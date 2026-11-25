// STUBS: every function returns canned data from src/fixtures. Replace with real engine code.
import { blackImage, emptyLot, neonStreet, type Fixture } from '../fixtures';
import type { BandPosition, BandScan, GenerateInput, ImageFeatures, Overrides, Pattern } from './types';

export * from './types';

/** Stub classifier: picks a fixture from the mean brightness and color spread of the pixels. */
function pickFixture(img: ImageData): Fixture {
  const { data } = img;
  const pixels = data.length / 4;
  if (pixels === 0) return blackImage;
  let lum = 0;
  let spread = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    lum += (r + g + b) / 3;
    spread += Math.max(r, g, b) - Math.min(r, g, b);
  }
  lum /= pixels;
  spread /= pixels;
  if (lum < 12) return blackImage;
  return spread > 80 ? neonStreet : emptyLot;
}

export function analyzeImage(img: ImageData): ImageFeatures {
  return pickFixture(img).features;
}

export function scanBand(img: ImageData, band: BandPosition): BandScan {
  const { A, B } = pickFixture(img).bands;
  const { scores } = band.center < 0.5 ? A : B;
  return { scores: [...scores], register: band.center };
}

export function generatePattern(input: GenerateInput): Pattern {
  if (input.features.signalStrength < 0.1) return blackImage.pattern;
  return input.mood === 'neon' ? neonStreet.pattern : emptyLot.pattern;
}

/** Stub: returns the auto pattern unchanged, so overrides have no effect yet. */
export function resolvePattern(auto: Pattern, _overrides: Overrides): Pattern {
  return auto;
}
