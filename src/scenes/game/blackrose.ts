/**
 * The Black Rose, Gloomhaven's tavern: drinks across the Widow's bar, her room
 * to let, Midge fetching from the bar, Grubb's fee for the back room, dice with
 * Silas Crane (whose bones are loaded until he's caught), arm-wrestling Dunn,
 * a drink for Hollis and what he read, the gentleman in grey's offer for the
 * orb, and the regulars' talk among themselves.
 */
import { GameAudio } from '../../audio/Audio';
import { SpeakerId } from '../../dialogue/Dialogue';
import { ROSE_CHATTER, ROSE_MUTTERS, ROSE_TOASTS, servedLine } from '../../dialogue/blackrose';
import { BACK_ROOM_FEE, BlackRose, HOLLIS_DRINK, ROSE_FLAGS, ROSE_CHECKOUT_HOUR, ROSE_MENU, ROSE_RENT, SILAS_STAKE } from '../../systems/BlackRose';
import { Inventory, ItemId } from '../../systems/Inventory';
import { QuestLog } from '../../systems/Quests';
import { Door } from '../../world/MapData';
import type { GameScene } from '../GameScene';
import { give } from './sights';
import { CHATTER_GAP, consume, LINE_GAP } from './tavern';

/** The Rose's areas: the taproom, the back room, the passage upstairs, and the room to let. */
export const ROSE_AREAS = ['blackrose', 'blackrose-back', 'blackrose-upstairs', 'blackrose-room'] as const;

/** Where Midge fetches orders from, at the bar's open end, and where the Widow stands. */
const PICKUP = { x: 14.5, y: 3.6 };
const WIDOW = { x: 12.5, y: 1.4 };

/** Into the taproom: the first time, the hero takes it in, and writes it down. */
export function enteredBlackRose(g: GameScene): void {
  if (g.visited.has('blackrose')) return;
  const busy = g.clock.hour >= 18 || g.clock.hour < 3;
  g.time.delayedCall(1000, () =>
    g.onHint?.(busy
      ? 'Smoke, wet wool, and eels. Every face in the room turns to look at me, and then, one by one, turns away. Not all of them.'
      : 'Dim and damp and smelling of eels. Water drips from the ceiling into a bucket. A tall woman in black watches me from behind the bar.'),
  );
  QuestLog.writeDiary(
    "Went into the Black Rose, the tavern on Gloomhaven's square. It is the sort of place Mother would have walked me past quickly. " +
      'The roof leaks, the walls are green with damp, and a black rose is painted over the bar. The landlady is a widow called Thorne, ' +
      'and she watches everything. So, I think, does everyone else.',
  );
}

/** Through the curtain, the first time. */
export function enteredRoseBack(g: GameScene): void {
  if (g.visited.has('blackrose-back')) return;
  g.time.delayedCall(900, () => g.onHint?.('Colder in here. Much colder. And there, in the corner, a faint green light between the slats of a crate.'));
}

/** Keeps the regulars talking. */
export function updateBlackRose(g: GameScene, dt: number): void {
  if (!(ROSE_AREAS as readonly string[]).includes(g.area)) return;
  if (g.area === 'blackrose') updateRoseChatter(g, dt);
}

/** The regulars talk among themselves: an exchange, a mutter, or a toast. */
function updateRoseChatter(g: GameScene, dt: number): void {
  if (g.busy) return;
  g.chatterTimer -= dt;
  if (g.chatterTimer > 0) return;
  const gap = () => CHATTER_GAP[0] + Math.random() * (CHATTER_GAP[1] - CHATTER_GAP[0]) + 2;
  const exchanges = ROSE_CHATTER.filter((ex) => ex.every(([id]) => g.someone(id)?.idle));
  if (exchanges.length > 0 && Math.random() < 0.5) {
    const ex = exchanges[Math.floor(Math.random() * exchanges.length)];
    ex.forEach(([id, text], i) => g.time.delayedCall(i * LINE_GAP * 1000, () => g.someone(id)?.say(text, LINE_GAP + 0.3)));
    g.chatterTimer = ex.length * LINE_GAP + gap();
    return;
  }
  g.chatterTimer = gap();
  const about = g.npcs.filter((n) => n.present && n.idle && !n.speech);
  const patrons = about.filter((n) => !['thorne', 'grubb', 'midge'].includes(n.id));
  if (patrons.length >= 4 && Math.random() < 0.3) {
    patrons[Math.floor(Math.random() * patrons.length)].say(ROSE_TOASTS[Math.floor(Math.random() * ROSE_TOASTS.length)], 3);
    return;
  }
  const talkers = about.filter((n) => ROSE_MUTTERS[n.id as SpeakerId]);
  const who = talkers[Math.floor(Math.random() * talkers.length)];
  const lines = who && ROSE_MUTTERS[who.id as SpeakerId]!;
  if (who && lines) who.say(lines[Math.floor(Math.random() * lines.length)], 3.5);
}

/**
 * Doors in the Rose that may be shut: the curtain until Grubb's been paid (or
 * the Widow has said so), and upstairs, every door but the one let to the
 * hero, which opens only while it's paid for.
 */
export function roseDoorAllowed(g: GameScene, door: Door): boolean {
  if (door.id === 'rose-back') {
    if (QuestLog.hasFlag(ROSE_FLAGS.backOk)) return true;
    GameAudio.rattle();
    g.someone('grubb')?.say(Math.random() < 0.5 ? 'No.' : "Friends only.", 2.5);
    g.onHint?.("Grubb shifts his bulk in front of the curtain without a word. I'd have to get past him first.");
    return false;
  }
  const room = door.id?.startsWith('rose-room-') ? Number(door.id.slice(10)) : undefined;
  if (room === undefined) return true;
  const renting = BlackRose.renting(g.clock.elapsedHours);
  if (room === 2 && renting) return true;
  GameAudio.rattle();
  const others: Record<number, string> = {
    1: 'Locked. On the other side, someone stops snoring, and listens. I listen back. Neither of us says anything.',
    3: 'Locked. There is a smell of wet earth under the door, and the boards in front of it are damp.',
    4: "The Widow's own room. Locked, and there's a black rose painted on the door. I don't think I'd want to be caught trying it.",
  };
  g.onHint?.(
    room === 2
      ? BlackRose.paidUntil > 0
        ? 'Locked. My time in this room is up. I would have to take it again from the Widow downstairs.'
        : "The room to let. Locked. I'd have to take it from the Widow first."
      : others[room] ?? 'Locked.',
  );
  return false;
}

/** The Rose's dialogue actions with an argument: `rose-drink:<item>`, `rose-order:<item>`, `rose-rent:<nights>`. Returns false if it isn't one. */
export function roseAction(g: GameScene, action: string): boolean {
  if (action.startsWith('rose-drink:')) {
    drinkAtRose(g, action.slice(11) as ItemId);
    return true;
  }
  if (action.startsWith('rose-order:')) {
    orderFromMidge(g, action.slice(11) as ItemId);
    return true;
  }
  if (action.startsWith('rose-rent:')) {
    rentRoseRoom(g, Number(action.slice(10)));
    return true;
  }
  const run = ROSE_ACTIONS[action];
  if (!run) return false;
  run(g);
  return true;
}

/** Across the Widow's bar, drunk (or eaten) there and then. */
function drinkAtRose(g: GameScene, item: ItemId): void {
  const menu = ROSE_MENU[item];
  if (!menu || !Inventory.addCoins(-menu.price)) return;
  GameAudio.coins();
  g.afterTalk = () => {
    const widow = g.someone('thorne');
    widow?.say(menu.served, 3.5);
    g.time.delayedCall(1100, () => consume(g, item, menu.thought));
  };
}

/** Midge takes the order, trots to the bar for it, and brings it back; if the hero's wandered off, she hands it over to take away. */
function orderFromMidge(g: GameScene, item: ItemId): void {
  const menu = ROSE_MENU[item];
  if (!menu || !Inventory.addCoins(-menu.price)) return;
  GameAudio.coins();
  g.afterTalk = () => {
    const midge = g.someone('midge');
    if (!midge) {
      give(g, item, 1);
      return;
    }
    midge.goTo(PICKUP, () => {
      midge.faceTowards(WIDOW.x, WIDOW.y);
      midge.say(item === 'stew' ? 'One eel, Mrs Thorne!' : 'Black ale, Mrs Thorne!', 2.5);
      g.time.delayedCall(1200, () => g.someone('thorne')?.say(Math.random() < 0.5 ? 'Mm.' : "Don't spill it.", 2));
      g.time.delayedCall(2800, () => {
        const near = { x: g.player.gx + 0.8, y: g.player.gy + 0.4 };
        const spot = g.map.blocked(near.x, near.y, 0.3) ? { x: g.player.gx, y: g.player.gy + 0.9 } : near;
        midge.goTo(spot, () => {
          midge.faceTowards(g.player.gx, g.player.gy);
          midge.say(servedLine(item), 3.5);
          if (Math.hypot(g.player.gx - midge.gx, g.player.gy - midge.gy) < 2.4) g.time.delayedCall(1000, () => consume(g, item, menu.thought));
          else give(g, item, 1);
        });
      });
    });
  };
}

/** Take (or keep on) the Widow's room for some nights. */
function rentRoseRoom(g: GameScene, nights: number): void {
  const option = ROSE_RENT.find((o) => o.nights === nights);
  if (!option || !Inventory.addCoins(-option.price)) return;
  GameAudio.coins();
  const extending = BlackRose.renting(g.clock.elapsedHours);
  BlackRose.rent(nights, g.clock.elapsedHours, g.clock.hoursUntil(ROSE_CHECKOUT_HOUR));
  const span = nights === 1 ? 'the night' : `${nights} nights`;
  QuestLog.writeDiary(
    extending
      ? `Paid the Widow Thorne ${option.price} coins to keep her room at the Black Rose for ${span} more.`
      : `Took the Widow Thorne's room at the Black Rose for ${span}, ${option.price} coins: the second door at the top of the stairs. ` +
          'She says to wedge a chair under the handle, and if I hear anyone in the passage at night, I don\'t.',
  );
}

/** A throw of the dice with Silas Crane: higher takes the pot, and he wins ties. His bones are loaded, till he's caught. */
function playSilas(g: GameScene): void {
  if (!Inventory.addCoins(-SILAS_STAKE)) return;
  const d6 = () => 1 + Math.floor(Math.random() * 6);
  const loaded = !QuestLog.hasFlag(ROSE_FLAGS.silasCaught);
  const his = () => (loaded ? Math.max(d6(), d6()) : d6());
  const mine = d6() + d6();
  const theirs = his() + his();
  const silas = g.someone('silas');
  GameAudio.dice();
  g.time.delayedCall(700, () => {
    if (mine > theirs) {
      Inventory.reward(SILAS_STAKE * 2);
      GameAudio.coins();
      silas?.say(mine === 12 ? 'Boxcars! Well, well. The river giveth.' : 'Ha! Fortune favours the fresh-faced.', 3.5);
      g.onHint?.(`I throw ${mine}. Silas throws ${theirs}. I win! He pushes the coins over with his smile nailed on.`);
    } else {
      QuestLog.setFlag(ROSE_FLAGS.silasWon);
      silas?.say(mine === theirs ? "A tie goes to the house, friend. House rules." : 'Bad luck, friend. Again?', 3.5);
      g.onHint?.(
        loaded && theirs >= 9
          ? `I throw ${mine}. Silas throws ${theirs}. Again. His dice seem to like the high numbers an awful lot.`
          : `I throw ${mine}. Silas throws ${theirs}. He has the coins off the table before the dice stop rolling.`,
      );
    }
  });
}

/** Arm-wrestling Dunn for two coins: it goes about how you'd think, most of the time. */
function armWrestle(g: GameScene): void {
  if (!Inventory.addCoins(-2)) return;
  GameAudio.coins();
  g.afterTalk = () => {
    const dunn = g.someone('dunn');
    const ferret = g.someone('ferret');
    ferret?.say('Ooh! Ooh, lamb wants a go!', 2.5);
    g.time.delayedCall(1600, () => {
      if (Math.random() < 0.3) {
        Inventory.reward(4);
        GameAudio.coins();
        dunn?.say('...Mm!', 3);
        ferret?.say('DUNN!', 2);
        g.onHint?.("I put everything I have into it, and Dunn's arm goes down. His face doesn't change. Ferret's does.");
      } else {
        dunn?.say('Mm.', 2.5);
        g.onHint?.('It is like trying to push over a church. Dunn puts my hand down on the table gently, the way you put down a cup.');
      }
    });
  };
}

/** What the Rose's people need from their conversations (see dialogue/blackrose.ts). */
const ROSE_ACTIONS: Record<string, (g: GameScene) => void> = {
  'rose-vouch': () => {
    QuestLog.setFlag(ROSE_FLAGS.backOk);
    QuestLog.setFlag(ROSE_FLAGS.vaneTold);
  },
  'rose-pay-grubb': () => {
    if (QuestLog.hasFlag(ROSE_FLAGS.backOk) || !Inventory.addCoins(-BACK_ROOM_FEE)) return;
    GameAudio.coins();
    QuestLog.setFlag(ROSE_FLAGS.backOk);
  },
  'rose-dice': (g) => {
    g.afterTalk = () => playSilas(g);
  },
  'rose-silas-caught': () => {
    if (QuestLog.hasFlag(ROSE_FLAGS.silasCaught)) return;
    QuestLog.setFlag(ROSE_FLAGS.silasCaught);
    Inventory.reward(SILAS_STAKE);
    GameAudio.coins();
    QuestLog.writeDiary(
      "Caught Silas Crane's dice out at the Black Rose: loaded, both of them. He gave me my stake back with a grin, and then told me what " +
        'he really carries up the river. Crates, from a boat out at the old causeway, for the gentleman in grey. One of his men opened one. ' +
        'He saw something green and cold in it that looked back, and walked into the river the next morning.',
    );
  },
  'rose-buy-hollis': () => {
    if (Inventory.addCoins(-HOLLIS_DRINK)) GameAudio.coins();
  },
  'rose-hollis-glass': () => {
    if (QuestLog.hasFlag(ROSE_FLAGS.hollisGlass)) return;
    QuestLog.setFlag(ROSE_FLAGS.hollisGlass);
    QuestLog.writeDiary(
      'Hollis, who was a monk at Saint Elda\'s until they caught him in the locked press, told me what the book said: the drowned kings ' +
        'of the fens had seven glass orbs made that could see and speak across any distance, and one of them was the master. Whoever holds ' +
        'the master hears all the others, and is obeyed. It was kept in their great church, which went under when the sea came in.',
    );
  },
  'rose-armwrestle': (g) => armWrestle(g),
  'rose-vane-offer': () => {
    if (QuestLog.hasFlag(ROSE_FLAGS.vaneOffer)) return;
    QuestLog.setFlag(ROSE_FLAGS.vaneOffer);
    QuestLog.writeDiary(
      'A man in grey called Vane was waiting for me in the back room of the Black Rose. He knew my name. He knew about the orb. ' +
        'He offered me five hundred crowns for it, for his "employer", whose voice I have heard already, he said, through the glass. ' +
        'He said Mother asked one question too many. I told him it was not for sale. He wrote my name in his ledger.',
    );
  },
};
