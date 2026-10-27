---
name: compose
description: Design and write new instruments or whole tracks in this repo, and review or mix them with the toolkit (inspect, render, loudness and clash analysis). Use when asked to compose, produce or arrange a track, build a new instrument from scratch, or analyze/review/mix a track. Not for small edits like adding one line or changing a note.
---

# Compose

The toolkit renders tracks offline in headless Chromium and measures them, which gives you the facts.
Whether something *sounds* right is still the user's call.

Everything here is for real composing work. Don't run this loop for small edits: the base rules in
`AGENTS.md` apply (small diff, validate, stop).

## Toolkit

All tools run from the repo root and take a track path. Each prints text, or JSON with `--json`.

| tool | what it answers | speed |
|---|---|---|
| `strudelcli validate <track>` | Does it parse, evaluate, produce events, find every sound, and render to audio? Exit 0 = valid, 1 = errors, 2 = couldn't run. | seconds |
| `strudelcli find <query>` | What Strudel has: functions by name or description, and synths, drum machine banks, soundfonts and samples by name, with their variants. An exact function name gives params, synonyms and examples (and flags superdirt-only functions that do nothing in the browser), an exact bank name its sounds, and a drum abbreviation (`cb`) the banks that have it. `--functions`, `--sounds` or `--banks` narrow it, and alone list everything of that kind. Exits 1 when nothing matches. | instant |
| `strudelcli structure <track>` | What plays when: section timeline (+added -removed), section × instrument map, which consts feed which instruments, dead definitions. Reads the code only. | instant |
| `strudelcli inspect <track> [instrument ...]` | Per instrument: sections, rhythm grid, notes and key fit, chords, opening phrase, level and share of what's heard, frequency range, width, envelope, overlaps with other instruments. `--no-audio` for the pattern part only. | ~10 s per instrument |
| `strudelcli review <track> [--reference song.wav]` | Full mix review: loudness (LUFS), true peak, clipping, band balance per section, clashes. Writes `out/<track>/report.md` next to the track. | minutes |
| `strudelcli render <track> [--from bar] [--to bar] [--stems]` | Renders a wav of the mix (and one per instrument) to `out/<track>/` next to the track, e.g. for the user to listen to. | ~5x real time |

Instrument names are the expressions stacked in the arrange, exactly as `strudelcli structure` lists them
(`lead`, `kickFill`, `kick.mask("<1!3 [1 1 1 0]>")`).

## Workflow

Work one instrument at a time: design it, write it, review it, and only then move on to the next.
Never write several instruments in one go and review them together afterwards.

1. **Get the context.** Before editing an existing track, run `strudelcli structure` to see the arrangement, and `strudelcli inspect` on the instruments already there. Note which frequency ranges, registers and rhythm steps are taken.
2. **For each instrument:**
   1. **Design.** Before writing code, state its role:
      - what it does in the track (pulse, bass, harmony, lead, texture, fill)
      - the sections it plays in
      - its rhythm (which 16th steps)
      - its notes and register, in the track's key
      - the frequency range it should own, chosen to avoid what's already taken.

      Check the functions and sounds you plan to use with `strudelcli find`: `find <function>` for what a setting does and its range, `find <bank>` or `find <sound>` for which drum machines have the sound you want. Don't guess names.
   2. **Write.** Add the definition, and place it in the arrange. The toolkit only sees instruments that are in the arrange, so use a temporary section if it doesn't belong anywhere yet.
   3. **Validate.** `strudelcli validate` must exit 0. Fix every error, and read the warnings (clipping, silent sections).
   4. **Review.** Reread the definition you just wrote, line by line, and question every value. Running the toolkit is not the review: it only gives you evidence for it. For each setting, ask:
      - **Why this value?** Can you say what it does to the sound and why the instrument needs it? A value you can't justify is a guess: rethink it or remove the setting.
      - **What would a different value do?** Would more or less serve the design better? For example: is `lpf(2500)` dark enough to stay behind the lead, or should it be `1800`? Is `decay(.2)` short enough to leave room for the kick?
      - **Does it fit with the rest of the definition?** For example: is `gain` still right after `distort` was raised? Does the `room` size match the space the other instruments sit in?
      - **Is anything missing or redundant?** A setting the design calls for that isn't there, or two settings fighting each other (a highpass cutting what the drive is meant to thicken).

      Then run `strudelcli inspect <track> <instrument>` and check the evidence against your answers and the design: rhythm grid, notes in key, register, share of what's heard, frequency range, overlaps with the other instruments. Where the numbers disagree with what you intended, change the values and review again. Don't start the next instrument until you'd defend every value in this one.
3. **Review the whole track.** Run `strudelcli structure` for the arrangement, `strudelcli validate`, and `strudelcli review` for the mix (loudness, clipping, band balance, clashes).
4. **Tell the user** what you made or changed in musical terms, and what to listen for.

## Scope

- Copied instruments stay verbatim (see `AGENTS.md`). Review them in their new track, since the same instrument can clash with different neighbours, but report problems instead of editing them.
- A mix pass (levels, EQ, clashes) is only done when the user asks for it. When it is asked for, change only what the report points at, and say what you changed.
