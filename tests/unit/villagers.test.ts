/// <reference types="vite/client" />
import { describe, expect, it, vi } from 'vitest';
import { DIRECTIONS_8, Model, Pose3D, renderFrame } from '../../src/art/figure3d';
import { FINE_FOLK } from '../../src/art/companions3d';
import { BRIGAND_FOLK, brigandFolkModel } from '../../src/art/brigands3d';
import { MODELS_3D } from '../../src/art/models3d';
import { motherModel } from '../../src/art/mother3d';
import { WAYFARER_MODELS } from '../../src/art/wayfarers3d';
import { CROWD_MODELS } from '../../src/art/townsfolk3d';
import { ROSE_FOLK } from '../../src/art/blackrose3d';
import { SHAMBLES_FOLK } from '../../src/art/shamblesfolk3d';
import { TOLL_FOLK } from '../../src/art/tollhouse3d';
import { GLOOM_FOLK } from '../../src/art/gloomfolk3d';
import { SUMP_FOLK } from '../../src/art/sump3d';
import type { PixelCanvas } from '../../src/art/PixelCanvas';
import npcSource from '../../src/entities/Npc.ts?raw';

// The art files import Phaser for registering textures, which needs a browser; only the models are used here.
vi.mock('phaser', () => ({ default: {} }));

/** Every 3D person, by the 'folk-<id>' texture they're registered as. */
const MODELS: Record<string, (pose: Pose3D) => Model> = {
  ...MODELS_3D, ...FINE_FOLK, ...WAYFARER_MODELS, ...ROSE_FOLK, ...SHAMBLES_FOLK, ...GLOOM_FOLK, ...TOLL_FOLK, ...SUMP_FOLK, mother: motherModel,
  ...Object.fromEntries(Object.entries(BRIGAND_FOLK).map(([id, look]) => [id, brigandFolkModel(look)])),
  ...Object.fromEntries(Object.entries(CROWD_MODELS).map(([id, m]) => [`crowd-${id}`, m])),
};

/** The textures the people in the world are drawn with, read from Npc.ts's table and the maps' children. */
function texturesInUse(): string[] {
  const keys = [...npcSource.matchAll(/texture: '(folk-[a-z-]+)'/g)].map((m) => m[1]);
  // Iran's children chatter in bubbles (entities/Child.ts), drawn as 'folk-<id>'.
  keys.push('folk-pip', 'folk-hetty');
  return [...new Set(keys)];
}

const STILL: Pose3D = { stride: 0, bob: 0 };

function pixels(c: PixelCanvas): number {
  let n = 0;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (c.get(x, y) !== null) n++;
  return n;
}

/** The fraction of pixels that differ between a frame and another one mirrored. */
function mirroredDifference(a: PixelCanvas, b: PixelCanvas): number {
  let differ = 0;
  let total = 0;
  for (let y = 0; y < a.height; y++) {
    for (let x = 0; x < a.width; x++) {
      const p = a.get(x, y);
      const q = b.get(a.width - 1 - x, y);
      if (p === null && q === null) continue;
      total++;
      if (p !== q) differ++;
    }
  }
  return differ / Math.max(1, total);
}

describe('the villagers', () => {
  it('everyone in the world has a 3D model', () => {
    const missing = texturesInUse().filter((key) => !MODELS[key.replace(/^folk-/, '')]);
    expect(missing).toEqual([]);
  });

  it('each is drawn in all eight directions, lit from the same side rather than mirrored', () => {
    for (const [id, build] of Object.entries(MODELS)) {
      const frames = DIRECTIONS_8.map((d) => renderFrame(build(STILL), d.angle));
      for (const f of frames) expect(pixels(f), `${id} has an empty frame`).toBeGreaterThan(150);
      // East (90) and west (270) are drawn apart: the light from the upper left falls on a different side.
      expect(mirroredDifference(frames[2], frames[6]), `${id}'s west is the east mirrored`).toBeGreaterThan(0.05);
    }
  });
});
