// "ashen vigil" - hard techno, 150 bpm, E phrygian (E F G A B C D)
//
// a vigil in a ruined, rusted land: bells tolling from a broken tower, chains
// clanking in the wind, ghouls gurgling in the dark and something enormous
// moaning far away. under it acid state's clean 909 kick with its offbeat
// reverb rumble, like a heartbeat. three choruses, each with its own voice:
// a tubular-bell knell, a growling formant "wraith" riff, and a screaming
// supersaw "seraph" with a choir. polymeter throughout: the chains loop in 5
// 16ths against the bar. the long breakdown goes down to texture only, then
// builds on a 7-against-8 music box and a dotted-quarter kick (3 against 4)
// that never meet the barline, so the drop lands where you don't expect it.
//
// structure (1 cycle = 1 bar = 4 beats, 208 bars, ~5:33):
//   0:00  intro        16  the landscape, a muffled kick, then the floor
//   0:25  build        16  open hats and ghouls, the bells behind a filter
//   0:51  chorus 1     32  the knell
//   1:42  interlude    16  the kick drops whole bars, the wraith stirs
//   2:08  chorus 2     32  the wraith, then the bells answering it
//   2:59  breakdown    48  texture only (16), then the polymeter build (32)
//   4:16  chorus 3     32  the peak: seraph and choir, then seraph and bells
//   5:07  outro        16  kick and music box, then the ruins again
//
// every section change has a fill: the kick drops out for a taiko roll, a
// noise swell sucks into the 1, and a crash or a gong lands on it.

setcps(150/60/4)
const bar = 4 * 60 / 150      // one bar in seconds (1.6 s), for envelopes and delay times

// plays a pattern only in the first / last bar of an n-bar section
// (arrange restarts every section at its own cycle 0)
const firstBar = (pat, n) => pat.mask('<1 0!' + (n - 1) + '>')
const lastBar = (pat, n) => pat.mask('<0!' + (n - 1) + ' 1>')
// drops the second half of the last bar, to make room for a fill
const endBreak = (pat, n) => pat.mask('<1!' + (n - 1) + ' [1 0]>')

// ---------------------------------------------------------------- drums

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

// ---------------------------------------------------------------- metal & transitions

// chains: a heavy chain dragged and dropped, in a 5-step loop over the 16ths
// (5 against 16), so the clank lands on a different 16th every bar and only
// lines up again after 5 bars. the polymeter of the choruses.
// two layers: a slowed metal hit for the link striking, and sleighbells pitched
// down into heavier links for the jangle, each one doubled a 64th later and
// softer, so every hit is several links clattering, not one clean tick.
const chainClank = s("{metal:3 ~ ~ ~ ~}%16")
  .speed(.5)                  // an octave down: iron, not tin
  .hpf(250)
  .lpf(5000)                  // no fizz on top
  .gain(.8)
const chainRattle = s("{~ ~ sleighbells:1 sleighbells:0 ~}%16")
  .speed(.7)                  // bigger, heavier links
  .end(.35)                   // a short shake, not a ringing sleigh bell
  .velocity("{1 .6 .8}%16")    // a 3-step accent against the 5 steps: never quite repeats
  .hpf(1500)
  .lpf(9000)
  .gain(.85)
// const chains = stack(chainClank, chainRattle)
const chains = chainRattle
  .off(1/64, x => x.velocity(.45))  // the links behind it, softer
  .room(.3)
  .roomsize(3)
  .roomlp(5000)
  .orbit(4)
  .pan(.65)

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

// ---------------------------------------------------------------- the landscape

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

// ---------------------------------------------------------------- hooks

// knell (chorus 1): the bell-tower hook. a 4-bar phrase: the same call three
// times (low E leaping to the octave, falling through the phrygian C-B), each
// ending differently, the 4th bar answering with a 16th run down to the root.
const knellNotes = "<[e4 ~ ~ e5 ~ ~ b4 ~ c5 ~ ~ b4 ~ ~ f4 ~] [e4 ~ ~ e5 ~ ~ b4 ~ c5 ~ d5 ~ e5 ~ ~ ~] [e4 ~ ~ e5 ~ ~ b4 ~ c5 ~ ~ b4 ~ ~ g4 ~] [a4 ~ g4 ~ f4 ~ ~ e4 ~ ~ [f4 g4] [f4 e4] ~ ~ ~ ~]>"
const knell = stack(
  // the tubular bell: the body of the hook
  note(knellNotes).s("gm_tubular_bells")
    .release(.6)
    .gain(.75),
  // a quiet FM layer an octave down: iron under the bell, so the hook
  // cuts through the drums
  note(knellNotes).transpose(-12).s("square")
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
// teaser for the build: filtered behind a wall, opening over 8 bars
const knellIn = knell.lpf(saw.slow(8).rangex(400, 4000))
// the bells answering another lead: only the 2nd half of each 4-bar phrase
const knellAnswer = knell.mask("<0 0 1 1>")

// wraith (chorus 2): a growling, talking saw riff in the mid register, a new
// voice for the second chorus. 16ths hammering the root with an octave jump,
// the phrygian F rubbing against it; the 2nd bar climbs chromatically through
// the tritone (Bb) like something dragging itself up, the 4th falls back down.
const wraith = note(`<
  [e3 e3 e4 e3 ~ e3 f3 ~ e3 e3 b3 e3 ~ d4 c4 b3]
  [e3 e3 e4 e3 ~ e3 f3 ~ g3 ~ a3 ~ bb3 ~ b3 ~]
  [e3 e3 e4 e3 ~ e3 f3 ~ e3 e3 b3 e3 ~ d4 c4 b3]
  [e3 e3 e4 e3 ~ e3 f3 ~ e4 ~ d4 ~ c4 b3 f3 e3]
>`)
  .s("sawtooth")
  .vowel("<o a o e>")         // the mouth opens and closes bar by bar
  .decay(.13)
  .sustain(.3)
  .release(.05)
  .lpf(sine.slow(8).rangex(900, 2600))
  .lpq(4)
  .distort("2:.35")           // the growl
  .hpf(150)
  .room(.25)
  .roomsize(4)
  .orbit(7)                   // ducked by the kick: it pumps
  .pan(.5)
  .gain(.55)
// teased in the interlude: the mouth closed, opening over 16 bars
const wraithIn = wraith.lpf(saw.slow(16).rangex(300, 2000))

// seraph (chorus 3, the peak): the boss's second phase. a screaming supersaw,
// higher than everything else, with a melody of its own: long held cries
// pulled up a half-step (E-F), a climb to G, a fall to B, and a last octave
// leap from the root that hands back to the start.
// (in 16ths: @3 = held for 3 16ths)
const seraphNotes = "<[e5@3 f5@3 e5@4 b4@2 c5@2 d5@2] [e5@3 f5@3 g5@4 f5@2 e5@2 d5@2] [c5@3 d5@3 c5@4 a4@2 b4@2 c5@2] [b4@8 e4@2 e5@2 f5 e5 ~@2]>"
const seraph = note(seraphNotes)
  .s("supersaw")
  .unison(5)
  .detune(.25)                // wide enough to scream, not so wide it goes out of tune
  .spread(.6)
  .attack(.01)
  .decay(.3)
  .sustain(.6)
  .release(.15)
  .hpf(400)
  .lpf(sine.slow(16).rangex(2500, 6000))
  .lpq(2)
  .distort("1.5:.35")         // the edge of the scream
  .room(.4)
  .roomsize(6)
  .roomlp(6000)
  .delay(.2)
  .delaytime(bar * 3 / 16)
  .delayfeedback(.3)
  .orbit(12)
  .gain(.5)

// the choir under it: the same melody an octave down, sung, slow to speak,
// so the scream has a congregation behind it
const choir = note(seraphNotes).transpose(-12)
  .s("gm_choir_aahs")
  .attack(.08)
  .release(.8)
  .hpf(200)
  .lpf(3500)
  .room(.6)
  .roomsize(8)
  .orbit(12)
  .gain(.6)

// ---------------------------------------------------------------- breakdown: losing the 1

// omen: a cursed music box. 7 notes on 8ths (7 against 8), so the figure
// restarts every 3.5 beats and its first note wanders across the bar: no
// downbeat to hold on to. the Bb (the tritone) is the wrongness in it.
// the filter opens over the 32-bar build.
const omen = note("{e5 b4 f5 e5 c5 bb4 g4}%8")
  .s("gm_music_box")
  .release(.4)
  .hpf(400)
  .lpf(saw.slow(32).rangex(900, 7000))
  .room(.6)
  .roomsize(8)
  .roomlp(5000)
  .delay(.35)
  .delaytime(bar * 3 / 16)    // dotted-8th echo: smears the grid even more
  .delayfeedback(.45)
  .orbit(13)
  .pan(sine.slow(4).range(.05, .95))         // circles you once every 4 bars: side to side...
  .velocity(cosine.slow(4).range(.6, 1))     // ...and front to back, a quarter turn out of phase: quieter when it's "behind"
  .gain(.45)

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

// ---------------------------------------------------------------- arrangement

arrange(
  // ---- intro (16): the landscape, a kick behind a wall, then the floor
  [8, stack(firstBar(gong, 8), abyss, wind, creature, kickIn, lastBar(suck, 8))],
  [8, stack(endBreak(kickA, 8), endBreak(rumbleHot, 8), hatsRoll, chains, abyss, glass, lastBar(taikoFill, 8))],

  // ---- build (16): open hats and ghouls, then the bells creep in behind a filter
  [8, stack(firstBar(crash, 8), kickB, rumbleHot, hatsRoll, ohats, chains, ghouls, glass)],
  [8, stack(endBreak(kickB, 8), endBreak(rumbleHot, 8), hatsRoll, ohats, clapFill, chains, knellIn, lastBar(taikoFill, 8), lastBar(suck, 8))],

  // ---- CHORUS 1 (32): the knell
  [16, stack(firstBar(impact, 16), kickA, rumbleHot, hatsRoll, ohats, clapFill, chains, knell)],
  [16, stack(endBreak(kickB, 16), endBreak(rumbleHot, 16), hatsRoll, ohats, clapFill, chains, knell, ghouls, lastBar(taikoFill, 16), lastBar(suck, 16))],

  // ---- interlude (16): bells gone, the kick drops whole bars, the wraith stirs
  [16, stack(firstBar(crash, 16), endBreak(kickGaps, 16), endBreak(rumbleHot, 16), hats, chains, creature, glass, wraithIn,
    ohats.mask("<0!8 1!8>"), clapFill.mask("<0!12 1!4>"), lastBar(taikoFill, 16), lastBar(suck, 16))],

  // ---- CHORUS 2 (32): the wraith, then the bells answering it
  [16, stack(firstBar(impact, 16), kickB, rumbleHot, hatsRoll, ohats, clapFill, chains, wraith, glass)],
  [16, stack(endBreak(kickC, 16), endBreak(rumbleHot, 16), hatsRoll, ohats, clapFill, chains, wraith, knellAnswer, lastBar(taikoFill, 16), lastBar(suck, 16))],

  // ---- BREAKDOWN (48): texture only, then a polymeter build that hides the 1
  [16, stack(firstBar(gong, 16), abyss, wind, creature, ghouls, glass)],
  [32, stack(omen, creature, chains, abyss.mask("<1!24 0!8>"), ghouls.mask("<1!16 0!16>"),
    taikoPulse.mask("<0!8 1!8 0!16>"), kickPoly.mask("<0!16 1!16>"),
    roll.mask("<0!24 1!8>"), riser.mask("<0!24 1!8>"), lastBar(suck, 32))],

  // ---- CHORUS 3, the peak (32): the seraph and the choir, then the bells return
  [16, stack(firstBar(impact, 16), kickC, rumbleHot, hatsRoll, ohats, clapFill, chains, seraph, choir)],
  [16, stack(endBreak(kickC, 16), endBreak(rumbleHot, 16), hatsRoll, ohats, clapFill, chains, seraph, knellAnswer, lastBar(taikoFill, 16), lastBar(suck, 16))],

  // ---- outro (16): the floor and the music box, then back to the ruins
  [8, stack(firstBar(crash, 8), kickA, rumbleHot, hats, abyss, omen)],
  [8, stack(firstBar(gong, 8), abyss, wind, creature, glass)],
).postgain(.4)
