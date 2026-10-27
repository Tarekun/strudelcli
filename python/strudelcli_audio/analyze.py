"""review a track rendered by render.mjs: loudness, peaks, frequency balance
and clashes between instruments. writes <out>/report.md

  python -m strudelcli_audio analyze out/<track> [--reference some-track.wav]

the thresholds below are starting points for an unmastered techno mix, not
rules: tune them once you've compared a few reports against what you hear.
with --reference the frequency balance is compared against a track you like
instead of against the track's own average slope, which is far more reliable
"""

import argparse
import json
import re
import subprocess
from pathlib import Path

import numpy as np
import pyloudnorm as pyln
import soundfile as sf

LUFS_RANGE = (-14.0, -9.0)  # integrated loudness: below = too quiet, above = no headroom left for mastering
MAX_TRUE_PEAK = -1.0  # dBTP: above this, converters and lossy encoders clip
MIN_CREST = 6.0  # dB peak-to-RMS per section: below = squashed, the kick has no punch left
MAX_BASS_WIDTH = -10.0  # dB side-vs-mid below 150 Hz: above = bass smeared in stereo, cancels on mono club systems
CLASH_SHARE = 0.25  # two instruments both prominent in a band for this share of a section's frames = clash
PROMINENT = 6.0  # dB: an instrument within this much of the whole mix in a band is a main contributor there
BUMP, HOLE = 5.0, -7.0  # dB residual from the smooth spectral trend that counts as a bump / a hole
REFERENCE_DIFF = 4.0  # dB difference per region against the reference track

FRAME = 4096  # ~93 ms at 44.1 kHz: fine enough to separate kick from offbeat bass, coarse enough for 40 Hz

# analysis bands: one sub band, then third octaves from 40 Hz to 16 kHz
CENTERS = np.array([30.0] + [1000 * 2 ** (k / 3) for k in range(-14, 13)])
EDGES = np.array([20.0] + [c * 2 ** (1 / 6) for c in CENTERS[:-1]] + [CENTERS[-1] * 2 ** (1 / 6)])
EDGES[1] = CENTERS[1] * 2 ** (-1 / 6)
REGIONS = [
    ('sub', 20, 60, 'kick body and rumble'),
    ('bass', 60, 250, 'bass and kick punch'),
    ('low-mids', 250, 500, 'mud: pads, drones and bass harmonics pile up here'),
    ('mids', 500, 2000, 'body of leads, chords, voices'),
    ('high-mids', 2000, 6000, 'presence and harshness: claps, distortion, leads'),
    ('air', 6000, 20000, 'hats, cymbals, noise'),
]


def region_of(center):
    return next(name for name, lo, hi, _ in REGIONS if lo <= center < hi)


def db(x, floor=1e-12):
    return 10 * np.log10(np.maximum(x, floor))


def band_frames(path):
    """energy per (frame, band) of a stereo wav, as total (L²+R²) and side (S²)"""
    info = sf.info(str(path))
    freqs = np.fft.rfftfreq(FRAME, 1 / info.samplerate)
    lo, hi = np.searchsorted(freqs, EDGES[:-1]), np.searchsorted(freqs, EDGES[1:])
    window = np.hanning(FRAME).astype(np.float32)
    totals, sides = [], []
    for block in sf.blocks(str(path), blocksize=FRAME * 256, dtype='float32', always_2d=True, fill_value=0):
        n = len(block) // FRAME
        frames = block[: n * FRAME].reshape(n, FRAME, 2)
        left, right = (np.abs(np.fft.rfft(frames[..., c] * window, axis=1)) ** 2 for c in (0, 1))
        side = np.abs(np.fft.rfft((frames[..., 0] - frames[..., 1]) / 2 * window, axis=1)) ** 2
        for spec, out in ((left + right, totals), (side, sides)):
            cum = np.concatenate([np.zeros((n, 1)), np.cumsum(spec, axis=1)], axis=1)
            out.append(cum[:, hi] - cum[:, lo])
    return np.concatenate(totals), np.concatenate(sides), info.samplerate


def ffmpeg_loudness(path):
    """integrated loudness, loudness range and true peak via ffmpeg's EBU R128 meter"""
    log = subprocess.run(
        ['ffmpeg', '-nostats', '-hide_banner', '-i', str(path), '-filter_complex', 'ebur128=peak=true', '-f', 'null', '-'],
        capture_output=True, text=True, check=True,
    ).stderr
    summary = log[log.rfind('Summary:'):]
    get = lambda key: float(re.search(rf'{key}:\s+(-?[\d.]+|-inf)', summary).group(1))
    return {'lufs': get('I'), 'lra': get('LRA'), 'true_peak': get('Peak')}


def groups_of(meta):
    """consecutive sections with the same label, as (label, first bar, bars, instruments)"""
    groups = []
    for s in meta['sections'] or [{'label': 'track', 'from': meta['from'], 'bars': meta['to'] - meta['from'], 'parts': []}]:
        if groups and groups[-1]['label'] == s['label']:
            groups[-1]['bars'] += s['bars']
            groups[-1]['parts'] |= set(s['parts'])
        else:
            groups.append({'label': s['label'] or f"bar {s['from']}", 'from': s['from'], 'bars': s['bars'], 'parts': set(s['parts'])})
    return groups


def spectral_residuals(levels):
    """per-band deviation (dB) from a straight line fitted over 40 Hz - 12 kHz, and the slope in dB/octave"""
    fit = (CENTERS >= 40) & (CENTERS <= 12000)
    x = np.log2(CENTERS)
    slope, offset = np.polyfit(x[fit], levels[fit], 1)
    return levels - (slope * x + offset), slope


def by_region(values):
    return {name: float(np.mean(values[(CENTERS >= lo) & (CENTERS < hi)])) for name, lo, hi, _ in REGIONS}


def band_range(bands):
    return f'{EDGES[bands[0]]:.0f}-{EDGES[bands[-1] + 1]:.0f} Hz'


def analyze(out, reference=None):
    meta = json.loads((out / 'meta.json').read_text())
    mix = out / 'mix.wav'
    rate = sf.info(str(mix)).samplerate
    to_frame = lambda bar: int((bar - meta['from']) / meta['cps'] * rate / FRAME)
    to_sample = lambda bar: int((bar - meta['from']) / meta['cps'] * rate)

    overall = ffmpeg_loudness(mix)
    mix_total, mix_side, _ = band_frames(mix)
    stems = {s['name']: band_frames(out / s['file'])[0] for s in meta['stems']}
    ref_regions = None
    if reference:
        ref_total, _, _ = band_frames(reference)
        ref_regions = by_region(db(ref_total.mean(axis=0)) - db(ref_total.mean(axis=0)).max())

    meter = pyln.Meter(rate)
    findings = []  # (severity, where, message)
    rows = []
    for g in groups_of(meta):
        f0, f1 = to_frame(g['from']), to_frame(g['from'] + g['bars'])
        audio, _ = sf.read(str(mix), start=to_sample(g['from']), stop=to_sample(g['from'] + g['bars']), dtype='float64')
        if len(audio) < rate:
            continue
        where = g['label']
        lufs = meter.integrated_loudness(audio)
        peak = np.abs(audio).max()
        rms = np.sqrt(np.mean(audio**2))
        crest = 20 * np.log10(peak / max(rms, 1e-12))
        clipped = int(np.sum(np.abs(audio) >= 1.0))
        total = mix_total[f0:f1]
        low = CENTERS < 150
        width = db(mix_side[f0:f1][:, low].sum()) - db((total[:, low].sum() - 2 * mix_side[f0:f1][:, low].sum()) / 2)
        levels = db(total.mean(axis=0))
        residuals, slope = spectral_residuals(levels)
        regions = by_region(residuals)
        rows.append({'where': where, 'bars': g['bars'], 'lufs': lufs, 'peak': 20 * np.log10(max(peak, 1e-12)), 'crest': crest, 'clipped': clipped, 'width': width, 'slope': slope, 'regions': regions})

        # which stems carry each region's energy in this section, for suggestions
        present = {name: e[f0:f1] for name, e in stems.items() if name in g['parts'] and len(e) >= f1}

        def carriers(region):
            lo, hi = next((lo, hi) for name, lo, hi, _ in REGIONS if name == region)
            band = (CENTERS >= lo) & (CENTERS < hi)
            energy = {n: e[:, band].sum() for n, e in present.items()}
            whole = sum(energy.values()) or 1
            top = sorted(energy.items(), key=lambda kv: -kv[1])[:3]
            return ', '.join(f'{n} {100 * v / whole:.0f}%' for n, v in top if v / whole > 0.1)

        if clipped:
            findings.append(('error', where, f'{clipped} clipped samples (|x| >= 1.0): lower the gain of the loudest parts or ease off distort/shape'))
        if crest < MIN_CREST:
            findings.append(('warn', where, f'crest factor {crest:.1f} dB: squashed, transients have no room. Usually too much distort/shape on many layers at once'))
        if width > MAX_BASS_WIDTH:
            findings.append(('warn', where, f'stereo bass: side is only {-width:.1f} dB below mid under 150 Hz. Keep low parts centred (no pan/jux/spread on them)'))

        for (name, lo, hi, why) in REGIONS:
            value = regions[name]
            if ref_regions is not None:
                diff = (levels[(CENTERS >= lo) & (CENTERS < hi)].mean() - levels.max()) - ref_regions[name]
                if abs(diff) > REFERENCE_DIFF:
                    word = 'more' if diff > 0 else 'less'
                    findings.append(('warn', where, f'{name} ({lo}-{hi} Hz): {abs(diff):.1f} dB {word} than the reference. Carried by: {carriers(name) or "-"}'))
            elif name in ('sub', 'bass'):
                continue  # techno is bass-heavy on purpose: only checkable against a reference
            elif value > BUMP:
                findings.append(('warn', where, f'{name} bump +{value:.1f} dB ({why}). Carried by: {carriers(name) or "-"}'))
            elif value < HOLE and name != 'air':
                findings.append(('info', where, f'{name} hole {value:.1f} dB: nothing much lives at {lo}-{hi} Hz here'))

        # clashes: pairs of instruments both prominent in the same bands at the same time
        mix_e = np.maximum(total, 1e-12)
        audible = db(mix_e) > db(mix_e.mean(axis=0)).max() - 50  # skip near-silent band/frames
        prominent = {n: (db(e) > db(mix_e) - PROMINENT) & audible for n, e in present.items()}
        names = sorted(prominent)
        usable = (CENTERS >= 40) & (CENTERS <= 10000)
        for i, a in enumerate(names):
            for b in names[i + 1:]:
                share = (prominent[a] & prominent[b]).mean(axis=0) * usable
                hot = np.flatnonzero(share > CLASH_SHARE)
                if not len(hot):
                    continue
                runs = np.split(hot, np.flatnonzero(np.diff(hot) > 1) + 1)
                ranges = ', '.join(f'{band_range(r)} ({100 * share[r].max():.0f}% of the time)' for r in runs)
                findings.append(('clash', where, f'{a} x {b}: {ranges}'))

    lufs_lo, lufs_hi = LUFS_RANGE
    if overall['lufs'] < lufs_lo:
        findings.insert(0, ('warn', 'whole track', f"integrated {overall['lufs']:.1f} LUFS: quieter than {lufs_lo} LUFS, raise the overall gain"))
    elif overall['lufs'] > lufs_hi:
        findings.insert(0, ('warn', 'whole track', f"integrated {overall['lufs']:.1f} LUFS: louder than {lufs_hi} LUFS, no headroom left for mastering"))
    if overall['true_peak'] > MAX_TRUE_PEAK:
        findings.insert(0, ('error', 'whole track', f"true peak {overall['true_peak']:.1f} dBTP, above {MAX_TRUE_PEAK} dBTP: it will distort on playback and encoding"))
    return meta, overall, rows, findings, reference


def report(out, meta, overall, rows, findings, reference):
    order = {'error': 0, 'warn': 1, 'clash': 2, 'info': 3}
    counts = {k: sum(1 for f in findings if f[0] == k) for k in order}
    name = Path(meta['track']).name
    length = (meta['to'] - meta['from']) / meta['cps']
    lines = [
        f'# Review: {name}',
        '',
        f"bars {meta['from']}-{meta['to']}, {int(length // 60)}:{int(length % 60):02d}, {len(meta['stems'])} stems"
        + (f', frequency balance compared against `{Path(reference).name}`' if reference else ', frequency balance compared against its own spectral slope (no reference given)'),
        '',
        f"**{counts['error']} errors, {counts['warn']} warnings, {counts['clash']} clashes, {counts['info']} notes**",
        '',
        '## Whole track',
        '',
        '| integrated | loudness range | true peak |',
        '|---|---|---|',
        f"| {overall['lufs']:.1f} LUFS (target {LUFS_RANGE[0]:.0f} to {LUFS_RANGE[1]:.0f}) | {overall['lra']:.1f} LU | {overall['true_peak']:.1f} dBTP (max {MAX_TRUE_PEAK:.0f}) |",
        '',
        '## Findings',
        '',
    ]
    for severity in order:
        items = [f for f in findings if f[0] == severity]
        if items:
            lines += [f'### {severity}', ''] + [f'- **{where}**: {msg}' for _, where, msg in items] + ['']
    if not findings:
        lines += ['nothing flagged', '']
    lines += [
        '## Sections',
        '',
        'loudness per section, then the spectrum as dB above/below the section\'s own smooth slope (+ = bump, - = hole)',
        '',
        '| section | bars | LUFS | peak dBFS | crest dB | clipped | bass width dB | slope dB/oct | ' + ' | '.join(r[0] for r in REGIONS) + ' |',
        '|---|' + '---|' * (8 + len(REGIONS)),
    ]
    for r in rows:
        lines.append(
            f"| {r['where']} | {r['bars']} | {r['lufs']:.1f} | {r['peak']:.1f} | {r['crest']:.1f} | {r['clipped']} | {r['width']:.1f} | {r['slope']:.1f} | "
            + ' | '.join(f"{r['regions'][n]:+.1f}" for n, *_ in REGIONS)
            + ' |'
        )
    (out / 'report.md').write_text('\n'.join(lines) + '\n')
    return out / 'report.md'


def main(argv):
    parser = argparse.ArgumentParser(prog='strudelcli_audio analyze', description='review a rendered strudel track')
    parser.add_argument('out', type=Path, help='render.mjs output directory (with meta.json and mix.wav)')
    parser.add_argument('--reference', type=Path, help='a finished track to compare the frequency balance against')
    args = parser.parse_args(argv)
    path = report(args.out, *analyze(args.out, args.reference))
    print(path)
