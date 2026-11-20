import Phaser from 'phaser';
import { ACTIONS } from '../actions.js';
import { addArt } from '../art.js';
import { COLOR, FONT_MINI, HEIGHT, WIDTH, addText } from '../view.js';
import { IS_TOUCH } from '../touch.js';

const RADIUS = 30; // size of the joystick ring, in pixels (the knob moves this far)
const KNOB = 13; // size of the knob you push around
const DEAD_ZONE = 0.08; // tiny thumb movements near the middle are ignored
const FULL_SPEED_AT = 0.5; // full speed once the thumb is this far out (0.5 = half the ring)
const STICK_HOME = { x: 58, y: 416 }; // where the joystick waits when no thumb is on it
const MARGIN = 4; // the ring always stays this far inside the screen
const HUD_HEIGHT = 44; // taps up there are for the HUD's buttons
const BUTTON_RADIUS = 24;
// The three action buttons, in a little arc for the right thumb.
export const BUTTONS = {
  approve: { x: 158, y: 438 },
  stop: { x: 204, y: 388 },
  review: { x: 241, y: 442 },
};

// The controls. On a phone the whole screen is the controller: put your left thumb anywhere on
// the left half and slide it to walk (the joystick jumps under your thumb); the right half has
// the three action buttons, and a tap next to them counts for the nearest one. On a computer the
// buttons are there too (click them, or use their keys). x and y go from -1 to 1, like arrow keys.
//
// Touches are read from the browser's own touch events, because Phaser ignores touches outside
// the canvas (the dark border around the game on wide screens).
export class TouchPad {
  constructor(scene, onAction) {
    this.scene = scene;
    this.onAction = onAction;
    this.x = 0;
    this.y = 0;
    this.touchId = null;

    this.buttons = {};
    for (const action of Object.values(ACTIONS)) {
      const at = BUTTONS[action.key];
      const circle = scene.add.circle(at.x, at.y, BUTTON_RADIUS, action.color, 0.22).setStrokeStyle(2, action.color, 0.95);
      const icon = addArt(scene, at.x, at.y - 5, action.icon).setTint(action.color);
      const label = addText(scene, at.x, at.y + 6, action.label, { size: 8, font: FONT_MINI }).setOrigin(0.5, 0);
      const parts = [circle, icon, label];
      if (!IS_TOUCH) {
        parts.push(addText(scene, at.x + 20, at.y - 23, action.hint, { size: 8, color: COLOR.dim }).setOrigin(0.5));
        circle.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.press(action.key));
      }
      for (const part of parts) part.setDepth(9000);
      this.buttons[action.key] = circle;
    }
    if (!IS_TOUCH) return; // computers walk with the keyboard

    this.base = scene.add.circle(0, 0, RADIUS, 0xffffff, 0.08).setStrokeStyle(2, 0xffffff, 0.5).setDepth(9000);
    this.knob = scene.add.circle(0, 0, KNOB, 0xffffff, 0.5).setDepth(9000);
    this.goHome();

    const page = document.getElementById('game');
    const handlers = {
      touchstart: (e) => this.onStart(e),
      touchmove: (e) => this.onMove(e),
      touchend: (e) => this.onEnd(e),
      touchcancel: (e) => this.onEnd(e),
    };
    for (const [type, fn] of Object.entries(handlers)) page.addEventListener(type, fn);
    scene.events.once('shutdown', () => {
      for (const [type, fn] of Object.entries(handlers)) page.removeEventListener(type, fn);
    });
  }

  // Browser page coordinates -> game pixels (can be outside 0..WIDTH on the dark border).
  toGame(touch) {
    const r = this.scene.game.canvas.getBoundingClientRect();
    return {
      x: ((touch.clientX - r.left) / r.width) * WIDTH,
      y: ((touch.clientY - r.top) / r.height) * HEIGHT,
    };
  }

  goHome() {
    this.base.setPosition(STICK_HOME.x, STICK_HOME.y).setAlpha(0.7);
    this.knob.setPosition(STICK_HOME.x, STICK_HOME.y).setAlpha(0.7);
  }

  onStart(e) {
    if (!this.scene.sys.isActive()) return;
    for (const touch of e.changedTouches) {
      const p = this.toGame(touch);
      if (p.x > WIDTH / 2) {
        if (p.y > HUD_HEIGHT) this.press(this.nearest(p));
        continue;
      }
      if (this.touchId !== null) continue;
      this.touchId = touch.identifier;
      this.start = p; // pushing is measured from where the thumb first landed
      // Under the thumb, but never partly off screen.
      const cx = Phaser.Math.Clamp(p.x, RADIUS + MARGIN, WIDTH / 2);
      const cy = Phaser.Math.Clamp(p.y, RADIUS + MARGIN, HEIGHT - RADIUS - MARGIN);
      this.base.setPosition(cx, cy).setAlpha(1);
      this.knob.setPosition(cx, cy).setAlpha(1);
    }
  }

  // The action button closest to a point.
  nearest(p) {
    let best = null;
    for (const [key, at] of Object.entries(BUTTONS)) {
      const d = Math.hypot(p.x - at.x, p.y - at.y);
      if (!best || d < best.d) best = { key, d };
    }
    return best.key;
  }

  press(key) {
    const button = this.buttons[key];
    const color = ACTIONS[key].color;
    button.setFillStyle(color, 0.75);
    this.scene.time.delayedCall(120, () => button.setFillStyle(color, 0.22));
    this.onAction(key);
  }

  onMove(e) {
    const touch = [...e.changedTouches].find((t) => t.identifier === this.touchId);
    if (!touch) return;
    const p = this.toGame(touch);
    const dx = p.x - this.start.x;
    const dy = p.y - this.start.y;
    const len = Math.min(Math.hypot(dx, dy), RADIUS);
    const angle = Math.atan2(dy, dx);
    this.knob.setPosition(this.base.x + Math.cos(angle) * len, this.base.y + Math.sin(angle) * len);
    const push = len / RADIUS;
    const strength = push < DEAD_ZONE ? 0 : Math.min(1, push / FULL_SPEED_AT);
    this.x = Math.cos(angle) * strength;
    this.y = Math.sin(angle) * strength;
  }

  onEnd(e) {
    if (![...e.changedTouches].some((t) => t.identifier === this.touchId)) return;
    this.touchId = null;
    this.x = 0;
    this.y = 0;
    this.goHome();
  }
}
