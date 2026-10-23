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
- **Click / tap**: walk to a tile (A* pathfinding around trees, rocks and water)
- **Mouse wheel**: zoom
- **Esc**: pause menu (resume, settings, back to main menu)
- **Enter** on the title screen: start

## Project layout

```
src/
  main.ts                 Phaser game config, scene list
  config.ts               Tile size, map size/seed, player speed, zoom limits
  iso/IsoMath.ts          Grid <-> isometric screen conversion, depth sorting
  world/MapData.ts        Terrain + prop types, walkability table
  world/MapGenerator.ts   Seeded placeholder map (village square, lake, road, forest)
  world/IsoMap.ts         Renders a MapData and answers "can I walk here?"
  systems/Pathfinding.ts  8-direction A* on the tile grid
  entities/Player.ts      Movement, collision, click-to-move path following
  audio/Audio.ts          Music and UI sounds, composed live with Web Audio (no audio files)
  settings/Settings.ts    Volume settings, saved in the browser
  ui/Widgets.ts           Shared menu look: panels, buttons, sliders, fonts
  scenes/BootScene.ts     Generates placeholder art (no asset files needed yet)
  scenes/MainMenuScene.ts Title screen over the drifting world map
  scenes/PauseScene.ts    Esc menu during play
  scenes/SettingsScene.ts Volume sliders + fullscreen, opened from either menu
  scenes/GameScene.ts     World, camera, input
  scenes/UIScene.ts       HUD overlay, separate from the world camera
```

## Key ideas

- **Gameplay runs in grid space, rendering is isometric.** Positions are in tile
  units (`gx`, `gy`). Only rendering and pointer input convert to and from screen
  pixels via `IsoMath`. This keeps collision, pathfinding, AI and saves simple.
- **Depth sorting** uses `gx + gy`, so anything lower on screen draws in front.
  Ground tiles are baked into one render texture for performance; trees, rocks
  and characters are individual sprites so they can overlap correctly.
- **Placeholder art** is drawn in `BootScene` under texture keys like
  `tile-grass`, `prop-tree`, `player`. Load real sprites under the same keys and
  everything else keeps working.
- **Music is code, not files.** `audio/Audio.ts` defines each track as a tempo,
  a chord progression and an arpeggio pattern, played by simple synth voices
  (harp pluck, pad, drone, flute). There is a calm `menu` track and a livelier
  `world` track; add more by adding entries to `TRACKS`. Recorded music can
  replace it later without changing the scenes.
- **Maps** are anything that produces a `MapData`. The generator is a stand-in;
  hand-made maps (e.g. from the Tiled editor) can plug in later.

## Good next steps

NPCs and dialogue, combat and stats, inventory, multiple maps with transitions,
real sprite sheets with 8-direction walk animations, save/load.
