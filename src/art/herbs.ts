import Phaser from 'phaser';
import type { HerbKind } from '../systems/Herbs';
import { IsoModel, Shader } from './IsoModel';
import { MODEL_ART } from './interior';

/**
 * Wild herbs for gathering (see systems/Herbs.ts and world/HerbPatches.ts):
 * yarrow, comfrey, nettles, wolfsbane and sage, each as a clump of plants
 * standing on its tile, in two crossed sheets like the herbs in the cloister
 * beds (art/abbey.ts). Each has a picked look too: cut down to a few low
 * leaves, until it grows back. Keys: 'herb-<kind>' and 'herb-<kind>-picked'.
 */

const hash = (a: number, b: number) => {
  const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return n - Math.floor(n);
};

type Shape = 'bush' | 'clump' | 'spikes' | 'umbels' | 'bells';

interface HerbLook {
  /** Height in pixels. */
  h: number;
  /** Leaf colours: dark, mid, light. */
  leaf: [number, number, number];
  /** Flower colours: main and highlight. */
  flower: [number, number];
  shape: Shape;
}

const LOOKS: Record<HerbKind, HerbLook> = {
  // Feathery low leaves, and thin stems carrying flat heads of tiny white flowers.
  yarrow: { h: 22, leaf: [0x46703a, 0x5e8a48, 0x7ea660], flower: [0xece6d0, 0xfffcf0], shape: 'umbels' },
  // Big, broad, hairy leaves, with drooping purple bells among them.
  comfrey: { h: 18, leaf: [0x2e5a2a, 0x447a38, 0x62984a], flower: [0x8a4aa0, 0xc080d0], shape: 'bells' },
  // A dark, upright patch of nettles with jagged leaves.
  nettle: { h: 20, leaf: [0x264a24, 0x386430, 0x4e8040], flower: [0x8aa868, 0xa8c080], shape: 'clump' },
  // Tall spikes of hooded violet flowers above glossy, deeply cut leaves.
  wolfsbane: { h: 28, leaf: [0x284a30, 0x3a6440, 0x548450], flower: [0x4a3aa0, 0x7a6ad8], shape: 'spikes' },
  // A soft, rounded grey-green bush with a few spires of violet flowers.
  sage: { h: 16, leaf: [0x5e6e58, 0x82927a, 0xa8b6a0], flower: [0x8a70c0, 0xb0a0e0], shape: 'bush' },
};

/** One sheet of the clump: u across, v down from the top, `picked` cut down to a few low leaves. */
function sheet(look: HerbLook, seed: number, dark: boolean, picked: boolean): Shader {
  const { leaf, flower, shape } = look;
  const leafAt = (n: number) => leaf[Math.max(0, (n < 0.35 ? 0 : n < 0.75 ? 1 : 2) - (dark ? 1 : 0))];
  return (u, v) => {
    const h = 1 - v;
    const n = hash(Math.floor(u * 18) + seed, Math.floor(v * 14));
    const edge = Math.abs(u - 0.5) * 2;
    if (picked) {
      // Stubble and a few leaves left near the ground.
      if (h > 0.32 - edge * 0.2 || edge > 0.9 || n < 0.35) return null;
      return leafAt(n);
    }
    switch (shape) {
      case 'bush': {
        if (edge ** 2 + h ** 2 * 1.1 > 1 || n < 0.1) return null;
        if (h > 0.45 && n > 0.88) return n > 0.95 ? flower[1] : flower[0];
        return leafAt(n);
      }
      case 'bells': {
        if (edge ** 2 * 0.9 + h ** 2 * 1.2 > 1 || n < 0.08) return null;
        // Broad leaves: bigger patches of one colour.
        const big = hash(Math.floor(u * 7) + seed, Math.floor(v * 5));
        if (h > 0.35 && h < 0.8 && n > 0.84) return n > 0.93 ? flower[1] : flower[0];
        return leafAt(big * 0.6 + n * 0.4);
      }
      case 'clump': {
        // Upright stems of different heights, jagged at the edges.
        const col = Math.floor(u * 9);
        const top = 0.55 + 0.45 * hash(col + seed * 3, 7);
        if (edge > 0.95 || h > top * (1 - edge * 0.35) || n < 0.14) return null;
        if (h > top * 0.7 && n > 0.9) return flower[0];
        return leafAt(n);
      }
      case 'spikes': {
        // Leafy at the bottom, then three or four tall flower spikes.
        if (h < 0.42) {
          if (edge ** 2 + (h / 0.42) ** 2 * 0.6 > 1 || n < 0.12) return null;
          return leafAt(n);
        }
        for (const [x, top] of [[0.28, 0.82], [0.5, 1], [0.7, 0.9], [0.86, 0.7]]) {
          const w = 0.07 * (1 - (h - 0.42) / (top - 0.42) * 0.5);
          if (h <= top && Math.abs(u - x) < w) {
            // Hooded flowers in tiers, with dark between them.
            const tier = Math.floor(h * 22) % 2;
            return tier ? (u < x ? flower[1] : flower[0]) : leaf[0];
          }
        }
        return null;
      }
      case 'umbels': {
        // Feathery leaves low down.
        if (h < 0.38) {
          if (edge > 0.95 || n < 0.32 || h > 0.38 - edge * 0.2) return null;
          return leafAt(n);
        }
        for (const [x, top] of [[0.3, 0.86], [0.55, 1], [0.76, 0.78]]) {
          // A flat head of flowers, and its stem.
          if (h > top - 0.14 && h <= top && Math.abs(u - x) < 0.13 * (1 - (top - h) * 2)) return n > 0.6 ? flower[1] : flower[0];
          if (h <= top - 0.14 && Math.abs(u - x) < 0.025) return leaf[1];
        }
        return null;
      }
    }
  };
}

function herb(kind: HerbKind, picked: boolean): IsoModel {
  const m = new IsoModel();
  const look = LOOKS[kind];
  const seed = kind.length * 13;
  const h = look.h;
  m.quad({ x: 0.5, y: 0.12, z: h }, { x: 0, y: 0.76, z: 0 }, { x: 0, y: 0, z: -h }, sheet(look, seed + 3, true, picked));
  m.quad({ x: 0.12, y: 0.5, z: h }, { x: 0.76, y: 0, z: 0 }, { x: 0, y: 0, z: -h }, sheet(look, seed, false, picked));
  return m;
}

function put(scene: Phaser.Scene, key: string, model: IsoModel): void {
  const r = model.render(true);
  const tex = r.canvas.toTexture(scene, key);
  MODEL_ART[key] = { key, originX: r.anchorX / tex.width, originY: r.anchorY / tex.height };
}

export function generateHerbs(scene: Phaser.Scene): void {
  for (const kind of Object.keys(LOOKS) as HerbKind[]) {
    put(scene, `herb-${kind}`, herb(kind, false));
    put(scene, `herb-${kind}-picked`, herb(kind, true));
  }
}
