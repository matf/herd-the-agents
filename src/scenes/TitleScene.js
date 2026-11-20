import Phaser from 'phaser';
import { ACTIONS } from '../actions.js';
import { ART_SCALE, SKYLINE, SPRITES, TITLE_FLOOR, addArt, makeTitleTexture, setArt, skylineTop } from '../art.js';
import { COLOR, FONT_MINI, HEIGHT, WIDTH, addButton, addText, setupCamera } from '../view.js';
import { IS_TOUCH } from '../touch.js';
import { loadSave } from '../save.js';
import { play } from '../sound.js';
import { newRun } from '../run.js';

const LEGEND = [
  { kind: 'ask', name: 'ASKS PERMISSION', text: 'It waits and waits. APPROVE it.', action: 'approve' },
  { kind: 'loop', name: 'LOOPS', text: 'Burns tokens fast. CTRL-C it!', action: 'stop' },
  { kind: 'halluc', name: 'HALLUCINATES', text: 'REVIEW it, and the bugs it makes.', action: 'review' },
  { kind: 'rogue', name: 'GOES ROGUE', text: 'CTRL-C it before it hits prod!', action: 'stop' },
];

// The scene behind the words: everything in it gets a depth below 0, so the words end up on top.
const DEPTH = { sky: -10, star: -9, window: -8, coin: -7, floor: -6, cast: -5, spark: -1 };
const BIG = 4 / 3 / ART_SCALE; // the cast stands a third bigger than in the game
const FLOOR_Y = 110; // the far corner of the floor
// Where the cast stands, in floor tiles from the far corner.
const CAST = [
  { key: 'robot-ask', sign: 'sign-ask', u: 0.9, v: 3.9 },
  { key: 'robot-loop', sign: 'sign-loop', u: 1.3, v: 2.3 },
  { key: 'robot-halluc', sign: 'sign-halluc', u: 2.3, v: 1.3 },
  { key: 'robot-rogue', sign: 'sign-rogue', u: 3.9, v: 0.9 },
];
const HERO = { u: 3.55, v: 3.55 };
const FURNITURE = [
  { key: 'desk', u: 2.5, v: 4.4 },
  { key: 'plant', u: 4.45, v: 2.5 },
];
const WAVE = ['hero-wave1', 'hero-wave2', 'hero-wave1', 'hero-wave2', 'hero-wave1', 'hero-wave2', 'hero', 'hero', 'hero', 'hero', 'hero'];

const onFloor = ({ u, v }) => ({
  x: WIDTH / 2 + (u - v) * TITLE_FLOOR.hw,
  y: FLOOR_Y + (u + v) * TITLE_FLOOR.hh,
});

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('title');
  }

  create() {
    setupCamera(this);
    const save = loadSave();

    this.addNight();
    this.addFloor();
    this.addCast();
    this.addCoins();

    // The name of the game, glowing a little.
    const glow = addArt(this, WIDTH / 2, 48, 'glow').setTint(COLOR.ok).setAlpha(0.2).setDisplaySize(250, 86).setDepth(DEPTH.star);
    this.tweens.add({ targets: glow, alpha: 0.36, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    addText(this, WIDTH / 2, 22, 'HERD THE', { size: 16, color: COLOR.ink }).setOrigin(0.5);
    addText(this, WIDTH / 2, 52, 'AGENTS', { size: 32, color: 0x14684a }).setOrigin(0.5);
    addText(this, WIDTH / 2, 50, 'AGENTS', { size: 32, color: COLOR.ok }).setOrigin(0.5);
    addText(this, WIDTH / 2, 78, 'A tiny roguelike about agentic engineering', { size: 8, font: FONT_MINI, color: 0xb9c0dc }).setOrigin(0.5);

    // What the agents do, and what to do about it.
    this.add.graphics().fillStyle(COLOR.panel, 0.78).fillRoundedRect(8, 233, WIDTH - 16, 100, 6).lineStyle(1, COLOR.line, 1).strokeRoundedRect(8, 233, WIDTH - 16, 100, 6);
    LEGEND.forEach((entry, i) => {
      const rowY = 249 + i * 23;
      const action = ACTIONS[entry.action];
      addArt(this, 26, rowY + 7, `sign-${entry.kind}`);
      addText(this, 40, rowY - 10, entry.name, { size: 8, color: COLOR[entry.kind] });
      addText(this, 40, rowY + 1, entry.text, { size: 8, font: FONT_MINI, color: COLOR.ink });
      this.add.circle(WIDTH - 26, rowY, 9, action.color, 0.22).setStrokeStyle(1.5, action.color, 0.95);
      addArt(this, WIDTH - 26, rowY, action.icon).setTint(action.color).setScale(0.17);
    });

    const button = addButton(this, WIDTH / 2, 356, 'START SPRINT 1', () => this.begin(), { width: 170, height: 32 });
    this.tweens.add({ targets: button, scale: 1.04, duration: 500, yoyo: true, repeat: -1 });
    if (save.bestPrs > 0) {
      addText(this, WIDTH / 2, 383, `BEST: ${save.bestPrs} PRs, sprint ${save.bestSprint}`, { size: 8, font: FONT_MINI, color: COLOR.loop }).setOrigin(0.5);
    }
    addText(
      this,
      WIDTH / 2,
      408,
      IS_TOUCH ? 'LEFT THUMB: walk\nRIGHT THUMB: approve, Ctrl-C, review' : 'WASD / ARROWS: walk\nJ: approve    K: Ctrl-C    L: review',
      { size: 8, font: FONT_MINI, color: COLOR.dim, align: 'center' },
    ).setOrigin(0.5);
    addText(this, WIDTH / 2, HEIGHT - 30, 'Built by a coding agent while its human\nsat in the talks. Agentic Engineering Days\nZurich 2026', { size: 8, font: FONT_MINI, color: COLOR.dim, align: 'center' }).setOrigin(0.5);

    this.input.keyboard.on('keydown-SPACE', () => this.begin());
    this.input.keyboard.on('keydown-ENTER', () => this.begin());
  }

  // The sky, the city, the moon and the stars.
  addNight() {
    makeTitleTexture(this);
    this.add.image(0, 0, 'title-sky').setOrigin(0).setScale(1 / ART_SCALE).setDepth(DEPTH.sky);

    addArt(this, 238, 26, 'glow').setTint(0xfff3c4).setAlpha(0.22).setDisplaySize(44, 44).setDepth(DEPTH.star);
    addArt(this, 238, 26, 'moon').setDepth(DEPTH.star).setAngle(-18);

    const tints = [0xffffff, 0xffffff, 0xcfe3ff, 0xfff1c4];
    for (let i = 0; i < 46; i++) {
      const x = Phaser.Math.Between(4, WIDTH - 4);
      const y = Phaser.Math.Between(5, 140);
      if (y > skylineTop(x) || Phaser.Math.Distance.Between(x, y, 238, 26) < 14) continue;
      const big = Math.random() < 0.2;
      const star = big
        ? addArt(this, x, y, 'twinkle').setScale(Phaser.Math.FloatBetween(0.6, 1) / ART_SCALE)
        : this.add.image(x, y, 'pixel').setScale(Phaser.Math.FloatBetween(0.1, 0.22));
      star.setTint(Phaser.Utils.Array.GetRandom(tints)).setAlpha(Phaser.Math.FloatBetween(0.5, 1)).setDepth(DEPTH.star);
      this.tweens.add({
        targets: star,
        alpha: 0.12,
        ...(big ? { scale: star.scale * 0.5 } : {}),
        duration: Phaser.Math.Between(700, 2200),
        delay: Phaser.Math.Between(0, 2500),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
    this.time.addEvent({ delay: 5200, loop: true, startAt: 3400, callback: () => this.shootingStar() });

    // People in the city switch their lights on and off.
    const windows = SKYLINE.blink.map(({ x, y, w, h, color }) =>
      this.add
        .rectangle(x + w / 2, y + h / 2, w, h, color)
        .setDepth(DEPTH.window)
        .setVisible(Math.random() < 0.5),
    );
    this.time.addEvent({
      delay: 450,
      loop: true,
      callback: () => {
        const window = Phaser.Utils.Array.GetRandom(windows);
        if (window) window.setVisible(!window.visible);
      },
    });
  }

  shootingStar() {
    const x = Phaser.Math.Between(70, WIDTH - 20);
    const y = Phaser.Math.Between(6, 40);
    const star = this.add.rectangle(x, y, 14, 1, 0xffffff).setAngle(155).setAlpha(0).setDepth(DEPTH.star);
    this.tweens.add({ targets: star, x: x - 58, y: y + 27, duration: 520, ease: 'Quad.easeIn', onComplete: () => star.destroy() });
    this.tweens.add({ targets: star, alpha: 0.9, duration: 180, yoyo: true, hold: 120 });
  }

  // The lit piece of office floor, and the light it throws into the mist.
  addFloor() {
    const { n, hh } = TITLE_FLOOR;
    const light = addArt(this, WIDTH / 2, FLOOR_Y + n * hh * 2 + 2, 'glow').setTint(COLOR.ok).setAlpha(0.3).setDisplaySize(230, 60).setDepth(DEPTH.floor);
    this.tweens.add({ targets: light, alpha: 0.45, duration: 1900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    addArt(this, WIDTH / 2, FLOOR_Y + n * hh, 'title-floor').setDepth(DEPTH.floor);
    addArt(this, WIDTH / 2, FLOOR_Y + n * hh, 'glow').setTint(0xfff3c4).setAlpha(0.2).setDisplaySize(150, 70).setDepth(DEPTH.floor);
  }

  // You, waving, and four agents doing what they do.
  addCast() {
    const stand = (spot, key) => {
      const { x, y } = onFloor(spot);
      addArt(this, x, y, 'shadow').setScale(BIG).setAlpha(0.28).setDepth(DEPTH.cast);
      return addArt(this, x, y, key).setScale(BIG).setDepth(DEPTH.cast + y / 1000);
    };

    CAST.forEach((member, i) => {
      const robot = stand(member, member.key);
      const sign = addArt(this, robot.x, robot.y - SPRITES.robot.ay * BIG * ART_SCALE - 1, member.sign).setDepth(robot.depth);
      if (member.key === 'robot-loop') this.time.addEvent({ delay: 160, loop: true, callback: () => robot.toggleFlipX() });
      this.tweens.add({ targets: [robot, sign], y: '-=2', duration: 420 + i * 90, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });

    for (const thing of FURNITURE) {
      const { x, y } = onFloor(thing);
      addArt(this, x, y, thing.key).setScale(BIG).setDepth(DEPTH.cast + y / 1000);
    }

    const hero = stand(HERO, 'hero');
    this.tweens.add({ targets: hero, y: hero.y - 2, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    let frame = 0;
    this.time.addEvent({
      delay: 200,
      loop: true,
      callback: () => {
        frame = (frame + 1) % WAVE.length;
        setArt(hero, WAVE[frame]);
      },
    });
  }

  // Token coins drift up out of the mist, with a sparkle now and then.
  addCoins() {
    const coin = () => {
      // Most of them at the sides, where the floor does not hide them.
      const side = Phaser.Math.Between(10, 56);
      const x = Math.random() < 0.3 ? Phaser.Math.Between(60, WIDTH - 60) : Math.random() < 0.5 ? side : WIDTH - side;
      const y = Phaser.Math.Between(188, 224);
      const size = Phaser.Math.FloatBetween(0.95, 1.4) / ART_SCALE;
      const image = addArt(this, x, y, 'coin').setScale(size).setAlpha(0).setDepth(DEPTH.coin);
      const time = Phaser.Math.Between(4200, 6200);
      this.tweens.add({ targets: image, y: y - Phaser.Math.Between(70, 110), duration: time,
        onComplete: () => {
          this.tweens.killTweensOf(image);
          image.destroy();
        },
      });
      this.tweens.add({ targets: image, x: x + Phaser.Math.Between(-9, 9), duration: time / 2, yoyo: true, ease: 'Sine.easeInOut' });
      this.tweens.add({ targets: image, alpha: 0.95, duration: time * 0.25, yoyo: true, hold: time * 0.4 });
      this.tweens.add({ targets: image, scaleX: size * 0.25, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }); // it turns
    };
    const spark = () => {
      const x = Phaser.Math.Between(16, WIDTH - 16);
      const y = Phaser.Math.Between(112, 220);
      const image = addArt(this, x, y, 'twinkle').setScale(0).setTint(Math.random() < 0.5 ? 0xfff1c4 : 0xbdfde6).setDepth(DEPTH.spark);
      this.tweens.add({ targets: image, scale: Phaser.Math.FloatBetween(0.7, 1.2) / ART_SCALE, angle: 45, duration: 420, yoyo: true, onComplete: () => image.destroy() });
    };
    for (let i = 0; i < 4; i++) this.time.delayedCall(i * 300, coin);
    this.time.addEvent({ delay: 520, loop: true, callback: coin });
    this.time.addEvent({ delay: 700, loop: true, callback: spark });
  }

  begin() {
    play(this, 'click');
    this.registry.set('run', newRun());
    this.scene.start('game');
  }
}
