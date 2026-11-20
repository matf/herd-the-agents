import Phaser from 'phaser';
import { addArt, setArt } from '../art.js';
import { HH, HW, depthAt, toGridDirection, toScreen } from '../iso.js';
import { TILE } from '../room.js';

const SPEED = 68; // grid pixels per second
const COOLDOWN = 260; // milliseconds between two actions
const REACH = 24; // how far an action reaches, in grid pixels (a tile is 16)
const SAFE_TIME = 1300; // milliseconds you can't be hurt again after a bug bit you
const KNOCKBACK = 190;

// You: the engineer. Walks with Arcade physics on the square grid so the walls and desks stop
// you; what you see is `view`, drawn where the grid position lands on screen.
export class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'pixel');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setVisible(false);
    this.body.setSize(8, 8);
    this.nextAction = 0;
    this.safeUntil = 0;
    this.pushed = 0; // seconds a knockback still lasts
    this.walking = false;
    this.shadow = addArt(scene, 0, 0, 'shadow').setAlpha(0.3).setDepth(50);
    this.view = addArt(scene, 0, 0, 'hero');
    this.ring = scene.add.graphics().setDepth(51);
    this.icon = addArt(scene, 0, 0, 'icon-approve').setDepth(6000).setVisible(false);
    this.place(0);
  }

  // dx, dy: -1 to 1 on screen, like a joystick.
  move(dx, dy, factor, dt) {
    if (this.pushed > 0) {
      this.pushed -= dt;
      return;
    }
    const push = Math.min(1, Math.hypot(dx, dy));
    this.walking = push > 0.2;
    if (push === 0) {
      this.setVelocity(0, 0);
      return;
    }
    const direction = toGridDirection(dx, dy);
    this.setVelocity(direction.x * SPEED * factor * push, direction.y * SPEED * factor * push);
    if (Math.abs(dx) > 0.2) this.view.setFlipX(dx < 0);
  }

  // Put the picture where the grid position is on screen.
  place(time) {
    const at = toScreen(this.x, this.y);
    const hop = this.walking ? Math.abs(Math.sin(time / 90)) * 2 : 0;
    this.shadow.setPosition(at.x, at.y);
    this.view.setPosition(at.x, at.y + 2 - hop).setDepth(depthAt(this.x, this.y));
    this.screen = at;
  }

  // False while the last action is still cooling down.
  canAct(now) {
    return now >= this.nextAction;
  }

  // Show the action: a ring on the floor as wide as it reaches, and its icon over your head.
  act(now, action, reachFactor) {
    this.nextAction = now + COOLDOWN;
    const reach = (REACH * reachFactor) / TILE;
    const at = this.screen;
    this.ring.clear().setPosition(at.x, at.y).setAlpha(1).setScale(0.3);
    this.ring.fillStyle(action.color, 0.25).fillEllipse(0, 0, reach * HW * 2.8, reach * HH * 2.8);
    this.ring.lineStyle(1.5, action.color, 1).strokeEllipse(0, 0, reach * HW * 2.8, reach * HH * 2.8);
    this.scene.tweens.add({ targets: this.ring, scale: 1, alpha: 0, duration: 240, ease: 'Cubic.out' });
    setArt(this.icon, action.icon).setTint(action.color).setPosition(at.x, at.y - 28).setAlpha(1).setVisible(true);
    this.scene.tweens.add({ targets: this.icon, y: at.y - 38, alpha: 0, duration: 380, ease: 'Cubic.out' });
  }

  // Does an action reach something at grid position x, y?
  reaches(x, y, reachFactor) {
    return Math.hypot(x - this.x, y - this.y) <= REACH * reachFactor;
  }

  // Bitten by a bug at x, y. False while you are still blinking from the last bite.
  hurt(now, x, y) {
    if (now < this.safeUntil) return false;
    this.safeUntil = now + SAFE_TIME;
    const away = new Phaser.Math.Vector2(this.x - x, this.y - y).normalize().scale(KNOCKBACK);
    this.setVelocity(away.x, away.y);
    this.pushed = 0.12;
    this.scene.tweens.add({
      targets: this.view,
      alpha: 0.25,
      duration: 90,
      yoyo: true,
      repeat: Math.floor(SAFE_TIME / 180) - 1,
      onComplete: () => this.view.setAlpha(1),
    });
    return true;
  }
}
