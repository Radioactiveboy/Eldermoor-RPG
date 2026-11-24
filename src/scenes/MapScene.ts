import Phaser from 'phaser';
import * as ink from '../art/mapInk';
import { GameAudio } from '../audio/Audio';
import { Settings } from '../settings/Settings';
import { currentTarget, placeIn } from '../systems/QuestTargets';
import { QuestLog } from '../systems/Quests';
import { AREA_NAMES } from '../systems/SaveGame';
import { THEME } from '../ui/Widgets';
import { anchor, atlasPoint, known, LINKS, Region, region, REGIONS, route, Spot, toAtlas } from '../world/atlas';
import { SURVEY, SURVEY_CELL } from '../world/atlasSurvey';
import type { AreaId } from '../world/MapData';
import type { GameScene } from './GameScene';

/** The sheet is drawn at this size and scaled to fit the screen. */
const SHEET_W = 1100;
const SHEET_H = 760;
/** The part of the sheet the country is drawn in, inside the frame and clear of the title. */
const AREA = { x: -420, y: -292, w: 840, h: 512 };
/** The sheet's painting is made at this many pixels per sheet pixel, so it stays sharp when scaled up. */
const SHARP = 2;

const INK_TEXT = '#3b2a1a';
const INK_FADED = '#6e5a3e';
const RUBRIC = '#8e2f22';
const GOLD = 0xffc43d;
const BODY_FONT = 'Merriweather, Georgia, "Times New Roman", serif';
/** The title, and roughly how far a league is in atlas units (the trek between the Hollow and Adowvale is two). */
const TITLE = 'The Shire of Adowvale';
const LEAGUE = 21;

/** Where "Lands unknown" is lettered, while there's country still to find. */
const UNKNOWN = { x: SHEET_W / 2 - 150, y: -SHEET_H / 2 + 120 };

/** The thin colour wash laid over each kind of country before it's inked. */
const WASH: Record<Region['look'], number> = {
  fields: 0xa9bb72,
  woods: 0x7f9a5c,
  village: 0xd2b27e,
  plains: 0xc9c784,
  grounds: 0xb3c27e,
  cloister: 0xc4b89a,
};

/** Names on the map that only say where a road goes: the road itself says that. */
const QUIET_NAMES = /^The (path|road) /;

/**
 * The world map: an old hand-inked fantasy map of the country the hero has seen so far,
 * north at the top. Each region is drawn from the survey of its real ground
 * (world/atlasSurvey.ts: its woods, water, roads, fields and buildings), washed with
 * colour and lettered; the roads between them run across the parchment, and roads to
 * places not yet seen trail off with a question mark. The hero's mark and the current
 * quest step's (unless quest markers are off in Settings) sit on top. Opened with M or
 * the journal's Map tab; M, J, Esc or a click closes it. The layout is world/atlas.ts.
 */
export class MapScene extends Phaser.Scene {
  private dim!: Phaser.GameObjects.Rectangle;
  private sheet!: Phaser.GameObjects.Container;
  private closing = false;
  /** Atlas units to sheet pixels, and where the atlas's origin sits on the sheet. */
  private scaleBy = 1;
  private offset = { x: 0, y: 0 };

  constructor() {
    super('Map');
  }

  create(): void {
    this.closing = false;
    this.dim = this.add.rectangle(0, 0, 10, 10, 0x000000, 0.65).setOrigin(0).setInteractive();
    this.dim.on('pointerup', () => this.close());
    const kb = this.input.keyboard!;
    kb.on('keydown-ESC', () => this.close());
    kb.on('keydown-M', () => this.close());
    kb.on('keydown-J', () => this.close());

    this.fit();
    this.sheet = this.add.container(0, 0);
    this.draw();
    this.layout();
    this.scale.on('resize', this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off('resize', this.layout, this));

    GameAudio.pageTurn();
    const target = this.sheet.scale;
    this.sheet.setScale(target * 0.92).setAlpha(0);
    this.tweens.add({ targets: this.sheet, scale: target, alpha: 1, duration: 240, ease: 'Back.easeOut' });
  }

  /** Scale the whole country (seen or not) onto the sheet, so the map doesn't shift about as more of it is found. */
  private fit(): void {
    const minX = Math.min(...REGIONS.map((r) => r.box.x)) - 3;
    const maxX = Math.max(...REGIONS.map((r) => r.box.x + r.box.w)) + 3;
    const minY = Math.min(...REGIONS.map((r) => r.box.y)) - 3;
    const maxY = Math.max(...REGIONS.map((r) => r.box.y + r.box.h)) + 2;
    this.scaleBy = Math.min(AREA.w / (maxX - minX), AREA.h / (maxY - minY));
    this.offset = {
      x: AREA.x + (AREA.w - (maxX - minX) * this.scaleBy) / 2 - minX * this.scaleBy,
      y: AREA.y + (AREA.h - (maxY - minY) * this.scaleBy) / 2 - minY * this.scaleBy,
    };
  }

  /** An atlas point on the sheet. North (-y) is up. */
  private at(p: Spot): Spot {
    return { x: this.offset.x + p.x * this.scaleBy, y: this.offset.y + p.y * this.scaleBy };
  }

  /** A tile in a region's own map, on the sheet. */
  private tile(r: Region, x: number, y: number): Spot {
    return this.at(toAtlas(r, { x, y }));
  }

  private draw(): void {
    const game = this.scene.get('Game') as GameScene;
    const visited = new Set<AreaId>(game.visited);
    visited.add(game.area);
    const shown = REGIONS.filter((r) => known(r.id, visited));
    const rnd = new Phaser.Math.RandomDataGenerator(['eldermoor-map']);

    // Everything that doesn't move is painted once, into a texture, at twice the sheet's size.
    const g = this.make.graphics({}, false);
    ink.parchment(g, SHEET_W, SHEET_H, rnd);
    for (const r of shown) this.wash(g, r);
    const roads = this.drawRoads(g, visited, rnd);
    this.drawWilds(g, shown, roads);
    // Back to front, so nearer things overlap those behind them.
    for (const r of [...shown].sort((a, b) => a.box.y - b.box.y)) this.drawRegion(g, r);
    ink.frame(g, SHEET_W, SHEET_H);
    ink.banner(g, 0, -SHEET_H / 2 + 52, 400, 40);
    ink.compassRose(g, -SHEET_W / 2 + 120, SHEET_H / 2 - 150, 62);
    const barUnit = (LEAGUE * this.scaleBy) / 2;
    ink.scaleBar(g, SHEET_W / 2 - 92 - barUnit * 4, SHEET_H / 2 - 112, barUnit, 4);
    const rt = this.add.renderTexture(0, 0, SHEET_W * SHARP, SHEET_H * SHARP).setScale(1 / SHARP);
    g.setScale(SHARP);
    rt.draw(g, (SHEET_W * SHARP) / 2, (SHEET_H * SHARP) / 2);
    g.destroy();
    this.sheet.add(rt);

    this.letter(0, -SHEET_H / 2 + 52, TITLE, { fontFamily: THEME.font, fontSize: '22px', color: INK_TEXT, fontStyle: 'bold' }, 3);
    this.letter(-SHEET_W / 2 + 120, SHEET_H / 2 - 150 - 78, 'N', { fontFamily: THEME.font, fontSize: '18px', color: RUBRIC, fontStyle: 'bold' });
    this.letter(SHEET_W / 2 - 92 - barUnit * 2, SHEET_H / 2 - 124, 'Two leagues', { fontFamily: BODY_FONT, fontSize: '12px', color: INK_FADED, fontStyle: 'italic' });
    // Region names first, then the places in them wherever there's still room.
    const taken: Phaser.Geom.Rectangle[] = [];
    for (const r of shown) this.labelRegion(r, taken);
    for (const r of shown) this.labelPlaces(r, taken);
    if (shown.length < REGIONS.length) {
      // The blank parchment past what's been seen.
      this.letter(UNKNOWN.x, UNKNOWN.y, 'Lands unknown', { fontFamily: BODY_FONT, fontSize: '13px', color: '#9a8458', fontStyle: 'italic' }, 2);
    }

    // The hero: where they stand in an area out of doors, or at the door of the place they're in.
    const here = region(game.area) ? atlasPoint(game.area, { x: game.player.gx, y: game.player.gy }) : atlasPoint(game.area);
    const target = Settings.get().showQuestMarkers ? this.targetMark(game.area, visited) : undefined;
    if (target) this.drawTarget(this.at(target.at));
    if (here) this.drawHero(this.at(here));

    // Along the foot of the sheet: where the hero is, and where the next step is.
    const quest = QuestLog.focused;
    const step = quest && QuestLog.current(quest);
    const lines: Array<[string, string]> = [[`You are in ${placeIn(game.area)}.`, INK_TEXT]];
    if (step && Settings.get().showQuestMarkers) lines.push([`◆ ${step.text}${target?.where ? `  (${target.where})` : ''}`, RUBRIC]);
    lines.forEach(([text, color], i) => {
      this.sheet.add(
        this.add
          .text(0, SHEET_H / 2 - 92 + i * 24, text, { fontFamily: BODY_FONT, fontSize: '15px', color, fontStyle: i ? 'normal' : 'italic', align: 'center', wordWrap: { width: 780 } })
          .setOrigin(0.5, 0),
      );
    });
    const close = this.add
      .text(SHEET_W / 2 - 8, -SHEET_H / 2 + 8, '✕', { fontFamily: BODY_FONT, fontSize: '22px', color: '#f3e2b3', backgroundColor: '#3a2014' })
      .setPadding(8, 3, 8, 5)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    close.on('pointerup', () => this.close());
    const touch = this.sys.game.device.input.touch;
    const hint = this.add
      .text(0, SHEET_H / 2 + 12, touch ? 'Tap anywhere to close' : 'M or Esc to close', { fontFamily: BODY_FONT, fontSize: '14px', color: THEME.dimText })
      .setOrigin(0.5, 0);
    this.sheet.add([close, hint]);
  }

  /** Lettering on the sheet, spaced out like a mapmaker's. */
  private letter(x: number, y: number, text: string, style: Phaser.Types.GameObjects.Text.TextStyle, spacing = 1): Phaser.GameObjects.Text {
    const t = this.add.text(x, y, text, style).setOrigin(0.5).setLetterSpacing(spacing);
    this.sheet.add(t);
    return t;
  }

  /** A thin wash of colour over a region, soft at its ragged edges, as if brushed on. */
  private wash(g: Phaser.GameObjects.Graphics, r: Region): void {
    const rnd = new Phaser.Math.RandomDataGenerator([`wash-${r.id}`]);
    const c = this.at({ x: r.box.x + r.box.w / 2, y: r.box.y + r.box.h / 2 });
    const hw = (r.box.w * this.scaleBy) / 2;
    const hh = (r.box.h * this.scaleBy) / 2;
    for (const [grow, alpha] of [[1.08, 0.12], [1.02, 0.16], [0.95, 0.2]] as const) {
      g.fillStyle(WASH[r.look], alpha);
      g.fillPoints(ink.blob(c.x, c.y, hw * grow, hh * grow, rnd, 0.06), true);
    }
  }

  /** A region drawn from the survey of its ground: water, fields, roads, walls, then woods, hills and buildings. */
  private drawRegion(g: Phaser.GameObjects.Graphics, r: Region): void {
    const s = SURVEY[r.id];
    if (!s) return;
    const rnd = new Phaser.Math.RandomDataGenerator([`ink-${r.id}`]);
    const cellW = (SURVEY_CELL / r.tiles.w) * r.box.w * this.scaleBy;
    const cellH = (SURVEY_CELL / r.tiles.h) * r.box.h * this.scaleBy;
    const cell = Math.min(cellW, cellH);
    const centre = (cx: number, cy: number) => this.tile(r, (cx + 0.5) * SURVEY_CELL, (cy + 0.5) * SURVEY_CELL);
    const at = (ch: string) => {
      const out: Array<{ cx: number; cy: number; x: number; y: number }> = [];
      s.ground.forEach((row, cy) => [...row].forEach((c, cx) => c === ch && out.push({ cx, cy, ...centre(cx, cy) })));
      return out;
    };
    const has = (ch: string, cx: number, cy: number) => s.ground[cy]?.[cx] === ch;

    // Paving (squares, courts, cloisters), fields, then water.
    for (const p of at('P')) ink.paving(g, p.x, p.y, cellW, cellH);
    for (const f of at('F')) ink.field(g, f.x, f.y, cell * 0.9, rnd);
    const pools = at('W');
    if (pools.length) ink.water(g, pools, cell * 0.72, rnd);

    // Roads: a track between each pair of neighbouring road patches. In a village, where
    // the ground between the houses is all lanes, it's drawn as one beaten-earth square instead.
    if (r.look === 'village') {
      for (const p of at('R')) {
        g.fillStyle(0xc9a97a, 0.55);
        g.fillRect(p.x - cellW / 2 - 0.5, p.y - cellH / 2 - 0.5, cellW + 1, cellH + 1);
      }
    }
    g.lineStyle(Math.max(1.2, cell * 0.16), 0x8a6338, 0.85);
    for (const p of r.look === 'village' ? [] : at('R')) {
      for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [-1, 1]]) {
        if (!has('R', p.cx + dx, p.cy + dy)) continue;
        // A diagonal only where there's no square way round.
        if (dx && dy && (has('R', p.cx + dx, p.cy) || has('R', p.cx, p.cy + dy))) continue;
        const q = centre(p.cx + dx, p.cy + dy);
        g.lineBetween(p.x, p.y, q.x, q.y);
      }
    }
    // Walls.
    for (const p of at('X')) {
      for (const [dx, dy] of [[1, 0], [0, 1]]) {
        if (!has('X', p.cx + dx, p.cy + dy)) continue;
        const q = centre(p.cx + dx, p.cy + dy);
        ink.wall(g, p.x, p.y, q.x, q.y);
      }
    }

    // Everything standing up, back to front: trees, hills, grass, buildings.
    const standing: Array<{ y: number; draw: () => void }> = [];
    const firs = r.look === 'woods' ? 0.55 : 0.2;
    const rows = s.ground.length;
    const cols = s.ground[0].length;
    for (const t of at('T')) {
      // The woods round the edge of every area's map are thinned, so the regions don't come out as boxes of trees.
      const edge = Math.min(t.cx, t.cy, cols - 1 - t.cx, rows - 1 - t.cy);
      if (rnd.frac() < (edge < 2 ? [0.7, 0.35][edge] : 0)) continue;
      const n = r.look === 'woods' || r.look === 'fields' ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const x = t.x + rnd.realInRange(-0.45, 0.45) * cellW;
        const y = t.y + rnd.realInRange(-0.35, 0.5) * cellH;
        const size = cell * rnd.realInRange(0.48, 0.62);
        const fir = rnd.frac() < firs;
        standing.push({ y, draw: () => (fir ? ink.pine(g, x, y, size) : ink.tree(g, x, y, size)) });
      }
    }
    for (const h of at('H')) {
      if (rnd.frac() < 0.4) continue;
      standing.push({ y: h.y, draw: () => ink.hill(g, h.x, h.y + cell * 0.3, cell * 0.55) });
    }
    if (r.look === 'plains' || r.look === 'fields' || r.look === 'grounds') {
      for (const o of at('.')) {
        if (rnd.frac() > 0.12) continue;
        const x = o.x + rnd.realInRange(-0.4, 0.4) * cellW;
        const y = o.y + rnd.realInRange(-0.4, 0.4) * cellH;
        standing.push({ y, draw: () => ink.tuft(g, x, y, cell * 0.45) });
      }
    }
    for (const [kind, x, y, w, h] of s.features) {
      const foot = this.tile(r, x + w / 2, y + h);
      const size = Math.max(7, Math.min(16, cell * 1.05 * Math.sqrt((w * h) / 9)));
      const draw = {
        house: () => ink.house(g, foot.x, foot.y, size, rnd.frac() < 0.35),
        cottage: () => ink.cottage(g, foot.x, foot.y, size),
        inn: () => ink.inn(g, foot.x, foot.y, size),
        church: () => ink.church(g, foot.x, foot.y, size * 0.9),
        hall: () => ink.hall(g, foot.x, foot.y, size * 0.75),
        tower: () => ink.tower(g, foot.x, foot.y, size, r.look === 'woods'),
        cave: () => ink.cave(g, foot.x, foot.y, size * 0.8),
        willow: () => ink.willow(g, foot.x, foot.y, size),
        gate: () => ink.gate(g, foot.x, foot.y, size * 0.8),
        well: () => ink.well(g, foot.x, foot.y, size * 0.7),
      }[kind];
      standing.push({ y: foot.y, draw });
    }
    standing.sort((a, b) => a.y - b.y).forEach((s) => s.draw());
  }

  /** The region's name in spaced capitals. */
  private labelRegion(r: Region, taken: Phaser.Geom.Rectangle[]): void {
    const style = { fontFamily: THEME.font, fontStyle: 'bold', color: INK_TEXT, stroke: '#eadbb2', strokeThickness: 4, align: 'center' };
    let t: Phaser.GameObjects.Text;
    if (r.label) {
      const c = this.tile(r, r.label.x, r.label.y);
      t = this.letter(c.x, c.y, AREA_NAMES[r.id].toUpperCase(), { ...style, fontSize: r.box.w * r.box.h > 900 ? '17px' : '14px', wordWrap: { width: 170 } }, 3);
    } else {
      const c = this.at({ x: r.box.x + r.box.w / 2, y: r.box.y });
      t = this.letter(c.x, c.y - 10, AREA_NAMES[r.id].toUpperCase(), { ...style, fontSize: '12px' }, 2);
    }
    taken.push(this.box(t));
  }

  /** The names of the places in a region, in small italics, each only where it won't run into another. */
  private labelPlaces(r: Region, taken: Phaser.Geom.Rectangle[]): void {
    if (r.box.w * r.box.h < 700) return;
    for (const [name, x, y] of SURVEY[r.id]?.names ?? []) {
      if (QUIET_NAMES.test(name)) continue;
      const p = this.tile(r, x, y);
      const t = this.letter(p.x, p.y + 9, name, { fontFamily: BODY_FONT, fontSize: '10px', fontStyle: 'italic', color: INK_FADED, stroke: '#eadbb2', strokeThickness: 3 });
      const b = this.box(t);
      if (taken.some((o) => Phaser.Geom.Rectangle.Overlaps(o, b))) t.destroy();
      else taken.push(b);
    }
  }

  /** A label's footprint on the sheet, with a little room round it. */
  private box(t: Phaser.GameObjects.Text): Phaser.Geom.Rectangle {
    return new Phaser.Geom.Rectangle(t.x - t.width / 2 - 4, t.y - t.height / 2 - 2, t.width + 8, t.height + 4);
  }

  /**
   * The open country between the places the hero knows, so the map reads as one land
   * rather than islands on blank paper: rolling hills and mountains rising to the north,
   * woods in drifts, grass between. It's scenery, the same on every visit and named
   * nowhere; it keeps clear of the regions, the roads, and the compass.
   */
  private drawWilds(g: Phaser.GameObjects.Graphics, shown: Region[], roads: Array<Array<{ x: number; y: number }>>): void {
    const rnd = new Phaser.Math.RandomDataGenerator(['wilds']);
    const noise = valueNoise(rnd);
    const boxes = shown.map((r) => {
      const a = this.at({ x: r.box.x, y: r.box.y });
      return new Phaser.Geom.Rectangle(a.x - 6, a.y - 4, r.box.w * this.scaleBy + 12, r.box.h * this.scaleBy + 8);
    });
    if (shown.length < REGIONS.length) boxes.push(new Phaser.Geom.Rectangle(UNKNOWN.x - 80, UNKNOWN.y - 16, 160, 32));
    const compass = new Phaser.Geom.Circle(-SHEET_W / 2 + 120, SHEET_H / 2 - 150, 84);
    const nearRoad = (x: number, y: number) =>
      roads.some((path) => path.some((p, i) => i > 0 && Phaser.Math.Distance.Between(...nearest(path[i - 1], p, x, y)) < 12));
    const standing: Array<{ y: number; draw: () => void }> = [];
    const step = 13;
    for (let y = AREA.y + 10; y < AREA.y + AREA.h + 26; y += step) {
      for (let x = AREA.x - 6; x < AREA.x + AREA.w + 6; x += step) {
        const px = x + rnd.realInRange(-0.4, 0.4) * step;
        const py = y + rnd.realInRange(-0.4, 0.4) * step;
        if (boxes.some((b) => b.contains(px, py)) || compass.contains(px, py) || nearRoad(px, py)) continue;
        // Higher ground to the north, where the Northwoods and the abbey's hills are.
        const north = 1 - (py - AREA.y) / AREA.h;
        const high = noise(px / 120, py / 120) * 0.75 + north * 0.45;
        const wood = noise(px / 70 + 40, py / 70 + 40);
        const roll = rnd.frac();
        if (high > 0.82) {
          if (roll < 0.55) standing.push({ y: py, draw: () => ink.mountain(g, px, py, rnd.realInRange(7, 10), rnd) });
        } else if (high > 0.66) {
          if (roll < 0.5) standing.push({ y: py, draw: () => ink.hill(g, px, py, rnd.realInRange(4, 5.5)) });
        } else if (wood > 0.6) {
          for (let i = 0; i < 2; i++) {
            const tx = px + rnd.realInRange(-0.5, 0.5) * step;
            const ty = py + rnd.realInRange(-0.3, 0.3) * step;
            const fir = rnd.frac() < 0.3 + north * 0.4;
            const size = rnd.realInRange(4.2, 5.4);
            standing.push({ y: ty, draw: () => (fir ? ink.pine(g, tx, ty, size) : ink.tree(g, tx, ty, size)) });
          }
        } else if (roll < 0.14) {
          standing.push({ y: py, draw: () => ink.tuft(g, px, py, 5) });
        }
      }
    }
    standing.sort((a, b) => a.y - b.y).forEach((s) => s.draw());
  }

  /**
   * The roads between regions, wandering a little across the open country. A road with
   * both ends seen is drawn whole, with a few trees and hills along it; one with only
   * one end seen trails off, dotted, towards a question mark.
   */
  private drawRoads(g: Phaser.GameObjects.Graphics, visited: ReadonlySet<AreaId>, rnd: Phaser.Math.RandomDataGenerator): Array<Array<{ x: number; y: number }>> {
    const drawn: Array<Array<{ x: number; y: number }>> = [];
    for (const l of LINKS) {
      const ra = region(l.a);
      const rb = region(l.b);
      if (!ra || !rb) continue;
      const ka = known(l.a, visited);
      const kb = known(l.b, visited);
      if (!ka && !kb) continue;
      const a = this.at(toAtlas(ra, l.at[l.a]!));
      const b = this.at(toAtlas(rb, l.at[l.b]!));
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const nx = -(b.y - a.y) / (len || 1);
      const ny = (b.x - a.x) / (len || 1);
      const bend = (t: number, amount: number) => ({ x: a.x + (b.x - a.x) * t + nx * amount, y: a.y + (b.y - a.y) * t + ny * amount });
      const sway = Math.min(18, len * 0.12);
      const path = [a, bend(0.3, sway * rnd.realInRange(-1, 1)), bend(0.65, sway * rnd.realInRange(-1, 1)), b];
      if (ka && kb) {
        // A passage by boat: a dotted way down the river, with no country along it.
        if (l.boat) {
          drawn.push(ink.road(g, path, 1.6, true));
          continue;
        }
        drawn.push(ink.road(g, path, 2));
        // Country along the way, set back from the road.
        if (len > 60) {
          for (let i = 0; i < Math.floor(len / 26); i++) {
            const t = rnd.realInRange(0.12, 0.88);
            const side = rnd.pick([-1, 1]);
            const p = bend(t, side * rnd.realInRange(10, 26));
            if (rnd.frac() < 0.3) ink.hill(g, p.x, p.y, 5);
            else if (rnd.frac() < 0.5) ink.pine(g, p.x, p.y, 5);
            else ink.tree(g, p.x, p.y, 5);
          }
        }
        continue;
      }
      // Only one end seen: a dotted way off, a third of the way, and a question mark.
      const from = ka ? a : b;
      const to = ka ? b : a;
      const end = { x: from.x + (to.x - from.x) * 0.3, y: from.y + (to.y - from.y) * 0.3 };
      drawn.push(ink.road(g, [from, end], 1.6, true));
      this.letter(end.x + (to.x - from.x) * 0.04, end.y + (to.y - from.y) * 0.04, '?', { fontFamily: THEME.font, fontSize: '17px', color: INK_FADED, fontStyle: 'bold' });
    }
    return drawn;
  }

  /**
   * Where to mark the current step: its spot, if that part of the world has been seen;
   * otherwise the way off the map towards it, from the last place on the way that has.
   */
  private targetMark(from: AreaId, visited: ReadonlySet<AreaId>): { at: Spot; where?: string } | undefined {
    const t = currentTarget();
    if (!t) return undefined;
    const home = anchor(t.area);
    if (home && known(home.region.id, visited)) {
      const p = atlasPoint(t.area, region(t.area) ? t : undefined);
      return p && { at: p, where: t.area === from ? undefined : placeIn(t.area) };
    }
    const path = route(from, t.area);
    for (let i = path.length - 2; i >= 0; i--) {
      if (!region(path[i]) || !known(path[i], visited)) continue;
      const l = LINKS.find((k) => (k.a === path[i] && k.b === path[i + 1]) || (k.b === path[i] && k.a === path[i + 1]))!;
      const p = toAtlas(region(path[i])!, l.at[path[i]]!);
      return { at: p, where: `somewhere beyond ${placeIn(path[i])}` };
    }
    return undefined;
  }

  /** The hero's mark: a red map pin that breathes gently, with "You" lettered over it. */
  private drawHero(p: Spot): void {
    const g = this.add.graphics().setPosition(p.x, p.y);
    g.fillStyle(0x000000, 0.3);
    g.fillEllipse(2, 1, 10, 4);
    g.lineStyle(2, ink.MAP_INK, 1);
    g.lineBetween(0, 0, 0, -12);
    g.fillStyle(ink.MAP_INK, 1);
    g.fillCircle(0, -15, 7);
    g.fillStyle(0xb8322a, 1);
    g.fillCircle(0, -15, 5.5);
    g.fillStyle(0xffd9c0, 1);
    g.fillCircle(-1.8, -17, 1.8);
    const label = this.add
      .text(p.x, p.y - 26, 'You', { fontFamily: THEME.font, fontSize: '13px', color: RUBRIC, fontStyle: 'bold', stroke: '#eadbb2', strokeThickness: 4 })
      .setOrigin(0.5, 1);
    this.sheet.add([g, label]);
    this.tweens.add({ targets: g, scale: { from: 1, to: 1.12 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  /** The quest step's mark: a gold star with a ring rippling out from it. */
  private drawTarget(p: Spot): void {
    const ring = this.add.graphics().setPosition(p.x, p.y);
    ring.lineStyle(2, 0xb8860b, 0.9);
    ring.strokeCircle(0, 0, 12);
    const g = this.add.graphics().setPosition(p.x, p.y);
    const star = (r: number) => {
      const pts: Phaser.Geom.Point[] = [];
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const d = i % 2 ? r * 0.45 : r;
        pts.push(new Phaser.Geom.Point(Math.cos(a) * d, Math.sin(a) * d));
      }
      return pts;
    };
    g.fillStyle(ink.MAP_INK, 1);
    g.fillPoints(star(12), true);
    g.fillStyle(GOLD, 1);
    g.fillPoints(star(9), true);
    this.sheet.add([ring, g]);
    this.tweens.add({ targets: ring, scale: { from: 0.8, to: 1.6 }, alpha: { from: 1, to: 0 }, duration: 1300, repeat: -1 });
  }

  private layout(): void {
    const { width, height } = this.scale;
    this.dim.setSize(width, height);
    this.dim.input!.hitArea.setSize(width, height);
    const scale = Math.min(1.4, (width - 12) / SHEET_W, (height - 36) / (SHEET_H + 30));
    this.sheet.setPosition(width / 2, height / 2 - 10 * scale).setScale(scale);
  }

  private close(): void {
    if (this.closing) return;
    this.closing = true;
    GameAudio.pageTurn();
    this.tweens.add({
      targets: this.sheet,
      alpha: 0,
      scale: this.sheet.scale * 0.94,
      duration: 160,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        this.events.emit('map-closed');
        this.scene.stop();
      },
    });
    this.tweens.add({ targets: this.dim, alpha: 0, duration: 160 });
  }
}

/** The point nearest (x, y) on the segment a to b. */
function nearest(a: Spot, b: Spot, x: number, y: number): [number, number, number, number] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = Phaser.Math.Clamp(((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return [x, y, a.x + dx * t, a.y + dy * t];
}

/** Smooth noise in [0, 1]: random values on a grid, eased between. */
function valueNoise(rnd: Phaser.Math.RandomDataGenerator): (x: number, y: number) => number {
  const N = 32;
  const grid = Array.from({ length: N * N }, () => rnd.frac());
  const v = (i: number, j: number) => grid[(((j % N) + N) % N) * N + (((i % N) + N) % N)];
  const ease = (t: number) => t * t * (3 - 2 * t);
  return (x, y) => {
    const i = Math.floor(x);
    const j = Math.floor(y);
    const fx = ease(x - i);
    const fy = ease(y - j);
    const top = v(i, j) + (v(i + 1, j) - v(i, j)) * fx;
    const bottom = v(i, j + 1) + (v(i + 1, j + 1) - v(i, j + 1)) * fx;
    return top + (bottom - top) * fy;
  };
}
