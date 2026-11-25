import { createTonePlayer } from '../src/audio';
import { analyzeImage, generatePattern, scanBand } from '../src/engine';
import { DEFAULT_DENSITY } from '../src/engine/presets';
import { ANALYSIS_WIDTH } from '../src/engine/types';
import type { BandScan, MoodId, Pattern, TrackId } from '../src/engine/types';

const IMAGE_URL = '/scenes/empty-lot.png';
const BAND_HEIGHT = 0.1;

function el<T extends HTMLElement>(id: string): T {
  const e = document.getElementById(id);
  if (!e) throw new Error(`missing element #${id}`);
  return e as T;
}

const playBtn = el<HTMLButtonElement>('play');
const bandA = el<HTMLInputElement>('bandA');
const bandB = el<HTMLInputElement>('bandB');
const density = el<HTMLInputElement>('density');
const mood = el<HTMLSelectElement>('mood');
const stepEl = el('step');
const barEl = el('bar');
const infoEl = el('info');
const errorEl = el('error');
const canvas = el<HTMLCanvasElement>('canvas');

const player = createTonePlayer();
player.onStep((step, bar) => {
  stepEl.textContent = String(step);
  barEl.textContent = String(bar);
});
window.addEventListener('beforeunload', () => player.dispose());

let imageData: ImageData | null = null;
let currentPattern: Pattern | null = null;
let playing = false;

density.value = String(DEFAULT_DENSITY);

function showError(msg: string): void {
  errorEl.textContent = msg;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load image file ${url}`));
    img.src = url;
  });
}

function fmt(n: number): string {
  return n.toFixed(2);
}

function render(pattern: Pattern, scans: Record<'A' | 'B', BandScan>): void {
  const rows: TrackId[] = ['kick', 'clap', 'A', 'B'];
  const lines: string[] = [`bpm ${pattern.bpm}  mood ${pattern.mood}`, ''];
  for (const id of ['A', 'B'] as const) {
    lines.push(`band ${id} scores: ${scans[id].scores.map(fmt).join(' ')}`);
  }
  lines.push('');
  for (const t of rows) {
    lines.push(`${t.padEnd(5)} ${pattern.tracks[t].map((s) => fmt(s.velocity)).join(' ')}`);
  }
  infoEl.textContent = lines.join('\n');
}

function rebuild(): void {
  if (!imageData) return;
  const features = analyzeImage(imageData);
  const scans = {
    A: scanBand(imageData, { center: Number(bandA.value), height: BAND_HEIGHT }),
    B: scanBand(imageData, { center: Number(bandB.value), height: BAND_HEIGHT }),
  };
  const pattern = generatePattern({
    features,
    bands: scans,
    mood: mood.value as MoodId,
    density: Number(density.value),
  });
  currentPattern = pattern;
  player.setPattern(pattern);
  render(pattern, scans);
}

function onInput(): void {
  el('bandAv').textContent = fmt(Number(bandA.value));
  el('bandBv').textContent = fmt(Number(bandB.value));
  el('densityv').textContent = density.value;
  rebuild();
}

for (const c of [bandA, bandB, density, mood]) c.addEventListener('input', onInput);

playBtn.addEventListener('click', () => {
  if (playing) {
    player.stop();
    playing = false;
    playBtn.textContent = 'Play';
    return;
  }
  // No await before start(): Tone.start() must run inside the click gesture.
  if (currentPattern) player.setPattern(currentPattern);
  const started = player.start();
  playing = true;
  playBtn.textContent = 'Stop';
  started.catch((e: unknown) => {
    playing = false;
    playBtn.textContent = 'Play';
    showError(`Could not start audio: ${e instanceof Error ? e.message : String(e)}`);
  });
});

async function init(): Promise<void> {
  try {
    const img = await loadImage(IMAGE_URL);
    const w = ANALYSIS_WIDTH;
    const h = Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * w));
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('2D canvas is not available');
    ctx.drawImage(img, 0, 0, w, h);
    imageData = ctx.getImageData(0, 0, w, h);
  } catch (e) {
    showError(e instanceof Error ? e.message : `Could not load image file ${IMAGE_URL}`);
    return;
  }
  const features = analyzeImage(imageData);
  mood.value = features.suggestedMood;
  onInput();
  playBtn.disabled = false;
}

void init();
