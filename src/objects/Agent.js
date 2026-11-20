import Phaser from 'phaser';
import { SPRITES, addArt, setArt } from '../art.js';
import { depthAt, toScreen } from '../iso.js';
import { COLOR, FONT_MINI, WIDTH, addText, css } from '../view.js';
import { findPath, randomFloor, tileAt, tileX, tileY } from '../room.js';

const WALK_SPEED = 40; // grid pixels per second (a tile is 16)
const WANDER_SPEED = 28; // hallucinating agents stroll
const DERAIL_MIN = 7; // seconds on task before something goes wrong...
const DERAIL_MAX = 13; // ...at the latest (shorter in later sprints)
const FIRST_DERAIL = 4; // the very first one comes quickly, so you learn the game
const BUG_EVERY = 3.4; // seconds between two bugs from a hallucinating agent
const PUSH_TIME = 1.7; // seconds a rogue agent needs at the database before it is too late
const AUTO_APPROVE_AFTER = 1.6; // with the Auto-approve upgrade
const LINE_TIME = 2600; // milliseconds a speech line stays
const INTERRUPT_LOSS = 0.25; // Ctrl-C on a working agent throws away this much of its PR
const APPROVED_ROGUE = 1.6; // a rogue agent you approved is this much faster
const HEAD = SPRITES.robot.ay; // signs float this far above the feet
const FEET = 2; // the pictures stand a little below the middle of their tile

// Tokens burned per second (in k), by what the agent is doing.
export const BURN = { walk: 0.3, work: 0.45, ask: 0, loop: 2.4, halluc: 1.4, rogue: 0.9, push: 0.9, done: 0 };

const LOOK = { ask: 'robot-ask', loop: 'robot-loop', halluc: 'robot-halluc', rogue: 'robot-rogue', push: 'robot-rogue' };
const SIGN = { ask: 'sign-ask', loop: 'sign-loop', halluc: 'sign-halluc', rogue: 'sign-rogue', push: 'sign-rogue' };
const WEIGHT = { ask: 1, loop: 1, halluc: 1, rogue: 0.8 };

const LINES = {
  ask: ['Can I run npm test?', 'Allow "ls"? (y/n)', 'May I read the README?', 'Run git status?', 'Can I edit one file?', 'Shall I proceed?'],
  loop: ["You're absolutely right!", 'Let me try that again...', 'Retrying...', 'Fixed! (It was not.)', 'One more attempt...'],
  halluc: ['That API definitely exists', 'import magic from "magic"', 'As the docs I made up say...', 'Tests pass! I deleted them', 'Trust me, it compiles'],
  rogue: ['git push --force', 'DROP TABLE users;', 'Skipping the tests...', 'rm -rf /', 'Deploying on Friday!'],
  merge: ['LGTM!', 'Merged!', 'Ship it!', 'Green build!'],
  back: ['On it!', 'Back to work', 'Right, the ticket', 'Sorry!', 'Thanks!'],
  hey: ['Hey! I was working!', 'Why?!', 'Rude.'],
  denied: ['Denied?! Starting over...', 'Fine. From scratch then.'],
  scrapped: ['All of it? OK, starting over', 'Threw it all away...'],
  nothing: ['Nothing to review here', 'Review what?'],
  focus: ['Ah, clear instructions!', 'Now I get it!', 'Reading AGENTS.md...'],
};

const pick = (list) => list[Math.floor(Math.random() * list.length)];

// A coding agent. On task it walks to its desk, works there until the PR is merged, then moves on
// to another desk. Now and then it derails: it asks for permission, loops, hallucinates or goes rogue.
//
// x and y are grid pixels (the rules live on a square grid); `view` is its picture on screen.
export class Agent {
  constructor(scene, x, y) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.mode = 'walk'; // walk, work, ask, loop, halluc, rogue, push or done
    this.path = [];
    this.desk = null;
    this.progress = 0; // 0 to 1 of the PR it is working on
    this.timer = 0;
    this.boost = 1;
    this.lift = 0; // how far the picture is off the ground (cheering)
    this.derailIn = Phaser.Math.FloatBetween(DERAIL_MIN, DERAIL_MAX) * scene.rules.derailEvery;
    this.shadow = addArt(scene, 0, 0, 'shadow').setAlpha(0.3).setDepth(50);
    this.view = addArt(scene, 0, 0, 'robot');
    this.sign = addArt(scene, 0, 0, 'sign-ask').setDepth(5000).setVisible(false);
    this.line = addText(scene, 0, 0, '', { size: 8, font: FONT_MINI, backgroundColor: '#0b0f1a', padding: { x: 3, y: 1 } })
      .setOrigin(0.5, 1)
      .setDepth(5200)
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
    this.line.setText(text).setColor(css(color)).setVisible(true).setAlpha(1);
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
      this.x = tx;
      this.y = ty;
      this.path.shift();
      return this.path.length === 0;
    }
    const dx = ((tx - this.x) / d) * step;
    const dy = ((ty - this.y) / d) * step;
    this.x += dx;
    this.y += dy;
    this.view.setFlipX(dx - dy < 0); // going left on screen
    return false;
  }

  update(dt, time) {
    const scene = this.scene;
    const run = scene.run;
    let hop = 0;
    let shake = 0;
    switch (this.mode) {
      case 'walk':
        hop = Math.abs(Math.sin(time / 100)) * 1.5;
        if (this.follow(dt, WALK_SPEED)) {
          this.mode = 'work';
          this.view.setFlipX(true); // the desk is up and to the right; look that way
        }
        break;
      case 'work':
        hop = Math.abs(Math.sin(time / 160)) * 0.8; // typing
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
        this.view.setFlipX(Math.floor(time / 130) % 2 === 0); // spins on the spot
        hop = Math.abs(Math.sin(time / 65)) * 2;
        break;
      case 'halluc':
        hop = Math.abs(Math.sin(time / 140)) * 1.5;
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
        hop = Math.abs(Math.sin(time / 70)) * 2;
        if (this.follow(dt, scene.rules.rogueSpeed * this.boost)) {
          this.mode = 'push';
          this.timer = PUSH_TIME / this.boost;
          this.say(this.target.kind === 'prod' ? 'Dropping prod...' : 'Force-pushing main...', COLOR.rogue);
        }
        break;
      case 'push':
        this.timer -= dt;
        shake = Math.floor(time / 50) % 2 ? 1 : -1;
        this.view.setTint(Math.floor(this.timer * 10) % 2 ? 0xff8a96 : 0xffffff);
        if (this.timer <= 0) {
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
    this.place(time, hop + this.lift, shake);
    if (this.desk) this.desk.showProgress(this.mode === 'work' || this.progress > 0 ? this.progress : 0);
  }

  // Put the picture, the sign and the speech line where the grid position is on screen.
  place(time, hop = 0, shake = 0) {
    const at = toScreen(this.x, this.y);
    this.screen = at;
    this.shadow.setPosition(at.x, at.y);
    this.view.setPosition(at.x + shake, at.y + FEET - hop).setDepth(depthAt(this.x, this.y));
    this.sign.setPosition(at.x, at.y - HEAD + Math.sin(time / 140) * 1.5);
    if (!this.line.visible) return;
    const half = this.line.width / 2;
    const x = Phaser.Math.Clamp(at.x, half + 2, WIDTH - half - 2);
    this.line.setPosition(x, at.y - HEAD - (this.sign.visible ? 19 : 2));
    const left = this.lineUntil - time;
    if (left <= 0) this.line.setVisible(false);
    else if (left < 300) this.line.setAlpha(left / 300);
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
    if (run.fixes > 0 || run.sprint > 1) {
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
    this.boost = 1;
    setArt(this.view, LOOK[kind]).clearTint();
    setArt(this.sign, SIGN[kind]).setVisible(true);
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

  // Back on task, because you did the right thing.
  fix(text) {
    const was = this.mode;
    this.recover();
    this.say(pick(LINES.back), COLOR.ok);
    this.scene.onFix(this, was, text);
  }

  // Ctrl-C on an agent that only wanted a yes, or a review: it stops, and starts its PR again.
  scrap() {
    const lines = this.mode === 'ask' ? LINES.denied : LINES.scrapped;
    this.recover();
    this.progress = 0;
    this.say(pick(lines), COLOR.dim);
  }

  // You approved a rogue agent. Off it goes, faster.
  encourage() {
    this.boost = APPROVED_ROGUE;
    if (this.mode === 'push') this.timer /= APPROVED_ROGUE;
    this.say('Permission granted!!', COLOR.rogue);
  }

  shrug() {
    this.say(pick(LINES.nothing), COLOR.dim);
  }

  recover() {
    setArt(this.view, 'robot').clearTint();
    this.sign.setVisible(false);
    this.boost = 1;
    this.derailIn = Phaser.Math.FloatBetween(DERAIL_MIN, DERAIL_MAX) * this.scene.rules.derailEvery;
    this.goToDesk();
  }

  // Somebody finally wrote clear instructions: back on task, and nothing goes wrong for `seconds`.
  focus(seconds) {
    if (this.mode === 'done') return;
    if (this.derailed) {
      this.recover();
      this.say(pick(LINES.focus), COLOR.ok);
    }
    this.derailIn = Math.max(this.derailIn, seconds + Math.random() * 3);
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
    this.path = [];
    setArt(this.view, 'robot-happy').clearTint();
    this.sign.setVisible(false);
    if (this.desk) this.desk.showProgress(0);
    this.scene.tweens.add({
      targets: this,
      lift: 5,
      duration: 180,
      yoyo: true,
      repeat: -1,
      delay: Phaser.Math.Between(0, 250),
      ease: 'Sine.out',
    });
  }
}
