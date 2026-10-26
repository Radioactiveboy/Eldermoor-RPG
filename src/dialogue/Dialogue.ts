/**
 * Conversations are written as small graphs of nodes. Each node is one
 * speaker saying one or more lines; it then either moves on to `next`, offers
 * the player some replies, or ends the conversation.
 *
 * `action` names are handled by the game (see GameScene.runDialogueAction),
 * which keeps quest logic out of the writing.
 */
export interface DialogueChoice {
  text: string;
  /** Node to go to; leave out to end the conversation. */
  next?: string;
  action?: string;
}

export interface DialogueNode {
  speaker: SpeakerId;
  /** Each string is one box of text; the player clicks through them. */
  lines: string[];
  choices?: DialogueChoice[];
  next?: string;
  /** Runs once this node's lines have been read. */
  action?: string;
}

export interface DialogueScript {
  start: string;
  nodes: Record<string, DialogueNode>;
}

export type SpeakerId =
  | 'mother' | 'pedlar' | 'pilgrim' | 'drover' | 'baker' | 'smith' | 'tanner' | 'guard' | 'iran'
  | 'tollguard' | 'carter' | 'herbwife';

export interface Speaker {
  name: string;
  /** Texture with portrait frames: 0 mouth closed, 1 mouth open, 2 blinking. */
  portrait: string;
  /** The "voice" blips played as text appears. */
  voice: { pitch: number; spread: number; wave: OscillatorType };
}

export const SPEAKERS: Record<SpeakerId, Speaker> = {
  mother: { name: 'Mother', portrait: 'portrait-mother', voice: { pitch: 300, spread: 0.12, wave: 'triangle' } },
  pedlar: { name: 'Bram the Pedlar', portrait: 'portrait-pedlar', voice: { pitch: 165, spread: 0.16, wave: 'sawtooth' } },
  pilgrim: { name: 'Sister Ysolde', portrait: 'portrait-pilgrim', voice: { pitch: 360, spread: 0.08, wave: 'sine' } },
  drover: { name: 'Wil the Drover', portrait: 'portrait-drover', voice: { pitch: 250, spread: 0.2, wave: 'triangle' } },
  baker: { name: 'Hilde the Baker', portrait: 'portrait-baker', voice: { pitch: 330, spread: 0.14, wave: 'triangle' } },
  smith: { name: 'Osric the Smith', portrait: 'portrait-smith', voice: { pitch: 130, spread: 0.1, wave: 'sawtooth' } },
  tanner: { name: 'Tamsin the Tanner', portrait: 'portrait-tanner', voice: { pitch: 280, spread: 0.18, wave: 'square' } },
  guard: { name: 'Militiaman', portrait: 'portrait-guard', voice: { pitch: 190, spread: 0.1, wave: 'sawtooth' } },
  iran: { name: 'Farmer Iran', portrait: 'portrait-iran', voice: { pitch: 150, spread: 0.14, wave: 'triangle' } },
  tollguard: { name: 'Toll Guard', portrait: 'portrait-tollguard', voice: { pitch: 140, spread: 0.08, wave: 'sawtooth' } },
  carter: { name: 'Odo the Carter', portrait: 'portrait-carter', voice: { pitch: 175, spread: 0.18, wave: 'triangle' } },
  herbwife: { name: 'Ness the Herb-gatherer', portrait: 'portrait-herbwife', voice: { pitch: 310, spread: 0.12, wave: 'sine' } },
};
