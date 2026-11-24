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

/**
 * The orb's portrait (see orbPortrait.ts) is painted smooth, bigger than the others, and always moving:
 * a loop of `frames` frames played at `fps`, then the same loop "stirred" (frames + i) for while it speaks.
 */
export const ORB_PORTRAIT = { key: 'portrait-orb', size: 160, frames: 24, fps: 10 } as const;

/** The militia garrison in Adowvale (see garrison.ts): its footprint, wall height in pixels, and which front tile its door is on. */
export const GARRISON = { w: 4, h: 3, height: 74, doorTile: 2 } as const;

/** The Headman's residence (see garrison.ts): footprint, height to the eaves and of the roof, and the middle of its porch along x. */
export const RESIDENCE = { w: 7, h: 4, height: 96, ridge: 54, porch: 3.5 } as const;

/** Where the residence's two chimneys top out, relative to its corner, for the smoke. */
export const RESIDENCE_CHIMNEYS = [
  { gx: 1.3, gy: 1.5, z: RESIDENCE.height + RESIDENCE.ridge + 12 },
  { gx: 5.9, gy: 1.5, z: RESIDENCE.height + RESIDENCE.ridge + 12 },
];

/** Height of the residence's panelled inner walls, in pixels (see garrison.ts). */
export const PANEL_WALL_HEIGHT = 100;
