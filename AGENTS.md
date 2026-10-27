# AGENTS.md

Tracks in this repo are [Strudel](https://strudel.cc) code: `*.strudel.js` files, grouped by genre
(`techno/`, `house/`, `sets/`, ...). Most define their instruments as `const`s and lay them out in an
`arrange([bars, stack(...)], ...)` at the bottom. The toolkit's instrument and section names come from that arrange.

The toolkit is the `strudelcli` command. `strudelcli help` lists its commands, and `strudelcli help <command>` shows
a command's options.

You can't hear the music. Whether something *sounds* right is the user's call: when a change is about taste,
say what you changed and ask them to listen.

## Editing a track

Do what was asked and nothing more. A one-line request (add a hi-hat, change a note, mute a section) is a
small diff.

- Don't touch the gain, filters or effects of existing instruments, and don't rebalance the mix, unless asked.
  Levels are the user's call.
- Don't render, analyze loudness or run `strudelcli review` unless asked. Those results lead to extra code the user
  didn't request.
- Don't refactor or tidy code you weren't asked to change.
- After editing, run `strudelcli validate <track>`. It must exit 0 (1 = errors, 2 = couldn't run). Fix
  errors, and read the warnings (clipping, silent sections).
- Check that functions and sounds exist with `strudelcli find <name or words>`
  instead of guessing names.

For designing a new instrument or track, or a mix pass, use the `compose` skill (`.agents/skills/compose`).
For mastering or exporting a playable file, use the `master` skill (`.agents/skills/master`).
For feedback on a track (code, mix, composition), use the `review` skill (`.agents/skills/review`).
For a live DJ set, use the `dj` skill (`.agents/skills/dj`).
For looking for a sound or ideas ("a different kick", "what could I add"), use the `explore` skill (`.agents/skills/explore`).

### Instruments copied from other tracks

When a track reuses an instrument from another track in this repo, copy its definition verbatim and
leave it as it is. Never rewrite it, re-tune it or "improve" it: the user picked it because they like it as it is.
If it really has to change to fit, don't edit the copy. Ask the user, or derive a variant from it under a new name
(`const leadDark = lead.lpf(1200)`) and leave the copied definition untouched.

## Things that trip tracks up

- **`.bank("X")` prefixes the sound name.** `s("sh").bank("RolandTR909")` looks for `RolandTR909_sh`. A bank only has its own sounds; validate reports missing ones with line numbers.
- **Synths can't take a bank.** `s("white")`, `s("sawtooth")`, `s("supersaw")` and the like must not get `.bank(...)`.
- **`slider()` silently breaks** evaluation in the user's VSCode Strudel extension. Use constants.
- **`gm_*` soundfonts** take notes (`note("c3 e3").s("gm_epiano1")`) and `.n(i)` picks one of the instrument's fonts. Some fonts don't cover every note: validate reports "no soundfont buffer found" for notes that stay silent.
- **`distort` and `shape` add a lot of level.** If you add one to an instrument you're writing, lower that instrument's `gain` to match.
- **Sidechain:** an instrument on the orbit named in the kick's `duckorbit(n)` gets ducked by the kick. Solo measurements in `strudelcli inspect` don't include that ducking.
