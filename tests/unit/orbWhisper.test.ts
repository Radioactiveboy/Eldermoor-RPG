import { describe, expect, it } from 'vitest';
import { GLOOMHAVEN_QUEST, WHISPER_LINES, WHISPER_VOICES } from '../../src/dialogue/orbWhisper';
import { QUESTS } from '../../src/systems/Quests';

describe("the orb's whisper", () => {
  it('lets slip that the boy lives, and Gloomhaven on the marshes', () => {
    const said = WHISPER_LINES.map((l) => l.text).join(' ');
    expect(said).toContain('The boy lives still...');
    expect(said).toContain('We must send them to Gloomhaven then, on the marshes.');
  });

  it('is spoken only by voices it knows, and ends close against the glass', () => {
    for (const line of WHISPER_LINES) if (line.voice) expect(WHISPER_VOICES[line.voice]).toBeDefined();
    expect(WHISPER_LINES[WHISPER_LINES.length - 1].near).toBe(true);
  });

  it('starts a main quest for the road to Gloomhaven', () => {
    expect(QUESTS[GLOOMHAVEN_QUEST]?.kind).toBe('main');
  });
});
