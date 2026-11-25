import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { generatePattern } from './generate';
import { MOODS, pitchClass } from './presets';
import { densityArb, featuresArb, moodArb, scoresArb } from './arbitraries';
import { STEPS } from './types';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const bandArb = fc.record({ scores: scoresArb, register: fc.double({ min: 0, max: 1, noNaN: true }) });

describe('Property 5: In key', () => {
  it('every B pitch (all 16 steps) belongs to the mood scale', () => {
    // **Validates: Requirements 6.1**
    fc.assert(
      fc.property(
        featuresArb,
        fc.record({ A: bandArb, B: bandArb }),
        moodArb,
        densityArb,
        (features, bands, mood, density) => {
          const p = generatePattern({ features, bands, mood, density });
          const m = MOODS[mood];
          const allowed = new Set(m.scaleOffsets.map((o) => pitchClass(m.rootPitchClass + o)));
          expect(p.tracks.B).toHaveLength(STEPS);
          for (const step of p.tracks.B) {
            expect(step.pitch).toBeDefined();
            const match = /^([A-G]#?)(-?\d+)$/.exec(step.pitch as string);
            expect(match).not.toBeNull();
            expect(allowed.has(NOTE_NAMES.indexOf(match![1]))).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
