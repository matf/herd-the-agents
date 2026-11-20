// Power-ups that turn up on the floor during a sprint. Walk over one to take it.
export const COFFEE_TIME = 8; // seconds of walking faster
export const COFFEE_SPEED = 1.6;
export const FOCUS_TIME = 9; // seconds nobody derails after reading AGENTS.md
export const TOKEN_PACK = 15; // k tokens

// `wanted` says whether this one would be any use right now; `weight` is how often it comes up.
export const PICKUPS = [
  {
    key: 'coffee',
    art: 'pick-coffee',
    name: 'COFFEE',
    color: 0xffc9a0,
    text: `You walk much faster for ${COFFEE_TIME} seconds.`,
    weight: 3,
    wanted: () => true,
  },
  {
    key: 'tokens',
    art: 'pick-tokens',
    name: 'TOKEN PACK',
    color: 0xffc93c,
    text: `+${TOKEN_PACK}k tokens.`,
    weight: 3,
    wanted: (scene) => scene.run.budget < scene.run.maxBudget - 5,
  },
  {
    key: 'docs',
    art: 'pick-doc',
    name: 'AGENTS.MD',
    color: 0x3ddc97,
    text: 'Clear instructions! Every agent is back on task and stays there for a while.',
    weight: 2,
    wanted: () => true,
  },
  {
    key: 'duck',
    art: 'pick-duck',
    name: 'RUBBER DUCK',
    color: 0xffd84a,
    text: 'It debugged the whole room: every bug is gone.',
    weight: 4,
    wanted: (scene) => scene.bugs.length > 0,
  },
  {
    key: 'heart',
    art: 'heart',
    scale: 1.5,
    name: 'DAY OFF',
    color: 0xff4d5e,
    text: 'One heart back.',
    weight: 1.5,
    wanted: (scene) => scene.run.hearts < scene.run.maxHearts,
  },
];

// One of the power-ups that are of use right now, by weight.
export function choosePickup(scene) {
  const list = PICKUPS.filter((p) => p.wanted(scene));
  let roll = Math.random() * list.reduce((sum, p) => sum + p.weight, 0);
  return list.find((p) => (roll -= p.weight) < 0) ?? list[0];
}
