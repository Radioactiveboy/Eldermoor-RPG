/**
 * The market crowd (world/MarketMap.ts's MARKET_CROWD): Adowvale folk about
 * the square by day, nobody to talk to, but heard as the hero goes by. Every
 * so often one of them says something in a bubble over their head (what's on
 * their minds is in dialogue/marketCrowd.ts, and follows what's been
 * happening), and the two gossiping by the well talk back and forth.
 */
import { childrensChatter, crowdGossip, Gossip, heroRemarks, pickGossip, TownNews } from '../../dialogue/marketCrowd';
import { raidIsOver } from '../../dialogue/afterRaid';
import type { Npc } from '../../entities/Npc';
import { Bounties } from '../../systems/Bounties';
import { QuestLog } from '../../systems/Quests';
import { Reputation } from '../../systems/Reputation';
import { Weather } from '../../systems/Weather';
import type { GameScene } from '../GameScene';

/** Seconds between one of them piping up and the next. */
const CHAT_GAP = [7, 13];
/** Seconds before a passer-by remarks on the hero again. */
const REMARK_GAP = [30, 50];
/** How close (tiles) the hero walks by for a passer-by to remark on them. */
const REMARK_RANGE = 2.2;
/** Only those this near the hero speak up (about what's on screen). */
const EARSHOT = 11;
/** The two gossiping by the well, who talk to each other rather than to the square. */
const PAIR = ['crowd-matron', 'crowd-elder'];
/** The two children running about the square. */
const CHILDREN = ['crowd-boy', 'crowd-girl'];

/** What's been said since the game started, oldest first: news only comes fresh once. */
const heard = new Set<string>();
/**
 * Seconds (of the game's own time, as the bubbles count it) until the next of
 * them speaks up, and until the next passes remark on the hero.
 */
let nextChat = 0;
let nextRemark = 0;
/** An answer waiting for the first speaker to finish: who says it, and in how long. */
let answer: { who: Npc; to: Npc; text: string; in: number } | undefined;

/** How things stand, as far as the square has heard. */
export function townNews(hour: number): TownNews {
  const stage = (id: string): TownNews['sheep'] => {
    const q = QuestLog.get(id);
    return !q ? 'none' : q.completed ? 'done' : 'active';
  };
  const medicine = QuestLog.get('mother-medicine');
  return {
    hour,
    weather: Weather.now.kind,
    raidOver: raidIsOver(),
    motherSick: !!medicine && !medicine.completed,
    motherWell: !!medicine?.completed,
    paidToll: QuestLog.hasFlag('paid-toll'),
    slewWolfMother: QuestLog.hasFlag('slew-wolf-mother'),
    sheep: stage('lost-sheep'),
    rats: stage('cellar-rats'),
    feed: stage('chicken-feed'),
    monasteryOpen: QuestLog.hasFlag('monastery-open'),
    foundCaveDoor: QuestLog.hasFlag('found-cave-door'),
    footpads: Reputation.last('footpads'),
    goat: Reputation.last('goat'),
    courier: Reputation.last('courier'),
    bounties: Bounties.timesClaimed(),
  };
}

/** Into the square: the first of them speaks up soon after, so fresh news is the first thing heard. */
export function enteredMarketCrowd(): void {
  nextChat = 3;
  nextRemark = 8;
  answer = undefined;
}

const between = ([lo, hi]: number[]) => lo + Math.random() * (hi - lo);

/** How long a bubble stays up, by how much there is to read. */
const readingTime = (text: string) => Math.min(6.5, 2.6 + text.length * 0.045);

/** Once a frame in the market: now and then, one of the crowd says something. */
export function updateMarketCrowd(g: GameScene, dt: number): void {
  if (g.area !== 'market' || g.busy || g.inCombat) return;
  if (answer) {
    answer.in -= dt;
    if (answer.in <= 0) {
      const { who, to, text } = answer;
      answer = undefined;
      if (who.present && !who.speech) {
        who.faceTowards(to.gx, to.gy);
        who.say(text, readingTime(text));
      }
    }
  }
  nextChat -= dt;
  nextRemark -= dt;
  const crowd = g.npcs.filter((n) => n.id.startsWith('crowd-') && n.present);
  if (crowd.length === 0) return;
  const hero = { x: g.player.gx, y: g.player.gy };

  if (nextRemark <= 0) {
    const by = crowd.find((n) => !n.speech && n.distanceTo(hero.x, hero.y) < REMARK_RANGE && !PAIR.includes(n.id));
    const remarks = by ? heroRemarks(townNews(g.clock.hour)) : [];
    if (by && remarks.length > 0) {
      const text = remarks[Math.floor(Math.random() * remarks.length)];
      by.faceTowards(hero.x, hero.y);
      by.say(text, readingTime(text));
      nextRemark = between(REMARK_GAP);
      nextChat = Math.max(nextChat, 3.5);
      return;
    }
  }

  if (nextChat > 0 || answer) return;
  nextChat = between(CHAT_GAP);
  const near = crowd.filter((n) => !n.speech && n.distanceTo(hero.x, hero.y) < EARSHOT && quietAround(g, n));
  if (near.length === 0) return;
  const pool = crowdGossip(townNews(g.clock.hour));
  const pair = PAIR.map((id) => near.find((n) => n.id === id));
  if (pair[0] && pair[1] && Math.random() < 0.45) {
    const [a, b] = Math.random() < 0.5 ? pair : [pair[1], pair[0]];
    speak(pickGossip(pool, heard, Math.random, true), a!, b!);
    return;
  }
  const loners = near.filter((n) => !PAIR.includes(n.id));
  const who = (loners.length > 0 ? loners : near)[Math.floor(Math.random() * (loners.length || near.length))];
  // The children have their own concerns.
  const gossip = CHILDREN.includes(who.id) ? pickGossip(childrensChatter(townNews(g.clock.hour)), heard) : pickGossip(pool, heard);
  // A reply comes from whoever's close by to hear it (if anyone).
  const reply = crowd.filter((n) => n !== who && !n.speech && n.distanceTo(who.gx, who.gy) < 4 && CHILDREN.includes(n.id) === CHILDREN.includes(who.id))
    .sort((p, q) => p.distanceTo(who.gx, who.gy) - q.distanceTo(who.gx, who.gy))[0];
  speak(gossip, who, reply);
}

/** No-one else is talking right beside them (so the bubbles don't pile up on each other). */
function quietAround(g: GameScene, n: Npc): boolean {
  return !g.npcs.some((o) => o !== n && o.speech && o.distanceTo(n.gx, n.gy) < 3);
}

/** One of them says their piece, and if it's a word between two, the other answers once they've finished. */
function speak(gossip: Gossip | undefined, who: Npc, reply?: Npc): void {
  if (!gossip) return;
  heard.delete(gossip.id);
  heard.add(gossip.id);
  const [first, second] = gossip.lines;
  if (reply && second) {
    who.faceTowards(reply.gx, reply.gy);
    reply.faceTowards(who.gx, who.gy);
  }
  const wait = readingTime(first);
  who.say(first, wait);
  if (!reply || !second) return;
  answer = { who: reply, to: who, text: second, in: wait + 0.3 };
  nextChat += wait;
}
