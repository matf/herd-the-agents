import Phaser from 'phaser';
import { T } from '../tiles.js';
import { COLOR, FONT_MINI, HEIGHT, WIDTH, addText, setupCamera } from '../view.js';
import { IS_TOUCH } from '../touch.js';
import { play } from '../sound.js';
import { PR_REFUND, SPRINT_BONUS, sprintRules } from '../run.js';
import { COLS, DOOR, ROOM_X, ROOM_Y, ROWS, START, TILE, WALL, generateRoom, randomFloor, tileX, tileY } from '../room.js';
import { Player } from '../objects/Player.js';
import { Agent, BURN } from '../objects/Agent.js';
import { BUG_COLOR, Bug } from '../objects/Bug.js';
import { TouchPad } from '../objects/TouchPad.js';

const AGENT_HUES = [0x7dd3fc, 0x86efac, 0x93c5fd, 0x5eead4, 0xa5b4fc, 0xbef264];
const OBSTACLE = {
  rack: { frame: T.rack, color: 0x6f86c9 },
  shelf: { frame: T.shelf, color: 0xa98467 },
  crate: { frame: T.crate, color: 0xb08d57 },
  cactus: { frame: T.cactus, color: 0x5fbf7a },
};
const HAZARD = {
  prod: { frame: T.database, color: 0xff8fa0, label: 'PROD' },
  main: { frame: T.mainButton, color: 0xffd166, label: 'MAIN' },
};
const APPROVE_DISTANCE = 13; // walk this close to an agent to approve its permission prompt
const BITE_DISTANCE = 9; // a bug this close bites
const DERAILED_SHARE = 0.67; // at most this share of the agents is derailed at the same time
const INCIDENT_COST = 8; // tokens an incident costs, on top of the heart
const TOAST_TIME = 4500;
const PANEL_Y = ROOM_Y + ROWS * TILE; // the strip below the room

const HINTS = {
  ask: 'PERMISSION PROMPT: walk into the agent to approve it.',
  loop: 'LOOPING: it burns tokens fast. Hit it with Ctrl-C!',
  halluc: 'HALLUCINATING: Ctrl-C it, and squash the bugs it makes!',
  rogue: 'GONE ROGUE: Ctrl-C it before it reaches PROD or MAIN!',
};

// One sprint: a random room full of agents. Merge enough PRs and the door opens.
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
      const agent = new Agent(this, tileX(at.c), tileY(at.r), AGENT_HUES[i % AGENT_HUES.length], i % 2 === 1);
      agent.claim(this.freeDesk());
      agent.goToDesk();
      this.agents.push(agent);
    }
    if (this.run.sprint === 1) this.agents[0].hurry();
    this.bugs = [];

    this.sparks = this.add
      .particles(0, 0, 'pixel', {
        speed: { min: 25, max: 85 },
        lifespan: { min: 220, max: 480 },
        scale: { start: 1, end: 0 },
        emitting: false,
      })
      .setDepth(11);

    this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT');
    // Ctrl-C is on Space (or J, or Enter). An event, so even the quickest tap of the key counts.
    this.input.keyboard.addCapture('SPACE');
    this.input.keyboard.on('keydown', (event) => {
      if (!event.repeat && [' ', 'j', 'J', 'Enter'].includes(event.key)) this.swing();
    });
    this.pad = new TouchPad(this, () => this.swing());
    this.buildPanel();

    this.scene.launch('ui');
    this.events.once('shutdown', () => this.scene.stop('ui'));

    this.toast(
      this.run.sprint === 1
        ? `Merge ${this.rules.goal} PRs to finish the sprint. Keep your agents on task!`
        : `SPRINT ${this.run.sprint}: merge ${this.rules.goal} PRs.`,
    );
  }

  buildRoom() {
    const { desks, hazards, obstacles } = this.room;
    this.add.rectangle(ROOM_X + TILE, ROOM_Y + TILE, (COLS - 2) * TILE, (ROWS - 2) * TILE, COLOR.floor).setOrigin(0);
    for (let i = 0; i < 16; i++) {
      const at = randomFloor(this.grid);
      this.add.image(tileX(at.c), tileY(at.r), 'tiles', Phaser.Utils.Array.GetRandom(T.speck)).setTint(COLOR.line);
    }

    this.solids = this.physics.add.staticGroup();
    const solid = (c, r, frame, color) => {
      const image = this.solids.create(tileX(c), tileY(r), 'tiles', frame);
      image.setTint(color).setDepth(3);
      return image;
    };
    for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
      if (this.grid[r * COLS + c] !== WALL || (c === DOOR.c && r === DOOR.r)) continue;
      solid(c, r, T.wall, COLOR.wall);
    }
    this.door = solid(DOOR.c, DOOR.r, T.doorClosed, COLOR.dim);
    this.lock = this.add.image(tileX(DOOR.c), tileY(DOOR.r) - 15, 'tiles', T.lock).setTint(COLOR.dim).setScale(0.75).setDepth(4);

    for (const o of obstacles) solid(o.c, o.r, OBSTACLE[o.kind].frame, OBSTACLE[o.kind].color);

    for (const h of hazards) {
      const { frame, color, label } = HAZARD[h.kind];
      solid(h.c, h.r, frame, color);
      // The name goes on the wall next to it.
      const onWallY = h.r === 1 ? tileY(0) : tileY(ROWS - 1);
      addText(this, tileX(h.c) + (h.c === 1 ? 2 : -2), onWallY, label, {
        size: 8,
        font: FONT_MINI,
        color,
        backgroundColor: '#0b0f1a',
        padding: { x: 2, y: 0 },
      })
        .setOrigin(0.5)
        .setDepth(4);
    }

    for (const d of desks) {
      solid(d.c, d.r, T.desk, 0xaab4d0);
      const back = this.add.rectangle(tileX(d.c) - 7, tileY(d.r) - 10, 14, 3, COLOR.bg).setOrigin(0, 0.5).setStrokeStyle(1, COLOR.line).setDepth(4);
      const bar = this.add.rectangle(tileX(d.c) - 7, tileY(d.r) - 10, 14, 3, COLOR.ok).setOrigin(0, 0.5).setDepth(4);
      d.owner = null;
      d.showProgress = (progress) => {
        back.setVisible(progress > 0);
        bar.setVisible(progress > 0).setScale(Math.min(1, progress), 1);
      };
      d.showProgress(0);
    }
  }

  // The strip below the room: the toast line, and how to play.
  buildPanel() {
    this.toastText = addText(this, WIDTH / 2, PANEL_Y + 4, '', {
      size: 8,
      font: FONT_MINI,
      align: 'center',
      wordWrap: { width: WIDTH - 44 },
    })
      .setOrigin(0.5, 0)
      .setDepth(21);
    if (IS_TOUCH) return; // phones show the joystick and the Ctrl-C button here (TouchPad)
    const y = HEIGHT - 52;
    addText(this, WIDTH / 2, y, 'MOVE   WASD or ARROW KEYS', { size: 8, font: FONT_MINI, color: COLOR.dim }).setOrigin(0.5);
    addText(this, WIDTH / 2, y + 14, 'CTRL-C   SPACE', { size: 8, font: FONT_MINI, color: COLOR.dim }).setOrigin(0.5);
  }

  toast(text, color = COLOR.ink) {
    this.toastText.setText(text).setColor(`#${color.toString(16).padStart(6, '0')}`).setAlpha(1);
    this.toastUntil = this.time.now + TOAST_TIME;
  }

  update(time, delta) {
    if (this.ending) return;
    const dt = Math.min(delta, 50) / 1000;
    const run = this.run;
    const k = this.keys;
    run.time += dt;

    const dx = this.pad.x || (k.RIGHT.isDown || k.D.isDown ? 1 : 0) - (k.LEFT.isDown || k.A.isDown ? 1 : 0);
    const dy = this.pad.y || (k.DOWN.isDown || k.S.isDown ? 1 : 0) - (k.UP.isDown || k.W.isDown ? 1 : 0);
    this.player.move(dx, dy, run.speed, dt);

    let burn = 0;
    for (const agent of this.agents) {
      agent.update(dt);
      burn += BURN[agent.mode];
      if (agent.mode === 'ask' && Phaser.Math.Distance.Between(agent.x, agent.y, this.player.x, this.player.y) < APPROVE_DISTANCE) {
        agent.fix('Approved');
      }
    }
    run.burning = burn * run.burn;
    run.budget -= run.burning * dt;

    for (const bug of this.bugs) {
      bug.update(dt, this.player, this.rules.bugSpeed * run.bugSpeed);
      if (!bug.harmless && Phaser.Math.Distance.Between(bug.x, bug.y, this.player.x, this.player.y) < BITE_DISTANCE) {
        this.bite(bug);
        if (this.ending) return;
      }
    }

    if (this.toastText.alpha > 0 && time > this.toastUntil) this.toastText.setAlpha(Math.max(0, 1 - (time - this.toastUntil) / 400));

    if (this.doorOpen && this.player.y < ROOM_Y + TILE * 0.8) this.leave();
    else if (run.budget <= 0) {
      run.budget = 0;
      this.gameOver('budget');
    }
  }

  // --- Ctrl-C ---

  swing() {
    if (this.ending || !this.player.canSwing(this.time.now)) return;
    // Turn towards the nearest thing worth hitting, so a tap is enough on a phone.
    const targets = [...this.bugs, ...this.agents.filter((a) => a.derailed)];
    this.player.aimAt(targets, this.run.reach);
    this.player.swing(this.time.now, this.run.reach);
    const reaches = (o) => this.player.reaches(o.x, o.y, this.run.reach);
    let hit = false;
    for (const bug of this.bugs.filter(reaches)) {
      this.squash(bug);
      hit = true;
    }
    for (const agent of this.agents) {
      if (agent.derailed && reaches(agent)) {
        agent.fix('^C');
        hit = true;
      }
    }
    if (!hit) {
      const working = this.agents.find((a) => a.mode === 'work' && reaches(a));
      if (working?.interrupt()) play(this, 'oops');
    }
    if (!hit) play(this, 'swing');
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
    if (this.run.hinted.includes(kind)) return;
    this.run.hinted.push(kind);
    this.toast(HINTS[kind], COLOR[kind]);
  }

  onFix(agent, was, text) {
    this.run.fixes++;
    play(this, was === 'ask' ? 'approve' : 'fix');
    this.burst(agent.x, agent.y, COLOR[was === 'push' ? 'rogue' : was], 8);
    this.float(agent.x, agent.y - 12, text, COLOR.ink);
  }

  onMerge(agent, desk) {
    const run = this.run;
    run.prs++;
    run.sprintPrs++;
    run.budget = Math.min(run.maxBudget, run.budget + PR_REFUND);
    play(this, 'merge');
    this.burst(tileX(desk.c), tileY(desk.r), COLOR.ok, 12);
    this.float(tileX(desk.c), tileY(desk.r) - 12, '+1 PR', COLOR.ok);
    if (run.sprintPrs >= this.rules.goal && !this.doorOpen) this.openDoor();
  }

  spawnBug(x, y) {
    if (this.bugs.length >= this.rules.maxBugs) return;
    this.bugs.push(new Bug(this, x, y));
  }

  squash(bug) {
    this.run.squashed++;
    play(this, 'squash');
    this.burst(bug.x, bug.y, BUG_COLOR, 8);
    this.bugs.splice(this.bugs.indexOf(bug), 1);
    bug.destroy();
  }

  bite(bug) {
    if (!this.player.hurt(this.time.now, bug.x, bug.y)) return;
    this.squash(bug);
    this.loseHeart('bugs', 'Ouch! A bug!');
  }

  // A rogue agent got through to prod or main.
  incident(agent, hazard) {
    const run = this.run;
    const name = hazard.kind === 'prod' ? 'PROD' : 'MAIN';
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

  // --- Effects ---

  burst(x, y, color, count) {
    this.sparks.setParticleTint(color);
    this.sparks.explode(count, x, y);
  }

  float(x, y, text, color) {
    const label = addText(this, x, y, text, { size: 8, font: FONT_MINI, color }).setOrigin(0.5).setDepth(13);
    this.tweens.add({ targets: label, y: y - 16, alpha: 0, duration: 900, ease: 'Cubic.out', onComplete: () => label.destroy() });
  }

  // --- The end of the sprint, or of the run ---

  openDoor() {
    const run = this.run;
    this.doorOpen = true;
    run.budget = Math.min(run.maxBudget, run.budget + SPRINT_BONUS);
    play(this, 'door');
    this.door.setFrame(T.doorOpen).setTint(COLOR.ok);
    this.door.body.enable = false;
    this.lock.setFrame(T.arrowUp).setTint(COLOR.ok).setScale(1).setY(tileY(1) + 2);
    this.tweens.add({ targets: this.lock, y: this.lock.y + 5, duration: 350, yoyo: true, repeat: -1 });
    for (const agent of this.agents) agent.cheer();
    for (const bug of [...this.bugs]) {
      this.burst(bug.x, bug.y, BUG_COLOR, 6);
      bug.destroy();
    }
    this.bugs = [];
    this.toast(`SPRINT DONE! +${SPRINT_BONUS}k tokens. Walk through the door at the top.`, COLOR.ok);
  }

  leave() {
    this.ending = true;
    this.player.setVelocity(0, 0);
    play(this, 'pick');
    this.scene.pause();
    this.scene.launch('upgrade');
  }

  gameOver(reason) {
    this.ending = true;
    this.run.over = reason;
    this.physics.pause();
    this.tweens.killAll();
    play(this, 'over');
    this.cameras.main.shake(400, 0.002);
    this.player.setTint(COLOR.rogue);
    this.time.delayedCall(1300, () => this.scene.start('gameover'));
  }
}
