/**
 * Fights that start out of a conversation: "Fight him." (Ned Flay in his pit barn), "Then come and take it." (the Hooks
 * at Lusk's), "Garth. Teg. Linnet." (the beacon's brigands). The people who were talking become the foes they fight
 * as, where they stand, and the fight is on, once the talk has properly let go of the hero.
 *
 * Every such fight goes through here, so there is one way of doing it. The swap itself (turnOnHero, in combat.ts)
 * only takes the people off the map once the fight has really begun: if it can't begin, they stay where they are,
 * still there to talk to, rather than vanishing.
 *
 * This file stays light (the fight's code is fetched when it's needed), so the areas' own code that uses it does
 * too: see areas.ts.
 */
import type { FoeKind } from '../../systems/Combat';
import type { GameScene } from '../GameScene';

/**
 * How long after a conversation closes before its fight begins. The close hands control back 80ms later
 * (GameScene.release): the fight starts after that, so that nothing the close does comes after it.
 */
export const TALK_FIGHT_DELAY = 150;

export interface TalkFight {
  /** Which person (by NPC id) fights as which foe. Those not about at the time are left out. */
  sides: Record<string, FoeKind>;
  /** Starts the creatures' ids, which are kept apart from every other fight's (e.g. 'pit' gives 'pit-flay-…'). */
  tag: string;
  /** Whether the fight is still wanted when the moment comes (the story may have moved on). */
  stillOn: () => boolean;
  /** Just before the swap: a last word, a shout from a bystander. */
  before?: () => void;
}

/** Sets the fight going once the conversation now open has closed (it's the conversation's afterTalk). */
export function fightAfterTalk(g: GameScene, fight: TalkFight): void {
  g.afterTalk = () => {
    const code = import('./combat');
    g.time.delayedCall(TALK_FIGHT_DELAY, () => {
      if (g.inCombat || !fight.stillOn()) return;
      void code
        .then(({ turnOnHero }) => {
          if (g.inCombat || !fight.stillOn()) return;
          fight.before?.();
          if (!turnOnHero(g, fight.sides, fight.tag)) console.warn(`The ${fight.tag} fight could not start: nobody to fight, or a fight already on.`);
        })
        .catch((e: unknown) => console.error(`The ${fight.tag} fight could not start:`, e));
    });
  };
}
