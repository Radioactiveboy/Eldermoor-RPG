import { boonText, FightBoon, FIST_DIE, Weapon, WEAPON_DIE, weaponEffectText } from './Combat';
import { SaveGame } from './SaveGame';

/**
 * What the hero carries and wears. Items are defined once in ITEMS; the
 * satchel is a fixed number of slots holding stacks of them, and each
 * equipment slot holds at most one item.
 */
export type EquipSlot = 'head' | 'body' | 'feet' | 'mainHand' | 'offHand' | 'trinket';

export const EQUIP_SLOTS: Array<{ id: EquipSlot; label: string }> = [
  { id: 'head', label: 'Head' },
  { id: 'body', label: 'Body' },
  { id: 'feet', label: 'Feet' },
  { id: 'mainHand', label: 'Main hand' },
  { id: 'offHand', label: 'Off hand' },
  { id: 'trinket', label: 'Trinket' },
];

export type ItemCategory = 'Food' | 'Potion' | 'Material' | 'Clothing' | 'Tool' | 'Weapon' | 'Armour';

export interface ItemDef {
  name: string;
  /** A line or two of flavour, shown when the item is selected. */
  description: string;
  /** Icon texture (see art/items.ts). */
  icon: string;
  category: ItemCategory;
  /** How many fit in one satchel slot. */
  stack: number;
  /** Gear: where it's worn and what it adds. */
  slot?: EquipSlot;
  defence?: number;
  attack?: number;
  /** Held in the main hand: its damage die and its own rule in a fight (see systems/Combat.ts). Without one, a d6. */
  weapon?: Weapon;
  /** Food: what eating it restores. */
  eat?: { health?: number; stamina?: number };
  /** Drunk rather than eaten (ale, mead): "Drink" in the satchel, and a gulp instead of a crunch. */
  drink?: boolean;
  /**
   * A brew's effect in a fight, for the rest of it (wolfsbane on the blade, a
   * bracing draught). It's used with the fight's Eat action; an item with a boon
   * and nothing to eat (an oil) can only be used in a fight.
   */
  boon?: FightBoon;
  /** Needed for a quest (Mother's medicine, Iran's hens): shown under the satchel's Quest tab. */
  quest?: boolean;
  /** What it costs at a stall, in coins. Traders pay less to buy it (see systems/Shops.ts); no value means nobody will buy it. */
  value?: number;
}

export const ITEMS = {
  carrot: {
    name: 'Carrot',
    description: 'Sweet and crunchy, pulled fresh from the garden.',
    icon: 'item-carrot',
    category: 'Food',
    stack: 20,
    eat: { stamina: 15 },
    value: 1,
  },
  cabbage: {
    name: 'Cabbage',
    description: 'A firm green head. Mother makes a good soup from these.',
    icon: 'item-cabbage',
    category: 'Food',
    stack: 10,
    eat: { health: 4, stamina: 8 },
    value: 2,
  },
  turnip: {
    name: 'Turnip',
    description: 'Peppery and tough. Better in a stew than raw.',
    icon: 'item-turnip',
    category: 'Food',
    stack: 20,
    eat: { stamina: 10 },
    value: 1,
  },
  apple: {
    name: 'Apple',
    description: 'Shaken loose from an old tree. A little bruised, but sweet.',
    icon: 'item-apple',
    category: 'Food',
    stack: 20,
    eat: { health: 6, stamina: 6 },
    value: 1,
  },
  bread: {
    name: 'Rye Bread',
    description: "Yesterday's loaf, wrapped in a cloth. Still good.",
    icon: 'item-bread',
    category: 'Food',
    stack: 10,
    eat: { health: 10, stamina: 25 },
    value: 3,
  },
  pinecone: {
    name: 'Pinecone',
    description: 'Dry and resinous. It would make good kindling for the hearth.',
    icon: 'item-pinecone',
    category: 'Material',
    stack: 30,
    value: 1,
  },
  stick: {
    name: 'Stout Stick',
    description: 'A fallen branch, straight enough to lean on.',
    icon: 'item-stick',
    category: 'Material',
    stack: 30,
    value: 1,
  },
  'wolf-pelt': {
    name: 'Wolf Pelt',
    description: 'Thick grey fur, still smelling of the forest. Someone in the village might pay for this.',
    icon: 'item-pelt',
    category: 'Material',
    stack: 10,
    value: 12,
  },
  'white-hide': {
    name: "The Wolf Mother's Hide",
    description:
      'A great white pelt, thick as a fleece and pale as frost, from the she-wolf who ruled the old den on the plains. ' +
      'There is not another like it in the shire.',
    icon: 'item-whitehide',
    category: 'Material',
    stack: 1,
    value: 90,
  },
  moonpetal: {
    name: 'Moonpetal',
    description: "Pale, star-shaped flowers from Saint Elda's cloister garden. They smell of rain, and glow faintly in the dark. Half of Mother's tincture.",
    icon: 'item-moonpetal',
    category: 'Material',
    quest: true,
    stack: 10,
  },
  'willow-bark': {
    name: 'White Willow Bark',
    description:
      'Curls of bark from the old white willow by the upland pool, silver-grey outside and pale as cream within. Bitter to the tongue. ' +
      "The other half of Mother's tincture.",
    icon: 'item-willowbark',
    category: 'Material',
    quest: true,
    stack: 10,
  },
  venison: {
    name: 'Venison',
    description: 'A raw haunch of red deer, wrapped in dock leaves. Rich and dark, and much better over a fire.',
    icon: 'item-venison',
    category: 'Food',
    stack: 10,
    eat: { health: 6, stamina: 4 },
    value: 8,
  },
  'deer-hide': {
    name: 'Deer Hide',
    description: "A red deer's hide, soft and supple once it's cured. Tamsin pays well for these.",
    icon: 'item-deerhide',
    category: 'Material',
    stack: 10,
    value: 16,
  },
  'hare-pelt': {
    name: 'Hare Pelt',
    description: 'A small brown pelt, soft as anything. Good for lining a pair of mittens.',
    icon: 'item-harepelt',
    category: 'Material',
    stack: 20,
    value: 4,
  },
  'wildcat-pelt': {
    name: 'Wild Cat Pelt',
    description: 'A thick grey-brown pelt barred like a tabby\'s, with a bushy, black-ringed tail. Wild cats are rare enough that a tanner will want it.',
    icon: 'item-wildcatpelt',
    category: 'Material',
    stack: 10,
    value: 10,
  },
  'boar-tusk': {
    name: 'Boar Tusk',
    description: 'A curved yellow tusk as long as your hand. It would make a fine knife handle, or a fine story.',
    icon: 'item-tusk',
    category: 'Material',
    stack: 20,
    value: 10,
  },
  'walking-staff': {
    name: 'Walking Staff',
    description: 'An old ash staff that has leaned by the door for years. Good for long walks.',
    icon: 'item-staff',
    category: 'Tool',
    stack: 1,
    slot: 'mainHand',
    attack: 2,
    weapon: { die: 6 },
    value: 5,
  },
  'straw-hat': {
    name: 'Straw Hat',
    description: 'Keeps the sun off while working in the garden.',
    icon: 'item-hat',
    category: 'Clothing',
    stack: 1,
    slot: 'head',
    defence: 1,
    value: 3,
  },
  tunic: {
    name: 'Linen Tunic',
    description: 'Plain, patched at the elbows, and comfortable.',
    icon: 'item-tunic',
    category: 'Clothing',
    stack: 1,
    slot: 'body',
    defence: 1,
    value: 4,
  },
  boots: {
    name: 'Leather Boots',
    description: 'Scuffed, but they keep the mud out.',
    icon: 'item-boots',
    category: 'Clothing',
    stack: 1,
    slot: 'feet',
    defence: 1,
    value: 6,
  },
  'river-stone': {
    name: 'River Stone Charm',
    description: 'A smooth grey stone on a cord. Mother gave it to you when you were small.',
    icon: 'item-charm',
    category: 'Clothing',
    stack: 1,
    slot: 'trinket',
  },
  cheese: {
    name: 'Wedge of Cheese',
    description: 'Hard, crumbly and sharp, wrapped in a cloth. It keeps for weeks.',
    icon: 'item-cheese',
    category: 'Food',
    stack: 10,
    eat: { health: 8, stamina: 12 },
    value: 4,
  },
  'meat-pie': {
    name: 'Mutton Pie',
    description: 'Still warm from the oven, with gravy leaking through the crust.',
    icon: 'item-pie',
    category: 'Food',
    stack: 10,
    eat: { health: 20, stamina: 30 },
    value: 6,
  },
  'honey-cake': {
    name: 'Honey Cake',
    description: 'Sticky and sweet. The baker swears the honey is from her own hives.',
    icon: 'item-honeycake',
    category: 'Food',
    stack: 10,
    eat: { health: 6, stamina: 40 },
    value: 5,
  },
  'hunting-knife': {
    name: 'Hunting Knife',
    description: 'A plain blade with an antler grip. Made for skinning, but it will do in a pinch.',
    icon: 'item-knife',
    category: 'Weapon',
    stack: 1,
    slot: 'mainHand',
    attack: 3,
    weapon: { die: 6, verb: 'slash your hunting knife at' },
    value: 14,
  },
  'short-sword': {
    name: 'Short Sword',
    description: 'Good village steel, oiled and sharp. The smith says it has never been used, and it looks it.',
    icon: 'item-sword',
    category: 'Weapon',
    stack: 1,
    slot: 'mainHand',
    attack: 5,
    weapon: { die: 6 },
    value: 40,
  },
  // Four weapons that each fight their own way (see WeaponEffect in systems/Combat.ts).
  spear: {
    name: 'Ash Spear',
    description: 'A long ash shaft with a leaf-shaped iron head. Plant the butt and let them run onto it: the old way with boar.',
    icon: 'item-spear',
    category: 'Weapon',
    stack: 1,
    slot: 'mainHand',
    attack: 3,
    weapon: { die: 8, verb: 'thrust your spear at', effect: { kind: 'set', toHit: 1 } },
    value: 26,
  },
  hatchet: {
    name: "Woodman's Hatchet",
    description: 'A short-hafted axe with a bearded head, made for splitting kindling. It bites deep and leaves a nasty wound.',
    icon: 'item-hatchet',
    category: 'Weapon',
    stack: 1,
    slot: 'mainHand',
    attack: 3,
    weapon: { die: 6, verb: 'chop your hatchet at', effect: { kind: 'cleave', chance: 0.35, damage: 2, turns: 2 } },
    value: 20,
  },
  sling: {
    name: 'Leather Sling',
    description: "Two plaited cords and a leather pouch, and a bag of smooth river stones. A shepherd's weapon: it hits before they reach you.",
    icon: 'item-sling',
    category: 'Weapon',
    stack: 1,
    slot: 'mainHand',
    attack: 2,
    weapon: { die: 4, verb: 'sling a stone at', effect: { kind: 'opening' } },
    value: 9,
  },
  cudgel: {
    name: 'Blackthorn Cudgel',
    description: 'A knobbed blackthorn club, hardened in the fire and heavy at the end. One good crack and they see stars.',
    icon: 'item-cudgel',
    category: 'Weapon',
    stack: 1,
    slot: 'mainHand',
    attack: 2,
    weapon: { die: 6, verb: 'bring your cudgel down on', effect: { kind: 'daze', chance: 0.3, turns: 1 } },
    value: 12,
  },
  buckler: {
    name: 'Oak Buckler',
    description: 'A small round shield, rimmed with iron. Strapped to the forearm.',
    icon: 'item-buckler',
    category: 'Armour',
    stack: 1,
    slot: 'offHand',
    defence: 2,
    value: 16,
  },
  'iron-cap': {
    name: 'Iron Cap',
    description: 'A dented kettle helm like the militia wear. It rings when you knock on it.',
    icon: 'item-ironcap',
    category: 'Armour',
    stack: 1,
    slot: 'head',
    defence: 2,
    value: 18,
  },
  jerkin: {
    name: 'Leather Jerkin',
    description: 'Boiled leather, stiff and heavy, over a padded lining. Turns a bite or a blade.',
    icon: 'item-jerkin',
    category: 'Armour',
    stack: 1,
    slot: 'body',
    defence: 3,
    value: 28,
  },
  'wool-hood': {
    name: 'Wool Hood',
    description: 'Thick undyed wool with a short cape. Warm on a cold night.',
    icon: 'item-hood',
    category: 'Clothing',
    stack: 1,
    slot: 'head',
    defence: 1,
    value: 6,
  },
  'riding-boots': {
    name: 'Riding Boots',
    description: 'Tall boots of good oiled leather, laced to the knee.',
    icon: 'item-ridingboots',
    category: 'Clothing',
    stack: 1,
    slot: 'feet',
    defence: 2,
    value: 15,
  },
  'chicken-feed': {
    name: 'Sack of Chicken Feed',
    description: "Cracked corn and barley, a good heavy sackful. Farmer Iran's hens are waiting for it.",
    icon: 'item-feed',
    category: 'Material',
    quest: true,
    stack: 5,
    value: 10,
  },
  // Hetty's doll, found in the ruins of the cottage after the raid (see scenes/game/speckle.ts).
  'rag-doll': {
    name: 'Moppet',
    description:
      "Hetty's rag doll, in a calico dress with a patch on it, smelling of smoke. One eye is old black stitches; the other is a new " +
      'button, sewn on tight. Mother finished it.',
    icon: 'item-rag-doll',
    category: 'Material',
    quest: true,
    stack: 1,
  },
  // Taken from its plinth in the brood hall under the Greyfells, once the voice had gone out of it (see scenes/game/warren.ts).
  'dark-orb': {
    name: 'The Dark Orb',
    description:
      'A ball of smoky glass the size of a fist, taken from the bone claws in the brood hall. Cold, always, and heavier than glass should be. ' +
      'Something far away spoke out of it and set the goblins on Adowvale. Sometimes, in the dark, the smoke inside it stirs.',
    icon: 'item-dark-orb',
    category: 'Material',
    quest: true,
    stack: 1,
  },
  // Growing your own, on the plot Farmer Iran lends (see systems/Farm.ts): seeds from Hilde, and Iran's old tools.
  'carrot-seed': {
    name: 'Carrot Seed',
    description: 'A twist of paper full of tiny seeds. Enough to sow one patch of the plot. Carrots are ready in about two days, if they are kept watered.',
    icon: 'item-carrot-seed',
    category: 'Material',
    stack: 20,
    value: 2,
  },
  'turnip-seed': {
    name: 'Turnip Seed',
    description: 'A twist of paper full of round brown seeds. Enough to sow one patch of the plot. Turnips are ready in about two days, if they are kept watered.',
    icon: 'item-turnip-seed',
    category: 'Material',
    stack: 20,
    value: 2,
  },
  'cabbage-seed': {
    name: 'Cabbage Seed',
    description: 'A twist of paper full of seeds. Enough to sow one patch of the plot. Cabbages take three days, if they are kept watered, and give two good heads.',
    icon: 'item-cabbage-seed',
    category: 'Material',
    stack: 20,
    value: 3,
  },
  spade: {
    name: "Iran's Old Spade",
    description: "Farmer Iran's spare spade, the handle worn smooth. For digging over the plot he lent me in his yard.",
    icon: 'item-spade',
    category: 'Tool',
    stack: 1,
  },
  'watering-can': {
    name: 'Watering Can',
    description: "A dented tin can with a rose on the spout. Iran's water butt by the plot keeps it full. Soil stays damp for about a day; rain does the job too.",
    icon: 'item-watering-can',
    category: 'Tool',
    stack: 1,
  },
  egg: {
    name: "Hen's Egg",
    description: 'Brown and still faintly warm. Better boiled, but it will do raw in a pinch.',
    icon: 'item-egg',
    category: 'Food',
    stack: 20,
    eat: { health: 5, stamina: 10 },
    value: 2,
  },
  'silver-ring': {
    name: 'Tarnished Ring',
    description: "A silver ring, black with age, found among old bones in the wolves' den. It feels lucky.",
    icon: 'item-ring',
    category: 'Clothing',
    stack: 1,
    slot: 'trinket',
    defence: 1,
    value: 22,
  },
  // From the Crooked Tankard, Adowvale's inn (see systems/Tavern.ts).
  ale: {
    name: 'Tankard of Ale',
    description: "Godric's own brown ale, with a head on it like a sheep's fleece. Bitter, cold, and very welcome.",
    icon: 'item-ale',
    category: 'Food',
    stack: 5,
    eat: { health: 3, stamina: 30 },
    drink: true,
    value: 2,
  },
  cider: {
    name: 'Flagon of Cider',
    description: 'Cloudy and sharp, from the orchards south of the village. It goes straight to your knees.',
    icon: 'item-cider',
    category: 'Food',
    stack: 5,
    eat: { health: 5, stamina: 22 },
    drink: true,
    value: 2,
  },
  mead: {
    name: 'Horn of Mead',
    description: 'Golden honey wine, sweet and strong. Godric keeps it for weddings, wakes and paying customers.',
    icon: 'item-mead',
    category: 'Food',
    stack: 5,
    eat: { health: 10, stamina: 35 },
    drink: true,
    value: 4,
  },
  'spiced-wine': {
    name: 'Cup of Spiced Wine',
    description: 'Red wine warmed by the fire with cloves and honey. It smells of feast days.',
    icon: 'item-wine',
    category: 'Food',
    stack: 5,
    eat: { health: 14, stamina: 20 },
    drink: true,
    value: 5,
  },
  stew: {
    name: 'Bowl of Stew',
    description: "Mutton, barley and leeks, thick enough to stand a spoon in. Nell swears there's no rat in it.",
    icon: 'item-stew',
    category: 'Food',
    stack: 5,
    eat: { health: 28, stamina: 25 },
    value: 4,
  },
  'rat-tail': {
    name: 'Rat Tail',
    description: "Long, scaly and frankly disgusting. Proof of a job done, if anyone asks.",
    icon: 'item-rattail',
    category: 'Material',
    stack: 30,
    value: 1,
  },
  // Brewed at an alchemist's bench (see systems/Crafting.ts).
  'fever-tincture': {
    name: 'Moonpetal Tincture',
    description:
      'Moonpetal steeped with white willow bark and strained into a little corked flask. It glows faintly, and smells of rain. ' +
      'The old cure for a fever and a bad chest. Mother needs this.',
    icon: 'item-fever-tincture',
    category: 'Potion',
    quest: true,
    stack: 5,
    eat: { health: 30 },
    drink: true,
  },
  // Meat from the hunt: edible raw, at a pinch, but far better cooked at a hearth.
  'raw-hare': {
    name: 'Raw Hare',
    description: 'A skinned and jointed hare. Not much eating on it raw; roast it, or put it in a pot with some roots.',
    icon: 'item-raw-hare',
    category: 'Food',
    stack: 10,
    eat: { health: 2, stamina: 3 },
    value: 2,
  },
  'wolf-meat': {
    name: 'Wolf Meat',
    description: 'Dark, stringy and strong-smelling, with a bit of grey fur still on it. Nobody would eat this raw. Nobody sensible.',
    icon: 'item-wolf-meat',
    category: 'Food',
    stack: 10,
    eat: { health: 1, stamina: 2 },
    value: 2,
  },
  'boar-meat': {
    name: 'Boar Meat',
    description: 'A heavy joint of wild boar with a thick rind of fat. It wants a good long roasting.',
    icon: 'item-boar-meat',
    category: 'Food',
    stack: 10,
    eat: { health: 3, stamina: 3 },
    value: 5,
  },
  // Cooked at a hearth.
  'roast-hare': {
    name: 'Roast Hare',
    description: 'Crisp outside, tender in. It smells of woodsmoke.',
    icon: 'item-roast-hare',
    category: 'Food',
    stack: 10,
    eat: { health: 16, stamina: 14 },
    value: 4,
  },
  'wolf-steak': {
    name: 'Seared Wolf Steak',
    description: 'Cooked hard over the coals. Still tough as an old boot, but filling, and there is something fierce in it.',
    icon: 'item-wolf-steak',
    category: 'Food',
    stack: 10,
    eat: { health: 20, stamina: 12 },
    value: 5,
  },
  'venison-steak': {
    name: 'Venison Steak',
    description: 'Seared dark, pink in the middle, with a sprig of rosemary. Food for a lord, or a lucky hunter.',
    icon: 'item-venison-steak',
    category: 'Food',
    stack: 10,
    eat: { health: 30, stamina: 18 },
    value: 12,
  },
  'roast-boar': {
    name: 'Roast Boar',
    description: 'A joint of wild boar, the crackling blistered and golden. The fat runs down your chin.',
    icon: 'item-roast-boar',
    category: 'Food',
    stack: 10,
    eat: { health: 32, stamina: 22 },
    value: 12,
  },
  'boiled-egg': {
    name: 'Boiled Egg',
    description: 'Hard boiled, shelled and halved. Much better than raw.',
    icon: 'item-boiled-egg',
    category: 'Food',
    stack: 20,
    eat: { health: 8, stamina: 14 },
    value: 3,
  },
  'hare-stew': {
    name: 'Hare Stew',
    description: 'Hare, carrot and turnip, simmered down till the meat falls off the bone. Mother would approve.',
    icon: 'item-hare-stew',
    category: 'Food',
    stack: 5,
    eat: { health: 30, stamina: 35 },
    value: 7,
  },
  'hunters-pottage': {
    name: "Hunter's Pottage",
    description: 'Venison and cabbage, thickened with bread. Thick enough to stand a spoon in, and it keeps you going all day.',
    icon: 'item-hunters-pottage',
    category: 'Food',
    stack: 5,
    eat: { health: 38, stamina: 30 },
    value: 9,
  },
  // Wild herbs, gathered on the plains and in the cloister garden (see systems/Herbs.ts). They grow back in a day or two.
  yarrow: {
    name: 'Yarrow',
    description: "Feathery leaves and flat heads of tiny white flowers. Soldiers' woundwort, Mother calls it: it stops a cut bleeding.",
    icon: 'item-yarrow',
    category: 'Material',
    stack: 20,
    value: 1,
  },
  comfrey: {
    name: 'Comfrey',
    description: 'Big hairy leaves and drooping purple bells, from damp ground. Knitbone: good for bruises, sprains and worse.',
    icon: 'item-comfrey',
    category: 'Material',
    stack: 20,
    value: 1,
  },
  nettle: {
    name: 'Stinging Nettle',
    description: 'A fistful of nettle tops, picked carefully. They sting like anything raw, but steeped they put the spring back in your legs.',
    icon: 'item-nettle',
    category: 'Material',
    stack: 20,
    value: 1,
  },
  wolfsbane: {
    name: 'Wolfsbane',
    description: 'Tall spikes of hooded violet flowers. Deadly poison, every scrap of it; the old hunters rubbed it on their spears for wolves.',
    icon: 'item-wolfsbane',
    category: 'Material',
    stack: 10,
    value: 3,
  },
  sage: {
    name: 'Sage',
    description: "Soft grey-green leaves from Brother Anselm's beds, smelling warm and clean. The brothers say it steadies the heart.",
    icon: 'item-sage',
    category: 'Material',
    stack: 20,
    value: 1,
  },
  // More brews from Old Maud's bench.
  'healing-draught': {
    name: 'Healing Draught',
    description: 'Comfrey and yarrow steeped together into a green-gold draught that tastes of hay and pennies. It closes cuts and eases bruises.',
    icon: 'item-healing-draught',
    category: 'Potion',
    stack: 5,
    eat: { health: 40 },
    drink: true,
    value: 10,
  },
  'stamina-tonic': {
    name: 'Nettle Tonic',
    description: 'Nettle tops steeped with a sweet apple. Sharp, fizzing and bright green: one swig and your legs feel new.',
    icon: 'item-stamina-tonic',
    category: 'Potion',
    stack: 5,
    eat: { health: 5, stamina: 70 },
    drink: true,
    value: 7,
  },
  'wolfsbane-oil': {
    name: 'Wolfsbane Oil',
    description:
      'Wolfsbane pounded with pine resin into a dark, sticky oil, in a stoppered horn. Wipe it on your blade before a fight with wolves, ' +
      'and keep it well away from your mouth.',
    icon: 'item-wolfsbane-oil',
    category: 'Potion',
    stack: 5,
    boon: { kind: 'bane', family: 'wolf', sides: 6 },
    value: 12,
  },
  'stout-draught': {
    name: 'Stout Draught',
    description: 'Sage and nettle in a dark, bitter draught. It sits in your belly like a warm stone, and the next blow seems to matter less.',
    icon: 'item-stout-draught',
    category: 'Potion',
    stack: 5,
    eat: { health: 8 },
    drink: true,
    boon: { kind: 'ward', armour: 2 },
    value: 10,
  },
  // Fishing (see systems/Fishing.ts): Old Tobin's spare rod, and what bites in the lake, the mere and the ponds.
  'fishing-rod': {
    name: 'Fishing Rod',
    description: "Old Tobin's spare: a hazel rod, a horsehair line and a red and white float. Stand at the water's edge and press E to fish.",
    icon: 'item-fishing-rod',
    category: 'Tool',
    stack: 1,
    value: 4,
  },
  perch: {
    name: 'Perch',
    description: 'Green-gold with dark bars and a spiny red fin. Bony, but sweet.',
    icon: 'item-perch',
    category: 'Food',
    stack: 10,
    eat: { health: 2, stamina: 3 },
    value: 2,
  },
  roach: {
    name: 'Roach',
    description: 'A little silver fish with red eyes. There are thousands of them; Tobin calls them the lake\'s small change.',
    icon: 'item-roach',
    category: 'Food',
    stack: 10,
    eat: { health: 1, stamina: 2 },
    value: 1,
  },
  pike: {
    name: 'Pike',
    description: 'Long, mottled green and all teeth. Not Old Grandfather, but a good one: it fought all the way to the bank.',
    icon: 'item-pike',
    category: 'Food',
    stack: 5,
    eat: { health: 3, stamina: 3 },
    value: 9,
  },
  eel: {
    name: 'Eel',
    description: 'Slippery, dark and still wriggling. They come out of the mud at night.',
    icon: 'item-eel',
    category: 'Food',
    stack: 10,
    eat: { health: 2, stamina: 2 },
    value: 4,
  },
  tench: {
    name: 'Tench',
    description: 'A fat olive-green fish with little red eyes, from the weedy shallows. The doctor fish, they call it.',
    icon: 'item-tench',
    category: 'Food',
    stack: 10,
    eat: { health: 2, stamina: 3 },
    value: 4,
  },
  carp: {
    name: 'Carp',
    description: "A heavy golden carp from the brothers' ponds. Brother Aldo knows every one by name, so perhaps don't tell him.",
    icon: 'item-carp',
    category: 'Food',
    stack: 5,
    eat: { health: 3, stamina: 3 },
    value: 6,
  },
  trout: {
    name: 'Brown Trout',
    description: 'Speckled red and black, from the cold brook-fed pool under the Greyfells. A lovely fish.',
    icon: 'item-trout',
    category: 'Food',
    stack: 10,
    eat: { health: 2, stamina: 3 },
    value: 5,
  },
  'old-boot': {
    name: 'Old Boot',
    description: 'A sodden leather boot, green with weed. Tobin has caught this one before, by the look of it.',
    icon: 'item-old-boot',
    category: 'Material',
    stack: 1,
  },
  // Fish cooked at a hearth.
  'grilled-perch': {
    name: 'Grilled Perch',
    description: 'Crisp skin, white flakes, and only a few bones to pick out.',
    icon: 'item-grilled-perch',
    category: 'Food',
    stack: 10,
    eat: { health: 14, stamina: 12 },
    value: 4,
  },
  'fried-roach': {
    name: 'Fried Roach',
    description: 'Three little roach, fried crisp. Eat them whole, bones and all.',
    icon: 'item-fried-roach',
    category: 'Food',
    stack: 10,
    eat: { health: 9, stamina: 10 },
    value: 2,
  },
  'baked-pike': {
    name: 'Baked Pike',
    description: 'A whole pike baked in the embers, enough for a family. Rich and meaty.',
    icon: 'item-baked-pike',
    category: 'Food',
    stack: 5,
    eat: { health: 34, stamina: 24 },
    value: 14,
  },
  'smoked-eel': {
    name: 'Smoked Eel',
    description: 'Hung over the fire till it turns gold and oily. It keeps for days.',
    icon: 'item-smoked-eel',
    category: 'Food',
    stack: 10,
    eat: { health: 20, stamina: 18 },
    value: 7,
  },
  'grilled-tench': {
    name: 'Grilled Tench',
    description: 'Earthy and soft, with a crackle of skin. Better than it sounds.',
    icon: 'item-grilled-tench',
    category: 'Food',
    stack: 10,
    eat: { health: 18, stamina: 14 },
    value: 6,
  },
  'roast-carp': {
    name: 'Roast Carp',
    description: 'A golden carp roasted on the spit, the way the brothers do it on feast days.',
    icon: 'item-roast-carp',
    category: 'Food',
    stack: 5,
    eat: { health: 26, stamina: 20 },
    value: 10,
  },
  'grilled-trout': {
    name: 'Grilled Trout',
    description: 'Pink-fleshed and delicate, with a sprig of thyme. Lord Morten eats no better.',
    icon: 'item-grilled-trout',
    category: 'Food',
    stack: 10,
    eat: { health: 22, stamina: 16 },
    value: 8,
  },
} satisfies Record<string, ItemDef>;

export type ItemId = keyof typeof ITEMS;

export function itemDef(id: ItemId): ItemDef {
  return ITEMS[id];
}

/** The rules of whatever's held in the main hand: its own, a d6 for anything else held, or bare fists. */
export function weaponOf(id: ItemId | undefined): Weapon {
  if (!id) return { die: FIST_DIE, verb: 'throw a punch at' };
  const def = itemDef(id);
  return { die: WEAPON_DIE, verb: `swing your ${def.name.toLowerCase()} at`, ...def.weapon };
}

/** What an item does, one line each, for item details ("Eat: +15 stamina", "Defence +1"). */
export function itemEffects(def: ItemDef): string[] {
  const lines: string[] = [];
  const verb = def.drink ? 'Drink' : 'Eat';
  if (def.eat?.health) lines.push(`${verb}: +${def.eat.health} health`);
  if (def.eat?.stamina) lines.push(`${verb}: +${def.eat.stamina} stamina`);
  if (def.boon) lines.push(`In a fight: ${boonText(def.boon)}`);
  if (def.slot) lines.push(`Worn: ${EQUIP_SLOTS.find((s) => s.id === def.slot)!.label}`);
  if (def.defence) lines.push(`Defence +${def.defence}`);
  if (def.attack) lines.push(`Attack +${def.attack}`);
  if (def.slot === 'mainHand') {
    const w = { die: WEAPON_DIE, ...def.weapon };
    lines.push(`Damage d${w.die}${def.attack ? `+${def.attack}` : ''}`);
    if (w.effect) lines.push(weaponEffectText(w.effect));
  }
  return lines;
}

export interface Stack {
  id: ItemId;
  count: number;
}

export type InventoryEvent =
  | { type: 'added'; id: ItemId; count: number }
  /** Coins given as a reward, which the HUD shows floating up like a found item. */
  | { type: 'rewarded'; coins: number }
  | { type: 'changed' };

type Listener = (e: InventoryEvent) => void;

export const BAG_SIZE = 20;
/** How Sort lays out the satchel, by kind of thing (with quest things last of all). */
const SORT_ORDER: ItemCategory[] = ['Weapon', 'Armour', 'Clothing', 'Tool', 'Potion', 'Food', 'Material'];

/** The satchel's filter tabs: what's for eating and drinking, what's worn or used, what's for making things, and what a quest needs. */
export type SatchelGroup = 'food' | 'gear' | 'materials' | 'quest';

export function satchelGroup(def: ItemDef): SatchelGroup {
  if (def.quest) return 'quest';
  if (def.category === 'Food' || def.category === 'Potion') return 'food';
  if (def.category === 'Material') return 'materials';
  return 'gear';
}

/** Ways to tidy the satchel: by kind of thing, dearest first, or A to Z. */
export type SortKey = 'type' | 'value' | 'name';

/** Which of two items comes first when the satchel is sorted by `by`. Ties go by name. */
export function compareItems(a: ItemDef, b: ItemDef, by: SortKey): number {
  const name = a.name.localeCompare(b.name);
  if (by === 'name') return name;
  if (by === 'value') return (b.value ?? -1) - (a.value ?? -1) || name;
  return Number(!!a.quest) - Number(!!b.quest) || SORT_ORDER.indexOf(a.category) - SORT_ORDER.indexOf(b.category) || name;
}
/** Coins the hero has saved up at the start. */
const START_COINS = 15;

class InventoryStore {
  /** Satchel slots; null is an empty slot. */
  bag: Array<Stack | null> = [];
  equipped: Partial<Record<EquipSlot, ItemId>> = {};
  /** Money, in copper coins. Kept outside the satchel's slots. */
  coins = START_COINS;
  private listeners: Listener[] = [];

  /** A new game: what the hero owns when they wake up. */
  reset(): void {
    this.bag = new Array(BAG_SIZE).fill(null);
    this.equipped = { body: 'tunic', feet: 'boots', trinket: 'river-stone' };
    this.bag[0] = { id: 'bread', count: 2 };
    this.bag[1] = { id: 'walking-staff', count: 1 };
    this.bag[2] = { id: 'straw-hat', count: 1 };
    this.coins = START_COINS;
    this.emit({ type: 'changed' });
  }

  onChange(fn: Listener): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  count(id: ItemId): number {
    return this.bag.reduce((n, s) => n + (s?.id === id ? s.count : 0), 0);
  }

  /** Room for `count` more of an item, topping up stacks before using empty slots. */
  canAdd(id: ItemId, count = 1): boolean {
    return this.room(id) >= count;
  }

  /** How many more of an item would fit. */
  room(id: ItemId): number {
    const max = itemDef(id).stack;
    let room = 0;
    for (const s of this.bag) room += s === null ? max : s.id === id ? max - s.count : 0;
    return room;
  }

  /** Takes `count` of an item out of the satchel (from the last stacks first), if there are that many. */
  remove(id: ItemId, count: number): boolean {
    if (this.count(id) < count) return false;
    let left = count;
    for (let i = this.bag.length - 1; i >= 0 && left > 0; i--) {
      const s = this.bag[i];
      if (s?.id !== id) continue;
      const n = Math.min(left, s.count);
      s.count -= n;
      left -= n;
      if (s.count === 0) this.bag[i] = null;
    }
    this.emit({ type: 'changed' });
    return true;
  }

  /** Coins given for a job done, announced on the HUD. */
  reward(coins: number): void {
    this.coins += coins;
    this.emit({ type: 'changed' });
    this.emit({ type: 'rewarded', coins });
  }

  /** Pays out or takes in coins. Returns false (changing nothing) if there isn't enough to pay. */
  addCoins(n: number): boolean {
    if (this.coins + n < 0) return false;
    this.coins += n;
    this.emit({ type: 'changed' });
    return true;
  }

  /** Adds items if they all fit; returns false (adding nothing) if the satchel is too full. */
  add(id: ItemId, count = 1): boolean {
    if (!this.canAdd(id, count)) return false;
    const max = itemDef(id).stack;
    let left = count;
    for (const s of this.bag) {
      if (left === 0) break;
      if (s?.id !== id || s.count >= max) continue;
      const n = Math.min(left, max - s.count);
      s.count += n;
      left -= n;
    }
    for (let i = 0; i < this.bag.length && left > 0; i++) {
      if (this.bag[i] !== null) continue;
      const n = Math.min(left, max);
      this.bag[i] = { id, count: n };
      left -= n;
    }
    this.emit({ type: 'added', id, count });
    this.emit({ type: 'changed' });
    return true;
  }

  /** Takes one item out of a satchel slot. */
  takeOne(index: number): ItemId | undefined {
    const s = this.bag[index];
    if (!s) return undefined;
    s.count--;
    if (s.count <= 0) this.bag[index] = null;
    this.emit({ type: 'changed' });
    return s.id;
  }

  /**
   * Drops one satchel slot onto another: stacks of the same thing merge as
   * far as they fit, anything else (or an empty slot) swaps places.
   */
  move(from: number, to: number): void {
    const a = this.bag[from];
    const b = this.bag[to];
    if (from === to || !a || to < 0 || to >= this.bag.length) return;
    const max = itemDef(a.id).stack;
    if (b && b.id === a.id && b.count < max) {
      const n = Math.min(a.count, max - b.count);
      b.count += n;
      a.count -= n;
      if (a.count === 0) this.bag[from] = null;
    } else {
      this.bag[to] = a;
      this.bag[from] = b;
    }
    this.emit({ type: 'changed' });
  }

  /**
   * Tidies the satchel: like with like in as few stacks as will hold them, laid
   * out by kind (gear first, odds and ends and then quest things last), by value
   * (dearest first) or by name.
   */
  sort(by: SortKey = 'type'): void {
    const totals = new Map<ItemId, number>();
    for (const s of this.bag) if (s) totals.set(s.id, (totals.get(s.id) ?? 0) + s.count);
    const ids = [...totals.keys()].sort((a, b) => compareItems(itemDef(a), itemDef(b), by));
    const bag: Array<Stack | null> = [];
    for (const id of ids) {
      const max = itemDef(id).stack;
      for (let left = totals.get(id)!; left > 0; left -= max) bag.push({ id, count: Math.min(left, max) });
    }
    this.bag = bag.concat(new Array(BAG_SIZE - bag.length).fill(null));
    this.emit({ type: 'changed' });
  }

  /** Puts on the gear in a satchel slot; whatever was worn there goes back into that slot. */
  equip(index: number): boolean {
    const s = this.bag[index];
    const slot = s && itemDef(s.id).slot;
    if (!s || !slot) return false;
    const previous = this.equipped[slot];
    this.equipped[slot] = s.id;
    this.bag[index] = previous ? { id: previous, count: 1 } : null;
    this.emit({ type: 'changed' });
    return true;
  }

  /** Takes off what's worn in a slot and puts it in the satchel, if there's room. */
  unequip(slot: EquipSlot): boolean {
    const id = this.equipped[slot];
    if (!id) return false;
    const free = this.bag.indexOf(null);
    if (free < 0) return false;
    this.bag[free] = { id, count: 1 };
    delete this.equipped[slot];
    this.emit({ type: 'changed' });
    return true;
  }

  toSave(): { bag: Array<Stack | null>; equipped: Partial<Record<EquipSlot, ItemId>>; coins: number } {
    return { bag: this.bag.map((s) => s && { ...s }), equipped: { ...this.equipped }, coins: this.coins };
  }

  fromSave(data: ReturnType<InventoryStore['toSave']>): void {
    // Items that have since been taken out of the game are quietly dropped.
    const isItem = (id: unknown): id is ItemId => typeof id === 'string' && id in ITEMS;
    this.bag = new Array(BAG_SIZE).fill(null).map((_, i) => {
      const s = data.bag?.[i];
      return s && isItem(s.id) && s.count > 0 ? { id: s.id, count: s.count } : null;
    });
    this.equipped = {};
    for (const { id: slot } of EQUIP_SLOTS) {
      const id = data.equipped?.[slot];
      if (isItem(id)) this.equipped[slot] = id;
    }
    this.coins = typeof data.coins === 'number' ? data.coins : START_COINS;
    this.emit({ type: 'changed' });
  }

  /** Totals from everything worn. */
  get totals(): { defence: number; attack: number } {
    let defence = 0;
    let attack = 0;
    for (const id of Object.values(this.equipped)) {
      const def: ItemDef = ITEMS[id];
      defence += def.defence ?? 0;
      attack += def.attack ?? 0;
    }
    return { defence, attack };
  }

  private emit(e: InventoryEvent): void {
    for (const l of this.listeners) l(e);
  }
}

export const Inventory = new InventoryStore();
Inventory.reset();

SaveGame.register('inventory', {
  save: () => Inventory.toSave(),
  load(data) {
    Inventory.reset();
    if (data) Inventory.fromSave(data as ReturnType<InventoryStore['toSave']>);
  },
});
