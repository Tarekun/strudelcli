// reads the arrange(...) call of a track: section lengths, labels and the
// instruments stacked in each section, and rewrites it to solo one instrument

// same text with comments blanked out (positions preserved), so the parser
// can ignore commented-out sections without losing track of offsets
export function blankComments(code) {
  let out = '';
  let quote = null;
  for (let i = 0; i < code.length; i++) {
    const c = code[i];
    if (quote) {
      out += c;
      if (c === '\\') out += code[++i] ?? '';
      else if (c === quote) quote = null;
    } else if (c === '"' || c === "'" || c === '`') {
      quote = c;
      out += c;
    } else if (c === '/' && code[i + 1] === '/') {
      while (i < code.length && code[i] !== '\n') out += ' ', i++;
      out += code[i] ?? '';
    } else if (c === '/' && code[i + 1] === '*') {
      while (i < code.length && !(code[i] === '*' && code[i + 1] === '/')) out += code[i] === '\n' ? '\n' : ' ', i++;
      out += '  ';
      i++;
    } else out += c;
  }
  return out;
}

// index of the bracket closing the one at `open`, skipping strings
function closing(text, open) {
  let depth = 0;
  let quote = null;
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = null;
    } else if (c === '"' || c === "'" || c === '`') quote = c;
    else if ('([{'.includes(c)) depth++;
    else if (')]}'.includes(c) && --depth === 0) return i;
  }
  throw new Error(`unbalanced bracket at ${open}`);
}

// split on commas that aren't nested in brackets or strings
function splitTopLevel(text) {
  const parts = [];
  let depth = 0;
  let quote = null;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = null;
    } else if (c === '"' || c === "'" || c === '`') quote = c;
    else if ('([{'.includes(c)) depth++;
    else if (')]}'.includes(c)) depth--;
    else if (c === ',' && depth === 0) parts.push(text.slice(start, i)), (start = i + 1);
  }
  parts.push(text.slice(start));
  return parts.map((p) => p.trim()).filter(Boolean);
}

// a section label is the last plain comment line above it in the arrange,
// e.g. "// ---- drop 1 (128)" -> "drop 1". commented-out sections don't count
function labelBefore(code, from, to) {
  const lines = code.slice(from, to).split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    const m = lines[i].match(/^\s*\/\/\s*(.*)$/);
    if (!m || /^\[\s*\d/.test(m[1]) || /^\/\//.test(m[1])) continue;
    const label = m[1].replace(/^-+\s*/, '').replace(/\s*\(\d+\)\s*:?.*$/, '').trim();
    if (label) return label;
  }
  return null;
}

/**
 * parse the last arrange(...) call in a track.
 * returns { start, end, sections: [{ bars, from, label, parts }] } where
 * from is the section's first bar and parts are the stacked expressions,
 * or null if the track has no arrange
 */
export function parseArrange(code) {
  const text = blankComments(code);
  const calls = [...text.matchAll(/\barrange\s*\(/g)];
  if (!calls.length) return null;
  const call = calls[calls.length - 1];
  const open = call.index + call[0].length - 1;
  const close = closing(text, open);

  const sections = [];
  let bar = 0;
  let label = null;
  let cursor = open + 1;
  let i = open + 1;
  while (i < close) {
    if (text[i] !== '[') {
      i++;
      continue;
    }
    const end = closing(text, i);
    const [bars, ...rest] = splitTopLevel(text.slice(i + 1, end));
    const expr = rest.join(', ');
    label = labelBefore(code, cursor, i) ?? label;
    const stack = expr.match(/^stack\s*\(/);
    const parts =
      stack && closing(expr, stack[0].length - 1) === expr.length - 1
        ? splitTopLevel(expr.slice(stack[0].length, -1))
        : [expr];
    sections.push({ bars: Number(bars), from: bar, label, parts });
    bar += Number(bars);
    cursor = end + 1;
    i = end + 1;
  }
  return { start: call.index, end: close + 1, sections };
}

// every distinct instrument expression used anywhere in the arrange
export function stemsOf(arrangement) {
  return [...new Set(arrangement.sections.flatMap((s) => s.parts.map(normalise)))];
}

// an instrument expression without whitespace, except inside strings where
// it's collapsed to single spaces: kick.mask("<1!7 [1 1 1 0]>") stays readable
export function normalise(part) {
  let out = '';
  let quote = null;
  for (let i = 0; i < part.length; i++) {
    const c = part[i];
    if (quote) {
      if (/\s/.test(c)) {
        if (!/\s/.test(part[i - 1])) out += ' ';
        continue;
      }
      out += c;
      if (c === '\\') out += part[++i] ?? '';
      else if (c === quote) quote = null;
    } else if (c === '"' || c === "'" || c === '`') {
      quote = c;
      out += c;
    } else if (!/\s/.test(c)) out += c;
  }
  return out;
}

// the track with its arrange rewritten so only `stem` plays: sections that
// use it keep just that instrument, the rest become silence of the same length
export function soloCode(code, arrangement, stem) {
  const sections = arrangement.sections.map(({ bars, parts }) => {
    const keep = parts.filter((p) => normalise(p) === stem);
    return `  [${bars}, ${keep.length ? `stack(${keep.join(', ')})` : 'silence'}],`;
  });
  return `${code.slice(0, arrangement.start)}arrange(\n${sections.join('\n')}\n)${code.slice(arrangement.end)}`;
}
