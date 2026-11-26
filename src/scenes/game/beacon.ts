/**
 * The old beacon on Corbie Tor (world/BeaconMap.ts, dialogue/beacon.ts): the
 * Headman's errand, the brigands holding the tower and the three ways of
 * settling with them (paying them off, taking them on as its keepers, or a
 * fight), the climb to the roof and its painted sky, and the report back.
 */
import Phaser from 'phaser';
import { GameAudio } from '../../audio/Audio';
import { BEACON_EARNEST, BEACON_REWARD, BeaconOutcome } from '../../dialogue/beacon';
import { BEACON_QUEST, beaconHolders, beaconOutcome } from '../../systems/Beacon';
import type { Creature } from '../../entities/Creature';
import { FoeKind } from '../../systems/Combat';
import { Inventory } from '../../systems/Inventory';
import { QuestLog } from '../../systems/Quests';
import { Reputation } from '../../systems/Reputation';
import type { Door } from '../../world/MapData';
import type { GameScene } from '../GameScene';
import { beaconPaidOff } from './whisper';

/** Which brigand fights as which foe. */
const BRIGAND_FOES: Record<string, FoeKind> = { corwin: 'brigandcaptain', garth: 'brigandbrute', teg: 'brigandcutter', linnet: 'brigandarcher' };

/** Steps already behind the hero when the errand is taken on (if they had been up the tor before being asked). */
function alreadyDone(): string[] {
  const done = ['talk'];
  if (QuestLog.hasFlag('beacon-found')) done.push('find');
  if (QuestLog.hasFlag('beacon-inside')) done.push('inside');
  if (beaconOutcome()) done.push('brigands');
  if (QuestLog.hasFlag('beacon-brazier')) done.push('brazier');
  return done;
}

/** Coming up the sheep path onto the knoll, in sight of the tower. */
export function reachedBeacon(): void {
  if (QuestLog.hasFlag('beacon-found')) return;
  QuestLog.setFlag('beacon-found');
  QuestLog.complete(BEACON_QUEST, 'find');
}

/** Through the beacon's door: the brigands, unless they're gone. */
export function enteredBeacon(g: GameScene): void {
  const first = !QuestLog.hasFlag('beacon-inside');
  QuestLog.setFlag('beacon-found');
  QuestLog.setFlag('beacon-inside');
  QuestLog.complete(BEACON_QUEST, 'find');
  QuestLog.complete(BEACON_QUEST, 'inside');
  const holders = beaconHolders();
  if (first) {
    QuestLog.writeDiary(
      holders === 'brigands'
        ? 'Climbed up to the old beacon on Corbie Tor. Somebody had a fire going inside, and when I opened the door there were four of them: ' +
            'a big bearded man in the old watch\'s blue, a giant with a maul, a masked one with two hatchets, and a woman on the stair with a bow drawn on me.'
        : 'Climbed up to the old beacon on Corbie Tor and went in. Cold, and empty, and the stair up the wall still sound.',
    );
  }
  if (holders !== 'brigands') return;
  // Corwin stops the hero at the door: the talk comes before anything else.
  g.busy = true;
  g.time.delayedCall(650, () => {
    const corwin = g.someone('corwin');
    if (!corwin) {
      g.release();
      return;
    }
    g.busy = false;
    g.startConversation(corwin);
  });
}

/** Up the stair: only once the band are gone or keep the tower for the Headman (Linnet's bow says not before). */
export function beaconDoorAllowed(g: GameScene, door: Door): boolean {
  if (door.to !== 'beacon-top' || beaconHolders() !== 'brigands') return true;
  g.onHint?.("Linnet's arrow follows me to the foot of the stair. \"Up there's ours,\" she says. Not while they hold the place.");
  return false;
}

/** Out on the roof: the sky painted behind it, coloured by the hour. */
export function enteredBeaconTop(g: GameScene): void {
  const cam = g.cameras.main;
  // (art/beacon.ts BEACON_SKY: named here so as not to pull the art into the first download.)
  const sky = g.add.image(0, 0, 'bct-sky').setScrollFactor(0).setDepth(-100000);
  const fit = () => {
    sky.setPosition(cam.width / 2, cam.height / 2);
    sky.setScale((Math.max(cam.width / sky.width, cam.height / sky.height) / cam.zoom) * 1.02);
  };
  fit();
  g.scale.on('resize', fit);
  g.events.once(Phaser.Scenes.Events.SHUTDOWN, () => g.scale.off('resize', fit));
  sky.setTint(skyTint(g.clock.hour));
  if (!g.visited.has('beacon-top')) {
    g.time.delayedCall(900, () => g.onHint?.('Wind, and nothing but sky all round. The whole of the plains is down there.'));
  }
}

/** The painted sky by day, warmed at dawn and dusk and darkened at night. */
function skyTint(hour: number): number {
  if (hour >= 7 && hour < 17) return 0xffffff;
  if (hour >= 5 && hour < 7) return 0xe8c0a8;
  if (hour >= 17 && hour < 20) return 0xf0b088;
  return 0x3a4468;
}

/** Looking over the brazier on the roof: the quest step, and why it stays unlit. */
export function lookedAtBrazier(g: GameScene): void {
  const errand = QuestLog.has(BEACON_QUEST);
  g.onHint?.(
    errand
      ? "An iron basket on a stone column, heaped with charred wood that was never cleared out. The ironwork is sound, and the fuel is dry. One spark and the whole plain would see it. Not unless they come, the Headman said."
      : 'An iron basket on a stone column, heaped with charred wood that was never cleared out. A fire up here would be seen from the fells to Adowvale.',
  );
  if (QuestLog.hasFlag('beacon-brazier')) return;
  QuestLog.setFlag('beacon-brazier');
  QuestLog.complete(BEACON_QUEST, 'brazier');
  if (errand) {
    QuestLog.writeDiary(
      "Stood on top of the beacon on Corbie Tor and looked over its brazier. It's sound: the iron hasn't rusted through, the column is solid, " +
        'and there is fuel and pitch stacked ready under oiled cloth. I did not light it. Back to the Headman.',
    );
  }
}

/** The band of brigands, as they stand about the hall. */
function band(g: GameScene) {
  return Object.keys(BRIGAND_FOES)
    .map((id) => g.someone(id))
    .filter((n) => !!n);
}

/** Settled, one way or another: the flag, the quest step, and the standing it earns. */
function settle(outcome: BeaconOutcome): void {
  QuestLog.setFlag(`beacon-${outcome}`);
  QuestLog.complete(BEACON_QUEST, 'brigands');
}

/** Paid off: they pack up and walk out of the door, one after another. */
function paid(g: GameScene, price: number): void {
  if (beaconOutcome() || !Inventory.addCoins(-price)) return;
  GameAudio.coins();
  settle('paid');
  Reputation.gain('militia', -2, 'Paid brigands to leave the beacon');
  QuestLog.writeDiary(
    `Paid Corwin Haske and his band ${price} coins to leave the beacon on Corbie Tor. They packed up and went off down the north road ` +
      'without a word, the archer last, walking backwards. It stuck in my throat. But nobody bled for it.',
  );
  g.afterTalk = () => {
    const door = { x: 1.2, y: 7.5 };
    band(g).forEach((npc, i) => g.time.delayedCall(400 + i * 900, () => npc.leave(door)));
    g.time.delayedCall(5200, () => g.onHint?.('The door bangs shut behind the last of them. The fire is still burning. The tower is the Headman\'s again.'));
  };
}

/** Taken on as the tower's keepers, on the hero's word (or a little earnest money) for the Headman's wage and pardon. */
function hired(earnest: boolean): void {
  if (beaconOutcome()) return;
  if (earnest && !Inventory.addCoins(-BEACON_EARNEST)) return;
  if (earnest) GameAudio.coins();
  settle('hired');
  Reputation.gain('adowvale', 3, 'Found the old beacon a keeper');
  QuestLog.writeDiary(
    'The brigands in the beacon are Corwin Haske, who kept it for twenty years until Lord Morten stood the watch down, and three of the old ' +
      "watch's leavings. I told him the Headman would pay a warden's wage and pardon them, if they keep the tower again" +
      (earnest ? `, and gave him ${BEACON_EARNEST} coins on account.` : ', on my word.') +
      ' He said yes. I hope Hale will.',
  );
}

/**
 * "Garth. Teg. Linnet." Each of them becomes the foe they fight as, where they stand, and the fight is on.
 * (The fight's code is fetched rather than imported, so the areas' arrival hooks stay light: see areas.ts.)
 */
function fight(g: GameScene): void {
  g.afterTalk = () => {
    const code = Promise.all([import('../../entities/Creature'), import('./combat')]);
    // The talk's close hands control back a beat later (GameScene.release): start the fight after that, or startCombat
    // sees the hero still busy talking and calls it off, and the band (who never pick a fight of their own) just stand there.
    g.time.delayedCall(150, () => void code.then(([{ Creature }, { startCombat }]) => {
      if (g.inCombat || beaconOutcome()) return;
      g.busy = false;
      const stamp = Date.now();
      const foes: Creature[] = band(g).map((npc) => {
        const kind = BRIGAND_FOES[npc.id];
        const id = `beacon-${npc.id}-${stamp}`;
        // Counted as met by chance, so beating them is kept by the story's flags rather than the list of foes gone for good.
        (g.map.data.creatures ??= []).push({ id, kind, gx: npc.gx, gy: npc.gy, respawns: true });
        const c = new Creature(g, g.map, id, kind, npc.gx, npc.gy);
        g.creatures.push(c);
        c.faceTowards(g.player.gx, g.player.gy);
        npc.destroy();
        g.npcs = g.npcs.filter((n) => n !== npc);
        return c;
      });
      if (foes.length > 0) startCombat(g, foes[0], undefined, foes);
    }));
  };
}

/** After a fight in the hall: if Corwin's band went down, the tower is the Headman's. */
export function checkBeaconFight(g: GameScene, slain: Creature[]): void {
  if (g.area !== 'beacon' || !slain.some((c) => c.kind === 'brigandcaptain') || beaconOutcome()) return;
  settle('fought');
  Reputation.gain('militia', 4, 'Put down the brigands in the beacon');
  const purse = Phaser.Math.Between(34, 52);
  Inventory.reward(purse);
  GameAudio.coins();
  QuestLog.writeDiary(
    'Fought the brigands holding the beacon on Corbie Tor: Corwin Haske, who was its warden once, and his band. It was a hard fight in a small ' +
      `room. When it was over the fire was still burning and the archer's arrows were in the door. Their purses held ${purse} coins.`,
  );
  g.time.delayedCall(2600, () => g.onHint?.('Quiet, but for the fire. Nobody holds the beacon now but me. The stair is clear.'));
}

/** The Headman's reward, when the hero reports back. */
function rewarded(g: GameScene): void {
  if (!QuestLog.isDone(BEACON_QUEST, 'brazier') || QuestLog.isDone(BEACON_QUEST, 'return')) return;
  Inventory.reward(BEACON_REWARD);
  GameAudio.coins();
  Reputation.gain('adowvale', 5, 'Opened the old beacon');
  const outcome = beaconOutcome();
  QuestLog.writeDiary(
    outcome === 'hired'
      ? `Told Headman Hale his beacon is manned again, by the very brigands who were holding it. He took it better than I feared, and paid me ${BEACON_REWARD} coins.`
      : `Told Headman Hale the beacon on Corbie Tor is sound, and empty now. He is sending Brannock's men to keep it, and paid me ${BEACON_REWARD} coins.`,
  );
  // (Every step behind it is done by now; make sure, so the quest closes.)
  for (const step of ['talk', 'find', 'inside', 'return']) QuestLog.complete(BEACON_QUEST, step);
  // And that night, the orb (see whisper.ts).
  beaconPaidOff(g);
}

/** Lines of dialogue that move the beacon's story on (see dialogueActions.ts). */
export const BEACON_ACTIONS: Record<string, (g: GameScene) => void> = {
  'beacon-accept': () => {
    if (QuestLog.has(BEACON_QUEST)) return;
    QuestLog.start(BEACON_QUEST, alreadyDone());
    QuestLog.complete('the-watcher', 'hale');
    QuestLog.writeDiary(
      "Headman Hale has asked me to go up to the old beacon on Corbie Tor, in the far north of the plains, and see if it can be opened again. " +
        "He signed the order that stood its watch down, twelve years ago, and he regrets it. Whatever I do, I am not to light it.",
    );
  },
  'beacon-told-aldo': () => QuestLog.setFlag('beacon-told-aldo'),
  'beacon-haggle': () => QuestLog.setFlag('beacon-haggled'),
  'beacon-hire': () => hired(false),
  'beacon-hire-earnest': () => hired(true),
  'beacon-fight': fight,
  'beacon-reward': rewarded,
};

/** `beacon-pay:<coins>`: paying the band off (dialogue/beacon.ts sets the price). */
export function beaconPayAction(g: GameScene, action: string): boolean {
  if (!action.startsWith('beacon-pay:')) return false;
  paid(g, Number(action.slice('beacon-pay:'.length)));
  return true;
}
