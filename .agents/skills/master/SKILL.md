---
name: master
description: Master a finished track and export a playable audio file (master.wav, optionally mp3) with loudness and true-peak targets. Use when asked to master, finalize, bounce or export a track for listening or sharing. Not for composing or fixing the mix.
---

# Master

Turns a rendered mix into a playable file at a target loudness with a true-peak ceiling.
You can't hear the result: mastering here means hitting measurable targets with a conservative chain,
then asking the user to listen.

Mastering fixes loudness and peaks. It does not fix a bad mix. If the review shows clashes, a bad band
balance or a crushed crest factor, report that and stop. Fixing it means changing the track, which is a
`compose` task and only done if the user asks.

## Steps

1. **Render with stems and review the mix.**

   ```sh
   toolkit/review.sh <track>
   ```

   Read `toolkit/out/<track>/report.md`. If it lists clipping, clashes or band-balance problems, tell the
   user and ask whether to master anyway or fix the track first. Don't fix the track on your own.

2. **Master.**

   ```sh
   node toolkit/master.mjs <track> [--lufs -11] [--ceiling -1] [--glue] [--mp3]
   ```

   It reads `toolkit/out/<track>/mix.wav` and writes `master.wav` (16-bit, 44.1 kHz, dithered) next to it.
   `mix.wav` is never modified. Add `--json` for a machine-readable report.

   The chain is fixed on purpose: highpass at 20 Hz, optional light glue compression (`--glue`, 1.5:1),
   gain to the target, then a limiter held to the true-peak ceiling. It re-measures and corrects the gain
   and limit until both targets are met. Do not add EQ, saturation or extra compression to it unless the
   user asks for a specific change. Without a reference to compare against, tonal changes are a guess.

3. **Check the output.** Read the before and after table and the warnings. Exit code 1 means a target was
   missed. The usual causes:
   - `off the target`: the mix is too peaky for the limiter to reach the loudness without heavy squashing.
     Report it. Don't lower the target without telling the user.
   - `loudness range ... heavily compressed`: the mix was already squashed, so skip `--glue`.
   - `needed +N dB of gain`: the mix is quiet. Mention it, since the user may prefer to raise levels in the track.

4. **Tell the user** where the file is, the before and after numbers, and what the chain did, in plain
   terms. Ask them to listen on the system they care about, and say what to listen for: pumping or
   dullness from the limiter, and low end that got louder than they expect.

## Targets

| use | `--lufs` | `--ceiling` |
|---|---|---|
| default (club and techno, the repo's usual) | -11 | -1 |
| streaming, more dynamics | -14 | -1 |
| mp3 export | any | -1.5 (the mp3 encoder adds inter-sample peaks) |

Never push loudness past the target to make a track "hit harder". Louder is not the goal.

## Notes

- `render.mjs` renders long tracks in chunks. The kick's sidechain can't duck tails that spill over a chunk
  boundary, so a tiny difference from the extension's playback is expected and isn't a mastering problem.
- `review.sh` thresholds are tuned for unmastered techno. For other genres, treat them as hints.
- `--reference some-track.wav` on `review.sh` compares band balance against a finished track. It is the
  only tonal evidence available to an agent, so use it when the user has a reference.
