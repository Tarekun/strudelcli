// "numbers station" - techno, 130 bpm, G phrygian
//
// a pitched-up voice reads numbers over a radio band while a hoover growl
// stabs in dotted 8ths, 3-against-4 over a 909 four-on-the-floor. the rim
// answers the voice, and a syncopated sub rumble rolls between the kicks.
// built from the scratch.strudel.js instruments alone: the arrange does all the work.
// a crushed 909 snare roll closes every 16-bar phrase and leads into each drop.
//
// structure (1 cycle = 1 bar = 4 beats, 216 bars, ~6:38):
//   0:00  intro            32 bars  kick and hats (for mixing), then rumble and rim
//   0:59  build            16 bars  open hats and the voice; the last bar drops the kick
//   1:28  drop             32 bars  the growl lands: everything
//   2:27  breakdown        16 bars  no kick: growl, rim echoes and the voice, then the hats; the last bar is the voice alone
//   2:57  drop 2           16 bars  everything
//   3:26  sweep breakdown  32 bars  no kick: the growl's resonant filter breathes every 4 bars through a quarter-note delay, then rises over the last 4
//   4:25  drop 3           32 bars  the last peak: the hard growl, layered with a crushed square an octave up
//   5:24  strip             8 bars  the hats drop out: kick, rumble, hard growl, layer and the voice
//   5:39  outro            32 bars  strip back down to kick and hats

setcps(130/60/4)


const kick = s("bd*4").bank("RolandTR909")
  .duckorbit(2).duckattack(.12).duckdepth(.8)   // sidechain: ducks the rumble on every hit
  .gain(1.1)                    // ~3 dB over the default .8: the kick leads the mix
const hats = s("[~ hh]*4").bank("RolandTR909")
  .hpf(3000)

// open hat on the same offbeats, alternating a long ring and a short choke
const openHat = s("[~ oh:11]*4").bank("RolandTR909")
  .clip("[~ 2] [~ .5] [~ 2] [~ .7]")   // long rings a full beat, up to the next hat; short is choked to ~70 ms
  .hpf(3000)                           // same floor as the closed hat: nothing near the snare's body
  .gain(.45)                           // the ring carries a lot of energy: keeps it from taking over the top end

// rimshot on the "and" of 2 and the "e" of 4, echoing on the growl's dotted-8th grid
const rim = s("[~ ~ ~ ~] [~ ~ rim ~] [~ ~ ~ ~] [~ rim ~ ~]").bank("RolandTR909")
  .hpf(900)                     // above the growl: only the click and ring, 1-4 kHz
  .delay(.35)                   // echoes quieter than the hit
  .delaytime(60/130 * 3/4)      // a dotted 8th: the echoes land on the growl's 3-against-4
  .delayfeedback(.35)           // two or three repeats, then gone
  .orbit(3)                     // own bus: the delay settings are per orbit
  .gain(.35)                    // a very spiky sample: peaks well over the kick at full level

// chopped voice on the "e" of 1 and the "a" of 3: call and response with the rims
const vox = s("[~ numbers:1 ~ ~] [~ ~ ~ ~] [~ ~ ~ numbers:8] [~ ~ ~ ~]")   // "one" ... "six"
  .begin(.05)                   // skips the silence before the word: the chop starts on the voice
  .clip(1)                      // cut to one 16th: just the first syllable, a chop not a word
  .speed(1.5)                   // up a fifth: lifts the voice out of the growl's 200-400 Hz body
  .hpf(800)                     // the rest of the body goes: the voice sits around 2 kHz, between growl and hats
  .gain(1.5)                    // just over the rim: the chop answers it, not buries it

// hoover growl in dotted 8ths: 3-against-4, the Ab lands somewhere new each bar
const growl = note("{g3 ~ ~ g3 ~ ~ ab3 ~ ~}%16").s("supersaw")   // G minor; Ab grinds a semitone over the root
  .unison(7).detune(.5).spread(.6)    // 7 detuned saws: thick, beating, wide
  .penv(-7).pattack(0).pdecay(.08)    // swoops up a fifth into each note: the hoover "bwoow"
  .lpf(2000).lpenv(2).lpdecay(.15)    // bright body, opens to ~8 kHz on the swoop: bite in the empty 1-3 kHz
  .decay(.25).sustain(0)              // stabs, gone before the next hit
  .distort("4.5:.11")                 // the dirt, pushed harder; postgain holds it under the kick
  .hpf(180)                           // out of the kick and rumble's sub
  .gain(.4)                           // drive input: the level is set by the postgain

// the last peak's growl: wider open, harder driven, more beating between the saws
const growlHard = growl
  .lpf(2800)                          // brighter still: the swoop now opens to ~11 kHz
  .distort("6:.085")                  // more drive, postgain down: about 1 dB over the growl
  .detune(.7)                         // wider detune: a rougher, angrier beat

// the hard growl's layer: the same line an octave up, a crushed square pluck on top of the saws
const growlTop = note("{g4 ~ ~ g4 ~ ~ ab4 ~ ~}%16").s("square")
  .decay(.12).sustain(0)              // a short tick on each stab's attack, shorter than the growl
  .crush(6)                           // digital grit: a different dirt from the growl's drive
  .hpf(1000)                          // only the square's upper harmonics: none of the growl's body
  .lpf(3500)                          // under the hard growl's bright swoop and the hats
  .gain(.6)                           // crush and the highpass leave little level: a layer, well under the growl

// sweep breakdown: a resonant lowpass breathes, closed at 250 Hz to open at 4 kHz every 4 bars
const growlSweep = growl
  .lpf(cosine.rangex(4000, 250).slow(4))   // starts closed, opens, closes again: exponential, as the ear hears it
  .lpq(8)                                  // resonance: the sweep sings instead of just dulling
  .delay(.1)                              // a faint ghost of each stab: the line stays in front
  .delaytime(.46)                          // a hair longer than a quarter (.46 s): echoes land off the grid, a blur, not extra notes
  .delayfeedback(.1)                      // one or two repeats, fading fast: a hint, not a roll
  .orbit(4)                                // own bus: the delay settings are per orbit

// the build into the last peak: the filter rises from closed to fully open over 4 bars
const growlRise = growl
  .lpf(saw.rangex(250, 6000).slow(4))
  .lpq(8)

// fill: a crushed 909 snare roll on the last beat, 16ths into 32nds, rising
const fill = s("~ ~ ~ [sd sd sd [sd sd]]").bank("RolandTR909")
  .gain("0 0 0 [.35 .5 .65 [.75 .85]]")   // crescendo: the roll leans into the next downbeat
  .crush(6)                               // the same grit as the scratch snare
  .hpf(200)                               // out of the kick and the rumble
const fill16 = fill.mask("<0!15 1>")      // the last bar of every 16
const fill8 = fill.mask("<0!7 1>")        // the last bar of every 8
const fill4 = fill.mask("<0!3 1>")        // the last bar of every 4

// syncopated sub rumble in the gaps between kicks
const rumble = s("bd").bank("RolandTR909")
  .struct("[~ x ~ x] [~ ~ x ~] [~ x ~ x] [~ ~ x ~]")   // never on the kick, pushes into the next bar
  .lpf(70)                      // sub only, below the kick's ~100 Hz punch
  .distort(2.5)                 // growl: harmonics just above the sub
  .orbit(2)                     // the bus the kick ducks
  .gain(.08)                    // drive adds a lot of level: still under the kick, but felt

arrange(
  // ---- intro (32): kick and hats for the DJ, then the low end and the rim
  [16, stack(kick, hats, fill16)],
  [16, stack(kick, rumble, hats, rim, fill16)],

  // ---- build (16): open hats and the voice; one bar without kick before the drop
  [15, stack(kick, rumble, hats, openHat, rim, vox)],
  [1, stack(hats, openHat, rim, vox, fill)],

  // ---- drop (32): the growl lands
  [32, stack(kick, rumble, hats, openHat, rim, vox, growl, fill16)],

  // ---- breakdown (16): no kick, the growl and the echoes carry it, then the voice alone
  [8, stack(growl, rim, vox)],
  [7, stack(growl, hats, openHat, rim, vox)],
  [1, stack(vox, fill)],

  // ---- drop 2 (16): everything
  [16, stack(kick, rumble, hats, openHat, rim, vox, growl, fill16)],

  // ---- sweep breakdown (32): no kick, the growl's filter breathes through the delay, then rises into the last peak
  [8, stack(growlSweep, rim)],
  [8, stack(growlSweep, hats, rim, vox)],
  [8, stack(growlSweep, hats, rim, openHat, vox)],
  [4, stack(growlSweep, hats, openHat, vox)],
  [4, stack(growlRise, hats, openHat, vox, fill4)],

  // ---- drop 3 (32): the last peak, the hard growl and its layer
  [32, stack(kick, rumble, hats, openHat, rim, vox, growlHard, growlTop, fill16)],

  // ---- strip (8): the top end drops out, the low end and the growl hammer on
  [8, stack(kick, rumble, growlHard, growlTop, vox, fill8)],

  // ---- outro (32): strip back down to kick and hats
  [16, stack(kick, rumble, hats, openHat, rim, fill16)],
  [16, stack(kick, hats)],
).velocity(.55)               // master level: the full stack peaks over 0 dBFS without it
