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

export type SpeakerId = 'mother';

export interface Speaker {
  name: string;
  /** Texture with portrait frames: 0 mouth closed, 1 mouth open, 2 blinking. */
  portrait: string;
  /** The "voice" blips played as text appears. */
  voice: { pitch: number; spread: number; wave: OscillatorType };
}

export const SPEAKERS: Record<SpeakerId, Speaker> = {
  mother: { name: 'Mother', portrait: 'portrait-mother', voice: { pitch: 300, spread: 0.12, wave: 'triangle' } },
};
