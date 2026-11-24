/**
 * Conversations are written as small graphs of nodes. Each node is one
 * speaker saying one or more lines; it then either moves on to `next`, offers
 * the player some replies, or ends the conversation.
 *
 * `action` names are handled by the game (see scenes/game/dialogueActions.ts),
 * which keeps quest logic out of the writing.
 */
export interface DialogueChoice {
  text: string;
  /** Node to go to; leave out to end the conversation. */
  next?: string;
  action?: string;
  /**
   * New and to do with what's going on (a quest, the raid): kept up front when a
   * long list folds its everyday questions under "Ask about…" (see ChoiceMenu.ts).
   * A reply with an `action` counts as one too.
   */
  key?: boolean;
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
  /**
   * Builds the conversation again as things now stand, after a reply's or a
   * node's action has run (a gift given, a story told), so what's offered next
   * fits: the same node ids, with what's in them brought up to date.
   */
  refresh?: () => DialogueScript;
}

export type SpeakerId =
  | 'mother' | 'pedlar' | 'pilgrim' | 'drover' | 'baker' | 'smith' | 'tanner' | 'guard' | 'iran'
  | 'tollguard' | 'carter' | 'herbwife' | 'fisherman' | 'porter' | 'gardener' | 'silent' | 'novice'
  | 'prior' | 'anselm' | 'cook' | 'scribe' | 'leofric'
  | 'landlord' | 'nell' | 'rosie' | 'harlan' | 'fenwick' | 'sigrun' | 'ada' | 'cobb' | 'pell'
  | 'footpad' | 'cutpurse' | 'tinker' | 'goatherd' | 'courier'
  | 'sergeant' | 'jailer' | 'prisoner' | 'headman' | 'steward' | 'housemaid' | 'housecook'
  | 'wat' | 'snikkit' | 'coombe' | 'orb'
  | 'maren' | 'ebb' | 'wren'
  | 'corwin' | 'garth' | 'teg' | 'linnet'
  | 'vosk' | 'brakk' | 'fitch' | 'crabbe' | 'ossery' | 'tallow' | 'lusk' | 'gutter' | 'wisp' | 'cray';

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
  orb: { name: 'A voice in the orb', portrait: 'portrait-orb', voice: { pitch: 80, spread: 0.3, wave: 'sawtooth' } },
  coombe: { name: 'Coombe the Shepherd', portrait: 'portrait-coombe', voice: { pitch: 128, spread: 0.16, wave: 'triangle' } },
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
  // The militia garrison and the Headman's residence, on the lane at the south end of Adowvale.
  sergeant: { name: 'Sergeant Brannock', portrait: 'portrait-sergeant', voice: { pitch: 125, spread: 0.06, wave: 'sawtooth' } },
  jailer: { name: 'Hamm the Jailer', portrait: 'portrait-jailer', voice: { pitch: 205, spread: 0.18, wave: 'sawtooth' } },
  prisoner: { name: 'Dickon the Poacher', portrait: 'portrait-prisoner', voice: { pitch: 175, spread: 0.24, wave: 'triangle' } },
  // The goblin the militia caught after the raid, in the cell at the foot of the jail steps.
  snikkit: { name: 'Snikkit the Goblin', portrait: 'portrait-snikkit', voice: { pitch: 290, spread: 0.32, wave: 'square' } },
  // Down at Adowvale Jetty, on the river Wend.
  maren: { name: 'Maren Tull', portrait: 'portrait-maren', voice: { pitch: 205, spread: 0.08, wave: 'triangle' } },
  ebb: { name: 'Old Ebb', portrait: 'portrait-ebb', voice: { pitch: 112, spread: 0.2, wave: 'triangle' } },
  wren: { name: 'Wren', portrait: 'portrait-wren', voice: { pitch: 430, spread: 0.24, wave: 'triangle' } },
  // Gloomhaven, downriver (dialogue/gloomhaven.ts).
  vosk: { name: 'Captain Vosk', portrait: 'portrait-vosk', voice: { pitch: 118, spread: 0.1, wave: 'sawtooth' } },
  brakk: { name: 'Brakk', portrait: 'portrait-brakk', voice: { pitch: 82, spread: 0.08, wave: 'sawtooth' } },
  fitch: { name: 'Fitch', portrait: 'portrait-fitch', voice: { pitch: 168, spread: 0.06, wave: 'triangle' } },
  crabbe: { name: 'Old Crabbe', portrait: 'portrait-crabbe', voice: { pitch: 124, spread: 0.26, wave: 'triangle' } },
  ossery: { name: 'Mother Ossery', portrait: 'portrait-ossery', voice: { pitch: 262, spread: 0.3, wave: 'triangle' } },
  tallow: { name: 'Hobb Tallow', portrait: 'portrait-tallow', voice: { pitch: 132, spread: 0.2, wave: 'square' } },
  lusk: { name: 'Abel Lusk', portrait: 'portrait-lusk', voice: { pitch: 140, spread: 0.05, wave: 'sine' } },
  gutter: { name: 'Gutter Jack', portrait: 'portrait-gutter', voice: { pitch: 110, spread: 0.34, wave: 'triangle' } },
  wisp: { name: 'Wisp', portrait: 'portrait-wisp', voice: { pitch: 470, spread: 0.26, wave: 'triangle' } },
  cray: { name: 'Cray', portrait: 'portrait-cray', voice: { pitch: 96, spread: 0.04, wave: 'sine' } },
  headman: { name: 'Headman Osbert Hale', portrait: 'portrait-headman', voice: { pitch: 135, spread: 0.08, wave: 'sine' } },
  steward: { name: 'Aldwin the Steward', portrait: 'portrait-steward', voice: { pitch: 145, spread: 0.04, wave: 'sine' } },
  housemaid: { name: 'Elsie', portrait: 'portrait-housemaid', voice: { pitch: 380, spread: 0.2, wave: 'triangle' } },
  housecook: { name: 'Marjory the Cook', portrait: 'portrait-housecook', voice: { pitch: 280, spread: 0.14, wave: 'triangle' } },
  // The militia lad who can come along (see systems/Companions.ts): one of the militia, so he has their face.
  wat: { name: 'Wat of the Militia', portrait: 'portrait-guard', voice: { pitch: 230, spread: 0.22, wave: 'triangle' } },
  // The brigands holding the old beacon on Corbie Tor (see dialogue/beacon.ts).
  corwin: { name: 'Corwin Haske', portrait: 'portrait-corwin', voice: { pitch: 118, spread: 0.08, wave: 'sawtooth' } },
  garth: { name: 'Big Garth', portrait: 'portrait-garth', voice: { pitch: 92, spread: 0.06, wave: 'sawtooth' } },
  teg: { name: 'Teg', portrait: 'portrait-teg', voice: { pitch: 215, spread: 0.2, wave: 'square' } },
  linnet: { name: 'Linnet', portrait: 'portrait-linnet', voice: { pitch: 300, spread: 0.1, wave: 'triangle' } },
};
