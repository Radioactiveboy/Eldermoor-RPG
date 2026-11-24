/**
 * The balance table: 1,000 fights of every match-up met in the game, at each
 * hero level 1-6, with the kit in KIT_BY_LEVEL and the hero's rules of thumb
 * in systems/CombatSim.ts. Run with `npm run sim`; add `-- --fights 5000` for
 * steadier numbers, `-- --weapons` for each weapon at level 1, or
 * `-- --markdown` for a table to paste into a pull request, `-- --brute` for
 * the Brute at the door of the brood hall, later on and with companions, or
 * `-- --beacon` for Corwin Haske's band in the beacon on Corbie Tor.
 */
import type { FoeKind } from '../src/systems/Combat';
import { KIT_BY_LEVEL, LATE_KIT, simulate } from '../src/systems/CombatSim';
import { ItemId, itemDef } from '../src/systems/Inventory';

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const fights = Number(args[args.indexOf('--fights') + 1]) || 1000;
const markdown = flag('markdown');
const LEVELS = [1, 2, 3, 4, 5, 6];

interface Row { label: string; kind: FoeKind; count?: number; escort?: Partial<Record<FoeKind, number>> }
/** The fights the game actually puts the hero in (and where). */
const ROWS: Row[] = [
  { label: 'Grey Wolf (by the cottage)', kind: 'wolf' },
  { label: '2 wolves (the den track, the road at dusk)', kind: 'wolf', count: 2 },
  { label: '3 wolves (the cave, the road at night)', kind: 'wolf', count: 3 },
  { label: 'Wolf Mother + 1 wolf (her den)', kind: 'wolfmother', escort: { wolf: 1 } },
  { label: 'Wolf Mother alone', kind: 'wolfmother' },
  { label: 'Wild Boar', kind: 'boar' },
  { label: 'Wild Cat (the north woods)', kind: 'wildcat' },
  { label: 'Red Deer', kind: 'deer' },
  { label: 'Brown Hare', kind: 'hare' },
  { label: 'Rook and Nab (footpad + cutpurse)', kind: 'footpad', escort: { cutpurse: 1 } },
  { label: 'Footpad alone', kind: 'footpad' },
  { label: '3 cellar rats', kind: 'rat', count: 3 },
  { label: '6 cellar rats (the whole cellar)', kind: 'rat', count: 6 },
  { label: 'Goblin Cutter (the raid is scripted)', kind: 'goblin' },
  { label: 'The goblin camp on the Greyfells (4)', kind: 'goblin', count: 2, escort: { goblintorch: 1, goblinspear: 1 } },
];

const pct = (x: number) => `${Math.round(x * 100)}%`;
const cell = (s: ReturnType<typeof simulate>) => `${pct(s.winRate)} · ${s.rounds.toFixed(1)}r · -${pct(s.hurt)}`;

console.log(`Win rate · rounds to win · share of health lost (when won), over ${fights} fights each.\n`);
if (markdown) {
  console.log(`| Fight | ${LEVELS.map((l) => `L${l}`).join(' | ')} |`);
  console.log(`| --- | ${LEVELS.map(() => '---').join(' | ')} |`);
} else {
  console.log(['Fight'.padEnd(44), ...LEVELS.map((l) => `L${l}`.padEnd(20))].join(''));
}
for (const row of ROWS) {
  const cells = LEVELS.map((level) => cell(simulate(level, row.kind, row.count ?? 1, { fights, escort: row.escort })));
  console.log(markdown ? `| ${row.label} | ${cells.join(' | ')} |` : [row.label.padEnd(44), ...cells.map((c) => c.padEnd(20))].join(''));
}

console.log('\nKit by level:');
for (const level of LEVELS) console.log(`  L${level}: ${KIT_BY_LEVEL[level].worn.map((id) => itemDef(id).name).join(', ')}`);

if (flag('weapons')) {
  console.log('\nEach weapon at level 1 (straw hat, tunic, boots): lone wolf, 2 wolves, boar.\n');
  const weapons: Array<ItemId | undefined> = [undefined, 'walking-staff', 'hunting-knife', 'short-sword', 'spear', 'hatchet', 'sling', 'cudgel'];
  for (const w of weapons) {
    const kit = { worn: ['straw-hat', 'tunic', 'boots', ...(w ? [w] : [])] as ItemId[], food: KIT_BY_LEVEL[1].food };
    const cells = ([['wolf', 1], ['wolf', 2], ['boar', 1]] as const).map(([k, n]) => cell(simulate(1, k, n, { fights, kit })).padEnd(20));
    console.log([(w ? itemDef(w).name : 'Fists').padEnd(20), ...cells].join(''));
  }
}


if (flag('brute')) {
  // The Brute and the two at his side (see world/BroodHallMap.ts), in the best kit there is.
  console.log('\nThe Brute in the brood hall (+ a cutter and a spearman), best kit: alone, with Sigrun, with Sigrun and Wat.\n');
  const parties = [[], ['sigrun'], ['sigrun', 'wat']] as const;
  for (const level of [8, 9, 10, 11, 12, 13]) {
    const cells = parties.map((allies) =>
      cell(simulate(level, 'goblinbrute', 1, { fights, kit: LATE_KIT, escort: { goblin: 1, goblinspear: 1 }, allies: [...allies] })).padEnd(20),
    );
    console.log([`L${level}`.padEnd(8), ...cells].join(''));
  }
}

if (flag('beacon')) {
  // Corwin Haske and his band in the beacon on Corbie Tor (see world/BeaconMap.ts), all four at once, in the best kit there is.
  console.log('\nCorwin Haske\'s band in the beacon (+ Garth, Teg and Linnet), best kit: alone, with Sigrun, with Sigrun and Wat.\n');
  const parties = [[], ['sigrun'], ['sigrun', 'wat']] as const;
  for (const level of [9, 10, 11, 12, 13]) {
    const cells = parties.map((allies) =>
      cell(simulate(level, 'brigandcaptain', 1, { fights, kit: LATE_KIT, escort: { brigandbrute: 1, brigandcutter: 1, brigandarcher: 1 }, allies: [...allies] })).padEnd(20),
    );
    console.log([`L${level}`.padEnd(8), ...cells].join(''));
  }
}
