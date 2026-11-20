import type { FoeKind } from './Combat';
import { Inventory } from './Inventory';
import { QUESTS, QuestLog } from './Quests';
import { Faction, Reputation } from './Reputation';
import { SaveGame } from './SaveGame';
import { CELLAR_RAT_SPOTS } from '../world/landmarks';
import type { CreatureSpawn } from '../world/MapData';

/**
 * The militia's bounties, posted on the notice board in Adowvale's market
 * square: rats back in the Crooked Tankard's cellar, boar rooting up the
 * crofts past the toll gate, footpads on the Lord's Road, and wolves out on
 * the plains by night. Each is a repeatable quest ('bounty-<id>'): take the
 * notice, kill enough of them, and come back to the board to be paid in coin
 * and in the militia's (and the village's) good opinion.
 *
 * The board puts up three of the four notices each morning, picked by the
 * day; one claimed today isn't posted again until tomorrow. A notice that's
 * been taken stays up until it's claimed.
 */
export type BountyId = 'rats' | 'boar' | 'footpads' | 'wolves';

export interface BountyDef {
  id: BountyId;
  /** The notice's heading, and the quest's title. */
  title: string;
  /** What the notice says. */
  notice: string;
  /** The quest's summary, in the hero's words. */
  summary: string;
  /** What counts towards it, and how many. */
  foes: FoeKind[];
  need: number;
  /** What it says to do, e.g. "Kill three wild boar on Adowvale Plains". */
  task: string;
  coins: number;
  standing: Partial<Record<Faction, number>>;
  xp: number;
}

export const BOUNTIES: Record<BountyId, BountyDef> = {
  rats: {
    id: 'rats',
    title: 'Bounty: Rats at the Tankard',
    notice: "RAT-CATCHER WANTED. The rats are back in the Crooked Tankard's cellar. Four tails, twelve coins. By order of the reeve.",
    summary: "The militia have posted a bounty on the rats in Godric's cellar again. Four of them, and the sergeant pays twelve coins.",
    foes: ['rat'],
    need: 4,
    task: "Kill four rats in the Crooked Tankard's cellar",
    coins: 12,
    standing: { militia: 4, adowvale: 3 },
    xp: 30,
  },
  boar: {
    id: 'boar',
    title: 'Bounty: Boar in the Crofts',
    notice: 'BOAR. Wild boar are rooting up the crofters\' turnips past the toll gate. Two of them, thirty coins, and you keep the meat.',
    summary: 'Boar have been at the crofters\' fields out on Adowvale Plains. The militia pay thirty coins for two of them.',
    foes: ['boar'],
    need: 2,
    task: 'Kill two wild boar on Adowvale Plains',
    coins: 30,
    standing: { militia: 5, adowvale: 4 },
    xp: 45,
  },
  footpads: {
    id: 'footpads',
    title: "Bounty: Footpads on the Lord's Road",
    notice: "FOOTPADS. A pair, a tall one in a hood and a bald one with a knife, stopping folk on the Lord's Road. Forty coins to see them off for good.",
    summary: "The militia want the footpads on the Lord's Road dealt with: Rook and Nab, by the sound of it. Forty coins for the pair.",
    foes: ['footpad', 'cutpurse'],
    need: 2,
    task: "Beat the footpads on the Lord's Road",
    coins: 40,
    standing: { militia: 8, adowvale: 3 },
    xp: 60,
  },
  wolves: {
    id: 'wolves',
    title: 'Bounty: Wolves by Night',
    notice: "WOLVES. A pack is hunting the plains after dark and the drovers won't go out. Three wolves, thirty-five coins. Go careful.",
    summary: 'A wolf pack hunts Adowvale Plains at night. The militia pay thirty-five coins for three of them.',
    foes: ['wolf'],
    need: 3,
    task: 'Kill three wolves on Adowvale Plains (they hunt at night)',
    coins: 35,
    standing: { militia: 6, adowvale: 4 },
    xp: 60,
  },
};

export const BOUNTY_IDS = Object.keys(BOUNTIES) as BountyId[];
/** How many notices the board puts up each morning. */
export const POSTED_EACH_DAY = 3;

export const questId = (id: BountyId) => `bounty-${id}`;

// Each bounty is a quest that can be done again and again.
for (const b of Object.values(BOUNTIES)) {
  QUESTS[questId(b.id)] = {
    id: questId(b.id),
    title: b.title,
    giver: 'The militia',
    summary: b.summary,
    objectives: [
      { id: 'hunt', text: b.task },
      { id: 'claim', text: "Claim the bounty at the notice board in Adowvale's market square" },
    ],
    xp: b.xp,
    repeatable: true,
  };
}

/** The notices up on a day (before taken and claimed ones are counted): all but one, which one changing day by day. */
export function postedOn(day: number): BountyId[] {
  const skip = (((day * 7 + 3) % BOUNTY_IDS.length) + BOUNTY_IDS.length) % BOUNTY_IDS.length;
  return BOUNTY_IDS.filter((_, i) => i !== skip).slice(0, POSTED_EACH_DAY);
}

/** A bounty the hero has taken: how many they've killed towards it. */
interface Taken {
  count: number;
  day: number;
}

/** What a notice on the board is, for the hero: open to take, under way, ready to claim, or claimed today. */
export type NoticeState = 'open' | 'taken' | 'ready' | 'claimed';

class BountyBoard {
  private taken = new Map<BountyId, Taken>();
  /** The day each was last claimed. */
  private claimedOn = new Map<BountyId, number>();
  /** How many times each has been claimed, ever. */
  private claims = new Map<BountyId, number>();
  day: () => number = () => QuestLog.dayProvider();

  reset(): void {
    this.taken.clear();
    this.claimedOn.clear();
    this.claims.clear();
  }

  /** The notices on the board today, with where the hero is with each. */
  notices(): Array<{ def: BountyDef; state: NoticeState; count: number }> {
    const today = this.day();
    const up = new Set<BountyId>(postedOn(today));
    for (const id of this.taken.keys()) up.add(id);
    for (const [id, day] of this.claimedOn) if (day === today) up.add(id);
    return BOUNTY_IDS.filter((id) => up.has(id)).map((id) => ({ def: BOUNTIES[id], state: this.state(id), count: this.taken.get(id)?.count ?? 0 }));
  }

  state(id: BountyId): NoticeState {
    const t = this.taken.get(id);
    if (t) return t.count >= BOUNTIES[id].need ? 'ready' : 'taken';
    return this.claimedOn.get(id) === this.day() ? 'claimed' : 'open';
  }

  /** Whether the hero is out after this kind of beast for a bounty (and hasn't killed enough yet). */
  wants(kind: FoeKind): boolean {
    return [...this.taken].some(([id, t]) => BOUNTIES[id].foes.includes(kind) && t.count < BOUNTIES[id].need);
  }

  has(id: BountyId): boolean {
    return this.taken.has(id);
  }

  timesClaimed(id?: BountyId): number {
    if (id) return this.claims.get(id) ?? 0;
    return [...this.claims.values()].reduce((a, b) => a + b, 0);
  }

  /** Takes a notice down from the board: the bounty's quest begins. */
  take(id: BountyId): boolean {
    if (this.state(id) !== 'open' || !this.notices().some((n) => n.def.id === id)) return false;
    this.taken.set(id, { count: 0, day: this.day() });
    QuestLog.start(questId(id));
    return true;
  }

  /**
   * Beasts killed in a fight: counted towards any bounty on them.
   * Returns what to tell the hero ("Boar for the bounty: 1 of 2").
   */
  slain(kinds: FoeKind[]): string[] {
    const said: string[] = [];
    for (const [id, t] of this.taken) {
      const def = BOUNTIES[id];
      if (t.count >= def.need) continue;
      const n = kinds.filter((k) => def.foes.includes(k)).length;
      if (n === 0) continue;
      t.count = Math.min(def.need, t.count + n);
      if (t.count >= def.need) {
        QuestLog.complete(questId(id), 'hunt');
        said.push(`That's the ${def.title.replace('Bounty: ', '').toLowerCase()} bounty done. The militia will want to know.`);
      } else said.push(`${def.title.replace('Bounty: ', '')}: ${t.count} of ${def.need}.`);
    }
    return said;
  }

  /** Claims a finished bounty at the board: coins, standing, and the quest done. False if it isn't ready. */
  claim(id: BountyId): boolean {
    if (this.state(id) !== 'ready') return false;
    const def = BOUNTIES[id];
    this.taken.delete(id);
    this.claimedOn.set(id, this.day());
    this.claims.set(id, (this.claims.get(id) ?? 0) + 1);
    Inventory.reward(def.coins);
    Reputation.gainAll(def.standing, def.title);
    QuestLog.complete(questId(id), 'claim');
    return true;
  }

  /**
   * Beasts that are there because of a bounty: with the rat bounty taken,
   * rats are back in the Tankard's cellar (new ones each day it's still open).
   */
  spawns(area: string): CreatureSpawn[] {
    const rats = this.taken.get('rats');
    if (area !== 'cellar' || !rats || rats.count >= BOUNTIES.rats.need) return [];
    const left = BOUNTIES.rats.need - rats.count;
    const day = this.day();
    return CELLAR_RAT_SPOTS.slice(0, left).map(([gx, gy], i) => ({ id: `bounty-rat-${day}-${rats.count}-${i}`, kind: 'rat', gx, gy }));
  }

  toSave(): { taken: Partial<Record<BountyId, Taken>>; claimedOn: Partial<Record<BountyId, number>>; claims: Partial<Record<BountyId, number>> } {
    return {
      taken: Object.fromEntries([...this.taken].map(([id, t]) => [id, { ...t }])),
      claimedOn: Object.fromEntries(this.claimedOn),
      claims: Object.fromEntries(this.claims),
    };
  }

  fromSave(data: Partial<ReturnType<BountyBoard['toSave']>>): void {
    this.reset();
    for (const id of BOUNTY_IDS) {
      const t = data.taken?.[id];
      if (t && typeof t.count === 'number') this.taken.set(id, { count: t.count, day: t.day ?? 1 });
      const c = data.claimedOn?.[id];
      if (typeof c === 'number') this.claimedOn.set(id, c);
      const n = data.claims?.[id];
      if (typeof n === 'number') this.claims.set(id, n);
    }
  }
}

export const Bounties = new BountyBoard();

SaveGame.register('bounties', {
  save: () => Bounties.toSave(),
  load(data) {
    Bounties.reset();
    if (data) Bounties.fromSave(data as Partial<ReturnType<typeof Bounties.toSave>>);
  },
});
