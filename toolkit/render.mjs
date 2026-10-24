// offline renderer: plays a .strudel.js track in headless chromium through an
// OfflineAudioContext (faster than real time) and writes float32 wavs
//
//   node render.mjs <track.strudel.js> [options]
//     --out <dir>      output directory (default: out/<track name>)
//     --from <bar>     first bar to render (default 0)
//     --to <bar>       bar to stop at (default: end of the arrange)
//     --stems          also render every instrument of the arrange on its own
//     --chunk <bars>   bars per offline render (default 32)
//     --tail <sec>     extra render time per chunk for releases, reverb and
//                      delay tails to ring out (default 12)
//     --rate <hz>      sample rate (default 44100)
//     --workers <n>    chunks rendered in parallel (default: cores - 2)
//     --verbose        print how long each chunk takes
//
// writes <out>/mix.wav (float32), <out>/stems/<name>.wav (16-bit) and <out>/meta.json
//
// long tracks are rendered in chunks: each chunk renders only the notes that
// start inside it, but keeps rendering for --tail seconds, and the chunks are
// overlap-added. the result matches a single render except that the kick's
// sidechain can't duck tails that spill over from the previous chunk

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { normalise, parseArrange, soloCode, stemsOf } from './arrange.mjs';
import { load, openPages, renderChunk, root } from './browser.mjs';

function parseArgs(argv) {
  const opts = { chunk: 32, tail: 12, rate: 44100, from: 0, stems: false };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--stems' || a === '--verbose') opts[a.slice(2)] = true;
    else if (a.startsWith('--')) opts[a.slice(2)] = isNaN(argv[i + 1]) ? argv[++i] : Number(argv[++i]);
    else rest.push(a);
  }
  if (rest.length !== 1) {
    console.error('usage: node render.mjs <track.strudel.js> [--out dir] [--from bar] [--to bar] [--stems]');
    process.exit(1);
  }
  opts.track = path.resolve(rest[0]);
  opts.name = path.basename(opts.track).replace(/\.strudel\.js$|\.js$/, '');
  opts.out = path.resolve(opts.out ?? path.join(root, 'out', opts.name));
  return opts;
}

// streaming stereo wav writer, float32 or 16-bit: header sizes are patched on close
function wavWriter(file, rate, format = 'float') {
  const fd = fs.openSync(file, 'w');
  const header = Buffer.alloc(44);
  fs.writeSync(fd, header);
  const width = format === 'float' ? 4 : 2;
  let bytes = 0;
  return {
    write(samples) {
      let buf;
      if (format === 'float') buf = Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength);
      else {
        const ints = new Int16Array(samples.length);
        for (let i = 0; i < samples.length; i++) ints[i] = Math.max(-32768, Math.min(32767, Math.round(samples[i] * 32767)));
        buf = Buffer.from(ints.buffer);
      }
      fs.writeSync(fd, buf);
      bytes += buf.length;
    },
    close() {
      header.write('RIFF', 0);
      header.writeUInt32LE(36 + bytes, 4);
      header.write('WAVEfmt ', 8);
      header.writeUInt32LE(16, 16);
      header.writeUInt16LE(format === 'float' ? 3 : 1, 20); // IEEE float or PCM
      header.writeUInt16LE(2, 22); // stereo
      header.writeUInt32LE(rate, 24);
      header.writeUInt32LE(rate * 2 * width, 28);
      header.writeUInt16LE(2 * width, 32);
      header.writeUInt16LE(8 * width, 34);
      header.write('data', 36);
      header.writeUInt32LE(bytes, 40);
      fs.writeSync(fd, header, 0, 44, 0);
      fs.closeSync(fd);
    },
  };
}

// collects one job's chunks as they finish (in any order) and writes them to
// its wav in order, overlap-adding each chunk's tail into the next
function assembler(file, { from, to, chunk, rate }, format) {
  const wav = wavWriter(file, rate, format);
  const done = new Map();
  let next = from;
  let carry = new Float32Array(0); // not-yet-final samples from the previous chunk's tail
  return {
    add(begin, audio, cps) {
      done.set(begin, audio);
      const frameAt = (bar) => Math.round(((bar - from) / cps) * rate);
      while (done.has(next)) {
        const audio = done.get(next);
        done.delete(next);
        const end = Math.min(next + chunk, to);
        const mixed = new Float32Array(Math.max(audio.length, carry.length));
        mixed.set(audio);
        for (let i = 0; i < carry.length; i++) mixed[i] += carry[i];
        const final = end < to ? 2 * (frameAt(end) - frameAt(next)) : mixed.length;
        wav.write(mixed.subarray(0, final));
        carry = mixed.slice(final);
        next = end;
      }
      if (next >= to) wav.close();
      return next >= to;
    },
  };
}

const opts = parseArgs(process.argv.slice(2));
const code = fs.readFileSync(opts.track, 'utf8');
const arrangement = parseArrange(code);
const totalBars = arrangement?.sections.reduce((n, s) => n + s.bars, 0);
opts.to ??= totalBars;
if (opts.to == null) {
  console.error('no arrange(...) found: pass --to <bar> to say how much to render');
  process.exit(1);
}

let close = async () => {};
try {
  fs.mkdirSync(opts.out, { recursive: true });
  const jobs = [{ name: 'mix', code, file: path.join(opts.out, 'mix.wav') }];
  if (opts.stems) {
    if (!arrangement) throw new Error('--stems needs an arrange(...) in the track');
    fs.mkdirSync(path.join(opts.out, 'stems'), { recursive: true });
    for (const stem of stemsOf(arrangement)) {
      const safe = stem.replace(/[^\w.-]+/g, '_');
      jobs.push({ name: stem, code: soloCode(code, arrangement, stem), file: path.join(opts.out, 'stems', `${safe}.wav`) });
    }
  }

  // every job split into chunks. an OfflineAudioContext renders on a single
  // thread, so the speed comes from rendering chunks on several pages at once
  const tasks = jobs.flatMap((job) => {
    // the mix stays float so overs above 0 dBFS can be measured, stems are
    // only used for spectra, and 16-bit halves their size
    job.output = assembler(job.file, opts, job.name === 'mix' ? 'float' : 'int16');
    const chunks = [];
    for (let bar = opts.from; bar < opts.to; bar += opts.chunk) chunks.push({ job, begin: bar, end: Math.min(bar + opts.chunk, opts.to) });
    return chunks;
  });
  const workers = Math.min(opts.workers ?? Math.max(1, os.availableParallelism() - 2), tasks.length);
  // repeated page errors (a missing sound fails on every note) print once
  // here, with their count at the end
  const errors = new Map();
  const browser = await openPages(workers, (type, text) => {
    const key = `[page ${type}] ${text}`;
    if (!errors.has(key)) console.error(key);
    errors.set(key, (errors.get(key) ?? 0) + 1);
  });
  const pages = browser.pages;
  close = browser.close;

  const started = Date.now();
  let cursor = 0;
  let finished = 0;
  let cps;
  await Promise.all(
    pages.map(async (page) => {
      let loaded = null;
      while (cursor < tasks.length) {
        const { job, begin, end } = tasks[cursor++];
        if (loaded !== job) {
          job.cps = cps = await load(page, job.code);
          loaded = job;
        }
        const chunkStarted = Date.now();
        const audio = await renderChunk(page, { begin, end, cps: job.cps, tail: opts.tail, rate: opts.rate });
        const complete = job.output.add(begin, audio, job.cps);
        finished++;
        if (opts.verbose) {
          console.log(`  ${job.name} bars ${begin}-${end}: ${(audio.length / 2 / opts.rate).toFixed(1)}s of audio in ${((Date.now() - chunkStarted) / 1000).toFixed(1)}s`);
        } else process.stdout.write(`\r${finished}/${tasks.length} chunks   `);
        if (complete) console.log(`\r${job.name} -> ${path.relative(process.cwd(), job.file)}`);
      }
    }),
  );

  const audioSec = ((opts.to - opts.from) / cps) * jobs.length;
  const tookSec = (Date.now() - started) / 1000;
  console.log(`${audioSec.toFixed(0)}s of audio in ${tookSec.toFixed(1)}s on ${workers} workers (${(audioSec / tookSec).toFixed(1)}x real time)`);

  const meta = {
    track: opts.track,
    cps,
    rate: opts.rate,
    from: opts.from,
    to: opts.to,
    sections: arrangement?.sections.map(({ bars, from, label, parts }) => ({ bars, from, label, parts: parts.map(normalise) })),
    stems: jobs.slice(1).map((j) => ({ name: j.name, file: path.relative(opts.out, j.file) })),
  };
  fs.writeFileSync(path.join(opts.out, 'meta.json'), JSON.stringify(meta, null, 2));
  for (const [key, count] of errors) if (count > 1) console.error(`${count}x ${key}`);
} finally {
  await close();
}
