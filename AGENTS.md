# AGENTS.md

This project is a music track creation tool built on top of strudel — a framework for generating musical patterns.

## Validation

Use the toolkit to validate tracks before and after editing:

```sh
node toolkit/validate.mjs <track.strudel.js>
```

This checks that the track parses correctly, produces events, references existing sounds, and renders to audio

## Toolkit Tools

- `arrange.mjs` — Parses and arranges a track
- `evaluate` / `renderChunk` — Evaluate events and render audio
- `review.sh` — Review script for tracks
- `analyze.py` — Analysis tool
- `page.html` / `render.mjs` — Browser-based rendering

## Workflow

1. Make edits to a `.strudel.js` track
2. Run validation with `node toolkit/validate.mjs <track>`
3. Use the toolkit tools to test and render the result
4. Ensure all referenced sounds exist in the project

## Example

```sh
# Validate a track
node toolkit/validate.mjs metalgrind.strudel.js

# Render to audio
node toolkit/render.mjs metalgrind.strudel.js --full
```
