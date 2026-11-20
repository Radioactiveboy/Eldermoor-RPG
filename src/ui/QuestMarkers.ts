import Phaser from 'phaser';
import { gridToScreen } from '../iso/IsoMath';
import type { GameScene } from '../scenes/GameScene';
import { currentTarget } from '../systems/QuestTargets';
import { waypoint } from '../world/atlas';
import { UI_FONT } from './theme';

const GOLD = 0xffc43d;
const INK = 0x1c1308;
/** How far in from the screen's edge the edge arrow sits. */
const EDGE = 34;
/** World pixels above someone's feet to hang the marker over their head. */
const HEAD = 38;

/** Where the quest marker points this frame, in world pixels, and what it marks. */
export interface MarkerAim {
  world: { x: number; y: number };
  /** The same, in tiles. */
  grid: { x: number; y: number };
  /** True when it's the step's own spot (or person); false for the door or road that leads towards it. */
  final: boolean;
  /** The area the door leads into, when it's a door. */
  next?: string;
}

/**
 * Where the current quest step's marker goes in the area the hero is in: over the
 * person to see or the spot to reach, or, when that's somewhere else, over the
 * door or road end that leads the right way (see world/atlas.ts).
 */
export function aimMarker(game: GameScene): MarkerAim | undefined {
  const target = currentTarget();
  if (!target) return undefined;
  const way = waypoint(game.area, target.area, target);
  if (!way) return undefined;
  const final = way.next === target.area && game.area === target.area;
  const npc = final && target.npc ? game.someone(target.npc) : undefined;
  if (npc) {
    const p = gridToScreen(npc.gx, npc.gy);
    return { world: { x: p.x, y: p.y - HEAD }, grid: { x: npc.gx, y: npc.gy }, final };
  }
  const p = gridToScreen(way.at.x, way.at.y);
  return { world: { x: p.x, y: p.y - 18 }, grid: way.at, final, next: final ? undefined : way.next };
}

/**
 * The quest marker on screen: a gold pointer bobbing over the spot when it's in view,
 * or an arrow at the edge of the screen pointing the way when it isn't.
 */
export class QuestMarkers {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    // Over the rest of the HUD, so an arrow at the edge isn't lost behind the minimap.
    this.g = scene.add.graphics().setDepth(10);
    this.label = scene.add
      .text(0, 0, '', { fontFamily: UI_FONT, fontSize: '12px', color: '#ffe7a8', stroke: '#000000', strokeThickness: 3 })
      .setOrigin(0.5)
      .setDepth(10)
      .setVisible(false);
  }

  hide(): void {
    this.g.clear();
    this.label.setVisible(false);
  }

  /**
   * @param at the marked spot, in screen pixels
   * @param width the screen's size
   * @param distance how far it is in tiles, shown beside the edge arrow
   * @param time seconds, for the bobbing
   */
  update(at: { x: number; y: number }, width: number, height: number, distance: number, time: number): void {
    const g = this.g.clear();
    const inView = at.x > EDGE && at.x < width - EDGE && at.y > EDGE && at.y < height - EDGE;
    if (inView) {
      this.label.setVisible(false);
      const y = at.y - 6 - Math.abs(Math.sin(time * 3.2)) * 7;
      this.pointer(g, at.x, y);
      return;
    }
    // Off screen: from the middle of the screen towards it, as far as the edge.
    const cx = width / 2;
    const cy = height / 2;
    const dx = at.x - cx;
    const dy = at.y - cy;
    const k = Math.min((cx - EDGE) / Math.max(Math.abs(dx), 1e-6), (cy - EDGE) / Math.max(Math.abs(dy), 1e-6));
    const ex = cx + dx * k;
    const ey = cy + dy * k;
    const a = Math.atan2(dy, dx);
    const pulse = 0.75 + Math.sin(time * 4) * 0.25;
    this.arrow(g, ex, ey, a, pulse);
    this.label
      .setVisible(distance >= 1)
      .setText(`${Math.round(distance)}`)
      .setPosition(Math.round(ex - Math.cos(a) * 22), Math.round(ey - Math.sin(a) * 22));
  }

  /** A gold teardrop pointing down at the spot. */
  private pointer(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
    g.fillStyle(INK, 0.9);
    g.fillCircle(x, y - 16, 8.5);
    g.fillTriangle(x - 7.5, y - 12, x + 7.5, y - 12, x, y + 1.5);
    g.fillStyle(GOLD, 1);
    g.fillCircle(x, y - 16, 6.5);
    g.fillTriangle(x - 5.5, y - 13, x + 5.5, y - 13, x, y - 1);
    g.fillStyle(0xfff1c2, 1);
    g.fillCircle(x - 2, y - 18, 2);
  }

  /** A gold arrowhead at the screen's edge, pointing `a` radians. */
  private arrow(g: Phaser.GameObjects.Graphics, x: number, y: number, a: number, alpha: number): void {
    const pt = (r: number, s: number) => ({ x: x + Math.cos(a + s) * r, y: y + Math.sin(a + s) * r });
    const tip = pt(14, 0);
    const l = pt(12, 2.4);
    const r = pt(12, -2.4);
    const notch = pt(4, Math.PI);
    g.fillStyle(INK, 0.85 * alpha);
    g.fillCircle(x, y, 15);
    g.fillStyle(GOLD, alpha);
    g.fillTriangle(tip.x, tip.y, l.x, l.y, notch.x, notch.y);
    g.fillTriangle(tip.x, tip.y, r.x, r.y, notch.x, notch.y);
  }

  destroy(): void {
    this.g.destroy();
    this.label.destroy();
  }
}
