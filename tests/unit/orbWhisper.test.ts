import { beforeEach, describe, expect, it } from 'vitest';
import { GLOOMHAVEN_QUEST, WHISPER_HEARD, WHISPER_LINES, WHISPER_VOICES } from '../../src/dialogue/orbWhisper';
import { repairWhisper, whisperPending } from '../../src/systems/OrbWhisper';
import { QuestLog, QUESTS } from '../../src/systems/Quests';

describe("the orb's whisper", () => {
  it('lets slip that the boy lives, and Gloomhaven on the marshes', () => {
    const said = WHISPER_LINES.map((l) => l.text).join(' ');
    expect(said).toContain('The boy lives still...');
    expect(said).toContain('We must send them to Gloomhaven then, on the marshes.');
  });

  it('is overheard, never spoken to the hero, and fades out at the end', () => {
    for (const line of WHISPER_LINES) expect(WHISPER_VOICES[line.voice]).toBeDefined();
    for (const line of WHISPER_LINES) expect(line.text).not.toMatch(/sleep, boy|waiting for you|he is looking now/i);
    expect(WHISPER_LINES[WHISPER_LINES.length - 1].faint).toBe(true);
  });

  it('names the Astarix and Daejonguk, and turns from Adowvale to Gloomhaven', () => {
    const said = WHISPER_LINES.map((l) => l.text).join(' ');
    expect(said).toContain('Astarix');
    expect(said).toContain('Daejonguk');
    expect(said).toContain('Adowvale will keep');
  });

  it('starts a main quest for the road to Gloomhaven', () => {
    expect(QUESTS[GLOOMHAVEN_QUEST]?.kind).toBe('main');
  });
});

describe('older saves and the whisper', () => {
  const finishBeacon = () => {
    QuestLog.start('the-beacon');
    for (const step of QUESTS['the-beacon'].objectives) QuestLog.complete('the-beacon', step.id);
  };

  beforeEach(() => {
    QuestLog.reset();
    QuestLog.start('the-watcher');
  });

  it('sets the whisper waiting for a beacon reported before the whisper existed', () => {
    finishBeacon();
    expect(whisperPending()).toBe(false);
    repairWhisper();
    expect(whisperPending()).toBe(true);
    expect(QuestLog.isDone('the-watcher', 'hale')).toBe(true);
    expect(QuestLog.get('the-watcher')?.completed).toBe(false);
  });

  it('leaves the orb dark before the beacon, and points the Watcher at the Headman', () => {
    repairWhisper();
    expect(whisperPending()).toBe(false);
    expect(QuestLog.isDone('the-watcher', 'hale')).toBe(false);
    expect(QUESTS['the-watcher'].objectives[0].target?.npc).toBe('headman');
  });

  it('closes the Watcher in the Glass for a hero who has already heard it', () => {
    finishBeacon();
    QuestLog.setFlag(WHISPER_HEARD);
    repairWhisper();
    expect(whisperPending()).toBe(false);
    expect(QuestLog.get('the-watcher')?.completed).toBe(true);
  });
});
