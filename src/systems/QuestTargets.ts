/**
 * Where each quest step is done, for the quest markers (ui/QuestMarkers.ts, the minimap)
 * and the world map. A step can carry its own `target` (see ObjectiveDef); the quests
 * written before markers existed have theirs here, by quest and step id, so their
 * definitions in Quests.ts stay as they were. A step with no target gets no marker
 * (the end of the Ashes quest, say, which the story hasn't reached yet).
 *
 * Spots are tile positions in the area's map; tests/unit/questTargets.test.ts checks
 * that each one is in its map and that anyone named stands in that area.
 */
import type { AreaId } from '../world/MapData';
import { ObjectiveDef, QuestLog, QuestState, QuestTarget } from './Quests';
import { AREA_NAMES } from './SaveGame';

const MOTHER: QuestTarget = { area: 'home', x: 3, y: 2, npc: 'mother' };
const WIL: QuestTarget = { area: 'world', x: 17, y: 43, npc: 'drover' };
const WYSTAN: QuestTarget = { area: 'monastery', x: 29, y: 10, npc: 'porter' };
const IRAN: QuestTarget = { area: 'world', x: 18, y: 18, npc: 'iran' };
const GODRIC: QuestTarget = { area: 'tavern', x: 10, y: 2, npc: 'landlord' };

export const QUEST_TARGETS: Record<string, Record<string, QuestTarget>> = {
  'mother-medicine': {
    talk: MOTHER,
    // Out of the cottage door into the yard.
    leave: { area: 'world', x: 22.5, y: 39 },
    find: { area: 'abbey', x: 18, y: 16, npc: 'anselm' },
    moonpetal: { area: 'abbey', x: 20, y: 15 },
    willow: { area: 'plains', x: 49, y: 18 },
    brew: { area: 'cellar', x: 11, y: 1.5 },
    return: MOTHER,
  },
  'lost-sheep': {
    talk: WIL,
    cave: { area: 'cave', x: 2, y: 3 },
    find: { area: 'cave', x: 13, y: 12 },
    tell: WIL,
  },
  'wolf-mother': {
    talk: WYSTAN,
    den: { area: 'den', x: 4, y: 4.5 },
    slay: { area: 'den', x: 23, y: 20 },
    return: WYSTAN,
  },
  'chicken-feed': {
    talk: IRAN,
    buy: { area: 'market', x: 11, y: 9, npc: 'baker' },
    return: IRAN,
  },
  'the-raid': {
    search: { area: 'home', x: 2.4, y: 1.4 },
    outside: { area: 'world', x: 22.5, y: 39 },
    iran: { area: 'hut', x: 5.5, y: 4.4, npc: 'iran-hiding' },
  },
  'cellar-rats': {
    talk: GODRIC,
    cellar: { area: 'cellar', x: 2, y: 2 },
    clear: { area: 'cellar', x: 11, y: 3.5 },
    return: GODRIC,
  },
};

/** Where a quest step is done, if anywhere in particular. */
export function stepTarget(quest: QuestState, step: ObjectiveDef): QuestTarget | undefined {
  return step.target ?? QUEST_TARGETS[quest.def.id]?.[step.id];
}

/**
 * Where the hero should be heading now: the step the quest tracker shows. Before any quest
 * has begun that's Mother; on the night before the raid, the hero's own bed; on the raid's
 * morning, the yard. Undefined when there's nowhere in particular to go.
 */
export function currentTarget(): QuestTarget | undefined {
  const quest = QuestLog.focused;
  if (quest) {
    const step = QuestLog.current(quest);
    return step && stepTarget(quest, step);
  }
  if (QuestLog.hasFlag('raid-morning')) return { area: 'world', x: 22.5, y: 39 };
  if (QuestLog.hasFlag('raid-pending')) return { area: 'home', x: 6.5, y: 4.9 };
  if (QuestLog.all.length === 0) return MOTHER;
  return undefined;
}

/** An area's name as it reads after "in": "in Adowvale", "in the cottage", "in Saint Elda's walls". */
export function placeIn(area: AreaId): string {
  const name = AREA_NAMES[area] ?? area;
  return name.startsWith('The ') ? `the ${name.slice(4)}` : name.startsWith('Within ') ? name.slice(7) : name;
}
