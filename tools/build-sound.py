#!/usr/bin/env python3
"""
Cuts the recorded music in public/audio/music/ and the fight sounds and voice
barks in public/audio/sfx/ from the original recordings listed in the
CREDITS.md file in each folder.

  python3 tools/build-sound.py <folder>

where <folder> holds clones of the repositories the recordings were found in,
under these names:

  meta                       https://github.com/facebookincubator/Meta-open-sound
  animater                   https://github.com/roileaf/animater (the wolf's snarl)
  minstrel-packs-music-01    https://github.com/Sayshal/minstrel-packs-music-01 (Kevin MacLeod's music)

Needs ffmpeg and numpy. Music is kept whole (the game crossfades each track's
end into its start), its silences trimmed, levelled and saved as stereo MP3.
Sounds are trimmed, given short fades, levelled and saved as mono MP3. Shares
its helpers with tools/build-ambience.py.
"""
import importlib.util
import json
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.dont_write_bytecode = True  # don't leave a __pycache__ in tools/
_spec = importlib.util.spec_from_file_location('ambience', ROOT / 'tools' / 'build-ambience.py')
amb = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(amb)
RATE = amb.RATE

MUSIC_OUT = ROOT / 'public' / 'audio' / 'music'
SFX_OUT = ROOT / 'public' / 'audio' / 'sfx'

KM = 'minstrel-packs-music-01/assets/audio/'
# name in the game: (source, longest length kept in seconds or 0 for all of it)
MUSIC = {
    'menu': (f'{KM}lord-of-the-land.ogg', 0),
    'hollow-day': (f'{KM}achaidh-cheide.ogg', 0),
    'hollow-night': (f'{KM}deep-haze.ogg', 0),
    'home-day': (f'{KM}teller-of-the-tales.ogg', 0),
    'home-night': (f'{KM}long-note-two.ogg', 200),
    'market': (f'{KM}minstrel-guild.ogg', 0),
    'tavern-day': (f'{KM}folk-round.ogg', 0),
    'tavern-night': (f'{KM}fiddles-mcginty.ogg', 0),
    'monastery': (f'{KM}gregorian-chant.ogg', 0),
    'cave': (f'{KM}oppressive-gloom.ogg', 0),
    'battle': (f'{KM}heroic-age.ogg', 0),
    'raid': (f'{KM}failing-defense.ogg', 0),
    'ruin': (f'{KM}dark-times.ogg', 0),
}

OC = 'meta/corpora/oculus-audio-pack/ogg/'
WOLF = 'animater/assets/sounds/wildlife/wolf/'
# name: (source, start s, end s or 0 for the end, loudness dB RMS)
SFX = {
    # Blows landing
    'hit-1': (f'{OC}FGHTImpt_PunchRegular_OS_02.ogg', 0, 0.45, -20),
    'hit-2': (f'{OC}FGHTImpt_PunchRegular_OS_03.ogg', 0, 0.45, -20),
    'hit-3': (f'{OC}FGHTImpt_PunchRegular_OS_04.ogg', 0, 0.45, -20),
    'hit-4': (f'{OC}FGHTImpt_PunchRegular_OS_05.ogg', 0, 0.45, -20),
    'hit-heavy-1': (f'{OC}FGHTImpt_PunchHarder_OS_02.ogg', 0, 0.55, -19),
    'hit-heavy-2': (f'{OC}FGHTImpt_PunchHarder_OS_03.ogg', 0, 0.55, -19),
    'hit-heavy-3': (f'{OC}FGHTImpt_PunchHarder_OS_01.ogg', 0, 0.6, -19),
    'crit-1': (f'{OC}FGHTImpt_PunchHardest_OS_01.ogg', 0, 0.7, -18),
    'crack-1': (f'{OC}GOREBone_BonesBreaking_OS_01.ogg', 0, 0.6, -24),
    'crack-2': (f'{OC}GOREBone_BonesBreaking_OS_02.ogg', 0, 0.7, -24),
    'thud-1': (f'{OC}FGHTImpt_Kick_OS_01.ogg', 0, 0.55, -20),
    # Swings through the air: misses, and the hero's heavy swings
    'whoosh-1': (f'{OC}WHSH_WhooshMedium_OS_01.ogg', 0, 0, -22),
    'whoosh-2': (f'{OC}WHSH_WhooshMedium_OS_02.ogg', 0, 0, -22),
    'whoosh-3': (f'{OC}WHSH_WhooshMedium_OS_03.ogg', 0, 0, -22),
    'whoosh-4': (f'{OC}WHSH_WhooshSmall_OS_01.ogg', 0, 0, -22),
    'whoosh-5': (f'{OC}WHSH_WhooshSmall_OS_03.ogg', 0, 0, -22),
    'swoosh-1': (f'{OC}SWSH_Swoosh_OS_01.ogg', 0, 0.45, -22),
    'swoosh-2': (f'{OC}SWSH_Swoosh_OS_02.ogg', 0, 0.45, -22),
    'swoosh-3': (f'{OC}SWSH_Swoosh_OS_03.ogg', 0, 0.5, -22),
    # A blow turned on a shield or a blade
    'block-1': (f'{OC}METLImpt_MetalHitSurface_OS_01.ogg', 0, 0.8, -22),
    'block-2': (f'{OC}METLImpt_MetalHitSurface_OS_05.ogg', 0, 0.8, -22),
    'block-3': (f'{OC}METLImpt_MetalHitSurface_OS_03.ogg', 0, 0.8, -22),
    'clash-1': (f'{OC}WEAPSwrd_SwordClash_OS_01.ogg', 0, 0.9, -22),
    # Beasts
    'snarl-1': (f'{WOLF}growl-260776-0.ogg', 0, 0, -21),
    'snarl-2': (f'{OC}ANMLDog_DogBark_OS_01.ogg', 0, 0, -22),
    'snarl-3': (f'{OC}ANMLDog_DogBark_OS_02.ogg', 0, 0, -22),
    'pig-1': (f'{OC}ANMLFarm_PigSqueal_OS_01.ogg', 0, 0, -23),
    'pig-2': (f'{OC}ANMLFarm_PigSqueal_OS_02.ogg', 0, 0, -23),
    # Goblins (troll voices, played faster) and the Goblin Brute (an ogre)
    'goblin-1': (f'{OC}CREAHmn_TrollHurt_OS_01.ogg', 0, 0, -21),
    'goblin-2': (f'{OC}CREAHmn_TrollHurt_OS_02.ogg', 0, 0, -21),
    'goblin-3': (f'{OC}CREAHmn_TrollHurt_OS_03.ogg', 0, 0, -21),
    'goblin-laugh-1': (f'{OC}CREAHmn_TrollLaugh_OS_02.ogg', 0, 1.2, -22),
    'goblin-laugh-2': (f'{OC}CREAHmn_TrollLaugh_OS_03.ogg', 0, 1.3, -22),
    'goblin-death-1': (f'{OC}CREAHmn_TrollDeath_OS_01.ogg', 0, 0, -21),
    'goblin-death-2': (f'{OC}CREAHmn_TrollDeath_OS_02.ogg', 0, 1.1, -21),
    'brute-1': (f'{OC}CREAHmn_OgreHurt_OS_01.ogg', 0, 0, -20),
    'brute-2': (f'{OC}CREAHmn_OgreHurt_OS_02.ogg', 0, 0, -20),
    'brute-3': (f'{OC}CREAHmn_OgreHurt_OS_03.ogg', 0, 0, -20),
    'brute-laugh-1': (f'{OC}CREAHmn_OgreLaugh_OS_01.ogg', 0, 1.5, -21),
    'brute-death-1': (f'{OC}CREAHmn_OgreDeath_OS_02.ogg', 0, 1.6, -20),
    # Men: the hero and the footpads
    'man1-hurt-1': (f'{OC}VOXMale_Male01Hurt_OS_01.ogg', 0, 0, -22),
    'man1-hurt-2': (f'{OC}VOXMale_Male01Hurt_OS_03.ogg', 0, 0, -22),
    'man1-hurt-3': (f'{OC}VOXMale_Male01Hurt_OS_02.ogg', 0, 0.75, -22),
    'man2-hurt-1': (f'{OC}VOXMale_Male02Hurt_OS_01.ogg', 0, 0, -22),
    'man2-hurt-2': (f'{OC}VOXMale_Male02Hurt_OS_02.ogg', 0, 0, -22),
    'man2-hurt-3': (f'{OC}VOXMale_Male02Hurt_OS_03.ogg', 0, 0, -22),
    'man1-death-1': (f'{OC}VOXMale_Male01Death_OS_01.ogg', 0, 0, -22),
    'man2-death-1': (f'{OC}VOXMale_Male02Death_OS_01.ogg', 0, 0, -22),
    # Stingers
    'levelup-1': (f'{OC}MUSCStngr_LevelUpOrchestral_OS_01.ogg', 0, 0, -21),
    'victory-1': (f'{OC}MUSCStngr_VictoryOrchestral_OS_01.ogg', 0, 0, -21),
    'defeat-1': (f'{OC}MUSCStngr_LossOrchestral_OS_01.ogg', 0, 0, -21),
}

# Voice barks under the dialogue's typing blips: two men's and two women's voices,
# each with a greeting (a short "heh"), a laugh and a grunt. The game pitches them
# a little per speaker, so no two villagers sound quite alike.
VOICES = {
    'm1': ('VOXLaff_Male01Laugh_OS_01.ogg', 'VOXLaff_Male01Laugh_OS_02.ogg', 'VOXEfrt_Male01Effort_OS_01.ogg'),
    'm2': ('VOXLaff_Male02Laugh_OS_03.ogg', 'VOXLaff_Male02Laugh_OS_01.ogg', 'VOXEfrt_Male02Effort_OS_01.ogg'),
    'f1': ('VOXLaff_Female01Laugh_OS_02.ogg', 'VOXLaff_Female01Laugh_OS_01.ogg', 'VOXEfrt_Female01Effort_OS_01.ogg'),
    'f2': ('VOXLaff_Female02Laugh_OS_02.ogg', 'VOXLaff_Female02Laugh_OS_01.ogg', 'VOXEfrt_Female02Effort_OS_01.ogg'),
}
for v, (greet, laugh, grunt) in VOICES.items():
    SFX[f'voice-{v}-greet'] = (f'{OC}{greet}', 0, 0.5, -24)
    SFX[f'voice-{v}-laugh'] = (f'{OC}{laugh}', 0, 1.3, -25)
    SFX[f'voice-{v}-grunt'] = (f'{OC}{grunt}', 0, 0.8, -24)


def strip_silence(a: np.ndarray, floor_db=-50) -> np.ndarray:
    """Trims the quiet start and end of a recording."""
    win = int(0.02 * RATE)
    loud = [i for i in range(0, len(a) - win, win) if amb.rms_db(a[i:i + win]) > floor_db]
    if not loud:
        return a
    return a[max(0, loud[0] - win):min(len(a), loud[-1] + 2 * win)]


def encode(audio: np.ndarray, out: Path, mono: bool, kbps: int) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    cmd = ['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(RATE), '-ac', '2', '-i', '-']
    if mono:
        cmd += ['-ac', '1']
    cmd += ['-c:a', 'libmp3lame', '-b:a', f'{kbps}k', str(out)]
    amb.subprocess.run(cmd, input=audio.astype(np.float32).tobytes(), check=True)


def main() -> None:
    src = Path(sys.argv[1])
    made = {}
    for name, (f, longest) in MUSIC.items():
        a = strip_silence(amb.decode(src / f), -55)
        if longest and len(a) > longest * RATE:
            a = amb.trim(a[:int(longest * RATE)], 0.002, 6)
        a = amb.level(a, -19, peak=0.9)
        encode(a, MUSIC_OUT / f'{name}.mp3', mono=False, kbps=80)
        made[f'music/{name}'] = round(len(a) / RATE, 1)
    for name, (f, start, end, db) in SFX.items():
        a = amb.decode(src / f, 40)
        a = a[int(start * RATE):int(end * RATE) if end else len(a)]
        a = amb.level(amb.trim(strip_silence(a), 0.003, min(0.12, len(a) / RATE / 4)), db, peak=0.85)
        encode(a, SFX_OUT / f'{name}.mp3', mono=True, kbps=64)
        made[f'sfx/{name}'] = round(len(a) / RATE, 2)
    print(json.dumps(made, indent=1))


if __name__ == '__main__':
    main()
