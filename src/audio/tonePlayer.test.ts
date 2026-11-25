import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Pattern, Step } from '../engine/types';

const h = vi.hoisted(() => {
  const state = {
    log: [] as string[],
    startImpl: (): Promise<void> => Promise.resolve(),
    tick: null as null | ((time: number) => void),
    drawCbs: [] as Array<() => void>,
  };
  return state;
});

vi.mock('tone', () => {
  const rec = (s: string) => h.log.push(s);
  class Node {
    volume = { value: 0 };
    ready: Promise<void>;
    constructor(public kind: string) {
      rec(`new ${kind}`);
      this.ready = Promise.resolve();
    }
    connect() {
      return this;
    }
    toDestination() {
      return this;
    }
    triggerAttack() {}
    triggerRelease() {}
    triggerAttackRelease() {}
    dispose() {
      rec(`dispose ${this.kind}`);
    }
  }
  const mk = (kind: string) =>
    class extends Node {
      constructor() {
        super(kind);
        if (kind === 'Reverb') {
          const p = Promise.resolve();
          Object.defineProperty(this, 'ready', {
            get() {
              rec('Reverb.ready');
              return p;
            },
          });
        }
      }
    };
  const transport = {
    bpm: { value: 120 },
    scheduleRepeat: (cb: (t: number) => void) => {
      rec('scheduleRepeat');
      h.tick = cb;
      return 1;
    },
    start: () => rec('Transport.start'),
    stop: () => rec('Transport.stop'),
    cancel: () => rec('Transport.cancel'),
  };
  const draw = {
    schedule: (cb: () => void) => {
      h.drawCbs.push(cb);
    },
    cancel: () => {
      h.drawCbs.length = 0;
    },
  };
  return {
    start: () => {
      rec('Tone.start');
      return h.startImpl();
    },
    getTransport: () => transport,
    getDraw: () => draw,
    getDestination: () => ({ volume: { value: 0 } }),
    Limiter: mk('Limiter'),
    MembraneSynth: mk('MembraneSynth'),
    NoiseSynth: mk('NoiseSynth'),
    Filter: mk('Filter'),
    Reverb: mk('Reverb'),
    MetalSynth: mk('MetalSynth'),
    MonoSynth: mk('MonoSynth'),
    Synth: mk('Synth'),
  };
});

import { createTonePlayer } from './tonePlayer';

const steps = (over: Partial<Record<number, Step>> = {}): Step[] =>
  Array.from({ length: 16 }, (_, i) => over[i] ?? { velocity: 0 });

const pattern = (mood: 'hollow' | 'neon'): Pattern => ({
  bpm: 100,
  mood,
  tracks: {
    kick: steps({ 0: { velocity: 1 } }),
    clap: steps(),
    A: steps(),
    B: steps({ 0: { velocity: 1, pitch: 'C2', length: 16 } }),
  },
});

const constructed = () => h.log.filter((l) => l.startsWith('new '));
const disposed = () => h.log.filter((l) => l.startsWith('dispose '));
const flush = () => new Promise<void>((r) => setTimeout(r, 0));

beforeEach(() => {
  h.log.length = 0;
  h.drawCbs.length = 0;
  h.tick = null;
  h.startImpl = () => Promise.resolve();
});

describe('Property 15: Tone.start() is first and synchronous', () => {
  it('calls Tone.start before start() returns and before any constructor or ready', async () => {
    const p = createTonePlayer();
    const promise = p.start();
    expect(h.log).toEqual(['Tone.start']);
    await promise;
    expect(h.log[0]).toBe('Tone.start');
    const firstNew = h.log.findIndex((l) => l.startsWith('new '));
    const firstReady = h.log.indexOf('Reverb.ready');
    expect(firstNew).toBeGreaterThan(0);
    expect(firstReady).toBeGreaterThan(firstNew);
    p.dispose();
  });

  it('builds nothing when Tone.start rejects, and a later start retries', async () => {
    h.startImpl = () => Promise.reject(new Error('blocked'));
    const p = createTonePlayer();
    await expect(p.start()).rejects.toThrow('blocked');
    expect(constructed()).toEqual([]);
    expect(h.log).not.toContain('scheduleRepeat');
    expect(h.log).not.toContain('Transport.start');

    h.startImpl = () => Promise.resolve();
    await p.start();
    expect(h.log.filter((l) => l === 'Tone.start')).toHaveLength(2);
    expect(constructed().length).toBeGreaterThan(0);
    p.dispose();
  });

  it('rejects when Tone.start throws synchronously, building nothing', async () => {
    h.startImpl = () => {
      throw new Error('sync boom');
    };
    const p = createTonePlayer();
    await expect(p.start()).rejects.toThrow('sync boom');
    expect(constructed()).toEqual([]);
  });
});

describe('Property 14: start() is idempotent for groups', () => {
  it('concurrent calls return the same promise and build once', async () => {
    const p = createTonePlayer();
    const a = p.start();
    const b = p.start();
    expect(b).toBe(a);
    await a;
    expect(h.log.filter((l) => l === 'Tone.start')).toHaveLength(1);
    const count = constructed().length;
    expect(count).toBeGreaterThan(0);
    // Repeated call while running builds nothing.
    await p.start();
    expect(constructed()).toHaveLength(count);
    p.dispose();
  });

  it('a restart after stop() does not rebuild groups or reschedule', async () => {
    const p = createTonePlayer();
    await p.start();
    const count = constructed().length;
    p.stop();
    await p.start();
    expect(constructed()).toHaveLength(count);
    expect(h.log.filter((l) => l === 'scheduleRepeat')).toHaveLength(2); // stop() cancels the Transport
    p.dispose();
  });
});

describe('Property 13: groups live until teardown', () => {
  it('never disposes across mood switches, stop() and restarts, only on dispose()', async () => {
    const p = createTonePlayer();
    p.setPattern(pattern('hollow'));
    await p.start();
    const count = constructed().length;

    // Run a bar of hollow, then queue neon and run the bar boundary.
    for (let i = 0; i < 16; i++) h.tick!(i * 0.1);
    p.setMood('neon');
    for (let i = 0; i < 16; i++) h.tick!(2 + i * 0.1);
    p.setMood('hollow');
    for (let i = 0; i < 16; i++) h.tick!(4 + i * 0.1);
    expect(disposed()).toEqual([]);

    p.stop();
    await p.start();
    p.stop();
    await flush();
    expect(disposed()).toEqual([]);
    expect(constructed()).toHaveLength(count);

    p.dispose();
    expect(disposed()).toHaveLength(count);
    p.dispose();
    expect(disposed()).toHaveLength(count);
  });
});

describe('Property 7: Draw step fidelity', () => {
  it('delivers the captured step and bar even when Draw callbacks run late', async () => {
    const p = createTonePlayer();
    p.setPattern(pattern('hollow'));
    const seen: Array<[number, number]> = [];
    p.onStep((s, b) => seen.push([s, b]));
    await p.start();

    for (let i = 0; i < 20; i++) h.tick!(i * 0.1); // 20 ticks before any Draw frame runs
    expect(seen).toEqual([]);
    for (const cb of [...h.drawCbs]) cb();

    expect(seen).toHaveLength(20);
    seen.forEach(([s, b], i) => {
      expect(s).toBe(i % 16);
      expect(b).toBe(Math.floor(i / 16));
    });
    p.dispose();
  });
});
