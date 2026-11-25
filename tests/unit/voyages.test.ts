import { beforeEach, describe, expect, it } from 'vitest';
import { marenAwayScript, marenScript } from '../../src/dialogue/jetty';
import { Inventory } from '../../src/systems/Inventory';
import { QuestLog } from '../../src/systems/Quests';
import { GLOOMHAVEN_PASSAGE, heronTalk, HERON_MENDING, openVoyages, VOYAGES } from '../../src/systems/Voyages';

const news = { raided: false, bereaved: false };

/** Every action the choices can run in the parts of a conversation that can be reached from its start. */
function actions(script: ReturnType<typeof marenScript>): string[] {
  const seen = new Set<string>();
  const found: string[] = [];
  const visit = (id: string | undefined) => {
    if (!id || seen.has(id) || !script.nodes[id]) return;
    seen.add(id);
    const node = script.nodes[id];
    visit(node.next);
    for (const c of node.choices ?? []) {
      if (c.action) found.push(c.action);
      visit(c.next);
    }
  };
  visit(script.start);
  return found;
}

beforeEach(() => {
  QuestLog.reset();
  Inventory.reset();
});

describe('the Grey Heron', () => {
  it("won't sail anywhere until she's mended", () => {
    expect(openVoyages()).toEqual([]);
    QuestLog.setFlag(GLOOMHAVEN_PASSAGE);
    expect(openVoyages().map((v) => v.to)).toEqual(['gloomhaven']);
  });

  it('asks no fare of the hero who helped mend her', () => {
    expect(VOYAGES.find((v) => v.to === 'gloomhaven')?.fare).toBe(0);
  });

  it('is only offered to be mended once the hero needs to get to Gloomhaven', () => {
    expect(actions(marenScript(false, news, [], 0, heronTalk()))).not.toContain('heron-start');
    QuestLog.start('the-marsh-road');
    expect(actions(marenScript(false, news, [], 0, heronTalk()))).toContain('heron-start');
  });

  it('counts what is still wanting for her mending, and lets it begin once all three are in hand', () => {
    QuestLog.start('the-marsh-road');
    QuestLog.start('fit-to-sail', ['talk']);
    expect(heronTalk()).toMatchObject({ stage: 'mending', wanting: ['a plank', 'the oakum', 'the pitch'] });
    expect(actions(marenScript(false, news, [], 0, heronTalk()))).not.toContain('heron-mend');
    for (const m of HERON_MENDING) Inventory.add(m.item, 1);
    expect(heronTalk().wanting).toEqual([]);
    expect(actions(marenScript(false, news, [], 0, heronTalk()))).toContain('heron-mend');
  });

  it('once mended, offers the passage to Gloomhaven', () => {
    QuestLog.start('the-marsh-road');
    QuestLog.start('fit-to-sail', ['talk', 'gather', 'mend']);
    QuestLog.setFlag(GLOOMHAVEN_PASSAGE);
    expect(heronTalk().stage).toBe('mended');
    expect(actions(marenScript(false, news, openVoyages(), 0, heronTalk()))).toContain('voyage:gloomhaven');
  });

  it('takes the hero home from Gloomhaven', () => {
    expect(actions(marenAwayScript(9))).toEqual(['voyage-home']);
  });
});
