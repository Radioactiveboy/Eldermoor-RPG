/**
 * What the village does for the hero once Ashes is over (see dialogue/afterAshes.ts):
 * the Headman's purse from the village chest, kept or given away; telling him about
 * the voice in the orb; Coombe's thanks; and a word with a companion about Mother.
 */
import { Inventory } from '../../systems/Inventory';
import { QuestLog } from '../../systems/Quests';
import { Relationships } from '../../systems/Relationships';
import { Reputation } from '../../systems/Reputation';
import type { DialogueAction } from './dialogueActions';

/** What the Headman's purse holds, and Coombe's. */
export const HEADMAN_PURSE = 60;
export const COOMBE_PURSE = 25;
/** How much closer a companion is for being asked how they're bearing it. */
export const CONFIDED_BOND = 4;

/** The Headman's purse, settled once: kept, or given to Iran or Hilde. */
function settlePurse(how: 'kept' | 'iran' | 'bakery'): DialogueAction {
  return () => {
    if (QuestLog.hasFlag('ashes-purse')) return;
    QuestLog.setFlag('ashes-purse');
    if (how === 'kept') {
      Inventory.addCoins(HEADMAN_PURSE);
      Reputation.gain('adowvale', 4, "Took the village's thanks");
      return;
    }
    QuestLog.setFlag(`ashes-purse-${how}`);
    Reputation.gain('adowvale', 15, how === 'iran' ? "Gave the village's purse to Iran" : "Gave the village's purse to Hilde's bakery");
    QuestLog.writeDiary(
      how === 'iran'
        ? `The Headman offered me sixty coins from the village chest. I asked him to give it to Iran for his hens and his coop. Mother would have.`
        : `The Headman offered me sixty coins from the village chest. I asked him to put it toward Hilde's bakery. Mother would have.`,
    );
  };
}

/** A companion asked how they're bearing it, the first time: it brings them a little closer. */
function confided(id: 'sigrun' | 'wat'): DialogueAction {
  return () => {
    QuestLog.setFlag(`ashes-confided:${id}`);
    if (Relationships.mark(id, 'ashes')) Relationships.gain(id, CONFIDED_BOND, 'Grieved together');
  };
}

export const ASHES_ACTIONS: Record<string, DialogueAction> = {
  'ashes-purse-kept': settlePurse('kept'),
  'ashes-purse-iran': settlePurse('iran'),
  'ashes-purse-bakery': settlePurse('bakery'),
  'told-headman-orb': () => {
    if (QuestLog.hasFlag('told-headman-orb')) return;
    QuestLog.setFlag('told-headman-orb');
    QuestLog.writeDiary(
      'Told the Headman about the orb, and the voice in it. He knew Father: it was his name under the order that took the watch down, ' +
        'and Father told him the village would be sorry. He says somebody means Adowvale gone, and he wants to talk about the old watch when I have rested.',
    );
  },
  'coombe-thanks': () => {
    if (QuestLog.hasFlag('coombe-thanked')) return;
    QuestLog.setFlag('coombe-thanked');
    Inventory.addCoins(COOMBE_PURSE);
  },
  'ashes-confided-sigrun': confided('sigrun'),
  'ashes-confided-wat': confided('wat'),
};
