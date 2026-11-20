// Every sprint is one random room on a grid of 16-pixel tiles.
export const TILE = 16;
export const COLS = 15;
export const ROWS = 20;
export const ROOM_X = 15; // where the grid starts on screen
export const ROOM_Y = 46;

export const FLOOR = 0;
export const WALL = 1;
export const SOLID = 2; // desks, racks, the database... anything you can't walk through

export const DOOR = { c: 7, r: 0 };
export const START = { c: 7, r: ROWS - 3 };

const MIN_OBSTACLES = 3;
const MAX_OBSTACLES = 7;
const DESK_SPACING = 3; // desks are at least this many tiles apart

// The middle of a tile, in game pixels.
export const tileX = (c) => ROOM_X + c * TILE + TILE / 2;
export const tileY = (r) => ROOM_Y + r * TILE + TILE / 2;
// The tile a point is on.
export const tileAt = (x, y) => ({ c: Math.floor((x - ROOM_X) / TILE), r: Math.floor((y - ROOM_Y) / TILE) });

const key = (c, r) => r * COLS + c;
const rand = (n) => Math.floor(Math.random() * n);
const NEIGHBOURS = [[0, -1], [1, 0], [0, 1], [-1, 0]];

export const isFloor = (grid, c, r) => c >= 0 && r >= 0 && c < COLS && r < ROWS && grid[key(c, r)] === FLOOR;

// Breadth-first search from one tile: how many steps to every tile you can reach.
function flood(grid, from) {
  const steps = new Int16Array(COLS * ROWS).fill(-1);
  steps[key(from.c, from.r)] = 0;
  const queue = [from];
  for (let i = 0; i < queue.length; i++) {
    const { c, r } = queue[i];
    for (const [dc, dr] of NEIGHBOURS) {
      const nc = c + dc;
      const nr = r + dr;
      if (!isFloor(grid, nc, nr) || steps[key(nc, nr)] >= 0) continue;
      steps[key(nc, nr)] = steps[key(c, r)] + 1;
      queue.push({ c: nc, r: nr });
    }
  }
  return steps;
}

// The shortest way from one floor tile to another, as a list of tiles (without the first).
// Empty when you are already there or there is no way.
export function findPath(grid, from, to) {
  if (!isFloor(grid, to.c, to.r) || (from.c === to.c && from.r === to.r)) return [];
  const steps = flood(grid, to); // walk "downhill" towards the goal
  if (steps[key(from.c, from.r)] < 0) return [];
  const path = [];
  let { c, r } = from;
  while (steps[key(c, r)] > 0) {
    // Among the neighbours one step closer, prefer a random one so agents don't all take the same lane.
    const next = NEIGHBOURS.map(([dc, dr]) => ({ c: c + dc, r: r + dr })).filter(
      (n) => isFloor(grid, n.c, n.r) && steps[key(n.c, n.r)] === steps[key(c, r)] - 1,
    );
    ({ c, r } = next[rand(next.length)]);
    path.push({ c, r });
  }
  return path;
}

// True when every floor tile can still be reached from the start.
function allConnected(grid) {
  const steps = flood(grid, START);
  for (let i = 0; i < grid.length; i++) if (grid[i] === FLOOR && steps[i] < 0) return false;
  return true;
}

// Put something solid on a tile, unless that would cut part of the room off.
function tryBlock(grid, c, r) {
  grid[key(c, r)] = SOLID;
  if (allConnected(grid)) return true;
  grid[key(c, r)] = FLOOR;
  return false;
}

export function randomFloor(grid) {
  for (;;) {
    const c = 1 + rand(COLS - 2);
    const r = 1 + rand(ROWS - 2);
    if (isFloor(grid, c, r)) return { c, r };
  }
}

// A new room with `deskCount` desks. Returns:
//   grid       FLOOR / WALL / SOLID for every tile
//   desks      [{ c, r, work: { c, r } }]  the agent stands on `work`, right below its desk
//   hazards    [{ kind: 'prod' | 'main', c, r, approach: { c, r } }]  what rogue agents run to
//   obstacles  [{ c, r, kind }]  racks, shelves, crates and plants
export function generateRoom(deskCount) {
  // Now and then the desks don't all fit between each other; then start over.
  for (let tries = 0; ; tries++) {
    const room = tryRoom(deskCount);
    if (room.desks.length === deskCount || tries > 30) return room;
  }
}

function tryRoom(deskCount) {
  const grid = new Uint8Array(COLS * ROWS);
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
    if (c === 0 || r === 0 || c === COLS - 1 || r === ROWS - 1) grid[key(c, r)] = WALL;
  }

  // Tiles that must stay free: around the start, below the door, and wherever somebody stands.
  const reserved = new Set();
  const reserve = (c, r) => reserved.add(key(c, r));
  for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 1; dr++) reserve(START.c + dc, START.r + dr);
  reserve(DOOR.c, 1);
  reserve(DOOR.c, 2);

  // The production database and the main branch sit in two different corners.
  const corners = [
    { c: 1, r: 1, side: 1 },
    { c: COLS - 2, r: 1, side: -1 },
    { c: 1, r: ROWS - 2, side: 1 },
    { c: COLS - 2, r: ROWS - 2, side: -1 },
  ];
  const first = rand(4);
  const second = (first + 1 + rand(3)) % 4;
  const hazards = [first, second].map((i, n) => {
    const { c, r, side } = corners[i];
    grid[key(c, r)] = SOLID;
    reserve(c + side, r);
    reserve(c, r === 1 ? 2 : r - 1);
    return { kind: n === 0 ? 'prod' : 'main', c, r, approach: { c: c + side, r } };
  });

  // Desks, each with a free tile below it for the agent.
  const desks = [];
  for (let tries = 0; desks.length < deskCount && tries < 400; tries++) {
    const c = 2 + rand(COLS - 4);
    const r = 3 + rand(ROWS - 8);
    if (reserved.has(key(c, r)) || reserved.has(key(c, r + 1))) continue;
    if (!isFloor(grid, c, r) || !isFloor(grid, c, r + 1)) continue;
    if (desks.some((d) => Math.max(Math.abs(d.c - c), Math.abs(d.r - r)) < DESK_SPACING)) continue;
    if (!tryBlock(grid, c, r)) continue;
    reserve(c, r + 1);
    desks.push({ c, r, work: { c, r: r + 1 } });
  }

  // A few things in the way.
  const kinds = ['rack', 'rack', 'shelf', 'crate', 'crate', 'cactus'];
  const obstacles = [];
  const wanted = MIN_OBSTACLES + rand(MAX_OBSTACLES - MIN_OBSTACLES + 1);
  for (let tries = 0; obstacles.length < wanted && tries < 200; tries++) {
    const c = 1 + rand(COLS - 2);
    const r = 2 + rand(ROWS - 4);
    if (reserved.has(key(c, r)) || !isFloor(grid, c, r)) continue;
    if (!tryBlock(grid, c, r)) continue;
    obstacles.push({ c, r, kind: kinds[rand(kinds.length)] });
  }

  return { grid, desks, hazards, obstacles };
}
