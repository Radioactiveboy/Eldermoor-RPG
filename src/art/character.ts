import Phaser from 'phaser';
import { PALETTE as P } from './palette';
import { PixelCanvas } from './PixelCanvas';

/**
 * The hero: a hooded wanderer in a forest-green cloak.
 *
 * Rather than hand-placing every pixel for every direction, the body is built
 * from simple 3D-ish parts (legs, torso, arms, head, cloak) that are rotated to
 * face each direction and drawn back-to-front. Five directions are drawn; the
 * three west-facing ones are the east ones mirrored.
 */

export const FRAME_W = 32;
export const FRAME_H = 48;
/** Pixel row the feet stand on, for the sprite origin. */
export const FEET_Y = 45;

/** Drawn directions, in sheet-row order. Angle is degrees: 0 faces the viewer, 90 faces screen-right. */
export const DIRECTIONS = [
  { name: 's', angle: 0 },
  { name: 'se', angle: 45 },
  { name: 'e', angle: 90 },
  { name: 'ne', angle: 135 },
  { name: 'n', angle: 180 },
] as const;
export type DrawnDir = (typeof DIRECTIONS)[number]['name'];

const IDLE_FRAMES = 2;
const WALK_FRAMES = 4;
const COLS = IDLE_FRAMES + WALK_FRAMES;

interface Pose {
  /** -1..1 leg swing: positive puts the left leg forward. */
  stride: number;
  /** Pixels the upper body sinks (walk contact frames, idle breathing). */
  bob: number;
  /** Cloak hem pushed back while moving. */
  flutter: number;
}

const IDLE: Pose[] = [
  { stride: 0, bob: 0, flutter: 0 },
  { stride: 0, bob: 1, flutter: 0 },
];
const WALK: Pose[] = [
  { stride: 1, bob: 1, flutter: 1 },
  { stride: 0, bob: 0, flutter: 2 },
  { stride: -1, bob: 1, flutter: 1 },
  { stride: 0, bob: 0, flutter: 2 },
];

type Draw = { z: number; paint: () => void };

function drawFigure(c: PixelCanvas, ox: number, oy: number, angleDeg: number, pose: Pose): void {
  const a = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const cx = ox + FRAME_W / 2;
  // L: offset to the figure's left (screen-right when facing us). D: offset forward.
  const X = (L: number, D: number) => cx + L * cos + D * sin;
  const Z = (L: number, D: number) => -L * sin + D * cos;
  const b = pose.bob;
  const feet = oy + FEET_Y;
  const parts: Draw[] = [];
  const front = cos > 0.2;

  // Legs and boots. The trailing leg lifts a little.
  for (const side of [-1, 1]) {
    const L = side * 2.5;
    const swing = pose.stride * side;
    const D = swing * 2.5;
    const lift = swing < 0 ? 2 : 0;
    parts.push({
      z: Z(L, D) - 0.5,
      paint: () => {
        const x = Math.round(X(L, D) - 1.5);
        const top = oy + 34;
        const bottom = feet - lift;
        c.shadedRect(x, top, 3, bottom - top - 2, P.trouser, P.trouserDark);
        // Boot toe points the way we face.
        const toe = Math.round(sin * 1.5);
        c.shadedRect(Math.min(x, x + toe), bottom - 3, 3 + Math.abs(toe), 3, P.leather, P.leatherDark, P.leatherLight);
      },
    });
  }

  // Cloak hangs behind the shoulders; seen from behind it covers the body.
  const cloakD = -2.5 - pose.flutter * 0.5;
  parts.push({
    z: Z(0, -2.5),
    paint: () => {
      const halfW = 7 * Math.abs(cos) + 3 * Math.abs(sin);
      const top = oy + 22 + b;
      const hem = oy + 40 + (cos < -0.2 ? 0 : -1);
      for (let y = top; y <= hem; y++) {
        const t = (y - top) / (hem - top);
        const flare = Math.round(t * 2);
        const shift = t * pose.flutter * -sin * 1.2;
        const mid = X(0, cloakD) + shift;
        const left = Math.round(mid - halfW - flare);
        const right = Math.round(mid + halfW + flare);
        for (let x = left; x <= right; x++) {
          const rel = (x - left) / Math.max(1, right - left);
          c.set(x, y, rel > 0.68 ? P.cloakDark : rel < 0.18 ? P.cloakLight : P.cloak);
        }
      }
      // Fold lines.
      if (cos < -0.2) {
        for (let y = top + 6; y < hem; y += 1) c.set(Math.round(X(0, cloakD)) + ((y >> 2) % 2), y, P.cloakDark);
      }
    },
  });

  // Torso: leather vest over a linen shirt, belt with a gold buckle.
  parts.push({
    z: 0,
    paint: () => {
      const halfW = 5 * Math.abs(cos) + 3.5 * Math.abs(sin);
      const left = Math.round(cx - halfW);
      const w = Math.round(halfW * 2);
      const top = oy + 23 + b;
      c.shadedRect(left, top, w, 13, P.leather, P.leatherDark, P.leatherLight);
      const beltY = oy + 32 + b;
      c.rect(left, beltY, w, 1, P.leatherDark);
      if (front) {
        const chest = Math.round(X(0, 3));
        // Linen shirt showing in a V at the collar.
        for (let i = 0; i < 4; i++) c.rect(chest - 2 + Math.ceil(i / 2), top + i, 4 - Math.ceil(i / 2) * 2 + 1, 1, P.linen);
        c.set(chest, beltY, P.gold);
        c.set(chest + 1, beltY, P.goldLight);
      }
    },
  });

  // Arms swing opposite to the legs.
  for (const side of [-1, 1]) {
    const L = side * 6;
    const D = -pose.stride * side * 2;
    parts.push({
      z: Z(L, D) + (Math.abs(sin) > 0.5 ? 0.2 : 0),
      paint: () => {
        const x = Math.round(X(L, D) - 1);
        const top = oy + 24 + b;
        c.shadedRect(x, top, 3, 8, P.linen, P.linenDark);
        c.rect(x, top + 6, 3, 1, P.leatherDark); // bracer edge
        c.rect(x, top + 8, 3, 2, P.skin);
      },
    });
  }

  // Head: hood, face, eyes.
  parts.push({
    z: 1,
    paint: () => {
      const hy = oy + 15 + b;
      const hoodX = X(0, -1.2);
      c.ellipse(hoodX, hy, 7.2, 7.5, P.cloak, P.cloakDark, P.cloakLight);
      // Point of the hood at the back of the head.
      const tipX = Math.round(X(0, -5.5));
      c.set(tipX, hy - 7, P.cloak);
      c.set(tipX, hy - 8, P.cloakLight);
      if (cos > -0.35) {
        const fx = X(0, 3.2);
        const rx = 2.6 + 1.6 * Math.max(0, cos);
        c.ellipse(fx, hy + 2, rx, 4, P.skin, P.skinShade);
        // Fringe of hair under the hood.
        c.rect(Math.round(fx - rx), hy - 2, Math.round(rx * 2), 2, P.hair);
        // Eyes: skip any that has turned out of view.
        for (const side of [-1, 1]) {
          const L = side * 1.8;
          if (Z(L, 4) < 0.6) continue;
          c.set(X(L, 4), hy + 1, P.eye);
        }
      }
      // Gold cloak clasp at the throat.
      if (front) c.set(X(0, 3), oy + 22 + b, P.gold);
    },
  });

  parts.sort((p, q) => p.z - q.z).forEach((p) => p.paint());
}

/**
 * Builds the 'player' sprite sheet (rows = directions, cols = 2 idle + 4 walk
 * frames) and registers 'player-idle-<dir>' / 'player-walk-<dir>' animations.
 */
export function generateCharacter(scene: Phaser.Scene): void {
  const sheet = new PixelCanvas(FRAME_W * COLS, FRAME_H * DIRECTIONS.length);
  DIRECTIONS.forEach((dir, row) => {
    const poses = [...IDLE, ...WALK];
    poses.forEach((pose, col) => {
      // Draw each frame alone so the outline pass can't bleed between frames.
      const frame = new PixelCanvas(FRAME_W, FRAME_H);
      drawFigure(frame, 0, 0, dir.angle, pose);
      frame.outline();
      sheet.blit(frame, col * FRAME_W, row * FRAME_H);
    });
  });

  const tex = sheet.toTexture(scene, 'player');
  let i = 0;
  for (let row = 0; row < DIRECTIONS.length; row++) {
    for (let col = 0; col < COLS; col++) tex.add(i++, 0, col * FRAME_W, row * FRAME_H, FRAME_W, FRAME_H);
  }

  DIRECTIONS.forEach((dir, row) => {
    const first = row * COLS;
    const frames = (from: number, n: number) =>
      Array.from({ length: n }, (_, k) => ({ key: 'player', frame: first + from + k }));
    scene.anims.create({ key: `player-idle-${dir.name}`, frames: frames(0, IDLE_FRAMES), frameRate: 2, repeat: -1 });
    scene.anims.create({ key: `player-walk-${dir.name}`, frames: frames(IDLE_FRAMES, WALK_FRAMES), frameRate: 9, repeat: -1 });
  });
}
