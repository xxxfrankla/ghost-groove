import type { BandId, BandScan, ImageFeatures, Pattern } from '../engine/types';
import blackImageJson from './blackImage.json';
import emptyLotJson from './emptyLot.json';
import neonStreetJson from './neonStreet.json';

export interface Fixture {
  features: ImageFeatures;
  bands: Record<BandId, BandScan>;
  pattern: Pattern; // the auto pattern for this case
}

export const emptyLot = emptyLotJson as Fixture;
export const neonStreet = neonStreetJson as Fixture;
export const blackImage = blackImageJson as Fixture;
