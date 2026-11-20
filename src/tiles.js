// Frame numbers in public/assets/tiles.png: Kenney's 1-Bit Pack, 16x16 tiles, 48 columns,
// white on transparent. at(column, row) as counted in the sheet.
const at = (col, row) => row * 48 + col;

export const T = {
  hero: at(25, 0),
  robot: at(31, 6),
  robotAlt: at(30, 6),
  bug: [at(18, 8), at(19, 8), at(20, 8), at(21, 8), at(22, 8)],
  slash: at(25, 11),

  // The room
  wall: at(10, 17),
  speck: [at(5, 0), at(6, 0), at(7, 0)],
  doorClosed: at(3, 9),
  doorOpen: at(2, 9),
  desk: at(10, 16),
  database: at(13, 13),
  mainButton: at(8, 18),
  rack: at(4, 6),
  shelf: at(5, 6),
  crate: at(15, 15),
  cactus: at(6, 1),
  chip: at(13, 15),

  // Signs over the agents' heads
  bang: at(35, 13),
  bangBubble: at(36, 13),
  question: at(37, 13),
  questionBubble: at(38, 13),
  turn: at(21, 20),
  warning: at(35, 21),
  arrowUp: at(28, 21),

  // HUD and menus
  heart: at(39, 10),
  heartEmpty: at(40, 10),
  coin: at(41, 3),
  soundOn: at(38, 16),
  soundOff: at(37, 16),
  trophy: at(40, 16),
  skull: at(38, 11),
  lock: at(0, 10),

  // Upgrades
  boots: at(39, 1),
  sword: at(33, 7),
  book: at(45, 5),
  floppy: at(42, 16),
  money: at(43, 4),
  shield: at(39, 4),
  gear: at(45, 16),
  hourglass: at(40, 12),
  face: at(37, 14),
};
