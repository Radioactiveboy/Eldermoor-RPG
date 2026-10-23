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

- **WASD / arrow keys**: move (screen-relative, so "up" goes up the screen)
- **Click / tap**: walk to a tile (A* pathfinding around trees, rocks and water).
  Clicking a person walks over to them and starts talking
- **E** (or **Enter**, or tapping the bubble): talk to someone nearby
- **During a conversation**: click / Space / Enter / E to skip the typing or carry on;
  pick a reply with the mouse, the number keys, or up/down then Enter
- **J** or the **book** button: open the journal (arrow keys or click to turn pages)
- **Shift**: sprint (uses stamina, which refills when you stop sprinting)
- **Mouse wheel**: zoom
- **Hold T**: fast-forward the clock (60x) to watch the day/night cycle
- **Esc** or the **II** button: pause menu (resume, settings, back to main menu)
- **Enter** on the title screen: start a new game (you wake up at home)
- Add `?hour=21` to the URL to start at a given hour (handy for testing night)

## Project layout

```
src/
  main.ts                 Phaser game config, scene list
  config.ts               Tile size, map size/seed, player speed, zoom limits
  iso/IsoMath.ts          Grid <-> isometric screen conversion, depth sorting
  world/MapData.ts        Terrain + prop types, walkability table
  world/MapGenerator.ts   Seeded placeholder map (village square, lake, road, forest, the family cottage)
  world/HomeMap.ts        Inside the cottage: walls, furniture, Mother, the door out
  world/IsoMap.ts         Renders a MapData and answers "can I walk here?"
  systems/Pathfinding.ts  8-direction A* on the tile grid
  systems/PlayerStats.ts  Health and stamina (sprinting drains stamina)
  systems/TimeOfDay.ts    In-game clock and the lighting colour for each hour
  entities/Player.ts      Movement, collision, click-to-move path following
  entities/Npc.ts         People you can talk to, and which conversation they have
  dialogue/               Conversations as data (lines, replies, story actions) and speakers
  systems/Quests.ts       Quest log: quest definitions, progress, diary entries
  art/                    Palette and pixel-art generators: tiles, props, the hero, Mother,
                          furniture and buildings (IsoModel.ts draws 3D-ish iso objects)
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
  scenes/UIScene.ts       HUD overlay, separate from the world camera
  ui/StatusBars.ts        Health and stamina bars
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
  (harp pluck, pad, drone, flute). There is a calm `menu` track and a livelier
  `world` track; add more by adding entries to `TRACKS`. Recorded music can
  replace it later without changing the scenes.
- **Maps** are anything that produces a `MapData`. The generator is a stand-in;
  hand-made maps (e.g. from the Tiled editor) can plug in later. A map can have
  furniture and buildings (`objects`), back walls for rooms, `doors` that lead
  to another area, light sources and NPCs. Stepping on a door tile swaps the
  area (`home` and `world` so far).
- **Conversations and quests are data.** A conversation is a set of nodes in
  `src/dialogue/`; replies point at the next node, and `action` names (like
  `start-medicine-quest`) are carried out in `GameScene.runDialogueAction`.
  Quests are listed in `QUESTS` in `systems/Quests.ts`; their steps appear one
  at a time in the HUD tracker and the journal.

## Good next steps

The village herbalist (the next step of "Medicine for Mother"), more villagers,
combat and stats, inventory, save/load.
