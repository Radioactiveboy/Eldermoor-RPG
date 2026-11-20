/**
 * The Crooked Tankard: the maids waiting on the hero's table, drinks at the bar,
 * rooms to let, dice with Ada, Pell's song, the regulars' chatter, and Godric's
 * rats in the cellar.
 */
import { GameAudio } from '../../audio/Audio';
import { PLAYER_RADIUS } from '../../config';
import { SpeakerId } from '../../dialogue/Dialogue';
import { DICE_STAKE, HARLAN_DRINK, PELL_SONG, RAT_REWARD, SONG_PRICE, TAVERN_CHATTER, TAVERN_MUTTERS, TAVERN_TOASTS } from '../../dialogue/tavern';
import { NpcWorld } from '../../entities/Npc';
import { Vec2 } from '../../iso/IsoMath';
import { Inventory, itemDef, ItemId } from '../../systems/Inventory';
import { QuestLog } from '../../systems/Quests';
import { Needs } from '../../systems/Needs';
import { CHECKOUT_HOUR, MENU, RENT_OPTIONS, Tavern } from '../../systems/Tavern';
import { Seat } from '../../world/MapData';
import { BAR_PICKUP, CELLAR_RATS } from '../../world/landmarks';
import type { GameScene } from '../GameScene';
import type { DialogueAction } from './dialogueActions';
import { give } from './sights';

/** Seconds sitting at a tavern table before a maid comes over, the first time, and between her visits after that. */
export const SERVICE_FIRST = 4;
export const SERVICE_AGAIN = 50;
/** Seconds between bits of chatter among the tavern's regulars. */
export const CHATTER_GAP: [number, number] = [6, 12];
/** Seconds between the lines of an overheard exchange (and of Pell's song). */
export const LINE_GAP = 3.2;

/** Into the Crooked Tankard: the first time, the hero takes it in. */
export function enteredTavern(g: GameScene): void {
  if (g.visited.has('tavern')) return;
  const busy = g.clock.hour >= 17 || g.clock.hour < 2;
  g.time.delayedCall(1000, () =>
    g.onHint?.(busy
      ? 'Heat, noise and the smell of ale. Every table is full, and somebody is murdering a lute by the fire.'
      : 'Warm and dim, smelling of woodsmoke and old ale. An old man dozes at the end of the bar.'),
  );
  QuestLog.writeDiary(
    "Went into the Crooked Tankard, the inn on Adowvale's square. Godric the landlord keeps it, a big bald man with a voice like a barrel " +
      'rolling downstairs. There are rooms to let upstairs, and ale, and more gossip than at Hilde\'s stall.',
  );
}

/** Down the trapdoor into the cellar: Godric's job moves on. */
export function enteredCellar(g: GameScene): void {
  QuestLog.complete('cellar-rats', 'cellar');
  checkCellarClear(g);
  if (g.visited.has('cellar')) return;
  g.time.delayedCall(1000, () => g.onHint?.('Cold stone, the smell of spilt ale and something worse. Little claws skitter in the dark.'));
}

/** All the cellar's rats dead or run off: Godric should hear of it. */
export function checkCellarClear(g: GameScene): void {
  if (!CELLAR_RATS.every((id) => g.defeatedFoes.has(id)) || !QuestLog.has('cellar-rats') || QuestLog.isDone('cellar-rats', 'clear')) return;
  QuestLog.complete('cellar-rats', 'cellar');
  QuestLog.complete('cellar-rats', 'clear');
  QuestLog.writeDiary(
    "Cleared the rats out of the Crooked Tankard's cellar. Six of them, fat as cats on Godric's grain, and one bit me on the ankle. " +
      'Godric owes me coin, and I have a satchel full of tails I did not want.',
  );
}

/** Tells the tavern's people what they need to know about the hero and the clock (see NpcWorld). */
export function syncNpcWorld(g: GameScene): void {
  NpcWorld.seated = g.seat?.name === 'tavern-table';
  NpcWorld.now = g.clock.elapsedHours;
  NpcWorld.hoursUntil = (h) => g.clock.hoursUntil(h);
}

export function updateTavern(g: GameScene, dt: number): void {
  if (g.area !== 'tavern') return;
  updateService(g, dt);
  updateChatter(g, dt);
}

/** While the hero sits at a table, now and then a maid comes over to take an order. */
export function updateService(g: GameScene, dt: number): void {
  g.serviceTimer -= dt;
  const seat = g.seat;
  if (g.service || !seat || seat.name !== 'tavern-table' || g.busy || g.serviceTimer > 0) return;
  const player = { x: g.player.gx, y: g.player.gy };
  const maid = g.npcs
    .filter((n) => (n.id === 'nell' || n.id === 'rosie') && n.present && n.idle)
    .sort((a, b) => a.distanceTo(player.x, player.y) - b.distanceTo(player.x, player.y))[0];
  if (!maid) {
    g.serviceTimer = 5;
    return;
  }
  const service = { maid, seat, stage: 'coming' as const };
  g.service = service;
  maid.goTo(serviceSpot(g, seat), () => maidArrives(g, service));
}

/**
 * Where a maid stands to serve someone sitting: beside them, but never on the
 * spot they'd step to on getting up (or she'd be in their way).
 */
export function serviceSpot(g: GameScene, seat: Seat): Vec2 {
  const sx = Math.floor(seat.gx);
  const sy = Math.floor(seat.gy);
  const stand = { x: Math.floor(seat.standX), y: Math.floor(seat.standY) };
  let best: Vec2 | undefined;
  let bestDist = Infinity;
  for (let y = sy - 1; y <= sy + 1; y++) {
    for (let x = sx - 1; x <= sx + 1; x++) {
      if ((x === sx && y === sy) || (x === stand.x && y === stand.y)) continue;
      if (!g.map.isWalkable(x, y) || g.map.blocked(x + 0.5, y + 0.5, PLAYER_RADIUS, false)) continue;
      const d = Math.hypot(x + 0.5 - seat.standX, y + 0.5 - seat.standY);
      if (d < bestDist) {
        best = { x: x + 0.5, y: y + 0.5 };
        bestDist = d;
      }
    }
  }
  return best ?? { x: seat.standX, y: seat.standY };
}

/** The maid is at the table: she takes the hero's order, unless they've got up and gone in the meantime. */
export function maidArrives(g: GameScene, service: NonNullable<GameScene['service']>): void {
  if (g.service !== service) return;
  if (g.seat !== service.seat || g.busy) {
    service.maid.say(g.seat ? "I'll come back by, love." : 'Oh! Never mind, then.', 3);
    g.service = undefined;
    g.serviceTimer = g.seat ? 12 : SERVICE_AGAIN;
    return;
  }
  g.serviceTimer = SERVICE_AGAIN;
  g.startConversation(service.maid, true);
}

/** Ordered from a maid at the table: pay up, and she'll fetch it once she's done talking. */
export function placeOrder(g: GameScene, item: ItemId): void {
  const menu = MENU[item];
  if (!menu || !Inventory.addCoins(-menu.price)) return;
  GameAudio.coins();
  g.ordered = item;
}

/** The maid goes to the bar for the order, waits on Godric, and brings it back to the table. */
export function fetchOrder(g: GameScene, item: ItemId): void {
  const service = g.service!;
  service.item = item;
  service.stage = 'fetching';
  const calls: Partial<Record<ItemId, string>> = { stew: 'One stew, Godric!', bread: 'Bread and butter, Godric!', cheese: 'Cheese for the table, Godric!' };
  service.maid.goTo(BAR_PICKUP, () => {
    if (g.service !== service) return;
    service.maid.faceTowards(9.5, 1.5);
    service.maid.say(calls[item] ?? `Godric! One ${itemDef(item).name.toLowerCase()}!`, 2.5);
    g.someone('landlord')?.say('Coming up!', 2);
    g.time.delayedCall(2800, () => {
      if (g.service !== service) return;
      service.stage = 'bringing';
      service.maid.goTo(serviceSpot(g, service.seat), () => deliver(g, service));
    });
  });
}

/** The order arrives: eaten (or drunk) at the table, or, if the hero has got up, handed over to take away. */
export function deliver(g: GameScene, service: NonNullable<GameScene['service']>): void {
  if (g.service !== service || !service.item) return;
  g.service = undefined;
  const item = service.item;
  const menu = MENU[item]!;
  service.maid.faceTowards(g.player.gx, g.player.gy);
  service.maid.say(menu.served, 4);
  if (g.seat === service.seat) g.time.delayedCall(1200, () => consume(g, item, menu.thought));
  else give(g, item, 1);
}

/** Eat or drink something straight away (served in the tavern), and say how it was. */
export function consume(g: GameScene, item: ItemId, thought: string): void {
  const def = itemDef(item);
  if (def.eat?.health) g.stats.heal(def.eat.health);
  if (def.eat?.stamina) g.stats.restoreStamina(def.eat.stamina);
  Needs.ate(def);
  if (def.drink) GameAudio.gulp();
  else GameAudio.crunch();
  g.onHint?.(thought);
}

/** A drink across the bar from Godric, drunk there and then (the first after clearing his cellar is on the house). */
export function drinkAtBar(g: GameScene, item: ItemId): void {
  const menu = MENU[item];
  if (!menu) return;
  if (QuestLog.hasFlag('tankard-free-drink')) {
    QuestLog.clearFlag('tankard-free-drink');
  } else if (!Inventory.addCoins(-menu.price)) {
    return;
  } else {
    GameAudio.coins();
  }
  g.afterTalk = () => {
    g.someone('landlord')?.say('There you go. Drink up.', 3);
    g.time.delayedCall(900, () => consume(g, item, menu.thought));
  };
}

/** Take (or keep on) a room upstairs for some nights: it's the hero's to sleep in until checkout on the last morning. */
export function rentRoom(g: GameScene, nights: number): void {
  const option = RENT_OPTIONS.find((o) => o.nights === nights);
  if (!option || !Inventory.addCoins(-option.price)) return;
  GameAudio.coins();
  const extending = Tavern.renting(g.clock.elapsedHours);
  const room = Tavern.rent(nights, g.clock.elapsedHours, g.clock.hoursUntil(CHECKOUT_HOUR));
  const span = nights === 1 ? 'the night' : nights === 7 ? 'the week' : `${nights} nights`;
  QuestLog.writeDiary(
    extending
      ? `Paid Godric ${option.price} coins to keep my room at the Crooked Tankard for ${span} more.`
      : `Took a room at the Crooked Tankard for ${span}: room ${room}, up the stairs. ${option.price} coins. A real bed, a lock on the door, and only a few fleas.`,
  );
}

/** A game of dice with Ada: the higher roll takes the pot, and she wins ties. */
export function playDice(g: GameScene): void {
  if (!Inventory.addCoins(-DICE_STAKE)) return;
  const d6 = () => 1 + Math.floor(Math.random() * 6);
  const mine = d6() + d6();
  const hers = d6() + d6();
  const ada = g.someone('ada');
  GameAudio.dice();
  g.time.delayedCall(700, () => {
    if (mine > hers) {
      Inventory.reward(DICE_STAKE * 2);
      GameAudio.coins();
      ada?.say(mine === 12 ? 'Double sixes?! Well, I never.' : 'Hmph. Beginner\'s luck.', 3.5);
      g.onHint?.(`I roll ${mine}. Ada rolls ${hers}. I win! She pushes the coins over with a face like thunder.`);
    } else {
      ada?.say(mine === hers ? 'A tie goes to the house, dearie.' : 'Thank you kindly!', 3.5);
      g.onHint?.(`I roll ${mine}. Ada rolls ${hers}. She scoops up the pot before the dice have stopped rolling.`);
    }
  });
}

/** Pell sings the Ballad of the Crooked Tankard, a bubble at a time, and the room joins in at the end. */
export function pellSings(g: GameScene): void {
  const pell = g.someone('pell');
  if (!pell) return;
  g.chatterTimer = PELL_SONG.length * LINE_GAP + 3;
  PELL_SONG.forEach((line, i) => g.time.delayedCall(i * LINE_GAP * 1000, () => pell.say(line, LINE_GAP + 0.2)));
  g.time.delayedCall(PELL_SONG.length * LINE_GAP * 1000, () => {
    const crowd = g.npcs.filter((n) => n.present && n !== pell && n.id !== 'landlord');
    crowd[Math.floor(Math.random() * crowd.length)]?.say('Hooray! ...More or less.', 3);
    g.someone('landlord')?.say('Not bad, Pell. Not good, either.', 3);
  });
}

/** The regulars talk among themselves: an exchange between some of them, someone muttering, or the room raising a cup. */
export function updateChatter(g: GameScene, dt: number): void {
  if (g.busy) return;
  g.chatterTimer -= dt;
  if (g.chatterTimer > 0) return;
  const gap = () => CHATTER_GAP[0] + Math.random() * (CHATTER_GAP[1] - CHATTER_GAP[0]);
  const exchanges = TAVERN_CHATTER.filter((ex) => ex.every(([id]) => g.someone(id)?.idle));
  if (exchanges.length > 0 && Math.random() < 0.55) {
    const ex = exchanges[Math.floor(Math.random() * exchanges.length)];
    ex.forEach(([id, text], i) => g.time.delayedCall(i * LINE_GAP * 1000, () => g.someone(id)?.say(text, LINE_GAP + 0.3)));
    g.chatterTimer = ex.length * LINE_GAP + gap();
    return;
  }
  g.chatterTimer = gap();
  const about = g.npcs.filter((n) => n.present && n.idle && !n.speech);
  const patrons = about.filter((n) => !['landlord', 'nell', 'rosie'].includes(n.id));
  if (patrons.length >= 4 && Math.random() < 0.35) {
    const who = patrons[Math.floor(Math.random() * patrons.length)];
    who.say(TAVERN_TOASTS[Math.floor(Math.random() * TAVERN_TOASTS.length)], 3);
    return;
  }
  const talkers = about.filter((n) => TAVERN_MUTTERS[n.id as SpeakerId]);
  const who = talkers[Math.floor(Math.random() * talkers.length)];
  const lines = who && TAVERN_MUTTERS[who.id as SpeakerId]!;
  if (who && lines) who.say(lines[Math.floor(Math.random() * lines.length)], 3.5);
}

/** What Godric, Ada, Pell and Old Harlan need from conversations (see dialogue/tavern.ts). */
export const TAVERN_ACTIONS: Record<string, DialogueAction> = {
  'start-rats-quest': (g) => {
    if (QuestLog.has('cellar-rats')) return;
    QuestLog.start('cellar-rats', ['talk']);
    QuestLog.writeDiary(
      `Godric at the Crooked Tankard has rats in his cellar, big as cats, he says. He will pay ${RAT_REWARD} coins to have them cleared out. ` +
        'The trapdoor is by the end of the bar.',
    );
    checkCellarClear(g);
  },
  'finish-rats-quest': () => {
    if (QuestLog.get('cellar-rats')?.completed) return;
    QuestLog.complete('cellar-rats', 'return');
    Inventory.reward(RAT_REWARD);
    GameAudio.coins();
    QuestLog.setFlag('tankard-free-drink');
    QuestLog.writeDiary(
      `Told Godric his cellar is clear. He went down to look for himself, came back up grinning, and paid me ${RAT_REWARD} coins. ` +
        'My next drink is on the house, he says. He did not want the tails.',
    );
  },
  'buy-harlan': () => {
    if (Inventory.addCoins(-HARLAN_DRINK)) GameAudio.coins();
  },
  'harlan-secret': () => {
    if (QuestLog.hasFlag('harlan-secret')) return;
    QuestLog.setFlag('harlan-secret');
    QuestLog.writeDiary(
      'Old Harlan at the Crooked Tankard says the door under the hill was put there by old Lord Morten, this one\'s grandfather, to shut in ' +
        'something that came up from the deep places. The key went with him: buried, or kept up at the manor.',
    );
  },
  'dice-game': (g) => {
    g.afterTalk = () => playDice(g);
  },
  'pell-song': (g) => {
    if (!Inventory.addCoins(-SONG_PRICE)) return;
    GameAudio.coins();
    g.afterTalk = () => pellSings(g);
  },
};
