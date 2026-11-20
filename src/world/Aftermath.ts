import { SaveGame } from '../systems/SaveGame';

/**
 * The days after the goblins' raid (see world/GoblinRaid.ts): when it
 * happened, so the ruins can smoulder for a couple of days and the crows
 * that come down on the farm thin out as the days go by. Saved with the game.
 */
/** When the raid was. */
export const Aftermath = {
  /** The raid's morning, in hours since the start of day 1 (undefined before it, or in a save from before this was kept). */
  raidAt: undefined as number | undefined,
};

SaveGame.register('aftermath', {
  save: () => ({ raidAt: Aftermath.raidAt }),
  load(data) {
    Aftermath.raidAt = (data as { raidAt?: number } | undefined)?.raidAt;
  },
});

/** Hours the ruins go on smoking after the raid. */
export const SMOULDER_HOURS = 48;
/** Days the crows keep coming back to the farm. */
export const CROW_DAYS = 5;

/**
 * How hard the ruins are smoking (0..1), `since` hours after the raid: thick
 * at first, thinning over the next day and out after {@link SMOULDER_HOURS}.
 */
export function smoulder(since: number): number {
  if (since < 0 || since >= SMOULDER_HOURS) return 0;
  return (1 - since / SMOULDER_HOURS) ** 1.3;
}

/** How many crows (0..1 of the most) are about the farm, `since` hours after the raid. */
export function crowsAbout(since: number): number {
  if (since < 0) return 0;
  return Math.max(0, 1 - since / (CROW_DAYS * 24)) * 0.8 + 0.2;
}
