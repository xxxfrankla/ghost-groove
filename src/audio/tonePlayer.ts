import * as Tone from 'tone';
import type { MoodId, Pattern, Player } from '../engine/types';
import {
  CLAP,
  HOLLOW_BASS,
  HOLLOW_DRONE,
  HOLLOW_METAL,
  GATE,
  KICK,
  LOOKAHEAD_S,
  MASTER,
  NEON_BASS,
  NEON_HAT,
} from './instruments';
import { advance, initialState, queueMood, queuePattern, stopState } from './schedule';
import type { DroneCommand, NoteEvent, ScheduleState } from './schedule';

export type TonePlayer = Player & {
  /** Final teardown. Disposes both mood groups and the shared voices. Not part of the Player contract. */
  dispose(): void;
};

/** Kick and clap, used by both moods. */
export interface SharedGroup {
  kick: Tone.MembraneSynth;
  clap: Tone.NoiseSynth;
  clapFilter: Tone.Filter;
}

export interface HollowGroup {
  metal: Tone.MetalSynth;
  drone: Tone.MonoSynth;
  bass: Tone.Synth;
  reverb: Tone.Reverb;
}

export interface NeonGroup {
  hat: Tone.MetalSynth;
  bass: Tone.MonoSynth;
}

export interface Groups {
  limiter: Tone.Limiter;
  shared: SharedGroup;
  hollow: HollowGroup;
  neon: NeonGroup;
}

/**
 * Builds the limiter and all three groups, routed to Destination. Awaits the reverb impulse
 * response. If anything fails, every node created so far is disposed and the error is rethrown.
 */
export async function buildGroups(): Promise<Groups> {
  const nodes: Array<{ dispose(): unknown }> = [];
  const track = <T extends { dispose(): unknown }>(node: T): T => {
    nodes.push(node);
    return node;
  };

  try {
    const limiter = track(new Tone.Limiter(MASTER.limiterThresholdDb));
    limiter.toDestination();
    Tone.getDestination().volume.value = MASTER.volumeDb;

    // Shared: kick and clap (clap through a bandpass filter).
    const kick = track(new Tone.MembraneSynth(structuredClone(KICK.synth) as never));
    kick.volume.value = KICK.volumeDb;
    kick.connect(limiter);

    const clapFilter = track(new Tone.Filter(structuredClone(CLAP.filter) as never));
    const clap = track(new Tone.NoiseSynth(structuredClone(CLAP.synth) as never));
    clap.volume.value = CLAP.volumeDb;
    clap.connect(clapFilter);
    clapFilter.connect(limiter);

    // Hollow: metal and drone and bass into a long reverb.
    const reverb = track(new Tone.Reverb(structuredClone(HOLLOW_METAL.reverb)));
    reverb.connect(limiter);
    const metal = track(new Tone.MetalSynth(structuredClone(HOLLOW_METAL.synth) as never));
    metal.volume.value = HOLLOW_METAL.volumeDb;
    metal.connect(reverb);
    const drone = track(new Tone.MonoSynth(structuredClone(HOLLOW_DRONE.synth) as never));
    drone.volume.value = HOLLOW_DRONE.volumeDb;
    drone.connect(reverb);
    const hollowBass = track(new Tone.Synth(structuredClone(HOLLOW_BASS.synth) as never));
    hollowBass.volume.value = HOLLOW_BASS.volumeDb;
    hollowBass.connect(reverb);

    // Neon: hat and bass, dry.
    const hat = track(new Tone.MetalSynth(structuredClone(NEON_HAT.synth) as never));
    hat.volume.value = NEON_HAT.volumeDb;
    hat.connect(limiter);
    const neonBass = track(new Tone.MonoSynth(structuredClone(NEON_BASS.synth) as never));
    neonBass.volume.value = NEON_BASS.volumeDb;
    neonBass.connect(limiter);

    await reverb.ready;

    return {
      limiter,
      shared: { kick, clap, clapFilter },
      hollow: { metal, drone, bass: hollowBass, reverb },
      neon: { hat, bass: neonBass },
    };
  } catch (err) {
    for (const node of nodes) {
      try {
        node.dispose();
      } catch {
        // keep disposing the rest
      }
    }
    throw err;
  }
}

/** Disposes every node in a built set of groups. Safe to call once per build. */
export function disposeGroups(g: Groups): void {
  const all: Array<{ dispose(): unknown }> = [
    g.shared.kick,
    g.shared.clap,
    g.shared.clapFilter,
    g.hollow.metal,
    g.hollow.drone,
    g.hollow.bass,
    g.hollow.reverb,
    g.neon.hat,
    g.neon.bass,
    g.limiter,
  ];
  for (const node of all) node.dispose();
}

const isValidBpm = (bpm: unknown): bpm is number =>
  typeof bpm === 'number' && Number.isFinite(bpm) && bpm > 0;

/**
 * Tone-backed Player.
 */
export function createTonePlayer(): TonePlayer {
  let groups: Groups | null = null;
  let disposed = false;
  let running = false;
  let starting: Promise<void> | null = null;
  let scheduled = false; // whether the scheduleRepeat event is currently on the Transport
  let epoch = 0; // bumped by stop()/dispose() so an in-flight run() can abort
  let state: ScheduleState = initialState;
  let step = 0;
  let bar = 0;
  const listeners = new Set<(step: number, bar: number) => void>();

  let activeMood: MoodId | null = null; // effective mood of the last tick

  const emit = (stepNo: number, barNo: number): void => {
    for (const cb of [...listeners]) {
      try {
        cb(stepNo, barNo);
      } catch {
        // one bad listener must not stop the others
      }
    }
  };

  /** Releases the sustained voices of a group. Nothing is disconnected or disposed, so reverb tails ring out. */
  const releaseGroup = (mood: MoodId, time: number): void => {
    if (!groups) return;
    try {
      if (mood === 'hollow') groups.hollow.drone.triggerRelease(time);
      else groups.neon.bass.triggerRelease(time);
    } catch {
      // releasing is best effort
    }
  };

  const triggerEvent = (g: Groups, ev: NoteEvent, time: number, stepSeconds: number): void => {
    const dur = ev.lengthSteps * stepSeconds * GATE;
    switch (ev.voice) {
      case 'kick':
        g.shared.kick.triggerAttackRelease(KICK.note, '16n', time, ev.gain);
        break;
      case 'clap':
        g.shared.clap.triggerAttackRelease('16n', time, ev.gain);
        break;
      case 'hollowMetal':
        g.hollow.metal.triggerAttackRelease(HOLLOW_METAL.frequency, dur, time, ev.gain);
        break;
      case 'neonHat':
        g.neon.hat.triggerAttackRelease(NEON_HAT.frequency, dur, time, ev.gain);
        break;
      case 'hollowBass':
        if (ev.pitch !== undefined) g.hollow.bass.triggerAttackRelease(ev.pitch, dur, time, ev.gain);
        break;
      case 'neonBass':
        if (ev.pitch !== undefined) g.neon.bass.triggerAttackRelease(ev.pitch, dur, time, ev.gain);
        break;
      default:
        break; // hollowDrone is driven only by DroneCommand
    }
  };

  const applyDrone = (g: Groups, cmd: DroneCommand, time: number): void => {
    if (cmd.action === 'trigger') g.hollow.drone.triggerAttack(cmd.pitch, time, cmd.gain);
    else if (cmd.action === 'release') g.hollow.drone.triggerRelease(time);
  };

  const tick = (time: number): void => {
    const capturedStep = step;
    const capturedBar = bar;
    try {
      const transport = Tone.getTransport();
      const result = advance(state, capturedStep);
      state = result.state;
      if (isValidBpm(result.bpm)) transport.bpm.value = result.bpm;

      const mood: MoodId | null = state.mood ?? state.pattern?.mood ?? null;
      if (mood !== null && activeMood !== null && mood !== activeMood) releaseGroup(activeMood, time);
      if (mood !== null) activeMood = mood;

      if (groups) {
        const g = groups;
        const bpmNow = transport.bpm.value;
        const stepSeconds = isValidBpm(bpmNow) ? 60 / bpmNow / 4 : 0.125;
        for (const ev of result.events) {
          try {
            triggerEvent(g, ev, time, stepSeconds);
          } catch {
            // a bad note must not stop the rest of the step
          }
        }
        try {
          applyDrone(g, result.drone, time);
        } catch {
          // best effort
        }
      }
    } catch {
      // a bad pattern must never throw inside the Transport callback
    }
    try {
      Tone.getDraw().schedule(() => emit(capturedStep, capturedBar), time);
    } catch {
      // best effort
    }
    step += 1;
    if (step === 16) {
      step = 0;
      bar += 1;
    }
  };

  const releaseSustained = (): void => {
    if (!groups) return;
    try {
      groups.hollow.drone.triggerRelease();
      groups.neon.bass.triggerRelease();
    } catch {
      // releasing is best effort
    }
  };

  const run = async (toneReady: Promise<void>): Promise<void> => {
    const myEpoch = epoch;
    await toneReady;
    if (disposed || myEpoch !== epoch) return;

    if (!groups) {
      const built = await buildGroups();
      if (disposed) {
        disposeGroups(built);
        return;
      }
      groups = built;
      if (myEpoch !== epoch) return;
    }

    const transport = Tone.getTransport();
    if (isValidBpm(state.pattern?.bpm)) transport.bpm.value = state.pattern.bpm;
    if (!scheduled) {
      transport.scheduleRepeat(tick, '16n', 0);
      scheduled = true;
    }
    running = true;
    transport.start(`+${LOOKAHEAD_S}`);
  };

  const start = (): Promise<void> => {
    if (disposed) return Promise.reject(new Error('tonePlayer is disposed'));
    if (starting) return starting;
    if (running) return Promise.resolve();

    let toneReady: Promise<void>;
    try {
      toneReady = Tone.start(); // synchronous, before any await: stays inside the click gesture
    } catch (err) {
      return Promise.reject(err);
    }

    const p: Promise<void> = run(toneReady).finally(() => {
      if (starting === p) starting = null;
    });
    starting = p;
    return p;
  };

  const stop = (): void => {
    epoch += 1;
    running = false;
    try {
      const transport = Tone.getTransport();
      transport.stop();
      transport.cancel();
      scheduled = false;
      Tone.getDraw().cancel();
    } catch {
      // keep tearing down state
    }
    releaseSustained();
    step = 0;
    bar = 0;
    activeMood = null;
    state = stopState(state);
  };

  const dispose = (): void => {
    if (disposed) return;
    stop();
    disposed = true;
    listeners.clear();
    if (groups) {
      const g = groups;
      groups = null;
      disposeGroups(g);
    }
  };

  return {
    start,
    stop,
    setPattern: (p: Pattern) => {
      // An invalid bpm is never applied: run() and tick() only set bpm when it is valid.
      if (!p) return;
      state = queuePattern(state, p, running);
    },
    setMood: (m: MoodId) => {
      state = queueMood(state, m, running);
    },
    onStep: (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    dispose,
  };
}
