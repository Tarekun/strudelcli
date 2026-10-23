// "rust" - schranz / industrial techno, 150 bpm, F minor-ish (lots of tritones)
//
// structure (1 cycle = 1 bar = 4 beats, ~2.5 min):
//   intro      16 bars  kick + metal, then rumble and hats join
//   build      16 bars  the schranz loop filters in, then clap + crash
//   groove      8 bars  ride, 16th hats and the stab riff
//   breakdown  12 bars  no kick: drone + stab, then snare roll + noise riser
//   drop       16 bars  everything
//   variation   8 bars  loop doubles up in the 4th bar, kick drops out for fills
//   outro      16 bars  strip back down to kick + metal

setcps(150/60/4)
const bar = 4 * 60 / 150   // one bar in seconds, for envelopes (attack etc.)


// ---------------------------------------------------------------- drums

// kick: 909 driven hard with shape + distort, lpf tames the fizz.
// duckorbit(2) = sidechain: every kick pushes down everything on orbit 2
const kick = s("bd:3*4").bank("RolandTR909")
  .shape(.6).distort(3)
  .lpf(5000)
  .gain(.45)
  .duckorbit(2).duckattack(.15).duckdepth(.9)
// fill versions: kick drops out at the end of the 8-bar phrase
const kickFill = kick.mask("<1!7 [1 1 1 0]>")
const kickBreak = kick.mask("<1!3 [1 1 0 0]>")

// rolling rumble: kick sample on the 3 16ths after each kick, sub only.
// lives on orbit 2, so the kick ducks it and they never fight
const rumble = s("[~ bd:3 bd:3 bd:3]*4").bank("RolandTR909")
  .speed(.8)
  .room(.4).roomsize(3)
  .lpf(110).distort(3)
  .gain(.12)
  .orbit(2)

// the schranz loop: rolling distorted toms, crushed to 6 bits.
// perlin wanders the hpf so the loop breathes instead of sitting still
const schranz = s("[lt mt lt lt] [mt lt lt mt] [lt lt mt lt] [lt mt mt lt]")
  .bank("RolandTR909").n("<3 5>")
  .speed(1.4)
  .distort(4).crush(6)
  .hpf(perlin.rangex(300, 1500).slow(2))
  .gain(.12)
  .orbit(4)
// filter-in version: hpf closes from thin (3000) to full (300) over 8 bars
const schranzIn = schranz.hpf(saw.rangex(3000, 300).slow(8))
// variation: every 4th bar each hit is doubled into 32nds
const schranzDouble = schranz.ply("<1 1 1 2>")

// hats: crushed offbeat hat, plus 16ths accented on the offbeat
const hats = s("[~ hh]*4").bank("RolandTR909").n(2).crush(8).gain(.35)
const hats16 = s("hh*16").bank("RolandTR909")
  .gain("[.15 .2 .4 .2]*4").crush(6)
const ride = s("rd*8").bank("RolandTR909").hpf(4000).gain(.15)

// clap on 2 and 4, dirty and washed in reverb on its own bus
const clap = s("~ cp ~ cp").bank("RolandTR909").n(2)
  .distort(2)
  .room(.5).roomsize(3).orbit(5)
  .gain(.25)

// industrial clank: rimshot in a euclidean rhythm (5 hits over 16 steps),
// pitched down, bitcrushed and sample-rate reduced until it sounds like metal
const metal = s("rim(5,16,2)").bank("RolandTR909")
  .speed(.7).crush(4).coarse(6)
  .pan(sine.range(.25, .75).slow(4))
  .gain(.3)

// crash on the first bar of every 4
const crash = s("cr").bank("RolandTR909").mask("<1 0 0 0>")
  .room(.4).orbit(5).gain(.3)

// snare roll for the build: 4, 8, 16 then 32 hits per bar, getting louder
// and brighter. saw.slow(4) ramps 0 -> 1 across the 4-bar section
const roll = s("sd*<4 8 16 32>").bank("RolandTR909").n(5)
  .crush(8)
  .hpf(saw.rangex(200, 2000).slow(4))
  .gain(saw.range(.1, .4).slow(4))


// ---------------------------------------------------------------- synths

// stab: F + B (tritone) chord, short distorted saw hits in a 3-3-4 rhythm.
// perlin moves the filter, dotted-8th delay smears it into the groove
const stab = note("<[f2,b2,f3] [f2,b2,f3] [f2,c3,f3] [e2,a#2,e3]>")
  .struct("x ~ ~ x ~ ~ x ~ ~ ~ x ~ ~ ~ ~ ~")
  .s("sawtooth")
  .lpf(perlin.rangex(400, 3000).slow(4)).lpq(8)
  .decay(.12).sustain(0)
  .distort(3)
  .delay(.4).delaytime(60/150 * 3/4).delayfeedback(.4)
  .orbit(6)
  .gain(.08)

// drone: low detuned supersaw for the breakdown, filter slowly opening
const drone = note("<f1 f1 f1 e1>")
  .s("supersaw").unison(5).detune(.3)
  .attack(.5).sustain(1).release(1)
  .lpf(sine.rangex(200, 1200).slow(16)).lpq(6)
  .distort(1.5)
  .room(.7).roomsize(6).orbit(3)
  .gain(.15)

// riser: white noise chopped into 16ths so the filter and volume can move
// (they only update at the start of each note), sweeping up over 4 bars
const riser = s("white*16")
  .hpf(saw.rangex(300, 9000).slow(4))
  .gain(saw.range(0, .3).slow(4))
  .orbit(3)


// ---------------------------------------------------------------- arrangement

arrange(
  // intro
  [8, stack(kickFill, metal)],
  [8, stack(kickFill, rumble, metal, hats)],

  // build
  [8, stack(kickFill, rumble, hats, schranzIn)],
  [8, stack(kickFill, rumble, hats, clap, schranz, crash)],

  // groove
  [8, stack(kickFill, rumble, hats16, ride, clap, schranz, stab, crash)],

  // breakdown
  [8, stack(drone, stab, metal)],
  [4, stack(drone, roll, riser)],

  // drop
  [16, stack(kickFill, rumble, schranz, hats16, ride, clap, stab, metal, crash)],

  // variation
  [8, stack(kickBreak, rumble, schranzDouble, hats16, clap, metal)],

  // outro
  [8, stack(kickFill, rumble, hats, metal)],
  [8, stack(kick, metal)],
)
