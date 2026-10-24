// deck for live dj sets: renders every queued section to audio ahead of time
// and plays the set through PipeWire (pw-cat), so whoever writes the sections
// (an agent, a slow local model) only has to be done a few minutes before the
// current one ends. playback only streams finished audio, so it needs no VSCode,
// and rendering or validating in the background can't make it crackle
//
//   node dj.mjs start  <set-dir> <section.strudel.js> [--minutes 5] [--target <sink>]
//   node dj.mjs check  <set-dir> <section.strudel.js>
//   node dj.mjs queue  <set-dir> <section.strudel.js> [--force] [--replace]
//   node dj.mjs now    <set-dir> [<section.strudel.js>]
//   node dj.mjs unqueue <set-dir> [n]
//   node dj.mjs skip   <set-dir>
//   node dj.mjs status <set-dir> [--json]
//   node dj.mjs wait   <set-dir> [--max <sec>]
//   node dj.mjs stop   <set-dir>
//
// <set-dir> is live/<name>/ by convention
//
// start  checks the first section, renders it and plays it from bar 0 (stops
//        a set already playing from that directory). returns right away: the
//        music starts once the render is done, usually within a minute or two.
//        --target picks the PipeWire sink (pw-cat --target), default the system's
// check  the quick gate a section must pass: validate (parses, has events,
//        sounds exist, makes audio), same tempo as the set, and an 8-bar render
//        of its busiest part measured against the sections played before.
//        exit 1 = it would sound broken or jump in level
// queue  check, then add it to the end of the queue and render it in the
//        background: each queued section swaps in when the one before it ends.
//        one that isn't rendered by then swaps in on a later 16-bar phrase, and
//        the current section plays from its top again meanwhile.
//        --replace empties the queue first
// now    re-render the current section from its next 16-bar phrase on, from its
//        edited file (or another one), and swap that in on the first phrase
//        after it's rendered: for changes the user wants to hear right away.
//        it lasts until the section ends; if it loops, it loops as queued
// unqueue remove the n-th queued section (1 = next up), default the last one
// skip   cut the current section short: the next queued one swaps in on the
//        next 16-bar phrase instead of at the end
// status what plays, where in it, what's queued and rendered, and when to wake
//        up next: now while fewer than 2 sections are queued, else just after
//        the next swap
// wait   block until the next queued section has swapped in (exit 3 after --max
//        seconds, default 540, so it fits a tool timeout: just call it again)
//
// timing: 1 cycle = 1 bar. a background player (_play) streams the set to
// pw-cat and swaps sections on exact bar boundaries, counted in samples, so
// every section starts from its own bar 0. every section keeps the set's tempo:
// a different setcps breaks the bar math. renders (_render) and the checks run
// at the lowest cpu priority, the player at normal priority
//
// files in <set-dir>: dj.json (settings and queue, written by the commands),
// deck.json (what plays, written by the player), dj.log (swaps and errors),
// .queue/<id>/ (each section's snapshot and render, deleted once played)

import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArrange } from './arrange.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(here);
const AHEAD = 2; // sections to keep queued: a late wake-up then still has a whole section of slack
const PHRASE = 16; // bars: late sections, skips and `now` swap in on a phrase of the current one
const MARGIN = 3000; // ms: a skip needs at least this much notice
const RATE = 44100;
const BLOCK = 4096; // frames the player writes at a time
const FADE = 0.05; // s: what's cut off mid-section fades out under what comes in
const RENDER_WORKERS = Math.max(2, Math.floor(os.availableParallelism() / 2));
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
  const opts = { minutes: 5, force: false, replace: false, json: false, max: 540, target: null };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    if (['--force', '--replace', '--json'].includes(argv[i])) opts[argv[i].slice(2)] = true;
    else if (argv[i] === '--minutes' || argv[i] === '--max') opts[argv[i].slice(2)] = Number(argv[++i]);
    else if (argv[i] === '--target') opts.target = argv[++i];
    else rest.push(argv[i]);
  }
  const [command, set, file] = rest;
  const needsFile = ['start', 'check', 'queue'].includes(command);
  const takesFile = needsFile || command === 'now';
  const known = takesFile || ['unqueue', 'skip', 'status', 'wait', 'stop', '_play', '_render'].includes(command);
  if (!known || !set || (needsFile && !file)) {
    console.error('usage: node dj.mjs start|check|queue <set-dir> <section.strudel.js> | now <set-dir> [file] | unqueue|skip|status|wait|stop <set-dir>   (see the header)');
    process.exit(2);
  }
  if (takesFile && file && !fs.existsSync(file)) {
    console.error(`no such file: ${file}`);
    process.exit(2);
  }
  return { ...opts, command, set: path.resolve(set), file: takesFile && file ? path.resolve(file) : null, n: takesFile ? null : file };
}

// ---------------------------------------------------------------- state

// each file has one writer, so the player and the commands never overwrite
// each other's changes. writes go through a rename, so readers never see half a file
function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}
function writeJson(file, value) {
  fs.writeFileSync(`${file}.tmp`, JSON.stringify(value, null, 2) + '\n');
  fs.renameSync(`${file}.tmp`, file);
}
const stateFile = (set) => path.join(set, 'dj.json');
const deckFile = (set) => path.join(set, 'deck.json');
const readState = (set) => readJson(stateFile(set));
const writeState = (set, state) => writeJson(stateFile(set), state);
const readDeck = (set) => readJson(deckFile(set));
const logLine = (set, line) => fs.appendFileSync(path.join(set, 'dj.log'), `${new Date().toISOString()} ${line}\n`);

function requireState(set) {
  const state = readState(set);
  if (!state) {
    console.error(`no set in ${set}: node dj.mjs start <set-dir> <first section>`);
    process.exit(2);
  }
  if (state.live) {
    console.error(`${set} was played by the old VSCode deck: run start again to play it with this one`);
    process.exit(2);
  }
  return state;
}

const alive = (pid) => {
  try {
    return pid && process.kill(pid, 0);
  } catch {
    return false;
  }
};
const kill = (pid) => {
  try {
    if (pid) process.kill(pid);
  } catch {}
};
// renders run detached in their own process group: this stops render.mjs and its chromium too
const killGroup = (pid) => {
  try {
    if (pid) process.kill(-pid);
  } catch {}
};

// the queue minus what the player has played already
const pending = (state, deck) => state.queue.filter((q) => !deck?.played.includes(q.id));

// ---------------------------------------------------------------- timing

const barMs = (state) => 240000 / state.bpm;
// the player's t0 is when it wrote the set's first sample: close enough to when
// it was heard for planning, the swaps themselves are counted in samples
const barAt = (state, deck, ms) => (ms - deck.t0) / barMs(state);
const timeOf = (state, deck, bar) => deck.t0 + bar * barMs(state);

// the first phrase of the current section that's still far enough away
function nextPhrase(state, deck, now = Date.now()) {
  const since = barAt(state, deck, now + MARGIN) - deck.current.start;
  return deck.current.start + Math.max(1, Math.ceil(since / PHRASE)) * PHRASE;
}

// the queue with the bar each section should start at: the first one when the
// current section ends (or at the skip), the rest following on. a section that
// isn't rendered yet when its bar comes swaps in later than this
function schedule(state, deck, now = Date.now()) {
  const queue = pending(state, deck);
  if (!deck?.current) return queue.map((q) => ({ ...q, start: null }));
  const end = deck.current.start + deck.current.bars;
  let at = queue[0] && state.skip?.id === queue[0].id ? state.skip.bar : end;
  if (timeOf(state, deck, at) < now) at = nextPhrase(state, deck, now); // late: it plays from its top again meanwhile
  return queue.map((q) => {
    const entry = { ...q, start: at };
    at += q.bars;
    return entry;
  });
}

// ---------------------------------------------------------------- renders

const renderDir = (set, id) => path.join(set, '.queue', id);
const audioFile = (dir) => path.join(dir, 'mix.wav');

// 'ready', 'failed: ...', or 'rendering 40%'
function renderState(entry, state) {
  const done = readJson(path.join(entry.dir, 'done.json'));
  if (done?.error) return `failed: ${done.error}`;
  if (done) return 'ready';
  let size = 0;
  try {
    size = fs.statSync(audioFile(entry.dir)).size;
  } catch {}
  const frames = ((entry.bars - (entry.from ?? 0)) * RATE * 240) / state.bpm;
  return `rendering ${Math.min(99, Math.round((100 * Math.max(0, size - 44)) / 8 / frames))}%`;
}
const isReady = (entry) => fs.existsSync(path.join(entry.dir, 'done.json')) && !readJson(path.join(entry.dir, 'done.json'))?.error;

// render a snapshot in the background, at the lowest priority. the job reads
// what to render from entry.json, since the caller writes dj.json after this
function spawnRender(set, entry) {
  fs.mkdirSync(entry.dir, { recursive: true });
  writeJson(path.join(entry.dir, 'entry.json'), entry);
  const log = fs.openSync(path.join(entry.dir, 'render.log'), 'a');
  const child = spawn('nice', ['-n', '19', process.execPath, fileURLToPath(import.meta.url), '_render', set, entry.id], { detached: true, stdio: ['ignore', log, log] });
  child.unref();
  entry.render = child.pid;
}

function renderJob(opts) {
  const entry = readJson(path.join(renderDir(opts.set, opts.n), 'entry.json'));
  if (!entry) return;
  const started = Date.now();
  const args = [path.join(here, 'render.mjs'), entry.snapshot, '--out', entry.dir, '--workers', String(RENDER_WORKERS)];
  if (entry.from) args.push('--from', String(entry.from), '--chunk', '16');
  const r = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 26 });
  process.stdout.write(r.stdout ?? '');
  process.stderr.write(r.stderr ?? '');
  const done = r.status === 0 ? { took: round((Date.now() - started) / 1000) } : { error: (r.stderr || r.stdout || 'render failed').trim().split('\n').slice(-2).join(' ') };
  writeJson(path.join(entry.dir, 'done.json'), done);
  if (done.error) logLine(opts.set, `render of ${entry.file} failed: ${done.error}`);
}

function dropRender(entry) {
  killGroup(entry.render);
  fs.rmSync(entry.dir, { recursive: true, force: true });
}

// ---------------------------------------------------------------- the quick gate

// at the lowest priority, so it doesn't slow down anything else on the machine
function run(args) {
  const r = spawnSync('nice', ['-n', '19', ...args], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 26 });
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

// { ok, problems, notes, bars, bpm, lufs, peak }. levels: false skips the level render
function check(file, state, history = [], { levels = true } = {}) {
  const problems = [];
  const notes = [];
  const result = { ok: false, problems, notes };
  const rel = path.relative(root, file);

  const v = run([process.execPath, path.join(here, 'validate.mjs'), rel, '--bars', '2', '--workers', '2', '--json']);
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
    problems.push('no arrange(...): the deck needs one to know the section length');
    return result;
  }
  result.bars = arrangement.sections.reduce((n, s) => n + s.bars, 0);
  if (result.bars % 8) problems.push(`the arrange is ${result.bars} bars: make it a multiple of 8 so the next section lands on a phrase`);
  if (state && Math.abs(result.bpm - state.bpm) > 0.5) problems.push(`tempo is ${result.bpm} bpm, the set runs at ${state.bpm}: use the same setcps`);
  if (state && levels) {
    const target = state.minutes * state.bpm / 4;
    if (result.bars < target) notes.push(`${result.bars} bars is ${clock(result.bars * barMs(state))}, shorter than the set's ${state.minutes} min sections: you'll have less time to write the next one`);
    else if (result.bars > target * 2) notes.push(`${result.bars} bars is ${clock(result.bars * barMs(state))}, over twice the set's ${state.minutes} min sections`);
  }
  if (!levels) {
    result.ok = !problems.length;
    return result;
  }

  // levels: 8 bars of the busiest part, against what the set played so far
  const busiest = arrangement.sections.reduce((a, b) => (b.parts.length > a.parts.length ? b : a));
  const out = path.join(here, 'out', 'dj', path.basename(file).replace(/\.strudel\.js$|\.js$/, ''));
  const from = busiest.from;
  const to = Math.min(from + 8, from + busiest.bars);
  const r = run([process.execPath, path.join(here, 'render.mjs'), rel, '--from', String(from), '--to', String(to), '--tail', '2', '--workers', '1', '--out', out]);
  if (r.status !== 0) {
    problems.push(`render failed: ${r.err.trim().split('\n').slice(-3).join(' ')}`);
    return result;
  }
  const { lufs, peak } = loudness(path.join(out, 'mix.wav'));
  Object.assign(result, { lufs: round(lufs), peak: round(peak), measured: `bars ${from}-${to} (${busiest.parts.length} instruments)` });
  if (!(lufs > SILENT_LUFS)) problems.push(`bars ${from}-${to} measure ${round(lufs)} LUFS: next to silent`);
  if (peak > 0) notes.push(`true peak ${round(peak)} dBTP in bars ${from}-${to}: it may distort, lower the gain of the loudest parts`);
  const played = history.map((h) => h.lufs).filter(Number.isFinite);
  if (played.length && lufs > SILENT_LUFS) {
    const diff = round(lufs - median(played));
    const msg = `${diff > 0 ? '+' : ''}${diff} LU against the set so far (${round(median(played))} LUFS)`;
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

// snapshot a section, so editing its file afterwards doesn't change what plays unchecked
function entryFor(set, file, c, extra = {}) {
  const id = `${Date.now()}`;
  const dir = renderDir(set, id);
  fs.mkdirSync(dir, { recursive: true });
  const snapshot = path.join(dir, 'section.js'); // not *.strudel.js, so the VSCode extension doesn't react to it
  fs.copyFileSync(file, snapshot);
  return { id, file: path.relative(root, file), snapshot, dir, bars: c.bars, lufs: c.lufs, ...extra };
}

// ---------------------------------------------------------------- the player

// streams the set to pw-cat: the queued sections one after another, each from
// its own render, swapped on exact bar boundaries
async function play(opts) {
  const set = opts.set;
  // start registers this process's pid right after spawning it
  for (let i = 0; i < 30 && readState(set)?.player !== process.pid; i++) await sleep(100);
  let state = readState(set);
  if (state?.player !== process.pid) return;
  const barFrames = (RATE * 240) / state.bpm;
  const frameOf = (bar) => Math.round(bar * barFrames);
  const deck = { pid: process.pid, t0: null, frame: 0, current: null, played: [], history: [] };
  const save = () => writeJson(deckFile(set), deck);

  // the first section has to be rendered before anything plays
  for (;;) {
    state = readState(set) ?? state;
    if (state.player !== process.pid) return;
    const first = pending(state, deck)[0];
    if (first && isReady(first)) break;
    if (first && renderState(first, state).startsWith('failed')) {
      logLine(set, `the first section didn't render: ${renderState(first, state)}`);
      return;
    }
    await sleep(500);
  }

  // open renders, by directory: [fd, frames]
  const files = new Map();
  const open = (dir) => {
    if (!files.has(dir)) {
      const fd = fs.openSync(audioFile(dir), 'r');
      files.set(dir, [fd, (fs.fstatSync(fd).size - 44) / 8]);
    }
    return files.get(dir);
  };
  const close = (dir) => {
    if (files.has(dir)) fs.closeSync(files.get(dir)[0]);
    files.delete(dir);
  };
  // the take's audio for set frames [frame, frame + n), as interleaved stereo
  const read = (take, start, frame, n) => {
    const out = new Float32Array(n * 2);
    const [fd, frames] = open(take.dir);
    const at = frame - frameOf(start + take.from);
    const from = Math.max(0, at);
    const to = Math.min(frames, at + n);
    if (to > from) {
      const bytes = Buffer.alloc((to - from) * 8);
      fs.readSync(fd, bytes, 0, bytes.length, 44 + from * 8);
      out.set(new Float32Array(bytes.buffer, bytes.byteOffset, (to - from) * 2), (from - at) * 2);
    }
    return out;
  };

  // audio that spills over into what comes next: release and reverb tails at a
  // section's end, a short fade when a section is cut off
  let carry = new Float32Array(0);
  let carryAt = 0;
  const addCarry = (frame, samples) => {
    if (!carry.length) carryAt = frame;
    const start = Math.min(carryAt, frame);
    const end = Math.max(carryAt + carry.length / 2, frame + samples.length / 2);
    const merged = new Float32Array((end - start) * 2);
    merged.set(carry, (carryAt - start) * 2);
    for (let i = 0; i < samples.length; i++) merged[(frame - start) * 2 + i] += samples[i];
    carry = merged;
    carryAt = start;
  };
  const tailOf = (cur, frame) => {
    const [, frames] = open(cur.take.dir);
    const left = frames - (frame - frameOf(cur.start + cur.take.from));
    return left > 0 ? read(cur.take, cur.start, frame, left) : new Float32Array(0);
  };
  const fadeOf = (cur, frame) => {
    const n = Math.round(FADE * RATE);
    const audio = read(cur.take, cur.start, frame, n);
    for (let i = 0; i < n; i++) {
      audio[2 * i] *= 1 - i / n;
      audio[2 * i + 1] *= 1 - i / n;
    }
    return audio;
  };

  const sectionOf = (entry, start) => ({ id: entry.id, file: entry.file, start, bars: entry.bars, lufs: entry.lufs, base: { dir: entry.dir, from: 0 }, take: { dir: entry.dir, from: 0 } });
  const retire = (cur) => {
    for (const dir of new Set([cur.base.dir, cur.take.dir])) {
      close(dir);
      fs.rmSync(dir, { recursive: true, force: true });
    }
  };
  const swapIn = (entry, bar, how) => {
    const prev = deck.current;
    deck.current = sectionOf(entry, bar);
    deck.played.push(entry.id);
    deck.history.push({ file: entry.file, start: bar, bars: entry.bars, lufs: entry.lufs, at: new Date().toISOString() });
    if (prev) retire(prev);
    logLine(set, `${how} ${entry.file} at bar ${bar}`);
  };

  let late = false; // the current section has ended or been skipped, and what's next isn't rendered yet
  // runs on every bar line of the set, before that bar is written
  const decide = (bar) => {
    const cur = deck.current;
    const frame = frameOf(bar);
    const local = bar - cur.start;
    const ended = local >= cur.bars;
    const now = state.now;
    if (!ended && now?.of === cur.id && !deck.played.includes(now.id) && local >= now.from && local % PHRASE === 0 && isReady(now)) {
      addCarry(frame, fadeOf(cur, frame));
      if (cur.take.dir !== cur.base.dir) close(cur.take.dir);
      cur.take = { dir: now.dir, from: now.from };
      deck.played.push(now.id);
      logLine(set, `now: ${now.file} from bar ${local} of the section`);
      return save();
    }
    const head = pending(state, deck)[0];
    if (ended || (head && state.skip?.id === head.id && bar >= state.skip.bar)) late = true;
    if (!late) return;
    if (head && isReady(head) && (ended || local % PHRASE === 0)) {
      addCarry(frame, ended ? tailOf(cur, frame) : fadeOf(cur, frame));
      swapIn(head, bar, ended ? 'swap' : 'cut to');
      late = false;
      return save();
    }
    if (ended) {
      // nothing ready: the section plays from its top again, as queued
      addCarry(frame, tailOf(cur, frame));
      if (cur.take.dir !== cur.base.dir) close(cur.take.dir);
      cur.start = bar;
      cur.take = cur.base;
      logLine(set, `loop ${cur.file} at bar ${bar}: ${head ? `${head.file} is ${renderState(head, state)}` : 'nothing queued'}`);
      save();
    }
  };

  const first = pending(state, deck)[0];
  swapIn(first, 0, 'start');
  // its own application name, so the mixer remembers a volume for the dj and not for every pw-cat
  const props = `{ application.name = "strudel-dj" media.name = "${path.basename(set)}" }`;
  const args = ['--playback', '--format', 'f32', '--rate', String(RATE), '--channels', '2', '--media-role', 'Music', '-P', props];
  const out = spawn('pw-cat', [...args, ...(state.target ? ['--target', state.target] : []), '-'], { stdio: ['pipe', 'ignore', 'pipe'] });
  let failed = null;
  out.stdin.on('error', (err) => (failed ??= err.message));
  out.stderr.on('data', (d) => logLine(set, `pw-cat: ${String(d).trim()}`));
  out.on('exit', (code) => (failed ??= `pw-cat exited with ${code}`));

  let decided = -1;
  let saved = 0;
  for (;;) {
    state = readState(set) ?? state;
    if (state.player !== process.pid) break; // stopped, or the set was restarted
    if (failed) {
      logLine(set, `playback failed: ${failed}`);
      break;
    }
    const block = new Float32Array(BLOCK * 2);
    for (let i = 0; i < BLOCK; ) {
      const frame = deck.frame + i;
      let bar = Math.floor(frame / barFrames);
      while (frameOf(bar) > frame) bar--;
      while (frameOf(bar + 1) <= frame) bar++;
      if (frameOf(bar) === frame && bar !== decided) {
        decided = bar;
        decide(bar);
      }
      const n = Math.min(BLOCK - i, frameOf(bar + 1) - frame);
      block.set(read(deck.current.take, deck.current.start, frame, n), i * 2);
      i += n;
    }
    if (carry.length) {
      const n = Math.min(BLOCK - (carryAt - deck.frame), carry.length / 2);
      for (let i = 0; i < n * 2; i++) block[(carryAt - deck.frame) * 2 + i] += carry[i];
      carry = carry.subarray(n * 2);
      carryAt += n;
    }
    deck.t0 ??= Date.now();
    deck.frame += BLOCK;
    if (!out.stdin.write(Buffer.from(block.buffer))) await new Promise((r) => out.stdin.once('drain', r));
    if (Date.now() - saved > 1000) {
      saved = Date.now();
      save();
    }
  }
  out.stdin.end();
  kill(out.pid);
  for (const dir of files.keys()) close(dir);
}

// ---------------------------------------------------------------- commands

function stopEverything(set, state) {
  kill(state.player);
  kill(state.deck); // the old VSCode deck
  for (const q of [...state.queue, ...(state.now ? [state.now] : [])]) killGroup(q.render);
  fs.rmSync(path.join(set, '.queue'), { recursive: true, force: true });
}

async function start(opts) {
  const c = check(opts.file, null);
  printCheck(opts.file, c);
  if (!c.ok) process.exit(1);
  fs.mkdirSync(opts.set, { recursive: true });
  const old = readState(opts.set);
  if (old) stopEverything(opts.set, old);
  fs.rmSync(deckFile(opts.set), { force: true });

  const entry = entryFor(opts.set, opts.file, c);
  const state = { bpm: c.bpm, minutes: opts.minutes, target: opts.target, queue: [entry], skip: null, now: null, player: null };
  spawnRender(opts.set, entry);
  const log = fs.openSync(path.join(opts.set, 'dj.log'), 'a');
  const player = spawn(process.execPath, [fileURLToPath(import.meta.url), '_play', opts.set], { detached: true, stdio: ['ignore', log, log] });
  player.unref();
  state.player = player.pid;
  writeState(opts.set, state);
  logLine(opts.set, `start ${entry.file} (${c.bars} bars at ${c.bpm} bpm)`);
  console.log(`rendering ${entry.file} (${clock(c.bars * barMs(state))} of audio): it starts playing when that's done, usually within a minute or two. status shows when`);
}

function queue(opts) {
  const state = requireState(opts.set);
  const deck = readDeck(opts.set);
  const c = check(opts.file, state, deck?.history);
  printCheck(opts.file, c);
  if (!c.ok && !opts.force) process.exit(1);
  state.queue = pending(state, deck); // forget what's been played
  if (opts.replace) {
    for (const q of state.queue) dropRender(q);
    state.queue = [];
    state.skip = null;
  }
  const entry = entryFor(opts.set, opts.file, c);
  spawnRender(opts.set, entry);
  state.queue.push(entry);
  writeState(opts.set, state);

  const me = schedule(state, deck).at(-1);
  if (me.start === null) return console.log(`queued #${state.queue.length}: rendering; the set hasn't started playing yet`);
  console.log(`queued #${state.queue.length}: rendering now, swaps in at bar ${me.start}, in ${clock(timeOf(state, deck, me.start) - Date.now())}`);
  if (!alive(state.player)) console.log('warning: the player isn\'t running: start the set again');
}

function now(opts) {
  const state = requireState(opts.set);
  const deck = readDeck(opts.set);
  if (!deck?.current) {
    console.error('nothing is playing yet');
    process.exit(1);
  }
  const file = opts.file ?? path.join(root, deck.current.file);
  const c = check(file, state, [], { levels: false });
  printCheck(file, c);
  if (!c.ok && !opts.force) process.exit(1);
  if (c.bars !== deck.current.bars) {
    console.error(`it's ${c.bars} bars and the playing section is ${deck.current.bars}: keep the length for now, or queue it instead`);
    process.exit(1);
  }
  const from = nextPhrase(state, deck) - deck.current.start;
  if (from >= deck.current.bars) {
    console.error('the section ends before its next phrase: queue the change with the next section instead');
    process.exit(1);
  }
  if (state.now) dropRender(state.now);
  state.now = entryFor(opts.set, file, c, { of: deck.current.id, from });
  spawnRender(opts.set, state.now);
  writeState(opts.set, state);
  console.log(`rendering ${path.relative(root, file)} from bar ${from} of the section: it swaps in on the first 16-bar phrase after the render is done (status shows it)`);
}

function unqueue(opts) {
  const state = requireState(opts.set);
  state.queue = pending(state, readDeck(opts.set));
  if (!state.queue.length) return console.log('nothing queued');
  const n = opts.n === null || opts.n === undefined ? state.queue.length : Number(opts.n);
  if (!(n >= 1 && n <= state.queue.length)) {
    console.error(`no #${opts.n} in the queue: it has ${state.queue.length}`);
    process.exit(2);
  }
  const [gone] = state.queue.splice(n - 1, 1);
  dropRender(gone);
  if (state.skip?.id === gone.id) state.skip = state.queue[0] ? { ...state.skip, id: state.queue[0].id } : null;
  writeState(opts.set, state);
  console.log(`removed #${n} ${gone.file}, ${state.queue.length} left`);
}

function skip(opts) {
  const state = requireState(opts.set);
  const deck = readDeck(opts.set);
  const head = schedule(state, deck)[0];
  if (!head || !deck?.current) {
    console.error('nothing queued to skip to: queue a section first');
    process.exit(1);
  }
  const at = nextPhrase(state, deck);
  if (at >= head.start) return console.log(`the next section already swaps in at bar ${head.start}, in ${clock(timeOf(state, deck, head.start) - Date.now())}`);
  state.skip = { id: head.id, bar: at };
  writeState(opts.set, state);
  logLine(opts.set, `skip: ${head.file} moved to bar ${at}`);
  const ready = isReady(head) ? '' : ` once it's rendered (${renderState(head, state)})`;
  console.log(`skipping: ${head.file} swaps in at bar ${at}, in ${clock(timeOf(state, deck, at) - Date.now())}${ready}`);
}

function status(opts) {
  const state = requireState(opts.set);
  const deck = readDeck(opts.set);
  const playing = Boolean(deck?.current && alive(state.player));
  const now = Date.now();
  const planned = schedule(state, deck, now);
  const fmt = (q) => ({ file: q.file, start: q.start, in: q.start == null ? null : Math.round((timeOf(state, deck, q.start) - now) / 1000), render: renderState(q, state) });
  if (!deck?.current) {
    const first = state.queue[0];
    const s = { bpm: state.bpm, playing: null, starting: first ? fmt(first) : null, player: Boolean(alive(state.player)), queue: planned.slice(1).map(fmt), ahead: planned.length - 1, target: AHEAD, wakeIn: 0 };
    if (opts.json) return console.log(JSON.stringify(s, null, 2));
    console.log(`${path.relative(process.cwd(), opts.set)} · ${state.bpm} bpm · not playing yet`);
    if (first) console.log(`starting ${first.file}: ${s.starting.render}`);
    if (!s.player) console.log('warning  the player isn\'t running: run start again (dj.log says why)');
    console.log(`wake     now: write and queue the next ${AHEAD} sections while the first one renders`);
    return;
  }
  const cur = deck.current;
  const into = barAt(state, deck, now) - cur.start;
  const next = planned[0]?.start ?? cur.start + cur.bars;
  const wake = planned.length >= AHEAD ? Math.round((timeOf(state, deck, next) - now) / 1000) + 5 : 0;
  const s = {
    bpm: state.bpm,
    section: deck.history.length,
    playing: cur.file,
    bar: Math.max(0, Math.floor(into)),
    bars: cur.bars,
    endsIn: Math.round((timeOf(state, deck, next) - now) / 1000),
    ahead: planned.length,
    target: AHEAD,
    queue: planned.map(fmt),
    now: state.now && !deck.played.includes(state.now.id) && state.now.of === cur.id ? { file: state.now.file, from: state.now.from, render: renderState(state.now, state) } : null,
    wakeIn: wake,
    player: playing,
  };
  if (opts.json) return console.log(JSON.stringify(s, null, 2));
  console.log(`${path.relative(process.cwd(), opts.set)} · ${state.bpm} bpm · section ${s.section}`);
  console.log(`playing  ${cur.file}  bar ${s.bar + 1}/${cur.bars}`);
  if (s.now) console.log(`now      ${s.now.file} from bar ${s.now.from}: ${s.now.render}`);
  planned.forEach((q, i) => {
    const late = !isReady(q) && i === 0 && s.queue[0].in < 60 ? ' (may swap in late: the current section plays from its top again until it is)' : '';
    console.log(`${i ? '        ' : 'queued  '} #${i + 1} ${q.file}  in ${clock(timeOf(state, deck, q.start) - now)} at bar ${q.start}, ${renderState(q, state)}${late}`);
  });
  if (!planned.length) console.log(`queued   nothing: the section plays from its top again in ${clock(timeOf(state, deck, next) - now)} unless something is queued`);
  console.log(`wake     ${wake ? `in ${clock(wake * 1000)}, just after the next swap` : `now: ${planned.length} of ${AHEAD} sections queued, write and queue ${AHEAD - planned.length} more before sleeping`}`);
  if (!playing) console.log('warning  the player isn\'t running: the music stopped. dj.log says why; start the set again with the current section');
}

async function wait(opts) {
  const until = Date.now() + opts.max * 1000;
  const state = requireState(opts.set);
  const swaps = readDeck(opts.set)?.history.length ?? 0;
  if (!pending(state, readDeck(opts.set)).length) return status(opts);
  while (Date.now() < until) {
    const deck = readDeck(opts.set);
    if ((deck?.history.length ?? 0) !== swaps || !alive(readState(opts.set)?.player)) return status(opts);
    await sleep(1000);
  }
  console.log('still waiting for the swap: run wait again');
  process.exit(3);
}

function stop(opts) {
  const state = requireState(opts.set);
  stopEverything(opts.set, state);
  Object.assign(state, { queue: [], skip: null, now: null, player: null });
  writeState(opts.set, state);
  logLine(opts.set, 'stop');
  console.log('stopped');
}

const opts = parseArgs(process.argv.slice(2));
if (opts.command === 'start') await start(opts);
else if (opts.command === 'check') {
  const state = readState(opts.set);
  const c = check(opts.file, state, readDeck(opts.set)?.history);
  printCheck(opts.file, c);
  process.exit(c.ok ? 0 : 1);
} else if (opts.command === 'queue') queue(opts);
else if (opts.command === 'now') now(opts);
else if (opts.command === 'unqueue') unqueue(opts);
else if (opts.command === 'skip') skip(opts);
else if (opts.command === 'status') status(opts);
else if (opts.command === 'wait') await wait(opts);
else if (opts.command === 'stop') stop(opts);
else if (opts.command === '_play') await play(opts);
else if (opts.command === '_render') renderJob(opts);
