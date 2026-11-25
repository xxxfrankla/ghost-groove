import type { MoodId, TrackId } from './types';

export interface MoodPreset {
  id: MoodId;
  bpm: number;
  rootPitchClass: number; // 0..11, C = 0
  scaleOffsets: readonly number[]; // semitones above root, ascending, length 5
  baseOctaveForRegister(register: number): number;
  baseGroove(density: number): { kick: readonly number[]; clap: readonly number[] };
  bassLine: readonly number[]; // 16 scale-degree indices, each 0..4, index into scaleOffsets
  bNoteLength: number; // length of a photo-driven B note
  drone: boolean; // step 0 of B holds a 16-step drone
}

export const DEFAULT_DENSITY = 50;
export const SIGNAL_FLOOR = 0.1; // signalStrength below this silences A and B
export const MIN_CONTRAST_SPAN = 48; // luma levels; scanBand never stretches a smaller span to 1
export const SCAN_EPS = 12; // luma levels; below this a band is flat and scores all 0
export const GHOST_VELOCITY = 0.45;
export const MAX_ACCENTS_PER_BAND = 6;
export const GHOST_MIN_DENSITY = 25; // ghost notes are enabled from this density
export const accentThreshold = (d: number): number => 0.8 - 0.3 * (d / 100); // 0.80 .. 0.50
export const ghostThreshold = (d: number): number => 0.6 - 0.4 * (d / 100); // 0.60 .. 0.20

export const TRACK_IDS: readonly TrackId[] = ['kick', 'clap', 'A', 'B'];

const MINOR_PENTATONIC: readonly number[] = [0, 3, 5, 7, 10];

/** Band register (0 top .. 1 bottom) to base octave: lower in the image means lower pitch. */
const baseOctaveForRegister = (register: number): number => {
  if (register >= 0.5) return 2;
  if (register >= 0.25) return 3;
  return 4;
};

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

/** Pitch class (0..11) of a semitone offset above C; handles values outside 0..11. */
export const pitchClass = (semitones: number): number => ((semitones % 12) + 12) % 12;

/**
 * Pitch name (sharps) for `semitones` above C of `octave`. Offsets of 12 or more carry into
 * higher octaves, e.g. pitchName(2, 2 + 10) is "C3".
 */
export const pitchName = (octave: number, semitones: number): string => {
  const total = octave * 12 + semitones;
  const oct = Math.floor(total / 12);
  return `${NOTE_NAMES[pitchClass(total)]}${oct}`;
};

export const MOODS: Record<MoodId, MoodPreset> = {
  hollow: {
    id: 'hollow',
    bpm: 124,
    rootPitchClass: 2, // D
    scaleOffsets: MINOR_PENTATONIC, // D F G A C
    baseOctaveForRegister,
    baseGroove: (density) => ({
      kick: density >= 90 ? [0, 6, 8, 14] : [0, 8],
      clap: [12],
    }),
    bassLine: [0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 4, 0, 0, 3, 0],
    bNoteLength: 1,
    drone: true,
  },
  neon: {
    id: 'neon',
    bpm: 124,
    rootPitchClass: 9, // A
    scaleOffsets: MINOR_PENTATONIC, // A C D E G
    baseOctaveForRegister,
    baseGroove: () => ({
      kick: [0, 4, 8, 12],
      clap: [4, 12],
    }),
    bassLine: [0, 3, 0, 3, 0, 3, 0, 4, 0, 3, 0, 3, 0, 3, 2, 3],
    bNoteLength: 1,
    drone: false,
  },
};
