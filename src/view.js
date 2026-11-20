// The game world is 270x480 "game pixels" (a phone held upright), but the canvas is ZOOM times
// bigger and every camera zooms in, so the art and the text are drawn sharp.
export const WIDTH = 270;
export const HEIGHT = 480;
export const ZOOM = 4;

export const FONT = 'KenPixel, monospace'; // public/assets/fonts/kenpixel.woff2, loaded in style.css
export const FONT_MINI = '"KenPixel Mini", KenPixel, monospace';

// One palette for the texts, buttons and effects. (The art has its own colours, see src/art.js.)
export const COLOR = {
  bg: 0x0b0f1a,
  panel: 0x131a2b,
  line: 0x26314c,
  floor: 0x0f1524,
  wall: 0x41507a,
  ink: 0xe8ecf4,
  dim: 0x8a93a6,
  ok: 0x3ddc97,
  hero: 0xffe9a8,
  ask: 0x4cc9f0,
  loop: 0xffb020,
  halluc: 0xb57bff,
  rogue: 0xff4d5e,
};

// The same colours for text styles ('#rrggbb').
export const css = (color) => `#${color.toString(16).padStart(6, '0')}`;

export function setupCamera(scene) {
  scene.cameras.main.setOrigin(0, 0).setZoom(ZOOM);
}

// Sharp text in game pixels.
export function addText(scene, x, y, string, { size = 8, color = COLOR.ink, font = FONT, ...style } = {}) {
  return scene.add
    .text(x, y, string, { fontFamily: font, fontSize: `${size}px`, color: css(color), ...style })
    .setResolution(ZOOM);
}

// A button: a box with a label. Tapping it calls onPress. Returns the container; its box is `.bg`.
export function addButton(scene, x, y, label, onPress, { width = 150, height = 26, color = COLOR.ok, ink = COLOR.bg, size = 10 } = {}) {
  const bg = scene.add
    .rectangle(0, 0, width, height, color)
    .setStrokeStyle(1, COLOR.ink)
    .setInteractive({ useHandCursor: true })
    .on('pointerdown', onPress);
  const text = addText(scene, 0, 0, label, { size, color: ink }).setOrigin(0.5);
  const button = scene.add.container(x, y, [bg, text]);
  button.bg = bg;
  button.label = text;
  return button;
}
