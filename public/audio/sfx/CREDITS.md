# Fight sound and voice credits

The fight sounds, the cries of beasts, goblins and men, the level-up, victory and defeat stingers, and the voice
barks heard as someone starts to speak are cut from real recordings that are free to use in a game. Almost all
come from the **Oculus Audio Pack 01** (CC BY 4.0, credit line below); the wolf's snarl is a Freesound recording
under CC BY 3.0. `tools/build-sound.py` trimmed, faded, levelled and re-encoded each one as mono MP3, and the game
changes their speed a little as they play (goblins are the troll voices sped up; the boar is a pig slowed down).

| File | What it is | Recording | By | Licence | Found via |
|---|---|---|---|---|---|
| `hit-1` … `hit-4`, `hit-heavy-1` … `hit-heavy-3`, `crit-1` | A blow landing; a heavy one; a critical hit | Punch Regular, Punch Harder, Punch Hardest | Oculus VR, LLC | **CC BY 4.0** | [Meta-open-sound](https://github.com/facebookincubator/Meta-open-sound) |
| `crack-1`, `crack-2` | Bone cracking under a critical hit | Bones Breaking | Oculus VR, LLC | **CC BY 4.0** | Meta-open-sound |
| `thud-1` | A body falling | Kick | Oculus VR, LLC | **CC BY 4.0** | Meta-open-sound |
| `whoosh-1` … `whoosh-5`, `swoosh-1` … `swoosh-3` | Swings through the air, and misses | Whoosh Medium, Whoosh Small, Swoosh | Oculus VR, LLC | **CC BY 4.0** | Meta-open-sound |
| `block-1` … `block-3`, `clash-1` | A blow turned on a shield | Metal Hit Surface, Sword Clash | Oculus VR, LLC | **CC BY 4.0** | Meta-open-sound |
| `snarl-1` | A wolf's snarl | [ANGRY DOG BARK SNARL Flat.wav](https://freesound.org/people/deleted_user_3424813/sounds/260776/), cut by Animater | a Freesound user whose account has since been deleted (deleted_user_3424813) | **CC BY 3.0** | [roileaf/animater](https://github.com/roileaf/animater) |
| `snarl-2`, `snarl-3` | A wolf barking (played slower and deeper) | Dog Bark | Oculus VR, LLC | **CC BY 4.0** | Meta-open-sound |
| `pig-1`, `pig-2` | The boar (played slower and deeper) | Pig Squeal | Oculus VR, LLC | **CC BY 4.0** | Meta-open-sound |
| `goblin-*` | Goblins' yells, cackles and death cries (played faster) | Troll Hurt, Troll Laugh, Troll Death | Oculus VR, LLC | **CC BY 4.0** | Meta-open-sound |
| `brute-*` | The Goblin Brute's bellows | Ogre Hurt, Ogre Laugh, Ogre Death | Oculus VR, LLC | **CC BY 4.0** | Meta-open-sound |
| `man1-*`, `man2-*` | The hero and the footpads crying out, and falling | Male 01 / Male 02 Hurt and Death | Oculus VR, LLC | **CC BY 4.0** | Meta-open-sound |
| `mere-hiss-*`, `mere-hurt-*`, `mere-death-*`, `mere-chief-*`, `harpoon-*` | The Mere-kin (the fen's lizard folk): hisses, cries, death rattles, the war-chief's bellow, a harpoon thrown on its line. Built by `tools/build-merekin-sound.py`: the hisses and the line's whirr are synthesised noise; the cries are slowed and rattled | Troll Hurt, Troll Death, Giant Hurt, Giant Laugh, Giant Death, Swoosh, Whoosh Small | Oculus VR, LLC | **CC BY 4.0** | Meta-open-sound |
| `levelup-1`, `victory-1`, `defeat-1` | Gaining a level; winning and losing a fight | Level Up Orchestral, Victory Orchestral, Loss Orchestral stingers | Oculus VR, LLC | **CC BY 4.0** | Meta-open-sound |
| `voice-m1-*`, `voice-m2-*`, `voice-f1-*`, `voice-f2-*` | Voice barks: a short "heh" (`greet`, the start of a laugh), a laugh, and a grunt, in two men's and two women's voices | Male 01 / 02 and Female 01 / 02 Laugh and Effort | Oculus VR, LLC | **CC BY 4.0** | Meta-open-sound |

## Credit lines (required)

> Some sounds from "Oculus Audio Pack 01" by Oculus VR, LLC
> (https://developers.meta.com/vr/downloads/package/oculus-audio-pack-1/), licensed under CC BY 4.0
> (https://creativecommons.org/licenses/by/4.0/). Trimmed, levelled and re-encoded.

> "ANGRY DOG BARK SNARL Flat.wav" by deleted_user_3424813 (https://freesound.org/s/260776/), licensed under
> CC BY 3.0 (https://creativecommons.org/licenses/by/3.0/). Cut and levelled by Animater, then by this game.
