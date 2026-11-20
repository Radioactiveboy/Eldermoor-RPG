import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setPhaserFlags } from '../../tools/phaserFlags';
import { retry } from '../../src/systems/Download';

// The area registry and the art list pull in Phaser for registering textures; only their bookkeeping is used here.
vi.mock('phaser', () => ({ default: { Math: { Clamp: (v: number, a: number, b: number) => Math.min(b, Math.max(a, v)) } } }));
// Nor is the sound engine, which needs a browser to start.
vi.mock('../../src/audio/Audio', () => ({ GameAudio: {} }));

describe('Phaser build flags', () => {
  it('sets the flags the way Phaser’s own build does', () => {
    const code = 'if (typeof WEBGL_RENDERER) a(); if (typeof PLUGIN_CAMERA3D) b(); if (typeof PLUGIN_FBINSTANT) c(); typeof FEATURE_SOUND; typeof WEBGL_DEBUG';
    expect(setPhaserFlags(code)).toBe('if (true) a(); if (false) b(); if (false) c(); true; false');
  });

  it('leaves other typeof checks alone', () => {
    expect(setPhaserFlags("typeof window !== 'undefined' && typeof WEBGL_RENDERERS")).toBe("typeof window !== 'undefined' && typeof WEBGL_RENDERERS");
  });
});

describe('retry', () => {
  const noWait = () => Promise.resolve();

  it('returns the first success', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce('map');
    const stuck = vi.fn();
    await expect(retry(load, stuck, noWait)).resolves.toBe('map');
    expect(load).toHaveBeenCalledTimes(2);
    expect(stuck).not.toHaveBeenCalled();
  });

  it('says it is stuck after a few failures, and keeps trying', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    let calls = 0;
    const load = () => (++calls < 6 ? Promise.reject(new Error('offline')) : Promise.resolve(calls));
    const stuck = vi.fn();
    await expect(retry(load, stuck, noWait)).resolves.toBe(6);
    expect(stuck).toHaveBeenCalledTimes(1);
  });

  it('waits a little longer each time, up to five seconds', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const waits: number[] = [];
    let calls = 0;
    const load = () => (++calls < 8 ? Promise.reject(new Error('offline')) : Promise.resolve());
    await retry(load, () => undefined, (ms) => (waits.push(ms), Promise.resolve()));
    expect(waits).toEqual([500, 1000, 2000, 4000, 5000, 5000, 5000]);
  });
});

/** Just enough of a browser window for ?area= to be read. */
function fakeWindow(search = ''): void {
  vi.stubGlobal('window', { location: { search } });
}

describe('the area registry', () => {
  beforeEach(() => fakeWindow());

  it('builds a split-off area only once its map has been fetched', async () => {
    const { areaReady, buildArea, loadArea } = await import('../../src/scenes/game/areas');
    expect(areaReady('cave')).toBe(false);
    expect(() => buildArea('cave')).toThrow(/before it was loaded/);
    await loadArea('cave');
    expect(areaReady('cave')).toBe(true);
    expect(buildArea('cave').width).toBeGreaterThan(0);
  });

  it('has the Hollow in the first download, and every other area fetchable', async () => {
    const { AREAS, areaReady, loadArea } = await import('../../src/scenes/game/areas');
    expect(areaReady('world')).toBe(true);
    for (const id of Object.keys(AREAS) as Array<keyof typeof AREAS>) await loadArea(id);
    for (const id of Object.keys(AREAS) as Array<keyof typeof AREAS>) expect(areaReady(id)).toBe(true);
  });

  it('starts in a save’s area, else the door’s, else home', async () => {
    const { arrivalArea } = await import('../../src/scenes/game/areas');
    expect(arrivalArea({ area: 'market' })).toBe('market');
    expect(arrivalArea({})).toBe('home');
    fakeWindow('?area=cave');
    expect(arrivalArea({ newGame: true, area: 'home' })).toBe('cave');
    expect(arrivalArea({ area: 'tavern' })).toBe('tavern');
  });
});

describe('the art list', () => {
  it('draws in order, stopping at a step whose code has not arrived', async () => {
    const { ART_STEPS, ArtLoader } = await import('../../src/art');
    const drawn: string[] = [];
    // Stand-in painters, so nothing touches Phaser: the first static, the next two fetched.
    let arrive!: () => void;
    const late = new Promise<void>((resolve) => (arrive = resolve));
    const steps = [
      { label: 'a', draw: () => drawn.push('a') },
      { label: 'b', load: () => late.then(() => () => drawn.push('b')) },
      { label: 'c', load: () => Promise.resolve(() => drawn.push('c')) },
    ];
    const saved = ART_STEPS.splice(0, ART_STEPS.length, ...steps);
    try {
      const scene = {} as never;
      ArtLoader.finish(scene);
      expect(drawn).toEqual(['a']);
      expect(ArtLoader.ready).toBe(false);
      const all = ArtLoader.drawAll(scene);
      await Promise.resolve();
      expect(drawn).toEqual(['a']);
      arrive();
      await all;
      expect(drawn).toEqual(['a', 'b', 'c']);
      expect(ArtLoader.finished).toBe(true);
    } finally {
      ART_STEPS.splice(0, ART_STEPS.length, ...saved);
    }
  });

  it('keeps the title screen’s art in the first download', async () => {
    const { ART_STEPS } = await import('../../src/art');
    expect(ART_STEPS.filter((s) => s.title).every((s) => s.draw && !s.load)).toBe(true);
    expect(ART_STEPS.every((s) => s.draw || s.load)).toBe(true);
  });
});
