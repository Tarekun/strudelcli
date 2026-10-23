// 130/60 -> beats per second
// (130/60) / 4 -> bars per second
setcps(130/60/4)


// play bd=basedrum 4 times per cycle
const kick = s("bd:1*4").bank("RolandTR909")//.mask("<1!3 [1 1 1 0]>")
// rumble: clone of the kick, shifted an 8th so it lands between kicks,
// drowned in reverb, low-passed to the sub and driven. orbit(2) gives it
// its own reverb/delay bus, like a separate track in Ableton
const rumble = kick
  .late(1/8)                 // shift an 8th note: lands between kicks
  .room(0.5)//.roomsize(5.5) // lots of reverb
  .lpf(80)                   // keep only the sub
  .distort(2.5).gain(.08)
  .orbit(2)                  // own effect bus

// snare on beats 2 and 4 (~ = rest)
// harsh: hpf cuts the low body so the drive hits the crack, crush adds
// bitcrushed grit (lower = dirtier), gain compensates for the drive
const snare = s("~ sd:1 ~ sd:1").bank("RolandTR808")
// s("~ sd ~ sd").bank("RolandTR808")
//   .n("<1 2>")
  .hpf(300)
  .distort(3)
  .crush(10)
  // .room(0.1)
  .gain(.15)

// closed hihat on the offbeats (between kicks)
const hats = s("[~ hh]*4").bank("RolandTR909")
// open hats: same rhythm as hats, just swapped to the oh sample, so they
// stay in sync if you change the hats pattern. quieter so they sit under
const openHats = hats.s("oh").gain(.6)
// syncopated toms: one bar of 16ths, one [ ] group per beat
// lt/mt/ht = low/mid/high tom
const tom = s(
    // "[~ lt ~ ~] [~ ~ ~ lt] [~ ~ ~ ~] [~ mt ~ lt]"
    // "[~ ~ lt lt ~ lt ~ lt     ~ ~ lt lt ~ ~ lt ~]"
    "[~ ~ lt lt ~ lt ~ lt     ~ ~ lt lt ~ lt ~ lt]"
    // "[~ ~ mt mt ~ mt ~ mt     ~ ~ mt mt ~ mt ~ mt]"
).bank("RolandTR909").gain(.2)


// acid line: 303-style squelch, resonant lowpass swept open over 8 bars
const acid = note("c2 c2 c3 c2 eb2 c2 g2 c2 c2 c3 c2 bb1 c2 eb3 c2 g2")
  .s("sawtooth")
  .lpf(sine.range(300, 2500).slow(8)).lpq(18).lpenv(4)
  .decay(.15).sustain(0)
  .distort(1.5).gain(.15)

// hoover: detuned supersaw stab that swoops in pitch (pitch envelope)
const hoover = note("<c3 c3 eb3 bb2>")
  .s("supersaw").unison(7).detune(.6).spread(.8)
  .penv(-12).pattack(.08).pdecay(.4)
  .lpf(3000).phaser(2)
  .attack(.02).release(.3).gain(.5)

// distorted alarm: same riff as acid, but notes held for the full step,
// low resonance and no per-note filter sweep (those made the "droplet"/zap),
// square wave + heavy drive for a buzzy, siren-like tone
const alarm = note("[c3 c4]*8")
// const alarm = note("c2 c2 c3 c2 eb2 c2 g2 c2 c2 c3 c2 bb1 c2 eb3 c2 g2")
  .s("square")
  .lpf(sine.range(1200, 3500).slow(8)).lpq(4)
  .distort(6).gain(.01)

// screaming acid: 303 with cutoff high and resonance near max, so the filter
// "sings" instead of squelching. few long notes per bar, @n = hold for n steps
const scream = note("c3@3 ~ c3@2 eb3@2 ~@2 g3@4 c4@2")
  .s("sawtooth")
  .lpf(sine.range(1500, 5000).slow(8)).lpq(28)
  .lpenv(2).lpattack(.05).lpdecay(.4)
  .distort(2).gain(.1)

// 303 lead, Higher State style: resonance maxed, NO filter envelope
// (the envelope sweep is what makes the "pew").
// no slider() here: the VSCode extension doesn't support it and silently fails
// PLACEHOLDER pattern, not the real riff: replace with the notes by ear
const wink = note("c2 c2 c3 c2 ~ c2 c3 ~ c2 c2 c3 c2 ~ eb2 c3 ~")
  .s("sawtooth")
  .lpf(1200).lpq(25).lpenv(0) // cutoff ~200-6000, resonance 0-50
  .distort(2).gain(.1)        // distort 0-6, raise gain carefully
// filter automation: tri goes 0 -> 1 -> 0 each cycle, slowed to 4 bars,
// so the cutoff sweeps from its lowest point up to fully open and back.
// the low end (900) keeps it from ever closing fully: raise it for less depth.
// rangex sweeps exponentially, which sounds more even than a linear sweep
const winkSweep = wink.lpf(tri.rangex(900, 4000).slow(4))

// Higher State recipe (from Bthelick's breakdown video):
// - the 303's "square" was a clipped saw, slightly asymmetric: pulse with
//   pw off 50% is what makes it sound like the record (try .35 - .45)
// - two 303s layered an octave apart
// - bass rolled off BEFORE the drive (guitar pedal style), so the drive
//   hits the resonant peak instead of the low end
// - resonance into heavy distortion is the actual acid scream
// - riff is in G major. PLACEHOLDER notes, not the real riff
const higherState = note("c3 ~ c3 ~ ~ c3 ~ c3 c3 ~ ~ c3 ~ c3 ~ c3")
  .superimpose(x => x.add(note(12)))  // second 303 an octave up
  .s("pulse")
  // .pw(.4)                  // asymmetric square
  .lpf(2000)
  // .lpq(20)
  .lpenv(.9)
  .lpdecay(.2)
  .hpf(400)                           // roll off bass before the drive
  .distort(6)
  .gain(.003)               // distort up -> gain down
const higherStateFew = note("c3 ~ c3 ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~")
  .superimpose(x => x.add(note(12)))  // second 303 an octave up
  .s("pulse")
  // .pw(.4)                  // asymmetric square
  .lpf(2000)
  // .lpq(20)
  .lpenv(.9)
  .lpdecay(.2)
  .hpf(400)                           // roll off bass before the drive
  .distort(6)
  .decay(0.2)
  .gain(.003)               // distort up -> gain down
const higherState2 = note("c3 ~ c3 ~ ~ c3 ~ ~ ~ ~ ~ ~ ~ ~ ~ c3")
  .superimpose(x => x.add(note(12)))  // second 303 an octave up
  .s("pulse")
  // .pw(.4)                  // asymmetric square
  .lpf(2000)
  // .lpq(20)
  .lpenv(.9)
  .lpdecay(.2)
  .hpf(400)                           // roll off bass before the drive
  .distort(6)
  .gain(.003)   
// the record's second half: filter played live and drive pushed harder.
// tri sweeps cutoff up and back over 4 bars, drive climbs over 16 bars
const higherStateLive = higherState
  .lpf(tri.rangex(800, 5000).slow(4))
  .distort(saw.range(2, 5).slow(16))



// house string: one high note held for 4 bars. slow attack fades it in,
// long release lets it ring out. supersaw = stack of detuned saws, which
// gives the lush "string machine" width. orbit(3) keeps its reverb separate
const houseString = note(
  "c6"
  // "[c6,g6]"
).slow(4)
  .s("supersaw").unison(7).detune(.4).spread(.8)
  .attack(.8).sustain(1).release(2)
  .lpf(4000)
  .room(.6).roomsize(4).orbit(3)
  .gain(.2)
// fade-in version: attack stretched to the full 4-bar note, so it swells
// from silence to full volume. attack is in seconds: cycles / cps
const houseStringFadeIn = houseString.attack(4 / (130/60/4))
// sampled alternative: actual string ensemble instead of a synth
// const houseString = note("c5").slow(4).s("gm_string_ensemble_1")
//   .attack(.8).release(2).room(.6).roomsize(4).orbit(3).gain(.5)


// riser for a 4-bar section: noise whoosh + snare roll that speeds up.
// saw.slow(4) goes 0 -> 1 over the 4 bars. Each step reads it at its start,
// so the noise is chopped into 16ths to make the sweep move smoothly
const riser = stack(
  // white noise: the highpass opens upward and the volume swells
  s("white*16")
    .hpf(saw.rangex(200, 10000).slow(4))
    .gain(saw.range(0, .15).slow(4))
    .attack(.01).release(.05),
  // snare roll: 4, then 8, 16, 32 hits per bar, getting louder
  s("sd*<4 8 16 32>").bank("RolandTR909")
    .gain(saw.range(.05, .3).slow(4))
)

// 1 cycle = 1 bar = 4 beats, so [4, ...] = 16 beats

arrange(
  // // intro
  // [4, stack(kick, rumble)],
  // [4, stack(kick.mask("<1!3 [1 1 1 0]>"), rumble, snare)],
  // [4, stack(kick, rumble, snare, hats)],
  // [4, stack(kick, rumble, snare, hats, tom)],
  
  // [8, stack(kick, rumble, snare, hats, tom)],
  // [4, stack(kick, rumble, snare, hats, tom)],
  // [4, stack(snare, hats, tom)],
  // [8, stack(kick.mask("<1!3 [1 1 0 0]>"), rumble, hats, acid)],
  // [4, stack(hats, acid)],

  [1, stack(hats)],
  [1, stack(hats, snare)],
  [2, stack(hats, snare, higherState2)],
  [4, stack(hats, higherState, riser)],
  [8, stack(kick.mask("<1!7 [1 1 0 0]>"), rumble, hats, snare, higherState)],
  [8, stack(kick.mask("<1!7 [0 0 0 0]>"), rumble, hats, snare, tom, higherState)],

  [8, stack(kick.mask("<1!3 [1 1 1 0]>"), rumble, openHats, higherState)],
  [8, stack(kick, rumble, openHats, snare, tom, acid, higherStateFew)],
  // [8, stack(hats, snare, tom, wink)],
  // [8, stack(kick, rumble, rumble, hats, snare, winkSweep)],

  // [16, stack(kick, rumble, rumble, openHats, snare, wink.gain(0.05), acid)],

  // [8, stack(kick, rumble, hats, snare, alarm)],
  // [8, stack(kick, rumble, hats, snare, scream)],
  // [8, stack(kick, rumble, hats, tom, hoover)],
  // [8, stack(kick, rumble, hats, higherState)],
  // [8, stack(kick, rumble, hats, snare, higherStateLive)],
)

