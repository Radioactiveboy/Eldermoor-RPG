# Eldermoor

An isometric fantasy RPG built with **Phaser 3 + TypeScript + Vite**. Arthus sets out from the cottage in
Adowvale Hollow to find medicine for his sick mother, and the story runs on from there: Adowvale's market and
inn, the plains and the Wolf Mother, Saint Elda's monastery, and the goblins who come out of the north woods.

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
npm run atlas        # re-surveys the maps for the world map's drawing (run it after changing a map)
npm run sim          # the balance table: 1,000 simulated fights per foe and pack size, hero levels 1-6
```

`npm run sim` (`tools/balance.ts`) plays fights with no screen, using the real rules in `systems/Combat.ts`
and a hero who follows a few rules of thumb with a typical kit for each level (`systems/CombatSim.ts`). It prints
the win rate, rounds to win and health lost for every fight the game sets up. Add `-- --weapons` to compare
the weapons at level 1, `-- --fights 5000` for steadier numbers, `-- --markdown` for a table to paste, or `-- --brute`
and `-- --beacon` for the brood hall's Brute and Corwin Haske's band, later on and with companions.
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
and console errors as warnings without failing on them. After the areas it opens `?debug` and checks the debug panel
works (switches, a teleport, a flag, coins); `SMOKE_DEBUG=0` skips that.

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
  pick a reply with the mouse, the number keys, or up/down then Enter. Replies are listed inside the box, under what
  was said, and the box grows to fit them (six rows at most). A long list keeps what's new up front and
  folds the everyday questions under **Ask about…** (Esc goes back); one still too long scrolls (mouse wheel, the
  ▲/▼ tabs, or up/down). Questions already asked are dimmed with a tick
- **J** or the **book** button: open the journal (arrow keys or click to turn pages): tasks, quests, the diary and
  the map. Every quest step and big moment writes a diary entry, headed with the day and hour it was written
- **M**, or the journal's **Map** tab: the world map, an old hand-inked map on parchment of the places
  you've been (their woods, water, roads and buildings), the country between them, the roads that join
  them, your own mark and the next quest step's. M, Esc or a click closes it
- **Quest markers**: a gold pointer bobs over the person or place the current quest step needs, or, when
  that's out of sight, an arrow at the screen's edge points the way (with how many tiles off it is). The
  minimap shows it too. In another area, it points at the door or road that leads there, and the quest
  tracker says which place it's in. Switch them off (and the minimap) in **Settings**
- **P**, or a companion's card under the health bars: who travels with you (see Companions below), with
  their health, and a button to send each one home
- **I**, **C** or the **satchel** button: the satchel and equipment, side by side. Arthus stands in the middle
  with what he wears in ten slots around him (head, neck, cloak, body; hands, ring, trinket, feet; main and off
  hand beneath), his health, armour, aim and damage under that, and the satchel's grid beside it. Hover over
  anything for a tooltip (what it does, and how gear compares with what's worn); click or tap to pin it with
  Eat / Wear / Take off; double-click or tap twice to do that at once. Drag things around the satchel, onto
  Arthus to wear them or off him to take them off. Tabs over the satchel (All, Food, Gear, Materials, Quest)
  pick out one kind of thing and fade the rest; **Sort** by Type, Value or Name tidies it. On a narrow screen
  (a phone held upright) the satchel and equipment go under two tabs, and Tab switches between them
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
- **Hunger and rest** (off unless you choose them: asked when a new game starts, and **Settings → Hunger & rest**
  any time): two thin bars under health and stamina. Hunger and tiredness grow with the hours (treks and fast-forward
  count); meals fill you up and sleep restores rest. Hungry, health stops mending and stamina refills at half speed;
  weary, stamina only refills to 60%
- **Settings → Resolution**: native, 75% or 50% of the screen's own resolution (lower is faster on slow machines). **Interface size**: Auto (bigger on large monitors, e.g. 150% at 2560×1440) or 75% to 200%
- **Enter** on the title screen: continue from your save, or start a new game if there isn't one
- Add `?debug` to the URL for the **debug panel** (bottom left; **`** (backquote) or its title folds it away). It
  gathers every URL switch (see **URL switches** below): pick them and **Start a new game
  with these** writes them into the address and starts one (on the title screen, begin a new journey to use them).
  Under **Now**: teleport to any area, set the hour, hold the weather, set or clear a story flag (the flags that
  are set show as chips; click one to clear it), add coins or XP, heal, and **Kill all in fight** (in the raid's
  fight, that goes straight on to the blackout and the ruins). A line along the top shows where you are, the day
  and hour, the weather, health, level and coins. Keys typed in the panel don't reach the game (see
  `scenes/DebugScene.ts`)
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
  meat to cook. Mother's tincture (moonpetal + white willow bark) is brewed at the bench and taken home to her.
  The recipe book turns its pages (‹ ›) once a station has more recipes than fit on one
- **More brews at Old Maud's bench**: the **Healing Draught** (comfrey + yarrow, +40 health), **Nettle Tonic**
  (2 nettles + an apple, +70 stamina), **Wolfsbane Oil** (wolfsbane + a pinecone for its resin: +1d6 damage against
  wolves and the Wolf Mother for the rest of a fight) and the **Stout Draught** (sage + nettle: +2 armour for the rest
  of a fight). In a fight, use them with **Eat** like food; an oil can only be used in a fight. The healing draught
  is in the book from the start, the rest are found by trying (the book gives a clue)
- **Wild herbs**: yarrow, comfrey, nettles and wolfsbane grow on Adowvale Plains (by the roads, the water, the copses
  and up by the Wolf Mother's knoll), and sage and comfrey in the cloister beds at Saint Elda's (once Brother Anselm
  has given leave), and wolfsbane, nettles, comfrey and yarrow in the north woods (by the watchtower, the fallen oak,
  the ford and the glade). Walk up and press E to pick them; each patch grows back after a day and a half
- **Growing your own**: ask Farmer Iran about the weedy patch by his hut and he lends it to you (eight tiles of his
  late mother's herb bed), with his old spade, a watering can and two twists of carrot seed. Hilde sells carrot, turnip
  and cabbage seed at her stall. Walk up to a tile and press E to **Dig** it, then **Sow** it (a box asks which seed
  when you carry more than one kind), then **Water** it. Seed only grows while the soil is damp: a watering keeps it
  damp for about a day, and so does a shower of rain (drizzle or heavier), even while you're away. Carrots and turnips
  want two days of damp soil, cabbages three. Press E on a growing tile to see how it's coming on, and pick it when
  it's ripe (3 carrots or turnips, 2 cabbages); the ground stays dug, ready to sow again
- **Fishing**: buy Old Tobin's spare rod (6 coppers) on the far shore of the lake. With it in the satchel, stand at
  the edge of the lake, the mere, the reed pond or the willow pool on the plains, or the brothers' fish ponds outside
  Saint Elda's, and press E to **Fish**. The window shows the water side-on, under a sky that follows the hour. Hold
  Space, E or a tap to swing the rod back and let go to cast; land on the rings of a rising fish and something bites
  twice as soon. Watch its shadow come in and nose at the bait (a twitch is only a nibble), and strike when the float
  goes right under. Then play it: hold to reel in, and let go when the water boils and it runs, or the line snaps;
  leave the line slack too long and it shakes the hook. Landed, it leaps out onto a catch card with its size. What bites depends on the water and the hour: perch and roach by
  day, pike at dawn and dusk, eels at night, tench in the mere, trout in the cold willow pool, carp in the brothers'
  ponds, barbel and grayling in the river Wend off Adowvale Jetty (and roach, perch, pike and eels there too), and
  now and then Tobin's old boot. Every fish cooks at a hearth. Tobin will tell you where they're biting
- **Hunting**: on the plains, walk up to a deer or a hare and press E (**Hunt**). Sprinting near
  game sends it running, and in a fight it may bolt rather than stand
- **The north woods**: from the sheep track by the wolves' cave, a narrow path climbs north behind the hill and
  off the top of the Hollow into the woods (walk off the end of it; the path at the woods' south edge leads back).
  Thick old forest, a brook with a ford, a ruined watchtower on a rise, fallen trees, bramble thickets and a glade
  where deer graze. Wild cats lie up in the brambles and spring at you if you come close: quick and savage, and
  their claws make you bleed, but a level-1 hero beats one (and takes its striped pelt). After the goblin raid the
  goblins' trail shows: bracken trodden flat all the way north, a burnt-out torch, and a scrap of Mother's quilt on
  the thorns. It's scenery for now, and doesn't move the **Ashes** quest on (try `?area=northwoods&raid=after`)
- **The old watchtower**: in the north woods, climb in over the rubble in its doorway (E). The top fell in long ago,
  so it's open to the sky (and the rain); the stair breaks off five steps up. The last watch left their things: a
  table with their logbook on it (read it), rusted spears, their fire ring, tally marks on the wall, and their chest,
  which can be searched once for something worth having (a spear, an iron cap, a buckler or old pennies). Two rats
  live in the heap of fallen stone
- **The beacon on Corbie Tor**: up the north road onto the upland, a sheep path turns off east past a waymark cairn
  to a tor in the far north-east of the plains, where the old signal beacon stands: a great round stone tower like
  a lighthouse, battlements and an iron brazier on top, heather and grey boulders round it, the warden's woodpile
  and the shell of his hut. Smoke rises from the top while anyone keeps a fire inside. Once Mother is home and
  buried, **Headman Hale** asks you to go up and see whether it can be opened again (and not to light it): the
  side quest **The Beacon on Corbie Tor**. Inside, the hall is held by brigands, modelled in HD like the companions:
  Corwin Haske, who kept the beacon for twenty years until Lord Morten stood the watch down (and knew your father),
  Big Garth with his maul, masked Teg with two hatchets, and Linnet on the stair with her longbow. Pay them to go
  (80 coins, or 60 if you haggle), talk Corwin into keeping the tower again for the Headman's wage and a pardon (on
  your word if Adowvale likes you, or with 20 coins on account), or fight all four at once. Then climb the stair to
  the roof, with the painted sky all round, look over the brazier, and report back to the Headman. Try
  `?area=beacon` or `?area=beacon-top`; `npm run sim -- --beacon` prints how the fight goes
- **Chance meetings on Adowvale Plains**: now and then, out on the plains, something happens along the Lord's Road.
  Footpads (Rook and Nab) step out of the grass and ask for half your purse: pay, talk your way out (if you've killed
  the Wolf Mother), or fight them. Jory the tinker has stopped to rest and will trade odds and ends. Mags the goatherd
  has lost her goat, Clover: find her in the long grass, press E to **Lead** her, and bring her back. Hal, Lord Morten's
  messenger, sits with a twisted ankle and would be glad of something to eat. At night a wolf pack may be out hunting.
  What happens depends on the hour, and the same thing never happens twice running (see `world/PlainsEvents.ts`)
- **Your name in the world**: Adowvale, the brothers of Saint Elda's and the village militia each keep a standing
  with you, from Distrusted through A stranger, Known and Liked to Honoured (`systems/Reputation.ts`, saved with the
  game). Quests done for folk raise it (Iran's feed, Wil's ewes, Godric's rats, the Wolf Mother), and so does how you
  handle the plains' meetings: finding Clover or feeding Hal pleases the village; beating the footpads or facing them
  down pleases the militia, and paying them off does not. "+5 Adowvale" rises over the hero as it moves, and a banner
  shows a new level. The world remembers each meeting too: Rook greets you by how your last run-in ended, the militia
  and the toll guards mention it, and Godric's news at the Tankard has it all (Mags, Hal, the footpads' black eyes).
  Liked by the militia, they greet you by name; liked by the brothers, Brother Wystan says the Prior asks after you
- **Prices that move**: each morning the stalls restock (their own goods topped back up a third of the way, what
  they bought from you sold on), and prices drift a little each day. Goods running short cost more and an
  overstocked stall charges less and pays less for more of the same. Adowvale's traders (Hilde, Osric, Tamsin,
  Godric's take-away) give better prices to someone the village likes, and worse to one it distrusts; Jory on the
  road cares for nobody's opinion. The trading window says when something is dear or cheap today, and your standing.
  However the prices move, nothing can be bought for less than any trader pays for it
- **The militia's bounties**: the notice board by the trough in the market square (**Read the notices**) opens close
  up, with the day's notices pinned to it on parchment: click or tap one (or ←/→, 1-4) to read it along the bottom,
  then take it down or claim its reward (Enter). Three of the four notices are up each morning: rats back in the Tankard's cellar (4 rats, 12 coins), boar in the crofts on the
  plains (2, 30 coins), the footpads on the Lord's Road (both, 40 coins) and wolves on the plains by night (3, 35
  coins). Take one and it's a quest; kill what it asks for (the HUD counts them) and come back to the board to be
  paid in coins and in the militia's and the village's good opinion. Each can be done again, one claim a day. With
  the rat bounty out, new rats are in the cellar; with the footpads' or the wolves' out, those meetings come more often
  on the plains (`systems/Bounties.ts`)
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
- **The garrison lane**: a dirt path runs south out of the square to the militia garrison, a squat stone guardhouse
  where Sergeant Brannock keeps his table, and next to it, behind a garden wall, the Headman's house. Steps inside
  the garrison (and a hatch in the lane outside) go down to the cells, where Hamm keeps the keys and Dickon the poacher
  keeps the straw warm. Headman Osbert Hale sits at his desk upstairs, with his steward, maid and cook about the
  house; the house is barred from 22:00 to 06:00. Both men have their own lines after the raid. The Headman's talk is
  a list of topics (`HeadmanTopic` in `dialogue/residence.ts`), so quests can add their own. Try `?area=garrison`,
  `?area=jail` or `?area=residence&hour=10`
- **Adowvale Jetty**: past the garrison a lane runs on south out of the village (a signpost at its head), down
  through the trees to the river Wend. A cobbled quay with a crane, crates and bollards; a timber pier on its piles
  with lanterns, a bench at the end, and the **Grey Heron** tied up alongside, a single-masted river boat with her
  sail furled, rowing boats round her; fishing huts, a smokehouse, a boathouse and slipway, nets and eel traps
  drying, a shingle beach of drawn-up boats, and a reed bank with lilies, an old willow, a shrine to the Lady of the
  Wend and a heron on the eyot out in the stream. The river runs: streaks of current drift downstream over shallows
  that shelve from gravel to deep water, gulls sit on the posts (and take off crying if you come close) and wheel
  over the water, and a family of mallards paddles about the reeds. Three new folk, drawn finely like the companions:
  **Maren Tull**, skipper of the Grey Heron; **Old Ebb**, mending his nets outside his hut; and **Wren**, his
  granddaughter, who sells smoked fish at the smokehouse and buys your river catch. Maren is the hook for travel by
  boat: she won't sail yet (the river's shut below Harrowford), but passages are listed in `systems/Voyages.ts` and
  she offers each, at its fare, once its story flag is set. You can fish off the pier and the banks. Try `?area=jetty`
- **The goblin raid**: give Mother her tincture and you're told to get some sleep, with only the one answer;
  you sleep till dawn. You wake to shouting: outside, goblins (cutters, a spearman and torch-bearing
  firebrands, led by an armoured Goblin Brute with a shield) are trampling the garden and setting the roof
  alight. Choose to **stand and fight**, or **retreat inside**, where they beat the door down. Either way the
  fight is scripted: from the third round (or sooner, if you get the better of the Brute) every blow of theirs
  lands, every one of yours misses, and you can't flee. You come round at 13:00 in the burnt-out cottage, with
  blood on the floor and Mother gone. The farm is ruined, the road travellers have fled, and Farmer Iran is
  huddled in his hut with Pip and Hetty. A new quest, **Ashes**, starts (see `world/GoblinRaid.ts`)
- **Cut-scenes**: the raid's opening (the camera taking in the yard and the Brute) and coming round in the ruins
  are framed as cut-scenes: black bars slide in, the HUD steps aside, the music is held, the camera moves in slow
  pans, and what's said or thought is written in the bottom bar. Later story scenes can use the same helper,
  `CutScene.begin(scene, { music })` in `ui/CutScene.ts`
- **After the raid**: the ruins of the cottage and the coop smoulder, thick and dark at first and dying down
  over two days; crows come down on the trampled garden and the yard (fewer as the days go by) and take off
  when you come near; and the folk on the plains road talk of the goblins (Jory, Hal and the footpads have
  something to say, and they shout about it as you pass) (see `world/Aftermath.ts`)
- **Speckle and Moppet** (a side story after the raid): once Iran has told you what he saw, Pip and Hetty whisper
  what they've lost. Hetty's hen Speckle ran off down the hill when the coop burned, and her rag doll Moppet was at
  your cottage, where Mother was sewing her a new eye. Moppet is under the fallen beam in the ruins (**Look under
  the fallen beam**); Speckle is hiding in the trampled garden beside the cottage (walk up quietly and press E to
  **Catch** her). Come back to the hut with both and the children have their say; Speckle lives in the hut after
  that, and the children chatter more cheerfully (see `scenes/game/speckle.ts`; try `?raid=after&area=hut`)
- **Weather**: clear skies, cloud, drizzle, rain and the odd thunderstorm, each lasting a few in-game hours and
  following on from the last (rain tends to come after cloud; a storm blows itself out into rain), and on some
  mornings after a dry night, mist lying in the hollows until mid-morning. Rain falls in sheets and splashes,
  rings the lake and the puddles that fill the paths (they dry over a few hours after), cloud greys and darkens
  the light (lanterns come on sooner), and storms bring wind in the trees, lightning and thunder. Indoors you
  hear the rain on the roof and the thunder dulled. The time wheel shows the cloud, rain and mist. The weather
  comes from a seed saved with the game, so the same game always has the same weather (see `systems/Weather.ts`)
- **Water and fire**: waves run round the lake's shore (rougher in a wind), lamps by the water and the hero's
  lantern shine on it after dark, and a hearth's light dances on the walls of the room

## URL switches

Add these to the address to start a new game somewhere else or set up something to test. They're all on the
`?debug` panel too, which writes them into the address for you (`systems/DebugSwitches.ts`). Except `weather`,
they only count when a new game starts (on the title screen, begin a new journey).

| Switch | What it does |
| --- | --- |
| `?area=<id>` | Start in that area: `world` (the Hollow outside the cottage), `hut` (Farmer Iran's), `cave`, `northwoods`, `watchtower` (inside the old watchtower there), `beacon` (inside the beacon on Corbie Tor), `beacon-top` (its roof), `market` (Adowvale's square), `tavern`, `tavern-hall`, `cellar`, `smithy`, `bakery`, `garrison`, `jail` (the cells under it), `residence` (the Headman's house), `jetty` (Adowvale Jetty, on the river), `plains`, `den` (the Wolf Mother's den), `deepden` (through the crevice behind it), `monastery`, `abbey`, `chapel`, `infirmary`, `scriptorium`, `refectory`. `home` is where a new game starts anyway; every area with `test: true` in `scenes/game/areas.ts` works |
| `?hour=21` | Start at that hour (0 to 23.99; 21 is 9pm) |
| `?raid=night` | Start at 20:00 with the tincture in the satchel and Mother's errand otherwise done (talk to her to give it) |
| `?raid=morning` | Wake on the morning of the goblin raid |
| `?raid=after` | Start in the ruins after the raid (add `&area=world` or `&area=hut` to start outside or in Iran's hut, where Pip and Hetty's side story begins) |
| `?event=footpads` | With `?area=plains`, have that chance meeting a few seconds in (or `tinker`, `goat`, `courier`, `wolves`) |
| `?give=moonpetal,willow-bark,raw-hare:3` | Start with those things in the satchel (`id:count`; ids are the keys of `ITEMS` in `systems/Inventory.ts`) |
| `?wolves=3` | The first beast you meet in an area comes as a pack this big (1 to 6) |
| `?weather=rain` | Hold the weather (`clear`, `overcast`, `drizzle`, `rain`, `storm`, `mist`); read on every area |
| `?debug` | The debug panel (see Controls) |
| `?smoke` | Puts the game on `window.game`, as the dev server always does (the smoke test uses it) |

## Project layout

Folder by folder, every file in `src/` (and the tools and tests around it). Most areas' map files, and most of
the art, download after the title screen (see "The download comes in pieces" under Key ideas), so anything the rest of the
game needs from a map lives in `world/landmarks.ts` instead.

```
src/
  main.ts                   Phaser game config and the scene list (puts the game on window.game under the dev server,
                            ?debug or ?smoke)
  config.ts                 Tile size, map size and seed, player speed, zoom limits, the start hour, the trek time
  vendor/phaser.js          A slimmer Phaser (what `import Phaser from 'phaser'` gets), built from Phaser's source

  iso/
    IsoMath.ts              Grid <-> isometric screen conversion, depth sorting

  world/                    The maps, and the living world on top of them
    MapData.ts              Area ids, terrain and prop types, the walkability table, and everything a map can hold
                            (doors, seats, beds, sights, lights, hens, children, creatures)
    MapGenerator.ts         The Hollow, seeded: the cottage and its garden, the lake, the road, the forest, Farmer
                            Iran's hut, run and plot, the cave in the hill, Old Tobin on the far shore
    HomeMap.ts              Inside the cottage (and its burnt-out ruin after the raid)
    HutMap.ts               Inside Farmer Iran's hut, where Pip and Hetty squabble (hiding in the dark after the
                            raid; Speckle pecking about the floor once she's home)
    CaveMap.ts              The wolves' cave in the hill: three wolves, the drover's ewes, bone piles, the locked door
    NorthWoodsMap.ts        The north woods beyond the cave: the brook and ford, the ruined watchtower, brambles and
                            wild cats, and after the raid the goblins' trail north (scenery only)
    WatchtowerMap.ts        Inside the old watchtower (7x7): roofless, the broken stair, the last watch's table,
                            logbook, spears, fire ring and chest, a rooks' nest, and two rats
    BeaconMap.ts            Inside the beacon on Corbie Tor (9x9): the brigands' hall, the warden's desk and book,
                            the stair to the hatch; and its roof (7x7): battlements, the brazier, fuel and the horn
    MarketMap.ts            Adowvale: the market square (stalls, well, houses, the inn, smithy and bakery doors,
                            the militia, the bounty board) and the lane north to Lord Morten's toll gate
    TavernMap.ts            The Crooked Tankard: taproom, the passage upstairs, a room to let, the cellar and its rats
    WorkshopMaps.ts         Inside Osric's smithy and Hilde's bakery
    GarrisonMaps.ts         The militia garrison, the cells beneath it, and the Headman's house
    JettyMap.ts             Adowvale Jetty on the river Wend: the quay, the pier (walkable decks over the water), the
                            Grey Heron and the rowing boats, huts, smokehouse, boathouse, reeds and the eyot
    RiverLife.ts            On a river (MapData.river): the shallows' wash, the current drifting, gulls and ducks
    PlainsMap.ts            Adowvale Plains past the toll gate (120x120): grass, copses, the mere and the pond, the
                            Lord's Road to the crossroads and on to the monastery, the old white willow, game
    PlainsEvents.ts         Chance meetings on the plains: the footpads, Jory the tinker, Mags's goat, Hal the
                            messenger, a wolf pack at night (?event=)
    DenMap.ts               The Wolf Mother's den on the plains (halls, a gallery round a black pool, her lair), and
                            the deep den through the crevice at the back (?area=den, ?area=deepden)
    MonasteryMap.ts         Outside Saint Elda's: the wall and gatehouse, shrines, beds, hives, fish ponds, brothers
    AbbeyMap.ts             Inside Saint Elda's walls: the court and well, the cloister and its herb garden (the
                            moonpetal), the chapel, dorter, infirmary, scriptorium, refectory, the brothers' graves
    AbbeyRooms.ts           The rooms off the abbey grounds: chapel, infirmary, scriptorium and refectory
    GoblinRaid.ts           The goblin raid: the farm on the morning of it, the scripted fight, and the ruins after
    Aftermath.ts            When the raid was (saved), how hard the ruins smoulder, how many crows come
    MotherRoutine.ts        Mother's day round the cottage: bed, meals at the table, pottering about
    HerbPatches.ts          Planting wild herb patches on a map (the clump, and its regrowing gather sight)
    landmarks.ts            Spots in the maps the rest of the game reads (the bar, the cellar rats, the moonpetal,
                            the monastery gate, the bounty board, where Speckle and Moppet are), kept out of the
                            map files so those can download on their own
    atlas.ts                How the areas join up (each door and road) and where each lies on the world map; the
                            way from any area to any other, for the quest markers
    atlasSurvey.ts          Generated by `npm run atlas`: each region's ground and buildings, for the world map
    IsoMap.ts               Renders a MapData and answers "can I walk here?" (per tile, and per exact spot)
    BakedLayer.ts           Bakes the ground into textures of at most 2048px, so big maps fit on phones
    Collision.ts            Collision outlines: round trunks and boulders, thin fence rails, full tiles
    Ambience.ts             Water glints and foam, birds, bats, butterflies, fireflies, cloud shadows, chimney
                            smoke, falling leaves; rain, puddles and mist; the ruins smouldering and crows after the raid
    AmbientSounds.ts        The background sounds' levels from the area, the hour, the weather and who's about
    Drips.ts                Water dripping from the cave's stalactites
    FireGlow.ts             A hearth's light dancing on the walls of a room

  entities/                 Things that move about the maps
    Player.ts               Movement, collision, click-to-move path following
    Npc.ts                  People you can talk to: their conversation, their day's round, travellers on the
                            road, the militia on their rounds
    Creature.ts             Wild beasts: wander and sniff near their den, start a fight when you come close
    Hen.ts                  Farmer Iran's hens: peck, strut about, scurry from the hero, roost at night
    Companion.ts            Someone travelling with the hero: walks in their footsteps, stands in fights
    Child.ts                Pip and Hetty: chatter in speech bubbles, say hello, and tell the hero things
    Goat.ts                 Clover, Mags's runaway goat on the plains: grazes, then follows when led

  systems/                  The game's rules, kept free of drawing (most have unit tests)
    Quests.ts               The quest log: quest definitions, steps, flags, and the diary (each entry with its
                            day and hour)
    QuestTargets.ts         Where each older quest's steps are done, for the markers and the map
    Experience.ts           XP and levels: what each level needs and gives, XP for quests
    PlayerStats.ts          Health and stamina (sprinting drains stamina)
    Needs.ts                Optional hunger and rest: how fast they fall, what meals and sleep restore, the penalties
    Inventory.ts            Item definitions, the satchel's slots and what's worn
    Loot.ts                 Random finds from searching a pile of bones
    Voyages.ts              Passages on the Grey Heron from Adowvale Jetty (none open yet): where, fare, hours, flag
    Shops.ts                The traders: stock, what they buy, prices that move with supply, the day and your standing
    MarketHours.ts          When the market trades (stalls open, packing up, shut)
    VillageDay.ts           Where Hilde, Osric and Tamsin are at each hour: stall, workshop, the Tankard or home
    Tavern.ts               The Crooked Tankard's menu and prices, and the room the hero has let
    Reputation.ts           Standing with Adowvale, Saint Elda's and the militia, and how each plains meeting went
    Bounties.ts             The militia's bounty notices: which are up each day, kills counted, claiming
    Crafting.ts             Brewing and cooking: recipes, stations, which recipes have been found
    Farm.ts                 The garden's crops, shaken trees, and the plot in Iran's yard (dug, sown, watered, grown)
    Herbs.ts                Wild herbs: the kinds, what each gives, when each patch was picked
    Fishing.ts              Each water's fish by time of day, bite timing, how hard each fights, the reel
    Combat.ts               Fight rules: initiative, attack rolls, damage dice, advantage, conditions, fleeing,
                            how beasts choose their moves, and their stats (FOES)
    Abilities.ts            The hero's combat skills: action or bonus action, stamina, cooldowns, levels
    CombatSim.ts            Headless fights for tuning FOES (`npm run sim`)
    Companions.ts           Who can travel with the hero, who does, their fighting numbers and turns, their health
    FightTally.ts           The sums for the end-of-fight card
    TimeOfDay.ts            The in-game clock and the lighting colour for each hour
    Weather.ts              Seeded spells of clear, cloud, rain and storm, morning mist, wet ground (?weather=)
    SaveGame.ts             Save and load: one save in browser storage, a section per system; area names
    Download.ts             Retries a download that failed, for the parts fetched after the first
    DebugSwitches.ts        Every URL switch the game reads, and reading/writing them in the address
    Pathfinding.ts          8-direction A* on the tile grid

  dialogue/                 Conversations as data: lines, replies, and named story actions
    Dialogue.ts             The node graph, speakers and their voices and portraits
    mother.ts               Mother, at home
    travellers.ts           Folk on the road past the cottage (Wil the drover and his lost ewes)
    iran.ts                 Farmer Iran and the feed, and Pip and Hetty's lines: squabbles, hellos, after the
                            raid, and Speckle and Moppet
    fisherman.ts            Old Tobin on the lake shore
    market.ts               The stallholders and the militia in Adowvale's square
    garrison.ts             Sergeant Brannock, Hamm the jailer, and Dickon the poacher
    residence.ts            Headman Hale (talk built from topics that quests can add to) and his household
    jetty.ts                Maren Tull the skipper, Old Ebb the fisherman, and Wren at the smokehouse
    tavern.ts               Godric, the maids and the Tankard's regulars
    plains.ts               The toll guards and the folk on the Lord's Road
    wayfarers.ts            The plains' chance meetings (footpads, tinker, goatherd, messenger)
    monastery.ts            Brother Wystan at Saint Elda's gate
    abbey.ts                The brothers inside: the Prior, Anselm, Leofric, Edmund and Hob

  scenes/
    BootScene.ts            Draws the art behind a loading bar, repaints the hero when gear changes, opens the menu
    MainMenuScene.ts        The title screen over the drifting world map
    GameScene.ts            The world scene: builds the area, runs the frame, camera, talking, menus. The rest of
                            what happens in the world is in scenes/game/, as functions that take the scene:
    game/
      areas.ts              The area registry: each id, how its map is built (most `lazy(...)`, fetched on first
                            need), whether ?area= starts there, and what happens on arriving
      interactions.ts       What the E prompt can do and which one shows
      input.ts              Keys, click-to-walk, pathfinding to a spot, the hover tile
      travel.ts             Doors, road exits, locked doors, the trek question, fading to the next area
      sights.ts             Few-second actions, crops, trees, examining, searching, gathering, giving items
      sitting.ts            Seats and the thoughts that come while sitting
      sleep.ts              Beds, sleeping, saving and loading
      combat.ts             Starting fights (and packs), spoils, being beaten, what comes after
      dialogueActions.ts    Runs a line's `action`: shop:, drink:, order:, road:, rent:, and the named ones, which
                            live with their part of the story:
      medicine.ts           Mother's medicine: leaving home, moonpetal, willow bark, the tincture brewed and given
      hollow.ts             Wil's ewes, Iran's hens and feed, the wolves' cave, the north woods, the children's hello
      speckle.ts            Pip and Hetty's side story after the raid: Speckle the hen and Moppet the rag doll
      raid.ts               The scene's side of the goblin raid, coming round in the ruins, ?raid=
      monastery.ts          The toll gate, the Wolf Mother, Saint Elda's gate
      tavern.ts             The Crooked Tankard: maids, the bar, rooms, dice, Pell's song, chatter, the cellar rats
      market.ts             Arriving in Adowvale, the militia calling the market's hours
      workshops.ts          The smithy and the bakery: barred at night, first visits, sparks and flour
      garrison.ts           The garrison, the cells and the Headman's house: first visits, the house barred at night
      jetty.ts              Arriving at Adowvale Jetty
      voyages.ts            Sailing on the Grey Heron (the voyage:<area> dialogue action)
      bounties.ts           The bounty board: reading it, taking a notice, kills counted, being paid
      plot.ts               The plot Iran lends: digging, sowing, watering and picking
      fishing.ts            The Fish prompt, first-catch diary lines, Tobin's rod and his boot
      debug.ts              What the ?debug panel does: teleport, hour, weather, flags, coins, XP, kill all
    UIScene.ts              The HUD, over the world camera
    DialogueScene.ts        The conversation box: talking portrait, typewriter text, voice blips, replies
                            (laid out by dialogue/ChoiceMenu.ts: a `key` reply stays up front, the rest fold away)
    JournalScene.ts         The journal book: tasks, quests, the diary (day and hour on each entry), and a Map tab
    MapScene.ts             The world map (M): an inked map of the places seen so far, the hero and the quest's mark
    InventoryScene.ts       Satchel and equipment: paper doll, item grid with filter tabs and sorting, tooltips, eat/wear
    ShopScene.ts            Trading: the stall's goods and your satchel, drag to buy and sell, how-many box
    StationScene.ts         Brewing bench and hearth: drag ingredients in, the recipe book, progress, the result
    FishingScene.ts         The water side-on: casting, the bite, playing the fish, the catch card
    CombatScene.ts          Turn-based fights: turn order, skill hotbar and tooltips, dice, combat log
    BountyBoardScene.ts     The notice board close up: pinned notices to pick, take and claim
    SleepScene.ts           "How long to sleep?", opened from a bed
    ConfirmScene.ts         A yes/no question with numbered answers (the trek, the raid's choice, hunger and rest)
    SaveWarningScene.ts     "Not saved" on waking when the browser refused the save, with Download Save
    InterludeScene.ts       A few half-remembered lines in the dark between scenes (beaten in the raid)
    LetterboxScene.ts       A cut-scene's bars and the caption in the bottom one
    PauseScene.ts           The Esc menu
    PartyScene.ts           Companions (P): who's with the hero, who's waiting, sending someone home
    SettingsScene.ts        Volume, resolution, interface size, minimap, quest markers, fullscreen, hunger and rest
    DebugScene.ts           The ?debug panel: an HTML overlay with every URL switch and testing buttons

  ui/                       Pieces of the HUD and menus
    theme.ts                The HUD's look: dark leather panels with gold trim, fonts
    Widgets.ts              Shared menu look: panels, buttons, sliders
    Display.ts              Draws at the screen's own resolution and sizes the interface to suit
    StatusBars.ts           Health and stamina bars (and hunger and rest), level and XP
    PartyStrip.ts           A card for each companion under the bars: face, name, health
    TimeWheel.ts            The sun and moon dial, with the weather's cloud, rain and mist
    Minimap.ts              The isometric minimap with the player, the view and the quest marker
    LocationLabel.ts        The area's name (and nearby landmark) under the minimap
    QuestTracker.ts         The current quest step, and which place it's in
    QuestMarkers.ts         A pointer over the step's spot, or an arrow at the screen's edge
    Toasts.ts               "New quest" banners, level-ups and the hero's passing thoughts
    SpeechBubbles.ts        Little bubbles over anyone saying something out loud (the militia, Pip and Hetty)
    DayNightOverlay.ts      Tints the world by time of day and weather; lantern, hearth and candle light; lightning
    CutScene.ts             Cut-scene framing: bars, the HUD away, held music, slow pans, captions
    CutSceneLayout.ts       The cut-scene's bar and caption sums
    AbilityIcons.ts         The hotbar's skill icons, painted into textures

  settings/
    Settings.ts             Volume, display, minimap, quest marker and hunger-and-rest settings, kept in the browser

  audio/
    Audio.ts                All the game's sound: music by area and hour, fight sounds, voice barks, UI blips
                            (and stand-in tunes if a recording won't load)
    Recordings.ts           Streams and crossfades the recorded music; plays the fight sounds and barks
    Soundscape.ts           The world's background sounds, footsteps and the bell

  art/                      All the pixel art, generated in code from one palette
    index.ts                The drawing steps, in order, for the loading screen (the first ones before the title)
    palette.ts              The Eldermoor palette every painter picks from
    sizes.ts                Sizes the scenes need from art drawn later (icons, faces)
    PixelCanvas.ts          A pixel-by-pixel painter, uploaded as a crisp texture
    IsoModel.ts             A tiny 3D painter for isometric objects (furniture, buildings), shaded per surface
    tiles.ts                Ground tiles, in look-alike variants
    ground.ts               Rocks and small things on the ground (tufts, flowers, mushrooms, pebbles)
    trees.ts                Broadleaf and pine trees, lit as forms
    props.ts                Standing props and flat ground decorations, with where each one's base sits
    willow.ts               The old white willow on the plains (and stripped of its bark)
    farm.ts                 The garden: tilled soil, crops ripe and picked, the split-rail fence
    henfarm.ts              Iran's hut, the coop and trough, the hens and the rooster
    interior.ts             The cottage's walls, floor and furniture, and the cottage from outside
    market.ts               Market stalls, townhouses and the inn, well, lamp posts, benches, crates, signpost
    tavern.ts               The Crooked Tankard inside: bar, kegs, stairs, trapdoor, tables
    workshops.ts            The smithy's and the bakery's furnishings, and Osric's and Hilde's work frames
    garrison.ts             The garrison and the Headman's house outside and in: cells, bars, panelled walls
    jetty.ts                The river front: pier decks, quay, the Grey Heron and rowing boats, huts, smokehouse,
                            boathouse, nets, reeds, lilies, the heron; gulls, ducks and the current's streak
    jettyfolk3d.ts          Maren, Old Ebb and Wren, drawn finely (FINE_SPEC)
    tollgate.ts             Lord Morten's toll gate, palisade, booth and banner
    monastery.ts            Saint Elda's from outside: wall, gatehouse, chapel, bell tower, shrines, hives
    abbey.ts                Saint Elda's within: the ranges round the cloister, the herb garden, the rooms' furnishings
    cave.ts                 The cave mouth, rock walls, stalactites, bones, the dead ewes, the locked door
    northwoods.ts           The watchtower (and its roofless inside), fallen trees, brambles, ford stones, the goblins' trail
    beacon.ts               The beacon tower on Corbie Tor, its knoll, the hall inside, the roof and the painted sky
    brigands3d.ts           Corwin Haske's band in HD: walking figures and full fight sheets, as the goblins have
    ruin.ts                 After the raid: burnt walls and furniture, blood and ash, fires, burnt fences and coop
    scorch.ts               Fire damage: makes any shader or texture come out charred and holed
    herbs.ts                Wild herb patches, grown and picked
    fishing.ts              Old Tobin's rod, float and creel
    stations.ts             The brewing still and the cooking pot, in layers, for the station window
    weather.ts              Rain sheets, splashes, puddles, mist, crows, lamp reflections, firelight on walls
    critters.ts             Water glints, foam, ripples, birds, bats, butterflies, chimney smoke
    mapInk.ts               The world map's pen work: parchment, frame, compass, trees, hills, water, roads
    items.ts                The satchel's painted item icons
    portraits.ts            Talking portraits for conversations
    character.ts            What every person's sprite sheet shares: frame size, feet, colour helpers
    figure3d.ts             The 3D figure renderer: rounded solids turned to 8 directions and lit as pixel art
    hero3d.ts               Arthus, the hero
    fight3d.ts              How the hero and the companions fight: stances, swings, flinches, guards, kneeling;
                            their bigger fight frames ('<key>@fight') and animations
    fightStances.ts         Draws the hero's and the fighting companions' fight frames
    gear.ts                 How worn gear looks on the hero (add an entry to dress a new item)
    mother3d.ts             Mother
    models3d.ts             The villagers' models (traders, militia, guards, brothers, tavern folk, Iran and his
                            children, Tobin, the road travellers)
    folk.ts                 Registers the villagers as 'folk-<id>'
    wayfarers3d.ts          The plains' chance meetings, Clover the goat, and the footpads' fighting frames
    beasts3d.ts             The beasts' 3D models: wolves, the Wolf Mother, deer, hares, boar, rats, the wild cat
    creatures.ts            Registers the beasts' sheets
    goblins3d.ts            The goblins, drawn finely (2x): cutters, spearmen, firebrands, the Brute, Snikkit and the shaman, with fight animations

public/audio/
  ambience/                 The ambient recordings (MP3) and CREDITS.md with their sources and licences
  music/                    The recorded music (MP3) and CREDITS.md
  sfx/                      The fight sounds, cries and voice barks (MP3) and CREDITS.md

tools/
  balance.ts                The balance table from the fight simulator (`npm run sim`)
  atlasSurvey.ts            Surveys the outdoor maps into src/world/atlasSurvey.ts (`npm run atlas`)
  gear-preview.html / .ts   The hero in every piece of gear, all 8 directions (/tools/gear-preview.html under `npm run dev`)
  phaserFlags.ts            Phaser's build flags, for building Phaser from its source (see vite.config.ts)
  build-ambience.py         Cuts, loops and levels the ambient recordings from the originals
  build-sound.py            Does the same for the music, fight sounds and voice barks

tests/
  unit/*.test.ts            Vitest tests, one file per system (quests, combat, satchel, shops, weather, the maps...)
  unit/helpers.ts           Scripted dice and a fake localStorage
  unit/maps.ts              Every area's map built in Node (with a Phaser maths mock), for tests against the maps
  smoke/smoke.mjs           Playwright smoke test: every ?area= loads without errors, and the ?debug panel works

.github/workflows/
  ci.yml                    Type-check, unit tests and smoke test on every PR and push
  deploy.yml                Build and publish to GitHub Pages from main
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
  rounded 3D solids (`art/hero3d.ts`, drawn by `art/figure3d.ts` like everyone else) turned to face 8 directions,
  with idle, walk, sit and work animations (`player-idle-<dir>`, `player-walk-<dir>`), and in a fight
  ready, attack, hit, guard and down animations on a sheet of bigger frames (`player-attack-<dir>`, see `art/fight3d.ts`;
  Sigrun and Wat have the same). Tiles come in several variants and
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
  `shop:<id>` action. `Shops.price(shop, id)` and `Shops.offer(shop, id)` work
  out today's prices from stock, a steady daily drift and the keeper's
  `faction` (see `sellPrice` / `buyPrice`); offers are capped below the lowest
  price anywhere, so there's no profit in carrying goods between stalls.
- **Standing and bounties.** `Reputation.gain(faction, n)` moves a standing and
  `Reputation.record(meeting, how)` remembers how a plains meeting ended; quest
  rewards are in `QUEST_STANDING`. Bounties are repeatable quests (`repeatable`
  on a `QuestDef` lets `QuestLog.start` begin a finished one again), defined in
  `BOUNTIES`; `BountyBoardScene` shows them and takes or claims them, and won
  fights count kills with `Bounties.slain`.
- **Conversations and quests are data.** A conversation is a set of nodes in
  `src/dialogue/`; replies point at the next node, and `action` names (like
  `start-medicine-quest`) are carried out in `GameScene.runDialogueAction`.
  Quests are listed in `QUESTS` in `systems/Quests.ts`; their steps appear one
  at a time in the HUD tracker and the journal. A step can name a `target` (an area,
  a tile and optionally the id of someone there) for the quest markers; the older
  quests' targets are in `systems/QuestTargets.ts`. A new area needs its doors and
  roads in `LINKS` in `world/atlas.ts` (and, out of doors, a `REGIONS` box to draw on
  the world map); `tests/unit/atlas.test.ts` checks them against the maps.

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

- **Companions** (`systems/Companions.ts`). After the raid, people can be asked to come along: Sigrun the
  sellsword at the Crooked Tankard of an evening (40 coins, or nothing once the `headman-pays-sigrun` flag is
  set) and Wat, a militia lad on the east side of the square. Up to two travel with the hero at once, walking
  in their footsteps from area to area (`entities/Companion.ts`, `scenes/game/companions.ts`). In a fight
  they're on the hero's side of the turn order and take their own turns (`chooseCompanionAction`): Sigrun
  finishes off whatever she can kill in one blow and shield-bashes the big ones off their feet every few
  turns; Wat goes for whatever the hero has marked or has hurt most, and raises his guard when badly hurt.
  Beasts go for whoever on the hero's side is weakest. A companion knocked down is out of that fight and
  gets up afterwards with a quarter of their health; if the hero falls while a companion stands, the fight
  goes on, and winning it hauls the hero back up. Running away takes everyone. Health comes back at
  `REGEN_PER_HOUR` and all at once after a sleep, and the save keeps who agreed to come, who's along, and
  how hurt each is. Talk to a companion (step right up to them) to ask how they are or send them home; P
  does the same from anywhere. To ask someone along again, find them where they wait.

  To add one: an NPC where they wait, an entry in `COMPANIONS` (their numbers, `tactic`, price, the flag
  they wait for, what they say), and an `ask` node in their talk: `offerCompanion` adds the asking to it.
  The dialogue actions are `companion:hire:<id>`, `companion:join:<id>` and `companion:leave:<id>`.
  Someone who should come but not fight (a guide) sets `fights: false`. The ?debug panel's Companion
  buttons bring someone along (or send them home) at once.

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

Threads the story has left open, roughly in the order the game points at them:

- **Finding Mother.** The last step of **Ashes** ("Find out what the goblins did with Mother") has nowhere to go
  yet: it's the one step in `tests/unit/questTargets.test.ts`'s `NO_TARGET`. The goblins' trail through the north
  woods is scenery only (`world/NorthWoodsMap.ts`, `art/northwoods.ts`), and runs off the north edge into the deep
  woods. Following it, and the goblins' camp, is the next big piece. Iran tells the hero to get word to Adowvale
  first: the militia and Lord Morten have nothing to say about the raid yet (`dialogue/market.ts`,
  `dialogue/plains.ts`).
- **The door under the hill.** The locked door at the back of the wolves' cave sets `found-cave-door`; Old Tobin
  then tells of men digging in the hill long ago, and Old Harlan at the Tankard (`harlan-secret`) says old Lord
  Morten shut something in down there and the key went with him, buried or kept at the manor. There's no manor
  yet, and nothing opens the door (`scenes/game/sights.ts` `tryLockedDoor`).
- **Deeper under the plains.** The deep den behind the Wolf Mother's lair (`?area=deepden`) has a passage running
  on into the dark "for another day" (`world/DenMap.ts`).
- **After the raid, at home.** The cottage stays a ruin and Iran's hens are gone (bar Speckle). Rebuilding the
  coop, or the cottage, would give the Hollow a way back to life; Iran's plot (`systems/Farm.ts`) already works
  after the raid.
- **More of the world.** More bounties (`BOUNTIES` in `systems/Bounties.ts` is data), more chance meetings
  (`world/PlainsEvents.ts`), more recipes (`systems/Crafting.ts`) and more brothers' errands at Saint Elda's.
- **A new area** is one entry in `scenes/game/areas.ts`, plus its id in `MapData.AreaId`, its name in
  `AREA_NAMES` (`systems/SaveGame.ts`), its doors in `world/atlas.ts`, and `npm run atlas` to survey it for the
  world map. **A new quest** is an entry in `QUESTS` (`systems/Quests.ts`) with a `target` on each step, story
  actions in the matching `scenes/game/` module, and a diary line (`QuestLog.writeDiary`) for each step.
