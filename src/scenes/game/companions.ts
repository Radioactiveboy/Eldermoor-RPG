/**
 * Companions in the world (see systems/Companions.ts for who they are and
 * entities/Companion.ts for how they walk): bringing them along into each
 * area behind the hero, asking someone to come or sending them home, and
 * talking to whoever is following.
 */
import { DialogueChoice, DialogueNode, DialogueScript, SpeakerId } from '../../dialogue/Dialogue';
import { Companion, Trail } from '../../entities/Companion';
import { Npc } from '../../entities/Npc';
import { Vec2 } from '../../iso/IsoMath';
import { COMPANIONS, CompanionId, Companions, isCompanion, MAX_PARTY, maxHpOf } from '../../systems/Companions';
import { Experience } from '../../systems/Experience';
import { Inventory } from '../../systems/Inventory';
import { QuestLog } from '../../systems/Quests';
import type { GameScene } from '../GameScene';
import type { Interaction } from './interactions';

/** How close the hero has to come to talk to someone following them (they're always close, so it's kept short). */
const FOLLOWER_TALK_RANGE = 0.85;

/** The companion an NPC stands for, where they wait to be asked. */
function companionAt(npcId: string): CompanionId | undefined {
  return Object.values(COMPANIONS).find((c) => c.npc === npcId)?.id;
}

/** Whether they'll come at all yet (some only once the story has got so far). */
function willCome(id: CompanionId): boolean {
  const needs = COMPANIONS[id].needs;
  return !needs || QuestLog.hasFlag(needs);
}

/** What they want to come, now (nothing if someone else is paying). */
export function priceOf(id: CompanionId): number {
  const hire = COMPANIONS[id].hire;
  if (!hire || Companions.isRecruited(id)) return 0;
  return hire.freeFlag && QuestLog.hasFlag(hire.freeFlag) ? 0 : hire.coins;
}

/**
 * Whether an NPC on the map stays out of sight: someone travelling with the
 * hero isn't also waiting at home, and someone who won't come yet (the
 * militia lad before the raid) isn't there to be asked.
 */
export function npcHidden(npcId: string): boolean {
  const id = companionAt(npcId);
  return !!id && (Companions.isWith(id) || (!!COMPANIONS[id].hiddenUntilNeeded && !willCome(id)));
}

/** Everyone in the party, stood just behind the hero as they arrive somewhere. */
export function spawnCompanions(g: GameScene): Companion[] {
  g.trail = new Trail();
  g.trail.reset({ x: g.player.gx, y: g.player.gy });
  return Companions.party.map((id, place) => {
    const spot = arrivalSpot(g, place);
    return new Companion(g, g.map, id, spot.x, spot.y, place);
  });
}

/** Beside or behind the hero, on open ground, a little further off for each one. */
function arrivalSpot(g: GameScene, place: number): Vec2 {
  const hx = g.player.gx;
  const hy = g.player.gy;
  const r = 1 + place * 0.9;
  for (let k = 0; k < 12; k++) {
    const a = Math.PI * 0.75 + place * 0.9 + k * (Math.PI / 6);
    const x = hx + Math.cos(a) * r;
    const y = hy + Math.sin(a) * r;
    if (g.map.isWalkable(Math.floor(x), Math.floor(y))) return { x, y };
  }
  return { x: hx, y: hy };
}

export function updateCompanions(g: GameScene, dt: number, heroSpeed: number): void {
  const hero = { x: g.player.gx, y: g.player.gy };
  g.trail.note(hero);
  for (const c of g.companions) c.update(dt, hero, g.trail, g.busy || g.inCombat, heroSpeed);
  if (!g.inCombat) Companions.tick(g.clock.elapsedHours, Experience.level);
}

/** After a fight, everyone falls in behind the hero again from wherever they stood. */
export function regroup(g: GameScene): void {
  g.trail.reset({ x: g.player.gx, y: g.player.gy });
  for (const c of g.companions) {
    c.offset.x = c.offset.y = 0;
    c.setDown(false);
  }
}

/** Talking to someone who's following: how they're doing, and sending them home. */
export function companionInteractions(g: GameScene): Interaction[] {
  return g.companions
    .filter((c) => !c.isGone)
    .map((c) => {
      const head = c.promptPoint;
      return {
        key: `companion:${c.id}`, label: 'Talk-to', target: c.def.short, gx: c.gx, gy: c.gy, range: FOLLOWER_TALK_RANGE,
        promptX: head.x, promptY: head.y, tile: { x: Math.floor(c.gx), y: Math.floor(c.gy) },
        run: () => {
          c.faceTowards(g.player.gx, g.player.gy);
          g.startScript(followerScript(c.id));
        },
      };
    });
}

/** What someone following the hero says when spoken to. */
export function followerScript(id: CompanionId): DialogueScript {
  const def = COMPANIONS[id];
  const speaker = def.speaker as SpeakerId;
  const hp = Companions.hp(id, Experience.level);
  const max = maxHpOf(id, Experience.level);
  const share = hp / max;
  const how: Record<CompanionId, [string, string, string]> = {
    sigrun: ["Still breathing. You?", "Scratched. It'll keep.", "I've had worse. Not much worse. Give me an hour."],
    wat: ["Fit as a fiddle! Where next?", "Bit bruised. Don't tell my mother.", "I think I'm bleeding. Am I bleeding? I'll be all right. Probably."],
  };
  const lines = how[id];
  const state = share > 0.75 ? lines[0] : share > 0.4 ? lines[1] : lines[2];
  return {
    start: 'greet',
    nodes: {
      greet: {
        speaker,
        lines: [id === 'sigrun' ? 'What.' : 'Yes? What is it?'],
        choices: [
          { text: 'How are you holding up?', next: 'how' },
          { text: `Go back to ${def.home.place} and wait for me there.`, next: 'leave' },
          { text: "Nothing. Let's keep going.", next: 'on' },
        ],
      },
      how: {
        speaker,
        lines: [`${state} (${Math.round(hp)} of ${max} health.)`],
        next: 'greet',
      },
      leave: { speaker, lines: [def.barks.leave], action: `companion:leave:${id}` },
      on: { speaker, lines: [id === 'sigrun' ? 'Then stop talking and walk.' : 'Right you are!'] },
    },
  };
}

/**
 * An NPC who could come along gets the asking worked into their talk: a
 * choice before the goodbye in their 'ask' node (their usual list of
 * questions), saying what they want, or that the party is full.
 */
export function offerCompanion(npcId: string, script: DialogueScript): DialogueScript {
  const id = companionAt(npcId);
  if (!id || Companions.isWith(id) || !willCome(id)) return script;
  const at = script.nodes.ask;
  if (!at?.choices) return script;
  const def = COMPANIONS[id];
  const speaker = def.speaker as SpeakerId;
  const nodes: Record<string, DialogueNode> = { ...script.nodes };
  let choice: DialogueChoice;
  if (Companions.full) {
    choice = { text: Companions.isRecruited(id) ? 'Come with me again.' : 'Will you come with me?', next: 'companion-full' };
    nodes['companion-full'] = {
      speaker,
      lines: [id === 'sigrun' ? `You've ${MAX_PARTY} with you already. I don't do crowds. Send one home.` : `You've already got ${MAX_PARTY} with you! Send someone home and I'll come.`],
      next: 'ask',
    };
  } else if (Companions.isRecruited(id)) {
    choice = { text: 'Come with me again.', next: 'companion-join' };
    nodes['companion-join'] = { speaker, lines: [def.barks.join], action: `companion:join:${id}` };
  } else {
    const price = priceOf(id);
    if (price > Inventory.coins) return script;
    const free = !!def.hire && price === 0;
    choice = {
      text: price > 0 ? `Here are ${price} coins. Come with me.` : free ? "The Headman's paying. Will you come?" : 'Will you come with me?',
      next: 'companion-hire',
    };
    nodes['companion-hire'] = {
      speaker,
      lines: id === 'sigrun'
        ? [price > 0 ? 'Hm. Count it out. ...All there. Fine.' : 'Is he. Then fine.', def.barks.join]
        : [def.barks.join],
      action: `companion:hire:${id}`,
    };
  }
  const choices = [...at.choices];
  choices.splice(Math.max(0, choices.length - 1), 0, { key: true, ...choice });
  nodes.ask = { ...at, choices };
  return { ...script, nodes };
}

/** `companion:hire:<id>`, `companion:join:<id>` and `companion:leave:<id>`, from a conversation. */
export function companionAction(g: GameScene, action: string): boolean {
  const [, verb, id] = action.split(':');
  if (!isCompanion(id)) return false;
  if (verb === 'hire') {
    const price = priceOf(id);
    if (price > 0 && !Inventory.addCoins(-price)) return true;
    Companions.recruit(id);
    QuestLog.setFlag(`hired-${id}`);
    bringAlong(g, id);
    return true;
  }
  if (verb === 'join') {
    if (Companions.join(id)) bringAlong(g, id);
    return true;
  }
  if (verb === 'leave') {
    sendHome(g, id);
    return true;
  }
  return false;
}

/** Someone who's just agreed to come steps out from where they were, and falls in behind. */
function bringAlong(g: GameScene, id: CompanionId): void {
  if (!Companions.isWith(id) || g.companions.some((c) => c.id === id)) return;
  const npc = g.npcs.find((n) => n.id === COMPANIONS[id].npc);
  const at = npc ? { x: npc.gx, y: npc.gy } : arrivalSpot(g, Companions.party.indexOf(id));
  if (npc) {
    npc.destroy();
    g.npcs = g.npcs.filter((n) => n !== npc);
  }
  g.companions.push(new Companion(g, g.map, id, at.x, at.y, Companions.party.indexOf(id)));
  g.trail.reset({ x: g.player.gx, y: g.player.gy });
}

/** Sent back to wait where they were met: they walk off, and (if this is that place) take up their spot again. */
export function sendHome(g: GameScene, id: CompanionId): void {
  Companions.leave(id);
  const c = g.companions.find((x) => x.id === id);
  g.companions = g.companions.filter((x) => x !== c);
  // Everyone else closes up the line.
  g.companions.forEach((x) => (x.place = Companions.party.indexOf(x.id)));
  if (!c) return;
  const def = COMPANIONS[id];
  const spawn = g.area === def.home.area ? g.map.data.npcs?.find((n) => n.id === def.npc) : undefined;
  const away = spawn ? { x: spawn.gx, y: spawn.gy } : { x: c.gx + (c.gx - g.player.gx) * 2, y: c.gy + (c.gy - g.player.gy) * 2 };
  c.leave(away, () => {
    if (!spawn || !g.scene.isActive() || g.npcs.some((n) => n.id === def.npc)) return;
    g.npcs.push(new Npc(g, g.map, spawn.id, spawn.gx, spawn.gy, spawn.commute, g.clock.hour, spawn.looking, spawn.hours, spawn));
  });
}

/** Someone following says something (a word after a fight won). */
export function companionSays(g: GameScene, id: CompanionId, text: string, seconds = 4): void {
  g.companions.find((c) => c.id === id)?.say(text, seconds);
}
