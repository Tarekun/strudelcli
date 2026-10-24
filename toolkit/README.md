# toolkit

How the toolkit works, for agents changing it. To use it on tracks, see `AGENTS.md` at the repo root and the skills in `.agents/skills/` (`compose`, `master`, `review`, `dj`, `explore`).

## Setup

```sh
cd toolkit
npm install                      # @strudel/web, playwright
npx playwright install chromium
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt   # only for analyze.py / review.sh
```

`node_modules/`, `.venv/`, `.sample-cache/` and `out/` are gitignored.

## Files

| file | role |
|---|---|
| `validate.mjs`, `structure.mjs`, `inspect.mjs`, `library.mjs`, `render.mjs`, `review.sh`, `master.mjs`, `dj.mjs`, `browse.mjs` | the tools: each has a usage header at the top |
| `master.mjs` internals | shells out to ffmpeg (`highpass`, `acompressor`, `volume`, `alimiter`) and measures with `ebur128`. Limiting lowers loudness and gain raises peaks, so it re-measures and corrects both, up to 5 passes. Needs ffmpeg on `PATH`, no Python |
| `dj.mjs` internals | drives VSCode through `../.strudel-remote` and reads `../.strudel-remote.log` for timestamps: the set's bar 0 is the logged `strudel.play`. Each section's arrange gets `.late(<start bar>)` in `live.strudel.js`. `queue` snapshots the section to `<set>/.queue/` and starts a detached `_deck` process (one per set, while anything is queued) that swaps the queue in order, `lead` seconds before each start bar. It naps 1 s at a time, so `skip` and `unqueue` take effect; `lead` is re-measured from the log after every swap. The head of the queue gets a fixed `start` bar once the deck picks it up, the rest follow on. State in `<set>/dj.json` |
| `browse.mjs` internals | renders every sample of a kind once (2 s slots, `s("<name:n ...>").clip(1)`, chunks of 24 across workers) and measures it with the FFT from `dsp.mjs`. Features are cached per strudel version in `.sample-cache/browse-<version>.json`: delete it after changing `features()`. Similarity is the RMS of z-scores over the kind's samples |
| `library.mjs` internals | function docs are parsed from the jsdoc in `node_modules/@strudel/*` and `superdough` (blocks without `@name` take it from the code below). Runtime names and the sound registry are read once from a page and cached in `.sample-cache/library-<strudel version>.json` (`--refresh` rebuilds it) |
| `browser.mjs` | Chromium page pool (one browser context per worker), local server for `page.html`, sample cache, `evaluate` / `load` / `renderChunk` |
| `page.html` | loads Strudel with the same sample maps as the VSCode extension (cmillsdev.strudelvs) and exposes `window.render` |
| `arrange.mjs` | parses `arrange(...)` (sections, labels, instruments), `normalise` for instrument names, `soloCode` to make an instrument play alone |
| `theory.mjs` | note names, registers, chord names, key detection (Krumhansl-Kessler tonic + best-fitting mode) |
| `dsp.mjs` | FFT, third-octave bands, A-weighting, level, width and envelope measures |
| `analyze.py` | mix analysis behind `review.sh`: LUFS via ffmpeg's ebur128, band balance, clashes from stems |

## Rendering

`page.html` patches two browser APIs. Both are needed, and both explain bugs you might hit:

- **`OfflineAudioContext.prototype.startRendering`:** Strudel's `renderPatternAudio` creates every voice before rendering, and Chromium processes all of them on every audio block, so cost grows with the square of the length. `window.render` hands it silence, and the hook suspends the context once per bar to create only that bar's voices (`schedule`). Offline renders without a plan pass straight through: superdough renders each reverb's impulse response in its own `OfflineAudioContext`. Breaking that passthrough silently removes all reverb.
- **`WeakRef.prototype.deref`:** superdough pools filters, compressors and synth worklets as `WeakRef`s across renders. Every render has its own context, and nodes can't connect across contexts ("cannot connect to an AudioNode belonging to a different audio context"). Nodes from another context dereference as gone, so the pool builds fresh ones.

Long renders are split into chunks (`render.mjs --chunk`). Each chunk renders only the notes that start inside it, plus `--tail` seconds, and the chunks are overlap-added in order. The one inaccuracy: the kick's sidechain can't duck tails that spill over from the previous chunk.

Speed: rendering is CPU bound at roughly one core per worker. Reverb convolution is the main cost.

## Checking changes

- **Smoke test:** `node toolkit/validate.mjs techno/vespers.strudel.js` should be `VALID`.
- **Known failures:** `metalgrind.strudel.js` (missing sounds) and `techno/industrial.strudel.js` (mini-notation parse error) are known-invalid tracks, useful for checking that errors still get reported.
- **Ground truth for `inspect.mjs`** on `vespers`: key A phrygian, pad chords Am, F, Dm, Bb, lead phrase `A4 C5 Bb4 | A4 E5 F5 E5`.
- **Watch the page errors.** A new `[page error]` in render or validate output usually means a renderer bug, not a track bug. The two above were found that way.
