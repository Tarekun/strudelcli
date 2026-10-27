// "crimson toccata (midnight)" - a variation of crimson toccata: the same
// track, with the knell's bells given new patterns in new places.
// hard techno, 150 bpm, A minor around E (E phrygian dominant over the E
// chord: the G# of the harmonic minor)
//
// the castle above the ruins of "ashen vigil": a cathedral organ is the voice
// of the track, playing the castlevania progression (Am G F E) in toccata-like
// runs, stabs and a 7-against-8 litany. a harpsichord spins a 5-step arpeggio
// against the bar, bats flutter in the rafters, and the ghouls, the creature,
// the war drum and the landscape come from ashen vigil unchanged. the bells
// are the knell's instrument from ashen vigil, playing new parts: a clock
// striking midnight in the breakdown, and a peal that follows the chords.
// the kick and its offbeat rumble come from acid state.
//
// three choruses, each with its own lead: the organ toccata (with stabs on a
// 3-against-16 grid), the bells' peal over the harpsichord, and the organ's
// peak melody with the peal ringing under it. the long breakdown goes down to
// texture and twelve strikes of the bell, then builds on the organ litany and
// a dotted-quarter kick that never meet the barline, so the drop lands where
// you don't expect it.
//
// structure (1 cycle = 1 bar = 4 beats, 208 bars, ~5:33):
//   0:00  intro        16  organ chords and a toccata run, then the floor
//   0:25  build        16  the stabs filter in, the toccata teases
//   0:51  chorus 1     32  the organ toccata over 3-against-16 stabs
//   1:42  interlude    16  the kick drops whole bars, the harpsichord spins in
//   2:08  chorus 2     32  the bells' peal over the harpsichord, then the stabs join
//   2:59  breakdown    48  texture and the midnight toll (16), then the organ litany build (32)
//   4:16  chorus 3     32  the peak: organ melody, then the peal ringing under it
//   5:07  outro        16  kick and litany, then the ruins again
//
// the instruments marked "(from ashen vigil)" or "(from acid state)" are
// copied verbatim; the bells keep the knell's sound with new notes.

setcps(150/60/4)
const bar = 4 * 60 / 150      // one bar in seconds (1.6 s), for envelopes and delay times

// plays a pattern only in the first / last bar of an n-bar section
// (arrange restarts every section at its own cycle 0)
const firstBar = (pat, n) => pat.mask('<1 0!' + (n - 1) + '>')
const lastBar = (pat, n) => pat.mask('<0!' + (n - 1) + ' 1>')
// drops the second half of the last bar, to make room for a fill
const endBreak = (pat, n) => pat.mask('<1!' + (n - 1) + ' [1 0]>')

// ---------------------------------------------------------------- drums (from ashen vigil)

// kick and rumble (from acid state)

/**
 * Kick: the four-on-the-floor pulse.
 * What: a clean 909 kick on every quarter note, pitched down.
 * How: no saturation, played slower so its pitch drops and its body gets
 *   longer, with a gentle lowpass softening the click.
 *   It sidechains orbit 2, so the rumble dips every time it hits.
 * Why: in techno the kick IS the meter. A steady quarter-note pulse lets
 *   everything else play syncopated against it without the listener
 *   losing the downbeat. Keeping it clean leaves the grit to the 303 bass.
 */
const kick = s("bd:1*4").bank("RolandTR909")
  .speed(.85)                 // ~3 semitones lower: deeper fundamental, longer boom
  .lpf(3000)                  // rounds off the click without making it dull
  .gain(.48)                  // the loudest element: it carries the meter
  .duckorbit(2)               // sidechain: ducks everything on orbit 2 (the rumble)
  .duckattack(.1)             // how fast the ducked sound swells back: the "pump"
  .duckdepth(.8)              // how far it's pushed down: deep, but not silent
  .decay(0.3)

/**
 * Rumble: the low end, offbeat reverb tail.
 * What: a reverb-drenched copy of the kick on the offbeat 8ths, filtered
 *   down to the sub range.
 * How: the kick sample between the kicks, sent into reverb, then everything
 *   above 80 Hz is cut and the rest is driven. It sits on orbit 2, so each
 *   kick ducks the reverb tail and it swells back in between them.
 * Why: the rumble is unpitched, so it adds weight without clashing with the
 *   303 bass harmony. Kick on the beat and rumble off the beat interlock,
 *   and the sidechain turns the reverb tail into a pulse that breathes.
 */
const rumble = s("[~ bd:1]*4").bank("RolandTR909")
  .room(.5)                   // lots of reverb: the tail IS the rumble
  .lpf(80)                    // keep only the sub: no mud in the low mids
  .distort(2.5)               // drive thickens the filtered tail into a growl
  .orbit(2)                   // the bus the kick ducks: the tail pumps
  .gain(.02)                  // reverb + drive add a lot of level: start low

// this track's master is .4 (acid state plays at 1), so the pair comes up
// about 4 dB to sit where the kick sat before. the kick also keeps pumping
// orbit 7, with the same depth and speed as before; orbit 2 (the rumble)
// keeps acid state's values.
const kickHot = kick
  .velocity(1.6)
  .duckorbit("2:7")
  .duckattack(".1:.12")
  .duckdepth(".8:.9")
const rumbleHot = rumble.velocity(1.6)

// kick variations, all on an 8-bar cycle (section-relative)
// A: last beat of every 8th bar dropped
const kickA = kickHot.struct("<x*4!7 [x x x ~]>")
// B: last beat of every 4th bar dropped, a 16th pickup closing the 8
const kickB = kickHot.struct("<x*4!3 [x x x ~] x*4!3 [x ~ ~ ~ x ~ ~ ~ x ~ x ~ ~ ~ x x]>")
// C (peak): bar 4 ends in a 3-hit stumble, bar 8 drops the whole second half
const kickC = kickHot.struct("<x*4!3 [x x x [~ x x x]] x*4!3 [x x ~ ~]>")
// gaps: every 4th bar the kick is gone entirely and only the rumble rolls on
const kickGaps = kickHot.mask("<1!3 0 1!3 [1 0]>")
// muffled kick, opening over 8 bars, for the builds
const kickIn = kickA.lpf(saw.slow(8).rangex(250, 2500))

// closed hats: crushed 909 hats on 16ths, accent on the offbeat 8th
const hats = s("hh*16").bank("RolandTR909")
  .velocity("[.35 .55 1 .55]*4")
  .sometimesBy(.07, x => x.ply(2))  // the odd 32nd flutter
  .crush(7)
  .hpf(7500)
  .pan(.56)
  .gain(.28)
// every 4th bar the last beat rolls in 32nds
const hatsRoll = hats.struct("<x*16!3 [x*4 x*4 x*4 x*8]>")

// open hats on the offbeat, two shapes alternating per 8 bars
const ohats = s("<[~ oh]*4!7 [~ oh ~ oh ~ oh oh oh]>").bank("RolandTR909")
  .decay(.16)
  .hpf(6500)
  .pan(.42)
  .gain(.24)

// clap: 909 clap layered with a short crushed noise crack (rust), in a dark room
const clap = stack(
  s("~ cp:3 ~ cp:3").bank("RolandTR909").gain(.32),
  s("~ white ~ white").decay(.07).sustain(0).hpf(2500).crush(5).gain(.13),
)
  .room(.45)
  .roomsize(4)
  .roomlp(4000)
  .orbit(5)
// every 8th bar: a flam pickup on the last 16th
const clapFill = clap.struct("<[~ x ~ x]!7 [~ x ~ [x ~ ~ x]]>")

// ---------------------------------------------------------------- transitions (from ashen vigil)

// iron gong: one deep strike on the downbeat of a drop
const gong = s("gong:2")
  .speed(.6)                  // a fourth-ish lower: bigger, darker
  .hpf(70)
  .lpf(5000)
  .room(.5)
  .roomsize(7)
  .roomlp(3000)
  .orbit(6)
  .gain(.5)
const crash = s("cr:1").bank("RolandTR909")
  .hpf(600)
  .room(.4)
  .roomsize(5)
  .orbit(6)
  .pan(.45)
  .gain(.24)
const impact = stack(gong, crash)

// taiko fill: war drums rolling into the next section, quiet to loud
const taikoFill = note("[~ ~ ~ ~ ~ ~ ~ ~ e2 ~ ~ e2 e2 e2 [e2 e2] [e2 e2]]")
  .s("gm_taiko_drum")
  .velocity("[0!8 .5 0 0 .6 .7 .8 .9 1]")
  .hpf(60)
  .room(.3)
  .roomsize(4)
  .orbit(5)
  .gain(1.1)

// suck-in: a bar of white noise swelling from nothing, cut dead on the next
// downbeat, so the section change lands on the 1 like a door slamming
const suck = s("white")
  .attack(bar * .95)
  .sustain(1)
  .release(.01)
  .hpf(saw.rangex(200, 4000))
  .lpf(9000)
  .pan(.5)
  .orbit(3)
  .gain(.25)

// ---------------------------------------------------------------- the landscape and the ghouls (from ashen vigil)

// abyss: a choir drone on open fifths, E most of the time, sinking to F (the
// phrygian half-step of dread) every 4th bar. slow attack, dark, very wide room.
const abyss = note("<[e2,b2,e3] [e2,b2,e3] [e2,b2,g3] [f2,c3,f3]>")
  .s("gm_pad_choir")
  .attack(1.2)
  .release(2.5)
  .hpf(140)                   // the E2 root mostly goes: its reverb made the bass stereo; B2 and E3 carry it
  .lpf(sine.slow(16).rangex(700, 1800))
  .room(.75)
  .roomsize(9)
  .roomlp(2500)
  .orbit(9)
  .gain(.55)

// wind across the ruins: one long gust every 2 bars, slowed down and dark
const wind = s("wind:<2 5 7 3>").slow(2)
  .speed(.6)
  .hpf(200)
  .lpf(3500)
  .room(.5)
  .roomsize(8)
  .orbit(9)
  .pan(sine.slow(6).range(.2, .8))
  .gain(.5)

// creatures: crow calls dropped two octaves into a guttural moan, far away
// in a huge room, one every 4 bars, alternating sides
const creature = s("<crow:1 ~ ~ ~ crow:3 ~ ~ ~>")
  .speed("<.28!4 .24!4>")
  .hpf(150)                   // no sub in the huge room: the low end stays mono
  .lpf(2500)
  .room(.85)
  .roomsize(10)
  .roomlp(2000)
  .orbit(10)
  .pan("<.15!4 .85!4>")
  .gain(.6)

// ghouls: the goblin patch low in the register, a whisper-gurgle crawling
// between E and F on the offbeat of every other bar
const ghouls = note("<[~ e3] ~ [~ f3] ~ [~ e3] ~ [~ bb2] ~>")
  .s("gm_fx_goblins")
  .attack(.3)
  .release(1.5)
  .hpf(150)
  .lpf(3000)
  .room(.6)
  .roomsize(8)
  .orbit(10)
  .pan(sine.slow(7).range(.3, .7))
  .gain(.8)

// singing rust: bowed metal. two FM sines a minor second apart (E against F,
// then B against C) beating against each other, an inharmonic ratio for the
// metallic overtones, swelling in and dying away every other bar
const glass = note("<[e5,f5] ~ [b4,c5] ~>")
  .s("sine")
  .fm(1.5)
  .fmh(1.414)                 // inharmonic: metal, not a bell
  .attack(.9)
  .decay(.6)
  .sustain(.4)
  .release(2)
  .lpf(4000)
  .room(.7)
  .roomsize(9)
  .orbit(9)
  .pan(.35)
  .gain(.14)

// the war drum, the polymeter kick, the roll and the riser (from ashen vigil)
// the war drum on dotted quarters (3 8ths: 3 against 4), never on the same
// beat of two consecutive bars
const taikoPulse = note("{e2 ~ ~}%8")
  .s("gm_taiko_drum")
  .hpf(60)
  .room(.35)
  .roomsize(5)
  .orbit(5)
  .gain(.8)

// the kick on the same dotted-quarter grid, muffled, opening up as the build
// goes on: it feels like the groove is back, but the 1 is in the wrong place
const kickPoly = kickHot.struct("{x ~ ~}%8")
  .lpf(saw.slow(32).rangex(150, 3000))

// the roll: taiko on dotted 8ths swelling, then 909 snares on 16ths and 32ths
// with no accents, so they climb without giving the downbeat away
const roll = stack(
  note("{e2 ~ ~}%16").s("gm_taiko_drum")
    .mask("<1 1 1 1 0 0 0 0>")
    .gain(saw.slow(4).range(.4, .9))
    .hpf(60)
    .room(.3).roomsize(4),
  s("<~ ~ ~ ~ sd:5*16 sd:5*16 sd:5*32 sd:5*32>").bank("RolandTR909")
    .hpf(saw.slow(4).rangex(300, 3000))
    .crush(7)
    .gain(saw.slow(4).range(.12, .32))
    .room(.3).roomsize(4),
).orbit(5)

// riser: noise sweeping up through a narrowing bandpass over 8 bars
const riser = s("white*16")
  .sustain(1)
  .release(.03)
  .bpf(saw.slow(8).rangex(300, 8000))
  .bpq(saw.slow(8).range(1, 6))
  .gain(saw.slow(8).range(0, .6))
  .orbit(3)

// ---------------------------------------------------------------- the bells (the knell's instrument, from ashen vigil)

// the knell's instrument exactly as in ashen vigil (the tubular bell, the iron
// FM layer an octave down, the same filters, room and dotted-8th echo), made
// into a function of the notes so it can play new parts.
const bells = notes => stack(
  // the tubular bell: the body of the hook
  note(notes).s("gm_tubular_bells")
    .release(.6)
    .gain(.75),
  // a quiet FM layer an octave down: iron under the bell, so the hook
  // cuts through the drums
  note(notes).transpose(-12).s("square")
    .fm(2.5)
    .fmh(3.5)                 // bright, clangy sidebands
    .fmdecay(.12)
    .decay(.25)
    .sustain(0)
    .lpf(3500)
    .gain(.16),
)
  .hpf(250)                   // leave the low end to the kick and rumble
  .room(.45)
  .roomsize(6)
  .roomlp(5000)
  .delay(.25)
  .delaytime(bar * 3 / 16)    // dotted-8th echo: the bells ring on off the grid
  .delayfeedback(.35)
  .orbit(11)

// midnight (breakdown): the clock tower strikes twelve. silence for 4 bars,
// then E4 on every downbeat for 12 bars, alone over the texture
const midnight = bells("<~!4 e4!12>")

// peal (choruses 2 and 3): a new bell melody that follows the chords instead
// of circling E. each bar falls through its chord in long ringing notes and
// climbs back to the top, one step lower each bar (Am, G, F); the 4th bar
// leaps from B to E and falls back, with no G, so it sits over the organ's
// G# as well as the natural-minor harpsichord. (in 16ths: @3 = 3 16ths)
const peal = bells(`<
  [e5@3 c5@3 a4@2 b4@2 c5@2 e5@4]
  [d5@3 b4@3 g4@2 a4@2 b4@2 d5@4]
  [c5@3 a4@3 f4@2 g4@2 a4@2 c5@2 e5@2]
  [b4@4 e5@4 d5@2 c5@2 b4@4]
>`)

// the peal brought to the front for the choruses (about +3 dB), the bells left as they are
const pealFront = peal.velocity(1.8)

// ---------------------------------------------------------------- the organ

// the progression: Am G F E, one chord a bar. the E is an open fifth (no
// third), so the bells' and harpsichord's G natural and the leads' G# can both sit on it.
const chords = "<[a3,c4,e4] [g3,b3,d4] [f3,a3,c4] [e3,b3,e4]>"

// organ pad: the progression held, a full bar each, on orbit 7 so the kick
// pumps it. a 16' octave below for weight, highpassed so it stays off the rumble.
const organPad = stack(
  note(chords).s("gm_church_organ").gain(.5),
  note(chords).transpose(-12).s("gm_church_organ").gain(.3),
)
  .attack(.05)
  .release(.6)
  .hpf(150)
  .lpf(2000)                  // dark: the bells and the harpsichord sit above it
  .room(.5)
  .roomsize(8)
  .roomlp(3000)
  .orbit(7)

// organ stabs: the same chords cut short on a dotted-8th grid (3 against 16),
// so the chord hits drift across the beat and only line up again every 3 bars.
// the polymeter of choruses 1 and 3. ducked by the kick on orbit 7: they pump.
const organStab = note(chords)
  .struct("{x ~ ~}%16")
  .s("gm_church_organ")
  .release(.08)
  .hpf(200)
  .lpf(4500)
  .room(.3)
  .roomsize(5)
  .orbit(7)
  .gain(.85)
// for the build: behind a wall, opening over 8 bars
const organStabIn = organStab.lpf(saw.slow(8).rangex(300, 4500))

// intro chords: the big opening statement, Am then E major (with the G#),
// held for two bars each in a huge room, low and wide
const organIntro = note("<[a2,e3,a3,c4,e4] ~ [e2,b2,e3,g#3,b3] ~>")
  .s("gm_church_organ")
  .attack(.1)
  .release(3)
  .clip(2)                    // each chord holds over the empty bar after it
  .hpf(120)                   // the low A2/E2 stay mostly dry: the huge room would spread the bass
  .lpf(3500)
  .room(.8)
  .roomsize(10)
  .roomlp(3000)
  .orbit(12)
  .gain(.55)

// toccata run: a 16th flourish falling two octaves through the harmonic minor
// (the G# is the drama), for the last bar before the kick comes in
const organRun = note("[e6 d6 c6 b5 a5 g#5 f5 e5 d5 c5 b4 a4 g#4 f4 e4 ~]")
  .s("gm_church_organ")
  .release(.1)
  .hpf(200)
  .room(.6)
  .roomsize(9)
  .roomlp(4000)
  .orbit(12)
  .gain(.55)

// toccata (chorus 1): the organ lead. each bar arpeggiates its chord up to the
// octave, then turns back down in a sequence that falls a step per bar
// (Am, G, F), and the 4th bar runs down the harmonic minor over the E.
// two stops: the 8' at pitch and a quieter 4' an octave up for the shine.
const toccataNotes = `<
  [a4@2 e5@2 a5@2 g5 f5 e5@2 d5 e5 c5@2 a4@2]
  [b4@2 d5@2 g5@2 f5 e5 d5@2 c5 d5 b4@2 g4@2]
  [c5@2 f5@2 a5@2 g5 f5 e5@2 f5 g5 a5@2 c6@2]
  [b5@2 g#5@2 e5@2 d5@2 c5 b4 a4 g#4 e4@4]
>`
const toccata = stack(
  note(toccataNotes).s("gm_church_organ").gain(.75),
  note(toccataNotes).transpose(12).s("gm_church_organ").gain(.25),
)
  .release(.15)
  .hpf(250)
  .lpf(6000)
  .room(.5)
  .roomsize(8)
  .roomlp(4500)
  .orbit(12)
const toccataIn = toccata.lpf(saw.slow(8).rangex(400, 6000))

// the peak melody (chorus 3): a new line, faster. each bar opens with a
// mordent-like turn around the chord's 5th, leaps up through the chord, and
// the 4th bar climbs to E6 before falling through the phrygian-dominant
// scale (E F G# A B C D), the castlevania sound.
const peakNotes = `<
  [e5 f5 e5 d5 c5 d5 e5@2 a5@2 e5@2 c5@2 a4@2]
  [d5 e5 d5 c5 b4 c5 d5@2 g5@2 d5@2 b4@2 g4@2]
  [c5 d5 c5 b4 a4 b4 c5@2 f5@2 a5@2 c6@2 a5@2]
  [b5@2 g#5@2 b5@2 e6@2 d6 c6 b5 a5 g#5 f5 e5@2]
>`
const organPeak = stack(
  note(peakNotes).s("gm_church_organ").gain(.75),
  note(peakNotes).transpose(12).s("gm_church_organ").gain(.3),
)
  .release(.12)
  .hpf(250)
  .lpf(7000)
  .room(.5)
  .roomsize(8)
  .roomlp(5000)
  .orbit(12)

// litany (breakdown): the organ's polymeter. 7 notes on 8ths (7 against 8):
// a turn around E5 with the phrygian F above it, falling back to B, restarting
// every 3.5 beats so its first note wanders across the bar. alone over the
// drone, then under the dotted-quarter kick; the filter opens over 32 bars.
const litany = stack(
  note("{a4 c5 e5 f5 e5 c5 b4}%8").s("gm_church_organ").gain(.75),
  note("{a4 c5 e5 f5 e5 c5 b4}%8").transpose(12).s("gm_church_organ").gain(.25),
)
  .release(.2)
  .hpf(250)
  .lpf(saw.slow(32).rangex(700, 6000))
  .room(.6)
  .roomsize(9)
  .roomlp(4000)
  .delay(.3)
  .delaytime(bar * 3 / 16)    // dotted-8th echo: smears the grid even more
  .delayfeedback(.4)
  .orbit(14)
  .pan(sine.slow(5).range(.35, .65))

// ---------------------------------------------------------------- harpsichord & bats

// harpsichord: a 5-step arpeggio over the 16ths (5 against 16), following the
// chord each bar (root, 3rd, 5th, octave, 5th), so the high note lands on a
// different 16th every bar. the polymeter of choruses 2 and 3.
// two versions: natural minor (E minor in bar 4, for chorus 2),
// and the peak's, with E major (G#) in bar 4 under the organ's run.
const harpsiShape = n("{0 2 4 7 4}%16").add("<0 -1 -2 -3>")
const harpsiTone = x => x
  .s("gm_harpsichord")
  .release(.15)
  .hpf(400)
  .lpf(4500)                  // leaves the top to the bells' shimmer
  .room(.35)
  .roomsize(5)
  .orbit(13)
  .pan(.62)
  .gain(.75)
const harpsi = harpsiTone(harpsiShape.scale("A4:minor"))
const harpsiPeak = harpsiTone(harpsiShape.scale("<A4:minor!3 A4:harmonic:minor>"))
// the interlude: opening over 16 bars
const harpsiIn = harpsi.lpf(saw.slow(16).rangex(500, 7000))

// bats: tiny high squeaks, a pitch-bent sine chirp in quick flurries, scattered
// across the stereo field, high up in the rafters
const bats = note("<[~ ~ ~ [g6 a6 g6]] ~ [~ [a6 bb6] ~ ~] ~ [~ ~ [f6 g6 f6 g6] ~] ~ ~ ~>")
  .s("sine")
  .penv(7)
  .pdecay(.02)
  .decay(.05)
  .sustain(0)
  .hpf(800)
  .crush(8)
  .room(.5)
  .roomsize(7)
  .orbit(10)
  .pan(rand)
  .gain(.5)

// ---------------------------------------------------------------- arrangement

arrange(
  // ---- intro (16): organ chords and a toccata run, then the floor
  [8, stack(firstBar(gong, 8), organIntro, wind, creature, kickIn, lastBar(organRun, 8), lastBar(suck, 8))],
  [8, stack(endBreak(kickA, 8), endBreak(rumbleHot, 8), hatsRoll, organPad, abyss, bats, lastBar(taikoFill, 8))],

  // ---- build (16): the stabs filter in, the toccata teases
  [8, stack(firstBar(crash, 8), kickB, rumbleHot, hatsRoll, ohats, organStabIn, ghouls, glass)],
  [8, stack(endBreak(kickB, 8), endBreak(rumbleHot, 8), hatsRoll, ohats, clapFill, organStab, toccataIn, lastBar(taikoFill, 8), lastBar(suck, 8))],

  // ---- CHORUS 1 (32): the organ toccata
  [16, stack(firstBar(impact, 16), kickA, rumbleHot, hatsRoll, ohats, clapFill, organStab, toccata)],
  [16, stack(endBreak(kickB, 16), endBreak(rumbleHot, 16), hatsRoll, ohats, clapFill, organStab, toccata, bats, lastBar(taikoFill, 16), lastBar(suck, 16))],

  // ---- interlude (16): the organ holds, the kick drops whole bars, the harpsichord spins in
  [16, stack(firstBar(crash, 16), endBreak(kickGaps, 16), endBreak(rumbleHot, 16), hats, organPad, creature, harpsiIn,
    ohats.mask("<0!8 1!8>"), clapFill.mask("<0!12 1!4>"), lastBar(taikoFill, 16), lastBar(suck, 16))],

  // ---- CHORUS 2 (32): the bells' peal over the harpsichord, then the stabs join
  [16, stack(firstBar(impact, 16), kickB, rumbleHot, hatsRoll, ohats, clapFill, pealFront, harpsi, organPad)],
  [16, stack(endBreak(kickC, 16), endBreak(rumbleHot, 16), hatsRoll, ohats, clapFill, pealFront, harpsi, organStab, ghouls, lastBar(taikoFill, 16), lastBar(suck, 16))],

  // ---- BREAKDOWN (48): texture and the midnight toll, then the organ litany build that hides the 1
  [16, stack(firstBar(gong, 16), abyss, wind, creature, ghouls, glass, bats, midnight)],
  [32, stack(litany, creature, abyss.mask("<1!24 0!8>"), ghouls.mask("<1!16 0!16>"),
    taikoPulse.mask("<0!8 1!8 0!16>"), kickPoly.mask("<0!16 1!16>"),
    roll.mask("<0!24 1!8>"), riser.mask("<0!24 1!8>"), lastBar(suck, 32))],

  // ---- CHORUS 3, the peak (32): the organ's peak melody, then the peal ringing under it
  [16, stack(firstBar(impact, 16), kickC, rumbleHot, hatsRoll, ohats, clapFill, organPeak, organStab)],
  [16, stack(endBreak(kickC, 16), endBreak(rumbleHot, 16), hatsRoll, ohats, clapFill, organPeak, peal, organStab, lastBar(taikoFill, 16), lastBar(suck, 16))],

  // ---- outro (16): the floor and the litany, then back to the ruins
  [8, stack(firstBar(crash, 8), kickA, rumbleHot, hats, organPad, litany)],
  [8, stack(firstBar(gong, 8), abyss, wind, creature, glass)],
).postgain(.4)
