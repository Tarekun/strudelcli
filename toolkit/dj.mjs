// deck for live dj sets: plays one section at a time through the strudel-remote
// extension and swaps in the next section on time, so whoever writes the
// sections (an agent, a slow local model) only has to be done before the
// current one ends
//
//   node dj.mjs start  <set-dir> <section.strudel.js> [--minutes 5]
//   node dj.mjs check  <set-dir> <section.strudel.js>
//   node dj.mjs queue  <set-dir> <section.strudel.js> [--force] [--replace]
//   node dj.mjs unqueue <set-dir> [n]
//   node dj.mjs skip   <set-dir>
//   node dj.mjs status <set-dir> [--json]
//   node dj.mjs wait   <set-dir> [--max <sec>]
//   node dj.mjs stop   <set-dir>
//
// <set-dir> is live/<name>/ by convention
//
// start  checks the first section, copies it to <set-dir>/live.strudel.js and
//        plays it from bar 0 (stops whatever plays)
// check  the quick gate a section must pass: validate (parses, has events,
//        sounds exist, makes audio), same tempo as the set, and an 8-bar render
//        of its busiest part measured against the sections played before.
//        exit 1 = it would sound broken or jump in level
// queue  check, then add it to the end of the queue: each queued section swaps
//        in when the one before it ends. a background process does the swaps,
//        the caller can go away. late? it swaps at the next 16-bar phrase.
//        --replace empties the queue first
// unqueue remove the n-th queued section (1 = next up), default the last one
// skip   cut the current section short: the next queued one swaps in on the
//        next 16-bar phrase instead of at the end
// status what plays, where in it, what's queued, and when to wake up next:
//        now while fewer than 2 sections are queued, else just after the next swap
// wait   block until the next queued section has swapped in (exit 3 after --max
//        seconds, default 540, so it fits a tool timeout: just call it again)
//
// timing: 1 cycle = 1 bar, and the set's clock starts at the extension's
// strudel.play. each section's arrange is shifted with .late(<start bar>) in the
// live file, so it starts from its own bar 0 whenever it's swapped in. every
// section keeps the set's tempo: a different setcps breaks the bar math
//
// state lives in <set-dir>/dj.json, swap history in <set-dir>/dj.log, queued
// sections are snapshotted to <set-dir>/.queue/ when queued

import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArrange } from './arrange.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(here); // the vscode workspace: .strudel-remote and its log live here
const REMOTE = path.join(root, '.strudel-remote');
const REMOTE_LOG = path.join(root, '.strudel-remote.log');
const AHEAD = 2; // sections to keep queued: a late wake-up then still has a whole section of slack
const PHRASE = 16; // bars: a late section swaps in on the next phrase of the current one
const MARGIN = 3000; // ms: a swap needs at least this much notice
const LEVEL_WARN = 3; // LU from the set's median: noticeable jump
const LEVEL_FAIL = 6; // LU: the crowd reaches for the volume knob
const SILENT_LUFS = -45;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clock = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const round = (x) => Math.round(x * 10) / 10;

function parseArgs(argv) {
  const opts = { minutes: 5, force: false, replace: false, json: false, max: 540 };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    if (['--force', '--replace', '--json'].includes(argv[i])) opts[argv[i].slice(2)] = true;
    else if (argv[i] === '--minutes' || argv[i] === '--max') opts[argv[i].slice(2)] = Number(argv[++i]);
    else rest.push(argv[i]);
  }
  const [command, set, file] = rest;
  const needsFile = ['start', 'check', 'queue'].includes(command);
  const known = needsFile || ['unqueue', 'skip', 'status', 'wait', 'stop', '_deck'].includes(command);
  if (!known || !set || (needsFile && !file)) {
    console.error('usage: node dj.mjs start|check|queue <set-dir> <section.strudel.js> | unqueue|skip|status|wait|stop <set-dir>   (see the header)');
    process.exit(2);
  }
  if (needsFile && !fs.existsSync(file)) {
    console.error(`no such file: ${file}`);
    process.exit(2);
  }
  return { ...opts, command, set: path.resolve(set), file: needsFile ? path.resolve(file) : null, n: needsFile ? null : file };
}

// ---------------------------------------------------------------- state

const stateFile = (set) => path.join(set, 'dj.json');
const readState = (set) => (fs.existsSync(stateFile(set)) ? JSON.parse(fs.readFileSync(stateFile(set), 'utf8')) : null);
const writeState = (set, state) => fs.writeFileSync(stateFile(set), JSON.stringify(state, null, 2) + '\n');
const logSwap = (set, line) => fs.appendFileSync(path.join(set, 'dj.log'), `${new Date().toISOString()} ${line}\n`);

function requireState(set) {
  const state = readState(set);
  if (!state) {
    console.error(`no set running in ${set}: node dj.mjs start <set-dir> <first section>`);
    process.exit(2);
  }
  return state;
}

const barMs = (state) => 240000 / state.bpm;
const barAt = (state, ms) => (ms - state.t0) / barMs(state);
const timeOf = (state, bar) => state.t0 + bar * barMs(state);

// the first phrase of the current section that's still far enough away
function nextPhrase(state, now = Date.now()) {
  const since = barAt(state, now + MARGIN) - state.current.start;
  return state.current.start + Math.max(1, Math.ceil(since / PHRASE)) * PHRASE;
}

// the bar the next section starts at: when the current one ends, or, when that
// has passed already, the next phrase of the current one
function nextStart(state, now = Date.now()) {
  const end = state.current.start + state.current.bars;
  return timeOf(state, end) - now > MARGIN ? end : nextPhrase(state, now);
}

// the queue with the bar each section will start at: the first one's is fixed
// once the deck picks it up, the rest follow on from each other
function schedule(state, now = Date.now()) {
  let at = state.queue[0]?.start ?? nextStart(state, now);
  return state.queue.map((q) => {
    const entry = { ...q, start: at };
    at += q.bars;
    return entry;
  });
}

// ---------------------------------------------------------------- the extension

function remoteLog(since) {
  if (!fs.existsSync(REMOTE_LOG)) return [];
  return fs
    .readFileSync(REMOTE_LOG, 'utf8')
    .split('\n')
    .map((line) => ({ at: Date.parse(line.slice(0, 24)), msg: line.slice(25) }))
    .filter((l) => l.at >= since);
}

async function remoteSaw(since, test, ms) {
  for (let t = 0; t < ms; t += 100) {
    const hit = remoteLog(since).find((l) => test(l.msg));
    if (hit) return hit;
    await sleep(100);
  }
  return null;
}

async function remote(command, test, ms = 3000) {
  const since = Date.now() - 50; // the log's clock and ours are the same machine, but stamps are ms-rounded
  fs.writeFileSync(REMOTE, command + '\n');
  return remoteSaw(since, test, ms);
}

// ---------------------------------------------------------------- the quick gate

function run(args) {
  const r = spawnSync(args[0], args.slice(1), { cwd: root, encoding: 'utf8', maxBuffer: 1 << 26 });
  return { status: r.status, out: r.stdout, err: r.stderr };
}

function loudness(file) {
  const r = run(['ffmpeg', '-nostats', '-hide_banner', '-i', file, '-filter_complex', 'ebur128=peak=true', '-f', 'null', '-']);
  const summary = r.err.slice(r.err.lastIndexOf('Summary:'));
  const get = (key) => Number(summary.match(new RegExp(`${key}:\\s+(-?[\\d.]+|-inf)`))?.[1] ?? NaN);
  return { lufs: get('I'), peak: get('Peak') };
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

// { ok, problems, notes, bars, bpm, lufs, peak }
function check(file, state) {
  const problems = [];
  const notes = [];
  const result = { ok: false, problems, notes };
  const rel = path.relative(root, file);

  const v = run([process.execPath, path.join(here, 'validate.mjs'), rel, '--bars', '2', '--json']);
  let report;
  try {
    report = JSON.parse(v.out);
  } catch {
    problems.push(`validate couldn't run: ${(v.err || v.out).trim().split('\n').slice(-3).join(' ')}`);
    return result;
  }
  for (const c of report.checks) {
    if (c.status === 'error') problems.push(`${c.check}: ${c.message}`);
    else if (c.status === 'warn') notes.push(`${c.check}: ${c.message}`);
  }
  result.bpm = Number(report.checks.find((c) => c.check === 'evaluate')?.message.match(/= ([\d.]+) bpm/)?.[1]);
  if (problems.length) return result;

  const arrangement = parseArrange(fs.readFileSync(file, 'utf8'));
  if (!arrangement?.sections.length) {
    problems.push('no arrange(...): the deck needs one to know the section length and to shift it into place');
    return result;
  }
  result.bars = arrangement.sections.reduce((n, s) => n + s.bars, 0);
  if (result.bars % 8) problems.push(`the arrange is ${result.bars} bars: make it a multiple of 8 so the next section lands on a phrase`);
  if (state && Math.abs(result.bpm - state.bpm) > 0.5) problems.push(`tempo is ${result.bpm} bpm, the set runs at ${state.bpm}: use the same setcps`);
  if (state) {
    const target = state.minutes * state.bpm / 4;
    if (result.bars < target) notes.push(`${result.bars} bars is ${clock(result.bars * barMs(state))}, shorter than the set's ${state.minutes} min sections: you'll have less time to write the next one`);
    else if (result.bars > target * 2) notes.push(`${result.bars} bars is ${clock(result.bars * barMs(state))}, over twice the set's ${state.minutes} min sections`);
  }

  // levels: 8 bars of the busiest part, against what the set played so far
  const busiest = arrangement.sections.reduce((a, b) => (b.parts.length > a.parts.length ? b : a));
  const out = path.join(here, 'out', 'dj', path.basename(file).replace(/\.strudel\.js$|\.js$/, ''));
  const from = busiest.from;
  const to = Math.min(from + 8, from + busiest.bars);
  const r = run([process.execPath, path.join(here, 'render.mjs'), rel, '--from', String(from), '--to', String(to), '--tail', '2', '--out', out]);
  if (r.status !== 0) {
    problems.push(`render failed: ${r.err.trim().split('\n').slice(-3).join(' ')}`);
    return result;
  }
  const { lufs, peak } = loudness(path.join(out, 'mix.wav'));
  Object.assign(result, { lufs: round(lufs), peak: round(peak), measured: `bars ${from}-${to} (${busiest.parts.length} instruments)` });
  if (!(lufs > SILENT_LUFS)) problems.push(`bars ${from}-${to} measure ${round(lufs)} LUFS: next to silent`);
  if (peak > 0) notes.push(`true peak ${round(peak)} dBTP in bars ${from}-${to}: it may distort, lower the gain of the loudest parts`);
  const levels = (state?.history ?? []).map((h) => h.lufs).filter(Number.isFinite);
  if (levels.length && lufs > SILENT_LUFS) {
    const diff = round(lufs - median(levels));
    const msg = `${diff > 0 ? '+' : ''}${diff} LU against the set so far (${round(median(levels))} LUFS)`;
    if (Math.abs(diff) > LEVEL_FAIL) problems.push(`${msg}: bring the gains ${diff > 0 ? 'down' : 'up'}`);
    else if (Math.abs(diff) > LEVEL_WARN) notes.push(msg);
  }
  result.ok = !problems.length;
  return result;
}

function printCheck(file, c) {
  console.log(`${c.ok ? 'OK' : 'FAIL'}  ${path.relative(process.cwd(), file)}${c.bars ? `  ${c.bars} bars` : ''}${c.bpm ? ` at ${c.bpm} bpm` : ''}${Number.isFinite(c.lufs) ? `, ${c.lufs} LUFS / ${c.peak} dBTP in ${c.measured}` : ''}`);
  for (const p of c.problems) console.log(`  error: ${p}`);
  for (const n of c.notes) console.log(`  warning: ${n}`);
}

// ---------------------------------------------------------------- the live file

const liveFile = (set) => path.join(set, 'live.strudel.js');

// the section, its arrange shifted so it starts at bar `start` of the set
function shifted(file, start, code = fs.readFileSync(file, 'utf8')) {
  const { end } = parseArrange(code);
  const header = `// live: ${path.basename(file)} from bar ${start} of the set, written by toolkit/dj.mjs\n`;
  return header + (start ? `${code.slice(0, end)}.late(${start})${code.slice(end)}` : code);
}

// ---------------------------------------------------------------- commands

async function start(opts) {
  const c = check(opts.file, null);
  printCheck(opts.file, c);
  if (!c.ok) process.exit(1);
  const old = readState(opts.set);
  if (old?.deck) kill(old.deck);

  fs.mkdirSync(opts.set, { recursive: true });
  const live = liveFile(opts.set);
  const rel = path.relative(root, live);
  fs.writeFileSync(live, shifted(opts.file, 0));
  await remote('stop', (m) => m.startsWith('strudel.stop'), 2000);
  await sleep(300);
  const played = await remote(`play ${rel}`, (m) => m.startsWith('strudel.play'), 6000);
  if (!played) {
    console.error('the extension never logged strudel.play: is VSCode open on this folder with Strudel and strudel-remote enabled?');
    process.exit(2);
  }
  const entry = { file: path.relative(root, opts.file), start: 0, bars: c.bars, lufs: c.lufs, at: new Date(played.at).toISOString() };
  writeState(opts.set, { bpm: c.bpm, minutes: opts.minutes, t0: played.at, lead: 0.5, live: rel, current: entry, queue: [], deck: null, history: [entry] });
  logSwap(opts.set, `start ${entry.file} (${c.bars} bars at ${c.bpm} bpm)`);
  console.log(`playing ${rel} from bar 0; it ends in ${clock(c.bars * 240000 / c.bpm)}`);
}

function kill(pid) {
  try {
    process.kill(pid);
  } catch {}
}

const alive = (pid) => {
  try {
    return pid && process.kill(pid, 0);
  } catch {
    return false;
  }
};

// state from before the queue existed had a single `queued`
function upgrade(state) {
  state.queue ??= [];
  delete state.queued;
  return state;
}

// make sure the background deck runs while anything is queued
function ensureDeck(set, state) {
  if (alive(state.deck)) return;
  const log = () => fs.openSync(path.join(set, 'dj.log'), 'a');
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), '_deck', set], { detached: true, stdio: ['ignore', log(), log()] });
  child.unref();
  state.deck = child.pid;
}

function queue(opts) {
  const state = upgrade(requireState(opts.set));
  const c = check(opts.file, state);
  printCheck(opts.file, c);
  if (!c.ok && !opts.force) process.exit(1);
  if (opts.replace) {
    for (const q of state.queue) fs.rmSync(q.snapshot, { force: true });
    state.queue = [];
  }

  // snapshot it, so editing the file afterwards doesn't change what plays unchecked
  const id = `${Date.now()}`;
  const snapshot = path.join(opts.set, '.queue', `${id}.js`); // not *.strudel.js, so the extension doesn't react to it
  fs.mkdirSync(path.dirname(snapshot), { recursive: true });
  fs.copyFileSync(opts.file, snapshot);
  state.queue.push({ id, file: path.relative(root, opts.file), snapshot, bars: c.bars, lufs: c.lufs });
  ensureDeck(opts.set, state);
  writeState(opts.set, state);

  const planned = schedule(state);
  const me = planned.at(-1);
  const late = planned.length === 1 && me.start !== state.current.start + state.current.bars;
  console.log(`queued #${planned.length}: swaps in at bar ${me.start}, in ${clock(timeOf(state, me.start) - Date.now())}${late ? ' (too late for its end: the current section plays from its top again until the next phrase)' : ''}`);
}

function unqueue(opts) {
  const state = upgrade(requireState(opts.set));
  if (!state.queue.length) return console.log('nothing queued');
  const n = opts.n === null || opts.n === undefined ? state.queue.length : Number(opts.n);
  if (!(n >= 1 && n <= state.queue.length)) {
    console.error(`no #${opts.n} in the queue: it has ${state.queue.length}`);
    process.exit(2);
  }
  const [gone] = state.queue.splice(n - 1, 1);
  fs.rmSync(gone.snapshot, { force: true });
  // the next section up now starts where the removed one would have
  if (n === 1 && state.queue.length) state.queue[0].start = gone.start;
  writeState(opts.set, state);
  console.log(`removed #${n} ${gone.file}, ${state.queue.length} left`);
}

function skip(opts) {
  const state = upgrade(requireState(opts.set));
  if (!state.queue.length) {
    console.error('nothing queued to skip to: queue a section first');
    process.exit(1);
  }
  const at = nextPhrase(state);
  const head = schedule(state)[0];
  if (at >= head.start) return console.log(`the next section already swaps in at bar ${head.start}, in ${clock(timeOf(state, head.start) - Date.now())}`);
  state.queue[0].start = at;
  writeState(opts.set, state);
  logSwap(opts.set, `skip: ${head.file} moved to bar ${at}`);
  console.log(`skipping: ${head.file} swaps in at bar ${at}, in ${clock(timeOf(state, at) - Date.now())}`);
}

// the background deck: swaps the queued sections in, one after another, then exits
async function deck(opts) {
  // queue registers this process's pid right after spawning it
  for (let i = 0; i < 30 && readState(opts.set)?.deck !== process.pid; i++) await sleep(100);
  for (;;) {
    let state = upgrade(readState(opts.set));
    if (state.deck !== process.pid) return; // replaced, or the set was restarted
    const head = state.queue[0];
    if (!head) {
      state.deck = null;
      return writeState(opts.set, state);
    }
    if (head.start === undefined) {
      head.start = nextStart(state);
      writeState(opts.set, state);
    }
    const left = timeOf(state, head.start) - state.lead * 1000 - Date.now();
    if (left > 0) {
      await sleep(Math.min(left, 1000)); // short naps, to notice skips and unqueues
      continue;
    }
    const live = path.join(root, state.live);
    const wrote = Date.now();
    fs.writeFileSync(live, shifted(head.file, head.start, fs.readFileSync(head.snapshot, 'utf8')));

    // the extension updates on its own when live.strudel.js is the active editor;
    // when the user is looking at another file it skips, so ask it explicitly
    const name = path.basename(live);
    let hit = await remoteSaw(wrote, (m) => m === 'strudel.update ' || m === 'strudel.update' || m.startsWith(`skip ${name}`), 2500);
    if (hit?.msg.startsWith('skip')) hit = await remote(`update ${state.live}`, (m) => m.startsWith('strudel.update'), 2500);
    const updated = hit?.msg.startsWith('strudel.update');

    state = upgrade(readState(opts.set)); // a queue command may have run meanwhile
    const offset = updated ? round((hit.at - timeOf(state, head.start)) / 1000) : null;
    if (updated && hit.msg.trim() === 'strudel.update') state.lead = Math.min(2, Math.max(0.1, round((hit.at - wrote) / 1000 + 0.05)));
    const entry = { file: head.file, start: head.start, bars: head.bars, lufs: head.lufs, at: new Date(wrote).toISOString(), offset };
    state.current = entry;
    state.history.push(entry);
    state.queue = state.queue.filter((q) => q.id !== head.id);
    if (state.queue[0]) delete state.queue[0].start; // it follows on from this one
    writeState(opts.set, state);
    fs.rmSync(head.snapshot, { force: true });
    logSwap(opts.set, updated ? `swap ${head.file} at bar ${head.start}, evaluated ${offset >= 0 ? '+' : ''}${offset}s from the downbeat` : `swap ${head.file} at bar ${head.start}: NO strudel.update in the extension log, it may still play the old section`);
  }
}

function status(opts) {
  const state = upgrade(requireState(opts.set));
  const now = Date.now();
  const cur = state.current;
  const into = barAt(state, now) - cur.start;
  const planned = schedule(state, now);
  const next = planned[0]?.start ?? nextStart(state, now);
  // with fewer than AHEAD queued: write now. otherwise wake just after the next
  // swap, when the queue is one short again
  const wake = planned.length >= AHEAD ? Math.round((timeOf(state, next) - now) / 1000) + 5 : 0;
  const s = {
    bpm: state.bpm,
    section: state.history.length,
    playing: cur.file,
    bar: Math.floor(into) % cur.bars,
    bars: cur.bars,
    looped: into >= cur.bars,
    endsIn: Math.round((timeOf(state, next) - now) / 1000),
    ahead: planned.length,
    target: AHEAD,
    queue: planned.map((q) => ({ file: q.file, start: q.start, in: Math.round((timeOf(state, q.start) - now) / 1000) })),
    wakeIn: wake,
    deck: planned.length ? Boolean(alive(state.deck)) : null,
    lead: state.lead,
    lastSwap: state.history.length > 1 ? state.history.at(-1).offset : null,
  };
  if (opts.json) return console.log(JSON.stringify(s, null, 2));
  console.log(`${path.relative(process.cwd(), opts.set)} · ${state.bpm} bpm · section ${s.section}`);
  console.log(`playing  ${cur.file}  bar ${s.bar + 1}/${cur.bars}${s.looped ? '  (past its end: it restarted, queue the next one now)' : ''}`);
  if (planned.length) planned.forEach((q, i) => console.log(`${i ? '        ' : 'queued  '} #${i + 1} ${q.file}  in ${clock(timeOf(state, q.start) - now)} at bar ${q.start}`));
  else console.log(`queued   nothing: the next section can start in ${clock(timeOf(state, next) - now)} (bar ${next}) if queued before then`);
  console.log(`wake     ${wake ? `in ${clock(wake * 1000)}, just after the next swap` : `now: ${planned.length} of ${AHEAD} sections queued, write and queue ${AHEAD - planned.length} more before sleeping`}`);
  if (s.deck === false) console.log('warning  the background deck isn\'t running: queue something again to restart it');
  if (s.lastSwap !== null && Math.abs(s.lastSwap) > 0.3) console.log(`note     the last swap evaluated ${s.lastSwap}s from its downbeat (lead is now ${state.lead}s)`);
}

async function wait(opts) {
  const until = Date.now() + opts.max * 1000;
  let state = upgrade(requireState(opts.set));
  if (!state.queue.length) return status(opts);
  const swaps = state.history.length;
  while (Date.now() < until) {
    state = readState(opts.set);
    if (state.history.length !== swaps || !state.queue?.length) return status(opts);
    await sleep(1000);
  }
  console.log('still waiting for the swap: run wait again');
  process.exit(3);
}

async function stop(opts) {
  const state = upgrade(requireState(opts.set));
  if (state.deck) kill(state.deck);
  for (const q of state.queue) fs.rmSync(q.snapshot, { force: true });
  state.queue = [];
  state.deck = null;
  writeState(opts.set, state);
  await remote('stop', (m) => m.startsWith('strudel.stop'), 2000);
  logSwap(opts.set, 'stop');
  console.log('stopped');
}

const opts = parseArgs(process.argv.slice(2));
if (opts.command === 'start') await start(opts);
else if (opts.command === 'check') {
  const c = check(opts.file, readState(opts.set));
  printCheck(opts.file, c);
  process.exit(c.ok ? 0 : 1);
} else if (opts.command === 'queue') queue(opts);
else if (opts.command === 'unqueue') unqueue(opts);
else if (opts.command === 'skip') skip(opts);
else if (opts.command === '_deck') await deck(opts);
else if (opts.command === 'status') status(opts);
else if (opts.command === 'wait') await wait(opts);
else if (opts.command === 'stop') await stop(opts);
