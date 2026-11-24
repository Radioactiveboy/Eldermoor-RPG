/**
 * What companions say out loud as they travel with the hero, in speech
 * bubbles (see scenes/game/chatter.ts for when). Sigrun is an old sellsword:
 * few words, dry, always looking for the next fight. Wat is a militia lad
 * barely out of his mother's kitchen: talks too much, frightens easily, means
 * well. They speak on coming somewhere, now and then along the way about the
 * weather, the hour or what's about, and when both are along they talk to
 * each other.
 */
import type { CompanionId } from '../systems/Companions';
import type { FoeKind } from '../systems/Combat';
import { atLeast, type BondLevel } from '../systems/Relationships';
import type { WeatherKind } from '../systems/Weather';
import type { AreaId } from '../world/MapData';

/** How things are, as the companions see them. */
export interface ChatterContext {
  area: AreaId;
  /** Hour of the day, 0 to 24. */
  hour: number;
  weather: WeatherKind;
  /** The map is a cold one (the watchtower, the high fells). */
  cold: boolean;
  indoor: boolean;
  underground: boolean;
  /** The hero's health, 0 to 1. */
  heroHealth: number;
  /** Who is along. */
  party: CompanionId[];
  /** Mother is still missing (the hunt for her goes on). */
  motherMissing: boolean;
  /** The goblins are coming to Adowvale tonight. */
  gateComing: boolean;
  /** A beast that might pick a fight, close by. */
  beastNear?: FoeKind;
  /** How each of them feels about the hero (see systems/Relationships.ts); missing means newly met. */
  bond?: Partial<Record<CompanionId, BondLevel>>;
}

/** One line said by one of them, and perhaps an answer from the other. */
export interface Chatter {
  /** Each is said at most once in a while (or once ever, with `once`). */
  id: string;
  who: CompanionId;
  text: string;
  /** The other's answer, said once the first has had their say. */
  reply?: { who: CompanionId; text: string };
  /** Only when this holds. */
  when?: (c: ChatterContext) => boolean;
  /** Only ever said once in a game. */
  once?: boolean;
  /** About something happening now (a beast close by, the hero hurt): said ahead of anything else that fits. */
  urgent?: boolean;
}

const night = (c: ChatterContext) => c.hour >= 21 || c.hour < 5;
const dawn = (c: ChatterContext) => c.hour >= 5 && c.hour < 7.5;
const outdoors = (c: ChatterContext) => !c.indoor;
const wet = (c: ChatterContext) => outdoors(c) && (c.weather === 'rain' || c.weather === 'drizzle' || c.weather === 'storm');
const both = (c: ChatterContext) => c.party.includes('sigrun') && c.party.includes('wat');
const wild: AreaId[] = ['world', 'plains', 'northwoods', 'greyfells'];
const inWild = (c: ChatterContext) => wild.includes(c.area);
/** Feels at least this way about the hero. */
const fond = (who: CompanionId, min: BondLevel) => (c: ChatterContext) => atLeast(c.bond?.[who] ?? 'acquainted', min);
/** Has cooled on the hero. */
const cool = (who: CompanionId) => (c: ChatterContext) => !atLeast(c.bond?.[who] ?? 'acquainted', 'acquainted');

/**
 * Said on coming into an area: the first line each of them has for a place
 * comes the first time they go there with the hero; the rest are for coming
 * back, now and then.
 */
export const ARRIVALS: Partial<Record<AreaId, Partial<Record<CompanionId, string[]>>>> = {
  home: {
    sigrun: ["Your house? ...I've seen a lot of these. Never gets easier to look at.", 'Nothing left here for you. Come on.'],
    wat: ["Oh. Oh, this was yours? I'm sorry. I didn't know it was this bad.", "I don't like it here. It still smells of smoke."],
  },
  world: {
    sigrun: ['Farm country. Good ground for an ambush, if anyone round here had the wit.', 'The Hollow again.'],
    wat: ["It's ever so quiet out here. Is it always this quiet?", "I keep thinking about the goblins coming down that hill. Don't you?"],
  },
  market: {
    sigrun: ['Walls, of a sort. Fence posts and hope.', 'Adowvale. Keep your purse close.'],
    wat: ["Back in town! If my mother sees me, let me do the talking.", "Morning, Sergeant! ...He can't hear me from here. Never mind."],
  },
  tavern: {
    sigrun: ['Godric still waters the ale. I can taste it from the door.', 'Home sweet home.'],
    wat: ["I'm not really allowed in here. Sergeant says it's where good lads go to become bad ones.", 'Can I have a cider? Just a small one?'],
  },
  cellar: {
    sigrun: ['Rats. I can smell them.'],
    wat: ['Is something moving down here? Something is definitely moving down here.'],
  },
  garrison: {
    sigrun: ["Brannock's kennel. Mind the dog. The sergeant, I mean.", 'Same old stink of boot grease.'],
    wat: ["Stand up straight, he's watching. He's always watching.", "Home! Well, it's where I sleep. On a bench."],
  },
  jail: {
    sigrun: ['If that goblin so much as breathes wrong, I want to be the one who answers it.'],
    wat: ["I've never been down here before. They don't let new lads do the cells.", "That goblin keeps looking at me. Why's it looking at me?"],
  },
  residence: {
    sigrun: ['Carpets. Must be nice.'],
    wat: ["Wipe your feet! Wipe your feet. The Headman's wife counts the mud."],
  },
  cave: {
    sigrun: ['Wolves have been through here. Lots of them. Stay behind me.', 'Watch the dark spots.'],
    wat: ["It's dark. Why is it so dark? Did anyone bring a lantern? Oh, you did. Good.", 'I can hear water dripping. At least I hope that\'s water.'],
  },
  northwoods: {
    sigrun: ['Thick trees. Archers would love this. Keep your eyes up.', 'Quiet. Too quiet, or just quiet. Hard to tell in woods.'],
    wat: ["My mother says these woods are where children go and don't come back. She says it to everyone's children.", "There's a lot of eyes in a forest, aren't there?"],
  },
  watchtower: {
    sigrun: ['Old watch post. Whoever kept it left in a hurry.'],
    wat: ['Brr! Colder in here than out there. How does that even work?'],
  },
  greyfells: {
    sigrun: ['Cold up here. Keep moving and you\'ll keep your toes.', "The wind's coming off the high fells. Snow by the week's end."],
    wat: ["It's freezing! Why does anyone live up here? Do goblins not feel the cold?", "My fingers have gone white. Is that bad? That's bad, isn't it."],
  },
  plains: {
    sigrun: ['Open ground. Nowhere to hide. I like it.', 'Long walk. Best get on with it.'],
    wat: ["Look at all that sky! I've never been this far from Adowvale. Well, once. To a wedding.", "Are there really wolves out here? There are, aren't there."],
  },
  den: {
    sigrun: ['This is where the big one lairs. Smell the bones.'],
    wat: ["I don't want to be here. I'm here, I'm not running, but I don't want to be."],
  },
  monastery: {
    sigrun: ['Monks. They never pay, and they always pray at you.'],
    wat: ['Should I take my helmet off? I think you take your helmet off near monks.'],
  },
  abbey: {
    sigrun: ["Mind your tongue in here. Brothers don't like a soldier's mouth."],
    wat: ["It's so quiet. I'm scared I'll sneeze."],
  },
  smithy: {
    sigrun: ['Osric does honest work. Ask him to look at that blade of yours.'],
    wat: ['It\'s so hot! How does he stand it all day?'],
  },
  bakery: {
    sigrun: ['Smells like the one good thing left in this village.'],
    wat: ["Hilde sometimes gives out the burnt ones for free. Not that I've ever asked. Much."],
  },
};

/** Said now and then along the way, when it fits. */
export const TRAVEL: Chatter[] = [
  // Sigrun.
  { id: 's-night', who: 'sigrun', text: 'Dark. Stay close and keep it sheathed till you need it.', when: (c) => night(c) && outdoors(c) },
  { id: 's-dawn', who: 'sigrun', text: "First light. Best time to march. Worst time to be found asleep.", when: dawn },
  { id: 's-rain', who: 'sigrun', text: "Rain. Wipe your blade tonight or it'll rust by morning.", when: wet },
  { id: 's-storm', who: 'sigrun', text: "Storm like this, nobody hears you coming. Or anything else.", when: (c) => outdoors(c) && c.weather === 'storm' },
  { id: 's-mist', who: 'sigrun', text: "Can't see ten paces. Keep talking quietly so I know where you are.", when: (c) => outdoors(c) && c.weather === 'mist' },
  { id: 's-cold', who: 'sigrun', text: "Keep moving. Cold gets you when you stand still.", when: (c) => c.cold },
  { id: 's-hurt', who: 'sigrun', text: "You're bleeding on my boots. Patch yourself up before the next one.", urgent: true, when: (c) => c.heroHealth < 0.35 },
  { id: 's-wolf', who: 'sigrun', text: 'Wolf. Over there. Let it come to us.', urgent: true, when: (c) => c.beastNear === 'wolf' },
  { id: 's-goblin', who: 'sigrun', text: "Goblin stink. They're close.", urgent: true, when: (c) => !!c.beastNear?.startsWith('goblin') },
  { id: 's-mother', who: 'sigrun', text: "We'll find her. Or find who took her. Either way, someone answers for it.", when: (c) => c.motherMissing && inWild(c) },
  { id: 's-gate', who: 'sigrun', text: 'Tonight, then. Eat something. Sleep if you can. You won\'t, but try.', when: (c) => c.gateComing },
  { id: 's-old', who: 'sigrun', text: "I fought at the Fording, twenty years back. This is quieter. For now.", when: inWild },
  { id: 's-footpad', who: 'sigrun', text: "Someone's watching us from the grass. Footpads. Let them see my sword.", urgent: true, when: (c) => c.beastNear === 'footpad' || c.beastNear === 'cutpurse' },
  { id: 's-boar', who: 'sigrun', text: "Boar. Don't. They don't stop till one of you's dead.", urgent: true, when: (c) => c.beastNear === 'boar' },
  { id: 's-feet', who: 'sigrun', text: 'Mind your footing. Twisted ankle out here and you\'re wolf food.', when: inWild },
  // Wat.
  { id: 'w-night', who: 'wat', text: 'Did you hear that? ...No? Probably nothing. Probably an owl.', when: (c) => night(c) && outdoors(c) },
  { id: 'w-dawn', who: 'wat', text: "Mum'll be lighting the stove about now. I hope she saved me some porridge.", when: dawn },
  { id: 'w-rain', who: 'wat', text: "I'm soaked right through. My mother's going to kill me. This tunic was my brother's.", when: wet },
  { id: 'w-storm', who: 'wat', text: "That thunder's close! Shouldn't we be indoors? Under something? Anything?", when: (c) => outdoors(c) && c.weather === 'storm' },
  { id: 'w-mist', who: 'wat', text: "I can't see a thing. If I walk into a tree, don't laugh.", when: (c) => outdoors(c) && c.weather === 'mist' },
  { id: 'w-cold', who: 'wat', text: "I can't feel my nose. Have I still got a nose?", when: (c) => c.cold },
  { id: 'w-hurt', who: 'wat', text: "You don't look so good. Should we stop? We can stop. I don't mind stopping.", urgent: true, when: (c) => c.heroHealth < 0.35 },
  { id: 'w-wolf', who: 'wat', text: "Is that a wolf? That's a wolf. That's a really big dog or a wolf.", urgent: true, when: (c) => c.beastNear === 'wolf' },
  { id: 'w-goblin', who: 'wat', text: "I-I think there's goblins about. Sergeant says hold the line. What line? We're two people!", urgent: true, when: (c) => !!c.beastNear?.startsWith('goblin') },
  { id: 'w-mother', who: 'wat', text: "My mum says your mum gave her a cure for her bad knee once. We'll find her. We will.", when: (c) => c.motherMissing && inWild(c) },
  { id: 'w-gate', who: 'wat', text: "They're really coming tonight, aren't they? I keep checking my spear's still pointy.", when: (c) => c.gateComing },
  { id: 'w-sergeant', who: 'wat', text: 'The sergeant would say I\'m walking like a farmer. I am a farmer. Was a farmer.', when: outdoors },
  { id: 'w-hungry', who: 'wat', text: "Are you hungry? I'm hungry. I'm always hungry. Mum says I've got hollow legs.", when: outdoors },
  { id: 'w-dark', who: 'wat', text: 'Do you think there are spiders down here? Big ones?', when: (c) => c.underground },
  { id: 'w-far', who: 'wat', text: "This is the furthest I've ever been from home. Is that sad? It feels a bit sad.", when: (c) => c.area === 'northwoods' || c.area === 'greyfells' || c.area === 'plains' },
  // How they feel about the hero shows in what they say along the way.
  { id: 's-fond', who: 'sigrun', text: "You're less useless than you were. Don't let it go to your head.", when: fond('sigrun', 'friendly') },
  { id: 's-close', who: 'sigrun', text: "I've walked beside worse. Most of them are dead. You won't be, if I've a say in it.", when: fond('sigrun', 'close'), once: true },
  { id: 's-trust', who: 'sigrun', text: 'When this is done, maybe I will go north. Find out if Astrid wants to see me. ...Forget I said that.', when: fond('sigrun', 'trusted'), once: true },
  { id: 's-cool', who: 'sigrun', text: "Walk. I'm not here to talk to you.", when: cool('sigrun') },
  { id: 'w-fond', who: 'wat', text: "I'm glad it's you I'm with. I'd be useless with anyone else. More useless.", when: fond('wat', 'friendly') },
  { id: 'w-close', who: 'wat', text: "When Mum asks who I've been with, I'm going to say my friend. Is that all right? I'm saying it anyway.", when: fond('wat', 'close'), once: true },
  { id: 'w-trust', who: 'wat', text: "I didn't run. Did you notice? I didn't run once. I think that's because of you.", when: fond('wat', 'trusted'), once: true },
  { id: 'w-cool', who: 'wat', text: "...I'll just walk back here, then. Out of the way.", when: cool('wat') },
  // Both of them, one answering the other.
  {
    id: 'p-quiet', who: 'wat', text: 'Have you killed a lot of people, Sigrun?', when: both,
    reply: { who: 'sigrun', text: 'Enough to know when to stop talking.' },
  },
  {
    id: 'p-sword', who: 'wat', text: "Is that sword heavy? It looks heavy. Can I hold it?", when: both,
    reply: { who: 'sigrun', text: 'No.' },
  },
  {
    id: 'p-cold', who: 'wat', text: "Aren't you cold, Sigrun?", when: (c) => both(c) && c.cold,
    reply: { who: 'sigrun', text: "Yes. I just don't go on about it." },
  },
  {
    id: 'p-rain', who: 'sigrun', text: 'Stop wringing out your sleeves, lad. They\'ll only get wet again.', when: (c) => both(c) && wet(c),
    reply: { who: 'wat', text: 'It makes me feel better though.' },
  },
  {
    id: 'p-night', who: 'wat', text: "Sigrun? Sigrun, are you awake? Oh, we're walking. Course you're awake.", when: (c) => both(c) && night(c),
    reply: { who: 'sigrun', text: 'Barely.' },
  },
  {
    id: 'p-mum', who: 'sigrun', text: 'Your mother know you\'re out here?', when: both, once: true,
    reply: { who: 'wat', text: "She thinks I'm on gate duty. Please don't tell her." },
  },
  {
    id: 'p-brave', who: 'wat', text: "Do you ever get scared, Sigrun?", when: (c) => both(c) && inWild(c), once: true,
    reply: { who: 'sigrun', text: "Every time. The trick's to be scared after." },
  },
  {
    id: 'p-friends', who: 'wat', text: "Sigrun, do you think we're friends? The three of us?", when: (c) => both(c) && fond('sigrun', 'friendly')(c) && fond('wat', 'friendly')(c), once: true,
    reply: { who: 'sigrun', text: "...Don't make me say it, lad." },
  },
  {
    id: 'p-goblin', who: 'sigrun', text: 'Spear point down, Wat. You\'ll have someone\'s eye out.', when: (c) => both(c) && c.gateComing,
    reply: { who: 'wat', text: "Sorry! Sorry. It's just... they're coming, aren't they." },
  },
];

/** The lines that fit now, for who's along: those each could say, and those needing both. */
export function chatterThatFits(c: ChatterContext, lines: readonly Chatter[] = TRAVEL): Chatter[] {
  return lines.filter((l) => c.party.includes(l.who) && (!l.reply || c.party.includes(l.reply.who)) && (!l.when || l.when(c)));
}
