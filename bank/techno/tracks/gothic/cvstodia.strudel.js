// "cvstodia" - hard techno, 150 bpm, E phrygian dominant (E F G# A B C D)
//
// a hard techno procession through the world of Blasphemous (Carlos Viola's
// score): a flamenco guitar strumming the Andalusian cadence (Am G F E) and
// picking a falseta down it, palmas in the 12-beat compás against the kick's
// four, and the church around it: a chant sung in organum, a choir, an organ,
// the bells, a saeta on a lone trumpet.

setcps(150/60/4)
const bar = 4 * 60 / 150      // one bar in seconds (1.6 s), for envelopes and delay times


// ---------------------------------------------------------------- drums

/**
 * Kick: the floor, clean and deep.
 * What: a tuned synth sub on E1 (the root) plus a 909 knock, on every quarter.
 * How: the `sbd` synth dives two octaves onto E1; the 909 hit with its low end
 *   cut adds only the attack. The sub ducks the rumble (2), the guitar (7),
 *   the falseta (8) and the organ stabs (9).
 * Why: hard techno lives on the kick; tuned to E it locks with the rumble and
 *   the cadence's last chord. Clean: the grit is in the rumble.
 */
const kickSub = s("sbd*4").note("e1")
  .penv(24)                   // starts 2 octaves up...
  .pdecay(.045)               // ...and dives onto E1: the punch
  .decay(.42)
  .lpf(4000)                  // a soft click
  .duckorbit("2:7:8:9")       // sidechain: rumble, guitar, falseta, organ stabs
  .duckattack(.12)
  .duckdepth(.8)
  .gain(.5)                   // the loudest thing in the track
const kickKnock = s("bd:1*4").bank("RolandTR909")
  .hpf(150)                   // no low end: only the knock
  .lpf(5000)
  .gain(.65)
const kick = stack(kickSub, kickKnock)
// every 8th bar the last beat drops out: room for a timpani hit into the next phrase
const kickFill = kick.struct("<x*4!7 [x ~ ~ ~ x ~ ~ ~ x ~ ~ ~ ~ ~ ~ ~]>")

/**
 * Rumble: the hard techno low end.
 * What: soft E1 hits on the three 16ths after every beat, lowpassed to the
 *   sub and its first harmonics, driven into a growl.
 * How: the kick's synth with barely any pitch dive, swelling toward the
 *   next kick, then a lowpass and drive. Orbit 2: ducked by the kick.
 * Why: the rolling, pumping sub between kicks is the engine of hard techno.
 *   It holds E under the whole cadence: the pedal tone flamenco and organ
 *   music both lean on.
 */
const rumble = s("sbd").note("e1")
  .struct("[~ x x x]*4")
  .velocity("[0 .6 1 .75]*4") // swells into the next kick
  .penv(3)                    // a hum, not a hit
  .pdecay(.03)
  .decay(.25)
  .lpf(200)                   // the sub and its first harmonics
  .distort("4:.2")            // the growl; postgain sets the level
  .orbit(2)                   // ducked by the kick
  .gain(.2)

/**
 * Hats: the 16th motor.
 * What: a 909 closed hat on every 16th, accented on the offbeat 8th.
 * How: crushed for grit, highpassed into the top octave, a touch right.
 * Why: at 150 the 16ths are what make it run.
 */
const hats = s("hh*16").bank("RolandTR909")
  .gain("[.1 .14 .28 .14]*4") // ghost, soft, accent on the "and", soft
  .crush(7)
  .hpf(6000)
  .pan(.58)

/**
 * Open hats: the piston, in the drops.
 * What: a short 909 open hat on every offbeat 8th.
 * How: cut short, lightly crushed, highpassed, a touch left.
 * Why: kick on the beat, hiss between: the oldest drive in techno.
 */
const ohats = s("[~ oh]*4").bank("RolandTR909")
  .decay(.14)
  .crush(8)
  .hpf(7000)
  .pan(.42)
  .gain(.15)                  // under the closed hats' accents

/**
 * Clap: the backbeat, by hand.
 * What: real hand claps layered with a snare on beats 2 and 4.
 * How: two different hand-clap takes (a crowd of hands, like the palmas)
 *   and a snare for the crack, highpassed, a big room with a dark tail.
 * Why: the same hands that play the palmas mark the backbeat, so the
 *   flamenco and the techno share one pair of hands.
 */
const clap = stack(
  s("~ clap:2 ~ clap:5"),
  s("~ clap:7 ~ clap:3").late(.004),    // a hair late: a looser, wider clap
  s("~ modern:20 ~ modern:20").bank("snare").gain(.6),  // the crack
)
  .decay(.22)                 // the room supplies the tail
  .sustain(0)
  .hpf(300)
  .distort("1.2:.6")
  .room(.4)
  .roomsize(5)                // a church nave
  .roomlp(4000)
  .orbit(5)
  .gain(.35)


/**
 * Palmas: the flamenco compás, against the kick.
 * What: 12 claps per bar (8th-note triplets) counting the 12-beat bulería
 *   compás: sharp claps (claras) on 3, 6, 8, 10 and 12, soft muffled ones
 *   (palmas sordas) in between.
 * How: the claras are a bright hand-clap take, the sordas a different take
 *   lowpassed and much softer (cupped hands). Panned left, a small room.
 * Why: the 12 crosses the kick's 4: the accents fall on and off the beat in a
 *   pattern that only lines up again every bar, the flamenco swing riding a
 *   straight techno grid. Real hands, so no two claps are the same.
 */
const claras = s("clap:4*12").struct("~ ~ x ~ ~ x ~ x ~ x ~ x")
  .hpf(900)                   // sharp: the fingers on the palm
  .gain(.35)
const sordas = s("clap:1*12").struct("x x ~ x x ~ x ~ x ~ x ~")
  .lpf(1500)                  // cupped hands: a dull pat
  .gain(.17)
const palmas = stack(claras, sordas)
  .room(.2)
  .roomsize(2)
  .orbit(4)
  .pan(.3)


// ---------------------------------------------------------------- the guitar

/**
 * Cadence: the Andalusian cadence, as a guitarist fingers it.
 * What: Am, G, F, E, one bar each, falling to the E major that is "home" in
 *   flamenco (E phrygian dominant: the G# makes the E chord major).
 * How: one list of notes per chord, lowest string first, in open-position
 *   voicings a flamenco player uses: the F keeps the open high E (Fmaj7), the
 *   E is the open E chord. Each string becomes its own pattern so a strum can
 *   reach them one after another.
 * Why: Am-G-F-E is the sound of Spain, and of Blasphemous: every bar steps
 *   down, and the half step F to E at the end lands with the weight of a
 *   procession setting down its float.
 */
// single quotes: plain strings (Strudel reads double-quoted strings as patterns)
const voicings = [
  ['a2', 'e3', 'a3', 'c4', 'e4'],         // Am
  ['g2', 'b2', 'd3', 'g3', 'b3', 'g4'],   // G
  ['f2', 'c3', 'f3', 'a3', 'c4', 'e4'],   // Fmaj7, open high E
  ['e2', 'b2', 'e3', 'g#3', 'b3', 'e4'],  // E, open
]
// string i (0 = lowest) across the 4 bars; a chord without that string rests
const cadenceString = i => note('<' + voicings.map(v => v[i] ?? '~').join(' ') + '>')
// a down-strum: each string 7 ms after the one below it
const strum = rhythm => stack(...[0, 1, 2, 3, 4, 5].map(i => cadenceString(i).struct(rhythm).late(i * .007)))

/**
 * Rasgueado: the guitar backbone, strumming the cadence.
 * What: a nylon-string guitar on a flamenco-rumba pattern (3-3-2: strokes on
 *   steps 0, 3, 6, 8, 11), and a four-stroke rasgueado burst on the last 8th
 *   of every bar, rolling into the next chord.
 * How: the GM nylon guitar, every stroke a real down-strum across the
 *   strings. Accents on the downbeat and beat 3, the burst crescendoing. A
 *   little drive and a highpass so it holds its own over the kick; ducked
 *   (orbit 7), so the strums pump.
 * Why: rasgueado (the fingers flicking out one after another) is the most
 *   flamenco sound a guitar makes, and rumba strumming is flamenco's 4/4: it
 *   sits on a techno grid without being forced. The burst at the end of each
 *   bar is the turn into the next chord, like a fill.
 */
const rasgueado = strum("x ~ ~ x ~ ~ x ~ x ~ ~ x ~ ~ [x x x x]@2")
  .velocity("1 ~ ~ .7 ~ ~ .75 ~ .95 ~ ~ .7 ~ ~ [.5 .6 .75 .9]@2")
  .s("gm_acoustic_guitar_nylon")
  .release(.1)
  .hpf(180)                   // thin the boomy body: the kick and rumble own the low end, the strings speak above
  .lpf(7000)
  .distort("1.3:.75")         // a touch of bite to stand up in a techno mix
  .room(.25)
  .roomsize(3)
  .orbit(7)                   // ducked by the kick
  .pan(.45)
  .gain(.3)

/**
 * Falseta: the hook, picked.
 * What: a 4-bar picado line that walks down the cadence in sequence: the
 *   same figure (a step up, then a run down) starting on E5 over Am, D5 over
 *   G, C5 over F; over the E chord it trills F-E (the flamenco half step),
 *   climbs through the G# and runs back down onto E.
 * How: single notes on the nylon guitar, accented on the first note of each
 *   figure, a little drive for the attack, a dotted-8th echo and a room so
 *   the runs hang in the church. Ducked by the kick (orbit 8).
 * Why: a falseta is the flamenco guitarist's melody, and a sequence falling
 *   down Am-G-F-E is the most Spanish line there is. The F-G# step in the
 *   last bar (an augmented second) is phrygian dominant's signature: the
 *   Moorish sound under every Blasphemous track.
 */
const falseta = note(`<
  [e5 ~ f5 e5 d5 ~ c5 d5 c5 b4 c5 ~ a4 ~ ~ ~]
  [d5 ~ e5 d5 c5 ~ b4 c5 b4 a4 b4 ~ g4 ~ ~ ~]
  [c5 ~ d5 c5 b4 ~ a4 b4 a4 g4 a4 ~ f4 ~ ~ ~]
  [f4 e4 f4 e4 ~ g#4 a4 b4 c5 ~ b4 ~ g#4 f4 e4 ~]
>`).s("gm_acoustic_guitar_nylon")
  .velocity("[1 ~ .7 .8 .75 ~ .85 .7 .8 .7 .8 ~ .9 ~ ~ ~]")  // the first note of each figure leads
  .release(.15)
  .hpf(250)
  .lpf(8000)
  .distort("1.3:.75")         // the attack of the nails, a bit harder
  .delay(.25)
  .delaytime(bar * 3 / 16)
  .delayfeedback(.3)
  .room(.35)
  .roomsize(5)
  .orbit(8)                   // ducked by the kick
  .pan(.55)
  .gain(.5)
// build version: muffled behind the church doors, opening over 8 bars
const falsetaIn = falseta.lpf(saw.slow(8).rangex(400, 8000))

/**
 * Laúd: the second chorus's hook, a tremolo melody.
 * What: an 8-bar song over two rounds of the cadence (E4 down to G#3, then
 *   climbing to G4 and settling back on E4), every note played in tremolo:
 *   picked again and again in 16th-note triplets.
 * How: there's no laúd in the library, so it's built: a steel-string guitar
 *   (the laúd has metal strings, played with a pick) in the laúd's register,
 *   an octave below a bandurria. `segment(24)` cuts each held note into 24
 *   picks a bar. Each pick is short and fades like a plucked string, with
 *   uneven strength (down-strokes harder, no two alike). Every note is doubled
 *   4 cents sharp and a few ms late: the two strings of a paired course,
 *   almost in tune. Rolled off above 5 kHz and kept in a small wooden room,
 *   no echo: an acoustic instrument in a room, not a studio effect. Ducked by
 *   the kick (orbit 8, the falseta's bus: they never play together).
 * Why: the trembling, metallic plucked melody of Spanish folk music (the laúd
 *   of the rondallas), the sound of the Blasphemous score's quieter moments.
 *   Tremolo turns a plucked string into a singing line, so a slow melody can
 *   float over the techno while the picking keeps the palmas' triplet motor.
 */
const laudSong = note(`<
  [e4@2 f4 e4] [d4@3 b3] [c4@2 d4 c4] [b3@3 g#3]
  [a3 c4 e4 a4] [g4@2 f4 e4] [f4@2 e4 d4] [e4@4]
>`).segment(24)               // tremolo: 6 picks a beat
  .velocity("[1 .7 .9 .66 .95 .74 .85 .7 1 .64 .9 .72]*2")  // down harder than up, never twice the same
const course = string => string.s("gm_acoustic_guitar_steel")
  .decay(.09)                 // each pick fades like a plucked string...
  .sustain(.35)               // ...before the next one catches it
  .release(.05)
  .hpf(160)                   // the laúd's small body: no guitar boom
  .lpf(5000)                  // an acoustic recording's top, no shimmer
const laud = stack(
  course(laudSong),
  course(laudSong.add(note(.04))).late(.005).velocity(.8),  // the paired string, 4 cents sharp, a hair late
)
  .room(.2)
  .roomsize(2)                // a small wooden room
  .orbit(8)                   // ducked by the kick
  .pan(.55)
  .gain(1.65)                 // the steel-string font is quiet, and this is the hook


// ---------------------------------------------------------------- the church

/**
 * Chant: monks singing in organum.
 * What: an 8-bar Gregorian-style line in half notes (E3 to C4) over two rounds
 *   of the cadence, sung with a second voice a fourth or fifth below. It ends
 *   F to E: the phrygian cadence of the old church modes.
 * How: the GM choir in a low register, both voices written out note by note
 *   so every interval stays in the mode (a strict parallel fourth would hit an
 *   F# or a Bb). A slow attack so each note swells like a breath, a long
 *   release and the cathedral's room (orbit 6, not ducked: the church doesn't
 *   pump).
 * Why: organum, a chant doubled in fourths and fifths, is the oldest sacred
 *   harmony there is: hollow, ancient, unmistakably a church. Half notes at 150
 *   are slow enough to float over the techno instead of dancing with it.
 */
const chant = note(`<
  [e3 a3] [b3 g3] [a3 c4] [b3 e3]
  [c4 b3] [a3 g3] [a3 f3] [f3 e3]
>`)
const organum = note(`<
  [a2 d3] [e3 c3] [d3 f3] [e3 a2]
  [f3 e3] [d3 c3] [d3 c3] [c3 b2]
>`)
const monks = stack(chant, organum.velocity(.8))
  .s("gm_choir_aahs")
  .attack(.12)                // a breath in
  .release(.6)
  .hpf(100)
  .lpf(3500)                  // dark: stone, not air
  .room(.6)
  .roomsize(9)                // the cathedral
  .orbit(6)
  .gain(.55)

/**
 * Choir: the cadence, sung.
 * What: the choir holding Am, G, F, E (A3 to E4), a bar each.
 * How: the GM choir, a slow swell and a long release so the chords blur into
 *   each other, the cathedral's room.
 * Why: the cadence the guitar strums, sung by the whole church: it turns the
 *   flamenco harmony sacred.
 */
const choir = note("<[a3,c4,e4] [g3,b3,d4] [f3,a3,c4] [e3,g#3,b3]>")
  .s("gm_choir_aahs").n(2)
  .attack(.4)
  .release(1.2)
  .hpf(200)
  .lpf(5000)
  .room(.6)
  .roomsize(9)
  .orbit(6)
  .gain(.35)

/**
 * Organ: the cathedral's voice.
 * What: the cadence on a church organ, the chords doubled an octave up, held
 *   a bar each; and a stab version for the second drop.
 * How: the GM church organ, a long release in the cathedral room (orbit 6,
 *   not ducked). The stabs (on the downbeat and the "and" of 2, the rumba's
 *   accents) are short, louder, ducked by the kick (orbit 9).
 * Why: the organ is the church's own instrument: held, it is the breakdown's
 *   ground; stabbed, it turns the cadence into a rave hook, the sacred sound
 *   pumping like a supersaw.
 */
const organChords = note("<[a2,e3,a3,c4,e4,a4] [g2,d3,g3,b3,d4,g4] [f2,c3,f3,a3,c4,f4] [e2,b2,e3,g#3,b3,e4]>")
  .s("gm_church_organ")
  .hpf(120)
  .lpf(6000)
const organ = organChords
  .release(.8)
  .room(.55)
  .roomsize(9)
  .orbit(6)
  .gain(.2)                   // a bed under the saeta and the monks
const organStabs = organChords
  .struct("x ~ ~ ~ ~ ~ x ~ ~ ~ ~ ~ ~ ~ ~ ~")
  .decay(.35)                 // a stab: cut before the next
  .sustain(.3)
  .release(.1)
  .room(.3)
  .roomsize(5)
  .orbit(9)                   // ducked by the kick: it pumps
  .gain(.9)                   // short hits, ducked: it needs level to be heard over the drop

/**
 * Bell: the church tower.
 * What: a low bell tolling E: every 4 bars in the drops, every 2 in the
 *   intro and outro.
 * How: the GM tubular bells on E3, dark and ringing in the cathedral room.
 * Why: the toll is the first and last thing heard: a city of the dead under
 *   a church, which is what Cvstodia is.
 */
const bellTone = note("e3").s("gm_tubular_bells")
  .release(2)
  .hpf(150)
  .room(.6)
  .roomsize(9)
  .orbit(6)
  .gain(1.2)                  // one strike every few bars: it has to ring out
const bell = bellTone.mask("<1 0!3>")
const toll = bellTone.mask("<1 0>")

/**
 * Saeta: the lament on a lone trumpet, the breakdown.
 * What: an 8-bar free melody over the cadence: a wail held on E5 and F5,
 *   falling through D, C, B to the G#; then climbing to E5 again and falling
 *   onto E through the F.
 * How: the GM trumpet, notes held with @-weights, a wide slow vibrato, a big
 *   room and a long echo: one player alone in a stone street.
 * Why: in Holy Week a saeta is sung (or played on a cornet) at the float as
 *   it passes: a cry, unaccompanied, melismatic, phrygian. It is the most
 *   Spanish sacred sound there is, and the Blasphemous score's soul.
 */
const saeta = note(`<
  [~@4 e5@8 f5@2 e5@2]
  [d5@6 e5@2 d5@2 c5@2 b4@4]
  [c5@8 b4@2 a4@6]
  [g#4@4 f4@4 e4@8]
  [~@2 a4@2 c5@2 e5@10]
  [f5@4 e5@2 d5@2 e5@8]
  [c5@6 d5@2 c5@2 b4@2 a4@4]
  [g#4@2 a4@2 f4@4 e4@8]
>`).s("gm_trumpet")
  .attack(.04)
  .release(.4)
  .vib(4.5)                   // a singer's vibrato...
  .vibmod(.3)                 // ...wide, a third of a semitone
  .hpf(250)
  .delay(.3)
  .delaytime(bar * 3 / 8)     // a dotted quarter: long, the street echoing
  .delayfeedback(.35)
  .room(.5)
  .roomsize(8)
  .orbit(10)
  .gain(.6)

/**
 * Tambor: the procession's snare.
 * What: a marching snare figure, accents on the beats with drags (two quick
 *   hits) leading into them, in the builds and under the saeta.
 * How: the acoustic snare, accented and ghosted by velocity, its own small room.
 * Why: the Holy Week bands march to snare drums; the drags give it the
 *   military, funereal swagger of a procession.
 */
const tambor = s("modern:5").bank("snare")
  .struct("x ~ [x x] x x ~ [x x] x x ~ [x x] x x ~ x x")
  .velocity("1 ~ [.35 .45] .6 1 ~ [.35 .45] .6 1 ~ [.35 .45] .6 1 ~ .7 .8")
  .hpf(350)                   // the wires and the crack, not the drum's boom
  .room(.25)
  .roomsize(4)
  .orbit(5)
  .pan(.6)
  .gain(.45)

/**
 * Timpani: the phrase ends and the build.
 * What: one timpani hit on E2 in the beat the kick leaves empty every 8th
 *   bar; and a 4-bar roll doubling every bar (4, 8, 16, 32 strokes).
 * How: the GM timpani, the roll crescendoing.
 * Why: the orchestral drum is the sacred score's drum: the hit closes each
 *   phrase like a door, the roll builds the procession to the drop.
 */
const timpaniFill = note("<~!7 [~@12 e2@4]>").s("gm_timpani")
  .room(.3)
  .roomsize(6)
  .orbit(11)
  .gain(.9)
const roll = note("e2*<4 8 16 32>").s("gm_timpani")
  .clip(1)                                // each stroke cut by the next: a roll, not a smear
  .gain(saw.slow(4).range(.3, .7))        // crescendo; 32 strokes a bar pile up, so it stops short of full
  .room(.3)
  .roomsize(6)
  .orbit(11)

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

// ---------------------------------------------------------------- arrangement

arrange(
  // ---- intro (16): the bell and the monks alone in the cathedral; then the kick and rumble under them
  [8, stack(monks, toll)],
  [8, stack(kickFill, rumble, hats, monks, toll, timpaniFill)],

  // ---- procession (16): the guitar strums the cadence, the palmas count the compás against the kick
  [16, stack(kickFill, rumble, hats, clap, palmas, rasgueado, bell, timpaniFill)],

  // ---- build (12): the choir and the falseta behind the doors, the tambor marching; then no kick, the timpani roll
  [8, stack(kickFill, rumble, hats, clap, palmas, rasgueado, choir, falsetaIn, tambor, timpaniFill)],
  [4, stack(rasgueado, monks, roll, riser)],

  // ---- drop 1 (16): the falseta over the strumming, the choir behind
  [16, stack(kickFill, rumble, hats, ohats, clap, palmas, rasgueado, falseta, choir, bell, timpaniFill)],

  // ---- break (4): the kick stops, the palmas and the guitar alone, the timpani rolling
  [4, stack(palmas, rasgueado, toll, roll)],

  // ---- chorus 2 (16): the laúd's tremolo song over the strumming
  [16, stack(kickFill, rumble, hats, ohats, clap, palmas, rasgueado, laud, choir, bell, timpaniFill)],

  // ---- break (4): only the kick, the rumble and the palmas
  [4, stack(kickFill, rumble, palmas)],

  // ---- breakdown (32): no kick: the monks over the organ, the saeta, the laúd alone in the church; then the tambor, the roll
  [8, stack(organ, monks, toll)],
  [8, stack(organ, saeta, bell)],
  [8, stack(organ, choir, laud)],
  [4, stack(organ, choir, monks, tambor)],
  [4, stack(organ, monks, tambor, roll, riser)],

  // ---- drop 2 (16): the organ stabs pumping, the falseta and the monks
  [16, stack(kickFill, rumble, hats, ohats, clap, palmas, rasgueado, falseta, organStabs, monks, bell, timpaniFill)],

  // ---- peak (8): the saeta takes the lead over everything
  [8, stack(kickFill, rumble, hats, ohats, clap, palmas, rasgueado, organStabs, choir, saeta, bell)],

  // ---- outro (16): the strumming and the monks over the kick; then the cathedral alone
  [8, stack(kickFill, rumble, hats, palmas, rasgueado, monks, bell, timpaniFill)],
  [8, stack(monks, choir, toll)],
).postgain(.5)  // master trim: headroom for the drops where the layers stack up
