import Phaser from 'phaser';
import { GameAudio } from '../audio/Audio';
import { AmbientMix, SILENCE, Surface } from '../audio/Soundscape';
import type { Npc } from '../entities/Npc';
import { marketOpen } from '../systems/MarketHours';
import { ambientAt } from '../systems/TimeOfDay';
import { AreaId, MapData, Terrain } from './MapData';
import { SMITHY } from './MarketMap';

/** How often the mix is worked out again, in seconds. The sounds glide between, so this needn't be often. */
const MIX_EVERY = 0.4;
/** Tiles walked between footsteps (a stride). */
const STRIDE = 0.62;
/** The hours the monastery bell rings for the offices: Prime, Terce, Sext, None, Vespers, Compline. */
const BELL_HOURS = [6, 9, 12, 15, 18, 21];

const clamp01 = (v: number) => Phaser.Math.Clamp(v, 0, 1);
/** 1 when `d` tiles is right there, falling to 0 at `range`. */
const nearness = (d: number, range: number) => clamp01(1 - d / range) ** 1.5;

/** How each place sounds, apart from what the hour and the people in it add. */
interface Place {
  /** Out under the sky: wind, birds by day, crickets and owls by night. */
  open?: boolean;
  wind?: number;
  /** How much wildlife there is (1 in the countryside, less in town). */
  wild?: number;
  /** Wolves are out there somewhere. */
  wolves?: boolean;
  fire?: number;
  cave?: number;
  echo?: number;
  /** The monastery bell, and how close its tower is (0..1). */
  bell?: number;
  /** A taproom, or the floors above one (how muffled, 0..1). */
  tavern?: number;
  /** Plates and cups knocking about, on top of the tavern's. */
  clatter?: number;
}

const PLACES: Record<AreaId, Place> = {
  world: { open: true, wind: 0.55, wild: 1, wolves: true },
  plains: { open: true, wind: 0.95, wild: 1, wolves: true },
  market: { open: true, wind: 0.35, wild: 0.4 },
  monastery: { open: true, wind: 0.5, wild: 0.9, bell: 0.45 },
  abbey: { open: true, wind: 0.35, wild: 0.6, bell: 0.85, echo: 0.2 },
  home: { fire: 0.75, echo: 0.1 },
  hut: { fire: 0.6, echo: 0.1 },
  tavern: { fire: 0.7, tavern: 1, echo: 0.2 },
  'tavern-hall': { tavern: 0.3, echo: 0.2 },
  'tavern-room': { tavern: 0.15, fire: 0.2, echo: 0.1 },
  cellar: { cave: 0.35, tavern: 0.12, echo: 0.6 },
  chapel: { bell: 0.7, echo: 0.9 },
  infirmary: { fire: 0.5, bell: 0.35, echo: 0.3 },
  scriptorium: { fire: 0.3, bell: 0.35, echo: 0.3 },
  refectory: { fire: 0.6, bell: 0.35, clatter: 0.35, echo: 0.4 },
  cave: { cave: 1, echo: 1 },
  den: { cave: 0.9, echo: 1 },
  deepden: { cave: 1, echo: 1 },
};

/**
 * Works out what the world sounds like where the hero is standing, and when:
 * birds by day and crickets, frogs and owls by night, the wind out on the
 * plains, waves where they're near the lake, the market's chatter while it's
 * open and the smith's hammer near the smithy, the taproom filling up of an
 * evening, bees by the monastery's hives, and the bell ringing the hours. It
 * also plays the hero's footsteps, by what's underfoot.
 *
 * The sounds themselves are made in audio/Soundscape.ts; this only sets
 * their levels.
 */
export class AmbientSounds {
  private readonly place: Place;
  private readonly water: Array<{ x: number; y: number }> = [];
  private readonly hives?: { x: number; y: number };
  private mixTimer = 0;
  private stride = 0;
  private lastPos?: { x: number; y: number };
  private lastHour?: number;

  constructor(
    private readonly area: AreaId,
    private readonly data: MapData,
  ) {
    this.place = PLACES[area] ?? {};
    // Only the water's edge matters: that's where the waves are.
    const { terrain, width, height } = data;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (terrain[y][x] !== Terrain.Water) continue;
        const shore = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
          const t = terrain[y + dy]?.[x + dx];
          return t !== undefined && t !== Terrain.Water;
        });
        if (shore) this.water.push({ x: x + 0.5, y: y + 0.5 });
      }
    }
    const hives = data.landmarks?.find((l) => l.name === 'The beehives');
    if (hives) this.hives = { x: hives.gx, y: hives.gy };
  }

  /**
   * @param walking how loud a step is: 1 walking, less sneaking, more sprinting, 0 standing still
   */
  update(dt: number, player: { x: number; y: number }, hour: number, npcs: Npc[], walking: number): void {
    this.footsteps(player, walking);
    this.bells(hour);
    this.mixTimer -= dt;
    if (this.mixTimer > 0) return;
    this.mixTimer = MIX_EVERY;
    GameAudio.setAmbience(this.mix(player, hour, npcs));
  }

  /** Silence the world, e.g. on leaving the area. */
  stop(): void {
    GameAudio.setAmbience({ ...SILENCE });
  }

  private mix(player: { x: number; y: number }, hour: number, npcs: Npc[]): AmbientMix {
    const p = this.place;
    const night = ambientAt(hour).darkness;
    const day = 1 - night;
    const mix: AmbientMix = { ...SILENCE, echo: p.echo ?? 0.05, fire: p.fire ?? 0, cave: p.cave ?? 0 };

    if (p.open) {
      const wild = p.wild ?? 1;
      // The dawn chorus: the birds are loudest just after first light.
      const dawn = hour >= 5 && hour < 8.5 ? 1.5 : 1;
      mix.wind = clamp01((p.wind ?? 0.5) * (1 + night * 0.25));
      mix.birds = clamp01(day * wild * 0.75 * dawn);
      mix.crickets = clamp01((night - 0.3) / 0.5) * wild;
      mix.owls = clamp01((night - 0.75) / 0.25) * wild;
      mix.wolves = p.wolves ? clamp01((night - 0.85) / 0.15) * 0.8 : 0;
      const shore = this.nearestWater(player);
      mix.water = nearness(shore, 8);
      mix.frogs = nearness(shore, 11) * clamp01((night - 0.4) / 0.4) * wild;
    }

    if (this.area === 'market') {
      const open = marketOpen(hour);
      const folk = npcs.filter((n) => n.present && n.distanceTo(player.x, player.y) < 14).length;
      mix.crowd = open ? clamp01(0.35 + folk / 10) : 0;
      mix.forge = marketOpen(hour, SMITHY.late) ? nearness(Math.hypot(player.x - SMITHY.x, player.y - SMITHY.y), 20) : 0;
    }

    if (p.tavern) {
      // The taproom's din comes from the folk drinking in it, and carries upstairs faintly.
      const folk = this.area === 'tavern' ? npcs.filter((n) => n.present).length : this.taproomGuess(hour);
      const busy = clamp01(folk / 7);
      mix.crowd = busy * p.tavern;
      mix.clatter = (0.2 + busy * 0.8) * p.tavern;
    }
    if (p.clatter) mix.clatter = Math.max(mix.clatter, p.clatter);

    if (this.hives) mix.bees = nearness(Math.hypot(player.x - this.hives.x, player.y - this.hives.y), 9) * clamp01(day * 1.5 - 0.3);
    return mix;
  }

  /** Upstairs, with no one in view: the taproom's quiet by day and fills of an evening. */
  private taproomGuess(hour: number): number {
    if (hour >= 18 || hour < 1) return 7;
    if (hour >= 11 && hour < 14) return 3;
    return 1;
  }

  private nearestWater(player: { x: number; y: number }): number {
    let best = Infinity;
    for (const w of this.water) {
      const d = (w.x - player.x) ** 2 + (w.y - player.y) ** 2;
      if (d < best) best = d;
    }
    return Math.sqrt(best);
  }

  private footsteps(player: { x: number; y: number }, walking: number): void {
    const last = this.lastPos;
    this.lastPos = { x: player.x, y: player.y };
    if (!last || walking <= 0) return;
    const moved = Math.hypot(player.x - last.x, player.y - last.y);
    // A jump (a door, a road's end) isn't a step.
    if (moved > 1) return;
    this.stride += moved;
    if (this.stride < STRIDE) return;
    this.stride -= STRIDE;
    GameAudio.footstep(this.surface(player), walking);
  }

  private surface(player: { x: number; y: number }): Surface {
    const t = this.data.terrain[Math.floor(player.y)]?.[Math.floor(player.x)];
    switch (t) {
      case Terrain.Grass:
        return 'grass';
      case Terrain.Dirt:
        return 'dirt';
      case Terrain.Sand:
        return 'sand';
      case Terrain.Soil:
        return 'soil';
      case Terrain.Cave:
        return 'gravel';
      case Terrain.Floor:
        // The monastery's rooms are flagged; everywhere else has boards.
        return this.place.bell ? 'stone' : 'wood';
      default:
        return 'stone';
    }
  }

  /** The monastery bell rings three strokes for each office of the day. */
  private bells(hour: number): void {
    const prev = this.lastHour;
    this.lastHour = hour;
    if (!this.place.bell || prev === undefined) return;
    // Hours jump when sleeping or fast-forwarding: only ring for a small step.
    const step = Phaser.Math.Wrap(hour - prev, 0, 24);
    if (step <= 0 || step > 0.5) return;
    if (BELL_HOURS.some((h) => prev < h && hour >= h)) GameAudio.bell(3, this.place.bell);
  }
}
