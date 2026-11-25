import type { ImageFeatures } from './types';

const EDGE_THRESHOLD = 24;

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Deterministic integer luma, 0..255. */
export const lumaOf = (r: number, g: number, b: number): number => (77 * r + 150 * g + 29 * b) >> 8;

/** Smallest value v whose cumulative histogram count reaches ceil(q * total). */
function histPercentile(hist: Uint32Array, total: number, q: number): number {
  const target = Math.max(1, Math.ceil(q * total));
  let cum = 0;
  for (let v = 0; v < 256; v++) {
    cum += hist[v];
    if (cum >= target) return v;
  }
  return 255;
}

const zeroFeatures = (): ImageFeatures => ({
  saturation: 0,
  contrast: 0,
  detailDensity: 0,
  signalStrength: 0,
  suggestedMood: 'hollow',
});

export function analyzeImage(img: ImageData): ImageFeatures {
  const w = img.width;
  const h = img.height;
  const n = w * h;
  const { data } = img;
  if (!(n > 0) || data.length < n * 4) return zeroFeatures();

  const luma = new Uint8Array(n);
  const hist = new Uint32Array(256);
  let satSum = 0;
  for (let p = 0; p < n; p++) {
    const r = data[p * 4], g = data[p * 4 + 1], b = data[p * 4 + 2];
    const l = lumaOf(r, g, b);
    luma[p] = l;
    hist[l]++;
    const mx = Math.max(r, g, b);
    if (mx > 0) satSum += (mx - Math.min(r, g, b)) / mx;
  }
  const saturation = clamp01(satSum / n);

  const p1 = histPercentile(hist, n, 0.01);
  const p5 = histPercentile(hist, n, 0.05);
  const p95 = histPercentile(hist, n, 0.95);
  const p99 = histPercentile(hist, n, 0.99);
  const contrast = clamp01((p95 - p5) / 255);

  let edges = 0;
  const dxHist = new Uint32Array(256);
  let dxCount = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      const l = luma[p];
      let edge = false;
      if (x < w - 1) {
        const d = Math.abs(l - luma[p + 1]);
        dxHist[d]++;
        dxCount++;
        if (d > EDGE_THRESHOLD) edge = true;
      }
      if (y < h - 1 && Math.abs(l - luma[p + w]) > EDGE_THRESHOLD) edge = true;
      if (edge) edges++;
    }
  }
  const detailDensity = clamp01((4 * edges) / n);

  const structure = clamp01((p99 - p1) / 24);
  const medDx = dxCount > 0 ? histPercentile(dxHist, dxCount, 0.5) : 0;
  const noiseRatio = medDx / Math.max(p95 - p5, 1);
  const noisePen = clamp01((noiseRatio - 0.08) / 0.12);
  const signalStrength = clamp01(structure * (1 - noisePen));

  const moodScore = 0.45 * saturation + 0.3 * contrast + 0.25 * detailDensity;

  return {
    saturation,
    contrast,
    detailDensity,
    signalStrength,
    suggestedMood: moodScore >= 0.5 ? 'neon' : 'hollow',
  };
}
