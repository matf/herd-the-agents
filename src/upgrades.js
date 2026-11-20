import { T } from './tiles.js';
import { COLOR } from './view.js';

// The upgrades you pick from after every sprint. `apply` changes the run (see src/run.js).
export const UPGRADES = [
  {
    key: 'shoes',
    name: 'Running shoes',
    text: 'You walk 15% faster.',
    icon: T.boots,
    color: COLOR.ok,
    apply: (run) => (run.speed *= 1.15),
  },
  {
    key: 'keyboard',
    name: 'Mechanical keyboard',
    text: 'Ctrl-C reaches 30% further.',
    icon: T.sword,
    color: COLOR.ink,
    apply: (run) => (run.reach *= 1.3),
  },
  {
    key: 'context',
    name: 'Bigger context window',
    text: 'Agents hallucinate half as often.',
    icon: T.book,
    color: COLOR.halluc,
    apply: (run) => (run.hallucChance *= 0.5),
  },
  {
    key: 'auto',
    name: 'Auto-approve',
    text: 'Prompts approve themselves. Agents go rogue more often.',
    icon: T.gear,
    color: COLOR.ask,
    once: true,
    apply: (run) => {
      run.autoApprove = true;
      run.rogueChance *= 1.5;
    },
  },
  {
    key: 'cache',
    name: 'Prompt cache',
    text: 'Agents burn 15% fewer tokens.',
    icon: T.floppy,
    color: COLOR.ask,
    apply: (run) => (run.burn *= 0.85),
  },
  {
    key: 'coffee',
    name: 'Coffee',
    text: 'Heal 2 hearts.',
    icon: T.heart,
    color: COLOR.rogue,
    available: (run) => run.hearts < run.maxHearts,
    apply: (run) => (run.hearts = Math.min(run.maxHearts, run.hearts + 2)),
  },
  {
    key: 'budget',
    name: 'Extra budget',
    text: '+40k tokens, and room for more.',
    icon: T.money,
    color: COLOR.loop,
    apply: (run) => {
      run.maxBudget += 20;
      run.budget = Math.min(run.maxBudget, run.budget + 40);
    },
  },
  {
    key: 'ci',
    name: 'CI gate',
    text: 'Blocks the first incident of every sprint.',
    icon: T.shield,
    color: COLOR.ok,
    once: true,
    apply: (run) => (run.ciGate = true),
  },
  {
    key: 'pair',
    name: 'Pair programming',
    text: 'Agents work 20% faster.',
    icon: T.face,
    color: COLOR.hero,
    apply: (run) => (run.workSpeed *= 1.2),
  },
  {
    key: 'linter',
    name: 'Linter',
    text: 'Bugs crawl 25% slower.',
    icon: T.hourglass,
    color: COLOR.halluc,
    apply: (run) => (run.bugSpeed *= 0.75),
  },
];

// Three different upgrades to choose from.
export function offerUpgrades(run) {
  const pool = UPGRADES.filter(
    (u) => !(u.once && run.perks.includes(u.key)) && (!u.available || u.available(run)),
  );
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 3);
}
