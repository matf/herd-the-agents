import Phaser from 'phaser';
import { ACTIONS, NEEDS, actionForKey } from '../actions.js';
import { ART_SCALE, SPRITES, addArt, makeRoomTexture, setArt } from '../art.js';
import { depthAt, tileScreen, toScreen } from '../iso.js';
import { COLOR, FONT_MINI, WIDTH, addText, css, setupCamera } from '../view.js';
import { IS_TOUCH } from '../touch.js';
import { play } from '../sound.js';
import { PR_REFUND, SPRINT_BONUS, sprintRules } from '../run.js';
import { COLS, DOOR, ROWS, START, TILE, WALL, generateRoom, randomFloor, tileX, tileY } from '../room.js';
import { Player } from '../objects/Player.js';
import { Agent, BURN } from '../objects/Agent.js';
import { BUG_COLOR, Bug } from '../objects/Bug.js';
import { TouchPad } from '../objects/TouchPad.js';
import { Pickup } from '../objects/Pickup.js';
import { COFFEE_SPEED, COFFEE_TIME, FOCUS_TIME, TOKEN_PACK, choosePickup } from '../pickups.js';

const HAZARD_LABEL = { prod: 'PROD', main: 'MAIN' };
const BITE_DISTANCE = 8; // a bug this close bites (grid pixels)
const DERAILED_SHARE = 0.67; // at most this share of the agents is derailed at the same time
const INCIDENT_COST = 8; // tokens an incident costs, on top of the heart
const WRONG_APPROVE_COST = 3; // tokens thrown away by approving a looping agent
const PICKUP_FIRST = [6, 10]; // seconds into the sprint until the first power-up turns up
const PICKUP_EVERY = [12, 18]; // ...and between two of them
const PICKUP_DISTANCE = 11; // this close and you have it (grid pixels)
const PICKUP_AWAY = 40; // they never turn up closer to you than this
const TOAST_TIME = 4500;
const TOAST_Y = 281; // just below the room
const CHEAT_Y = 336; // the row of reminders between the room and the controls
const EFFECTS = 6000; // depth of sparks and floating texts: above everything in the room

const HINTS = {
  ask: 'PERMISSION PROMPT: go to the agent and APPROVE it.',
  loop: 'LOOPING: it burns tokens fast. Go and CTRL-C it!',
  halluc: 'HALLUCINATING: REVIEW its work. REVIEW squashes its bugs, too!',
  rogue: 'GONE ROGUE: CTRL-C it before it reaches PROD or MAIN!',
};
const FIXED = { approve: 'Approved', stop: '^C', review: 'Reviewed' };

// One sprint: a random room full of agents. Merge enough PRs and the door opens.
//
// The rules run on a square grid (src/room.js): positions are "grid pixels", 16 to a tile.
// What you see is that grid drawn from an angle (src/iso.js); toScreen() turns one into the other.
export class GameScene extends Phaser.Scene {
  constructor() {
    super('game');
  }

  create() {
    setupCamera(this);
    this.run = this.registry.get('run');
    this.rules = sprintRules(this.run.sprint);
    this.run.sprintPrs = 0;
    this.run.ciReady = this.run.ciGate;
    this.room = generateRoom(this.rules.agents + 1);
    this.grid = this.room.grid;
    this.maxDerailed = Math.ceil(this.rules.agents * DERAILED_SHARE);
    this.doorOpen = false;
    this.ending = false;
    this.buildRoom();

    this.player = new Player(this, tileX(START.c), tileY(START.r));
    this.physics.add.collider(this.player, this.solids);

    this.agents = [];
    for (let i = 0; i < this.rules.agents; i++) {
      const at = randomFloor(this.grid);
      const agent = new Agent(this, tileX(at.c), tileY(at.r));
      agent.claim(this.freeDesk());
      agent.goToDesk();
      this.agents.push(agent);
    }
    if (this.run.sprint === 1) this.agents[0].hurry();
    this.bugs = [];
    this.pickups = [];
    this.sprintTime = 0; // seconds in this room
    this.nextPickup = Phaser.Math.FloatBetween(...PICKUP_FIRST);
    this.coffeeUntil = 0;
    this.nextPuff = 0;

    this.sparks = this.add
      .particles(0, 0, 'pixel', {
        speed: { min: 25, max: 85 },
        lifespan: { min: 220, max: 480 },
        scale: { start: 1.2, end: 0 },
        emitting: false,
      })
      .setDepth(EFFECTS);

    this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT');
    // The three actions are on J K L (or Z X C, or 1 2 3). An event, so even the quickest tap counts.
    this.input.keyboard.addCapture('SPACE');
    // (Phaser can hand over the same key press twice when two arrive within one frame: skip those.)
    let lastPress = 0;
    this.input.keyboard.on('keydown', (event) => {
      if (event.repeat || event.timeStamp <= lastPress) return;
      lastPress = event.timeStamp;
      const action = actionForKey(event.key);
      if (action) this.pad.press(action);
    });
    this.pad = new TouchPad(this, (action) => this.act(action));
    this.buildPanel();

    this.scene.launch('ui');
    this.events.once('shutdown', () => this.scene.stop('ui'));

    this.toast(
      this.run.sprint === 1
        ? `Merge ${this.rules.goal} PRs to finish the sprint. Keep your agents on task!`
        : `SPRINT ${this.run.sprint}: merge ${this.rules.goal} PRs.${this.rules.burn > 1 ? ` Long context: +${Math.round((this.rules.burn - 1) * 100)}% token burn.` : ''}`,
    );
  }

  buildRoom() {
    const { desks, hazards, obstacles } = this.room;
    makeRoomTexture(this, this.run.sprint);
    this.add.image(0, 0, 'room').setOrigin(0).setScale(1 / ART_SCALE);

    // What you bump into: invisible boxes on the grid. The pictures are separate.
    this.solids = this.physics.add.staticGroup();
    const solid = (c, r) => {
      const box = this.add.zone(tileX(c), tileY(r), TILE, TILE);
      this.solids.add(box);
      return box;
    };
    // A thing standing on a floor tile.
    const thing = (c, r, key) => {
      solid(c, r);
      const at = tileScreen(c, r);
      return addArt(this, at.x, at.y, key).setDepth(depthAt(tileX(c), tileY(r)));
    };

    for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
      if (this.grid[r * COLS + c] === WALL && !(c === DOOR.c && r === DOOR.r)) solid(c, r);
    }
    this.doorBox = solid(DOOR.c, DOOR.r);
    const doorAt = toScreen(tileX(DOOR.c), TILE); // the foot of the wall, in the middle of the door
    this.door = addArt(this, doorAt.x, doorAt.y, 'door-closed').setDepth(1);
    this.exit = addText(this, doorAt.x, doorAt.y - 44, 'EXIT', { size: 8, color: COLOR.ok, backgroundColor: '#0b0f1a', padding: { x: 3, y: 1 } })
      .setOrigin(0.5)
      .setDepth(EFFECTS)
      .setVisible(false);

    for (const o of obstacles) thing(o.c, o.r, o.kind);

    for (const h of hazards) {
      const image = thing(h.c, h.r, h.kind);
      addText(this, Phaser.Math.Clamp(image.x, 18, WIDTH - 18), image.y - SPRITES[h.kind].ay - 6, HAZARD_LABEL[h.kind], {
        size: 8,
        font: FONT_MINI,
        color: h.kind === 'prod' ? 0xff8fa0 : 0xffd166,
        backgroundColor: '#0b0f1a',
        padding: { x: 3, y: 1 },
      })
        .setOrigin(0.5)
        .setDepth(EFFECTS - 1);
    }

    for (const d of desks) {
      const image = thing(d.c, d.r, 'desk');
      // How far the PR at this desk is: a little bar over the monitor.
      const x = image.x - 8;
      const y = image.y - SPRITES.desk.ay - 3;
      const back = this.add.rectangle(x - 1, y, 18, 5, COLOR.bg).setOrigin(0, 0.5).setDepth(EFFECTS - 2);
      const bar = this.add.rectangle(x, y, 16, 3, COLOR.ok).setOrigin(0, 0.5).setDepth(EFFECTS - 2);
      d.owner = null;
      d.screen = { x: image.x, y: image.y };
      d.showProgress = (progress) => {
        back.setVisible(progress > 0);
        bar.setVisible(progress > 0).setScale(Math.min(1, progress), 1);
      };
      d.showProgress(0);
    }
  }

  // Below the room: the toast line, and how to walk.
  buildPanel() {
    this.toastText = addText(this, WIDTH / 2, TOAST_Y, '', {
      size: 8,
      font: FONT_MINI,
      align: 'center',
      wordWrap: { width: WIDTH - 36 },
    })
      .setOrigin(0.5, 0)
      .setDepth(9000);

    // A reminder of which action each misbehaviour needs.
    Object.entries(NEEDS).filter(([mode]) => mode !== 'push').forEach(([mode, needs], i) => {
      const x = WIDTH / 2 - 87 + i * 58;
      const action = ACTIONS[needs];
      addArt(this, x - 9, CHEAT_Y + 7, `sign-${mode}`);
      this.add.circle(x + 9, CHEAT_Y, 7, action.color, 0.22).setStrokeStyle(1, action.color, 0.95);
      addArt(this, x + 9, CHEAT_Y, action.icon).setTint(action.color).setScale(0.14);
    });

    if (IS_TOUCH) return; // phones show the joystick here (TouchPad)
    addText(this, 58, 408, 'WALK', { size: 8, color: COLOR.dim }).setOrigin(0.5);
    addText(this, 58, 420, 'WASD or\nARROW KEYS', { size: 8, font: FONT_MINI, color: COLOR.dim, align: 'center' }).setOrigin(0.5, 0);
  }

  toast(text, color = COLOR.ink) {
    this.toastText.setText(text).setColor(css(color)).setAlpha(1);
    this.toastUntil = this.time.now + TOAST_TIME;
  }

  update(time, delta) {
    if (this.ending) return;
    const dt = Math.min(delta, 50) / 1000;
    const run = this.run;
    const k = this.keys;
    run.time += dt;
    this.sprintTime += dt;
    const coffee = this.sprintTime < this.coffeeUntil;

    const dx = this.pad.x || (k.RIGHT.isDown || k.D.isDown ? 1 : 0) - (k.LEFT.isDown || k.A.isDown ? 1 : 0);
    const dy = this.pad.y || (k.DOWN.isDown || k.S.isDown ? 1 : 0) - (k.UP.isDown || k.W.isDown ? 1 : 0);
    this.player.move(dx, dy, run.speed * (coffee ? COFFEE_SPEED : 1), dt);
    this.player.place(time);
    if (coffee && this.player.walking && time > this.nextPuff) {
      this.nextPuff = time + 70;
      this.burst(this.player.x, this.player.y, 0xffe6cc, 1, 2);
    }
    this.updatePickups(dt, time);

    let burn = 0;
    for (const agent of this.agents) {
      agent.update(dt, time);
      burn += BURN[agent.mode];
    }
    if (this.ending) return; // an incident just ended the run
    run.burning = burn * run.burn * this.rules.burn;
    run.budget -= run.burning * dt;

    for (const bug of this.bugs) {
      bug.update(dt, time, this.player, this.rules.bugSpeed * run.bugSpeed);
      if (!bug.harmless && Phaser.Math.Distance.Between(bug.x, bug.y, this.player.x, this.player.y) < BITE_DISTANCE) {
        this.bite(bug);
        if (this.ending) return;
      }
    }

    if (this.toastText.alpha > 0 && time > this.toastUntil) this.toastText.setAlpha(Math.max(0, 1 - (time - this.toastUntil) / 400));

    if (this.doorOpen && this.player.y < TILE * 0.8) this.leave();
    else if (run.budget <= 0) {
      run.budget = 0;
      this.gameOver('budget');
    }
  }

  // --- Your three actions: approve, Ctrl-C and review ---

  // Do `kind` to everything within reach. Each misbehaviour needs one of the three (NEEDS);
  // the wrong one makes things worse.
  act(kind) {
    if (this.ending || !this.player.canAct(this.time.now)) return;
    const run = this.run;
    this.player.act(this.time.now, ACTIONS[kind], run.reach);
    const reaches = (o) => this.player.reaches(o.x, o.y, run.reach);
    let right = 0;
    let wrong = 0;

    if (kind === 'review') {
      for (const bug of this.bugs.filter(reaches)) {
        this.squash(bug);
        right++;
      }
    }
    for (const agent of this.agents) {
      if (!agent.derailed || !reaches(agent)) continue;
      if (NEEDS[agent.mode] === kind) {
        agent.fix(FIXED[kind]);
        right++;
      } else {
        this.mistake(agent, kind);
        wrong++;
      }
    }
    // Ctrl-C with nothing derailed around hits whoever was happily working there.
    if (kind === 'stop' && !right && !wrong && this.agents.find((a) => a.mode === 'work' && reaches(a))?.interrupt()) wrong++;

    if (wrong) play(this, 'oops');
    else if (!right) play(this, 'swing');
  }

  // The wrong action for what this agent is doing.
  mistake(agent, kind) {
    const run = this.run;
    if (kind === 'review') {
      agent.shrug();
    } else if (kind === 'stop') {
      // A permission prompt or a hallucination: Ctrl-C does stop it, but the PR is gone.
      const was = agent.mode;
      agent.scrap();
      this.burst(agent.x, agent.y, COLOR.dim, 8);
      this.float(agent.x, agent.y, 'PR lost', COLOR.rogue);
      this.hintOnce(`stop-${was}`, was === 'ask' ? 'It only needed a yes: APPROVE keeps its work. CTRL-C threw it away.' : 'A REVIEW would have kept its work. CTRL-C threw it away.');
    } else if (agent.mode === 'loop') {
      run.budget = Math.max(0, run.budget - WRONG_APPROVE_COST);
      agent.say('Approved! Retrying forever', COLOR.loop);
      this.float(agent.x, agent.y, `-${WRONG_APPROVE_COST}k`, COLOR.rogue);
      this.hintOnce('approve-loop', 'Never approve a loop: that just burned tokens. CTRL-C it!');
    } else if (agent.mode === 'halluc') {
      agent.say('Great, shipping it!', COLOR.halluc);
      this.spawnBug(agent.x, agent.y);
      this.hintOnce('approve-halluc', 'You approved a hallucination: one more bug. REVIEW it instead!');
    } else {
      agent.encourage();
      this.hintOnce('approve-rogue', 'You approved a rogue agent?! Now it is even faster. CTRL-C!');
    }
  }

  // An explanation that is only shown the first time.
  hintOnce(key, text, color = COLOR.loop) {
    if (this.run.hinted.includes(key)) return;
    this.run.hinted.push(key);
    this.toast(text, color);
  }

  // --- Power-ups ---

  updatePickups(dt, time) {
    if (!this.doorOpen && !this.pickups.length && this.sprintTime >= this.nextPickup) this.spawnPickup();
    for (const pickup of [...this.pickups]) {
      const near = Phaser.Math.Distance.Between(pickup.x, pickup.y, this.player.x, this.player.y) < PICKUP_DISTANCE;
      if (near) this.collect(pickup);
      else if (!pickup.update(dt, time)) this.removePickup(pickup);
    }
  }

  // Put a power-up on a free tile, not right next to you. `kind` is one from src/pickups.js (left out: a useful one is chosen).
  spawnPickup(kind = choosePickup(this)) {
    this.nextPickup = this.sprintTime + Phaser.Math.FloatBetween(...PICKUP_EVERY);
    let at = randomFloor(this.grid);
    for (let i = 0; i < 30 && Phaser.Math.Distance.Between(tileX(at.c), tileY(at.r), this.player.x, this.player.y) < PICKUP_AWAY; i++) {
      at = randomFloor(this.grid);
    }
    const pickup = new Pickup(this, tileX(at.c), tileY(at.r), kind);
    this.pickups.push(pickup);
    this.hintOnce('pickup', 'A POWER-UP! Walk over it to grab it before it is gone.', COLOR.ok);
    return pickup;
  }

  removePickup(pickup) {
    this.pickups.splice(this.pickups.indexOf(pickup), 1);
    pickup.destroy();
  }

  collect(pickup) {
    const run = this.run;
    const kind = pickup.kind;
    run.powerups++;
    play(this, 'pickup');
    this.burst(pickup.x, pickup.y, kind.color, 14, 6);
    this.float(pickup.x, pickup.y, kind.name, kind.color);
    this.toast(`${kind.name}: ${kind.text}`, kind.color);
    this.removePickup(pickup);
    switch (kind.key) {
      case 'coffee':
        this.coffeeUntil = this.sprintTime + COFFEE_TIME;
        break;
      case 'tokens':
        run.budget = Math.min(run.maxBudget, run.budget + TOKEN_PACK);
        break;
      case 'docs':
        for (const agent of this.agents) agent.focus(FOCUS_TIME);
        break;
      case 'duck':
        for (const bug of [...this.bugs]) this.squash(bug);
        break;
      case 'heart':
        run.hearts = Math.min(run.maxHearts, run.hearts + 1);
        break;
      default:
    }
  }

  // --- What the agents report ---

  derailedCount() {
    return this.agents.filter((a) => a.derailed).length;
  }

  freeDesk() {
    return Phaser.Utils.Array.GetRandom(this.room.desks.filter((d) => !d.owner));
  }

  onDerail(agent, kind) {
    play(this, kind === 'rogue' ? 'rogue' : 'derail');
    this.hintOnce(kind, HINTS[kind], COLOR[kind]);
  }

  onFix(agent, was, text) {
    this.run.fixes++;
    play(this, was === 'ask' ? 'approve' : 'fix');
    this.burst(agent.x, agent.y, COLOR[was === 'push' ? 'rogue' : was], 8);
    this.float(agent.x, agent.y, text, COLOR.ink);
  }

  onMerge(agent, desk) {
    const run = this.run;
    run.prs++;
    run.sprintPrs++;
    run.budget = Math.min(run.maxBudget, run.budget + PR_REFUND);
    play(this, 'merge');
    this.burst(tileX(desk.c), tileY(desk.r), COLOR.ok, 12);
    this.float(tileX(desk.c), tileY(desk.r), '+1 PR', COLOR.ok);
    if (run.sprintPrs >= this.rules.goal && !this.doorOpen) this.openDoor();
  }

  spawnBug(x, y) {
    if (this.bugs.length >= this.rules.maxBugs) return;
    this.bugs.push(new Bug(this, x, y));
  }

  squash(bug) {
    this.run.squashed++;
    play(this, 'squash');
    this.burst(bug.x, bug.y, BUG_COLOR, 8, 3);
    this.bugs.splice(this.bugs.indexOf(bug), 1);
    bug.destroy();
  }

  bite(bug) {
    if (!this.player.hurt(this.time.now, bug.x, bug.y)) return;
    this.squash(bug);
    this.loseHeart('bugs', 'Ouch! A bug! REVIEW squashes them.');
  }

  // A rogue agent got through to prod or main.
  incident(agent, hazard) {
    const run = this.run;
    const name = HAZARD_LABEL[hazard.kind];
    if (run.ciReady) {
      run.ciReady = false;
      play(this, 'approve');
      this.burst(tileX(hazard.c), tileY(hazard.r), COLOR.ok, 14);
      this.toast(`The CI gate blocked the push to ${name}. Once.`, COLOR.ok);
      return;
    }
    run.incidents++;
    run.budget = Math.max(0, run.budget - INCIDENT_COST);
    this.burst(tileX(hazard.c), tileY(hazard.r), COLOR.rogue, 24);
    this.cameras.main.flash(180, 255, 77, 94);
    this.loseHeart('incident', hazard.kind === 'prod' ? 'INCIDENT! The agent dropped the prod database.' : 'INCIDENT! The agent force-pushed to main.');
  }

  loseHeart(reason, text) {
    const run = this.run;
    run.hearts--;
    play(this, reason === 'incident' ? 'incident' : 'hurt');
    this.cameras.main.shake(220, 0.0015);
    this.toast(text, COLOR.rogue);
    if (run.hearts <= 0) this.gameOver(reason);
  }

  // --- Effects (x, y in grid pixels; `up` is how far above the floor) ---

  burst(x, y, color, count, up = 12) {
    const at = toScreen(x, y);
    this.sparks.setParticleTint(color);
    this.sparks.explode(count, at.x, at.y - up);
  }

  float(x, y, text, color) {
    const at = toScreen(x, y);
    const label = addText(this, at.x, at.y - 30, text, { size: 8, color, stroke: '#0b0f1a', strokeThickness: 3 }).setOrigin(0.5).setDepth(EFFECTS + 1);
    this.tweens.add({ targets: label, y: at.y - 48, alpha: 0, duration: 1000, ease: 'Cubic.out', onComplete: () => label.destroy() });
  }

  // --- The end of the sprint, or of the run ---

  openDoor() {
    const run = this.run;
    this.doorOpen = true;
    run.budget = Math.min(run.maxBudget, run.budget + SPRINT_BONUS);
    play(this, 'door');
    setArt(this.door, 'door-open');
    this.doorBox.body.enable = false;
    this.exit.setVisible(true);
    this.tweens.add({ targets: this.exit, y: this.exit.y + 4, duration: 350, yoyo: true, repeat: -1 });
    for (const agent of this.agents) agent.cheer();
    for (const bug of [...this.bugs]) {
      this.burst(bug.x, bug.y, BUG_COLOR, 6, 3);
      bug.destroy();
    }
    this.bugs = [];
    this.toast(`SPRINT DONE! +${SPRINT_BONUS}k tokens. Walk out through the door.`, COLOR.ok);
  }

  leave() {
    this.ending = true;
    this.player.setVelocity(0, 0);
    play(this, 'pick');
    this.scene.pause();
    this.scene.launch('upgrade');
  }

  gameOver(reason) {
    if (this.ending) return; // an incident and an empty budget in the same frame: the first one counts
    this.ending = true;
    this.run.over = reason;
    this.physics.pause();
    this.tweens.killAll();
    play(this, 'over');
    this.cameras.main.shake(400, 0.002);
    this.player.view.setTint(COLOR.rogue).setAlpha(1);
    this.time.delayedCall(1300, () => this.scene.start('gameover'));
  }
}
