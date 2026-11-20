import Phaser from 'phaser';
import { T } from '../tiles.js';
import { newRun } from '../run.js';

// Loads the one sprite sheet and makes the textures and animations the other scenes share.
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('preload');
  }

  preload() {
    this.load.setPath('assets'); // relative, so the game also works under /herd-the-agents/
    this.load.spritesheet('tiles', 'tiles.png', { frameWidth: 16, frameHeight: 16 });
  }

  create() {
    // A white 2x2 dot for particles; they get tinted.
    const g = this.add.graphics();
    g.fillStyle(0xffffff).fillRect(0, 0, 2, 2).generateTexture('pixel', 2, 2).destroy();

    this.anims.create({
      key: 'bug-crawl',
      frames: this.anims.generateFrameNumbers('tiles', { frames: [T.bug[0], T.bug[1]] }),
      frameRate: 7,
      repeat: -1,
    });

    this.registry.set('run', newRun());
    this.scene.start('title');
  }
}
