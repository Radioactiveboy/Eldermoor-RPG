/// <reference types="vite/client" />
import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { CombatScene } from './scenes/CombatScene';
import { ConfirmScene } from './scenes/ConfirmScene';
import { DialogueScene } from './scenes/DialogueScene';
import { GameScene } from './scenes/GameScene';
import { UIScene } from './scenes/UIScene';
import { InventoryScene } from './scenes/InventoryScene';
import { JournalScene } from './scenes/JournalScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { PauseScene } from './scenes/PauseScene';
import { SettingsScene } from './scenes/SettingsScene';
import { ShopScene } from './scenes/ShopScene';
import { SleepScene } from './scenes/SleepScene';
import { StationScene } from './scenes/StationScene';
import { FishingScene } from './scenes/FishingScene';
import { InterludeScene } from './scenes/InterludeScene';
import { SaveWarningScene } from './scenes/SaveWarningScene';
import { BountyBoardScene } from './scenes/BountyBoardScene';
import { LetterboxScene } from './scenes/LetterboxScene';
import { DebugScene } from './scenes/DebugScene';
import { debugWanted } from './systems/DebugSwitches';
import { Display } from './ui/Display';

// Wait (briefly) for the fonts so text isn't first drawn in a fallback (Phaser won't redraw it when they arrive).
const fonts = ['40px Cinzel', 'bold 40px Cinzel', '16px Merriweather', 'bold 16px Merriweather', 'italic 16px Merriweather'];
Promise.race([Promise.all(fonts.map((f) => document.fonts.load(f))), new Promise((resolve) => setTimeout(resolve, 2500))])
  .catch(() => undefined)
  .then(startGame);

function startGame(): void {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#0e0f14',
    // Drawn at the screen's own resolution, with the interface sized to suit it (see ui/Display).
    scale: Display.scaleConfig(),
    // Later scenes draw on top of earlier ones.
    scene: [BootScene, MainMenuScene, GameScene, UIScene, LetterboxScene, DialogueScene, CombatScene, JournalScene, InventoryScene, ShopScene, BountyBoardScene, StationScene, FishingScene, SleepScene, ConfirmScene, InterludeScene, PauseScene, SaveWarningScene, SettingsScene, DebugScene],
  });
  Display.install(game);
  // Handy for poking at the game from the browser console while developing (and for the smoke test, which adds ?smoke).
  const debug = debugWanted(window.location.search);
  if (import.meta.env.DEV || debug || new URLSearchParams(window.location.search).has('smoke')) {
    (window as unknown as { game: Phaser.Game }).game = game;
  }
  // The testing panel (see scenes/DebugScene.ts), open from the start alongside whatever else is running.
  if (debug) game.events.once(Phaser.Core.Events.READY, () => game.scene.run('Debug'));
}
