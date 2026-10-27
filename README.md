# strudelcli

How the toolkit works, for agents changing it.

`agents-md/` is not for working on this repo: it's the agent setup for music projects that use `strudelcli`. To set one up, copy `agents-md/AGENTS.md` to the project's root and each `agents-md/<skill>/` to `.agents/skills/<skill>/` (`compose`, `master`, `review`, `dj`, `explore`), where `AGENTS.md` expects them. When a command changes, update its docs there too.

## Setup

```sh
./install.sh                     # npm install, playwright's chromium, the .venv with python/,
                                 # and a strudelcli symlink in ~/.local/bin (--bin <dir> for another)
```

Run it again after changing `package.json` or `python/pyproject.toml`: every step is idempotent.

`strudelcli dj` plays through PipeWire's `pw-cat` (`pipewire-bin` on Debian/Ubuntu), and `master`, `review` and the dj checks need `ffmpeg`.

`node_modules/` and `.venv/` live in the install and are gitignored. Nothing else is written there (`src/paths.mjs`): a track's renders and reports go to `out/<track name>/` next to the track, and the sample cache and sound registries to `~/.cache/strudelcli` (`$XDG_CACHE_HOME/strudelcli`).

## Files

```
bin/strudelcli.mjs   the dispatcher
src/commands/        one module per command, named after it
src/engine/          Strudel -> audio in headless Chromium
src/code/            reading Strudel code: arrange, music theory
src/audio/           measuring audio in JS
src/paths.mjs        where the install is and where output goes
python/              strudelcli_audio, the Python analysis: python -m strudelcli_audio <task>
examples/            tracks for checking changes
```

| file | role |
|---|---|
| `bin/strudelcli.mjs` | `strudelcli`: runs `src/commands/<command>.mjs`, rewrites `process.argv` to what the module expects and imports it, so a command behaves exactly like `node <module> args`. `strudelcli help <command>` prints the module's header comment. A new command is a module there plus an entry in `COMMANDS` |
| `src/commands/*.mjs` | the commands: each reads its own arguments and has a usage header at the top, which is its `strudelcli help` |
| `master.mjs` internals | shells out to ffmpeg (`highpass`, `acompressor`, `volume`, `alimiter`) and measures with `ebur128`. Limiting lowers loudness and gain raises peaks, so it re-measures and corrects both, up to 5 passes. Needs ffmpeg on `PATH`, no Python |
| `dj.mjs` internals | renders ahead and plays finished audio, so playback can't crackle under load and needs no VSCode. `queue` snapshots a section to `<set>/.queue/<id>/` and starts a detached `_render` (render.mjs at `nice 19`, half the cores) that writes `mix.wav` there, then `done.json`. One detached `_play` per set streams float32 to `pw-cat` (application `strudel-dj`) at normal priority, paced by the pipe's backpressure, and decides on every bar line: swap in the head when the section ends and the head is rendered, else loop the section and swap on a later 16-bar phrase; `skip` and `now` swap on a phrase too. Swaps are counted in samples. The ended section's render tail (reverb, releases) is mixed into the next one; a cut fades out over 50 ms. `dj.json` is written only by the commands (settings, queue, skip, now) and `deck.json` only by the player (t0, current section, played ids, history), both through a rename. The checks run validate and render at `nice 19` too |
| `browse.mjs` internals | renders every sample of a kind once (2 s slots, `s("<name:n ...>").clip(1)`, chunks of 24 across workers) and measures it with the FFT from `dsp.mjs`. Features are cached per strudel version in `~/.cache/strudelcli/browse-<version>.json`: delete it after changing `features()`. Similarity is the RMS of z-scores over the kind's samples |
| `find.mjs` internals | Runs every lookup the flags allow and prints the sections that matched, exact matches first. Function docs are parsed from the jsdoc in `node_modules/@strudel/*` and `superdough` (blocks without `@name` take it from the code below). Runtime names and the sound registry are read once from a page and cached in `~/.cache/strudelcli/library-<strudel version>.json` (`--refresh` rebuilds it) |
| `src/paths.mjs` | `packageRoot` is the install (node_modules, .venv). Where output goes: `outDir(track)` is `out/<track name>/` next to the track, `cacheDir` the shared cache. Use these instead of paths relative to the install |
| `src/engine/browser.mjs` | Chromium page pool (one browser context per worker), local server for the package root (so `page.html` can import from `node_modules`), sample cache, `evaluate` / `load` / `renderChunk` |
| `src/engine/page.html` | loads Strudel with the same sample maps and gm_* soundfonts as the VSCode extension (cmillsdev.strudelvs) and exposes `window.render`. The soundfont loader (`@strudel/soundfonts/fontloader.mjs`) imports from `@strudel/core` and `@strudel/webaudio`: an import map points both at the `@strudel/web` bundle, so they share its soundMap |
| `src/code/arrange.mjs` | parses `arrange(...)` (sections, labels, instruments), `normalise` for instrument names, `soloCode` to make an instrument play alone |
| `src/code/theory.mjs` | note names, registers, chord names, key detection (Krumhansl-Kessler tonic + best-fitting mode) |
| `src/audio/dsp.mjs` | FFT, third-octave bands, A-weighting, level, width and envelope measures |
| `python/strudelcli_audio/` | one module per task with a `main(argv)`, listed in `__main__.py`'s `TASKS` and imported on demand. Dependencies are in `python/pyproject.toml`, installed editable into `.venv` |
| `analyze.py` | mix analysis behind `review.mjs`: LUFS via ffmpeg's ebur128, band balance, clashes from stems |

## Rendering

`page.html` patches two browser APIs. Both are needed, and both explain bugs you might hit:

- **`OfflineAudioContext.prototype.startRendering`:** Strudel's `renderPatternAudio` creates every voice before rendering, and Chromium processes all of them on every audio block, so cost grows with the square of the length. `window.render` hands it silence, and the hook suspends the context once per bar to create only that bar's voices (`schedule`). Offline renders without a plan pass straight through: superdough renders each reverb's impulse response in its own `OfflineAudioContext`. Breaking that passthrough silently removes all reverb.
- **`WeakRef.prototype.deref`:** superdough pools filters, compressors and synth worklets as `WeakRef`s across renders. Every render has its own context, and nodes can't connect across contexts ("cannot connect to an AudioNode belonging to a different audio context"). Nodes from another context dereference as gone, so the pool builds fresh ones.

- **`BaseAudioContext.prototype.decodeAudioData`:** the soundfont loader decodes with a success callback only, so a zone that fails to decode (gm_vibraphone has an empty one) never resolves and stalls the render. The patch calls back with `null`, and that note fails with "no soundfont buffer found". `schedule` also skips any voice that takes over 20 s to load.

Long renders are split into chunks (`strudelcli render --chunk`). Each chunk renders only the notes that start inside it, plus `--tail` seconds, and the chunks are overlap-added in order. The one inaccuracy: the kick's sidechain can't duck tails that spill over from the previous chunk.

Speed: rendering is CPU bound at roughly one core per worker. Reverb convolution is the main cost.

## Checking changes

- **Smoke test:** `strudelcli validate examples/vespers.strudel.js` should be `VALID`.
- **Known failures:** `metalgrind.strudel.js` (missing sounds) and `examples/industrial.strudel.js` (mini-notation parse error) are known-invalid tracks, useful for checking that errors still get reported.
- **Ground truth for `inspect.mjs`** on `vespers`: key A phrygian, pad chords Am, F, Dm, Bb, lead phrase `A4 C5 Bb4 | A4 E5 F5 E5`.
- **Watch the page errors.** A new `[page error]` in render or validate output usually means a renderer bug, not a track bug. The two above were found that way.
