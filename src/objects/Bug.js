import Phaser from 'phaser';
import { T } from '../tiles.js';
import { findPath, isFloor, tileAt, tileX, tileY } from '../room.js';

export const BUG_COLOR = 0xff7ac8;
const HATCH_TIME = 0.7; // seconds a new bug sits still, so one never bites you out of nowhere
const REPATH_EVERY = 0.45; // seconds between looking for the way to you again

// A bug made by a hallucinating agent. It crawls after you around the furniture.
export class Bug extends Phaser.GameObjects.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'tiles', T.bug[0]);
    scene.add.existing(this);
    this.setTint(BUG_COLOR).setDepth(7).setScale(0);
    this.play('bug-crawl');
    this.hatching = HATCH_TIME;
    this.repath = 0;
    this.path = [];
    scene.tweens.add({ targets: this, scale: 1, duration: HATCH_TIME * 1000, ease: 'Back.out' });
  }

  get harmless() {
    return this.hatching > 0;
  }

  update(dt, player, speed) {
    if (this.hatching > 0) {
      this.hatching -= dt;
      return;
    }
    const grid = this.scene.grid;
    const here = tileAt(this.x, this.y);
    const there = tileAt(player.x, player.y);
    this.repath -= dt;
    if (this.repath <= 0) {
      this.repath = REPATH_EVERY;
      this.path = isFloor(grid, there.c, there.r) ? findPath(grid, here, there) : [];
    }
    // Follow the path tile by tile; on your tile (or right next to you) go straight for you.
    let tx = player.x;
    let ty = player.y;
    if (this.path.length > 1) {
      tx = tileX(this.path[0].c);
      ty = tileY(this.path[0].r);
      if (Math.hypot(tx - this.x, ty - this.y) < 2) this.path.shift();
    }
    const d = Math.hypot(tx - this.x, ty - this.y);
    if (d > 0.5) {
      this.x += ((tx - this.x) / d) * speed * dt;
      this.y += ((ty - this.y) / d) * speed * dt;
      this.setFlipX(tx < this.x);
    }
  }
}
