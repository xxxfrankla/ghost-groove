// Rewrites the `pattern` of each fixture from the current engine.
// Run manually after tuning presets: npm run regen:fixtures
// Not part of the engine bundle and not run by tests.
import { readFileSync, writeFileSync } from 'node:fs';
import { generatePattern } from '../src/engine/generate';
import { DEFAULT_DENSITY } from '../src/engine/presets';
import type { Fixture } from '../src/fixtures';

const FIXTURE_NAMES = ['emptyLot', 'neonStreet', 'blackImage'] as const;

for (const name of FIXTURE_NAMES) {
  const url = new URL(`../src/fixtures/${name}.json`, import.meta.url);
  const fixture = JSON.parse(readFileSync(url, 'utf8')) as Fixture;
  fixture.pattern = generatePattern({
    features: fixture.features,
    bands: fixture.bands,
    mood: fixture.features.suggestedMood,
    density: DEFAULT_DENSITY,
  });
  writeFileSync(url, JSON.stringify(fixture, null, 2) + '\n');
  console.log(`regenerated ${name}.json`);
}
