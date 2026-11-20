import Phaser from 'phaser';
import { makeArt } from '../art.js';
import { newRun } from '../run.js';

// Makes the textures the other scenes share. Nearly all of the art is drawn in code (src/art.js);
// only the little icons on the upgrade cards come from a sprite sheet.
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('preload');
  }

  preload() {
    this.load.setPath('assets'); // relative, so the game also works under /herd-the-agents/
    this.load.spritesheet('tiles', 'tiles.png', { frameWidth: 16, frameHeight: 16 });
  }

  create() {
    this.textures.get('tiles').setFilter(Phaser.Textures.FilterMode.NEAREST); // pixel art stays crisp
    makeArt(this);

    // A white dot for particles; they get tinted.
    const g = this.add.graphics();
    g.fillStyle(0xffffff).fillCircle(4, 4, 4).generateTexture('pixel', 8, 8).destroy();

    this.registry.set('run', newRun());
    this.scene.start('title');
  }
}
