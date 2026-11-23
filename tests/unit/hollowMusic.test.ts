import { describe, expect, it, vi } from 'vitest';
import { phaserMock } from './maps';

vi.mock('phaser', () => phaserMock());
// The raid's map changes don't need the sound engine, which wants a browser.
vi.mock('../../src/audio/Audio', () => ({ GameAudio: {} }));

const { MAP_HEIGHT, MAP_SEED, MAP_WIDTH } = await import('../../src/config');
const { generateMap } = await import('../../src/world/MapGenerator');
const { raidWorld, ruinWorld } = await import('../../src/world/GoblinRaid');
const { MUSIC_FILES, musicFileFor } = await import('../../src/audio/Recordings');

describe("The Hollow's music", () => {
  it('plays the old outdoor tune before the raid and on its morning', () => {
    expect(generateMap(MAP_WIDTH, MAP_HEIGHT, MAP_SEED).music).toBe('world');
    const morning = generateMap(MAP_WIDTH, MAP_HEIGHT, MAP_SEED);
    raidWorld(morning);
    expect(morning.music).toBe('world');
  });

  it('turns to a lament once the farm is burnt, by day and by night', () => {
    const after = generateMap(MAP_WIDTH, MAP_HEIGHT, MAP_SEED);
    ruinWorld(after);
    expect(after.music).toBe('mourning');
    expect(musicFileFor(MUSIC_FILES.mourning, 12)).toBe('mourning-day');
    expect(musicFileFor(MUSIC_FILES.mourning, 23)).toBe('mourning-night');
  });
});
