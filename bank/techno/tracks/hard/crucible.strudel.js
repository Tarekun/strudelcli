// "crucible" - hard techno, 150 bpm, G phrygian (G Ab Bb C D Eb F)
//
// a foundry at full heat. a clean, deep kick with a reverb bloom and a rolling
// rumble under it, struck scrap metal and an anvil marking the phrases. three
// choruses, each a different machine: a pumping supersaw chord stab, then a
// polymeter (a 5-step FM clang against a 7-step acid line against the kick's 4),
// then a screaming, driven-into-the-ground supersaw over the acid.
//
// structure (1 cycle = 1 bar = 4 beats, 128 bars, ~3:24):
//   0:00  intro       16 bars  kick, metal and anvil, then rumble and hats
//   0:25  build       16 bars  clap lands, the stab filters in, then a kickless roll
//   0:51  chorus 1    16 bars  hook A: the pumping chord stab, open hats
//   1:16  interlude    8 bars  the stab drops out, the polymeter clang takes over, acid creeps in
//   1:29  chorus 2    16 bars  the polymeter: clang 5 vs acid 7 vs kick 4, ride instead of open hats
//   1:55  breakdown   16 bars  no kick: metallic pad, then the screech tears through a filter
//   2:20  chorus 3    16 bars  the nasty one: distorted screech over the acid, open hats and metal back
//   2:46  peak         8 bars  everything at once, the stab back for one last round
//   2:59  outro       16 bars  strip back down to kick and metal

setcps(150/60/4)
const bar = 4 * 60 / 150      // one bar in seconds (1.6 s), for envelopes and delay times


// ---------------------------------------------------------------- drums

/**
 * Kick: the floor.
 * What: a clean, deep 909 kick on every quarter, with a reverb tail.
 * How: two layers of the same hit. The body is dry: pitched down so it sits
 *   low, no drive at all, a lowpass to round off the click; it ducks the
 *   rumble, stab and acid. The tail layer is the same hit with its sub cut
 *   away, sent almost entirely into a room, so each kick blooms into the
 *   space behind it.
 * Why: hard techno at 150 lives on the kick, but this one stays clean: the
 *   weight comes from pitch and the room, not distortion, which leaves the
 *   nastiness to the synths. A reverb is stereo, and a stereo sub thins out
 *   on a mono club system, so only the part of the kick above 200 Hz goes
 *   into the room: the bloom is heard, the low end stays centred and tight.
 */
const kickBody = s("bd:1*4").bank("RolandTR909")
  .speed(.82)                 // ~3.5 semitones down: a longer, lower body
  .lpf(2500)                  // soft click, no fizz
  .duckorbit("2:7:8")         // sidechain: ducks the rumble (2), the stab (7) and the acid (8)
  .duckattack(.13)            // they swell back between kicks
  .duckdepth(.9)
  .gain(.5)                   // loudest in the track; the rumble adds in phase on the downbeat, so leave room
const kickTail = s("bd:1*4").bank("RolandTR909")
  .speed(.82)                 // same pitch as the body
  .hpf(200)                   // no sub into the reverb: the low end stays mono
  .lpf(2500)
  .room(.9)                   // this layer is mostly reverb
  .roomsize(4)                // a medium tail: blooms but clears before the next hit
  .roomlp(1500)               // a dark tail, no hiss in the hats' range
  .orbit(1)                   // own reverb bus
  .gain(.3)                   // the bloom sits behind the body
const kick = stack(kickBody, kickTail)
// every 8th bar the last beat drops out and a 16th pickup pulls into the next phrase
const kickFill = kick.struct("<x*4!7 [x ~ ~ ~ x ~ ~ ~ x ~ ~ ~ ~ ~ x x]>")

/**
 * Rumble: the hard techno low end.
 * What: the kick retriggered on the last two 16ths of every beat, cut to
 *   the sub and smeared by a 16th echo and a big dark room.
 * How: a lowpass leaves only the sub, a little drive gives it a growl the
 *   kick doesn't have, and the feedback echo rolls it on between kicks.
 *   It lives on orbit 2, so every kick pushes it down and it swells back.
 * Why: the rolling, pumping rumble is the signature of hard techno. Being
 *   the same pitch as the kick, it fills the gaps without a second bass
 *   note, and the drive lives here, not on the kick, so the kick stays clean.
 */
const rumble = s("bd:1").bank("RolandTR909")
  .struct("[~ ~ x x]*4")      // feeds the tail into the next kick
  .speed(.82)                 // the kick's pitch: one low end, not two
  .lpf(100)                   // sub only
  .distort("2:.4")            // a growl above the sub; postgain gives back the level
  .delay(.7)                  // the roll is mostly echo: it stays centred (mono-safe)
  .delaytime(bar / 16)        // one 16th: every repeat lands on the grid
  .delayfeedback(.6)          // bridges the gap to the next kick
  .room(.12)                  // a little of the big dark room: more would make the sub wide
  .roomsize(8)
  .roomlp(300)                // dark: nothing left in the clap's range
  .orbit(2)                   // the bus the kick ducks: it pumps
  .gain(.03)                  // echo + room add a lot of level


/**
 * Hats: the 16th motor.
 * What: a closed 909 hat on every 16th, accented on the offbeat 8th.
 * How: a ghost-soft-LOUD-soft gain cycle per beat, lightly crushed for
 *   grit, highpassed into the top octave.
 * Why: at 150 the 16ths are what make the track feel fast. The accent on
 *   the "and" leans forward against the kick; a light crush makes the shiny
 *   909 hat sound like it's coming off a grinder, without turning to fizz.
 */
const hats = s("hh*16").bank("RolandTR909")
  .gain("[.1 .14 .28 .14]*4") // ghost, soft, accent on the "and", soft (crushed hats peak high)
  .crush(7)                   // some grit, still a hat
  .hpf(6000)                  // the top octave only
  .pan(.56)                   // a touch right; the metal sits left

/**
 * Open hats: the piston.
 * What: a short open hat on every offbeat 8th.
 * How: the 909 open hat cut short, in the very top, a touch left.
 * Why: kick on the beat, open hat between: the in-and-out of a piston,
 *   the oldest drive in techno. Cut short so it stays a hiss, not a wash.
 */
const ohats = s("[~ oh]*4").bank("RolandTR909")
  .decay(.14)                 // a hiss, not a cymbal
  .crush(8)                   // a little grit, like the closed hats
  .hpf(7000)                  // above the closed hats
  .pan(.44)                   // a touch left: the two hats frame the centre
  .gain(.22)                  // under the closed hats' accents

/**
 * Ride: chorus 2's top, in place of the open hats.
 * What: a 909 ride on every 8th, louder on the offbeat.
 * How: highpassed into the very top, lightly crushed, a touch right.
 * Why: swapping the open hats for a ride changes the whole top of the
 *   groove without touching the rhythm: a steady metallic shimmer instead
 *   of a hiss, which suits the clang and acid riding over it.
 */
const ride = s("rd*8").bank("RolandTR909")
  .gain("[.07 .12]*4")        // the offbeat 8th rings louder; a shimmer, not a feature
  .crush(9)                   // a hint of grit
  .hpf(5000)                  // the very top
  .pan(.6)

/**
 * Clap: the backbeat.
 * What: a 909 clap layered with a snare on beats 2 and 4, in a big room.
 * How: the two struck together, highpassed out of the kick, slightly
 *   driven, and sent to a large room with a darkened tail.
 * Why: the backbeat splits the bar into call and answer. The snare gives
 *   it a body, the clap the spread; the big room says "warehouse" and the
 *   dark tail keeps the reverb out of the hats.
 */
const clap = s("~ [cp,sd:3] ~ [cp,sd:3]").bank("RolandTR909")
  .hpf(300)                   // clear of the kick body and its bloom
  .distort("1.2:.5")          // a bit of bite; postgain gives the level back
  .room(.45)                  // the tail is half the sound
  .roomsize(5)                // big, but cleared before the next backbeat
  .roomlp(4000)               // a darker tail than the hit
  .orbit(5)                   // own reverb bus
  .gain(.27)


/**
 * Roll: the build, in rhythm.
 * What: a 4-bar snare roll that doubles every bar: 4, 8, 16, then 32 hits.
 * How: a crushed 909 snare, highpass and level both rising across the 4
 *   bars, in the clap's room.
 * Why: more hits in the same time feels like acceleration at a fixed
 *   tempo: tension only the drop can release.
 */
const roll = s("sd:5*<4 8 16 32>").bank("RolandTR909")
  .crush(8)                               // grit, like the hats
  .hpf(saw.slow(4).rangex(200, 2500))     // thinner and brighter as it climbs
  .gain(saw.slow(4).range(.08, .3))       // crescendo
  .room(.3)
  .roomsize(5)                            // the clap's room...
  .roomlp(4000)
  .orbit(5)                               // ...on the clap's bus

/**
 * Riser: the build, in timbre.
 * What: white noise through a bandpass climbing from 300 Hz to 10 kHz over
 *   4 bars, narrowing into a whistle and swelling from silence.
 * How: noise in 16ths (filters update per note), held at full level so it
 *   is one stream, the band centre and resonance rising with a saw.
 * Why: rising brightness reads as rising tension; the narrowing band at
 *   the top screams like a valve about to blow, right before the drop.
 */
const riser = s("white*16")
  .sustain(1)                             // one continuous stream...
  .release(.03)                           // ...no gaps
  .bpf(saw.slow(4).rangex(300, 10000))    // the climb
  .bpq(saw.slow(4).range(.7, 6))          // hiss to whistle
  .gain(saw.slow(4).range(0, 1))          // fades in (band-passed noise is quiet)
  .orbit(3)                               // own bus


// ---------------------------------------------------------------- metal

/**
 * Metal: scrap struck in the corner of the room.
 * What: sampled metal hits on the off-steps around the backbeat, a
 *   2-bar figure with different pieces of scrap.
 * How: the Dirt `metal` samples, pitched down a little, highpassed out of
 *   the low end, a short bright room and a dotted-8th echo, panned left.
 * Why: the call to industrial: real struck metal has inharmonic overtones
 *   no drum machine makes. Placing the hits on steps the kick, clap and
 *   hat accents don't use (3, 6, 13 / 3, 9, 14) makes them answer the
 *   groove instead of doubling it, and the echo throws them across the bar
 *   so a few hits feel like a whole machine shop.
 */
const metal = s(`<
  [~ ~ ~ metal:3 ~ ~ metal:5 ~ ~ ~ ~ ~ ~ metal:3 ~ ~]
  [~ ~ ~ metal:3 ~ ~ ~ ~ ~ metal:7 ~ ~ ~ ~ metal:5 ~]
>`)
  .speed(.85)                 // a bit heavier than the raw sample
  .hpf(500)                   // metal, not thud: clear of kick and rumble
  .delay(.3)                  // a few quiet repeats...
  .delaytime(bar * 3 / 16)    // ...a dotted 8th apart: off the grid of the hits
  .delayfeedback(.3)
  .room(.2)                   // a small, hard room
  .roomsize(1.5)
  .orbit(4)                   // own bus
  .pan(.32)                   // left, opposite the hats
  .gain(.35)

/**
 * Anvil: the phrase marker.
 * What: an anvil strike on the downbeat of every 8th bar, ringing out in
 *   a huge room.
 * How: the vcsl anvil, pitched down a fifth, highpassed, sent to a long
 *   reverb with its top kept (the ring is the point).
 * Why: replaces the crash: instead of a cymbal, a hammer on iron announces
 *   each phrase. Down a fifth the ring gets longer and darker, a foundry
 *   bell rather than a ping.
 */
const anvil = s("anvil:2").mask("<1 0!7>")
  .speed(.67)                 // a fifth down: longer, darker ring
  .hpf(300)                   // out of the low end
  .room(.6)                   // rings out across the room
  .roomsize(8)                // the biggest space in the track
  .orbit(6)                   // own bus
  .pan(.4)
  .gain(.55)                  // one hit per 8 bars: it has to cut through



// ---------------------------------------------------------------- synths

/**
 * Stab: hook A, the first chorus.
 * What: a pumping supersaw chord stab, Gm Gm Eb Fm over 4 bars, in a
 *   3-3-4-2-4 rhythm (steps 0, 3, 6, 10, 12).
 * How: a 5-voice supersaw, a lowpass envelope that bites open on each hit
 *   and snaps shut, a little drive, a dotted-8th echo and a mid room. Its
 *   orbit (7) is ducked by the kick, so every chord pumps.
 * Why: the rave stab is hard techno's hook. Gm - Eb - Fm stays in G
 *   phrygian: Eb pulls down a semitone onto D, and Fm brings the Ab (the
 *   flat 2nd) in on the last bar, the darkest note of the key, before it
 *   falls back onto G. The syncopated rhythm lands only the first hit with
 *   the kick, so the chords bounce between the beats.
 */
const stab = note("<[g3,bb3,d4] [g3,bb3,d4] [eb3,g3,bb3] [f3,ab3,c4]>")
  .struct("x ~ ~ x ~ ~ x ~ ~ ~ x ~ x ~ ~ ~")
  .s("supersaw")
  .unison(5)                  // a thick stack of voices
  .detune(.25)                // wide, but still pitched
  .hpf(180)                   // out of the kick and rumble: a mid hook
  .lpf(900)                   // resting cutoff: the body, with some edge
  .lpenv(3)                   // opens 3 octaves on each hit: the bite
  .lpdecay(.15)               // and snaps shut
  .lpsustain(0)
  .lpq(4)                     // a little resonance on the snap
  .decay(.25)                 // a stab: gone before the next hit
  .sustain(0)
  .distort("1.5:.5")          // a bit of grit; postgain gives the level back
  .delay(.25)                 // quiet echoes...
  .delaytime(bar * 3 / 16)    // ...a dotted 8th apart, between the hits
  .delayfeedback(.35)
  .room(.25)
  .roomsize(4)
  .orbit(7)                   // ducked by the kick: the pump
  .gain(.25)
// build version: the resting cutoff opens from a muffled 200 Hz to 900 over 8 bars
const stabIn = stab.lpf(saw.slow(8).rangex(200, 900))


/**
 * Clang: the polymeter, chorus 2's hook.
 * What: an FM-synthesised metal hit in a 5-step figure (G4, rest, Ab4,
 *   rest, rest) laid on the 16-step grid, so it cycles every 5 bars.
 * How: a sine carrier modulated at an irrational ratio (sqrt 2), the FM
 *   index decaying fast so each hit starts as a clang and rings down to a
 *   pure tone. A bandpass-like hpf/lpf pair keeps it in the upper mids, a
 *   bright room and an autopan send it around the room.
 * Why: 5 against 4 is the polymeter: the clang lands somewhere new against
 *   the kick on every beat and only lines up again after 5 bars, so a
 *   two-note figure never repeats the same way. The sqrt-2 ratio puts every
 *   sideband between the harmonics: struck metal, not a bell. G and Ab, a
 *   semitone apart, grind like two girders hit together.
 */
const clang = note("{g4 ~ ab4 ~ ~}%16").s("sine")
  .fm(5)                      // FM index: lots of clang at the attack
  .fmh(1.414)                 // irrational ratio: inharmonic, metallic
  .fmdecay(.09)               // the clang fades fast...
  .fmsustain(.1)              // ...to a little grit
  .decay(.18)                 // a hit, not a held note
  .sustain(0)
  .hpf(500)                   // upper mids and up
  .room(.3)
  .roomsize(3)                // a bright mid room: metal on concrete
  .orbit(9)                   // own bus
  .pan(sine.slow(5).range(.25, .75))  // one sweep per full polymeter cycle
  .gain(.3)


/**
 * Acid: the rolling 303-style line, choruses 2 and 3.
 * What: a squelchy saw bass in a 7-step figure (G2 G3 . G2 Bb2 . Ab2) on
 *   the 16-step grid: it cycles every 7 bars, against the clang's 5.
 * How: a sawtooth through the aggressive ladder filter, high resonance,
 *   an envelope that opens on every note, and a cutoff that wanders with
 *   perlin noise so no two bars squelch the same. Driven for grit, ducked
 *   by the kick (orbit 8).
 * Why: 7 against 4 (and against the clang's 5) is the second layer of the
 *   polymeter: the line keeps re-accenting itself against the kick. The
 *   octave jump G2-G3 is the classic acid bounce; Bb and Ab are the minor
 *   third and the flat 2nd, dark and phrygian. It is highpassed above its G2
 *   fundamentals, so the low end stays the kick's and the rumble's.
 */
const acid = note("{g2 g3 ~ g2 bb2 ~ ab2}%16").s("sawtooth")
  .ftype(1)                   // ladder filter: the squelchy one
  .lpf(perlin.slow(4).rangex(350, 1400))  // the hand on the cutoff knob
  .lpq(14)                    // high resonance: the squelch
  .lpenv(2.5)                 // opens on every note
  .lpdecay(.12)
  .lpsustain(.2)
  .decay(.14)                 // short notes, rests between
  .sustain(.2)                // staccato: the rests have to be heard
  .hpf(150)                   // the G2 fundamentals give way to the kick: the line lives in its harmonics
  .distort("2.5:.35")         // acid wants grit; postgain pulls it back
  .delay(.2)
  .delaytime(bar * 3 / 16)    // dotted 8th, like the stab
  .delayfeedback(.3)
  .orbit(8)                   // ducked by the kick
  .gain(.2)                   // drive + resonance make it loud for its gain
// filter-in version: the cutoff climbs from 150 Hz to 1.2 kHz over 4 bars
const acidIn = acid.lpf(saw.slow(4).rangex(150, 1200))


/**
 * Screech: the nasty one, chorus 3's lead.
 * What: a 7-voice supersaw driven into the ground, playing a 2-bar
 *   16th-note riff around G3 that leaps to G4 and claws back down through
 *   F, Eb, D (bar 1) and Bb, Ab, G, F, D (bar 2).
 * How: every note starts an octave high and dives onto its pitch in a few
 *   milliseconds (pitch envelope), so each hit screams before it lands.
 *   Wide detune, then heavy distortion and a little bitcrush; a resonant
 *   lowpass keeps the fizz from turning into pure noise. Its own bus with
 *   a short room and a dotted-8th echo.
 * Why: the track's payoff after two cleaner choruses: everything the kick
 *   isn't. The octave dive is the "hoover" scream of rave, the distortion
 *   turns 7 detuned saws into a wall of grinding harmonics, and the riff
 *   rides the phrygian scale down (Ab, the flat 2nd, just before G) so it
 *   snarls instead of resolving sweetly.
 */
const screech = note(`<
  [g3 g3 ~ g4 ~ g3 ~ f4 g3 ~ eb4 ~ d4 ~ ab3 ~]
  [g3 g3 ~ g4 ~ g3 ~ bb4 ab4 ~ g4 ~ f4 ~ d4 ~]
>`).s("supersaw")
  .unison(7)                  // a wall of voices
  .detune(.45)                // wide and sour
  .penv(12)                   // each note starts an octave up...
  .pattack(.001)
  .pdecay(.07)                // ...and dives onto its pitch: the scream
  .decay(.16)
  .sustain(.3)
  .release(.05)
  .hpf(220)                   // no low end: that's the kick, rumble and acid
  .distort("7:.06")           // driven into the ground; the postgain sets its level
  .crush(10)                  // a little digital grit on top of the drive
  .lpf(4500)                  // the fizz above this is just noise
  .lpq(5)                     // a resonant edge on the top
  .delay(.25)
  .delaytime(bar * 3 / 16)    // dotted 8th, like the other synths
  .delayfeedback(.3)
  .room(.2)
  .roomsize(3)
  .orbit(10)                  // own bus
  .gain(.18)                  // feeds the drive: the level is set by the postgain above
// breakdown tease: muffled behind a wall at 250 Hz, tearing open to full over 8 bars
const screechIn = screech.lpf(saw.slow(8).rangex(250, 4500))


/**
 * Pad: the cooling furnace, breakdown only.
 * What: a metallic pad holding the stab's progression, two bars a chord:
 *   Gm, Eb, Fm, then Gsus4 hanging unresolved into the build.
 * How: the GM "metallic" pad with a slow attack and long release so the
 *   chords blur together, a lowpass that slowly opens over the 8-bar
 *   cycle, and a huge room.
 * Why: with the kick gone the breakdown needs a bed, and the stab's chords
 *   slowed down to pads let the ear hear the harmony it's been bouncing on.
 *   The metallic timbre keeps it industrial, a ringing hall of steel, not
 *   a soft string pad. The sus4 (C over G) refuses to settle, so the drop
 *   lands as the answer.
 */
const pad = note("<[g2,bb2,d3] [eb2,g2,bb2] [f2,ab2,c3] [g2,c3,d3]>/2")
  .s("gm_pad_metallic")
  .attack(.8)                 // swells in: no transient
  .release(2)                 // the chords blur into each other
  .lpf(sine.slow(8).rangex(600, 3000))  // opens and closes across the 8 bars
  .room(.6)
  .roomsize(8)                // the anvil's huge space
  .orbit(6)                   // shares the anvil's bus: same room
  .gain(.5)


// ---------------------------------------------------------------- arrangement

arrange(
  // ---- intro (16): kick and metal, then the rumble and hats
  [8, stack(kickFill, metal, anvil)],
  [8, stack(kickFill, rumble, hats, metal, anvil)],

  // ---- build (16): the clap lands and the stab filters in, then the kick drops for the roll
  [8, stack(kickFill, rumble, hats, clap, metal, anvil, stabIn)],
  [4, stack(kickFill, rumble, hats, ohats, clap, metal, stab)],
  [4, stack(hats, stab, roll, riser)],

  // ---- chorus 1 (16): hook A, the pumping stab
  [16, stack(kickFill, rumble, hats, ohats, clap, metal, anvil, stab)],

  // ---- interlude (8): the stab drops out and the polymeter clang takes over, the acid creeps in
  [4, stack(kickFill, rumble, hats, metal, anvil, clang)],
  [4, stack(kickFill, rumble, hats, clang, acidIn, roll)],

  // ---- chorus 2 (16): the polymeter, clang 5 against acid 7 against the kick's 4, ride on top
  [16, stack(kickFill, rumble, hats, ride, clap, anvil, clang, acid)],

  // ---- breakdown (16): no kick, the metallic pad, then the screech tears through the wall
  [8, stack(pad, metal, anvil)],
  [4, stack(pad, clang, screechIn)],
  [4, stack(pad, screechIn, roll, riser)],

  // ---- chorus 3 (16): the nasty one, the screech over the acid
  [16, stack(kickFill, rumble, hats, ohats, clap, metal, anvil, acid, screech)],

  // ---- peak (8): everything at once, the stab back for one last round
  [8, stack(kickFill, rumble, hats, ohats, ride, clap, metal, anvil, clang, acid, stab, screech)],

  // ---- outro (16): strip back down to kick and metal
  [8, stack(kickFill, rumble, hats, metal, anvil, clang)],
  [8, stack(kickFill, metal, anvil)],
).postgain(.7)  // master trim (-3 dB, after each voice's drive): headroom for the peaks where layers stack up
