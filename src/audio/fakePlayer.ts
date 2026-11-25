import type { MoodId, Pattern, Player } from '../engine/types';
import { STEPS } from '../engine/types';

export const FAKE_BPM = 124;
const STEP_MS = 60000 / FAKE_BPM / 4; // 16th-note steps

export interface FakePlayer extends Player {
  /** The pattern currently in effect (after any next-bar switch). */
  getActivePattern(): Pattern | null;
  getMood(): MoodId | null;
}

/** Silent Player that ticks with setInterval. Stands in for the Tone.js player. */
export function createFakePlayer(): FakePlayer {
  let timer: ReturnType<typeof setInterval> | null = null;
  let active: Pattern | null = null;
  let pending: Pattern | null = null;
  let mood: MoodId | null = null;
  let step = 0;
  let bar = 0;
  const listeners = new Set<(step: number, bar: number) => void>();

  function tick() {
    if (step === 0 && pending) {
      active = pending;
      pending = null;
    }
    for (const cb of [...listeners]) cb(step, bar);
    step += 1;
    if (step === STEPS) {
      step = 0;
      bar += 1;
    }
  }

  return {
    async start() {
      if (timer !== null) return;
      step = 0;
      bar = 0;
      tick();
      timer = setInterval(tick, STEP_MS);
    },
    stop() {
      if (timer !== null) clearInterval(timer);
      timer = null;
    },
    setPattern(p) {
      if (timer === null) active = p;
      else pending = p;
    },
    setMood(m) {
      mood = m;
    },
    onStep(cb) {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    getActivePattern: () => active,
    getMood: () => mood,
  };
}
