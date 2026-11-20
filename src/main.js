import Phaser from 'phaser';
import { PreloadScene } from './scenes/PreloadScene.js';
import { TitleScene } from './scenes/TitleScene.js';
import { GameScene } from './scenes/GameScene.js';
import { UIScene } from './scenes/UIScene.js';
import { UpgradeScene } from './scenes/UpgradeScene.js';
import { GameOverScene } from './scenes/GameOverScene.js';
import { keepFitted, watchOrientation } from './touch.js';
import { HEIGHT, WIDTH, ZOOM } from './view.js';

function startGame() {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: WIDTH * ZOOM,
    height: HEIGHT * ZOOM,
    pixelArt: true,
    backgroundColor: '#0b0f1a',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    input: { activePointers: 3 }, // several fingers at once on phones
    physics: {
      default: 'arcade',
      arcade: { gravity: { x: 0, y: 0 }, debug: false }, // seen from above: nothing falls
    },
    scene: [PreloadScene, TitleScene, GameScene, UIScene, UpgradeScene, GameOverScene],
  });

  watchOrientation(game);
  keepFitted(game);

  // Handy for poking at the game from the browser console (and for automated testing).
  if (import.meta.env.DEV) window.game = game;
}

// Wait for the fonts, otherwise the first texts are drawn in a fallback font.
Promise.all([document.fonts.load('16px KenPixel'), document.fonts.load('16px "KenPixel Mini"')]).finally(startGame);
