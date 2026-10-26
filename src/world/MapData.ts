import type { TrackName } from '../audio/Audio';
import type { HenKind } from '../art/henfarm';
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
export type AreaId = 'home' | 'world' | 'market' | 'cave' | 'hut';

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
  /** Taken by walking onto the tile, with no E prompt: a road leading off the map. */
  auto?: boolean;
  /** What the prompt says, if not "Go inside" / "Go outside". */
  label?: string;
  /**
   * Whether it's in a wall along the tile's -x edge (the cottage's doors, which
   * have their prompt there) or opens towards the viewer (the cave mouth).
   */
  facing?: 'wall' | 'front';
  /**
   * Asked before going, e.g. "Do you want to make the trek to Adowvale Market?".
   * Saying no turns the player back the way they came.
   */
  ask?: string;
}

/**
 * Something to look at closely: the lost ewes in the cave, a signpost, a pile
 * of bones. GameScene decides what examining it does.
 */
export interface Sight {
  id: string;
  gx: number;
  gy: number;
  label: string;
  /** Height of the prompt above the ground, in pixels. */
  z: number;
  /** A signpost: reading it shows where each arm points. */
  sign?: { heading: string; lines: string[] };
  /** Can be searched once for a random find (see systems/Loot.ts). */
  loot?: 'bones';
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

/**
 * Somewhere to sleep. Sleeping passes the time and saves the game, so every
 * bed is a save point: add one to any area to make another.
 */
export interface Bed {
  /** Remembered in the save, so loading knows where the player went to sleep. */
  id: string;
  /** The tile clicking on selects it, and the point its prompt floats over. */
  tx: number;
  ty: number;
  /** Where the player must stand near to use it, and where they wake up. */
  gx: number;
  gy: number;
}

export interface NpcSpawn {
  id: string;
  gx: number;
  gy: number;
  /** A trader who keeps market hours: packs up and walks home in the evening, back in the morning. */
  commute?: Commute;
}

/** How a stallholder gets between their stall and their front door (see systems/MarketHours.ts). */
export interface Commute {
  /** Their stall, which is covered over while they're away. */
  stall: MapObject;
  /** Where they step out from behind the counter. */
  exit: { x: number; y: number };
  /** Their front door, where they go in for the night. */
  home: { x: number; y: number };
  /** Hours after the others they open and close (negative for earlier). */
  late: number;
}

/** A wild animal that roams near where it starts (see entities/Creature.ts). */
export interface CreatureSpawn {
  /** Remembered once it's beaten, so it stays gone. */
  id: string;
  kind: FoeKind;
  gx: number;
  gy: number;
}

/** A fenced run that hens stay inside, in grid units (the open ground within the fence). */
export interface HenPen {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * Children who play together and chatter in speech bubbles rather than
 * holding a conversation (see entities/Child.ts). They say hello when the
 * player comes near.
 */
export interface ChildSpawn {
  id: string;
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
  beds?: Bed[];
  creatures?: CreatureSpawn[];
  /** Hens pottering about a pen (see entities/Hen.ts). */
  hens?: { pen: HenPen; flock: Array<{ kind: HenKind; gx: number; gy: number }> };
  children?: ChildSpawn[];
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
