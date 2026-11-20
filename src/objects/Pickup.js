import { ART_SCALE, addArt } from '../art.js';
import { depthAt, toScreen } from '../iso.js';

const LIFE = 11; // seconds before it disappears again
const WARNING = 3; // it blinks for the last seconds
const GROW_TIME = 0.25;
const FLOAT = 3; // how far above the floor it hovers

// A power-up lying in the room (see src/pickups.js). x, y are grid pixels.
export class Pickup {
  constructor(scene, x, y, kind) {
    this.x = x;
    this.y = y;
    this.kind = kind;
    this.age = 0;
    this.size = (kind.scale ?? 1) / ART_SCALE;
    const at = toScreen(x, y);
    this.at = at;
    this.glow = scene.add.ellipse(at.x, at.y, 17, 11, kind.color, 0.3).setDepth(52);
    this.view = addArt(scene, at.x, at.y, kind.art).setScale(0).setDepth(depthAt(x, y));
  }

  // False once its time is up.
  update(dt, time) {
    this.age += dt;
    const left = LIFE - this.age;
    const pulse = 0.5 + 0.5 * Math.sin(time / 180);
    const blink = left < WARNING && Math.floor(time / 110) % 2 ? 0.3 : 1;
    this.view
      .setScale(this.size * Math.min(1, this.age / GROW_TIME))
      .setY(this.at.y - FLOAT - pulse * 2)
      .setAlpha(blink);
    this.glow.setScale(0.8 + pulse * 0.3).setAlpha((0.28 + pulse * 0.22) * blink);
    return left > 0;
  }

  destroy() {
    this.view.destroy();
    this.glow.destroy();
  }
}
