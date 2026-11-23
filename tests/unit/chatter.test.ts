import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('phaser', async () => (await import('./maps')).phaserMock());
import { ARRIVALS, ChatterContext, chatterThatFits, TRAVEL } from '../../src/dialogue/companionChatter';
import { chooseChatter, resetChatter } from '../../src/scenes/game/chatter';
import { COMPANION_IDS } from '../../src/systems/Companions';
import { SaveGame } from '../../src/systems/SaveGame';

const ctx = (over: Partial<ChatterContext> = {}): ChatterContext => ({
  area: 'northwoods', hour: 13, weather: 'clear', cold: false, indoor: false, underground: false,
  heroHealth: 1, party: ['sigrun'], motherMissing: false, gateComing: false, ...over,
});

beforeEach(() => resetChatter());

describe('companion chatter', () => {
  it('only has someone say what they would, about what is happening', () => {
    const lines = chatterThatFits(ctx({ party: ['wat'], weather: 'rain' }));
    expect(lines.every((l) => l.who === 'wat' && !l.reply)).toBe(true);
    expect(lines.map((l) => l.id)).toContain('w-rain');
    expect(chatterThatFits(ctx({ party: ['wat'], weather: 'rain', indoor: true })).map((l) => l.id)).not.toContain('w-rain');
  });

  it('lets the two talk to each other only when both are along', () => {
    expect(chatterThatFits(ctx()).some((l) => l.reply)).toBe(false);
    expect(chatterThatFits(ctx({ party: ['sigrun', 'wat'] })).some((l) => l.reply)).toBe(true);
  });

  it('speaks up first about a beast close by', () => {
    const line = chooseChatter(ctx({ party: ['sigrun', 'wat'], beastNear: 'wolf' }), () => 0);
    expect(line?.urgent).toBe(true);
    expect(line?.text).toMatch(/wolf/i);
  });

  it('has something for the cold up on the fells', () => {
    expect(chatterThatFits(ctx({ area: 'greyfells', cold: true })).map((l) => l.id)).toContain('s-cold');
    for (const id of COMPANION_IDS) expect(ARRIVALS.greyfells?.[id]?.[0]).toMatch(/cold|freez/i);
  });

  it('gives each line its own name', () => {
    const ids = TRAVEL.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('remembers with the save which once-only lines were said', () => {
    const saved = JSON.parse(JSON.stringify(SaveGame.collect()));
    expect(saved.chatter).toEqual([]);
  });
});
