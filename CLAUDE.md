# Notes for coding agents

Herd the Agents: a portrait, top-down action roguelike for phones and computers.
Phaser 4 + Vite, plain JavaScript (ES modules), no framework, no TypeScript. See README.md.

- `npm run dev` to try it, `npm run build` must pass before pushing. Pushing to `main` deploys to
  GitHub Pages (https://matf.github.io/herd-the-agents/), so asset paths at runtime must stay
  relative (`this.load.setPath('assets')`, never `'/assets'`).
- The world is 270x480 game pixels; the canvas is `ZOOM` (4) times bigger so text is sharp. Every
  scene calls `setupCamera(this)`; texts go through `addText` in `src/view.js`. Raw browser
  coordinates must be converted to game pixels (see `TouchPad.toGame`).
- All sprites come from one white-on-transparent sheet (`public/assets/tiles.png`, 16 px tiles,
  48 columns) and are tinted in code. Frame numbers live in `src/tiles.js`, colours in `COLOR`.
- The run's state is one plain object in the registry (`registry.get('run')`, see `src/run.js`).
  `UIScene` only reads it. Numbers that tune the game are named constants at the top of each file;
  difficulty per sprint is in `sprintRules`.
- Agents and bugs walk on the tile grid with breadth-first search (`src/room.js`); only the player
  uses Arcade physics. Rooms must stay fully connected (`tryBlock`).
- Phone input is `src/objects/TouchPad.js` (DOM touch events on `#game`); keep everything playable
  with one thumb per side and test changes in a phone-sized touch viewport as well as with keys.
- `localStorage` access is always wrapped in try/catch (`src/save.js`).
- In dev, `window.game` is exposed for poking at the game and for automated play-testing.
- Original game: do not copy characters, art, names or levels from existing games.
