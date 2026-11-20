import { addArt } from '../art.js';
import { depthAt, toScreen } from '../iso.js';
import { findPath, isFloor, tileAt, tileX, tileY } from '../room.js';

export const BUG_COLOR = 0xff7ac8;
const HATCH_TIME = 0.7; // seconds a new bug sits still, so one never bites you out of nowhere
const REPATH_EVERY = 0.45; // seconds between looking for the way to you again
const SIZE = 0.25; // the pictures are drawn four times as big as they are shown (ART_SCALE)

// A bug made by a hallucinating agent. It crawls after you around the furniture.
// x, y are grid pixels; `view` is the picture on screen.
export class Bug {
  constructor(scene, x, y) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.view = addArt(scene, 0, 0, 'bug-0').setScale(0);
    this.hatching = HATCH_TIME;
    this.repath = 0;
    this.path = [];
    scene.tweens.add({ targets: this.view, scale: SIZE, duration: HATCH_TIME * 1000, ease: 'Back.out' });
    this.place(0);
  }

  get harmless() {
    return this.hatching > 0;
  }

  place(time) {
    const at = toScreen(this.x, this.y);
    this.view.setPosition(at.x, at.y + 2).setDepth(depthAt(this.x, this.y));
    this.view.setTexture(Math.floor(time / 140) % 2 ? 'bug-1' : 'bug-0');
  }

  update(dt, time, player, speed) {
    this.place(time);
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
      const dx = ((tx - this.x) / d) * speed * dt;
      const dy = ((ty - this.y) / d) * speed * dt;
      this.x += dx;
      this.y += dy;
      if (Math.abs(dx - dy) > 0.01) this.view.setFlipX(dx - dy < 0); // left on screen
    }
  }

  destroy() {
    this.scene.tweens.killTweensOf(this.view);
    this.view.destroy();
  }
}
