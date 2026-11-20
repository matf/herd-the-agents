import Phaser from 'phaser';
import { T } from '../tiles.js';
import { COLOR, WIDTH, addText, css, setupCamera } from '../view.js';
import { isMuted, toggleMute } from '../sound.js';
import { sprintRules } from '../run.js';

const BAR = { x: 30, y: 31, width: 112, height: 8 };
const FAST_BURN = 2.2; // k tokens per second: the bar starts to flicker

// The HUD at the top: hearts, sprint, tokens and PRs. It just shows what is in the run.
export class UIScene extends Phaser.Scene {
  constructor() {
    super('ui');
  }

  create() {
    setupCamera(this);
    this.run = this.registry.get('run');
    this.goal = sprintRules(this.run.sprint).goal;

    this.hearts = [];
    for (let i = 0; i < this.run.maxHearts; i++) {
      this.hearts.push(this.add.image(22 + i * 14, 12, 'tiles', T.heart).setTint(COLOR.rogue));
    }
    this.shield = this.add.image(22 + this.run.maxHearts * 14 + 2, 12, 'tiles', T.shield).setTint(COLOR.ok);
    this.sprint = addText(this, WIDTH / 2 + 22, 12, '', { size: 8 }).setOrigin(0.5);

    this.mute = this.add
      .image(WIDTH - 23, 12, 'tiles', T.soundOn)
      .setTint(COLOR.dim)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        toggleMute();
        this.showMute();
      });
    this.mute.input.hitArea.setTo(-6, -6, 28, 28); // easier to hit with a finger
    this.showMute();

    this.add.image(21, BAR.y, 'tiles', T.coin).setTint(COLOR.loop).setScale(0.75);
    this.add.rectangle(BAR.x, BAR.y, BAR.width, BAR.height, COLOR.panel).setOrigin(0, 0.5).setStrokeStyle(1, COLOR.line);
    this.bar = this.add.rectangle(BAR.x, BAR.y, BAR.width, BAR.height, COLOR.ok).setOrigin(0, 0.5);
    this.tokens = addText(this, BAR.x + BAR.width + 5, BAR.y, '', { size: 8 }).setOrigin(0, 0.5);
    this.prs = addText(this, WIDTH - 15, BAR.y, '', { size: 8 }).setOrigin(1, 0.5);

    this.shown = '';
  }

  showMute() {
    this.mute.setFrame(isMuted() ? T.soundOff : T.soundOn);
  }

  update(time) {
    const run = this.run;
    const share = Phaser.Math.Clamp(run.budget / run.maxBudget, 0, 1);
    const color = share > 0.5 ? COLOR.ok : share > 0.25 ? COLOR.loop : COLOR.rogue;
    const flicker = run.burning > FAST_BURN && Math.floor(time / 120) % 2 === 0;
    this.bar.setScale(share, 1).setFillStyle(flicker ? COLOR.ink : color);

    // The texts only change now and then.
    const now = [run.hearts, run.ciReady, run.sprint, Math.ceil(run.budget), run.sprintPrs].join();
    if (now === this.shown) return;
    this.shown = now;
    this.hearts.forEach((heart, i) => {
      heart.setFrame(i < run.hearts ? T.heart : T.heartEmpty).setTint(i < run.hearts ? COLOR.rogue : COLOR.line);
    });
    this.shield.setVisible(run.ciReady);
    this.sprint.setText(`SPRINT ${run.sprint}`);
    this.tokens.setText(`${Math.ceil(run.budget)}k`).setColor(css(color));
    const done = run.sprintPrs >= this.goal;
    this.prs.setText(`PR ${Math.min(run.sprintPrs, this.goal)}/${this.goal}`).setColor(css(done ? COLOR.ok : COLOR.ink));
  }
}
