import Phaser from 'phaser';
import { IsoModel, lipped, planks, RenderedModel, Shader } from './IsoModel';
import { PALETTE as P } from './palette';
import { PixelCanvas, seededRandom } from './PixelCanvas';
import { scorch } from './scorch';

/**
 * The family home: log walls, floorboards, furniture and the cottage seen from
 * outside. Everything is built with IsoModel so it sits on the same isometric
 * grid as the rest of the world.
 *
 * Each model is registered under a texture key with its anchor (where the
 * model's grid corner (0, 0) lands), so IsoMap can stand it on any tile.
 */
export interface ModelArt {
  key: string;
  originX: number;
  originY: number;
}

export const MODEL_ART: Record<string, ModelArt> = {};

/** Height of the room's back walls, in pixels. */
export const WALL_HEIGHT = 84;

export function registerModel(scene: Phaser.Scene, key: string, m: RenderedModel): PixelCanvas {
  return register(scene, key, m);
}

function register(scene: Phaser.Scene, key: string, m: RenderedModel): PixelCanvas {
  const tex = m.canvas.toTexture(scene, key);
  MODEL_ART[key] = { key, originX: m.anchorX / tex.width, originY: m.anchorY / tex.height };
  return m.canvas;
}

const pick = (h: number, ...cols: number[]) => cols[Math.floor(Math.abs(h)) % cols.length];
const hash = (a: number, b: number) => {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

// ---------------------------------------------------------------- walls

export type WallKind = 'plain' | 'window' | 'door' | 'shelf';

/** Log wall, with an optional window, door or hanging shelf cut into it. */
function wallShader(kind: WallKind, side: 'back' | 'side', index: number): Shader {
  const logs = planks(9, P.log, P.logDark, P.logLight, index * 3 + (side === 'back' ? 1 : 5));
  return (u, v) => {
    const x = u * 32; // pixels across the segment
    const y = v * WALL_HEIGHT; // pixels down from the top
    // Top beam and skirting board.
    if (y < 5) return y < 2 ? P.logLight : P.logDark;
    if (y > WALL_HEIGHT - 5) return y > WALL_HEIGHT - 2 ? P.plankDark : P.bark;
    if (kind === 'window' && x > 7 && x < 25 && y > 20 && y < 46) {
      if (x < 9 || x > 23 || y < 22 || y > 44) return P.barkDark; // frame
      if (Math.abs(x - 16) < 1 || Math.abs(y - 33) < 1) return P.bark; // mullions
      // Diagonal glint across the glass.
      const glint = (x - y + 60) % 14;
      if (glint < 2) return P.glassLight;
      return y < 33 ? P.glass : P.glassDark;
    }
    if (kind === 'window' && x > 6 && x < 26 && y >= 46 && y < 49) return P.plankLight; // sill
    if (kind === 'door' && x > 5 && x < 27) {
      // Arched plank door.
      const cx = x - 16;
      const archTop = 14 + (cx * cx) / 14;
      if (y > archTop) {
        if (y < archTop + 2 || x < 7 || x > 25) return P.barkDark;
        if (Math.floor(x) % 5 === 0) return P.leatherDark;
        if ((y > 30 && y < 33) || (y > 62 && y < 65)) return x > 20 ? P.iron : P.ironLight; // hinges
        if (Math.abs(x - 9) < 1 && Math.abs(y - 50) < 2) return P.gold; // latch
        return y < archTop + 5 ? P.leatherLight : P.leather;
      }
    }
    if (kind === 'shelf') {
      if (y > 36 && y < 40 && x > 3 && x < 29) return y < 37 ? P.plankLight : P.plankDark;
      // Jars and a hanging bunch of herbs.
      if (y > 26 && y <= 36) {
        if (x > 6 && x < 11) return y < 28 ? P.leatherDark : x < 8 ? P.glassLight : P.glass;
        if (x > 13 && x < 17 && y > 29) return x < 14 ? P.flowerWhite : P.linenDark;
        if (x > 20 && x < 26 && y > 28) return y < 30 ? P.mushroom : x < 22 ? P.leatherLight : P.leather;
      }
      if (x > 11 && x < 21 && y > 50 && y < 64) {
        const stem = Math.abs(x - 16) < 0.6;
        if (y < 53) {
          if (stem) return P.bark;
        } else if (hash(Math.floor(x), Math.floor(y)) < 0.55 - (y - 53) * 0.035) return pick(x + y, P.leafDark, P.leaf, P.moss);
      }
    }
    return logs(u, v);
  };
}

export function makeWall(scene: Phaser.Scene, key: string, side: 'back' | 'side', kind: WallKind, index: number, wrap?: (s: Shader) => Shader): void {
  const m = new IsoModel();
  const H = WALL_HEIGHT;
  const cap = 0.14;
  const shade = wrap ? wrap(wallShader(kind, side, index)) : wallShader(kind, side, index);
  if (side === 'back') {
    // Runs along x at y = 0, facing the room (+y).
    m.quad({ x: 0, y: 0, z: H }, { x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: -H }, shade);
    m.quad({ x: 0, y: -cap, z: H }, { x: 1, y: 0, z: 0 }, { x: 0, y: cap, z: 0 }, lipped(P.logLight, P.logLight));
  } else {
    // Runs along y at x = 0, facing the room (+x). Slightly darker: it's in shade.
    const darker: Shader = (u, v) => {
      const c = shade(u, v);
      return c === null ? null : darken(c);
    };
    m.quad({ x: 0, y: 0, z: H }, { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: -H }, darker);
    m.quad({ x: -cap, y: 0, z: H }, { x: cap, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, P.logLight);
  }
  register(scene, key, m.render(false));
}

/** One step darker along the wood ramp, for walls facing away from the light. */
function darken(c: number): number {
  const ramp: Record<number, number> = {
    [P.logLight]: P.log,
    [P.log]: P.logDark,
    [P.logDark]: P.barkDark,
    [P.glass]: P.glassDark,
    [P.leatherLight]: P.leather,
    [P.leather]: P.leatherDark,
  };
  return ramp[c] ?? c;
}

function cornerPost(scene: Phaser.Scene): void {
  const m = new IsoModel();
  m.box(-0.14, -0.14, 0, 0.26, 0.26, WALL_HEIGHT + 2, {
    top: P.logLight,
    left: lipped(P.log, P.logLight),
    right: P.logDark,
  });
  register(scene, 'wall-corner', m.render());
}

// ---------------------------------------------------------------- floor

/** Wooden floorboards running across the room, as a ground tile. */
export function floorTile(seed: number, w: number, h: number): PixelCanvas {
  const c = new PixelCanvas(w, h);
  const rnd = seededRandom(seed);
  const board = planks(4, P.plank, P.plankDark, P.plankLight, seed);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const row = y < h / 2 ? y : h - 1 - y;
      const half = 2 * (row + 1);
      if (x < w / 2 - half || x >= w / 2 + half) continue;
      const sx = (x + 0.5 - w / 2) / (w / 2);
      const sy = (y + 0.5 - h / 2) / (h / 2);
      const u = (sx + sy) / 2 + 0.5;
      const v = (sy - sx) / 2 + 0.5;
      let col = board(v, u) ?? P.plank;
      if (col === P.plank && rnd() < 0.06) col = P.plankDark;
      c.set(x, y, col);
    }
  }
  return c;
}

// ---------------------------------------------------------------- furniture

export function hearth(): IsoModel {
  const m = new IsoModel();
  const stones: Shader = (u, v) => {
    const row = Math.floor(v * 5);
    const col = Math.floor(u * 6 + (row % 2) * 0.5);
    const lu = (u * 6 + (row % 2) * 0.5) % 1;
    const lv = (v * 5) % 1;
    if (lu < 0.08 || lv < 0.12) return P.mortar;
    return pick(hash(col, row) * 4, P.stone, P.stoneLight, P.stone, P.stoneDark);
  };
  const stonesDark: Shader = (u, v) => {
    const c = stones(u, v);
    return c === P.stoneLight ? P.stone : c === P.stone ? P.stoneDark : c;
  };
  // Chimney breast up the wall, then the firebox in front of it.
  m.box(0.3, 0, 40, 1.4, 0.45, WALL_HEIGHT - 40, { top: P.stoneLight, left: stones, right: stonesDark });
  m.box(0, 0, 0, 2, 0.8, 40, {
    top: P.stoneLight,
    left: (u, v) => {
      // Arched opening in the front face.
      const x = (u - 0.5) * 64;
      const y = v * 40;
      const top = 12 + (x * x) / 40;
      if (Math.abs(x) < 20 && y > top) return y > 36 ? P.ink : P.soot;
      return stones(u, v);
    },
    right: stonesDark,
  });
  // Wooden mantel.
  m.box(-0.06, 0, 40, 2.12, 0.92, 4, { top: P.plankLight, left: P.plank, right: P.plankDark });
  // A pot and candle on the mantel.
  m.cylinder(0.45, 0.55, 44, 0.12, 8, (u) => (u < 0.3 ? P.leatherLight : u > 0.7 ? P.leatherDark : P.leather), P.leatherDark);
  m.box(1.55, 0.45, 44, 0.08, 0.08, 9, { top: P.fireYellow, left: P.flowerWhite, right: P.linenDark });
  return m;
}

/** Adds flickering flames into the hearth's opening for one animation frame. */
function paintFlames(c: PixelCanvas, ax: number, ay: number, frame: number): void {
  // The opening's bottom-centre: grid (1, 0.8, 0) in model space.
  const bx = ax + (1 - 0.8) * 32;
  const by = ay + (1 + 0.8) * 16 - 3;
  const rnd = seededRandom(17 + frame * 31);
  // Logs.
  // The opening's floor slopes down to the right (it's on the left-facing side).
  const floor = (x: number) => by + Math.round(x / 2);
  for (let i = -9; i <= 9; i++) {
    c.set(bx + i, floor(i) - 1, P.barkDark);
    c.set(bx + i, floor(i) - 2, i % 4 === 0 ? P.ember : P.bark);
  }
  for (let i = 0; i < 26; i++) {
    const x = Math.round((rnd() - 0.5) * 22);
    const h = 4 + rnd() * (16 - Math.abs(x) * 0.7);
    for (let y = 0; y < h; y++) {
      const t = y / h;
      const col = t < 0.3 ? P.fireYellow : t < 0.7 ? P.fireOrange : P.fireRed;
      const sway = Math.round(Math.sin(t * 3 + frame * 2 + i) * t * 1.5);
      c.set(bx + x + sway, floor(x) - 3 - y, col);
    }
  }
  for (let i = 0; i < 3; i++) c.set(bx + Math.round((rnd() - 0.5) * 16), by - 18 - rnd() * 6, P.ember);
}

export function bed(): IsoModel {
  const m = new IsoModel();
  const wood = { top: P.barkLight, left: lipped(P.bark, P.barkLight), right: P.barkDark };
  // Headboard against the back, then frame, mattress, quilt, pillow, footboard.
  m.box(0, 0, 0, 1, 0.12, 42, wood);
  m.box(0.04, 0.12, 4, 0.92, 1.82, 12, wood);
  m.box(0.08, 0.14, 16, 0.84, 1.76, 6, { top: P.linen, left: P.linenDark, right: P.linenDark });
  m.box(0.16, 0.2, 22, 0.68, 0.36, 6, { top: P.flowerWhite, left: P.linen, right: P.linenDark });
  const quilt: Shader = (u, v) => {
    const cu = Math.floor(u * 4);
    const cv = Math.floor(v * 6);
    if ((u * 4) % 1 < 0.08 || (v * 6) % 1 < 0.08) return P.quiltDark;
    return (cu + cv) % 2 ? P.quilt : P.quiltLight;
  };
  m.box(0.06, 0.66, 18, 0.88, 1.24, 6, {
    top: quilt,
    left: (_u, v) => (v < 0.4 ? P.quilt : P.quiltDark),
    right: P.quiltDark,
  });
  m.box(0, 1.88, 0, 1, 0.12, 26, wood);
  return m;
}

export function strawBed(): IsoModel {
  const m = new IsoModel();
  const straw: Shader = (u, v) => (hash(Math.floor(u * 40), Math.floor(v * 30)) < 0.3 ? P.strawDark : P.straw);
  m.box(0.08, 0, 0, 0.84, 1.9, 8, { top: straw, left: P.strawDark, right: P.strawDark });
  m.box(0.1, 0.8, 8, 0.8, 1.05, 3, {
    top: (u, v) => ((u * 10 + v * 4) % 1 < 0.15 ? P.woolDark : P.wool),
    left: P.woolDark,
    right: P.woolDark,
  });
  m.box(0.22, 0.12, 8, 0.56, 0.36, 4, { top: P.linen, left: P.linenDark, right: P.linenDark });
  return m;
}

export function table(): IsoModel {
  const m = new IsoModel();
  const leg = { top: P.bark, left: P.bark, right: P.barkDark };
  for (const [x, y] of [[0.12, 0.12], [1.78, 0.12], [0.12, 0.78], [1.78, 0.78]]) m.box(x, y, 0, 0.1, 0.1, 26, leg);
  m.box(0, 0, 26, 2, 1, 4, { top: planks(3, P.plankLight, P.plank, P.plankLight, 4), left: P.plank, right: P.plankDark });
  // Bread, a bowl and a candle.
  m.box(0.45, 0.3, 30, 0.35, 0.22, 6, { top: P.dirtLight, left: P.dirt, right: P.dirtDark });
  m.cylinder(1.25, 0.55, 30, 0.16, 5, (u) => (u < 0.4 ? P.stoneLight : P.stone), P.mortar);
  m.box(1.55, 0.25, 30, 0.08, 0.08, 10, { top: P.fireYellow, left: P.flowerWhite, right: P.linenDark });
  return m;
}

export function stool(): IsoModel {
  const m = new IsoModel();
  for (const [x, y] of [[0.3, 0.3], [0.62, 0.3], [0.3, 0.62], [0.62, 0.62]]) {
    m.box(x, y, 0, 0.08, 0.08, 14, { top: P.bark, left: P.bark, right: P.barkDark });
  }
  m.cylinder(0.5, 0.5, 14, 0.28, 4, (u) => (u < 0.35 ? P.plankLight : u > 0.75 ? P.plankDark : P.plank), P.plankLight);
  return m;
}

export function cupboard(): IsoModel {
  const m = new IsoModel();
  const front: Shader = (u, v) => {
    const x = u * 32;
    const y = v * 64;
    if (x < 2 || x > 30 || y < 3) return P.barkDark;
    // Open shelves on top, closed doors below.
    if (y < 34) {
      if (Math.floor(y) % 11 < 2) return P.plankLight;
      const shelf = Math.floor(y / 11);
      const item = Math.floor(x / 6);
      const h = hash(shelf, item);
      const inItem = x % 6 > 1 && y % 11 > 4 - (h > 0.5 ? 2 : 0);
      if (inItem && h > 0.25) return h > 0.7 ? P.stoneLight : h > 0.5 ? P.flowerWhite : P.leatherLight;
      return P.ink;
    }
    if (Math.abs(x - 16) < 1) return P.barkDark;
    if (Math.abs(x - 13.5) < 1 && Math.abs(y - 48) < 1.5) return P.gold;
    if (Math.abs(x - 18.5) < 1 && Math.abs(y - 48) < 1.5) return P.gold;
    return y < 36 ? P.plankLight : P.plank;
  };
  m.box(0.05, 0, 0, 0.9, 0.5, 64, { top: P.plankLight, left: front, right: P.plankDark });
  return m;
}

/**
 * A barrel: oak staves bellied out in the middle, three iron hoops, and a lid of
 * boards with a bung. Built from stacked rings so the belly shows.
 */
function barrel(cx: number, cy: number, m: IsoModel, h = 26): IsoModel {
  const rings = 9;
  const hoops = [0.12, 0.5, 0.88];
  for (let i = 0; i < rings; i++) {
    const t0 = i / rings;
    const t1 = (i + 1) / rings;
    const r = 0.25 + 0.05 * Math.sin(Math.PI * (t0 + t1) / 2);
    const hooped = hoops.some((hz) => Math.abs((t0 + t1) / 2 - hz) < 0.5 / rings);
    m.cylinder(cx, cy, h * t0, r, h / rings + 0.3, (u) => {
      if (hooped) return u < 0.35 ? P.ironLight : u > 0.75 ? 0x3a3a44 : P.iron;
      // Staves: a joint every few slices, and each stave a slightly different oak.
      if (Math.floor(u * 24) % 3 === 0) return P.barkDark;
      const stave = Math.floor(u * 8);
      const c = stave % 3 === 0 ? P.barkLight : stave % 3 === 1 ? P.bark : 0x6e4a2e;
      return u < 0.3 ? P.barkLight : u > 0.75 ? P.barkDark : c;
    }, P.bark);
  }
  return m.cylinder(cx, cy, h, 0.26, 1, () => P.iron, (u, v) => {
    const d = Math.hypot(u - 0.5, v - 0.5);
    if (d > 0.42) return P.barkDark;
    if (Math.hypot(u - 0.62, v - 0.58) < 0.07) return P.barkDark;
    return (u * 5) % 1 < 0.1 ? P.bark : P.barkLight;
  });
}

export function barrels(): IsoModel {
  const m = new IsoModel();
  // Both kept inside the tile, so neither sticks out in front of what stands next to them.
  barrel(0.3, 0.3, m);
  barrel(0.7, 0.72, m, 22);
  return m;
}

export function chest(): IsoModel {
  const m = new IsoModel();
  const band: Shader = (u, v) => {
    if (Math.abs(u - 0.2) < 0.05 || Math.abs(u - 0.8) < 0.05) return P.iron;
    if (Math.abs(u - 0.5) < 0.06 && v > 0.15 && v < 0.45) return P.gold;
    return v < 0.32 ? P.leatherLight : P.leather;
  };
  m.box(0.1, 0.2, 0, 0.8, 0.6, 20, { top: band, left: band, right: P.leatherDark });
  return m;
}

/** Flat woven rug, baked into the floor. */
export function rug(): IsoModel {
  const m = new IsoModel();
  m.quad({ x: 0, y: 0, z: 0 }, { x: 2.6, y: 0, z: 0 }, { x: 0, y: 2, z: 0 }, (u, v) => {
    const e = Math.min(u, v, 1 - u, 1 - v);
    if (e < 0.02) return (Math.floor(u * 40) + Math.floor(v * 40)) % 2 ? P.linen : null; // fringe
    if (e < 0.08) return P.quiltDark;
    if (e < 0.11) return P.gold;
    const d = Math.abs(u - 0.5) * 1.3 + Math.abs(v - 0.5);
    if (Math.abs(d - 0.3) < 0.04) return P.gold;
    return d < 0.3 ? P.quiltLight : P.quilt;
  });
  return m;
}

/** Straw doormat by the front door. */
function doormat(): IsoModel {
  const m = new IsoModel();
  m.quad({ x: 0.1, y: 0.15, z: 0 }, { x: 0.8, y: 0, z: 0 }, { x: 0, y: 0.7, z: 0 }, (u, v) =>
    Math.min(u, v, 1 - u, 1 - v) < 0.08 ? P.strawDark : (u * 12) % 1 < 0.3 ? P.strawDark : P.straw,
  );
  return m;
}

// ---------------------------------------------------------------- outside

/** The family cottage as seen from the village: log walls, thatched gable roof, chimney. */
function cottage(ruined = false): { model: IsoModel; windows: Array<[number, number]> } {
  const m = new IsoModel();
  const S = 3; // footprint, in tiles
  const H = 64;
  const R = 46;
  const o = 0.28;
  const logs = planks(10, P.log, P.logDark, P.logLight, 3);
  const thatch: Shader = (u, v) => {
    const row = Math.floor(v * 9);
    const lv = (v * 9) % 1;
    const n = hash(Math.floor(u * 60), row);
    if (v > 0.94) return P.thatchDark;
    if (lv > 0.82) return P.thatchDark;
    if (n < 0.18) return P.thatchDark;
    if (n > 0.86 || lv < 0.15) return P.thatchLight;
    return P.thatch;
  };
  const wall = (windows: Array<[number, number]>, door: [number, number] | null, dark: boolean): Shader => (u, v) => {
    const x = u * S * 32;
    const y = v * H;
    if (y > H - 8) return pick(hash(Math.floor(x / 6), Math.floor(y / 4)) * 3, P.stone, P.stoneDark, P.stoneLight);
    if (u < 0.03 || u > 0.97) return dark ? P.barkDark : P.bark;
    if (door && u > door[0] && u < door[1] && y > 14) {
      const du = (u - door[0]) / (door[1] - door[0]);
      const archTop = 14 + Math.pow((du - 0.5) * 2, 2) * 6;
      if (y > archTop) {
        if (du < 0.08 || du > 0.92 || y < archTop + 2) return P.barkDark;
        if ((y > 26 && y < 29) || (y > 46 && y < 49)) return P.iron;
        if (Math.floor(du * 5 + 0.5) !== Math.round(du * 5) && (du * 5) % 1 < 0.12) return P.leatherDark;
        return dark ? P.leatherDark : P.leather;
      }
    }
    for (const [a, b] of windows) {
      if (u > a && u < b && y > 18 && y < 40) {
        const wu = (u - a) / (b - a);
        if (wu < 0.12 || wu > 0.88 || y < 20.5 || y > 37.5) return P.barkDark;
        if (Math.abs(wu - 0.5) < 0.06 || Math.abs(y - 29) < 1) return P.bark;
        return y < 29 ? P.glassLit : P.fireOrange;
      }
      if (u > a - 0.02 && u < b + 0.02 && y >= 40 && y < 43) return P.plankLight;
    }
    const c = logs(u, v * 0.86) ?? P.log;
    return dark ? darken(c) : c;
  };

  const frontWindows: Array<[number, number]> = [[0.16, 0.34], [0.64, 0.82]];
  // Burnt by the goblins: walls blackened from the top down, windows and door gone to black holes,
  // the thatch burnt away to a few charred tufts over bare, broken rafters.
  const burn = (shade: Shader, seed: number, amount: number, holes = 0): Shader =>
    ruined ? scorch(shade, seed, { amount, holes, climb: 0.7, grain: 1.2, embers: true }, [9, 6]) : shade;
  const gutted: Shader = (u, v) => {
    // Windows and door burnt out: black holes, a jagged sliver of shutter left here and there.
    return ruined && (hash(Math.floor(u * 40), Math.floor(v * 30)) < 0.85) ? P.ink : P.barkDark;
  };
  const wallOf = (windows: Array<[number, number]>, door: [number, number] | null, dark: boolean): Shader => {
    const base = wall(windows, door, dark);
    if (!ruined) return base;
    return (u, v) => {
      const y = v * H;
      for (const [a, b] of windows) if (u > a && u < b && y > 20 && y < 38) return gutted(u, v);
      if (door && u > door[0] + 0.02 && u < door[1] - 0.02 && y > 16) return gutted(u, v);
      return base(u, v);
    };
  };
  // Back roof slope (drawn first; the front slope and gable cover most of it).
  if (!ruined) m.quad({ x: -o, y: S / 2, z: H + R }, { x: S + o, y: 0, z: 0 }, { x: 0, y: -S / 2 - o, z: -R - 8 }, thatch);
  // Chimney poking up through the back slope (the stone stands, even when all else burns).
  m.box(0.55, 0.45, H, 0.45, 0.45, R + 24, {
    top: P.soot,
    left: burn((u, v) => ((v * 8) % 1 < 0.15 || (u * 3 + Math.floor(v * 8) * 0.5) % 1 < 0.1 ? P.mortar : P.stone), 21, 0.35),
    right: burn((_u, v) => ((v * 8) % 1 < 0.15 ? P.mortar : P.stoneDark), 22, 0.35),
  });
  if (ruined) {
    // Charred rafters, front and back, a few broken off short, and what's left of the ridge beam, sagging.
    const char = { left: 0x2a2224 };
    const rafters: Array<[number, number]> = [[-0.1, 1], [0.7, 0.55], [1.35, 1], [2.05, 0.4], [2.75, 0.85]];
    for (const [x, len] of rafters) {
      m.quad({ x, y: S / 2, z: H + R }, { x: 0, y: (-S / 2 - o) * len, z: (-R - 8) * len }, { x: 0.1, y: 0, z: 0 }, char.left);
    }
    // Remnants of thatch, black and smouldering, clinging to the back eaves.
    m.quad({ x: -o, y: 0.5, z: H + 14 }, { x: S + o, y: 0, z: 0 }, { x: 0, y: -0.5 - o, z: -22 }, burn(thatch, 23, 0.75, 0.9));
  }
  // Walls: the front (+y) face with windows, the side (+x) face with the door.
  m.quad({ x: 0, y: S, z: H }, { x: S, y: 0, z: 0 }, { x: 0, y: 0, z: -H }, burn(wallOf(frontWindows, null, false), 24, 0.45, 0.35));
  m.quad({ x: S, y: 0, z: H }, { x: 0, y: S, z: 0 }, { x: 0, y: 0, z: -H }, burn(wallOf([[0.1, 0.26]], [0.37, 0.63], true), 25, 0.45, 0.35));
  // Gable triangle above the door (burnt down to a jagged stump).
  m.quad({ x: S, y: 0, z: H }, { x: 0, y: S, z: 0 }, { x: 0, y: 0, z: R }, burn((u, v) => {
    if (v > 1 - Math.abs(u * 2 - 1)) return null;
    if (ruined && v > 0.25 + Math.sin(u * 23) * 0.12 + Math.sin(u * 7.3) * 0.1) return null;
    if (Math.abs(u - 0.5) < 0.05 && v > 0.25 && v < 0.5) return P.ink; // vent
    return v < 0.06 ? P.logDark : darken(logs(u, v) ?? P.log);
  }, 26, 0.6));
  if (ruined) {
    // The front rafters over everything, a couple snapped and hanging.
    const rafters: Array<[number, number]> = [[-0.2, 1], [0.6, 0.35], [1.3, 0.8], [2.0, 1], [2.7, 0.5], [S + 0.15, 0.9]];
    for (const [x, len] of rafters) {
      m.quad({ x, y: S / 2, z: H + R }, { x: 0, y: (S / 2 + o) * len, z: (-R - 8) * len }, { x: 0.1, y: 0, z: 0 }, (u) => (u < 0.5 ? 0x3a2e2a : 0x2a2224));
    }
    // The ridge beam, sagging in the middle.
    m.quad({ x: -o, y: S / 2, z: H + R - 2 }, { x: (S + o * 2) * 0.55, y: 0, z: -9 }, { x: 0, y: 0, z: 3 }, P.ink);
    m.quad({ x: -o + (S + o * 2) * 0.55, y: S / 2, z: H + R - 11 }, { x: (S + o * 2) * 0.45, y: 0, z: 9 }, { x: 0, y: 0, z: 3 }, 0x2a2224);
    // Scraps of charred thatch still hanging off the front eaves.
    m.quad({ x: -o, y: S, z: H + 2 }, { x: S + o * 2, y: 0, z: 0 }, { x: 0, y: o, z: -10 }, burn(thatch, 27, 0.8, 1.1));
    // The bench by the door, burnt, and the water barrel knocked over in the mud.
    m.box(S + 0.05, 0.25, 0, 0.3, 0.7, 7, { top: 0x2a2224, left: 0x3a2e2a, right: P.ink });
    m.quad({ x: S + 0.1, y: 2.2, z: 1 }, { x: 0.5, y: 0.15, z: 0 }, { x: 0, y: 0, z: 9 }, burn(lipped(P.bark, P.barkLight), 28, 0.5));
    return { model: m, windows: [] };
  }
  // Overhang of the back slope past the gable, then the front slope over everything.
  m.quad({ x: S, y: S / 2, z: H + R }, { x: o, y: 0, z: 0 }, { x: 0, y: -S / 2 - o, z: -R - 8 }, P.thatchDark);
  m.quad({ x: -o, y: S / 2, z: H + R }, { x: S + o * 2, y: 0, z: 0 }, { x: 0, y: S / 2 + o, z: -R - 8 }, thatch);
  // Ridge cap.
  m.box(-o, S / 2 - 0.06, H + R - 2, S + o * 2, 0.12, 4, { top: P.thatchLight, left: P.thatchDark, right: P.thatchDark });
  // A bench and a water barrel by the door.
  m.box(S + 0.05, 0.25, 0, 0.3, 0.7, 12, { top: P.plankLight, left: P.plank, right: P.plankDark });
  barrel(S + 0.3, 2.55, m, 24);
  return { model: m, windows: frontWindows };
}

// ---------------------------------------------------------------- registry

export const HEARTH_FRAMES = 4;

export function generateInterior(scene: Phaser.Scene): void {
  (['plain', 'window', 'door', 'shelf'] as WallKind[]).forEach((kind) => {
    for (let i = 0; i < 2; i++) {
      makeWall(scene, `wall-back-${kind}-${i}`, 'back', kind, i);
      makeWall(scene, `wall-side-${kind}-${i}`, 'side', kind, i);
    }
  });
  cornerPost(scene);

  register(scene, 'furn-bed', bed().render());
  register(scene, 'furn-strawbed', strawBed().render());
  register(scene, 'furn-table', table().render());
  register(scene, 'furn-stool', stool().render());
  register(scene, 'furn-cupboard', cupboard().render());
  register(scene, 'furn-barrels', barrels().render());
  register(scene, 'furn-chest', chest().render());
  register(scene, 'furn-rug', rug().render(false));
  register(scene, 'furn-doormat', doormat().render(false));
  register(scene, 'bld-cottage', cottage().model.render());
  register(scene, 'bld-cottage-burnt', cottage(true).model.render());

  // The hearth as a strip of frames with the fire flickering.
  const base = hearth().render();
  const w = base.canvas.width;
  const sheet = new PixelCanvas(w * HEARTH_FRAMES, base.canvas.height);
  for (let f = 0; f < HEARTH_FRAMES; f++) {
    const frame = new PixelCanvas(w, base.canvas.height);
    frame.blit(base.canvas, 0, 0);
    paintFlames(frame, base.anchorX, base.anchorY, f);
    sheet.blit(frame, f * w, 0);
  }
  const tex = sheet.toTexture(scene, 'furn-hearth');
  for (let f = 0; f < HEARTH_FRAMES; f++) tex.add(f, 0, f * w, 0, w, base.canvas.height);
  MODEL_ART['furn-hearth'] = { key: 'furn-hearth', originX: base.anchorX / w, originY: base.anchorY / base.canvas.height };
  scene.anims.create({
    key: 'hearth-fire',
    frames: [0, 1, 2, 3, 1, 2].map((frame) => ({ key: 'furn-hearth', frame })),
    frameRate: 7,
    repeat: -1,
  });
}
