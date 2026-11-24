import { beforeEach, describe, expect, it } from 'vitest';
import { BEACON_HAGGLED, BEACON_PRICE, beaconTopics, corwinScript, CorwinTalk } from '../../src/dialogue/beacon';
import { BEACON_QUEST, beaconHolders, beaconOutcome, beaconStage } from '../../src/systems/Beacon';
import { QuestLog } from '../../src/systems/Quests';

const corwin = (t: Partial<CorwinTalk> = {}) =>
  corwinScript({ first: true, errand: true, coins: 0, haggled: false, trusted: false, toldOfAldo: false, keepers: false, ...t });
const replies = (script: ReturnType<typeof corwin>, node: string) => (script.nodes[node].choices ?? []).map((c) => c.action ?? c.next);

beforeEach(() => QuestLog.reset());

describe('the beacon on Corbie Tor', () => {
  it("is the Headman's to offer only once Mother is home and buried", () => {
    expect(beaconStage()).toBeUndefined();
    QuestLog.start('the-raid');
    QuestLog.complete('the-raid', 'bury');
    expect(beaconStage()).toBe('offer');
    QuestLog.start(BEACON_QUEST, ['talk']);
    expect(beaconStage()).toBe('active');
    QuestLog.complete(BEACON_QUEST, 'brigands');
    QuestLog.complete(BEACON_QUEST, 'brazier');
    expect(beaconStage()).toBe('report');
    for (const step of ['find', 'inside', 'return']) QuestLog.complete(BEACON_QUEST, step);
    expect(beaconStage()).toBe('done');
  });

  it('is held by the brigands until it is settled, and kept by them if they were hired', () => {
    expect(beaconHolders()).toBe('brigands');
    QuestLog.setFlag('beacon-hired');
    expect(beaconOutcome()).toBe('hired');
    expect(beaconHolders()).toBe('keepers');
    QuestLog.reset();
    QuestLog.setFlag('beacon-paid');
    expect(beaconHolders()).toBe('empty');
  });

  it("offers the Headman's topics as the errand stands", () => {
    expect(beaconTopics(undefined, undefined)).toEqual([]);
    const offer = beaconTopics('offer', undefined)[0];
    expect(Object.values(offer.nodes).some((n) => n.choices?.some((c) => c.action === 'beacon-accept'))).toBe(true);
    for (const outcome of ['fought', 'paid', 'hired'] as const) {
      const report = beaconTopics('report', outcome)[0];
      expect(report.nodes['beacon-pay'].action).toBe('beacon-reward');
    }
  });

  it('lets Corwin be paid off (or haggled down), hired, or fought', () => {
    // Without the Headman's errand there's nothing to bargain over, but a fight is always on offer.
    expect(replies(corwin({ errand: false }), 'halt')).not.toContain('errand');
    expect(replies(corwin({ errand: false }), 'halt')).toContain('fight-sure');
    expect(corwin().nodes['fight'].action).toBe('beacon-fight');
    // Too poor to pay: only haggling, or going to get the money.
    expect(replies(corwin(), 'price')).toEqual(['beacon-haggle', 'poor', 'menu']);
    expect(replies(corwin({ coins: BEACON_PRICE }), 'price')).toContain(`beacon-pay:${BEACON_PRICE}`);
    expect(replies(corwin({ coins: BEACON_HAGGLED, haggled: true }), 'price')).toContain(`beacon-pay:${BEACON_HAGGLED}`);
    // Hired on the hero's word if Adowvale likes them, or with a little money on account.
    expect(replies(corwin({ trusted: true }), 'terms')).toContain('beacon-hire');
    expect(replies(corwin({ coins: 20 }), 'terms')).toContain('beacon-hire-earnest');
    expect(replies(corwin(), 'terms')).toEqual(['menu']);
    // Once they keep the tower for the Headman, he's friendly.
    expect(corwin({ keepers: true }).nodes.greet.speaker).toBe('corwin');
  });
});
