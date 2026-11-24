import { box, circle } from './Collision';
import { MOTHER_AT, MOTHER_PALLET, ORB, ORB_TAKE } from './landmarks';
import { CreatureSpawn, MapData, MapObject, placeObject, Prop, Terrain } from './MapData';

export const BROODHALL_W = 26;
export const BROODHALL_H = 28;
/** The back-wall segment with the passage back up to the warren in it. */
export const BROODHALL_UP_X = 4;
export interface BroodHallState {
  /** Mother is gone, and the hero is carrying her out (see scenes/game/warren.ts). */
  motherDead?: boolean;
  /** The hero has taken the dark orb off its plinth. */
  orbTaken?: boolean;
}

/** The Brute who keeps the way into the hall, and the two at his side. */
const KEEPERS: CreatureSpawn[] = [
  { id: 'bh-brute', kind: 'goblinbrute', gx: 12.5, gy: 7.6, notice: 7.5 },
  { id: 'bh-keeper-0', kind: 'goblin', gx: 9.8, gy: 6.4, notice: 7.5 },
  { id: 'bh-keeper-1', kind: 'goblinspear', gx: 15.4, gy: 7.2, notice: 7.5 },
];
/** Everyone between the hero and Mother. */
export const BROODHALL_KEEPERS = KEEPERS.map((c) => c.id);

/**
 * The brood hall, at the bottom of the goblins' warren under the Greyfells: hot,
 * close and stinking, lit by braziers and by the orb. The passage down from the
 * upper tunnels (WarrenMap) comes out in an antechamber, where the Brute who led
 * the raid on the Hollow keeps the only way on, a gap in a wall of rock. Past it
 * is the hall itself, and the brood-mother, too big to have come in by any way
 * there is now: they must have dug the hall round her. She is dying. Her eggs
 * lie about the floor in clutches. By her head, on a heap of furs, is Mother;
 * on her other side the orb on its plinth, with the shaman crouched before it.
 */
export function buildBroodHallMap(state: BroodHallState = {}): MapData {
  const W = BROODHALL_W;
  const H = BROODHALL_H;
  const terrain: Terrain[][] = [];
  const props: Prop[][] = [];
  for (let y = 0; y < H; y++) {
    terrain.push(new Array(W).fill(Terrain.Cave));
    props.push(new Array(W).fill(Prop.None));
  }
  const up = { x: BROODHALL_UP_X + 0.5, y: 1.6 };
  const data: MapData = {
    width: W,
    height: H,
    terrain,
    props,
    spawn: up,
    indoor: true,
    underground: true,
    music: 'cave',
    walls: {
      back: Array.from({ length: W }, (_, i) => (i === BROODHALL_UP_X ? 'cave-wall-back-door' : `cave-wall-back-${(i * 3 + 2) % 4}`)),
      side: Array.from({ length: H }, (_, i) => `cave-wall-side-${(i * 5 + 1) % 4}`),
      corner: 'cave-corner',
      height: 120,
    },
    doors: [
      {
        id: 'broodhall-up', tx: BROODHALL_UP_X, ty: 0, to: 'warren', entry: 'down', label: 'Go back up', facing: 'front',
        ask: state.motherDead ? 'Do you want to carry Mother back up into the warren?' : 'Do you want to go back up to the tunnels?',
      },
    ],
    entries: { stair: up },
    lights: [],
    creatures: state.motherDead ? [] : [...KEEPERS],
    npcs: [],
    sights: [],
    drips: [],
    landmarks: [
      { gx: 8, gy: 5, name: 'The antechamber', range: 7 },
      { gx: 12.5, gy: 19, name: 'The brood hall', range: 10 },
    ],
  };

  const add = (key: string, tx: number, ty: number, extra: Partial<MapObject> = {}) => placeObject(data, { key, tx, ty, w: 1, h: 1, ...extra });
  const rock = (tx: number, ty: number) => {
    if (props[ty]?.[tx] !== Prop.None) return;
    add(`cave-rockwall-${(tx * 5 + ty * 3) % 4}`, tx, ty, { fades: true });
  };
  const boulder = (tx: number, ty: number) => {
    if (props[ty]?.[tx] !== Prop.None) return;
    add(`cave-boulder-${(tx + ty) % 3}`, tx, ty, { shapes: [circle(0.5, 0.5, 0.42)] });
  };
  const fire = (tx: number, ty: number, radius = 150) => {
    add('nwt-firering', tx, ty, { shapes: [circle(0.5, 0.5, 0.4)] });
    add('fire-small', tx, ty, { anim: 'fire-small-burn' });
    data.lights!.push({ gx: tx + 0.5, gy: ty + 0.5, z: 12, radius, flicker: 1 });
  };

  // ---- The antechamber, and the wall with the one way through ----
  for (let x = 0; x < W; x++) if (x < 11 || x > 13) rock(x, 10);
  // The antechamber is narrower than the hall: rock fills its far end.
  for (let y = 0; y < 10; y++) for (let x = 19; x < W; x++) if (x > 19 || y % 2 === 0) rock(x, y);
  fire(7, 3, 160);
  fire(15, 4, 150);
  add('cave-bones-0', 11, 5, { flat: true });
  add('cave-bones-1', 13, 8, { flat: true });
  add('cave-bones-0', 16, 2, { flat: true });
  add('nw-trampled-1', 12, 7, { flat: true });
  add('cave-stalagmites-0', 2, 7, { shapes: [circle(0.5, 0.55, 0.3)] });
  data.sights!.push({
    id: 'bh-bones', gx: 11.5, gy: 5.5, label: 'Look at the bones', z: 6,
    thought: 'Sheep bones, mostly, cracked for the marrow. Not all of them. I will not look closer.',
  });

  // ---- The hall ----
  // The brood-mother, filling the middle of it, breathing.
  placeObject(data, {
    key: 'bh-broodmother', tx: 9, ty: 17, w: 5, h: 4, anim: 'bh-broodmother-breathe',
    shapes: [box(0, 0.4, 5, 3.6)],
  });
  data.sights!.push({
    id: 'bh-broodmother', gx: 13.6, gy: 17.6, label: 'Look at her', z: 60,
    thought: state.motherDead
      ? 'She is still breathing, slow as the sea. She does not know, or care, what has happened in her hall.'
      : 'Their Mother. The great one, from the picture on the stone. She is bigger than the cottage, swollen past any shape, and every breath ' +
        'rattles. She is dying too. That is what they wanted ours for.',
  });
  // Her eggs, in clutches about the floor.
  for (const [tx, ty, v] of [[7, 22, 0], [9, 23, 2], [13, 23, 1], [6, 18, 1], [15, 22, 0], [8, 15, 2], [11, 14, 0], [5, 20, 2]]) {
    add(`bh-eggs-${v}`, tx, ty, { shapes: [circle(0.5, 0.5, 0.36)] });
  }
  data.sights!.push({
    id: 'bh-eggs', gx: 9.5, gy: 23.5, label: 'Look at the eggs', z: 10,
    thought: 'Eggs, leathery and warm, as big as my head. Some of them are moving. Hundreds more where these came from, if she lives.',
  });
  // Mother, on her furs by the brood-mother's head.
  placeObject(data, { key: state.motherDead ? 'bh-pallet' : 'bh-pallet-mother', tx: MOTHER_PALLET.tx, ty: MOTHER_PALLET.ty, w: 2, h: 1, shapes: [box(0.1, 0.2, 1.9, 0.8)] });
  if (!state.motherDead) data.npcs!.push({ id: 'mother-dying', gx: MOTHER_AT.x, gy: MOTHER_AT.y, looking: { x: 0, y: 1 } });
  // The orb on its plinth, and the shaman crouched before it.
  const orbArt = !state.motherDead ? 'bh-orb' : state.orbTaken ? 'bh-plinth' : 'bh-orb-dark';
  add(orbArt, ORB.tx, ORB.ty, { anim: state.motherDead ? undefined : 'bh-orb-swirl', shapes: [circle(0.5, 0.5, 0.32)] });
  if (!state.motherDead) {
    data.lights!.push({ gx: ORB.tx + 0.5, gy: ORB.ty + 0.5, z: 34, radius: 150, flicker: 0.3 });
    data.npcs!.push({ id: 'shaman', gx: ORB.tx + 1.6, gy: ORB.ty + 1.2, looking: { x: -1, y: -1 } });
  }
  if (state.motherDead && !state.orbTaken) data.sights!.push({ ...ORB_TAKE });
  else {
    data.sights!.push({
      id: 'bh-orb', gx: ORB.tx + 0.5, gy: ORB.ty + 0.5, label: state.orbTaken ? 'Look at the plinth' : 'Look at the orb', z: 34,
      thought: state.orbTaken
        ? 'Bone claws, holding nothing. What they held is in my pack now.'
        : 'A ball of glass held up in bone claws, with smoke turning inside it, lit from within. It is not goblin work. Nothing about it is.',
    });
  }
  // Braziers round the walls of the hall.
  fire(3, 13, 170);
  fire(21, 14, 160);
  fire(4, 25, 150);
  fire(19, 25, 150);
  // Holes at the far end of the hall, where the rest of them live.
  for (const [tx, ty] of [[24, 25], [25, 21], [22, 27]]) add('cave-bones-1', tx, ty, { flat: true });
  for (const [tx, ty, v] of [[2, 16, 0], [23, 12, 1], [16, 26, 0]]) add(`cave-stalagmites-${v}`, tx, ty, { shapes: [circle(0.5, 0.55, 0.3)] });
  for (const [tx, ty, v] of [[6, 12, 0], [18, 17, 1], [10, 25, 0]]) {
    add(`cave-stalactites-${v}`, tx, ty, { overhead: true, blocks: [] });
    data.drips!.push({ gx: tx + 0.5, gy: ty + 0.5, z: v === 0 ? 118 : 108 });
  }
  for (let x = 1; x < W; x += 3) boulder(x, H - 1);
  for (let y = 12; y < H; y += 3) boulder(W - 1, y);
  return data;
}
