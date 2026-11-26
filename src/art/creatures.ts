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
  wildcatSheet,
  wildcatSpec,
  wolfSheet,
  wolfSpec,
} from './beasts3d';
import { BRUTE_SIZE, GOBLIN_COLS, GOBLIN_RES, goblinShownSpec } from './goblins3d';
import { footpadSpec } from './wayfarers3d';
import { BRIGAND_COLS, BRIGAND_RES, brigandShownSpec, shownSpec } from './brigands3d';

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
  'wolf' | 'wolfmother' | 'deer' | 'hare' | 'boar' | 'wildcat' | 'rat' | 'footpad' | 'cutpurse' | 'goblin' | 'goblinspear' | 'goblintorch' | 'goblinbrute' | 'brigandcaptain' | 'brigandbrute' | 'brigandcutter' | 'brigandarcher' | 'apronflay' | 'apronknacker' | 'hookgaff' | 'hookbrute',
  {
    w: number;
    h: number;
    feetY: number;
    scale?: number;
    /** Drawn in 3D, in eight directions (see beasts3d.ts): 8 rows of 12 frames. */
    eight?: boolean;
    /** How tall it stands on screen, in pixels (for what's shown over its head). */
    tall?: number;
    /** How many times finer than this frame its sheet is drawn (the goblins', see goblins3d.ts): its sprite is scaled down by as much. */
    res?: number;
    /** Frames in each direction's row, if not the beasts' BEAST_COLS. */
    cols?: number;
  }
> = {
  wolf: { ...wolfSpec(1), eight: true, tall: 26 },
  // The Wolf Mother: the grey wolf, half as big again, in a coat as white as frost.
  wolfmother: { ...wolfSpec(WOLF_MOTHER_SIZE), eight: true, tall: 26 * WOLF_MOTHER_SIZE },
  deer: { ...deerSpec(), eight: true, tall: 42 },
  hare: { ...hareSpec(), eight: true, tall: 16 },
  boar: { ...boarSpec(), eight: true, tall: 24 },
  // The wild cats of the north woods.
  wildcat: { ...wildcatSpec(), eight: true, tall: 16 },
  // The rats in the Crooked Tankard's cellar.
  rat: { ...ratSpec(), eight: true, tall: 13 },
  // The footpads on the Lord's Road (their sheets are drawn in wayfarers3d.ts).
  footpad: { ...footpadSpec(), eight: true, tall: 42 },
  cutpurse: { ...footpadSpec(), eight: true, tall: 40 },
  // The goblins who raid the Hollow (their sheets are drawn in goblins3d.ts).
  // Drawn finely (GOBLIN_RES times the detail), with a fight's worth of extra frames.
  goblin: { ...goblinShownSpec('goblin'), eight: true, tall: 32, res: GOBLIN_RES, cols: GOBLIN_COLS },
  goblinspear: { ...goblinShownSpec('goblinspear'), eight: true, tall: 34, res: GOBLIN_RES, cols: GOBLIN_COLS },
  goblintorch: { ...goblinShownSpec('goblintorch'), eight: true, tall: 34, res: GOBLIN_RES, cols: GOBLIN_COLS },
  goblinbrute: { ...goblinShownSpec('goblinbrute'), eight: true, tall: 34 * BRUTE_SIZE, res: GOBLIN_RES, cols: GOBLIN_COLS },
  // The brigands in the beacon tower (their sheets are drawn finely in brigands3d.ts, with the goblins' fight frames).
  brigandcaptain: { ...brigandShownSpec('brigandcaptain'), eight: true, tall: 42, res: BRIGAND_RES, cols: BRIGAND_COLS },
  brigandbrute: { ...brigandShownSpec('brigandbrute'), eight: true, tall: 48, res: BRIGAND_RES, cols: BRIGAND_COLS },
  brigandcutter: { ...brigandShownSpec('brigandcutter'), eight: true, tall: 42, res: BRIGAND_RES, cols: BRIGAND_COLS },
  // The Red Aprons in the Shambles' pit barn (drawn as the brigands are; see art/shamblesfolk3d.ts).
  apronflay: { ...brigandShownSpec('apronflay'), eight: true, tall: 43, res: BRIGAND_RES, cols: BRIGAND_COLS },
  apronknacker: { ...brigandShownSpec('apronknacker'), eight: true, tall: 46, res: BRIGAND_RES, cols: BRIGAND_COLS },
  brigandarcher: { ...brigandShownSpec('brigandarcher'), eight: true, tall: 40, res: BRIGAND_RES, cols: BRIGAND_COLS },
  // Two of Gloomhaven's Hooks, on the brigands' frame (their sheets are drawn in pawnfolk3d.ts).
  hookgaff: { ...shownSpec(false), eight: true, tall: 42, res: BRIGAND_RES, cols: BRIGAND_COLS },
  hookbrute: { ...shownSpec(true), eight: true, tall: 48, res: BRIGAND_RES, cols: BRIGAND_COLS },
};

export function generateCreatures(scene: Phaser.Scene): void {
  generateBeast(scene, 'wolf', wolfSheet(GREY_WOLF), 9);
  generateBeast(scene, 'wolfmother', wolfSheet(WHITE_WOLF, WOLF_MOTHER_SIZE), 8);
  generateBeast(scene, 'deer', deerSheet(), 8);
  generateBeast(scene, 'hare', hareSheet(), 10);
  generateBeast(scene, 'boar', boarSheet(), 9);
  generateBeast(scene, 'rat', ratSheet(), 12);
  generateBeast(scene, 'wildcat', wildcatSheet(), 11);
}
