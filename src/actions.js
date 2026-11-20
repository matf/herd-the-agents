import { COLOR } from './view.js';

// The three things you can do to whatever stands next to you. Every misbehaviour needs one of them.
export const ACTIONS = {
  approve: { key: 'approve', label: 'APPROVE', icon: 'icon-approve', color: COLOR.ask, keys: ['j', 'z', '1'], hint: 'J' },
  stop: { key: 'stop', label: 'CTRL-C', icon: 'icon-stop', color: COLOR.rogue, keys: ['k', 'x', '2', ' '], hint: 'K' },
  review: { key: 'review', label: 'REVIEW', icon: 'icon-review', color: COLOR.halluc, keys: ['l', 'c', '3'], hint: 'L' },
};

// What an agent in each derailed mode needs. (Bugs need a review, too.)
export const NEEDS = { ask: 'approve', loop: 'stop', rogue: 'stop', push: 'stop', halluc: 'review' };

// The action a key on the keyboard stands for, if any.
export function actionForKey(key) {
  const lower = key.toLowerCase();
  return Object.values(ACTIONS).find((a) => a.keys.includes(lower))?.key ?? null;
}
