import type { SpeakerId } from './Dialogue';
import type { Faction } from '../systems/Reputation';
import { SaveGame } from '../systems/SaveGame';

/**
 * Who each speaker belongs to, shown under their portrait in conversation
 * ("Adowvale Militia", "Goblin Warband") once the hero knows it.
 *
 * When it counts as known:
 * - `sight`: worn on them, so it shows from the first word. The militia's blue
 *   tabard, a brother's habit and tonsure, Lord Morten's crimson, a goblin.
 * - `met`: nothing about them gives it away, so it shows once the hero has
 *   finished a conversation with them. A stranger in the square is just a
 *   name the first time; the next time you know she's one of the village.
 *
 * Speakers with no entry (Mother, the voice in the orb, folk passing through)
 * show nothing. `faction` ties the group to a standing in systems/Reputation.ts
 * where there is one.
 */
export interface Affiliation {
  label: string;
  known: 'sight' | 'met';
  faction?: Faction;
}

const MILITIA: Affiliation = { label: 'Adowvale Militia', known: 'sight', faction: 'militia' };
const BROTHER: Affiliation = { label: "Brothers of Saint Elda's", known: 'sight', faction: 'monastery' };
const VILLAGE: Affiliation = { label: 'Folk of Adowvale', known: 'met', faction: 'adowvale' };
const MORTEN: Affiliation = { label: "Lord Morten's Men", known: 'sight' };
const GATE_MEN: Affiliation = { label: 'The Fen Gate Watch', known: 'sight' };
const GLOOMFOLK: Affiliation = { label: 'Folk of Gloomhaven', known: 'met' };

export const AFFILIATIONS: Partial<Record<SpeakerId, Affiliation>> = {
  guard: MILITIA,
  wat: MILITIA,
  sergeant: MILITIA,
  jailer: MILITIA,

  porter: BROTHER,
  gardener: BROTHER,
  silent: BROTHER,
  novice: BROTHER,
  prior: BROTHER,
  anselm: BROTHER,
  cook: BROTHER,
  scribe: BROTHER,
  leofric: BROTHER,

  tollguard: MORTEN,
  // Hal wears no colours; he says whose messenger he is.
  courier: { ...MORTEN, known: 'met' },

  snikkit: { label: 'Goblin Warband', known: 'sight' },
  footpad: { label: 'Footpads of the Plains', known: 'met' },
  cutpurse: { label: 'Footpads of the Plains', known: 'met' },
  // Corwin wears the old watch's colours; the rest are known by the company they keep.
  corwin: { label: 'Brigands of Corbie Tor', known: 'met' },
  garth: { label: 'Brigands of Corbie Tor', known: 'met' },
  teg: { label: 'Brigands of Corbie Tor', known: 'met' },
  linnet: { label: 'Brigands of Corbie Tor', known: 'met' },

  baker: VILLAGE,
  smith: VILLAGE,
  tanner: VILLAGE,
  iran: VILLAGE,
  fisherman: VILLAGE,
  ebb: VILLAGE,
  wren: VILLAGE,
  // A river skipper: she belongs to the Wend more than to Adowvale.
  maren: { label: 'Boatfolk of the Wend', known: 'met' },
  // Gloomhaven: the gate men wear the town's black and red; the rest you learn by talking.
  vosk: GATE_MEN,
  brakk: GATE_MEN,
  fitch: GATE_MEN,
  crabbe: GATE_MEN,
  ossery: GLOOMFOLK,
  tallow: GLOOMFOLK,
  lusk: GLOOMFOLK,
  gutter: GLOOMFOLK,
  wisp: GLOOMFOLK,
  annis: GLOOMFOLK,
  nan: GLOOMFOLK,
  ned: GLOOMFOLK,
  cray: { label: 'Boatfolk of the Wend', known: 'met' },
  coombe: VILLAGE,
  // His chain of office says it.
  headman: { ...VILLAGE, known: 'sight' },
  steward: VILLAGE,
  housemaid: VILLAGE,
  housecook: VILLAGE,
  landlord: VILLAGE,
  nell: VILLAGE,
  rosie: VILLAGE,
  harlan: VILLAGE,
  ada: VILLAGE,
  cobb: VILLAGE,
};

class AffiliationStore {
  /** Speakers the hero has finished a conversation with. */
  private met = new Set<SpeakerId>();

  reset(): void {
    this.met.clear();
  }

  /** Notes that the hero has talked with someone, so a `met` affiliation shows from now on. */
  markMet(id: SpeakerId): void {
    this.met.add(id);
  }

  hasMet(id: SpeakerId): boolean {
    return this.met.has(id);
  }

  /** What to show under their portrait, or undefined while it isn't known (or they belong to no one). */
  known(id: SpeakerId): Affiliation | undefined {
    const a = AFFILIATIONS[id];
    if (!a) return undefined;
    return a.known === 'sight' || this.met.has(id) ? a : undefined;
  }

  toSave(): SpeakerId[] {
    return [...this.met];
  }

  fromSave(data: unknown): void {
    this.reset();
    if (Array.isArray(data)) for (const id of data) if (typeof id === 'string') this.met.add(id as SpeakerId);
  }
}

export const Affiliations = new AffiliationStore();

SaveGame.register('affiliations', {
  save: () => Affiliations.toSave(),
  load: (data) => Affiliations.fromSave(data),
});
