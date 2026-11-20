// One run = one game, from the first sprint until the budget or the hearts are gone.
// The run lives in the registry (`registry.get('run')`) so every scene can read it.

export const START_HEARTS = 4;
export const START_BUDGET = 100; // in "k tokens"
export const SPRINT_BONUS = 12; // tokens you get for finishing a sprint
export const PR_REFUND = 5; // tokens every merged PR earns back

export function newRun() {
  return {
    sprint: 1, // the room you are in
    prs: 0, // PRs merged in the whole run (the score)
    sprintPrs: 0, // PRs merged in this sprint
    hearts: START_HEARTS,
    maxHearts: START_HEARTS,
    budget: START_BUDGET,
    maxBudget: START_BUDGET,
    time: 0, // seconds played
    fixes: 0, // agents put back on task
    squashed: 0, // bugs squashed
    incidents: 0,
    powerups: 0, // power-ups picked up
    perks: [], // keys of the upgrades picked so far
    hinted: [], // misbehaviours that were explained already
    burning: 0, // k tokens per second right now
    // Changed by upgrades (see src/upgrades.js):
    speed: 1,
    reach: 1,
    burn: 1,
    workSpeed: 1,
    bugSpeed: 1,
    hallucChance: 1,
    rogueChance: 1,
    autoApprove: false,
    ciGate: false,
    ciReady: false, // the CI gate blocks one incident per sprint
    over: null, // why the run ended: 'budget', 'incident' or 'bugs'
  };
}

// How hard a sprint is. Everything that grows with the sprint number is in here.
export function sprintRules(sprint) {
  return {
    goal: Math.min(3 + sprint, 9), // PRs to merge before the door opens
    agents: Math.min(5, 2 + Math.floor(sprint / 2)),
    workTime: 5.5 + 0.2 * Math.min(sprint, 10), // seconds at the desk for one PR
    derailEvery: Math.max(0.45, 1 - 0.06 * (sprint - 1)), // multiplies the time between derails
    // Which misbehaviours can happen: they are introduced one sprint at a time.
    kinds: sprint === 1 ? ['ask', 'loop'] : sprint === 2 ? ['ask', 'loop', 'halluc'] : ['ask', 'loop', 'halluc', 'rogue'],
    bugSpeed: Math.min(50, 30 + 2 * sprint), // grid pixels per second
    maxBugs: Math.min(7, 3 + Math.floor(sprint / 2)),
    rogueSpeed: Math.min(48, 28 + 2 * sprint),
    // Long runs have to end, too: from sprint 7 on everything burns a little more every sprint,
    // and from sprint 10 on (where the rest stops getting harder) it grows faster and faster.
    burn: 1 + 0.06 * Math.max(0, sprint - 6) + 0.015 * Math.max(0, sprint - 9) ** 2,
  };
}

// Your title on the game-over screen, by PRs merged.
const RANKS = [
  [0, 'Prompt Intern'],
  [5, 'Junior Agent Wrangler'],
  [12, 'Agent Herder'],
  [22, 'Senior Agent Herder'],
  [35, 'Staff Orchestrator'],
  [50, 'Principal Swarm Whisperer'],
  [70, 'Distinguished Herder of Agents'],
];

export function rankFor(prs) {
  let title = RANKS[0][1];
  for (const [min, name] of RANKS) if (prs >= min) title = name;
  return title;
}
