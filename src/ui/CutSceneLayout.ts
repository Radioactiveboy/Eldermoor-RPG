/**
 * The sums behind a cut-scene's framing (see ui/CutScene.ts and
 * scenes/LetterboxScene.ts), kept apart from Phaser so they can be tested.
 */

/** How tall each letterbox bar is, in interface pixels: an eighth of the screen, within reason. */
export function letterboxHeight(width: number, height: number): number {
  // A tall phone held upright gets slimmer bars, so there's still a picture between them.
  const share = height > width ? 0.09 : 0.125;
  return Math.round(Math.min(140, Math.max(44, height * share)));
}

/** How long a caption stays up: long enough to read it at an easy pace. */
export function captionMs(text: string): number {
  return Math.round(Math.min(7000, 2200 + text.length * 45));
}
