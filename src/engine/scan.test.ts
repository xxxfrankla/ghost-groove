import { describe, expect, it } from 'vitest';
import { accentThreshold } from './presets';
import { scanBand } from './scan';

/** Build a grey ImageData-like object (no DOM available). */
function makeGrey(width: number, height: number, fn: (x: number, y: number) => number): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = fn(x, y);
      const i = (y * width + x) * 4;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  return { width, height, data, colorSpace: 'srgb' } as ImageData;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const W = 64; // 4 px per cell
const H = 64;
const BAND = { center: 0.5, height: 0.25 };
const THRESH = accentThreshold(100);

describe('scanBand', () => {
  it('scores a lone bright cell 1 and every other cell 0', () => {
    const img = makeGrey(W, H, (x) => (Math.floor(x / 4) === 11 ? 200 : 100));
    const { scores } = scanBand(img, BAND);
    expect(scores).toHaveLength(16);
    scores.forEach((s, i) => expect(s).toBe(i === 11 ? 1 : 0));
  });

  it('gives 16 zeros for a flat band', () => {
    const { scores } = scanBand(makeGrey(W, H, () => 128), BAND);
    expect(scores).toEqual(new Array(16).fill(0));
  });

  it('changes scores when the band moves vertically', () => {
    // Bright spot at cell 3 in the top rows, cell 12 in the bottom rows.
    const img = makeGrey(W, H, (x, y) => {
      const cell = Math.floor(x / 4);
      if (y < H / 2 && cell === 3) return 220;
      if (y >= H / 2 && cell === 12) return 220;
      return 40;
    });
    const top = scanBand(img, { center: 0.2, height: 0.2 }).scores;
    const bottom = scanBand(img, { center: 0.8, height: 0.2 }).scores;
    expect(top[3]).toBe(1);
    expect(bottom[12]).toBe(1);
    expect(top).not.toEqual(bottom);
  });

  it('handles a band outside the image with 16 valid scores', () => {
    const img = makeGrey(W, H, (x) => (Math.floor(x / 4) === 5 ? 220 : 60));
    for (const band of [
      { center: -0.5, height: 0.2 },
      { center: 1.7, height: 0.2 },
      { center: 0.5, height: 0 },
      { center: 0.99, height: 1 },
    ]) {
      const { scores } = scanBand(img, band);
      expect(scores).toHaveLength(16);
      scores.forEach((s) => {
        expect(Number.isFinite(s)).toBe(true);
        expect(s).toBeGreaterThanOrEqual(0);
        expect(s).toBeLessThanOrEqual(1);
      });
      expect(scores[5]).toBe(1);
    }
  });

  it('echoes the clamped center as register', () => {
    const img = makeGrey(W, H, () => 100);
    expect(scanBand(img, { center: 0.3, height: 0.1 }).register).toBe(0.3);
    expect(scanBand(img, { center: -2, height: 0.1 }).register).toBe(0);
    expect(scanBand(img, { center: 5, height: 0.1 }).register).toBe(1);
  });

  it('scores a band of only ±6 luma noise below the accent threshold', () => {
    const rnd = mulberry32(42);
    const img = makeGrey(W, H, () => 120 + Math.round((rnd() * 2 - 1) * 6));
    const { scores } = scanBand(img, BAND);
    scores.forEach((s) => expect(s).toBeLessThan(THRESH));
  });

  it('scores a dim gradient spanning under 48 luma below the accent threshold', () => {
    // luma 30..76 across the width (span 46)
    const img = makeGrey(W, H, (x) => 30 + Math.round((x / (W - 1)) * 46));
    const { scores } = scanBand(img, BAND);
    scores.forEach((s) => expect(s).toBeLessThan(THRESH));
  });

  it('keeps weak contrast (12..48) below a score of 1', () => {
    const img = makeGrey(W, H, (x) => (Math.floor(x / 4) === 7 ? 130 : 100)); // +30
    const { scores } = scanBand(img, BAND);
    expect(Math.max(...scores)).toBeGreaterThan(0);
    expect(Math.max(...scores)).toBeLessThan(1);
  });
});
