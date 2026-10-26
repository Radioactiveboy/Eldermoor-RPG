import Phaser from 'phaser';
import { PALETTE as P } from './palette';
import { PixelCanvas } from './PixelCanvas';

/**
 * The hero: a hooded wanderer in a forest-green cloak. Travellers on the road
 * are built from the same body in their own clothes (see {@link Outfit}).
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
const SIT_FRAMES = 2;
const COLS = IDLE_FRAMES + WALK_FRAMES + SIT_FRAMES;

interface Pose {
  /** -1..1 leg swing: positive puts the left leg forward. */
  stride: number;
  /** Pixels the upper body sinks (walk contact frames, idle breathing). */
  bob: number;
  /** Cloak hem pushed back while moving. */
  flutter: number;
  /** Seated (or crouching): knees bent forward, body lowered. */
  sit?: boolean;
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
const SIT: Pose[] = [
  { stride: 0, bob: 3, flutter: 0, sit: true },
  { stride: 0, bob: 4, flutter: 0, sit: true },
];

type Draw = { z: number; paint: () => void };

/** A colour about a third darker, for shading hair. */
export function darker(color: number): number {
  const ch = (shift: number) => Math.round(((color >> shift) & 0xff) * 0.65) << shift;
  return ch(16) | ch(8) | ch(0);
}

/** Three tones of one colour: base, shade, light. */
export type Tones = [number, number, number];

/** What a figure wears and carries. */
export interface Outfit {
  /** Cloak hanging from the shoulders, or null for none. */
  cloak: Tones | null;
  /** A hood up over the head (in the cloak's colour), instead of bare hair. */
  hood: boolean;
  /** Vest or tunic over the torso. */
  tunic: Tones;
  /** Sleeves, and the shirt showing at the collar: base and shade. */
  shirt: [number, number];
  trouser: [number, number];
  boots: Tones;
  skin: [number, number];
  hair: number;
  /** A wide-brimmed hat. */
  hat?: Tones;
  beard?: number;
  /** A long robe down to the ankles, in the tunic's colours. */
  robe?: boolean;
  /** A heavy pack on the back, with a bedroll on top. */
  pack?: boolean;
  /** A tall walking staff in the right hand. */
  staff?: boolean;
  /** Tips the staff with an iron spearhead (it's a spear, held a little higher). */
  spear?: boolean;
  /** A shirt of mail: grey rings showing at the shoulders and under the tunic's hem. */
  mail?: boolean;
}

export const HERO_OUTFIT: Outfit = {
  cloak: [P.cloak, P.cloakDark, P.cloakLight],
  hood: true,
  tunic: [P.leather, P.leatherDark, P.leatherLight],
  shirt: [P.linen, P.linenDark],
  trouser: [P.trouser, P.trouserDark],
  boots: [P.leather, P.leatherDark, P.leatherLight],
  skin: [P.skin, P.skinShade],
  hair: P.hair,
};

function drawFigure(c: PixelCanvas, ox: number, oy: number, angleDeg: number, pose: Pose, o: Outfit): void {
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

  // Seated: thighs reach forward from the hips, shins drop to the ground.
  if (pose.sit) {
    for (const side of [-1, 1]) {
      const L = side * 2.5;
      parts.push({
        z: Z(L, 3) - 0.5,
        paint: () => {
          const hip = oy + 35;
          for (let d = 0; d <= 3; d++) c.shadedRect(Math.round(X(L, d) - 1.5), hip, 3, 3, ...o.trouser);
          const x = Math.round(X(L, 3.5) - 1.5);
          c.shadedRect(x, hip + 2, 3, feet - hip - 4, ...o.trouser);
          const toe = Math.round(sin * 1.5);
          c.shadedRect(Math.min(x, x + toe), feet - 3, 3 + Math.abs(toe), 3, ...o.boots);
        },
      });
    }
  }

  // Legs and boots. The trailing leg lifts a little.
  for (const side of pose.sit ? [] : [-1, 1]) {
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
        c.shadedRect(x, top, 3, bottom - top - 2, ...o.trouser);
        // Boot toe points the way we face.
        const toe = Math.round(sin * 1.5);
        c.shadedRect(Math.min(x, x + toe), bottom - 3, 3 + Math.abs(toe), 3, ...o.boots);
      },
    });
  }

  // A robe hangs from the waist to the ankles, over the legs.
  if (o.robe) {
    const [base, dark, light] = o.tunic;
    parts.push({
      z: Z(0, 0) - 0.2,
      paint: () => {
        const top = oy + 31 + b;
        for (let y = top; y <= feet - 1; y++) {
          const half = 4.5 * Math.abs(cos) + 3.5 * Math.abs(sin) + (y - top) * 0.15 + 0.5;
          const mid = X(0, 0) + (y - top) * pose.stride * 0.04 * cos;
          const left = Math.round(mid - half);
          const right = Math.round(mid + half);
          for (let x = left; x <= right; x++) {
            const rel = (x - left) / Math.max(1, right - left);
            c.set(x, y, y === feet - 1 ? dark : rel > 0.68 ? dark : rel < 0.16 ? light : base);
          }
        }
      },
    });
  }

  // A pack on the back, with a rolled blanket strapped on top.
  if (o.pack) {
    parts.push({
      z: Z(0, -5),
      paint: () => {
        const mid = X(0, -5);
        const halfW = 4.5 * Math.abs(cos) + 3 * Math.abs(sin);
        const top = oy + 21 + b;
        c.shadedRect(Math.round(mid - halfW), top, Math.round(halfW * 2), 12, P.leather, P.leatherDark, P.leatherLight);
        c.shadedRect(Math.round(mid - halfW - 1), top - 3, Math.round(halfW * 2 + 2), 4, P.wool, P.woolDark);
        c.rect(Math.round(mid - halfW), top + 5, Math.round(halfW * 2), 1, P.leatherDark);
      },
    });
  }

  // Cloak hangs behind the shoulders; seen from behind it covers the body.
  const cloakD = -2.5 - pose.flutter * 0.5;
  const [cloak, cloakDark, cloakLight] = o.cloak ?? o.tunic;
  if (o.cloak) parts.push({
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
          c.set(x, y, rel > 0.68 ? cloakDark : rel < 0.18 ? cloakLight : cloak);
        }
      }
      // Fold lines.
      if (cos < -0.2) {
        for (let y = top + 6; y < hem; y += 1) c.set(Math.round(X(0, cloakD)) + ((y >> 2) % 2), y, cloakDark);
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
      c.shadedRect(left, top, w, 13, ...o.tunic);
      // Mail shows below the tunic's hem.
      if (o.mail) c.rect(left, top + 13, w, 2, (pose.stride + b) % 2 ? P.iron : P.ironLight);
      const beltY = oy + 32 + b;
      c.rect(left, beltY, w, 1, P.leatherDark);
      if (front) {
        const chest = Math.round(X(0, 3));
        // Linen shirt showing in a V at the collar.
        for (let i = 0; i < 4; i++) c.rect(chest - 2 + Math.ceil(i / 2), top + i, 4 - Math.ceil(i / 2) * 2 + 1, 1, o.shirt[0]);
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
        c.shadedRect(x, top, 3, 8, ...o.shirt);
        c.rect(x, top + 6, 3, 1, P.leatherDark); // bracer edge
        c.rect(x, top + 8, 3, 2, o.skin[0]);
      },
    });
  }

  // A walking staff, planted ahead in the right hand (screen-left when facing us).
  if (o.staff) {
    parts.push({
      z: Z(6, 1) + 0.3,
      paint: () => {
        const x = Math.round(X(6, 1 - pose.stride));
        if (o.spear) {
          // A long ash shaft with a leaf-shaped iron head.
          for (let y = oy + 6; y < feet - 1; y++) c.set(x, y, P.bark);
          c.set(x, oy + 1, P.ironLight);
          c.rect(x - 1, oy + 2, 3, 3, P.iron);
          c.set(x, oy + 2, P.ironLight);
          c.set(x, oy + 3, P.ironLight);
          c.set(x, oy + 5, P.leatherDark);
          return;
        }
        for (let y = oy + 8; y < feet; y++) c.set(x, y, y < oy + 11 ? P.barkLight : P.bark);
        c.set(x - 1, oy + 9, P.barkDark);
      },
    });
  }

  // Head: hood, face, eyes.
  parts.push({
    z: 1,
    paint: () => {
      const hy = oy + 15 + b;
      if (o.hood) {
        const hoodX = X(0, -1.2);
        c.ellipse(hoodX, hy, 7.2, 7.5, cloak, cloakDark, cloakLight);
        // Point of the hood at the back of the head.
        const tipX = Math.round(X(0, -5.5));
        c.set(tipX, hy - 7, cloak);
        c.set(tipX, hy - 8, cloakLight);
      } else {
        // Bare head: hair over the back and top.
        c.ellipse(X(0, -0.8), hy, 6, 6.4, o.hair, darker(o.hair));
      }
      if (cos > -0.35) {
        const fx = X(0, 3.2);
        const rx = 2.6 + 1.6 * Math.max(0, cos);
        c.ellipse(fx, hy + 2, rx, 4, ...o.skin);
        // Fringe of hair under the hood.
        c.rect(Math.round(fx - rx), hy - 2, Math.round(rx * 2), 2, o.hair);
        // Eyes: skip any that has turned out of view.
        for (const side of [-1, 1]) {
          const L = side * 1.8;
          if (Z(L, 4) < 0.6) continue;
          c.set(X(L, 4), hy + 1, P.eye);
        }
        if (o.beard !== undefined) c.ellipse(X(0, 3.4), hy + 5, rx - 0.4, 2.6, o.beard);
      }
      if (o.hat) {
        // Wide brim, then the crown.
        c.ellipse(X(0, 0), hy - 3, 9 * Math.abs(cos) + 7 * Math.abs(sin), 2.2, ...o.hat);
        c.ellipse(X(0, -0.5), hy - 6, 5, 3.6, o.hat[0], o.hat[1], o.hat[2]);
        c.rect(Math.round(X(0, -0.5) - 4), hy - 4, 8, 1, P.leatherDark); // hatband
      }
      // Gold cloak clasp at the throat.
      if (front && o.cloak) c.set(X(0, 3), oy + 22 + b, P.gold);
    },
  });

  parts.sort((p, q) => p.z - q.z).forEach((p) => p.paint());
}

/**
 * Builds a character's sprite sheet (rows = directions, cols = 2 idle + 4 walk +
 * 2 sitting frames) and registers '<key>-idle-<dir>', '<key>-walk-<dir>',
 * '<key>-sit-<dir>' and '<key>-work-<dir>' animations. The hero is 'player'.
 */
export function generateCharacter(scene: Phaser.Scene, key = 'player', outfit: Outfit = HERO_OUTFIT): void {
  const sheet = new PixelCanvas(FRAME_W * COLS, FRAME_H * DIRECTIONS.length);
  DIRECTIONS.forEach((dir, row) => {
    const poses = [...IDLE, ...WALK, ...SIT];
    poses.forEach((pose, col) => {
      // Draw each frame alone so the outline pass can't bleed between frames.
      const frame = new PixelCanvas(FRAME_W, FRAME_H);
      drawFigure(frame, 0, 0, dir.angle, pose, outfit);
      frame.outline();
      sheet.blit(frame, col * FRAME_W, row * FRAME_H);
    });
  });

  const tex = sheet.toTexture(scene, key);
  let i = 0;
  for (let row = 0; row < DIRECTIONS.length; row++) {
    for (let col = 0; col < COLS; col++) tex.add(i++, 0, col * FRAME_W, row * FRAME_H, FRAME_W, FRAME_H);
  }

  DIRECTIONS.forEach((dir, row) => {
    const first = row * COLS;
    const frames = (from: number, n: number) =>
      Array.from({ length: n }, (_, k) => ({ key, frame: first + from + k }));
    scene.anims.create({ key: `${key}-idle-${dir.name}`, frames: frames(0, IDLE_FRAMES), frameRate: 2, repeat: -1 });
    scene.anims.create({ key: `${key}-walk-${dir.name}`, frames: frames(IDLE_FRAMES, WALK_FRAMES), frameRate: 9, repeat: -1 });
    // Sitting breathes slowly; crouching to work (picking, gathering) bobs quickly.
    const sitFrames = frames(IDLE_FRAMES + WALK_FRAMES, SIT_FRAMES);
    scene.anims.create({ key: `${key}-sit-${dir.name}`, frames: sitFrames, frameRate: 1.5, repeat: -1 });
    scene.anims.create({ key: `${key}-work-${dir.name}`, frames: sitFrames, frameRate: 6, repeat: -1 });
  });
}
