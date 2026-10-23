export enum Terrain {
  Grass,
  Dirt,
  Stone,
  Water,
  Sand,
}

export enum Prop {
  None,
  Tree,
  Rock,
}

export interface MapData {
  width: number;
  height: number;
  terrain: Terrain[][]; // [y][x]
  props: Prop[][]; // [y][x]
  spawn: { x: number; y: number };
}

export const TERRAIN_WALKABLE: Record<Terrain, boolean> = {
  [Terrain.Grass]: true,
  [Terrain.Dirt]: true,
  [Terrain.Stone]: true,
  [Terrain.Water]: false,
  [Terrain.Sand]: true,
};
