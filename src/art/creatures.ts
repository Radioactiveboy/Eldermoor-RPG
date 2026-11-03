import Phaser from 'phaser';
import {
  BEAST_FRAME,
  boarSheet,
  boarSpec,
  deerSheet,
  deerSpec,
  generateBeast,
  GREY_WOLF,
  hareSheet,
  hareSpec,
  ratSheet,
  ratSpec,
  WHITE_WOLF,
  wolfSheet,
  wolfSpec,
} from './beasts3d';

/**
 * The wild animals, each modelled in 3D and drawn as pixel art (see
 * beasts3d.ts): eight directions of the same twelve frames.
 */

/** Every beast's frames: 0-1 standing, 2-5 walking, 6-7 head down, then these. */
export const CREATURE_FRAME = BEAST_FRAME;
export const WOLF_FRAME = BEAST_FRAME;

/** How much bigger than a grey wolf the Wolf Mother is. */
const WOLF_MOTHER_SIZE = 1.45;

/**
 * Each beast's frame size and the pixel row its feet stand on, by kind (see
 * systems/Combat.ts FOES).
 */
export const CREATURE_ART: Record<
  'wolf' | 'wolfmother' | 'deer' | 'hare' | 'boar' | 'rat',
  {
    w: number;
    h: number;
    feetY: number;
    scale?: number;
    /** Drawn in 3D, in eight directions (see beasts3d.ts): 8 rows of 12 frames. */
    eight?: boolean;
    /** How tall it stands on screen, in pixels (for what's shown over its head). */
    tall?: number;
  }
> = {
  wolf: { ...wolfSpec(1), eight: true, tall: 26 },
  // The Wolf Mother: the grey wolf, half as big again, in a coat as white as frost.
  wolfmother: { ...wolfSpec(WOLF_MOTHER_SIZE), eight: true, tall: 26 * WOLF_MOTHER_SIZE },
  deer: { ...deerSpec(), eight: true, tall: 42 },
  hare: { ...hareSpec(), eight: true, tall: 16 },
  boar: { ...boarSpec(), eight: true, tall: 24 },
  // The rats in the Crooked Tankard's cellar.
  rat: { ...ratSpec(), eight: true, tall: 13 },
};

export function generateCreatures(scene: Phaser.Scene): void {
  generateBeast(scene, 'wolf', wolfSheet(GREY_WOLF), 9);
  generateBeast(scene, 'wolfmother', wolfSheet(WHITE_WOLF, WOLF_MOTHER_SIZE), 8);
  generateBeast(scene, 'deer', deerSheet(), 8);
  generateBeast(scene, 'hare', hareSheet(), 10);
  generateBeast(scene, 'boar', boarSheet(), 9);
  generateBeast(scene, 'rat', ratSheet(), 12);
}
