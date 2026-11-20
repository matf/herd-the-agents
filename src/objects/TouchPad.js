import Phaser from 'phaser';
import { COLOR, HEIGHT, WIDTH, addText } from '../view.js';
import { IS_TOUCH } from '../touch.js';

const RADIUS = 30; // size of the joystick ring, in pixels (the knob moves this far)
const KNOB = 13; // size of the knob you push around
const DEAD_ZONE = 0.08; // tiny thumb movements near the middle are ignored
const FULL_SPEED_AT = 0.5; // full speed once the thumb is this far out (0.5 = half the ring)
const STICK_HOME = { x: 62, y: 428 }; // where the joystick waits when no thumb is on it
const BUTTON = { x: 208, y: 428 }; // the Ctrl-C button
const MARGIN = 4; // the ring always stays this far inside the screen
const HUD_HEIGHT = 44; // taps up there are for the HUD's buttons

// The controls for phones. The whole screen is the controller: put your left thumb anywhere on
// the left half and slide it to walk (the joystick jumps under your thumb), tap anywhere on the
// right half for Ctrl-C. x and y go from -1 to 1, like the arrow keys.
//
// It reads the browser's touch events itself, because Phaser ignores touches outside the canvas
// (the dark border around the game on wide screens).
export class TouchPad {
  constructor(scene, onAction) {
    this.scene = scene;
    this.onAction = onAction;
    this.x = 0;
    this.y = 0;
    this.touchId = null;
    if (!IS_TOUCH) return; // computers use the keyboard

    this.base = scene.add.circle(0, 0, RADIUS, 0xffffff, 0.08).setStrokeStyle(2, 0xffffff, 0.5);
    this.knob = scene.add.circle(0, 0, KNOB, 0xffffff, 0.5);
    this.button = scene.add.circle(BUTTON.x, BUTTON.y, RADIUS, COLOR.rogue, 0.25).setStrokeStyle(2, COLOR.rogue, 0.9);
    this.label = addText(scene, BUTTON.x, BUTTON.y, 'Ctrl-C', { size: 8 }).setOrigin(0.5);
    for (const g of [this.base, this.knob, this.button, this.label]) g.setDepth(20);
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
        if (p.y > HUD_HEIGHT) this.press();
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

  press() {
    this.onAction();
    this.button.setFillStyle(COLOR.rogue, 0.7);
    this.scene.time.delayedCall(110, () => this.button.setFillStyle(COLOR.rogue, 0.25));
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
