// Shared fast-check arbitraries for engine tests. Test-only: not exported from ./index.
import fc from 'fast-check';
import { STEPS } from './types';
import type { BandPosition, ImageFeatures, MoodId, Overrides, Override, TrackId } from './types';

type Img = { width: number; height: number; data: Uint8ClampedArray };

const asImage = (img: Img): ImageData => img as unknown as ImageData;

const unit = () => fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true });

function imageFrom(
  dims: fc.Arbitrary<{ width: number; height: number }>,
  channel: fc.Arbitrary<number>,
): fc.Arbitrary<ImageData> {
  return dims.chain(({ width, height }) =>
    fc.array(channel, { minLength: width * height * 3, maxLength: width * height * 3 }).map((rgb) => {
      const data = new Uint8ClampedArray(width * height * 4);
      for (let i = 0; i < width * height; i++) {
        data[i * 4] = rgb[i * 3];
        data[i * 4 + 1] = rgb[i * 3 + 1];
        data[i * 4 + 2] = rgb[i * 3 + 2];
        data[i * 4 + 3] = 255;
      }
      return asImage({ width, height, data });
    }),
  );
}

const byte = fc.integer({ min: 0, max: 255 });

/** Random RGBA image, width 16..48, height 4..24, alpha 255. */
export const imageArb: fc.Arbitrary<ImageData> = imageFrom(
  fc.record({ width: fc.integer({ min: 16, max: 48 }), height: fc.integer({ min: 4, max: 24 }) }),
  byte,
);

/** Near-black image: every colour channel in 0..2, alpha 255. */
export const blackImageArb: fc.Arbitrary<ImageData> = imageFrom(
  fc.record({ width: fc.integer({ min: 16, max: 48 }), height: fc.integer({ min: 4, max: 24 }) }),
  fc.integer({ min: 0, max: 2 }),
);

/** iid uniform noise image with at least 256 pixels. */
export const noiseImageArb: fc.Arbitrary<ImageData> = imageFrom(
  fc
    .record({ width: fc.integer({ min: 16, max: 48 }), height: fc.integer({ min: 16, max: 24 }) })
    .filter(({ width, height }) => width * height >= 256),
  byte,
);

export const bandPositionArb: fc.Arbitrary<BandPosition> = fc.record({
  center: unit(),
  height: fc.double({ min: 0.05, max: 1, noNaN: true, noDefaultInfinity: true }),
});

/** 16 floats in [0, 1]. */
export const scoresArb: fc.Arbitrary<number[]> = fc.array(unit(), { minLength: STEPS, maxLength: STEPS });

export const moodArb: fc.Arbitrary<MoodId> = fc.constantFrom<MoodId>('hollow', 'neon');

export const featuresArb: fc.Arbitrary<ImageFeatures> = fc.record({
  saturation: unit(),
  contrast: unit(),
  detailDensity: unit(),
  signalStrength: unit(),
  suggestedMood: moodArb,
});

/** Integers 0..100. */
export const densityArb: fc.Arbitrary<number> = fc.integer({ min: 0, max: 100 });

const trackIds: TrackId[] = ['kick', 'clap', 'A', 'B'];

const trackOverrideArb: fc.Arbitrary<Partial<Record<number, Override>>> = fc.dictionary(
  fc.integer({ min: 0, max: STEPS - 1 }).map(String),
  fc.constantFrom<Override>('on', 'off'),
) as fc.Arbitrary<Partial<Record<number, Override>>>;

export const overridesArb: fc.Arbitrary<Overrides> = fc.record(
  Object.fromEntries(trackIds.map((t) => [t, trackOverrideArb])) as Record<TrackId, typeof trackOverrideArb>,
  { requiredKeys: [] },
) as fc.Arbitrary<Overrides>;
