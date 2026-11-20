// What is kept between runs lives in localStorage.
// Browsers can block it (private mode), so every access is wrapped in try/catch.
const KEY = 'herdTheAgents.save';

const DEFAULTS = {
  bestPrs: 0, // most PRs merged in one run
  bestSprint: 0, // furthest sprint reached
  muted: false,
};

export function loadSave() {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    // Use the defaults.
  }
  return { ...DEFAULTS, ...saved };
}

export function writeSave(save) {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    // Not saved this time; the game keeps working.
  }
}
