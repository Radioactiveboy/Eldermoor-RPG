/**
 * The Fen Road (world/FenRoadMap.ts): Captain Vosk opening the Fen Gate, going
 * out along the causeway, the wreck at the Drowned Mile and what's to be found
 * there, and the thing in the mere that watches the hero find it. The talk is
 * in dialogue/fenroad.ts.
 */
import { sheetScale } from '../../art/fine3d';
import { FEET_Y, FRAME_H } from '../../art/character';
import { GameAudio } from '../../audio/Audio';
import { depthAt, gridToScreen } from '../../iso/IsoMath';
import { FEN_FLAGS } from '../../systems/FenRoad';
import { GUILD_FLAGS, GUILD_QUEST } from '../../systems/Guild';
import { Inventory } from '../../systems/Inventory';
import { QuestLog } from '../../systems/Quests';
import { FEN_GATE_OPEN, FEN_WATCHER, fenGateDoors, gatehouseShape } from '../../world/landmarks';
import type { Sight } from '../../world/MapData';
import type { GameScene } from '../GameScene';
import type { DialogueAction } from './dialogueActions';

/** Out of the gate for the first time: a thought, and a line in the diary. */
export function enteredFenRoad(g: GameScene): void {
  if (g.visited.has('fenroad')) return;
  g.time.delayedCall(1200, () => g.onHint?.('The fog closes in behind me. Logs underfoot, black water either side, and the oaks leaning over the road with their beards hanging down. It is very quiet.'));
  QuestLog.writeDiary(
    "Went out through the Fen Gate onto the causeway, with Captain Vosk's leave. It is a road of split logs laid across the bog, sunk and broken, " +
      'and the oaks lean in over it from both sides so it runs in a tunnel of moss. There are old iron lamps along it, and some of them were lit.',
  );
}

/** Whether the hero is working for the guild on the raids, so the wreck means something. */
const onTheCase = () => QuestLog.has(GUILD_QUEST) && !QuestLog.get(GUILD_QUEST)?.completed;

/** What the hero thinks, looking at each part of the wreck. */
const WRECK_THOUGHTS: Record<string, string> = {
  'fr-wreck-wagon':
    "The lead wagon, in the guild's green, rolled off the causeway and over on its side in the bog, the near wheels under and the far ones up in the air like a dead beetle's legs. " +
    'The tilt is slashed open in long rents, not torn: cut. And scarlet cloth spilling out of it into the black water, yards of it, spoiling.',
  'fr-wreck-burnt':
    "A wagon burnt where it stood, down to its ribs, and the heap in it is wool, Dame Marrable's wool, burnt black on the outside and still white at the heart where the fire didn't reach. " +
    "Somebody stood here and kept it burning. Wool doesn't burn on its own, not in the wet.",
  'fr-wreck-cart':
    'A handcart on its back, its sacks split. Salt, good white salt, spilled all over the logs and going to brine in the rain. Nobody took a grain of it. Salt is money. Brigands would have taken the salt.',
  'fr-wreck-casks':
    'Casks stove in, the eels spilled out of them and left to rot. That is the smell. Every one of these would have fetched a copper on the Staithe, and they left them for the crows.',
  'fr-wreck-bale':
    "A bale of Master Tunstall's scarlet, cut open, the cloth pulled out and trodden into the mud. Kermes, he said. Real kermes. Whoever did this knew whose it was and what it was worth.",
  'fr-wreck-ox':
    "The ox, or what the crows have left of it, still in its yoke. Its skull has been split, one blow, and not by any axe I know: there are three gouges in the bone side by side, like a rake's. Or a hand's.",
  'fr-wreck-lantern':
    "A lantern on a long pole, smashed, lying across the logs where it fell. Garrow's lantern. He said he walked in front with it, in the fog. He must have dropped it here, and gone down there, in the reeds, with his arm broken, and watched.",
};

/**
 * Looking at the wreck, the tracks and the scale (and the Lady's shrine, where the hero leaves a copper).
 * Returns false for any other sight.
 */
export function examineOnFenRoad(g: GameScene, sight: Sight): boolean {
  const wreck = WRECK_THOUGHTS[sight.id];
  if (wreck) {
    g.onHint?.(wreck);
    sawWreck(g);
    return true;
  }
  if (sight.id === 'fr-tracks') {
    g.onHint?.(
      'Tracks, pressed deep in the peat and filled with water. Three long toes splayed forward and a spur behind, bigger than my hand, walking upright on two feet. ' +
        'And between them, a furrow, like a rope dragged along: a tail. Lots of them, going one way: off the causeway and down into the mere.',
    );
    sawTracks(g);
    return true;
  }
  if (sight.id === 'fr-scale') {
    if (QuestLog.hasFlag(FEN_FLAGS.scale)) return true;
    if (!Inventory.add('white-scale', 1)) {
      g.onHint?.('My satchel is full.');
      return true;
    }
    GameAudio.pickup();
    QuestLog.setFlag(FEN_FLAGS.scale);
    g.map.data.sights = g.map.data.sights?.filter((s) => s.id !== 'fr-scale');
    const decal = g.map.objectByKey('fr-scale');
    decal?.sprite.setVisible(false);
    g.onHint?.('Something white in the mud by the tracks. A scale, as big as my palm, hard as horn, white as a drowned thing and shining like the inside of a shell. I wipe it off and put it away carefully.');
    QuestLog.writeDiary(
      'Found a scale in the mud by the tracks at the Drowned Mile: white, as big as my palm, hard as horn, with rings on it like a tree. Whatever shed it is very big. ' +
        'I have kept it. Somebody in the Guildhall will have to believe this.',
    );
    if (!QuestLog.hasFlag(FEN_FLAGS.tracks)) sawTracks(g);
    return true;
  }
  if (sight.id === 'fr-shrine' && !QuestLog.hasFlag(FEN_FLAGS.offered) && Inventory.coins > 0 && Inventory.addCoins(-1)) {
    GameAudio.coins();
    QuestLog.setFlag(FEN_FLAGS.offered);
    g.onHint?.(`${sight.thought} I put a copper on the stone with the others. It seems only polite, out here.`);
    return true;
  }
  return false;
}

/** The first look at the wreck: the quest's step, and the diary. */
function sawWreck(g: GameScene): void {
  if (QuestLog.hasFlag(FEN_FLAGS.wreck)) return;
  QuestLog.setFlag(FEN_FLAGS.wreck);
  if (onTheCase()) QuestLog.complete(GUILD_QUEST, 'wreck');
  QuestLog.writeDiary(
    'Found the wreck of the last caravan at the Drowned Mile, where the causeway runs low across open water. The lead wagon is over in the bog, one burnt to its ribs, the cloth slashed and the wool burnt. ' +
      'And the salt and the eels left lying. Not one thing taken. Whoever did this came to spoil, not to steal.',
  );
  g.time.delayedCall(900, () =>
    g.onHint?.(onTheCase() ? 'Nothing taken. Garrow was right. Now: the tracks. Lowe said to look at what made the tracks.' : 'Nothing taken. Who robs a caravan and takes nothing?'),
  );
}

/** The first look at the tracks: the quest's step, the diary, and something in the water. */
function sawTracks(g: GameScene): void {
  if (QuestLog.hasFlag(FEN_FLAGS.tracks)) return;
  QuestLog.setFlag(FEN_FLAGS.tracks);
  if (!QuestLog.hasFlag(FEN_FLAGS.wreck)) sawWreck(g);
  if (onTheCase()) QuestLog.complete(GUILD_QUEST, 'tracks');
  QuestLog.writeDiary(
    'The tracks at the wreck go off the causeway and down into the mere: three long toes and a spur, walking on two feet, and a tail dragging between. Not men. ' +
      'Not anything I have a name for. Garrow said they went into the water and never came up. They didn\'t need to.',
  );
  g.time.delayedCall(2600, () => watcher(g));
}

/**
 * Something comes up out of the mere, west of the causeway, where the tracks go
 * in: the head first, then the shoulders, water running off it. It stands
 * waist-deep, looking at the hero, for a few long breaths; hisses; and goes
 * down again without a ripple. It never comes closer.
 */
function watcher(g: GameScene): void {
  if (g.area !== 'fenroad' || !g.textures.exists('folk-lizardman')) return;
  QuestLog.setFlag(FEN_FLAGS.watcher);
  const key = 'folk-lizardman';
  const p = gridToScreen(FEN_WATCHER.x, FEN_WATCHER.y);
  // A head taller than a man, and drawn finer than the folk (art/fenroad.ts): shown larger than life, looming.
  const scale = 1.6 / sheetScale(g, key);
  const sprite = g.add.sprite(p.x, p.y, key, 0).setOrigin(0.5, (FEET_Y + 0.5) / FRAME_H).setScale(scale).setDepth(depthAt(FEN_WATCHER.x, FEN_WATCHER.y));
  // Facing the hero.
  const dx = g.player.gx - FEN_WATCHER.x;
  const dy = g.player.gy - FEN_WATCHER.y;
  const sx = dx - dy;
  const sy = (dx + dy) / 2;
  const dirs = ['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne'];
  const dir = dirs[Math.round(((Math.atan2(sy, sx) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4)) % 8];
  if (g.anims.exists(`${key}-idle-${dir}`)) sprite.play(`${key}-idle-${dir}`);
  // Sunk in the water: the surface stays where it is, on its tile, and the figure rises through it to the
  // waist (water.h 0 to 1) and goes down again; only what's above the surface is drawn.
  const frame = sprite.frame;
  const k = frame.height / FRAME_H;
  const feetRow = (FEET_Y + 0.5) * k;
  const waist = 19 * k;
  const head = 40 * k;
  const water = { h: 0 };
  const show = () => {
    const under = waist + (head - waist) * (1 - Math.max(0, Math.min(1, water.h)));
    sprite.setY(p.y + under * scale);
    sprite.setCrop(0, 0, frame.width, Math.max(1, feetRow - under));
    sprite.setVisible(feetRow - under > 2 * k);
  };
  show();
  GameAudio.bubble();
  const ripple = g.add.ellipse(p.x, p.y + 2, 10, 4).setStrokeStyle(1, 0xb8c4c0, 0.8).setDepth(sprite.depth - 0.01);
  g.tweens.add({ targets: ripple, scaleX: 4, scaleY: 4, alpha: 0, duration: 2200, repeat: 2 });
  g.tweens.add({
    targets: water,
    h: 1,
    duration: 2600,
    ease: 'Sine.easeOut',
    onUpdate: show,
    onComplete: () => {
      g.onHint?.('Something in the water. Out there, where the tracks go in. It has come up out of the mere to the waist, and it is looking at me.');
      g.time.delayedCall(2600, () => {
        GameAudio.whisper(1.6);
        g.onHint?.('A long, flat head. Scales, and water running off them. It opens its mouth, and hisses, like a kettle.');
      });
      g.time.delayedCall(6200, () =>
        g.tweens.add({
          targets: water,
          h: 0,
          duration: 1800,
          ease: 'Sine.easeIn',
          onUpdate: show,
          onComplete: () => {
            sprite.destroy();
            ripple.destroy();
            GameAudio.splash(false);
            g.onHint?.("And it's gone. Not a ripple. I don't think I breathed the whole time.");
            QuestLog.writeDiary('Something came up out of the mere at the Drowned Mile and watched me, waist-deep, scaled and long-headed. It hissed at me and went back under. It was not afraid of me at all.');
          },
        }),
      );
    },
  });
}

/** Captain Vosk opens the Fen Gate to the hero: the bar comes off, the leaves swing back, and the road out is open from now on. */
function openFenGate(g: GameScene): void {
  if (QuestLog.hasFlag(FEN_GATE_OPEN)) return;
  QuestLog.setFlag(FEN_GATE_OPEN);
  QuestLog.writeDiary(
    'Captain Vosk has opened the Fen Gate to me. Keep to the logs, he says; turn back where the water is over them; and follow no light I did not light myself. ' +
      'There is an old woman a mile out who cuts reed, Gammer Teal, who knows the fen better than anyone living.',
  );
  g.afterTalk = () => {
    const placed = g.map.objectByKey('gh-gatehouse');
    if (placed) {
      const open = gatehouseShape(true);
      g.map.reshapeObject(placed.obj, 'gh-gatehouse-open', open.shapes, open.blocks);
    }
    GameAudio.door();
    g.map.data.doors!.push(...fenGateDoors());
    g.map.data.musings = g.map.data.musings?.filter((m) => !m.text.startsWith('The causeway runs off north across the fen from here'));
    g.time.delayedCall(400, () => g.onHint?.('Brakk and Fitch heave the great bar off and swing the gates back. Beyond the arch, the causeway, going off into the fog under the trees.'));
  };
}

/** What the Fen Road's conversations set going (see dialogue/fenroad.ts). */
export const FEN_ACTIONS: Record<string, DialogueAction> = {
  'fen-gate-open': (g) => openFenGate(g),
  'fen-told-vosk': () => QuestLog.setFlag(FEN_FLAGS.toldVosk),
  'fen-gammer-punt': () => {
    if (QuestLog.hasFlag(FEN_FLAGS.punt)) return;
    QuestLog.setFlag(FEN_FLAGS.punt);
    QuestLog.writeDiary(
      'Gammer Teal, the reed-cutter, heard the raid at the Drowned Mile from her hut: hissing, like a choir of kettles. At first light a man in a good grey coat poled a punt past her from the north, ' +
        'and paid her a tower coin not to have seen him. The same new silver.',
    );
  },
  'fen-gammer-white': () => {
    if (QuestLog.hasFlag(FEN_FLAGS.white)) return;
    QuestLog.setFlag(FEN_FLAGS.white);
    QuestLog.writeDiary(
      'Gammer Teal calls them the Mere-kin: scaly folk out in the deep fen, who kept to themselves for as long as anyone remembers, and never touched the road until this spring. ' +
        'They have a leader, a great white one, bigger than Brakk, who sits on a drowned oak at dusk and watches the road. They come from the north, past where the causeway goes under.',
    );
  },
  'fen-report': (g) => {
    if (QuestLog.hasFlag(FEN_FLAGS.report)) return;
    QuestLog.setFlag(FEN_FLAGS.report);
    QuestLog.complete(GUILD_QUEST, 'report');
    QuestLog.writeDiary(
      "Told Edric Lowe what I found at the Drowned Mile. He didn't laugh. He thinks somebody is paying the lizard men to ruin the members who won't sell, and he wants to know " +
        'where they go back to, and who meets them there. Not a word to the table yet: Thrale would have them laughing.',
    );
    g.time.delayedCall(600, () => g.onHint?.('Where they go back to. North, past where the causeway goes under.'));
  },
};

/** For the guild's talk: whether the hero has seen what's at the wreck (Edric's report). */
export function fenReport(thraleHere: boolean): { tracks: boolean; told: boolean; scale: boolean; punt: boolean; thraleHere: boolean } {
  return {
    tracks: QuestLog.hasFlag(FEN_FLAGS.tracks) && QuestLog.hasFlag(GUILD_FLAGS.hired),
    told: QuestLog.hasFlag(FEN_FLAGS.report),
    scale: Inventory.count('white-scale') > 0,
    punt: QuestLog.hasFlag(FEN_FLAGS.punt),
    thraleHere,
  };
}

