import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { analyzeImage } from './analyze';
import { generatePattern } from './generate';
import { SIGNAL_FLOOR } from './presets';
import type { GenerateInput } from './types';
import { blackImageArb, densityArb, moodArb, noiseImageArb, scoresArb } from './arbitraries';

const unit = fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true });

describe('Property 2: Dark-safe', () => {
  it('black or noise images are below SIGNAL_FLOOR, and silence A and B while keeping kick and clap', () => {
    // **Validates: Requirements 2.1, 2.2, 7.1, 7.2**
    fc.assert(
      fc.property(
        fc.oneof(blackImageArb, noiseImageArb),
        moodArb,
        densityArb,
        scoresArb,
        scoresArb,
        unit,
        unit,
        (img, mood, density, scoresA, scoresB, regA, regB) => {
          const features = analyzeImage(img);
          expect(features.signalStrength).toBeLessThan(SIGNAL_FLOOR);

          const bands: GenerateInput['bands'] = {
            A: { scores: scoresA, register: regA },
            B: { scores: scoresB, register: regB },
          };
          const dark = generatePattern({ features, bands, mood, density });
          const normal = generatePattern({
            features: { ...features, signalStrength: 1 },
            bands,
            mood,
            density,
          });

          for (const t of ['A', 'B'] as const) {
            expect(dark.tracks[t]).toHaveLength(16);
            for (const s of dark.tracks[t]) expect(s.velocity).toBe(0);
          }
          expect(dark.tracks.kick).toEqual(normal.tracks.kick);
          expect(dark.tracks.clap).toEqual(normal.tracks.clap);
        },
      ),
      { numRuns: 100 },
    );
  });
});
