import Phaser from 'phaser';
import { GameAudio } from '../audio/Audio';
import { Settings } from '../settings/Settings';
import { currentTarget, placeIn } from '../systems/QuestTargets';
import { QuestLog } from '../systems/Quests';
import { AREA_NAMES } from '../systems/SaveGame';
import { THEME } from '../ui/Widgets';
import { anchor, atlasPoint, known, LINKS, Region, region, REGIONS, route, Spot, toAtlas } from '../world/atlas';
import type { AreaId } from '../world/MapData';
import type { GameScene } from './GameScene';

/** The sheet is drawn at this size and scaled to fit the screen. */
const SHEET_W = 1000;
const SHEET_H = 660;
/** The part of the sheet the country is drawn in. */
const AREA = { x: -460, y: -236, w: 920, h: 430 };

const INK = 0x3a2717;
const INK_TEXT = '#3a2717';
const INK_FADED = '#7a6448';
const RUBRIC = '#8e2f22';
const PARCHMENT = 0xefe1c0;
const PARCHMENT_EDGE = 0xd2bb8c;
const GOLD = 0xffc43d;
const BODY_FONT = 'Merriweather, Georgia, "Times New Roman", serif';

/** How each kind of country is washed in: fill, and the colour of its little marks. */
const LOOKS: Record<Region['look'], { fill: number; mark: number }> = {
  fields: { fill: 0xb7c98a, mark: 0x5e7a3a },
  woods: { fill: 0x7f9a66, mark: 0x2f4a26 },
  village: { fill: 0xd8c29a, mark: 0x8a5a36 },
  plains: { fill: 0xd2d49a, mark: 0x8a8a4a },
  grounds: { fill: 0xbccf96, mark: 0x7a7a82 },
  cloister: { fill: 0xc9c3b3, mark: 0x6a6670 },
};

/** Atlas units -> the isometric sheet, the same way round as the game (and the minimap). */
function iso(p: Spot): Spot {
  return { x: p.x - p.y, y: (p.x + p.y) / 2 };
}

/**
 * The world map: an old parchment sheet of the country the hero has seen so far,
 * drawn the same way round as the game, with the roads between the places, the
 * hero's own mark, and the current quest step's mark (unless quest markers are
 * off in Settings). Opened with M or the journal's Map tab; anything else closes it.
 * The layout of the country is world/atlas.ts.
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
    this.dim = this.add.rectangle(0, 0, 10, 10, 0x000000, 0.6).setOrigin(0).setInteractive();
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
    this.sheet.setScale(target * 0.9).setAlpha(0);
    this.tweens.add({ targets: this.sheet, scale: target, alpha: 1, duration: 220, ease: 'Back.easeOut' });
  }

  /** Scale the whole country (seen or not) into the sheet, so the map doesn't shift about as more of it is found. */
  private fit(): void {
    const corners = REGIONS.flatMap((r) => {
      const b = r.box;
      return [iso({ x: b.x, y: b.y }), iso({ x: b.x + b.w, y: b.y }), iso({ x: b.x, y: b.y + b.h }), iso({ x: b.x + b.w, y: b.y + b.h })];
    });
    const minX = Math.min(...corners.map((c) => c.x));
    const maxX = Math.max(...corners.map((c) => c.x));
    const minY = Math.min(...corners.map((c) => c.y));
    const maxY = Math.max(...corners.map((c) => c.y));
    this.scaleBy = Math.min(AREA.w / (maxX - minX), AREA.h / (maxY - minY));
    this.offset = {
      x: AREA.x + (AREA.w - (maxX - minX) * this.scaleBy) / 2 - minX * this.scaleBy,
      y: AREA.y + (AREA.h - (maxY - minY) * this.scaleBy) / 2 - minY * this.scaleBy,
    };
  }

  /** An atlas point on the sheet. */
  private at(p: Spot): Spot {
    const q = iso(p);
    return { x: this.offset.x + q.x * this.scaleBy, y: this.offset.y + q.y * this.scaleBy };
  }

  private draw(): void {
    const game = this.scene.get('Game') as GameScene;
    const visited = new Set<AreaId>(game.visited);
    visited.add(game.area);
    const shown = REGIONS.filter((r) => known(r.id, visited));

    const g = this.add.graphics();
    this.sheet.add(g);
    this.drawSheet(g);
    for (const r of shown) this.drawRegion(g, r);
    this.drawRoads(g, visited);
    // Places found indoors and underground, as small marks at their doors.
    for (const area of visited) {
      if (region(area)) continue;
      const p = atlasPoint(area);
      if (!p) continue;
      const s = this.at(p);
      g.fillStyle(INK, 0.85);
      g.fillCircle(s.x, s.y, 3);
    }
    for (const r of shown) this.labelRegion(r);

    // The hero: where they stand in an area out of doors, or the door of the place they're in.
    const here = region(game.area) ? atlasPoint(game.area, { x: game.player.gx, y: game.player.gy }) : atlasPoint(game.area);
    const target = Settings.get().showQuestMarkers ? this.targetMark(game.area, visited) : undefined;
    if (target) this.drawTarget(target.at);
    if (here) this.drawHero(this.at(here));

    // Along the bottom: where the hero is, and where the next step is.
    const quest = QuestLog.focused;
    const step = quest && QuestLog.current(quest);
    const lines: Array<[string, string]> = [[`You are in ${placeIn(game.area)}.`, INK_TEXT]];
    if (step && Settings.get().showQuestMarkers) {
      lines.push([`◆ ${step.text}${target?.where ? `  (${target.where})` : ''}`, RUBRIC]);
    }
    lines.forEach(([text, color], i) => {
      this.sheet.add(
        this.add
          .text(0, SHEET_H / 2 - 92 + i * 26, text, { fontFamily: BODY_FONT, fontSize: '16px', color, wordWrap: { width: SHEET_W - 120 } })
          .setOrigin(0.5, 0),
      );
    });
    const touch = this.sys.game.device.input.touch;
    this.sheet.add(
      this.add
        .text(0, SHEET_H / 2 + 14, touch ? 'Tap anywhere to close' : 'M or Esc to close', { fontFamily: BODY_FONT, fontSize: '14px', color: THEME.dimText })
        .setOrigin(0.5, 0),
    );
  }

  /** The parchment, its border, the title and a compass rose. */
  private drawSheet(g: Phaser.GameObjects.Graphics): void {
    const hw = SHEET_W / 2;
    const hh = SHEET_H / 2;
    g.fillStyle(0x000000, 0.45);
    g.fillRoundedRect(-hw + 8, -hh + 10, SHEET_W, SHEET_H, 10);
    g.fillStyle(PARCHMENT_EDGE, 1);
    g.fillRoundedRect(-hw, -hh, SHEET_W, SHEET_H, 10);
    g.fillStyle(PARCHMENT, 1);
    g.fillRoundedRect(-hw + 6, -hh + 6, SHEET_W - 12, SHEET_H - 12, 8);
    g.lineStyle(2, 0x8a6a3a, 0.9);
    g.strokeRoundedRect(-hw + 12, -hh + 12, SHEET_W - 24, SHEET_H - 24, 6);
    g.lineStyle(1, 0x8a6a3a, 0.6);
    g.strokeRoundedRect(-hw + 18, -hh + 18, SHEET_W - 36, SHEET_H - 36, 4);
    this.sheet.add(
      this.add
        .text(0, -hh + 26, 'Map of the Shire', { fontFamily: THEME.font, fontSize: '30px', color: RUBRIC, fontStyle: 'bold' })
        .setOrigin(0.5, 0),
    );
    const close = this.add
      .text(hw - 6, -hh + 6, '✕', { fontFamily: BODY_FONT, fontSize: '22px', color: '#f3e2b3', backgroundColor: '#3a2014' })
      .setPadding(8, 3, 8, 5)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    close.on('pointerup', () => this.close());
    this.sheet.add(close);

    // A compass rose, its N along the way north runs in the game (up and to the right).
    const cx = hw - 92;
    const cy = -hh + 96;
    const dirs: Array<[string, Spot]> = [['N', { x: 0, y: -1 }], ['E', { x: 1, y: 0 }], ['S', { x: 0, y: 1 }], ['W', { x: -1, y: 0 }]];
    g.lineStyle(1, INK, 0.6);
    g.strokeCircle(cx, cy, 30);
    for (const [label, d] of dirs) {
      const v = iso(d);
      const len = Math.hypot(v.x, v.y);
      const ux = v.x / len;
      const uy = v.y / len;
      g.fillStyle(label === 'N' ? 0x8e2f22 : INK, 0.9);
      g.fillTriangle(cx + ux * 28, cy + uy * 28, cx - uy * 5, cy + ux * 5, cx + uy * 5, cy - ux * 5);
      this.sheet.add(
        this.add
          .text(cx + ux * 42, cy + uy * 42, label, { fontFamily: THEME.font, fontSize: '13px', color: label === 'N' ? RUBRIC : INK_TEXT, fontStyle: 'bold' })
          .setOrigin(0.5),
      );
    }
  }

  /** A piece of country: its outline washed in, with a scatter of marks for what grows or stands there. */
  private drawRegion(g: Phaser.GameObjects.Graphics, r: Region): void {
    const b = r.box;
    const pts = [
      this.at({ x: b.x, y: b.y }),
      this.at({ x: b.x + b.w, y: b.y }),
      this.at({ x: b.x + b.w, y: b.y + b.h }),
      this.at({ x: b.x, y: b.y + b.h }),
    ].map((p) => new Phaser.Geom.Point(p.x, p.y));
    const look = LOOKS[r.look];
    g.fillStyle(look.fill, 0.85);
    g.fillPoints(pts, true);
    g.lineStyle(1.5, INK, 0.7);
    g.strokePoints(pts, true);

    // The marks, always in the same places (seeded by the region), never right at the edge.
    const rnd = new Phaser.Math.RandomDataGenerator([r.id]);
    const count = Math.round((b.w * b.h) / 18);
    for (let i = 0; i < count; i++) {
      const p = this.at({ x: b.x + b.w * rnd.realInRange(0.08, 0.92), y: b.y + b.h * rnd.realInRange(0.08, 0.92) });
      g.fillStyle(look.mark, 0.55);
      g.lineStyle(1, look.mark, 0.6);
      switch (r.look) {
        case 'woods':
          g.fillCircle(p.x, p.y - 3, 4);
          g.fillRect(p.x - 0.5, p.y, 1, 3);
          break;
        case 'fields':
        case 'plains':
          g.lineBetween(p.x - 3, p.y, p.x - 1, p.y - 4);
          g.lineBetween(p.x + 1, p.y, p.x + 3, p.y - 4);
          break;
        case 'village':
          if (i % 2) break;
          g.fillRect(p.x - 4, p.y - 3, 8, 5);
          g.fillTriangle(p.x - 5, p.y - 3, p.x + 5, p.y - 3, p.x, p.y - 8);
          break;
        default:
          g.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
      }
    }
  }

  /** The region's name where the atlas says (clear of its doors and people), or, for a small one, just above its top corner. */
  private labelRegion(r: Region): void {
    const big = !!r.label;
    const c = r.label ? this.at(toAtlas(r, r.label)) : this.at({ x: r.box.x, y: r.box.y });
    this.sheet.add(
      this.add
        .text(c.x, c.y, AREA_NAMES[r.id], {
          fontFamily: THEME.font,
          fontSize: big ? '17px' : '14px',
          color: INK_TEXT,
          fontStyle: 'bold',
          stroke: '#efe1c0',
          strokeThickness: 4,
          align: 'center',
          wordWrap: { width: big ? 150 : 220 },
        })
        .setOrigin(0.5, big ? 0.5 : 1.15),
    );
  }

  /** Roads between the regions: drawn where both ends have been seen, and as a dotted way off towards one that hasn't. */
  private drawRoads(g: Phaser.GameObjects.Graphics, visited: ReadonlySet<AreaId>): void {
    for (const l of LINKS) {
      const ra = region(l.a);
      const rb = region(l.b);
      if (!ra || !rb) continue;
      const ka = known(l.a, visited);
      const kb = known(l.b, visited);
      if (!ka && !kb) continue;
      const a = this.at(toAtlas(ra, l.at[l.a]!));
      const b = this.at(toAtlas(rb, l.at[l.b]!));
      if (ka && kb) {
        g.lineStyle(5, 0x8a6a3a, 0.9);
        g.lineBetween(a.x, a.y, b.x, b.y);
        g.lineStyle(2, 0xe8d5a6, 1);
        g.lineBetween(a.x, a.y, b.x, b.y);
        continue;
      }
      // Only one end seen: a dotted way off, a third of the way, and a question mark.
      const [from, to] = ka ? [a, b] : [b, a];
      const end = { x: from.x + (to.x - from.x) * 0.35, y: from.y + (to.y - from.y) * 0.35 };
      g.fillStyle(0x8a6a3a, 0.9);
      for (let t = 0; t <= 1; t += 0.12) g.fillCircle(from.x + (end.x - from.x) * t, from.y + (end.y - from.y) * t, 1.8);
      this.sheet.add(this.add.text(end.x, end.y, '?', { fontFamily: THEME.font, fontSize: '16px', color: INK_FADED, fontStyle: 'bold' }).setOrigin(0.5));
    }
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

  /** The hero's mark, a red pin that breathes gently, with "You" over it. */
  private drawHero(p: Spot): void {
    const g = this.add.graphics().setPosition(p.x, p.y);
    g.fillStyle(0x000000, 0.35);
    g.fillEllipse(0, 4, 18, 7);
    g.fillStyle(0x1c1308, 1);
    g.fillCircle(0, 0, 8);
    g.fillStyle(0xc0392b, 1);
    g.fillCircle(0, 0, 6);
    g.fillStyle(0xffe7a8, 1);
    g.fillCircle(-2, -2, 2);
    const label = this.add
      .text(p.x, p.y - 12, 'You', { fontFamily: THEME.font, fontSize: '13px', color: '#8e2f22', fontStyle: 'bold', stroke: '#efe1c0', strokeThickness: 4 })
      .setOrigin(0.5, 1);
    this.sheet.add([g, label]);
    this.tweens.add({ targets: g, scale: { from: 1, to: 1.15 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  /** The quest step's mark: a gold diamond with a soft ring round it. */
  private drawTarget(atlasAt: Spot): void {
    const p = this.at(atlasAt);
    const ring = this.add.graphics().setPosition(p.x, p.y);
    ring.lineStyle(2, 0xb8860b, 0.9);
    ring.strokeCircle(0, 0, 13);
    const g = this.add.graphics().setPosition(p.x, p.y);
    g.fillStyle(0x1c1308, 1);
    g.fillPoints([new Phaser.Geom.Point(0, -11), new Phaser.Geom.Point(9, 0), new Phaser.Geom.Point(0, 11), new Phaser.Geom.Point(-9, 0)], true);
    g.fillStyle(GOLD, 1);
    g.fillPoints([new Phaser.Geom.Point(0, -8), new Phaser.Geom.Point(6.5, 0), new Phaser.Geom.Point(0, 8), new Phaser.Geom.Point(-6.5, 0)], true);
    this.sheet.add([ring, g]);
    this.tweens.add({ targets: ring, scale: { from: 0.8, to: 1.5 }, alpha: { from: 1, to: 0 }, duration: 1200, repeat: -1 });
  }

  private layout(): void {
    const { width, height } = this.scale;
    this.dim.setSize(width, height);
    this.dim.input!.hitArea.setSize(width, height);
    const scale = Math.min(1.3, (width - 16) / SHEET_W, (height - 40) / (SHEET_H + 30));
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
