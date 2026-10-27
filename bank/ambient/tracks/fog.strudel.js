// "fog" - dark ambient, 66 bpm, D minor
//
// silent hill 2-style ambient, played straight: no beat, no hook. a detuned drone
// breathes under radio static while a piano plays a lament that never resolves.
// the horror is the grief: a piano in an empty hall, metal somewhere far off,
// and a heartbeat that slowly gets ahead of the music.
//
// structure (1 cycle = 1 bar = 4 beats, 80 bars, ~4:50):
//   0:00  fog        8 bars  drone and radio static
//   0:29  lament    16 bars  the piano, and a bell across the lake
//   1:27  body      16 bars  bowed chords under the piano, distant metal
//   2:25  radio      8 bars  the piano stops, the static swells: something is near
//   2:54  heart     16 bars  the lament over a heartbeat that quickens halfway
//   3:52  aftermath  8 bars  the first half of the lament and the bell
//   4:21  fade       8 bars  drone and static

setcps(66/60/4)


// low D and A, a bare fifth, and D an octave up for a body small speakers can play.
// no third, so it's neither major nor minor, just hollow.
// one note every 4 bars, swelling in and dying out, so the drone breathes
const drone = note("[d1,a1,d2]").slow(4).s("supersaw")
  .unison(4).detune(.15)        // a few slightly detuned saws: a slow, sour beating, never quite still
  .spread(0)                    // all saws in the centre: a wide sub smears and cancels on mono speakers
  .attack(2).release(3)         // swells over 2 s, rings 3 s past the next swell: the gaps fill
  .lpf(sine.rangex(220, 500).slow(16))   // the filter drifts open and closed every 16 bars: the fog thickens and thins
  .gain(.5)

// radio static: pink noise in the AM band, chopped into 16ths whose level wanders,
// so it flutters and crackles like a pocket radio picking something up
const radio = s("pink*16")
  .bpf(perlin.rangex(1200, 3500).slow(8))   // a narrow band that drifts: a voice-like band, as if tuning past a station
  .bpq(1.5)                                 // narrow enough to sound like a speaker, not a hiss
  .attack(.01).release(.03)                 // soft edges on each 16th: flutter, not clicks
  .gain(perlin.range(0, 2).fast(3))         // the level wanders per 16th: fades, bursts, drops out. the band-pass leaves little energy, so the gain is high
  .hpf(900)                                 // nothing under the drone and the piano's left hand
  .pan(.6)                                  // a little off-centre: the radio is in your pocket, not the room

// the lament: 16 bars over Dm | Bb | Gm | A, two bars each, twice.
// the second time it slips onto an Eb (the flat second, sickly against D minor)
// and stops on the C#, the leading tone, so it never comes home to D
const pianoRight = note(`<
  [a4 ~ ~ ~] [~ ~ f4 e4] [d4 ~ ~ ~] [~ ~ ~ ~]  [bb4 ~ ~ a4] [g4 ~ ~ ~] [e4 ~ ~ ~] [~ ~ ~ ~]
  [a4 ~ ~ ~] [~ ~ f4 e4] [d4 ~ ~ f4] [eb4 ~ ~ ~] [d4 ~ ~ ~] [bb3 ~ ~ ~] [cs4 ~ ~ ~] [~ ~ ~ ~]
>`)
// open fifths in the left hand, one per chord, struck on its first bar
const pianoLeft = note("<[d3,a3] ~ [bb2,f3] ~ [g2,d3] ~ [a2,e3] ~>")
const piano = stack(pianoRight, pianoLeft).s("piano")
  .gain(perlin.range(.55, .8))  // uneven touch: a person playing, hesitating
  .lpf(2600)                    // softens the hammer: the piano is in another room
  .room(.6).roomsize(6)         // a big, empty hall: each note hangs well into the silence after it
  .delay(.15)                   // a faint echo, a memory of the note rather than a repeat
  .delaytime(60/66 * 3/4)       // a dotted 8th: echoes land off the beat, between the melody notes
  .delayfeedback(.3)            // two or three repeats, then gone
  .orbit(3)                     // own bus: the delay and reverb settings are per orbit

// the piano's chords, bowed, under the melody: Dm | Bbmaj7 | Gm(add9) | A, two bars each.
// the maj7 and the 9th are the piano's next notes, held: soft dissonances that ache
const pad = note("<[d3,f3,a3] [bb2,d3,f3,a3] [g2,bb2,d3,a3] [a2,cs3,e3]>").slow(2)
  .s("gm_pad_bowed")
  .attack(1.5).release(3)       // no audible start: each chord seeps in and bleeds into the next
  .lpf(1400)                    // below the piano's melody: the pad is the room, not a voice
  .room(.5)                     // the piano's hall, a little less: it sits behind
  .gain(.15)                    // well behind the piano: felt more than heard

// something metal, somewhere else in the building: three clangs every 8 bars,
// on 16ths no beat ever lands on, so you can't brace for them
const metal = s(`<
  [~ ~ ~ ~ ~ ~ ~ ~ ~ metal:2 ~ ~ ~ ~ ~ ~] ~ [~ ~ ~ ~ ~ metal:6 ~ ~ ~ ~ ~ ~ ~ ~ ~ ~] ~
  ~ [~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ metal:4 ~ ~] ~ ~
>`)
  .speed(.3)                    // ~21 semitones down: a girder, not a pan. slower playback also stretches the ring
  .hpf(120)                     // keeps the slowed-down rumble out of the drone
  .lpf(1800)                    // no bright edge: it's far away, through walls
  .pan("<.2 .8 .35>")           // each clang from a different place
  .room(.9).roomsize(8)         // a huge, wet space: most of what you hear is the echo
  .orbit(4)                     // own bus: a bigger room than the piano's
  .gain(.6)

// a church bell across the lake: one D toll every 8 bars, on the first beat
const bell = note("<d4 ~ ~ ~ ~ ~ ~ ~>").s("gm_tubular_bells")
  .lpf(2200)                    // the clang of the strike is dulled by distance; the hum stays
  .room(.9).roomsize(8)         // the metal's room: the same far-off space
  .orbit(4)
  .gain(1)                      // a short soundfont that measures quiet: at 1 it's still far off, but you hear it

// the static swells: something is near. same radio, a much hotter level
const radioNear = radio
  .gain(perlin.range(0, 5).fast(6))   // ~8 dB hotter and wandering twice as fast: it won't settle

// a heartbeat, not a kick: lub on the beat, dub a 16th later. 66 bpm, a resting heart
const heart = s("[bd bd ~ ~]*4")    // lub and dub a 16th (~.23 s) apart, like a real heartbeat
  .gain("[.22 .14 0 0]*4")      // the dub softer than the lub. low: it's felt under the drone, not played over it
  .speed(.85)                   // a little lower and rounder: a chest, not a drum
  .lpf(220)                     // the thump and a little body, so laptops hear it too; still no click
  .room(.3)                     // a little air, so it isn't stuck to your ear
// the heart quickens: five beats against the bar's four (~83 bpm), running ahead of the music
const heartFast = heart.fast(5/4)

arrange(
  // ---- fog (8): drone and static, nothing else
  [8, stack(drone, radio)],

  // ---- lament (16): the piano, a bell across the lake
  [16, stack(drone, radio, piano, bell)],

  // ---- body (16): the bowed chords under it, metal somewhere in the building
  [16, stack(drone, radio, piano, pad, metal)],

  // ---- radio (8): the piano stops, the static swells: something is near
  [8, stack(drone, radioNear, pad, metal)],

  // ---- heart (16): the lament returns over a heartbeat that slowly runs ahead of it
  [8, stack(drone, radio, piano, pad, metal, heart)],
  [8, stack(drone, radio, piano, pad, metal, heartFast)],

  // ---- aftermath (8): the first half of the lament alone, and the bell
  [8, stack(drone, radio, piano, bell)],

  // ---- fade (8): back into the fog
  [8, stack(drone, radio)],
)
