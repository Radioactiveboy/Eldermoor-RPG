/**
 * The night after the beacon (scenes/game/whisper.ts, scenes/OrbWhisperScene.ts):
 * the hero sleeps with the orb in the satchel by the bed, and for the first
 * time since the brood hall it wakes. Two voices on the other side of it, not
 * talking to the hero at all: overheard, not spoken to. What they let slip is
 * the way on: Gloomhaven, the big, bad marsh town outside the shire, which the
 * Astarix means to take now that Adowvale has failed him.
 */

/** Set once the Headman has paid for the beacon: the next sleep carries the orb's whisper. */
export const WHISPER_PENDING = 'whisper-pending';
/** Set once it has been heard. */
export const WHISPER_HEARD = 'whisper-heard';

/** The quest the whisper starts (see systems/Quests.ts). */
export const GLOOMHAVEN_QUEST = 'the-marsh-road';

/** Who speaks through the orb that night. */
export type WhisperVoice = 'watcher' | 'other';

export const WHISPER_VOICES: Record<WhisperVoice, { name: string; pitch: number; spread: number; wave: OscillatorType }> = {
  // The cold voice from the brood hall (the same as Dialogue.ts's 'orb'): the Astarix, who holds the orb's partner stone.
  watcher: { name: 'The cold voice', pitch: 80, spread: 0.3, wave: 'sawtooth' },
  // One of his people, reporting to him at his end of the glass.
  other: { name: 'A second voice', pitch: 128, spread: 0.45, wave: 'triangle' },
};

export interface WhisperLine {
  voice: WhisperVoice;
  text: string;
  /** Fading as the glass goes dark: the last words, half caught. */
  faint?: boolean;
}

/** Before the voices: falling asleep. */
export const WHISPER_OPENING: string[] = [
  'I sleep, and sleep is a long way down.',
  'Somewhere at the bottom of it, by the bed, something in my satchel has begun to hum.',
];

/**
 * What the orb carries, in order. Nobody is talking to the hero: the orb is a
 * seeing stone, one of a pair, and its partner is in the hands of an Astarix
 * of the empire in the ashland of Daejonguk. Tonight it is open at his end,
 * and the hero overhears him hear a report. Adowvale has cost him the brood
 * and the Mother; he turns his eye to Gloomhaven instead.
 */
export const WHISPER_LINES: WhisperLine[] = [
  { voice: 'other', text: 'The hill is silent, Astarix. Not a word out of the brood hall since the new moon. The stone there has gone dark.' },
  { voice: 'watcher', text: 'The Mother is dead, and the brood in the shell with her. Years of feeding, and that little shire still stands.' },
  { voice: 'other', text: "There was a boy, the goblins said. A healer's son. He went down into the hill after his mother." },
  { voice: 'watcher', text: 'The boy lives still... It does not matter. One village is not worth another year. Adowvale will keep. It will be there when we come back for it.' },
  { voice: 'other', text: 'Then where would you have them go?' },
  { voice: 'watcher', text: 'We must send them to Gloomhaven then, on the marshes. What is left of the war-bands, and the coin with them.' },
  { voice: 'other', text: 'Gloomhaven? The marsh-folk will not kneel to an empire they have never seen.' },
  { voice: 'watcher', text: 'They will not see it. They never do. A guild bought here, a reeve there, a fire in the wrong warehouse. Its streets will sell anything to anyone.' },
  { voice: 'watcher', text: 'By the thaw, Gloomhaven will be ours in all but name. And every road out of the marshes runs to some other door. The shire\'s, among them.' },
  { voice: 'other', text: 'And the stone in the brood hall?' },
  { voice: 'watcher', text: 'Lost in the dark with the Mother. Let it lie. Glass that nobody looks into tells no tales.' },
  { voice: 'watcher', text: 'Close the stone. Daejonguk wants my report by moonset.', faint: true },
];

/** After the orb goes dark: waking. */
export const WHISPER_WAKING: string[] = [
  'I wake with my hand on the orb, and no memory of taking it out of the satchel.',
  'It is cold again. Dark again. They never knew I was there.',
  'Gloomhaven. On the marshes.',
];

/** The hero's first thoughts on waking after it (see GameScene's arrival). */
export const WHISPER_WAKING_THOUGHTS: string[] = [
  'An Astarix, the other one called him. Of Daejonguk. The orb is half of a pair, and he holds the other half. He sent the goblins for Mother, and now he is done with us. For now.',
  'Gloomhaven is next: bought guilds, fires, and then the roads out of the marshes, to the shire among them. Somebody has to be there before he is. I am going to Gloomhaven.',
];
