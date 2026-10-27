// render a track offline (mix + one stem per instrument) and review it
//
//   strudelcli review <track.strudel.js> [--reference some-track.wav] [render options]
//
// writes out/<track>/report.md next to the track, beside mix.wav and stems/

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { outDir, packageRoot } from '../paths.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

const [track, ...argv] = process.argv.slice(2);
if (!track || track.startsWith('--')) {
  console.error('usage: strudelcli review <track.strudel.js> [--reference some-track.wav] [render options]');
  process.exit(1);
}
const reference = [];
const render = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--reference') reference.push('--reference', path.resolve(argv[++i]));
  else render.push(argv[i]);
}

const python = path.join(packageRoot, '.venv', 'bin', 'python');
if (!fs.existsSync(python)) {
  console.error('the mix analysis needs its python environment: run ./install.sh');
  process.exit(2);
}

const out = outDir(track);

const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 2);
};
run(process.execPath, [path.join(here, 'render.mjs'), track, '--stems', '--out', out, ...render]);
run(python, ['-I', '-m', 'strudelcli_audio', 'analyze', out, ...reference]);
