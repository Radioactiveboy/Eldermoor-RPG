import type { DialogueScript } from './Dialogue';

/**
 * Folk travelling the road past the cottage. They don't start quests; they
 * pass the time of day and know a little about Eldermoor and what's around it.
 * Each has a first meeting, a shorter hello afterwards, and a few things to ask.
 */

export const PEDLAR: DialogueScript = {
  start: 'greet',
  nodes: {
    greet: {
      speaker: 'pedlar',
      lines: [
        "Ho there! Mind the pack, it swings. Bram's the name, needles and news, buttons and gossip, all for sale.",
        "Well. I say for sale. The Harrowford fair picked me clean, so mostly it's the news I've got left.",
      ],
      next: 'ask',
    },
    again: {
      speaker: 'pedlar',
      lines: ['Back for more news? Cheapest thing in my pack. Free, in fact.'],
      next: 'ask',
    },
    ask: {
      speaker: 'pedlar',
      lines: ['What would you know?'],
      choices: [
        { text: 'Why come this way? Nobody uses this road.', next: 'road' },
        { text: 'What news from the towns?', next: 'news' },
        { text: 'What are those stones up on the moor?', next: 'stones' },
        { text: 'Safe travels, Bram.', next: 'bye' },
      ],
    },
    road: {
      speaker: 'pedlar',
      lines: [
        "Floods took the bridge at Harrowford, so the King's Road's no good till spring. This old track goes round by the lake instead.",
        'Longer, mind. And quieter than I like. A quiet road is one where nobody hears you shout.',
      ],
      next: 'ask',
    },
    news: {
      speaker: 'pedlar',
      lines: [
        "Wolves, mostly. They've come down out of the Greyfells early this year. Lean ones. Hungry ones.",
        "A farmer by Thornwick lost half his flock in a night. Keep a stick handy if you walk out after dark, that's my advice.",
      ],
      next: 'ask',
    },
    stones: {
      speaker: 'pedlar',
      lines: [
        "The Nine Maidens? Older than the village, older than anyone's grandmother's grandmother.",
        "Folk say they were dancers turned to stone for dancing on a holy day. I say they're good for keeping the wind off while you eat your lunch.",
      ],
      next: 'ask',
    },
    bye: {
      speaker: 'pedlar',
      lines: ['And to you. If you hear of anyone wanting thimbles, send them my way.'],
    },
  },
};

export const PILGRIM: DialogueScript = {
  start: 'greet',
  nodes: {
    greet: {
      speaker: 'pilgrim',
      lines: [
        'Peace on your house, child. I am Sister Ysolde, walking to the shrine of Saint Elda at the edge of the moor.',
        'I have been walking since the new moon. My feet would like a word with the saint when I get there.',
      ],
      next: 'ask',
    },
    again: {
      speaker: 'pilgrim',
      lines: ['Peace on you again, child.'],
      next: 'ask',
    },
    ask: {
      speaker: 'pilgrim',
      lines: ['Is there something on your mind?'],
      choices: [
        { text: 'Who was Saint Elda?', next: 'elda' },
        { text: 'My mother is sick. Do you know of moonpetal?', next: 'moonpetal' },
        { text: 'Why walk all this way?', next: 'why' },
        { text: 'Go safely, Sister.', next: 'bye' },
      ],
    },
    elda: {
      speaker: 'pilgrim',
      lines: [
        'A healer, long ago, when this was all bog and heather. They say she walked the moor with a lantern, finding the lost and tending the sick.',
        "Eldermoor is her moor: Elda's moor. The village took her name, though most have forgotten why.",
      ],
      next: 'ask',
    },
    moonpetal: {
      speaker: 'pilgrim',
      lines: [
        "Moonpetal... a pale flower. It grows by still water and only opens under the moon. Saint Elda's own remedy, the stories say.",
        'Any healer worth her salt keeps some dried. I will remember your mother at the shrine.',
      ],
      next: 'ask',
    },
    why: {
      speaker: 'pilgrim',
      lines: [
        'I made a promise, years ago, to someone who could no longer make the walk themselves.',
        'Some promises you keep with your feet.',
      ],
      next: 'ask',
    },
    bye: {
      speaker: 'pilgrim',
      lines: ['And you, child. Keep a light by you after dark.'],
    },
  },
};

export const DROVER: DialogueScript = {
  start: 'greet',
  nodes: {
    greet: {
      speaker: 'drover',
      lines: [
        "Oh! Sorry, you made me jump. Wil. I'm a drover, or I was meant to be, driving Master Coombe's ewes to market.",
        "Only I've lost two of them. Again. He'll have my hide.",
      ],
      next: 'ask',
    },
    again: {
      speaker: 'drover',
      lines: ["Still no sign of them. You'd think sheep would be easier to find. They're white."],
      next: 'ask',
    },
    ask: {
      speaker: 'drover',
      lines: ['You live round here?'],
      choices: [
        { text: 'How did you lose them?', next: 'lost' },
        { text: 'Tell me about the lake.', next: 'lake' },
        { text: 'Seen anything strange on the road?', next: 'strange' },
        { text: 'Good luck finding them.', next: 'bye' },
      ],
    },
    lost: {
      speaker: 'drover',
      lines: [
        "Something spooked them last night by the lake. I found tracks in the mud this morning. Big ones. Bigger than a dog's.",
        "I'm not saying it was a wolf. I'm just saying I'm not going back to look on my own.",
      ],
      next: 'ask',
    },
    lake: {
      speaker: 'drover',
      lines: [
        "Mirrormere, my gran called it. Still as glass on a calm day. There's a chapel at the bottom, she said, drowned when the river changed its course.",
        "On quiet nights you can hear its bell. I've never heard it. I've never stayed out late enough to try.",
      ],
      next: 'ask',
    },
    strange: {
      speaker: 'drover',
      lines: [
        "There's a pedlar with a pack bigger than he is, and a holy sister who walks slower than my sheep. That's about all.",
        "Oh, and the birds have all gone quiet down by the trees past your garden. Birds don't go quiet for nothing.",
      ],
      next: 'ask',
    },
    bye: {
      speaker: 'drover',
      lines: ['Thanks. If you see two ewes looking guilty, they answer to Bess and Bramble.'],
    },
  },
};
