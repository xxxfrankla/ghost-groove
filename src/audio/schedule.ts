/**
 * Pure per-step scheduling decisions for the Tone player. No Tone, no DOM, no
 * time, no randomness. Lenient at the boundary: bad input is skipped, never thrown.
 */
import type { MoodId, Pattern, Step, TrackId } from '../engine/types';
import { DRONE_MIN_STEPS, VELOCITY_CURVE } from './instruments';
import type { VoiceId } from './instruments';

export interface NoteEvent {
  track: TrackId;
  voice: VoiceId;
  gain: number; // 0..1, = velocityToGain(step.velocity)
  pitch?: string; // track B only
  lengthSteps: number; // >= 1; 1 for percussion
}

export interface ScheduleState {
  pattern: Pattern | null; // in effect now
  mood: MoodId | null; // in effect now
  pendingPattern: Pattern | null;
  pendingMood: MoodId | null;
  drone: string | null; // pitch of the Hollow drone currently sounding, or null
}

/** What the player must do with the single Hollow drone voice at this step. */
export type DroneCommand =
  | { action: 'none' }
  | { action: 'trigger'; pitch: string; gain: number }
  | { action: 'hold' }
  | { action: 'release' };

export interface Advance {
  state: ScheduleState;
  events: NoteEvent[]; // never contains a hollowDrone event
  drone: DroneCommand;
  bpm?: number; // set only when a pending pattern was promoted at step 0
}

const TRACK_ORDER: readonly TrackId[] = ['kick', 'clap', 'A', 'B'];
const MAX_LENGTH = 16;

export function velocityToGain(velocity: number): number {
  if (typeof velocity !== 'number' || Number.isNaN(velocity)) return 0;
  const v = Math.min(1, Math.max(0, velocity));
  return v ** VELOCITY_CURVE;
}

export function voiceFor(track: TrackId, mood: MoodId, lengthSteps: number): VoiceId {
  switch (track) {
    case 'kick':
      return 'kick';
    case 'clap':
      return 'clap';
    case 'A':
      return mood === 'hollow' ? 'hollowMetal' : 'neonHat';
    case 'B':
      if (mood === 'hollow') return lengthSteps >= DRONE_MIN_STEPS ? 'hollowDrone' : 'hollowBass';
      return 'neonBass';
  }
}

function clampLength(length: number | undefined): number {
  if (typeof length !== 'number' || !Number.isFinite(length)) return 1;
  return Math.min(MAX_LENGTH, Math.max(1, length));
}

/** The audible cell for a track at a step, or null when it must be skipped. */
function cellAt(pattern: Pattern, track: TrackId, step: number): Step | null {
  const cell = pattern?.tracks?.[track]?.[step];
  if (!cell || !(cell.velocity > 0)) return null;
  if (track === 'B' && (cell.pitch === undefined || cell.pitch === null)) return null;
  return cell;
}

export function planStep(pattern: Pattern, mood: MoodId, step: number): NoteEvent[] {
  const events: NoteEvent[] = [];
  for (const track of TRACK_ORDER) {
    const cell = cellAt(pattern, track, step);
    if (!cell) continue;
    const lengthSteps = track === 'B' ? clampLength(cell.length) : 1;
    const voice = voiceFor(track, mood, lengthSteps);
    if (voice === 'hollowDrone') continue; // handled by planDrone
    const event: NoteEvent = {
      track,
      voice,
      gain: velocityToGain(cell.velocity),
      lengthSteps,
    };
    if (track === 'B') event.pitch = cell.pitch;
    events.push(event);
  }
  return events;
}

export function planDrone(
  pattern: Pattern,
  mood: MoodId,
  step: number,
): { pitch: string; gain: number } | null {
  if (mood !== 'hollow') return null;
  const cell = cellAt(pattern, 'B', step);
  if (!cell || cell.pitch === undefined) return null;
  if (clampLength(cell.length) < DRONE_MIN_STEPS) return null;
  return { pitch: cell.pitch, gain: velocityToGain(cell.velocity) };
}

export function barHasDrone(pattern: Pattern, mood: MoodId): boolean {
  for (let step = 0; step < 16; step++) {
    if (planDrone(pattern, mood, step) !== null) return true;
  }
  return false;
}

export const initialState: ScheduleState = {
  pattern: null,
  mood: null,
  pendingPattern: null,
  pendingMood: null,
  drone: null,
};

/** Queue a pattern (and its mood). Applies at once when not running. */
export function queuePattern(s: ScheduleState, p: Pattern, running: boolean): ScheduleState {
  if (!running) {
    return { ...s, pattern: p, mood: p.mood, pendingPattern: null, pendingMood: null };
  }
  return { ...s, pendingPattern: p, pendingMood: p.mood };
}

/** Queue a mood. Applies at once when not running. */
export function queueMood(s: ScheduleState, m: MoodId, running: boolean): ScheduleState {
  if (!running) return { ...s, mood: m, pendingMood: null };
  return { ...s, pendingMood: m };
}

export function advance(s: ScheduleState, step: number): Advance {
  const state: ScheduleState = { ...s };
  let bpm: number | undefined;
  let drone: DroneCommand = { action: 'none' };
  const moodBefore = s.mood ?? s.pattern?.mood ?? null;

  if (step === 0) {
    if (state.pendingPattern !== null) {
      state.pattern = state.pendingPattern;
      state.pendingPattern = null;
      bpm = state.pattern.bpm;
    }
    if (state.pendingMood !== null) {
      state.mood = state.pendingMood;
      state.pendingMood = null;
    }
  }

  if (state.pattern === null) {
    const result: Advance = { state, events: [], drone };
    if (bpm !== undefined) result.bpm = bpm;
    return result;
  }

  const pattern = state.pattern;
  const mood: MoodId = state.mood ?? pattern.mood;
  const events = planStep(pattern, mood, step);
  const note = planDrone(pattern, mood, step);

  if (step === 0 && state.drone !== null && mood !== moodBefore) {
    drone = { action: 'release' };
    state.drone = null;
  } else if (note !== null) {
    if (state.drone === note.pitch) {
      drone = { action: 'hold' };
    } else {
      drone = { action: 'trigger', pitch: note.pitch, gain: note.gain };
      state.drone = note.pitch;
    }
  } else if (step === 0 && state.drone !== null && !barHasDrone(pattern, mood)) {
    drone = { action: 'release' };
    state.drone = null;
  }

  const result: Advance = { state, events, drone };
  if (bpm !== undefined) result.bpm = bpm;
  return result;
}

/** Forget the sounding drone; keep pattern, mood and pending values. */
export function stopState(s: ScheduleState): ScheduleState {
  return { ...s, drone: null };
}
