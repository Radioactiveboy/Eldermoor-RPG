import { HERO_NAME } from '../config';
import type { DialogueScript } from './Dialogue';

/**
 * Wat, the youngest of Adowvale's militia, who keeps watch on the Hollow road
 * from the square's east side once the goblins have been. He saw the smoke and
 * wasn't let go; he'd give anything to be some use now. Asking him to come
 * along is worked into his 'ask' node by scenes/game/companions.ts.
 */
export function watScript(first: boolean): DialogueScript {
  return {
    start: first ? 'greet' : 'again',
    nodes: {
      greet: {
        speaker: 'wat',
        lines: [
          `You're ${HERO_NAME}. From the Hollow. I'm Wat. I was on the east watch the morning they came. I saw the smoke before anyone.`,
          'I wanted to run down there. The sergeant had me by the collar. "We hold the village, lad." So I held the village. And they took your mother.',
        ],
        next: 'ask',
      },
      again: {
        speaker: 'wat',
        lines: ["Still watching the Hollow road. Nothing's come up it. Nothing ever does, now."],
        next: 'ask',
      },
      ask: {
        speaker: 'wat',
        lines: ['Is there anything I can do?'],
        choices: [
          { text: 'Can you fight?', next: 'fight' },
          { text: "What's the sergeant like?", next: 'sergeant' },
          { text: 'Keep watching the road.', next: 'bye' },
        ],
      },
      fight: {
        speaker: 'wat',
        lines: [
          "I've had a spear since spring. I can hold a line, and I can stick a wolf if it comes at me straight. I've done it! Once.",
          "I've never fought a goblin. Nobody here has. But I'd rather learn on one than sit here jumping at hens.",
        ],
        next: 'ask',
      },
      sergeant: {
        speaker: 'wat',
        lines: [
          "Hard, but fair. He's lost two men to the Lord's Road this year and he won't lose another for a farm, he says. Meaning no offence.",
          "He'll not stop me going if I'm off watch, though. He said so. Well, he said \"do what you like, you will anyway\". Same thing.",
        ],
        next: 'ask',
      },
      bye: { speaker: 'wat', lines: ['Aye. I will.'] },
    },
  };
}
