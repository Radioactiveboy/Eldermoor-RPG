import type { AreaId } from '../world/MapData';
import { START_HOUR } from '../config';
import { SaveGame } from './SaveGame';

/**
 * The quest log: which quests the player has taken on, how far along each one
 * is, and the diary entries the journal shows. Quests are defined as data in
 * QUESTS below; game code only says "start this" or "this step is done".
 *
 * Objectives are revealed one at a time: the journal and HUD show the ones
 * already done plus the current one, so the next step stays a surprise.
 */
export interface ObjectiveDef {
  id: string;
  text: string;
  /** Where to go for it, for the quest markers and the world map (the older quests' are in QuestTargets.ts). */
  target?: QuestTarget;
}

/** A spot in an area (in its tiles), and optionally someone to find there, who is marked wherever they stand. */
export interface QuestTarget {
  area: AreaId;
  x: number;
  y: number;
  npc?: string;
}

/**
 * What sort of quest it is, which the journal groups its quest list by: the main story, a favour for
 * someone met along the way, or one of the militia's bounties.
 */
export type QuestKind = 'main' | 'side' | 'bounty';

/** The kinds in the order the journal lists them, with their headings and how a quest's page names one. */
export const QUEST_KINDS: ReadonlyArray<{ kind: QuestKind; heading: string; one: string }> = [
  { kind: 'main', heading: 'Main Quests', one: 'main quest' },
  { kind: 'side', heading: 'Side Quests', one: 'side quest' },
  { kind: 'bounty', heading: 'Bounties', one: 'bounty' },
];

export interface QuestDef {
  id: string;
  title: string;
  giver: string;
  kind: QuestKind;
  /** A short paragraph for the journal, in the hero's own words. */
  summary: string;
  objectives: ObjectiveDef[];
  /** Experience for finishing it (each step on the way earns a little too; see Experience.ts). */
  xp: number;
  /** Can be taken on again once finished (the militia's bounties, see systems/Bounties.ts). */
  repeatable?: boolean;
}

export const QUESTS: Record<string, QuestDef> = {
  'mother-medicine': {
    id: 'mother-medicine',
    title: 'Medicine for Mother',
    giver: 'Mother',
    kind: 'main',
    summary:
      "Mother's cough has turned to fever, and it worsens with every night. She says a tincture of moonpetal and willow bark " +
      'could ease it, but we have none left. Someone in Eldermoor must sell it.',
    objectives: [
      { id: 'talk', text: 'Speak with Mother' },
      { id: 'leave', text: 'Head out into the village' },
      { id: 'find', text: 'Find a healer or herbalist with moonpetal tincture' },
      { id: 'moonpetal', text: "Gather moonpetal in Saint Elda's cloister garden" },
      { id: 'willow', text: 'Find willow bark for the tincture' },
      { id: 'brew', text: "Brew the moonpetal and willow bark into a tincture at Old Maud's bench, in the Crooked Tankard's cellar" },
      { id: 'return', text: 'Bring the tincture home to Mother' },
    ],
    xp: 200,
  },
  'lost-sheep': {
    id: 'lost-sheep',
    title: 'The Lost Ewes',
    giver: 'Wil the Drover',
    kind: 'side',
    summary:
      "Wil, a drover on the old road, has lost two of Master Coombe's ewes, Bess and Bramble. Something big spooked them " +
      'by the lake, and its tracks lead north past our cottage, to the cave in the hill. He is too frightened to look himself.',
    objectives: [
      { id: 'talk', text: 'Speak with Wil the Drover' },
      { id: 'cave', text: 'Follow the tracks north to the cave in the hill' },
      { id: 'find', text: 'Find Bess and Bramble' },
      { id: 'tell', text: 'Tell Wil what became of his ewes' },
    ],
    xp: 150,
  },
  'wolf-mother': {
    id: 'wolf-mother',
    title: 'The Wolf Mother',
    giver: 'Brother Wystan',
    kind: 'main',
    summary:
      "Wolves have been harrying the brothers of Saint Elda on the Lord's Road, and the Prior has barred the gate to all guests " +
      'until they stop. Brother Wystan says they are led by a great white she-wolf, the Wolf Mother, from an old den out on ' +
      'Adowvale Plains. If I put an end to her, the gate will be opened to me.',
    objectives: [
      { id: 'talk', text: 'Speak with Brother Wystan' },
      { id: 'den', text: "Find the Wolf Mother's den on Adowvale Plains" },
      { id: 'slay', text: 'Slay the Wolf Mother' },
      { id: 'return', text: 'Tell Brother Wystan the road is safe' },
    ],
    xp: 250,
  },
  'chicken-feed': {
    id: 'chicken-feed',
    title: 'Feed for the Hens',
    giver: 'Farmer Iran',
    kind: 'side',
    summary:
      'Farmer Iran, who keeps hens on the hill north of our cottage, has run out of chicken feed, and hungry hens do not lay. ' +
      "He can't leave the farm with wolves about, so he gave me ten coins to buy a sack from Hilde's bakehouse stall at the market.",
    objectives: [
      { id: 'talk', text: 'Speak with Farmer Iran' },
      { id: 'buy', text: "Buy a sack of chicken feed at Hilde's stall in Adowvale's market square" },
      { id: 'return', text: 'Bring the feed back to Farmer Iran' },
    ],
    xp: 80,
  },
  'the-raid': {
    id: 'the-raid',
    title: 'Ashes',
    giver: 'Myself',
    kind: 'main',
    summary:
      'Goblins came out of the north woods at dawn and fell on the farm. I tried to stop them, and they beat me senseless. When I came ' +
      "to, the cottage was burnt to its rafters, there was blood all over the floor, and Mother was gone. I have to find out what " +
      'they did with her.',
    objectives: [
      { id: 'search', text: 'Search what is left of the cottage' },
      { id: 'outside', text: 'Go outside and look for Mother' },
      { id: 'iran', text: "See if Farmer Iran and his children are safe" },
      {
        id: 'trail',
        text: "Follow the goblins' trail north, past the wolves' cave and into the woods",
        target: { area: 'northwoods', x: 30.5, y: 72 },
      },
      { id: 'signs', text: 'Look along the trail for any sign of Mother', target: { area: 'northwoods', x: 33.5, y: 32.5 } },
      { id: 'edge', text: 'See where the trail leads', target: { area: 'northwoods', x: 41, y: 6 } },
      {
        id: 'word',
        text: "Take word to the militia in Adowvale's market square, as Iran said",
        target: { area: 'market', x: 11.5, y: 15.5, npc: 'guard-1' },
      },
      {
        id: 'sergeant',
        text: 'Tell Sergeant Brannock at the garrison where the trail leads',
        target: { area: 'garrison', x: 8, y: 1.6, npc: 'sergeant' },
      },
      { id: 'prisoner', text: 'Question the goblin in the cells under the garrison', target: { area: 'jail', x: 6.3, y: 2.55, npc: 'snikkit' } },
      {
        id: 'fells',
        text: "Follow the goblins' trail up out of the woods to Greyfells Clearing",
        target: { area: 'greyfells', x: 23.5, y: 26 },
      },
      { id: 'camp', text: "Search the goblins' camp for any sign of Mother", target: { area: 'greyfells', x: 21, y: 23 } },
      { id: 'warren', text: 'Find where the trail goes from the camp', target: { area: 'greyfells', x: 24.5, y: 7.5 } },
      { id: 'descend', text: 'Go down into the hole in the hill', target: { area: 'greyfells', x: 24.5, y: 7.5 } },
      { id: 'tunnels', text: "Find the way down through the goblins' tunnels", target: { area: 'warren', x: 29.5, y: 1.5 } },
      { id: 'brute', text: 'Get past the Brute', target: { area: 'broodhall', x: 12.5, y: 8.5 } },
      { id: 'mother', text: 'Find Mother', target: { area: 'broodhall', x: 16.2, y: 16.6, npc: 'mother-dying' } },
      { id: 'orb', text: 'Take the orb', target: { area: 'broodhall', x: 16.5, y: 21.2 } },
      { id: 'out', text: "Carry Mother out of the warren", target: { area: 'warren', x: 1.2, y: 3.5 } },
      { id: 'bury', text: 'Take Mother home to the Hollow' },
    ],
    xp: 300,
  },
  'the-watcher': {
    id: 'the-watcher',
    title: 'The Watcher in the Glass',
    kind: 'main',
    giver: 'Myself',
    summary:
      'When Mother died, something spoke out of the orb in the brood hall: a cold voice, from very far away, that called the goblins\' ' +
      'mother a failure and told them to kill me and finish Adowvale. The orb is dark now, and in my satchel. Whoever was looking out of it ' +
      'set the goblins on us. On her. I am going to find out who.',
    objectives: [{ id: 'who', text: 'Find out who spoke through the orb, and set the goblins on Adowvale' }],
    xp: 500,
  },
  // Heard through the orb the night after the beacon (scenes/game/whisper.ts, dialogue/orbWhisper.ts).
  'the-marsh-road': {
    id: 'the-marsh-road',
    title: 'The Road to Gloomhaven',
    kind: 'main',
    giver: 'Myself',
    summary:
      'The orb woke in the night, and I overheard two voices through it. One was the cold voice from the brood hall; the other called ' +
      'him Astarix, and spoke of Daejonguk. The orb is a seeing stone, one of a pair, and he holds its twin. Adowvale has cost him the ' +
      'goblins\' Mother, so he is turning to Gloomhaven, a marsh town out past the edge of the shire, much bigger than Adowvale and full of ' +
      'the sort of people the carters lower their voices about. He means to buy it from the inside, and every road out of the marshes ' +
      'runs to some other door. Ours among them. Somebody has to get there before he does.',
    objectives: [{ id: 'way', text: 'Find the way to Gloomhaven, a town on the marshes beyond the shire of Adowvale' }],
    xp: 400,
  },
  'the-pen': {
    id: 'the-pen',
    title: 'In the Pen',
    giver: 'Myself',
    kind: 'side',
    summary:
      "The goblins keep a pen in their tunnels under the Greyfells, like the sheep pen at their camp on the fell. It isn't sheep in this one.",
    objectives: [{ id: 'free', text: 'Get whoever is in the pen out of the warren', target: { area: 'warren', x: 5, y: 15 } }],
    xp: 80,
  },
  'the-gate': {
    id: 'the-gate',
    title: 'The Night They Came',
    kind: 'main',
    giver: 'Myself',
    summary:
      "I fought the goblins keeping their camp on the Greyfells, and one more got away up the hill, blowing a horn. They know someone found " +
      "their camp now, and it won't take them long to guess where from. Adowvale. I have to warn the militia, and be there when they come.",
    objectives: [
      { id: 'warn', text: "Warn the militia in Adowvale's square that the goblins will come", target: { area: 'market', x: 11.5, y: 15.5, npc: 'guard-1' } },
      { id: 'hold', text: 'Stand with the militia on the old road into Adowvale when the goblins come, after dark', target: { area: 'market', x: 29.5, y: 17.5 } },
    ],
    xp: 250,
  },
  'cellar-rats': {
    id: 'cellar-rats',
    title: 'Rats in the Cellar',
    giver: 'Godric the Landlord',
    kind: 'side',
    summary:
      "Godric, who keeps the Crooked Tankard in Adowvale, has rats in his cellar: big as cats, he says, and twice as bold. They have " +
      "been at his grain and his kegs, and the maids won't go down there. He'll pay 25 coins to have them cleared out.",
    objectives: [
      { id: 'talk', text: 'Speak with Godric the Landlord' },
      { id: 'cellar', text: 'Go down through the trapdoor by the bar to the cellar' },
      { id: 'clear', text: 'Kill the rats in the cellar' },
      { id: 'return', text: 'Tell Godric his cellar is clear' },
    ],
    xp: 70,
  },
  // The Headman's errand once Mother is home and buried (scenes/game/beacon.ts, dialogue/beacon.ts).
  'the-beacon': {
    id: 'the-beacon',
    title: 'The Beacon on Corbie Tor',
    giver: 'Headman Osbert Hale',
    kind: 'side',
    summary:
      'Headman Hale wants the old signal beacon on Corbie Tor opened up again, after what came down off the Greyfells. Its watch was stood ' +
      'down twelve years ago and it has stood empty since, though the carters talk of smoke from it some nights. I am to go up and see what ' +
      'state it is in, the door, the stair and the brazier on top, and come back and tell him. And I am not to light it.',
    objectives: [
      { id: 'talk', text: 'Hear the Headman out', target: { area: 'residence', x: 13.2, y: 1.35, npc: 'headman' } },
      { id: 'find', text: 'Find the old beacon on Corbie Tor, in the far north of the plains', target: { area: 'plains', x: 90, y: 12 } },
      { id: 'inside', text: 'Go inside the beacon', target: { area: 'plains', x: 90, y: 9 } },
      { id: 'brigands', text: 'Deal with the brigands holding the beacon: pay them, bargain, or fight', target: { area: 'beacon', x: 2.4, y: 1.75, npc: 'corwin' } },
      { id: 'brazier', text: 'Climb to the top of the tower and look over the brazier', target: { area: 'beacon-top', x: 3.5, y: 4.5 } },
      { id: 'return', text: 'Tell Headman Hale what you found', target: { area: 'residence', x: 13.2, y: 1.35, npc: 'headman' } },
    ],
    xp: 320,
  },
  // Putting the Hollow right (systems/Homestead.ts, scenes/game/homestead.ts): the cottage first, then better than it was, and Iran's stead.
  'hearth-and-home': {
    id: 'hearth-and-home',
    title: 'Hearth and Home',
    giver: 'Headman Osbert Hale',
    kind: 'side',
    summary:
      'The Headman has written the cottage and the land in the village book in my name, and says there are men ready to put a roof on it ' +
      'whenever I am. I am ready. The burnt timbers have to come out first, then Osric will tell me what it wants: oak, reed for the thatch, ' +
      'nails and stone. I can cut and gather most of it myself, or buy it in Adowvale. It will never be the house she lived in. But it can be a home.',
    objectives: [
      { id: 'talk', text: 'Tell the Headman you are ready to rebuild', target: { area: 'residence', x: 13.2, y: 1.35, npc: 'headman' } },
      { id: 'clear', text: 'Drag the burnt timbers out of the cottage', target: { area: 'world', x: 19.5, y: 39.5 } },
      { id: 'osric', text: 'Ask Osric what the cottage will need', target: { area: 'smithy', x: 3.5, y: 2.88, npc: 'smith' } },
      { id: 'walls', text: 'Bring 12 oak timber, 16 bundles of reed and 2 kegs of nails to the builder\'s pile at the cottage', target: { area: 'world', x: 22.5, y: 34.5 } },
      { id: 'raise', text: "Let Osric's work party raise the walls and the roof (three days)", target: { area: 'world', x: 19.5, y: 39.5 } },
      { id: 'hearth', text: 'Bring 6 dressed stone, 4 oak timber and 40 coins for the joiner to the builder\'s pile', target: { area: 'world', x: 22.5, y: 34.5 } },
      { id: 'furnish', text: 'Let them build the hearth and fit out the room (two days)', target: { area: 'world', x: 19.5, y: 39.5 } },
      { id: 'sleep', text: 'Sleep under your own roof again', target: { area: 'home', x: 6.5, y: 4.9 } },
    ],
    xp: 260,
  },
  'hollow-made-good': {
    id: 'hollow-made-good',
    title: 'The Hollow Made Good',
    giver: 'Osric the Smith',
    kind: 'side',
    summary:
      'The cottage stands again, and Osric has left his plans for the Hollow pinned up by the builder\'s pile: a well, a herb garden, ' +
      'a workshop, a paddock, a wall round the yard, a slate roof. One at a time, as I find the coin and the stuff for them. ' +
      'Better than it was, he says. She would have liked that.',
    objectives: [
      { id: 'plans', text: "Look over Osric's plans at the builder's pile", target: { area: 'world', x: 22.5, y: 34.5 } },
      { id: 'first', text: 'Build the first improvement on the Hollow', target: { area: 'world', x: 22.5, y: 34.5 } },
      { id: 'three', text: 'Build three improvements on the Hollow', target: { area: 'world', x: 22.5, y: 34.5 } },
      { id: 'all', text: "Build everything on Osric's plans", target: { area: 'world', x: 22.5, y: 34.5 } },
    ],
    xp: 300,
  },
  'irans-stead': {
    id: 'irans-stead',
    title: "Iran's Stead",
    giver: 'Farmer Iran',
    kind: 'side',
    summary:
      'The goblins burnt Iran\'s coop, scorched his hut and smashed his fences, and he has no money to put any of it right. He will not take ' +
      'charity, he says, so I am calling it rent for the plot. Whatever I give him goes on timber and the cooper\'s boys\' hire, ' +
      'a piece at a time: the coop, then the hut, then the pen, then, if it ever comes to it, a little barn.',
    objectives: [
      { id: 'talk', text: 'Offer to help Iran put his stead right', target: { area: 'hut', x: 5, y: 4 } },
      { id: 'coop', text: 'Give Iran 40 coins in all, for a new hen coop', target: { area: 'hut', x: 5, y: 4 } },
      { id: 'hut', text: 'Give Iran 90 coins in all, to mend and thatch his hut', target: { area: 'hut', x: 5, y: 4 } },
      { id: 'pen', text: 'Give Iran 150 coins in all, for new fences and hens', target: { area: 'hut', x: 5, y: 4 } },
      { id: 'barn', text: 'Give Iran 220 coins in all, for a little barn', target: { area: 'hut', x: 5, y: 4 } },
    ],
    xp: 180,
  },
  'speckle-and-moppet': {
    id: 'speckle-and-moppet',
    title: 'Speckle and Moppet',
    giver: 'Pip and Hetty',
    kind: 'side',
    summary:
      'Pip and Hetty came through the raid without a scratch, but two things are breaking their hearts. Speckle, Hetty\'s own hen, ' +
      'got out when the goblins fired the coop and ran off down the hill. And Moppet, Hetty\'s rag doll, was down at our cottage: ' +
      'Mother was sewing a new eye on her. If either of them came through, I mean to bring them home.',
    objectives: [
      { id: 'talk', text: 'Hear what Pip and Hetty have lost', target: { area: 'hut', x: 5, y: 4 } },
      { id: 'moppet', text: "Look for Hetty's rag doll in the ruins of the cottage", target: { area: 'home', x: 4.6, y: 5.6 } },
      { id: 'speckle', text: 'Find Speckle. Pip saw her run down the hill, towards our garden', target: { area: 'world', x: 26.5, y: 37.5 } },
      { id: 'return', text: 'Bring Speckle and Moppet back to Pip and Hetty', target: { area: 'hut', x: 5, y: 4 } },
    ],
    xp: 60,
  },
};

export interface QuestState {
  def: QuestDef;
  done: Set<string>;
  completed: boolean;
  /** In-game day the quest began, for the journal. */
  day: number;
}

export interface DiaryEntry {
  day: number;
  /** Hour of the day it was written, 0 up to 24 (saves from before the diary kept the hour have none). */
  hour?: number;
  text: string;
}

/** When an entry was written, for the journal: "Day 3, 14:20", or just "Day 3" for one from an older save. */
export function diaryStamp(entry: DiaryEntry): string {
  if (entry.hour === undefined) return `Day ${entry.day}`;
  const minutes = Math.floor((((entry.hour % 24) + 24) % 24) * 60);
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
  const mm = String(minutes % 60).padStart(2, '0');
  return `Day ${entry.day}, ${hh}:${mm}`;
}

export type QuestEvent =
  | { type: 'started'; quest: QuestState }
  | { type: 'progress'; quest: QuestState; objective: ObjectiveDef }
  | { type: 'completed'; quest: QuestState }
  | { type: 'diary'; entry: DiaryEntry };

type Listener = (e: QuestEvent) => void;

class QuestLogStore {
  private quests: QuestState[] = [];
  private diaryEntries: DiaryEntry[] = [];
  /** Things that have happened which quests may care about later (e.g. 'saw-bess'). */
  private flags = new Set<string>();
  private listeners = new Set<Listener>();
  /** Id of the quest last started or moved on (see `focused`). */
  private focusId?: string;
  /** Supplies the current in-game day for new entries. */
  dayProvider: () => number = () => 1;
  /** Supplies the hour of the day (0 up to 24) for new entries. */
  hourProvider: () => number = () => START_HOUR;

  /** Forget everything, for a new game. The opening diary entry is written quietly, at the hour the game begins. */
  reset(openingEntry?: string): void {
    this.quests = [];
    this.diaryEntries = openingEntry ? [{ day: 1, hour: START_HOUR, text: openingEntry }] : [];
    this.flags.clear();
    this.focusId = undefined;
  }

  setFlag(flag: string): void {
    this.flags.add(flag);
  }

  clearFlag(flag: string): void {
    this.flags.delete(flag);
  }

  hasFlag(flag: string): boolean {
    return this.flags.has(flag);
  }

  /** The quest the player is most likely busy with: the last one started or moved on, if it's still going. */
  get focused(): QuestState | undefined {
    const quest = this.focusId ? this.get(this.focusId) : undefined;
    return quest && !quest.completed ? quest : this.active[0];
  }

  get all(): readonly QuestState[] {
    return this.quests;
  }

  get active(): QuestState[] {
    return this.quests.filter((q) => !q.completed);
  }

  get diary(): readonly DiaryEntry[] {
    return this.diaryEntries;
  }

  get(id: string): QuestState | undefined {
    return this.quests.find((q) => q.def.id === id);
  }

  has(id: string): boolean {
    return !!this.get(id);
  }

  isDone(id: string, objective: string): boolean {
    return !!this.get(id)?.done.has(objective);
  }

  /** Begins a quest, optionally with some steps already done (e.g. "speak with her" when she gave it). */
  start(id: string, alreadyDone: string[] = []): void {
    const before = this.get(id);
    if (before && !(before.completed && before.def.repeatable)) return;
    // A repeatable quest done before starts over: the old one makes way for the new.
    if (before) this.quests.splice(this.quests.indexOf(before), 1);
    const def = QUESTS[id];
    if (!def) throw new Error(`Unknown quest: ${id}`);
    const quest: QuestState = { def, done: new Set(alreadyDone), completed: false, day: this.dayProvider() };
    this.quests.push(quest);
    this.focusId = id;
    this.emit({ type: 'started', quest });
  }

  /** Marks a step done. The quest completes when its last step is done. */
  complete(id: string, objective: string): void {
    const quest = this.get(id);
    if (!quest || quest.completed || quest.done.has(objective)) return;
    const def = quest.def.objectives.find((o) => o.id === objective);
    if (!def) return;
    quest.done.add(objective);
    this.focusId = id;
    this.emit({ type: 'progress', quest, objective: def });
    if (quest.def.objectives.every((o) => quest.done.has(o.id))) {
      quest.completed = true;
      this.emit({ type: 'completed', quest });
    }
  }

  /** The step the player should be working on, or undefined once all are done. */
  current(quest: QuestState): ObjectiveDef | undefined {
    return quest.def.objectives.find((o) => !quest.done.has(o.id));
  }

  /** Steps to show: everything done so far plus the current one. */
  visibleObjectives(quest: QuestState): Array<ObjectiveDef & { done: boolean }> {
    const out: Array<ObjectiveDef & { done: boolean }> = [];
    for (const o of quest.def.objectives) {
      const done = quest.done.has(o.id);
      out.push({ ...o, done });
      if (!done) break;
    }
    return out;
  }

  /** The log as plain data, for a save. */
  toSave(): {
    quests: Array<{ id: string; done: string[]; completed: boolean; day: number }>;
    diary: DiaryEntry[];
    flags?: string[];
    focus?: string;
  } {
    return {
      quests: this.quests.map((q) => ({ id: q.def.id, done: [...q.done], completed: q.completed, day: q.day })),
      diary: this.diaryEntries.map((e) => ({ ...e })),
      flags: [...this.flags],
      focus: this.focusId,
    };
  }

  /** Puts the log back from a save, quietly (no "new quest" announcements). */
  fromSave(data: ReturnType<QuestLogStore['toSave']>): void {
    // Quests that have since been taken out of the game are skipped.
    this.quests = data.quests
      .filter((q) => QUESTS[q.id])
      .map((q) => ({ def: QUESTS[q.id], done: new Set(q.done), completed: q.completed, day: q.day }));
    this.diaryEntries = data.diary.map((e) => ({ ...e }));
    this.flags = new Set(data.flags ?? []);
    this.focusId = data.focus;
  }

  writeDiary(text: string): void {
    const entry = { day: this.dayProvider(), hour: this.hourProvider(), text };
    this.diaryEntries.push(entry);
    this.emit({ type: 'diary', entry });
  }

  /** Calls fn on every change. Returns an unsubscribe function. */
  onChange(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(e: QuestEvent): void {
    this.listeners.forEach((fn) => fn(e));
  }
}

export const QuestLog = new QuestLogStore();

SaveGame.register('quests', {
  save: () => QuestLog.toSave(),
  load(data) {
    QuestLog.reset();
    if (data) QuestLog.fromSave(data as ReturnType<QuestLogStore['toSave']>);
  },
});
