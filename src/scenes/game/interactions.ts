/**
 * What the hero can do where they stand (talk, use a door, sit, sleep, pick,
 * shake a tree, hunt, fish), and choosing which one the E prompt shows.
 */
import { SpeakerId, SPEAKERS } from '../../dialogue/Dialogue';
import { Creature } from '../../entities/Creature';
import { Npc } from '../../entities/Npc';
import { gridToScreen } from '../../iso/IsoMath';
import { CROPS, Farm } from '../../systems/Farm';
import { Herbs } from '../../systems/Herbs';
import { GridPoint } from '../../systems/Pathfinding';
import { QuestLog } from '../../systems/Quests';
import { Bed, CropPatch, Door, Prop, Seat, Sight } from '../../world/MapData';
import type { GameScene } from '../GameScene';
import { startCombat } from './combat';
import { companionInteractions } from './companions';
import { fishInteraction } from './fishing';
import { plotInteractions } from './plot';
import { examine, pickCrop, shakeTree } from './sights';
import { takeOrb } from './broodhall';
import { ORB_TAKE } from '../../world/landmarks';
import { speckleInteraction } from './speckle';
import { sitOn, standUp } from './sitting';
import { goToBed } from './sleep';
import { useDoor } from './travel';

/**
 * Something the player can do where they stand: talk to someone, use a door,
 * sit down, pick crops, shake a tree. The nearest one in range gets an
 * "E  <label>" prompt over it; E, Enter, or tapping the prompt does it.
 */
export interface Interaction {
  /** Identifies it across frames, e.g. "crop:24,22". */
  key: string;
  /** What to do, e.g. "Talk-to" or "Go inside". */
  label: string;
  /** Who or what it's done to, shown after the label in yellow, e.g. "Mother". */
  target?: string;
  /** Where it is, in grid space, for the range check. */
  gx: number;
  gy: number;
  range: number;
  /** World pixel the prompt floats above. */
  promptX: number;
  promptY: number;
  /** The tile that clicking on selects it. */
  tile: GridPoint;
  /** Walk onto its tile (doors) rather than next to it. */
  walkOnto?: boolean;
  run: () => void;
}

/** Something that takes a few seconds (picking, shaking a tree). Moving cancels it. */
export interface Channel {
  label: string;
  seconds: number;
  elapsed: number;
  onDone: () => void;
  onCancel?: () => void;
}

/** Everything the player could use from around (gx, gy). */
export function interactionsNear(g: GameScene, gx: number, gy: number): Interaction[] {
  const list: Interaction[] = [];
  if (g.seat) {
    // On a stool at the bar, Godric is the one to talk to (walking off gets up).
    const godric = g.seat.name === 'tavern-bar' ? g.someone('landlord') : undefined;
    if (godric) return [npcInteraction(g, godric)];
    // Sitting: the only thing to do is get up.
    const head = g.player.sprite;
    list.push({
      key: 'stand', label: 'Stand up', gx: g.player.gx, gy: g.player.gy, range: Infinity,
      promptX: head.x, promptY: head.y - 44, tile: { x: -1, y: -1 }, run: () => standUp(g),
    });
    return list;
  }
  for (const npc of g.npcs) if (npc.present && npc.talks) list.push(npcInteraction(g, npc));
  list.push(...companionInteractions(g));
  for (const beast of g.creatures) if (beast.huntable) list.push(huntInteraction(g, beast));
  if (g.roadEvents) list.push(...g.roadEvents.interactions());
  for (const door of g.map.data.doors ?? []) if (!door.auto) list.push(doorInteraction(g, door));
  for (const seat of g.map.data.seats ?? []) list.push(seatInteraction(g, seat));
  for (const sight of g.map.data.sights ?? []) {
    // A pile already searched has nothing more to give.
    if (sight.loot && QuestLog.hasFlag(`searched-${sight.id}`)) continue;
    if (sight.gather?.regrow) {
      // A wild herb: only once it has grown back.
      if (!Herbs.isReady(sight.id, g.clock.elapsedHours)) continue;
    } else if (sight.gather && QuestLog.hasFlag(`gathered-${sight.id}`)) continue;
    list.push(sightInteraction(g, sight));
  }
  for (const bed of g.map.data.beds ?? []) list.push(bedInteraction(g, bed));
  for (const crop of g.map.data.crops ?? []) {
    if (Math.abs(crop.tx + 0.5 - gx) < 2 && Math.abs(crop.ty + 0.5 - gy) < 2) {
      const i = cropInteraction(g, crop);
      if (i) list.push(i);
    }
  }
  list.push(...plotInteractions(g, gx, gy));
  const speckle = speckleInteraction(g);
  if (speckle) list.push(speckle);
  const fish = fishInteraction(g, gx, gy);
  if (fish) list.push(fish);
  const tx = Math.floor(gx);
  const ty = Math.floor(gy);
  for (let y = ty - 2; y <= ty + 2; y++) {
    for (let x = tx - 2; x <= tx + 2; x++) {
      const tree = treeInteraction(g, x, y);
      if (tree) list.push(tree);
    }
  }
  return list;
}

/** What clicking on a tile would use, if anything. */
export function interactionAt(g: GameScene, tile: GridPoint): Interaction | undefined {
  const npc = g.npcs.find((n) => n.present && n.talks && n.tileX === tile.x && n.tileY === tile.y);
  if (npc) return npcInteraction(g, npc);
  const near = interactionsNear(g, tile.x + 0.5, tile.y + 0.5);
  return near.find((i) => i.tile.x === tile.x && i.tile.y === tile.y);
}

export function inRange(g: GameScene, i: Interaction): boolean {
  return Math.hypot(g.player.gx - i.gx, g.player.gy - i.gy) <= i.range;
}

export function npcInteraction(g: GameScene, npc: Npc): Interaction {
  const head = npc.promptPoint;
  return {
    key: `npc:${npc.id}`, label: 'Talk-to', target: SPEAKERS[npc.id.replace(/-(hiding|dying|captive|home)$/, '').replace(/^hilde$/, 'baker') as SpeakerId]?.name, gx: npc.gx, gy: npc.gy, range: npc.talkRange,
    promptX: head.x, promptY: head.y, tile: { x: npc.tileX, y: npc.tileY },
    // Godric can be called over from a stool at his bar without getting up.
    run: () => g.startConversation(npc, npc.id === 'landlord' && g.seat?.name === 'tavern-bar'),
  };
}

/** Go after a deer or a hare: walk up quietly (running sends it off) and the hunt starts as a fight. */
export function huntInteraction(g: GameScene, beast: Creature): Interaction {
  const p = gridToScreen(beast.gx, beast.gy);
  return {
    key: `hunt:${beast.id}`, label: 'Hunt', target: beast.name, gx: beast.gx, gy: beast.gy, range: 2.2,
    promptX: p.x, promptY: p.y - beast.sprite.displayHeight * beast.sprite.originY - 4,
    tile: { x: Math.floor(beast.gx), y: Math.floor(beast.gy) },
    run: () => {
      if (beast.huntable) startCombat(g, beast);
    },
  };
}

export function doorInteraction(g: GameScene, door: Door): Interaction {
  // Doors in a wall along the tile's -x edge have the prompt over the doorway; the cave mouth, over its tile.
  const front = door.facing === 'front';
  // A door in the wall along the tile's -y edge (the tavern's), over its middle.
  const p = front
    ? gridToScreen(door.tx + 0.5, door.ty + 0.5)
    : door.facing === 'back'
      ? gridToScreen(door.tx + 0.5, door.ty)
      : gridToScreen(door.tx, door.ty + 0.5);
  return {
    key: `door:${door.tx},${door.ty}`, label: door.label ?? (door.to === 'home' ? 'Go inside' : 'Go outside'),
    gx: door.tx + 0.5, gy: door.ty + 0.5, range: 1.3, promptX: p.x, promptY: p.y - (front ? 62 : 58),
    tile: { x: door.tx, y: door.ty }, walkOnto: true, run: () => useDoor(g, door),
  };
}

export function sightInteraction(g: GameScene, sight: Sight): Interaction {
  const p = gridToScreen(sight.gx, sight.gy);
  return {
    key: `sight:${sight.id}`, label: sight.label, gx: sight.gx, gy: sight.gy, range: 1.5,
    promptX: p.x, promptY: p.y - sight.z, tile: { x: Math.floor(sight.gx), y: Math.floor(sight.gy) },
    // (The dark orb in the brood hall is taken, not looked at: see broodhall.ts.)
    run: () => (sight.id === ORB_TAKE.id ? takeOrb(g) : examine(g, sight)),
  };
}

export function seatInteraction(g: GameScene, seat: Seat): Interaction {
  const p = gridToScreen(seat.gx, seat.gy);
  return {
    key: `seat:${seat.gx},${seat.gy}`, label: 'Sit', gx: seat.gx, gy: seat.gy, range: 1.3,
    promptX: p.x, promptY: p.y - 26, tile: { x: Math.floor(seat.gx), y: Math.floor(seat.gy) },
    run: () => sitOn(g, seat),
  };
}

export function bedInteraction(g: GameScene, bed: Bed): Interaction {
  const p = gridToScreen(bed.tx + 0.5, bed.ty + 0.5);
  return {
    key: `bed:${bed.id}`, label: 'Sleep', gx: bed.gx, gy: bed.gy, range: 1.2,
    promptX: p.x, promptY: p.y - 30, tile: { x: bed.tx, y: bed.ty },
    run: () => goToBed(g, bed),
  };
}

export function cropInteraction(g: GameScene, crop: CropPatch): Interaction | undefined {
  if (!Farm.isRipe(crop.tx, crop.ty, g.clock.elapsedHours)) return undefined;
  const p = gridToScreen(crop.tx + 0.5, crop.ty + 0.5);
  return {
    key: `crop:${crop.tx},${crop.ty}`, label: CROPS[crop.kind].verb, gx: crop.tx + 0.5, gy: crop.ty + 0.5,
    range: 1.2, promptX: p.x, promptY: p.y - 24, tile: { x: crop.tx, y: crop.ty },
    run: () => pickCrop(g, crop),
  };
}

export function treeInteraction(g: GameScene, tx: number, ty: number): Interaction | undefined {
  if (!g.map.inBounds(tx, ty) || g.map.data.props[ty][tx] !== Prop.Tree) return undefined;
  const tree = g.map.trees.get(ty * g.map.width + tx);
  // Each tree only gives something once a day.
  if (!tree || Farm.wasShakenToday(tx, ty, g.clock.day)) return undefined;
  const p = gridToScreen(tx + 0.5, ty + 0.5);
  return {
    key: `tree:${tx},${ty}`, label: 'Shake the tree', gx: tx + 0.5, gy: ty + 0.5, range: 1.45,
    promptX: p.x, promptY: p.y - 40, tile: { x: tx, y: ty },
    run: () => shakeTree(g, tx, ty, tree.image, tree.pine, tree.apple),
  };
}

/** The nearest thing in range becomes the prompt; a clicked target is used on arrival. */
export function updateFocus(g: GameScene): void {
  if (g.busy || g.channel) {
    g.focus = undefined;
    return;
  }
  let best: Interaction | undefined;
  let bestDist = Infinity;
  for (const i of interactionsNear(g, g.player.gx, g.player.gy)) {
    const d = Math.hypot(g.player.gx - i.gx, g.player.gy - i.gy);
    // People come first: someone standing by a tree is more likely to be wanted than the tree.
    // Whoever is following is always close by, so they come last, or they'd hide every door and stool.
    const rank = i.key.startsWith('npc:') ? d - 1 : i.key.startsWith('companion:') ? d + 2 : d;
    if (d <= i.range && rank < bestDist) {
      best = i;
      bestDist = rank;
    }
  }
  g.focus = best;
  const target = g.walkingTo;
  if (!target) return;
  // NPCs are greeted as soon as they're in reach; other things once the walk is over.
  const arrived = target.walkOnto
    ? g.player.tileX === target.tile.x && g.player.tileY === target.tile.y
    : inRange(g, target) && (target.key.startsWith('npc:') || !g.player.hasPath);
  if (arrived) {
    g.walkingTo = undefined;
    g.player.setPath([]);
    target.run();
  } else if (!g.player.hasPath) {
    g.walkingTo = undefined;
  }
}
