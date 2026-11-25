/**
 * The night after the beacon (scenes/game/whisper.ts, scenes/OrbWhisperScene.ts):
 * the hero sleeps with the orb in the satchel by the bed, and for the first
 * time since the brood hall it wakes. Two voices on the other side of it, not
 * talking to the hero at all, until the last line. What they let slip is the
 * way on: Gloomhaven, the big, bad marsh town outside the shire.
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
  // The cold voice from the brood hall (the same as Dialogue.ts's 'orb').
  watcher: { name: 'The voice in the orb', pitch: 80, spread: 0.3, wave: 'sawtooth' },
  // Somebody else, nearer the glass: older, wetter, afraid of the first.
  other: { name: 'Another voice', pitch: 128, spread: 0.45, wave: 'triangle' },
};

export interface WhisperLine {
  /** Spoken through the orb; without one, it's the hero's own half-asleep thought. */
  voice?: WhisperVoice;
  text: string;
  /** The orb leans close to the glass, as though it knows it's being heard. */
  near?: boolean;
}

/** Before the voices: falling asleep. */
export const WHISPER_OPENING: string[] = [
  'I sleep, and sleep is a long way down.',
  'Somewhere at the bottom of it, by the bed, something in my satchel has begun to hum.',
];

/** What the orb carries, in order. */
export const WHISPER_LINES: WhisperLine[] = [
  { voice: 'other', text: "...can you hear me? The hill has gone quiet. Not a cry out of the brood hall in days." },
  { voice: 'watcher', text: 'The Mother is dead. The shell went cold with her. Years of feeding her, and nothing hatched worth the meat.' },
  { voice: 'other', text: 'And the healer\'s whelp? The one who came down after her?' },
  { voice: 'watcher', text: 'The boy lives still...' },
  { voice: 'other', text: 'Then he will come looking. The sons always do. His father did.' },
  { voice: 'watcher', text: 'We must send them to Gloomhaven then, on the marshes. All that are left. Every knife we have paid for.' },
  { voice: 'other', text: 'Gloomhaven. That sinkhole. There are more cutthroats on the causeway than there are frogs in the fen.' },
  { voice: 'watcher', text: 'Good. Let them be bought, and armed, and waiting. When he comes the fen will close over him, the way it closed over the father.' },
  { voice: 'other', text: 'And if he does not come?' },
  { voice: 'watcher', text: 'He has the glass. He looks into it, as the father did, and wonders who looks back. He is looking now.', near: true },
  { voice: 'watcher', text: 'Sleep, boy. Gloomhaven is waiting for you.', near: true },
];

/** After the orb goes dark: waking. */
export const WHISPER_WAKING: string[] = [
  'I wake with my hand on the orb, and no memory of taking it out of the satchel.',
  'It is cold again. Dark again.',
  'Gloomhaven. On the marshes.',
];

/** The hero's first thoughts on waking after it (see GameScene's arrival). */
export const WHISPER_WAKING_THOUGHTS: string[] = [
  'Gloomhaven. A marsh town, out past the edge of the shire. I have heard the carters call it worse things than a sinkhole.',
  'Whoever is behind the glass is sending knives there, to wait for me. And they said the fen closed over Father. If he went that way, so do I.',
];
