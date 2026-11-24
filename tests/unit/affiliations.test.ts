import { beforeEach, describe, expect, it } from 'vitest';
import { Affiliations } from '../../src/dialogue/Affiliations';

beforeEach(() => Affiliations.reset());

describe('affiliations under portraits', () => {
  it('shows what is worn from the first word', () => {
    expect(Affiliations.known('guard')?.label).toBe('Adowvale Militia');
    expect(Affiliations.known('snikkit')?.label).toBe('Goblin Warband');
    expect(Affiliations.known('prior')?.faction).toBe('monastery');
  });

  it('keeps the rest hidden until the hero has talked with them', () => {
    expect(Affiliations.known('baker')).toBeUndefined();
    Affiliations.markMet('baker');
    expect(Affiliations.known('baker')?.label).toBe('Folk of Adowvale');
  });

  it('shows nothing for those who belong to no one', () => {
    Affiliations.markMet('mother');
    expect(Affiliations.known('mother')).toBeUndefined();
    expect(Affiliations.known('orb')).toBeUndefined();
  });

  it('remembers who has been met across a save', () => {
    Affiliations.markMet('smith');
    const saved = JSON.parse(JSON.stringify(Affiliations.toSave()));
    Affiliations.reset();
    Affiliations.fromSave(saved);
    expect(Affiliations.known('smith')).toBeDefined();
  });
});
