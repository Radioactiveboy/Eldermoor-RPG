import type { DialogueScript } from './Dialogue';

/**
 * The market at Eldermoor: three stallholders and the village militia. The
 * traders open their stalls with the `shop:<id>` action (see GameScene); the
 * militia stand about, keep an eye on things and grumble.
 */

export const BAKER: DialogueScript = {
  start: 'greet',
  nodes: {
    greet: {
      speaker: 'baker',
      lines: [
        "Morning, love! You're from the cottage out by the lake, aren't you? I'd know your mother's face anywhere. Look at you, all grown.",
        "Hilde. I bake for half the village and gossip for the other half. What can I do you for?",
      ],
      next: 'ask',
    },
    again: {
      speaker: 'baker',
      lines: ['Back again? Something sweet this time, I hope.'],
      next: 'ask',
    },
    ask: {
      speaker: 'baker',
      lines: ['Well?'],
      choices: [
        { text: "Let's see what you've baked.", action: 'shop:baker' },
        { text: 'My mother is sick. Is there a healer here?', next: 'healer' },
        { text: 'How is trade?', next: 'trade' },
        { text: 'Goodbye, Hilde.', next: 'bye' },
      ],
    },
    healer: {
      speaker: 'baker',
      lines: [
        "Oh, I'm sorry to hear it. Old Maud the herb-wife used to keep a stall here, but her knees gave out last winter.",
        "She'll still see folk at her door, if you can find it. Take her a honey cake. She's partial to them.",
      ],
      next: 'ask',
    },
    trade: {
      speaker: 'baker',
      lines: [
        "Slow. With the bridge down at Harrowford, half the carts can't get here, and flour's dearer every week.",
        "Still, folk always need bread. And the militia lads eat like horses.",
      ],
      next: 'ask',
    },
    bye: {
      speaker: 'baker',
      lines: ['Mind how you go, and give your mother my love.'],
    },
  },
};

export const SMITH: DialogueScript = {
  start: 'greet',
  nodes: {
    greet: {
      speaker: 'smith',
      lines: [
        "Hm. Osric. I make the iron in this village: nails, hinges, ploughshares. And lately, rather more blades than I'd like.",
      ],
      next: 'ask',
    },
    again: {
      speaker: 'smith',
      lines: ['Hm. You again.'],
      next: 'ask',
    },
    ask: {
      speaker: 'smith',
      lines: ['Buying, or just looking?'],
      choices: [
        { text: 'Show me your weapons and armour.', action: 'shop:smith' },
        { text: 'Why more blades lately?', next: 'blades' },
        { text: 'Any advice for fighting wolves?', next: 'wolves' },
        { text: 'Just looking. Goodbye.', next: 'bye' },
      ],
    },
    blades: {
      speaker: 'smith',
      lines: [
        "Wolves. The reeve's raised the militia for the first time in twenty years. Every lad with two hands wants a spear.",
        "I'd rather be making ploughshares. Ploughshares don't come back with blood on them.",
      ],
      next: 'ask',
    },
    wolves: {
      speaker: 'smith',
      lines: [
        "Don't fight them with your fists, for a start. A stick is better than nothing, a blade is better than a stick.",
        "And wear something they can't bite through. Tamsin's jerkins are good. Don't tell her I said so.",
      ],
      next: 'ask',
    },
    bye: {
      speaker: 'smith',
      lines: ['Hm.'],
    },
  },
};

export const TANNER: DialogueScript = {
  start: 'greet',
  nodes: {
    greet: {
      speaker: 'tanner',
      lines: [
        "Don't mind the smell, everyone does. Tamsin, tanner and leatherworker. If it once had a hide, I can make something of it.",
        "Pelts, especially. Bring me pelts and I'll pay better than anyone between here and Harrowford.",
      ],
      next: 'ask',
    },
    again: {
      speaker: 'tanner',
      lines: ['Brought me anything furry?'],
      next: 'ask',
    },
    ask: {
      speaker: 'tanner',
      lines: ['What do you need?'],
      choices: [
        { text: "I'd like to trade.", action: 'shop:tanner' },
        { text: 'Why do you want pelts so badly?', next: 'pelts' },
        { text: 'Who are the soldiers?', next: 'militia' },
        { text: 'Goodbye.', next: 'bye' },
      ],
    },
    pelts: {
      speaker: 'tanner',
      lines: [
        'Winter cloaks. Everyone wants one this year, with the cold coming early, and a wolf-fur lining is the warmest there is.',
        "Funny, isn't it? The wolves are why folk are scared to go out, and the wolves are what keeps them warm.",
      ],
      next: 'ask',
    },
    militia: {
      speaker: 'tanner',
      lines: [
        "Soldiers? Ha! That's the village militia. The cooper's boys, the miller's nephew, and old Garrick who's deaf in one ear.",
        "They walk round the square looking stern. It does make people feel safer, I suppose. I made their belts.",
      ],
      next: 'ask',
    },
    bye: {
      speaker: 'tanner',
      lines: ['Watch yourself on the road. Bring me something back.'],
    },
  },
};

export const GUARD: DialogueScript = {
  start: 'greet',
  nodes: {
    greet: {
      speaker: 'guard',
      lines: ['Halt! Er. I mean, good day. Keep the peace and you will have no trouble from the militia.'],
      next: 'ask',
    },
    tired: {
      speaker: 'guard',
      lines: ["Three times round the square since dawn. My feet are killing me. Don't tell the sergeant I said that."],
      next: 'ask',
    },
    bored: {
      speaker: 'guard',
      lines: ['Quiet morning. The only thing I have arrested today is a goose. It bit me.'],
      next: 'ask',
    },
    ask: {
      speaker: 'guard',
      lines: ['Something you need?'],
      choices: [
        { text: 'What are you guarding against?', next: 'wolves' },
        { text: 'Is the road safe?', next: 'road' },
        { text: 'Carry on.', next: 'bye' },
      ],
    },
    wolves: {
      speaker: 'guard',
      lines: [
        'Wolves, mostly. A pack took two of the miller\'s sheep last week, right up by the mill race.',
        "And thieves, with all these strangers on the road since the bridge went. Nobody's stolen anything yet. That's down to us, that is.",
      ],
      next: 'ask',
    },
    road: {
      speaker: 'guard',
      lines: [
        'In daylight, mostly. After dark, stay in, bar the door and keep a fire going. Wolves hate fire.',
      ],
      next: 'ask',
    },
    bye: {
      speaker: 'guard',
      lines: ['Move along, then. Peacefully.'],
    },
  },
};
