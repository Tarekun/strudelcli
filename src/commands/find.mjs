// look things up in strudel by name: its functions (with their docs and
// examples) and its sounds (synths, drum machine banks, soundfonts and sample
// sets), as loaded by the toolkit and the VSCode extension
//
//   strudelcli find <query>    functions, sounds and banks matching the query. a
//                              query that names a function or a bank exactly
//                              (lpf, RolandTR909) shows its full docs or its sounds
//   strudelcli find --functions | --sounds | --banks [query]
//                              only that kind (--sounds includes bank sounds);
//                              without a query, the full list of it
//   options: --json, --refresh (rebuild the cached list of what exists at runtime)
//
// functions match by name, synonym or description (every word has to match),
// sounds and banks by name: find cb lists the banks that have a cowbell.
// exit code: 0 = found something, 1 = nothing matches (closest names are printed)
//
// docs come from the jsdoc comments in the installed strudel packages (the
// same source strudel.cc's reference is built from). what exists at runtime
// comes from a headless page with strudel loaded, cached per strudel version
// in the cache directory (~/.cache/strudelcli)

import fs from 'node:fs';
import path from 'node:path';
import { openPages } from '../engine/browser.mjs';
import { cacheDir, packageRoot as root } from '../paths.mjs';

const USAGE = 'usage: strudelcli find [query] [--functions] [--sounds] [--banks] [--json] [--refresh]';

const args = process.argv.slice(2);
const json = args.includes('--json');
const refresh = args.includes('--refresh');
const kinds = ['functions', 'sounds', 'banks'].filter((k) => args.includes(`--${k}`));
const query = args.filter((a) => !a.startsWith('--')).join(' ').trim();
const unknown = args.find((a) => a.startsWith('--') && !['--json', '--refresh', ...kinds.map((k) => `--${k}`)].includes(a));
if (unknown) {
  console.error(`unknown option ${unknown}\n${USAGE}`);
  process.exit(2);
}
// --sounds covers everything played with s(), banks included
const want = { functions: !kinds.length || kinds.includes('functions'), sounds: !kinds.length || kinds.includes('sounds') };
want.banks = want.sounds || kinds.includes('banks');

// what the usual drum machine abbreviations stand for
const DRUMS = {
  bd: 'bass drum (kick)',
  sd: 'snare drum',
  hh: 'closed hi-hat',
  oh: 'open hi-hat',
  cp: 'clap',
  rim: 'rimshot',
  cr: 'crash cymbal',
  rd: 'ride cymbal',
  lt: 'low tom',
  mt: 'mid tom',
  ht: 'high tom',
  cb: 'cowbell',
  sh: 'shaker',
  tb: 'tambourine',
  perc: 'percussion',
  misc: 'miscellaneous',
  fx: 'effects',
};

// ---------------------------------------------------------------- docs

const SOURCES = ['@strudel/core', '@strudel/mini', '@strudel/tonal', '@strudel/webaudio', '@strudel/transpiler', 'superdough'];

// the name a jsdoc block documents, from the code right after it
function nameFromCode(code) {
  const line = code.split('\n').find((l) => l.trim()) ?? '';
  let m;
  if ((m = line.match(/register\(\s*\[([^\]]+)\]/))) {
    const names = [...m[1].matchAll(/['"]([\w$]+)['"]/g)].map((x) => x[1]);
    return { name: names[0], synonyms: names.slice(1) };
  }
  if ((m = line.match(/register\(\s*['"]([\w$]+)['"]/))) return { name: m[1] };
  if ((m = line.match(/Pattern\.prototype\.([\w$]+)\s*=/))) return { name: m[1] };
  if ((m = line.match(/export\s+(?:async\s+)?function\s*\*?\s*([\w$]+)/))) return { name: m[1] };
  if ((m = line.match(/export\s+(?:const|let)\s+([\w$]+)\s*=/))) return { name: m[1] };
  if ((m = line.match(/^\s*(?:async\s+)?(?:get\s+|set\s+)?([\w$]+)\s*\([^)]*\)\s*\{/)) && !['if', 'for', 'while', 'switch', 'function'].includes(m[1])) {
    return { name: m[1], internal: true }; // a method of the Pattern class
  }
  return null;
}

function parseDocs() {
  const docs = new Map();
  for (const pkg of SOURCES) {
    const dir = path.join(root, 'node_modules', pkg);
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.mjs'))) {
      const text = fs.readFileSync(path.join(dir, file), 'utf8');
      for (const m of text.matchAll(/\/\*\*([\s\S]*?)\*\//g)) {
        const lines = m[1].split('\n').map((l) => l.replace(/^\s*\* ?/, ''));
        const doc = { description: [], params: [], synonyms: [], examples: [], file: `${pkg.replace('@strudel/', '')}/${file.replace('.mjs', '')}` };
        let tag = null;
        for (const line of lines) {
          const t = line.match(/^@(\w+)\s*(.*)$/);
          if (t) {
            tag = t[1];
            const rest = t[2].trim();
            if (tag === 'name') doc.name = rest;
            else if (tag === 'synonyms') doc.synonyms.push(...rest.split(',').map((s) => s.trim()).filter(Boolean));
            else if (tag === 'param') {
              const p = rest.match(/^(?:\{([^}]*)\})?\s*(\[?[\w$.]+\]?)?\s*(.*)$/);
              doc.params.push({ type: p?.[1] ?? '', name: p?.[2] ?? '', description: p?.[3] ?? '' });
            } else if (tag === 'example') doc.examples.push(rest ? [rest] : []);
            else if (tag === 'returns' || tag === 'return') doc.returns = rest;
            else if (tag === 'superdirtOnly') doc.superdirtOnly = true;
            else if (tag === 'deprecated') doc.deprecated = rest || true;
            else if (tag === 'noAutocomplete') doc.noAutocomplete = true;
            continue;
          }
          if (tag === 'example') doc.examples[doc.examples.length - 1].push(line);
          else if (!tag) doc.description.push(line);
        }
        const fromCode = nameFromCode(text.slice(m.index + m[0].length));
        doc.name ??= fromCode?.name;
        if (!doc.name || /^[^\w$]/.test(doc.name)) continue;
        doc.synonyms = [...new Set([...doc.synonyms, ...(fromCode?.synonyms ?? [])])].filter((s) => s !== doc.name);
        doc.internal = !!fromCode?.internal && !lines.some((l) => l.startsWith('@name'));
        doc.description = doc.description.join('\n').trim();
        doc.examples = doc.examples.map((e) => e.join('\n').trim()).filter(Boolean);
        const seen = docs.get(doc.name);
        if (!seen || doc.description.length + doc.examples.length > seen.description.length + seen.examples.length) docs.set(doc.name, doc);
      }
    }
  }
  return docs;
}

// ---------------------------------------------------------------- runtime snapshot

const version = JSON.parse(fs.readFileSync(path.join(root, 'node_modules/@strudel/web/package.json'), 'utf8')).version;
const snapshotFile = path.join(cacheDir, `library-${version}.json`);

async function snapshot() {
  if (!refresh && fs.existsSync(snapshotFile)) return JSON.parse(fs.readFileSync(snapshotFile, 'utf8'));
  if (!json) console.error('reading what strudel has loaded (cached after the first run)...');
  const browser = await openPages(1);
  try {
    const data = await browser.pages[0].evaluate(async () => {
      const S = window.S;
      // the sound registry lowercases names: recover the spelling from the sample maps
      const ds = 'https://raw.githubusercontent.com/felixroos/dough-samples/main';
      const maps = ['tidal-drum-machines', 'piano', 'Dirt-Samples', 'EmuSP12', 'vcsl', 'mridangam'];
      const source = {};
      for (const map of maps) {
        const list = await (await fetch(`${ds}/${map}.json`)).json();
        for (const name of Object.keys(list)) if (!name.startsWith('_')) source[name.toLowerCase().replace(/\s+/g, '_')] = { name, map };
      }
      const sounds = Object.entries(S.soundMap.get()).map(([key, entry]) => {
        const samples = entry?.data?.samples;
        return {
          name: source[key]?.name ?? key,
          map: source[key]?.map ?? null,
          type: entry?.data?.type ?? 'unknown',
          variants: entry?.data?.fonts?.length ?? (Array.isArray(samples) ? samples.length : samples && typeof samples === 'object' ? Object.keys(samples).length : null),
        };
      });
      return { functions: Object.keys(S), methods: Object.getOwnPropertyNames(S.Pattern.prototype), sounds };
    });
    fs.mkdirSync(path.dirname(snapshotFile), { recursive: true });
    fs.writeFileSync(snapshotFile, JSON.stringify(data));
    return data;
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------- helpers

const summary = (text) => (text.split(/\n\s*\n/)[0].replace(/\s+/g, ' ').match(/^.*?[.!?](\s|$)/)?.[0] ?? text.replace(/\s+/g, ' ')).trim().slice(0, 140);

function distance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  }
  return d[a.length][b.length];
}

// relevance of a function to the query words: names first, then descriptions
function score(doc, words) {
  let total = 0;
  for (const w of words) {
    const names = [doc.name, ...doc.synonyms].map((n) => n.toLowerCase());
    const text = `${doc.description} ${doc.params.map((p) => p.description).join(' ')}`.toLowerCase();
    if (names.includes(w)) total += 100;
    else if (names.some((n) => n.startsWith(w))) total += 40;
    else if (names.some((n) => n.includes(w))) total += 25;
    else if (new RegExp(`\\b${w.replace(/[^\w]/g, '')}`).test(text)) total += 10;
    else return 0; // every word has to match somewhere
  }
  return total;
}

// <bank>_<sound> names: always a bank in the drum machine map, elsewhere
// only when at least 3 sounds share the prefix
function banksOf(sounds) {
  const prefixes = {};
  for (const s of sounds) {
    if (s.type === 'soundfont') continue; // gm_* is a naming scheme, not a bank
    const i = s.name.indexOf('_');
    if (i > 0) (prefixes[s.name.slice(0, i)] ??= []).push({ ...s, short: s.name.slice(i + 1) });
  }
  return Object.fromEntries(
    Object.entries(prefixes)
      .filter(([, list]) => list.length >= 3 || list.some((s) => s.map === 'tidal-drum-machines'))
      .sort(([a], [b]) => a.localeCompare(b)),
  );
}

const variants = (s) => (s.variants > 1 ? `×${s.variants}` : '');
const out = (data, text) => console.log(json ? JSON.stringify(data, null, 2) : text);

// ---------------------------------------------------------------- functions

// each finder returns { exact, data, lines, names }: exact = the query names
// one thing, lines = text to print (empty when nothing matches), names = what
// exists, for suggestions

async function findFunctions() {
  const docs = parseDocs();
  const runtime = await snapshot();
  const available = new Set([...runtime.functions, ...runtime.methods]);
  const isAvailable = (d) => [d.name, ...d.synonyms].some((n) => available.has(n));
  const flags = (d) =>
    [d.superdirtOnly && 'superdirt only: no effect in the browser', d.deprecated && 'deprecated', !isAvailable(d) && 'not available at runtime']
      .filter(Boolean)
      .join(', ');
  const undocumented = [...available].filter((n) => !docs.has(n) && ![...docs.values()].some((d) => d.synonyms.includes(n)) && /^[a-z]/.test(n));
  const names = [...docs.keys(), ...undocumented];

  if (!query) {
    // every documented, user-facing function, grouped by source file
    const byFile = {};
    for (const d of docs.values()) if (!d.internal && !d.noAutocomplete) (byFile[d.file] ??= []).push(d.name);
    const lines = [`${docs.size} documented functions (strudel ${version}). search with: find <words>`, ''];
    for (const [file, list] of Object.entries(byFile).sort()) lines.push(`${file} (${list.length})`, `  ${list.sort().join(' ')}`, '');
    return { data: { functions: byFile }, lines, names };
  }

  const doc = docs.get(query) ?? [...docs.values()].find((d) => d.synonyms.includes(query));
  const words = query.toLowerCase().split(/\s+/);
  const hits = [...docs.values()]
    .filter((d) => d !== doc)
    .map((d) => [d, score(d, words)])
    .filter(([, s]) => s > 0)
    .sort((a, b) => b[1] - a[1] || Number(a[0].internal) - Number(b[0].internal) || a[0].name.localeCompare(b[0].name))
    .slice(0, 25)
    .map(([d]) => d);
  const bare = undocumented.filter((n) => n !== query && words.every((w) => n.toLowerCase().includes(w))).slice(0, 10);
  const data = { functions: hits.map((d) => ({ name: d.name, synonyms: d.synonyms, summary: summary(d.description), file: d.file, flags: flags(d) || undefined })), undocumented: bare };
  const lines = [];

  if (doc) {
    data.function = { ...doc, available: isAvailable(doc) };
    lines.push(`${doc.name}${doc.synonyms.length ? `  (synonyms: ${doc.synonyms.join(', ')})` : ''}  [${doc.file}]`);
    if (flags(doc)) lines.push(`  ! ${flags(doc)}`);
    if (doc.description) lines.push('', doc.description);
    if (doc.params.length) lines.push('', 'params', ...doc.params.map((p) => `  ${p.name}${p.type ? ` {${p.type}}` : ''}  ${p.description}`));
    if (doc.returns) lines.push('', `returns ${doc.returns}`);
    for (const e of doc.examples) lines.push('', 'example', ...e.split('\n').map((l) => `  ${l}`));
    // the full docs are what was asked for: the other hits are just pointers
    const also = [...hits.map((d) => d.name), ...bare].slice(0, 10);
    if (also.length) lines.push('', `see also: ${also.join(' ')}`);
    return { exact: true, data, lines, names };
  }
  if (available.has(query)) {
    data.function = { name: query, documented: false, available: true };
    lines.push(`${query}: exists at runtime but has no docs`);
  }
  if (hits.length) {
    if (lines.length) lines.push('');
    lines.push('functions:');
    for (const d of hits) {
      const f = flags(d);
      lines.push(`  ${d.name}${d.synonyms.length ? ` (${d.synonyms.join(', ')})` : ''}: ${summary(d.description) || '-'}  [${d.file}]${f ? `  ! ${f}` : ''}`);
    }
  }
  if (bare.length) lines.push(...(lines.length ? [''] : []), `no docs, but exist at runtime: ${bare.join(' ')}`);
  if (hits.length) lines.push('', 'details: find <name>');
  return { exact: available.has(query), data, lines, names };
}

// ---------------------------------------------------------------- sounds and banks

async function findSounds() {
  const sounds = (await snapshot()).sounds.filter((s) => !s.name.startsWith('_'));
  const banks = banksOf(sounds);
  const inBank = new Set(Object.values(banks).flat().map((s) => s.name));
  const synths = sounds.filter((s) => s.type === 'synth');
  const fonts = sounds.filter((s) => s.type === 'soundfont');
  const samples = sounds.filter((s) => !['synth', 'soundfont'].includes(s.type) && !inBank.has(s.name));
  const bankLine = (name, list) => `${name}: ${list.map((s) => `${s.short}${variants(s)}`).join(' ')}`;
  const names = [...synths, ...fonts, ...samples].map((s) => s.name).concat(Object.keys(banks));
  const result = { sounds: { names }, banks: { names } };

  if (!query) {
    const maps = {};
    // the EmuSP12 map registers plain drum names: what s("bd") plays without a bank
    for (const s of samples) (maps[s.map === 'EmuSP12' ? 'default drums, no .bank() (EmuSP12)' : s.map ?? 'other'] ??= []).push(s);
    result.sounds.data = { synths: synths.map((s) => s.name), soundfonts: fonts.map((s) => s.name), banks: Object.keys(banks), samples: maps };
    result.sounds.lines = [
      `${sounds.length} sounds (strudel ${version}, same sample maps as the VSCode extension)`,
      '',
      `synths (${synths.length}), no .bank(): ${synths.map((s) => s.name).sort().join(' ')}`,
      '',
      `drum machine banks (${Object.keys(banks).length}): use s("bd").bank("<bank>"). their sounds: find --banks`,
      `  ${Object.keys(banks).join(' ')}`,
      '',
      `soundfonts (${fonts.length}), General MIDI instruments played with note(), no .bank(), .n(i) picks the font: ${fonts.map((s) => s.name).join(' ')}`,
      '',
      'sample sets, used as s("<name>") or s("<name>:n"):',
      ...Object.entries(maps).map(([map, list]) => `  ${map} (${list.length}): ${list.slice(0, 40).map((s) => s.name).join(' ')}${list.length > 40 ? ' ...' : ''}`),
      '',
      'search: find <query>',
    ];
    result.banks.data = { banks: Object.fromEntries(Object.entries(banks).map(([n, list]) => [n, list.map((s) => ({ name: s.short, variants: s.variants }))])) };
    result.banks.lines = [
      `${Object.keys(banks).length} banks (×n = variants, pick one with :n). sounds: ${Object.entries(DRUMS).map(([k, v]) => `${k} ${v}`).join(', ')}`,
      '',
      ...Object.entries(banks).map(([name, list]) => bankLine(name, list)),
    ];
    return result;
  }

  const q = query.toLowerCase();
  const bank = Object.keys(banks).find((b) => b.toLowerCase() === q);
  if (bank) {
    const list = banks[bank];
    const lines = [`${bank}: ${list.length} sounds`, ''];
    for (const s of list) lines.push(`  ${s.short.padEnd(6)} ${String(s.variants ?? 1).padStart(3)} variant${s.variants === 1 ? ' ' : 's'}  ${DRUMS[s.short] ?? ''}`);
    const first = list[0];
    lines.push('', 'usage', `  s("${first.short}*4").bank("${bank}")       // variant 0`, `  s("${first.short}:1*4").bank("${bank}")     // variant 1, or .n(1)`);
    Object.assign(result.banks, { exact: true, data: { bank: { name: bank, sounds: list.map((s) => ({ name: s.short, variants: s.variants, meaning: DRUMS[s.short] })) } }, lines });
  } else {
    // a bank named like the query lists all its sounds, any other only the matching ones
    const hits = Object.entries(banks)
      .map(([name, list]) => [name, name.toLowerCase().includes(q) ? list : list.filter((s) => s.short.toLowerCase().includes(q))])
      .filter(([, list]) => list.length);
    // all of them when banks are what was asked for
    const max = kinds.includes('banks') ? Infinity : 30;
    const lines = hits.length
      ? [
          `in ${hits.length} banks${DRUMS[q] ? ` (${q} = ${DRUMS[q]})` : ''}, as s("<sound>").bank("<bank>"), ×n = variants:`,
          ...hits.slice(0, max).map(([n, list]) => `  ${bankLine(n, list)}`),
          ...(hits.length > max ? [`  ... ${hits.length - max} more: find --banks ${query}`] : []),
        ]
      : [];
    Object.assign(result.banks, { data: { banks: Object.fromEntries(hits.map(([n, l]) => [n, l.map((s) => ({ name: s.short, variants: s.variants }))])) }, lines });
  }

  const hitSynths = synths.filter((s) => s.name.toLowerCase().includes(q));
  const hitFonts = fonts.filter((s) => s.name.toLowerCase().includes(q));
  const hitSamples = samples.filter((s) => s.name.toLowerCase().includes(q));
  const lines = [];
  if (hitSynths.length) lines.push(`synths (no .bank()): ${hitSynths.map((s) => s.name).join(' ')}`, '');
  if (hitFonts.length) lines.push(`soundfonts, as note(...).s("<name>"), no .bank(): ${hitFonts.map((s) => `${s.name}${variants(s)}`).join(' ')}`, '');
  if (hitSamples.length) lines.push('samples, as s("<name>"):', ...hitSamples.slice(0, 40).map((s) => `  ${s.name}${variants(s)}  [${s.map ?? s.type}]`), ...(hitSamples.length > 40 ? [`  ... ${hitSamples.length - 40} more`] : []));
  if (lines.at(-1) === '') lines.pop();
  const exact = [...hitSynths, ...hitFonts, ...hitSamples].some((s) => s.name.toLowerCase() === q);
  Object.assign(result.sounds, { exact, data: { synths: hitSynths, soundfonts: hitFonts, samples: hitSamples }, lines });
  return result;
}

// ---------------------------------------------------------------- find

const sections = [];
if (want.functions) sections.push(await findFunctions());
if (want.sounds || want.banks) {
  const found = await findSounds();
  if (want.sounds) sections.push(found.sounds);
  if (want.banks && (query || !want.sounds || kinds.includes('banks'))) sections.push(found.banks);
}

if (!query && !kinds.length) {
  // no query and no kind: what there is and how to look
  const [fns, snd] = sections;
  const d = snd.data;
  const counts = `${Object.values(fns.data.functions).flat().length} functions, ${d.synths.length} synths, ${d.banks.length} drum machine banks, ${d.soundfonts.length} soundfonts, ${Object.values(d.samples).flat().length} sample sets`;
  out({ functions: fns.data.functions, ...d }, [`strudel ${version}: ${counts}`, '', USAGE, '  find <query>          functions, sounds and banks by name (and functions by description)', '  find --functions      every function, by source file', '  find --sounds         every synth, soundfont, bank and sample set', '  find --banks          every bank with its sounds'].join('\n'));
  process.exit(0);
}

// exact matches first: they're what the query asked for
const shown = sections.filter((s) => s.lines.length).sort((a, b) => Number(!!b.exact) - Number(!!a.exact));
if (!shown.length) {
  const all = [...new Set(sections.flatMap((s) => s.names))];
  const close = all.map((n) => [n, distance(n.toLowerCase(), query.toLowerCase())]).sort((a, b) => a[1] - b[1]).slice(0, 8).map(([n]) => n);
  if (json) console.log(JSON.stringify({ query, found: false, closest: close }, null, 2));
  else console.error(`nothing matches "${query}". closest: ${close.join(', ')}`);
  process.exit(1);
}
out(Object.assign({ query }, ...shown.map((s) => s.data)), shown.map((s) => s.lines.join('\n')).join('\n\n'));
