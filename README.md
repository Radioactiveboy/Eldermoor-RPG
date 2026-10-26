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

## Controls

The HUD doesn't list controls; they're under **Controls** in the pause menu.

- **WASD / arrow keys**: move (screen-relative, so "up" goes up the screen)
- **Click / tap**: walk to that spot (A* pathfinding around trees, rocks and water,
  smoothed into straight lines). Clicking a person or thing walks over to it and uses it
- **E** (or **Enter**, or tapping the prompt): do what the prompt over something
  nearby says: talk, go through a door, sit on a bench or stool, pick crops,
  shake a tree. Moving or pressing E again gets up from a seat; moving cancels
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
- **In a fight**: pick an action with the mouse, the number keys, or arrows then Enter;
  Esc goes back from a sub-menu (choosing a target or an item)
- **Shift**: sprint (uses stamina, which refills when you stop sprinting)
- **Mouse wheel**: zoom
- **Hold T**: fast-forward the clock (60x) to watch the day/night cycle
- **Esc** or the **II** button: pause menu (resume, controls, settings, back to main menu)
- **Enter** on the title screen: start a new game (you wake up at home)
- Add `?hour=21` to the URL to start at a given hour (handy for testing night)
- Add `?area=market` to start in the market (or `?area=world` outside the cottage)
- Add `?wolves=3` to the URL to meet a pack of wolves instead of the lone one (handy for
  testing fights against several enemies)

## Project layout

```
src/
  main.ts                 Phaser game config, scene list
  config.ts               Tile size, map size/seed, player speed, zoom limits
  iso/IsoMath.ts          Grid <-> isometric screen conversion, depth sorting
  world/MapData.ts        Terrain + prop types, walkability table
  world/MapGenerator.ts   Seeded placeholder map (the family cottage and its vegetable garden, lake, road, forest)
  world/HomeMap.ts        Inside the cottage: walls, furniture, Mother, stools, the door out
  world/MarketMap.ts      The market at the end of the road: bare-earth square, well, stalls, houses, militia
  world/IsoMap.ts         Renders a MapData and answers "can I walk here?" (per tile, and per exact spot)
  world/Collision.ts      Collision outlines: round trunks and boulders, thin fence rails, full tiles
  world/Ambience.ts       Living world: water glints and foam, birds, bats, sparrows, butterflies,
                          fireflies, cloud shadows, chimney smoke, falling leaves
  systems/Pathfinding.ts  8-direction A* on the tile grid
  systems/PlayerStats.ts  Health and stamina (sprinting drains stamina)
  systems/Inventory.ts    Item definitions, the satchel's slots and what's worn
  systems/Shops.ts        The market traders: stock, what they buy, prices
  systems/Farm.ts         Crops (picked ones regrow) and which trees were shaken today
  systems/TimeOfDay.ts    In-game clock and the lighting colour for each hour
  systems/Combat.ts       Fight rules: initiative, attack rolls against armour, damage dice, fleeing,
                          how beasts choose their moves, and the beasts' stats (FOES)
  entities/Player.ts      Movement, collision, click-to-move path following
  entities/Npc.ts         People you can talk to, which conversation they have, travellers
                          who wander up and down the road, and the militia on their rounds
  entities/Creature.ts    Wild animals: wander and sniff near their den, start a fight when you come close
  dialogue/               Conversations as data (lines, replies, story actions) and speakers
  systems/Quests.ts       Quest log: quest definitions, progress, diary entries
  art/market.ts           Market stalls, townhouses and the inn, the well, lamp posts, benches, crates, signpost
  art/                    Palette and pixel-art generators: tiles, props, the hero, Mother,
                          furniture and buildings (IsoModel.ts draws 3D-ish iso objects),
                          the garden (farm.ts: soil, crops, fences), item icons (items.ts),
                          the grey wolf (creatures.ts), travellers on the road (folk.ts) and birds, ripples and smoke (critters.ts)
  audio/Audio.ts          Music and UI sounds, composed live with Web Audio (no audio files)
  settings/Settings.ts    Volume settings, saved in the browser
  ui/Widgets.ts           Shared menu look: panels, buttons, sliders, fonts
  scenes/BootScene.ts     Generates the art, then opens the main menu
  scenes/MainMenuScene.ts Title screen over the drifting world map
  scenes/PauseScene.ts    Esc menu during play
  scenes/SettingsScene.ts Volume sliders + fullscreen, opened from either menu
  scenes/GameScene.ts     World, camera, input, doors between areas, talking
  scenes/DialogueScene.ts Conversation box: talking portrait, typewriter text, voice blips, replies
  scenes/JournalScene.ts  The journal book: tasks, quests, diary, page turning
  scenes/InventoryScene.ts Satchel and equipment tabs: item grid, worn gear, details, eat/wear
  scenes/ShopScene.ts     Trading window: the stall's goods and your satchel, drag to buy and sell, how-many box
  scenes/CombatScene.ts   Turn-based fights over the world: turn order, action menu, dice, combat log
  scenes/UIScene.ts       HUD overlay, separate from the world camera
  ui/StatusBars.ts        Slim health and stamina bars
  ui/TimeWheel.ts         Rotating sun/moon dial showing the time of day
  ui/Minimap.ts           Isometric minimap with player and camera view
  ui/DayNightOverlay.ts   Tints the world by time of day; lantern, hearth and candle light
  ui/QuestTracker.ts      HUD reminder of the current quest step
  ui/Toasts.ts            "New quest" banners and the hero's passing thoughts
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
- **Music is code, not files.** `audio/Audio.ts` defines each track as a tempo,
  a chord progression and an arpeggio pattern, played by simple synth voices
  (harp pluck, pad, drone, flute, and optionally a frame drum and tambourine).
  There is a calm `menu` track, a livelier `world` track, a sad `home` one, a
  tense `battle` one and a bouncing `market` dance; add more by adding entries
  to `TRACKS`. Each map names its track (`MapData.music`). Recorded music can
  replace it later without changing the scenes.
- **Maps** are anything that produces a `MapData`. The generator is a stand-in;
  hand-made maps (e.g. from the Tiled editor) can plug in later. A map can have
  furniture and buildings (`objects`), back walls for rooms, `doors` that lead
  to another area, light sources, NPCs, seats and crops. Using a door (E by it)
  swaps the area (`home`, `world` and `market` so far). A door marked `auto` is
  the end of a road at the map's edge: walking onto it goes on to the next area
  (the road west from the cottage leads to the market, and back).
- **Interactions** are built in `GameScene.interactionsNear`: each nearby NPC,
  door, seat, ripe crop or tree offers an `Interaction` (a label, a range and
  what to do). The nearest one in range gets the HUD's "E" prompt. Slower
  actions (picking, shaking) run as a `Channel` with a progress bar; moving
  cancels them. To add a new kind of thing to use, add another case there.
- **Items** are defined in `ITEMS` (`systems/Inventory.ts`) with an icon from
  `art/items.ts`. `Inventory.add(id, n)` puts them in the satchel and the HUD
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
  critical hit (double dice) and a natural 1 always misses. Your armour is
  10 + the Defence of what you wear; your to-hit and damage come from your
  weapon's Attack (fists roll d4, a weapon d6). On your turn you choose to
  **Attack**, make a **Heavy blow** (-2 to hit but double damage, costs stamina),
  **Defend** (+4 armour until your next turn, recovers stamina), **Use an item**
  (eat food, or take up a weapon from the satchel) or **Flee** (d20 + quickness
  against 10, +2 per extra enemy). Wolves gang up (+2 to hit in a pack) and may
  bolt when badly hurt. Lose and you wake up at home. The clock stops during a
  fight. New beasts go in `FOES` (`systems/Combat.ts`) with art in `art/` and a
  spawn in the map's `creatures` list.

## Good next steps

The village herbalist (the next step of "Medicine for Mother"; Hilde the baker
mentions Old Maud), more villagers and buildings to go into,
more beasts and weapons, a reward for the wolf pelt, cooking with the garden's
crops, showing worn gear on the hero's sprite, save/load.
