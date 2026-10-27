// where the cli writes: a track's renders and reports go to out/<track name>/
// next to the track, and caches shared by every track go to the user's cache
// directory, so nothing is written into the install

import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// the install: node_modules, .venv and the code
export const packageRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// samples, sample maps and the sound and feature registries
export const cacheDir = path.join(process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache'), 'strudelcli');

// track.strudel.js and song.wav -> track, song
export const trackName = (track) => path.basename(track).replace(/\.strudel\.js$|\.[^.]+$/, '');

// out/<track name>/ next to the track, or out/<kind>/<track name>/ for a tool's scratch renders
export const outDir = (track, kind) => path.join(path.dirname(path.resolve(track)), 'out', ...(kind ? [kind] : []), trackName(track));
