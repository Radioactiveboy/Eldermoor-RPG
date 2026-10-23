/** Global tuning values. Change these to adjust feel without touching systems. */
export const TILE_WIDTH = 64;
export const TILE_HEIGHT = 32;

export const MAP_WIDTH = 48;
export const MAP_HEIGHT = 48;
export const MAP_SEED = 'eldermoor';

export const PLAYER_SPEED = 4; // tiles per second
export const PLAYER_RADIUS = 0.25; // in tiles, used for collision

export const CAMERA_ZOOM = { min: 0.5, max: 2.5, default: 1.25 };

export const SPRINT_MULTIPLIER = 1.6; // hold Shift to sprint
export const STAMINA = { max: 100, drainPerSecond: 28, regenPerSecond: 18, regenDelay: 0.8, sprintMinimum: 15 };
export const HEALTH = { max: 100, regenPerSecond: 1 };

export const DAY_LENGTH_SECONDS = 600; // one full in-game day = 10 real minutes
export const START_HOUR = 8; // the game starts at 08:00
export const FAST_FORWARD = 60; // hold T to run the clock this many times faster
