/**
 * Adowvale Jetty (world/JettyMap.ts): arriving at the river, and mending the
 * Grey Heron (the 'fit-to-sail' quest Maren Tull gives once the hero needs to
 * get to Gloomhaven). The people there are in entities/Npc.ts and
 * dialogue/jetty.ts; sailing her is systems/Voyages.ts and voyages.ts here.
 */
import { GameAudio } from '../../audio/Audio';
import { Inventory } from '../../systems/Inventory';
import { QuestLog } from '../../systems/Quests';
import { GLOOMHAVEN_PASSAGE, HERON_AWAY, HERON_MENDING } from '../../systems/Voyages';
import type { Sight } from '../../world/MapData';
import type { GameScene } from '../GameScene';
import type { DialogueAction } from './dialogueActions';
import { give, startChannel } from './sights';

const QUEST = 'fit-to-sail';
/** Hours the mending takes: warping her into the shallows, cutting out the sprung plank, fitting the new, caulking and paying the seams. */
const MENDING_HOURS = 3;
/** Set while the scene restarts after the mending, for the thought on coming back to the pier. */
const JUST_MENDED = 'heron-just-mended';

/** Arriving at the jetty: the Heron is home whichever way the hero came back; the first time, a thought and a line in the diary. */
export function enteredJetty(g: GameScene): void {
  QuestLog.clearFlag(HERON_AWAY);
  if (QuestLog.hasFlag(JUST_MENDED)) {
    QuestLog.clearFlag(JUST_MENDED);
    g.time.delayedCall(900, () =>
      g.onHint?.('My hands are black with pitch to the wrists, and my back aches. But the Heron sits high and dry inside, and Maren is smiling.'),
    );
  }
  if (g.visited.has('jetty')) return;
  g.time.delayedCall(1100, () => g.onHint?.('The river! I could smell it from the lane: weed and tar and woodsmoke. Boats, nets, gulls on every post.'));
  QuestLog.writeDiary(
    'Went down the lane past the garrison to Adowvale Jetty, on the river Wend. Fishing huts, a smokehouse, nets hung out to dry, and a pier ' +
      'out over the water with a proper sailing boat tied up at it, the Grey Heron. The river is wider than I ever imagined.',
  );
}

/** Mending her is under way: Maren has asked, and it isn't done yet. */
function mending(): boolean {
  return QuestLog.has(QUEST) && !QuestLog.isDone(QUEST, 'mend');
}

/** Each thing she needs, once it's in the satchel: when all three are, that step is done. */
function gathered(g: GameScene): void {
  if (HERON_MENDING.every((m) => Inventory.count(m.item) > 0)) {
    QuestLog.complete(QUEST, 'gather');
    g.time.delayedCall(1400, () => g.onHint?.("Plank, oakum and pitch. That's everything Maren asked for. Back to the pier."));
  }
}

/**
 * The boathouse and the tar pot on the shingle, while the Heron is being mended: the plank to take
 * down from the rafters, and the pitch to fill a pail with. Otherwise they're only looked at.
 */
export function examineAtJetty(g: GameScene, sight: Sight): boolean {
  if (!mending() || (sight.id !== 'jetty-boathouse' && sight.id !== 'jetty-tar')) return false;
  const plank = sight.id === 'jetty-boathouse';
  const item = plank ? 'oak-plank' : 'pitch-pail';
  if (Inventory.count(item) > 0) return false;
  if (!Inventory.canAdd(item)) {
    g.onHint?.('My satchel is full.');
    return true;
  }
  if (plank) GameAudio.rustle();
  else GameAudio.stir();
  startChannel(
    g,
    {
      label: plank ? 'Taking down a plank' : 'Filling the pail',
      seconds: plank ? 2.4 : 2,
      onDone: () => {
        give(g, item, 1);
        g.onHint?.(
          plank
            ? 'Seasoned oak, stacked up in the rafters over the half-built boat: dry, straight, and heavier than it looks. Sorry, Jack Pellow.'
            : 'The pitch is thick and black and smoking, and it smells of pine woods burning. I fill the pail without getting more than half of it on me.',
        );
        gathered(g);
      },
    },
    { x: sight.gx, y: sight.gy },
  );
  return true;
}

export const JETTY_ACTIONS: Record<string, DialogueAction> = {
  // Offering to help mend her: the quest starts, with talking to Maren done.
  'heron-start': () => {
    QuestLog.start(QUEST, ['talk']);
    QuestLog.writeDiary(
      'Maren Tull will sail me down the Wend to Gloomhaven, once her Grey Heron is fit to sail. She sprang a plank on a drowned oak in the spring ' +
        'flood. I am to fetch a new plank from the boathouse, oakum from Old Ebb, and pitch from the tar pot on the shingle, and help her mend it.',
    );
  },
  // Old Ebb's oakum, picked out of the drift net the pike went through.
  'heron-oakum': (g) => {
    if (!mending() || Inventory.count('oakum') > 0) return;
    give(g, 'oakum', 1);
    gathered(g);
  },
  // Mending her: the afternoon (or morning) goes by in hammering and caulking, and she's fit to sail.
  'heron-mend': (g) => {
    if (!mending() || !HERON_MENDING.every((m) => Inventory.count(m.item) > 0)) return;
    for (const m of HERON_MENDING) Inventory.remove(m.item, 1);
    g.afterTalk = () => mendHeron(g);
  },
};

/** Fades out on the work, with the sounds of it, and comes back to her mended, a few hours on. */
function mendHeron(g: GameScene): void {
  // Kept from the controls throughout (closing the conversation hands them back a moment after this starts).
  const hold = () => (g.busy = true);
  hold();
  g.player.setPath([]);
  g.time.delayedCall(150, hold);
  g.time.delayedCall(2000, hold);
  g.cameras.main.fadeOut(900, 0, 0, 0);
  // Mallet on caulking iron, a pause, the saw, more mallet.
  const knocks = [1100, 1350, 1600, 2300, 2550, 2800, 3050, 3900, 4150, 4400];
  for (const ms of knocks) g.time.delayedCall(ms, () => GameAudio.bang());
  g.time.delayedCall(1900, () => GameAudio.swing(true));
  g.time.delayedCall(3500, () => GameAudio.splash(true));
  g.time.delayedCall(5000, () => {
    QuestLog.complete(QUEST, 'mend');
    QuestLog.setFlag(GLOOMHAVEN_PASSAGE);
    QuestLog.setFlag(JUST_MENDED);
    QuestLog.writeDiary(
      'Spent the best part of the day up to my elbows in pitch, helping Maren mend the Grey Heron. We warped her into the shallows and heeled her ' +
        'over, cut out the sprung plank and fitted the new one, hammered the oakum into her seams and paid them over hot. She is tight as a drum. ' +
        'Maren says she will take me down to Gloomhaven whenever I am ready, and will not hear of a fare.',
    );
    g.clock.advance(MENDING_HOURS);
    g.scene.restart({ area: 'jetty', entry: 'pier' });
  });
}
