import { loadSave, writeSave } from './save.js';

// All sound effects are little synthesizer blips made with the Web Audio API, so there are no
// audio files to load. Each effect is a list of notes: [frequency, end frequency, start, length].
const VOLUME = 0.07;

const EFFECTS = {
  swing: { type: 'triangle', notes: [[620, 180, 0, 0.09]] },
  fix: { type: 'square', notes: [[523, 523, 0, 0.06], [784, 784, 0.06, 0.09]] },
  approve: { type: 'square', notes: [[660, 660, 0, 0.05], [880, 880, 0.05, 0.07]] },
  merge: { type: 'square', notes: [[988, 988, 0, 0.07], [1319, 1319, 0.07, 0.16]] },
  squash: { type: 'sawtooth', notes: [[300, 90, 0, 0.1]] },
  hurt: { type: 'sawtooth', notes: [[220, 70, 0, 0.25]] },
  derail: { type: 'triangle', notes: [[330, 247, 0, 0.12]] },
  rogue: { type: 'square', notes: [[440, 440, 0, 0.08], [311, 311, 0.1, 0.08], [440, 440, 0.2, 0.08], [311, 311, 0.3, 0.1]] },
  incident: { type: 'sawtooth', notes: [[160, 60, 0, 0.5], [120, 40, 0.1, 0.5]] },
  door: { type: 'square', notes: [[523, 523, 0, 0.08], [659, 659, 0.08, 0.08], [784, 784, 0.16, 0.08], [1047, 1047, 0.24, 0.2]] },
  pick: { type: 'square', notes: [[784, 784, 0, 0.06], [1047, 1047, 0.06, 0.06], [1319, 1319, 0.12, 0.14]] },
  pickup: { type: 'square', notes: [[880, 880, 0, 0.05], [1175, 1175, 0.05, 0.05], [1568, 1568, 0.1, 0.13]] },
  click: { type: 'square', notes: [[700, 700, 0, 0.04]] },
  oops: { type: 'triangle', notes: [[260, 200, 0, 0.1]] },
  over: { type: 'triangle', notes: [[392, 392, 0, 0.18], [330, 330, 0.18, 0.18], [262, 262, 0.36, 0.18], [196, 150, 0.54, 0.5]] },
};

let muted = loadSave().muted;

export function isMuted() {
  return muted;
}

export function toggleMute() {
  muted = !muted;
  writeSave({ ...loadSave(), muted });
  return muted;
}

export function play(scene, key) {
  if (muted) return;
  const ctx = scene.sound.context;
  // Browsers only allow sound after the first tap or key press; Phaser unlocks it then.
  if (!ctx || ctx.state !== 'running') return;
  try {
    const { type, notes } = EFFECTS[key];
    for (const [from, to, start, length] of notes) {
      const t = ctx.currentTime + start;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(from, t);
      if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, t + length);
      gain.gain.setValueAtTime(VOLUME, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + length + 0.02);
    }
  } catch {
    // No sound this time; the game keeps working.
  }
}
