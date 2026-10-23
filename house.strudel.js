// 124/60 -> beats per second
// (124/60) / 4 -> bars per second
setcps(124/60/4)


// punchy kick: short and tight instead of boomy. decay/sustain(0) cuts the
// tail so each hit is a short thump, shape adds a little saturation for punch
const kick = s("bd*4").bank("RolandTR909")
  .decay(.25).sustain(0)
  .shape(.25).gain(.9)

// clap on beats 2 and 4 (~ = rest), the classic house backbeat
const clap = s("~ cp ~ cp").bank("RolandTR909").gain(.6)

// closed hats on every 16th, accented on the offbeat so they groove
const hats = s("hh*16").bank("RolandTR909")
  .gain("[.25 .35 .6 .35]*4")
// closed hihat on the offbeats (between kicks)
const offHats = s("[~ hh]*4").bank("RolandTR909")

// open hat on the offbeats (between kicks)
const openHats = s("[~ oh]*4").bank("RolandTR909").gain(.4)
// rimshot: syncopated percussion, one [ ] group per beat
const rim = s("[~ ~ ~ rim] [~ ~ rim ~] [~ ~ ~ rim] [~ rim ~ ~]")
  .bank("RolandTR909").gain(.35)

// the full percussion loop, for sections that want everything
const perc = stack(clap, hats, openHats, rim)


// house piano: two chords (Am7, Fmaj7), one per bar, played as short stabs
// in a syncopated 3-3-2 style rhythm. struct gives the rhythm, x = hit
const piano = note("<[a3,c4,e4,g4] [f3,a3,c4,e4]>")
  .struct("x ~ ~ x ~ ~ x ~ ~ ~ x ~ ~ x ~ ~")
  // .s("gm_piano")
  // .s("gm_bright_acoustic_piano")
  .s("gm_epiano1")
  .hpf(200)                        // thin out the lows, leave them to the kick
  .room(.3).roomsize(2).orbit(4)
  .gain(.6)

// house string: one high note held for 4 bars. e is in both chords, so it
// sits over the whole progression. supersaw = stack of detuned saws for the
// lush "string machine" width. orbit(3) keeps its reverb separate
const houseString = note("e6").slow(4)
  .s("supersaw").unison(7).detune(.4).spread(.8)
  .attack(.8).sustain(1).release(2)
  .lpf(4000)
  .room(.6).roomsize(4).orbit(3)
  .gain(.2)
// fade-in version: attack stretched to the full 4-bar note, so it swells
// from silence to full volume. attack is in seconds: cycles / cps
const houseStringFadeIn = houseString.attack(4 / (124/60/4))
// sampled alternative: actual string ensemble instead of a synth
// const houseString = note("e5").slow(4).s("gm_string_ensemble_1")
//   .attack(.8).release(2).room(.6).roomsize(4).orbit(3).gain(.5)

// 1 cycle = 1 bar = 4 beats, so [4, ...] = 16 beats

arrange(
  // intro
  [4, stack(offHats)],
  [4, stack(offHats, clap)],
  [4, stack(kick, clap, offHats)],
  [4, stack(kick, clap, offHats, rim, houseStringFadeIn)],

  // chorus
  [8, stack(kick, perc, piano, houseString)],
  [4, stack(perc, piano, houseString)],      // breakdown: drop the kick
  [8, stack(kick, perc, piano, houseString)],

  // [8, stack(offHats, clap, rim)],
)
