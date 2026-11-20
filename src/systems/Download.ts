/**
 * Tries a download a few times, a little longer apart each time (a phone on a poor signal can
 * drop one), then calls `stuck` so the screen can say so, and keeps trying every few seconds.
 * Used for the parts of the game that come down after the first download (art, area maps).
 */
export async function retry<T>(load: () => Promise<T>, stuck: () => void, wait = sleep): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await load();
    } catch (e) {
      if (attempt === 2) {
        console.warn('Still trying to download part of the game:', e);
        stuck();
      }
      await wait(Math.min(5000, 500 * 2 ** attempt));
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
