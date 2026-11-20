/**
 * Sizes the game's scenes need from art that is drawn later (the satchel's icons, the faces).
 * They live here rather than in items.ts and portraits.ts, so the scenes that read them don't
 * pull those painters into the first download (see ART_STEPS in art/index.ts).
 */

/** Item icons are painted ICON_SIZE pixels square (see items.ts). */
export const ICON_SIZE = 128;

/**
 * The scale that shows an icon at the size a 16-pixel icon had at scale `s`.
 * Every caller sizes icons through this, so they all stay in proportion.
 */
export function itemScale(s: number): number {
  return (s * 16) / ICON_SIZE;
}

/** Portraits are PORTRAIT_SIZE pixels square (see portraits.ts). */
export const PORTRAIT_SIZE = 96;
