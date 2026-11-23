import Phaser from 'phaser';
import { darker, type Tones } from './character';
import { generateFigure3D, Hit, limb, Model, Pose3D, Solid } from './figure3d';
import { asChild, dusted, maidModel, regularModel } from './models3d';
import { PALETTE as P } from './palette';

/**
 * The people of Adowvale who fill the market square by day ('folk-crowd-<id>'):
 * nobody in particular, just folk about their business, out with a basket,
 * stopping for a word by the well. They aren't spoken to, only overheard (see
 * scenes/game/marketCrowd.ts). Built from the same 3D bodies as the tavern's
 * maids and regulars (models3d.ts), dressed in homespun.
 */

const BELT: Tones = [0x3a2a1e, 0x261a12, 0x4e3a2a];
const WICKER: Tones = [0xc8a060, 0x96743e, 0xe0bc7c];

/** A wicker basket hung over the right arm, with a cloth over what's in it. */
function basket(b: number, cloth: Tones): Solid[] {
  const weave = (h: Hit): Tones => ((Math.floor(h.y * 0.9) + Math.floor((h.x + h.z) * 0.7)) % 2 ? WICKER : [WICKER[1], darker(WICKER[1]), WICKER[0]]);
  return [
    { cx: 7.4, cy: 14.4 - b, cz: 2.4, rx: 2.6, ry: 2, rz: 2.2, material: weave },
    { cx: 7.4, cy: 16.3 - b, cz: 2.4, rx: 2.3, ry: 0.6, rz: 1.9, material: cloth },
    // The handle, up over the forearm.
    ...limb([6, 15.8 - b, 2.4], [7.4, 18.4 - b, 2.4], 0.4, 0.4, WICKER, 0.3),
    ...limb([7.4, 18.4 - b, 2.4], [8.8, 15.8 - b, 2.4], 0.4, 0.4, WICKER, 0.3),
  ];
}

/** A goodwife out for her bread: a russet dress and apron, a basket on her arm, dark hair braided. */
export function goodwifeModel(pose: Pose3D): Model {
  const model = maidModel(pose, {
    dress: [0x8a5236, 0x643a24, 0xa86a48],
    skin: [0xe8b892, 0xc29070, 0xf8cca8],
    hair: [0x3a2a22, 0x261a14, 0x54402e],
    hairStyle: 'braid',
  });
  model.solids.push(...basket(pose.bob, [0xe8e0cc, 0xbcb29c, 0xfff8e8]));
  return model;
}

/** An older woman in a plain slate-blue dress and a cream kerchief over her grey hair. */
export function matronModel(pose: Pose3D): Model {
  const kerchief: Tones = [0xe8dcc0, 0xbcae94, 0xfaf0d8];
  const model = maidModel(pose, {
    dress: [0x4a5a72, 0x343f52, 0x627692],
    sleeves: [0x4a5a72, 0x343f52, 0x627692],
    skin: [0xe0aa8a, 0xb8846a, 0xf2c0a0],
    hair: [0xa8a098, 0x7e7872, 0xc4bcb4],
    hairStyle: 'loose',
    noApron: true,
  });
  const hy = 32.5 - pose.bob;
  // The kerchief over her crown, tied at the back of her neck.
  model.solids.push({ cx: 0, cy: hy + 2.6, cz: -0.6, rx: 5.9, ry: 4.4, rz: 5.6, material: kerchief });
  model.solids.push({ cx: 0, cy: hy - 3.4, cz: -4.8, rx: 1.4, ry: 1.2, rz: 1, material: kerchief });
  model.solids.push(...basket(pose.bob, [0x7a8a4a, 0x5a6834, 0x96a862]));
  return model;
}

/** A labourer in from the fields: an oatmeal smock belted over brown breeches, a straw hat and a short beard. */
export function labourerModel(pose: Pose3D): Model {
  const straw: Tones = [P.straw, P.strawDark, P.strawLight];
  const hair: Tones = [0x6a4a2e, 0x4a321e, 0x86603e];
  return regularModel(pose, {
    coat: [0xc8b890, 0x9e8e6a, 0xe0d2ac],
    legs: [0x6b4a30, 0x4a3020, 0x87603e],
    boots: [P.barkDark, P.ink, P.bark],
    skin: [0xd8946c, 0xb07454, 0xeeae88],
    hair,
    beard: hair,
    coatPaint: (h, base) => (Math.abs(h.y - (15.6 - pose.bob)) < 0.7 ? BELT : base),
    extras: (hy, hz) => [
      // A wide straw hat, its weave catching the light.
      { cx: 0, cy: hy + 3, cz: hz, rx: 8, ry: 0.7, rz: 7.6, material: (h: Hit) => (dusted(h, 0.3) ? [straw[1], straw[1], straw[0]] : straw) },
      { cx: 0, cy: hy + 4.6, cz: hz - 0.2, rx: 4.6, ry: 2.6, rz: 4.4, material: straw },
    ],
  });
}

/** An old man taking the air: a long grey-green coat, white hair and beard, a little stooped, with a stick. */
export function elderModel(pose: Pose3D): Model {
  const stick: Tones = [0x7a5a3a, 0x54402a, 0x96744e];
  const white: Tones = [0xe4e0da, 0xb8b4ae, 0xfaf8f4];
  const model = regularModel(pose, {
    coat: [0x5a6a56, 0x3e4a3c, 0x768a70],
    legs: [0x4e4234, 0x342a20, 0x645440],
    boots: [P.leatherDark, P.barkDark, P.leather],
    skin: [0xe0a88a, 0xb8846a, 0xf2c0a2],
    hair: white,
    beard: white,
    long: true,
    hunched: true,
  });
  // His stick, planted by his right foot.
  model.solids.push(...limb([7.4, 0.6, 2.2], [6.6, 16 - pose.bob, 1.6], 0.55, 0.55, stick, 0.3));
  return model;
}

/** A young man about an errand: a short red tunic belted over linen sleeves and grey hose, fair-haired. */
export function youthModel(pose: Pose3D): Model {
  return regularModel(pose, {
    coat: [0x9a3a32, 0x702822, 0xb8524a],
    sleeves: [P.linen, P.linenDark, 0xfff4e0],
    legs: [0x6a6670, 0x4a464e, 0x86828c],
    boots: [P.leather, P.leatherDark, P.leatherLight],
    skin: [0xf0c4a0, 0xc69a7a, 0xffdcbc],
    hair: [0xd8b878, 0xae9054, 0xf0d496],
    coatPaint: (h, base) => (Math.abs(h.y - (15.6 - pose.bob)) < 0.7 ? BELT : base),
  });
}

/** A girl sent to market: a mustard dress and apron, chestnut hair loose to her shoulders. */
export function girlModel(pose: Pose3D): Model {
  return asChild(maidModel(pose, {
    dress: [0xc8a040, 0x9a7a2a, 0xe0bc5c],
    skin: [0xecc0a0, 0xc29878, 0xfad6b8],
    hair: [0x8a4a2a, 0x62321c, 0xa8603a],
    hairStyle: 'loose',
  }), 27);
}

/** A boy at a run: a blue tunic, brown breeches and a cap pulled down over his ears. */
export function boyModel(pose: Pose3D): Model {
  const cap: Tones = [0x6a4a30, 0x4a3020, 0x87603e];
  return asChild(regularModel(pose, {
    coat: [0x3e5a8a, 0x2c4068, 0x5474a8],
    sleeves: [0x3e5a8a, 0x2c4068, 0x5474a8],
    legs: [0x6b4a30, 0x4a3020, 0x87603e],
    boots: [P.leather, P.leatherDark, P.leatherLight],
    skin: [0xc89070, 0xa06c52, 0xdea888],
    hair: [0x2e2420, 0x1e1614, 0x463830],
    extras: (hy, hz) => [
      { cx: 0, cy: hy + 2.6, cz: hz - 0.4, rx: 5.7, ry: 3.8, rz: 5.5, material: cap },
      { cx: 0, cy: hy + 2.2, cz: hz + 4, rx: 3.4, ry: 0.5, rz: 2, material: cap },
    ],
  }));
}

/** The market crowd's figures, by id: drawn as 'folk-crowd-<id>'. */
export const CROWD_MODELS: Record<string, (pose: Pose3D) => Model> = {
  goodwife: goodwifeModel,
  matron: matronModel,
  labourer: labourerModel,
  elder: elderModel,
  youth: youthModel,
  girl: girlModel,
  boy: boyModel,
};

export function generateCrowd(scene: Phaser.Scene): void {
  for (const [id, model] of Object.entries(CROWD_MODELS)) generateFigure3D(scene, `folk-crowd-${id}`, model);
}
