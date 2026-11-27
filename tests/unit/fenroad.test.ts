import { describe, expect, it, vi } from 'vitest';
import type { DialogueScript } from '../../src/dialogue/Dialogue';

vi.mock('phaser', async () => (await import('./maps')).phaserMock());

const { edricWreckTalk, gammerScript, voskFenTalk } = await import('../../src/dialogue/fenroad');
const { voskScript } = await import('../../src/dialogue/gloomhaven');
const { edricScript } = await import('../../src/dialogue/guildhall');
const { buildFenRoadMap } = await import('../../src/world/FenRoadMap');
const { buildGloomhavenMap } = await import('../../src/world/GloomhavenMap');
const { FEN_WATCHER } = await import('../../src/world/landmarks');
const { Terrain } = await import('../../src/world/MapData');

/** Every choice and `next` in a script leads to a node that's there. */
function dangling(script: DialogueScript): string[] {
  const out: string[] = [];
  if (!script.nodes[script.start]) out.push(`start → ${script.start}`);
  for (const [id, node] of Object.entries(script.nodes)) {
    if (node.next && !script.nodes[node.next]) out.push(`${id} → ${node.next}`);
    for (const c of node.choices ?? []) if (c.next && !script.nodes[c.next]) out.push(`${id} → ${c.next}`);
  }
  return out;
}

const flags = [false, true];

describe('the Fen Road', () => {
  it("Vosk's gate talk hangs together, shut or open, whatever the hero has found", () => {
    for (const open of flags) for (const hired of flags) for (const owed of flags) for (const tracks of flags) for (const toldVosk of flags) {
      for (const first of flags) expect(dangling(voskFenTalk(voskScript(first), { open, hired, owed, tracks, toldVosk }))).toEqual([]);
    }
  });

  it("Gammer Teal's talk hangs together", () => {
    for (const first of flags) for (const hired of flags) for (const wreck of flags) for (const tracks of flags) for (const scale of flags) for (const heardWhite of flags) for (const offered of flags) {
      for (const coins of [0, 5]) expect(dangling(gammerScript({ first, hired, wreck, tracks, scale, heardWhite, offered, coins }))).toEqual([]);
    }
  });

  it("Edric's report on the wreck hangs together", () => {
    for (const edric of flags) for (const tracks of flags) for (const told of flags) for (const scale of flags) for (const punt of flags) {
      const base = edricScript({ first: false, hired: true, heardLowe: true, garrow: true, pimLeave: false, ledger: false, edric, letters: false, marrable: false, tunstall: false }, false);
      expect(dangling(edricWreckTalk(base, { tracks, told, scale, punt, thraleHere: false }))).toEqual([]);
    }
  });

  it('leads out of the Fen Gate only once Vosk has opened it, and back in again', () => {
    expect(buildGloomhavenMap(false, false).doors?.some((d) => d.to === 'fenroad')).toBe(false);
    expect(buildGloomhavenMap(false, true).doors?.some((d) => d.to === 'fenroad')).toBe(true);
    expect(buildFenRoadMap().doors?.some((d) => d.to === 'gloomhaven')).toBe(true);
  });

  it('has open water where the watcher comes up', () => {
    const map = buildFenRoadMap();
    expect(map.terrain[Math.floor(FEN_WATCHER.y)][Math.floor(FEN_WATCHER.x)]).toBe(Terrain.Water);
  });
});
