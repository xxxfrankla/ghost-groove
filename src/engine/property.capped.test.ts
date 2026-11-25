import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { generatePattern } from './generate';
import { MAX_ACCENTS_PER_BAND } from './presets';
import { densityArb, featuresArb, moodArb, scoresArb } from './arbitraries';
import type { BandScan, ImageFeatures } from './types';

const scan = (scores: number[], register: number): BandScan => ({ scores, register });
const accents = (steps: { velocity: number }[]) => steps.filter((s) => s.velocity === 1).length;

describe('Property 4: Capped', () => {
  /**
   * **Validates: Requirements 4.3, 4.4, 6.5**
   */
  it('A and B each have at most 6 accent steps', () => {
    fc.assert(
      fc.property(
        featuresArb,
        scoresArb,
        scoresArb,
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        moodArb,
        densityArb,
        (features, a, b, regA, regB, mood, density) => {
          const p = generatePattern({
            features,
            bands: { A: scan(a, regA), B: scan(b, regB) },
            mood,
            density,
          });
          expect(MAX_ACCENTS_PER_BAND).toBe(6);
          expect(accents(p.tracks.A)).toBeLessThanOrEqual(6);
          expect(accents(p.tracks.B)).toBeLessThanOrEqual(6);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('16 equal scores of 1.0 on band A accent steps 0..5 (lower index wins ties)', () => {
    const features: ImageFeatures = {
      saturation: 0.5,
      contrast: 0.5,
      detailDensity: 0.5,
      signalStrength: 1,
      suggestedMood: 'neon',
    };
    const p = generatePattern({
      features,
      bands: { A: scan(Array(16).fill(1), 0.35), B: scan(Array(16).fill(0), 0.75) },
      mood: 'neon',
      density: 50,
    });
    const accentSteps = p.tracks.A.map((s, i) => (s.velocity === 1 ? i : -1)).filter((i) => i >= 0);
    expect(accentSteps).toEqual([0, 1, 2, 3, 4, 5]);
  });
});
