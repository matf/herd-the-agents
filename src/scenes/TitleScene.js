import Phaser from 'phaser';
import { ACTIONS } from '../actions.js';
import { SPRITES, addArt } from '../art.js';
import { COLOR, FONT_MINI, HEIGHT, WIDTH, addButton, addText, setupCamera } from '../view.js';
import { IS_TOUCH } from '../touch.js';
import { loadSave } from '../save.js';
import { play } from '../sound.js';
import { newRun } from '../run.js';

// What can go wrong with an agent, and which of your three actions puts it right.
const LEGEND = [
  { kind: 'ask', name: 'ASKS PERMISSION', text: 'It waits and waits. APPROVE it.', action: 'approve' },
  { kind: 'loop', name: 'LOOPS', text: 'Burns tokens fast. CTRL-C it!', action: 'stop' },
  { kind: 'halluc', name: 'HALLUCINATES', text: 'REVIEW it, and the bugs it makes.', action: 'review' },
  { kind: 'rogue', name: 'GOES ROGUE', text: 'CTRL-C it before it hits prod!', action: 'stop' },
];
const BIG = 1.5 / 4; // the pictures are drawn four times as big as in the game

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('title');
  }

  create() {
    setupCamera(this);
    const save = loadSave();

    addText(this, WIDTH / 2, 40, 'HERD THE', { size: 16, color: COLOR.ink }).setOrigin(0.5);
    addText(this, WIDTH / 2, 68, 'AGENTS', { size: 32, color: COLOR.ok }).setOrigin(0.5);
    addText(this, WIDTH / 2, 95, 'A tiny roguelike about agentic engineering', { size: 8, font: FONT_MINI, color: COLOR.dim }).setOrigin(0.5);

    // You, and a few agents doing what they do.
    const y = 162;
    const hero = addArt(this, 44, y, 'hero').setScale(BIG);
    this.tweens.add({ targets: hero, y: y - 3, duration: 400, yoyo: true, repeat: -1 });
    LEGEND.forEach((entry, i) => {
      const x = 96 + i * 44;
      const robot = addArt(this, x, y, `robot-${entry.kind}`).setScale(BIG);
      const sign = addArt(this, x, y - SPRITES.robot.ay * 1.5 - 1, `sign-${entry.kind}`);
      if (entry.kind === 'loop') this.time.addEvent({ delay: 140, loop: true, callback: () => robot.toggleFlipX() });
      this.tweens.add({ targets: [robot, sign], y: '-=2', duration: 300 + i * 70, yoyo: true, repeat: -1 });
    });

    addText(this, WIDTH / 2, 182, 'Merge PRs to finish each sprint.\nYour agents will not make it easy:', {
      size: 8,
      font: FONT_MINI,
      align: 'center',
    }).setOrigin(0.5);

    LEGEND.forEach((entry, i) => {
      const rowY = 212 + i * 25;
      const action = ACTIONS[entry.action];
      addArt(this, 28, rowY + 8, `sign-${entry.kind}`);
      addText(this, 42, rowY - 10, entry.name, { size: 8, color: COLOR[entry.kind] });
      addText(this, 42, rowY + 1, entry.text, { size: 8, font: FONT_MINI, color: COLOR.ink });
      this.add.circle(WIDTH - 28, rowY, 10, action.color, 0.22).setStrokeStyle(1.5, action.color, 0.95);
      addArt(this, WIDTH - 28, rowY, action.icon).setTint(action.color).setScale(0.19);
    });

    addText(
      this,
      WIDTH / 2,
      316,
      IS_TOUCH
        ? 'LEFT THUMB: walk\nRIGHT THUMB: approve, Ctrl-C, review'
        : 'WASD / ARROWS: walk\nJ: approve    K: Ctrl-C    L: review',
      { size: 8, font: FONT_MINI, color: COLOR.dim, align: 'center' },
    ).setOrigin(0.5);

    const button = addButton(this, WIDTH / 2, 356, 'START SPRINT 1', () => this.begin(), { width: 170, height: 32 });
    this.tweens.add({ targets: button, scale: 1.04, duration: 500, yoyo: true, repeat: -1 });
    if (save.bestPrs > 0) {
      addText(this, WIDTH / 2, 388, `BEST: ${save.bestPrs} PRs, sprint ${save.bestSprint}`, { size: 8, font: FONT_MINI, color: COLOR.loop }).setOrigin(0.5);
    }

    addText(
      this,
      WIDTH / 2,
      HEIGHT - 30,
      'Built by a coding agent while its human\nsat in the talks. Agentic Engineering Days\nZurich 2026',
      { size: 8, font: FONT_MINI, color: COLOR.dim, align: 'center' },
    ).setOrigin(0.5);

    this.input.keyboard.on('keydown-SPACE', () => this.begin());
    this.input.keyboard.on('keydown-ENTER', () => this.begin());
  }

  begin() {
    play(this, 'click');
    this.registry.set('run', newRun());
    this.scene.start('game');
  }
}
