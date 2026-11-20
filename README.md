# Fantasy Iso RPG

A minimal isometric RPG framework built with **Phaser 3 + TypeScript + Vite**.

## Play it

The latest version on `main` is published automatically to
https://radioactiveboy.github.io/Eldermoor-RPG/

## Run it locally

```bash
npm install
npm run dev      # dev server with hot reload at http://localhost:5173
npm run build    # type-check + production build into dist/
```

## Tests

```bash
npm test             # unit tests (Vitest) for the game rules: combat, XP, satchel, crafting, quests, saving
npm run test:watch   # the same, re-running as you edit
npm run test:smoke   # builds, then opens every ?area= in headless Chromium and fails on any page error
npm run sim          # the balance table: 1,000 simulated fights per foe and pack size, hero levels 1-6
```

`npm run sim` (`tools/balance.ts`) plays fights with no screen, using the real rules in `systems/Combat.ts`
and a hero who follows a few rules of thumb with a typical kit for each level (`systems/CombatSim.ts`). It prints
the win rate, rounds to win and health lost for every fight the game sets up. Add `-- --weapons` to compare
the weapons at level 1, `-- --fights 5000` for steadier numbers, or `-- --markdown` for a table to paste.
`tests/unit/balance.test.ts` checks the tuning targets (a lone wolf nearly always won at level 1, two wolves about
3 times in 4, the Wolf Mother's den about 60% at levels 3-4), so a change to `FOES` that moves them fails the tests.

The unit tests live in `tests/unit/` and run in Node, without Phaser, so they cover the pure systems in
`src/systems/`. Dice are scripted rather than random (`scripted(...)` and `face(...)` in `tests/unit/helpers.ts`),
so a test can say "the wolf rolls a 15, then a 1 and a 1 for damage" and check exactly what happens.

The smoke test (`tests/smoke/smoke.mjs`) serves `dist/`, opens each area with `?smoke&area=...` (the `smoke`
switch puts the game on `window.game`, as the dev server always does), presses Enter on the title screen for a
new game, waits until the hero stands in that area, walks a step, and fails on any uncaught error. It needs
Playwright's Chromium (`npx playwright install chromium` once, if you don't already have it). To check just a few
areas against the existing build: `SMOKE_AREAS=market,cave node tests/smoke/smoke.mjs`. It lists failed requests
and console errors as warnings without failing on them.

Every pull request and push runs the type-check, `npm test` and `npm run test:smoke` on GitHub Actions
(`.github/workflows/ci.yml`). Publishing to GitHub Pages is a separate workflow (`deploy.yml`) that runs on `main`.

## Controls

The HUD doesn't list controls; they're under **Controls** in the pause menu.

- **WASD / arrow keys**: move (screen-relative, so "up" goes up the screen)
- **Click / tap**: walk to that spot (A* pathfinding around trees, rocks and water,
  smoothed into straight lines). Clicking a person or thing walks over to it and uses it
- **E** (or **Enter**, or tapping the prompt): do what the prompt over something
  nearby says: talk, go through a door, sit on a bench or stool, sleep in your
  bed, pick crops, shake a tree. Moving or pressing E again gets up from a seat; moving cancels
  picking
- **During a conversation**: click / Space / Enter / E to skip the typing or carry on;
  pick a reply with the mouse, the number keys, or up/down then Enter
- **J** or the **book** button: open the journal (arrow keys or click to turn pages)
- **I** or the **satchel** button: the satchel (inventory). **C**: equipment.
  Tab switches between them; select an item to eat, wear or take it off
- **Trading at a stall**: talk to the stallholder and ask to see their goods. Drag
  things from the stall to your satchel to buy them, or from your satchel to the stall
  to sell them; when there's more than one, a box asks how many (slider, - / +, or the
  arrow keys, then Enter). Or click something and press Buy / Sell. Esc closes
- **In a fight**: the hotbar along the bottom holds your skills. Click one, or press its number
  (1-9, 0, -), or move along with the arrow keys and press Enter; hover or select a skill to see what it
  costs and does. **Space** ends your turn. When a skill needs a target, click the beast (each shows your
  chance to hit) or its button; Esc goes back
- **Shift**: sprint (uses stamina, which refills when you stop sprinting)
- **Mouse wheel**: zoom
- **Hold T**: fast-forward the clock (60x) to watch the day/night cycle. A day lasts 24 real minutes
  (an in-game hour a minute), and the trek along the old road between the Hollow and Adowvale takes
  two hours each way (`TREK_HOURS` in `config.ts`); the question before setting off says when you'd arrive
- **Sleeping and saving**: use your straw bed at home and choose how long to sleep
  (until morning, midday, evening or night; or press 1-4). You wake rested, and the game
  is saved. **Continue** on the title screen, or **Load Last Save** in the pause menu,
  brings you back to that moment. Any bed added to a map (`MapData.beds`) is another save point
- **When the browser won't keep a save** (some private windows block storage, or it's full): waking shows
  a **Not Saved** warning instead of "Game saved", with a **Download Save** button. **Download Save** is also
  in the pause menu once you've slept. **Load from File** on the title screen carries on from a downloaded save
  (it's the same JSON the game keeps in browser storage)
- **Esc** or the **II** button: pause menu (resume, controls, settings, load last save, download save, back to main menu)
- **Settings → Resolution**: native, 75% or 50% of the screen's own resolution (lower is faster on slow machines). **Interface size**: Auto (bigger on large monitors, e.g. 150% at 2560×1440) or 75% to 200%
- **Enter** on the title screen: continue from your save, or start a new game if there isn't one
- Add `?hour=21` to the URL to start at a given hour (handy for testing night)
- Add `?area=market` to start in Adowvale's market square (or `?area=world` outside the cottage, `?area=cave`
  in the wolves' cave, `?area=hut` inside Farmer Iran's hut, `?area=northwoods` in the north woods, `?area=plains` on Adowvale Plains,
  `?area=monastery` outside Saint Elda's monastery, `?area=tavern` in the Crooked Tankard's taproom,
  `?area=cellar` in its cellar, or `?area=smithy` / `?area=bakery` inside Osric's smithy and Hilde's bakery;
  every area with `test: true` in `scenes/game/areas.ts` works)
- **The Crooked Tankard**, Adowvale's inn on the north side of the square: buy a drink across the bar
  from Godric the landlord (drunk there and then), or food and drink to take away. Sit at a table and a
  maid comes over to take your order, fetches it from the bar and brings it back. It's quiet by day and
  busy of an evening, when the regulars come in (play dice with Ada, pay Pell for a song, buy Old Harlan a
  drink and he'll tell you about the door under the hill). Godric lets rooms upstairs for a night, three
  nights or a week; your room's door is the only one along the passage that opens, and its bed is a save
  point until checkout (11:00) on the last morning. He also has rats in his cellar
- **Brewing and cooking**: walk up to a hearth (the cottage, Farmer Iran's hut, the Crooked Tankard, the
  monastery refectory) and press E to **Cook**, or to Old Maud's brewing bench in the Tankard's cellar to
  **Brew**. Drag ingredients from the satchel into the three bowls (or click them, or click a recipe in the
  book to fill them), choose how many, and press Cook / Brew. Stir the pot to hurry a brew along; take food
  off the fire while the bar is in the golden band and it's done to a turn (a little bonus XP). Unknown
  combinations show a "?" and are written into the recipe book once made. Wolves, hares and boar now leave
  meat to cook. Mother's tincture (moonpetal + white willow bark) is brewed at the bench and taken home to her
- Add `?give=moonpetal,willow-bark,raw-hare:3` to the URL on a new game to start with those things in the
  satchel (handy for testing the stations)
- **Hunting**: on the plains, walk up to a deer or a hare and press E (**Hunt**). Sprinting near
  game sends it running, and in a fight it may bolt rather than stand
- **The north woods**: from the sheep track by the wolves' cave, a narrow path climbs north behind the hill and
  off the top of the Hollow into the woods (walk off the end of it; the path at the woods' south edge leads back).
  Thick old forest, a brook with a ford, a ruined watchtower on a rise, fallen trees, bramble thickets and a glade
  where deer graze. Wild cats lie up in the brambles and spring at you if you come close: quick and savage, and
  their claws make you bleed, but a level-1 hero beats one (and takes its striped pelt). After the goblin raid the
  goblins' trail shows: bracken trodden flat all the way north, a burnt-out torch, and a scrap of Mother's quilt on
  the thorns. It's scenery for now, and doesn't move the **Ashes** quest on (try `?area=northwoods&raid=after`)
- **Chance meetings on Adowvale Plains**: now and then, out on the plains, something happens along the Lord's Road.
  Footpads (Rook and Nab) step out of the grass and ask for half your purse: pay, talk your way out (if you've killed
  the Wolf Mother), or fight them. Jory the tinker has stopped to rest and will trade odds and ends. Mags the goatherd
  has lost her goat, Clover: find her in the long grass, press E to **Lead** her, and bring her back. Hal, Lord Morten's
  messenger, sits with a twisted ankle and would be glad of something to eat. At night a wolf pack may be out hunting.
  What happens depends on the hour, and the same thing never happens twice running (see `world/PlainsEvents.ts`)
- Add `?event=footpads` (or `tinker`, `goat`, `courier`, `wolves`) to the URL with `?area=plains` to have that meeting
  happen a few seconds after arriving
- Add `?wolves=3` to the URL to meet a pack of wolves instead of the lone one (handy for
  testing fights against several enemies)
- **Mother's day**: once you've first spoken to her, Mother goes about the cottage by the clock. She's in bed
  from 21:00 till 07:00 and naps 13:30 to 15:00 (talk to her there and she's drowsy), sits at the table for
  breakfast (07:00), dinner (12:00) and supper (18:00), and the rest of the time potters between the hearth,
  the cupboard, the barrels, the window and the chest (see `world/MotherRoutine.ts`)
- **Adowvale's traders' days**: Hilde the baker, Osric the smith and Tamsin the tanner keep a round by the clock
  (`systems/VillageDay.ts`). Their stalls keep market hours, each with its own start; Hilde bakes in her bakery from
  03:30 and goes back for the noon loaves (11:30 to 13:00), Osric lights his forge at 05:30 and goes back to the anvil
  from 11:00 to 14:00, and both work on for a while after the market shuts. All three spend the evening at the
  Crooked Tankard (at their own table by the barrels), then go home to bed. In the square you see them cover their
  stalls and walk to the right door (and say where they're off to); talk to them on the way and they say so too.
  **The smithy and the bakery** are the stone house past the inn (anvil on the sign) and the corner house (a loaf):
  go in to trade with Osric at his anvil or Hilde at her kneading trough while they're there. Their doors are barred
  while their keeper is in bed. Try `?area=smithy&hour=12`, `?area=bakery&hour=5` or `?area=tavern&hour=20`
- **The goblin raid**: give Mother her tincture and you're told to get some sleep, with only the one answer;
  you sleep till dawn. You wake to shouting: outside, goblins (cutters, a spearman and torch-bearing
  firebrands, led by an armoured Goblin Brute with a shield) are trampling the garden and setting the roof
  alight. Choose to **stand and fight**, or **retreat inside**, where they beat the door down. Either way the
  fight is scripted: from the third round (or sooner, if you get the better of the Brute) every blow of theirs
  lands, every one of yours misses, and you can't flee. You come round at 13:00 in the burnt-out cottage, with
  blood on the floor and Mother gone. The farm is ruined, the road travellers have fled, and Farmer Iran is
  huddled in his hut with Pip and Hetty. A new quest, **Ashes**, starts (see `world/GoblinRaid.ts`)
- Add `?raid=night` to start at 20:00 with the tincture in the satchel (talk to Mother to give it to her),
  `?raid=morning` to wake on the morning of the raid, or `?raid=after` to start in the ruins (add `&area=world`
  or `&area=hut` to start outside or in Iran's hut)
- **After the raid**: the ruins of the cottage and the coop smoulder, thick and dark at first and dying down
  over two days; crows come down on the trampled garden and the yard (fewer as the days go by) and take off
  when you come near; and the folk on the plains road talk of the goblins (Jory, Hal and the footpads have
  something to say, and they shout about it as you pass) (see `world/Aftermath.ts`)
- **Weather**: clear skies, cloud, drizzle, rain and the odd thunderstorm, each lasting a few in-game hours and
  following on from the last (rain tends to come after cloud; a storm blows itself out into rain), and on some
  mornings after a dry night, mist lying in the hollows until mid-morning. Rain falls in sheets and splashes,
  rings the lake and the puddles that fill the paths (they dry over a few hours after), cloud greys and darkens
  the light (lanterns come on sooner), and storms bring wind in the trees, lightning and thunder. Indoors you
  hear the rain on the roof and the thunder dulled. The time wheel shows the cloud, rain and mist. The weather
  comes from a seed saved with the game, so the same game always has the same weather (see `systems/Weather.ts`)
- Add `?weather=rain` to the URL to hold the weather (or `clear`, `overcast`, `drizzle`, `storm`, `mist`)
- **Water and fire**: waves run round the lake's shore (rougher in a wind), lamps by the water and the hero's
  lantern shine on it after dark, and a hearth's light dances on the walls of the room

## Project layout

```
src/
  main.ts                 Phaser game config, scene list
  config.ts               Tile size, map size/seed, player speed, zoom limits
  iso/IsoMath.ts          Grid <-> isometric screen conversion, depth sorting
  world/MapData.ts        Terrain + prop types, walkability table
  world/MapGenerator.ts   Seeded placeholder map (the family cottage and its vegetable garden, lake, road, forest,
                          and Old Tobin fishing on the far shore of the lake)
  world/HomeMap.ts        Inside the cottage: walls, furniture, Mother, stools, the door out (and the burnt-out
                          ruin of it after the goblin raid)
  world/MotherRoutine.ts  Mother's day round the cottage: bed, the table at mealtimes, pottering about
  world/GoblinRaid.ts     The goblins' raid: the farm under attack and after, and the scripted morning itself
  world/MarketMap.ts      Adowvale, the village at the end of the road: its market square (well, stalls, houses, the
                          smithy and bakery doors, militia) and the lane north to Lord Morten's toll gate (area id 'market', kept for old saves)
  world/PlainsMap.ts      Adowvale Plains past the toll gate: the biggest map (120x120), open grass, copses, a mere
                          and a pond, the Lord's Road to a crossroads and on east to the monastery, deer, hares
                          and boar, and two travellers
  world/NorthWoodsMap.ts  The north woods beyond the wolves' cave (60x76): forest, a brook and its ford, the ruined
                          watchtower, fallen trees, bramble thickets, a glade, wild cats and game, and after the
                          raid the goblins' trail north (scenery only)
  world/MonasteryMap.ts   The grounds outside Saint Elda's monastery, east of the plains: the wall and its barred
                          gatehouse with the chapel and bell tower showing over it, the Saint's statue, wayside
                          shrines, vegetable beds, beehives, fish ponds with benches, and four of the brothers
  world/BakedLayer.ts     Bakes the ground into textures of at most 2048px, so big maps fit on phones
  world/HutMap.ts         Inside Farmer Iran's hut, where his children Pip and Hetty squabble
  world/WorkshopMaps.ts   Inside Osric's smithy (forge, bellows, anvil, quench tub, tool and iron racks, his slate)
                          and Hilde's bakery (bread oven, loaf racks, kneading trough, the counter)
  world/TavernMap.ts      The Crooked Tankard: the taproom (bar, hearth, tables, stairs, cellar trapdoor), the
                          passage upstairs with four rooms to let, a room, and the cellar with its rats
  world/CaveMap.ts        The wolves' cave in the hill north of the cottage: rock walls, stalactites and
                          stalagmites, a pool, three wolves, the drover's lost ewes, bone piles to search, and
                          a locked door in the back wall (a hint of a quest to come)
  world/Drips.ts          Water dripping from the cave's stalactites
  world/IsoMap.ts         Renders a MapData and answers "can I walk here?" (per tile, and per exact spot)
  world/Collision.ts      Collision outlines: round trunks and boulders, thin fence rails, full tiles
  world/Ambience.ts       Living world: water glints and foam, birds, bats, sparrows, butterflies,
                          fireflies, cloud shadows, chimney smoke, falling leaves; rain, puddles and mist;
                          lamps reflected on the water; the ruins smouldering and crows after the raid
  world/Aftermath.ts      When the raid was (saved), how hard the ruins smoulder and how many crows come after it
  world/FireGlow.ts       A hearth's light dancing on the walls of a room
  art/weather.ts          Rain sheets, splashes, puddles, mist, crows, lamp reflections, firelight on walls
  systems/Pathfinding.ts  8-direction A* on the tile grid
  systems/PlayerStats.ts  Health and stamina (sprinting drains stamina)
  systems/Inventory.ts    Item definitions, the satchel's slots and what's worn
  systems/Shops.ts        The market traders (and Godric at the Tankard): stock, what they buy, prices
  systems/Tavern.ts       The Crooked Tankard's menu and prices, and the room the hero has let (until when)
  systems/VillageDay.ts   Where the market's traders are at each hour: stall, workshop, the Tankard or home
  systems/Crafting.ts     Brewing and cooking: the recipes, the stations, and which recipes have been found
  systems/Loot.ts         Random finds: what searching a pile of bones can turn up, and how likely each is
  systems/Farm.ts         Crops (picked ones regrow) and which trees were shaken today
  systems/SaveGame.ts     Save and load: one save in browser storage, made of a section per system
  systems/TimeOfDay.ts    In-game clock and the lighting colour for each hour
  systems/Weather.ts      The weather: seeded spells of clear, cloud, rain and storm, morning mist, wet ground,
                          the light under cloud and lightning; ?weather=
  systems/Experience.ts   XP and levels: what each level needs, what it gives, XP for quests
  systems/Combat.ts       Fight rules: initiative, attack rolls against armour, damage dice, advantage,
                          conditions (prone, dazed...), fleeing, how beasts choose their moves, and the
                          beasts' stats and traits (FOES)
  systems/CombatSim.ts    Headless fights for tuning FOES: a seeded rng, a typical kit per level, simple hero tactics
  systems/FightTally.ts   The sums for the end-of-fight card: damage each way, blows, XP, spoils
  systems/Abilities.ts    The hero's combat skills: action or bonus action, stamina, cooldowns, levels
  ui/AbilityIcons.ts      The hotbar's skill icons, painted with canvas gradients and glows into textures
  entities/Player.ts      Movement, collision, click-to-move path following
  entities/Npc.ts         People you can talk to, which conversation they have, travellers
                          who wander up and down the road, and the militia on their rounds
  entities/Hen.ts         Farmer Iran's hens: peck, strut about the run, scurry from the hero, roost at night
  entities/Child.ts       Children who chatter to each other in speech bubbles and say hello as you come near
  scenes/InterludeScene.ts A few half-remembered lines in the dark between scenes (beaten in the raid)
  entities/Creature.ts    Wild animals: wander and sniff near their den, start a fight when you come close
  dialogue/               Conversations as data (lines, replies, story actions) and speakers
  systems/Quests.ts       Quest log: quest definitions, progress, diary entries
  art/market.ts           Market stalls, townhouses and the inn, the well, lamp posts, benches, crates, signpost
  art/tavern.ts           The Crooked Tankard inside: bar counter pieces, kegs, bottle shelf, stairs, trapdoor,
                          notice board, laid tables, washstand, sacks and the passage's runner
  art/rats.ts             The cellar rats
  art/goblins3d.ts        The raiding goblins, modelled in 3D: cutters, a spearman, torch-bearing firebrands,
                          and the Goblin Brute in iron with a shield
  art/mother3d.ts         Mother, modelled in 3D, so she can walk about, sit and turn
  art/scorch.ts           Fire damage: wraps any shader (or finished texture) so it comes out charred and holed
  art/ruin.ts             After the raid: burnt walls and furniture, blood and ash on the floor, fires, and burnt
                          copies of the farm's fences, coop and hut
  art/tollgate.ts         Lord Morten's toll gate (shut and open), the palisade, the guards' booth and his banner
  art/monastery.ts        Saint Elda's: the wall, gatehouse, chapel, bell tower, shrines, statue, bean rows,
                          beehive skeps and water lilies
  art/henfarm.ts          Farmer Iran's hut, the hen coop and trough, and the hens and rooster
  art/cave.ts             The cave mouth in the hillside, rock walls, stalactites, stalagmites, columns,
                          boulders, bones, the dead ewes and the locked door
  art/fishing.ts          Old Tobin's rod, float and creel
  art/figure3d.ts         The 3D figure renderer every person is drawn with: rounded solids, turned to 8 directions and
                          lit as pixel art, with idle, walk, sit and work frames
  art/models3d.ts         The villagers' 3D models (traders, militia, toll guards, brothers, tavern folk, Iran and his
                          children, Tobin, the road travellers), registered as 'folk-<id>' by folk.ts
  art/wayfarers3d.ts      The folk met by chance on the plains (and the footpads' fighting frames)
  art/northwoods.ts       The north woods' watchtower, fallen trees, brambles, bracken, leaf litter, ford stones,
                          and the goblins' trodden trail, dropped torch and the scrap of quilt
  art/mother3d.ts         Mother's 3D model
  art/workshops.ts        The smithy's and bakery's furnishings (the forge's coals and the oven's fire flicker), and
                          Osric's hammer stroke and Hilde's kneading as their 'work' frames
  art/portraits.ts        Talking portraits for conversations: shaded faces, hair, clothes, per speaker
  art/gear.ts             How worn gear looks on the hero's sprite (every head, body, feet and hand item): add an entry to dress new items
  tools/gear-preview.html The hero in every piece of gear, all 8 directions (open /tools/gear-preview.html under `npm run dev`)
  art/                    Palette and pixel-art generators: tiles, props, the hero, Mother,
                          furniture and buildings (IsoModel.ts draws 3D-ish iso objects),
                          the garden (farm.ts: soil, crops, fences), painted item icons (items.ts),
                          the beasts (beasts3d.ts, registered by creatures.ts: wolves, deer, hares, boar,
                          rats and the north woods' wild cat) and birds, ripples and smoke (critters.ts)
  audio/Audio.ts          All the game's sound: picks the music by area and hour, plays fight sounds and voice
                          barks, and composes UI blips (and stand-in tunes and sounds if a recording won't load)
  audio/Recordings.ts     Streams and crossfades the recorded music; fetches and plays the fight sounds and barks
  audio/Soundscape.ts     The world's background sounds, footsteps and the bell, all recordings
  public/audio/ambience/  The ambient recordings (MP3) and CREDITS.md with their sources and licences
  public/audio/music/     The recorded music (MP3) and CREDITS.md
  public/audio/sfx/       The fight sounds, cries and voice barks (MP3) and CREDITS.md
  tools/build-ambience.py Cuts, loops and levels the ambient recordings from the originals
  tools/build-sound.py    Does the same for the music, fight sounds and voice barks
  tools/balance.ts        The balance table from the fight simulator (`npm run sim`)
  world/AmbientSounds.ts  Sets the background sounds' levels from the area, the hour, the weather and who's about;
                          times the lightning and thunder
  world/landmarks.ts      Spots in the maps the rest of the game reads (the bar, the cellar rats, the moonpetal, the
                          monastery gate), kept out of the map files so those can download on their own
  settings/Settings.ts    Volume and display settings, saved in the browser
  ui/Display.ts           Draws at the screen's own resolution (sharp on high-density and 1440p/4K screens) and sizes the interface to suit
  ui/Widgets.ts           Shared menu look: panels, buttons, sliders, fonts
  vendor/phaser.js        A slimmer Phaser (what `import Phaser from 'phaser'` gets), built from Phaser's source
  systems/Download.ts     Retries a download that failed, for the parts of the game fetched after the first
  scenes/BootScene.ts     Draws the art behind a loading bar (the title screen's first, the rest while it's up),
                          repaints the hero when gear changes, then opens the main menu
  scenes/MainMenuScene.ts Title screen over the drifting world map
  scenes/PauseScene.ts    Esc menu during play
  scenes/SettingsScene.ts Volume sliders, resolution, interface size and fullscreen, opened from either menu
  scenes/GameScene.ts     The world scene: builds the area, runs the frame, camera, talking, menus. The rest of what
                          happens in the world is in scenes/game/, as functions that take the scene:
  scenes/game/areas.ts    The area registry: each area id, how its map is built (most with `lazy(...)`, fetched on
                          first need), whether ?area= starts there, and what happens on arriving. A new area is one
                          entry here (plus AreaId and AREA_NAMES)
  scenes/game/interactions.ts  What the E prompt can do (talk, door, sit, sleep, pick, shake, hunt) and which one shows
  scenes/game/dialogueActions.ts  Runs a line's `action`: shop:, drink:, order:, road:, rent:, and the named ones,
                          which live with their part of the story:
  scenes/game/medicine.ts Mother's medicine: moonpetal, willow bark, the tincture brewed and given
  scenes/game/hollow.ts   Wil's ewes, Farmer Iran's hens, feed and children, the wolves' cave
  scenes/game/monastery.ts The toll gate, the Wolf Mother, Saint Elda's gate
  scenes/game/tavern.ts   The Crooked Tankard: maids, the bar, rooms, dice, Pell's song, chatter, the cellar rats
  scenes/game/raid.ts     The scene's side of the goblin raid, coming round in the ruins, ?raid=
  scenes/game/market.ts   Arriving in Adowvale, the militia calling the market's hours
  scenes/game/workshops.ts The smithy and the bakery: barred at night, first visits, sparks off the anvil, flour
  scenes/game/combat.ts   Starting fights (and packs), the plains' chance meetings, spoils and what comes after
  scenes/game/sights.ts   Few-second actions, crops, trees, examining, searching, gathering, giving items
  scenes/game/sitting.ts  Seats and the thoughts that come while sitting
  scenes/game/travel.ts   Doors, road exits, locked doors, the trek question, fading to the next area
  scenes/game/sleep.ts    Beds, sleeping, saving and loading
  scenes/game/input.ts    Keys, click-to-walk, pathfinding to a spot, the hover tile
  scenes/DialogueScene.ts Conversation box: talking portrait, typewriter text, voice blips, replies
  scenes/JournalScene.ts  The journal book: tasks, quests, diary, page turning
  scenes/InventoryScene.ts Satchel and equipment tabs: item grid, worn gear, details, eat/wear
  scenes/ShopScene.ts     Trading window: the stall's goods and your satchel, drag to buy and sell, how-many box
  scenes/StationScene.ts  Brewing bench and hearth window: drag ingredients in, recipe book, progress bar, result popup
  scenes/SleepScene.ts    "How long to sleep?" box, opened from a bed
  scenes/CombatScene.ts   Turn-based fights over the world: turn order, skill hotbar and tooltips, dice, combat log
  scenes/UIScene.ts       HUD overlay, separate from the world camera
  ui/StatusBars.ts        Slim health and stamina bars, the hero's level and an XP bar
  ui/TimeWheel.ts         Rotating sun/moon dial showing the time of day, with the weather's cloud, rain and mist
  ui/Minimap.ts           Isometric minimap with player and camera view
  ui/LocationLabel.ts     Current area name (and nearby landmark) under the minimap
  ui/DayNightOverlay.ts   Tints the world by time of day (and weather); lantern, hearth and candle light; lightning
  ui/QuestTracker.ts      HUD reminder of the current quest step
  ui/Toasts.ts            "New quest" banners and the hero's passing thoughts
tests/
  unit/*.test.ts          Vitest tests for src/systems (Combat, Experience, Inventory, Crafting, Quests, SaveGame)
  unit/balance.test.ts    The simulator, the balance targets and the fight tally
  unit/helpers.ts         Scripted dice and a fake localStorage for the tests
  smoke/smoke.mjs         Playwright smoke test: every ?area= loads without errors
.github/workflows/
  ci.yml                  Type-check, unit tests and smoke test on every PR and push
  deploy.yml              Build and publish to GitHub Pages from main
```

## Key ideas

- **Gameplay runs in grid space, rendering is isometric.** Positions are in tile
  units (`gx`, `gy`). Only rendering and pointer input convert to and from screen
  pixels via `IsoMath`. This keeps collision, pathfinding, AI and saves simple.
- **Depth sorting** uses `gx + gy`, so anything lower on screen draws in front.
  Ground tiles are baked into one render texture for performance; trees, rocks
  and characters are individual sprites so they can overlap correctly.
- **Pixel art is generated in code** (`src/art/`) from one shared palette
  (`palette.ts`), so there are no image files to manage. The hero is built from
  simple body parts rotated to face 8 directions, with idle and walk animations
  (`player-idle-<dir>`, `player-walk-<dir>`). Tiles come in several variants and
  the ground is sprinkled with flowers, grass tufts and pebbles. To use
  hand-drawn art instead, load it in `BootScene` under the same texture keys
  (`tile-grass`, `prop-tree`, `player`, ...).
- **Boot draws the art in steps** (`ART_STEPS` in `art/index.ts`). The steps marked `title` (the land,
  trees, the hero, the cottage, the farm, Adowvale, the cave, the hen farm, the river: what the title
  screen's drifting map shows) are drawn first behind a loading bar; the title screen then shows, and
  the rest is drawn a step at a time while it's up. Pressing Begin/Continue before that's done shows
  "Drawing the rest of the world…" and finishes it first, and any other scene that starts also finishes
  it first, so nothing past the title screen ever sees missing art. A new step goes near the end (each
  step may use art from the steps above it); mark it `title` only if the title screen's map shows it.
  Steps past the title screen can be `load: () => import('./x').then((m) => m.generateX)` instead of
  `draw`: their code is then a file of its own, downloaded while the title art is drawn. That only
  splits it off if nothing else imports the painter (sizes the scenes need go in `art/sizes.ts`).
- **The download comes in pieces** (see `vite.config.ts`). Phaser is a file of its own (`phaser-*.js`),
  so an update to the game doesn't make returning players download it again, and it's built from
  Phaser's source without the parts the game doesn't use (physics, tilemaps, video, meshes...):
  `src/vendor/phaser.js` lists what's in, and is where to add a Phaser feature back if one turns up
  missing (say `this.add.tileSprite` is undefined). Most area maps are separate files too, fetched
  the first time they're needed: the title screen fetches the area the game opens in, each area fetches
  the maps behind its doors a moment after arriving, and if one still isn't here on arrival the screen
  stays dark with "On the way…" (or "Waiting for the connection…" if it keeps failing) until it is.
  Import a map file only from `scenes/game/areas.ts`, through `lazy(...)`; anything else that needs a
  spot from a map reads it from `world/landmarks.ts`. `npm run build` lists every file and its size.
- **Measuring boot:** the game sets performance marks you can read in the browser console with
  `performance.getEntriesByName('eldermoor:menu')` (also `eldermoor:boot`, `eldermoor:title-art`,
  `eldermoor:art` when all the art is drawn, and `eldermoor:area` when the first area is up).
  Headless Chromium logs "GPU stall due to ReadPixels" for any WebGL page (it reads each frame back
  for its software compositor), so that warning in automated runs isn't from the game.
- **Music is recorded.** Each map names its track (`MapData.music`: `menu`, `world`, `home`, `market`, `tavern`,
  `monastery`, `cave`, `battle`, `raid`, `ruin`) and `MUSIC_FILES` in `audio/Recordings.ts` says which recording
  plays for it. Some change with the hour: out of doors and at home a quieter piece plays from 20:00 to 05:30, and
  the tavern strikes up a fiddle reel from 18:00. The music is Kevin MacLeod's (CC BY 4.0): Celtic and folk lute
  and fiddle tunes for the Hollow, home, the market and the tavern, a Gregorian chant at the monastery, darker
  pieces for the caves, the raid and the ruins, and a heroic one for fights (see `public/audio/music/CREDITS.md`).
  Each track is streamed from its MP3 the first time it's wanted (about 1 to 2 MB each), looped, and crossfaded
  into the next; a change of hour fades over six seconds. If a file won't load, the tune composed in code for that
  track in `audio/Audio.ts` (`TRACKS`: tempo, chords, arpeggio and synth voices) plays instead. To add a track,
  add an MP3 to `public/audio/music/` (and to `tools/build-sound.py`), a name to `TrackName` with a stand-in
  in `TRACKS`, and an entry in `MUSIC_FILES`.
- **Fights and conversations have recorded sounds.** Blows land with a punch or, on a critical, a heavier one
  with a crack of bone; misses whistle past; a blow turned by the hero's shield (or while on guard) clangs;
  wolves snarl, the boar squeals, goblins yell and cackle and the Brute bellows; the hero and the footpads cry
  out when hurt; whoever drops gives a last cry and falls with a thud; and gaining a level, winning and losing
  each have an orchestral flourish. When someone starts to speak you hear a short bark under the typing blips:
  a friendly "heh", a laugh (if their line has one in it) or a grunt from gruff men, in one of two men's or two
  women's voices chosen and pitched from the speaker's blip voice, so each villager keeps their own. The
  recordings are in `public/audio/sfx/` (CC BY, see `CREDITS.md` there); a fight's sounds are
  fetched as its music starts (about 250 KB), the barks and stingers (about 130 KB) when sound is first switched on. If a
  sound isn't loaded, the synthesised one plays instead. All of it goes through the Effects volume slider, and
  the music through the Music one.
- **The world has its own sounds, from real recordings.** `world/AmbientSounds.ts` gives each
  area a profile in `PLACES` (out in the open, how windy, how wild, a hearth, a
  cave, the monastery bell, a taproom) and every fraction of a second works out
  an `AmbientMix` from it: birds by day with a dawn chorus, crickets, frogs, owls
  and far-off wolves by night, waves when near the shore, the market's chatter
  while it's open, the smith's hammer by the smithy, the taproom filling up with
  its regulars, bees by the hives, the bell at the offices. `audio/Soundscape.ts`
  plays it: steady sounds are seamless loops of recordings glided to their level,
  the rest (owls, wolves, clinking mugs, the anvil) are recorded one-offs
  scheduled now and then. The recordings are in `public/audio/ambience/`, all
  CC0 or CC BY (see `CREDITS.md` there), and are fetched only when a place first
  needs them. The footsteps and the monastery bell are recordings too. They go through their own Ambience volume slider, duck
  under a fight and fall silent behind the pause menu. Footsteps follow what's
  underfoot (grass, dirt, sand, soil, cave gravel, flagstones, floorboards).
- **The weather is worked out, not stored.** `systems/Weather.ts` makes a run of spells (clear, overcast,
  drizzle, rain, storm, each a few hours long, the next picked by what tends to follow the last) from a seed,
  and `Weather.at(hours)` gives the sky at any moment as numbers (cloud, rain, wind, storm, mist), easing from one
  spell into the next. Only the seed is saved, so sleeping through a storm just means waking after it. Each part of
  the game reads the numbers: `Ambience` draws the rain, puddles (by `Weather.wetness`) and mist, the HUD's overlay
  greys the light (`weatherLight`), and `AmbientSounds` mixes rain, a downpour, a gale and rain on the roof
  (indoors, louder in a thatched cottage than a busy taproom; see `ROOFS`), and times the lightning and thunder.
  The weather's recordings (about 250 KB a loop) are only fetched once it rains.
- **Maps** are anything that produces a `MapData`. The generator is a stand-in;
  hand-made maps (e.g. from the Tiled editor) can plug in later. A map can have
  furniture and buildings (`objects`), back walls for rooms, `doors` that lead
  to another area, light sources, NPCs, seats and crops. Using a door (E by it)
  swaps the area. A door marked `auto` is the end of a road at the map's edge:
  walking onto it goes on to the next area (the road west from the cottage
  leads to Adowvale, and the toll gate north of Adowvale to the plains). A map
  can also name `landmarks` for the location label, and `musings`: patches of
  ground where the hero has a thought, like the plains' road ends.
- **The toll gate.** Lord Morten's two guards at the north edge of Adowvale want
  100 coins (`TOLL` in `world/MarketMap.ts`) before they'll open the gate. Paying
  (the `pay-toll` dialogue action) sets the `paid-toll` quest-log flag, which is
  saved, and swings the gate open (`IsoMap.reshapeObject`); from then on
  Adowvale is always built with it open.
- **Interactions** are built in `GameScene.interactionsNear`: each nearby NPC,
  door, seat, ripe crop or tree offers an `Interaction` (a label, a range and
  what to do). The nearest one in range gets the HUD's "E" prompt. Slower
  actions (picking, shaking) run as a `Channel` with a progress bar; moving
  cancels them. To add a new kind of thing to use, add another case there.
- **Items** are defined in `ITEMS` (`systems/Inventory.ts`) with an icon from
  `art/items.ts` (painted with canvas gradients at 128px: add a painter to
  `PAINTERS` and a line to `ICONS`, and size it on screen with `itemScale`).
  `Inventory.add(id, n)` puts them in the satchel and the HUD
  shows "+n Name" over the hero. An item's `value` is its price at a stall.
- **Trading.** Coins are kept in `Inventory.coins`. Each trader in `SHOPS`
  (`systems/Shops.ts`) has starting stock, the kinds of thing they'll buy, and
  what fraction of an item's value they pay (Tamsin pays extra for wolf pelts).
  What you sell goes onto their stall. A conversation opens a stall with the
  `shop:<id>` action.
- **Conversations and quests are data.** A conversation is a set of nodes in
  `src/dialogue/`; replies point at the next node, and `action` names (like
  `start-medicine-quest`) are carried out in `GameScene.runDialogueAction`.
  Quests are listed in `QUESTS` in `systems/Quests.ts`; their steps appear one
  at a time in the HUD tracker and the journal.

- **Combat is turn-based, like a tabletop game.** When a beast notices you
  (`entities/Creature.ts`), it and any of its pack nearby attack, and
  `CombatScene` takes over. Everyone rolls initiative (d20 + quickness) and acts
  in that order, shown along the top of the screen. An attack rolls d20 + to-hit
  against the target's armour class; a hit rolls damage dice, a natural 20 is a
  critical hit (double dice) and a natural 1 always misses. Some rolls are made
  with **advantage** (two d20, keep the higher) or **disadvantage** (keep the
  lower). Your armour is 10 + the Defence of what you wear; your to-hit and
  damage come from your weapon's Attack (fists roll d4; each weapon has its own
  damage die, a d6 unless it says otherwise).

  Some weapons fight their own way (`WeaponEffect` in `systems/Combat.ts`; each
  weapon's die and numbers are on its item in `systems/Inventory.ts`):

  | Weapon | Where | Damage | Its way |
  | --- | --- | --- | --- |
  | Ash Spear | Osric the smith | d8 + 3 | +1 to hit a foe that hasn't attacked yet (set against its charge) |
  | Woodman's Hatchet | Osric the smith | d6 + 3 | 35% of hits leave the foe bleeding, 2 a turn for 2 turns |
  | Blackthorn Cudgel | Osric, Jory the tinker | d6 + 2 | 30% of hits daze the foe (disadvantage on its next attacks) |
  | Leather Sling | Tamsin the tanner, Jory | d4 + 2 | Ranged: a free shot before initiative, as the foes close in |

  Each turn you get one **Action** (green circle) and one **Bonus action**
  (orange triangle), spent in either order from the hotbar, then End turn.
  Skills can cost stamina, have a cooldown in turns, need a weapon in hand, or be
  learned at a later level (`ABILITIES` in `systems/Abilities.ts`):

  | Skill | Cost | What it does |
  | --- | --- | --- |
  | Strike | Action | A plain attack |
  | Heavy Blow | Action, 30 stamina | -2 to hit, damage dice rolled twice |
  | Staggering Blow | Action, 15 stamina, 2-turn cooldown | On a hit the foe is Dazed: its attacks roll with disadvantage |
  | Sweeping Blow | Action, 20 stamina, 3-turn cooldown, level 2, needs a weapon | Attacks every foe at -2, half damage |
  | Brace | Action | +4 armour until your next turn, +20 stamina |
  | Eat | Action | Eat something from your satchel |
  | Flee | Action | d20 + quickness against 10, +2 per extra foe |
  | Shove | Bonus, 10 stamina, 2-turn cooldown | Contest to knock a foe Prone: attacks on it roll with advantage, and it spends its next turn getting up |
  | Mark Prey | Bonus, 10 stamina, 4-turn cooldown, level 3 | +2 to hit and +1d4 damage against that foe for 3 of its turns |
  | Second Wind | Bonus, once a fight | Heal 1d8 + your level |
  | Ready Weapon | Bonus | Take up a weapon from your satchel |

  Fighters can carry **conditions** (`STATUSES` in `systems/Combat.ts`), shown
  as tags on the turn-order cards: Guarded, Prone, Dazed, Marked, Bleeding and
  Rallied. Beasts have **traits** (`FoeTrait`): wolves try to drag you down
  (save with d20 + quickness or you're Prone, and getting up costs your bonus
  action), cellar rats' bites bleed, a boar's first charge hits harder and it's
  hard to shove, and the Wolf Mother howls to rally her pack (+2 to hit). Wolves
  also gang up (+2 to hit in a pack) and may bolt when badly hurt. Lose and you
  wake up at home. The clock stops during a fight.

  Blows land with weight: the damage pops up over the one struck, who blinks
  white then red and rocks back, and a critical hit freezes the fight for a
  heartbeat with a pale flash. The last few lines of the log sit above the
  hotbar; **L** (or the Full log tab) opens the whole fight's log, which scrolls
  with the wheel, a drag or Page Up / Down. A won fight ends with a card: rounds,
  damage dealt and taken, blows landed, experience, any level gained, and what
  was taken from the fallen (`systems/FightTally.ts` keeps the sums).

  To add a skill: an id and entry in `ABILITIES` (cost, stamina, cooldown, level,
  the numbers for its tooltip), a painter in `ui/AbilityIcons.ts`, and what it
  does in `CombatScene.useAbility`. New beasts go in `FOES` (`systems/Combat.ts`)
  with art in `art/` and a spawn in the map's `creatures` list. How each behaves
  in the wild is in `WAYS` (`entities/Creature.ts`): wolves, boar and wild cats attack when
  you come close; deer and hares are shy game you hunt yourself, which may bolt
  (`skittish`). What each leaves behind is `SPOILS` in `GameScene` (venison and a
  hide from a deer, a hare's pelt, a boar's tusks). Spawns marked `respawns` (the
  plains' and the north woods' game) are back every visit.

- **Experience and levels.** The hero earns XP for slaying beasts (each beast
  in `FOES` has an `xp` value; a grey wolf is 40), for each step of a quest (20),
  for finishing one (each quest in `QUESTS` has its own `xp`), and for finding a
  new area (25). Level 2 takes 100 XP, level 3 250, level 4 450, and so on up to
  level 20 (`xpForLevel` in `systems/Experience.ts`). Each level adds 10 maximum
  health (and gives it straight back), every other level adds +1 to hit, and every
  third level +1 damage. The level and a thin gold XP bar sit under the health and
  stamina bars; "+40 XP" rises from the hero, and a banner and fanfare announce a
  level-up. The Equipment tab (C) shows your level and how far to the next one.
  To award XP for something new, call `Experience.gain(amount, reason)`.

## Good next steps

The locked door at the back of the wolves' cave: trying it sets the
`found-cave-door` flag and writes in the diary, and Old Tobin the fisherman
then has a story about men digging in the hill long ago. Nothing opens it yet.
Inside Saint Elda's monastery, where the travellers say moonpetal grows (the
`heard-of-monastery` flag is set once one tells you). The grounds outside are
built (`world/MonasteryMap.ts`); the gatehouse is shut, and Brother Wystan the
porter (`dialogue/monastery.ts`) is the one to change when the way in is written.
The village herbalist (the next step of "Medicine for Mother"; Hilde the baker
mentions Old Maud), more villagers and buildings to go into,
more beasts, weapon skills for the new weapons, a reward for the wolf pelt, cooking with the garden's
crops, save/load.
