import Phaser from 'phaser';
import { T } from '../tiles.js';
import { COLOR, FONT_MINI, HEIGHT, WIDTH, addButton, addText, setupCamera } from '../view.js';
import { IS_TOUCH } from '../touch.js';
import { loadSave } from '../save.js';
import { play } from '../sound.js';
import { newRun } from '../run.js';

// What can go wrong with an agent, and what to do about it.
const LEGEND = [
  { color: COLOR.ask, sign: T.questionBubble, name: 'ASKS PERMISSION', text: 'Walk into it to approve.' },
  { color: COLOR.loop, sign: T.turn, name: 'LOOPS', text: 'Burns tokens. Ctrl-C it!' },
  { color: COLOR.halluc, sign: T.face, name: 'HALLUCINATES', text: 'Ctrl-C it, squash its bugs.' },
  { color: COLOR.rogue, sign: T.warning, name: 'GOES ROGUE', text: 'Stop it before it hits prod!' },
];

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('title');
  }

  create() {
    setupCamera(this);
    const save = loadSave();

    addText(this, WIDTH / 2, 44, 'HERD THE', { size: 16, color: COLOR.ink }).setOrigin(0.5);
    addText(this, WIDTH / 2, 72, 'AGENTS', { size: 32, color: COLOR.ok }).setOrigin(0.5);
    addText(this, WIDTH / 2, 100, 'A tiny roguelike about agentic engineering', { size: 8, font: FONT_MINI, color: COLOR.dim }).setOrigin(0.5);

    // You, and a few agents doing what they do.
    const y = 134;
    const hero = this.add.image(WIDTH / 2 - 60, y, 'tiles', T.hero).setTint(COLOR.hero).setScale(2);
    this.tweens.add({ targets: hero, y: y - 3, duration: 400, yoyo: true, repeat: -1 });
    LEGEND.forEach((entry, i) => {
      const x = WIDTH / 2 - 18 + i * 30;
      const robot = this.add.image(x, y, 'tiles', i % 2 ? T.robotAlt : T.robot).setTint(entry.color).setScale(2);
      if (entry.sign === T.turn) this.time.addEvent({ delay: 130, loop: true, callback: () => (robot.angle += 90) });
      else this.tweens.add({ targets: robot, y: y - 2, duration: 300 + i * 70, yoyo: true, repeat: -1 });
    });

    addText(this, WIDTH / 2, 168, 'Merge PRs to finish each sprint.\nYour agents will not make it easy:', {
      size: 8,
      font: FONT_MINI,
      align: 'center',
    }).setOrigin(0.5);

    LEGEND.forEach((entry, i) => {
      const rowY = 198 + i * 26;
      this.add.image(34, rowY, 'tiles', entry.sign).setTint(entry.color);
      addText(this, 50, rowY - 10, entry.name, { size: 8, color: entry.color });
      addText(this, 50, rowY + 1, entry.text, { size: 8, font: FONT_MINI, color: COLOR.ink });
    });

    addText(
      this,
      WIDTH / 2,
      312,
      IS_TOUCH ? 'LEFT THUMB: walk     RIGHT THUMB: Ctrl-C' : 'WASD / ARROWS: walk     SPACE: Ctrl-C',
      { size: 8, font: FONT_MINI, color: COLOR.dim },
    ).setOrigin(0.5);

    const button = addButton(this, WIDTH / 2, 348, 'START SPRINT 1', () => this.begin(), { width: 170, height: 32 });
    this.tweens.add({ targets: button, scale: 1.04, duration: 500, yoyo: true, repeat: -1 });
    if (save.bestPrs > 0) {
      addText(this, WIDTH / 2, 382, `BEST: ${save.bestPrs} PRs, sprint ${save.bestSprint}`, { size: 8, font: FONT_MINI, color: COLOR.loop }).setOrigin(0.5);
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
