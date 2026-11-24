import { MapData, Prop, Terrain } from './MapData';

/**
 * TEMPORARY stand-in for Gloomhaven's square, so the Black Rose has somewhere to
 * open onto until the town's own map (built in its own branch) is merged in.
 */
export function buildGloomhavenMap(): MapData {
  const W = 40;
  const H = 30;
  const terrain: Terrain[][] = [];
  const props: Prop[][] = [];
  for (let y = 0; y < H; y++) {
    terrain.push(new Array(W).fill(Terrain.Dirt));
    props.push(new Array(W).fill(Prop.None));
  }
  return {
    width: W,
    height: H,
    terrain,
    props,
    spawn: { x: 29.5, y: 20.5 },
    doors: [{ tx: 29, ty: 19, to: 'blackrose', entry: 'door', label: 'Go inside', facing: 'back' }],
    entries: { blackrose: { x: 29.5, y: 19.7 } },
  };
}
