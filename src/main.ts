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
import { InterludeScene } from './scenes/InterludeScene';

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
    scale: {
      mode: Phaser.Scale.RESIZE,
      width: window.innerWidth,
      height: window.innerHeight,
    },
    // Later scenes draw on top of earlier ones.
    scene: [BootScene, MainMenuScene, GameScene, UIScene, DialogueScene, CombatScene, JournalScene, InventoryScene, ShopScene, StationScene, SleepScene, ConfirmScene, InterludeScene, PauseScene, SettingsScene],
  });
  // Handy for poking at the game from the browser console while developing.
  if (import.meta.env.DEV) (window as unknown as { game: Phaser.Game }).game = game;
}
