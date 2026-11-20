import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SAVE_VERSION, SaveData, SaveGame } from '../../src/systems/SaveGame';
// Each of these registers its own save section on import.
import { Crafting, RECIPES } from '../../src/systems/Crafting';
import { Experience } from '../../src/systems/Experience';
import { Inventory } from '../../src/systems/Inventory';
import { QuestLog } from '../../src/systems/Quests';
import '../../src/systems/Farm';
import '../../src/systems/Shops';
import '../../src/systems/Tavern';
import { fakeStorage } from './helpers';

function save(sections = SaveGame.collect()): SaveData {
  return {
    version: SAVE_VERSION,
    savedAt: 1_700_000_000_000,
    savePoint: 'home-bed',
    area: 'home',
    position: { x: 4, y: 5 },
    hours: 24 * 2 + 7,
    health: 30,
    stamina: 50,
    sections,
  };
}

function newGame(): void {
  Inventory.reset();
  QuestLog.reset();
  Experience.reset();
  Crafting.reset();
}

/** Plays a little: things every section should remember. */
function play(): void {
  Inventory.add('apple', 4);
  Inventory.addCoins(10);
  QuestLog.start('chicken-feed', ['talk']);
  QuestLog.setFlag('paid-toll');
  Experience.gain(130, 'test');
  Inventory.add('raw-hare', 1);
  Inventory.add('carrot', 1);
  Inventory.add('turnip', 1);
  Crafting.make(RECIPES.find((r) => r.id === 'hare-stew')!, 1);
}

beforeEach(() => {
  vi.stubGlobal('window', { localStorage: fakeStorage() });
  newGame();
});

afterEach(() => vi.unstubAllGlobals());

describe('sections', () => {
  it('has a section for every system that remembers something', () => {
    expect(Object.keys(SaveGame.collect())).toEqual(
      expect.arrayContaining(['inventory', 'quests', 'experience', 'crafting', 'farm', 'shops', 'tavern']),
    );
  });

  it('round-trips every section through storage', () => {
    play();
    const before = SaveGame.collect();
    expect(SaveGame.write(save(before))).toBe(true);
    newGame();
    const loaded = SaveGame.read()!;
    expect(loaded).toBeDefined();
    SaveGame.restore(loaded);
    expect(SaveGame.collect()).toEqual(before);
    expect(Inventory.count('hare-stew')).toBe(RECIPES.find((r) => r.id === 'hare-stew')!.yields);
    expect(QuestLog.hasFlag('paid-toll')).toBe(true);
    expect(Experience.level).toBe(2);
  });

  it('starts a section fresh when an old save has no entry for it', () => {
    play();
    const sections = SaveGame.collect();
    delete sections.crafting;
    delete sections.experience;
    delete sections.quests;
    SaveGame.restore(save(sections));
    expect(Experience.xp).toBe(0);
    expect(QuestLog.all).toHaveLength(0);
    expect(Crafting.toSave()).toEqual({ made: [] });
    // The sections that were there still load.
    expect(Inventory.count('apple')).toBe(4);
  });
});

describe('storage', () => {
  it('tells listeners when the game is saved', () => {
    const seen: SaveData[] = [];
    const off = SaveGame.onSave((s) => seen.push(s));
    const s = save();
    SaveGame.write(s);
    off();
    expect(seen).toEqual([s]);
  });

  it('returns false when storage is blocked, but keeps the save in memory', () => {
    vi.stubGlobal('window', { localStorage: fakeStorage({ blocked: true }) });
    const s = save();
    expect(SaveGame.write(s)).toBe(false);
    expect(SaveGame.read()).toBe(s);
  });

  it('ignores saves from a newer version or for an unknown area', () => {
    const storage = fakeStorage();
    vi.stubGlobal('window', { localStorage: storage });
    // Forget the one kept in memory by the earlier tests.
    (SaveGame as unknown as { latest?: SaveData }).latest = undefined;
    storage.setItem('eldermoor.save', JSON.stringify({ ...save(), version: SAVE_VERSION + 1 }));
    expect(SaveGame.read()).toBeUndefined();
    storage.setItem('eldermoor.save', JSON.stringify({ ...save(), area: 'atlantis' }));
    expect(SaveGame.read()).toBeUndefined();
    storage.setItem('eldermoor.save', '{not json');
    expect(SaveGame.read()).toBeUndefined();
  });

  it('describes a save for the menus', () => {
    expect(SaveGame.describe(save())).toBe('Day 3, 07:00  ·  The cottage');
  });
});
