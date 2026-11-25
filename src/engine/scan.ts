import { lumaOf } from './analyze';
import { MIN_CONTRAST_SPAN, SCAN_EPS } from './presets';
import type { BandPosition, BandScan } from './types';
import { STEPS } from './types';

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
const finiteOr = (v: number, fallback: number): number => (Number.isFinite(v) ? v : fallback);
const zeros = (): number[] => new Array<number>(STEPS).fill(0);

export function scanBand(img: ImageData, band: BandPosition): BandScan {
  const center = clamp(finiteOr(band.center, 0.5), 0, 1);
  const height = clamp(finiteOr(band.height, 0.5), 0, 1);
  const W = img.width;
  const H = img.height;
  const data = img.data;
  if (!(W > 0) || !(H > 0) || !data || data.length < W * H * 4) {
    return { scores: zeros(), register: center };
  }

  const top = clamp(Math.round((center - height / 2) * H), 0, H - 1);
  const bottom = clamp(Math.round((center + height / 2) * H), top + 1, H);

  const peaks: number[] = new Array<number>(STEPS);
  for (let i = 0; i < STEPS; i++) {
    let x0 = Math.floor((i * W) / STEPS);
    let x1 = Math.max(Math.floor(((i + 1) * W) / STEPS), x0 + 1);
    x0 = Math.min(x0, W - 1);
    x1 = Math.min(x1, W);
    const values: number[] = [];
    for (let y = top; y < bottom; y++) {
      for (let x = x0; x < x1; x++) {
        const o = (y * W + x) * 4;
        values.push(lumaOf(data[o], data[o + 1], data[o + 2]));
      }
    }
    values.sort((a, b) => b - a);
    const k = Math.max(1, Math.ceil(0.1 * values.length));
    let sum = 0;
    for (let j = 0; j < k; j++) sum += values[j];
    peaks[i] = sum / k;
  }

  const sorted = [...peaks].sort((a, b) => a - b);
  const median = (sorted[7] + sorted[8]) / 2;
  const d = peaks.map((p) => Math.max(0, p - median));
  const dmax = Math.max(...d);

  if (dmax < SCAN_EPS) return { scores: zeros(), register: center };
  const div = Math.max(dmax, MIN_CONTRAST_SPAN);
  return { scores: d.map((v) => clamp(v / div, 0, 1)), register: center };
}
