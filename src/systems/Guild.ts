/**
 * The Guildhall of the Causeway Merchants, on Gloomhaven's Staithe (world/GuildHallMap.ts):
 * the quest the guild hires the hero for, what the hero has found out so far (as quest flags,
 * so they're saved with everything else), and what the guild pays.
 *
 * The story under it, which nobody in the hall knows whole: someone is buying the guild
 * from the inside, a member at a time. The raids on the caravans out at the Drowned Mile are
 * meant to break the ones who won't sell; Master Thrale lends the broken ones silver against
 * their shares, and the silver is new, and it isn't his. (It comes, through Vane and the grey
 * coats of the Black Rose's back room, from the Astarix's people; nobody in Gloomhaven knows
 * of the orb, and nobody is told.) Edric Lowe has half guessed it and nobody will hear him.
 */

/** The quest in systems/Quests.ts. */
export const GUILD_QUEST = 'caravan-raids';

/** What's happened at the Guildhall, as quest flags. */
export const GUILD_FLAGS = {
  /** The hero walked in on the meeting, and it's over: the members keep their own hours now. */
  met: 'guild-met',
  /** Taken on by the guild to find out what is behind the raids. */
  hired: 'guild-hired',
  /** Asked the guild to let Edric Lowe finish, at the meeting (Thrale noticed). */
  heardLowe: 'guild-heard-lowe',
  /** Nat Garrow told what he saw at the Drowned Mile: the punt in the fog, the man in grey, the coin. */
  garrow: 'guild-garrow',
  /** Pim gave the hero leave to read the route book. */
  pimLeave: 'guild-pim-leave',
  /** Read the route book: Master Thrale asked to see it before every caravan that was hit. */
  ledger: 'guild-ledger',
  /** Edric Lowe, away from Thrale, said his piece about the new silver, and sent the hero out to the wreck. */
  edric: 'guild-edric',
  /** Read the guildmaster's letters, with his leave: an offer for the charter, sealed in grey wax. */
  letters: 'guild-letters',
  /** Dame Marrable told of the offer for her late brother's share. */
  marrable: 'guild-marrable',
  /** Tunstall owned that Thrale lent him silver against his next caravan. */
  tunstall: 'guild-tunstall',
} as const;

/** Coins on account when the guild takes the hero on, and what Wexley promises for the answer. */
export const GUILD_EARNEST = 15;
export const GUILD_FEE = 100;

/** The hours the Guildhall's door on the Staithe stands open. */
export const GUILD_HOURS: [number, number] = [7, 21];

/** For the guild's talk, kept up to date by the scene (scenes/game/guildhall.ts). */
export const GuildWorld = {
  /** Master Thrale is in the hall, within earshot, so Edric Lowe won't speak freely. */
  thraleHere: false,
};
