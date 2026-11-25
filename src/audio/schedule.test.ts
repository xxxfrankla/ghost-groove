import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { STEPS } from '../engine/types';
import type { Pattern, Step, TrackId } from '../engine/types';
import { DRONE_MIN_STEPS } from './instruments';
import { moodArb } from '../engine/arbitraries';
import {
  advance,
  barHasDrone,
  initialState,
  planDrone,
  planStep,
  queueMood,
  queuePattern,
  stopState,
  velocityToGain,
  voiceFor,
} from './schedule';
import type { ScheduleState } from './schedule';

const velocityArb = fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true });
const pitchArb = fc.constantFrom('C2', 'D2', 'E2', 'F#2', 'A2', 'C3');
const stepArb = (withPitch: boolean): fc.Arbitrary<Step> =>
  fc.record(
    {
      velocity: velocityArb,
      pitch: withPitch ? pitchArb : fc.constant(undefined),
      length: fc.integer({ min: 1, max: 16 }),
    },
    { requiredKeys: withPitch ? ['velocity', 'pitch'] : ['velocity'] },
  );
const trackArb = (withPitch: boolean) => fc.array(stepArb(withPitch), { minLength: STEPS, maxLength: STEPS });

const droneCellArb: fc.Arbitrary<Step> = fc.record({
  velocity: fc.double({ min: 0.05, max: 1, noNaN: true, noDefaultInfinity: true }),
  pitch: pitchArb,
  length: fc.integer({ min: DRONE_MIN_STEPS, max: 20 }),
});

/** Hollow pattern with a drone note at the returned step, plus a state already sounding that pitch. */
const droneStateArb = fc
  .record({
    bpm: fc.integer({ min: 60, max: 180 }),
    kick: trackArb(false),
    clap: trackArb(false),
    A: trackArb(false),
    B: trackArb(true),
    step: fc.integer({ min: 0, max: STEPS - 1 }),
    cell: droneCellArb,
    explicitMood: fc.boolean(),
  })
  .map(({ bpm, kick, clap, A, B, step, cell, explicitMood }) => {
    B[step] = cell;
    const tracks: Record<TrackId, Step[]> = { kick, clap, A, B };
    const pattern: Pattern = { bpm, mood: 'hollow', tracks };
    const state: ScheduleState = {
      pattern,
      mood: explicitMood ? 'hollow' : null,
      pendingPattern: null,
      pendingMood: null,
      drone: cell.pitch as string,
    };
    return { state, step };
  });

describe('Property 8: Drone sustain', () => {
  // Feature: real-audio-player, Property 8: Drone sustain
  // **Validates: Requirements 8.2**
  it('holds the drone and leaves state.drone unchanged when the pitch matches', () => {
    fc.assert(
      fc.property(droneStateArb, ({ state, step }) => {
        const note = planDrone(state.pattern as Pattern, 'hollow', step);
        expect(note).not.toBeNull();
        expect(note?.pitch).toBe(state.drone);

        const result = advance(state, step);
        expect(result.drone.action).toBe('hold');
        expect(result.state.drone).toBe(state.drone);
        expect(result.events.some((e) => e.voice === 'hollowDrone')).toBe(false);
      }),
      { numRuns: 100 },
    );
  });
});

const anyHollowStateArb = fc
  .record({
    bpm: fc.integer({ min: 60, max: 180 }),
    kick: trackArb(false),
    clap: trackArb(false),
    A: trackArb(false),
    B: trackArb(true),
    step: fc.integer({ min: 0, max: STEPS - 1 }),
    drone: fc.option(pitchArb, { nil: null }),
    forceDrone: fc.boolean(),
    cell: droneCellArb,
  })
  .map(({ bpm, kick, clap, A, B, step, drone, forceDrone, cell }) => {
    if (forceDrone) B[step] = cell; // make drone notes common enough
    const pattern: Pattern = { bpm, mood: 'hollow', tracks: { kick, clap, A, B } };
    const state: ScheduleState = { pattern, mood: 'hollow', pendingPattern: null, pendingMood: null, drone };
    return { state, step };
  });

describe('Property 9: Drone retrigger conditions', () => {
  // Feature: real-audio-player, Property 9: Drone retrigger conditions
  // **Validates: Requirements 8.3**
  it('triggers iff a drone note is planned and state.drone is null or a different pitch', () => {
    fc.assert(
      fc.property(anyHollowStateArb, ({ state, step }) => {
        const note = planDrone(state.pattern as Pattern, 'hollow', step);
        const result = advance(state, step);
        const shouldTrigger = note !== null && state.drone !== note.pitch;

        expect(result.drone.action === 'trigger').toBe(shouldTrigger);
        if (note !== null && result.drone.action === 'trigger') {
          expect(result.drone.pitch).toBe(note.pitch);
          expect(result.state.drone).toBe(note.pitch);
        }
        if (note !== null && state.drone === note.pitch) {
          expect(result.drone.action).toBe('hold');
          expect(result.state.drone).toBe(state.drone);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('retriggers after stopState and on return to Hollow from another mood', () => {
    fc.assert(
      fc.property(droneStateArb, ({ state, step }) => {
        const stopped = advance(stopState(state), step);
        expect(stopped.drone.action).toBe('trigger');

        const fromNeon: ScheduleState = { ...state, mood: 'neon', pendingMood: 'hollow', drone: null };
        const returned = advance(fromNeon, 0);
        const note = planDrone(state.pattern as Pattern, 'hollow', 0);
        expect(returned.drone.action === 'trigger').toBe(note !== null);
      }),
      { numRuns: 100 },
    );
  });
});

const shortCellArb: fc.Arbitrary<Step> = fc.record({
  velocity: velocityArb,
  pitch: pitchArb,
  length: fc.integer({ min: 1, max: DRONE_MIN_STEPS - 1 }),
});

/** Hollow pattern with no drone-length notes in track B, plus a sounding drone. */
const noDroneStateArb = fc
  .record({
    bpm: fc.integer({ min: 60, max: 180 }),
    kick: trackArb(false),
    clap: trackArb(false),
    A: trackArb(false),
    B: fc.array(shortCellArb, { minLength: STEPS, maxLength: STEPS }),
    drone: pitchArb,
  })
  .map(({ bpm, kick, clap, A, B, drone }) => {
    const pattern: Pattern = { bpm, mood: 'hollow', tracks: { kick, clap, A, B } };
    const state: ScheduleState = { pattern, mood: 'hollow', pendingPattern: null, pendingMood: null, drone };
    return state;
  });

describe('Property 10: Drone release', () => {
  // Feature: real-audio-player, Property 10: Drone release
  // **Validates: Requirements 8.4, 8.5, 8.6**
  it('releases at step 0 when the bar has no drone note in the same mood', () => {
    fc.assert(
      fc.property(noDroneStateArb, (state) => {
        expect(barHasDrone(state.pattern as Pattern, 'hollow')).toBe(false);
        const result = advance(state, 0);
        expect(result.drone.action).toBe('release');
        expect(result.state.drone).toBeNull();
      }),
      { numRuns: 100 },
    );
  });

  it('releases at step 0 when the effective mood changes away from hollow', () => {
    fc.assert(
      fc.property(anyHollowStateArb, fc.constantFrom('neon' as const), ({ state }, next) => {
        const sounding: ScheduleState = { ...state, mood: 'hollow', pendingMood: next, drone: state.drone ?? 'C2' };
        const result = advance(sounding, 0);
        expect(result.drone.action).toBe('release');
        expect(result.state.drone).toBeNull();
      }),
      { numRuns: 100 },
    );
  });

  it('never releases at steps 1..15', () => {
    fc.assert(
      fc.property(
        anyHollowStateArb,
        fc.integer({ min: 1, max: STEPS - 1 }),
        fc.option(fc.constantFrom('neon' as const, 'hollow' as const), { nil: null }),
        ({ state }, step, pendingMood) => {
          const result = advance({ ...state, pendingMood, drone: state.drone ?? 'C2' }, step);
          expect(result.drone.action).not.toBe('release');
        },
      ),
      { numRuns: 200 },
    );
  });
});

// ---------- Example (unit) tests ----------

const silent = (): Step[] => Array.from({ length: STEPS }, () => ({ velocity: 0 }));
const mk = (mood: 'hollow' | 'neon', over: Partial<Record<TrackId, Step[]>> = {}, bpm = 100): Pattern => ({
  bpm,
  mood,
  tracks: { kick: silent(), clap: silent(), A: silent(), B: silent(), ...over },
});
const withCell = (at: number, cell: Step): Step[] => {
  const t = silent();
  t[at] = cell;
  return t;
};
const droneBar = (pitch: string): Pattern => mk('hollow', { B: withCell(0, { velocity: 0.8, pitch, length: 16 }) });

describe('voiceFor', () => {
  it('maps tracks to voices per mood', () => {
    expect(voiceFor('kick', 'hollow', 1)).toBe('kick');
    expect(voiceFor('clap', 'neon', 1)).toBe('clap');
    expect(voiceFor('A', 'hollow', 1)).toBe('hollowMetal');
    expect(voiceFor('A', 'neon', 1)).toBe('neonHat');
    expect(voiceFor('B', 'neon', 16)).toBe('neonBass');
    expect(voiceFor('B', 'hollow', 1)).toBe('hollowBass');
    expect(voiceFor('B', 'hollow', DRONE_MIN_STEPS - 1)).toBe('hollowBass');
    expect(voiceFor('B', 'hollow', DRONE_MIN_STEPS)).toBe('hollowDrone');
  });

  it('never picks the drone outside hollow track B', () => {
    fc.assert(
      fc.property(moodArb, fc.integer({ min: 1, max: 16 }), (mood, len) => {
        expect(voiceFor('A', mood, len)).not.toBe('hollowDrone');
        if (mood === 'neon') expect(voiceFor('B', mood, len)).toBe('neonBass');
      }),
    );
  });
});

describe('velocityToGain', () => {
  it('clamps and treats NaN as 0', () => {
    expect(velocityToGain(NaN)).toBe(0);
    expect(velocityToGain(-1)).toBe(0);
    expect(velocityToGain(2)).toBe(1);
  });
});

describe('planStep', () => {
  it('orders events kick, clap, A, B', () => {
    const cell = { velocity: 0.7 };
    const p = mk('neon', {
      kick: withCell(3, cell),
      clap: withCell(3, cell),
      A: withCell(3, cell),
      B: withCell(3, { ...cell, pitch: 'C2' }),
    });
    expect(planStep(p, 'neon', 3).map((e) => e.track)).toEqual(['kick', 'clap', 'A', 'B']);
    expect(planStep(p, 'neon', 3).map((e) => e.voice)).toEqual(['kick', 'clap', 'neonHat', 'neonBass']);
  });

  it('skips zero velocity, track B without pitch, and out-of-range steps', () => {
    const p = mk('neon', { kick: withCell(0, { velocity: 0 }), B: withCell(0, { velocity: 1 }) });
    expect(planStep(p, 'neon', 0)).toEqual([]);
    expect(planStep(p, 'neon', 40)).toEqual([]);
    const short = mk('neon', { kick: [{ velocity: 1 }] });
    expect(planStep(short, 'neon', 5)).toEqual([]);
    expect(planStep(short, 'neon', 0)).toHaveLength(1);
  });

  it('clamps B length to 1..16 and forces percussion length to 1', () => {
    const at = (length: number | undefined) =>
      planStep(mk('neon', { B: withCell(0, { velocity: 1, pitch: 'C2', length }) }), 'neon', 0)[0].lengthSteps;
    expect(at(0)).toBe(1);
    expect(at(-3)).toBe(1);
    expect(at(99)).toBe(16);
    expect(at(undefined)).toBe(1);
    expect(at(NaN)).toBe(1);
    const k = planStep(mk('neon', { kick: withCell(0, { velocity: 1, length: 8 }) }), 'neon', 0)[0];
    expect(k.lengthSteps).toBe(1);
    expect(k.pitch).toBeUndefined();
  });

  it('carries pitch for B and gain from velocity', () => {
    const [e] = planStep(mk('hollow', { B: withCell(2, { velocity: 0.5, pitch: 'E2', length: 2 }) }), 'hollow', 2);
    expect(e).toMatchObject({ track: 'B', voice: 'hollowBass', pitch: 'E2', lengthSteps: 2 });
    expect(e.gain).toBeCloseTo(velocityToGain(0.5));
  });

  it('omits the drone event in hollow', () => {
    expect(planStep(droneBar('C2'), 'hollow', 0)).toEqual([]);
  });
});

describe('queuePattern / queueMood', () => {
  const p = mk('neon');
  it('applies immediately when not running', () => {
    const s = queuePattern(initialState, p, false);
    expect(s).toMatchObject({ pattern: p, mood: 'neon', pendingPattern: null, pendingMood: null });
    const m = queueMood(s, 'hollow', false);
    expect(m.mood).toBe('hollow');
    expect(m.pendingMood).toBeNull();
  });

  it('only sets pending values when running', () => {
    const s = queuePattern(initialState, p, true);
    expect(s.pattern).toBeNull();
    expect(s.mood).toBeNull();
    expect(s.pendingPattern).toBe(p);
    expect(s.pendingMood).toBe('neon');
    const m = queueMood(s, 'hollow', true);
    expect(m.pendingMood).toBe('hollow');
    expect(m.mood).toBeNull();
  });

  it('promotes pending pattern and bpm only at step 0', () => {
    const s = queuePattern(queuePattern(initialState, mk('neon'), false), mk('hollow', {}, 120), true);
    const mid = advance(s, 5);
    expect(mid.bpm).toBeUndefined();
    expect(mid.state.pendingPattern).not.toBeNull();
    const start = advance(s, 0);
    expect(start.bpm).toBe(120);
    expect(start.state.pendingPattern).toBeNull();
    expect(start.state.mood).toBe('hollow');
  });

  it('returns nothing without a pattern', () => {
    expect(advance(initialState, 0)).toMatchObject({ events: [], drone: { action: 'none' } });
  });
});

describe('multi-bar drone continuity', () => {
  const run = (s: ScheduleState, step: number) => advance(s, step);

  it('triggers first, holds on repeat, retriggers on pitch change', () => {
    let s = queuePattern(initialState, droneBar('C2'), false);
    const first = run(s, 0);
    expect(first.drone).toMatchObject({ action: 'trigger', pitch: 'C2' });
    s = first.state;
    expect(s.drone).toBe('C2');
    expect(run(s, 0).drone.action).toBe('hold');
    expect(run(s, 1).drone.action).toBe('none');
    s = queuePattern(s, droneBar('E2'), true);
    const changed = run(s, 0);
    expect(changed.drone).toMatchObject({ action: 'trigger', pitch: 'E2' });
    expect(changed.state.drone).toBe('E2');
  });

  it('releases at the bar start when the signal drops', () => {
    let s = run(queuePattern(initialState, droneBar('C2'), false), 0).state;
    s = queuePattern(s, mk('hollow'), true);
    const r = run(s, 0);
    expect(r.drone.action).toBe('release');
    expect(r.state.drone).toBeNull();
    expect(run(r.state, 0).drone.action).toBe('none');
  });

  it('releases on Hollow to Neon and retriggers on return to Hollow', () => {
    let s = run(queuePattern(initialState, droneBar('C2'), false), 0).state;
    s = queueMood(s, 'neon', true);
    const toNeon = run(s, 0);
    expect(toNeon.drone.action).toBe('release');
    expect(toNeon.events.some((e) => e.voice === 'hollowDrone')).toBe(false);
    expect(toNeon.state.drone).toBeNull();
    const back = run(queueMood(toNeon.state, 'hollow', true), 0);
    expect(back.drone).toMatchObject({ action: 'trigger', pitch: 'C2' });
  });

  it('stopState clears the drone but keeps pattern, mood and pending values', () => {
    let s = run(queuePattern(initialState, droneBar('C2'), false), 0).state;
    s = queueMood(s, 'neon', true);
    const stopped = stopState(s);
    expect(stopped.drone).toBeNull();
    expect(stopped.pattern).toBe(s.pattern);
    expect(stopped.mood).toBe('hollow');
    expect(stopped.pendingMood).toBe('neon');
    const s2 = queueMood(run(queuePattern(initialState, droneBar('C2'), false), 0).state, 'hollow', false);
    expect(run(stopState(s2), 0).drone.action).toBe('trigger');
  });
});
