import Phaser from 'phaser';
import { FINE_FOLK } from './companions3d';
import { generateFigure3D } from './figure3d';
import { FINE_SPEC } from './fine3d';
import { MODELS_3D } from './models3d';

/**
 * The townsfolk, travellers and brothers ('folk-<id>'): each modelled in 3D in
 * models3d.ts and drawn in eight directions (see figure3d.ts). Their talking
 * portraits are in portraits.ts; the folk met by chance on the plains are in
 * wayfarers3d.ts, and Mother is in mother3d.ts. The companions are drawn
 * finely, like the hero (see companions3d.ts and fine3d.ts).
 */
export function generateFolk(scene: Phaser.Scene): void {
  for (const [id, model] of Object.entries(MODELS_3D)) generateFigure3D(scene, `folk-${id}`, model);
  for (const [id, model] of Object.entries(FINE_FOLK)) generateFigure3D(scene, `folk-${id}`, model, FINE_SPEC);
}
