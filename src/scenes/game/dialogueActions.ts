/**
 * Story effects triggered by lines of dialogue (the `action` on a line or reply,
 * see dialogue/Dialogue.ts). The named ones live with their part of the story
 * (medicine.ts, hollow.ts, monastery.ts, tavern.ts, raid.ts, fishing.ts); add new ones there.
 */
import { ItemId } from '../../systems/Inventory';
import { ShopId, SHOPS } from '../../systems/Shops';
import type { GameScene } from '../GameScene';
import { bountyAction } from './bounties';
import { FISHING_ACTIONS } from './fishing';
import { HOLLOW_ACTIONS } from './hollow';
import { MEDICINE_ACTIONS } from './medicine';
import { MONASTERY_ACTIONS } from './monastery';
import { RAID_ACTIONS } from './raid';
import { drinkAtBar, placeOrder, rentRoom, TAVERN_ACTIONS } from './tavern';

/** A named story effect: what happens when a line with this action is said. */
export type DialogueAction = (g: GameScene) => void;

/** Every named action, from the modules for each part of the story. */
const ACTIONS: Record<string, DialogueAction> = {
  ...MEDICINE_ACTIONS,
  ...HOLLOW_ACTIONS,
  ...MONASTERY_ACTIONS,
  ...TAVERN_ACTIONS,
  ...RAID_ACTIONS,
  ...FISHING_ACTIONS,
};

/** Runs a dialogue action: `shop:<id>`, `drink:<item>`, `order:<item>`, `road:<what>`, `rent:<nights>`, `bounty:<take|claim>:<id>`, or a named one. */
export function runDialogueAction(g: GameScene, action: string): void {
  if (action.startsWith('shop:') && action.slice(5) in SHOPS) {
    g.pendingShop = action.slice(5) as ShopId;
    return;
  }
  if (action.startsWith('drink:')) {
    drinkAtBar(g, action.slice(6) as ItemId);
    return;
  }
  if (action.startsWith('order:')) {
    placeOrder(g, action.slice(6) as ItemId);
    return;
  }
  if (action.startsWith('road:')) {
    g.roadEvents?.action(action.slice(5));
    return;
  }
  if (action.startsWith('bounty:')) {
    bountyAction(g, action.slice(7));
    return;
  }
  if (action.startsWith('rent:')) {
    rentRoom(g, Number(action.slice(5)));
    return;
  }
  const run = Object.hasOwn(ACTIONS, action) ? ACTIONS[action] : undefined;
  if (run) run(g);
  else console.warn(`Unknown dialogue action: ${action}`);
}
