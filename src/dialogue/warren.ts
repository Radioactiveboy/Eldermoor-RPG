import { HERO_NAME } from '../config';
import type { DialogueScript } from './Dialogue';

/**
 * Down in the goblins' warren under the Greyfells (world/WarrenMap.ts): whoever
 * they're keeping in their pen. If the village fell the night they came, it's
 * Hilde the baker, dragged off from Adowvale. If it held, it's Coombe the
 * shepherd from over the fell, whose ewes they took first. Either way, letting
 * them out ('freed-prisoner', scenes/game/warren.ts) sends them creeping back
 * up to the daylight, and either way they've seen Mother carried past.
 */
export function hildeCaptiveScript(): DialogueScript {
  return {
    start: 'greet',
    nodes: {
      greet: {
        speaker: 'baker',
        lines: [
          "Arthus? Arthus! Oh, Saints be thanked. Keep your voice down, there's one of them asleep just there.",
          'They dragged me out of the bakery by my hair, with the roof coming down. I bit one. I hope it dies of it.',
        ],
        choices: [
          { text: 'Hold still. I will cut you loose.', next: 'free' },
          { text: 'Have you seen my mother?', next: 'mother' },
        ],
      },
      mother: {
        speaker: 'baker',
        lines: [
          "A woman with grey hair, in a rust-red shawl? They carried her past when they brought me in. Down, through the back. She was coughing, love. Badly.",
          'And they were gentle with her. That was the worst of it. Goblins, being gentle.',
        ],
        choices: [{ text: 'Hold still. I will cut you loose.', next: 'free' }],
      },
      free: {
        speaker: 'baker',
        lines: [
          'Mind the gut, it cuts like wire. There. Oh, my wrists.',
          "I can find my own way up, don't you fret. I've got legs, and I've got this. (She picks up a stone the size of a loaf.) Go and find her.",
        ],
        action: 'freed-prisoner',
      },
    },
  };
}

export function coombeScript(): DialogueScript {
  return {
    start: 'greet',
    nodes: {
      greet: {
        speaker: 'coombe',
        lines: [
          "Who's that? Not one of them, by the size of you. Hush, lad, hush, there's one sleeping by the fire.",
          "Coombe. I keep sheep over the fell. Kept. They had my ewes first, then they came back for the shepherd. Ate the dog. I'll not forget that.",
        ],
        choices: [
          { text: 'I will get you out of there.', next: 'free' },
          { text: 'Have they brought a woman through here? Grey hair, a rust-red shawl?', next: 'mother' },
        ],
      },
      mother: {
        speaker: 'coombe',
        lines: [
          "Aye. Days back. Four of them carrying her on a litter, careful as eggs. Down through the back way, where the heat comes up.",
          "She looked at me as they went by. Said, 'Courage.' To me, lad. And her coughing fit to break.",
        ],
        choices: [{ text: 'I will get you out of there.', next: 'free' }],
      },
      free: {
        speaker: 'coombe',
        lines: [
          "There's a knife. Bless you. Bless you, lad.",
          "I know the fell blind, I'll be home by dark. Don't you wait on me. Go and get her, if they've left anything to get.",
        ],
        action: 'freed-prisoner',
      },
    },
  };
}

/**
 * Mother, on her furs in the brood hall (world/BroodHallMap.ts), worn out with
 * fever and with nursing the brood-mother. She lasts long enough to see Arthus,
 * and to tell him the truth about his father. 'mother-died' (scenes/game/warren.ts)
 * is the end of her, and what the orb does next.
 */
export function motherDyingScript(): DialogueScript {
  return {
    start: 'greet',
    nodes: {
      greet: {
        speaker: 'mother',
        lines: [
          `${HERO_NAME}? Is it you? I dreamt you'd come. I told them you would. I told them every day.`,
          "Don't look at her like that, love. She can't help what she is. None of them can.",
        ],
        choices: [
          { text: "I've come to take you home.", next: 'home' },
          { text: 'What have they done to you?', next: 'done' },
        ],
      },
      done: {
        speaker: 'mother',
        lines: [
          'Nothing they meant ill by. They brought me to make her well. Willow and moonpetal, and everything my mother taught me. Every day, and every night.',
          "*cough* There's no mending her. She's too far gone. And so am I, love. I've known it a while.",
        ],
        next: 'home',
      },
      home: {
        speaker: 'mother',
        lines: [
          'Home. Yes. Lay me in the hollow by the cottage, where the bluebells come up in spring. Promise me.',
        ],
        choices: [
          { text: 'I promise.', next: 'father' },
          { text: "Don't talk like that. You're coming with me.", next: 'father' },
        ],
      },
      father: {
        speaker: 'mother',
        lines: [
          "Hush now and listen, because I've left it too long. It's about your father.",
          'His name was Aldo. He kept the watch at the old tower in the north woods, before the lord took the watch down. He saw them, years ago. Lights in the trees. Little grey men at the edge of the wood.',
          "When they called the watch home, he wouldn't come. He went north after them, the winter you were born, to find where they came from. He never came back.",
          "I told you the cough took him. It was easier than not knowing. I'm sorry, love. I'm so sorry.",
        ],
        choices: [{ text: 'Why tell me now?', next: 'why' }],
      },
      why: {
        speaker: 'mother',
        lines: [
          "Because of that thing. The glass. Something speaks out of it at night, and they do whatever it says. It isn't goblin, whatever it is.",
          'Your father went looking for where they came from. I think, maybe, he found it.',
        ],
        next: 'end',
      },
      end: {
        speaker: 'mother',
        lines: [
          "You've your father's stubborn heart. I always said so. Don't let it take you where it took him.",
          "Hold me, love. I'm so tired. ...There. That's better. That's...",
        ],
        action: 'mother-died',
      },
    },
  };
}

/** Whoever is on the other side of the orb, once Mother is gone: the goblins are to kill the hero, and then finish Adowvale. */
export function orbScript(alone: boolean): DialogueScript {
  return {
    start: 'speak',
    nodes: {
      speak: {
        speaker: 'orb',
        lines: [
          "So. The healer's whelp, come down into the dark after her. How touching. And how late.",
          'She failed. The Mother will die, and her brood in the shell with her, and that is a waste I will not forgive.',
          alone
            ? 'Children. Kill him. Then go up into the light and finish what you began. Leave nothing standing in Adowvale.'
            : 'Children. Kill them, all of them. Then go up into the light and finish what you began. Leave nothing standing in Adowvale.',
        ],
        action: 'orb-spoke',
      },
    },
  };
}
