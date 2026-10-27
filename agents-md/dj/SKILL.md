---
name: dj
description: Run a live DJ set through the speakers (no VSCode needed), writing each 5+ minute section while the previous one plays and queueing it to swap in on the downbeat. Wakes itself up to keep the set going. Use when asked to DJ, play a live set, or keep music going. Not for composing a finished track (compose) or reviewing one (review).
---

# DJ

You run a live set: you keep **two sections queued ahead** of the one playing (5+ minutes each), and `strudelcli dj`
renders each one to audio in the background (about a minute) and swaps it in on the right bar. The music plays
through PipeWire, not VSCode. With two ahead, a late wake-up still has a whole section of slack. Being on time matters more than polish. Don't run `strudelcli validate`, `strudelcli inspect`, `strudelcli review` or the
compose or review workflows during a set: `start` and `queue` already validate and measure each section, and its output is
the only feedback you need.

## The deck

| command | does |
|---|---|
| `strudelcli dj start <set> <file>` | checks the first section and renders it; it starts playing when the render is done, usually within a minute |
| `strudelcli dj queue <set> <file>` | checks a section, adds it to the queue and renders it: each swaps in when the one before ends (not rendered by then = on a later 16-bar phrase). `--replace` empties the queue first |
| `strudelcli dj now <set> [file]` | re-renders the playing section from its edited file and swaps it in on the next phrase after that, usually within a minute |
| `strudelcli dj unqueue <set> [n]` | removes the n-th queued section (1 = next up), default the last |
| `strudelcli dj skip <set>` | cuts the current section short: the next queued one swaps in on the next 16-bar phrase |
| `strudelcli dj status <set> --json` | what plays, the queue with start times and render progress, `ahead` (sections queued), and `wakeIn`: 0 = write now, otherwise seconds to sleep |
| `strudelcli dj wait <set>` | blocks until the next queued section swaps in (exit 3 = run it again) |
| `strudelcli dj stop <set>` | stops playback and empties the queue |

`<set>` is `live/<name>/`. Don't edit its `dj.json` or `deck.json`.

## 1. Ask, then plan

Before anything plays, ask the user in one message for whatever they haven't specified:

- the style or genre, and any reference (an artist, or a track in this repo)
- the tempo
- the mood and the shape of the set: slow build, peak early, deep and hypnotic, ...
- the length, or "until I say stop"
- sounds or instruments to use or avoid (instruments from repo tracks can be reused)

Suggest a default for each, so "go" is a valid answer. Then write `live/<name>/plan.md`: one tempo for the whole
set, a key, sections of **at least 5 minutes** (bars = bpm × 5 / 4, rounded *up* to a multiple of 16: 176 bars at 140 bpm,
160 at 124 bpm), and one line per section with
its energy (1-5) and what it brings.

## 2. Write a section

`live/<name>/NN-<label>.strudel.js`, standalone: the same `setcps(...)`, every `const` it uses, one `arrange(...)`
of the planned length.

- Copy instruments that continue verbatim from the previous section. The swap is a hard cut, so bar 0 should sound like a continuation.
- Check new sounds and functions with `strudelcli find <name>`. Don't guess names.
- Keep new instruments' gain near what similar instruments in the set use.

## 3. Improve it, then queue

Local models tend to write one basic loop repeated for the whole section. Before queueing, reread the file once and fix
the weakest points:

- **Arrange:** something should enter, leave or change every 16-32 bars. One `stack` for 176 bars is a loop, not a section.
- **Inside the instruments:** add variation across bars, such as `"<...>"` alternation, `.every(4, ...)`, `.sometimes(...)`, `.mask(...)`, or a slow filter sweep with `sine.slow(16).range(...)`. A one-bar riff repeated unchanged doesn't count as a phrase.
- **The ending:** the last 8-16 bars should set up the next section: thin out, add a fill, or a riser.

Make one pass, then `queue`. Don't run `strudelcli validate` first: `queue` runs it, and its report is your feedback. Fix
every error it reports, then queue again. Fix a warning (clipping, level jump) only if it takes a
single gain change. If you're stuck with under a minute left, queue a copy of the current section with one change.

## 4. Loop: fill the queue, then sleep

**Never sleep with fewer than two sections queued.** Queueing one and sleeping is how sets run dry: the model
wakes up late, nothing is left, and the current section loops.

On every wake-up:

1. Run `status --json`.
2. **While `wakeIn` is 0** (`ahead` below 2): write, improve and queue the next section from the plan, then run `status` again. Repeat until `wakeIn` is above 0.
3. Tell the user in one line what's playing and what's queued.
4. Sleep `wakeIn` seconds. That's just after the next swap, when the queue is one short again.

At the start, that means: `start` section 1, then write and queue sections 2 and 3 while it renders, before the first sleep.
Two ahead is the limit, though: more than that and the plan can't react to the user anymore.

How to sleep:

- **Claude Code:** in `/loop`, use `ScheduleWakeup` with `delaySeconds` set to `wakeIn` (at least 60).
- **Other agents:** use your scheduler. With none, run `strudelcli dj wait <set>`.
- Never sleep longer than `wakeIn`, even when the plan says the next section is "easy".

**Ending:** once the outro is queued, stop topping up the queue and ignore `wakeIn` 0: sleep until the outro has
played (its `in` from `queue` plus its length), then run `stop` and end the loop. If the user says stop now, run `stop` right away.

**User requests mid-set:** fold "more X" into the next section you write and `plan.md`. If a queued section no longer
fits, `unqueue` it and write a new one. For "next!" or "this is dragging", run `skip`. It needs something queued. For "do X now", edit the playing
section's own file (same length), run `now`, and tell the user it lands on the next phrase after its render, usually within a minute. It lasts
until that section ends, so make the same change in the queued sections that should keep it. If the music dies, check the end of
`dj.log`, and `start` again with the current section.
