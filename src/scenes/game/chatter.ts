/**
 * Companions talking as they travel (the lines are in dialogue/companionChatter.ts):
 * a word on coming somewhere, now and then something about the weather, the
 * hour or a beast nearby, and the two of them talking to each other when both
 * are along. Other parts of the story can have a companion say something with
 * companionRemark.
 */
import { ARRIVALS, Chatter, ChatterContext, chatterThatFits } from '../../dialogue/companionChatter';
import type { CompanionId } from '../../systems/Companions';
import { QuestLog } from '../../systems/Quests';
import { SaveGame } from '../../systems/SaveGame';
import { Weather } from '../../systems/Weather';
import type { Companion } from '../../entities/Companion';
import type { GameScene } from '../GameScene';

/** Seconds between one remark along the way and the next (a few, with ?chatter=fast, for trying lines out). */
const GAP = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('chatter') === 'fast' ? [4, 7] : [50, 95];
/** Seconds before a line can be said again. */
const AGAIN = 600;
/** How likely they are to say something on coming back somewhere they've been. */
const AGAIN_ON_ARRIVAL = 0.35;
/** Seconds after arriving before the arrival line. */
const ARRIVAL_DELAY = 2.2;
/** A beast this close (tiles), that might pick a fight, gets a word. */
const BEAST_NEAR = 9;

/** Lines said only once (and arrival lines, `<who>:<area>`), kept with the save. */
const spent = new Set<string>();
/** Play-seconds since the game started (counting only time out of conversations and fights), and when each line was last said. */
let clock = 0;
const lastSaid = new Map<string, number>();
let nextLine = GAP[0];
/** Lines waiting their turn: an arrival line, an answer, or a remark from elsewhere. */
let queue: Array<{ who: CompanionId; text: string; in: number }> = [];
/** The beast last remarked on, so the same one doesn't get a word twice. */
let lastBeast: unknown;

const between = ([lo, hi]: number[]) => lo + Math.random() * (hi - lo);
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)];

/** How long a bubble stays up, by how much there is to read. */
export const readingTime = (text: string) => Math.min(7, 2.6 + text.length * 0.05);

export function resetChatter(): void {
  spent.clear();
  lastSaid.clear();
  clock = 0;
  nextLine = GAP[0];
  queue = [];
  lastBeast = undefined;
}

/** How things are, as the companions see them. */
export function chatterContext(g: GameScene): ChatterContext {
  const data = g.map.data;
  const hero = { x: g.player.gx, y: g.player.gy };
  const beast = g.creatures.find((c) => c.prowling && c.distanceTo(hero.x, hero.y) < BEAST_NEAR);
  const gate = QuestLog.get('the-gate');
  return {
    area: g.area,
    hour: g.clock.hour,
    weather: Weather.now.kind,
    cold: !!data.cold || g.area === 'greyfells',
    indoor: !!data.indoor,
    underground: !!data.underground,
    heroHealth: g.stats.health / g.stats.maxHealth,
    party: g.companions.filter((c) => !c.isGone).map((c) => c.id),
    motherMissing: QuestLog.hasFlag('raid-over') && !QuestLog.get('the-raid')?.completed,
    gateComing: !!gate && !gate.completed,
    beastNear: beast?.kind,
  };
}

/** Coming into an area with company: one of them has a word for it, soon after. */
export function companionsArrived(g: GameScene): void {
  queue = [];
  if (g.companions.length === 0) return;
  nextLine = Math.max(nextLine, between([GAP[0] * 0.5, GAP[0] * 0.9]));
  const here = ARRIVALS[g.area];
  if (!here) return;
  const who = g.companions.map((c) => c.id).filter((id) => here[id]?.length);
  if (who.length === 0) return;
  // Somewhere new to one of them: that one speaks.
  const fresh = who.filter((id) => !spent.has(`${id}:${g.area}`));
  if (fresh.length > 0) {
    const id = pick(fresh);
    spent.add(`${id}:${g.area}`);
    queue.push({ who: id, text: here[id]![0], in: ARRIVAL_DELAY });
    return;
  }
  if (Math.random() > AGAIN_ON_ARRIVAL) return;
  const id = pick(who);
  const lines = here[id]!;
  queue.push({ who: id, text: lines.length > 1 ? pick(lines.slice(1)) : lines[0], in: ARRIVAL_DELAY });
}

/**
 * Have one of the hero's companions say something out loud, for other parts
 * of the story to use (a word about the cold on the fells, say). Give a line
 * for each who might say it; one of those along says theirs. With `once`, it's
 * said only the first time that key is used in a game. Returns whether anyone
 * was there to say it.
 */
export function companionRemark(
  g: GameScene,
  lines: Partial<Record<CompanionId, string>>,
  opts: { once?: string; delay?: number } = {},
): boolean {
  if (opts.once && spent.has(opts.once)) return false;
  const who = g.companions.filter((c) => !c.isGone && lines[c.id]).map((c) => c.id);
  if (who.length === 0) return false;
  if (opts.once) spent.add(opts.once);
  const id = pick(who);
  queue.push({ who: id, text: lines[id]!, in: opts.delay ?? 0.5 });
  return true;
}

/** Once a frame: whoever's along says something now and then. */
export function updateChatter(g: GameScene, dt: number): void {
  if (g.companions.length === 0 || g.busy || g.inCombat) return;
  clock += dt;
  if (queue.length > 0) {
    const next = queue[0];
    next.in -= dt;
    if (next.in <= 0) {
      queue.shift();
      say(g, next.who, next.text);
    }
    return;
  }
  // Someone's still talking (a word after a fight, say): let them finish.
  if (g.companions.some((c) => c.speech)) return;
  const c = chatterContext(g);
  if (c.beastNear && lastBeast !== c.beastNear) {
    lastBeast = c.beastNear;
    nextLine = Math.min(nextLine, 0.8);
  } else if (!c.beastNear) {
    lastBeast = undefined;
  }
  nextLine -= dt;
  if (nextLine > 0) return;
  nextLine = between(GAP);
  const line = chooseChatter(c);
  if (line) speak(g, line);
}

/**
 * What to say now, of the lines that fit and haven't been said lately: a
 * word about a beast close by, or how hurt the hero is, comes first.
 */
export function chooseChatter(c: ChatterContext, rand = Math.random): Chatter | undefined {
  const ready = chatterThatFits(c).filter((l) => !spent.has(l.id) && (lastSaid.get(l.id) ?? -Infinity) <= clock - AGAIN);
  const urgent = ready.filter((l) => l.urgent);
  const from = urgent.length > 0 ? urgent : ready;
  return from.length > 0 ? from[Math.floor(rand() * from.length)] : undefined;
}

function speak(g: GameScene, line: Chatter): void {
  lastSaid.set(line.id, clock);
  if (line.once) spent.add(line.id);
  say(g, line.who, line.text);
  if (line.reply) queue.push({ who: line.reply.who, text: line.reply.text, in: readingTime(line.text) + 0.3 });
}

function say(g: GameScene, id: CompanionId, text: string): void {
  const c: Companion | undefined = g.companions.find((x) => x.id === id && !x.isGone);
  c?.say(text, readingTime(text));
}

SaveGame.register('chatter', {
  save: () => [...spent],
  load: (data) => {
    resetChatter();
    if (Array.isArray(data)) for (const k of data) if (typeof k === 'string') spent.add(k);
  },
});
