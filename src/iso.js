import { TILE } from './room.js';

// The game's rules live on a plain square grid (see room.js); only the drawing is isometric.
// The room is a diamond: grid column 1..N runs down to the right, row 1..N down to the left.
export const N = 11; // floor tiles along each side of the room
export const HW = 12; // half the width of a floor tile on screen
export const HH = 8; // half its height
export const OX = 135; // where the floor's far (top) corner is on screen
export const OY = 92;
export const WALL_H = 30; // height of the two back walls

// Grid pixels (what the rules use) -> screen pixels.
export function toScreen(x, y) {
  const u = x / TILE - 1; // the ring of wall tiles around the floor is not drawn as tiles
  const v = y / TILE - 1;
  return { x: OX + (u - v) * HW, y: OY + (u + v) * HH };
}

// The middle of a grid tile on screen.
export const tileScreen = (c, r) => toScreen(c * TILE + TILE / 2, r * TILE + TILE / 2);

// A direction on screen (joystick, arrow keys) -> the same direction on the grid, length 1.
export function toGridDirection(dx, dy) {
  const gx = dx / HW + dy / HH;
  const gy = -dx / HW + dy / HH;
  const length = Math.hypot(gx, gy) || 1;
  return { x: gx / length, y: gy / length };
}

// Things further down the screen are drawn in front.
export const depthAt = (x, y) => 100 + (x + y) / 4;
