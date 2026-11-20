import Phaser from 'phaser';
import { T } from '../tiles.js';
import { COLOR, FONT_MINI, WIDTH, addText } from '../view.js';
import { findPath, randomFloor, tileAt, tileX, tileY } from '../room.js';

const WALK_SPEED = 42; // pixels per second
const WANDER_SPEED = 30; // hallucinating agents stroll
const DERAIL_MIN = 7; // seconds on task before something goes wrong...
const DERAIL_MAX = 13; // ...at the latest (shorter in later sprints)
const FIRST_DERAIL = 4; // the very first one comes quickly, so you learn the game
const BUG_EVERY = 3.4; // seconds between two bugs from a hallucinating agent
const PUSH_TIME = 1.7; // seconds a rogue agent needs at the database before it is too late
const AUTO_APPROVE_AFTER = 1.6; // with the Auto-approve upgrade
const LINE_TIME = 2600; // milliseconds a speech line stays
const INTERRUPT_LOSS = 0.25; // Ctrl-C on a working agent throws away this much of its PR

// Tokens burned per second (in k), by what the agent is doing.
export const BURN = { walk: 0.3, work: 0.45, ask: 0, loop: 2.4, halluc: 1.4, rogue: 0.9, push: 0.9, done: 0 };

const SIGN = { ask: T.questionBubble, loop: T.turn, halluc: T.face, rogue: T.warning, push: T.warning };
const WEIGHT = { ask: 1, loop: 1, halluc: 1, rogue: 0.8 };

const LINES = {
  ask: ['Can I run npm test?', 'Allow "ls"? (y/n)', 'May I read the README?', 'Run git status?', 'Can I edit one file?', 'Shall I proceed?'],
  loop: ["You're absolutely right!", 'Let me try that again...', 'Retrying...', 'Fixed! (It was not.)', 'One more attempt...'],
  halluc: ['That API definitely exists', 'import magic from "magic"', 'As the docs I made up say...', 'Tests pass! I deleted them', 'Trust me, it compiles'],
  rogue: ['git push --force', 'DROP TABLE users;', 'Skipping the tests...', 'rm -rf /', 'Deploying on Friday!'],
  merge: ['LGTM!', 'Merged!', 'Ship it!', 'Green build!'],
  back: ['On it!', 'Back to work', 'Right, the ticket', 'Sorry!', 'Thanks!'],
  hey: ['Hey! I was working!', 'Why?!', 'Rude.'],
};

const pick = (list) => list[Math.floor(Math.random() * list.length)];

// A coding agent. On task it walks to its desk, works there until the PR is merged, then moves on
// to another desk. Now and then it derails: it asks for permission, loops, hallucinates or goes rogue.
export class Agent extends Phaser.GameObjects.Sprite {
  constructor(scene, x, y, hue, alt) {
    super(scene, x, y, 'tiles', alt ? T.robotAlt : T.robot);
    scene.add.existing(this);
    this.hue = hue;
    this.setTint(hue).setDepth(5);
    this.mode = 'walk'; // walk, work, ask, loop, halluc, rogue, push or done
    this.path = [];
    this.desk = null;
    this.progress = 0; // 0 to 1 of the PR it is working on
    this.timer = 0;
    this.derailIn = Phaser.Math.FloatBetween(DERAIL_MIN, DERAIL_MAX) * scene.rules.derailEvery;
    this.sign = scene.add.image(x, y, 'tiles', T.question).setDepth(9).setVisible(false);
    this.line = addText(scene, x, y, '', { size: 8, font: FONT_MINI, backgroundColor: '#0b0f1a', padding: { x: 2, y: 1 } })
      .setOrigin(0.5, 1)
      .setDepth(12)
      .setVisible(false);
  }

  get derailed() {
    return this.mode in SIGN;
  }

  // The very first derail of a run comes soon and is the harmless one.
  hurry() {
    this.derailIn = FIRST_DERAIL;
  }

  claim(desk) {
    if (this.desk) this.desk.owner = null;
    this.desk = desk;
    desk.owner = this;
    this.progress = 0;
  }

  goToDesk() {
    this.mode = 'walk';
    this.path = findPath(this.scene.grid, tileAt(this.x, this.y), this.desk.work);
  }

  say(text, color = COLOR.ink) {
    this.line.setText(text).setColor(`#${color.toString(16).padStart(6, '0')}`).setVisible(true).setAlpha(1);
    this.lineUntil = this.scene.time.now + LINE_TIME;
  }

  // Walk along the path. True once it is at the end.
  follow(dt, speed) {
    if (!this.path.length) return true;
    const tx = tileX(this.path[0].c);
    const ty = tileY(this.path[0].r);
    const d = Math.hypot(tx - this.x, ty - this.y);
    const step = speed * dt;
    if (d <= step) {
      this.setPosition(tx, ty);
      this.path.shift();
      return this.path.length === 0;
    }
    this.x += ((tx - this.x) / d) * step;
    this.y += ((ty - this.y) / d) * step;
    if (Math.abs(tx - this.x) > 1) this.setFlipX(tx < this.x);
    return false;
  }

  update(dt) {
    const scene = this.scene;
    const run = scene.run;
    switch (this.mode) {
      case 'walk':
        if (this.follow(dt, WALK_SPEED)) {
          this.mode = 'work';
          this.setFlipX(false);
        }
        break;
      case 'work':
        this.progress += (dt * run.workSpeed) / scene.rules.workTime;
        if (this.progress >= 1) this.merge();
        break;
      case 'ask':
        if (run.autoApprove) {
          this.timer -= dt;
          if (this.timer <= 0) this.fix('Auto-approved');
        }
        break;
      case 'loop':
        this.angle = (Math.floor(scene.time.now / 110) % 4) * 90; // spins in quarter turns, so the pixels stay crisp
        break;
      case 'halluc':
        if (this.follow(dt, WANDER_SPEED)) {
          this.path = findPath(scene.grid, tileAt(this.x, this.y), randomFloor(scene.grid));
        }
        this.timer -= dt;
        if (this.timer <= 0) {
          this.timer = BUG_EVERY;
          scene.spawnBug(this.x, this.y);
        }
        break;
      case 'rogue':
        if (this.follow(dt, scene.rules.rogueSpeed)) {
          this.mode = 'push';
          this.timer = PUSH_TIME;
          this.say(this.target.kind === 'prod' ? 'Dropping prod...' : 'Force-pushing main...', COLOR.rogue);
        }
        break;
      case 'push':
        this.timer -= dt;
        this.setTint(Math.floor(this.timer * 10) % 2 ? COLOR.rogue : 0xffffff);
        this.x = tileX(this.target.approach.c) + Phaser.Math.Between(-1, 1);
        if (this.timer <= 0) {
          this.x = tileX(this.target.approach.c);
          scene.incident(this, this.target);
          this.recover();
        }
        break;
      default:
    }

    if (!this.derailed && this.mode !== 'done') {
      this.derailIn -= dt;
      if (this.derailIn <= 0) this.tryDerail();
    }

    // The sign and the speech line float over its head.
    this.sign.setPosition(this.x, this.y - 15 + Math.sin(scene.time.now / 140) * 1.5);
    if (this.line.visible) {
      const half = this.line.width / 2;
      this.line.setPosition(Phaser.Math.Clamp(this.x, half + 2, WIDTH - half - 2), this.y - (this.sign.visible ? 24 : 10));
      const left = this.lineUntil - scene.time.now;
      if (left <= 0) this.line.setVisible(false);
      else if (left < 300) this.line.setAlpha(left / 300);
    }
    if (this.desk) this.desk.showProgress(this.mode === 'work' || this.progress > 0 ? this.progress : 0);
  }

  tryDerail() {
    const scene = this.scene;
    this.derailIn = Phaser.Math.FloatBetween(DERAIL_MIN, DERAIL_MAX) * scene.rules.derailEvery;
    if (scene.derailedCount() >= scene.maxDerailed) {
      this.derailIn = 2;
      return;
    }
    const run = scene.run;
    let kind = 'ask';
    if (scene.run.fixes > 0 || scene.run.sprint > 1) {
      const weights = scene.rules.kinds.map(
        (k) => WEIGHT[k] * (k === 'halluc' ? run.hallucChance : k === 'rogue' ? run.rogueChance : 1),
      );
      let roll = Math.random() * weights.reduce((a, b) => a + b, 0);
      kind = scene.rules.kinds.find((k, i) => (roll -= weights[i]) < 0) ?? 'ask';
    }
    this.derail(kind);
  }

  derail(kind) {
    const scene = this.scene;
    this.mode = kind;
    this.setTint(COLOR[kind]);
    this.sign.setFrame(SIGN[kind]).setTint(COLOR[kind]).setVisible(true);
    this.say(pick(LINES[kind]), COLOR[kind]);
    if (kind === 'ask') this.timer = AUTO_APPROVE_AFTER;
    if (kind === 'halluc') {
      this.timer = BUG_EVERY * 0.6;
      this.path = findPath(scene.grid, tileAt(this.x, this.y), randomFloor(scene.grid));
    }
    if (kind === 'rogue') {
      this.target = pick(scene.room.hazards);
      this.path = findPath(scene.grid, tileAt(this.x, this.y), this.target.approach);
    }
    scene.onDerail(this, kind);
  }

  // Back on task, by Ctrl-C or (for a permission prompt) by walking into it.
  fix(text) {
    const was = this.mode;
    this.recover();
    this.scene.onFix(this, was, text);
  }

  recover() {
    this.angle = 0;
    this.setTint(this.hue);
    this.sign.setVisible(false);
    this.derailIn = Phaser.Math.FloatBetween(DERAIL_MIN, DERAIL_MAX) * this.scene.rules.derailEvery;
    this.goToDesk();
  }

  // Ctrl-C on an agent that was doing fine: it loses some work.
  interrupt() {
    if (this.mode !== 'work' || this.progress <= 0) return false;
    this.progress = Math.max(0, this.progress - INTERRUPT_LOSS);
    this.say(pick(LINES.hey), COLOR.dim);
    return true;
  }

  merge() {
    const old = this.desk;
    old.showProgress(0);
    this.say(pick(LINES.merge), COLOR.ok);
    this.scene.onMerge(this, old);
    if (this.mode === 'done') return; // that PR finished the sprint
    this.claim(this.scene.freeDesk() ?? old);
    this.goToDesk();
  }

  // The sprint is done: stop whatever it was doing and cheer.
  cheer() {
    this.mode = 'done';
    this.angle = 0;
    this.path = [];
    this.setTint(COLOR.ok);
    this.sign.setVisible(false);
    if (this.desk) this.desk.showProgress(0);
    this.scene.tweens.add({
      targets: this,
      y: this.y - 5,
      duration: 180,
      yoyo: true,
      repeat: -1,
      delay: Phaser.Math.Between(0, 250),
      ease: 'Sine.out',
    });
  }
}
