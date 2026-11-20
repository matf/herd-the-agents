import Phaser from 'phaser';
import { T } from '../tiles.js';
import { COLOR } from '../view.js';

const SPEED = 72; // pixels per second
const SWING_COOLDOWN = 260; // milliseconds between two Ctrl-Cs
const REACH = 25; // how far Ctrl-C reaches, in pixels
const ARC = Phaser.Math.DegToRad(75); // ...to both sides of where you look
const CLOSE = 11; // this close it hits in every direction
const SAFE_TIME = 1300; // milliseconds you can't be hurt again after a bug bit you
const KNOCKBACK = 190;

// You: the engineer. Walks with Arcade physics so the walls and desks stop you.
export class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'tiles', T.hero);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setTint(COLOR.hero).setDepth(6);
    this.body.setSize(8, 8).setOffset(4, 7);
    this.facing = new Phaser.Math.Vector2(0, -1); // where the last step went
    this.nextSwing = 0;
    this.safeUntil = 0;
    this.pushed = 0; // seconds a knockback still lasts
    this.arc = scene.add.graphics().setDepth(8);
  }

  // dx, dy: -1 to 1, like a joystick.
  move(dx, dy, factor, dt) {
    if (this.pushed > 0) {
      this.pushed -= dt;
      return;
    }
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }
    this.setVelocity(dx * SPEED * factor, dy * SPEED * factor);
    if (len > 0.2) {
      this.facing.set(dx, dy).normalize();
      if (Math.abs(dx) > 0.2) this.setFlipX(dx < 0);
    }
  }

  // Swing Ctrl-C. False while the last swing is still cooling down.
  swing(now, reachFactor) {
    if (now < this.nextSwing) return false;
    this.nextSwing = now + SWING_COOLDOWN;
    const angle = this.facing.angle();
    const reach = REACH * reachFactor;
    this.arc.clear().setAlpha(1).setPosition(this.x, this.y);
    this.arc.lineStyle(3, 0xffffff, 1);
    this.arc.beginPath();
    this.arc.arc(0, 0, reach - 5, angle - ARC, angle + ARC);
    this.arc.strokePath();
    this.arc.lineStyle(1, COLOR.hero, 1);
    this.arc.beginPath();
    this.arc.arc(0, 0, reach - 1, angle - ARC * 0.8, angle + ARC * 0.8);
    this.arc.strokePath();
    this.scene.tweens.add({ targets: this.arc, alpha: 0, duration: 160 });
    return true;
  }

  // Would a swing hit something at x, y?
  reaches(x, y, reachFactor) {
    const dx = x - this.x;
    const dy = y - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= CLOSE) return true;
    if (dist > REACH * reachFactor) return false;
    const off = Phaser.Math.Angle.Wrap(Math.atan2(dy, dx) - this.facing.angle());
    return Math.abs(off) <= ARC;
  }

  // Bitten by a bug at x, y. False while you are still blinking from the last bite.
  hurt(now, x, y) {
    if (now < this.safeUntil) return false;
    this.safeUntil = now + SAFE_TIME;
    const away = new Phaser.Math.Vector2(this.x - x, this.y - y).normalize().scale(KNOCKBACK);
    this.setVelocity(away.x, away.y);
    this.pushed = 0.12;
    this.scene.tweens.add({
      targets: this,
      alpha: 0.25,
      duration: 90,
      yoyo: true,
      repeat: Math.floor(SAFE_TIME / 180) - 1,
      onComplete: () => this.setAlpha(1),
    });
    return true;
  }
}
