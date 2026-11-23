import { describe, expect, it } from 'vitest';
import { crowdGossip, heroRemarks, pickGossip, TownNews } from '../../src/dialogue/marketCrowd';

const QUIET: TownNews = {
  hour: 11, weather: 'clear', raidOver: false, motherSick: true, motherWell: false, paidToll: false,
  slewWolfMother: false, sheep: 'none', rats: 'none', feed: 'none', monasteryOpen: false, foundCaveDoor: false, bounties: 0,
};

const said = (n: TownNews) => crowdGossip(n).flatMap((g) => g.lines).join(' ');

describe('the market crowd', () => {
  it('always has something to talk about', () => {
    expect(crowdGossip(QUIET).length).toBeGreaterThan(5);
    expect(pickGossip(crowdGossip(QUIET), new Set())).toBeDefined();
  });

  it('talks about what the hero has done once it has happened', () => {
    expect(said(QUIET)).not.toMatch(/white wolf's dead/);
    expect(said({ ...QUIET, slewWolfMother: true })).toMatch(/white wolf's dead/);
    expect(said({ ...QUIET, sheep: 'done' })).toMatch(/Bess and Bramble/);
    expect(said({ ...QUIET, bounties: 2 })).toMatch(/notices/);
  });

  it('brings up fresh news first, then goes back to idle talk', () => {
    const pool = crowdGossip({ ...QUIET, slewWolfMother: true });
    const heard = new Set<string>();
    const first = pickGossip(pool, heard, () => 0)!;
    expect(first.id).toBe('wolf-mother');
    heard.add(first.id);
    // Said once, it's no longer fresh, and the same thing isn't said twice running.
    expect(pickGossip(pool, heard, () => 0)!.id).not.toBe('wolf-mother');
  });

  it('talks of nothing but the goblins after the raid, newest first', () => {
    const pool = crowdGossip({ ...QUIET, raidOver: true, slewWolfMother: true });
    expect(pickGossip(pool, new Set(), () => 0)!.id).toBe('raid-hollow');
    // The cheerful idle talk is gone, and nobody asks after Mother's fever any more.
    expect(said({ ...QUIET, raidOver: true })).not.toMatch(/minstrel|fever/i);
  });

  it('remarks on the weather and the hour', () => {
    expect(said({ ...QUIET, weather: 'storm' })).toMatch(/thunder/);
    expect(said({ ...QUIET, hour: 8 })).toMatch(/Hilde's first loaves/);
    expect(said({ ...QUIET, hour: 15 })).toMatch(/Stalls'll be shutting/);
  });

  it('the pair by the well only trade words, never talk to themselves', () => {
    for (let i = 0; i < 20; i++) {
      const g = pickGossip(crowdGossip(QUIET), new Set(), () => i / 20, true)!;
      expect(g.lines.length).toBe(2);
    }
  });

  it('leaves the hero be until they have done something worth remarking on', () => {
    expect(heroRemarks({ ...QUIET, motherSick: false })).toEqual([]);
    expect(heroRemarks({ ...QUIET, slewWolfMother: true }).join(' ')).toMatch(/wolf/);
    expect(heroRemarks({ ...QUIET, raidOver: true }).join(' ')).toMatch(/find her/);
  });
});
