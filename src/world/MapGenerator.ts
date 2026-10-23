import Phaser from 'phaser';
import { MapData, Prop, Terrain } from './MapData';

/**
 * Placeholder procedural map: a village square, a lake, a winding road and
 * scattered forest. Swap this out for hand-made maps (e.g. Tiled JSON) later;
 * anything that produces a MapData works with the rest of the game.
 */
export function generateMap(width: number, height: number, seed: string): MapData {
  const rnd = new Phaser.Math.RandomDataGenerator([seed]);
  const terrain: Terrain[][] = [];
  const props: Prop[][] = [];

  for (let y = 0; y < height; y++) {
    terrain.push(new Array(width).fill(Terrain.Grass));
    props.push(new Array(width).fill(Prop.None));
  }

  const cx = Math.floor(width / 2);
  const cy = Math.floor(height / 2);

  // Lake in the north-east, with a sandy shore.
  const lake = { x: width * 0.72, y: height * 0.25, r: Math.min(width, height) * 0.14 };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const wobble = Math.sin(x * 0.7) * 0.9 + Math.cos(y * 0.6) * 0.9;
      const d = Phaser.Math.Distance.Between(x, y, lake.x, lake.y) + wobble;
      if (d < lake.r) terrain[y][x] = Terrain.Water;
      else if (d < lake.r + 1.5) terrain[y][x] = Terrain.Sand;
    }
  }

  // Winding dirt road from the south-west edge to the village square.
  let rx = 0;
  let ry = height - 6;
  while (rx < cx || ry > cy) {
    for (let oy = 0; oy <= 1; oy++) {
      for (let ox = 0; ox <= 1; ox++) setIf(terrain, rx + ox, ry + oy, Terrain.Dirt);
    }
    if (rx < cx && (ry <= cy || rnd.frac() < 0.55)) rx++;
    else ry--;
  }

  // Stone village square around the spawn point.
  for (let y = cy - 3; y <= cy + 3; y++) {
    for (let x = cx - 3; x <= cx + 3; x++) setIf(terrain, x, y, Terrain.Stone);
  }

  // Forest: denser near the edges, never on roads, water or the square.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (terrain[y][x] !== Terrain.Grass) continue;
      const edge = Math.min(x, y, width - 1 - x, height - 1 - y);
      const nearSpawn = Phaser.Math.Distance.Between(x, y, cx, cy) < 6;
      if (nearSpawn) continue;
      const treeChance = edge < 3 ? 0.65 : 0.08;
      const roll = rnd.frac();
      if (roll < treeChance) props[y][x] = Prop.Tree;
      else if (roll < treeChance + 0.015) props[y][x] = Prop.Rock;
    }
  }

  return { width, height, terrain, props, spawn: { x: cx + 0.5, y: cy + 0.5 } };
}

function setIf(grid: Terrain[][], x: number, y: number, t: Terrain): void {
  if (y >= 0 && y < grid.length && x >= 0 && x < grid[0].length) grid[y][x] = t;
}
