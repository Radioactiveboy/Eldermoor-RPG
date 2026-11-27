#!/usr/bin/env python3
"""
Makes the Mere-kin's sounds in public/audio/sfx/ (the lizard folk of the fen,
see src/art/merekin3d.ts): their hisses, their cries when hurt, their death
rattles, the war-chief's bellow, and a harpoon thrown on its line.

  python3 tools/build-merekin-sound.py <folder>

where <folder> holds a clone of Meta-open-sound under the name `meta` (as for
tools/build-sound.py). Needs ffmpeg and numpy.

Nothing in the Oculus pack sounds like a lizard, so each is built: the hiss is
noise shaped like breath forced through a narrow throat (a band of hiss that
opens and closes, a rattle of the throat under it); the cries are the pack's
troll and giant voices slowed and deepened, put through the same rattle so they
come out guttural and wet, with a hiss on the end; and the harpoon is a swoosh
with the whirr of its line paying out after it. The noise is seeded, so the
same files come out every time.
"""
import importlib.util
import json
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.dont_write_bytecode = True
_spec = importlib.util.spec_from_file_location('ambience', ROOT / 'tools' / 'build-ambience.py')
amb = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(amb)
_spec2 = importlib.util.spec_from_file_location('sound', ROOT / 'tools' / 'build-sound.py')
snd = importlib.util.module_from_spec(_spec2)
_spec2.loader.exec_module(snd)
RATE = amb.RATE
OUT = ROOT / 'public' / 'audio' / 'sfx'
OC = 'meta/corpora/oculus-audio-pack/ogg/'

rng = np.random.default_rng(1207)


def band(x: np.ndarray, lo: float, hi: float) -> np.ndarray:
    """A brick-wall band-pass in the frequency domain (fine for noise)."""
    f = np.fft.rfft(x)
    freqs = np.fft.rfftfreq(len(x), 1 / RATE)
    f[(freqs < lo) | (freqs > hi)] = 0
    return np.fft.irfft(f, len(x))


def sweep_band(x: np.ndarray, lo: np.ndarray, hi: np.ndarray, block=1024) -> np.ndarray:
    """A band-pass whose edges move over time (per block, overlapped), for a hiss that opens and closes."""
    out = np.zeros(len(x) + block)
    win = np.hanning(block * 2)
    for i in range(0, len(x), block):
        seg = x[i:i + block * 2]
        if len(seg) < 8:
            break
        w = win[:len(seg)]
        j = min(i, len(lo) - 1)
        out[i:i + len(seg)] += band(seg * w, lo[j], hi[j])
    return out[:len(x)]


def env(n: int, attack: float, hold: float, release: float, curve=2.0) -> np.ndarray:
    a, h = int(attack * RATE), int(hold * RATE)
    r = max(1, n - a - h)
    return np.concatenate([np.linspace(0, 1, a) ** 0.6, np.ones(h), np.linspace(1, 0, r) ** curve])[:n]


def rattle(n: int, hz: float, depth: float, jitter=0.15) -> np.ndarray:
    """The throat's rattle: a fast, uneven flutter of the loudness."""
    t = np.arange(n) / RATE
    wobble = hz * (1 + jitter * np.sin(2 * np.pi * 1.7 * t + rng.uniform(0, 6)))
    phase = 2 * np.pi * np.cumsum(wobble) / RATE
    return 1 - depth * (0.5 + 0.5 * np.sign(np.sin(phase)) * np.abs(np.sin(phase)) ** 0.5)


def hiss(seconds: float, lo=2200.0, hi=7600.0, rattle_hz=26.0, throat=0.35) -> np.ndarray:
    n = int(seconds * RATE)
    noise = rng.standard_normal(n)
    t = np.linspace(0, 1, n)
    # The band opens as the breath is forced out, and narrows as it runs out.
    lo_t = lo * (1.25 - 0.35 * np.sin(np.pi * t))
    hi_t = hi * (0.75 + 0.3 * np.sin(np.pi * t))
    h = sweep_band(noise, lo_t, hi_t)
    # A breathy low part under it, and the rattle of the throat at the start.
    breath = band(rng.standard_normal(n), 500, 1600) * 0.35
    shake = rattle(n, rattle_hz, throat) * (1 - t * 0.7) + t * 0.7 * 1
    y = (h + breath) * shake * env(n, 0.04, seconds * 0.35, seconds * 0.6, 1.6)
    return y


def voice(path: str, rate: float, rattle_hz: float, depth: float, src: Path, end=0.0) -> np.ndarray:
    """A recorded cry, slowed (deeper), with the throat's rattle through it."""
    a = amb.decode(src / path).mean(axis=1)
    if end:
        a = a[:int(end * RATE)]
    a = snd.strip_silence(np.stack([a, a], axis=1)).mean(axis=1)
    # Slower and deeper: resample by `rate` (below 1 stretches it).
    idx = np.arange(0, len(a) - 1, rate)
    a = np.interp(idx, np.arange(len(a)), a)
    # Take the air out of it a little, so it's less human: thin the low body, keep the grit.
    a = a - 0.5 * band(a, 0, 220)
    return a * rattle(len(a), rattle_hz, depth)


def stereo(a: np.ndarray) -> np.ndarray:
    return np.stack([a, a], axis=1)


def mix(*parts) -> np.ndarray:
    """Lays (signal, offset seconds, gain) over one another."""
    n = max(int(o * RATE) + len(s) for s, o, _ in parts)
    out = np.zeros(n)
    for s, o, g in parts:
        i = int(o * RATE)
        out[i:i + len(s)] += s * g
    return out


def finish(a: np.ndarray, name: str, db: float, made: dict) -> None:
    a = stereo(a / (np.max(np.abs(a)) + 1e-9))
    a = amb.level(amb.trim(a, 0.004, min(0.12, len(a) / RATE / 4)), db, peak=0.85)
    snd.encode(a, OUT / f'{name}.mp3', mono=True, kbps=64)
    made[f'sfx/{name}'] = round(len(a) / RATE, 2)


def main() -> None:
    src = Path(sys.argv[1])
    made: dict = {}
    # Hisses: as they square up, rally, and jeer. Three takes, of different lengths and throats.
    finish(hiss(0.9, 2400, 7800, 24, 0.4), 'mere-hiss-1', -22, made)
    finish(hiss(1.25, 1900, 6800, 30, 0.5), 'mere-hiss-2', -22, made)
    finish(mix((hiss(0.35, 2600, 8200, 34, 0.3), 0, 0.8), (hiss(0.8, 2100, 7200, 22, 0.45), 0.28, 1)), 'mere-hiss-3', -22, made)
    # Hurt: a troll's yell slowed and rattled, a short hiss after it.
    for i, (f, rate, hz) in enumerate([('CREAHmn_TrollHurt_OS_01.ogg', 0.74, 31), ('CREAHmn_TrollHurt_OS_02.ogg', 0.7, 27), ('CREAHmn_TrollHurt_OS_03.ogg', 0.78, 35)], 1):
        cry = voice(OC + f, rate, hz, 0.55, src)
        finish(mix((cry, 0, 1), (hiss(0.45, 2600, 7600, 28, 0.3), len(cry) / RATE - 0.12, 0.45)), f'mere-hurt-{i}', -21, made)
    # Dying: a giant's death cry slowed and rattled, running out in a long falling hiss.
    for i, (f, rate, hz, end) in enumerate([('CREAHmn_TrollDeath_OS_01.ogg', 0.68, 24, 0), ('CREAHmn_GiantDeath_OS_02.ogg', 0.86, 22, 1.4)], 1):
        cry = voice(OC + f, rate, hz, 0.6, src, end)
        tail = hiss(1.1, 1500, 5200, 16, 0.6)
        finish(mix((cry, 0, 1), (tail, len(cry) / RATE - 0.25, 0.4)), f'mere-death-{i}', -21, made)
    # The war-chief: a giant's roar, deep and rattling, with a great hiss under it.
    roar = voice(OC + 'CREAHmn_GiantHurt_OS_01.ogg', 0.8, 20, 0.5, src)
    finish(mix((roar, 0, 1), (hiss(1.4, 1500, 6000, 18, 0.55), 0.1, 0.55)), 'mere-chief-1', -20, made)
    roar = voice(OC + 'CREAHmn_GiantLaugh_OS_02.ogg', 0.85, 22, 0.5, src, 1.6)
    finish(mix((roar, 0, 1), (hiss(0.9, 1800, 6400, 20, 0.5), len(roar) / RATE - 0.3, 0.5)), 'mere-chief-2', -20, made)
    chief_death = voice(OC + 'CREAHmn_GiantDeath_OS_01.ogg', 0.8, 18, 0.55, src, 2)
    finish(mix((chief_death, 0, 1), (hiss(1.6, 1200, 4800, 14, 0.6), len(chief_death) / RATE - 0.4, 0.45)), 'mere-chief-death-1', -20, made)
    # A harpoon thrown: the swoosh of it, and its line whirring out after.
    for i, f in enumerate(['SWSH_Swoosh_OS_02.ogg', 'WHSH_WhooshSmall_OS_02.ogg'], 1):
        sw = amb.decode(src / (OC + f)).mean(axis=1)
        sw = snd.strip_silence(stereo(sw)).mean(axis=1)[:int(0.5 * RATE)]
        n = int(0.6 * RATE)
        t = np.arange(n) / RATE
        line = sweep_band(rng.standard_normal(n), np.linspace(1800, 3200, n), np.linspace(2600, 5200, n))
        line *= (0.6 + 0.4 * np.sign(np.sin(2 * np.pi * (60 - 30 * t / 0.6) * t))) * env(n, 0.02, 0.1, 0.48, 1.2)
        finish(mix((sw, 0, 1), (line, 0.12, 0.35)), f'harpoon-{i}', -22, made)
    print(json.dumps(made, indent=1))


if __name__ == '__main__':
    main()
