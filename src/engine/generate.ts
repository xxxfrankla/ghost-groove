import type { GenerateInput, Pattern, Step } from './types';
import { STEPS } from './types';
import {
  DEFAULT_DENSITY,
  GHOST_MIN_DENSITY,
  GHOST_VELOCITY,
  MAX_ACCENTS_PER_BAND,
  MOODS,
  SIGNAL_FLOOR,
  accentThreshold,
  ghostThreshold,
  pitchName,
} from './presets';

const finiteOr = (v: number, fallback: number): number => (Number.isFinite(v) ? v : fallback);
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

const stepsFrom = (hits: readonly number[]): Step[] =>
  Array.from({ length: STEPS }, (_, i) => ({ velocity: hits.includes(i) ? 1 : 0 }));

/**
 * Velocities (0, GHOST_VELOCITY or 1) for one band. Accents are the `cap` best-scoring cells at or
 * above the accent threshold (ties go to the lower index). Overflow candidates and cells above the
 * ghost threshold become ghost notes when density >= GHOST_MIN_DENSITY.
 */
export function bandVelocities(
  scores: readonly number[],
  density: number,
  live: boolean,
  cap: number = MAX_ACCENTS_PER_BAND,
  skip?: number,
): number[] {
  const vel: number[] = new Array<number>(STEPS).fill(0);
  if (!live) return vel;

  const s = Array.from({ length: STEPS }, (_, i) => {
    const v = scores?.[i];
    return typeof v === 'number' && Number.isFinite(v) ? v : 0;
  });
  const tAcc = accentThreshold(density);
  const tGhost = ghostThreshold(density);
  const ghostsOn = density >= GHOST_MIN_DENSITY;

  const candidates: number[] = [];
  for (let i = 0; i < STEPS; i++) if (i !== skip && s[i] >= tAcc) candidates.push(i);
  candidates.sort((a, b) => s[b] - s[a] || a - b);

  const accents = candidates.slice(0, Math.max(0, cap));
  const overflow = candidates.slice(Math.max(0, cap));

  for (const i of accents) vel[i] = 1;
  if (ghostsOn) {
    for (const i of overflow) vel[i] = GHOST_VELOCITY;
    for (let i = 0; i < STEPS; i++) {
      if (i !== skip && vel[i] === 0 && s[i] >= tGhost) vel[i] = GHOST_VELOCITY;
    }
  }
  return vel;
}

export function generatePattern(input: GenerateInput): Pattern {
  const mood = MOODS[input.mood];
  const d = clamp(finiteOr(input.density, DEFAULT_DENSITY), 0, 100);
  const live = finiteOr(input.features.signalStrength, 0) >= SIGNAL_FLOOR;

  const groove = mood.baseGroove(d);
  const kick = stepsFrom(groove.kick);
  const clap = stepsFrom(groove.clap);

  const aVel = bandVelocities(input.bands.A.scores, d, live, MAX_ACCENTS_PER_BAND);
  const A: Step[] = aVel.map((velocity) => ({ velocity }));

  const droneOn = mood.drone && live;
  const bVel = bandVelocities(
    input.bands.B.scores,
    d,
    live,
    MAX_ACCENTS_PER_BAND - (droneOn ? 1 : 0),
    mood.drone ? 0 : undefined,
  );
  if (droneOn) bVel[0] = 1;

  const octave = mood.baseOctaveForRegister(finiteOr(input.bands.B.register, 0.5));
  const pool = mood.scaleOffsets.map((o) => pitchName(octave, mood.rootPitchClass + o));

  const B: Step[] = Array.from({ length: STEPS }, (_, i) => {
    const step: Step = { velocity: bVel[i], pitch: pool[mood.bassLine[i]] };
    if (i === 0 && droneOn) step.length = STEPS;
    else if (!mood.drone || bVel[i] > 0) step.length = mood.bNoteLength;
    return step;
  });

  return { bpm: mood.bpm, mood: input.mood, tracks: { kick, clap, A, B } };
}
