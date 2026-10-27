// "blood mirror" - hard techno, 145 bpm, D phrygian (D Eb F G A Bb C), drop D
//
// the "narcissist version": a hard techno track with a metal band playing on
// top, the way Carti's tour band played riffs over the trap songs. the guitars
// are written like a guitarist plays, not like a sequencer: palm-muted gallops
// on the open low D, power chords strummed and left to ring, chromatic walks
// down the neck, pinch squeals and feedback. the hook is first an opium synth;
// then the lead guitar takes it over in octaves.

setcps(150/60/4)
const bar = 4 * 60 / 145      // one bar in seconds (~1.66 s), for envelopes and delay times


// ---------------------------------------------------------------- drums

/**
 * Kick: the floor, clean and deep.
 * What: a tuned synth sub on D1 (the open low string, two octaves down) plus
 *   a 909 knock, on every quarter.
 * How: the `sbd` synth dives two octaves onto D1; the 909 hit with its low
 *   end cut adds only the attack. The sub ducks the rumble (2), the guitars
 *   (7), the bass (8), the lead guitar (9) and the synth (10).
 * Why: tuned to the riff's open string, the kick, rumble and bass are one
 *   low end. Clean: all the dirt in this track is in the guitars.
 */
const kickSub = s("sbd*4").note("d1")
  .penv(24)                   // starts 2 octaves up...
  .pdecay(.045)               // ...and dives onto D1: the punch
  .decay(.42)                 // gone well before the next beat
  .lpf(4000)                  // a soft click
  .duckorbit("2:7:8:9:10")    // sidechain: rumble, guitars, bass, lead, synth
  .duckattack(.12)
  .duckdepth(.8)              // a little less than full: the band shouldn't vanish on every beat
  .gain(.5)                   // the loudest thing in the track
const kickKnock = s("bd:1*4").bank("RolandTR909")
  .hpf(150)                   // no low end: only the knock
  .lpf(5000)
  .gain(.65)
const kick = stack(kickSub, kickKnock)
// every 8th bar the last beat drops out for the drummer's tom fill
const kickFill = kick.struct("<x*4!7 [x ~ ~ ~ x ~ ~ ~ x ~ ~ ~ ~ ~ ~ ~]>")

/**
 * Rumble: the hard techno low end.
 * What: soft D1 hits on the three 16ths after every beat, lowpassed to the
 *   sub and driven into a growl.
 * How: the kick's synth with barely any pitch dive (a hum), swelling toward
 *   the next kick, then a lowpass and drive. Orbit 2: ducked by the kick.
 * Why: the rolling sub between kicks is hard techno's engine. It stays on D
 *   (the riff's open string, which the gallops hammer anyway), so the bass
 *   guitar can walk the riff's notes above it without two basslines.
 */
const rumble = s("sbd").note("d1")
  .struct("[~ x x x]*4")
  .velocity("[0 .6 1 .75]*4") // swells into the next kick
  .penv(3)                    // a hum, not a hit
  .pdecay(.03)
  .decay(.25)
  .lpf(200)                   // the sub and its first harmonics: D1 alone is felt, not heard
  .distort("4:.2")            // a growl just above the sub; postgain sets the level
  .orbit(2)                   // ducked by the kick
  .gain(.2)

/**
 * Sticks: the drummer's count-in.
 * What: four clicks on the quarters; masked onto the last bar before the
 *   band kicks in.
 * How: claves (two wooden sticks struck together), pitched up a little to
 *   sound thinner, like drumsticks, dry and highpassed.
 * Why: "one, two, three, four": the most live-band sound there is.
 */
const sticks = s("clave:1*4")
  .speed(1.25)                // thinner than claves: sticks
  .hpf(800)
  .gain(2)                    // quiet recording, and it has to cut through the ringing guitars

/**
 * Hats: the 16th motor, with trap rolls.
 * What: closed hats on every 16th, accented on the offbeat 8th. Every 2nd
 *   bar the last beat rolls in 16th triplets; every 4th bar beats 3 and 4
 *   roll in 32nds, pitching up.
 * How: LinnDrum hats (sampled real cymbals: a drummer's hat, not a 909's),
 *   lightly crushed, highpassed into the top, a touch right.
 * Why: the 16ths drive the techno; the rolls are the trap in it.
 */
const hats = s(`<
  hh*16
  [[hh*4]!3 hh*6]
  hh*16
  [[hh*4]!2 hh*8 hh*8]
>`).bank("LinnDrum")
  .velocity("[.45 .6 1 .6]*4")  // ghost, soft, accent on the "and", soft
  .speed("<1 [1 1 1 1.1] 1 [1 1 1.1 1.25]>")  // rolls pitch up
  .crush(9)                   // a little grit
  .hpf(6500)
  .pan(.58)
  .gain(.5)

/**
 * Open hats: the piston, in the drops.
 * What: a short open hat on every offbeat 8th.
 * How: the LinnDrum open hat cut short, highpassed, a touch left.
 * Why: kick on the beat, hiss between: the oldest drive in techno.
 */
const ohats = s("[~ oh]*4").bank("LinnDrum")
  .decay(.15)                 // a hiss, not a wash
  .sustain(0)
  .hpf(6000)
  .pan(.42)
  .gain(.35)

/**
 * Snare: the backbeat, a drummer's snare.
 * What: a real snare layered with a clap on beats 2 and 4, plus a soft
 *   ghost note just before beat 4 every other bar.
 * How: an acoustic snare recording for the crack and the wires, an 808 clap
 *   for the spread, a bit of drive, a mid-sized room.
 * Why: a real snare is what turns the beat into a band; the clap keeps it
 *   tied to trap. Ghost notes are a drummer's left hand, never a machine's.
 */
const snareHit = stack(
  s("modern:20").bank("snare"),
  s("cp:1").bank("RolandTR808").gain(.6),   // the trap spread under the crack
)
  .hpf(250)                   // clear of the kick and the bass
  .distort("1.2:.6")
  .room(.35)
  .roomsize(4)
  .roomlp(4500)
  .orbit(5)                   // own reverb bus
  .gain(.5)
const snare = snareHit.struct("<[~ x ~ x] [~ ~ ~ ~ x ~ ~ ~ ~ ~ ~ x x ~ ~ ~]>")
  .velocity("<1 [1 1 .3 1]>")  // the ghost note is soft
// metal breakdown: half time, one snare on beat 3
const snareHalf = snareHit.struct("~ ~ x ~")

/**
 * Crash: the drummer marking phrases.
 * What: a crash cymbal on the first downbeat of every 4 bars.
 * How: the LinnDrum crash (a sampled real cymbal), highpassed, a little room.
 * Why: a drummer hits a crash at the top of every phrase; a drum machine
 *   track wouldn't. It ties the drums to the band's phrasing.
 */
const crash = s("cr").bank("LinnDrum").mask("<1 0!3>")
  .hpf(400)
  .room(.25)
  .roomsize(4)
  .orbit(5)
  .pan(.35)
  .gain(.45)

/**
 * Toms: the drummer's fill.
 * What: a fill down the kit (high, high, mid, low) on the last beat of every
 *   8th bar, exactly where the kick drops out.
 * How: the LinnDrum toms (sampled acoustic toms), in the snare's room.
 * Why: the fill into the next phrase is the live drummer's signature; the
 *   kick's gap leaves it room to be heard.
 */
const toms = s("<~!7 [~@12 ht:1 ht mt lt]>").bank("LinnDrum")
  .room(.3)
  .roomsize(4)
  .orbit(5)
  .gain(.7)

/**
 * Roll: the build, a real snare roll.
 * What: a 4-bar snare roll doubling every bar (4, 8, 16, 32 hits), swelling.
 * How: the acoustic snare, its level and highpass rising, in the snare's room.
 * Why: a drummer's roll, not a drum machine's: the build before the band
 *   comes crashing in.
 */
const roll = s("modern:12*<4 8 16 32>").bank("snare")
  .hpf(saw.slow(4).rangex(200, 1200))     // tighter as it speeds up
  .gain(saw.slow(4).range(.4, 1.4))       // crescendo (a soft recording)
  .room(.3)
  .roomsize(4)
  .orbit(5)

/**
 * Riser: the build, in timbre.
 * What: white noise through a bandpass climbing from 300 Hz to 9 kHz over 4
 *   bars, swelling from silence.
 * How: a continuous noise stream, the band centre and resonance rising.
 * Why: rising brightness is rising tension, under the roll.
 */
const riser = s("white*16")
  .sustain(1)
  .release(.03)
  .bpf(saw.slow(4).rangex(300, 9000))
  .bpq(saw.slow(4).range(.7, 5))
  .gain(saw.slow(4).range(0, .7))
  .orbit(3)

// ---------------------------------------------------------------- the riff

/**
 * Riff: the notes of the band, in two articulations, drop D.
 * What: a 4-bar metal riff. Each bar opens with a palm-muted gallop on the
 *   open low D (8th, 16th, 16th, twice), then answers with ringing power
 *   chords walking down: F-Eb-D, then Bb-A-Ab-G (chromatic), F-Eb-D again,
 *   and a turnaround on a held C, Eb and a 16th chug run back into the top.
 * How: two patterns on the same grid, one per articulation, so each can get
 *   its own guitar sound: `riffMute` (short, dark chugs) and `riffOpen` (held
 *   chords, the @-weights are how long each rings).
 * Why: the mute/open contrast is what makes a riff sound played rather than
 *   sequenced: the chugs are percussion, the open chords are the song. Every
 *   chord is a real drop-D shape (D2 is the open 6th string, Eb2 to Ab2 frets
 *   1-6, A2 to C3 on the A string); the Eb (flat 2nd) and Ab (tritone) are
 *   the two notes metal lives on.
 */
const riffMute = note(`<
  [d2 ~ d2 d2 d2 ~ d2 d2 ~ ~ ~ ~ ~ ~ ~ ~]
  [d2 ~ d2 d2 d2 ~ d2 d2 ~ ~ ~ ~ ~ ~ ~ ~]
  [d2 ~ d2 d2 d2 ~ d2 d2 ~ ~ ~ ~ ~ ~ ~ ~]
  [~ ~ ~ ~ ~ ~ d2 d2 ~ ~ ~ ~ d2 d2 d2 d2]
>`)
const riffOpen = note(`<
  [~@8 f2@2 eb2@2 d2@4]
  [~@8 bb2@2 a2@2 ab2@2 g2@2]
  [~@8 f2@2 eb2@2 d2@4]
  [c3@6 ~@2 eb2@4 ~@4]
>`)

// a downstroke: root, fifth, octave, each string a few ms after the last
const strum = x => stack(x, x.add(note(7)).late(.006), x.add(note(12)).late(.012))
// palm mutes only catch the two low strings
const strumMute = x => stack(x, x.add(note(7)).late(.004))

/**
 * Rhythm guitars: the band, double-tracked.
 * What: the riff on two guitars panned hard left and right, each one a
 *   different guitar and a slightly different player.
 * How: one take = the open chords on the GM distortion guitar, strummed and
 *   left to ring, plus the palm mutes on the GM muted guitar pushed through
 *   harder drive and a darker cab filter. Velocities wobble a little on every
 *   chug (no two picks are the same). The second take uses other fonts and
 *   plays 14 ms late. Both ducked by the kick (orbit 7).
 * Why: a muted guitar sample driven hard is a real palm mute: a tight, dark
 *   thud with a pick click, not a short note. Two different takes, hard
 *   panned, is the sound of every metal record; the centre stays free for the
 *   kick, bass and the lead.
 */
const openTake = (riff, font) => strum(riff).s("gm_distortion_guitar").n(font)
  .release(.12)               // chords ring to the end of their length, then let go
  .hpf(130)                   // a tight low end: the bass is under it, and hard-panned lows would make the sub wide
  .lpf(4500)                  // the cab: no fizz above
  .distort("3:.25")           // more gain than the soundfont; postgain sets the level
  .orbit(7)                   // ducked by the kick
  .gain(.16)
const muteTake = (riff, font, chug) => strumMute(riff).s("gm_electric_guitar_muted").n(font)
  .velocity(rand.range(.8, 1))  // every pick a bit different
  .decay(chug)                // the mute: the string is choked after this long
  .sustain(0)
  .hpf(120)                   // the thud's lows belong to the (centred) bass
  .lpf(2200)                  // a muted string has no top: dark thud and click
  .distort("5:.2")            // high gain, like the amp is cranked
  .orbit(7)
  .gain(.2)
// two players, hard left and right, the second a hair late on other guitars
// chug: how long a palm mute rings (short gallops in the riff, heavy chugs in the breakdown)
const band = (mute, open, chug = .12) => stack(
  openTake(open, 0).pan(.1),
  openTake(open, 2).late(.014).pan(.9),
  muteTake(mute, 0, chug).pan(.1),
  muteTake(mute, 3, chug).late(.014).pan(.9),
)
const guitars = band(riffMute, riffOpen)
// only the open chords, ringing: the intro, the guitarist alone
const guitarsOpen = band(silence, riffOpen)

/**
 * Bass: the bassist, an octave under the guitars.
 * What: every note of the riff on a picked electric bass, an octave below
 *   the guitars (D1 to C2): short on the gallops, held under the chords.
 * How: the GM pick bass, driven for the metal bass growl, highpassed so its
 *   lowest fundamentals (37-65 Hz) give way to the kick and rumble: the
 *   pitch comes through on the harmonics. Ducked by the kick (orbit 8).
 * Why: in a band the bass locks to the guitarist's right hand. The octave
 *   below is where a drop-D bassist plays, and it fills the gap between the
 *   rumble's sub and the guitars' 100 Hz highpass.
 */
const bassOf = (mute, open, chug = .15) => stack(
  mute.decay(chug).sustain(.2),         // the gallops: short, like the guitars' mutes
  open.release(.1),                     // the chords: held
).add(note(-12))
  .s("gm_electric_bass_pick")
  .hpf(60)                    // the sub belongs to the kick and rumble
  .lpf(2000)                  // the pick, no string rattle
  .distort("2.5:.4")          // the growl that makes the pitch heard above the sub
  .orbit(8)                   // ducked by the kick
  .gain(.5)
const bass = bassOf(riffMute, riffOpen)

/**
 * Breakdown: the mosh part, the band alone with the kick.
 * What: a 2-bar metal breakdown, half time. Chugs on the open D in a
 *   syncopated 3-3-4-2 pattern with silence between them, the second bar
 *   speeding into 8th chugs and a ringing Eb chord. The kick hits with
 *   every chug, a crash on each bar and on the Eb, the snare on beat 3.
 * How: the same guitars and bass as the riff (same tone), on new notes. The
 *   kick follows the guitar instead of the grid and doesn't duck it: in a
 *   breakdown the drummer and guitarist hit together.
 * Why: the breakdown is the moment the pit opens at a metal show. Silence
 *   between the hits is what makes them heavy; the kick in unison with the
 *   chugs turns each one into a wall.
 */
const breakMute = note(`<
  [d2 ~ ~ d2 ~ ~ d2 ~ ~ ~ d2 ~ d2 ~ ~ ~]
  [d2 ~ ~ d2 ~ ~ d2 ~ d2 ~ d2 ~ ~ ~ ~ ~]
>`)
const breakOpen = note("<~ [~@12 eb2@4]>")
const guitarsBreak = band(breakMute, breakOpen, .35)  // heavy chugs: the string rings longer
const bassBreak = bassOf(breakMute, breakOpen, .4)
const kickBreak = kick
  .struct("<[x ~ ~ x ~ ~ x ~ ~ ~ x ~ x ~ ~ ~] [x ~ ~ x ~ ~ x ~ x ~ x ~ x ~ ~ ~]>")
  .duckorbit(13)              // hits with the guitars, so it ducks an empty bus instead of them (duckdepth(0) breaks the engine)
const crashBreak = s("<[cr ~ ~ ~] [cr ~ ~ cr]>").bank("LinnDrum")
  .hpf(400)
  .room(.25)
  .roomsize(4)
  .orbit(5)
  .pan(.35)
  .gain(.15)                  // a crash every bar rings over everything: keep it behind the chugs

/**
 * Squeal: a pinch harmonic at the end of every 8-bar phrase.
 * What: a high, screaming D6 on the second half of the 8th bar, over the
 *   riff's held Eb chord, bending up and shaking.
 * How: the GM guitar harmonics font (a harmonic is a pure, glassy tone),
 *   driven hard so it screams, a slow bend up from a whole step below and a
 *   wide, fast vibrato, a room and an echo.
 * Why: the pinch squeal is the metal guitarist's signature, the sound of the
 *   pick catching the string. One per phrase marks the turnaround.
 */
const squeal = note("<~!7 [~@8 d6@8]>")
  .s("gm_guitar_harmonics")
  .penv(-2)                   // starts a whole step low...
  .pattack(.001)
  .pdecay(.3)                 // ...and bends up slowly: the squeal
  .vib(7)                     // wide and fast: the guitarist shaking it
  .vibmod(.5)
  .release(.2)
  .hpf(600)
  .lpf(6000)
  .distort("4:.15")           // screaming; postgain sets the level
  .delay(.3)
  .delaytime(bar * 3 / 16)
  .delayfeedback(.35)
  .room(.3)
  .roomsize(4)
  .orbit(9)                   // the lead's bus
  .pan(.6)
  .gain(.4)

/**
 * Feedback: the amp howling, intro and breakdown.
 * What: a held D (D4 and D5) swelling in over two bars and howling for four,
 *   with a slow wobble.
 * How: the GM overdriven guitar held for 4 bars, a 2-bar attack (the
 *   feedback building), a slow vibrato, drive, a big room. Its own bus.
 * Why: before the band kicks in, the guitarist holds the guitar to the amp.
 *   Nothing says "live band on stage" more than that.
 */
const feedback = note("[d4,d5]").slow(4)
  .s("gm_overdriven_guitar")
  .attack(bar * 2)            // builds over two bars
  .sustain(1)
  .release(bar)
  .vib(3)                     // a slow, wide howl
  .vibmod(.15)
  .hpf(300)
  .lpf(4000)
  .distort("3:.2")
  .room(.5)
  .roomsize(6)
  .orbit(6)                   // own bus
  .gain(.3)


// ---------------------------------------------------------------- the hook

/**
 * Hook: the song's melody, first sung by a synth, then by the lead guitar.
 * What: a 4-bar minor line: A-Bb-A falling to F, A-Bb-A climbing to C,
 *   A-Bb-A to F-G-F, then down to Eb and a long D.
 * How: the @-weights hold the long notes (6 and 10 16ths) so they can ring.
 * Why: opium hooks are a few notes repeated until they're a chant. The
 *   Bb-A half step is the sad, evil sigh at its centre, and the last bar
 *   falls through the phrygian Eb onto the open-string D the riff lives on.
 */
const hook = note(`<
  [a4@4 bb4@2 a4@2 f4@6 d4@2]
  [a4@4 bb4@2 a4@2 c5@6 bb4@2]
  [a4@4 bb4@2 a4@2 f4@4 g4@2 f4@2]
  [eb4@6 d4@10]
>`)
// bends, on the same weights as the hook: how far below each note the string starts
const hookBends = `<
  [-2@4 0@2 0@2 -1@6 0@2]
  [-2@4 0@2 0@2 -2@6 0@2]
  [-2@4 0@2 0@2 0@4 0@2 0@2]
  [-1@6 0@10]
>`

/**
 * Lead guitar: the hook, played by the band (the "narcissist version").
 * What: the hook in octaves (as written and an octave up) on an overdriven
 *   guitar, bending up into the long notes, with vibrato.
 * How: a pitch envelope on each note starts it a half or whole step low and
 *   pulls it up in ~120 ms: a string bend. A slow, shallow vibrato on
 *   everything (the held notes are where it's heard). Overdrive rather than
 *   high-gain distortion, so the lead sings instead of buzzing. A dotted-8th
 *   echo and a room, centred, ducked by the kick (orbit 9).
 * Why: when Carti's band played the songs, the guitarist took the synth
 *   melodies and played them in octaves over the riff. Octaves are the
 *   classic way to make a guitar lead huge without harmony fighting the
 *   rhythm guitars; bends and vibrato are what a synth can't fake.
 */
const leadGuitar = stack(hook, hook.add(note(12)).velocity(.8))
  .s("gm_overdriven_guitar")
  .penv(hookBends)
  .pattack(.001)
  .pdecay(.12)                // the bend takes ~120 ms
  .vib(5.5)                   // a guitarist's vibrato...
  .vibmod(.2)                 // ...a fifth of a semitone wide
  .release(.15)
  .hpf(250)                   // above the rhythm guitars' body
  .lpf(3500)                  // keeps the overdrive's fizz out of the presence range
  .distort("2:.25")           // a little drive on the overdrive: it sings, not buzzes; postgain sets the level
  .delay(.25)
  .delaytime(bar * 3 / 16)    // dotted 8th: the classic lead echo
  .delayfeedback(.3)
  .room(.3)
  .roomsize(4)
  .orbit(9)                   // ducked by the kick
  .gain(.22)

/**
 * Bell: the hook as the original song had it, an opium synth.
 * What: the hook an octave up (A5 to C6) on a glassy FM bell with a
 *   shimmering tremolo, in a big room.
 * How: a sine carrier with a modulator at 3x (odd harmonics: a hollow,
 *   square-ish bell), the FM index decaying so each note starts bright and
 *   settles. A fast, half-deep tremolo makes the held notes shimmer. Ducked
 *   by the kick (orbit 10).
 * Why: before the band covers it, the hook is heard the way a producer made
 *   it: an eerie, sweet, slightly broken synth floating in reverb, the Whole
 *   Lotta Red sound. Hearing it first is what makes the guitar version land.
 */
const bell = hook.add(note(12)).s("sine")
  .fm(3)                      // a bright attack...
  .fmh(3)                     // ...at 3x: odd harmonics, hollow
  .fmdecay(.25)
  .fmsustain(.3)              // ...settling into a softer tone
  .decay(.4)
  .sustain(.5)
  .release(.3)
  .tremolo(8)                 // the shimmer on the held notes
  .tremolodepth(.5)
  .hpf(400)
  .delay(.3)
  .delaytime(bar * 3 / 16)
  .delayfeedback(.35)
  .room(.55)
  .roomsize(7)                // floating
  .orbit(10)                  // ducked by the kick
  .gain(.35)
// build version: muffled, opening over 8 bars
const bellIn = bell.lpf(saw.slow(8).rangex(500, 8000))

/**
 * Barks: copied from "vamp mosh" (verbatim, E-based), transposed below.
 * Shouts at the end of every 2nd and 4th bar, formant-filtered saws with a
 * delay throw.
 */
const barks = note("<~ [~ ~ ~ e3] ~ [~ ~ b3 e3]>")
  .vowel("<a a a [o a]>")     // "what" / "yeah-what"
  .superimpose(x => x.add(note(-12)).velocity(.6))  // a deeper voice under it
  .s("supersaw")
  .unison(3)
  .detune(.2)
  .penv(4)                    // the yell: scoops up...
  .pattack(.04)
  .pdecay(.2)                 // ...and falls back
  .decay(.25)
  .sustain(0)
  .hpf(200)
  .distort("4:.2")            // shouted; postgain sets the level
  .delay(.4)                  // the delay throw
  .delaytime(bar * 3 / 16)
  .delayfeedback(.45)
  .room(.3)
  .roomsize(4)
  .orbit(11)                  // own bus: the throw isn't ducked
  .gain(.5)
// in this track's key: down a whole step, E/B to D/A
const barksD = barks.add(note(-2))

// ---------------------------------------------------------------- arrangement

// the drummer's count-in on the last bar of an 8- or 4-bar section
const countIn8 = sticks.mask("<0!7 1>")
const countIn4 = sticks.mask("<0!3 1>")
// the last chord: one D power chord on both guitars, the bass, a crash and a kick, left to ring
const lastChord = stack(
  band(silence, note("d2").slow(2)),
  bassOf(silence, note("d2").slow(2)),
  kick.struct("<x ~>").duckorbit(13),
  s("cr").bank("LinnDrum").mask("<1 0>").gain(.45),
)

arrange(
  // ---- intro (16): the guitarist alone with the amp howling, the count-in; then the band and the kick
  [8, stack(guitars, feedback, countIn8)],
  [8, stack(kickFill, rumble, guitars, bass, hats, crash, toms)],

  // ---- the song (16): the original trap version, the hook on the opium bell, the bass keeps the riff
  [16, stack(kickFill, rumble, bass, hats, ohats, snare, bell, barksD, crash, toms)],

  // ---- build (12): the guitars ring back in under the bell; then no kick, a roll, the count-in
  [8, stack(kickFill, rumble, bass, hats, snare, bell, guitarsOpen)],
  [4, stack(guitarsOpen, feedback, roll, riser, countIn4)],

  // ---- drop 1 (16): the narcissist version, the band takes the song: riff + the hook on lead guitar
  [16, stack(kickFill, rumble, guitars, bass, leadGuitar, squeal, hats, ohats, snare, barksD, crash, toms)],

  // ---- breakdown (8): the pit opens, kick and crash in unison with the chugs
  [8, stack(guitarsBreak, bassBreak, kickBreak, crashBreak, snareHalf)],

  // ---- bridge (12): the amp howls under the bell, no drums; then the roll and the count-in
  [8, stack(feedback, bell, bass)],
  [4, stack(guitarsOpen, feedback, roll, riser, countIn4)],

  // ---- drop 2 (16): everything, the lead guitar and the bell on the hook together
  [16, stack(kickFill, rumble, guitars, bass, leadGuitar, bell, squeal, hats, ohats, snare, barksD, crash, toms)],

  // ---- outro (18): the riff over the kick, then the band alone, then the last chord
  [8, stack(kickFill, rumble, guitars, bass, hats, crash, toms)],
  [8, stack(guitars, bass, feedback)],
  [2, lastChord],
).postgain(.48)  // master trim: headroom for the drops where the layers stack up
