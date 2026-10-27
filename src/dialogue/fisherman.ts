import { HERO_NAME } from '../config';
import type { DialogueScript } from './Dialogue';

/**
 * Old Tobin, who sits on the far shore of the lake in Adowvale Hollow with his
 * rod, day in, day out, and seldom catches anything. He has lived in the
 * Hollow longer than anyone and remembers the hill before the wolves came. If
 * the hero has found the locked door in the wolves' cave, he has a story about it.
 */

/**
 * @param first whether this is the first time they've spoken
 * @param sawDoor whether the hero has tried the locked door in the wolves' cave
 */
export function fishermanScript(first: boolean, sawDoor: boolean): DialogueScript {
  return {
    start: first ? 'greet' : 'again',
    nodes: {
      greet: {
        speaker: 'fisherman',
        lines: [
          "Shh! Keep your voice down, you'll frighten them off. ...Ah, never mind. There's nothing biting anyway.",
          `You're the lad from the cottage across the water. ${HERO_NAME}, isn't it? Tobin. I've fished this lake since before you were born.`,
        ],
        next: 'ask',
      },
      again: {
        speaker: 'fisherman',
        lines: ['Back again? Sit down if you like. Quietly, mind.'],
        next: 'ask',
      },
      ask: {
        speaker: 'fisherman',
        lines: ['What is it?'],
        choices: [
          { text: 'Caught anything?', next: 'catch' },
          { text: 'Is it peaceful out here?', next: 'peace' },
          sawDoor
            ? { text: "There's a locked door in the wolves' cave.", next: 'door' }
            : { text: 'What do you know about the caves in the hill?', next: 'hill' },
          { text: "I'll leave you to it.", next: 'bye' },
        ],
      },
      catch: {
        speaker: 'fisherman',
        lines: [
          'Caught? This morning, a boot. Yesterday, the same boot. I threw it back, and it came round again.',
          "There's a pike in here as long as your arm. Old Grandfather, I call him. I've had him on the line twice in twenty years. One day.",
        ],
        next: 'ask',
      },
      peace: {
        speaker: 'fisherman',
        lines: [
          "It was, till the wolves started howling up on the hill at nights. You can hear them clear across the water.",
          "Still. The fish don't mind wolves, and I don't mind fish. Mostly I watch the float and think about nothing. You should try it.",
        ],
        next: 'ask',
      },
      hill: {
        speaker: 'fisherman',
        lines: [
          "Wolves' den now, so stay out of it. When I was a boy we dared each other to touch the back wall and run.",
          "My grandad said men came and dug in that hill once, long ago. Carts going up full and coming down empty, all one summer. Never said what for.",
        ],
        next: 'ask',
      },
      door: {
        speaker: 'fisherman',
        lines: [
          "A door? In the cave? ...No. No, there wasn't any door when I was a boy. Just the back wall, and the dark.",
          "My grandad used to say men dug in that hill, one summer long ago. Carts going up full and coming down empty. Then they went away, and nobody asked.",
          "If somebody's put a lock on it, somebody's got the key. I'd want to know who, before I went knocking.",
        ],
        next: 'ask',
      },
      bye: {
        speaker: 'fisherman',
        lines: ["Mind how you go. And if you see a pike as long as your arm, he's mine."],
      },
    },
  };
}
