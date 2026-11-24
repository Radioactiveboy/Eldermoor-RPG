/**
 * Putting the Hollow right, as the hero does it (see systems/Homestead.ts for
 * the rules and world/Homestead.ts for how it looks): dragging the burnt timber
 * out of the shell, bringing goods to the builder's pile and paying the joiner,
 * picking from Osric's plans, giving Iran coins for his stead, and the diary,
 * the quest steps and the HUD's word as each piece of work is finished.
 */
import { GameAudio } from '../../audio/Audio';
import { Homestead, IMPROVEMENTS, PROJECTS, ProjectId, RUBBLE, STEAD_GIFT, STEAD_STAGES } from '../../systems/Homestead';
import { Experience } from '../../systems/Experience';
import { Inventory, ItemId, itemDef } from '../../systems/Inventory';
import { QuestLog } from '../../systems/Quests';
import { Reputation } from '../../systems/Reputation';
import { REBUILDING } from '../../world/Homestead';
import type { Sight } from '../../world/MapData';
import type { ConfirmSceneData } from '../ConfirmScene';
import type { GameScene } from '../GameScene';
import type { DialogueAction } from './dialogueActions';
import { startChannel } from './sights';

export const IMPROVING = 'hollow-made-good';
export const STEAD = 'irans-stead';

/** How long dragging out one heap of burnt timber takes, in real seconds. */
const RUBBLE_SECONDS = 3.2;
/** XP for each improvement built (the quest's own comes at the end). */
const IMPROVEMENT_XP = 40;

/** "12 oak timber, 16 bundles of reed and 40 coins", from what's wanted. */
export function listOf(wanted: Record<string, number>): string {
  const parts = Object.entries(wanted).map(([what, n]) => {
    if (what === 'coins') return `${n} coins`;
    const name = itemDef(what as ItemId).name;
    return `${n} × ${name}`;
  });
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

// ------------------------------------------------------------ the burnt timber

/** E at a heap of burnt timber: drag it out. Now and then a beam turns out sound under the char. */
export function clearRubble(g: GameScene, sight: Sight): void {
  if (Homestead.cleared.has(sight.id)) return;
  GameAudio.rustle();
  startChannel(g, {
    label: 'Dragging out timber',
    seconds: RUBBLE_SECONDS,
    onDone: () => {
      Homestead.cleared.add(sight.id);
      GameAudio.block();
      // The heap goes; a smudge of ash is left where it lay, and it's no longer in the way.
      const obj = (g.map.data.objects ?? []).find((o) => o.key === 'hs-rubble' && o.tx === Math.floor(sight.gx) && o.ty === Math.floor(sight.gy));
      if (obj) g.map.reshapeObject(obj, 'hs-ash-patch', [], []);
      g.map.data.sights = (g.map.data.sights ?? []).filter((s) => s !== sight);
      const index = RUBBLE.indexOf(sight.id as (typeof RUBBLE)[number]);
      if (index === 1 || index === 3) {
        if (Inventory.add('timber', 1)) GameAudio.pickup();
        g.onHint?.('Black right through, all of it but this one beam. Under the char it is sound oak. That can go back in.');
      }
      const left = RUBBLE.filter((id) => !Homestead.cleared.has(id)).length;
      if (left > 0) {
        if (index !== 1 && index !== 3) g.onHint?.(left === 1 ? 'One more heap.' : `Out on the grass with it. ${left} heaps to go.`);
        return;
      }
      clearedShell(g);
    },
  }, { x: sight.gx, y: sight.gy });
}

/** The last heap out: the shell is swept, and it's time to see Osric. */
function clearedShell(g: GameScene): void {
  QuestLog.complete(REBUILDING, 'clear');
  const home = (g.map.data.objects ?? []).find((o) => o.key.startsWith('bld-cottage'));
  if (home) g.map.setObjectArt(home, 'bld-cottage-cleared');
  g.onHint?.("That's the last of it. Four walls and a chimney, swept out. Now Osric can tell me what it wants.");
  QuestLog.writeDiary(
    'Dragged the last of the burnt timber out of the cottage today. Her bed, the table, the rafters, all of it, out on the grass in black heaps. ' +
      'It is only walls and a chimney now, swept to the boards. It looks smaller. I thought it would hurt more, and it did, and then it did not. ' +
      'Osric is to tell me what it wants.',
  );
}

// ------------------------------------------------------------ the builder's pile

/** E at the builder's pile: bring what's wanted, see what's still wanted, or (later) choose from Osric's plans. */
export function atPile(g: GameScene): void {
  const work = Homestead.work;
  if (work) {
    const name = PROJECTS[work.project].name.toLowerCase();
    g.onHint?.(
      g.clock.elapsedHours < work.from
        ? `Everything for ${name} is here. Osric's lads will be up at first light.`
        : `They are at work on ${name}. ${daysLeft(g, work.until)}`,
    );
    return;
  }
  if (!QuestLog.isDone(REBUILDING, 'osric')) {
    g.onHint?.("A clear patch for the timber, and a post to pin the plans to. I need to ask Osric what it'll all want.");
    return;
  }
  if (Homestead.built.has('hearth')) {
    choosePlan(g);
    return;
  }
  const project = Homestead.open()[0];
  if (project) bringTo(g, project);
}

/** "Two more days, Osric reckons." */
function daysLeft(g: GameScene, until: number): string {
  const days = Math.ceil((until - g.clock.elapsedHours) / 24);
  return days <= 1 ? 'It should be done by morning.' : `${days} more days, Osric reckons.`;
}

/** Osric's plans, once the cottage is a home again: which improvement to work towards. */
function choosePlan(g: GameScene): void {
  if (!QuestLog.has(IMPROVING)) QuestLog.start(IMPROVING);
  QuestLog.complete(IMPROVING, 'plans');
  const open = IMPROVEMENTS.filter((p) => !Homestead.built.has(p));
  if (open.length === 0) {
    g.onHint?.("Every line on Osric's plans has a mark through it. The Hollow is better than it ever was.");
    return;
  }
  if (!g.takeControls()) return;
  const data: ConfirmSceneData = {
    question: "Osric's plans for the Hollow",
    note: 'Pick one to work towards. Bring what it wants here, and his lads will build it.',
    choices: open.map((p) => {
      const left = Homestead.missing(p);
      const started = Object.keys(left).length < Object.keys({ ...PROJECTS[p].needs, ...(PROJECTS[p].coins ? { coins: 1 } : {}) }).length || Object.entries(left).some(([w, n]) => n < ((PROJECTS[p].needs as Record<string, number>)[w] ?? PROJECTS[p].coins ?? 0));
      return `${PROJECTS[p].name}${started ? ' (begun)' : ''}`;
    }),
    onAnswer: () => undefined,
    onChoice: (i) => {
      g.release();
      if (i !== undefined) g.time.delayedCall(120, () => bringTo(g, open[i]));
    },
  };
  g.scene.launch('Confirm', data);
}

/**
 * Bring what the satchel holds of what's wanted for a piece of work (and pay
 * any coins it needs), then say what's still wanted, or set the lads to it.
 */
function bringTo(g: GameScene, project: ProjectId): void {
  const def = PROJECTS[project];
  const wanted = Homestead.missing(project);
  const carrying = Object.keys(wanted).filter((w) => w !== 'coins' && Inventory.count(w as ItemId) > 0);
  const coins = wanted.coins ?? 0;
  if (!g.takeControls()) return;
  const choices: string[] = [];
  const acts: Array<() => void> = [];
  if (carrying.length > 0) {
    choices.push('Bring what I have of it');
    acts.push(() => deliverAll(g, project));
  }
  if (coins > 0 && Inventory.coins >= coins) {
    choices.push(`Leave ${coins} coins for ${project === 'hearth' ? 'the joiner' : "the lads' hire"}`);
    acts.push(() => {
      Inventory.addCoins(-coins);
      Homestead.deliver(project, 'coins', coins);
      GameAudio.coins();
      afterDelivery(g, project);
    });
  }
  const data: ConfirmSceneData = {
    question: def.name,
    note: `${def.blurb} Still wanted: ${listOf(wanted)}.${carrying.length ? ` I have ${listOf(Object.fromEntries(carrying.map((w) => [w, Math.min(wanted[w], Inventory.count(w as ItemId))])))} on me.` : ''}`,
    choices,
    onAnswer: () => undefined,
    onChoice: (i) => {
      g.release();
      if (i !== undefined) acts[i]();
      else if (choices.length === 0) g.onHint?.(nothingToBring(wanted));
    },
  };
  if (choices.length === 0) {
    g.release();
    g.onHint?.(nothingToBring(wanted));
    return;
  }
  g.scene.launch('Confirm', data);
}

function nothingToBring(wanted: Record<string, number>): string {
  return `I have none of it on me. It still wants ${listOf(wanted)}. Osric sells most of it, and Wren has reed at the jetty, or I can cut and gather my own.`;
}

/** Everything in the satchel that's wanted goes on the pile. */
function deliverAll(g: GameScene, project: ProjectId): void {
  let any = false;
  for (const what of Object.keys(Homestead.missing(project))) {
    if (what === 'coins') continue;
    const id = what as ItemId;
    const n = Homestead.deliver(project, id, Inventory.count(id));
    if (n > 0 && Inventory.remove(id, n)) any = true;
  }
  if (any) GameAudio.block();
  afterDelivery(g, project);
}

/** After bringing things: the pile grows, and if it's all there, the lads are sent for. */
function afterDelivery(g: GameScene, project: ProjectId): void {
  const pile = (g.map.data.objects ?? []).find((o) => o.key.startsWith('hs-pile-'));
  const left = Homestead.missing(project);
  if (!Homestead.ready(project)) {
    if (pile) {
      void import('../../world/Homestead').then((m) => g.map.setObjectArt(pile, `hs-pile-${m.pileFill()}`));
    }
    g.onHint?.(`On the pile. It still wants ${listOf(left)}.`);
    return;
  }
  if (pile) g.map.setObjectArt(pile, 'hs-pile-3');
  const work = Homestead.startWork(project, g.clock.elapsedHours);
  if (!work) return;
  if (project === 'walls') QuestLog.complete(REBUILDING, 'walls');
  if (project === 'hearth') QuestLog.complete(REBUILDING, 'hearth');
  const days = PROJECTS[project].days;
  g.onHint?.(`That's everything. Osric's lads will be up at first light, and it's ${days === 1 ? 'a day' : `${days} days`}' work.`);
  QuestLog.writeDiary(diaryForStart(project));
}

function diaryForStart(p: ProjectId): string {
  switch (p) {
    case 'walls':
      return "The last of the oak and the reed is up at the cottage, and Osric's nails. He says his lads will be up at first light and it will take them three days: " +
        'walls, rafters, thatch. I said I would help. He looked at my hands and said I could carry.';
    case 'hearth':
      return 'Stone for the hearth, oak for the floor, and the joiner paid for a bed, a table and three stools. Two days, Osric says. ' +
        'Then I can sleep under my own roof.';
    default:
      return `Everything for ${PROJECTS[p].name.toLowerCase()} is up at the cottage. Osric's lads come in the morning.`;
  }
}

// ------------------------------------------------------------ time passing

/**
 * Brings the work up to the clock (called every second, and on waking): writes
 * the diary for anything just finished, moves the quests on, and says so if
 * the hero is there to see it.
 */
export function checkHomestead(g: GameScene): void {
  for (const f of Homestead.advance(g.clock.elapsedHours)) {
    if (f.kind === 'project') finishedProject(g, f.project);
    else finishedStead(g, f.stage);
  }
}

function finishedProject(g: GameScene, p: ProjectId): void {
  if (p !== 'walls' && p !== 'hearth') Experience.gain(IMPROVEMENT_XP, PROJECTS[p].name);
  if (p === 'walls') {
    QuestLog.complete(REBUILDING, 'raise');
    QuestLog.writeDiary(
      'Three days, and it stands. New oak where the old logs burnt through, pale as bread against the old, and a thatch so new it shines. ' +
        "Osric walked round it twice and said \"hm\", which from Osric is a speech. It has no hearth yet and no floor to speak of. That's next.",
    );
    if (g.area === 'world') g.onHint?.('The cottage has a roof again. A new one, golden and thick. I had to stand and look at it.');
    return;
  }
  if (p === 'hearth') {
    QuestLog.complete(REBUILDING, 'furnish');
    QuestLog.writeDiary(
      "It's done. A hearth of good grey stone, a new floor, a bed, a table and three stools from the joiner, and Hetty's bluebell leaves in a jar on the sill. " +
        "It is not her house. It is mine. Tonight I sleep in it.",
    );
    if (g.area === 'world' || g.area === 'home') g.onHint?.("Smoke from our chimney. I'd forgotten what that looks like from the yard.");
    return;
  }
  const built = IMPROVEMENTS.filter((x) => Homestead.built.has(x)).length;
  if (QuestLog.has(IMPROVING)) {
    QuestLog.complete(IMPROVING, 'plans');
    QuestLog.complete(IMPROVING, 'first');
    if (built >= 3) QuestLog.complete(IMPROVING, 'three');
    if (built >= IMPROVEMENTS.length) QuestLog.complete(IMPROVING, 'all');
  }
  QuestLog.writeDiary(IMPROVEMENT_DIARY[p] ?? `${PROJECTS[p].name}: built.`);
  if (g.area === 'world') g.onHint?.(`${PROJECTS[p].name}: finished.`);
}

const IMPROVEMENT_DIARY: Partial<Record<ProjectId, string>> = {
  well: 'We have a well. A real one, with a stone curb and a roof on it, and water so cold it makes my teeth ache. No more buckets up from the lake.',
  'herb-garden':
    "Mother always said she would have a herb bed by the door one day, so she need not go hunting yarrow in the ditches. Now there are three, " +
    'yarrow and comfrey and sage, in boxes of new oak. I think she would have fussed over where they went. I put them where the sun is.',
  workshop: "A lean-to against the west wall, and a bench under it with a copper pot of my own. I need not go begging the use of Old Maud's any more.",
  paddock: 'Two nanny goats from Mags, in a paddock east of the garden with a shed of their own. They have already eaten a glove. I think the white one is in charge.',
  'yard-wall': "A dry-stone wall round the yard now, and an oak gate on iron hinges. It wouldn't stop a goblin. It says this is somebody's.",
  'slate-roof': 'Slate on the roof, grey as the Greyfells it came from. It will not burn. I stood in the yard in the rain and listened to it, and did not think of fire at all.',
};

function finishedStead(g: GameScene, id: (typeof STEAD_STAGES)[number]['id']): void {
  QuestLog.complete(STEAD, id);
  const diary: Record<typeof id, string> = {
    coop: "Iran's new coop is up, on stilts like the old one, with a proper ramp. Hetty has already named the ramp. I didn't ask.",
    hut: "Iran's hut has a new thatch and the scorch is scrubbed off the boards. He stood in his door and didn't say anything for a long time.",
    pen: 'New fences round Iran\'s pen, and hens in it again, six of them, bought off a farm down the Lord\'s Road. Pip counts them every evening.',
    barn: "Iran has a barn. A little one, but a barn, with a hay loft and doors you could drive a cart through. He says he'll never be out of my debt. I told him to stop being daft.",
  };
  QuestLog.writeDiary(diary[id]);
  Reputation.gain('adowvale', 3, "Helped mend Iran's stead");
  if (g.area === 'world') g.onHint?.(`Iran's stead: ${STEAD_STAGES.find((s) => s.id === id)!.name}, finished.`);
}

/** Into the cottage, rebuilt: the first time, the hero takes it in. */
export function enteredHome(g: GameScene): void {
  if (Homestead.stage !== 'home' || QuestLog.hasFlag('hs-home-seen')) return;
  QuestLog.setFlag('hs-home-seen');
  g.time.delayedCall(900, () => g.onHint?.('New wood, new straw, a fire in the hearth. It smells of sawdust instead of her herbs. It will take a while.'));
}

/** Into the cottage: once it's home, sleeping in its bed is the last step. */
export function sleptAtHome(): void {
  if (Homestead.stage !== 'home' || QuestLog.get(REBUILDING)?.completed) return;
  QuestLog.complete(REBUILDING, 'sleep');
  QuestLog.writeDiary(
    'Slept in the cottage last night, for the first time since. I lay awake a long while listening to the new thatch tick as it settled, ' +
      'and waiting to hear her cough through the wall. Then I slept, and did not dream at all.',
  );
  if (!QuestLog.has(IMPROVING)) QuestLog.start(IMPROVING);
}

// ------------------------------------------------------------ talk

/** Iran's stead: a handful of coins to him, and what it pays for. */
function giveIran(g: GameScene, all: boolean): void {
  const want = Homestead.steadWanted;
  const n = Math.min(all ? want : STEAD_GIFT, want, Inventory.coins);
  if (n <= 0) return;
  Inventory.addCoins(-n);
  GameAudio.coins();
  const before = Homestead.steadWork;
  Homestead.giveIran(n, g.clock.elapsedHours);
  if (!before && Homestead.steadWork) {
    QuestLog.writeDiary(`Gave Iran enough for ${Homestead.nextStead!.name}. The cooper's boys will start on it in the morning.`);
  }
}

export const HOMESTEAD_ACTIONS: Record<string, DialogueAction> = {
  // The Headman: the cottage is the hero's, and the hero is ready.
  'hs-start': () => {
    if (QuestLog.has(REBUILDING)) return;
    QuestLog.start(REBUILDING, ['talk']);
    QuestLog.writeDiary(
      'Told the Headman I am ready to put the cottage right. He shook my hand and held on to it. The burnt timber has to come out first, ' +
        'then Osric will tell me what it wants. He has done this before, the Headman says: half the roofs in Adowvale are his.',
    );
  },
  // Osric: what the cottage wants, and where to get it.
  'hs-osric': () => {
    if (!QuestLog.has(REBUILDING)) return;
    QuestLog.complete(REBUILDING, 'osric');
  },
  // Iran: taking the stead on, and coins for it.
  'hs-iran-start': () => {
    if (QuestLog.has(STEAD)) return;
    QuestLog.start(STEAD, ['talk']);
    // The Headman's purse, if it went to Iran, is spent on the coop already.
    if (QuestLog.hasFlag('ashes-purse-iran') && !QuestLog.hasFlag('stead-purse')) {
      QuestLog.setFlag('stead-purse');
      Homestead.giveIran(60, Homestead.clock());
    }
  },
  'hs-iran-give': (g) => giveIran(g, false),
  'hs-iran-give-all': (g) => giveIran(g, true),
};
