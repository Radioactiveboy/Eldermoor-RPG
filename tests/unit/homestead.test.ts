import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('phaser', async () => (await import('./maps')).phaserMock());
vi.mock('../../src/audio/Audio', () => ({ GameAudio: {} }));

const { dawnAfter, Homestead, IMPROVEMENTS, PROJECTS, RUBBLE, STEAD_STAGES, workHours } = await import('../../src/systems/Homestead');
const { QuestLog } = await import('../../src/systems/Quests');
const { ITEMS } = await import('../../src/systems/Inventory');
const { SHOPS } = await import('../../src/systems/Shops');
const { homesteadTalk } = await import('../../src/dialogue/homestead');
const { cottageKey, homesteadWorld, pileFill, restoreStead, snapshotStead } = await import('../../src/world/Homestead');
const { generateMap } = await import('../../src/world/MapGenerator');
const { graveWorld, ruinWorld } = await import('../../src/world/GoblinRaid');
const { MAP_HEIGHT, MAP_SEED, MAP_WIDTH } = await import('../../src/config');

/** Ten o'clock on day 3, in clock hours. */
const NOW = 2 * 24 + 10;

const clearAll = () => RUBBLE.forEach((id) => Homestead.cleared.add(id));
/** Brings everything a piece of work wants. */
function bringAll(p: keyof typeof PROJECTS): void {
  for (const [what, n] of Object.entries(Homestead.missing(p))) Homestead.deliver(p, what, n);
}

/** The Hollow as it's built after the raid, with the rebuilding laid over it at `now`. */
function hollowAt(now: number, hour = 11) {
  const data = generateMap(MAP_WIDTH, MAP_HEIGHT, MAP_SEED);
  const before = snapshotStead(data);
  ruinWorld(data);
  graveWorld(data);
  homesteadWorld(data, now, hour);
  restoreStead(data, before);
  return data;
}

beforeEach(() => {
  Homestead.reset();
  QuestLog.reset();
});

describe('working hours', () => {
  it('start at the next dawn and finish at a dawn, whole days later', () => {
    expect(dawnAfter(10, 1)).toBe(30); // 10am day 1 -> 6am day 2
    expect(dawnAfter(3, 1)).toBe(6); // 3am -> this morning's dawn
    expect(workHours(NOW, 3)).toEqual({ from: 3 * 24 + 6, until: 6 * 24 + 6 });
  });
});

describe('the cottage', () => {
  it('goes from the burnt shell to a home, a stage at a time', () => {
    expect(Homestead.stage).toBe('ruin');
    expect(Homestead.open()).toEqual([]);
    clearAll();
    expect(Homestead.stage).toBe('cleared');
    expect(Homestead.open()).toEqual(['walls']);
    bringAll('walls');
    const work = Homestead.startWork('walls', NOW)!;
    expect(Homestead.stage).toBe('raising');
    expect(Homestead.working(NOW)).toBe(false);
    expect(Homestead.working(work.from + 1)).toBe(true);
    expect(Homestead.advance(work.until - 1)).toEqual([]);
    expect(Homestead.advance(work.until)).toEqual([{ kind: 'project', project: 'walls' }]);
    expect(Homestead.stage).toBe('roofed');
    expect(Homestead.open()).toEqual(['hearth']);
    bringAll('hearth');
    const hearth = Homestead.startWork('hearth', work.until)!;
    expect(hearth.until - hearth.from).toBe(48);
    Homestead.advance(hearth.until);
    expect(Homestead.stage).toBe('home');
    expect(Homestead.open()).toEqual([...IMPROVEMENTS]);
  });

  it('only takes what is still wanted, and nothing before the walls are swept', () => {
    expect(Homestead.deliver('walls', 'timber', 5)).toBe(0);
    clearAll();
    expect(Homestead.deliver('walls', 'timber', 5)).toBe(5);
    expect(Homestead.deliver('walls', 'timber', 50)).toBe(7);
    expect(Homestead.deliver('walls', 'slate', 3)).toBe(0);
    expect(Homestead.missing('walls')).toEqual({ 'thatching-reed': 16, 'iron-nails': 2 });
    expect(Homestead.startWork('walls', NOW)).toBeUndefined();
  });

  it('wants coins as well as goods for the hearth, and starts no work while other work is on', () => {
    clearAll();
    bringAll('walls');
    Homestead.startWork('walls', NOW);
    expect(Homestead.deliver('walls', 'timber', 1)).toBe(0);
    Homestead.advance(NOW + 24 * 5);
    expect(Homestead.missing('hearth').coins).toBe(PROJECTS.hearth.coins);
    Homestead.built.add('hearth');
    bringAll('well');
    bringAll('paddock');
    expect(Homestead.startWork('well', NOW)).toBeDefined();
    expect(Homestead.startWork('paddock', NOW)).toBeUndefined();
  });

  it('is kept in the save, and an odd save is tidied', () => {
    clearAll();
    bringAll('walls');
    Homestead.startWork('walls', NOW);
    Homestead.giveIran(55, NOW);
    const saved = JSON.parse(JSON.stringify(Homestead.toSave()));
    Homestead.reset();
    Homestead.fromSave(saved);
    expect(Homestead.stage).toBe('raising');
    expect(Homestead.iranGiven).toBe(55);
    expect(Homestead.steadWork).toBeDefined();
    Homestead.fromSave({ built: ['walls', 'nonsense'] as never, steadBuilt: 99, delivered: { bogus: { timber: 3 } } as never });
    expect([...Homestead.built]).toEqual(['walls']);
    expect(Homestead.steadBuilt).toBe(STEAD_STAGES.length);
  });
});

describe("Iran's stead", () => {
  it('is mended a piece at a time, as the coins come, two days a piece', () => {
    Homestead.giveIran(30, NOW);
    expect(Homestead.steadWork).toBeUndefined();
    Homestead.giveIran(10, NOW);
    const w = Homestead.steadWork!;
    expect(w.until - w.from).toBe(48);
    expect(Homestead.advance(w.until)).toEqual([{ kind: 'stead', stage: 'coop' }]);
    expect(Homestead.steadHas('coop')).toBe(true);
    expect(Homestead.steadHas('hut')).toBe(false);
  });

  it('goes straight on to the next piece if it is already paid for', () => {
    Homestead.giveIran(220, NOW);
    const done = Homestead.advance(NOW + 24 * 20);
    expect(done.map((d) => (d.kind === 'stead' ? d.stage : ''))).toEqual(['coop', 'hut', 'pen', 'barn']);
    expect(Homestead.steadWanted).toBe(0);
  });
});

describe('the goods', () => {
  it('are items the satchel holds, sold by Osric and Wren', () => {
    for (const id of ['timber', 'thatching-reed', 'iron-nails', 'dressed-stone', 'slate'] as const) {
      expect(ITEMS[id].category).toBe('Material');
      const sold = Object.values(SHOPS).some((s) => s.stock.some(([item]) => item === id));
      expect(sold, id).toBe(true);
    }
    // Everything any piece of work wants is something that exists.
    for (const def of Object.values(PROJECTS)) for (const id of Object.keys(def.needs)) expect(id in ITEMS, id).toBe(true);
  });
});

describe('the Hollow, as it stands', () => {
  it('shows nothing new before the hero takes it on', () => {
    const data = hollowAt(NOW);
    expect(data.objects!.some((o) => o.key === 'bld-cottage-burnt')).toBe(true);
    expect(data.sights!.some((s) => s.work)).toBe(false);
  });

  it('has heaps of burnt timber to drag out, then a pile, then scaffolding and workmen by day', () => {
    QuestLog.start('hearth-and-home', ['talk']);
    let data = hollowAt(NOW);
    expect(data.sights!.filter((s) => s.work === 'rubble')).toHaveLength(RUBBLE.length);
    clearAll();
    data = hollowAt(NOW);
    expect(data.objects!.some((o) => o.key === 'bld-cottage-cleared')).toBe(true);
    expect(data.sights!.some((s) => s.work === 'pile')).toBe(true);
    expect(pileFill()).toBe(0);
    Homestead.deliver('walls', 'timber', 12);
    expect(pileFill()).toBe(1);
    bringAll('walls');
    const w = Homestead.startWork('walls', NOW)!;
    // Day two, mid-morning: half thatched, with Osric and the lads about.
    data = hollowAt(w.from + 24 + 5, 11);
    expect(cottageKey(w.from + 29)).toBe('bld-cottage-raising-1');
    expect(data.npcs!.map((n) => n.id)).toEqual(expect.arrayContaining(['hs-osric', 'hs-lad-1', 'hs-lad-2']));
    // At night they've gone home.
    data = hollowAt(w.from + 24 + 16, 22);
    expect(data.npcs!.some((n) => n.id.startsWith('hs-'))).toBe(false);
  });

  it('is a home again, with its improvements and goats, and Iran has his barn and his hens', () => {
    QuestLog.start('hearth-and-home', ['talk']);
    clearAll();
    for (const p of ['walls', 'hearth', ...IMPROVEMENTS] as const) Homestead.built.add(p);
    Homestead.giveIran(220, 0);
    const data = hollowAt(24 * 30);
    const keys = new Set(data.objects!.map((o) => o.key));
    for (const k of ['bld-cottage-slate', 'hs-well', 'hs-workshop', 'hs-goatshed', 'hs-barn', 'bld-hut', 'farm-coop']) expect(keys.has(k), k).toBe(true);
    expect([...keys].some((k) => k.startsWith('hs-wall-'))).toBe(true);
    expect([...keys].some((k) => k.endsWith('-burnt'))).toBe(false);
    expect(data.goats).toHaveLength(2);
    expect(data.hens!.flock.length).toBeGreaterThan(0);
    expect(data.sights!.some((s) => s.station === 'home-bench')).toBe(true);
    expect(data.music).toBe('world');
  });
});

describe('talk', () => {
  it("has the Headman offer to start, Osric say what's wanted, and Iran take coins for his stead", () => {
    let talk = homesteadTalk();
    expect(talk.headman.ask!.map((c) => c.next)).toEqual(['hs-ready']);
    expect(talk.headman.nodes!['hs-ready'].action).toBe('hs-start');
    expect(talk['iran-hiding'].ask!.map((c) => c.next)).toEqual(['hs-stead-offer']);
    QuestLog.start('hearth-and-home', ['talk']);
    QuestLog.complete('hearth-and-home', 'clear');
    talk = homesteadTalk();
    expect(talk.smith.ask!.map((c) => c.next)).toEqual(['hs-needs']);
    expect(talk.smith.nodes!['hs-needs'].action).toBe('hs-osric');
    QuestLog.start('irans-stead', ['talk']);
    talk = homesteadTalk();
    expect(talk['iran-hiding'].ask!.some((c) => c.action === 'hs-iran-give')).toBe(true);
  });
});
