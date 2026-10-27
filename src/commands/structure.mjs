// the arrangement of a track at a glance: a timeline of what changes at each
// section, a map of which instrument plays in which part, which definitions
// feed which instruments (and which never reach the arrange), and notes on
// abrupt or static stretches. reads the code only, so it's instant
//
//   strudelcli structure <track.strudel.js> [--json]

import fs from 'node:fs';
import path from 'node:path';
import { blankComments, normalise, parseArrange } from '../code/arrange.mjs';

const BIG_CHANGE = 6; // instruments added + removed at one boundary
const STATIC_BARS = 64; // bars without any change in instruments

const args = process.argv.slice(2);
const json = args.includes('--json');
const [file] = args.filter((a) => !a.startsWith('--'));
if (!file) {
  console.error('usage: strudelcli structure <track.strudel.js> [--json]');
  process.exit(2);
}
const code = fs.readFileSync(file, 'utf8');
const text = blankComments(code);
const arrangement = parseArrange(code);
if (!arrangement?.sections.length) {
  console.error(`${file}: no arrange(...) found, nothing to show`);
  process.exit(2);
}
const sections = arrangement.sections.map((s) => ({ ...s, parts: s.parts.map(normalise) }));

// tempo from setcps(...) / setcpm(...), if it's plain arithmetic
function tempo() {
  const m = text.match(/\bset(cps|cpm)\s*\(([\d\s.+\-*/()]+)\)/);
  if (!m) return null;
  const value = Function(`return (${m[2]})`)();
  return m[1] === 'cps' ? value : value / 60;
}
const cps = tempo();
const clock = (bar) => {
  if (!cps) return '';
  const s = bar / cps;
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};
const totalBars = sections.reduce((n, s) => n + s.bars, 0);

// top-level const definitions and the other definitions each one uses
const defs = [...text.matchAll(/^[ \t]*const\s+([A-Za-z_$][\w$]*)\s*=/gm)].map((m) => ({ name: m[1], start: m.index }));
const names = new Set(defs.map((d) => d.name));
for (const [i, d] of defs.entries()) {
  const end = defs[i + 1]?.start ?? (arrangement.start > d.start ? arrangement.start : text.length);
  d.uses = [...new Set(text.slice(d.start, end).match(/[A-Za-z_$][\w$]*/g))].filter((n) => names.has(n) && n !== d.name);
}
const byName = Object.fromEntries(defs.map((d) => [d.name, d]));
const identifiers = (expr) => (expr.match(/[A-Za-z_$][\w$]*/g) ?? []).filter((n) => names.has(n));

// everything the arrange reaches, directly or through other definitions
const placed = new Set(sections.flatMap((s) => s.parts.flatMap(identifiers)));
const reached = new Set();
const visit = (name) => {
  if (reached.has(name)) return;
  reached.add(name);
  byName[name]?.uses.forEach(visit);
};
placed.forEach(visit);
const referenced = (name) => (text.match(new RegExp(`(?<![\\w$.])${name.replace(/\$/g, '\\$')}(?![\\w$])`, 'g')) ?? []).length > 1;
const unreached = defs.filter((d) => !reached.has(d.name)).map((d) => ({ name: d.name, referenced: referenced(d.name) }));
// building blocks: reached definitions that other definitions are made from
const usedBy = {};
for (const d of defs) for (const u of d.uses) if (reached.has(d.name)) (usedBy[u] ??= []).push(d.name);

// timeline: what each section adds and removes
let previous = new Set();
const timeline = sections.map((s) => {
  const now = new Set(s.parts);
  const added = [...now].filter((p) => !previous.has(p));
  const removed = [...previous].filter((p) => !now.has(p));
  previous = now;
  return { from: s.from, bars: s.bars, label: s.label, time: clock(s.from), parts: s.parts, added, removed };
});

// groups of consecutive sections with the same label, and who plays in them
const groups = [];
for (const s of sections) {
  const last = groups[groups.length - 1];
  if (last && last.label === s.label) last.sections.push(s);
  else groups.push({ label: s.label ?? `bar ${s.from}`, from: s.from, sections: [s] });
}
const instruments = [...new Set(sections.flatMap((s) => s.parts))].map((name) => ({
  name,
  bars: sections.filter((s) => s.parts.includes(name)).reduce((n, s) => n + s.bars, 0),
  groups: groups.map((g) => {
    const total = g.sections.reduce((n, s) => n + s.bars, 0);
    return g.sections.filter((s) => s.parts.includes(name)).reduce((n, s) => n + s.bars, 0) / total;
  }),
}));

const notes = [];
for (const t of timeline.slice(1)) {
  if (t.added.length + t.removed.length >= BIG_CHANGE) {
    notes.push(`bar ${t.from}${t.label ? ` (${t.label})` : ''}: ${t.added.length + t.removed.length} instruments change at once (${[...t.added.map((a) => `+${a}`), ...t.removed.map((r) => `-${r}`)].join(' ')})`);
  }
}
for (let i = 0; i < timeline.length; ) {
  let j = i + 1;
  while (j < timeline.length && !timeline[j].added.length && !timeline[j].removed.length) j++;
  const bars = timeline.slice(i, j).reduce((n, t) => n + t.bars, 0);
  if (bars >= STATIC_BARS) notes.push(`bars ${timeline[i].from}-${timeline[i].from + bars}: ${bars} bars with the same instruments`);
  i = j;
}
for (const u of unreached) {
  notes.push(`${u.name} is defined but never reaches the arrange${u.referenced ? ' (only used by other unused definitions)' : ''}`);
}

if (json) {
  const report = {
    file,
    cps,
    bpm: cps && Math.round(cps * 240),
    bars: totalBars,
    seconds: cps && totalBars / cps,
    timeline,
    groups: groups.map((g) => ({ label: g.label, from: g.from, bars: g.sections.reduce((n, s) => n + s.bars, 0) })),
    instruments,
    buildingBlocks: usedBy,
    unreached,
    notes,
  };
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

const out = [];
out.push(`${path.relative(process.cwd(), path.resolve(file))} · ${cps ? `${Math.round(cps * 240)} bpm · ` : ''}${totalBars} bars${cps ? `, ${clock(totalBars)}` : ''} · ${sections.length} sections, ${instruments.length} instruments`);
out.push('', 'timeline');
const labelWidth = Math.max(...timeline.map((t) => (t.label ?? '').length));
for (const t of timeline) {
  const changes = t === timeline[0] ? t.parts.join(' ') : [...t.added.map((a) => `+${a}`), ...t.removed.map((r) => `-${r}`)].join(' ') || '(same)';
  out.push(`  ${t.time.padStart(5)}  bar ${String(t.from).padStart(4)}  ${(t.label ?? '').padEnd(labelWidth)}  ${String(t.bars).padStart(3)}  ${changes}`);
}
out.push('', 'map (█ whole part, ▄ some of it)');
const nameWidth = Math.max(...instruments.map((i) => i.name.length));
const widths = groups.map((g) => Math.max(g.label.length, 1));
out.push(`  ${''.padEnd(nameWidth)}  ${groups.map((g, i) => g.label.padEnd(widths[i])).join(' ')}`);
for (const ins of instruments) {
  out.push(`  ${ins.name.padEnd(nameWidth)}  ${ins.groups.map((share, i) => (share === 1 ? '█' : share > 0 ? '▄' : '·').padEnd(widths[i])).join(' ')}`);
}
const blocks = Object.entries(usedBy).filter(([name]) => names.has(name));
if (blocks.length) {
  out.push('', 'building blocks (editing one changes the instruments made from it)');
  for (const [name, users] of blocks) out.push(`  ${name} -> ${users.join(', ')}`);
}
if (notes.length) out.push('', 'notes', ...notes.map((n) => `  - ${n}`));
console.log(out.join('\n'));
