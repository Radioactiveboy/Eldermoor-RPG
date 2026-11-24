/** Two-finger pinch on a touch screen, turned into camera zoom steps. */
import Phaser from 'phaser';

/** Touch pointers the game listens to: two, so a pinch can be seen. */
const TOUCH_POINTERS = 2;

function fingers(scene: Phaser.Scene): [Phaser.Input.Pointer, Phaser.Input.Pointer] | undefined {
  const { pointer1, pointer2 } = scene.input;
  return pointer1?.isDown && pointer2?.isDown ? [pointer1, pointer2] : undefined;
}

/** Whether two fingers are on the screen at once. */
export function pinching(scene: Phaser.Scene): boolean {
  return !!fingers(scene);
}

/**
 * Calls `zoomBy` with how much the gap between two fingers has grown (above 1)
 * or shrunk (below 1) since the last move, while `enabled` says so.
 */
export function pinchZoom(scene: Phaser.Scene, enabled: () => boolean, zoomBy: (factor: number) => void): void {
  // Pointers are shared by the whole game (the mouse is pointers[0]), so only add what's missing.
  const missing = TOUCH_POINTERS + 1 - scene.input.manager.pointers.length;
  if (missing > 0) scene.input.addPointer(missing);
  let last = 0;
  scene.input.on(Phaser.Input.Events.POINTER_MOVE, () => {
    const both = fingers(scene);
    if (!both || !enabled()) {
      last = 0;
      return;
    }
    const gap = Phaser.Math.Distance.Between(both[0].x, both[0].y, both[1].x, both[1].y);
    if (last > 0 && gap > 0) zoomBy(gap / last);
    last = gap;
  });
  scene.input.on(Phaser.Input.Events.POINTER_UP, () => (last = 0));
}
