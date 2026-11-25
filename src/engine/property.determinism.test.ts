import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { analyzeImage } from './analyze';
import { scanBand } from './scan';
import { generatePattern } from './generate';
import { resolvePattern } from './resolve';
import { bandPositionArb, densityArb, featuresArb, imageArb, moodArb, overridesArb, scoresArb } from './arbitraries';
import type { BandScan, GenerateInput } from './types';

const bandScanArb: fc.Arbitrary<BandScan> = fc.record({
  scores: scoresArb,
  register: fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true }),
});

const generateInputArb: fc.Arbitrary<GenerateInput> = fc.record({
  features: featuresArb,
  bands: fc.record({ A: bandScanArb, B: bandScanArb }),
  mood: moodArb,
  density: densityArb,
});

const clone = <T>(v: T): T => structuredClone(v);
const runs = { numRuns: 100 };

describe('Property 1: Determinism', () => {
  // **Validates: Requirements 9.1, 9.2**
  it('analyzeImage called twice returns deeply equal results', () => {
    fc.assert(
      fc.property(imageArb, (img) => {
        expect(analyzeImage(img)).toEqual(analyzeImage(img));
      }),
      runs,
    );
  });

  it('scanBand called twice returns deeply equal results', () => {
    fc.assert(
      fc.property(imageArb, bandPositionArb, (img, band) => {
        expect(scanBand(img, band)).toEqual(scanBand(img, band));
      }),
      runs,
    );
  });

  it('generatePattern called twice returns deeply equal results', () => {
    fc.assert(
      fc.property(generateInputArb, (input) => {
        expect(generatePattern(input)).toEqual(generatePattern(input));
      }),
      runs,
    );
  });

  it('resolvePattern leaves its arguments unchanged', () => {
    fc.assert(
      fc.property(generateInputArb, overridesArb, (input, overrides) => {
        const auto = generatePattern(input);
        const autoBefore = clone(auto);
        const overridesBefore = clone(overrides);
        const r1 = resolvePattern(auto, overrides);
        const r2 = resolvePattern(auto, overrides);
        expect(auto).toEqual(autoBefore);
        expect(overrides).toEqual(overridesBefore);
        expect(r1).toEqual(r2);
      }),
      runs,
    );
  });
});
