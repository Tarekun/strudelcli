// "otherworld" - industrial ritual ambient, 90 bpm, C# phrygian (with the locrian tritone, G)
//
// after Akira Yamaoka's otherworld pieces: the air-raid siren, then the town rusts over.
// a ritual nobody can stop: rusted metal struck in the same off-beat loop every bar, chains,
// a half-time procession drum that pushes the drone down on every hit, a grinding machine in 8ths.
// a low male choir chants a line that climbs to the tritone and never comes home, and each time
// it ends, a gong starts it over. it evolves maliciously slowly: filters drift over 16 and 32 bars,
// the metal sags a semitone every 4th bar, the drum stumbles into every phrase.
//
// structure (1 cycle = 1 bar = 4 beats, 132 bars, ~5:52):
//   0:00  siren       12 bars  sirens overlapping over the town, then the drone rises under them
//   0:32  ritual      24 bars  the metal loop, then the procession drum, then the chains
//   1:36  machine     20 bars  the grind joins; the last 4 bars drop the drum, a held breath
//   2:29  chant       24 bars  the choir and the gong over everything
//   3:33  collapse    16 bars  the drum stops, the sirens return; the drone's filter tears open and
//                              the metal slows to a crawl, then only sirens and the torn drone
//   4:16  chant 2     24 bars  the ritual again, with a church organ swinging C# to D over the choir
//   5:20  fade        12 bars  metal, drone, organ and gong, then the drone and the last toll
setcps(90/60/4)

// the air-raid siren: one long wail every 4 bars, slowed so it groans instead of screams
const siren = s("<siren:3 ~ ~ ~>")
  .speed(.75)                   // down a fourth and ~14 s long: each wail overlaps the next, sirens from different streets
  .hpf(150)                     // the recording's motor rumble goes: the drone owns the sub
  .room(.7).roomsize(8)         // a huge, empty space: the siren is far away, over the whole town
  .orbit(1)
  .gain(10)                     // a very quiet recording (-36 dBFS rms at gain 1): it must cut through the collapse

// the floor of the other world: a low C# held for 4 bars at a time, rough and slowly breathing
const drone = note("[c#1,c#2]").slow(4).s("sawtooth")
  .attack(2).release(3)                      // swells in and out: no edge at each 4-bar retrigger
  .lpf(sine.rangex(140, 420).slow(16))      // a dark filter that opens and closes over 16 bars: the drone breathes
  .lpq(4)                                    // a little resonance: the filter sweep is heard as a moan
  .distort("2:.5")                           // grit on the low saws: rust, not tone
  .orbit(2)                                  // the bus the procession drum ducks
  .gain(.5)                                  // drive input: the level is set by the postgain

// rusted metal struck in a 3+3+3+3+4 loop: off the beat, but the same every bar, a ritual
const metal = s("metal:2 ~ ~ metal:6 ~ ~ metal:2 ~ ~ metal:6 ~ ~ metal:4 ~ ~ ~")
  .speed("<.5 .5 .5 .47>")       // an octave down: a heavier, duller clank; every 4th bar sags a semitone, out of true
  .hpf(300)                      // the slowed hits gain body: keep it off the drone
  .delay(.3).delaytime(60/90 * 3/4).delayfeedback(.4)   // dotted-8th echoes: the clanks smear across the beat
  .pan("0.3!3 0.7!3 0.35!3 0.65!3 0.5!4")   // each clank from a different side: the room feels big and wrong
  .room(.5).roomsize(5)          // the same far hall as the siren, a bit closer
  .orbit(3)                      // own bus for the delay
  .gain(.5)

// a concert bass drum on 1 and 3: half time, a slow procession; the 4th bar of every phrase stumbles into the next
const procession = "<[x ~ x ~]!3 [x ~ x [~ x x ~]]>"
const drum = stack(
  s("bassdrum2:9").struct(procession)
    .speed(.8),                  // the long 43 Hz boom tuned down to C#1, the drone's root: felt more than heard
  s("bassdrum1:7").struct(procession)
    .speed(.9)                   // the short skin hit, a touch lower and heavier: the audible thud, 70-150 Hz
    .gain(1.4),                  // over the boom: the ear should get the hit, the boom is the weight under it
)
  .duckorbit(2).duckattack(.4).duckdepth(.5)   // each hit pushes the drone down; it swells back over half a bar
  .room(.4).roomsize(5)          // the same hall, less of it: the hit stays heavy
  .orbit(4)

// chains: rattles of tiny metal hits dragged across beat 4, never twice the same
const chains = s("metal").struct("<[~ ~ ~ x*6] ~ [~ ~ [~ x*3] x*4] ~>")   // every other bar, the 3rd one longer
  .n(irand(10))                  // a random scrap of metal each hit: links, not a tuned bell
  .speed(rand.range(2.2, 3))     // tiny and high, each link a different size
  .gain(rand.range(.7, 1.4))     // uneven: a rattle, not a roll; tiny highpassed clicks need the level to be heard at all
  .clip(.6)                      // short: the links clack, they don't ring
  .hpf(2500)                     // above the metal loop's 1-1.6 kHz clank: the top of the mix is the chain's
  .pan(rand.range(.2, .8))       // each link somewhere else
  .room(.5).roomsize(5)          // the same hall
  .orbit(3)

// the machine: a grinding noise pulse in 8ths, accented 3+3+2 against the half-time drum
const grind = s("brown*8")
  .gain("1 .45 .45 1 .45 .45 1 .45")          // 3+3+2: the machine limps against the procession
  .attack(.01).decay(.14).sustain(0)          // a chug that dies before the next 8th: the drive would smear any sustain into a hiss
  .bpf(sine.rangex(350, 700).slow(32)).bpq(2.5)      // owns 300-800 Hz, between the drone and the metal; drifts over 32 bars
  .distort("5:.8")                             // grinding: the noise saturates into a rasp
  .orbit(5)
  .postgain(.3)                                // the drive adds ~30 dB to the quiet band: brought back down after it

// the chant: a low male choir over 8 bars, in octaves. it climbs a step at a time to the tritone (G),
// the wound, and ends on the flat 2nd (D): it never comes home, so the phrase starts over
const choir = note(`<
  c#3 [d3 c#3] e3 [d3 c#3]
  [c#3 e3] g3 [f#3 e3] d3
>`).add(note("0,-12"))           // unison in octaves, like monks: no harmony to soften the line
  .s("gm_choir_aahs")
  .attack(.4).release(1.5)       // the voices swell in and hang into the next note
  .lpf(2500)                     // darker: chest voices, no air on top
  .room(.6).roomsize(8)          // the siren's huge space: the choir is everywhere and nowhere
  .orbit(6)
  .gain(.8)

// a church organ over the second chant: the bare fifth C#-G#, then D major, the flat-2nd chord, 4 bars each.
// the phrygian swing between home and the chord a semitone above it: comfort that is always wrong
const organ = note("<[c#4,g#4] [d4,f#4,a4]>").slow(4)
  .s("gm_church_organ")
  .attack(1.5).release(3)        // fades in and out like a distant service: no key clicks, no edges
  .lpf(1800)                     // above the choir's chest voices but dull: heard through a wall
  .room(.6).roomsize(8)          // the choir's space
  .orbit(6)
  .gain(.25)                     // behind the choir: the chant leads, the organ is the room it echoes in

// a gong tolls once every 8 bars, on the first note of the chant: the ritual starts over
const gong = s("<gong:2 ~ ~ ~ ~ ~ ~ ~>")
  .speed(1.02)                   // its 135 Hz hum tuned up to C#3: it rings on the choir's first note
  .room(.6).roomsize(8)          // the choir's space: the toll hangs for a whole bar
  .orbit(6)
  .gain(2)                       // a soft recording: over the choir's first note, not under it

// the collapse: the drone's filter tears open and shut every 8 bars, the resonance screaming
const droneTorn = drone
  .lpf(sine.rangex(100, 1600).slow(8))
  .lpq(12)                       // a sharp, whistling peak: the floor gives way
  .gain(.2)                      // the open filter lets the drive through: under the drone, so the sirens carry the collapse

// the collapse: the metal loop slows to a crawl, its echoes piling up
const metalCrawl = metal
  .speed("<.35 .33>")            // a tritone, then a fifth, under the loop: huge, slow clanks, sagging every other bar
  .delayfeedback(.6)             // the echoes pile up instead of dying

arrange(
  // ---- siren (12): the shift
  [4, stack(siren)],
  [8, stack(siren, drone)],

  // ---- ritual (24): the loop, the procession, the chains (the drum leads every stack: it ducks the drone)
  [8, stack(drone, metal)],
  [8, stack(drum, drone, metal)],
  [8, stack(drum, drone, metal, chains)],

  // ---- machine (20): the grind, then a held breath without the drum
  [16, stack(drum, drone, metal, chains, grind)],
  [4, stack(drone, metal, chains, grind)],

  // ---- chant (24): the choir, the gong starting every phrase
  [24, stack(drum, drone, metal, chains, grind, choir, gong)],

  // ---- collapse (16): the sirens return, everything tears and slows
  [8, stack(siren, droneTorn, metalCrawl, chains)],
  [8, stack(siren, droneTorn)],

  // ---- chant 2 (24): the ritual again, the organ over it
  [24, stack(drum, drone, metal, chains, grind, choir, organ, gong)],

  // ---- fade (12): strip back to the drone and the last toll
  [8, stack(drone, metal, organ, gong)],
  [4, stack(drone, gong)],
).velocity(.6)                   // master level: the full chant stack peaks over 0 dBFS without it
