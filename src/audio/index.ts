import type { Player } from '../engine/types';
import { createTonePlayer } from './tonePlayer';

export { createFakePlayer, FAKE_BPM, type FakePlayer } from './fakePlayer';
export { createTonePlayer, type TonePlayer } from './tonePlayer';

/** The contract's createPlayer, backed by the Tone.js player. */
export const createPlayer: () => Player = createTonePlayer;
