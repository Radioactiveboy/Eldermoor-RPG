import { Inventory, ItemId } from './Inventory';
import { SaveGame } from './SaveGame';

/**
 * Making things out of other things: brewing at an alchemist's bench and
 * cooking over a hearth. A recipe is a handful of ingredients in, one thing
 * out. Recipes are data (RECIPES below); the station window
 * (scenes/StationScene.ts) matches whatever the hero has put in its slots
 * against them.
 *
 * Some recipes are known from the start (Mother told the hero hers); others
 * are found by trying things, and once made are written in the recipe book.
 */
export type StationKind = 'alchemy' | 'cooking';

export interface Recipe {
  id: string;
  station: StationKind;
  /** What goes in, and how many of each. Order doesn't matter. */
  needs: Array<[ItemId, number]>;
  makes: ItemId;
  /** How many one batch makes. */
  yields: number;
  /** Seconds one batch takes at the station. */
  seconds: number;
  /** Known before it's ever been made (it shows in the recipe book from the start). */
  known?: boolean;
  /** The recipe book's clue while it's still unknown. */
  hint: string;
  /** What each stretch of the progress bar is called, in order ("Grinding", "Steeping"...). */
  stages: string[];
  /** Experience for making it the first time. */
  xp: number;
}

export const RECIPES: Recipe[] = [
  {
    id: 'fever-tincture',
    station: 'alchemy',
    needs: [['moonpetal', 1], ['willow-bark', 1]],
    makes: 'fever-tincture',
    yields: 1,
    seconds: 6,
    known: true,
    hint: "Mother's remedy: moonpetal and white willow bark, steeped together.",
    stages: ['Grinding the bark', 'Steeping the moonpetal', 'Straining the tincture'],
    xp: 40,
  },
  {
    id: 'roast-hare',
    station: 'cooking',
    needs: [['raw-hare', 1]],
    makes: 'roast-hare',
    yields: 1,
    seconds: 4,
    known: true,
    hint: 'A jointed hare on the spit.',
    stages: ['Searing', 'Roasting'],
    xp: 10,
  },
  {
    id: 'wolf-steak',
    station: 'cooking',
    needs: [['wolf-meat', 1]],
    makes: 'wolf-steak',
    yields: 1,
    seconds: 4.5,
    known: true,
    hint: 'Tough wolf meat, seared hard over the coals.',
    stages: ['Searing', 'Cooking through'],
    xp: 10,
  },
  {
    id: 'venison-steak',
    station: 'cooking',
    needs: [['venison', 1]],
    makes: 'venison-steak',
    yields: 1,
    seconds: 4,
    known: true,
    hint: 'A haunch of venison, over the fire.',
    stages: ['Searing', 'Roasting'],
    xp: 10,
  },
  {
    id: 'roast-boar',
    station: 'cooking',
    needs: [['boar-meat', 1]],
    makes: 'roast-boar',
    yields: 1,
    seconds: 5,
    known: true,
    hint: 'Wild boar, crackling and all.',
    stages: ['Searing', 'Roasting', 'Crisping the crackling'],
    xp: 10,
  },
  {
    id: 'boiled-egg',
    station: 'cooking',
    needs: [['egg', 1]],
    makes: 'boiled-egg',
    yields: 1,
    seconds: 3,
    hint: "Something from Farmer Iran's hens, in a pot of water.",
    stages: ['Boiling'],
    xp: 10,
  },
  {
    id: 'hare-stew',
    station: 'cooking',
    needs: [['raw-hare', 1], ['carrot', 1], ['turnip', 1]],
    makes: 'hare-stew',
    yields: 2,
    seconds: 6,
    hint: 'A hare in the pot, with two roots from the garden.',
    stages: ['Browning the meat', 'Simmering', 'Thickening'],
    xp: 25,
  },
  {
    id: 'hunters-pottage',
    station: 'cooking',
    needs: [['venison', 1], ['cabbage', 1], ['bread', 1]],
    makes: 'hunters-pottage',
    yields: 2,
    seconds: 6,
    hint: 'Venison, a green head from the garden, and a crust to thicken it.',
    stages: ['Browning the meat', 'Simmering', 'Thickening'],
    xp: 25,
  },
];

/** How many slots each station's window has for ingredients. */
export const STATION_SLOTS = 3;

/** Named places to brew or cook: what the window calls them, and a line of flavour. */
export interface StationDef {
  kind: StationKind;
  name: string;
  blurb: string;
}

export const STATIONS: Record<string, StationDef> = {
  'cellar-bench': {
    kind: 'alchemy',
    name: "Old Maud's Brewing Bench",
    blurb: "Godric's grandmother's stillroom bench: a copper pot, a mortar, and shelves of dusty flasks.",
  },
  'home-hearth': { kind: 'cooking', name: 'The Cottage Hearth', blurb: "Mother's black iron pot and the old spit. The fire is low, but it will do." },
  'hut-hearth': { kind: 'cooking', name: "Farmer Iran's Hearth", blurb: 'A smoky little fire, with a pan that smells of a hundred breakfasts.' },
  'tavern-hearth': { kind: 'cooking', name: 'The Tankard Hearth', blurb: 'A great roaring fire, with a spit and a griddle. Godric lets folk use it, so long as they mind the sparks.' },
  'refectory-hearth': { kind: 'cooking', name: "Brother Hob's Kitchen Hearth", blurb: 'Scrubbed iron, hung pans, and a strong smell of leeks.' },
};

type Listener = (recipe: Recipe, batches: number, firstTime: boolean) => void;

class CraftingStore {
  /** Recipes made at least once (the ones known from the start are always known). */
  private made = new Set<string>();
  private listeners = new Set<Listener>();

  reset(): void {
    this.made.clear();
  }

  isKnown(r: Recipe): boolean {
    return !!r.known || this.made.has(r.id);
  }

  hasMade(r: Recipe): boolean {
    return this.made.has(r.id);
  }

  recipesFor(station: StationKind): Recipe[] {
    return RECIPES.filter((r) => r.station === station);
  }

  /** Every item any recipe at this station uses: what the window lets the hero put in. */
  ingredientsFor(station: StationKind): Set<ItemId> {
    return new Set(this.recipesFor(station).flatMap((r) => r.needs.map(([id]) => id)));
  }

  /**
   * The recipe these ingredients make, if any. Ingredients are counted
   * together (two hares in two slots is two hares), and must be exactly what
   * the recipe needs: nothing missing and nothing extra.
   */
  match(station: StationKind, slots: Array<ItemId | undefined>): Recipe | undefined {
    const have = new Map<ItemId, number>();
    for (const id of slots) if (id) have.set(id, (have.get(id) ?? 0) + 1);
    if (have.size === 0) return undefined;
    return this.recipesFor(station).find((r) => {
      if (r.needs.length !== have.size) return false;
      return r.needs.every(([id, n]) => have.get(id) === n);
    });
  }

  /** How many batches the satchel has the ingredients for (and room to take the result). */
  maxBatches(r: Recipe): number {
    let n = Infinity;
    for (const [id, need] of r.needs) n = Math.min(n, Math.floor(Inventory.count(id) / need));
    if (!isFinite(n)) return 0;
    while (n > 0 && !this.fits(r, n)) n--;
    return n;
  }

  /** Whether the results of `batches` would fit once the ingredients are used up. */
  private fits(r: Recipe, batches: number): boolean {
    // A slot freed by the ingredients can take the result, so check after taking them out.
    const before = Inventory.toSave();
    for (const [id, need] of r.needs) Inventory.bag = removeQuietly(Inventory.bag, id, need * batches);
    const ok = Inventory.canAdd(r.makes, r.yields * batches);
    Inventory.bag = before.bag;
    return ok;
  }

  /** Uses up the ingredients and puts what was made in the satchel. Returns false (changing nothing) if it can't. */
  make(r: Recipe, batches: number): boolean {
    if (batches < 1 || this.maxBatches(r) < batches) return false;
    for (const [id, need] of r.needs) Inventory.remove(id, need * batches);
    Inventory.add(r.makes, r.yields * batches);
    const first = !this.made.has(r.id);
    this.made.add(r.id);
    this.listeners.forEach((fn) => fn(r, batches, first));
    return true;
  }

  /** Calls fn whenever something is made. Returns an unsubscribe function. */
  onMade(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  toSave(): { made: string[] } {
    return { made: [...this.made] };
  }

  fromSave(data: { made?: string[] } | undefined): void {
    this.made = new Set((data?.made ?? []).filter((id) => RECIPES.some((r) => r.id === id)));
  }
}

/** A copy of the satchel's slots with `count` of an item taken out, without telling anyone. */
function removeQuietly<T extends { id: ItemId; count: number } | null>(bag: T[], id: ItemId, count: number): T[] {
  const out = bag.map((s) => (s ? { ...s } : s)) as T[];
  let left = count;
  for (let i = out.length - 1; i >= 0 && left > 0; i--) {
    const s = out[i];
    if (!s || s.id !== id) continue;
    const n = Math.min(left, s.count);
    s.count -= n;
    left -= n;
    if (s.count === 0) out[i] = null as T;
  }
  return out;
}

export const Crafting = new CraftingStore();

SaveGame.register('crafting', {
  save: () => Crafting.toSave(),
  load(data) {
    Crafting.reset();
    Crafting.fromSave(data as { made?: string[] } | undefined);
  },
});
