import { beforeEach, describe, expect, it } from 'vitest';
import { lookedAtTrailSign, reachedTrailEnd } from '../../src/scenes/game/trail';
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
