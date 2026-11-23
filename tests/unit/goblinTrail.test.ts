import { beforeEach, describe, expect, it } from 'vitest';
import { goblinPrisonerScript, GoblinTalk, SergeantTalk, sergeantScript } from '../../src/dialogue/garrison';
import { headmanScript, HeadmanTalk } from '../../src/dialogue/residence';
import { SHAREABLE_FOOD } from '../../src/dialogue/wayfarers';
import { Inventory } from '../../src/systems/Inventory';
import { fedGoblin, greyfellsOpen, headmanPaysSigrun, lookedAtCamp, lookedAtTrailSign, questionedGoblin, reachedTrailEnd, toldSergeant } from '../../src/scenes/game/trail';
import { QuestLog } from '../../src/systems/Quests';

/** The Ashes quest, as far as the goblins' trail in the north woods. */
beforeEach(() => {
  QuestLog.reset();
  QuestLog.setFlag('raid-over');
  QuestLog.start('the-raid', ['search', 'outside', 'iran']);
});

const current = () => QuestLog.current(QuestLog.get('the-raid')!)?.id;

describe("following the goblins' trail", () => {
  it('goes from the trail, to the scrap of quilt, to where it runs off north, then to the militia', () => {
    expect(current()).toBe('trail');
    lookedAtTrailSign('nw-goblin-torch');
    expect(current()).toBe('signs');
    lookedAtTrailSign('nw-quilt-scrap');
    expect(current()).toBe('edge');
    reachedTrailEnd();
    expect(current()).toBe('word');
  });

  it('writes the diary once for each find, however often the hero looks', () => {
    const before = QuestLog.diary.length;
    lookedAtTrailSign('nw-quilt-scrap');
    lookedAtTrailSign('nw-quilt-scrap');
    reachedTrailEnd();
    reachedTrailEnd();
    expect(QuestLog.diary.length).toBe(before + 2);
  });

  it('counts the quilt and the trail end even if the hero skips ahead', () => {
    reachedTrailEnd();
    lookedAtTrailSign('nw-quilt-scrap');
    expect(current()).toBe('word');
  });

  it('means nothing before the raid', () => {
    QuestLog.reset();
    lookedAtTrailSign('nw-quilt-scrap');
    reachedTrailEnd();
    expect(QuestLog.diary).toHaveLength(0);
  });
});

describe('the goblin camp on the Greyfells', () => {
  beforeEach(() => {
    for (const step of ['trail', 'signs', 'edge']) QuestLog.complete('the-raid', step);
  });

  it('opens up the trail only once the goblin in the cells has talked', () => {
    expect(greyfellsOpen()).toBe(false);
    QuestLog.complete('the-raid', 'word');
    expect(greyfellsOpen()).toBe(false);
    toldSergeant();
    expect(current()).toBe('prisoner');
    expect(greyfellsOpen()).toBe(false);
    questionedGoblin();
    expect(greyfellsOpen()).toBe(true);
    expect(current()).toBe('fells');
  });

  it('counts the militia and the sergeant as told if the hero goes straight to the goblin', () => {
    questionedGoblin();
    expect(['word', 'sergeant', 'prisoner'].every((step) => QuestLog.isDone('the-raid', step))).toBe(true);
  });

  it('writes the diary once for the sergeant, the goblin and the Headman', () => {
    const before = QuestLog.diary.length;
    for (let i = 0; i < 2; i++) {
      toldSergeant();
      questionedGoblin();
      headmanPaysSigrun();
    }
    expect(QuestLog.diary.length).toBe(before + 3);
    expect(QuestLog.hasFlag('headman-pays-sigrun')).toBe(true);
  });

  it("goes from the camp's litter to the hole in the hill", () => {
    questionedGoblin();
    expect(current()).toBe('fells');
    lookedAtCamp('gf-litter');
    expect(current()).toBe('warren');
    lookedAtCamp('gf-warren');
    expect(current()).toBe('mother');
  });

  it('counts the camp as searched when the hero goes straight past it to the hole', () => {
    questionedGoblin();
    lookedAtCamp('gf-warren');
    expect(current()).toBe('mother');
  });

  it('writes about the scratched stone once, without moving the quest on', () => {
    questionedGoblin();
    lookedAtCamp('gf-litter');
    const before = QuestLog.diary.length;
    lookedAtCamp('gf-stone');
    lookedAtCamp('gf-stone');
    expect(QuestLog.diary.length).toBe(before + 1);
    expect(current()).toBe('warren');
  });
});

describe('Snikkit, the goblin in the cells', () => {
  const talk = (over: Partial<GoblinTalk> = {}) => goblinPrisonerScript({ first: true, talked: false, ...over });

  it('tells all, by being fed or by the right guess, and never to threats', () => {
    const s = talk({ food: 'bread' });
    expect(s.nodes.threat.next).toBe('ask');
    expect(s.nodes.fed.next).toBe('tell');
    expect(s.nodes.healer.next).toBe('tell');
    expect(s.nodes.tell.action).toBe('questioned-goblin');
    expect(s.nodes.fed.action).toBe('fed-goblin');
  });

  it('can only be fed with something in the satchel', () => {
    const next = (s: ReturnType<typeof talk>) => s.nodes.ask.choices!.map((c) => c.next);
    expect(next(talk({ food: 'bread' }))).toContain('fed');
    expect(next(talk())).not.toContain('fed');
    expect(next(talk())).toContain('hungry');
  });

  it('just says it again, once it has talked', () => {
    expect(talk({ talked: true }).start).toBe('told');
  });

  it('eats what it is given', () => {
    Inventory.add('bread', 1);
    const before = SHAREABLE_FOOD.reduce((n, id) => n + Inventory.count(id), 0);
    fedGoblin();
    expect(SHAREABLE_FOOD.reduce((n, id) => n + Inventory.count(id), 0)).toBe(before - 1);
    expect(QuestLog.hasFlag('fed-snikkit')).toBe(true);
  });
});

describe('Brannock and Hale', () => {
  const sergeant = (over: Partial<SergeantTalk> = {}) =>
    sergeantScript({ first: false, raidOver: true, toldRaid: true, standing: 'known', bounties: 0, slewWolfMother: false, ...over });
  const choices = (s: ReturnType<typeof sergeant>) => s.nodes.ask.choices!.map((c) => c.next);

  it('has the sergeant hear where the trail goes, once the hero knows', () => {
    expect(choices(sergeant())).not.toContain('trail');
    const s = sergeant({ trailNews: true });
    expect(choices(s)).toContain('trail');
    expect(s.nodes.trail.action).toBe('told-sergeant');
  });

  it("has the Headman offer to pay Sigrun once the goblin has talked, and not twice", () => {
    const hale = (over: Partial<HeadmanTalk>) =>
      headmanScript({ first: false, raidOver: true, toldRaid: true, medicine: false, paidToll: false, slewWolfMother: false, ...over });
    const asks = (s: ReturnType<typeof hale>) => s.nodes.ask.choices!.map((c) => c.next);
    expect(asks(hale({}))).not.toContain('raid-greyfells');
    const offer = hale({ goblinTalked: true });
    expect(asks(offer)).toContain('raid-greyfells');
    expect(offer.nodes['raid-greyfells'].action).toBe('headman-pays-sigrun');
    const paid = hale({ goblinTalked: true, paysSigrun: true });
    expect(asks(paid)).not.toContain('raid-greyfells');
    expect(asks(paid)).toContain('raid-sigrun');
  });
});
