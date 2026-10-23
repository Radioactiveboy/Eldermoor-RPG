import Phaser from 'phaser';
import { HEALTH, STAMINA } from '../config';

/**
 * Health and stamina. Sprinting spends stamina; it refills after a short rest.
 * Combat and hazards can call damage() / heal() once they exist.
 */
export class PlayerStats {
  health = HEALTH.max;
  stamina = STAMINA.max;
  readonly maxHealth = HEALTH.max;
  readonly maxStamina = STAMINA.max;
  private restTimer = 0;
  private exhausted = false;

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
        this.stamina = Math.min(this.maxStamina, this.stamina + STAMINA.regenPerSecond * dt);
      }
      if (this.stamina >= STAMINA.sprintMinimum) this.exhausted = false;
    }
    this.health = Math.min(this.maxHealth, this.health + HEALTH.regenPerSecond * dt);
  }

  damage(amount: number): void {
    this.health = Phaser.Math.Clamp(this.health - amount, 0, this.maxHealth);
  }

  heal(amount: number): void {
    this.health = Phaser.Math.Clamp(this.health + amount, 0, this.maxHealth);
  }
}
