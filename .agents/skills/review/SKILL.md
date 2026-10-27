---
name: review
description: Review a track and give feedback on how to improve it, covering the code, the sound and mix (through the toolkit's evaluation pipeline) and the composition (arrangement, rhythm, harmony, energy). Use when asked to review, critique, give feedback on or suggest improvements for a track. Produces feedback only and does not edit the track.
---

# Review

Reads a track's code, runs the evaluation pipeline and reviews the composition, then gives the user
feedback on how to improve each of the three. **Don't edit the track.** The user decides what to change.
At the end, offer to apply the items they pick.

You can't hear the music. The toolkit gives you facts (levels, clipping, notes, rhythm grids, which
instruments play when). Taste calls are suggestions to try and listen to, not fixes. Say which is which.

If the user names an aspect ("just the mix"), a section or an instrument, review only that, and skip the
tools you don't need for it.

## 1. Gather the evidence

Run these from the repo root, in this order. They take a few minutes in total.

```sh
strudelcli validate <track>           # does it work at all
strudelcli structure <track>          # timeline, section × instrument map, dead definitions
strudelcli inspect <track>            # every instrument: rhythm, notes, key, level, range, overlaps (~10 s each)
strudelcli review <track> [--reference x.wav]   # mix: LUFS, true peak, clipping, band balance, clashes
```

- If `strudelcli validate` exits 1, the errors are the review. Report them with line numbers and stop, unless the
  user wants the rest anyway.
- Use `--reference` whenever the user has a track they want this one to sound like. Without one, band
  balance is only compared against the track's own spectral slope, which is weak evidence.
- `strudelcli review` writes `toolkit/out/<track>/report.md`. Read it fully.
- The thresholds in `strudelcli review` are tuned for unmastered techno. For other genres, treat them as hints.

Then read the track source in full. The tools tell you what the code does. Only reading it tells you how
well it is written.

## 2. Review each aspect

### Code

How easy the track is to read, change and keep working.

- **Errors and risks:** validate errors and warnings, `slider()` (breaks the VSCode extension), `.bank()` on
  synths, and superdirt-only functions that do nothing in the browser (`strudelcli find <name>` flags them).
- **Dead code:** definitions `strudelcli structure` lists as never reaching the arrange, and commented-out blocks.
- **Duplication:** the same pattern or effect chain written several times, where a shared `const` or a
  derived variant (`const kickFill = kick.mask(...)`) would do.
- **Naming:** whether `const` names say what the instrument is (`bassStab`, not `b2`), and whether the
  arrange reads as the song's structure.
- **Unexplained values:** settings that cancel each other (a `hpf` cutting what `distort` thickens), or
  values that make no audible difference.
- **Copied instruments:** if a definition is identical to one in another track (`grep` the repo), don't
  suggest rewriting it (see `AGENTS.md`). Point out clashes with its new neighbours instead.

### Sound and mix

How it sounds as a whole. The evidence is `report.md` plus inspect's level, range and overlap figures.

- **Must fix:** clipping, true peak above the ceiling, stereo bass on mono club systems.
- **Balance:** band bumps and holes per section, an instrument whose share of what's heard is far from its
  role (a texture at 30% of a section, a lead at 5%), quiet sections where the drop should land.
- **Clashes:** two instruments prominent in the same band. Say which one should move, and how
  (`lpf`, `hpf`, register, rhythm steps, or the sidechain via `duckorbit`).
- **Dynamics:** crest factor per section (punch), loudness range, and whether the energy rises and falls
  with the arrangement.
- **Space:** reverb and delay that smear the low end, and instruments sitting in rooms of very different sizes.

Measure levels against the mix (`report.md`) as well as solo (`strudelcli inspect`). Solo levels ignore the
kick's sidechain ducking.

### Composition

How the music is built. The evidence is `strudelcli structure` and inspect's pattern analysis. Judge it against
the genre, which you can tell from the folder (`techno/`, `house/`).

- **Arrangement:** section lengths in 8 or 16 bar phrases, intro and outro long enough to mix in and out
  for club genres, stretches `strudelcli structure` flags as static (no change for 64+ bars) or abrupt
  (many instruments in or out at once).
- **Energy curve:** per-section LUFS and instrument count against the intended shape. Does the breakdown
  build into the drop (riser, roll, filter sweep), and is the drop clearly the peak?
- **Rhythm:** the 16th-step grids. Kick and bass interlocking or fighting, too many instruments on the same
  steps, and missing groove (swing, ghost notes, offbeat movement where the genre expects it).
- **Harmony and melody:** key fit, chord movement, register spacing between bass, pad and lead, and
  whether the lead's opening phrase develops or just repeats unchanged.
- **Roles:** two instruments doing the same job, or a role the genre expects that nothing fills.
- **Variation:** loops that never change over long stretches. Suggest `mask`, `every`, `sometimesBy`,
  filter automation or fills before suggesting new instruments.

## 3. Write the feedback

Write it to `toolkit/out/<track>/feedback.md` and give the user a short summary in chat: the verdict in a
line or two, then the top three to five items.

Structure:

```markdown
# Feedback: <track>

<two or three sentences: what works, and what would improve it most>

## Code
## Sound and mix
## Composition

## Next steps
<the 3–5 changes worth doing first, in order>
```

Each finding gets:

- **Priority:** `must fix` (broken, clipping, invalid), `should` (clear improvement backed by the numbers)
  or `try` (a taste call, to listen to).
- **Where:** line number, section and bars, or instrument name.
- **Evidence:** the number or tool output behind it (`drop: 458 clipped samples`,
  `bass and pad both prominent at 125–250 Hz in body`). A `try` can rest on a musical argument instead,
  but say so.
- **Suggestion:** a concrete change, with the code when it's short (`.lpf(1800)` on `pad`, or move `clap`
  to steps 5 and 13). Keep each suggestion as small as possible.

Also say what works and should stay. Not every finding is a problem.

Don't pad the feedback. A clean track gets a short review. Leave out generic advice the evidence doesn't
support, like "add more variation" when `strudelcli structure` shows changes every 16 bars.

## 4. Offer to apply

Ask which items to apply. When the user picks some, small changes follow the editing rules in `AGENTS.md`.
New instruments or reworked sections follow the `compose` skill, and loudness for export follows the
`master` skill.
