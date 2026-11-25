import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { generatePattern } from './generate';
import { resolvePattern } from './resolve';
import { TRACK_IDS } from './presets';
import { densityArb, featuresArb, moodArb, overridesArb, scoresArb } from './arbitraries';
import { STEPS } from './types';

const bandArb = fc.record({ scores: scoresArb, register: fc.double({ min: 0, max: 1, noNaN: true }) });

describe('Property 6: Overrides win', () => {
  it('on => velocity 1, off => velocity 0, others equal auto, pitch preserved', () => {
    // **Validates: Requirements 8.1, 8.2, 8.3, 8.5**
    fc.assert(
      fc.property(
        featuresArb,
        fc.record({ A: bandArb, B: bandArb }),
        moodArb,
        densityArb,
        overridesArb,
        (features, bands, mood, density, overrides) => {
          const auto = generatePattern({ features, bands, mood, density });
          const resolved = resolvePattern(auto, overrides);
          for (const id of TRACK_IDS) {
            const perTrack = (overrides[id] ?? {}) as Record<string, 'on' | 'off' | undefined>;
            for (let i = 0; i < STEPS; i++) {
              const o = perTrack[String(i)];
              const a = auto.tracks[id][i];
              const r = resolved.tracks[id][i];
              if (o === 'on') {
                expect(r.velocity).toBe(1);
                expect(r.pitch).toEqual(a.pitch);
              } else if (o === 'off') {
                expect(r.velocity).toBe(0);
                expect(r.pitch).toEqual(a.pitch);
              } else {
                expect(r).toEqual(a);
              }
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
