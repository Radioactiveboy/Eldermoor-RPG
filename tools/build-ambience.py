#!/usr/bin/env python3
"""
Cuts the recorded ambience in public/audio/ambience/ from the original
recordings listed in public/audio/ambience/CREDITS.md.

  python3 tools/build-ambience.py <folder>

where <folder> holds clones of the repositories the recordings were found in
(omarchy-ambient, moodist, Blankie, meta = Meta-open-sound, and the two Kenney
Godot ports), under the names used in the paths below.

Needs ffmpeg and numpy. Steady sounds ("beds") are cut to a stretch, their end
crossfaded into their start so they loop without a seam, levelled to the same
loudness, and saved as MP3. One-off sounds (an owl, a wolf's howl, the smith's
hammer, a mug on a table) are split out, trimmed of silence and levelled.
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np

RATE = 44100
OUT = Path(__file__).resolve().parent.parent / 'public' / 'audio' / 'ambience'

# name: (source file, start s, length s, crossfade s, high-pass Hz or 0, low-pass Hz or 0)
BEDS = {
    'wind': ('omarchy-ambient/sounds/wind.ogg', 20, 60, 3, 0, 0),
    'birds': ('omarchy-ambient/sounds/birds.ogg', 10, 60, 3, 120, 0),
    'crickets': ('omarchy-ambient/sounds/crickets.ogg', 30, 60, 3, 200, 0),
    'water': ('meta/corpora/oculus-audio-pack/ogg/WATRLap_WaterLapping_LOOP_01.ogg', 0, 42, 3, 0, 0),
    'frogs': ('moodist/public/sounds/animals/frog.mp3', 0, 74, 3, 150, 0),
    'market': ('moodist/public/sounds/urban/crowd.mp3', 2, 66, 3, 140, 0),
    'taproom': ('moodist/public/sounds/places/crowded-bar.mp3', 1, 54, 3, 90, 0),
    'fire': ('Blankie/Blankie/Resources/Sounds/fireplace.m4a', 0, 24, 2, 40, 0),
    'bees': ('moodist/public/sounds/animals/beehive.mp3', 1, 42, 3, 60, 0),
    'drips': ('moodist/public/sounds/nature/droplets.mp3', 1, 48, 3, 0, 0),
}

# name: (source file, [(start s, end s), ...]) -- each cut becomes name-1, name-2, ...
SHOTS = {
    'owl': ('moodist/public/sounds/animals/owl.mp3', [(2.9, 6.4), (8.9, 12.98)]),
    'wolf': ('moodist/public/sounds/animals/wolf.mp3', 'auto'),
    'anvil': ('meta/corpora/oculus-audio-pack/ogg/METLImpt_HammerAnvilAmbient_OS_01.ogg', 'auto'),
}
# Single files used whole: name -> source file
SINGLES = {
    'clink-1': 'kenney-impact-sounds-for-godot/addons/kenney impact sounds/impact_glass_light_000.ogg',
    'clink-2': 'kenney-impact-sounds-for-godot/addons/kenney impact sounds/impact_glass_light_002.ogg',
    'clink-3': 'kenney-impact-sounds-for-godot/addons/kenney impact sounds/impact_glass_medium_001.ogg',
    'clink-4': 'kenney-impact-sounds-for-godot/addons/kenney impact sounds/impact_plate_light_000.ogg',
    'clink-5': 'kenney-impact-sounds-for-godot/addons/kenney impact sounds/impact_plate_light_003.ogg',
    'clink-6': 'kenney-impact-sounds-for-godot/addons/kenney impact sounds/impact_plate_medium_002.ogg',
    'clink-7': 'kenney-rpg-audio-for-godot/addons/kenney rpg audio/metal_pot_1.ogg',
    'clink-8': 'kenney-rpg-audio-for-godot/addons/kenney rpg audio/metal_pot_3.ogg',
    'clink-9': 'kenney-impact-sounds-for-godot/addons/kenney impact sounds/impact_wood_light_001.ogg',
    'anvil-strike': 'meta/corpora/oculus-audio-pack/ogg/METLImpt_HammerAnvil_OS_01.ogg',
}


# Extra ffmpeg filters for a bed, e.g. to tame the fire's loud crackles.
EXTRA = {
    'fire': 'acompressor=threshold=-32dB:ratio=8:attack=0.5:release=60:makeup=4,alimiter=limit=0.6',
}


def decode(path: Path, hp=0, lp=0, extra='') -> np.ndarray:
    filters = [extra] if extra else []
    if hp:
        filters.append(f'highpass=f={hp}')
    if lp:
        filters.append(f'lowpass=f={lp}')
    cmd = ['ffmpeg', '-v', 'error', '-i', str(path), '-ac', '2', '-ar', str(RATE)]
    if filters:
        cmd += ['-af', ','.join(filters)]
    cmd += ['-f', 'f32le', '-']
    raw = subprocess.run(cmd, check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).copy()


def encode(audio: np.ndarray, name: str, mono: bool, kbps: int) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    cmd = ['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(RATE), '-ac', '2', '-i', '-']
    if mono:
        cmd += ['-ac', '1']
    cmd += ['-c:a', 'libmp3lame', '-b:a', f'{kbps}k', str(OUT / f'{name}.mp3')]
    subprocess.run(cmd, input=audio.astype(np.float32).tobytes(), check=True)


def rms_db(a: np.ndarray) -> float:
    return 20 * np.log10(np.sqrt(np.mean(a ** 2)) + 1e-12)


def level(a: np.ndarray, target_db: float, peak=0.7) -> np.ndarray:
    a = a * 10 ** ((target_db - rms_db(a)) / 20)
    top = np.max(np.abs(a))
    return a * (peak / top) if top > peak else a


def loop(a: np.ndarray, fade_s: float) -> np.ndarray:
    """Crossfades the last `fade_s` seconds into the start (equal power), so it loops seamlessly."""
    n = int(fade_s * RATE)
    body, tail = a[:-n].copy(), a[-n:]
    k = np.linspace(0, 1, n)[:, None]
    body[:n] = body[:n] * np.sin(k * np.pi / 2) + tail * np.cos(k * np.pi / 2)
    return body


def cuts_by_energy(a: np.ndarray, quiet_db=-40, gap_s=0.6, min_s=0.8):
    """Finds the loud stretches (howls, hammer blows) separated by quiet gaps."""
    win = int(0.05 * RATE)
    frames = len(a) // win
    e = np.array([rms_db(a[i * win:(i + 1) * win]) for i in range(frames)])
    loud = e > (e.max() + quiet_db / 2)
    out, start, quiet = [], None, 0
    for i, on in enumerate(loud):
        if on:
            start = i if start is None else start
            quiet = 0
        elif start is not None:
            quiet += 1
            if quiet * win / RATE >= gap_s:
                end = i - quiet + 1
                if (end - start) * win / RATE >= min_s:
                    out.append(((start * win) / RATE - 0.15, (end * win) / RATE + 0.5))
                start, quiet = None, 0
    if start is not None:
        out.append(((start * win) / RATE - 0.15, len(a) / RATE))
    return out


def trim(a: np.ndarray, fade_in=0.02, fade_out=0.25) -> np.ndarray:
    a = a.copy()
    i, o = int(fade_in * RATE), min(len(a), int(fade_out * RATE))
    a[:i] *= np.linspace(0, 1, i)[:, None]
    a[-o:] *= np.linspace(1, 0, o)[:, None]
    return a


def main() -> None:
    src = Path(sys.argv[1])
    made = {}
    for name, (f, start, length, fade, hp, lp) in BEDS.items():
        a = decode(src / f, hp, lp, EXTRA.get(name, ''))
        s = int(start * RATE)
        a = a[s:s + int((length + fade) * RATE)]
        a = level(loop(a, fade), -24)
        encode(a, name, mono=True, kbps=64)
        made[name] = round(len(a) / RATE, 2)
    for name, (f, spans) in SHOTS.items():
        a = decode(src / f, 80)
        if spans == 'auto':
            spans = cuts_by_energy(a)
        for i, (s, e) in enumerate(spans, 1):
            cut = a[max(0, int(s * RATE)):int(e * RATE)]
            cut = level(trim(cut), -22)
            encode(cut, f'{name}-{i}', mono=True, kbps=64)
            made[f'{name}-{i}'] = round(len(cut) / RATE, 2)
    for name, f in SINGLES.items():
        a = level(trim(decode(src / f, 120), 0.002, 0.05), -24)
        encode(a, name, mono=True, kbps=64)
        made[name] = round(len(a) / RATE, 2)
    print(json.dumps(made, indent=1))


if __name__ == '__main__':
    main()
