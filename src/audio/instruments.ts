/**
 * Sound settings for the Tone player. Plain data only: no runtime Tone import,
 * so Vitest can import this file in Node. Values are starting points, tuned by ear.
 * Option objects follow the Tone 15 option types for MembraneSynth, NoiseSynth,
 * MetalSynth, Synth and MonoSynth.
 */

export type VoiceId =
  | 'kick'
  | 'clap'
  | 'hollowMetal'
  | 'neonHat'
  | 'hollowDrone'
  | 'hollowBass'
  | 'neonBass';

/** velocity (0..1) -> gain (0..1) is gain = velocity ** VELOCITY_CURVE. */
export const VELOCITY_CURVE = 1.6; // ghost 0.45 -> 0.28 (about -11 dB vs accent)
export const DRONE_MIN_STEPS = 16; // Hollow B note with length >= this uses the drone voice
export const GATE = 0.9; // fraction of a note's length that is held before release

export const MASTER = { volumeDb: -6, limiterThresholdDb: -1 } as const;
export const LOOKAHEAD_S = 0.05; // Transport start offset

export const KICK = {
  note: 'C1',
  synth: {
    pitchDecay: 0.05,
    octaves: 6,
    oscillator: { type: 'sine' },
    envelope: { attack: 0.001, decay: 0.35, sustain: 0, release: 0.1 },
  },
  volumeDb: 0,
} as const;

export const CLAP = {
  synth: {
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.05 },
  },
  filter: { type: 'bandpass', frequency: 1800, Q: 0.8 },
  volumeDb: -4,
} as const;

/** Track A, Hollow. */
export const HOLLOW_METAL = {
  synth: {
    harmonicity: 5.1,
    modulationIndex: 24,
    resonance: 3000,
    octaves: 1.2,
    envelope: { attack: 0.001, decay: 1.2, release: 1.5 },
  },
  frequency: 220,
  duration: 0.4,
  volumeDb: -16,
  reverb: { decay: 5, preDelay: 0.02, wet: 0.6 }, // long tail
} as const;

/** Track A, Neon. */
export const NEON_HAT = {
  synth: {
    harmonicity: 5.1,
    modulationIndex: 32,
    resonance: 7000,
    octaves: 1.5,
    envelope: { attack: 0.001, decay: 0.05, release: 0.02 },
  },
  frequency: 400,
  duration: 0.03,
  volumeDb: -18,
} as const;

/** Track B, Hollow, notes with length >= DRONE_MIN_STEPS. Held with triggerAttack, ended with triggerRelease. */
export const HOLLOW_DRONE = {
  synth: {
    oscillator: { type: 'sawtooth' },
    envelope: { attack: 0.8, decay: 0.2, sustain: 0.9, release: 1.5 },
    filter: { Q: 2, type: 'lowpass', rolloff: -24 },
    filterEnvelope: {
      attack: 1.2,
      decay: 0.5,
      sustain: 0.6,
      release: 1.5,
      baseFrequency: 120,
      octaves: 3,
    },
  },
  volumeDb: -14,
} as const;

/** Track B, Hollow, short notes. */
export const HOLLOW_BASS = {
  synth: {
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.005, decay: 0.2, sustain: 0.3, release: 0.2 },
  },
  volumeDb: -8,
} as const;

/** Track B, Neon. */
export const NEON_BASS = {
  synth: {
    oscillator: { type: 'square' },
    envelope: { attack: 0.005, decay: 0.12, sustain: 0.2, release: 0.08 },
    filter: { Q: 3, type: 'lowpass', rolloff: -12 },
    filterEnvelope: {
      attack: 0.005,
      decay: 0.1,
      sustain: 0.1,
      release: 0.08,
      baseFrequency: 200,
      octaves: 3,
    },
  },
  volumeDb: -8,
} as const;
