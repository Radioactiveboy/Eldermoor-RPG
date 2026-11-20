/**
 * The ?debug panel's switches (systems/DebugSwitches.ts), and the sums behind
 * a cut-scene's framing (ui/CutSceneLayout.ts).
 */
import { describe, expect, it } from 'vitest';
import { debugWanted, readSwitches, SWITCHES, withSwitches } from '../../src/systems/DebugSwitches';
import { captionMs, letterboxHeight } from '../../src/ui/CutSceneLayout';

describe('the debug switches', () => {
  it('covers every switch the game reads from the address', () => {
    expect(SWITCHES.map((s) => s.key)).toEqual(['area', 'hour', 'raid', 'event', 'give', 'wolves', 'weather']);
  });

  it('reads the switches that are set, and nothing else', () => {
    expect(readSwitches('?debug&area=market&hour=21&smoke&weather=')).toEqual({ area: 'market', hour: '21' });
    expect(readSwitches('')).toEqual({});
    expect(readSwitches('?give=moonpetal%2Craw-hare%3A3')).toEqual({ give: 'moonpetal,raw-hare:3' });
  });

  it('writes switches back, keeping ?debug and ?smoke as they were', () => {
    expect(withSwitches('?debug', { area: 'cave', wolves: '3' })).toBe('?debug&area=cave&wolves=3');
    expect(withSwitches('?smoke&debug&area=cave', { area: 'market' })).toBe('?smoke&debug&area=market');
  });

  it('removes a switch given an empty value, and leaves alone those not mentioned', () => {
    expect(withSwitches('?debug&area=cave&hour=6&raid=after', { area: '', raid: '  ' })).toBe('?debug&hour=6');
    expect(withSwitches('?area=cave', { area: '' })).toBe('');
  });

  it('round-trips what it writes', () => {
    const values = { area: 'plains', hour: '20.5', event: 'goat', give: 'moonpetal,raw-hare:3', weather: 'storm' };
    expect(readSwitches(withSwitches('?debug', values))).toEqual(values);
  });

  it('knows when the panel is wanted', () => {
    expect(debugWanted('?debug')).toBe(true);
    expect(debugWanted('?area=cave&debug=1')).toBe(true);
    expect(debugWanted('?area=cave')).toBe(false);
  });
});

describe('the cut-scene framing', () => {
  it('gives bars about an eighth of the screen, slimmer upright, within limits', () => {
    expect(letterboxHeight(1280, 720)).toBe(90);
    expect(letterboxHeight(390, 844)).toBe(76);
    expect(letterboxHeight(800, 300)).toBe(44);
    expect(letterboxHeight(2560, 1440)).toBe(140);
  });

  it('keeps a caption up longer the more there is to read, within limits', () => {
    expect(captionMs('Mother? MOTHER!')).toBeGreaterThan(2200);
    expect(captionMs('a'.repeat(80))).toBeGreaterThan(captionMs('a'.repeat(20)));
    expect(captionMs('a'.repeat(1000))).toBe(7000);
  });
});
