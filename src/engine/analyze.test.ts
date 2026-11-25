import { describe, expect, it } from 'vitest';
import { analyzeImage } from './analyze';

type Px = [number, number, number];

/** Build an ImageData-like object (no DOM available). */
function makeImage(width: number, height: number, fn: (x: number, y: number) => Px): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = fn(x, y);
      const i = (y * width + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  return { width, height, data, colorSpace: 'srgb' } as ImageData;
}

/** Small deterministic PRNG (mulberry32). */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('analyzeImage', () => {
  it('black image has signalStrength < 0.1', () => {
    const f = analyzeImage(makeImage(32, 32, () => [0, 0, 0]));
    expect(f.signalStrength).toBeLessThan(0.1);
  });

  it('dark image with a small bright gap keeps signalStrength >= 0.1', () => {
    const f = analyzeImage(
      makeImage(32, 32, (x, y) => (x < 8 && y < 8 ? [200, 200, 200] : [10, 10, 10])),
    );
    expect(f.signalStrength).toBeGreaterThanOrEqual(0.1);
  });

  it('saturated bright image suggests neon', () => {
    const f = analyzeImage(
      makeImage(32, 32, (x) => (x % 2 === 0 ? [255, 0, 0] : [0, 255, 0])),
    );
    expect(f.suggestedMood).toBe('neon');
  });

  it('grey image suggests hollow', () => {
    const f = analyzeImage(makeImage(32, 32, () => [128, 128, 128]));
    expect(f.suggestedMood).toBe('hollow');
  });

  it('empty image returns all zeros and hollow', () => {
    const f = analyzeImage({ width: 0, height: 0, data: new Uint8ClampedArray(0) } as ImageData);
    expect(f).toEqual({
      saturation: 0,
      contrast: 0,
      detailDensity: 0,
      signalStrength: 0,
      suggestedMood: 'hollow',
    });
  });

  it('uniform random noise image has signalStrength < 0.1', () => {
    const rnd = mulberry32(12345);
    const f = analyzeImage(
      makeImage(32, 32, () => {
        const v = Math.floor(rnd() * 256);
        return [v, v, v];
      }),
    );
    expect(f.signalStrength).toBeLessThan(0.1);
  });
});
