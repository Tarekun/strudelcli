// look things up in strudel: its functions (with their docs and examples) and
// its sounds (synths, drum machine banks and sample sets), as loaded by the
// toolkit and the VSCode extension
//
//   node library.mjs functions [query]   search functions by name, synonym or description
//   node library.mjs function <name>     full docs of one function: params, synonyms, examples
//   node library.mjs sounds [query]      search sounds: synths, bank sounds, sample sets
//   node library.mjs banks [query]       drum machine banks with their sounds; the query
//                                        matches bank names or a sound they have (banks cb)
//   node library.mjs bank <name>         one bank: its sounds, how many variants each, usage
//   options: --json, --refresh (rebuild the cached list of what exists at runtime)
//
// docs come from the jsdoc comments in the installed strudel packages (the
// same source strudel.cc's reference is built from). what exists at runtime
// comes from a headless page with strudel loaded, cached per strudel version
// in .sample-cache

import fs from 'node:fs';
import path from 'node:path';
import { openPages, root } from './browser.mjs';

const args = process.argv.slice(2);
const json = args.includes('--json');
const refresh = args.includes('--refresh');
const [command, ...words] = args.filter((a) => !a.startsWith('--'));
const query = words.join(' ').trim();

const USAGE = `usage: node library.mjs <command> [query] [--json] [--refresh]
  functions [query]   search functions
  function <name>     one function's docs
  sounds [query]      search sounds
  banks [query]       drum machine banks (query: bank name or a sound abbreviation)
  bank <name>         one bank's sounds`;

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
const snapshotFile = path.join(root, '.sample-cache', `library-${version}.json`);

async function snapshot() {
  if (!refresh && fs.existsSync(snapshotFile)) return JSON.parse(fs.readFileSync(snapshotFile, 'utf8'));
  if (!json) console.error('reading what strudel has loaded (cached after the first run)...');
  const browser = await openPages(1);
  try {
    const data = await browser.pages[0].evaluate(async () => {
      const S = window.S;
      // the sound registry lowercases names: recover the spelling from the sample maps
      const ds = 'https://raw.githubusercontent.com/felixroos/dough-samples/main';
      const maps = ['tidal-drum-machines', 'piano', 'Dirt-Samples', 'EmuSP12', 'vcsl'];
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
          variants: Array.isArray(samples) ? samples.length : samples && typeof samples === 'object' ? Object.keys(samples).length : null,
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

// ---------------------------------------------------------------- commands

if (!command) {
  console.error(USAGE);
  process.exit(2);
}

if (command === 'functions' || command === 'function') {
  const docs = parseDocs();
  const runtime = await snapshot();
  const available = new Set([...runtime.functions, ...runtime.methods]);
  const isAvailable = (d) => [d.name, ...d.synonyms].some((n) => available.has(n));
  const flags = (d) =>
    [d.superdirtOnly && 'superdirt only: no effect in the browser', d.deprecated && 'deprecated', !isAvailable(d) && 'not available at runtime']
      .filter(Boolean)
      .join(', ');
  const undocumented = [...available].filter((n) => !docs.has(n) && ![...docs.values()].some((d) => d.synonyms.includes(n)) && /^[a-z]/.test(n));

  if (command === 'function') {
    const name = query;
    const doc = docs.get(name) ?? [...docs.values()].find((d) => d.synonyms.includes(name));
    if (!doc) {
      const close = [...docs.keys(), ...undocumented].map((n) => [n, distance(n.toLowerCase(), name.toLowerCase())]).sort((a, b) => a[1] - b[1]).slice(0, 5).map(([n]) => n);
      if (available.has(name)) out({ name, documented: false, available: true }, `${name}: exists at runtime but has no docs`);
      else {
        console.error(`no function "${name}". closest: ${close.join(', ')}`);
        process.exit(1);
      }
      process.exit(0);
    }
    const lines = [`${doc.name}${doc.synonyms.length ? `  (synonyms: ${doc.synonyms.join(', ')})` : ''}  [${doc.file}]`];
    if (flags(doc)) lines.push(`  ! ${flags(doc)}`);
    if (doc.description) lines.push('', doc.description);
    if (doc.params.length) lines.push('', 'params', ...doc.params.map((p) => `  ${p.name}${p.type ? ` {${p.type}}` : ''}  ${p.description}`));
    if (doc.returns) lines.push('', `returns ${doc.returns}`);
    for (const e of doc.examples) lines.push('', 'example', ...e.split('\n').map((l) => `  ${l}`));
    out({ ...doc, available: isAvailable(doc) }, lines.join('\n'));
  } else if (!query) {
    // overview: every documented, user-facing function, grouped by source file
    const byFile = {};
    for (const d of docs.values()) if (!d.internal && !d.noAutocomplete) (byFile[d.file] ??= []).push(d.name);
    const lines = [`${docs.size} documented functions (strudel ${version}). search with: functions <words>`, ''];
    for (const [file, names] of Object.entries(byFile).sort()) lines.push(`${file} (${names.length})`, `  ${names.sort().join(' ')}`, '');
    out(byFile, lines.join('\n'));
  } else {
    const words = query.toLowerCase().split(/\s+/);
    const hits = [...docs.values()]
      .map((d) => [d, score(d, words)])
      .filter(([, s]) => s > 0)
      .sort((a, b) => b[1] - a[1] || Number(a[0].internal) - Number(b[0].internal) || a[0].name.localeCompare(b[0].name))
      .slice(0, 25)
      .map(([d]) => d);
    const bare = undocumented.filter((n) => words.every((w) => n.toLowerCase().includes(w))).slice(0, 10);
    const lines = hits.map((d) => {
      const f = flags(d);
      return `${d.name}${d.synonyms.length ? ` (${d.synonyms.join(', ')})` : ''}: ${summary(d.description) || '-'}  [${d.file}]${f ? `  ! ${f}` : ''}`;
    });
    if (bare.length) lines.push('', `no docs, but exist at runtime: ${bare.join(' ')}`);
    if (!lines.length) lines.push(`nothing matches "${query}"`);
    else lines.push('', 'details: node toolkit/library.mjs function <name>');
    out({ query, functions: hits.map((d) => ({ name: d.name, synonyms: d.synonyms, summary: summary(d.description), file: d.file, flags: flags(d) || undefined })), undocumented: bare }, lines.join('\n'));
  }
} else if (['sounds', 'banks', 'bank'].includes(command)) {
  const sounds = (await snapshot()).sounds.filter((s) => !s.name.startsWith('_'));
  const banks = banksOf(sounds);
  const inBank = new Set(Object.values(banks).flat().map((s) => s.name));
  const synths = sounds.filter((s) => s.type === 'synth');
  const samples = sounds.filter((s) => s.type !== 'synth' && !inBank.has(s.name));
  const bankLine = (name, list) => `${name}: ${list.map((s) => `${s.short}${variants(s)}`).join(' ')}`;

  if (command === 'bank') {
    const name = Object.keys(banks).find((b) => b.toLowerCase() === query.toLowerCase());
    if (!name) {
      const close = Object.keys(banks).map((b) => [b, distance(b.toLowerCase(), query.toLowerCase())]).sort((a, b) => a[1] - b[1]).slice(0, 5).map(([b]) => b);
      console.error(`no bank "${query}". closest: ${close.join(', ')}`);
      process.exit(1);
    }
    const list = banks[name];
    const lines = [`${name}: ${list.length} sounds`, ''];
    for (const s of list) lines.push(`  ${s.short.padEnd(6)} ${String(s.variants ?? 1).padStart(3)} variant${s.variants === 1 ? ' ' : 's'}  ${DRUMS[s.short] ?? ''}`);
    const first = list[0];
    lines.push('', 'usage', `  s("${first.short}*4").bank("${name}")       // variant 0`, `  s("${first.short}:1*4").bank("${name}")     // variant 1, or .n(1)`);
    out({ bank: name, sounds: list.map((s) => ({ name: s.short, variants: s.variants, meaning: DRUMS[s.short] })) }, lines.join('\n'));
  } else if (command === 'banks') {
    const q = query.toLowerCase();
    const matching = Object.entries(banks).filter(([name, list]) => !q || name.toLowerCase().includes(q) || list.some((s) => s.short.toLowerCase() === q));
    const lines = matching.map(([name, list]) => bankLine(name, list));
    if (!lines.length) lines.push(`no bank is called or has a sound "${query}"`);
    else lines.unshift(`${matching.length} banks${q ? ` matching "${query}"` : ''} (×n = variants, pick one with :n). sounds: ${Object.entries(DRUMS).map(([k, v]) => `${k} ${v}`).join(', ')}`, '');
    out(Object.fromEntries(matching.map(([n, list]) => [n, list.map((s) => ({ name: s.short, variants: s.variants }))])), lines.join('\n'));
  } else if (!query) {
    const maps = {};
    // the EmuSP12 map registers plain drum names: what s("bd") plays without a bank
    for (const s of samples) (maps[s.map === 'EmuSP12' ? 'default drums, no .bank() (EmuSP12)' : s.map ?? 'other'] ??= []).push(s);
    const lines = [
      `${sounds.length} sounds (strudel ${version}, same sample maps as the VSCode extension)`,
      '',
      `synths (${synths.length}), no .bank(): ${synths.map((s) => s.name).sort().join(' ')}`,
      '',
      `drum machine banks (${Object.keys(banks).length}): use s("bd").bank("<bank>"). list them: banks [query]`,
      `  ${Object.keys(banks).join(' ')}`,
      '',
      'sample sets, used as s("<name>") or s("<name>:n"):',
      ...Object.entries(maps).map(([map, list]) => `  ${map} (${list.length}): ${list.slice(0, 40).map((s) => s.name).join(' ')}${list.length > 40 ? ' ...' : ''}`),
      '',
      'search: sounds <query>',
    ];
    out({ synths: synths.map((s) => s.name), banks: Object.keys(banks), samples: maps }, lines.join('\n'));
  } else {
    const q = query.toLowerCase();
    const hitSynths = synths.filter((s) => s.name.toLowerCase().includes(q));
    const hitBanks = Object.entries(banks)
      .map(([name, list]) => [name, list.filter((s) => s.short.toLowerCase().includes(q) || name.toLowerCase().includes(q))])
      .filter(([, list]) => list.length);
    const hitSamples = samples.filter((s) => s.name.toLowerCase().includes(q));
    const lines = [];
    if (hitSynths.length) lines.push(`synths (no .bank()): ${hitSynths.map((s) => s.name).join(' ')}`, '');
    if (hitBanks.length) lines.push(`in ${hitBanks.length} banks, as s("<sound>").bank("<bank>"):`, ...hitBanks.slice(0, 30).map(([n, list]) => `  ${bankLine(n, list)}`), ...(hitBanks.length > 30 ? [`  ... ${hitBanks.length - 30} more`] : []), '');
    if (hitSamples.length) lines.push('samples, as s("<name>"):', ...hitSamples.slice(0, 40).map((s) => `  ${s.name}${variants(s)}  [${s.map ?? s.type}]`), ...(hitSamples.length > 40 ? [`  ... ${hitSamples.length - 40} more`] : []));
    if (!lines.length) lines.push(`no sound matches "${query}"`);
    out({ synths: hitSynths, banks: Object.fromEntries(hitBanks.map(([n, l]) => [n, l.map((s) => ({ name: s.short, variants: s.variants }))])), samples: hitSamples }, lines.join('\n'));
  }
} else {
  console.error(USAGE);
  process.exit(2);
}
