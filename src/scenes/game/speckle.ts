/**
 * Pip and Hetty's side story after the raid ("Speckle and Moppet"): Hetty's
 * hen Speckle, run off down the hill when the coop burned, and her rag doll
 * Moppet, left at the cottage for Mother to mend. The children ask once Iran
 * has told the hero what he saw; the doll is under the fallen beam in the
 * ruins, Speckle is hiding in the trampled garden, and once both are back
 * Speckle lives in the hut.
 */
import { GameAudio } from '../../audio/Audio';
import { ashesOver, SIBLING_AFTER_ASHES, SIBLING_AFTER_ASHES_HELLO } from '../../dialogue/afterAshes';
import {
  ChildLine,
  SIBLING_BANTER,
  SIBLING_COMFORTED,
  SIBLING_GLAD_HELLO,
  SIBLING_LOST,
  SIBLING_REUNITED,
  SIBLING_SCARED,
  SIBLING_SCARED_HELLO,
  SIBLING_WAITING,
} from '../../dialogue/iran';
import { Hen } from '../../entities/Hen';
import { gridToScreen } from '../../iso/IsoMath';
import { Inventory } from '../../systems/Inventory';
import { QuestLog } from '../../systems/Quests';
import { raidStage } from '../../world/GoblinRaid';
import { GARDEN_PEN, HUT_HEN_PEN, HUT_SPECKLE, MOPPET_SIGHT } from '../../world/landmarks';
import type { GameScene } from '../GameScene';
import { siblingHello } from './hollow';
import type { Interaction } from './interactions';
import { give } from './sights';

export const SIDE_QUEST = 'speckle-and-moppet';
/** Set once Speckle has been caught (she isn't a thing to carry in the satchel). */
export const SPECKLE_FLAG = 'caught-speckle';


/** Whether the side story is under way: asked, and not yet finished. */
function underway(): boolean {
  const q = QuestLog.get(SIDE_QUEST);
  return !!q && !q.completed;
}

/** Speckle, while she's loose in the garden in this scene. */
const loose = new WeakMap<GameScene, Hen>();

/** What the children squabble about and how they say hello after the raid, as the side story stands. */
export function siblingLines(): { banter: ChildLine[][]; hello: () => ChildLine[] } {
  if (raidStage() !== 'over') return { banter: SIBLING_BANTER, hello: siblingHello };
  // Once Mother is buried: they keep her grave, and grieve her, between whatever else is going on.
  if (ashesOver() && !underway()) {
    const comforted = QuestLog.get(SIDE_QUEST)?.completed ? SIBLING_COMFORTED.filter((ex) => !ex.some(([, line]) => /mam\b/.test(line) && /bring back/i.test(line))) : [];
    return { banter: [...SIBLING_AFTER_ASHES, ...comforted], hello: () => SIBLING_AFTER_ASHES_HELLO };
  }
  if (QuestLog.get(SIDE_QUEST)?.completed) return { banter: SIBLING_COMFORTED, hello: () => SIBLING_GLAD_HELLO[0] };
  if (underway()) return { banter: [...SIBLING_SCARED, ...SIBLING_WAITING], hello: () => SIBLING_SCARED_HELLO[0] };
  return { banter: SIBLING_SCARED, hello: () => SIBLING_SCARED_HELLO[0] };
}

/** Arriving somewhere after the raid: the doll waits in the ruins, Speckle in the garden. */
export function enteredForSpeckle(g: GameScene): void {
  if (raidStage() !== 'over' || !underway()) return;
  if (g.area === 'home' && !QuestLog.isDone(SIDE_QUEST, 'moppet')) {
    const sights = (g.map.data.sights ??= []);
    if (!sights.some((s) => s.id === MOPPET_SIGHT.id)) sights.push(MOPPET_SIGHT);
  }
  if (g.area === 'world' && !QuestLog.hasFlag(SPECKLE_FLAG)) {
    const hen = new Hen(g, g.map, GARDEN_PEN, 'speckled', 26.5, 37.5);
    hen.homeless = true;
    g.hens.push(hen);
    loose.set(g, hen);
  }
}

/** In the hut: the children ask for help once Iran has had his say, and rejoice when both come home. */
export function updateSpeckle(g: GameScene): void {
  const kids = g.siblings;
  if (g.area !== 'hut' || !kids || kids.telling || g.busy || raidStage() !== 'over') return;
  if (!QuestLog.has(SIDE_QUEST) && QuestLog.isDone('the-raid', 'iran')) {
    kids.tell(SIBLING_LOST, () => {
      QuestLog.start(SIDE_QUEST, ['talk']);
      QuestLog.writeDiary(
        'Pip and Hetty did not cry once while Iran told me what he saw. Afterwards Hetty whispered that her hen Speckle got out when ' +
          'the coop burned and ran off down the hill, and that her rag doll Moppet was at ours: Mother was sewing her a new eye. ' +
          'It is a small thing beside Mother. But I can do something about it, and today that matters.',
      );
    });
    return;
  }
  if (underway() && QuestLog.isDone(SIDE_QUEST, 'moppet') && QuestLog.isDone(SIDE_QUEST, 'speckle')) {
    kids.tell(SIBLING_REUNITED, () => bringHome(g));
  }
}

/** Speckle and Moppet handed over: the side story's end, and Speckle settles in on the hut floor. */
function bringHome(g: GameScene): void {
  Inventory.remove('rag-doll', 1);
  QuestLog.complete(SIDE_QUEST, 'return');
  GameAudio.questChime();
  GameAudio.cluck(1);
  QuestLog.writeDiary(
    'Brought Speckle and Moppet home to the hut. Hetty squeezed the hen so hard she squawked, and then held the doll up to show me ' +
      'the new eye Mother had sewn on, small and neat. Mother finished it. Iran turned away to see to the fire. ' +
      'For a little while, in that dark hut, there was laughing.',
  );
  if (!g.map.data.hens) g.map.data.hens = { pen: HUT_HEN_PEN, flock: [] };
  const hen = new Hen(g, g.map, HUT_HEN_PEN, 'speckled', HUT_SPECKLE.x, HUT_SPECKLE.y);
  hen.homeless = true;
  g.hens.push(hen);
}

/** Looking under the beam in the ruins: Moppet, sooty but whole. */
export function foundMoppet(g: GameScene): void {
  if (QuestLog.isDone(SIDE_QUEST, 'moppet')) return;
  GameAudio.rustle();
  give(g, 'rag-doll', 1);
  QuestLog.complete(SIDE_QUEST, 'moppet');
  g.map.data.sights = (g.map.data.sights ?? []).filter((s) => s.id !== MOPPET_SIGHT.id);
  g.onHint?.(
    QuestLog.isDone(SIDE_QUEST, 'speckle')
      ? "Moppet! Squashed flat under the beam, and sooty, but whole. And Mother's new eye, sewn on tight. Now home to Hetty."
      : "Moppet! Squashed flat under the beam, and sooty, but whole. And Mother's new eye, sewn on tight. Now for Speckle.",
  );
  QuestLog.writeDiary(
    "Found Hetty's rag doll under the beam that came down in the cottage, squashed and smelling of smoke. Mother had finished " +
      'the new eye: a little black button, sewn on with her tight neat stitches. I sat on the floor with it for a while before I could get up.',
  );
}

/** Speckle in the garden: walk up to her (slowly: she startles) and scoop her up. */
export function speckleInteraction(g: GameScene): Interaction | undefined {
  const hen = loose.get(g);
  if (!hen) return undefined;
  const at = hen.position;
  const p = gridToScreen(at.x, at.y);
  return {
    key: 'speckle', label: 'Catch', target: 'Speckle', gx: at.x, gy: at.y, range: 1.8,
    promptX: p.x, promptY: p.y - 22, tile: { x: Math.floor(at.x), y: Math.floor(at.y) },
    run: () => catchSpeckle(g),
  };
}

function catchSpeckle(g: GameScene): void {
  const hen = loose.get(g);
  if (!hen) return;
  loose.delete(g);
  g.hens = g.hens.filter((h) => h !== hen);
  hen.destroy();
  GameAudio.cluck(1);
  QuestLog.setFlag(SPECKLE_FLAG);
  QuestLog.complete(SIDE_QUEST, 'speckle');
  g.onHint?.(
    QuestLog.isDone(SIDE_QUEST, 'moppet')
      ? 'Got you! Sooty, cross, and alive. Under my arm with you, Speckle. Hetty is waiting.'
      : 'Got you! Sooty, cross, and alive. Now, Moppet. She must be somewhere in the ruins of the cottage.',
  );
  QuestLog.writeDiary(
    "Found Speckle hiding in what is left of our garden, among the trampled cabbages, black with soot and furious about it. " +
      'She led me three times round the rows before I caught her. The only one of Iran\'s hens the goblins did not get.',
  );
}
