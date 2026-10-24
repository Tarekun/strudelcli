// checks that a .strudel.js track is valid: it parses and evaluates, its
// pattern produces events, every sound it asks for exists, and it renders to
// actual audio. meant to be run by an agent after editing a track
//
//   node validate.mjs <track.strudel.js> [options]
//     --bars <n>   bars rendered from the start of each section (default 2)
//     --full       render the whole track instead (slower)
//     --json       print a machine-readable report instead of text
//
// exit code: 0 = valid (possibly with warnings), 1 = errors found, 2 = couldn't run
//
// events and sounds are checked over the whole arrange; only the audio check
// samples the start of each section, unless --full

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArrange } from './arrange.mjs';
import { evaluate, openPages, renderChunk } from './browser.mjs';

const RATE = 22050; // plenty to tell sound from silence, and half the work
const SILENT = 1e-4; // -80 dBFS peak

function parseArgs(argv) {
  const opts = { bars: 2, full: false, json: false };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--full' || argv[i] === '--json') opts[argv[i].slice(2)] = true;
    else if (argv[i] === '--bars') opts.bars = Number(argv[++i]);
    else rest.push(argv[i]);
  }
  if (rest.length !== 1) {
    console.error('usage: node validate.mjs <track.strudel.js> [--bars n] [--full] [--json]');
    process.exit(2);
  }
  opts.track = path.resolve(rest[0]);
  return opts;
}

// "line:col" of a character offset in the code
function position(code, offset) {
  const before = code.slice(0, offset).split('\n');
  return `${before.length}:${before[before.length - 1].length + 1}`;
}

// hints for errors whose message doesn't say what to do
function hint(message) {
  if (/sliderWithID/.test(message)) return 'slider() is not supported by the VSCode Strudel extension: use a constant';
  if (/is not a function/.test(message)) return 'unknown function or method: check the spelling, or that it is a strudel function';
  if (/is not defined/.test(message)) return 'unknown name: a typo, or a const used before it is defined';
  if (/Unexpected token|Unterminated|SyntaxError/.test(message)) return 'syntax error: check brackets, quotes and commas around this position';
  return null;
}

// every bar of the pattern, queried in the page: event counts per bar, sounds
// that don't resolve (with where they come from) and NaN controls
async function inspect(page, bars, cps) {
  return page.evaluate(
    ({ bars, cps }) => {
      const missing = {};
      const nan = {};
      const noSound = { count: 0, firstBar: null, locations: [] };
      const sounds = new Set();
      const perBar = [];
      for (let bar = 0; bar < bars; bar++) {
        let haps;
        try {
          haps = window.pattern.queryArc(bar, bar + 1, { _cps: cps });
        } catch (err) {
          return { queryError: String(err?.message ?? err), bar };
        }
        let events = 0;
        for (const hap of haps) {
          if (!hap.hasOnset()) continue;
          events++;
          const value = hap.value;
          const locations = (hap.context?.locations ?? []).map((l) => l.start);
          if (typeof value !== 'object' || value === null) {
            noSound.count++;
            noSound.firstBar ??= bar;
            if (noSound.locations.length < 3) noSound.locations.push(...locations);
            continue;
          }
          // the same name superdough looks up when it plays the note
          let s = value.s ?? 'triangle';
          if (['-', '~', '_'].includes(s)) continue;
          if (value.bank && s) s = `${value.bank}_${s}`;
          sounds.add(s);
          if (!value.source && !window.S.getSound(s)) {
            const m = (missing[s] ??= { s: value.s ?? null, bank: value.bank ?? null, count: 0, firstBar: bar, locations: [] });
            m.count++;
            for (const l of locations) if (m.locations.length < 3 && !m.locations.includes(l)) m.locations.push(l);
          }
          for (const [key, v] of Object.entries(value)) {
            if (typeof v === 'number' && !Number.isFinite(v)) (nan[key] ??= { count: 0, firstBar: bar }).count++;
          }
        }
        perBar.push(events);
      }
      return { perBar, missing, nan, noSound, sounds: [...sounds] };
    },
    { bars, cps },
  );
}

const opts = parseArgs(process.argv.slice(2));
const code = fs.readFileSync(opts.track, 'utf8');
const checks = [];
const add = (status, check, message, extra = {}) => checks.push({ status, check, message, ...extra });

const arrangement = parseArrange(code);
const sections = arrangement?.sections.length ? arrangement.sections : null;
const totalBars = sections ? sections.reduce((n, s) => n + s.bars, 0) : 16;

// what the audio check renders: the start of each section, or everything
const ranges = opts.full
  ? Array.from({ length: Math.ceil(totalBars / 32) }, (_, i) => ({ label: `bars ${i * 32}-${Math.min((i + 1) * 32, totalBars)}`, from: i * 32, to: Math.min((i + 1) * 32, totalBars) }))
  : (sections ?? [{ label: null, from: 0, bars: totalBars }]).map((s) => ({ label: s.label, from: s.from, to: s.from + Math.min(s.bars, opts.bars) }));

const pageErrors = new Map();
let browser;
try {
  browser = await openPages(Math.max(1, Math.min(ranges.length, os.availableParallelism() - 2)), (type, text) =>
    pageErrors.set(`${type}: ${text}`, (pageErrors.get(`${type}: ${text}`) ?? 0) + 1),
  );
} catch (err) {
  console.error(`could not start the browser: ${err.message}`);
  process.exit(2);
}

try {
  const [page] = browser.pages;

  // 1. parse + evaluate
  const { cps, error } = await evaluate(page, code);
  if (error) {
    const at = error.match(/\((\d+):(\d+)\)/);
    add('error', 'evaluate', error, { line: at ? `${at[1]}:${Number(at[2]) + 1}` : undefined, hint: hint(error) });
    throw 'stop';
  }
  const bpm = Math.round(cps * 60 * 4);
  add('ok', 'evaluate', `parses and evaluates (${cps.toFixed(3)} cps = ${bpm} bpm at 4 beats per cycle)`);
  if (!/\bset(cps|cpm)\s*\(/.test(code)) add('warn', 'evaluate', 'no setcps()/setcpm(): the tempo is whatever the player defaults to');
  if (!sections) add('warn', 'arrange', `no arrange(...) found: checking the first ${totalBars} bars only`);

  // 2. events and sounds over the whole arrange
  const found = await inspect(page, totalBars, cps);
  if (found.queryError) {
    add('error', 'events', `querying bar ${found.bar} failed: ${found.queryError}`, { hint: hint(found.queryError) });
    throw 'stop';
  }
  const events = found.perBar.reduce((a, b) => a + b, 0);
  if (!events) {
    add('error', 'events', `the pattern produces no events in ${totalBars} bars: nothing will play`);
    throw 'stop';
  }
  add('ok', 'events', `${events} events over ${totalBars} bars${sections ? `, ${sections.length} sections` : ''}`);
  for (const s of sections ?? []) {
    const n = found.perBar.slice(s.from, s.from + s.bars).reduce((a, b) => a + b, 0);
    if (!n) add('warn', 'events', `section ${s.label ? `"${s.label}" ` : ''}at bars ${s.from}-${s.from + s.bars} has no events`);
  }
  const lines = (locations) => [...new Set(locations.map((l) => position(code, l)))];
  const missing = Object.entries(found.missing);
  for (const [name, m] of missing) {
    const asked = m.bank ? `s("${m.s}") with .bank("${m.bank}")` : `s("${m.s ?? 'triangle'}")`;
    const why = name.startsWith('gm_')
      ? 'soundfonts (gm_*) are not loaded by the toolkit, so this may still play in the extension'
      : m.bank
        ? `the ${m.bank} bank has no "${m.s}" sound (or the bank name is wrong)`
        : 'no sample or synth with this name is loaded';
    add(name.startsWith('gm_') ? 'warn' : 'error', 'sounds', `sound "${name}" not found: ${asked}, ${m.count} events from bar ${m.firstBar}. ${why}`, {
      line: lines(m.locations).join(', ') || undefined,
    });
  }
  if (!missing.length) add('ok', 'sounds', `all ${found.sounds.length} sounds found`);
  if (found.noSound.count) {
    add('error', 'sounds', `${found.noSound.count} events have no sound (plain values, not objects): add .s() or .note()`, {
      line: lines(found.noSound.locations).join(', ') || undefined,
    });
  }
  for (const [key, n] of Object.entries(found.nan)) {
    add('error', 'controls', `.${key}() gets NaN or Infinity on ${n.count} events from bar ${n.firstBar}: check the math feeding it`);
  }

  // 3. render and listen
  const pending = [...ranges];
  const rendered = [];
  await Promise.all(
    browser.pages.map(async (page, i) => {
      if (i > 0) await evaluate(page, code);
      while (pending.length) {
        const range = pending.shift();
        const audio = await renderChunk(page, { begin: range.from, end: range.to, cps, tail: 1, rate: RATE });
        let peak = 0;
        let bad = 0;
        for (const x of audio) {
          if (!Number.isFinite(x)) bad++;
          else if (Math.abs(x) > peak) peak = Math.abs(x);
        }
        rendered.push({ ...range, peak, bad });
      }
    }),
  );
  rendered.sort((a, b) => a.from - b.from);
  const where = (r) => `${r.label ? `section "${r.label}" ` : ''}bars ${r.from}-${r.to}`;
  const dbfs = (x) => `${x > 1 ? '+' : ''}${(20 * Math.log10(x)).toFixed(1)} dBFS`;
  for (const r of rendered) {
    if (r.bad) add('error', 'audio', `${where(r)}: ${r.bad} NaN/Infinity samples, an effect parameter is broken`);
    else if (r.peak < SILENT && found.perBar.slice(r.from, r.to).some(Boolean)) add('warn', 'audio', `${where(r)}: renders silent although it has events`);
  }
  // clipping is usually a level problem of the whole track, so one line for
  // all of it, with every clipping range listed in the json output
  const clipping = rendered.filter((r) => !r.bad && r.peak > 1);
  if (clipping.length) {
    const worst = clipping.reduce((a, b) => (b.peak > a.peak ? b : a));
    add('warn', 'audio', `clips (peak above 0 dBFS) in ${clipping.length} of ${rendered.length} rendered ranges, worst ${dbfs(worst.peak)} in ${where(worst)}: lower the gain or ease off distort/shape on the loudest parts`, {
      ranges: clipping.map((r) => ({ label: r.label, from: r.from, to: r.to, peak: dbfs(r.peak) })),
    });
  }
  const loudest = Math.max(...rendered.map((r) => r.peak));
  if (loudest < SILENT) add('error', 'audio', 'everything renders silent');
  else add('ok', 'audio', `${rendered.length} ${opts.full ? 'chunks' : `sections (first ${opts.bars} bars each)`} rendered, loudest peak ${dbfs(loudest)}`);
} catch (err) {
  if (err !== 'stop') add('error', 'validator', `validator crashed: ${err.stack ?? err}`);
} finally {
  await browser.close();
}

// browser errors not already explained above: missing sounds fail on every
// note, and a failed evaluation is also logged with its stack. the rest are
// grouped by their first line with numbers masked, so "pan.value 1.39 out of
// range" and "pan.value 1.28 out of range" count as one problem
const explained = checks.filter((c) => c.check === 'evaluate' && c.status === 'error').map((c) => c.message);
const grouped = new Map();
for (const [text, count] of pageErrors) {
  const [type, ...rest] = text.split(': ');
  const message = rest.join(': ').split('\n')[0];
  if (/sound .* not found|expected hap.value to be an object/.test(message) || explained.some((e) => message.includes(e) || e.includes(message))) continue;
  const key = `${type}: ${message.replace(/-?\d+(\.\d+)?/g, '#')}`;
  const group = grouped.get(key) ?? { type, example: message, count: 0 };
  group.count += count;
  grouped.set(key, group);
}
for (const { type, example, count } of grouped.values()) {
  add(type === 'error' ? 'error' : 'warn', 'runtime', `${count > 1 ? `${count}x ` : ''}${example}`);
}

const errors = checks.filter((c) => c.status === 'error').length;
const warnings = checks.filter((c) => c.status === 'warn').length;
const file = path.relative(process.cwd(), opts.track);
if (opts.json) console.log(JSON.stringify({ file, valid: !errors, errors, warnings, checks }, null, 2));
else {
  console.log(file);
  for (const c of checks) {
    console.log(`  ${c.status.padEnd(5)} ${c.message}${c.line ? ` (line ${c.line})` : ''}`);
    if (c.hint) console.log(`        hint: ${c.hint}`);
  }
  console.log(errors ? `INVALID: ${errors} errors, ${warnings} warnings` : `VALID${warnings ? ` (${warnings} warnings)` : ''}`);
}
process.exit(errors ? 1 : 0);
