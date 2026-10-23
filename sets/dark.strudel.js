// "abyss" - dark techno, 140 bpm, A phrygian (the Bb over A is the darkness)
//
// structure (1 cycle = 1 bar = 4 beats, 1056 bars, ~30 min):
//    0:00  void         64 bars  drone and bells, the kick fades in
//    1:50  pulse        96 bars  groove builds one layer at a time
//    4:34  descent      96 bars  stab and lead arrive, ends in a filter build
//    7:19  breakdown 1  32 bars  no kick: drone, pad, lead drowned in reverb
//    8:14  drop 1      128 bars  everything, then toms take over
//   11:53  plateau     128 bars  hypnotic acid section, screaming by the end
//   15:33  breakdown 2  48 bars  pad + arp, longer and deeper
//   16:55  drop 2      128 bars  peak: answer lead, arp and pad together
//   20:34  industrial   96 bars  broken and halftime kicks, glitches, chant
//   23:19  final peak  128 bars  hardest kick, everything at once
//   26:58  outro       112 bars  strip back down to drone and bells
//
// after 1056 bars the arrange loops back to the start

setcps(140/60/4)
const bar = 4 * 60 / 140         // one bar in seconds, for envelopes
const dotted8 = 60 / 140 * 3 / 4 // dotted-8th delay time


// ---------------------------------------------------------------- drums

// kick: 909 driven with shape + distort, lpf tames the fizz.
// duckorbit(2) = sidechain: every kick pushes down everything on orbit 2
const kick = s("bd:1*4").bank("RolandTR909")
  .shape(.4).distort(2)
  .lpf(4000)
  .gain(.45)
  .duckorbit(2).duckattack(.2).duckdepth(.8)
// kick drops out on the last beat of each 8-bar phrase
const kickFill = kick.mask("<1!7 [1 1 1 0]>")
// longer gap: last 2 beats of every 4th bar
const kickBreak = kick.mask("<1!3 [1 1 0 0]>")
// final peak: same phrasing, more drive
const kickHard = kickFill.distort(3.5)
// halftime: beats 1 and 3 only
const kickHalf = kick.struct("x ~ ~ ~ ~ ~ ~ ~ x ~ ~ ~ ~ ~ ~ ~")
// broken: 3-3-4 syncopation instead of 4/4
const kickBroken = kick.struct("x ~ ~ x ~ ~ x ~ ~ ~ x ~ x ~ ~ ~")

// rumble: kick sample on the 3 16ths after each kick, reverb, sub only.
// orbit 2, so the kick ducks it and the two never fight
const rumble = s("[~ bd:1 bd:1 bd:1]*4").bank("RolandTR909")
  .speed(.75)
  .room(.5).roomsize(4)
  .lpf(100).distort(3)
  .gain(.12)
  .orbit(2)

// hats: crushed offbeat hat, 16ths accented on the offbeat, open hat, ride
const hats = s("[~ hh]*4").bank("RolandTR909").n(1).crush(8).gain(.3)
const hats16 = s("hh*16").bank("RolandTR909")
  .gain("[.1 .15 .3 .15]*4").crush(6)
const openHats = s("[~ oh]*4").bank("RolandTR909").crush(8).gain(.2)
const ride = s("rd*8").bank("RolandTR909").hpf(4000).gain(.12)
// shaker: euclidean hats (7 over 16), drifting across the stereo field
const shaker = s("hh(7,16,2)").bank("RolandTR909").n(3)
  .hpf(6000)
  .pan(sine.range(.2, .8).slow(3))
  .gain(.18)

// clap on 2 and 4, dirty, with its own reverb bus
const clap = s("~ cp ~ cp").bank("RolandTR909")
  .distort(1.5)
  .room(.5).roomsize(4).orbit(5)
  .gain(.22)

// metal: rimshot pitched down, crushed and sample-rate reduced,
// euclidean 3 over 8 so it pushes against the 4/4
const metal = s("rim(3,8,1)").bank("RolandTR909")
  .speed(.6).crush(5).coarse(4)
  .pan(sine.range(.3, .7).slow(4))
  .room(.3).orbit(5)
  .gain(.25)
// glitch: metal forwards on the left, reversed on the right (jux),
// and ~30% of hits randomly stutter into doubles
const glitch = metal.jux(rev).sometimesBy(.3, x => x.ply(2)).gain(.2)

// toms: slow, sparse and pitched down, darker than a schranz loop
const toms = s("[~ lt ~ lt] [~ ~ mt ~] [lt ~ ~ lt] [~ mt ~ ~]")
  .bank("RolandTR909")
  .speed(.8)
  .distort(3).hpf(200)
  .room(.3).orbit(4)
  .gain(.12)

// crash on the first bar of every 16
const crash = s("cr").bank("RolandTR909").mask("<1 0!15>")
  .room(.5).orbit(5).gain(.25)

// snare roll: 4, 8, 16, 32 hits per bar over a 4-bar section
const roll = s("sd*<4 8 16 32>").bank("RolandTR909")
  .crush(8)
  .hpf(saw.rangex(200, 2000).slow(4))
  .gain(saw.range(.1, .35).slow(4))

// riser: white noise in 16ths (filters only update at each note start),
// highpass sweeping up over a 4-bar section
const riser = s("white*16")
  .hpf(saw.rangex(300, 9000).slow(4))
  .gain(saw.range(0, .25).slow(4))
  .orbit(3)


// ---------------------------------------------------------------- synths

// drone: low detuned supersaw, A with a Bb every 4th bar
const drone = note("<a1 a1 a1 bb1>")
  .s("supersaw").unison(5).detune(.3)
  .attack(.5).sustain(1).release(1)
  .lpf(sine.rangex(150, 900).slow(16)).lpq(6)
  .distort(1.5)
  .room(.7).roomsize(6).orbit(3)
  .gain(.12)

// bass: offbeat 8ths, short saw blips. orbit 2 = ducked by the kick
const bass = note("<a1 a1 a1 bb1>")
  .struct("[~ x]*4")
  .s("sawtooth")
  .lpf(300).lpq(4)
  .decay(.15).sustain(0)
  .distort(1.5)
  .orbit(2)
  .gain(.15)
// filter-in version: opens from 80 to 300 over 16 bars
const bassIn = bass.lpf(saw.rangex(80, 300).slow(16))

// stab: minor chord, Bb major on the 4th bar, two hits per bar,
// dotted-8th delay smears them into the groove
const stab = note("<[a2,c3,e3] [a2,c3,e3] [a2,c3,e3] [bb2,d3,f3]>")
  .struct("x ~ ~ ~ ~ ~ x ~ ~ ~ ~ ~ ~ ~ ~ ~")
  .s("sawtooth")
  .lpf(perlin.rangex(400, 2500).slow(4)).lpq(8)
  .decay(.15).sustain(0)
  .distort(2.5)
  .delay(.45).delaytime(dotted8).delayfeedback(.5)
  .orbit(6)
  .gain(.08)
const stabIn = stab.lpf(saw.rangex(300, 2500).slow(16))

// lead: 2-bar hypnotic phrase, the bb4 and f5 are the phrygian bite
const lead = note(`<
  [a4 ~ ~ ~ ~ ~ c5 ~ ~ ~ bb4 ~ ~ ~ ~ ~]
  [a4 ~ ~ ~ ~ ~ e5 ~ ~ ~ f5 ~ e5 ~ ~ ~]
>`)
  .s("supersaw").unison(3).detune(.15)
  .decay(.2).sustain(.3).release(.1)
  .lpf(2500).lpq(6)
  .distort(2)
  .delay(.35).delaytime(dotted8).delayfeedback(.45)
  .orbit(7)
  .gain(.07)
// filter-in version: opens over 16 bars
const leadIn = lead.lpf(saw.rangex(300, 2500).slow(16))
// breakdown version: drowned in reverb
const leadVerb = lead.room(.8).roomsize(6)
// lead B: answer phrase for the second drop, sits higher
const leadB = note(`<
  [c5 ~ ~ ~ ~ ~ e5 ~ ~ ~ d5 ~ ~ ~ ~ ~]
  [c5 ~ ~ ~ ~ ~ f5 ~ ~ ~ e5 ~ bb4 ~ ~ ~]
>`)
  .s("supersaw").unison(3).detune(.15)
  .decay(.2).sustain(.3).release(.1)
  .lpf(2800).lpq(6)
  .distort(2)
  .delay(.35).delaytime(dotted8).delayfeedback(.45)
  .orbit(7)
  .gain(.065)

// pad: Am - F - Dm - Bb, one chord per bar, slow attack, long release
const pad = note("<[a2,c3,e3] [f2,a2,c3] [d3,f3,a3] [bb2,d3,f3]>")
  .s("supersaw").unison(5).detune(.25).spread(.8)
  .attack(.8).sustain(1).release(2)
  .lpf(1800)
  .room(.7).roomsize(6).orbit(10)
  .gain(.08)

// arp: 16ths walking the pad chords, square crushed to 8 bits
const arp = note(`<
  [a3 c4 e4 c4]*4 [f3 a3 c4 a3]*4 [d4 f4 a4 f4]*4 [bb3 d4 f4 d4]*4
>`)
  .s("square")
  .decay(.1).sustain(0)
  .lpf(2200).crush(8)
  .delay(.3).delaytime(dotted8).delayfeedback(.35)
  .orbit(12)
  .gain(.06)
const arpIn = arp.lpf(saw.rangex(300, 2200).slow(8))

// acid: 303-style 16ths in A phrygian, filter wandering with perlin
const acid = note("a1 a2 a1 c2 a1 bb1 a2 a1 a1 e2 a1 a2 f2 a1 bb1 a2")
  .s("sawtooth")
  .lpf(perlin.rangex(300, 2000).slow(4)).lpq(14).lpenv(3)
  .decay(.15).sustain(0)
  .distort(2)
  .orbit(8)
  .gain(.09)
const acidIn = acid.lpf(saw.rangex(200, 1500).slow(8))
// screaming version (Higher State recipe): resonance near max, no filter
// envelope, bass cut before heavy drive, cutoff swept up and back
const acidScream = acid
  .lpenv(0).lpq(24)
  .lpf(tri.rangex(800, 4000).slow(8))
  .hpf(250)
  .distort(3.5)
  .gain(.05)

// bell: FM sine with an inharmonic ratio so it rings like struck metal,
// euclidean 3 hits over 8, long delay tail
const bell = note("<a5 e5 bb4 c5>")
  .struct("x(3,8)")
  .s("sine").fm(4).fmh(1.41)
  .decay(.3).sustain(0)
  .delay(.5).delaytime(dotted8).delayfeedback(.5)
  .room(.5).roomsize(4).orbit(9)
  .gain(.1)

// chant: driven saw through dark vowels (formant filter), robotic voice
const chant = note("<a2 a2 c3 bb2>")
  .struct("x ~ ~ x ~ ~ x ~ ~ ~ x ~ ~ ~ ~ ~")
  .s("sawtooth")
  .vowel("<o u a u>")
  .decay(.25).sustain(.2)
  .distort(2.5)
  .room(.4).roomsize(4).orbit(11)
  .gain(.1)


// ---------------------------------------------------------------- builds

// DJ-style build: the whole groove through one highpass rising over 8 bars
const build1 = stack(kickFill, rumble, hats16, bass, clap, lead, stab)
  .hpf(saw.rangex(40, 3000).slow(8))
const build2 = stack(kickFill, rumble, hats16, clap, toms, acidScream)
  .hpf(saw.rangex(40, 3000).slow(8))


// ---------------------------------------------------------------- arrangement

arrange(
  // ---- void (64)
  [16, stack(drone, bell)],
  [16, stack(drone, bell, metal)],
  [16, stack(kickFill, drone, metal)],
  [16, stack(kickFill, rumble, drone, metal)],

  // ---- pulse (96)
  [16, stack(kickFill, rumble, hats, metal)],
  [16, stack(kickFill, rumble, hats, shaker, metal)],
  [16, stack(kickFill, rumble, hats, shaker, bassIn)],
  [16, stack(kickFill, rumble, hats, shaker, bass, clap)],
  [16, stack(kickFill, rumble, hats16, shaker, bass, clap, metal, crash)],
  [16, stack(kickFill, rumble, hats16, shaker, bass, clap, stabIn)],

  // ---- descent (96)
  [16, stack(kickFill, rumble, hats16, openHats, bass, clap, stab, crash)],
  [16, stack(kickFill, rumble, hats16, openHats, bass, clap, stab, metal)],
  [16, stack(kickFill, rumble, hats16, bass, clap, leadIn)],
  [16, stack(kickFill, rumble, hats16, openHats, ride, bass, clap, lead, crash)],
  [16, stack(kickFill, rumble, hats16, openHats, ride, bass, clap, lead, stab)],
  [8, stack(kickBreak, rumble, hats16, bass, clap, lead, stab)],
  [8, build1],

  // ---- breakdown 1 (32)
  [8, stack(drone, pad)],
  [8, stack(drone, pad, leadVerb)],
  [12, stack(pad, leadVerb, bell)],
  [4, stack(pad, leadVerb, roll, riser)],

  // ---- drop 1 (128)
  [16, stack(kickFill, rumble, hats16, openHats, ride, bass, clap, lead, pad, stab, crash)],
  [16, stack(kickFill, rumble, hats16, openHats, ride, bass, clap, lead, stab, metal)],
  [16, stack(kickFill, rumble, hats16, openHats, ride, bass, clap, lead, arp, crash)],
  [16, stack(kickFill, rumble, hats16, openHats, ride, bass, clap, lead, arp, metal)],
  [16, stack(kickFill, rumble, hats16, shaker, bass, clap, arp, stab, crash)],
  [16, stack(kickFill, rumble, hats16, shaker, bass, clap, toms)],
  [16, stack(kickFill, rumble, hats16, openHats, bass, clap, toms, metal, crash)],
  [8, stack(kickBreak, rumble, hats16, toms, metal)],
  [8, stack(kickBreak, rumble, hats, toms, acidIn)],

  // ---- plateau (128)
  [16, stack(kickFill, rumble, hats16, shaker, bass, clap, acid, crash)],
  [16, stack(kickFill, rumble, hats16, shaker, bass, clap, acid, metal)],
  [16, stack(kickFill, rumble, hats16, openHats, clap, acid, toms, crash)],
  [16, stack(kickFill, rumble, hats16, openHats, ride, clap, acid, toms, bell)],
  [16, stack(kickBroken, rumble, glitch, shaker, acid, chant)],
  [16, stack(kickFill, rumble, hats16, clap, acidScream, chant, metal, crash)],
  [16, stack(kickFill, rumble, hats16, openHats, ride, clap, acidScream, toms)],
  [8, stack(kickBreak, rumble, hats16, clap, acidScream, toms)],
  [8, build2],

  // ---- breakdown 2 (48)
  [8, stack(drone)],
  [8, stack(drone, bell)],
  [8, stack(drone, pad, bell)],
  [8, stack(pad, arpIn, bell)],
  [8, stack(pad, arp, leadVerb)],
  [4, stack(pad, arp, leadVerb, kickHalf)],
  [4, stack(pad, arp, roll, riser)],

  // ---- drop 2 (128)
  [16, stack(kickFill, rumble, hats16, openHats, ride, bass, clap, leadB, pad, arp, crash)],
  [16, stack(kickFill, rumble, hats16, openHats, ride, bass, clap, leadB, stab, arp, metal)],
  [16, stack(kickFill, rumble, hats16, openHats, ride, bass, clap, lead, stab, pad, crash)],
  [16, stack(kickFill, rumble, hats16, openHats, ride, bass, clap, leadB, arp, toms)],
  [16, stack(kickFill, rumble, hats16, shaker, bass, clap, arp, acid, crash)],
  [16, stack(kickFill, rumble, hats16, shaker, ride, bass, clap, acid, toms, metal)],
  [16, stack(kickFill, rumble, hats16, openHats, ride, bass, clap, leadB, pad, acid, crash)],
  [12, stack(kickBreak, rumble, hats16, clap, toms, glitch)],
  [4, stack(drone, roll, riser)],

  // ---- industrial (96)
  [16, stack(kickBroken, rumble, glitch, chant, drone)],
  [16, stack(kickBroken, rumble, glitch, shaker, chant, toms)],
  [16, stack(kickHalf, rumble, hats, toms, bell, stab)],
  [16, stack(kickFill, rumble, hats16, clap, toms, metal, stab, crash)],
  [16, stack(kickFill, rumble, hats16, openHats, clap, toms, metal, stab, acid)],
  [12, stack(kickBreak, rumble, hats16, clap, toms, acid, stab)],
  [4, stack(drone, roll, riser)],

  // ---- final peak (128)
  [16, stack(kickHard, rumble, hats16, openHats, ride, bass, clap, leadB, pad, arp, crash)],
  [16, stack(kickHard, rumble, hats16, openHats, ride, bass, clap, lead, stab, arp, toms)],
  [16, stack(kickHard, rumble, hats16, openHats, ride, bass, clap, acidScream, toms, metal, crash)],
  [16, stack(kickHard, rumble, hats16, shaker, clap, acidScream, glitch, chant)],
  [16, stack(kickHard, rumble, hats16, openHats, ride, bass, clap, leadB, pad, acid, crash)],
  [16, stack(kickHard, rumble, hats16, openHats, ride, bass, clap, lead, arp, stab, toms)],
  [16, stack(kickHard, rumble, hats16, openHats, ride, bass, clap, leadB, pad, arp, acidScream, crash)],
  [16, stack(kickHard, rumble, hats16, openHats, ride, bass, clap, lead, pad, stab, toms, metal)],

  // ---- outro (112)
  [16, stack(kickFill, rumble, hats16, openHats, bass, clap, pad, leadVerb)],
  [16, stack(kickFill, rumble, hats16, bass, clap, metal)],
  [16, stack(kickFill, rumble, hats, shaker, metal)],
  [16, stack(kickFill, rumble, hats, metal)],
  [16, stack(kickFill, rumble, metal, drone)],
  [16, stack(kick, drone, bell)],
  [16, stack(drone, bell)],
)
