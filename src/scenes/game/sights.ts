/**
 * Doing things in the world: few-second actions (channels), picking crops,
 * shaking trees, examining, searching and gathering, and putting things in the satchel.
 */
import Phaser from 'phaser';
import { cropKey } from '../../art/farm';
import { GameAudio } from '../../audio/Audio';
import { Vec2 } from '../../iso/IsoMath';
import { CROPS, Farm, PICK_SECONDS } from '../../systems/Farm';
import { HERBS, Herbs } from '../../systems/Herbs';
import { atPile, clearRubble } from './homestead';
import { Inventory, ItemId } from '../../systems/Inventory';
import { NO_ROOM, rollLoot } from '../../systems/Loot';
import { QuestLog } from '../../systems/Quests';
import { CropPatch, Sight } from '../../world/MapData';
import { BOUNTY_BOARD, MOPPET_SIGHT } from '../../world/landmarks';
import { readBountyBoard } from './bounties';
import { foundMoppet } from './speckle';
import type { GameScene } from '../GameScene';
import type { ReaderSceneData } from '../ReaderScene';
import type { Channel } from './interactions';
import { gatheredMoonpetal, gatheredWillowBark } from './medicine';
import { syncPlot } from './plot';
import { lookedAtCamp, lookedAtTrailSign } from './trail';
import { lookedAtBrazier } from './beacon';
import { examineAtJetty } from './jetty';
import { examineAtTollHouse } from './tollhouse';
import { examineInSump } from './sump';
import { examineAtGuild } from './guildhall';

export function startChannel(g: GameScene, channel: Omit<Channel, 'elapsed'>, towards: Vec2): void {
  g.walkingTo = undefined;
  g.channel = { ...channel, elapsed: 0 };
  g.player.setWorking(true, towards);
}

export function updateChannel(g: GameScene, dt: number): void {
  const c = g.channel;
  if (!c || g.busy) return;
  c.elapsed += dt;
  if (c.elapsed < c.seconds) return;
  g.channel = undefined;
  g.player.setWorking(false);
  c.onDone();
}

export function cancelChannel(g: GameScene): void {
  const c = g.channel;
  if (!c) return;
  g.channel = undefined;
  g.player.setWorking(false);
  c.onCancel?.();
}

export function pickCrop(g: GameScene, crop: CropPatch): void {
  const item = CROPS[crop.kind].item;
  if (!Inventory.canAdd(item)) {
    g.onHint?.('My satchel is full. I should eat something, or leave it for later.');
    return;
  }
  GameAudio.rustle();
  startChannel(g, 
    {
      label: 'Picking',
      seconds: PICK_SECONDS,
      onDone: () => {
        Farm.pick(crop.tx, crop.ty, g.clock.elapsedHours);
        syncCrops(g);
        give(g, item, crop.kind === 'cabbage' ? 1 : 2);
      },
    },
    { x: crop.tx + 0.5, y: crop.ty + 0.5 },
  );
}

export function shakeTree(g: GameScene, tx: number, ty: number, image: Phaser.GameObjects.Image, pine: boolean, apple = false): void {
  // The tree sways (pivoting at its base) while leaves drift down.
  const sway = g.tweens.add({ targets: image, angle: { from: -3, to: 3 }, duration: 110, yoyo: true, repeat: -1 });
  const leaves = g.time.addEvent({ delay: 140, loop: true, callback: () => dropLeaf(g, image, pine) });
  const stop = () => {
    sway.stop();
    leaves.remove();
    g.tweens.add({ targets: image, angle: 0, duration: 200 });
  };
  GameAudio.rustle();
  startChannel(g, 
    {
      label: 'Shaking',
      seconds: 1.4,
      onCancel: stop,
      onDone: () => {
        stop();
        Farm.shake(tx, ty, g.clock.day);
        const roll = Math.random();
        // An apple tree nearly always gives an apple or two.
        if (apple) {
          give(g, 'apple', roll < 0.4 ? 2 : 1);
          return;
        }
        const found: ItemId | undefined = pine ? (roll < 0.7 ? 'pinecone' : undefined) : roll < 0.55 ? 'apple' : roll < 0.8 ? 'stick' : undefined;
        if (found) give(g, found, 1);
        else g.onHint?.(pine ? 'Only a shower of needles.' : 'Just a few leaves. Nothing worth keeping.');
      },
    },
    { x: tx + 0.5, y: ty + 0.5 },
  );
}

/** A leaf (or needle) falling from somewhere in a tree's canopy. */
export function dropLeaf(g: GameScene, tree: Phaser.GameObjects.Image, pine: boolean): void {
  const x = tree.x + (Math.random() - 0.5) * tree.width * 0.7;
  const y = tree.y - tree.height * (0.45 + Math.random() * 0.4);
  const colors = pine ? [0x24503a, 0x37704a] : [0x5c9e48, 0x8cc456, 0x3e7a3e];
  const leaf = g.add.rectangle(x, y, 2, 2, colors[Math.floor(Math.random() * colors.length)]).setDepth(tree.depth + 1);
  g.tweens.add({
    targets: leaf,
    y: tree.y - 2 + Math.random() * 6,
    x: x + (Math.random() - 0.5) * 24,
    angle: 180,
    alpha: { from: 1, to: 0.2 },
    duration: 700 + Math.random() * 500,
    ease: 'Sine.easeIn',
    onComplete: () => leaf.destroy(),
  });
}

/** Look closely at something: a signpost, a pile of bones, the remains of Wil's ewes in the cave. */
export function examine(g: GameScene, sight: Sight): void {
  g.walkingTo = undefined;
  g.player.setPath([]);
  g.player.faceTowards(sight.gx, sight.gy);
  if (sight.id === BOUNTY_BOARD.id) {
    readBountyBoard(g);
    return;
  }
  if (sight.id === 'bct-brazier') {
    lookedAtBrazier(g);
    return;
  }
  if (sight.id === MOPPET_SIGHT.id) {
    foundMoppet(g);
    return;
  }
  if (sight.sign) {
    readSign(g, sight.sign);
    return;
  }
  if (sight.loot) {
    search(g, sight);
    return;
  }
  if (sight.locked) {
    tryLockedDoor(g);
    return;
  }
  if (sight.gather) {
    gather(g, sight);
    return;
  }
  if (sight.station) {
    g.openStation(sight.station);
    return;
  }
  if (sight.work === 'rubble') {
    clearRubble(g, sight);
    return;
  }
  if (sight.work === 'pile') {
    atPile(g);
    return;
  }
  if (examineAtJetty(g, sight)) return;
  if (examineAtTollHouse(g, sight)) return;
  if (examineInSump(g, sight)) return;
  if (examineAtGuild(g, sight)) return;
  if (sight.thought) {
    g.onHint?.(sight.thought);
    lookedAtTrailSign(sight.id);
    lookedAtCamp(sight.id);
    if (sight.id === 'ruin-mother-bed' && !QuestLog.isDone('the-raid', 'search')) {
      QuestLog.complete('the-raid', 'search');
      QuestLog.writeDiary(
        "Made myself look at Mother's bed. The quilt is gone and the straw is soaked dark, and there is a trail of blood from it to the door, " +
          'as if they dragged her. But there is no body. They took her. Whatever they wanted her for, they wanted her alive. I have to believe that.',
      );
    }
    return;
  }
  const flag = `saw-${sight.id}`;
  const first = !QuestLog.hasFlag(flag);
  QuestLog.setFlag(flag);
  const asked = QuestLog.has('lost-sheep');
  const thoughts: Record<string, string> = {
    bess: asked
      ? 'A ewe, torn open and cold. There is a little bell on a cord round her neck, scratched "BESS". Poor Wil.'
      : 'A dead ewe, torn open and cold. A bell round her neck is scratched with a name: "BESS".',
    bramble: asked
      ? 'Another ewe, just beyond the first. This must be Bramble. She followed Bess right to the end.'
      : 'Another dead ewe, wool matted with blood. Someone has lost two sheep, and wolves have found them.',
  };
  if (!first) {
    g.onHint?.('I would rather not look again. Wil should hear what happened.');
    return;
  }
  g.onHint?.(thoughts[sight.id] ?? 'Nothing worth a closer look.');
  if (!QuestLog.hasFlag('saw-bess') || !QuestLog.hasFlag('saw-bramble')) return;
  if (asked) {
    QuestLog.complete('lost-sheep', 'cave');
    QuestLog.complete('lost-sheep', 'find');
  }
  QuestLog.writeDiary(
    asked
      ? 'Found Bess and Bramble at the back of the wolves\' cave. The wolves got them both. I will have to tell Wil; ' +
          'I would rather he heard it from me than found them like that.'
      : 'Found two dead ewes at the back of a wolves\' den in the hill, a bell on one scratched "BESS". Someone on the road ' +
          'must be missing them.',
  );
}

/**
 * Something written: a signpost is read in passing, in a banner; a notice
 * board, book, slate or carving opens close up, to read at leisure
 * (scenes/ReaderScene.ts), and the world waits until it's put down.
 */
export function readSign(g: GameScene, sign: NonNullable<Sight['sign']>): void {
  if (sign.style === 'post') {
    GameAudio.click();
    g.onSign?.(sign.heading, sign.lines);
    return;
  }
  if (!g.takeControls()) return;
  const data: ReaderSceneData = { heading: sign.heading, lines: sign.lines, style: sign.style };
  g.scene.launch('Reader', data);
  g.scene.get('Reader').events.once('reader-closed', () => g.release());
}

/**
 * The door at the back of the wolves' cave: it won't open, and the hero
 * notes it in the diary the first time. A hint of things to come.
 */
export function tryLockedDoor(g: GameScene): void {
  GameAudio.rattle();
  if (QuestLog.hasFlag('found-cave-door')) {
    g.onHint?.('Still locked fast. Whoever has the key to this, it is not me.');
    return;
  }
  QuestLog.setFlag('found-cave-door');
  g.onHint?.(
    'A door, deep in the hill: old oak bound with iron, and a lock as big as my hand. It will not budge. ' +
      'Someone went to a lot of trouble to keep something in. Or out.',
  );
  QuestLog.writeDiary(
    'There is a door at the back of the wolves\' cave, set right into the rock. Old oak, iron straps, a great lock, ' +
      'and no key anywhere. Who would build a door down there? I mean to find out what is behind it.',
  );
}

/**
 * Pick something growing, once: the moonpetal by the cloister pond, or the
 * bark of the old white willow up on the plains. The moonpetal is Brother
 * Anselm's, so not before he has said the hero may; the willow's bark is
 * only worth cutting once the hero knows Mother's tincture needs it. Each
 * moves Mother's errand on.
 */
export function gather(g: GameScene, sight: Sight): void {
  if (sight.gather!.regrow) {
    gatherHerb(g, sight);
    return;
  }
  const { item } = sight.gather!;
  const bark = item === 'willow-bark';
  if (!bark && !QuestLog.hasFlag('may-pick-moonpetal')) {
    g.onHint?.('Pale flowers like little stars, shining faintly. Moonpetal! But these are Brother Anselm\'s. I should ask him before I pick any.');
    return;
  }
  if (bark && !QuestLog.has('mother-medicine')) {
    g.onHint?.('An old white willow, its bark grey and deeply furrowed. Willow bark is good for aches and fevers, they say. I have no need of it today.');
    return;
  }
  if (!Inventory.canAdd(item)) {
    g.onHint?.('My satchel is full.');
    return;
  }
  GameAudio.rustle();
  startChannel(g, 
    {
      label: bark ? 'Stripping bark' : 'Gathering',
      seconds: bark ? PICK_SECONDS * 1.6 : PICK_SECONDS,
      onDone: () => {
        QuestLog.setFlag(`gathered-${sight.id}`);
        give(g, item, bark ? 3 : 1);
        syncGathered(g);
        if (bark) gatheredWillowBark(g);
        else gatheredMoonpetal(g);
      },
    },
    { x: sight.gx, y: sight.gy },
  );
}


/**
 * Pick a patch of wild herbs (yarrow, nettles, wolfsbane, sage, comfrey) for
 * the brews at Old Maud's bench. It grows back in a day and a half.
 */
function gatherHerb(g: GameScene, sight: Sight): void {
  const { item, regrow, needs } = sight.gather!;
  if (needs && !QuestLog.hasFlag(needs.flag)) {
    g.onHint?.(needs.thought);
    return;
  }
  if (!Herbs.isReady(sight.id, g.clock.elapsedHours)) return;
  if (!Inventory.canAdd(item)) {
    g.onHint?.('My satchel is full.');
    return;
  }
  GameAudio.rustle();
  startChannel(g,
    {
      label: 'Gathering',
      seconds: PICK_SECONDS,
      onDone: () => {
        Herbs.pick(sight.id, g.clock.elapsedHours);
        give(g, item, Math.min(regrow!.count, Inventory.room(item)));
        syncGathered(g);
        // (Timber, reed and stone for the building grow back too, but they're no use at Maud's bench.)
        if (!QuestLog.hasFlag('gathered-wild-herb') && Object.values(HERBS).some((h) => h.item === item)) {
          QuestLog.setFlag('gathered-wild-herb');
          g.time.delayedCall(700, () => g.onHint?.('That will grow back in a day or two. Old Maud\'s bench in the Tankard\'s cellar could make something of it.'));
        }
      },
    },
    { x: sight.gx, y: sight.gy },
  );
}

/** The object a sight stands on or over (the moonpetal on its tile, the willow whose trunk is mid-footprint). */
function objectAt(g: GameScene, sight: Sight) {
  const tx = Math.floor(sight.gx);
  const ty = Math.floor(sight.gy);
  const objects = g.map.data.objects ?? [];
  return (
    objects.find((o) => o.tx === tx && o.ty === ty) ??
    objects.find((o) => !o.flat && tx >= o.tx && tx < o.tx + o.w && ty >= o.ty && ty < o.ty + o.h)
  );
}

/** Shows anything already gathered (the moonpetal, the willow's bark) as picked, and wild herbs as picked or grown back. */
export function syncGathered(g: GameScene): void {
  for (const sight of g.map.data.sights ?? []) {
    const regrow = sight.gather?.regrow;
    if (regrow) {
      const obj = objectAt(g, sight);
      if (obj) g.map.setObjectArt(obj, Herbs.isReady(sight.id, g.clock.elapsedHours) ? regrow.grown : sight.gather!.picked);
      continue;
    }
    if (!sight.gather || !QuestLog.hasFlag(`gathered-${sight.id}`)) continue;
    const tx = Math.floor(sight.gx);
    const ty = Math.floor(sight.gy);
    // The thing itself: on the sight's tile (the moonpetal), or else standing over it (the willow, whose trunk is mid-footprint).
    const objects = g.map.data.objects ?? [];
    const obj =
      objects.find((o) => o.tx === tx && o.ty === ty) ??
      objects.find((o) => !o.flat && tx >= o.tx && tx < o.tx + o.w && ty >= o.ty && ty < o.ty + o.h);
    if (obj) g.map.setObjectArt(obj, sight.gather.picked);
  }
}

/** Rummage through something (a pile of bones) for a random find. Each can only be searched once. */
export function search(g: GameScene, sight: Sight): void {
  GameAudio.rustle();
  startChannel(g, 
    {
      label: 'Searching',
      seconds: 1.6,
      onDone: () => {
        const find = rollLoot(sight.loot!);
        // Leave it be if there's no room, so it can be searched again once there is.
        if (find.item && !Inventory.canAdd(find.item)) {
          g.onHint?.(NO_ROOM[sight.loot!]);
          return;
        }
        QuestLog.setFlag(`searched-${sight.id}`);
        if (find.item) give(g, find.item, 1);
        if (find.coins) {
          Inventory.reward(find.coins);
          GameAudio.coins();
        }
        g.onHint?.(find.text);
      },
    },
    { x: sight.gx, y: sight.gy },
  );
}

/** Adds items to the satchel, or says why not. The HUD shows what was gained. */
export function give(g: GameScene, id: ItemId, count: number): void {
  if (Inventory.add(id, count)) GameAudio.pickup();
  else if (Inventory.add(id, 1)) GameAudio.pickup();
  else g.onHint?.('My satchel is full.');
}

/** Show each crop as ripe or freshly picked; picked ones grow back over time. And the plot in Iran's yard. */
export function syncCrops(g: GameScene): void {
  syncPlot(g);
  for (const crop of g.map.data.crops ?? []) {
    const img = g.map.crops.get(crop.ty * g.map.width + crop.tx);
    const key = cropKey(crop.kind, Farm.isRipe(crop.tx, crop.ty, g.clock.elapsedHours));
    if (img && img.texture.key !== key) img.setTexture(key);
  }
}
