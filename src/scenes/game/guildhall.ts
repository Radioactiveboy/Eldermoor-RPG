/**
 * The Guildhall of the Causeway Merchants, on Gloomhaven's Staithe: the sitting
 * the hero walks in on the first time through the door (and how it breaks up),
 * the guild taking the hero on, the doors that stay shut (the hall's own out of
 * hours, the guildmaster's office until he's said so), what the hero reads in
 * the route book and on the guildmaster's desk, and the members' muttering.
 */
import { GameAudio } from '../../audio/Audio';
import type { SpeakerId } from '../../dialogue/Dialogue';
import { GUILD_MUTTERS, MEETING_BARKS } from '../../dialogue/guildhall';
import type { Npc } from '../../entities/Npc';
import { GUILD_EARNEST, GUILD_FLAGS, GUILD_HOURS, GUILD_QUEST, GuildWorld } from '../../systems/Guild';
import { Inventory } from '../../systems/Inventory';
import { QuestLog } from '../../systems/Quests';
import type { Door, Sight } from '../../world/MapData';
import type { GameScene } from '../GameScene';
import { CHATTER_GAP } from './tavern';

/** The Guildhall's rooms. */
export const GUILD_AREAS = ['guildhall', 'guildhall-counting', 'guildhall-office'] as const;

/** Where Edric Lowe goes to brood once the sitting breaks up: the window over the Staithe. */
const EDRIC_WINDOW = { x: 0.65, y: 5.5 };
/** The hall's door onto the Staithe, where those leaving go (world/GuildHallMap.ts). */
const HALL_DOOR = { x: 0.6, y: 8.5 };

/** Into the hall. The first time, the guild is in the middle of a row, and the row comes to the hero. */
export function enteredGuildHall(g: GameScene): void {
  if (QuestLog.hasFlag(GUILD_FLAGS.met)) return;
  g.busy = true;
  QuestLog.writeDiary(
    "Went into the Guildhall on the Staithe, the merchants' hall, which is the grandest building in Gloomhaven and still has a bucket under the leak. " +
      'I walked straight into the middle of a sitting of the guild, and a row: everyone on their feet and shouting at once about their caravans.',
  );
  // Everybody talking at once, before anyone notices the door.
  MEETING_BARKS.forEach(([id, text], i) => g.time.delayedCall(250 + i * 750, () => g.someone(id)?.say(text, 2.4)));
  g.time.delayedCall(250 + MEETING_BARKS.length * 750 + 900, () => {
    const wexley = g.someone('wexley');
    if (!wexley) {
      adjourn(g);
      g.release();
      return;
    }
    g.busy = false;
    // The shouting stops as the guildmaster turns to the door.
    for (const n of g.npcs) n.speech = undefined;
    // However the hero gets out of it, the sitting is over once they have.
    g.afterTalk = () => adjourn(g);
    g.startConversation(wexley);
  });
}

/**
 * The sitting breaks up: Thrale and Tunstall go out onto the Staithe, Edric Lowe
 * takes himself off to the window, and from now on the members keep their own hours.
 */
function adjourn(g: GameScene): void {
  if (QuestLog.hasFlag(GUILD_FLAGS.met)) return;
  QuestLog.setFlag(GUILD_FLAGS.met);
  const out = HALL_DOOR;
  const gone = (npc: Npc) => () => (g.npcs = g.npcs.filter((n) => n !== npc));
  const thrale = g.someone('thrale');
  const tunstall = g.someone('tunstall');
  if (thrale) {
    g.time.delayedCall(600, () => {
      thrale.say(QuestLog.hasFlag(GUILD_FLAGS.hired) ? 'Good luck, friend.' : 'Gentlemen. Dame.', 2.5);
      thrale.leave(out, gone(thrale));
    });
  }
  if (tunstall) {
    g.time.delayedCall(1800, () => {
      tunstall.say('Forty bolts...', 2.5);
      tunstall.leave(out, gone(tunstall));
    });
  }
  const edric = g.someone('edric');
  edric?.goTo(EDRIC_WINDOW, () => edric.turnTo({ x: -1, y: 0.2 }));
}

/** Keeps the guild muttering, and Edric aware of who's in the room. */
export function updateGuildHall(g: GameScene, dt: number): void {
  GuildWorld.thraleHere = g.area === 'guildhall' && !!g.someone('thrale');
  if (!(GUILD_AREAS as readonly string[]).includes(g.area) || g.busy || !QuestLog.hasFlag(GUILD_FLAGS.met)) return;
  g.chatterTimer -= dt;
  if (g.chatterTimer > 0) return;
  g.chatterTimer = CHATTER_GAP[0] + Math.random() * (CHATTER_GAP[1] - CHATTER_GAP[0]) + 4;
  const talkers = g.npcs.filter((n) => n.present && n.idle && !n.speech && GUILD_MUTTERS[n.id as SpeakerId]);
  const who = talkers[Math.floor(Math.random() * talkers.length)];
  const lines = who && GUILD_MUTTERS[who.id as SpeakerId]!;
  if (who && lines) who.say(lines[Math.floor(Math.random() * lines.length)], 3.5);
}

/** The hall's door on the Staithe, open only in the guild's hours; and the guildmaster's office, until he's taken the hero on. */
export function guildDoorAllowed(g: GameScene, door: Door): boolean {
  if (door.to === 'guildhall' && g.area === 'gloomhaven') {
    const [open, shut] = GUILD_HOURS;
    if (g.clock.hour >= open && g.clock.hour < shut) return true;
    GameAudio.rattle();
    g.onHint?.(`Barred. A brass plate on the door says the Merchants of the Causeway sit from ${open} in the morning until ${shut - 12} at night, and not to knock.`);
    return false;
  }
  if (door.id === 'guild-office' && !QuestLog.hasFlag(GUILD_FLAGS.hired)) {
    GameAudio.rattle();
    const wexley = g.someone('wexley');
    wexley?.say('That is my office, if you please.', 2.5);
    g.onHint?.(wexley ? "The guildmaster's office. Locked, and the guildmaster is watching me try it." : "The guildmaster's office. Locked.");
    return false;
  }
  return true;
}

/** The Guildhall's own sights, as things stand: the route book once Pim allows it, the guildmaster's letters once he's said so. */
export function examineAtGuild(g: GameScene, sight: Sight): boolean {
  if (sight.id === 'gd-routebook' && QuestLog.hasFlag(GUILD_FLAGS.pimLeave)) {
    GameAudio.click();
    g.onHint?.(
      'The route book. I turn back through it, carefully, with Pim watching. Every caravan, its day, its cargo. Beside each of the three that were set upon, ' +
        'in Pim\'s little hand in the margin, two days before it left: "Seen, J. Thrale." Beside the ones that got through, nothing, or "Seen, E. Lowe". ' +
        'And Master Thrale\'s own wine, according to the book, has never gone by the causeway at all. It goes by river.',
    );
    if (!QuestLog.hasFlag(GUILD_FLAGS.ledger)) {
      QuestLog.setFlag(GUILD_FLAGS.ledger);
      QuestLog.complete(GUILD_QUEST, 'ledger');
      QuestLog.writeDiary(
        'Read the guild\'s route book, with Pim\'s leave. Before each of the three caravans that were raided, Master Thrale asked to see it. ' +
          'He never ships anything by the causeway. It proves nothing. A man may read a book. But Garrow said they knew which wagon.',
      );
    }
    return true;
  }
  if (sight.id === 'gd-letters' && QuestLog.hasFlag(GUILD_FLAGS.hired)) {
    GameAudio.click();
    g.onHint?.(
      'Bills, duns, complaints, a sermon from the Reeve on the Flood Toll. And on top, unanswered, a sheet of heavy paper with no name to it, sealed in grey wax ' +
        'pressed with a little tower. It offers to buy the charter of the Merchants of the Causeway, road and all, for a sum I can\'t picture. ' +
        '"Your members are tired, Guildmaster. Let them rest."',
    );
    if (!QuestLog.hasFlag(GUILD_FLAGS.letters)) {
      QuestLog.setFlag(GUILD_FLAGS.letters);
      QuestLog.writeDiary(
        "Read the letters on the guildmaster's desk, with his leave. Someone wants to buy the whole guild, charter and causeway and all. No name; a grey seal, with a tower on it. " +
          'The same tower as on the new silver, I think.',
      );
    }
    return true;
  }
  return false;
}

/** What the guild's conversations need from the game (see dialogue/guildhall.ts). */
const GUILD_ACTIONS: Record<string, (g: GameScene) => void> = {
  'guild-adjourn': (g) => adjourn(g),
  'guild-heard-lowe': () => QuestLog.setFlag(GUILD_FLAGS.heardLowe),
  'guild-hire': () => {
    if (QuestLog.hasFlag(GUILD_FLAGS.hired)) return;
    QuestLog.setFlag(GUILD_FLAGS.hired);
    const already = ['meeting', ...(QuestLog.hasFlag(GUILD_FLAGS.garrow) ? ['garrow'] : [])];
    QuestLog.start(GUILD_QUEST, already);
    Inventory.reward(GUILD_EARNEST);
    GameAudio.coins();
    QuestLog.writeDiary(
      `The Merchants of the Causeway have taken me on to find out who is behind the raids on their caravans out at the Drowned Mile. ${GUILD_EARNEST} coins on account, ` +
        'and a hundred more when I can tell them, and prove it. Master Thrale, the one with the ring, voted against. He smiled the whole time.',
    );
  },
  'guild-garrow': () => {
    if (QuestLog.hasFlag(GUILD_FLAGS.garrow)) return;
    QuestLog.setFlag(GUILD_FLAGS.garrow);
    QuestLog.complete(GUILD_QUEST, 'garrow');
    QuestLog.writeDiary(
      'Nat Garrow, the caravan master who came back from the Drowned Mile with his head broken, says the raiders never said a word, went straight to the ' +
        'cloth, spoiled it and took nothing, and hissed instead of shouting, and went into the mere when they were done and never came up. A man in a good grey coat watched it all from a punt. ' +
        'And Garrow found a coin in the mud: new silver, very bright, with a tower on it and a star over the tower.',
    );
  },
  'guild-pim-leave': () => QuestLog.setFlag(GUILD_FLAGS.pimLeave),
  'guild-marrable': () => {
    if (QuestLog.hasFlag(GUILD_FLAGS.marrable)) return;
    QuestLog.setFlag(GUILD_FLAGS.marrable);
    QuestLog.writeDiary(
      "Dame Marrable told me a man in a grey coat, with clean boots, came to buy her late brother's share in the guild, and she showed him the door. " +
        'Her first caravan was set upon a fortnight later.',
    );
  },
  'guild-tunstall': () => {
    if (QuestLog.hasFlag(GUILD_FLAGS.tunstall)) return;
    QuestLog.setFlag(GUILD_FLAGS.tunstall);
    QuestLog.writeDiary(
      "Master Tunstall owns that Master Thrale has lent him forty silver against his next caravan. If it doesn't come in, Thrale has his share of the guild. " +
        "The day-book in the counting room has the same line for Jos Cobley, a week before Cobley's name was struck off the roll. SOLD.",
    );
  },
  'guild-edric': (g) => {
    if (QuestLog.hasFlag(GUILD_FLAGS.edric)) return;
    QuestLog.setFlag(GUILD_FLAGS.edric);
    QuestLog.complete(GUILD_QUEST, 'edric');
    QuestLog.writeDiary(
      "Edric Lowe, away from Thrale, said his piece: the new silver with the tower on it is all over Gloomhaven since the spring, in the Reeve's pay and the Rose's " +
        'back room and Thrale\'s loans, and he saw one once off a ship from somewhere far to the east. He thinks someone means to buy the guild by breaking it first. ' +
        'He wants me to go and look at the wreck of the last caravan, out of the Fen Gate and along the causeway at the Drowned Mile, and see what made the tracks.',
    );
    g.time.delayedCall(600, () => g.onHint?.('The Drowned Mile, then. Out of the Fen Gate, and north along the causeway.'));
  },
};

/** The guild's dialogue actions (`guild-...`). Returns false if it isn't one. */
export function guildAction(g: GameScene, action: string): boolean {
  const run = GUILD_ACTIONS[action];
  if (!run) return false;
  run(g);
  return true;
}
