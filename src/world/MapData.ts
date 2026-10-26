import type { TrackName } from '../audio/Audio';
import type { FoeKind } from '../systems/Combat';
import type { CropKind } from '../systems/Farm';
import type { Shape } from './Collision';

export enum Terrain {
  Grass,
  Dirt,
  Stone,
  Water,
  Sand,
  Floor,
  /** Tilled garden soil. */
  Soil,
  /** The gravelly rock floor of a cave. */
  Cave,
}

export enum Prop {
  None,
  Tree,
  Rock,
  /** A tile covered by a building or furniture (see MapData.objects). */
  Blocked,
}

/** The places the player can be. Each is its own map; doors lead between them. */
export type AreaId = 'home' | 'world' | 'market' | 'cave';

/**
 * A building or piece of furniture standing on the grid. Its art (see
 * art/interior.ts) is anchored at the object's back corner (tx, ty).
 */
export interface MapObject {
  key: string;
  tx: number;
  ty: number;
  /** Footprint in tiles, along x and y. */
  w: number;
  h: number;
  /** Painted flat into the floor (rugs, mats) instead of standing up. */
  flat?: boolean;
  /** Mirror the art, which swaps which wall it backs onto. */
  flipX?: boolean;
  /** Animation to play on it (e.g. the hearth's fire). */
  anim?: string;
  /** Hangs high overhead (stalactites), so it's drawn in front of anyone walking beneath it. */
  overhead?: boolean;
  /** Tiles it blocks, if not its whole footprint (relative to tx, ty). */
  blocks?: Array<[number, number]>;
  /**
   * Its outline for collisions (relative to tx, ty), if it's slimmer than the
   * tiles it blocks, like a fence. Each shape must lie inside one tile.
   */
  shapes?: Shape[];
}

/**
 * A way to another area: a door the player uses with E, or (when `auto`) the
 * end of a road at the map's edge, which the player just walks off.
 */
export interface Door {
  tx: number;
  ty: number;
  to: AreaId;
  /** Entry point name in the destination's MapData.entries. */
  entry: string;
  /** Taken by walking onto the tile, with no prompt: a road leading off the map. */
  auto?: boolean;
  /** What the prompt says, if not "Go inside" / "Go outside". */
  label?: string;
  /**
   * Whether it's in a wall along the tile's -x edge (the cottage's doors, which
   * have their prompt there) or opens towards the viewer (the cave mouth).
   */
  facing?: 'wall' | 'front';
}

/** Something to look at closely (the lost ewes in the cave). GameScene decides what examining it does. */
export interface Sight {
  id: string;
  gx: number;
  gy: number;
  label: string;
  /** Height of the prompt above the ground, in pixels. */
  z: number;
}

/** A warm light source that brightens its surroundings in the dark. */
export interface LightSource {
  gx: number;
  gy: number;
  /** Height above the floor in pixels, so lights on the hearth sit at the flames. */
  z: number;
  radius: number;
  /** 0 = steady, 1 = flickers like fire. */
  flicker: number;
}

/** A tile of vegetables that can be picked (see systems/Farm.ts). */
export interface CropPatch {
  tx: number;
  ty: number;
  kind: CropKind;
}

/** Somewhere to sit: a bench or stool. The player sits at (gx, gy) facing (faceX, faceY). */
export interface Seat {
  gx: number;
  gy: number;
  faceX: number;
  faceY: number;
  /** Where to stand when getting up. */
  standX: number;
  standY: number;
  name: string;
}

export interface NpcSpawn {
  id: string;
  gx: number;
  gy: number;
}

/** A wild animal that roams near where it starts (see entities/Creature.ts). */
export interface CreatureSpawn {
  /** Remembered once it's beaten, so it stays gone. */
  id: string;
  kind: FoeKind;
  gx: number;
  gy: number;
}

export interface MapData {
  width: number;
  height: number;
  terrain: Terrain[][]; // [y][x]
  props: Prop[][]; // [y][x]
  spawn: { x: number; y: number };
  objects?: MapObject[];
  /** Back walls of an indoor room: texture keys along y = 0 (back) and x = 0 (side), the corner post, and their height. */
  walls?: { back: string[]; side: string[]; corner?: string; height?: number };
  doors?: Door[];
  /** Named arrival points, in tile units. */
  entries?: Record<string, { x: number; y: number }>;
  lights?: LightSource[];
  npcs?: NpcSpawn[];
  crops?: CropPatch[];
  seats?: Seat[];
  creatures?: CreatureSpawn[];
  sights?: Sight[];
  /** Where water drips from overhead (stalactite tips): grid position and height in pixels. */
  drips?: Array<{ gx: number; gy: number; z: number }>;
  /** Chimney tops that smoke: grid position and height in pixels. */
  chimneys?: Array<{ gx: number; gy: number; z: number }>;
  /** Road tiles in order from one end to the other, for travellers to wander along. */
  road?: Array<{ x: number; y: number }>;
  /** Indoors: no minimap, and lit by the fire rather than the sky. */
  indoor?: boolean;
  /** Underground (with `indoor`): dark whatever the hour, so the hero's lantern is lit. */
  underground?: boolean;
  /** The music for the area (see audio/Audio.ts). */
  music?: TrackName;
}

export const TERRAIN_WALKABLE: Record<Terrain, boolean> = {
  [Terrain.Grass]: true,
  [Terrain.Dirt]: true,
  [Terrain.Stone]: true,
  [Terrain.Water]: false,
  [Terrain.Sand]: true,
  [Terrain.Floor]: true,
  [Terrain.Soil]: true,
  [Terrain.Cave]: true,
};

/** Marks every tile an object covers as blocked (or just the ones it lists). */
export function placeObject(data: MapData, obj: MapObject): void {
  (data.objects ??= []).push(obj);
  if (obj.flat) return;
  const tiles: Array<[number, number]> = obj.blocks ?? [];
  if (!obj.blocks) {
    for (let y = 0; y < obj.h; y++) for (let x = 0; x < obj.w; x++) tiles.push([x, y]);
  }
  for (const [x, y] of tiles) {
    const tx = obj.tx + x;
    const ty = obj.ty + y;
    if (ty >= 0 && ty < data.height && tx >= 0 && tx < data.width) data.props[ty][tx] = Prop.Blocked;
  }
}
