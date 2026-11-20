import Phaser from 'phaser';
import { addArt } from '../art.js';
import { COLOR, FONT_MINI, HEIGHT, WIDTH, addButton, addText, setupCamera } from '../view.js';
import { IS_TOUCH } from '../touch.js';
import { loadSave, writeSave } from '../save.js';
import { play } from '../sound.js';
import { newRun, rankFor } from '../run.js';

const URL = 'https://matf.github.io/herd-the-agents/';
const WAIT = 600; // milliseconds before keys count, so a last key press doesn't restart right away

const REASON = {
  budget: { icon: 'coin', color: COLOR.loop, text: 'The token budget is burned.', short: 'the token budget ran out' },
  incident: { icon: 'prod', color: COLOR.rogue, text: 'Prod is down. An agent did it.', short: 'an agent took down prod' },
  bugs: { icon: 'bug-0', color: 0xff7ac8, text: 'The bugs got you.', short: 'the bugs got me' },
};

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super('gameover');
  }

  create() {
    setupCamera(this);
    const run = this.registry.get('run');
    const reason = REASON[run.over] ?? REASON.budget;
    const rank = rankFor(run.prs);

    const save = loadSave();
    const isBest = run.prs > save.bestPrs;
    if (isBest) writeSave({ ...save, bestPrs: run.prs, bestSprint: run.sprint });

    addText(this, WIDTH / 2, 50, 'RUN OVER', { size: 24, color: COLOR.rogue }).setOrigin(0.5);
    addArt(this, WIDTH / 2, 84, reason.icon).setOrigin(0.5).setScale(reason.icon === 'prod' ? 0.2 : 0.5);
    addText(this, WIDTH / 2, 108, reason.text, { size: 8, font: FONT_MINI, color: reason.color }).setOrigin(0.5);

    addText(this, WIDTH / 2, 142, `${run.prs}`, { size: 32, color: COLOR.ok }).setOrigin(0.5);
    addText(this, WIDTH / 2, 166, 'PRs MERGED', { size: 8 }).setOrigin(0.5);
    addText(this, WIDTH / 2, 184, isBest ? 'NEW BEST!' : `Best: ${save.bestPrs}`, { size: 8, font: FONT_MINI, color: isBest ? COLOR.loop : COLOR.dim }).setOrigin(0.5);

    this.add.rectangle(WIDTH / 2, 216, 236, 34, COLOR.panel).setStrokeStyle(1, COLOR.hero);
    addText(this, WIDTH / 2, 209, 'YOUR RANK', { size: 8, font: FONT_MINI, color: COLOR.dim }).setOrigin(0.5);
    addText(this, WIDTH / 2, 222, rank.toUpperCase(), { size: 8, color: COLOR.hero }).setOrigin(0.5);

    const minutes = Math.floor(run.time / 60);
    const seconds = `${Math.floor(run.time % 60)}`.padStart(2, '0');
    const stats = [
      ['Sprint reached', run.sprint],
      ['Agents put back on task', run.fixes],
      ['Bugs squashed', run.squashed],
      ['Incidents', run.incidents],
      ['Power-ups grabbed', run.powerups],
      ['Time', `${minutes}:${seconds}`],
    ];
    stats.forEach(([name, value], i) => {
      const y = 244 + i * 12;
      addText(this, 30, y, name, { size: 8, font: FONT_MINI, color: COLOR.dim });
      addText(this, WIDTH - 30, y, `${value}`, { size: 8, font: FONT_MINI }).setOrigin(1, 0);
    });

    addButton(this, WIDTH / 2, 342, 'RUN AGAIN', () => this.again(), { width: 170, height: 30 });
    const shareLabel = IS_TOUCH && navigator.share ? 'SHARE RESULT' : 'COPY RESULT';
    this.share = addButton(this, WIDTH / 2, 380, shareLabel, () => {}, { width: 170, height: 26, color: COLOR.panel, ink: COLOR.ask, size: 8 });
    addButton(this, WIDTH / 2, 414, 'TITLE', () => this.scene.start('title'), { width: 170, height: 26, color: COLOR.panel, ink: COLOR.dim, size: 8 });
    addText(this, WIDTH / 2, HEIGHT - 24, 'matf.github.io/herd-the-agents', { size: 8, font: FONT_MINI, color: COLOR.dim }).setOrigin(0.5);

    this.message =
      `I merged ${run.prs} PRs over ${run.sprint} sprint${run.sprint === 1 ? '' : 's'} in "Herd the Agents" before ${reason.short}. ` +
      `Rank: ${rank}. Can you herd them better? ${URL}`;

    // Sharing and the clipboard only work straight from a real tap or click, and Phaser handles
    // its pointer events a moment later. So listen to the browser's click on the canvas itself.
    const canvas = this.game.canvas;
    const onClick = (event) => {
      const r = canvas.getBoundingClientRect();
      const x = ((event.clientX - r.left) / r.width) * WIDTH;
      const y = ((event.clientY - r.top) / r.height) * HEIGHT;
      if (Math.abs(x - this.share.x) <= 85 && Math.abs(y - this.share.y) <= 13) this.shareResult();
    };
    canvas.addEventListener('click', onClick);
    this.events.once('shutdown', () => canvas.removeEventListener('click', onClick));

    this.openAt = this.time.now + WAIT;
    this.input.keyboard.on('keydown-SPACE', () => this.again());
    this.input.keyboard.on('keydown-ENTER', () => this.again());
  }

  async shareResult() {
    play(this, 'click');
    try {
      if (IS_TOUCH && navigator.share) {
        await navigator.share({ text: this.message });
        return;
      }
      await navigator.clipboard.writeText(this.message);
      this.share.label.setText('COPIED!');
    } catch {
      // Cancelled, or not allowed here.
      this.share.label.setText('COULD NOT SHARE');
    }
    this.time.delayedCall(1600, () => this.share.label.setText(IS_TOUCH && navigator.share ? 'SHARE RESULT' : 'COPY RESULT'));
  }

  again() {
    if (this.time.now < this.openAt) return;
    play(this, 'click');
    this.registry.set('run', newRun());
    this.scene.start('game');
  }
}
