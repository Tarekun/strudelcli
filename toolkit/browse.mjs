// browse sounds by how they sound, not by name: every sample of a kind (all
// kicks, all claps, ...) is rendered once and measured, so you can ask for
// "like this one", "like this one but longer and darker", or "the brightest
// hats", then hear the candidates in a numbered audition reel
//
//   strudelcli browse list <kind> [--sort <feature>] [--top n]
//   strudelcli browse like <sound> [--more <feature>] [--less <feature>] [--kind <kind>] [--top n]
//   strudelcli browse audition <candidate ...> [options]
//
// kind      a sound name or drum abbreviation: bd, sd, cp, hh, oh, cr, rd, lt, perc, ...
//           (every bank's <kind> plus plain sample sets of that name)
// sound     as in code: bd:1/RolandTR909 (sound:variant/bank), or bd:3 for a sample set
// features  bright (spectral centroid), sub (energy under 120 Hz), pitch (strongest
//           frequency 30-300 Hz), click (share of the first 20 ms above 2 kHz),
//           long (decay to -30 dB), attack (time to peak), noisy (spectral flatness)
//           --more/--less take any of them, more than once: --more long --less bright
//
// audition options
//   candidates are sounds (bd:1/RolandTR909) or any strudel expression ('kick.lpf(800)')
//   --pattern <expr>   expression a sound is played with, $ = the sound: 's("$*4").gain(.5)'
//                      (default by kind: kicks on every beat, claps on 2 and 4, hats offbeat)
//   --over <track>     play each candidate over a section of a track, with its other instruments
//   --section <s>      that section, by label or bar number (default: the busiest one)
//   --replace <name>   instrument of that section the candidates replace
//   --bars <n>         bars per candidate (default 2, 4 with --over)
//   --bpm <n>          tempo without --over (default 130)
//   --play             play the reel in VSCode through strudel-remote (replaces what plays)
//
// writes toolkit/out/audition/<name>.strudel.js, numbered 1..n in order. measurements
// are cached in .sample-cache/browse-<strudel version>.json, the first list of a kind
// renders all its samples (~1 min for 400 kicks)

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { normalise, parseArrange } from './arrange.mjs';
import { load, openPages, renderChunk, root } from './browser.mjs';
import { fft } from './dsp.mjs';

const RATE = 44100;
const SLOT = 2; // seconds per sample in the measuring render
const CHUNK = 24; // samples per render
const DRUMS = ['bd', 'sd', 'hh', 'oh', 'cp', 'rim', 'cr', 'rd', 'lt', 'mt', 'ht', 'cb', 'sh', 'tb', 'perc', 'misc', 'fx'];
const PATTERNS = { bd: 's("$*4")', sd: 's("~ $ ~ $")', cp: 's("~ $ ~ $")', rim: 's("~ $ ~ $")', hh: 's("[~ $]*4")', oh: 's("[~ $]*4")', sh: 's("$*8")', tb: 's("$*8")', rd: 's("$*8")' };
const FEATURES = {
  bright: { unit: 'Hz', scale: Math.log2, help: 'spectral centroid' },
  sub: { unit: 'dB', scale: (x) => x, help: 'energy under 120 Hz' },
  pitch: { unit: 'Hz', scale: Math.log2, help: 'strongest frequency 30-300 Hz' },
  click: { unit: 'dB', scale: (x) => x, help: 'first 20 ms above 2 kHz' },
  long: { unit: 'ms', scale: (x) => Math.log2(x + 5), help: 'decay to -30 dB' },
  attack: { unit: 'ms', scale: (x) => Math.log2(x + 1), help: 'time to peak' },
  noisy: { unit: 'dB', scale: (x) => x, help: 'spectral flatness' },
};

function parseArgs(argv) {
  const opts = { top: 15, more: [], less: [], items: [], play: false };
  const valued = ['--sort', '--top', '--kind', '--pattern', '--over', '--section', '--replace', '--bars', '--bpm'];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--play') opts.play = true;
    else if (a === '--more' || a === '--less') opts[a.slice(2)].push(argv[++i]);
    else if (valued.includes(a)) opts[a.slice(2)] = argv[++i];
    else opts.items.push(a);
  }
  opts.command = opts.items.shift();
  opts.top = Number(opts.top);
  for (const f of [...opts.more, ...opts.less, opts.sort?.replace(/^-/, '')].filter(Boolean))
    if (!FEATURES[f]) fail(`unknown feature "${f}": ${Object.keys(FEATURES).join(', ')}`);
  const ok = { list: 1, like: 1, audition: Infinity }[opts.command];
  if (!ok || !opts.items.length || opts.items.length > ok) fail('usage: strudelcli browse list <kind> | like <sound> | audition <candidate ...>   (see the header)');
  return opts;
}

function fail(msg) {
  console.error(msg);
  process.exit(2);
}

// ---------------------------------------------------------------- sounds

function registry() {
  const dir = path.join(root, '.sample-cache');
  const file = fs.existsSync(dir) && fs.readdirSync(dir).filter((f) => /^library-.*\.json$/.test(f)).sort().at(-1);
  if (!file) fail('no sound registry yet: run node toolkit/library.mjs sounds once');
  return { version: file.slice(8, -5), sounds: JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')).sounds.filter((s) => s.type === 'sample') };
}

// RolandTR909_bd -> { bank: RolandTR909, sound: bd }
function split(name) {
  const i = name.lastIndexOf('_');
  return i > 0 && DRUMS.includes(name.slice(i + 1)) ? { bank: name.slice(0, i), sound: name.slice(i + 1) } : { bank: null, sound: name };
}

// every sample of a kind, as { id: 'bd:1/RolandTR909', name, n }
function samplesOf(kind, sounds) {
  let matches = sounds.filter((s) => s.name === kind || s.name.endsWith(`_${kind}`));
  if (!matches.length) matches = sounds.filter((s) => s.name.toLowerCase().includes(kind.toLowerCase()));
  return matches.flatMap((s) => Array.from({ length: s.variants || 1 }, (_, n) => ({ id: idOf(s.name, n), name: s.name, n })));
}

const idOf = (name, n) => {
  const { bank, sound } = split(name);
  return `${sound}:${n}${bank ? `/${bank}` : ''}`;
};

// bd:1/RolandTR909 -> { name: RolandTR909_bd, n: 1 }
function parseId(id) {
  const m = id.match(/^([^:/]+)(?::(\d+))?(?:\/(.+))?$/);
  return m && { name: m[3] ? `${m[3]}_${m[1]}` : m[1], n: Number(m[2] ?? 0), sound: m[1], bank: m[3] ?? null };
}

// strudel code playing a sound with a pattern template
function code(id, pattern) {
  const { sound, n, bank } = parseId(id);
  return pattern.replaceAll('$', `${sound}:${n}`) + (bank ? `.bank("${bank}")` : '');
}

// ---------------------------------------------------------------- measuring

function features(audio) {
  const n = audio.length / 2;
  const x = new Float32Array(n);
  let peak = 0;
  for (let i = 0; i < n; i++) {
    x[i] = (audio[2 * i] + audio[2 * i + 1]) / 2;
    peak = Math.max(peak, Math.abs(x[i]));
  }
  if (peak < 1e-4) return null;
  const start = x.findIndex((v) => Math.abs(v) > peak / 100);

  // envelope in 5 ms windows
  const win = Math.round(RATE * 0.005);
  const env = [];
  for (let i = start; i + win <= n; i += win) {
    let s = 0;
    for (let j = i; j < i + win; j++) s += x[j] ** 2;
    env.push(Math.sqrt(s / win));
  }
  const top = env.indexOf(Math.max(...env));
  const tail = env.findIndex((e, i) => i > top && e < env[top] * 10 ** (-30 / 20));
  const attack = top * 5;
  const long = ((tail < 0 ? env.length : tail) - top) * 5;

  const spectrum = (from, size) => {
    const re = new Float64Array(size);
    const im = new Float64Array(size);
    for (let i = 0; i < size; i++) re[i] = (x[from + i] ?? 0) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / size));
    fft(re, im);
    return Array.from({ length: size / 2 }, (_, b) => ({ f: (b * RATE) / size, p: re[b] ** 2 + im[b] ** 2 }));
  };
  const body = spectrum(start, 16384).filter((b) => b.f >= 20 && b.f <= 20000);
  const total = body.reduce((s, b) => s + b.p, 0) || 1e-20;
  const bright = 2 ** body.reduce((s, b) => s + (b.p / total) * Math.log2(b.f), 0);
  const sub = 10 * Math.log10(Math.max(body.filter((b) => b.f < 120).reduce((s, b) => s + b.p, 0) / total, 1e-6));
  const low = body.filter((b) => b.f >= 30 && b.f <= 300);
  const pitch = low.reduce((a, b) => (b.p > a.p ? b : a)).f;
  const flat = body.filter((b) => b.f >= 100 && b.f <= 10000);
  const noisy = 10 * Math.log10(Math.exp(flat.reduce((s, b) => s + Math.log(b.p + 1e-20), 0) / flat.length) / (flat.reduce((s, b) => s + b.p, 0) / flat.length));
  const hit = spectrum(start, 1024);
  const click = 10 * Math.log10(Math.max(hit.filter((b) => b.f > 2000).reduce((s, b) => s + b.p, 0) / (hit.reduce((s, b) => s + b.p, 0) || 1e-20), 1e-6));
  const r = (v) => Math.round(v * 10) / 10;
  return { bright: Math.round(bright), sub: r(sub), pitch: Math.round(pitch), click: r(click), long: Math.round(long), attack: Math.round(attack), noisy: r(noisy), peak: r(20 * Math.log10(peak)) };
}

async function measureAll(samples, version) {
  const cacheFile = path.join(root, '.sample-cache', `browse-${version}.json`);
  const cache = fs.existsSync(cacheFile) ? JSON.parse(fs.readFileSync(cacheFile, 'utf8')) : {};
  const todo = samples.filter((s) => !(s.id in cache));
  if (todo.length) {
    const chunks = [];
    for (let i = 0; i < todo.length; i += CHUNK) chunks.push(todo.slice(i, i + CHUNK));
    const workers = Math.min(Math.max(1, os.availableParallelism() - 2), chunks.length);
    process.stderr.write(`measuring ${todo.length} samples on ${workers} workers...\n`);
    const browser = await openPages(workers);
    try {
      let next = 0;
      await Promise.all(
        browser.pages.map(async (page) => {
          while (next < chunks.length) {
            const chunk = chunks[next++];
            const events = chunk.map((s) => `${s.name}:${s.n}`).join(' ');
            const cps = await load(page, `setcps(${1 / SLOT})\ns("<${events}>").clip(1)`);
            const audio = await renderChunk(page, { begin: 0, end: chunk.length, cps, tail: 0, rate: RATE });
            const per = SLOT * RATE * 2;
            chunk.forEach((s, i) => (cache[s.id] = features(audio.subarray(i * per, (i + 1) * per))));
          }
        }),
      );
    } finally {
      await browser.close();
    }
    fs.writeFileSync(cacheFile, JSON.stringify(cache));
  }
  return samples.filter((s) => cache[s.id]).map((s) => ({ ...s, ...cache[s.id] }));
}

// ---------------------------------------------------------------- ranking

function zScores(rows) {
  const stats = {};
  for (const [f, { scale }] of Object.entries(FEATURES)) {
    const xs = rows.map((r) => scale(r[f]));
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length) || 1;
    stats[f] = { mean, sd };
  }
  return (row, f) => (FEATURES[f].scale(row[f]) - stats[f].mean) / stats[f].sd;
}

function table(rows, extra) {
  const cols = Object.keys(FEATURES);
  const head = ['#', 'sound', ...cols.map((c) => `${c} ${FEATURES[c].unit}`), ...(extra ? [extra.title] : [])];
  const body = rows.map((r, i) => [String(i + 1), r.id, ...cols.map((c) => String(r[c])), ...(extra ? [extra.value(r)] : [])]);
  const widths = head.map((h, c) => Math.max(h.length, ...body.map((b) => b[c].length)));
  const line = (cells) => cells.map((c, i) => (i < 2 ? c.padEnd(widths[i]) : c.padStart(widths[i]))).join('  ');
  console.log(line(head));
  for (const b of body) console.log(line(b));
}

async function list(opts, reg) {
  const kind = opts.items[0];
  const rows = await measureAll(samplesOf(kind, reg.sounds), reg.version);
  if (!rows.length) fail(`no samples match "${kind}": see node toolkit/library.mjs banks`);
  const sort = opts.sort?.replace(/^-/, '');
  if (sort) rows.sort((a, b) => (opts.sort.startsWith('-') ? a[sort] - b[sort] : b[sort] - a[sort]));
  console.log(`${rows.length} ${kind} samples${sort ? `, ${opts.sort.startsWith('-') ? 'least' : 'most'} ${sort} first` : ''}${rows.length > opts.top ? ` (top ${opts.top}, --top for more)` : ''}`);
  table(rows.slice(0, opts.top));
}

async function like(opts, reg) {
  const id = opts.items[0];
  const ref = parseId(id);
  if (!ref || !reg.sounds.some((s) => s.name === ref.name)) fail(`no such sound: ${id} (write it as sound:variant/bank, e.g. bd:1/RolandTR909)`);
  const kind = opts.kind ?? split(ref.name).sound;
  const pool = samplesOf(kind, reg.sounds);
  const refId = idOf(ref.name, ref.n);
  if (!pool.some((s) => s.id === refId)) pool.push({ id: refId, name: ref.name, n: ref.n });
  const rows = await measureAll(pool, reg.version);
  const me = rows.find((r) => r.id === refId);
  if (!me) fail(`${id} renders silent`);
  const z = zScores(rows);
  const steer = [...opts.more.map((f) => [f, 1]), ...opts.less.map((f) => [f, -1])];
  const free = Object.keys(FEATURES).filter((f) => !steer.some(([s]) => s === f));
  const found = rows
    .filter((r) => r.id !== refId && steer.every(([f, dir]) => dir * (z(r, f) - z(me, f)) >= 0.5))
    .map((r) => ({ ...r, distance: Math.sqrt(free.reduce((s, f) => s + (z(r, f) - z(me, f)) ** 2, 0) / free.length) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, opts.top);
  console.log(`${id} among ${rows.length} ${kind} samples:`);
  table([me]);
  console.log(`\nclosest${steer.length ? `, with ${steer.map(([f, d]) => `${d > 0 ? 'more' : 'less'} ${f}`).join(' and ')}` : ''} (distance: 0 = the same, 1 = typical difference)`);
  if (!found.length) console.log('  nothing: ease off a --more/--less');
  else table(found, { title: 'distance', value: (r) => r.distance.toFixed(2) });
}

// ---------------------------------------------------------------- audition reel

function audition(opts, reg) {
  const names = new Set(reg.sounds.map((s) => s.name));
  const candidates = opts.items.map((item) => {
    const p = parseId(item);
    if (p && names.has(p.name)) return { label: item, expr: code(item, opts.pattern ?? PATTERNS[p.sound] ?? 's("$ ~ ~ ~")') };
    return { label: item, expr: item };
  });

  let head = '';
  let parts = [];
  let bars = Number(opts.bars ?? (opts.over ? 4 : 2));
  let context = '';
  if (opts.over) {
    const track = fs.readFileSync(opts.over, 'utf8');
    const arrangement = parseArrange(track);
    if (!arrangement) fail(`${opts.over} has no arrange(...)`);
    const s = opts.section;
    const section =
      s === undefined
        ? arrangement.sections.reduce((a, b) => (b.parts.length > a.parts.length ? b : a))
        : /^\d+$/.test(s)
          ? arrangement.sections.find((x) => x.from <= Number(s) && Number(s) < x.from + x.bars)
          : arrangement.sections.find((x) => x.label?.toLowerCase().startsWith(s.toLowerCase()));
    if (!section) fail(`no section "${s}" in ${opts.over}`);
    parts = section.parts;
    if (opts.replace) {
      const keep = parts.filter((p) => normalise(p) !== normalise(opts.replace));
      if (keep.length === parts.length) fail(`"${opts.replace}" doesn't play in that section: ${parts.map(normalise).join(', ')}`);
      parts = keep;
    }
    head = track.slice(0, arrangement.start);
    context = ` over ${path.basename(opts.over)} bars ${section.from}-${section.from + section.bars}${opts.replace ? ` without ${opts.replace}` : ''}`;
  } else head = `setcps(${Number(opts.bpm ?? 130)}/60/4)\n\n`;

  const name = opts.over ? path.basename(opts.over).replace(/\.strudel\.js$/, '') : parseId(opts.items[0])?.sound ?? 'reel';
  const sections = candidates.map((c, i) => `  // ${i + 1}: ${c.label}\n  [${bars}, stack(${[...parts, c.expr].join(', ')})],`);
  const reel = `// audition${context}: ${candidates.length} candidates, ${bars} bars each, then it loops. written by toolkit/browse.mjs\n${head}arrange(\n${sections.join('\n')}\n)\n`;
  const out = path.join(root, 'out', 'audition', `${name}.strudel.js`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, reel);
  const rel = path.relative(path.dirname(root), out);
  console.log(`wrote ${path.relative(process.cwd(), out)}: ${candidates.length} candidates${context}, ${bars} bars each`);
  candidates.forEach((c, i) => console.log(`  ${String(i + 1).padStart(2)}  ${c.label === c.expr ? c.expr : `${c.label.padEnd(24)} ${c.expr}`}`));
  if (opts.play) {
    fs.writeFileSync(path.join(path.dirname(root), '.strudel-remote'), `play ${rel}\n`);
    console.log('playing in VSCode');
  }
}

const opts = parseArgs(process.argv.slice(2));
const reg = registry();
if (opts.command === 'list') await list(opts, reg);
else if (opts.command === 'like') await like(opts, reg);
else audition(opts, reg);
