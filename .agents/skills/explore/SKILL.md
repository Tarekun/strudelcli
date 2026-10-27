---
name: explore
description: Find sounds and ideas for a track and make them quick to hear, since Strudel has no sound browser. Use when the user wants an alternative to a sound ("a different kick", "a darker clap", "something like this hat but longer"), wants to try an effect or variation, or asks what they could add to a track. Offers numbered options in an audition reel; the user picks by ear. Not for composing a whole instrument from scratch (compose) or judging a finished track (review).
---

# Explore

Strudel has hundreds of samples (420+ kicks alone) and no way to browse them by how they sound.
This skill does the searching, and turns the results into something the user can hear in one go: a
numbered **audition reel**. You can't hear, so you narrow the options down with measurements and the user
picks by ear.

While exploring, **don't edit the track**. Offer options, let the user pick, then make the change.

## Tools

| command | what it answers |
|---|---|
| `strudelcli browse list <kind> [--sort <feature>] [--top n]` | every sample of a kind (`bd`, `sd`, `cp`, `hh`, `oh`, `cr`, `rd`, `lt`, `perc`, ...), measured. `--sort long` for most first, `--sort -long` for least first |
| `strudelcli browse like <sound> [--more f] [--less f]` | the samples closest to a sound, optionally steered: `--more long --less bright` |
| `strudelcli browse audition <candidate ...> [--over <track> --section <s> --replace <instr>] [--play]` | writes `toolkit/out/audition/<name>.strudel.js`, which plays the candidates one after another, numbered in order, then loops |
| `strudelcli find <query>` | names: synths, sample sets, banks, effects and their params. An exact name (`lpf`, `RolandTR909`) gives its docs or sounds, a drum abbreviation (`cb`) the banks that have it |
| `strudelcli structure <track>`, `strudelcli inspect <track> --no-audio` | what the track has, instantly: sections, instruments, rhythm grids, key, notes |

Sounds are written `sound:variant/bank`: `bd:1/RolandTR909` is `s("bd:1").bank("RolandTR909")`, and `bd:3` is the
plain `bd` sample set. The first `list`/`like` of a kind measures all its samples, which takes about 15 s; after that the results are cached.

**Features** come from rendering each sample once: `bright` (spectral centroid), `sub` (energy under 120 Hz),
`pitch` (strongest frequency between 30 and 300 Hz), `click` (share of the first 20 ms above 2 kHz), `long`
(decay to -30 dB), `attack` (time to peak) and `noisy` (spectral flatness). Translate the user's words into them:

| the user says | steer |
|---|---|
| deeper, lower | `--less pitch` (and often `--more sub`) |
| boomy, longer, more tail | `--more long` |
| tight, short, dry | `--less long` |
| punchy, clicky, cuts through | `--more click` |
| soft, round | `--less click`, `--more attack` |
| dark, warm | `--less bright` |
| bright, crisp | `--more bright` |
| dirty, gritty, trashy | `--more noisy` |

## Find a sound

1. **Work out the kind and the current sound.** Read the instrument's definition: `s("bd:1").bank("RolandTR909")` gives kind `bd` and sound `bd:1/RolandTR909`. With no variant, it's `:0`. For words, use the drum abbreviations (kick `bd`, snare `sd`, clap `cp`, closed or open hat `hh`/`oh`, crash `cr`, ride `rd`, toms `lt`/`mt`/`ht`, rimshot `rim`, shaker `sh`, cowbell `cb`), or `strudelcli find <word>` for anything else.
2. **Search.** Use `like <current> --more ... --less ...` for "like mine but ...". Use `list <kind> --sort <feature>` for "the punchiest claps". With no direction at all ("just something different"), use `like` without steering and take candidates from the middle of the list, not the top: the closest ones sound nearly the same.
3. **Pick 4 to 6 candidates.** Make them different from each other: spread them across banks, and across the feature you're steering. Put the current sound first, so the user can compare against it.
4. **Audition them in context**, over the section where the sound plays, with the instrument replaced. Write the candidates as the user's own instrument with only the sample swapped, so its processing (speed, filters, gain, sidechain) stays the same:

   ```sh
   strudelcli browse audition 'kick' 'kick.bank("MPC1000").n(4)' 'kick.bank("YamahaRM50").n(78)' \
     --over techno/vespers.strudel.js --section groove --replace kickFill
   ```

   `--replace` takes the name as the section stacks it (`strudelcli structure` lists those). For a bank-less sample set, write the expression in full and copy the processing over. Without `--over`, `--pattern 's("$*4")'` sets the pattern a sound plays (`$` stands for the sound).
5. **Let the user listen.**
   - With `--play`, the reel plays in VSCode, on top of a DJ set if one is playing, so don't use it during one.
   - Without it, tell them to open the reel and press Ctrl+Enter.
   - Give them a numbered list with one phrase per candidate, taken from the numbers: "2: lower and boomier, less click", "3: much longer tail, 808-like".
   - The `peak` column in `list` shows how hot each sample is. Mention candidates that are much louder or quieter, since the louder one usually sounds better at first.
6. **Apply the pick** with the smallest edit (`.bank(...)` and the variant), under the editing rules in `AGENTS.md`, then run validate. Only change its gain if the user asks, or if the new sample is clearly off in level, and then ask first.

## Try an effect or a variation

Candidates can be any expression, so the same reel compares settings, not only sounds:

```sh
strudelcli browse audition 'lead' 'lead.lpf(1200)' 'lead.lpf(1200).room(.6)' 'lead.delay(.5).delaytime(3/16)' \
  --over <track> --section drop --replace lead
```

Look up what a function does and its range with `strudelcli find <name>` before using it. Pick 3 to 5 values
that sound clearly different from each other, not small steps.

## Ideas for a track

1. **Get the context, quickly.** Read the code, then run `strudelcli structure` and `strudelcli inspect --no-audio`. Don't render or run `strudelcli review`: you need what's there, not a mix report.
2. **Look for openings:**
   - **A missing role:** no percussion between kick and hats, nothing answering the lead, no low pad under a breakdown.
   - **Unused space:** a register nobody plays in, empty 16th steps in the rhythm grids, a frequency range only one instrument covers.
   - **Static stretches:** `strudelcli structure` flags 64+ bars without change. Look for sections that only add and never take away.
   - **Genre moves** that would fit. Techno: rumble, ride, a percussion loop, an acid line, a chord stab, a noise riser. House: offbeat open hats, a shaker, chord stabs, a piano or organ riff, a filtered loop.
3. **Propose 3 to 5 ideas**, mixing safe and bold. For each: what it is, its role, which sections, why (the opening it fills), and a one-line sketch. Check every sound and function name with `strudelcli find`.
4. **Make them hearable.** Write each idea as an expression and audition them all over the section where they'd go, without `--replace`, so each one plays on top of what's there. Keep their gain modest, near similar parts of the track.

   ```sh
   strudelcli browse audition 's("[~ rd]*4").bank("RolandTR909").gain(.15)' \
     'note("<a2 c3 g2 f2>").s("sawtooth").lpf(600).gain(.25)' --over <track> --section body
   ```

5. **The user picks**, then add the idea as a small edit: a `const` and its place in the arrange. If it needs real design work, such as a melody or a full new part, move on to the `compose` skill.

## Notes

- Reels in `toolkit/out/audition/` are scratch files: they're overwritten each time and gitignored. One reel per track or kind: if you're comparing two reels, rename the first.
- The measurements describe the raw sample, so a `speed`, `lpf` or `shape` in the track changes how it really sounds. That's one more reason to audition in context.
- Don't keep re-searching: two rounds of reels is usually enough. If nothing fits, ask the user which candidate came closest, and search around that one.
