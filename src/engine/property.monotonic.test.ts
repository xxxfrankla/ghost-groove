import { describe, it } from 'vitest';
import fc from 'fast-check';
import { generatePattern } from './generate';
import { densityArb, featuresArb, moodArb, scoresArb } from './arbitraries';

describe('Property 3: Monotonic density', () => {
  /**
   * **Validates: Requirements 4.5**
   */
  it('every step of A and B has velocity(d2) >= velocity(d1) when d1 <= d2', () => {
    fc.assert(
      fc.property(
        featuresArb,
        moodArb,
        scoresArb,
        scoresArb,
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        densityArb,
        densityArb,
        (features, mood, sA, sB, regA, regB, x, y) => {
          const d1 = Math.min(x, y);
          const d2 = Math.max(x, y);
          const make = (density: number) =>
            generatePattern({
              features,
              mood,
              density,
              bands: {
                A: { scores: sA, register: regA },
                B: { scores: sB, register: regB },
              },
            });
          const lo = make(d1);
          const hi = make(d2);
          for (const t of ['A', 'B'] as const) {
            for (let i = 0; i < 16; i++) {
              if (hi.tracks[t][i].velocity < lo.tracks[t][i].velocity) return false;
            }
          }
          return true;
        },
      ),
      { numRuns: 200 },
    );
  });
});
