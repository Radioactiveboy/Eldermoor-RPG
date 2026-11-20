import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', async () => (await import('./maps')).phaserMock());

const { allMaps } = await import('./maps');
const { SKIP_ABOVE, survey, surveyFile } = await import('../../tools/atlasSurvey');
const { REGIONS } = await import('../../src/world/atlas');

// (Through variables, so the type-check, which has no Node types, leaves them alone.)
const fsModule = 'node:fs';
const fs = (await import(/* @vite-ignore */ fsModule)) as { readFileSync(p: URL, e: string): string; writeFileSync(p: URL, s: string): void };
const FILE = new URL('../../src/world/atlasSurvey.ts', import.meta.url);
const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;

describe("the world map's survey of the ground", () => {
  it('is up to date with the maps (`npm run atlas` rewrites it)', async () => {
    const maps = await allMaps();
    const text = surveyFile(Object.fromEntries(REGIONS.map((r) => [r.id, survey(maps[r.id], SKIP_ABOVE[r.id])])));
    if (env.WRITE_ATLAS) fs.writeFileSync(FILE, text);
    expect(fs.readFileSync(FILE, 'utf8')).toBe(text);
  });
});
