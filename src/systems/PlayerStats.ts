import Phaser from 'phaser';
import { HEALTH, STAMINA } from '../config';
import { Experience } from './Experience';
import { Needs } from './Needs';

/**
 * Health and stamina. Maximum health rises with each level. Sprinting spends stamina; it refills after a short rest.
 * Combat and hazards can call damage() / heal() once they exist.
 */
export class PlayerStats {
  health = HEALTH.max;
  stamina = STAMINA.max;
  readonly maxStamina = STAMINA.max;
  private restTimer = 0;
  private exhausted = false;

  /** Grows with the hero's level. */
  get maxHealth(): number {
    return HEALTH.max + Experience.healthBonus;
  }

  /** As far as stamina refills: the whole bar, or less when weary (see systems/Needs.ts). */
  get staminaCap(): number {
    return this.maxStamina * Needs.staminaCap;
  }

  /** True after stamina ran dry, until it recovers enough to sprint again. */
  get isExhausted(): boolean {
    return this.exhausted;
  }

  /** True if the player is allowed to sprint this frame. */
  canSprint(): boolean {
    return !this.exhausted && this.stamina > 0;
  }

  update(dt: number, sprinting: boolean): void {
    if (sprinting) {
      this.stamina = Math.max(0, this.stamina - STAMINA.drainPerSecond * dt);
      this.restTimer = 0;
      // Running dry locks sprinting until stamina has recovered a little.
      if (this.stamina === 0) this.exhausted = true;
    } else {
      this.restTimer += dt;
      if (this.restTimer >= STAMINA.regenDelay) {
        const cap = this.staminaCap;
        if (this.stamina < cap) this.stamina = Math.min(cap, this.stamina + STAMINA.regenPerSecond * Needs.staminaRegen * dt);
      }
      if (this.stamina >= STAMINA.sprintMinimum) this.exhausted = false;
    }
    if (Needs.healthRegen) this.health = Math.min(this.maxHealth, this.health + HEALTH.regenPerSecond * dt);
  }

  damage(amount: number): void {
    this.health = Phaser.Math.Clamp(this.health - amount, 0, this.maxHealth);
  }

  restoreStamina(amount: number): void {
    // Food and rest don't fill a weary hero past what they could recover to, but nothing takes away what's already there.
    const cap = Math.max(this.staminaCap, Math.min(this.stamina, this.maxStamina));
    this.stamina = Phaser.Math.Clamp(this.stamina + amount, 0, amount > 0 ? cap : this.maxStamina);
    if (this.stamina >= STAMINA.sprintMinimum) this.exhausted = false;
  }

  heal(amount: number): void {
    this.health = Phaser.Math.Clamp(this.health + amount, 0, this.maxHealth);
  }
}
