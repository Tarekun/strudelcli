// what each instrument of a track does and how it sits in the mix: where it
// plays, its rhythm, notes, chords and phrase (from the pattern itself), and
// its level, share of the section, frequency range, stereo width, envelope
// and overlaps with other instruments (from short solo renders)
//
//   node inspect.mjs <track.strudel.js> [instrument ...] [options]
//     --bars <n>     bars rendered from the start of each section (default 4)
//     --no-audio     pattern analysis only: rhythm, notes, chords (instant)
//     --workers <n>  renders in parallel (default: cores - 2)
//     --json         machine-readable output
//
// "share of what's heard" is the instrument's A-weighted energy over all the
// section's instruments together: roughly how much of the section it is
// to the ear, not to a meter, which the kick would dominate
//
// instrument names are the expressions stacked in the arrange, as listed by
// structure.mjs (kickFill, lead, kick.mask("<1!3 [1 1 1 0]>"), ...)
//
// levels come from each instrument rendered alone, so instruments ducked by
// the kick's sidechain measure a bit louder than they are in the mix

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArrange, soloCode, stemsOf } from './arrange.mjs';
import { evaluate, openPages, renderChunk } from './browser.mjs';
import { CENTERS, EDGES, centroid, db, hz, measure, perceivedEnergy, percentileFrequency } from './dsp.mjs';
import { NAMES, chordName, detectKey, noteName, pitchClass, register } from './theory.mjs';

const RATE = 44100;
const PROMINENT = 6; // dB: within this much of all instruments together in a band = a main contributor there
const OVERLAP = 0.15; // share of frames two instruments are both prominent in a band to count as overlapping

function parseArgs(argv) {
  const opts = { bars: 4, audio: true, json: false, only: [] };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--no-audio') opts.audio = false;
    else if (a === '--json') opts.json = true;
    else if (a === '--bars' || a === '--workers') opts[a.slice(2)] = Number(argv[++i]);
    else rest.push(a);
  }
  if (!rest.length) {
    console.error('usage: node inspect.mjs <track.strudel.js> [instrument ...] [--bars n] [--no-audio] [--json]');
    process.exit(2);
  }
  [opts.track, ...opts.only] = rest;
  return opts;
}

// every note-on of the evaluated pattern: [bar, position in bar, midi or null, duration, sound]
function collectEvents(page, bars, cps) {
  return page.evaluate(
    ({ bars, cps }) => {
      const events = [];
      for (let bar = 0; bar < bars; bar++) {
        for (const hap of window.pattern.queryArc(bar, bar + 1, { _cps: cps })) {
          const v = hap.value;
          if (!hap.hasOnset() || typeof v !== 'object' || v === null || ['-', '~', '_'].includes(v.s)) continue;
          // pitched if it has a note or freq: samples without one are percussion
          let midi = null;
          if (v.note != null || v.freq != null) {
            try {
              midi = window.S.valueToMidi(v);
            } catch {}
          }
          const sound = v.bank ? `${v.bank} ${v.s}${v.n != null ? `:${v.n}` : ''}` : `${v.s ?? 'triangle'}${v.n != null && midi == null ? `:${v.n}` : ''}`;
          events.push([bar, hap.whole.begin.valueOf() - bar, Number.isFinite(midi) ? midi : null, hap.duration.valueOf(), sound]);
        }
      }
      return events;
    },
    { bars, cps },
  );
}

// rhythm, notes and chords of one instrument's events
function describePattern(events, barsPlaying, key) {
  const steps = new Array(16).fill(0);
  const hits = new Set();
  let offGrid = 0;
  const accents = { onBeat: 0, offbeat8: 0, sixteenth: 0 };
  for (const [bar, pos] of events) {
    const step = pos * 16;
    if (Math.abs(step - Math.round(step)) > 0.01) {
      offGrid++;
      continue;
    }
    const s = Math.round(step) % 16;
    hits.add(`${bar}:${s}`);
    if (s % 4 === 0) accents.onBeat++;
    else if (s % 2 === 0) accents.offbeat8++;
    else accents.sixteenth++;
  }
  for (const h of hits) steps[Number(h.split(':')[1])]++;
  const grid = steps.map((n) => n / (barsPlaying || 1)).map((p) => (p >= 0.75 ? 'X' : p >= 0.25 ? 'x' : p > 0 ? '.' : '-')).join('');
  const onGrid = events.length - offGrid || 1;

  const sounds = {};
  for (const e of events) sounds[e[4]] = (sounds[e[4]] ?? 0) + 1;

  const pitched = events.filter((e) => e[2] != null);
  let notes = null;
  if (pitched.length) {
    const midis = pitched.map((e) => e[2]);
    const sorted = [...midis].sort((a, b) => a - b);
    const classes = {};
    for (const m of midis) classes[NAMES[pitchClass(m)]] = (classes[NAMES[pitchClass(m)]] ?? 0) + 1;
    const outside = key ? Object.entries(classes).filter(([name]) => !key.scale.includes(NAMES.indexOf(name))) : [];

    // simultaneous notes = chords, in order of first appearance
    const atOnce = new Map();
    for (const e of pitched) atOnce.set(`${e[0]}:${e[1].toFixed(4)}`, [...(atOnce.get(`${e[0]}:${e[1].toFixed(4)}`) ?? []), e[2]]);
    const chords = [...new Set([...atOnce.values()].map(chordName).filter(Boolean))];

    // the first two bars it plays, as note names, chords in brackets
    const firstBar = pitched[0][0];
    const phrase = [firstBar, firstBar + 1].map((bar) =>
      [...atOnce.entries()]
        .filter(([k]) => Number(k.split(':')[0]) === bar)
        .sort(([a], [b]) => Number(a.split(':')[1]) - Number(b.split(':')[1]))
        .map(([, ms]) => (ms.length > 1 ? `[${[...ms].sort((a, b) => a - b).map(noteName).join(',')}]` : noteName(ms[0])))
        .slice(0, 16)
        .join(' '),
    );
    notes = {
      lowest: noteName(sorted[0]),
      highest: noteName(sorted[sorted.length - 1]),
      register: register(sorted[Math.floor(sorted.length / 2)]),
      classes: Object.fromEntries(Object.entries(classes).sort((a, b) => b[1] - a[1]).map(([n, c]) => [n, c / midis.length])),
      outside: Object.fromEntries(outside.map(([n, c]) => [n, c / midis.length])),
      chords,
      phrase: { from: firstBar, bars: phrase },
    };
  }
  return {
    events: events.length,
    perBar: events.length / (barsPlaying || 1),
    grid,
    offGrid: offGrid / (events.length || 1),
    accents: { onBeat: accents.onBeat / onGrid, offbeat8: accents.offbeat8 / onGrid, sixteenth: accents.sixteenth / onGrid },
    sounds: Object.fromEntries(Object.entries(sounds).sort((a, b) => b[1] - a[1])),
    notes,
  };
}

// band runs where a and b are both prominent more than OVERLAP of the time
function overlaps(a, b, sum) {
  const frames = Math.min(a.length, b.length, sum.length);
  if (!frames) return [];
  const loudest = Math.max(...CENTERS.map((_, band) => sum.reduce((s, f) => s + f[band], 0) / frames));
  const share = CENTERS.map((center, band) => {
    if (center < 40 || center > 10000) return 0;
    let both = 0;
    for (let i = 0; i < frames; i++) {
      const whole = sum[i][band];
      if (db(whole) < db(loudest) - 50) continue;
      const limit = whole * 10 ** (-PROMINENT / 10);
      if (a[i][band] > limit && b[i][band] > limit) both++;
    }
    return both / frames;
  });
  const runs = [];
  for (let band = 0; band < share.length; band++) {
    if (share[band] <= OVERLAP) continue;
    const last = runs[runs.length - 1];
    if (last && last.to === band - 1) {
      last.to = band;
      last.share = Math.max(last.share, share[band]);
    } else runs.push({ from: band, to: band, share: share[band] });
  }
  return runs.map((r) => ({ range: `${hz(EDGES[r.from])}-${hz(EDGES[r.to + 1])}`, share: r.share }));
}

const opts = parseArgs(process.argv.slice(2));
const code = fs.readFileSync(opts.track, 'utf8');
const arrangement = parseArrange(code);
if (!arrangement?.sections.length) {
  console.error(`${opts.track}: inspect needs an arrange(...) to know the instruments`);
  process.exit(2);
}
const sections = arrangement.sections;
const totalBars = sections.reduce((n, s) => n + s.bars, 0);
const stems = stemsOf(arrangement);
const partsOf = (s) => stemsOf({ sections: [s] });
const selected = opts.only.length ? opts.only : stems;
const unknown = selected.filter((s) => !stems.includes(s));
if (unknown.length) {
  console.error(`unknown instrument${unknown.length > 1 ? 's' : ''}: ${unknown.join(', ')}\navailable: ${stems.join(', ')}`);
  process.exit(2);
}

// render tasks: every instrument of every section a selected instrument plays in
const tasks = [];
if (opts.audio) {
  for (const [index, s] of sections.entries()) {
    const parts = partsOf(s);
    if (!parts.some((p) => selected.includes(p))) continue;
    for (const stem of parts) tasks.push({ stem, index, from: s.from, to: s.from + Math.min(s.bars, opts.bars) });
  }
  tasks.sort((a, b) => a.stem.localeCompare(b.stem) || a.from - b.from);
}
const workers = Math.max(1, Math.min(opts.workers ?? os.availableParallelism() - 2, tasks.length || 1));

const pageErrors = new Map();
const browser = await openPages(workers, (type, text) => pageErrors.set(text.split('\n')[0], (pageErrors.get(text.split('\n')[0]) ?? 0) + 1));
const result = {};
let cps;
let key;
try {
  const [page] = browser.pages;
  const full = await evaluate(page, code);
  if (full.error) {
    console.error(`${opts.track} does not evaluate: ${full.error}\nrun validate.mjs for details`);
    process.exitCode = 1;
    throw 'stop';
  }
  cps = full.cps;

  // 1. pattern: every instrument's events (all of them, for the key)
  const events = {};
  for (const stem of stems) {
    const { error } = await evaluate(page, soloCode(code, arrangement, stem));
    events[stem] = error ? [] : await collectEvents(page, totalBars, cps);
  }
  const weights = new Array(12).fill(0);
  const bassWeights = new Array(12).fill(0);
  for (const list of Object.values(events)) {
    for (const [, , midi, duration] of list) {
      if (midi == null) continue;
      weights[pitchClass(midi)] += duration;
      if (midi < 48) bassWeights[pitchClass(midi)] += duration;
    }
  }
  key = detectKey(weights, bassWeights);

  for (const stem of selected) {
    const playing = sections.filter((s) => partsOf(s).includes(stem));
    const barsPlaying = playing.reduce((n, s) => n + s.bars, 0);
    result[stem] = {
      sections: [...new Set(playing.map((s) => s.label ?? `bar ${s.from}`))],
      bars: barsPlaying,
      share: barsPlaying / totalBars,
      pattern: describePattern(events[stem], barsPlaying, key),
    };
  }

  // 2. audio: solo renders of the start of each relevant section
  const measured = {}; // measured[index][stem]
  const pending = [...tasks];
  await Promise.all(
    browser.pages.map(async (page) => {
      let loaded = null;
      while (pending.length) {
        const task = pending.shift();
        if (loaded !== task.stem) {
          await evaluate(page, soloCode(code, arrangement, task.stem));
          loaded = task.stem;
        }
        const audio = await renderChunk(page, { begin: task.from, end: task.to, cps, tail: 1, rate: RATE });
        const length = Math.round(((task.to - task.from) / cps) * RATE) * 2;
        (measured[task.index] ??= {})[task.stem] = measure(audio.subarray(0, length), RATE);
      }
    }),
  );

  for (const stem of opts.audio ? selected : []) {
    const levels = {};
    const bands = new Array(CENTERS.length).fill(0);
    let side = 0;
    let crest = 0;
    let duty = 0;
    let count = 0;
    const found = {};
    for (const [index, all] of Object.entries(measured)) {
      const mine = all[stem];
      if (!mine) continue;
      const s = sections[index];
      const label = s.label ?? `bar ${s.from}`;
      // share of what you hear in the section: A-weighted, so the kick's
      // low end doesn't drown every other instrument's share
      const total = Object.values(all).reduce((sum, m) => sum + perceivedEnergy(m.frames), 0);
      const level = (levels[label] ??= { energy: 0, share: 0, n: 0 });
      level.energy += mine.rms ** 2;
      level.share += perceivedEnergy(mine.frames) / (total || 1);
      level.n++;
      for (const f of mine.frames) f.forEach((e, b) => (bands[b] += e));
      for (const f of mine.sides) side += f.reduce((a, b) => a + b, 0);
      crest += mine.crest;
      duty += mine.duty;
      count++;
      // overlaps with the other instruments playing in this section
      const frames = Math.min(...Object.values(all).map((m) => m.frames.length));
      const sum = Array.from({ length: frames }, (_, i) => CENTERS.map((_, b) => Object.values(all).reduce((t, m) => t + m.frames[i][b], 0)));
      for (const [other, theirs] of Object.entries(all)) {
        if (other === stem) continue;
        for (const o of overlaps(mine.frames, theirs.frames, sum)) {
          const best = found[other];
          if (!best || o.share > best.share) found[other] = { ...o, section: label, sections: new Set([...(best?.sections ?? []), label]) };
          else best.sections.add(label);
        }
      }
    }
    if (!count) continue;
    const totalEnergy = bands.reduce((a, b) => a + b, 0);
    const mid = totalEnergy / 2 - side;
    result[stem].audio = {
      levels: Object.fromEntries(
        Object.entries(levels).map(([label, l]) => [label, { rms: db(l.energy / l.n), share: l.share / l.n }]),
      ),
      range: [percentileFrequency(bands, 0.1), percentileFrequency(bands, 0.9)],
      centroid: centroid(bands),
      strongest: CENTERS[bands.indexOf(Math.max(...bands))],
      width: db(side) - db(mid),
      crest: crest / count,
      duty: duty / count,
      overlaps: Object.entries(found)
        .sort((a, b) => b[1].share - a[1].share)
        .map(([other, o]) => ({ with: other, range: o.range, share: o.share, worst: o.section, sections: [...o.sections] })),
    };
  }
} catch (err) {
  if (err !== 'stop') throw err;
} finally {
  await browser.close();
}
if (process.exitCode) process.exit();

// --------------------------------------------------------------- output

const pct = (x) => `${Math.round(100 * x)}%`;
if (opts.json) {
  console.log(JSON.stringify({ file: opts.track, cps, bpm: Math.round(cps * 240), bars: totalBars, key, instruments: result, pageErrors: Object.fromEntries(pageErrors) }, null, 2));
  process.exit(0);
}

const out = [];
const keyText = key ? `key estimate ${key.name}${key.outside > 0.02 ? ` (${pct(key.outside)} of note time outside it)` : ''}` : 'no pitched notes';
out.push(`${path.relative(process.cwd(), path.resolve(opts.track))} · ${Math.round(cps * 240)} bpm · ${totalBars} bars · ${keyText}`);
for (const [stem, r] of Object.entries(result)) {
  const p = r.pattern;
  out.push('', stem);
  out.push(`  plays      ${r.sections.join(', ')} · ${r.bars} of ${totalBars} bars (${pct(r.share)}) · ${p.perBar.toFixed(1)} events/bar`);
  if (p.events) {
    const accents = `on the beat ${pct(p.accents.onBeat)}, offbeat 8ths ${pct(p.accents.offbeat8)}, 16ths ${pct(p.accents.sixteenth)}`;
    out.push(`  rhythm     |${p.grid}|  ${accents}${p.offGrid > 0.05 ? ` · ${pct(p.offGrid)} off the 16th grid (triplets, swing or nudges)` : ''}`);
    out.push(`  sound      ${Object.keys(p.sounds).slice(0, 3).join(', ')}`);
  }
  if (p.notes) {
    const n = p.notes;
    const classes = Object.entries(n.classes).slice(0, 7).map(([c, s]) => `${c} ${pct(s)}`).join(', ');
    const outside = Object.keys(n.outside).length ? `outside the key: ${Object.entries(n.outside).map(([c, s]) => `${c} ${pct(s)}`).join(', ')}` : 'all in key';
    out.push(`  notes      ${n.lowest}-${n.highest} (${n.register}) · ${classes} · ${outside}`);
    if (n.chords.length) out.push(`  chords     ${n.chords.slice(0, 8).join(', ')}${n.chords.length > 8 ? ` (+${n.chords.length - 8} more)` : ''}`);
    out.push(`  phrase     bars ${n.phrase.from}-${n.phrase.from + 1}: ${n.phrase.bars.join(' | ')}`);
  }
  const a = r.audio;
  if (a) {
    out.push(`  level      ${Object.entries(a.levels).map(([label, l]) => `${label} ${l.rms.toFixed(1)} dBFS rms, ${pct(l.share)} of what's heard`).join(' · ')}`);
    const width = a.width < -20 ? 'mono' : a.width < -10 ? 'narrow' : a.width < -4 ? 'wide' : 'very wide';
    out.push(`  spectrum   ${hz(a.range[0])}-${hz(a.range[1])}, centre ${hz(a.centroid)}, strongest ${hz(a.strongest)} · ${width} (side ${a.width.toFixed(0)} dB vs mid)`);
    const shape = a.duty < 0.3 ? 'short hits' : a.duty < 0.7 ? 'rhythmic' : 'sustained';
    out.push(`  envelope   ${shape}: sounding ${pct(a.duty)} of the time, crest ${a.crest.toFixed(0)} dB`);
    out.push(`  overlaps   ${a.overlaps.slice(0, 4).map((o) => `${o.with} ${o.range} (${pct(o.share)} of the time in ${o.worst})`).join(' · ') || 'none'}`);
  }
}
const errors = [...pageErrors].filter(([t]) => !/outside nominal range/.test(t));
if (errors.length) out.push('', 'browser errors (run validate.mjs for details)', ...errors.map(([t, n]) => `  ${n > 1 ? `${n}x ` : ''}${t}`));
console.log(out.join('\n'));
