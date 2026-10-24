// "industrial grind" - heavy industrial techno, 128 bpm, A minor / atonal
// built from the elements of metalgrind.strudel.js and dark.strudel.js:
//   distorted kick, metallic clang, noise bed, detuned saws, glitch stutters.
//
// structure (1 cycle = 1 bar = 4 beats, 256 bars, ~7:30):
//   0:00  intro      32 bars  noise bed + metallic hits, slowly forming
//   0:55  groove     32 bars  distorted kick and clanging percussion lock in
//   1:50  tension    32 bars  the grind motor starts, stutters appear
//   2:45  assault    32 bars  full chaos: all elements, max distortion
//   3:39  shutdown   32 bars  kick drops out, noise and metallic drones remain
//   4:34  reforge    64 bars  everything returns, heavier and wider
//   6:24  outro      32 bars  strip to a single grinding oscillator + noise

setcps(128/60/4)
const dotted8 = 60 / 128 * 3 / 4 // dotted-8th note in seconds, for delays


// ---------------------------------------------------------------- drums

/**
 * Kick: a distorted, punchy industrial kick.
 * What: a sample-based kick with heavy distortion and a midrange bark.
 * How: bitcrushed and overdriven, with a bandpass centered around 200 Hz
 *   to emphasise the "thunk" of a machine hitting metal. Short decay for
 *   tightness.
 * Why: industrial techno kicks are rarely clean. They sound like presses
 *   and hammers — distorted, mid-forward, and aggressive. The bandpass
 *   keeps it from turning into muddy low-end; the distortion gives it bite.
 */
const kick = s("bd:1*4").bank("RolandTR909")
  .speed(.8)                 // deeper and longer boom
  .lpf(2000)                  // roll off top, keep the mid-bark
  .hpf(40)                    // tighten sub, no rumble below kick fundamental
  .distort(5)                 // heavy drive: machines don't play clean
  .crush(7)                   // bit-crushed transient: metallic click
  .decay(0.12)                // short and punchy
  .gain(.8)                   // loud but leave room for the rumble

/**
 * Metallic clang: the machine hit.
 * What: a short, bright metallic resonance on the offbeat.
 * How: a filtered noise burst with a fast decay, pitched up an octave.
 * Why: it's the sound of metal being struck — sharp, bright, and harsh.
 */
const clang = s("[~ bd:1]*4").bank("RolandTR909")
  .lpf(6000)                  // very bright, no sub
  .hpf(saw.rangex(3000, 8000).slow(4)) // only the high end
  .gain(.5)

/**
 * Rumble: the low-end weight.
 * What: a reverb-drenched copy of the kick on the offbeat 8ths, filtered
 *   down to the sub range.
 * How: the kick sample between the kicks, sent into reverb, then everything
 *   above 80 Hz is cut and the rest is driven. It sits on orbit 2, so each
 *   kick ducks the reverb tail and it swells back in between them.
 * Why: the rumble is unpitched, so it adds weight without clashing with the
 *   drone and pad harmony. Kick on the beat and rumble off the beat
 *   interlock (complementary rhythm), and the sidechain turns the reverb
 *   tail into a pulse that breathes with the meter: the "pump" of industrial
 *   techno.
 */
const rumble = s("[~ bd:1]*4").bank("RolandTR909")
  .room(.5)                   // lots of reverb: the tail IS the rumble
  .lpf(80)                    // keep only the sub: no mud in the low mids
  .distort(2.5)               // drive thickens the filtered tail into a growl
  .orbit(2)                   // the bus the kick ducks: the tail pumps
  .gain(.03)                  // reverb + drive add a lot of level: start low

/**
 * Offbeat hats: the forward lean.
 * What: a closed hat on every "and" between kicks.
 * How: a rest then a hat, repeated 4 times per bar, bitcrushed for grit.
 * Why: accenting the upbeat creates syncopation against the kick: the ear
 *   hears tension on the "and" and resolution on the next downbeat, which
 *   is what makes a 4/4 groove feel like it's moving forward. The bitcrush
 *   adds industrial grit.
 */
const hats = s("[~ hh]*4").bank("RolandTR909")
  .n(1)                       // a slightly darker hat variant
  .crush(9)                   // 8-bit grit: industrial, not shiny
  .gain(.25)                  // sits under the kick and clap

/**
 * 16th hats: the motor.
 * What: hats on every 16th note, with a dynamic accent on the offbeat.
 * How: a 4-step gain pattern (soft, medium, LOUD, medium) per beat.
 * Why: constant 16ths set the smallest subdivision of the grid, and the
 *   accent on the 3rd 16th (the "and") keeps the offbeat feel of the plain
 *   hats while adding density for the busier sections.
 */
const hats16 = s("hh*16").bank("RolandTR909")
  .gain("[.1 .15 .3 .15]*4")  // accent the "and" of each beat
  .crush(6)                   // dirtier than the offbeat hats: it's background texture

/**
 * Clap: the backbeat.
 * What: a clap on beats 2 and 4, distorted and harsh.
 * How: heavily driven, with its own reverb bus.
 * Why: the backbeat splits each bar into two halves that call and answer
 *   (strong-weak-strong-weak). The reverb tail fills the space between
 *   the claps and gives the room a sense of depth.
 */
const clap = s("~ cp ~ cp").bank("RolandTR909")
  .distort(3)                 // heavy distortion for the industrial feel
  .room(.5)                   // medium reverb: places it further back than the kick
  .roomsize(4)                // a large room, for the dark, cavernous feel
  .orbit(5)                   // own bus, so its reverb doesn't smear other sounds
  .gain(.2)                   // under the kick, over the hats

/**
 * Crash: the phrase marker.
 * What: one crash on the first bar of every 16.
 * How: a mask with 16 values, only the first one on.
 * Why: marks the start of each 16-bar section (two 8-bar phrases), so
 *   new layers coming in feel announced instead of just appearing.
 */
const crash = s("cr").bank("RolandTR909")
  .mask("<1 0!15>")           // first bar of 16 only
  .room(.5)                   // long tail, like a cymbal ringing out in a hall
  .orbit(5)                   // shares the clap's reverb: same room
  .gain(.2)                   // a marker, not a feature

/**
 * Snare roll: rhythmic acceleration.
 * What: 4, then 8, 16 and 32 hits per bar over a 4-bar build.
 * How: one subdivision per bar, with a rising highpass and rising volume.
 * Why: doubling the subdivision every bar compresses time: the pulse feels
 *   like it's speeding up while the tempo stays fixed. That builds
 *   expectation, and the drop resolves it.
 */
const roll = s("sd*<4 8 16 32>").bank("RolandTR909")
  .crush(9)                   // grit to match the hats
  .hpf(saw.range(200, 2000).slow(4))   // thinner and brighter as it climbs
  .gain(saw.range(.1, .3).slow(4))     // crescendo across the 4 bars

/**
 * Riser: spectral build.
 * What: white noise sweeping upward over 4 bars.
 * How: noise in 16ths (filters update only at each note start), a highpass
 *   rising from 300 Hz to 9 kHz, and the volume swelling.
 * Why: rising pitch and brightness read as rising tension (like a pitch
 *   climbing to a climax), even from unpitched noise. It pairs with the
 *   roll: one builds in rhythm, the other in timbre.
 */
const riser = s("white*16")
  .hpf(saw.rangex(300, 9000).slow(4))   // the sweep: low end removed bit by bit
  .gain(saw.range(0, .2).slow(4))       // fades in from silence
  .orbit(3)                             // away from the drums' buses

// ---------------------------------------------------------------- synths

/**
 * Drone: the pedal point.
 * What: a low, held supersaw on A, moving up to B-flat every 4th bar.
 * How: detuned saws with a slow attack, and a lowpass slowly opening and
 *   closing over 16 bars.
 * Why: a pedal point holds the tonic underneath everything, which is the
 *   core of hypnotic music: the harmony barely moves, so the ear turns to
 *   texture and rhythm instead. The B-flat is the phrygian flat 2nd, a
 *   semitone of tension that resolves straight back to A. The detuned
 *   voices beat against each other, so even a static note shimmers.
 */
const drone = note("<a1 a1 a1 bb1>").s("supersaw")
  .unison(5)                               // 5 saws per note: thick
  .detune(.3)                              // detuned: the voices beat against each other, chorus-like
  .attack(.5)                              // fades in instead of starting abruptly
  .sustain(1)                              // holds at full level for the whole bar
  .release(1)                              // overlaps into the next bar: no gaps
  .lpf(sine.rangex(150, 900).slow(16))     // slow timbre movement keeps a static pitch alive
  .lpq(4)                                  // slight resonance: the sweep is audible
  .distort(1.5)                            // grit, so it reads as dark, not ambient
  .room(.7)                                // big reverb: background, not foreground
  .roomsize(6)                             // cavernous
  .orbit(3)                                // own reverb bus
  .gain(.12)                               // a bed, not a lead

/**
 * Pad: the harmony.
 * What: four chords, one per bar: Am - F - Dm - Bb (i - bVI - iv - bII).
 * How: wide detuned supersaws with slow attack and long release, so the
 *   chords blur into each other.
 * Why: every neighbouring pair of chords shares two notes (Am-F share A and
 *   C, F-Dm share F and A, Dm-Bb share D and F), so the voice leading is
 *   smooth and the progression feels like slow drifting rather than
 *   changing. The Bb major chord is the phrygian bII (related to the
 *   Neapolitan chord): its semitone pull down to Am at the loop point is
 *   the darkest cadence the mode offers.
 */
const pad = note("<[a2,c3,e3] [f2,a2,c3] [d3,f3,a3] [bb2,d3,f3]>").s("supersaw")
  .unison(5)                  // thick, string-machine-like
  .detune(.25)                // gentler than the drone: the chords need to stay in tune
  .spread(.8)                 // voices spread across stereo: a wide backdrop
  .attack(.8)                 // swells in, no transient
  .sustain(1)                 // holds for the whole bar
  .release(2)                 // rings into the next chord: the blur
  .lpf(1800)                  // dark: keeps the pad behind the lead
  .room(.7)                   // lots of reverb, far away
  .roomsize(6)                // same cavern as the drone
  .orbit(10)                  // own bus
  .gain(.06)                  // a bed under everything

/**
 * Bell: the ritual.
 * What: a metallic bell playing A, E, B-flat and C, one note per bar, in a
 *   tresillo rhythm.
 * How: FM synthesis: a sine modulated by another sine at 1.41x its pitch.
 *   3 hits spread over 8 steps (the euclidean rhythm x(3,8)), with a
 *   dotted-8th delay.
 * Why: real bells have inharmonic partials (overtones that aren't whole-
 *   number multiples of the root), and a non-integer FM ratio (1.41, about
 *   the square root of 2) produces exactly that. x(3,8) is the tresillo
 *   (3+3+2), a cell found from Afro-Cuban music to techno: it cuts across
 *   the 4/4 grid. The dotted-8th delay echoes at 3 16ths against the
 *   4-16th beat, a 3-against-4 cross-rhythm that makes the bell feel
 *   like it's floating.
 */
const bell = note("<a5 e5 bb4 c5>").s("sine")
  .struct("x(3,8)")           // tresillo: 3+3+2, syncopated against the kick
  .fm(4)                      // FM depth: more = more metallic overtones
  .fmh(1.41)                  // non-integer ratio = inharmonic partials = bell
  .decay(.3)                  // struck, then ringing out
  .sustain(0)                 // no hold: a strike, not a tone
  .delay(.5)                  // loud echoes: half the bell's character
  .delaytime(dotted8)         // 3-against-4 echo cross-rhythm
  .delayfeedback(.5)          // several repeats, fading
  .room(.5)                   // a church-sized space
  .roomsize(4)                // big, but smaller than the pad: keeps it clearer
  .orbit(9)                   // own bus
  .gain(.08)                  // bright, so it doesn't need much level

/**
 * Chant: the robotic voice.
 * What: a driven saw through a vowel filter, singing A, A, C, B-flat (one
 *   note per bar) in a 3-3-4 rhythm.
 * How: the vowel filter adds formants (the resonant peaks that make the
 *   difference between "o" and "a" in a voice), changing every bar.
 * Why: an ostinato (a short figure repeated unchanged) is the engine of
 *   hypnotic music: repeating it makes it feel inevitable and trance-like.
 *   The 3-3-4 grouping (16ths 0, 3, 6, 10) is a stretched tresillo, so it
 *   locks with the bell's rhythm. The dark vowels (o, u) have low
 *   formants, which sound like a low, chanting choir, and the bright "a"
 *   lands on the minor 3rd (C) for contrast.
 */
const chant = note("<a2 a2 c3 bb2>").s("sawtooth")
  .struct("x ~ ~ x ~ ~ x ~ ~ ~ x ~ ~ ~ ~ ~")  // 3-3-4: syncopated ostinato
  .vowel("<o u a u>")                         // formant per bar: mostly dark vowels
  .decay(.25)                                 // short syllables
  .sustain(.2)                                // a little hold: they sound sung, not plucked
  .distort(2.5)                               // the "robotic" grit
  .room(.4)                                   // set back in the space
  .roomsize(4)                                // matches the clap's room
  .orbit(11)                                  // own bus
  .gain(.08)                                  // a texture, under the lead

/**
 * Lead: the melody.
 * What: a sparse 2-bar phrase. Bar 1: A - C - B-flat. Bar 2: A - E - F - E.
 * How: a thin, driven supersaw with a dotted-8th delay. Notes fall on the
 *   offbeat 8ths, never on the kick.
 * Why: bar 1 circles the tonic with its minor 3rd and the phrygian flat 2nd
 *   (B-flat), a neighbour tone that sits a semitone above A and leans back
 *   down to it. Bar 2 is the answer (call and response): it reaches up to
 *   the 5th (E), then the minor 6th (F) sighs back down onto E. That
 *   semitone fall (an appoggiatura) is the most "sad" gesture in minor
 *   keys. Playing off the beat (syncopation) keeps it hypnotic instead of
 *   marching, and few notes leave room for the delay to fill.
 */
const lead = note(`
  [a4 ~ ~ ~ ~ ~ c5 ~ ~ ~ bb4 ~ ~ ~ ~ ~]
  [a4 ~ ~ ~ ~ ~ e5 ~ ~ ~ f5 ~ e5 ~ ~ ~]
>`).s("supersaw")
  .unison(3)                  // only 3 voices: thinner than the pad, so it stands out
  .detune(.15)                // slight detune: wide, but still clearly pitched
  .decay(.2)                  // a plucked attack...
  .sustain(.3)                // ...then a quieter hold: it speaks, then sits
  .release(.1)                // short tail: the delay does the sustaining
  .lpf(2500)                  // takes off the harsh top
  .lpq(6)                     // slight resonance: a vocal, nasal edge
  .distort(2)                 // dark grit to match the rest
  .delay(.35)                 // echoes fill the gaps in the sparse phrase
  .delaytime(dotted8)         // 3-against-4 echoes, like the bell
  .delayfeedback(.45)         // a few repeats
  .orbit(7)                   // own bus
  .gain(.06)                  // driven saws are loud: modest gain

/**
 * Lead, filtering in: the lead's entrance.
 * What: the lead, with its lowpass opening from 300 Hz to 2500 Hz over 16 bars.
 * How: overrides the lead's fixed cutoff with a rising exponential sweep.
 * Why: introducing the melody muffled and letting it brighten is a slow
 *   timbral crescendo. The listener hears the phrase before they consciously
 *   notice it, so by the time it's fully open it already feels familiar.
 */
const leadIn = lead
  .lpf(saw.rangex(300, 2500).slow(16))  // exponential: sounds even to the ear

/**
 * Lead in reverb: the breakdown version.
 * What: the lead drowned in a huge reverb.
 * How: a large reverb send on the lead's own bus.
 * Why: without the kick, the melody becomes the subject. Reverb turns
 *   the dry phrase into a distant, sustained memory of itself and fills
 *   the space the drums leave.
 */
const leadVerb = lead
  .room(.8)                   // mostly reverb
  .roomsize(6)                // the same cavern as the drone and pad

// ---------------------------------------------------------------- arrangement

arrange(
  // ---- intro (32): the drone as a pedal point, then the bell, then the chant
  [16, stack(drone, bell)],
  [16, stack(drone, bell, chant)],

  // ---- groove (32)
  [16, stack(kickFill, hats, drum, clap, chant, bell, crash)],
  [16, stack(kickFill, rumble, hats16, clap, chant, bell, crash)],

  // ---- tension (32): the grind motor starts, stutters appear
  [16, stack(kickFill, rumble, hats16, clap, chant, leadIn, crash)],
  [16, stack(kickFill, rumble, hats16, clap, chant, bell, lead)],

  // ---- assault (32): full chaos: all elements, max distortion
  [8, stack(drone, pad)],
  [8, stack(drone, pad, chant)],
  [12, stack(pad, bell, leadVerb)],
  [4, stack(pad, leadVerb, roll, riser)],

  // ---- shutdown (32): kick drops out, noise and metallic drones remain
  [8, stack(kickFill, rumble, hats16, clap, chant, bell, lead)],
  [8, stack(kickFill, rumble, hats16, clap, chant, lead, pad)],

  // ---- reforge (64): everything returns, heavier and wider
  [16, stack(kickFill, rumble, hats16, clap, chant, bell, lead, pad, crash)],
  [16, stack(kickFill, rumble, hats16, clap, chant, lead, pad, drone)],
  [16, stack(kickFill, rumble, hats16, clap, chant, bell, lead, pad, crash)],
  [16, stack(kickFill, hats, chant, bell, drone)],

  // ---- outro (32): strip back down to a single grinding oscillator + noise
  [16, stack(kickFill, hats, chant, bell, drone)],
  [16, stack(drone, bell)],
)
