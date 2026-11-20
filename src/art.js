import { HH, HW, N, OX, OY, WALL_H } from './iso.js';

// All the pictures in the game are drawn here, with the canvas, when the game starts.
// Nothing is loaded from files. Sizes are in game pixels; the textures are ART_SCALE times
// bigger so they stay smooth on sharp phone screens.
export const ART_SCALE = 4; // texture pixels per game pixel

const INK = '#1b2140'; // the dark outline everything shares
const LINE = 1; // outline width in game pixels

// --- Small drawing helpers ---

const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;

// A colour between two colours (numbers like 0xff8800), t from 0 to 1.
function mix(a, b, t) {
  const ch = (shift) => Math.round(((a >> shift) & 255) * (1 - t) + ((b >> shift) & 255) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}
const light = (c, t) => hex(mix(c, 0xffffff, t));
const dark = (c, t) => hex(mix(c, 0x151a38, t));

function paint(ctx, fill, stroke = INK, width = LINE) {
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
  }
}

function poly(ctx, points, fill, stroke, width) {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  paint(ctx, fill, stroke, width);
}

function line(ctx, points, color = INK, width = LINE) {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  paint(ctx, null, color, width);
}

function rrect(ctx, x, y, w, h, r, fill, stroke, width) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  paint(ctx, fill, stroke, width);
}

function oval(ctx, x, y, rx, ry, fill, stroke, width) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  paint(ctx, fill, stroke, width);
}
const dot = (ctx, x, y, r, fill, stroke, width) => oval(ctx, x, y, r, r, fill, stroke, width);

function arc(ctx, x, y, r, from, to, color = INK, width = LINE) {
  ctx.beginPath();
  ctx.arc(x, y, r, from * Math.PI, to * Math.PI);
  paint(ctx, null, color, width);
}

// An isometric box standing on a diamond (middle cx, cy; half width hw) that is `h` high.
// The top is lit, the left side a little darker, the right side darkest.
function box(ctx, cx, cy, hw, h, color, { top = light(color, 0.3), left = hex(color), right = dark(color, 0.28) } = {}) {
  const hh = (hw * HH) / HW;
  poly(ctx, [[cx - hw, cy], [cx, cy + hh], [cx, cy + hh - h], [cx - hw, cy - h]], left);
  poly(ctx, [[cx, cy + hh], [cx + hw, cy], [cx + hw, cy - h], [cx, cy + hh - h]], right);
  poly(ctx, [[cx - hw, cy - h], [cx, cy - hh - h], [cx + hw, cy - h], [cx, cy + hh - h]], top);
}

// A standing cylinder: middle of its base at cx, cy.
function cylinder(ctx, cx, cy, rx, h, color, topColor = light(color, 0.35)) {
  const ry = (rx * HH) / HW;
  ctx.beginPath();
  ctx.moveTo(cx - rx, cy - h);
  ctx.lineTo(cx - rx, cy);
  ctx.ellipse(cx, cy, rx, ry, 0, Math.PI, 0, true);
  ctx.lineTo(cx + rx, cy - h);
  ctx.closePath();
  const shade = ctx.createLinearGradient(cx - rx, 0, cx + rx, 0);
  shade.addColorStop(0, hex(color));
  shade.addColorStop(1, dark(color, 0.3));
  paint(ctx, shade);
  oval(ctx, cx, cy - h, rx, ry, topColor);
}

// --- The characters ---

const SKIN = '#ffdcbf';
const BLUSH = 'rgba(255, 122, 160, 0.75)';

function drawHero(ctx) {
  const hoodie = 0xffd35c;
  // legs
  rrect(ctx, 5.7, 18.5, 3, 4.5, 1.2, '#4a5a94');
  rrect(ctx, 9.3, 18.5, 3, 4.5, 1.2, '#4a5a94');
  // arms and hoodie
  dot(ctx, 4, 16.6, 1.7, dark(hoodie, 0.12));
  dot(ctx, 14, 16.6, 1.7, dark(hoodie, 0.12));
  rrect(ctx, 5, 12.6, 8, 8, 2.6, hex(hoodie));
  arc(ctx, 9, 17.2, 1.7, 0.1, 0.9, dark(hoodie, 0.3), 0.6); // the pocket
  line(ctx, [[8.2, 13.6], [8.2, 15]], '#ffffff', 0.5);
  line(ctx, [[9.8, 13.6], [9.8, 15]], '#ffffff', 0.5);
  // head
  dot(ctx, 9, 8, 5.6, SKIN);
  // hair with a fringe and a tuft
  ctx.beginPath();
  ctx.arc(9, 8, 5.6, Math.PI * 0.98, Math.PI * 2.02);
  ctx.lineTo(13, 6.3);
  ctx.lineTo(11.2, 7.4);
  ctx.lineTo(9.2, 6.1);
  ctx.lineTo(6.8, 7.4);
  ctx.lineTo(4.8, 6.4);
  ctx.closePath();
  paint(ctx, '#7a4a2b');
  ctx.beginPath();
  ctx.moveTo(8, 2.6);
  ctx.quadraticCurveTo(9, 0.4, 11, 1.4);
  ctx.quadraticCurveTo(9.8, 1.8, 10, 2.8);
  paint(ctx, '#7a4a2b');
  // headphones
  arc(ctx, 9, 8, 6.2, 1.12, 1.88, INK, 1.8);
  arc(ctx, 9, 8, 6.2, 1.12, 1.88, '#4cc9f0', 0.9);
  rrect(ctx, 1.9, 6.6, 2.4, 4.4, 1.1, '#4cc9f0');
  rrect(ctx, 13.7, 6.6, 2.4, 4.4, 1.1, '#4cc9f0');
  // face
  dot(ctx, 7, 9.3, 1, INK, null);
  dot(ctx, 11, 9.3, 1, INK, null);
  dot(ctx, 7.3, 9, 0.35, '#ffffff', null);
  dot(ctx, 11.3, 9, 0.35, '#ffffff', null);
  oval(ctx, 5.5, 10.9, 0.9, 0.55, BLUSH, null);
  oval(ctx, 12.5, 10.9, 0.9, 0.55, BLUSH, null);
  arc(ctx, 9, 10.3, 1.1, 0.15, 0.85, INK, 0.6);
}

// The star in a hallucinating robot's eye, and in its sign.
function sparkle(ctx, x, y, r, color) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 - Math.PI / 2;
    const d = i % 2 ? r * 0.38 : r;
    ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
  }
  ctx.closePath();
  paint(ctx, color, null);
}

const FACES = {
  // happy at work
  work(ctx, glow) {
    dot(ctx, 7.6, 9.4, 1.25, glow, null);
    dot(ctx, 12.4, 9.4, 1.25, glow, null);
    arc(ctx, 10, 10.4, 1.2, 0.15, 0.85, glow, 0.6);
  },
  // not sure, looking up
  ask(ctx, glow) {
    dot(ctx, 7.8, 8.7, 1.15, glow, null);
    dot(ctx, 12.6, 8.7, 1.15, glow, null);
    line(ctx, [[6.4, 7.4], [8.6, 7]], glow, 0.5);
    dot(ctx, 10.1, 11.5, 0.55, null, glow, 0.5);
  },
  // dizzy
  loop(ctx, glow) {
    for (const x of [7.6, 12.4]) {
      arc(ctx, x, 9.4, 1.35, 0.2, 1.9, glow, 0.5);
      dot(ctx, x, 9.4, 0.45, glow, null);
    }
    line(ctx, [[8.6, 11.9], [9.3, 11.4], [10, 11.9], [10.7, 11.4], [11.4, 11.9]], glow, 0.5);
  },
  // one star eye, one tiny eye, tongue out
  halluc(ctx, glow) {
    sparkle(ctx, 7.5, 9.2, 1.9, glow);
    dot(ctx, 12.6, 9.6, 0.8, glow, null);
    arc(ctx, 10.2, 10.6, 1.3, 0.1, 0.9, glow, 0.6);
    rrect(ctx, 9.9, 11.3, 1.5, 1.5, 0.7, '#ff8fb3', null);
  },
  // angry eyebrows and a grin
  rogue(ctx, glow) {
    dot(ctx, 7.6, 9.7, 1.2, glow, null);
    dot(ctx, 12.4, 9.7, 1.2, glow, null);
    poly(ctx, [[5.8, 7.3], [9.2, 9.2], [9.2, 7.3]], '#1d2347', null);
    poly(ctx, [[14.2, 7.3], [10.8, 9.2], [10.8, 7.3]], '#1d2347', null);
    line(ctx, [[6.1, 7.8], [8.8, 9.2]], glow, 0.7);
    line(ctx, [[13.9, 7.8], [11.2, 9.2]], glow, 0.7);
    ctx.beginPath();
    ctx.moveTo(7.9, 11);
    ctx.quadraticCurveTo(10, 13.2, 12.1, 11);
    ctx.closePath();
    paint(ctx, '#ffffff', null);
  },
  // eyes closed, big smile
  happy(ctx, glow) {
    arc(ctx, 7.6, 10, 1.25, 1.1, 1.9, glow, 0.7);
    arc(ctx, 12.4, 10, 1.25, 1.1, 1.9, glow, 0.7);
    ctx.beginPath();
    ctx.moveTo(8.7, 10.9);
    ctx.quadraticCurveTo(10, 13, 11.3, 10.9);
    ctx.closePath();
    paint(ctx, glow, null);
  },
};

function drawRobot(ctx, { body, accent, glow, face, armsUp = false }) {
  const shade = dark(body, 0.22);
  // feet
  rrect(ctx, 6, 19.6, 3.3, 3.4, 1.3, shade);
  rrect(ctx, 10.7, 19.6, 3.3, 3.4, 1.3, shade);
  // arms
  const armY = armsUp ? 11.2 : 17;
  const armX = armsUp ? 7.9 : 5.6;
  dot(ctx, 10 - armX, armY, 1.7, shade);
  dot(ctx, 10 + armX, armY, 1.7, shade);
  // body with a little light on the belly
  rrect(ctx, 6, 13.6, 8, 7.4, 2.6, hex(body));
  dot(ctx, 10, 18, 1.1, hex(accent), INK, 0.5);
  // antenna
  line(ctx, [[10, 4], [10, 2.4]], INK, 1);
  dot(ctx, 10, 1.9, 1.35, hex(accent));
  // head
  rrect(ctx, 3, 3.8, 14, 11.6, 4.6, hex(body));
  arc(ctx, 7.6, 8.4, 3.4, 1.05, 1.45, light(body, 0.75), 0.8); // a shine
  rrect(ctx, 5, 6.4, 10, 6.8, 3, '#1d2347', INK, 0.6);
  FACES[face](ctx, glow);
  oval(ctx, 4.5, 13.3, 0.95, 0.55, BLUSH, null);
  oval(ctx, 15.5, 13.3, 0.95, 0.55, BLUSH, null);
  if (face === 'ask') {
    // a drop of sweat
    ctx.beginPath();
    ctx.moveTo(16.6, 3.2);
    ctx.quadraticCurveTo(18.4, 6, 16.6, 6.2);
    ctx.quadraticCurveTo(14.9, 6, 16.6, 3.2);
    paint(ctx, '#c9f1ff', INK, 0.5);
  }
}

const robot = (options) => ({ w: 20, h: 24, ax: 10, ay: 23, draw: (ctx) => drawRobot(ctx, options) });

function drawBug(ctx, step) {
  const pink = 0xff7ac8;
  // legs: two poses
  const legs = step ? [[-1.2, 1.4], [0.4, 2], [1.6, 1.2]] : [[-1.6, 2], [0, 1.3], [1.2, 2]];
  legs.forEach(([dx, dy], i) => {
    const y = 5 + i * 1.1;
    line(ctx, [[2.8, y - 0.6], [1.2 + dx * 0.3, y + dy * 0.9]], INK, 0.7);
    line(ctx, [[9.2, y - 0.6], [10.8 - dx * 0.3, y + dy * 0.9]], INK, 0.7);
  });
  // feelers
  line(ctx, [[4.6, 2.6], [3.6, 0.8]], INK, 0.6);
  line(ctx, [[7.4, 2.6], [8.4, 0.8]], INK, 0.6);
  dot(ctx, 3.6, 0.8, 0.5, hex(pink), INK, 0.4);
  dot(ctx, 8.4, 0.8, 0.5, hex(pink), INK, 0.4);
  // body
  oval(ctx, 6, 5.4, 4.2, 3.4, hex(pink));
  arc(ctx, 6, 5.4, 3.1, 1.15, 1.5, light(pink, 0.6), 0.7);
  dot(ctx, 3.9, 6.9, 0.6, dark(pink, 0.3), null);
  dot(ctx, 8.1, 6.9, 0.6, dark(pink, 0.3), null);
  dot(ctx, 6, 7.6, 0.5, dark(pink, 0.3), null);
  // googly eyes
  dot(ctx, 4.5, 4.4, 1.45, '#ffffff', INK, 0.5);
  dot(ctx, 7.5, 4.4, 1.45, '#ffffff', INK, 0.5);
  dot(ctx, 4.8 + (step ? 0.3 : 0), 4.7, 0.65, INK, null);
  dot(ctx, 7.3 - (step ? 0.3 : 0), 4.7, 0.65, INK, null);
}

// --- Things that stand on a tile (the anchor is the middle of the tile) ---

function drawDesk(ctx) {
  const cx = 13;
  const cy = 22;
  const wood = 0xe7b98a;
  // legs, then the table top
  for (const [dx, dy] of [[-8, 0], [0, 5.3], [8, 0]]) line(ctx, [[cx + dx, cy + dy - 1], [cx + dx, cy + dy - 8]], INK, 2);
  for (const [dx, dy] of [[-8, 0], [0, 5.3], [8, 0]]) line(ctx, [[cx + dx, cy + dy - 1], [cx + dx, cy + dy - 8]], dark(wood, 0.25), 1);
  box(ctx, cx, cy - 7, 10, 2.5, wood);
  // the monitor looks to the lower left, at the agent
  const top = cy - 9.5;
  const mx = cx + 2.5;
  const my = top - 1.5;
  line(ctx, [[mx, my + 1.5], [mx, my - 1]], INK, 2);
  poly(ctx, [[mx - 5.5, my - 3.7], [mx + 5.5, my + 3.7], [mx + 5.5, my - 5.3], [mx - 5.5, my - 12.7]], '#39446e');
  poly(ctx, [[mx - 4.3, my - 4.4], [mx + 4.3, my + 1.3], [mx + 4.3, my - 4.6], [mx - 4.3, my - 10.3]], '#9df5d5', null);
  line(ctx, [[mx - 3, my - 7.6], [mx + 1, my - 4.9]], '#ffffff', 0.7);
  line(ctx, [[mx - 3, my - 5.6], [mx + 2.6, my - 1.9]], '#3ddc97', 0.7);
  // keyboard
  poly(ctx, [[cx - 6.5, top + 0.2], [cx - 3.2, top - 2], [cx + 0.8, top + 0.7], [cx - 2.5, top + 2.9]], '#f2f5ff', INK, 0.6);
}

function drawPlant(ctx) {
  const cx = 11;
  const cy = 22;
  const leaf = 0x5fd08a;
  // pot
  ctx.beginPath();
  ctx.moveTo(cx - 5, cy - 7);
  ctx.lineTo(cx - 3.8, cy);
  ctx.ellipse(cx, cy, 3.8, 2.5, 0, Math.PI, 0, true);
  ctx.lineTo(cx + 5, cy - 7);
  ctx.closePath();
  paint(ctx, '#e58a62');
  oval(ctx, cx, cy - 7, 5, 3.2, '#8a5a3c');
  // leaves
  dot(ctx, cx - 4.2, cy - 12, 4.2, hex(leaf));
  dot(ctx, cx + 4.4, cy - 12.6, 4.4, dark(leaf, 0.12));
  dot(ctx, cx, cy - 16.4, 5, light(leaf, 0.12));
  dot(ctx, cx, cy - 12.6, 3.2, hex(leaf), null);
  arc(ctx, cx - 0.6, cy - 16.6, 3.2, 1.1, 1.5, light(leaf, 0.6), 0.8);
}

function drawRack(ctx) {
  const cx = 11;
  const cy = 28;
  box(ctx, cx, cy, 9, 21, 0x7f93d6);
  // slots with little lights on the left side
  const leds = ['#3ddc97', '#ffd166', '#3ddc97', '#ff7a8a'];
  for (let i = 0; i < 4; i++) {
    const y = cy - 17 + i * 4.6;
    poly(ctx, [[cx - 7.5, y], [cx - 1.5, y + 4], [cx - 1.5, y + 6.6], [cx - 7.5, y + 2.6]], '#2a3360', null);
    dot(ctx, cx - 6, y + 2.3, 0.8, leds[i], null);
    line(ctx, [[cx - 4.4, y + 3.3], [cx - 2.4, y + 4.6]], '#6f86c9', 0.6);
  }
}

function drawBoxes(ctx) {
  const cx = 12;
  const cy = 20;
  const card = 0xd9a56c;
  box(ctx, cx, cy, 9.5, 8.5, card);
  line(ctx, [[cx - 4.75, cy - 11.7], [cx + 4.75, cy - 5.3]], light(card, 0.6), 1.2);
  box(ctx, cx - 1.5, cy - 9.5, 6, 6.5, mix(card, 0xffe2b0, 0.35));
  line(ctx, [[cx - 4.5, cy - 18], [cx + 1.5, cy - 14]], light(card, 0.7), 1);
}

function drawCooler(ctx) {
  const cx = 10;
  const cy = 26;
  box(ctx, cx, cy, 6, 13, 0xf2f5ff);
  dot(ctx, cx - 3, cy - 6.5, 0.8, '#ff7a8a', INK, 0.4);
  dot(ctx, cx - 3, cy - 3.6, 0.8, '#4cc9f0', INK, 0.4);
  cylinder(ctx, cx, cy - 14, 4.4, 8, 0x8fdcff, '#c9f1ff');
  arc(ctx, cx - 1, cy - 18, 2.6, 0.75, 1.2, '#ffffff', 0.8);
}

// The production database: three precious discs with a warning light.
function drawProd(ctx) {
  const cx = 12;
  const cy = 26;
  for (let i = 0; i < 3; i++) {
    const y = cy - i * 6.2;
    cylinder(ctx, cx, y, 9, 5, i === 1 ? 0xffb3c0 : 0xff6f86, i === 1 ? '#ffe3e8' : '#ffc2cc');
    dot(ctx, cx - 5.5, y - 0.2, 0.9, '#fff3a8', INK, 0.4);
    dot(ctx, cx - 2.6, y + 1.5, 0.9, '#9df5d5', INK, 0.4);
  }
  // a heart on top: handle with care
  ctx.save();
  ctx.translate(cx, cy - 17.6);
  ctx.scale(1, 0.72);
  heartPath(ctx, 0, 0.2, 3.3);
  paint(ctx, '#ffffff', INK, 0.6);
  ctx.restore();
}

// The main branch: a big button nobody should push.
function drawMain(ctx) {
  const cx = 12;
  const cy = 20;
  box(ctx, cx, cy, 10, 7, 0x59648f);
  // warning stripes on the left side
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx - 10, cy - 1.2);
  ctx.lineTo(cx, cy + 5.5);
  ctx.lineTo(cx, cy + 2.7);
  ctx.lineTo(cx - 10, cy - 4);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = '#ffd166';
  ctx.fill();
  for (let i = -3; i < 6; i++) poly(ctx, [[cx - 10 + i * 3, cy - 6], [cx - 8.5 + i * 3, cy - 6], [cx - 11.5 + i * 3, cy + 8], [cx - 13 + i * 3, cy + 8]], INK, null);
  ctx.restore();
  // the button
  cylinder(ctx, cx, cy - 7.4, 6.6, 2.6, 0xf2a91e, '#ffd166');
  ctx.beginPath();
  ctx.ellipse(cx, cy - 10, 5.4, 3.6, 0, 0, Math.PI, false);
  ctx.ellipse(cx, cy - 10, 5.4, 6.2, 0, Math.PI, 0, false);
  ctx.closePath();
  paint(ctx, '#ffd84a');
  arc(ctx, cx - 0.8, cy - 11.4, 3.2, 1.05, 1.5, '#fff6c9', 0.9);
}

// --- The door (in the right-hand back wall) ---

function drawDoor(ctx, open) {
  const ax = 20;
  const ay = 30;
  const slope = HH / HW;
  const at = (along, up) => [ax + along, ay + along * slope - up]; // a point on the wall
  if (open) {
    // light on the floor in front
    const glow = ctx.createLinearGradient(ax, ay, ax - 12, ay + 8);
    glow.addColorStop(0, 'rgba(61, 220, 151, 0.6)');
    glow.addColorStop(1, 'rgba(61, 220, 151, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.moveTo(...at(-6, 0));
    ctx.lineTo(...at(6, 0));
    ctx.lineTo(ax + 6 - 15, ay + 4 + 10);
    ctx.lineTo(ax - 6 - 15, ay - 4 + 10);
    ctx.closePath();
    ctx.fill();
  }
  poly(ctx, [at(-7, 0), at(7, 0), at(7, 25.5), at(-7, 25.5)], '#4a5686'); // frame
  if (open) {
    const inside = ctx.createLinearGradient(0, ay - 24, 0, ay + 4);
    inside.addColorStop(0, '#eafff5');
    inside.addColorStop(1, '#3ddc97');
    poly(ctx, [at(-5.4, 0), at(5.4, 0), at(5.4, 23.5), at(-5.4, 23.5)], inside, INK, 0.6);
    // the door itself, swung open
    poly(ctx, [at(5.4, 0), [ax + 9.5, ay + 0.4], [ax + 9.5, ay - 22.6], at(5.4, 23.5)], '#aab4dc', INK, 0.6);
  } else {
    poly(ctx, [at(-5.4, 0), at(5.4, 0), at(5.4, 23.5), at(-5.4, 23.5)], '#aab4dc', INK, 0.6);
    poly(ctx, [at(-3.6, 13), at(3.6, 13), at(3.6, 21), at(-3.6, 21)], '#c9d2f2', INK, 0.5);
    poly(ctx, [at(-3.6, 2.5), at(3.6, 2.5), at(3.6, 10.5), at(-3.6, 10.5)], '#c9d2f2', INK, 0.5);
    // lock
    const [lx, ly] = at(3.2, 11.6);
    arc(ctx, lx, ly - 1.2, 1.2, 1, 2, INK, 0.7);
    rrect(ctx, lx - 1.7, ly - 1.2, 3.4, 2.8, 0.7, '#ffd166', INK, 0.5);
  }
}

// --- Signs, icons and the HUD ---

function drawSign(ctx, color, glyph) {
  ctx.beginPath();
  ctx.moveTo(5, 11);
  ctx.lineTo(6.5, 14.3);
  ctx.lineTo(8, 11);
  ctx.closePath();
  paint(ctx, hex(color));
  rrect(ctx, 0.7, 0.7, 11.6, 10.8, 3.6, hex(color));
  poly(ctx, [[5.3, 10.9], [6.5, 13.4], [7.7, 10.9]], hex(color), null); // hide the seam
  glyph(ctx);
}

const SIGN_GLYPHS = {
  ask(ctx) {
    ctx.beginPath();
    ctx.arc(6.5, 4.6, 1.9, Math.PI * 1.05, Math.PI * 2.45);
    ctx.lineTo(6.5, 7.2);
    paint(ctx, null, '#ffffff', 1.3);
    dot(ctx, 6.5, 9.1, 0.8, '#ffffff', null);
  },
  loop(ctx) {
    for (const turn of [0, 1]) {
      ctx.save();
      ctx.translate(6.5, 6.1);
      ctx.rotate(turn * Math.PI);
      arc(ctx, 0, 0, 2.9, 1.15, 1.95, '#ffffff', 1.2);
      poly(ctx, [[1.6, -2.4], [4.4, -1.6], [3.2, 0.8]], '#ffffff', null);
      ctx.restore();
    }
  },
  halluc(ctx) {
    sparkle(ctx, 5.6, 6.6, 3.6, '#ffffff');
    sparkle(ctx, 9.6, 3.5, 1.7, '#ffffff');
  },
  rogue(ctx) {
    poly(ctx, [[6.5, 2.2], [10.6, 9.4], [2.4, 9.4]], '#ffffff', '#ffffff', 0.8);
    line(ctx, [[6.5, 4.7], [6.5, 6.8]], '#ff4d5e', 1.1);
    dot(ctx, 6.5, 8.3, 0.6, '#ff4d5e', null);
  },
};

const sign = (color, glyph) => ({ w: 13, h: 15, ax: 6.5, ay: 14.6, draw: (ctx) => drawSign(ctx, color, glyph) });

function heartPath(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s);
  ctx.bezierCurveTo(x - s * 1.5, y, x - s * 0.9, y - s * 1.1, x, y - s * 0.35);
  ctx.bezierCurveTo(x + s * 0.9, y - s * 1.1, x + s * 1.5, y, x, y + s);
  ctx.closePath();
}

function drawHeart(ctx, full) {
  heartPath(ctx, 5, 4.3, 3.9);
  paint(ctx, full ? '#ff4d5e' : '#232b47', full ? INK : '#55608a');
  if (full) arc(ctx, 3.5, 3.7, 1.5, 1.05, 1.55, '#ffc2cc', 0.8);
}

// --- Power-ups (the anchor is the bottom middle) ---

function drawCoffee(ctx) {
  line(ctx, [[5.2, 4.4], [6.1, 3], [5.2, 1.6]], '#ffffff', 0.8); // steam
  line(ctx, [[8.2, 4.8], [9.1, 3.4], [8.2, 2]], '#ffffff', 0.8);
  arc(ctx, 10.8, 10.4, 2, 1.5, 2.5, INK, 2.4); // the handle
  arc(ctx, 10.8, 10.4, 2, 1.5, 2.5, '#f2f5ff', 1);
  cylinder(ctx, 6.8, 13.4, 4.3, 6.4, 0xf2f5ff, '#8a5630');
  ctx.save();
  ctx.translate(6.2, 11);
  heartPath(ctx, 0, 0, 1.5);
  paint(ctx, '#ff7a8a', null);
  ctx.restore();
}

function drawTokens(ctx) {
  for (const y of [12, 9.6, 7.2]) cylinder(ctx, 7, y, 5, 1.7, 0xffb92e, '#ffe27a');
  oval(ctx, 7, 5.5, 2.9, 1.8, null, '#e39a12', 0.7);
  sparkle(ctx, 11.6, 3, 2.2, '#ffffff');
}

function drawDoc(ctx) {
  poly(ctx, [[2, 1.5], [8.5, 1.5], [11.5, 4.5], [11.5, 14.5], [2, 14.5]], '#f2f5ff');
  poly(ctx, [[8.5, 1.5], [8.5, 4.5], [11.5, 4.5]], '#c9d2e6', INK, 0.6);
  line(ctx, [[3.8, 5], [6.8, 5]], '#4cc9f0', 1.1);
  for (const y of [7.4, 9.6, 11.8]) line(ctx, [[3.8, y], [y > 11 ? 6.4 : 9.6, y]], '#8d98bd', 0.8);
  dot(ctx, 10.4, 12.6, 2.8, '#3ddc97', INK, 0.7);
  line(ctx, [[9.1, 12.7], [10.1, 13.7], [11.8, 11.6]], '#ffffff', 0.9);
}

function drawDuck(ctx) {
  const yellow = '#ffd84a';
  poly(ctx, [[1.6, 7.2], [3.6, 8.6], [3, 11]], yellow); // tail
  oval(ctx, 7, 10, 5.4, 3.5, yellow);
  dot(ctx, 9.8, 5.2, 3.3, yellow);
  poly(ctx, [[12.4, 4.7], [14.6, 5.7], [12.4, 6.7]], '#ff8a3c', INK, 0.6);
  dot(ctx, 10.6, 4.5, 0.65, INK, null);
  arc(ctx, 6.2, 9.6, 2.4, 0.15, 0.85, '#e0a81c', 0.8); // wing
  arc(ctx, 9.2, 4.6, 2.2, 1.1, 1.45, '#fff3b0', 0.7);
}

function drawSpeaker(ctx, on) {
  const grey = '#c9d2e6';
  poly(ctx, [[1, 3.8], [3, 3.8], [5.6, 1.6], [5.6, 8.4], [3, 6.2], [1, 6.2]], grey, grey, 0.6);
  if (on) {
    arc(ctx, 5.4, 5, 2, 1.7, 2.3, grey, 0.9);
    arc(ctx, 5.4, 5, 3.7, 1.72, 2.28, grey, 0.9);
  } else {
    line(ctx, [[7, 3.6], [9.4, 6.4]], '#ff7a8a', 0.9);
    line(ctx, [[9.4, 3.6], [7, 6.4]], '#ff7a8a', 0.9);
  }
}

export const SPRITES = {
  hero: { w: 18, h: 24, ax: 9, ay: 23, draw: drawHero },
  robot: robot({ body: 0xf2f5ff, accent: 0x3ddc97, glow: '#7dffd0', face: 'work' }),
  'robot-ask': robot({ body: 0x6fd6f5, accent: 0xffffff, glow: '#ffffff', face: 'ask' }),
  'robot-loop': robot({ body: 0xffbd42, accent: 0xffffff, glow: '#fff3c4', face: 'loop' }),
  'robot-halluc': robot({ body: 0xc294ff, accent: 0xffffff, glow: '#fff1ff', face: 'halluc' }),
  'robot-rogue': robot({ body: 0xff6373, accent: 0x2a1030, glow: '#ffe0e4', face: 'rogue' }),
  'robot-happy': robot({ body: 0x5fe6ac, accent: 0xffffff, glow: '#eafff5', face: 'happy', armsUp: true }),
  'bug-0': { w: 12, h: 10, ax: 6, ay: 9, draw: (ctx) => drawBug(ctx, 0) },
  'bug-1': { w: 12, h: 10, ax: 6, ay: 9, draw: (ctx) => drawBug(ctx, 1) },

  desk: { w: 26, h: 30, ax: 13, ay: 22, draw: drawDesk },
  plant: { w: 22, h: 30, ax: 11, ay: 22, draw: drawPlant },
  rack: { w: 22, h: 36, ax: 11, ay: 28, draw: drawRack },
  boxes: { w: 24, h: 28, ax: 12, ay: 20, draw: drawBoxes },
  cooler: { w: 20, h: 34, ax: 10, ay: 26, draw: drawCooler },
  prod: { w: 24, h: 34, ax: 12, ay: 26, draw: drawProd },
  main: { w: 24, h: 28, ax: 12, ay: 20, draw: drawMain },

  'door-closed': { w: 32, h: 44, ax: 20, ay: 30, draw: (ctx) => drawDoor(ctx, false) },
  'door-open': { w: 32, h: 44, ax: 20, ay: 30, draw: (ctx) => drawDoor(ctx, true) },

  shadow: {
    w: 14,
    h: 7,
    ax: 7,
    ay: 3.5,
    draw(ctx) {
      ctx.save();
      ctx.translate(7, 3.5);
      ctx.scale(1, 0.5);
      const fade = ctx.createRadialGradient(0, 0, 0, 0, 0, 7);
      fade.addColorStop(0, 'rgba(15, 20, 50, 0.6)');
      fade.addColorStop(0.6, 'rgba(15, 20, 50, 0.5)');
      fade.addColorStop(1, 'rgba(15, 20, 50, 0)');
      ctx.fillStyle = fade;
      ctx.fillRect(-7, -7, 14, 14);
      ctx.restore();
    },
  },

  'sign-ask': sign(0x4cc9f0, SIGN_GLYPHS.ask),
  'sign-loop': sign(0xffb020, SIGN_GLYPHS.loop),
  'sign-halluc': sign(0xb57bff, SIGN_GLYPHS.halluc),
  'sign-rogue': sign(0xff4d5e, SIGN_GLYPHS.rogue),

  // White, so the game can tint them.
  'icon-approve': { w: 16, h: 16, ax: 8, ay: 8, draw: (ctx) => line(ctx, [[3.4, 8.6], [6.6, 11.6], [12.6, 4.6]], '#ffffff', 2.6) },
  'icon-stop': {
    w: 16,
    h: 16,
    ax: 8,
    ay: 8,
    draw(ctx) {
      line(ctx, [[4.2, 4.2], [11.8, 11.8]], '#ffffff', 2.6);
      line(ctx, [[11.8, 4.2], [4.2, 11.8]], '#ffffff', 2.6);
    },
  },
  'icon-review': {
    w: 16,
    h: 16,
    ax: 8,
    ay: 8,
    draw(ctx) {
      dot(ctx, 6.8, 6.8, 3.9, null, '#ffffff', 2.2);
      line(ctx, [[9.9, 9.9], [13, 13]], '#ffffff', 2.8);
    },
  },

  heart: { w: 10, h: 9, ax: 5, ay: 4.5, draw: (ctx) => drawHeart(ctx, true) },
  'heart-empty': { w: 10, h: 9, ax: 5, ay: 4.5, draw: (ctx) => drawHeart(ctx, false) },
  coin: {
    w: 10,
    h: 10,
    ax: 5,
    ay: 5,
    draw(ctx) {
      dot(ctx, 5, 5, 4.3, '#ffc93c');
      dot(ctx, 5, 5, 2.7, null, '#e39a12', 0.8);
      arc(ctx, 5, 5, 3.3, 1.1, 1.5, '#fff3b0', 0.8);
    },
  },
  'pick-coffee': { w: 14, h: 16, ax: 7, ay: 15, draw: drawCoffee },
  'pick-tokens': { w: 14, h: 15, ax: 7, ay: 14, draw: drawTokens },
  'pick-doc': { w: 14, h: 16, ax: 7, ay: 15, draw: drawDoc },
  'pick-duck': { w: 16, h: 15, ax: 7.5, ay: 14, draw: drawDuck },
  'sound-on': { w: 10, h: 10, ax: 5, ay: 5, draw: (ctx) => drawSpeaker(ctx, true) },
  'sound-off': { w: 10, h: 10, ax: 5, ay: 5, draw: (ctx) => drawSpeaker(ctx, false) },
  shield: {
    w: 10,
    h: 11,
    ax: 5,
    ay: 5.5,
    draw(ctx) {
      ctx.beginPath();
      ctx.moveTo(5, 0.7);
      ctx.lineTo(9.2, 2.2);
      ctx.quadraticCurveTo(9.4, 8, 5, 10.3);
      ctx.quadraticCurveTo(0.6, 8, 0.8, 2.2);
      ctx.closePath();
      paint(ctx, '#3ddc97');
      line(ctx, [[3, 5.4], [4.5, 7], [7.1, 3.8]], '#ffffff', 1.1);
    },
  },
  lock: {
    w: 8,
    h: 9,
    ax: 4,
    ay: 4.5,
    draw(ctx) {
      arc(ctx, 4, 3.8, 2, 1, 2, '#aab4c8', 1.2);
      rrect(ctx, 1, 3.8, 6, 4.6, 1.2, '#aab4c8', INK, 0.6);
      dot(ctx, 4, 6, 0.8, INK, null);
    },
  },
};

// --- The room ---

// Floor and wall colours; every sprint gets the next set.
const THEMES = [
  { a: 0xfff3dc, b: 0xf7e2bd, wallLeft: 0x8fd6cf, wallRight: 0x74c2bd }, // cream and teal
  { a: 0xefe6ff, b: 0xdccdfa, wallLeft: 0xb9a4ee, wallRight: 0xa18ee0 }, // lavender
  { a: 0xffe9dc, b: 0xfcd3bd, wallLeft: 0xf5a98e, wallRight: 0xe8937b }, // peach
  { a: 0xe4fbef, b: 0xc6f0da, wallLeft: 0x8bd9ad, wallRight: 0x72c79a }, // mint
  { a: 0xe3f4ff, b: 0xc5e4fa, wallLeft: 0x8fbdf0, wallRight: 0x78a8e2 }, // sky
];

// A point on the floor, in tiles from the far corner (u runs down-right, v down-left).
const floorAt = (u, v) => [OX + (u - v) * HW, OY + (u + v) * HH];
// A point on a back wall: `along` in tiles from the far corner, `up` in pixels above the floor.
const leftWall = (along, up) => [OX - along * HW, OY + along * HH - up];
const rightWall = (along, up) => [OX + along * HW, OY + along * HH - up];

export function drawRoom(ctx, sprint = 1) {
  const theme = THEMES[(((sprint - 1) % THEMES.length) + THEMES.length) % THEMES.length];
  const SLAB = 8;
  const top = floorAt(0, 0);
  const right = floorAt(N, 0);
  const bottom = floorAt(N, N);
  const left = floorAt(0, N);
  const down = ([x, y], d) => [x, y + d];

  // The slab the room stands on.
  const slab = mix(theme.b, 0x6a6f9a, 0.45);
  poly(ctx, [left, bottom, down(bottom, SLAB), down(left, SLAB)], hex(slab));
  poly(ctx, [bottom, right, down(right, SLAB), down(bottom, SLAB)], dark(slab, 0.22));

  // The floor: one big diamond, then every other tile a shade darker.
  poly(ctx, [top, right, bottom, left], hex(theme.a), null);
  ctx.fillStyle = hex(theme.b);
  for (let u = 0; u < N; u++) for (let v = 0; v < N; v++) {
    if ((u + v) % 2 === 0) continue;
    ctx.beginPath();
    ctx.moveTo(...floorAt(u, v));
    ctx.lineTo(...floorAt(u + 1, v));
    ctx.lineTo(...floorAt(u + 1, v + 1));
    ctx.lineTo(...floorAt(u, v + 1));
    ctx.closePath();
    ctx.fill();
  }
  poly(ctx, [top, right, bottom, left], null, INK);

  // The two back walls, with a lighter top and a baseboard.
  const walls = [
    { at: leftWall, color: theme.wallLeft },
    { at: rightWall, color: theme.wallRight },
  ];
  for (const { at, color } of walls) {
    poly(ctx, [at(0, 0), at(N, 0), at(N, WALL_H), at(0, WALL_H)], hex(color));
    poly(ctx, [at(0, 0), at(N, 0), at(N, 3), at(0, 3)], dark(color, 0.25), null);
    poly(ctx, [at(0, WALL_H - 2.5), at(N, WALL_H - 2.5), at(N, WALL_H), at(0, WALL_H)], light(color, 0.45), null);
    poly(ctx, [at(0, 0), at(N, 0), at(N, WALL_H), at(0, WALL_H)], null, INK);
  }
  line(ctx, [top, down(top, -WALL_H)], INK);

  // A window in the left wall.
  const pane = (from, to, low, high) => [leftWall(from, low), leftWall(to, low), leftWall(to, high), leftWall(from, high)];
  poly(ctx, pane(3.2, 6, 9, 24), '#ffffff', INK, 0.8);
  const sky = ctx.createLinearGradient(0, OY, 0, OY + 60);
  sky.addColorStop(0, '#9fdcff');
  sky.addColorStop(1, '#e6f7ff');
  poly(ctx, pane(3.45, 5.75, 10.5, 22.5), sky, INK, 0.5);
  line(ctx, [leftWall(4.6, 10.5), leftWall(4.6, 22.5)], '#ffffff', 1);
  line(ctx, [leftWall(3.45, 16.5), leftWall(5.75, 16.5)], '#ffffff', 1);
  // Sticky notes further along.
  const notes = ['#ffd166', '#ff9fb2', '#9df5d5', '#ffd166', '#c9b6ff'];
  notes.forEach((color, i) => {
    const along = 7.6 + (i % 3) * 0.75;
    const up = 18 - Math.floor(i / 3) * 6.5;
    poly(ctx, [leftWall(along, up), leftWall(along + 0.55, up), leftWall(along + 0.55, up + 4.6), leftWall(along, up + 4.6)], color, INK, 0.4);
  });

  // A whiteboard and a clock in the right wall (the door goes between them).
  const board = (from, to, low, high) => [rightWall(from, low), rightWall(to, low), rightWall(to, high), rightWall(from, high)];
  poly(ctx, board(1, 4, 9, 24), '#ffffff', INK, 0.8);
  line(ctx, [rightWall(1.4, 20), rightWall(2.6, 20)], '#ff7a8a', 0.9);
  line(ctx, [rightWall(1.4, 16.5), rightWall(3.4, 16.5)], '#8a93c6', 0.7);
  line(ctx, [rightWall(1.4, 13.5), rightWall(3, 13.5)], '#8a93c6', 0.7);
  line(ctx, [rightWall(2.9, 20.5), rightWall(3.3, 18.6), rightWall(3.7, 21.5)], '#3ddc97', 0.9);
  const [clockX, clockY] = rightWall(8.6, 18);
  ctx.save();
  ctx.translate(clockX, clockY);
  ctx.transform(1, HH / HW, 0, 1, 0, 0); // lie in the wall
  dot(ctx, 0, 0, 3.6, '#ffffff', INK, 0.8);
  line(ctx, [[0, 0], [0, -2.2]], INK, 0.6);
  line(ctx, [[0, 0], [1.6, 0.6]], INK, 0.6);
  ctx.restore();
}

// --- Handing the pictures to Phaser ---

function canvasFor(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(w * ART_SCALE);
  canvas.height = Math.ceil(h * ART_SCALE);
  const ctx = canvas.getContext('2d');
  ctx.scale(ART_SCALE, ART_SCALE);
  return { canvas, ctx };
}

// Draw every sprite once and keep it as a texture.
export function makeArt(scene) {
  for (const [key, sprite] of Object.entries(SPRITES)) {
    if (scene.textures.exists(key)) continue;
    const { canvas, ctx } = canvasFor(sprite.w, sprite.h);
    sprite.draw(ctx);
    scene.textures.addCanvas(key, canvas);
  }
}

// An image of one of the sprites, at game size, standing on its anchor point.
export function addArt(scene, x, y, key) {
  const { w, h, ax, ay } = SPRITES[key];
  return scene.add
    .image(x, y, key)
    .setScale(1 / ART_SCALE)
    .setOrigin(ax / w, ay / h);
}

// Change an image to another sprite.
export function setArt(image, key) {
  const { w, h, ax, ay } = SPRITES[key];
  return image.setTexture(key).setOrigin(ax / w, ay / h);
}

// The room's floor and walls as one screen-sized texture called 'room'.
export function makeRoomTexture(scene, sprint) {
  if (scene.textures.exists('room')) scene.textures.remove('room');
  const { canvas, ctx } = canvasFor(270, 480);
  drawRoom(ctx, sprint);
  scene.textures.addCanvas('room', canvas);
}
