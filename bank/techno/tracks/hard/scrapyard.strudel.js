// "scrapyard" - hard techno, 155 bpm, F minor / phrygian (F Gb Ab Bb C Db Eb)
//
// no 808 or 909 anywhere. the kick is synthesised (a tuned `sbd` sub with a
// LinnDrum knock on top), the rumble comes from the same synth, the hats are
// filtered noise. the percussion is junk and orchestra: car brake drums, a
// ratchet, a gong, timpani, taiko, shakers and real hand claps. each chorus
// has its own lead and its own way of making sound: a saw pushed through a
// vowel formant filter (a voice), a bytebeat formula (a circuit), and a
// pulse-width-modulated, phased, driven pulse wave (an engine).
//
// structure (1 cycle = 1 bar = 4 beats, 128 bars, ~3:18):
//   0:00  intro       16 bars  kick, brake drums, gong and ratchet; then rumble and hats
//   0:24  build       16 bars  claps land, the talker filters in, then a kickless timpani roll + siren
//   0:49  chorus 1    16 bars  hook A: the talking saw over the brake drums, open hats
//   1:14  interlude    8 bars  taiko in 3 against 4, then shakers and the bytebeat warming up
//   1:26  chorus 2    16 bars  hook B: the bytebeat lead over taiko and shakers, no brakes
//   1:51  breakdown   16 bars  no kick: a synth choir, then the grinder starts up behind it
//   2:16  chorus 3    16 bars  hook C: the grinder, brake drums and open hats back
//   2:41  peak         8 bars  grinder and bytebeat together, every drum in the yard
//   2:53  outro       16 bars  strip back down to the kick and the junk

setcps(155/60/4)
const bar = 4 * 60 / 155      // one bar in seconds (~1.55 s), for envelopes and delay times


// ---------------------------------------------------------------- drums

/**
 * Kick: built from scratch, in two layers.
 * What: a tuned synth sub on F1 (the track's root) plus a sampled knock on
 *   top, on every quarter.
 * How: the sub is the `sbd` synth: a triangle that starts 2 octaves up and
 *   dives onto F1 in a few tens of milliseconds, a brown-noise click, a body
 *   that decays in under half a bar, lightly shaped. The knock is a LinnDrum
 *   kick with everything under 150 Hz cut away, so it adds only the attack
 *   and the mid punch. The sub ducks orbit 2 (the rumble).
 * Why: a synthesised sub can be tuned: on the root it locks with the
 *   rumble and bass instead of beating against them. But a pure sub at 43 Hz
 *   vanishes on small speakers, so the knock carries the hit in the mids. Two
 *   clean layers, no drive: a deep thud with a defined attack.
 */
const kickSub = s("sbd*4").note("f1")
  .penv(24)                   // starts 2 octaves up...
  .pdecay(.045)               // ...and dives onto F1 fast: the punch
  .decay(.42)                 // the body: gone well before the next beat
  .shape(.3)                  // a little roundness, still clean
  .lpf(4000)                  // keep the click soft
  .duckorbit("2:7:8:10")      // sidechain: ducks the rumble (2), taiko (7), talker (8) and grinder (10)
  .duckattack(.12)
  .duckdepth(.9)
  .gain(.3)                   // shape adds level; the sub carries the most energy, so it sets the headroom
const kickKnock = s("bd*4").bank("LinnDrum")
  .hpf(150)                   // no low end: only the attack and the knock
  .lpf(6000)                  // no fizz
  .gain(.4)                   // the audible punch of the kick; a short transient, peaks high for its loudness
const kick = stack(kickSub, kickKnock)
// every 8th bar beat 4 empties and a two-16th pickup throws into the next phrase
const kickFill = kick.struct("<x*4!7 [x ~ ~ ~ x ~ ~ ~ x ~ ~ ~ ~ ~ x x]>")

/**
 * Rumble: the synthesised low end.
 * What: the synth kick retriggered on the three 16ths after every beat,
 *   lowpassed and driven into a growl.
 * How: soft `sbd` hits on F1 with almost no pitch dive (just a hum), each
 *   long enough to run into the next, then a lowpass and some drive. Orbit
 *   2: the kick ducks it, so it swells between beats.
 * Why: the hard techno rumble is the kick's tail turned into a bass. Built
 *   from the same tuned synth, it sits exactly on the root and rolls under
 *   the groove without adding a second pitch. Three hits a beat fill the gap
 *   on their own, so no reverb is needed, and the sub stays mono.
 */
const rumble = s("sbd").note("f1")
  .struct("[~ x x x]*4")      // the three 16ths after each beat
  .velocity("[0 .6 1 .75]*4") // swells toward the last 16th, into the next kick
  .penv(3)                    // barely a dive: a hum, not a hit
  .pdecay(.03)
  .decay(.25)
  .lpf(120)                   // sub only
  .distort("1.5:.5")          // a growl just above the sub
  .orbit(2)                   // ducked by the kick; no reverb: a stereo tail on a sub goes wide
  .gain(.18)


/**
 * Hats: synthesised, no samples.
 * What: a white-noise tick on every 16th, accented on the offbeat 8th,
 *   with every 4th bar's last beat opening up.
 * How: white noise with a very short decay (a tick, not a hiss), a high
 *   highpass, and the accent cycle on velocity. The length of the last
 *   hits is patterned so a few hats per phrase ring longer.
 * Why: a closed hat is just a burst of filtered noise; building it lets the
 *   decay be shaped per step. The ticks drive the 16ths; the longer hits on
 *   the last beat of every 4th bar open the phrase like a valve.
 */
const hats = s("white*16")
  .decay("<[.03!16] [.03!16] [.03!16] [.03!12 .06 .03 .09 .03]>")  // ticks; the 4th bar opens up at the end
  .sustain(0)
  .velocity("[.45 .6 1 .6]*4") // ghost, soft, accent on the "and", soft
  .hpf(8000)                  // the top octave
  .pan(.57)                   // a touch right
  .gain(.45)

/**
 * Open hats: the piston, choruses 1 and 3.
 * What: a short open hat on every offbeat 8th.
 * How: a Yamaha RM50 open hat, cut short, highpassed, a touch left.
 * Why: kick on the beat, hiss between: the in-and-out drive of techno.
 *   Short, so it stays a hiss and leaves the top to the synthesised ticks.
 */
const ohats = s("[~ oh:4]*4").bank("YamahaRM50")
  .decay(.13)                 // a hiss, not a wash
  .sustain(0)
  .hpf(6500)
  .pan(.43)                   // a touch left: the two hats frame the centre
  .gain(.35)

/**
 * Shaker: chorus 2's top, in place of the open hats.
 * What: real shakers on the 16ths, pushing the offbeat 16ths.
 * How: two vcsl large shakers alternating (a wrist going back and forth),
 *   accented on the "e" and "a" of each beat, with a little swing.
 * Why: under the taiko and the bytebeat lead, a shaker turns the top from a
 *   machine into a crowd of hands: the tribal side of chorus 2.
 */
const shaker = s("[shaker_large:0 shaker_large:3]*8")
  .velocity("[.5 1 .6 .9]*4") // pushes the off-16ths
  .swingBy(1/24, 8)           // a slight swing on the 16ths: human hands
  .hpf(2500)
  .pan(.6)
  .gain(.6)

/**
 * Clap: the backbeat, played by hand.
 * What: real hand claps layered with a modern snare on beats 2 and 4.
 * How: two vcsl hand-clap recordings struck together (a fuller crowd of
 *   hands), plus a snare from the `snare` sample library for the crack,
 *   highpassed, then a large room with a dark tail.
 * Why: hand claps are never twice the same, so they sound human against
 *   the synthesised kick and hats: the one organic thing in the machine.
 *   The snare under them gives the attack a drum machine clap would have.
 */
const clap = stack(
  s("~ clap:2 ~ clap:5"),             // two different takes: the flams of a group of hands
  s("~ clap:7 ~ clap:3").late(.004),  // a hair late: a wider, looser clap
  s("~ modern:20 ~ modern:20").bank("snare").gain(.6),  // the crack under the hands
)
  .decay(.22)                 // cut the recordings' own tails: the room supplies the space
  .sustain(0)
  .hpf(350)                   // clear of the kick knock and the rumble
  .room(.35)
  .roomsize(4)                // a big hall that clears before the next backbeat
  .roomlp(3500)               // a darker tail than the hit
  .orbit(5)
  .gain(.28)



// ---------------------------------------------------------------- junk

/**
 * Brakes: car brake drums, the industrial voice of the track.
 * What: struck brake drums in a euclidean rhythm, 5 hits spread over the
 *   16 steps and rotated off the kick, cycling through four different drums.
 * How: the vcsl brake drum recordings, a step to a new drum each hit, a
 *   little lower than recorded, highpassed, a touch of sample-rate reduction,
 *   a short concrete room. Now and then (a quarter of the hits) a hit is
 *   doubled into 32nds, a stutter that keeps the loop from sounding fixed.
 * Why: brake drums are the oldest industrial instrument there is (scrapyard
 *   percussion, Einstürzende Neubauten): thick cast iron with a dull,
 *   inharmonic ring no synth or drum machine makes. Five evenly spread
 *   hits against the kick's four make an interlocking loop that never sits
 *   on the beat.
 */
const brakes = s("brakedrum").euclidRot(5, 16, 3)
  .n("<2 6 9 13>*5")          // a different drum on each hit
  .sometimesBy(.25, x => x.ply(2))  // a stutter now and then
  .speed(.9)                  // a little heavier than recorded
  .hpf(400)                   // iron, not thud: clear of the kick and rumble
  .coarse(2)                  // a touch of digital dirt in the ring
  .room(.2)
  .roomsize(1.5)              // a small concrete space
  .orbit(4)
  .pan(.35)                   // left, opposite the hats
  .gain(.5)

/**
 * Gong: the phrase marker.
 * What: a gong struck on the downbeat of every 16th bar, an octave down.
 * How: the vcsl gong at half speed (an octave lower, twice as long),
 *   highpassed, in a huge room.
 * Why: in place of a crash cymbal: a long, dark, shimmering wash that marks
 *   each section like a factory shift bell. An octave down it stops sounding
 *   like a temple and starts sounding like a sheet of steel.
 */
const gong = s("gong:3").mask("<1 0!15>")
  .speed(.5)                  // an octave down: darker and longer
  .decay(bar * 2)             // fades over 2 bars: a marker, not a drone
  .sustain(0)
  .hpf(300)                   // out of the low end and the lower mids
  .room(.5)
  .roomsize(8)                // the biggest space in the track
  .orbit(6)
  .gain(.4)

/**
 * Ratchet: the fill.
 * What: a ratchet cranked through the last beat of every 8th bar, exactly
 *   where kickFill drops out.
 * How: the vcsl ratchet, played twice in that beat (two cranks), highpassed,
 *   crushed a bit, with a 16th echo that carries it into the next bar.
 * Why: the kick's gap is a breath before the phrase turns; a mechanical
 *   rattle fills it with tension instead of silence, like a winch pulling
 *   the next 8 bars in.
 */
const ratchet = s("<~!7 [~ ~ ~ [ratchet:4 ratchet:4]]>")
  .hpf(600)                   // a rattle, not a thud
  .crush(8)                   // grit to match the junk
  .delay(.3)
  .delaytime(bar / 16)        // 16th echoes: a rattle that keeps winding
  .delayfeedback(.4)
  .orbit(4)                   // shares the brakes' bus: the same concrete room
  .pan(.6)
  .gain(1.4)                  // the recording is quiet

/**
 * Taiko: the war drums, chorus 2 and the peak.
 * What: tuned taiko hits every dotted 8th (one per 3 16ths), walking
 *   F - C - F - Ab, so the figure realigns with the bar only every 3 bars.
 * How: the GM taiko soundfont played on notes, highpassed out of the kick,
 *   a medium room, ducking with the kick's sidechain on orbit 7.
 * Why: 3 against 4: the drums roll over the kick instead of marching with
 *   it, which makes the groove feel faster without a tempo change. Tuning
 *   them to the root, fifth and minor third makes them part of the harmony,
 *   like a bassline played on skins.
 */
const taiko = note("{f2 ~ ~ c2 ~ ~ f2 ~ ~ ab2 ~ ~}%16")
  .s("gm_taiko_drum")
  .hpf(110)                   // above the kick's sub and the rumble
  .room(.3)
  .roomsize(4)
  .orbit(7)
  .gain(1.3)                  // low drums need level to be heard



// ---------------------------------------------------------------- synths

/**
 * Talker: hook A, the first chorus.
 * What: a sawtooth riff that talks: every beat the formant filter changes
 *   vowel (a, o, e, i), over a syncopated 16th figure in F phrygian that
 *   hammers the root and flicks up to the flat 2nd (Gb), the minor third and
 *   the fifth.
 * How: scale degrees through `scale("F4:phrygian")`, a pair of detuned saws
 *   (unison), a vowel formant filter stepping per beat, a little drive, then
 *   a dotted-8th echo. Orbit 8, ducked by the kick.
 * Why: a formant filter makes a synth sound like a throat: the riff becomes
 *   a voice barking orders over the machine, without any vocal sample. The
 *   Gb (the flat 2nd, a semitone above the root) is what makes it phrygian:
 *   dark and tense, it always falls back onto F.
 */
const talker = n(`<
  [0 ~ 0 2 ~ 0 ~ 4 ~ 0 1 ~ 0 ~ 2 ~]
  [0 ~ 0 2 ~ 0 ~ 4 ~ 0 1 ~ 4 ~ 7 ~]
>`).scale("F4:phrygian")
  .s("supersaw")
  .unison(2)                  // two voices: thick, still clear enough for the vowels
  .detune(.2)
  .vowel("<a o e i>*4")       // a new vowel every beat: the voice
  .decay(.14)
  .sustain(.2)
  .hpf(180)                   // out of the low end
  .distort("1.8:.75")         // some bark; the postgain sets its level (the formants eat a lot)
  .delay(.25)
  .delaytime(bar * 3 / 16)    // dotted 8th: answers between the notes
  .delayfeedback(.3)
  .orbit(8)                   // ducked by the kick
  .gain(.4)
// build version: muffled behind a wall at 300 Hz, opening fully over 8 bars
const talkerIn = talker.lpf(saw.slow(8).rangex(300, 6000))


/**
 * Byter: hook B, the second chorus, a lead made of arithmetic.
 * What: a bytebeat synth playing a stabbing 2-bar riff: the root in
 *   offbeat 8ths, answered by a falling line C5 - Db5 - C5 - Ab4 - Gb4 that
 *   lands back on F.
 * How: a bytebeat oscillator: the formula `t*((t>>11)%3+1)` is a sawtooth
 *   at the note's pitch whose harmonic jumps between 1x, 2x and 3x every
 *   eight cycles of the wave, so the tone snarls and buzzes while staying on
 *   pitch. Every note restarts the formula at t = 0 (same attack every time).
 *   A lowpass envelope bites on each note, drive on top, a short room.
 * Why: a sound no sampler or analog synth makes: digital, aliased, ugly in
 *   the best way, the junkyard of synthesis. After the vowel lead's voice,
 *   chorus 2 swaps a throat for a circuit. The riff is mostly root on the
 *   offbeats, so the taiko's cross-rhythm stays readable under it; the
 *   falling answer on bar 2 passes through Db (the minor 6th) and Gb (the
 *   flat 2nd), the two darkest notes of F phrygian.
 */
const byter = note(`<
  [~ f4 ~ f4 ~ f4 ~ [f4 f5] ~ f4 ~ f4 ~ f4 ~ ~]
  [~ f4 ~ f4 ~ f4 ~ ~ c5 db5 ~ c5 ~ ab4 gb4 ~]
>`).s("bytebeat")
  .bbexpr(pure('t*((t>>11)%3+1)'))  // pure(): the formula as a literal, not parsed as mini-notation
  .bbst(0)                    // every note starts the formula from zero
  .decay(.12)
  .sustain(.4)
  .release(.03)
  .hpf(250)
  .lpf(1200)
  .lpenv(2)                   // bites open 2 octaves on each note...
  .lpdecay(.1)                // ...and closes
  .distort("2:.16")           // more grit; the postgain sets its level (the raw bytebeat is loud and dense)
  .room(.2)
  .roomsize(2)
  .orbit(9)
  .gain(.7)
// interlude version: the circuit warming up, the lowpass opening over 4 bars
const byterIn = byter.lpf(saw.slow(4).rangex(250, 1200))


/**
 * Grinder: hook C, the third chorus, the nasty one.
 * What: a driven, phasing pulse-wave lead doubled an octave up, in a
 *   3-3-2 rhythm: F, F, Gb-F, then up to C and the Db that grinds against it.
 * How: two pulse oscillators (the riff and its octave) whose pulse width
 *   is swept by a fast LFO (the "wasp" of PWM), a slow vibrato, a phaser
 *   sweeping through the harmonics, then heavy drive. Notes are held longer
 *   than in the other hooks (sustain), so the movement is heard inside them.
 *   Orbit 10, ducked by the kick: it pumps.
 * Why: the payoff after a voice and a circuit: a wall of moving, buzzing
 *   harmonics. PWM plus phaser make each note churn like an engine under
 *   load, and the drive turns that churn into a snarl. Long notes in a 3-3-2
 *   rhythm against the kick feel half-time and heavy, the opposite of the
 *   busy byter riff, and Gb and Db (flat 2nd, minor 6th) are each a semitone
 *   above F and C: the riff grinds its teeth on both.
 */
const grinder = note(`<
  [f3 ~ ~ f3 ~ ~ gb3 ~ f3 ~ ~ ~ c4 ~ db4 c4]
  [f3 ~ ~ f3 ~ ~ gb3 ~ f3 ~ ab3 ~ gb3 ~ eb3 ~]
>`).superimpose(x => x.add(note(12)))  // the octave above, for the scream
  .s("pulse")
  .pw(.35)
  .pwrate(7)                  // a fast pulse-width LFO: the buzz inside each note
  .pwsweep(.25)
  .vib(4.5)                   // a slow vibrato, a quarter tone deep
  .vibmod(.25)
  .decay(.3)
  .sustain(.6)                // held: the movement inside the note is the point
  .release(.08)
  .hpf(160)                   // out of the kick and rumble
  .phaser(2)                  // sweeps through the harmonics
  .phaserdepth(.6)
  .distort("5:.05")           // the snarl; the postgain sets its level
  .lpf(3500)                  // the fizz above this is just noise
  .delay(.2)
  .delaytime(bar * 3 / 16)
  .delayfeedback(.3)
  .orbit(10)                  // ducked by the kick
  .gain(.5)
// breakdown tease: the engine starting behind the choir, opening over 8 bars
const grinderIn = grinder.lpf(saw.slow(8).rangex(200, 3500))



// ---------------------------------------------------------------- breakdown

/**
 * Choir: the breakdown, the scrapyard at night.
 * What: a synth choir holding Fm - Gb - Ebm - Fm, two bars a chord.
 * How: the GM synth-choir soundfont, slow attack, long release so the
 *   chords blur, a lowpass that breathes over 8 bars, a big room. Voiced
 *   from F4 up: an octave lower, the chords and their reverb muddied the
 *   low mids and spread the bass.
 * Why: with the machines stopped, voices: the human counterpart of the
 *   talker's formant voice. Gb major over an F pedal in the ear is the
 *   phrygian half-step, the darkest move the key has; Ebm drops further
 *   before Fm closes the loop.
 */
const choir = note("<[f4,ab4,c5] [gb4,bb4,db5] [eb4,gb4,bb4] [f4,ab4,c5]>/2")
  .s("gm_synth_choir")
  .attack(.6)                 // swells in
  .release(1.5)               // the chords blur into each other
  .lpf(sine.slow(8).rangex(900, 3500))  // breathes over 8 bars
  .room(.5)
  .roomsize(8)                // the gong's huge space
  .orbit(6)                   // shares the gong's bus: same room
  .gain(.3)


/**
 * Roll: the build, played on timpani.
 * What: a 4-bar timpani roll that doubles every bar: 4, 8, 16, then 32
 *   strokes, swelling from soft to loud.
 * How: an orchestral timpani hit, retriggered faster each bar, the level
 *   climbing with a saw, each stroke cut off by the next (`clip`) so the
 *   fast strokes stay a roll, not a smear. A highpass also climbs, so the
 *   roll gets tighter as it speeds up.
 * Why: the orchestral version of the snare roll: the same acceleration at
 *   a fixed tempo, but with a pitched, booming drum, it sounds like the
 *   ground shaking before the drop rather than a drum machine.
 */
const roll = s("timpani:4*<4 8 16 32>")  // variant 4: a hard stroke
  .clip(1)                                // each stroke ends where the next begins
  .hpf(saw.slow(4).rangex(60, 300))       // tighter as it speeds up
  .gain(saw.slow(4).range(.3, 1))         // crescendo
  .room(.15)                              // a little: the recording is already wide, and reverb on a low drum spreads the bass
  .roomsize(4)
  .orbit(11)                              // own bus

/**
 * Siren: the build, in pitch.
 * What: a real siren, retriggered every 2 beats and pitched higher with
 *   every hit across 4 bars, rising more than an octave.
 * How: the vcsl siren recording at a playback speed that climbs with a saw
 *   (faster = higher), cut off by the next hit, sent to a long echo.
 * Why: the rave siren, the real thing: a rising siren is the universal
 *   "something is coming" signal. Stepping it up every half bar makes the
 *   rise rhythmic, so it drives the build along with the roll.
 */
const siren = s("siren:1*2")
  .speed(saw.slow(4).rangex(.6, 1.4))     // climbs more than an octave over 4 bars
  .clip(1)                                // each hit cut by the next: steps, not a pile-up
  .hpf(400)
  .delay(.35)
  .delaytime(bar * 3 / 16)
  .delayfeedback(.45)
  .orbit(3)
  .gain(saw.slow(4).range(.5, 1.1))       // grows with the climb (a quiet recording)


// ---------------------------------------------------------------- arrangement

arrange(
  // ---- intro (16): the kick and the brake drums, then the rumble and hats
  [8, stack(kickFill, brakes, gong, ratchet)],
  [8, stack(kickFill, rumble, hats, brakes, gong, ratchet)],

  // ---- build (16): the claps land and the talker filters in, then a kickless roll
  [8, stack(kickFill, rumble, hats, clap, brakes, gong, ratchet, talkerIn)],
  [4, stack(kickFill, rumble, hats, ohats, clap, brakes, talker)],
  [4, stack(hats, talker, roll, siren)],

  // ---- chorus 1 (16): hook A, the talking saw over the brake drums
  [16, stack(kickFill, rumble, hats, ohats, clap, brakes, gong, ratchet, talker)],

  // ---- interlude (8): the talker leaves, the taiko rolls in 3 against 4, the circuit warms up
  [4, stack(kickFill, rumble, hats, brakes, gong, taiko)],
  [4, stack(kickFill, rumble, hats, shaker, taiko, byterIn)],

  // ---- chorus 2 (16): hook B, the bytebeat lead over taiko and shakers
  [16, stack(kickFill, rumble, hats, shaker, clap, gong, ratchet, taiko, byter)],

  // ---- breakdown (16): no kick, the choir, then the grinder starts up behind it
  [8, stack(choir, brakes, gong)],
  [4, stack(choir, grinderIn)],
  [4, stack(choir, grinderIn, roll, siren)],

  // ---- chorus 3 (16): hook C, the grinder, brake drums and open hats back
  [16, stack(kickFill, rumble, hats, ohats, clap, brakes, gong, ratchet, grinder)],

  // ---- peak (8): the grinder and the circuit together, every drum in the yard
  [8, stack(kickFill, rumble, hats, ohats, shaker, clap, brakes, gong, ratchet, taiko, byter, grinder)],

  // ---- outro (16): strip back down to the kick and the junk
  [8, stack(kickFill, rumble, hats, brakes, gong, ratchet, taiko)],
  [8, stack(kickFill, brakes, gong, ratchet)],
).postgain(.85)  // master trim (-1.4 dB, after each voice's drive): headroom for the kick's transient
