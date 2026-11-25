import { describe, expect, it } from 'vitest';
import * as inst from './instruments';

describe('instruments', () => {
  it('imports in Node and exposes the design values', () => {
    expect(inst.VELOCITY_CURVE).toBe(1.6);
    expect(inst.DRONE_MIN_STEPS).toBe(16);
    expect(inst.GATE).toBe(0.9);
    expect(inst.LOOKAHEAD_S).toBe(0.05);
    expect(inst.MASTER).toEqual({ volumeDb: -6, limiterThresholdDb: -1 });
    expect(inst.HOLLOW_DRONE.synth.filterEnvelope.baseFrequency).toBeGreaterThan(0);
  });
});
