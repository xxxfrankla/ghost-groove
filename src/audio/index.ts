import type { Player } from '../engine/types';
import { createFakePlayer } from './fakePlayer';

export { createFakePlayer, FAKE_BPM, type FakePlayer } from './fakePlayer';

/** Alias for the contract's createPlayer. Points at the fake player until the Tone.js one exists. */
export const createPlayer: () => Player = createFakePlayer;
