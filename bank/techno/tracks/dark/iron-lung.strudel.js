// "iron lung" - industrial warehouse techno, 138 bpm, D phrygian / locrian
//
// a concrete warehouse with a machine breathing in it. a distorted kick and a
// rolling sub rumble hammer the floor, crushed hats and struck-metal perc
// fill the grid, and the signature is an iron stab: D - Eb - D - [D+Ab],
// root, flat 2nd and tritone, in dotted 8ths that slip 3-against-4 over the
// kick and only line up again every 3 bars. behind it, the "iron lung":
// filtered noise inhaling for a bar and exhaling for the next.
// harsh and relentless, but groovy: 138, not schranz speed.
// inspired by: surgeon, perc, ancient methods, early blawan
//
// structure (1 cycle = 1 bar = 4 beats, 208 bars, ~6:01):
//   0:00  intro      32 bars  kick, hats and clank (for mixing), then rumble, rim, the lung
//   0:55  groove     32 bars  the snare lands, the stab filters in, then the open hats
//   1:51  body       32 bars  the full machine, the lung breathing behind it
//   2:46  breakdown  24 bars  no kick: the drone and the lung, the stab in reverb, a 4-bar build
//   3:28  peak       32 bars  everything
//   4:24  tension     8 bars  kick and rumble cut out: stab, perc and drone, then a 4-bar build
//   4:38  peak 2     16 bars  the last drop
//   5:06  outro      32 bars  strip back down to kick, hats and clank

setcps(138/60/4)
const bar = 4 * 60 / 138      // one bar in seconds (~1.74 s), for envelopes


// ---------------------------------------------------------------- drums

/**
 * Kick: the hammer.
 * What: a distorted 909 kick on every quarter note, pitched down.
 * How: played slower so its pitch drops and its body gets longer, then
 *   driven hard through a waveshaper with a postgain to pull the level back.
 *   It sidechains orbit 2, so the rumble dips every time it hits.
 * Why: in warehouse techno the kick is a piece of machinery: the drive
 *   squares off the body (more harmonics = more punch on small speakers,
 *   more weight on big ones) and turns the click into a hard edge. A steady
 *   four-on-the-floor is the anchor that lets the stab and the perc play
 *   off-grid against it without the floor losing the downbeat.
 */
const kick = s("bd*4").bank("RolandTR909")
  .speed(.75)                 // ~5 semitones lower: a deeper body, strongest around 80 Hz
  .distort("2.5:.34")         // hard drive, postgain .34 to give back the level it adds
  .lpf(6000)                  // keep the edge of the click, lose the fizz the drive adds
  .duckorbit(2)               // sidechain: ducks everything on orbit 2 (the rumble)
  .duckattack(.12)            // how fast the rumble swells back between kicks
  .duckdepth(.9)              // pushed almost to silence on each hit
  .gain(.8)                   // the loudest element: it carries the meter
const kickFill = kick
  .struct("<x*4!7 [x ~ ~ ~ x ~ ~ ~ x ~ ~ ~ ~ ~ x x]>")  // every 8th bar: beat 4 skips, then a double hit pulls into the next phrase

/**
 * Rumble: the low end, a rolling echo of the kick in a dark room.
 * What: the kick, retriggered on the "and" and the "a" of every beat (steps
 *   2 and 3 of each 4, counting from 0), cut down to the sub, driven, then smeared by a 16th-note echo
 *   that feeds back on itself and a little of the warehouse reverb.
 * How: two ghost hits per beat start the echo train, and each echo lands on
 *   the next 16th, so the low end rolls on continuously between kicks. A
 *   lowpass before the drive leaves only the sub and the drive turns it into
 *   a growl. It sits on orbit 2, so each kick ducks it and it swells back in
 *   the gap.
 * Why: this is the "rumble" of warehouse techno, done with an echo rather
 *   than a big reverb: a long reverb tail is stereo, and stereo sub thins
 *   out or cancels on a mono club system. A feedback echo of a centred
 *   sound stays centred, so most of the tail is the echo and the reverb
 *   only adds the sense of a room. Feeding it on the two last 16ths of each
 *   beat gives the swell a forward push into the next kick, like a breath
 *   drawn just before each hammer blow. Being at the same pitch as the
 *   kick, it thickens the sub without adding a second bass note.
 */
const rumble = s("bd").bank("RolandTR909")
  .struct("[~ ~ x x]*4")      // the "and" and the "a" of each beat: feeds the tail into the next kick
  .speed(.75)                 // same pitch as the kick: one low end, not two
  .lpf(90)                    // only the sub goes into the drive, the echo and the reverb
  .distort("3:.4")            // the growl: harmonics just above the sub
  .delay(.8)                  // most of the tail is the echo: it stays centred
  .delaytime(bar / 16)        // one 16th: every echo lands on the grid, the roll
  .delayfeedback(.65)         // long enough to bridge the gap between kicks
  .room(.2)                   // a little of the room, for depth without a wide sub
  .roomsize(7)                // a long, warehouse-sized tail
  .roomlp(400)                // the tail stays dark: no growl left where the snare's body is
  .orbit(2)                   // the bus the kick ducks: the tail pumps
  .gain(.018)                 // drive + echo add a lot of level: well under the kick


/**
 * Hats: the conveyor belt.
 * What: a closed hat on every 16th, crushed down to a few bits, accented on
 *   the offbeat 8th and ghosted on the 16ths around it.
 * How: a 4-step gain pattern per beat (ghost, soft, LOUD, soft), bitcrushed
 *   and sample-rate reduced, with a highpass so it lives only in the top.
 * Why: steady 16ths are the smallest subdivision of the grid: they make the
 *   machine audible, and the accent on the "and" gives the forward lean
 *   against the kick. Crushing turns a shiny 909 hat into something like a
 *   grinder on sheet metal: aliasing adds inharmonic, clanking overtones.
 */
const hats = s("hh*16").bank("RolandTR909")
  .gain("[.1 .16 .32 .16]*4") // ghost, soft, accent on the "and", soft
  .crush(5)                   // 5-bit: harsh, gritty, industrial
  .coarse(3)                  // a third of the sample rate: metallic aliasing
  .hpf(5000)                  // stays in the top octave, out of the stab's way
  .pan(.55)                   // a touch right, so the perc can sit left

/**
 * Open hats: the steam valve.
 * What: a short open hat on the offbeat 8ths, for the busier sections.
 * How: the 909 open hat, cut short, crushed less than the closed hats.
 * Why: an open hat on the "and" is the strongest offbeat accent there is:
 *   it hisses open exactly between two kicks, so kick and hat alternate like
 *   a piston going in and out. Cutting it short keeps it a hiss, not a wash.
 */
const ohats = s("[~ oh]*4").bank("RolandTR909")
  .decay(.12)                 // short: a hiss, not a cymbal wash
  .crush(7)                   // some grit to match the closed hats
  .hpf(7000)                  // above the closed hats: the very top
  .pan(.45)                   // a touch left: the two hats frame the centre
  .gain(.25)                  // under the closed hats' accents


/**
 * Clank: the struck girder.
 * What: an 808 cowbell, pitched down and driven, on the "a" of beat 2 and the
 *   "and" of beat 4, plus a third hit on the "e" of beat 3 every other bar.
 * How: played at 70% speed, the cowbell's two square-wave tones drop
 *   toward the mids and stop sounding like a bell; the drive and a bandpass
 *   turn them into a dull metallic knock, with a short decay so it stays a
 *   hit. A small, bright room makes it bounce off concrete.
 * Why: the 808 cowbell is two detuned tones a little less than a fifth
 *   apart, which is already inharmonic: lowered and distorted it is the
 *   sound of metal on metal. Placed late in the beat (steps 7 and 14,
 *   counting from 0) it
 *   answers the backbeat instead of doubling it, a call-and-response the
 *   ear follows across the bar, and the extra hit every other bar makes it
 *   a 2-bar figure so it doesn't feel looped.
 */
const clank = s(`<
  [~ ~ ~ ~ ~ ~ ~ cb ~ ~ ~ ~ ~ ~ cb ~]
  [~ ~ ~ ~ ~ ~ ~ cb ~ cb ~ ~ ~ ~ cb ~]
>`).bank("RolandTR808")
  .speed(.7)                  // ~6 semitones down: from a bell to a knock
  .distort("2:.5")            // metal grit; postgain pulls the level back
  .bpf(1200)                  // centred above the stab's body, below the hats
  .bpq(2)                     // a wide band: some body, some ring
  .decay(.15)                 // short: a hit, not a ringing bell
  .room(.25)                  // a small, hard space
  .roomsize(1.5)              // short reflections: concrete walls close by
  .orbit(4)                   // own bus, so this short room stays separate
  .pan(.35)                   // left of centre, opposite the closed hats
  .gain(.5)                   // a feature of the groove, under the kick

/**
 * Rim: the rivet gun.
 * What: a crushed 808 rimshot on the "a" of beat 1 and of beat 3, and the
 *   "e" of beat 4 (steps 3, 11 and 13, counting from 0).
 * How: pitched up a little, crushed and highpassed into a small, dry click,
 *   with a short 16th-triplet echo that ratchets after each hit.
 * Why: these three steps are the holes the kick, snare, open hats and clank
 *   leave, so the rim fills the grid in without doubling anything: the
 *   groove gets a tight, interlocking "machine shop" feel. A 16th-triplet
 *   echo is a 3-against-4 subdivision: each hit is followed by a stutter
 *   that falls between the 16ths, the off-grid rattle of a rivet gun.
 */
const rim = s("~ ~ ~ rim ~ ~ ~ ~ ~ ~ ~ rim ~ rim ~ ~").bank("RolandTR808")
  .speed(1.15)                // a bit higher and tighter
  .crush(6)                   // grit to match the hats
  .hpf(1500)                  // above the clank: no low-mid knock
  .delay(.3)                  // quiet echoes: a ratchet, not a second part
  .delaytime(bar / 24)        // a 16th-note triplet: falls between the 16ths
  .delayfeedback(.35)         // two or three repeats, fading fast
  .orbit(6)                   // own bus: the delay time stays its own
  .pan(.7)                    // right, opposite the clank
  .gain(.3)                   // a detail: crushed clicks peak high for their loudness


/**
 * Snare: the backbeat slab.
 * What: a 909 snare and clap struck together on beats 2 and 4.
 * How: the two layered, pitched down, driven, and sent into a big reverb
 *   with its top cut, so the tail is a dark boom instead of a bright splash.
 * Why: the backbeat splits each bar into call and answer. Layering gives
 *   it the snare's body and the clap's spread at once, so it hits like a
 *   slab dropped on concrete; pitching it down makes it heavier. A dark
 *   room tail tells the ear the space is huge and hard (a warehouse), while
 *   keeping the reverb's top out of the hats' range.
 */
const snare = s("~ [sd,cp] ~ [sd,cp]").bank("RolandTR909")
  .speed(.9)                  // ~2 semitones down: heavier
  .hpf(180)                   // keeps the reverb out of the kick and rumble's sub
  .distort("1.5:.35")         // grit to match the kick; postgain pulls it back
  .room(.5)                   // a big send: the tail is half the sound
  .roomsize(6)                // a warehouse-sized room
  .roomlp(3000)               // a dark tail: concrete, not a bright hall
  .orbit(5)                   // own reverb bus
  .gain(.25)                  // under the kick, over the perc

/**
 * Slam: the phrase marker.
 * What: a crash on the first bar of every 16, pitched an octave down.
 * How: the 909 crash at half speed, driven and crushed, in the snare's room.
 * Why: marks each 16-bar section, so the layers coming in sound announced.
 *   An octave down, the crash loses its shimmer and becomes a long, dark
 *   wash of metal: a shutter door slammed in a warehouse, not a cymbal.
 */
const slam = s("cr").bank("RolandTR909")
  .mask("<1 0!15>")           // first bar of 16 only
  .speed(.5)                  // an octave down: dark, long, heavy metal
  .crush(8)                   // grit, like the hats
  .distort("1:.5")            // a little weight, postgain pulls it back
  .hpf(300)                   // out of the low end
  .room(.4)                   // rings out in the room
  .roomsize(6)                // the warehouse
  .roomlp(3000)               // the dark tail, as for the snare
  .orbit(5)                   // shares the snare's reverb: same space
  .gain(.18)                  // a marker, not a feature

/**
 * Roll: the build, in rhythm.
 * What: a 4-bar roll that speeds up every bar: low and mid toms in 8ths,
 *   then low-mid-high toms in 8th triplets, then the snare in 16ths, then
 *   in 32nds.
 * How: one subdivision per bar (8, 12, 16, 32 hits), crushed and driven,
 *   with a rising highpass and a rising level, in the snare's dark room.
 * Why: each bar packs more hits into the same time, so the pulse feels
 *   like it's accelerating while the tempo stays fixed: tension that only
 *   the drop can release. Starting on toms gives the roll a pitch that
 *   climbs (low, mid, high) before it turns into a snare blur, and the
 *   triplet bar is a moment of 3-against-4, like the stab, before the grid
 *   snaps back to straight 16ths.
 */
const roll = s("<[lt mt]*4 [lt mt ht]*4 sd*16 sd*32>").bank("RolandTR909")
  .crush(7)                               // grit to match the hats
  .distort("1.5:.6")                      // weight, like the snare
  .hpf(saw.slow(4).rangex(150, 1800))     // thinner and brighter as it climbs
  .gain(saw.slow(4).range(.1, .32))       // crescendo across the 4 bars
  .room(.3)                               // in the snare's room...
  .roomsize(6)                            // ...the warehouse...
  .roomlp(3000)                           // ...with the same dark tail
  .orbit(5)                               // shares the snare's reverb bus

/**
 * Riser: the build, in timbre.
 * What: white noise through a bandpass that climbs from 400 Hz to 9 kHz
 *   over 4 bars, getting narrower and louder as it goes.
 * How: noise in 16ths (filters update only at each note start), the
 *   bandpass centre rising exponentially, its resonance rising with it so
 *   the hiss turns into a whistle, and the volume swelling from silence.
 * Why: rising pitch and brightness read as rising tension, even from
 *   unpitched noise. Narrowing the band at the top makes the end of the
 *   riser scream like a pressure valve about to burst, the iron lung
 *   overloading, before the drop lets it go. It pairs with the roll: one
 *   builds in rhythm, the other in timbre.
 */
const riser = s("white*16")
  .sustain(1)                             // full level for each 16th: one stream
  .release(.03)                           // short overlap: no gaps
  .bpf(saw.slow(4).rangex(400, 9000))     // the climb
  .bpq(saw.slow(4).range(.7, 6))          // wide hiss at the start, a whistle at the top
  .gain(saw.slow(4).range(0, 1.2))        // fades in from silence (a narrow band of noise is quiet)
  .orbit(3)                               // shares the breath's bus: same air


// ---------------------------------------------------------------- synths

/**
 * Stab: the iron riff, the signature of the track.
 * What: a metallic, driven stab playing D - Eb - D - [D+Ab] in dotted 8ths:
 *   root, flat 2nd, root, and a tritone dyad as the accent.
 * How: a 12-step figure (4 hits, one every 3 16ths) played on the 16-step
 *   grid, so it slips against the bar and lines up again every 3 bars.
 *   Each hit is a sawtooth frequency-modulated at an inharmonic ratio, with
 *   the FM and the lowpass both snapping shut right after the attack, then
 *   driven through a waveshaper. A short room puts it in the same concrete
 *   space as the perc.
 * Why: one hit every 3 16ths against a kick every 4 is a 3-against-4
 *   cross-rhythm: the riff never lands the same way twice in a row, which
 *   is what makes a 4-note figure hypnotic instead of repetitive. The notes
 *   are the darkest intervals there are: Eb is the phrygian flat 2nd, a
 *   semitone grinding against the root, and Ab is the tritone (the locrian
 *   flat 5th), the interval that splits the octave in half and never
 *   settles. An FM ratio of 1.47 puts the sidebands between the harmonics
 *   (inharmonic, like struck metal), and the snap-shut envelopes make each
 *   hit start as a clang and end as a dull saw: iron, not a synth pad.
 */
const stab = note("{d3 ~ ~ eb3 ~ ~ d3 ~ ~ [d3,ab3] ~ ~}%16").s("sawtooth")
  .fm(4)                      // FM index: how much clang at the attack
  .fmh(1.47)                  // inharmonic ratio: metallic sidebands
  .fmdecay(.08)               // the clang fades fast...
  .fmsustain(.15)             // ...to a little grit that stays
  .hpf(130)                   // out of the kick and rumble's sub: it's a mid stab
  .lpf(800)                   // closed: the body of the saw, with some edge left
  .lpenv(2)                   // opens 2 octaves (to ~3.2 kHz) on each hit
  .lpdecay(.1)                // and snaps shut: a bite, not a sweep
  .lpsustain(0)               // fully closed between hits
  .lpq(3)                     // a little resonance on the snap
  .decay(.2)                  // a stab: gone before the next hit
  .sustain(0)                 // no hold
  .distort("2.5:.3")          // iron: driven hard, postgain pulls it back
  .room(.25)                  // the perc's small, hard room
  .roomsize(2)                // close concrete walls
  .orbit(7)                   // own bus
  .gain(.3)                   // the feature, still under the kick

/**
 * Stab, filtering in: the riff's entrance.
 * What: the stab, with its resting cutoff opening from 150 Hz to 800 Hz
 *   over 16 bars.
 * How: overrides the stab's fixed cutoff with a rising exponential sweep;
 *   the per-hit envelope still opens 2 octaves above wherever it is.
 * Why: the riff arrives as a muffled knock behind a wall and gets closer
 *   bar by bar, a slow timbral crescendo. By the time it's fully open the
 *   ear already knows the figure.
 */
const stabIn = stab
  .lpf(saw.slow(16).rangex(150, 800))   // exponential: sounds even to the ear

/**
 * Stab in reverb: the breakdown version.
 * What: the stab drowned in the warehouse reverb, a little quieter.
 * How: a large, dark reverb send on the stab's own bus, and a higher
 *   highpass that takes away the body of the hits.
 * Why: without the kick the riff becomes the subject: the reverb turns the
 *   dry, mechanical hits into echoes from the far end of the building, a
 *   memory of the groove that the drop brings back up close.
 */
const stabVerb = stab
  .hpf(250)                   // thinner and further away; leaves the low mids to the drone
  .room(.7)                   // mostly reverb
  .roomsize(7)                // the rumble's huge space
  .roomlp(2500)               // dark, like every tail in the track
  .gain(.18)                  // the reverb adds level: pull it back


// ---------------------------------------------------------------- texture

/**
 * Breath: the iron lung.
 * What: filtered pink noise that inhales for one bar and exhales for the
 *   next, over and over.
 * How: noise in 16ths (filters only update at each note start), held at
 *   full level so the notes join into one stream. A bandpass rises from
 *   350 Hz to 2.8 kHz over the first bar and falls back over the second,
 *   and the level swells and fades with it, following one 2-bar triangle.
 *   A big, dark room behind it.
 * Why: a sound that rises in pitch and level reads as a breath drawn in,
 *   and the same shape falling back reads as the breath let out: the ear
 *   hears a machine breathing for someone. A 2-bar cycle is much slower
 *   than anything else in the track, so it feels like a body under the
 *   mechanism: it moves the whole groove in long waves without touching
 *   its rhythm.
 */
const breath = s("pink*16")
  .sustain(1)                             // full level for each 16th...
  .release(.03)                           // ...with a short overlap: one stream, no gaps
  .bpf(tri.slow(2).rangex(350, 2800))     // in: the band rises; out: it falls
  .bpq(1)                                 // wide and airy, but the pitch move is still heard
  .gain(tri.slow(2).range(.15, 2))        // swells with the inhale, fades with the exhale (band-passed noise is quiet)
  .pan(sine.slow(8).range(.35, .65))      // drifts slowly across the centre
  .room(.4)                               // set back in the space
  .roomsize(6)                            // the warehouse, like the snare's room
  .roomlp(2500)                           // a dark tail
  .orbit(3)                               // own bus

/**
 * Drone: the furnace.
 * What: a low, driven saw on D1 with its octave, held for whole bars,
 *   moving over 8 bars: D D D Eb D D Ab Eb.
 * How: two saws an octave apart, slow attack and long release so the bars
 *   blur, a resonant lowpass slowly opening and closing over 8 bars, then
 *   heavy drive and a dark room (a modest send: a long reverb on a sub
 *   note makes the sub wide). It sits an octave under the stab
 *   (whose lowest note is D3), and its lowpass stays under 500 Hz, so the
 *   two share the key but not the register.
 * Why: without the kick the breakdown needs a floor, and a pedal point on
 *   the root holds the key while everything else falls away. The moves are
 *   the track's two dissonances again, slowed down: Eb (flat 2nd) grinds a
 *   semitone above the root, and the Ab (the tritone, a pitch with no pull
 *   to either side) is the most unstable moment of the phrase, which then
 *   steps back through Eb onto D at the loop. Driving a filtered saw hard
 *   makes it roar like a machine room instead of humming like a pad.
 */
const drone = note("<[d1,d2]!3 [eb1,eb2] [d1,d2]!2 [ab1,ab2] [eb1,eb2]>").s("sawtooth")
  .attack(.4)                             // fades in: no transient
  .sustain(1)                             // holds the whole bar
  .release(1.2)                           // rings into the next bar: no gaps
  .hpf(30)                                // nothing below the lowest fundamental (D1, 37 Hz): no DC from the drive
  .lpf(sine.slow(8).rangex(120, 500))     // slow timbre movement keeps a held note alive, under the stab
  .lpq(6)                                 // resonance: the sweep is audible, a whistle in the roar
  .distort("3:.15")                       // the roar; a low postgain pulls the level back after it
  .room(.15)                              // a little space, kept small: a reverb tail on a sub note makes the sub wide
  .roomsize(7)                            // the same huge tail as the rumble
  .roomlp(1500)                           // a dark tail
  .orbit(8)                               // own bus
  .gain(.25)                              // a bed, under the stab


// ---------------------------------------------------------------- arrangement

arrange(
  // ---- intro (32): kick and perc only, for the DJ to mix in
  [16, stack(kickFill, hats, clank)],
  [16, stack(kickFill, rumble, hats, clank, rim, breath)],

  // ---- groove (32): the snare lands, the riff filters in
  [16, stack(kickFill, rumble, hats, clank, rim, snare, stabIn, slam)],
  [16, stack(kickFill, rumble, hats, ohats, clank, rim, snare, stab)],

  // ---- body (32): the full machine, the lung breathing behind it
  [16, stack(kickFill, rumble, hats, ohats, clank, rim, snare, stab, breath, slam)],
  [16, stack(kickFill, rumble, hats, ohats, clank, rim, snare, stab)],

  // ---- breakdown (24): no kick, the furnace and the lung, then the build
  [8, stack(drone, breath)],
  [12, stack(drone, breath, stabVerb)],
  [4, stack(drone, stabVerb, roll, riser)],

  // ---- peak (32): everything
  [16, stack(kickFill, rumble, hats, ohats, clank, rim, snare, stab, breath, slam)],
  [16, stack(kickFill, rumble, hats, ohats, clank, rim, snare, stab, breath)],

  // ---- tension (8): the kick and rumble cut out, the riff and the furnace carry it
  [4, stack(hats, ohats, clank, rim, stab, breath, drone)],
  [4, stack(hats, stab, drone, roll, riser)],

  // ---- peak 2 (16): the last drop
  [16, stack(kickFill, rumble, hats, ohats, clank, rim, snare, stab, breath, slam)],

  // ---- outro (32): strip back down to kick and perc
  [16, stack(kickFill, rumble, hats, clank, rim, snare)],
  [16, stack(kickFill, hats, clank)],
)
