/**
 * Sailing on the Grey Heron (see systems/Voyages.ts and dialogue/jetty.ts):
 * down the Wend from Adowvale Jetty to Gloomhaven, and home again. The hero
 * goes aboard, Maren Tull casts off and lets fall the sail, and the Heron
 * swings out from the pier and away down the river; then the screen goes to
 * black, the hours pass, and they step ashore at the other end.
 */
import Phaser from 'phaser';
import { generateHeronUnderway, HERON_HEADINGS, HERON_PIVOT, heronUnderwayKey } from '../../art/jetty';
import { MODEL_ART } from '../../art/interior';
import { GameAudio } from '../../audio/Audio';
import { depthAt, gridToScreen, Vec2 } from '../../iso/IsoMath';
import { Inventory } from '../../systems/Inventory';
import { QuestLog } from '../../systems/Quests';
import { HERON_AWAY, HOME_HOURS, openVoyages } from '../../systems/Voyages';
import { CutScene } from '../../ui/CutScene';
import type { AreaId } from '../../world/MapData';
import { GLOOM_HERON, HERON_BERTH } from '../../world/landmarks';
import type { GameScene } from '../GameScene';
import type { DialogueAction } from './dialogueActions';

/** Set for the arrival, so the far end can say something as the hero steps ashore. */
const LANDED = 'heron-landed';
const GLOOMHAVEN_QUEST = 'the-marsh-road';

/** One sailing: where she lies, which way she turns and goes, what's said, and where it ends. */
interface Sailing {
  /** The art she's drawn with at her mooring, to find her by. */
  moored: string;
  /** Her footprint's corner, in tiles. */
  berth: { tx: number; ty: number };
  /** Her heading (an index into HERON_HEADINGS) at the mooring, and once she's swung round onto her course. */
  from: number;
  to: number;
  /** How far she's gone (in tiles, from the mooring) when the sailing is `p` (0 to 1) through. */
  course: (p: number) => Vec2;
  /** Maren's words as she casts off and as the sail goes up, and the hero's thought as the place drops behind. */
  castOff: string;
  letFall: string;
  behind: string;
  /** Over black, as the hours go by. */
  passing: string;
  area: AreaId;
  entry: string;
  hours: number;
}

/** From Adowvale Jetty: she swings her bow out off the pier, round to the east, and runs away down the stream. */
const DOWNRIVER = (hours: number): Sailing => ({
  moored: 'jt-heron',
  berth: { tx: HERON_BERTH.tx, ty: HERON_BERTH.ty },
  from: 6,
  to: 12,
  course: (p) => ({ x: 19 * p ** 1.7, y: 0.9 * smooth(0, 0.6, p) }),
  castOff: 'Cast off forward! Let go aft! And you, sit there, on the hatch, and hold on to something that isn’t me.',
  letFall: 'Let her fall! There. Feel that? She wants to go.',
  behind: 'The jetty slides away behind us. Old Ebb lifts a hand from his nets, and then the willows close over it all.',
  passing: 'Down the Wend for hours, between the willows and the water meadows, and on into the fen.',
  area: 'gloomhaven',
  entry: 'heron',
  hours,
});

/** From Gloomhaven's pier: she lies bow upstream already, and only has to push off and go. */
const UPRIVER: Sailing = {
  moored: heronUnderwayKey(0, false),
  berth: { tx: GLOOM_HERON.tx, ty: GLOOM_HERON.ty },
  from: 0,
  to: 0,
  course: (p) => ({ x: -21 * p ** 1.6, y: 0.7 * smooth(0, 0.6, p) }),
  castOff: "Cast off, and let's be gone. I've had about enough of this town's company.",
  letFall: 'Up she goes. The wind’s fair, at least, even if the stream isn’t.',
  behind: 'The black roofs of Gloomhaven sink back into the mist. I do not watch them for long.',
  passing: 'Up the Wend against the stream, hour after hour, until the fen gives way to willows, and the willows to Adowvale’s fields.',
  area: 'jetty',
  entry: 'gloomhaven',
  hours: HOME_HOURS,
};

/** Where the hero and Maren stand aboard, from her middle unturned (bow towards -y): the hero aft of the hatch, Maren at the tiller. */
const HERO_ABOARD = { x: -0.02, y: 1.57, z: 16.6 };
const MAREN_ABOARD = { x: 0.05, y: 3.25, z: 19.7 };
/** Her stern, for the wake, and her bow, for the wave under it. */
const STERN = { x: 0, y: 3.4 };
const BOW = { x: 0, y: -3.3 };

/** How long she's in sight after the sail goes up, before it all goes dark. */
const UNDER_WAY_MS = 9500;

function smooth(a: number, b: number, t: number): number {
  const k = Phaser.Math.Clamp((t - a) / (b - a), 0, 1);
  return k * k * (3 - 2 * k);
}

/** A point aboard, from her middle unturned, turned to her heading. */
function turned(p: Vec2, heading: number): Vec2 {
  const c = Math.cos(heading);
  const s = Math.sin(heading);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
}

/**
 * Sailing for somewhere from Adowvale Jetty (the `voyage:<area>` action, from Maren's talk): pay any
 * fare, and off down the river.
 */
export function sailTo(g: GameScene, to: string): void {
  const voyage = openVoyages().find((v) => v.to === to);
  if (!voyage) return;
  if (voyage.fare > 0) {
    if (!Inventory.addCoins(-voyage.fare)) return;
    GameAudio.coins();
  }
  QuestLog.writeDiary(
    voyage.fare > 0
      ? `Paid Maren Tull ${voyage.fare} coins for a passage on the Grey Heron, down the Wend to ${voyage.name}.`
      : `Took ship with Maren Tull on the Grey Heron, down the Wend to ${voyage.name}. She would not take a coin for it: I helped mend her, she says, and that is fare enough.`,
  );
  g.afterTalk = () =>
    sail(g, { ...DOWNRIVER(voyage.hours), area: voyage.to, entry: voyage.entry }, () => {
      if (voyage.to === 'gloomhaven') QuestLog.setFlag(HERON_AWAY);
    });
}

export const VOYAGE_ACTIONS: Record<string, DialogueAction> = {
  // Home from Gloomhaven with Maren, who's waited at the pier.
  'voyage-home': (g) => {
    if (g.area !== 'gloomhaven' || !QuestLog.hasFlag(HERON_AWAY)) return;
    QuestLog.writeDiary('Sailed home from Gloomhaven with Maren Tull on the Grey Heron, up the Wend against the stream.');
    g.afterTalk = () => sail(g, UPRIVER);
  },
};

/** Stepping ashore at the far end: a thought, and (the first time at Gloomhaven) the way there found. */
export function landed(g: GameScene): void {
  if (g.area === 'gloomhaven' && QuestLog.has(GLOOMHAVEN_QUEST)) QuestLog.complete(GLOOMHAVEN_QUEST, 'way');
  if (!QuestLog.hasFlag(LANDED)) return;
  QuestLog.clearFlag(LANDED);
  // The first time at Gloomhaven has its own thought (see gloomhaven.ts); after that, and coming home, these.
  if (g.area === 'gloomhaven' && !g.visited.has('gloomhaven')) return;
  const thought =
    g.area === 'gloomhaven'
      ? 'Maren brings her in alongside the pier as neat as threading a needle. Gloomhaven again. The smell hits me before the gangplank does.'
      : 'Adowvale Jetty, and the smokehouse smoking, and Wren running down the quay to take the rope. Home, or near enough.';
  g.time.delayedCall(1100, () => g.onHint?.(thought));
}

/**
 * The sailing itself: a moment's black while the hero goes aboard, then the Heron, with them in her
 * and Maren at the tiller, casting off, letting fall her sail, swinging onto her course and away;
 * then black again, the hours passing, and the far end.
 */
function sail(g: GameScene, s: Sailing, beforeLeaving?: () => void): void {
  const moored = g.map.objectByKey(s.moored);
  if (!moored) return;
  // The controls stay taken the whole way (the conversation closing hands them back a moment after this starts).
  const hold = () => {
    g.busy = true;
    g.walkingTo = undefined;
  };
  hold();
  g.player.setPath([]);
  g.time.delayedCall(150, hold);
  const cam = g.cameras.main;
  cam.fadeOut(450, 0, 0, 0);
  cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
    // Her art at every heading, drawn the first time it's wanted (while the screen is dark).
    generateHeronUnderway(g);
    g.tweens.killTweensOf(moored.sprite);
    moored.sprite.setVisible(false);
    const boat = g.add.sprite(0, 0, heronUnderwayKey(s.from, false));
    const maren = g.someone('maren');
    if (maren) maren.scripted = true;
    for (const c of g.companions) c.setShown(false);

    // Where she is and which way she's heading, as the sailing goes on.
    const pivot = { x: s.berth.tx + HERON_PIVOT.x, y: s.berth.ty + HERON_PIVOT.y };
    let index = s.from;
    let sail = false;
    let at = { x: 0, y: 0 };
    let time = 0;
    const started = g.time.now;
    const place = () => {
      const key = heronUnderwayKey(index, sail);
      if (boat.texture.key !== key) boat.setTexture(key);
      const art = MODEL_ART[key];
      boat.setOrigin(art.originX, art.originY);
      const bob = Math.sin(time * 1.6) * 0.8;
      const p = gridToScreen(s.berth.tx + at.x, s.berth.ty + at.y);
      boat.setPosition(p.x, p.y + bob);
      const middle = { x: pivot.x + at.x, y: pivot.y + at.y };
      const depth = depthAt(middle.x, middle.y);
      boat.setDepth(depth);
      const heading = HERON_HEADINGS[index];
      const stand = (spot: typeof HERO_ABOARD) => {
        const d = turned(spot, heading);
        return { x: middle.x + d.x, y: middle.y + d.y };
      };
      const hero = stand(HERO_ABOARD);
      g.player.aboard = { depth: depth + 0.01 };
      g.player.offset.x = 0;
      g.player.offset.y = -HERO_ABOARD.z + bob;
      g.player.gx = hero.x;
      g.player.gy = hero.y;
      // He looks where she's going.
      const ahead = turned(BOW, heading);
      g.player.faceTowards(hero.x + ahead.x, hero.y + ahead.y);
      if (maren) {
        const m = stand(MAREN_ABOARD);
        maren.aboard = { depth: depth + 0.02 };
        maren.offset.y = -MAREN_ABOARD.z + bob;
        maren.pose(m.x, m.y, { x: m.x + ahead.x, y: m.y + ahead.y }, false);
      }
      return { middle, heading, depth };
    };
    place();

    const cut = CutScene.begin(g, { ambience: 0.7, free: true });
    cut.lookAt(pivot.x, pivot.y, 1.12);
    const follow = () => {
      const p = gridToScreen(pivot.x + at.x, pivot.y + at.y);
      const view = cam.midPoint;
      cam.centerOn(view.x + (p.x - view.x) * 0.12, view.y + (p.y - 36 - view.y) * 0.12);
    };
    cam.fadeIn(800, 0, 0, 0);

    // The wake: foam peeling off her stern and a wave curling under her bow, fading as they spread.
    let foamIn = 0;
    const foam = (from: Vec2, depth: number, big: number) => {
      const p = gridToScreen(from.x, from.y);
      const blob = g.add.ellipse(p.x + (Math.random() - 0.5) * 8, p.y + (Math.random() - 0.5) * 4, 10 * big, 4 * big, 0xeaf2f0, 0.55).setDepth(depth - 0.02);
      g.tweens.add({ targets: blob, scaleX: 2.6, scaleY: 2, alpha: 0, duration: 1700, ease: 'Sine.easeOut', onComplete: () => blob.destroy() });
    };

    // Cast off; let fall the sail; then away.
    const say = (ms: number, text: string, speaker?: string) => g.time.delayedCall(ms, () => cut.caption(text, speaker, 3600));
    say(700, s.castOff, 'Maren Tull');
    g.time.delayedCall(1200, () => GameAudio.splash(false));
    g.time.delayedCall(3400, () => {
      sail = true;
      GameAudio.flutter();
      GameAudio.swing(true);
      place();
    });
    say(3600, s.letFall, 'Maren Tull');
    say(8200, s.behind);
    const start = 4200;
    let p = 0;
    let lastSpeed = 0;
    const onUpdate = (_t: number, deltaMs: number) => {
      hold();
      time += deltaMs / 1000;
      if (g.time.now - started > start) p = Math.min(1, p + deltaMs / UNDER_WAY_MS);
      const next = s.course(p);
      lastSpeed = Math.hypot(next.x - at.x, next.y - at.y) / Math.max(deltaMs / 1000, 0.001);
      at = next;
      index = Math.round(s.from + (s.to - s.from) * smooth(0.04, 0.5, p));
      const { middle, heading, depth } = place();
      follow();
      foamIn -= deltaMs;
      if (lastSpeed > 0.2 && foamIn <= 0) {
        foamIn = 110;
        const st = turned(STERN, heading);
        const bw = turned(BOW, heading);
        foam({ x: middle.x + st.x, y: middle.y + st.y }, depth, 1.2);
        foam({ x: middle.x + bw.x, y: middle.y + bw.y }, depth, 0.8);
      }
    };
    g.events.on(Phaser.Scenes.Events.UPDATE, onUpdate);
    g.events.once(Phaser.Scenes.Events.SHUTDOWN, () => g.events.off(Phaser.Scenes.Events.UPDATE, onUpdate));

    // Into the dark, with the hours going by, and ashore at the far end.
    const dark = start + UNDER_WAY_MS * 0.82;
    g.time.delayedCall(dark, () => {
      cut.caption(s.passing, undefined, 4200);
      cam.fadeOut(1800, 0, 0, 0);
    });
    g.time.delayedCall(dark + 4600, () => {
      beforeLeaving?.();
      QuestLog.setFlag(LANDED);
      g.player.aboard = undefined;
      g.player.offset.y = 0;
      g.clock.advance(s.hours);
      g.scene.restart({ area: s.area, entry: s.entry });
    });
  });
}
