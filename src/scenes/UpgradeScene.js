import Phaser from 'phaser';
import { COLOR, FONT_MINI, HEIGHT, WIDTH, addText, setupCamera } from '../view.js';
import { IS_TOUCH } from '../touch.js';
import { play } from '../sound.js';
import { SPRINT_BONUS } from '../run.js';
import { offerUpgrades } from '../upgrades.js';

const CARD = { width: 236, height: 70, top: 176, gap: 80 };
const WAIT = 450; // milliseconds before a tap counts, so a late tap on an action button doesn't pick a card

// Between two sprints: pick one of three upgrades. Lies on top of the paused game.
export class UpgradeScene extends Phaser.Scene {
  constructor() {
    super('upgrade');
  }

  create() {
    setupCamera(this);
    const run = this.registry.get('run');
    this.run = run;
    this.picked = false;
    this.openAt = this.time.now + WAIT;

    this.add.rectangle(0, 0, WIDTH, HEIGHT, COLOR.bg, 0.9).setOrigin(0).setInteractive(); // also blocks taps on the game
    addText(this, WIDTH / 2, 72, `SPRINT ${run.sprint}\nSHIPPED!`, { size: 16, color: COLOR.ok, align: 'center' }).setOrigin(0.5);
    addText(this, WIDTH / 2, 110, `${run.prs} PRs merged so far   +${SPRINT_BONUS}k tokens`, { size: 8, font: FONT_MINI, color: COLOR.dim }).setOrigin(0.5);
    addText(this, WIDTH / 2, 130, 'PICK AN UPGRADE', { size: 8 }).setOrigin(0.5);

    this.offers = offerUpgrades(run);
    this.offers.forEach((upgrade, i) => {
      const y = CARD.top + i * CARD.gap;
      const box = this.add
        .rectangle(WIDTH / 2, y, CARD.width, CARD.height, COLOR.panel)
        .setStrokeStyle(1, upgrade.color)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.pick(i));
      this.add.image(40, y, 'tiles', upgrade.icon).setTint(upgrade.color).setScale(2);
      addText(this, 66, y - 24, upgrade.name, { size: 8, color: upgrade.color });
      addText(this, 66, y - 9, upgrade.text, { size: 8, font: FONT_MINI, color: COLOR.ink, wordWrap: { width: 170 } });
      if (!IS_TOUCH) addText(this, WIDTH / 2 + CARD.width / 2 - 6, y + CARD.height / 2 - 5, `${i + 1}`, { size: 8, font: FONT_MINI, color: COLOR.dim }).setOrigin(1, 1);
      box.on('pointerover', () => box.setFillStyle(COLOR.line)).on('pointerout', () => box.setFillStyle(COLOR.panel));
    });

    this.input.keyboard.on('keydown', (event) => {
      const i = ['1', '2', '3'].indexOf(event.key);
      if (i >= 0) this.pick(i);
    });
  }

  pick(i) {
    const upgrade = this.offers[i];
    if (!upgrade || this.picked || this.time.now < this.openAt) return;
    this.picked = true;
    upgrade.apply(this.run);
    this.run.perks.push(upgrade.key);
    this.run.sprint++;
    play(this, 'pick');
    this.scene.start('game');
  }
}
