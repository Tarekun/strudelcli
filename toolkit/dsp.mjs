// audio measurements in plain js: levels, third-octave band energies per
// frame, stereo width and envelope, for interleaved stereo float32 audio

export const FRAME = 4096; // ~93 ms at 44.1 kHz, same as analyze.py

// analysis bands: one sub band, then third octaves from 40 Hz to 16 kHz
export const CENTERS = [30, ...Array.from({ length: 27 }, (_, i) => 1000 * 2 ** ((i - 14) / 3))];
export const EDGES = [20, ...CENTERS.slice(1).map((c) => c * 2 ** (-1 / 6)), CENTERS[CENTERS.length - 1] * 2 ** (1 / 6)];

// in-place radix-2 fft
export function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const angle = (-2 * Math.PI) / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const [cos, sin] = [Math.cos(angle * k), Math.sin(angle * k)];
        const [a, b] = [i + k, i + k + len / 2];
        const tr = re[b] * cos - im[b] * sin;
        const ti = re[b] * sin + im[b] * cos;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
      }
    }
  }
}

const hann = Float64Array.from({ length: FRAME }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FRAME - 1)));

// energy per band of one windowed frame of a mono signal
function bandEnergies(signal, offset, rate) {
  const re = new Float64Array(FRAME);
  const im = new Float64Array(FRAME);
  for (let i = 0; i < FRAME; i++) re[i] = (signal[offset + i] ?? 0) * hann[i];
  fft(re, im);
  const bands = new Float64Array(CENTERS.length);
  for (let bin = 1; bin < FRAME / 2; bin++) {
    const f = (bin * rate) / FRAME;
    const band = EDGES.findIndex((edge, i) => i < CENTERS.length && f >= edge && f < EDGES[i + 1]);
    if (band >= 0) bands[band] += re[bin] ** 2 + im[bin] ** 2;
  }
  return bands;
}

/**
 * measure interleaved stereo audio: { rms, peak, crest, duty, frames, sides }
 * frames[i][band] is the L+R energy of frame i, sides[i][band] the side
 * (L-R) energy. duty is the share of 20 ms windows within 20 dB of the
 * loudest one: low for short hits, high for sustained sounds
 */
export function measure(audio, rate) {
  const n = audio.length / 2;
  const left = new Float32Array(n);
  const right = new Float32Array(n);
  const side = new Float32Array(n);
  let sum = 0;
  let peak = 0;
  for (let i = 0; i < n; i++) {
    left[i] = audio[2 * i];
    right[i] = audio[2 * i + 1];
    side[i] = (left[i] - right[i]) / 2;
    sum += left[i] ** 2 + right[i] ** 2;
    peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
  }
  const rms = Math.sqrt(sum / (2 * n || 1));

  const window = Math.round(rate * 0.02);
  const levels = [];
  for (let i = 0; i + window <= n; i += window) {
    let s = 0;
    for (let j = i; j < i + window; j++) s += left[j] ** 2 + right[j] ** 2;
    levels.push(s / window);
  }
  const loudest = Math.max(...levels, 1e-20);
  const duty = levels.filter((l) => l > loudest / 100).length / (levels.length || 1);

  const frames = [];
  const sides = [];
  for (let offset = 0; offset + FRAME <= n; offset += FRAME) {
    const l = bandEnergies(left, offset, rate);
    const r = bandEnergies(right, offset, rate);
    frames.push(l.map((v, b) => v + r[b]));
    sides.push(bandEnergies(side, offset, rate));
  }
  return { rms, peak, crest: 20 * Math.log10(peak / (rms || 1e-12) || 1), duty, frames, sides };
}

export const db = (x) => 10 * Math.log10(Math.max(x, 1e-20));

// frequency at which the cumulative band energy reaches `share` of the total
export function percentileFrequency(bands, share) {
  const total = bands.reduce((a, b) => a + b, 0);
  let cum = 0;
  for (let b = 0; b < bands.length; b++) {
    cum += bands[b];
    if (cum >= share * total) return CENTERS[b];
  }
  return CENTERS[CENTERS.length - 1];
}

// energy-weighted mean frequency, on a log scale (how high it "sounds")
export function centroid(bands) {
  const total = bands.reduce((a, b) => a + b, 0) || 1;
  return 2 ** bands.reduce((s, e, b) => s + (e / total) * Math.log2(CENTERS[b]), 0);
}

export const hz = (f) => (f >= 1000 ? `${(f / 1000).toFixed(f >= 10000 ? 0 : 1)} kHz` : `${Math.round(f)} Hz`);

// A-weighting per band as a power factor: how loud each band sounds to the
// ear relative to 1 kHz (the low end counts far less than its raw energy)
const aWeightDb = (f) => {
  const f2 = f * f;
  const ra = (12194 ** 2 * f2 * f2) / ((f2 + 20.6 ** 2) * Math.sqrt((f2 + 107.7 ** 2) * (f2 + 737.9 ** 2)) * (f2 + 12194 ** 2));
  return 20 * Math.log10(ra) + 2;
};
export const A_WEIGHT = CENTERS.map((f) => 10 ** (aWeightDb(f) / 10));

// total A-weighted energy of measured frames
export const perceivedEnergy = (frames) => frames.reduce((s, f) => s + f.reduce((t, e, b) => t + e * A_WEIGHT[b], 0), 0);
