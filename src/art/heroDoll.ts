import type Phaser from 'phaser';
import type { EquipSlot, ItemId } from '../systems/Inventory';
import { personSpec, renderFrame } from './figure3d';
import { dressed } from './gear';
import { heroModel } from './hero3d';

/** How much finer than the folk the equipment screen's hero is drawn: 5 makes a 160 by 240 picture. */
const DOLL_SCALE = 5;
/** Turned a little towards the light, as a portrait would be. */
const DOLL_ANGLE = 28;
export const HERO_DOLL_KEY = 'hero-doll';
let paintedFor = '';

/**
 * The hero drawn large and fine for the equipment screen's paper doll, in
 * whatever they're wearing. Repainted only when the gear changes.
 */
export function paintHeroDoll(scene: Phaser.Scene, equipped: Partial<Record<EquipSlot, ItemId>>): string {
  const sig = JSON.stringify(equipped);
  if (sig === paintedFor && scene.textures.exists(HERO_DOLL_KEY)) return HERO_DOLL_KEY;
  const frame = renderFrame(heroModel({ stride: 0, bob: 0, flutter: 1 }, dressed(equipped)), DOLL_ANGLE, personSpec(DOLL_SCALE, { creases: true }));
  frame.outline();
  frame.toTexture(scene, HERO_DOLL_KEY);
  paintedFor = sig;
  return HERO_DOLL_KEY;
}
