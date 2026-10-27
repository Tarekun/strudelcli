// masters a rendered track: a gentle fixed chain (highpass, optional glue
// compression, gain to the loudness target, true-peak limiter) and writes a
// playable file next to the mix. it never touches mix.wav
//
//   strudelcli master <track.strudel.js | out/<track>> [options]
//     --lufs <n>       integrated loudness target (default -11)
//     --ceiling <n>    true-peak ceiling in dBTP (default -1)
//     --glue           add light bus compression (1.5:1, slow attack)
//     --mp3            also write master.mp3 (320 kbps)
//     --json           print a machine-readable report instead of text
//
// reads <out>/mix.wav (render it first with strudelcli render or strudelcli review), writes
// <out>/master.wav (16-bit, triangular dither) and prints before and after
//
// this fixes loudness and peaks, not a bad mix: if strudelcli review reports clashes
// or a bad band balance, fix the track instead of mastering over it

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { outDir } from '../paths.mjs';

const MAX_PASSES = 5;
const LUFS_TOLERANCE = 0.2;

function parseArgs(argv) {
  const opts = { lufs: -11, ceiling: -1, glue: false, mp3: false, json: false };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (['--glue', '--mp3', '--json'].includes(a)) opts[a.slice(2)] = true;
    else if (a === '--lufs' || a === '--ceiling') opts[a.slice(2)] = Number(argv[++i]);
    else rest.push(a);
  }
  if (rest.length !== 1 || Number.isNaN(opts.lufs) || Number.isNaN(opts.ceiling) || opts.ceiling > 0) {
    console.error('usage: strudelcli master <track.strudel.js | out/<track>> [--lufs n] [--ceiling n (<= 0)] [--glue] [--mp3] [--json]');
    process.exit(2);
  }
  const target = path.resolve(rest[0]);
  opts.out = fs.existsSync(path.join(target, 'mix.wav'))
    ? target
    : outDir(target);
  return opts;
}

function ffmpeg(args) {
  const r = spawnSync('ffmpeg', ['-nostats', '-hide_banner', '-y', ...args], { encoding: 'utf8', maxBuffer: 1 << 28 });
  if (r.status !== 0) {
    console.error(r.stderr.split('\n').slice(-12).join('\n'));
    process.exit(2);
  }
  return r.stderr;
}

// integrated loudness (LUFS), loudness range (LU) and true peak (dBTP), same meter as analyze.py
function measure(file) {
  const log = ffmpeg(['-i', file, '-filter_complex', 'ebur128=peak=true', '-f', 'null', '-']);
  const summary = log.slice(log.lastIndexOf('Summary:'));
  const get = (key) => Number(summary.match(new RegExp(`${key}:\\s+(-?[\\d.]+|-inf)`))[1]);
  return { lufs: get('I'), lra: get('LRA'), peak: get('Peak') };
}

const round = (x) => Math.round(x * 10) / 10;

const opts = parseArgs(process.argv.slice(2));
const mix = path.join(opts.out, 'mix.wav');
if (!fs.existsSync(mix)) {
  console.error(`no ${mix}: render the track first (strudelcli render <track>)`);
  process.exit(2);
}

const before = measure(mix);
if (!Number.isFinite(before.lufs)) {
  console.error('the mix is silent, nothing to master');
  process.exit(1);
}

// highpass removes inaudible rumble that would eat limiter headroom
const pre = ['highpass=f=20'];
if (opts.glue) pre.push('acompressor=threshold=-18dB:ratio=1.5:attack=30:release=250:makeup=1');

// gain and limiting interact (limiting lowers loudness), so correct the gain
// by the remaining error and the limit by any true-peak overshoot, until both sit in tolerance
const tmp = path.join(opts.out, '.master-tmp.wav');
let gain = opts.lufs - before.lufs;
let limit = opts.ceiling;
let after;
let passes = 0;
for (; passes < MAX_PASSES; passes++) {
  const chain = [...pre, `volume=${gain}dB`, `alimiter=limit=${10 ** (limit / 20)}:attack=5:release=60:level=disabled`];
  ffmpeg(['-i', mix, '-af', chain.join(','), '-c:a', 'pcm_f32le', tmp]);
  after = measure(tmp);
  const lufsError = opts.lufs - after.lufs;
  const overshoot = after.peak - opts.ceiling;
  if (Math.abs(lufsError) <= LUFS_TOLERANCE && overshoot <= 0.05) break;
  if (overshoot > 0.05) limit -= overshoot;
  if (Math.abs(lufsError) > LUFS_TOLERANCE) gain += lufsError;
}

const wav = path.join(opts.out, 'master.wav');
ffmpeg(['-i', tmp, '-af', 'aresample=osf=s16:dither_method=triangular', '-c:a', 'pcm_s16le', wav]);
if (opts.mp3) ffmpeg(['-i', wav, '-c:a', 'libmp3lame', '-b:a', '320k', path.join(opts.out, 'master.mp3')]);
fs.rmSync(tmp);

const final = measure(wav);
const limiterCut = round(opts.ceiling - limit);
const report = {
  file: wav,
  target: { lufs: opts.lufs, ceiling: opts.ceiling },
  before: { lufs: round(before.lufs), peak: round(before.peak), lra: round(before.lra) },
  after: { lufs: round(final.lufs), peak: round(final.peak), lra: round(final.lra) },
  gain: round(gain),
  glue: opts.glue,
  passes: passes + 1,
  warnings: [],
};
if (Math.abs(final.lufs - opts.lufs) > 0.5)
  report.warnings.push(`loudness ${round(final.lufs)} LUFS is off the ${opts.lufs} target: the limiter can't reach it without heavy squashing, the mix is too peaky`);
if (final.peak > opts.ceiling + 0.2) report.warnings.push(`true peak ${round(final.peak)} dBTP is above the ${opts.ceiling} ceiling`);
if (final.lra < 3) report.warnings.push(`loudness range is ${round(final.lra)} LU: heavily compressed, check the crest factor in strudelcli review`);
if (gain > 8) report.warnings.push(`needed +${round(gain)} dB of gain: the mix was quiet, consider raising levels in the track`);

if (opts.json) console.log(JSON.stringify(report, null, 2));
else {
  console.log(`mastered ${path.relative(process.cwd(), wav)}${opts.mp3 ? ' (+ master.mp3)' : ''}`);
  console.log(`            LUFS    true peak   LRA`);
  console.log(`  before  ${String(report.before.lufs).padStart(6)}   ${String(report.before.peak).padStart(6)} dBTP  ${report.before.lra} LU`);
  console.log(`  after   ${String(report.after.lufs).padStart(6)}   ${String(report.after.peak).padStart(6)} dBTP  ${report.after.lra} LU   (target ${opts.lufs} / ${opts.ceiling})`);
  console.log(`  chain: highpass 20 Hz${opts.glue ? ', glue 1.5:1' : ''}, gain ${report.gain >= 0 ? '+' : ''}${report.gain} dB, limiter${limiterCut > 0 ? ` (ceiling lowered ${limiterCut} dB to hold true peak)` : ''}, ${report.passes} pass(es)`);
  for (const w of report.warnings) console.log(`  warning: ${w}`);
}
process.exit(report.warnings.some((w) => w.includes('off the') || w.includes('above the')) ? 1 : 0);
