import Phaser from 'phaser';
import { FENCE_MASKS, fenceKey } from './farm';
import {
  barrels,
  bed,
  chest,
  cupboard,
  hearth,
  makeWall,
  MODEL_ART,
  registerModel,
  rug,
  stool,
  strawBed,
  WALL_HEIGHT,
  WallKind,
} from './interior';
import { IsoModel, lipped, planks, Shader } from './IsoModel';
import { PALETTE as P } from './palette';
import { PixelCanvas, seededRandom } from './PixelCanvas';
import { scorch, ScorchOptions, scorchPixels, smoothNoise } from './scorch';

/**
 * What the goblins leave behind, and the fires they set while they're at it:
 * the cottage's room burnt and ransacked (charred walls holed to the sky, the
 * furniture smashed and blackened, the cupboard emptied, the chest broken
 * open, blood on the floor), the farm's coop and fences scorched, trampled
 * crops, scattered feathers, patches of burnt ground, and flames to set on
 * anything still burning. Also Mother asleep in her bed, which is drawn as
 * part of the bed. The burnt cottage itself is in interior.ts, beside the
 * whole one.
 */

const BLOOD = 0x6e1414;
const BLOOD_DARK = 0x4a0c0e;
const BLOOD_LIGHT = 0x8e2020;
const CHAR = 0x2a2224;
const CHAR_LIGHT = 0x3a2e2a;

const hash = (a: number, b: number) => {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/** A whole model burnt, face by face. */
function burnt(m: IsoModel, seed: number, o: ScorchOptions, size: [number, number] = [5, 5]): IsoModel {
  return m.mapShaders((shade, i) => scorch(shade, seed + i * 13, o, size));
}

// ---------------------------------------------------------------- Mother in bed

/** Her bed with her in it: a hump under the quilt, and her grey head on the pillow. */
function motherInBed(): IsoModel {
  const m = bed();
  const quilt: Shader = (u, v) => {
    const cu = Math.floor(u * 4);
    const cv = Math.floor(v * 5);
    if ((u * 4) % 1 < 0.08 || (v * 5) % 1 < 0.08) return P.quiltDark;
    return (cu + cv) % 2 ? P.quilt : P.quiltLight;
  };
  // Her body under the quilt: a long hump, higher at the hip.
  m.box(0.2, 0.62, 24, 0.6, 1.1, 4, { top: quilt, left: P.quiltDark, right: P.quiltDark });
  m.box(0.26, 0.9, 28, 0.48, 0.5, 2, { top: quilt, left: P.quiltDark, right: P.quiltDark });
  // Her head on the pillow, turned to the room: grey hair and a pale cheek.
  m.box(0.34, 0.26, 28, 0.32, 0.32, 5, {
    top: (u, v) => (u + v < 0.9 ? P.hairGrey : P.hairGreyLight),
    left: (u, v) => (v < 0.4 || u < 0.25 ? P.hairGrey : u > 0.7 ? P.skinPaleShade : P.skinPale),
    right: P.hairGreyDark,
  });
  // Her hand on the quilt.
  m.box(0.6, 0.72, 28, 0.12, 0.12, 2, { top: P.skinPale, left: P.skinPaleShade, right: P.skinPaleShade });
  return m;
}

// ---------------------------------------------------------------- the ruined room

/** Her bed after the raid: burnt, the quilt torn half off, blood on the pillow. */
function ruinedBed(): IsoModel {
  const m = new IsoModel();
  const wood = { top: P.barkLight, left: lipped(P.bark, P.barkLight), right: P.barkDark };
  m.box(0, 0, 0, 1, 0.12, 42, wood);
  m.box(0.04, 0.12, 4, 0.92, 1.82, 12, wood);
  m.box(0.08, 0.14, 16, 0.84, 1.76, 6, {
    top: (u, v) => (Math.hypot(u - 0.5, v - 0.2) < 0.16 ? BLOOD : hash(Math.floor(u * 20), Math.floor(v * 30)) < 0.08 ? P.strawDark : P.linen),
    left: P.linenDark,
    right: P.linenDark,
  });
  // The pillow, stained, and the quilt dragged towards the floor.
  m.box(0.16, 0.2, 22, 0.68, 0.36, 5, { top: (u, v) => (Math.hypot(u - 0.6, v - 0.5) < 0.3 ? BLOOD_LIGHT : P.flowerWhite), left: P.linen, right: P.linenDark });
  m.quad({ x: 0.06, y: 1.2, z: 22 }, { x: 0.88, y: 0, z: 0 }, { x: 0, y: 0.8, z: -20 }, (u, v) => {
    if (v > 0.75 + Math.sin(u * 19) * 0.12) return null;
    return (Math.floor(u * 4) + Math.floor(v * 4)) % 2 ? P.quilt : P.quiltLight;
  });
  m.box(0, 1.88, 0, 1, 0.12, 26, wood);
  return burnt(m, 301, { amount: 0.4, embers: false });
}

/** The table, one end smashed down to the floor, its top split. */
function brokenTable(): IsoModel {
  const m = new IsoModel();
  const leg = { top: P.bark, left: P.bark, right: P.barkDark };
  // Two legs still standing at the back; the front ones snapped off.
  m.box(0.12, 0.12, 0, 0.1, 0.1, 26, leg);
  m.box(1.78, 0.12, 0, 0.1, 0.1, 26, leg);
  m.box(1.0, 0.8, 0, 0.1, 0.5, 4, leg);
  // The top, tipped down onto the floor at the front.
  const top = planks(3, P.plankLight, P.plank, P.plankLight, 4);
  m.quad({ x: 0, y: 0, z: 30 }, { x: 2, y: 0, z: 0 }, { x: 0, y: 1, z: -27 }, (u, v) => (Math.abs(u - 0.62 - v * 0.08) < 0.02 ? null : top(u, v)));
  m.quad({ x: 0, y: 1, z: 3 }, { x: 2, y: 0, z: 0 }, { x: 0, y: 0, z: -3 }, P.plankDark);
  // The bowl, broken on the floor beside it.
  m.box(0.5, 1.2, 0, 0.18, 0.12, 2, { top: P.stoneLight, left: P.stone, right: P.mortar });
  m.box(0.8, 1.3, 0, 0.12, 0.1, 2, { top: P.stoneLight, left: P.stone, right: P.mortar });
  return burnt(m, 311, { amount: 0.35 });
}

/** A stool knocked over on its side. */
function fallenStool(): IsoModel {
  const m = new IsoModel();
  // The seat, upright on its edge, and the legs sticking out across the floor.
  m.quad({ x: 0.3, y: 0.3, z: 16 }, { x: 0, y: 0.5, z: 0 }, { x: 0, y: 0, z: -16 }, (u, v) => {
    const d = Math.hypot(u - 0.5, v - 0.5);
    return d > 0.5 ? null : d > 0.42 ? P.plankDark : P.plank;
  });
  for (const [y, z] of [[0.4, 4], [0.7, 4], [0.4, 11], [0.7, 11]]) m.box(0.34, y, z, 0.5, 0.06, 1.4, { top: P.bark, left: P.bark, right: P.barkDark });
  return burnt(m, 321, { amount: 0.3 });
}

/** The cupboard ransacked: doors hanging open, the shelves swept bare. */
function ransackedCupboard(): IsoModel {
  const m = new IsoModel();
  const front: Shader = (u, v) => {
    const x = u * 32;
    const y = v * 64;
    if (x < 2 || x > 30 || y < 3) return P.barkDark;
    if (y < 34) return Math.floor(y) % 11 < 2 ? P.plankLight : P.ink;
    // The doors torn away: the empty inside, one hinge left hanging.
    if (Math.abs(x - 4) < 1 && Math.abs(y - 40) < 1.5) return P.iron;
    return P.ink;
  };
  m.box(0.05, 0, 0, 0.9, 0.5, 64, { top: P.plankLight, left: front, right: P.plankDark });
  // One door, wrenched off and leaning against the front.
  m.quad({ x: 0.1, y: 0.64, z: 26 }, { x: 0.42, y: 0, z: 0 }, { x: 0, y: 0.16, z: -26 }, (u) => (u < 0.1 ? P.barkDark : P.plank));
  return burnt(m, 331, { amount: 0.45, holes: 0.3 });
}

/** The barrels: one burnt, the other smashed open, its staves spilled across the floor. */
function smashedBarrels(): IsoModel {
  const m = barrels();
  for (let i = 0; i < 5; i++) {
    const x = 0.1 + i * 0.16;
    m.quad({ x, y: 0.6 + (i % 2) * 0.12, z: 1 }, { x: 0.1, y: 0.3, z: 0 }, { x: 0.05, y: 0, z: 0 }, (u) => (u < 0.5 ? P.bark : P.barkDark));
  }
  return burnt(m, 341, { amount: 0.4 });
}

/** The chest, its lid torn back and its hasp broken, empty. */
function brokenChest(): IsoModel {
  const m = new IsoModel();
  const band: Shader = (u, v) => {
    if (Math.abs(u - 0.2) < 0.05 || Math.abs(u - 0.8) < 0.05) return P.iron;
    return v < 0.32 ? P.leatherLight : P.leather;
  };
  // The lid, flung back upright behind it.
  m.quad({ x: 0.1, y: 0.2, z: 34 }, { x: 0.8, y: 0, z: 0 }, { x: 0, y: 0.04, z: -14 }, band);
  m.box(0.1, 0.2, 0, 0.8, 0.6, 16, { top: (u, v) => (u > 0.06 && u < 0.94 && v > 0.08 && v < 0.92 ? P.ink : P.leatherLight), left: band, right: P.leatherDark });
  return burnt(m, 351, { amount: 0.3 });
}

/** The hearth gone cold: ash and blackened logs in the firebox. */
function coldHearth(): IsoModel {
  const m = hearth();
  m.box(0.45, 0.45, 0, 1.1, 0.3, 3, { top: (u, v) => (hash(Math.floor(u * 20), Math.floor(v * 8)) < 0.3 ? P.ashLight : P.ash), left: P.ashDark, right: P.ashDark });
  m.box(0.6, 0.55, 3, 0.8, 0.1, 2, { top: CHAR_LIGHT, left: CHAR, right: P.ink });
  return burnt(m, 361, { amount: 0.2 });
}

/** A roof beam that came down: charred and split, lying across the floor. */
function fallenBeam(): IsoModel {
  const m = new IsoModel();
  m.quad({ x: 0.1, y: 0.3, z: 10 }, { x: 1.8, y: 0.5, z: -8 }, { x: 0, y: 0.2, z: 0 }, (u, v) => (hash(Math.floor(u * 30), Math.floor(v * 3)) < 0.2 ? P.ember : v < 0.3 ? CHAR_LIGHT : CHAR));
  m.quad({ x: 0.1, y: 0.5, z: 10 }, { x: 1.8, y: 0.5, z: -8 }, { x: 0, y: 0, z: -4 }, (u) => (u < 0.5 ? CHAR : P.ink));
  // Burnt thatch and splinters scattered round it.
  for (let i = 0; i < 9; i++) {
    const x = hash(i, 1) * 1.8;
    const y = hash(i, 2) * 0.9;
    m.box(x, y, 0, 0.12, 0.04, 1, { top: hash(i, 3) < 0.5 ? CHAR_LIGHT : P.ashDark, left: CHAR, right: P.ink });
  }
  return m;
}

// ---------------------------------------------------------------- decals (flat)

/** A flat patch on the ground, painted by `paint(u, v)` over `w` x `h` tiles from the tile's corner. */
function decal(w: number, h: number, paint: Shader): IsoModel {
  return new IsoModel().quad({ x: 0, y: 0, z: 0 }, { x: w, y: 0, z: 0 }, { x: 0, y: h, z: 0 }, paint);
}

/** A blot with a ragged edge: noise pushes the edge in and out. */
function blot(u: number, v: number, cx: number, cy: number, r: number, seed: number): number {
  const d = Math.hypot(u - cx, v - cy) / r;
  return d - (smoothNoise(u * 6, v * 6, seed) - 0.5) * 0.7;
}

/** A pool of blood, dark at its heart. */
const bloodPool = () =>
  decal(1, 1, (u, v) => {
    const b = blot(u, v, 0.5, 0.5, 0.36, 401);
    if (b > 1) return blot(u, v, 0.2, 0.8, 0.08, 402) < 1 || blot(u, v, 0.85, 0.3, 0.06, 403) < 1 ? BLOOD : null;
    return b < 0.5 ? BLOOD_DARK : b > 0.9 ? BLOOD_LIGHT : BLOOD;
  });

/** Blood smeared along the floor, as if something was dragged through it: along u, out of the tile towards +x. */
const bloodSmear = () =>
  decal(2, 1, (u, v) => {
    const centre = 0.5 + Math.sin(u * 5) * 0.08;
    const width = 0.2 * (1 - u * 0.6) + (smoothNoise(u * 12, v * 3, 411) - 0.5) * 0.12;
    const d = Math.abs(v - centre);
    if (d > width) return hash(Math.floor(u * 60), Math.floor(v * 30)) < 0.02 ? BLOOD : null;
    // Streaks along the drag.
    return Math.floor(v * 40) % 3 === 0 ? BLOOD_DARK : smoothNoise(u * 20, v * 4, 412) < 0.4 ? BLOOD_LIGHT : BLOOD;
  });

/** A few drops and spatters. */
const bloodDrops = () =>
  decal(1, 1, (u, v) => {
    for (let i = 0; i < 7; i++) if (Math.hypot(u - hash(i, 7), v - hash(i, 8)) < 0.03 + hash(i, 9) * 0.04) return i % 2 ? BLOOD : BLOOD_DARK;
    return null;
  });

/** A burnt patch on the floor or the ground: black at the heart, ash round the edge. */
const scorchMark = (seed: number, w = 2, h = 2) =>
  decal(w, h, (u, v) => {
    const b = blot(u, v, 0.5, 0.5, 0.42, seed);
    if (b > 1.05) return null;
    if (b > 0.85) return hash(Math.floor(u * 50), Math.floor(v * 50)) < 0.5 ? P.ashDark : null;
    if (b > 0.6) return CHAR_LIGHT;
    return hash(Math.floor(u * 40), Math.floor(v * 40)) < 0.04 ? P.ember : CHAR;
  });

/** Ash and cinders in drifts. */
const ashDrift = (seed: number) =>
  decal(1, 1, (u, v) => {
    const n = smoothNoise(u * 5, v * 5, seed);
    if (n < 0.55) return null;
    return n > 0.75 ? P.ashLight : n > 0.65 ? P.ash : P.ashDark;
  });

/** Broken crockery, splinters and spilled straw: whatever the goblins threw down. */
const debris = (seed: number) =>
  decal(1, 1, (u, v) => {
    const rnd = seededRandom(seed);
    for (let i = 0; i < 14; i++) {
      const x = rnd();
      const y = rnd();
      const kind = rnd();
      const len = 0.04 + rnd() * 0.08;
      if (Math.abs(u - x) < len && Math.abs(v - y) < 0.02) return kind < 0.3 ? P.plank : kind < 0.55 ? P.strawDark : kind < 0.75 ? P.stoneLight : CHAR;
    }
    return null;
  });

/** Crops torn up and trodden into the mud. */
const trampled = (seed: number) =>
  decal(1, 1, (u, v) => {
    const n = smoothNoise(u * 7, v * 7, seed);
    if (n < 0.35) return null;
    // Flattened leaves, a broken carrot or two, and goblin footprints.
    if (Math.floor(u * 9 + v * 3) % 4 === 0 && n > 0.6) return P.dirtDark;
    if (n > 0.82) return hash(Math.floor(u * 30), Math.floor(v * 30)) < 0.3 ? 0xd8782a : 0x4e6a2a;
    return n > 0.6 ? 0x5e7a32 : 0x3e5422;
  });

/** Feathers scattered over the ground (the goblins have had the hens). */
const feathers = (seed: number) =>
  decal(1, 1, (u, v) => {
    const rnd = seededRandom(seed);
    for (let i = 0; i < 12; i++) {
      const x = rnd();
      const y = rnd();
      const c = rnd();
      if (Math.abs(u - x) < 0.05 && Math.abs(v - y) < 0.015) return c < 0.4 ? 0xf0ece0 : c < 0.7 ? 0xa86a3a : 0x3a2a22;
    }
    return null;
  });

// ---------------------------------------------------------------- fire

export const FIRE_FRAMES = 6;

/**
 * Flames as a strip of frames: a ragged sheet of fire licking up from its base,
 * with a hot yellow heart and red tips, and sparks flying off the top.
 */
function drawFireFrame(c: PixelCanvas, w: number, h: number, frame: number, seed: number): void {
  const rnd = seededRandom(seed + frame * 97);
  const base = h - 2;
  for (let x = 2; x < w - 2; x++) {
    const across = Math.abs(x - w / 2) / (w / 2 - 2);
    const tall = (1 - across * across) * (h - 10) * (0.55 + 0.45 * smoothNoise(x * 0.35, frame * 0.9, seed));
    for (let y = 0; y < tall; y++) {
      const t = y / tall;
      const sway = Math.round(Math.sin(t * 4 + frame * 1.7 + x * 0.3) * t * 2);
      const col = t < 0.3 ? P.fireYellow : t < 0.65 ? P.fireOrange : P.fireRed;
      // Holes in the flame near the top, so it flickers rather than stands like a wall.
      if (t > 0.6 && smoothNoise(x * 0.5, y * 0.4 + frame, seed + 5) < 0.4) continue;
      c.set(x + sway, base - y, col);
    }
  }
  for (let i = 0; i < 5; i++) c.set(Math.floor(rnd() * w), Math.floor(rnd() * h * 0.4), P.ember);
}

/** Registers a sheet of flames and art keys for it standing on the ground and at heights above it (a roof). */
function generateFire(scene: Phaser.Scene, key: string, w: number, h: number, heights: Record<string, number>): void {
  const sheet = new PixelCanvas(w * FIRE_FRAMES, h);
  for (let f = 0; f < FIRE_FRAMES; f++) {
    const frame = new PixelCanvas(w, h);
    drawFireFrame(frame, w, h, f, w * 7 + h);
    sheet.blit(frame, f * w, 0);
  }
  const tex = sheet.toTexture(scene, key);
  for (let f = 0; f < FIRE_FRAMES; f++) tex.add(f, 0, f * w, 0, w, h);
  scene.anims.create({ key: `${key}-burn`, frames: [0, 1, 2, 3, 4, 5].map((frame) => ({ key, frame })), frameRate: 10, repeat: -1 });
  // The flame's base sits on the middle of its tile (a tile's middle is 16px below its corner), raised by `z`.
  for (const [name, z] of Object.entries(heights)) MODEL_ART[name] = { key, originX: 0.5, originY: (h - 2 - 16 + z) / h };
}

// ---------------------------------------------------------------- burnt copies of finished art

/** A burnt copy of an already drawn texture (a fence, the coop), under a new key with the same anchor. */
function scorchedCopy(scene: Phaser.Scene, from: string, to: string, seed: number, o: ScorchOptions): void {
  const art = MODEL_ART[from];
  if (!art) return;
  const src = scene.textures.get(art.key).getSourceImage() as HTMLCanvasElement;
  const tex = scene.textures.createCanvas(to, src.width, src.height)!;
  tex.context.drawImage(src, 0, 0);
  const img = tex.context.getImageData(0, 0, src.width, src.height);
  scorchPixels(img, seed, o, 9);
  tex.context.putImageData(img, 0, 0);
  tex.refresh();
  tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
  MODEL_ART[to] = { key: to, originX: art.originX, originY: art.originY };
}

export function generateRuin(scene: Phaser.Scene): void {
  registerModel(scene, 'furn-bed-mother', motherInBed().render());

  // The burnt room: walls charred from the top down and holed through to the sky.
  (['plain', 'window', 'door', 'shelf'] as WallKind[]).forEach((kind) => {
    for (let i = 0; i < 2; i++) {
      for (const side of ['back', 'side'] as const) {
        makeWall(scene, `wall-${side}-burnt-${kind}-${i}`, side, kind, i, (s) =>
          scorch(s, 500 + i * 7 + kind.length * 3 + (side === 'back' ? 0 : 50), { amount: 0.55, holes: 0.55, climb: 0.75, grain: 1, embers: true }, [3, WALL_HEIGHT / 12]));
      }
    }
  });
  registerModel(scene, 'furn-bed-ruined', ruinedBed().render());
  registerModel(scene, 'furn-strawbed-burnt', burnt(strawBed(), 371, { amount: 0.35 }).render());
  registerModel(scene, 'furn-table-broken', brokenTable().render());
  registerModel(scene, 'furn-stool-fallen', fallenStool().render());
  registerModel(scene, 'furn-stool-burnt', burnt(stool(), 381, { amount: 0.4 }).render());
  registerModel(scene, 'furn-cupboard-ransacked', ransackedCupboard().render());
  registerModel(scene, 'furn-barrels-smashed', smashedBarrels().render());
  registerModel(scene, 'furn-chest-broken', brokenChest().render());
  registerModel(scene, 'furn-rug-burnt', burnt(rug(), 391, { amount: 0.55, holes: 0.7 }, [8, 6]).render(false));
  registerModel(scene, 'furn-hearth-cold', coldHearth().render());
  registerModel(scene, 'ruin-beam', fallenBeam().render());
  registerModel(scene, 'furn-chest-burnt', burnt(chest(), 395, { amount: 0.4 }).render());
  registerModel(scene, 'furn-cupboard-burnt', burnt(cupboard(), 397, { amount: 0.4 }).render());

  // Flat things on the floor and the ground.
  registerModel(scene, 'decal-blood-pool', bloodPool().render(false));
  registerModel(scene, 'decal-blood-smear', bloodSmear().render(false));
  registerModel(scene, 'decal-blood-drops', bloodDrops().render(false));
  for (let i = 0; i < 3; i++) {
    registerModel(scene, `decal-scorch-${i}`, scorchMark(420 + i).render(false));
    registerModel(scene, `decal-ash-${i}`, ashDrift(430 + i).render(false));
    registerModel(scene, `decal-debris-${i}`, debris(440 + i).render(false));
    registerModel(scene, `decal-trampled-${i}`, trampled(450 + i).render(false));
    registerModel(scene, `decal-feathers-${i}`, feathers(460 + i).render(false));
  }

  // Fires: on the ground, and up on a roof or the top of a coop.
  generateFire(scene, 'fire-big', 40, 60, { 'fire-ground': 0, 'fire-roof': 78, 'fire-low': 22 });
  generateFire(scene, 'fire-small', 22, 30, { 'fire-small': 0, 'fire-small-roof': 60, 'fire-small-low': 18 });

  // The farm, scorched: the coop, the hut, the trough, and every shape of fence.
  scorchedCopy(scene, 'farm-coop', 'farm-coop-burnt', 471, { amount: 0.7, holes: 0.6, climb: 0.5, embers: true });
  scorchedCopy(scene, 'farm-trough', 'farm-trough-burnt', 472, { amount: 0.3 });
  scorchedCopy(scene, 'bld-hut', 'bld-hut-scorched', 473, { amount: 0.22, climb: 0.25 });
  for (const mask of FENCE_MASKS) scorchedCopy(scene, fenceKey(mask), `${fenceKey(mask)}-burnt`, 480 + mask, { amount: 0.55, holes: 0.35, climb: 0.4 });
}
