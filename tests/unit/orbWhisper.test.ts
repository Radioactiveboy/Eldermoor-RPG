import { describe, expect, it } from 'vitest';
import { GLOOMHAVEN_QUEST, WHISPER_LINES, WHISPER_VOICES } from '../../src/dialogue/orbWhisper';
import { QUESTS } from '../../src/systems/Quests';

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
