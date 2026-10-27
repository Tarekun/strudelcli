// "sunday groove" - soulful deep house, 122 bpm, A minor (Am7 - Dm9 - Fmaj7 - E7)
// warm 909 drums, a rolling sidechained bass, e-piano stabs, a filtered
// pad and a simple hook.
//
// structure (1 cycle = 1 bar = 4 beats, 128 bars, ~4:11):
//   0:00  intro      16 bars  hats and percussion, then the kick
//   0:31  groove     16 bars  bass and clap lock in
//   1:03  main       32 bars  chords and the hook arrive
//   2:06  breakdown  16 bars  no kick: pad, chords, riser
//   2:36  drop       32 bars  everything
//   3:41  outro      16 bars  strip back to drums

setcps(122/60/4)


// ---------------------------------------------------------------- drums

// four-on-the-floor kick, tight and round. it sidechains orbit 2 (the bass
// and the pad), so they dip on every hit and swell back between kicks
const kick = s("bd*4").bank("RolandTR909")
  .decay(.3).sustain(0)
  .shape(.2)
  .duckorbit(2).duckattack(.15).duckdepth(.7)
  .gain(.95)

// kick that rests every 4th bar's last beat, for movement in the busy parts
const kickFill = kick.mask("<1 1 1 [1 1 1 0]>")

// clap on beats 2 and 4, with a touch of room
const clap = s("~ cp ~ cp").bank("RolandTR909")
  .room(.2).orbit(5)
  .gain(.55)

// offbeat open hat: the "tss" between the kicks that makes house bounce
const openHat = s("~ oh ~ oh ~ oh ~ oh").bank("RolandTR909")
  .decay(.2).hpf(6000)
  .gain(.35)

// closed hats on every 16th, accents sweeping through each beat
const hats = s("hh*16").bank("RolandTR909")
  .gain("[.2 .3 .5 .3]*4")
  .hpf(7000)
  .pan(sine.range(.4, .6).slow(4))

// shaker, slightly ahead of the grid with swing from the 16th pattern
const shaker = s("[~ sh]*8").bank("RolandMC303") // the 909 has no shaker
  .gain(.25).hpf(5000)

// syncopated rim + conga: the latin-ish groove layer
const perc = stack(
  s("[~ ~ ~ rim] [~ ~ rim ~] [~ ~ ~ rim] [~ rim ~ ~]")
    .bank("RolandTR909").gain(.3),
  s("~ [~ lt] ~ [~ ~ mt ~]").bank("RolandTR909")
    .gain(.3).room(.3).orbit(5)
)

// snare roll for the end of the breakdown: speeds up over 4 bars
const roll = s("sd*8").bank("RolandTR909")
  .gain(saw.range(.1, .7).slow(4))
  .hpf(400)
  .room(.3).orbit(5)

// crash on the first bar of a section
const crash = s("cr/8").bank("RolandTR909")
  .gain(.3).room(.4).orbit(5)


// ---------------------------------------------------------------- bass

// rolling off-beat bass: root notes on the 16ths between the kicks.
// follows the chord progression, one chord per bar
const bass = note("<a1 d2 f1 e1>")
  .struct("~ x x ~ ~ x x ~ ~ x x ~ ~ x ~ x")
  .s("sawtooth")
  .lpf(sine.range(250, 700).slow(8))   // slow filter movement
  .lpq(6)
  .decay(.15).sustain(.3)
  .orbit(2)                            // sidechained by the kick
  .gain(.6)

// sub: a pure sine underneath, one long note per bar, for the weight
const sub = note("<a1 d2 f1 e1>").s("sine")
  .orbit(2)
  .gain(.5)


// ---------------------------------------------------------------- harmony

// the chord progression: Am7, Dm9, Fmaj7, E7, one per bar
const chords = "<[a3,c4,e4,g4] [d3,f3,a3,c4,e4] [f3,a3,c4,e4] [e3,g#3,d4,b3]>"

// e-piano stabs in a 3-3-2 rhythm, the classic house chord pattern
const stabs = note(chords)
  .struct("x ~ ~ x ~ ~ x ~ ~ ~ x ~ ~ x ~ ~")
  .s("gm_epiano1")
  .hpf(200)
  .delay(.3).delaytime(60 / 122 * 3 / 4).delayfeedback(.35)  // dotted-8th echo
  .room(.3).roomsize(2).orbit(4)
  .gain(.55)

// the same chords as long pad notes, slowly opening and closing a filter.
// it shares the sidechained bus, so it pumps along with the bass
const pad = note(chords).s("supersaw")
  .unison(5).detune(.3).spread(.8)
  .attack(.5).release(1.5)
  .lpf(sine.range(600, 2500).slow(16))
  .hpf(250)
  .room(.5).roomsize(4).orbit(2)
  .gain(.18)

// pad swelling in from nothing over the first 8 bars of a section
const padIn = pad.lpf(sine.range(300, 2000).slow(32)).gain(.12)

// the hook: a simple pentatonic melody on a pluck, two bars long
const hook = note("<[e5 ~ g5 a5 ~ g5 e5 ~] [d5 ~ e5 g5 ~ e5 d5 c5]>")
  .s("gm_vibraphone")
  .delay(.4).delaytime(60 / 122 * 3 / 4).delayfeedback(.4)
  .room(.4).roomsize(3).orbit(3)
  .gain(.4)

// a higher, quieter echo of the hook, panned wide, for the drop
// .n(1): the default vibraphone font has no samples above C6, this one does
const hookHigh = hook.add(note(12)).pan(.8).gain(.15).n(1)

// white noise riser for the last bars of the breakdown
const riser = s("white").slow(4)
  .hpf(saw.range(500, 9000).slow(4))
  .gain(saw.range(.05, .35).slow(4))
  .room(.3).orbit(3)


// ---------------------------------------------------------------- arrangement

// 1 cycle = 1 bar = 4 beats, so [16, ...] = 16 bars
arrange(
  // ---- intro (16)
  [8, stack(hats, shaker)],
  [8, stack(hats, shaker, openHat, kick)],

  // ---- groove (16): bass and clap lock in, perc adds the swing
  [8, stack(kick, clap, openHat, hats, bass, sub)],
  [8, stack(kick, clap, openHat, hats, shaker, bass, sub, perc, padIn)],

  // ---- main (32): chords and the hook
  [8, stack(kick, clap, openHat, hats, bass, sub, stabs, crash)],
  [8, stack(kick, clap, openHat, hats, shaker, bass, sub, stabs, perc, pad)],
  [8, stack(kickFill, clap, openHat, hats, bass, sub, stabs, hook)],
  [8, stack(kickFill, clap, openHat, hats, shaker, bass, sub, stabs, perc, pad, hook)],

  // ---- breakdown (16): the kick leaves, the pad and chords carry
  [8, stack(pad, stabs, shaker)],
  [4, stack(pad, hook, openHat)],
  [4, stack(pad, hook, roll, riser)],

  // ---- drop (32): everything
  [8, stack(kick, clap, openHat, hats, shaker, bass, sub, stabs, perc, pad, hook, crash)],
  [8, stack(kickFill, clap, openHat, hats, bass, sub, stabs, pad, hook, hookHigh)],
  [8, stack(kick, clap, openHat, hats, shaker, bass, sub, stabs, perc, pad, hook, hookHigh)],
  [8, stack(kickFill, clap, openHat, hats, bass, sub, stabs, pad, hook)],

  // ---- outro (16): strip back down to the drums
  [8, stack(kick, clap, openHat, hats, bass, sub, stabs)],
  [8, stack(kick, openHat, hats, shaker)],
).postgain(.55) // the whole mix down 5 dB, balance unchanged: it peaked at +4 dBFS and clipped
