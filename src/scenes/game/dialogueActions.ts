/**
 * Story effects triggered by lines of dialogue (the `action` on a line or reply,
 * see dialogue/Dialogue.ts). The named ones live with their part of the story
 * (medicine.ts, hollow.ts, monastery.ts, tavern.ts, raid.ts, fishing.ts, beacon.ts, gloomhaven.ts, jetty.ts, voyages.ts); add new ones there.
 */
import { ItemId } from '../../systems/Inventory';
import { ShopId, SHOPS } from '../../systems/Shops';
import type { GameScene } from '../GameScene';
import { bondAction, companionAction } from './companions';
import { FISHING_ACTIONS } from './fishing';
import { HOLLOW_ACTIONS } from './hollow';
import { HOMESTEAD_ACTIONS } from './homestead';
import { MEDICINE_ACTIONS } from './medicine';
import { MONASTERY_ACTIONS } from './monastery';
import { RAID_ACTIONS } from './raid';
import { GATE_ACTIONS } from './gate';
import { TRAIL_ACTIONS } from './trail';
import { WARREN_ACTIONS } from './broodhall';
import { sailTo, VOYAGE_ACTIONS } from './voyages';
import { JETTY_ACTIONS } from './jetty';
import { GLOOM_ACTIONS } from './gloomhaven';
import { ASHES_ACTIONS } from './ashes';
import { BEACON_ACTIONS, beaconPayAction } from './beacon';
import { drinkAtBar, placeOrder, rentRoom, TAVERN_ACTIONS } from './tavern';
import { roseAction } from './blackrose';
import { SHAMBLES_ACTIONS } from './shambles';

/** A named story effect: what happens when a line with this action is said. */
export type DialogueAction = (g: GameScene) => void;

/** Every named action, from the modules for each part of the story. */
const ACTIONS: Record<string, DialogueAction> = {
  ...MEDICINE_ACTIONS,
  ...HOLLOW_ACTIONS,
  ...MONASTERY_ACTIONS,
  ...TAVERN_ACTIONS,
  ...RAID_ACTIONS,
  ...GATE_ACTIONS,
  ...TRAIL_ACTIONS,
  ...WARREN_ACTIONS,
  ...FISHING_ACTIONS,
  ...ASHES_ACTIONS,
  ...BEACON_ACTIONS,
  ...GLOOM_ACTIONS,
  ...JETTY_ACTIONS,
  ...VOYAGE_ACTIONS,
  ...HOMESTEAD_ACTIONS,
  ...SHAMBLES_ACTIONS,
};

/** Runs a dialogue action: `companion:hire|join|leave:<id>`, `bond:...` (see companions.ts), `shop:<id>`, `drink:<item>`, `order:<item>`, `road:<what>`, `rent:<nights>`, `beacon-pay:<coins>`, `voyage:<area>` (see voyages.ts), or a named one. */
export function runDialogueAction(g: GameScene, action: string): void {
  if (action.startsWith('shop:') && action.slice(5) in SHOPS) {
    g.pendingShop = action.slice(5) as ShopId;
    return;
  }
  if (action.startsWith('rose-') && roseAction(g, action)) return;
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
  if (action.startsWith('companion:') && companionAction(g, action)) return;
  if (action.startsWith('bond:') && bondAction(g, action)) return;
  if (beaconPayAction(g, action)) return;
  if (action.startsWith('rent:')) {
    rentRoom(g, Number(action.slice(5)));
    return;
  }
  if (action.startsWith('voyage:')) {
    sailTo(g, action.slice(7));
    return;
  }
  const run = Object.hasOwn(ACTIONS, action) ? ACTIONS[action] : undefined;
  if (run) run(g);
  else console.warn(`Unknown dialogue action: ${action}`);
}
