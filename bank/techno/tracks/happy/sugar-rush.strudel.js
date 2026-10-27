// "sugar rush" - happy hardcore, 175 bpm, D major (D E F# G A B C#)
//
// pure sugar. a crunchy stomping kick and an offbeat saw bass bouncing under a
// rave piano, a chiptune arp glittering on top. two hooks over the pop anthem
// progression D A Bm G: a huge supersaw sing-along, then a thin, vibrato-ed
// pulse line standing in for a sped-up vocal. the breakdowns slow into the
// J-pop "royal road" (Gmaj7 A7 F#m7 Bm7) with a music box over soft pads.
// inspired by: S3RL, Tokyo Ghetto Pussy, vocaloid, nightcore edits
//
// structure (1 cycle = 1 bar = 4 beats, 128 bars, ~2:55):
//   0:00  intro        16 bars  kick and hats, then the bass bounce and the piano surfacing
//   0:21  breakdown 1  16 bars  no kick: royal road piano and pad, the music box verse, then a snare roll
//   0:43  drop 1       16 bars  hook A, the supersaw anthem
//   1:05  interlude     8 bars  the groove on the royal road, no lead
//   1:16  breakdown 2  16 bars  the drop chords ringing, hook B teased on the music box, then rising in
//   1:38  drop 2       16 bars  hook B, the vocaloid line
//   2:00  build         8 bars  kick out, hook A tears back in through a filter
//   2:11  last drop    16 bars  hook A again, the pad underneath
//   2:33  outro        16 bars  strip back down to kick and hats

setcps(175/60/4)
const bar = 4 * 60 / 175      // one bar in seconds (~1.37 s), for envelopes and delay times


// ---------------------------------------------------------------- drums

/**
 * Kick: the hardcore stomp.
 * What: a punchy 909 kick on every quarter, crunched with drive.
 * How: the hit pitched up a touch so it's tight at 175, driven for the
 *   hardcore crunch, its fizz rounded off. It ducks the bass and the synths.
 * Why: happy hardcore runs on a short, hard, slightly distorted kick: at
 *   175 a boomy tail would smear into the next beat and the offbeat bass.
 */
const kick = s("bd:2*4").bank("RolandTR909")
  .speed(1.05)                // a touch up: tighter at this tempo
  .distort("2:.5")            // the hardcore crunch; postgain gives the level back
  .lpf(6000)                  // keeps the crunch, loses the fizz
  .duckorbit("2:3")           // sidechain: ducks the bass (2) and the supersaws (3)
  .duckattack(.1)             // back up before the offbeat (an 8th is .17 s)
  .duckdepth(.85)
  .gain(.6)
// every 8th bar the last beat turns into a 16th stutter into the next phrase
const kickFill = kick.struct("<x*4!7 [x ~ ~ ~ x ~ ~ ~ x ~ x ~ x x x x]>")


/**
 * Hats: the 16th shimmer.
 * What: a closed 909 hat on every 16th, accented on the offbeat 8th.
 * How: a soft-soft-LOUD-soft gain cycle per beat, highpassed into the top.
 * Why: at 175 the 16ths blur into a bright, fizzy sheen over everything:
 *   the "sparkle" layer of the genre. The accent leans on the offbeat with
 *   the bass and the open hat.
 */
const hats = s("hh*16").bank("RolandTR909")
  .gain("[.16 .2 .4 .2]*4")   // accent on the "and"
  .hpf(7000)                  // the very top only
  .pan(.58)                   // a touch right; the open hat sits left

/**
 * Open hat: the offbeat "tss".
 * What: a short 909 open hat on every offbeat 8th, with the bass.
 * How: cut short so it stays a crisp hiss, highpassed, a touch left.
 * Why: the open hat is half of the offbeat bounce: bass for the body,
 *   hat for the snap. Short, so the 16ths still come through.
 */
const ohats = s("[~ oh]*4").bank("RolandTR909")
  .decay(.13)                 // a "tss", not a wash: gone before the next 16th accent
  .hpf(6000)
  .pan(.42)
  .gain(.32)

/**
 * Clap: the backbeat.
 * What: a 909 clap and a bright snare together on beats 2 and 4.
 * How: highpassed out of the kick and bass, in a short bright room.
 * Why: the snare gives the crack, the clap the width; a short room keeps
 *   it snappy at this tempo (a beat is only .34 s).
 */
const clap = s("~ [cp,sd:8] ~ [cp,sd:8]").bank("RolandTR909")
  .hpf(350)                   // out of the kick and bass
  .room(.25)
  .roomsize(2)                // short and bright: clears before the next beat
  .orbit(5)                   // own reverb bus
  .gain(.42)

/**
 * Crash: the phrase marker.
 * What: a 909 crash on the downbeat of every 8th bar.
 * How: highpassed, a bit left, let ring.
 * Why: happy hardcore is built in 8-bar phrases, and every one of them
 *   announces itself.
 */
const crash = s("cr").bank("RolandTR909").mask("<1 0!7>")
  .hpf(4000)                  // only the shimmer: the drop's downbeat is the kick's
  .pan(.4)
  .gain(.3)


// ---------------------------------------------------------------- bass

/**
 * Bass: the offbeat bounce.
 * What: a saw bass on every offbeat 8th, playing the chord roots, one chord
 *   a bar: D A Bm G (I V vi IV) in the drops, G A F#m Bm (IV V iii vi, the
 *   J-pop "royal road") in the breakdown.
 * How: a mono sawtooth with a lowpass that snaps open on each hit, cut short
 *   so it's gone before the next kick, and a little drive so it's heard
 *   on small speakers too. Its orbit (2) is ducked by the kick.
 * Why: kick on the beat, bass between: the oom-pah bounce that makes happy
 *   hardcore skip instead of stomp. The kick and bass never sound together,
 *   so both get the low end to themselves, and the duck pumps what's left.
 */
const bassLine = roots => note(roots).struct("[~ x]*4").s("sawtooth")
  .lpf(700)                   // resting cutoff: round, under the synths
  .lpenv(2.5)                 // opens on each hit: the "bwap"
  .lpdecay(.08)
  .lpsustain(0)
  .decay(.15)                 // short: the offbeat 8th is .17 s
  .sustain(0)
  .distort("1.5:.7")          // a little grit: harmonics that read on small speakers
  .orbit(2)                   // ducked by the kick
  .gain(.85)
const bass = bassLine("<d2 a1 b1 g1>")
const bassRoyal = bassLine("<g1 a1 f#1 b1>")


// ---------------------------------------------------------------- piano

/**
 * Piano: the rave piano, the genre's oldest hook.
 * What: acoustic piano chords in a bouncing 3-3-2-3-3-2 rhythm (steps 0, 3,
 *   6, 8, 11, 14), one chord a bar. In the drops: D A Bm G, voiced close
 *   around D4-D5 so the top note barely moves. In the breakdowns: the royal
 *   road with sevenths, Gmaj7 A7 F#m7 Bm7, the progression half of J-pop and
 *   vocaloid is built on.
 * How: a sampled grand, highpassed out of the bass, the notes cut after a
 *   few 16ths so the rhythm is heard, a medium bright room.
 * Why: 3-3-2 against the four-on-the-floor is the skip of happy hardcore:
 *   only the first hit lands with a kick. The royal road climbs IV-V and
 *   then sidesteps to iii-vi instead of resolving, which is the bittersweet,
 *   "sparkly but longing" sound of anime openings.
 */
const pianoLine = (chords, len) => note(chords)
  .struct("x ~ ~ x ~ ~ x ~ x ~ ~ x ~ ~ x ~")
  .s("piano")
  .decay(len)                 // how long each chord rings
  .sustain(0)
  .hpf(220)                   // out of the bass
  .room(.3)
  .roomsize(3)                // a medium bright room
  .orbit(4)                   // own reverb bus
  .gain(.6)
const chordsDrop = "<[d4,f#4,a4,d5] [c#4,e4,a4,c#5] [d4,f#4,b4,d5] [d4,g4,b4,d5]>"
const chordsRoyal = "<[d4,f#4,g4,b4] [c#4,e4,g4,a4] [c#4,e4,f#4,a4] [d4,f#4,a4,b4]>"
const piano = pianoLine(chordsDrop, .22)            // stabs: gone in under two 16ths
const pianoRoyal = pianoLine(chordsRoyal, .22)
const pianoRing = pianoLine(chordsDrop, .5)         // breakdowns: the chords ring into each other
const pianoRoyalRing = pianoLine(chordsRoyal, .5)
// intro version: the piano surfaces from behind a 400 Hz lowpass over 8 bars
const pianoIn = piano.lpf(saw.slow(8).rangex(400, 10000))


// ---------------------------------------------------------------- leads

/**
 * Hook A: the supersaw anthem, drop 1 and the last drop.
 * What: an 8-bar melody high up (B4-E6) over D A Bm G. Each bar opens with
 *   two dotted 8ths falling down the chord (A-F#-D, C#-E-A...), then runs
 *   8ths back up; the second 4 bars climb an octave higher at the same
 *   spots, peaking on E6 over A before sliding home to E5.
 * How: a 7-voice supersaw, wide but sweet detune, a fast attack and a
 *   held sustain so the notes sing into each other, a dotted-8th echo and
 *   a bright room. Its orbit (3) is ducked by the kick.
 * Why: the S3RL / nightcore lead: big, bright, sugary, an octave above
 *   everything else so it can't be missed. Dotted 8ths against the kick
 *   give the bounce; almost every long note is a chord tone, so it sounds
 *   like a sing-along, and the climb in bars 5-7 is the "hands up" moment.
 */
const leadA = note(`<
  [a5@3 f#5@3 d5@2 e5@2 f#5@2 e5@2 d5@2]
  [c#5@3 e5@3 a5@4 e5@2 c#5@2 e5@2]
  [d5@3 f#5@3 b5@2 a5@2 f#5@2 e5@2 d5@2]
  [e5@3 d5@3 b4@2 d5@2 e5@2 f#5@2 a5@2]
  [a5@3 f#5@3 d5@2 e5@2 f#5@2 a5@2 b5@2]
  [c#6@3 a5@3 e5@4 a5@2 c#6@2 e6@2]
  [d6@3 b5@3 f#5@2 a5@2 b5@2 a5@2 f#5@2]
  [g5@3 f#5@3 e5@4 d5@2 e5@4]
>`).s("supersaw")
  .unison(7)                  // a big stack of voices
  .detune(.3)                 // wide and shiny, still in tune
  .attack(.005)
  .decay(.3)
  .sustain(.6)                // the notes sing, not pluck
  .release(.08)
  .hpf(300)                   // leaves the low mids to the piano
  .lpf(7000)                  // bright, minus the harshest fizz
  .delay(.25)
  .delaytime(bar * 3 / 16)    // dotted 8th: echoes fill the gaps between phrases
  .delayfeedback(.3)
  .room(.3)
  .roomsize(4)
  .orbit(3)                   // ducked by the kick: the pump
  .gain(.5)                   // the loudest melodic part: it's the hook
// build version: the lowpass tears open from 300 Hz over 4 bars
const leadAIn = leadA.lpf(saw.slow(4).rangex(300, 7000))


/**
 * Hook B: the vocaloid line, drop 2.
 * What: a new 8-bar melody over the same D A Bm G, in the middle register
 *   (A4-D6) where a singer would be: quick two-16th pickups into repeated
 *   notes, like syllables of a lyric, and 8th-note runs. It ends hanging on
 *   C#6 over G (the bright, lydian #11) and settles on A5.
 * How: a pulse wave, narrow so it's nasal and voice-like, with a gentle
 *   vibrato on every note, a soft attack, held sustain, a dotted-8th echo
 *   and a room. Ducked by the kick with the other leads.
 * Why: a second drop needs a new hook, and a new timbre for it: where hook
 *   A is a wall of saws above everything, this is one thin, singing voice,
 *   the synth stand-in for a sped-up nightcore or vocaloid vocal. The
 *   repeated notes are what make it sound sung rather than played.
 */
const melodyB = `<
  [d5 e5 f#5@2 f#5@2 e5 f#5@2 a5@2 f#5 e5@2 d5@2]
  [c#5 d5 e5@2 e5@2 c#5 e5@2 a5@2 e5 c#5@2 a4@2]
  [b4 c#5 d5@2 d5@2 f#5@2 b5@2 a5@2 f#5@2 d5@2]
  [g5@2 f#5@2 e5@2 d5@2 b4@2 d5@2 e5@4]
  [d5 e5 f#5@2 f#5@2 e5 f#5@2 a5@2 b5 a5@2 f#5@2]
  [e5 f#5 e5@2 c#5@2 e5@2 a5@2 c#6@2 b5@2 a5@2]
  [b5@2 a5@2 f#5@2 d5@2 f#5@2 a5@2 b5@2 d6@2]
  [c#6@4 b5@2 a5@10]
>`
const leadB = note(melodyB).s("pulse")
  .pw(.2)                     // narrow pulse: thin and nasal, like a voice
  .vib(6)                     // a singer's vibrato rate...
  .vibmod(.15)                // ...and a gentle depth
  .attack(.01)                // soft onset, no click
  .decay(.15)
  .sustain(.7)
  .release(.08)
  .hpf(250)                   // out of the bass and the piano's body
  .lpf(4500)                  // keeps the pulse from buzzing
  .delay(.25)
  .delaytime(bar * 3 / 16)    // dotted 8th, like hook A
  .delayfeedback(.3)
  .room(.3)
  .roomsize(4)
  .orbit(3)                   // ducked by the kick
  .gain(.55)                  // one thin voice: it needs more level than the saw wall
const leadBIn = leadB.lpf(saw.slow(4).rangex(300, 4500))

/**
 * Arp: the chiptune sparkle.
 * What: a 16th-note square-wave arpeggio up in the 6th octave (G5-G6),
 *   bouncing on each chord's tones: a low-high-higher-high figure, one chord
 *   a bar, following the bass.
 * How: a square wave plucked very short, a little lowpass to take the
 *   edge off, a quick 16th echo and a slow autopan so it twinkles across
 *   the speakers.
 * Why: the video-game / vocaloid glitter: constant 16ths above the lead
 *   make the whole track feel faster and brighter without adding level.
 *   Each pluck is so short it reads as sparkle, not as a second melody
 *   fighting the hook.
 */
const arpLine = chords => note(chords).s("square")
  .decay(.06)                 // a blip
  .sustain(0)
  .lpf(5000)                  // the square's top harmonics get harsh up here
  .hpf(800)
  .delay(.3)
  .delaytime(bar / 16)        // a 16th echo: blurs the blips into a shimmer
  .delayfeedback(.25)
  .pan(sine.slow(8).range(.2, .8))  // twinkles side to side over 8 bars
  .orbit(6)                   // own bus: not ducked, it floats over the pump
  .gain(.24)                  // quiet: glitter, not a second hook
const arp = arpLine(`<
  [a5 d6 f#6 d6]*4
  [a5 c#6 e6 c#6]*4
  [b5 d6 f#6 d6]*4
  [b5 d6 g6 d6]*4
>`)
const arpRoyal = arpLine(`<
  [b5 d6 f#6 d6]*4
  [a5 c#6 g6 c#6]*4
  [a5 c#6 f#6 c#6]*4
  [[b5 d6 f#6 a6]*2 [b5 d6 f#6 d6]*2]
>`)


// ---------------------------------------------------------------- breakdown

/**
 * Pad: the breakdown's bed.
 * What: held supersaw chords, one a bar. Royal road sevenths in breakdown
 *   1 (Gmaj7 A7 F#m7 Bm7), the drop's D A Bm G in breakdown 2 and under
 *   the last drop, voiced low (F#3-G4) under the piano and the leads.
 * How: a soft supersaw with a slow attack and a long release so the chords
 *   blur, highpassed so it doesn't muddy the piano's low mids, a big room. Its own orbit, not
 *   ducked: in the last drop it's the only thing that doesn't pump.
 * Why: with the kick gone the breakdown needs something to float on. A
 *   saw pad (not a string patch) keeps the trance-y, synthetic shine of the
 *   genre, and the slow attack leaves the piano's hits on top.
 */
const padLine = chords => note(chords).s("supersaw")
  .unison(5)
  .detune(.2)                 // a gentle shimmer
  .attack(.4)                 // swells in under the piano's hits
  .sustain(1)
  .release(1)                 // chords blur into each other
  .hpf(300)                   // the piano holds the chords' body: the pad is only their shimmer
  .lpf(2500)                  // soft on top: the brightness belongs to the leads
  .room(.6)
  .roomsize(6)                // the biggest space in the track
  .orbit(7)                   // own bus, not ducked
  .gain(.2)
const padRoyal = padLine("<[g3,b3,d4,f#4] [a3,c#4,e4,g4] [f#3,a3,c#4,e4] [b3,d4,f#4,a4]>")
const pad = padLine("<[f#3,a3,d4] [e3,a3,c#4] [f#3,b3,d4] [g3,b3,d4]>")

/**
 * Music box: the breakdown melodies.
 * What: in breakdown 1, an 8-bar verse melody over the royal road, in long
 *   notes (B5 down to F#5, up to D6...); in breakdown 2, a preview of hook B.
 * How: the GM music box, in its natural high register, with a big room
 *   and a slow dotted-8th echo.
 * Why: the kawaii moment: a tinkly music box over soft chords is the
 *   anime-opening breakdown, and teasing hook B on it before the drop lets
 *   the drop land as "that tune, but huge".
 */
const boxLine = melody => note(melody).s("gm_music_box")
  .delay(.3)
  .delaytime(bar * 3 / 16)    // dotted 8th, like the leads
  .delayfeedback(.35)
  .room(.5)
  .roomsize(6)                // the pad's space
  .orbit(7)
  .gain(.55)
const boxVerse = boxLine(`<
  [b5@4 a5@2 b5@2 d6@4 f#5@4]
  [e5@4 g5@2 a5@2 c#6@4 a5@4]
  [a5@4 f#5@2 a5@2 c#6@4 e6@4]
  [d6@6 c#6@2 b5@4 a5@4]
  [b5@4 a5@2 b5@2 d6@4 f#5@4]
  [e5@4 g5@2 a5@2 c#6@4 a5@4]
  [a5@4 c#6@2 e6@2 f#6@4 e6@4]
  [d6@8 ~@8]
>`)
const boxB = boxLine(melodyB)



/**
 * Roll: the build, in rhythm.
 * What: a 4-bar snare roll that doubles every bar: 4, 8, 16, then 32 hits.
 * How: the clap's 909 snare, the highpass and the level both climbing over
 *   the 4 bars, in the clap's room.
 * Why: the snare roll into the drop is the most hardcore thing there is:
 *   more hits in the same time feels like speeding up at a fixed tempo.
 */
const roll = s("sd:8*<4 8 16 32>").bank("RolandTR909")
  .hpf(saw.slow(4).rangex(300, 3000))     // thinner and brighter as it climbs
  .gain(saw.slow(4).range(.12, .4))       // crescendo
  .room(.25)
  .roomsize(2)                            // the clap's room...
  .orbit(5)                               // ...on the clap's bus

/**
 * Riser: the build, in timbre.
 * What: white noise through a bandpass sweeping from 400 Hz to 12 kHz over
 *   4 bars, fading in from silence.
 * How: noise in 16ths held as one stream (filters update per note), band
 *   centre and resonance rising with a saw.
 * Why: the whoosh up into the drop: rising brightness reads as rising
 *   excitement, and it fills the top while the kick is out.
 */
const riser = s("white*16")
  .sustain(1)                             // one continuous stream...
  .release(.03)                           // ...no gaps
  .bpf(saw.slow(4).rangex(400, 12000))    // the climb
  .bpq(saw.slow(4).range(.7, 4))          // hiss to whistle
  .gain(saw.slow(4).range(0, .8))         // fades in
  .orbit(8)                               // own bus


// ---------------------------------------------------------------- arrangement

arrange(
  // ---- intro (16): kick and hats for the DJ, then the bounce and the piano surfacing
  [8, stack(kickFill, hats, crash)],
  [8, stack(kickFill, bass, hats, ohats, clap, crash, pianoIn)],

  // ---- breakdown 1 (16): no kick, the royal road on piano and pad, the music box verse
  [8, stack(pianoRoyalRing, padRoyal, boxVerse)],
  [4, stack(pianoRoyalRing, padRoyal, boxVerse, arpRoyal)],
  [4, stack(pianoRoyalRing, padRoyal, arpRoyal, roll, riser)],

  // ---- drop 1 (16): hook A, the supersaw anthem
  [16, stack(kickFill, bass, hats, ohats, clap, crash, piano, leadA, arp)],

  // ---- interlude (8): the groove on the royal road, no lead
  [8, stack(kickFill, bassRoyal, hats, ohats, clap, crash, pianoRoyal, arpRoyal)],

  // ---- breakdown 2 (16): the drop chords ringing, hook B teased on the music box, then on the pulse
  [8, stack(pianoRing, pad, boxB)],
  [4, stack(pianoRing, pad, boxB, arp)],
  [4, stack(pad, arp, leadBIn, roll, riser)],

  // ---- drop 2 (16): hook B, the vocaloid line
  [16, stack(kickFill, bass, hats, ohats, clap, crash, piano, leadB, arp)],

  // ---- build (8): the kick drops out, hook A tears back in
  [4, stack(pianoRing, pad, arp, leadAIn)],
  [4, stack(pad, leadAIn, roll, riser)],

  // ---- last drop (16): hook A again, the pad underneath
  [16, stack(kickFill, bass, hats, ohats, clap, crash, piano, pad, leadA, arp)],

  // ---- outro (16): strip back down to kick and hats
  [8, stack(kickFill, bass, hats, ohats, clap, crash, piano, arp)],
  [8, stack(kickFill, hats, crash)],
).postgain(.66)  // master trim (-3.6 dB): headroom for the drops where layers stack up
