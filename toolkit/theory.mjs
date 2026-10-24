// music theory helpers: note names, registers, chord names and key detection

export const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

export const pitchClass = (midi) => ((Math.round(midi) % 12) + 12) % 12;
export const noteName = (midi) => `${NAMES[pitchClass(midi)]}${Math.floor(Math.round(midi) / 12) - 1}`;

// rough register of a pitch, named after where it sits in a mix
export function register(midi) {
  if (midi < 36) return 'sub'; // below C2, ~65 Hz
  if (midi < 48) return 'bass'; // C2-B2
  if (midi < 60) return 'low-mid'; // C3-B3
  if (midi < 72) return 'mid'; // C4-B4
  if (midi < 84) return 'high'; // C5-B5
  return 'very high';
}

// interval sets above the root, checked in this order
const CHORDS = [
  ['', [0, 4, 7]],
  ['m', [0, 3, 7]],
  ['dim', [0, 3, 6]],
  ['aug', [0, 4, 8]],
  ['sus2', [0, 2, 7]],
  ['sus4', [0, 5, 7]],
  ['7', [0, 4, 7, 10]],
  ['maj7', [0, 4, 7, 11]],
  ['m7', [0, 3, 7, 10]],
  ['m7b5', [0, 3, 6, 10]],
  ['5', [0, 7]],
];

// name of the chord formed by some simultaneous notes ("F/A" for inversions),
// the pitch classes joined with + if it isn't a known chord, null for one note
export function chordName(midis) {
  const pcs = [...new Set(midis.map(pitchClass))];
  if (pcs.length < 2) return null;
  const bass = pitchClass(Math.min(...midis));
  for (const [suffix, intervals] of CHORDS) {
    for (const root of pcs) {
      const set = new Set(pcs.map((p) => (p - root + 12) % 12));
      if (set.size === intervals.length && intervals.every((i) => set.has(i))) {
        return `${NAMES[root]}${suffix}${bass !== root ? `/${NAMES[bass]}` : ''}`;
      }
    }
  }
  return pcs.map((p) => NAMES[p]).join('+');
}

export const MODES = {
  minor: [0, 2, 3, 5, 7, 8, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  'harmonic minor': [0, 2, 3, 5, 7, 8, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  locrian: [0, 1, 3, 5, 6, 8, 10],
};

// Krumhansl-Kessler profiles: how strongly each scale degree implies a key
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

function correlation(a, b) {
  const mean = (x) => x.reduce((s, v) => s + v, 0) / x.length;
  const [ma, mb] = [mean(a), mean(b)];
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < a.length; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return da && db ? num / Math.sqrt(da * db) : 0;
}

/**
 * estimate the key from how long each pitch class sounds (12 weights).
 * the tonic comes from the Krumhansl-Kessler profiles, with bass notes
 * counted extra (in techno the drone or bass root is the strongest tonic
 * cue); the mode is the one on that tonic that leaves the least note time
 * outside the scale. returns null without pitched notes
 */
export function detectKey(weights, bassWeights) {
  const total = weights.reduce((a, b) => a + b, 0);
  if (!total) return null;
  const cue = weights.map((w, i) => w + 2 * bassWeights[i]);
  let best = { score: -Infinity };
  for (let tonic = 0; tonic < 12; tonic++) {
    const rotated = cue.map((_, i) => cue[(i + tonic) % 12]);
    for (const [quality, profile] of [['major', MAJOR_PROFILE], ['minor', MINOR_PROFILE]]) {
      const score = correlation(rotated, profile);
      if (score > best.score) best = { score, tonic, quality };
    }
  }
  const outside = (mode) => weights.reduce((sum, w, pc) => sum + (MODES[mode].includes((pc - best.tonic + 12) % 12) ? 0 : w), 0);
  // the profile's own quality wins ties, so plain minor/major is preferred
  const modes = [best.quality, ...Object.keys(MODES).filter((m) => m !== best.quality)];
  const mode = modes.reduce((a, b) => (outside(b) < outside(a) - 1e-9 ? b : a));
  const scale = MODES[mode].map((i) => (i + best.tonic) % 12);
  return { name: `${NAMES[best.tonic]} ${mode}`, tonic: best.tonic, mode, scale, outside: outside(mode) / total, confidence: best.score };
}
