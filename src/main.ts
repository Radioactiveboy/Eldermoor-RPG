import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { UIScene } from './scenes/UIScene';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#0e0f14',
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: window.innerWidth,
    height: window.innerHeight,
  },
  scene: [BootScene, GameScene, UIScene],
});
