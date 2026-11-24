/**
 * What the market crowd talk about (see scenes/game/marketCrowd.ts): the folk
 * strolling about Adowvale's square by day, overheard in speech bubbles rather
 * than spoken to. What they say follows what's been happening: the weather,
 * the hour, the hero's deeds out on the plains, the militia's notices and,
 * once the goblins have come, nothing else. Fresh news is talked about first,
 * so something that's just happened is the first thing the hero overhears.
 * No Phaser in here, so it's tested on its own.
 */
import type { RoadOutcome } from '../systems/Reputation';
import type { WeatherKind } from '../systems/Weather';

/** Everything the crowd might have heard about, as it stands. */
export interface TownNews {
  /** Hour of the day, 0..24. */
  hour: number;
  weather: WeatherKind;
  /** The goblins have burnt the farm in the Hollow and taken Mother (dialogue/afterRaid.ts). */
  raidOver: boolean;
  /** Mother is sick with the fever, and the hero is out looking for medicine. */
  motherSick: boolean;
  /** The hero brought the tincture home, and she's on the mend. */
  motherWell: boolean;
  paidToll: boolean;
  slewWolfMother: boolean;
  /** Wil the drover's lost ewes, Bess and Bramble ('lost-sheep'). */
  sheep: 'none' | 'active' | 'done';
  /** Godric's cellar rats ('cellar-rats'). */
  rats: 'none' | 'active' | 'done';
  /** Iran's chicken feed ('chicken-feed'). */
  feed: 'none' | 'active' | 'done';
  monasteryOpen: boolean;
  foundCaveDoor: boolean;
  footpads?: RoadOutcome;
  goat?: RoadOutcome;
  courier?: RoadOutcome;
  /** Militia bounties the hero has claimed. */
  bounties: number;
  /** Ashes is over (dialogue/afterAshes.ts): how it went, as the square tells it. */
  ashes?: { held: boolean; freed?: 'hilde' | 'coombe'; penned?: 'hilde' | 'coombe' };
}

/**
 * One thing said: a remark to nobody in particular (one line), or a word
 * between two of them (two lines, the second said back by whoever's nearest).
 */
export interface Gossip {
  /** Which story it is, so it's only fresh news once. */
  id: string;
  lines: string[];
  /** News (what's happened, rather than idle talk), which is talked about first, while it's fresh. */
  news?: boolean;
}

/**
 * Everything the crowd might say now, newest news first: the raid, then the
 * hero's deeds, the weather and the time of day, then idle talk.
 */
export function crowdGossip(n: TownNews): Gossip[] {
  const out: Gossip[] = [];
  const news = (id: string, ...lines: string[]) => out.push({ id, lines, news: true });
  const talk = (id: string, ...lines: string[]) => out.push({ id, lines });

  if (n.ashes) {
    // Once the hero has carried Mother home from under the hill and buried her: the story everyone tells, quietly, and proudly.
    const a = n.ashes;
    news('ashes-warren', "He went down the goblins' hole on the Greyfells. Down it! And came back up.", 'With his mother in his arms, Odo says. Gone, poor soul.');
    news('ashes-brute', "The big one that burnt the Hollow's dead. The Brute, they called it. Him that did it, down there.", 'Good. I hope it hurt.');
    if (a.held) news('ashes-road', "Brannock's lads are still telling the night on the old road. It gets bigger every time.", 'Garrick killed eleven, last I heard. Last week it was two.');
    else news('ashes-bakery', "Osric's clearing the ash out of Hilde's bakery every morning before he lights his own forge.", "He'd never say so, but he's been sweet on her thirty years.");
    if (a.freed === 'hilde') news('ashes-hilde', "Hilde's back! Walked in at the gate at dawn with a rock in her fist, they say.", "She's at the Tankard. Godric's feeding her up.");
    if (a.freed === 'coombe') news('ashes-coombe', 'Old Coombe stood a round at the Tankard last night. Coombe!', 'The goblins must have knocked something loose.');
    if (a.penned === 'hilde') news('ashes-hilde-lost', 'Still no word of Hilde.', "Don't. I can't.");
    talk('ashes-grave', "Iran's keeping her grave in the Hollow, I hear. His little girl takes it flowers.");
    talk('ashes-gates', "Gates still barred at dusk. The sergeant says till he's sure.", 'Sure of what?');
    talk('ashes-hero', "That's him. No, don't stare. Let the lad be.");
    talk('ashes-morten', '"Gratified," Lord Morten wrote. Gratified! The Headman read it out to the whole square.');
    if (a.held) talk('ashes-eggs', "No eggs on the end of Hilde's stall since. She'll not have another egg-woman, she says.");
  } else if (n.raidOver) {
    // Since the goblins came, nobody talks of anything else, and they keep their voices down.
    news('raid-hollow', 'Burnt to the ground, the whole farm in the Hollow. Goblins, they say.', 'Goblins. In my grandmother\'s day that was a story to frighten children.');
    news('raid-mother', 'And they took his mother. Took her. What do goblins want with a woman?', "Hush. Don't. Not where he can hear.");
    news('raid-iran', "Iran's barred himself in with his two little ones. Hilde's sending bread down with the carter.");
    news('raid-gates', "The sergeant's shutting the gates at dusk now. First time since the old war.", 'Good. I\'ll not sleep easy till they\'ve found where those things came from.');
    talk('raid-lock', "I've put a bar on the back door. Never needed one in thirty years.");
    talk('raid-north', 'Fires in the north woods at night, the shepherds say. Lots of little fires.');
    talk('raid-children', "I'm keeping mine indoors after noon. Don't you look at me like that.");
    talk('raid-quiet', 'Quiet market today. Folk are frightened to come in from the farms.');
    talk('raid-pray', "The brothers at Saint Elda's are ringing for her, morning and evening. For his mother.");
  }

  if (n.slewWolfMother) {
    news('wolf-mother', "The great white wolf's dead! Somebody went out to her den on the plains and killed her.", 'The monks rang their bell for an hour. I heard it from my garden.');
  }
  if (n.sheep === 'done') {
    news('sheep', "Wil the drover's ewes turned up, I hear. Down a cave in the hill, of all places.", 'Bess and Bramble? Ha. Wil was beside himself.');
  } else if (n.sheep === 'active') {
    talk('sheep-lost', "Wil's still hunting high and low for those two ewes of his. Wolves, I'd say. Poor beasts.");
  }
  if (n.foundCaveDoor) {
    news('cave-door', "They say there's a door in the wolves' cave. A door! Under the hill!", "Old Harlan's been saying that for years. Nobody listens to Harlan.");
  }
  if (n.rats === 'done') {
    news('rats', "Godric's cellar's clear of rats at last. He's telling everyone he did it himself.");
  } else if (n.rats === 'active') {
    talk('rats-active', "Rats in the Tankard's cellar the size of cats, Godric says. I'll take my ale in the yard, thank you.");
  }
  if (n.feed === 'done') {
    news('feed', "Iran's hens are laying again, now they've proper feed. Eggs back at Hilde's stall tomorrow.");
  }
  if (n.monasteryOpen) {
    news('monastery', "Saint Elda's have opened their gate again. Brother Hob's been in for leeks.");
  }
  const footpads: Partial<Record<RoadOutcome, string[]>> = {
    fought: ['Two footpads on the Lord\'s Road got a proper hiding, I heard.', 'About time somebody did.'],
    paid: ['Somebody paid those footpads on the Lord\'s Road. Paid them! Encourages them, that does.'],
    scared: ['Rook the footpad turned tail and ran, they say. Ran!', 'From who?'],
  };
  if (n.footpads && footpads[n.footpads]) news(`footpads-${n.footpads}`, ...footpads[n.footpads]!);
  if (n.goat === 'found') news('goat', "Little Mags got her goat back. She's told the whole square. Twice.");
  if (n.courier === 'fed') news('courier', "Lord Morten's messenger was found on the road half starved. Somebody fed him, kind soul.");
  if (n.bounties >= 1) {
    news(`bounties-${Math.min(n.bounties, 3)}`, n.bounties >= 3
      ? "Another of the militia's notices taken down. Somebody's earning their keep."
      : "Somebody's been taking the notices off the militia's board.", "Better them than the militia. The militia can't find their own feet.");
  }
  if (n.paidToll) talk('toll-paid', "Morten's gate's open for someone, then. A hundred coins! I'd want gold paving for that.");
  else talk('toll', "A hundred coins to use the Lord's Road now. A hundred! Lord Morten's having a laugh.");

  if (!n.raidOver) {
    if (n.motherWell) news('mother-well', "His mother's up and about again, they say. The fever's broken.", 'Thank the Saint. She was poorly a long while.');
    else if (n.motherSick) talk('mother-sick', "The lad from the Hollow's after medicine for his mother. Fever, I heard.", 'Moonpetal, he wants. The brothers grow it, if they\'d ever open that gate.');
  }

  // The weather, while it lasts.
  const weather: Partial<Record<WeatherKind, Gossip['lines']>> = {
    rain: ["Look at it come down. My washing's still out on the line."],
    drizzle: ['Only a drizzle. It\'ll clear.', "You said that yesterday."],
    storm: ['Hear that thunder! Get under cover, you daft lump!'],
    mist: ["Can't see the far side of the square in this murk."],
    overcast: ['Clouding over. Rain by evening, you mark me.'],
    clear: ["Lovely day for it. Wish I'd nothing to carry."],
  };
  const sky = weather[n.weather];
  if (sky) (n.weather === 'rain' || n.weather === 'storm' ? news : talk)(`weather-${n.weather}`, ...sky);

  // The hour.
  if (n.hour < 10) talk('morning', n.raidOver ? "Hilde's loaves are out. Get some while there's some." : "Smell that? Hilde's first loaves. I'll be in that queue.");
  else if (n.hour < 13) talk('noon', n.raidOver ? 'Noon already. The days go so slow and so quick now.' : "Osric's at his anvil again. You can hear it from the well.");
  else talk('afternoon', n.raidOver ? 'I want to be home well before dark.' : "Stalls'll be shutting soon. I've still not got the thread I came for.");

  // Idle talk, as ever (more cheerful before the raid).
  if (!n.raidOver) {
    talk('bridge', "Harrowford bridge still down. My cousin's stuck the far side of the river.", 'Lucky cousin.');
    talk('tamsin', "Tamsin's leather's dear this year.", 'It always is. Smells it, too.');
    talk('pell', "That minstrel at the Tankard knows one song. One. I've heard it forty times.");
    talk('well', 'Mind the well, little one!');
    talk('fenwick', "Fenwick the wool man's in town, in a hat like a cartwheel.");
    talk('hens', "My hens have stopped laying. It's the weather. Or the fox. Or the weather.");
  }
  return out;
}

/**
 * What to say next: the newest news nobody's talked about yet, if there is
 * any, or else anything at random. `heard` is what's been said already, kept
 * by the caller; news said once is just talk after that.
 * @param pairOnly only words between two (for the two gossiping at the well), if there are any
 */
export function pickGossip(pool: Gossip[], heard: ReadonlySet<string>, random = Math.random, pairOnly = false): Gossip | undefined {
  const fit = pairOnly ? pool.filter((g) => g.lines.length > 1) : pool;
  const from = fit.length > 0 ? fit : pool;
  const fresh = from.find((g) => g.news && !heard.has(g.id));
  if (fresh) return fresh;
  // Nothing that's just been said, where there's anything else.
  const recent = [...heard].slice(-RECENT);
  const others = from.filter((g) => !recent.includes(g.id));
  const choice = others.length > 0 ? others : from;
  return choice[Math.floor(random() * choice.length)];
}

/** How many of the last things said aren't said again straight away. */
const RECENT = 4;

/** What the two children running about the square shout to each other. */
export function childrensChatter(n: TownNews): Gossip[] {
  const out: Gossip[] = [];
  const say = (id: string, ...lines: string[]) => out.push({ id: `child-${id}`, lines });
  if (n.raidOver) {
    say('goblins', 'Ma says goblins eat children.', "They don't! ...Do they?");
    say('home', "We've to be home before the bell. Ma said.");
    say('brave', "If a goblin came I'd hit it with a stick.", "You would not. You'd cry.");
    return out;
  }
  say('race', 'Race you to the well!', 'Not fair, you started first!');
  say('cake', "D'you think Hilde'll give us a crust if we ask nicely?");
  say('tag', "You're it!", "Wasn't touching! Wasn't!");
  say('smith', 'I\'m going to be a smith like Osric when I\'m big.');
  if (n.slewWolfMother) say('wolf', "I'm the wolf-killer! Rrraah!", "No, I'm the wolf-killer, you be the wolf!");
  if (n.weather === 'rain' || n.weather === 'drizzle' || n.weather === 'storm') say('puddle', 'Jump in it! Jump in it!');
  return out;
}

/**
 * What a passer-by says as the hero goes by, now and then: nothing, until
 * the hero has done something worth remarking on.
 */
export function heroRemarks(n: TownNews): string[] {
  if (n.raidOver) return ["That's him. The lad from the Hollow. ...Poor soul.", "Gods keep you, lad. I hope you find her.", "If there's aught you need, you've only to ask."];
  const out: string[] = [];
  if (n.slewWolfMother) out.push("That's him! The one who killed the white wolf!", 'Mind your manners, Ned, that\'s the wolf-killer.');
  if (n.footpads === 'fought' || n.footpads === 'scared') out.push('Is that the one who saw off the footpads?');
  if (n.bounties >= 2) out.push('Morning! Taken any more of those notices?');
  if (n.motherSick && !n.motherWell) out.push('How\'s your mother, lad? Any better?');
  if (n.motherWell) out.push('Give your mother our best, lad!');
  return out;
}
