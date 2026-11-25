export const STEPS = 16;
export const ANALYSIS_WIDTH = 256; // UI downsamples to this width before analysis

export type MoodId = 'hollow' | 'neon';
export type BandId = 'A' | 'B';
export type TrackId = 'kick' | 'clap' | 'A' | 'B';

export interface ImageFeatures {
  saturation: number;      // 0..1
  contrast: number;        // 0..1
  detailDensity: number;   // 0..1
  signalStrength: number;  // 0..1, low means "too dark or noisy to trust"
  suggestedMood: MoodId;
}

export interface BandPosition { center: number; height: number } // fractions of image height

export interface BandScan {
  scores: number[];        // length 16, 0..1, normalized within the band
  register: number;        // band center, 0 (top) .. 1 (bottom)
}

export interface GenerateInput {
  features: ImageFeatures;
  bands: Record<BandId, BandScan>;
  mood: MoodId;
  density: number;         // 0..100
}

export interface Step {
  velocity: number;        // 0 = silent, 1 = accent, ~0.45 = ghost note
  pitch?: string;          // e.g. "D2"; set on EVERY step of track B, even silent ones
  length?: number;         // in steps, for sustained notes
}

export interface Pattern {
  bpm: number;
  mood: MoodId;
  tracks: Record<TrackId, Step[]>; // each length 16
}

export type Override = 'on' | 'off';
export type Overrides = Partial<Record<TrackId, Partial<Record<number, Override>>>>;

// engine
export declare function analyzeImage(img: ImageData): ImageFeatures;
export declare function scanBand(img: ImageData, band: BandPosition): BandScan;
export declare function generatePattern(input: GenerateInput): Pattern;
export declare function resolvePattern(auto: Pattern, overrides: Overrides): Pattern;

// audio
export interface Player {
  start(): Promise<void>;             // call from the Play click (browsers need a user gesture)
  stop(): void;
  setPattern(p: Pattern): void;       // takes effect at the next bar
  setMood(m: MoodId): void;
  onStep(cb: (step: number, bar: number) => void): () => void; // returns unsubscribe
}
export declare function createPlayer(): Player;
