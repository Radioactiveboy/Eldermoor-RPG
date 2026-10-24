/// <reference types="vite/client" />
import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { DialogueScene } from './scenes/DialogueScene';
import { GameScene } from './scenes/GameScene';
import { UIScene } from './scenes/UIScene';
import { InventoryScene } from './scenes/InventoryScene';
import { JournalScene } from './scenes/JournalScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { PauseScene } from './scenes/PauseScene';
import { SettingsScene } from './scenes/SettingsScene';

// Wait (briefly) for the menu font so text isn't first drawn in a fallback font.
Promise.race([document.fonts.load('40px Cinzel'), new Promise((resolve) => setTimeout(resolve, 2000))])
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
    scene: [BootScene, MainMenuScene, GameScene, UIScene, DialogueScene, JournalScene, InventoryScene, PauseScene, SettingsScene],
  });
  // Handy for poking at the game from the browser console while developing.
  if (import.meta.env.DEV) (window as unknown as { game: Phaser.Game }).game = game;
}
