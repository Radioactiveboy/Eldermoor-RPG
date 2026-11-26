/**
 * The Fen Road (world/FenRoadMap.ts): what the hero has done and found out
 * there, as quest flags so they're saved with everything else. The way out
 * through the Fen Gate is world/landmarks.ts's FEN_GATE_OPEN; the guild's quest
 * about the raids is systems/Guild.ts's.
 */
export const FEN_FLAGS = {
  /** Looked at the wreck of the guild's last caravan, at the Drowned Mile. */
  wreck: 'fen-wreck',
  /** Looked at the tracks going off the causeway into the mere: three toes, a spur and a tail. */
  tracks: 'fen-tracks',
  /** Saw something come up out of the mere and look back. */
  watcher: 'fen-watcher',
  /** Picked the white scale up out of the mud. */
  scale: 'fen-scale',
  /** Left a copper at the Lady's shrine. */
  offered: 'fen-offered',
  /** Gammer Teal told of the night of the raid, and the man in grey in his punt who paid her in tower silver. */
  punt: 'fen-gammer-punt',
  /** Gammer Teal told of the Mere-kin and the white one. */
  white: 'fen-gammer-white',
  /** Told Captain Vosk about the tracks. */
  toldVosk: 'fen-told-vosk',
  /** Told Edric Lowe what was found at the Drowned Mile. */
  report: 'fen-report',
} as const;
