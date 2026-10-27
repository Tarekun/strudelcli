// "letter" - melancholic trip-hop, 80 bpm, D minor (harmonic: the A7 pulls home)
//
// a radio left between stations, a mandolin-style tremolo guitar going round
// one 4-bar loop (Dm | Bbmaj7 | Gm7 | A7), a dusty, limping break and a
// fretless bass. in the chorus a wordless voice sings over it; in the break
// a music box plays her tune back after she's gone. the tune always ends
// hanging on the A7, so nothing ever resolves: the loop just starts again.
//
// structure (1 cycle = 1 bar = 4 beats, 108 bars, ~5:24):
//   0:00  intro     12 bars  radio hiss, then the guitar, then bass and strings
//   0:36  verse     16 bars  the break comes in, strings halfway; no drums on the last bar
//   1:24  chorus    16 bars  the voice, twice through the tune
//   2:12  break     16 bars  no drums: the music box alone, then guitar and bass return
//   3:00  verse 2   16 bars  kick and hats only, then snare and strings; no drums on the last bar
//   3:48  chorus 2  16 bars  the voice, with a choir answering under it
//   4:36  outro     16 bars  no drums, the choir stays, then the music box, then only the radio

setcps(80/60/4)


// ---------------------------------------------------------------- the room

// radio hiss: pink noise squeezed through a narrow band, like a set left
// between stations. it never stops: the letter is read over it
const hiss = s("pink")
  .bpf(2200).bpq(1.5)           // a telephone-ish band: no lows, no air, just the "shhh"
  .tremolo(.13).tremolodepth(.4) // drifts in and out over ~8 s, a weak signal
  .gain(.7)                     // ~15 dB under the guitar: always there, never in front

// crackle: sparse dust clicks on top of the hiss
const crackle = s("crackle")
  .density(.03)                 // a few pops per second, not rain
  .hpf(1500)                    // clicks only, nothing in the music's body
  .gain(1)                      // very spiky (38 dB crest): the pops peak near the guitar, the average stays low


// ---------------------------------------------------------------- drums

// a slow, dusty break: kick on 1, the "a" of 2 and the "and" of 3, the
// lazy trip-hop limp. it never plays on beat 3, so the bar sags in the middle
const kick = s("bd").bank("AkaiMPC60")
  .struct("x ~ ~ ~ ~ ~ ~ x ~ ~ x ~ ~ ~ ~ ~")
  .lpf(2000)                    // takes the beater click off: a thud through a wall
  .gain(.8)

// snare on 2 and 4, bitcrushed and thrown into a big room, so the backbeat
// rings out like a door slamming in an empty corridor
const snare = s("sd:1").bank("AkaiMPC60")
  .struct("~ x ~ x")
  .crush(7)                     // grit and dust: an old sampler, not a clean drum
  .lpf(5000)                    // the crush's fizz rolled off, keeping the crack
  .room(.6).roomsize(5)         // a long, dark tail: the hit is the drum, the tail is the house
  .orbit(2)                     // its own reverb bus, bigger than the guitar's
  .gain(.65)                    // the backbeat should be heard: the tail sits ~7 dB under the kick

// hats in swung 8ths, the offbeats ghosted: barely there, a clock in another room
const hats = s("hh*8").bank("AkaiMPC60")
  .velocity("[.8 .4]*4")        // on-beat ticks, ghost offbeats
  .swingBy(1/3, 4)              // offbeats late by a third: the triplet shuffle of the break
  .hpf(6000)                    // only the tick: above the voice and the guitar
  .gain(.35)

// ---------------------------------------------------------------- harmony

// the whole track turns on one 4-bar loop: Dm | Bbmaj7 | Gm7 | A7.
// a, d and f hang on through the first three chords while the bass moves
// under them, so the same notes keep changing meaning: hypnotic, not static

// tremolo guitar: Yamaoka's mandolin, a steel string picked in 32nds on
// one note per beat. each bar climbs the chord and turns back on beat 4;
// the A7 bar lifts to c#, the leading tone that drags the loop back to Dm
const mandolin = note(`<
  [a3 d4 f4 e4] [a3 d4 f4 d4] [bb3 d4 f4 g4] [a3 c#4 e4 g4]
>`).ply(8)                      // 8 picks per beat: ~11 a second, a mandolin tremolo
  .s("gm_acoustic_guitar_steel")
  .velocity("[1 .55 .75 .55]*8") // down-up picking: the downstroke on each 8th lands harder
  .clip(1)                      // each pick stops the last one, as on a real string
  .hpf(180)                     // under the lowest note (a3, 220 Hz): the body boom is the bass's
  .lpf(3500)                    // takes the pick's brittle top off: a worn, distant string
  .pan(.4)                      // a step left, leaving the right for the voice
  .room(.4).roomsize(3)         // a medium hall: the guitar is in the room, not in your ear
  .gain(.8)                     // the verse's lead: over the strings, under the voice

// strings: the loop as held chords, low and dark, swelling under the guitar.
// d and a stay put across three bars, only the top voice moves (f - f - f - e)
// and the A7 bar slips the whole chord down a step: a sigh, then home
const chords = `<
  [d3,a3,f4] [d3,a3,f4] [d3,bb3,f4] [c#3,g3,e4]
>`
const strings = note(chords).s("gm_string_ensemble_1")
  .attack(.8).release(1.5)      // slow bow in, long tail into the next chord: no edges
  .lpf(1400)                    // muffled, like it's coming through the floor: under the voice
  .room(.5).roomsize(5).orbit(2) // the snare's big room: everything sad lives in the same house
  .gain(.3)                     // a step under the guitar: the bed, not the song

// fretless bass: the root held through the bar, then a step to the fifth
// on the "and" of 3, with the kick. the A7 bar walks e - c# up into the
// next Dm. the slide of a fretless is the sound of something sinking
const bass = note(`<
  [d2@10 a1@6] [bb1@10 f1@6] [g1@10 d2@6] [a1@10 e2@4 c#2@2]
>`).s("gm_fretless_bass")
  .clip(.95)                    // a breath between notes, so each one speaks
  .lpf(900)                     // round: the body and the growl of the string, no finger click
  .gain(.6)                     // under the kick's thump, still the floor of the loop


// ---------------------------------------------------------------- melody

// the chorus tune, wordless, in 8ths over two passes of the loop. it climbs
// from a to f and sinks back the first time; the second time it reaches the
// high a and falls the whole way down, and it ends hanging on c# over A7,
// never resolved: the loop has to start again to bring it home
const tune = `<
  [a4@2 d5@2 f5@3 e5]   [d5@6 c5 bb4]   [d5@2 c5@2 bb4@2 a4 bb4]   [a4@6 ~ ~]
  [a4@2 d5@2 f5@2 a5@2] [g5@3 f5 d5@4]  [f5@2 e5@2 d5@2 bb4@2]     [e5@2 c#5@6]
>`

// the voice: an "ooh" over everything, the one human thing in the track
const voice = note(tune).s("gm_voice_oohs")
  .attack(.08).release(.8)      // soft onsets, each note dissolving into the next
  .vib(4).vibmod(.1)            // a slight, tired waver: a person, not a synth
  .pan(.6)                      // a step right, opposite the guitar
  .room(.6).roomsize(6).orbit(3) // the biggest room: a voice from far away
  .delay(.2).delaytime(60/80 * 3/4).delayfeedback(.3) // a faint dotted-8th echo behind each note
  .gain(.55)                    // ~4 dB over the guitar: on top, not shouting

// the break: the same tune an octave up on a music box, a child's toy
// playing the song back after the voice is gone. the long notes become
// single plinks, so the line comes out broken, with holes in it
const musicBox = note(tune).transpose(12).s("gm_music_box")
  .pan(.55)
  .room(.6).roomsize(6).orbit(3) // the voice's room: it plays in the space she left
  .delay(.2).delaytime(60/80 * 3/4).delayfeedback(.3) // the voice's echo, same orbit
  .gain(.9)                     // the break's lead: a few dB over the strings

// last chorus: a choir answers under the voice, one long note a bar,
// moving by step (f f d e | a g f e). the g over Bbmaj7 and the e under
// the voice's hanging c# make the A7 bar ache a little more
const choir = note("<f4 f4 d4 e4 a4 g4 f4 e4>").s("gm_choir_aahs")
  .attack(.5).release(1.2)      // the choir breathes in and fades, no consonants
  .lpf(2500)                    // soft and distant: under the voice's "ooh"
  .pan(.4)                      // the guitar's side, so the two voices spread
  .room(.6).roomsize(6).orbit(3)
  .gain(.55)                    // ~6 dB under the voice: an answer, not a duet


// ---------------------------------------------------------------- arrangement

// the drums hold their breath on the last bar before each chorus
const kickHold = kick.mask("<1!7 0>")
const snareHold = snare.mask("<1!7 0>")

arrange(
  // the radio, then the guitar, then the house around it
  // ---- intro (12)
  [4, stack(hiss, crackle)],
  [4, stack(hiss, crackle, mandolin)],
  [4, stack(hiss, crackle, mandolin, bass, strings)],

  // the break comes in, the strings join halfway, the drums stop on the last bar
  // ---- verse (16)
  [8, stack(hiss, crackle, mandolin, bass, kick, snare, hats)],
  [8, stack(hiss, crackle, mandolin, bass, kickHold, snareHold, hats, strings)],

  // the voice, twice through the tune
  // ---- chorus (16)
  [16, stack(hiss, crackle, mandolin, bass, kick, snare, hats, strings, voice)],

  // no drums: the music box plays the tune back alone, then the guitar and bass return under it
  // ---- break (16)
  [8, stack(hiss, crackle, strings, musicBox)],
  [8, stack(hiss, crackle, strings, musicBox, mandolin, bass)],

  // kick and hats only at first, then the snare and the strings
  // ---- verse 2 (16)
  [8, stack(hiss, crackle, mandolin, bass, kick, hats)],
  [8, stack(hiss, crackle, mandolin, bass, kickHold, snareHold, hats, strings)],

  // the voice with the choir answering
  // ---- chorus 2 (16)
  [16, stack(hiss, crackle, mandolin, bass, kick, snare, hats, strings, voice, choir)],

  // the drums stop, the choir stays, then only the toy and the radio are left
  // ---- outro (16)
  [8, stack(hiss, crackle, mandolin, bass, strings, choir)],
  [4, stack(hiss, crackle, mandolin, musicBox)],
  [4, stack(hiss, crackle)],
).postgain(.75) // master trim (-2.5 dB): the kick and snare peaks clipped in the choruses
