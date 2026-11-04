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
  | 'tollguard' | 'carter' | 'herbwife' | 'fisherman' | 'porter' | 'gardener' | 'silent' | 'novice'
  | 'prior' | 'anselm' | 'cook' | 'scribe' | 'leofric'
  | 'landlord' | 'nell' | 'rosie' | 'harlan' | 'fenwick' | 'sigrun' | 'ada' | 'cobb' | 'pell'
  | 'footpad' | 'cutpurse' | 'tinker' | 'goatherd' | 'courier';

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
  fisherman: { name: 'Old Tobin', portrait: 'portrait-fisherman', voice: { pitch: 120, spread: 0.12, wave: 'triangle' } },
  porter: { name: 'Brother Wystan', portrait: 'portrait-porter', voice: { pitch: 145, spread: 0.06, wave: 'sine' } },
  gardener: { name: 'Brother Cuthbert', portrait: 'portrait-gardener', voice: { pitch: 185, spread: 0.16, wave: 'triangle' } },
  silent: { name: 'Brother Aldo', portrait: 'portrait-silent', voice: { pitch: 120, spread: 0.04, wave: 'sine' } },
  novice: { name: 'Brother Tobin', portrait: 'portrait-novice', voice: { pitch: 240, spread: 0.2, wave: 'triangle' } },
  prior: { name: 'Prior Benedict', portrait: 'portrait-prior', voice: { pitch: 125, spread: 0.05, wave: 'sine' } },
  anselm: { name: 'Brother Anselm', portrait: 'portrait-anselm', voice: { pitch: 150, spread: 0.1, wave: 'sine' } },
  cook: { name: 'Brother Hob', portrait: 'portrait-cook', voice: { pitch: 160, spread: 0.2, wave: 'triangle' } },
  scribe: { name: 'Brother Edmund', portrait: 'portrait-scribe', voice: { pitch: 220, spread: 0.12, wave: 'sine' } },
  leofric: { name: 'Brother Leofric', portrait: 'portrait-leofric', voice: { pitch: 190, spread: 0.14, wave: 'triangle' } },
  landlord: { name: 'Godric the Landlord', portrait: 'portrait-landlord', voice: { pitch: 135, spread: 0.14, wave: 'sawtooth' } },
  nell: { name: 'Nell', portrait: 'portrait-nell', voice: { pitch: 320, spread: 0.16, wave: 'triangle' } },
  rosie: { name: 'Rosie', portrait: 'portrait-rosie', voice: { pitch: 370, spread: 0.18, wave: 'triangle' } },
  harlan: { name: 'Old Harlan', portrait: 'portrait-harlan', voice: { pitch: 140, spread: 0.24, wave: 'triangle' } },
  fenwick: { name: 'Master Fenwick', portrait: 'portrait-fenwick', voice: { pitch: 175, spread: 0.08, wave: 'sine' } },
  sigrun: { name: 'Sigrun the Sellsword', portrait: 'portrait-sigrun', voice: { pitch: 240, spread: 0.06, wave: 'square' } },
  ada: { name: 'Ada', portrait: 'portrait-ada', voice: { pitch: 290, spread: 0.14, wave: 'triangle' } },
  cobb: { name: 'Cobb', portrait: 'portrait-cobb', voice: { pitch: 150, spread: 0.18, wave: 'triangle' } },
  pell: { name: 'Pell the Minstrel', portrait: 'portrait-pell', voice: { pitch: 260, spread: 0.22, wave: 'sine' } },
  // Met by chance on Adowvale Plains (see world/PlainsEvents.ts).
  footpad: { name: 'Rook the Footpad', portrait: 'portrait-footpad', voice: { pitch: 150, spread: 0.1, wave: 'sawtooth' } },
  cutpurse: { name: 'Nab', portrait: 'portrait-cutpurse', voice: { pitch: 120, spread: 0.2, wave: 'square' } },
  tinker: { name: 'Jory the Tinker', portrait: 'portrait-tinker', voice: { pitch: 200, spread: 0.24, wave: 'triangle' } },
  goatherd: { name: 'Mags', portrait: 'portrait-goatherd', voice: { pitch: 420, spread: 0.2, wave: 'triangle' } },
  courier: { name: 'Hal the Messenger', portrait: 'portrait-courier', voice: { pitch: 210, spread: 0.12, wave: 'sine' } },
};
