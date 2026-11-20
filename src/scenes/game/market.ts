/** Adowvale's market square: arriving, and the militia calling the market's hours. */
import { marketOpen } from '../../systems/MarketHours';
import { QuestLog } from '../../systems/Quests';
import type { GameScene } from '../GameScene';

/** What the militia call out about the market's hours. */
export const MILITIA_CALLS = {
  closing: "Market's closing! Stalls are shut till morning, folks. Off home with you.",
  closed: "Market's shut for the night, friend. The traders have all gone home. Come back in the morning.",
  opening: "Morning! Market's open!",
};

/** Into the market square: after hours the militia say so, and the first time the hero takes it in. */
export function enteredMarket(g: GameScene): void {
  if (!g.marketWasOpen) {
    // Turning up after hours: the militia say so.
    g.time.delayedCall(1400, () => militiaCall(g, MILITIA_CALLS.closed));
  }
  if (g.visited.has('market')) return;
  const firstSight = g.marketWasOpen
    ? 'Adowvale at last. Fresh bread, woodsmoke, and the clang of the smithy in the market square.'
    : 'Adowvale at last, but the market stalls are all covered over for the night.';
  g.time.delayedCall(1000, () => g.onHint?.(firstSight));
  QuestLog.writeDiary(
    'Followed the old road all the way to Adowvale. The market square was busier than I remembered, with the militia ' +
      'marching about in their tin hats. Someone here must know where to find moonpetal.',
  );
}

/** In the market, the militia call out as the stalls shut in the evening and open in the morning. */
export function updateMarketHours(g: GameScene): void {
  if (g.area !== 'market') return;
  const open = marketOpen(g.clock.hour);
  if (open !== g.marketWasOpen) militiaCall(g, open ? MILITIA_CALLS.opening : MILITIA_CALLS.closing);
  g.marketWasOpen = open;
}

/** The militiaman nearest the player calls something out. */
export function militiaCall(g: GameScene, text: string): void {
  const guards = g.npcs.filter((n) => n.id.startsWith('guard-'));
  const nearest = guards.sort((a, b) => a.distanceTo(g.player.gx, g.player.gy) - b.distanceTo(g.player.gx, g.player.gy))[0];
  nearest?.say(text, 6);
}
