/** Keyboard, mouse and touch in the world: moving, click-to-walk, pathfinding to a spot, and the hover tile. */
import Phaser from 'phaser';
import { PLAYER_RADIUS } from '../../config';
import { gridToScreen, screenToGrid, Vec2 } from '../../iso/IsoMath';
import { findPath, GridPoint } from '../../systems/Pathfinding';
import { pinchZoom, pinching } from '../../ui/PinchZoom';
import type { GameScene } from '../GameScene';
import { inRange, interactionAt, updateFocus } from './interactions';
import { cancelChannel } from './sights';
import { standUp } from './sitting';

export type MoveKeys = Record<
  'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd' | 'sprint' | 'sneak' | 'fastForward',
  Phaser.Input.Keyboard.Key
>;

export function setupInput(g: GameScene): void {
  const kb = g.input.keyboard!;
  const K = Phaser.Input.Keyboard.KeyCodes;
  g.keys = kb.addKeys({
    up: K.UP, down: K.DOWN, left: K.LEFT, right: K.RIGHT,
    w: K.W, a: K.A, s: K.S, d: K.D,
    sprint: K.SHIFT, sneak: K.CTRL, fastForward: K.T,
  }) as MoveKeys;

  kb.on('keydown-ESC', () => g.openPauseMenu());
  kb.on('keydown-E', () => g.interact());
  kb.on('keydown-ENTER', () => g.interact());
  kb.on('keydown-J', () => g.openJournal());
  kb.on('keydown-M', () => g.openWorldMap());
  kb.on('keydown-P', () => g.openParty());
  kb.on('keydown-I', () => g.openInventory('satchel'));
  kb.on('keydown-C', () => g.openInventory('equipment'));

  // (In a fight the fight's own scene takes the wheel and pinch, and zooms the same way.)
  g.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
    if (g.busy) return;
    g.zoomBy(dy > 0 ? 0.9 : 1.1);
  });
  pinchZoom(g, () => !g.busy, (factor) => g.zoomBy(factor));

  g.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
    if (g.busy) return;
    // A second finger coming down is a pinch, not a tap: stop where the first one sent the hero.
    if (pinching(g)) {
      g.walkingTo = undefined;
      g.player.setPath([]);
      g.marker.setVisible(false);
      return;
    }
    const tile = pointerTile(g, pointer);
    if (g.channel) cancelChannel(g);
    // Clicking a person or thing walks over to it and uses it.
    const target = interactionAt(g, tile);
    if (g.seat) {
      if (target?.key === 'stand') return;
      const callingGodric = target?.key === 'npc:landlord' && g.seat.name === 'tavern-bar' && inRange(g, target);
      if (!callingGodric) standUp(g);
    }
    if (target) {
      if (inRange(g, target) && !target.walkOnto) {
        g.walkingTo = undefined;
        g.player.setPath([]);
        target.run();
        return;
      }
      const path = target.walkOnto ? pathTo(g, target.tile) : pathNextTo(g, target.tile);
      if (path) {
        g.walkingTo = target;
        g.player.setPath(path);
        if (path.length === 0) updateFocus(g);
      }
      return;
    }
    g.walkingTo = undefined;
    const route = routeTo(g, pointerPoint(g, pointer));
    if (!route) return;
    g.player.setPath(route.path, route.end);
    const c = gridToScreen(tile.x + 0.5, tile.y + 0.5);
    g.marker.setPosition(c.x, c.y).setVisible(true);
    g.tweens.killTweensOf(g.marker);
    g.marker.setAlpha(1);
    g.tweens.add({ targets: g.marker, alpha: 0, duration: 900, onComplete: () => g.marker.setVisible(false) });
  });
}

/**
 * Tile path from the player to a tile. Diagonal steps may squeeze between
 * two blocked tiles when there's room for the player in between (two tree
 * trunks, say), since collisions follow each thing's real outline.
 */
export function pathTo(g: GameScene, tile: GridPoint): GridPoint[] | null {
  const start = startTile(g);
  const clear = PLAYER_RADIUS + 0.03;
  const path = findPath(
    start,
    tile,
    g.map.width,
    g.map.height,
    (x, y) => g.map.isWalkable(x, y),
    5000,
    (x, y, dx, dy) => g.map.segmentClear({ x: x + 0.5, y: y + 0.5 }, { x: x + dx + 0.5, y: y + dy + 0.5 }, clear),
  );
  if (!path) return null;
  // Starting beside a fence or trunk: step onto the open tile next to it first.
  return start.x === g.player.tileX && start.y === g.player.tileY ? path : [start, ...path];
}

/**
 * Where pathfinding starts: the player's tile, or, if they've squeezed onto
 * part of a tile with a fence or tree on it, the nearest open tile they can
 * step straight onto.
 */
export function startTile(g: GameScene): GridPoint {
  const { gx, gy, tileX, tileY } = g.player;
  if (g.map.isWalkable(tileX, tileY)) return { x: tileX, y: tileY };
  let best: GridPoint | undefined;
  let bestDist = Infinity;
  for (let y = tileY - 1; y <= tileY + 1; y++) {
    for (let x = tileX - 1; x <= tileX + 1; x++) {
      if (!g.map.isWalkable(x, y)) continue;
      const d = Math.hypot(x + 0.5 - gx, y + 0.5 - gy);
      if (d < bestDist && g.map.segmentClear({ x: gx, y: gy }, { x: x + 0.5, y: y + 0.5 }, PLAYER_RADIUS)) {
        best = { x, y };
        bestDist = d;
      }
    }
  }
  return best ?? { x: tileX, y: tileY };
}

/**
 * A route to the exact spot that was clicked. The spot may be in the open
 * part of a tile with a tree or a fence on it, which pathfinding (working in
 * whole tiles) can't go to, so the route goes to the open tile beside it and
 * then straight to the spot.
 */
export function routeTo(g: GameScene, point: Vec2): { path: GridPoint[]; end?: Vec2 } | null {
  const tile = { x: Math.floor(point.x), y: Math.floor(point.y) };
  const open = !g.map.blocked(point.x, point.y, PLAYER_RADIUS, false);
  if (g.map.isWalkable(tile.x, tile.y)) {
    const path = pathTo(g, tile);
    // A spot too close to a wall to stand on: settle for the middle of its tile.
    return path && { path, end: open ? point : undefined };
  }
  if (!open) return null;
  const besides: GridPoint[] = [];
  for (let y = tile.y - 1; y <= tile.y + 1; y++) {
    for (let x = tile.x - 1; x <= tile.x + 1; x++) {
      if (g.map.isWalkable(x, y) && g.map.segmentClear({ x: x + 0.5, y: y + 0.5 }, point, PLAYER_RADIUS)) {
        besides.push({ x, y });
      }
    }
  }
  besides.sort((a, b) => Math.hypot(a.x + 0.5 - point.x, a.y + 0.5 - point.y) - Math.hypot(b.x + 0.5 - point.x, b.y + 0.5 - point.y));
  for (const t of besides) {
    const path = pathTo(g, t);
    if (path) return { path, end: point };
  }
  return null;
}

/** Shortest path to any free tile beside a tile (an NPC, a crop, a tree). Straight neighbours first. */
export function pathNextTo(g: GameScene, tile: GridPoint): GridPoint[] | null {
  let best: GridPoint[] | null = null;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const path = pathTo(g, { x: tile.x + dx, y: tile.y + dy });
    if (path && (!best || path.length < best.length)) best = path;
  }
  return best;
}

/**
 * Screen-relative controls: "up" moves up the screen, which in grid space
 * is diagonal (-x, -y). Returns a normalised grid-space direction.
 */
export function readKeyboard(g: GameScene): Vec2 {
  const k = g.keys;
  const sx = (k.right.isDown || k.d.isDown ? 1 : 0) - (k.left.isDown || k.a.isDown ? 1 : 0);
  const sy = (k.down.isDown || k.s.isDown ? 1 : 0) - (k.up.isDown || k.w.isDown ? 1 : 0);
  if (sx === 0 && sy === 0) return { x: 0, y: 0 };
  const gx = sx + sy;
  const gy = sy - sx;
  const len = Math.hypot(gx, gy);
  return { x: gx / len, y: gy / len };
}

export function pointerTile(g: GameScene, pointer: Phaser.Input.Pointer): { x: number; y: number } {
  const p = pointerPoint(g, pointer);
  return { x: Math.floor(p.x), y: Math.floor(p.y) };
}

/** The exact grid point under the pointer. */
export function pointerPoint(g: GameScene, pointer: Phaser.Input.Pointer): Vec2 {
  const world = g.cameras.main.getWorldPoint(pointer.x, pointer.y);
  return screenToGrid(world.x, world.y);
}

export function updateHover(g: GameScene): void {
  const tile = pointerTile(g, g.input.activePointer);
  if (g.busy || !g.map.inBounds(tile.x, tile.y)) {
    g.hover.setVisible(false);
    return;
  }
  const c = gridToScreen(tile.x + 0.5, tile.y + 0.5);
  const usable = !!interactionAt(g, tile);
  g.hover
    .setPosition(c.x, c.y)
    .setTint(usable ? 0xffe08a : g.map.isWalkable(tile.x, tile.y) ? 0xffffff : 0xff6b6b)
    .setVisible(true);
}
