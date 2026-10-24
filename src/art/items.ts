import Phaser from 'phaser';
import { PALETTE as P } from './palette';
import { PixelCanvas } from './PixelCanvas';

/** Item icons are drawn on a small square and shown scaled up in the satchel. */
export const ICON_SIZE = 16;

const CARROT = 0xe0782a;
const CARROT_DARK = 0xa84e1c;
const CARROT_LIGHT = 0xf5a04a;
const CABBAGE = 0x7fb05a;
const CABBAGE_DARK = 0x4f7e3a;
const CABBAGE_LIGHT = 0xb4d68a;
const TURNIP = 0xece2d6;
const TURNIP_TOP = 0x9a4a8c;
const TURNIP_TOP_LIGHT = 0xc070b0;
const APPLE = 0xc8343a;
const APPLE_DARK = 0x8a2228;
const APPLE_LIGHT = 0xf06a5a;
const CRUST = 0xa8642e;
const CRUST_DARK = 0x7a4420;
const CRUST_LIGHT = 0xd09048;

function icon(draw: (c: PixelCanvas) => void): PixelCanvas {
  const c = new PixelCanvas(ICON_SIZE, ICON_SIZE);
  draw(c);
  c.outline();
  return c;
}

const carrot = () =>
  icon((c) => {
    // A tapering root, drawn on the diagonal, with feathery leaves at the top.
    for (let i = 0; i < 10; i++) {
      const w = Math.max(1, Math.round(3 - i * 0.28));
      for (let k = 0; k < w; k++) c.set(4 + i + k - 1, 13 - i + k - 1, k === 0 ? CARROT_LIGHT : k === w - 1 ? CARROT_DARK : CARROT);
    }
    c.set(6, 10, CARROT_DARK);
    c.set(9, 7, CARROT_DARK);
    for (const [x, y] of [[12, 2], [13, 1], [14, 3], [13, 4], [12, 1], [15, 2], [11, 1]]) c.set(x, y, P.leafLight);
    for (const [x, y] of [[13, 3], [12, 3], [14, 2]]) c.set(x, y, P.leaf);
  });

const cabbage = () =>
  icon((c) => {
    c.ellipse(8, 9, 6.5, 5.5, CABBAGE, CABBAGE_DARK, CABBAGE_LIGHT);
    c.ellipse(8, 8, 3.6, 3.2, CABBAGE_LIGHT, CABBAGE);
    for (let y = 5; y < 14; y++) c.set(8 + Math.round((y - 9) * 0.2), y, CABBAGE_DARK);
    c.set(4, 9, CABBAGE_DARK);
    c.set(12, 9, CABBAGE_DARK);
  });

const turnip = () =>
  icon((c) => {
    c.ellipse(8, 10, 5, 4.5, TURNIP, P.linenDark);
    c.ellipse(8, 8, 4.6, 2.2, TURNIP_TOP, undefined, TURNIP_TOP_LIGHT);
    c.set(8, 15, P.linenDark);
    c.set(8, 14, TURNIP);
    for (const [x, y] of [[7, 3], [6, 2], [9, 3], [10, 2], [8, 4], [5, 1], [11, 1], [8, 2]]) c.set(x, y, P.leafLight);
    for (const [x, y] of [[7, 4], [9, 4], [8, 3]]) c.set(x, y, P.leaf);
  });

const apple = () =>
  icon((c) => {
    c.ellipse(8, 9.5, 5.5, 5, APPLE, APPLE_DARK, APPLE_LIGHT);
    c.set(8, 5, APPLE_DARK);
    c.rect(8, 2, 1, 3, P.bark);
    c.set(9, 3, P.leaf);
    c.set(10, 3, P.leafLight);
    c.set(10, 2, P.leaf);
    c.set(6, 7, 0xffd0c0);
  });

const bread = () =>
  icon((c) => {
    c.ellipse(8, 9, 7, 4.5, CRUST, CRUST_DARK, CRUST_LIGHT);
    for (const x of [4, 7, 10]) {
      c.set(x, 8, P.linen);
      c.set(x + 1, 7, P.linen);
    }
  });

const pinecone = () =>
  icon((c) => {
    for (let row = 0; row < 6; row++) {
      const y = 3 + row * 2;
      const half = row < 3 ? 2 + row : 7 - row;
      for (let x = 8 - half; x <= 8 + half; x++) {
        c.set(x, y, (x + row) % 2 ? P.bark : P.barkLight);
        c.set(x, y + 1, P.barkDark);
      }
    }
    c.rect(8, 1, 1, 2, P.barkDark);
  });

const stick = () =>
  icon((c) => {
    for (let i = 0; i < 12; i++) {
      c.set(2 + i, 13 - i, P.barkLight);
      c.set(3 + i, 13 - i, P.bark);
    }
    c.set(8, 6, P.bark);
    c.set(7, 5, P.barkLight);
    c.set(6, 5, P.leaf);
  });

const staff = () =>
  icon((c) => {
    for (let i = 0; i < 14; i++) {
      c.set(1 + i, 14 - i, P.plankLight);
      c.set(2 + i, 14 - i, P.plank);
    }
    // Knotted head and a leather grip.
    c.ellipse(13.5, 2.5, 2, 2, P.plankLight, P.plankDark);
    for (let i = 5; i < 8; i++) c.set(1 + i, 14 - i, P.leatherDark);
  });

const hat = () =>
  icon((c) => {
    c.ellipse(8, 10, 7.5, 2.8, P.straw, P.strawDark);
    c.ellipse(8, 7, 4, 3.5, P.straw, P.strawDark);
    c.rect(4, 8, 8, 1, 0x8e3a3a);
  });

const tunic = () =>
  icon((c) => {
    c.rect(4, 3, 8, 11, P.linen);
    c.rect(1, 3, 3, 6, P.linen);
    c.rect(12, 3, 3, 6, P.linenDark);
    c.rect(10, 3, 2, 11, P.linenDark);
    c.rect(4, 9, 8, 1, P.leatherDark);
    c.set(7, 3, P.leather);
    c.set(8, 3, P.leather);
    c.set(7, 4, P.leather);
    c.set(6, 12, P.linenDark);
  });

const boots = () =>
  icon((c) => {
    c.shadedRect(3, 3, 4, 9, P.leather, P.leatherDark, P.leatherLight);
    c.rect(3, 11, 7, 3, P.leather);
    c.rect(3, 13, 7, 1, P.leatherDark);
    c.shadedRect(9, 2, 4, 9, P.leatherDark, P.leatherDark, P.leather);
    c.rect(9, 10, 6, 3, P.leatherDark);
    c.rect(3, 3, 4, 1, P.leatherLight);
  });

const charm = () =>
  icon((c) => {
    // Cord looping down to a smooth grey stone.
    for (let i = 0; i < 6; i++) {
      c.set(3 + i, 2 + i, P.leather);
      c.set(13 - i, 2 + i, P.leather);
    }
    c.ellipse(8, 11, 3.5, 3, P.stone, P.stoneDark, P.stoneLight);
    c.set(7, 10, P.flowerWhite);
  });

const pelt = () =>
  icon((c) => {
    // A rolled-up grey hide tied with a cord, the tail hanging from one end.
    c.ellipse(8, 8, 6.5, 4.5, 0x7a7480, 0x4b4652, 0xa29ca6);
    c.ellipse(4, 8, 2.2, 3.6, 0x4b4652, 0x4b4652);
    c.ellipse(4, 8, 1.2, 2.2, 0xcfc6bb, 0xcfc6bb);
    c.rect(9, 4, 1, 9, P.leather);
    for (let i = 0; i < 4; i++) c.set(14 - i * 0.2, 11 + i, i > 2 ? 0x4b4652 : 0x7a7480);
    c.set(12, 6, 0xcfc6bb);
  });

export function generateItemIcons(scene: Phaser.Scene): void {
  const icons: Array<[string, () => PixelCanvas]> = [
    ['item-carrot', carrot],
    ['item-cabbage', cabbage],
    ['item-turnip', turnip],
    ['item-apple', apple],
    ['item-bread', bread],
    ['item-pinecone', pinecone],
    ['item-stick', stick],
    ['item-staff', staff],
    ['item-hat', hat],
    ['item-tunic', tunic],
    ['item-boots', boots],
    ['item-charm', charm],
    ['item-pelt', pelt],
  ];
  for (const [key, make] of icons) make().toTexture(scene, key);
}
