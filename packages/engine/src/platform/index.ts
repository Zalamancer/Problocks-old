/**
 * @problocks/engine — Platform detection subsystem
 *
 * Hardware capability detection and device tier classification.
 */

export type {
  DeviceTier,
  HardwareProfile,
  GameHardwareReqs,
} from './hardware-detect.js';

export {
  detectHardware,
  getGameMinTier,
  canRunGame,
} from './hardware-detect.js';

// Game metadata & marketplace filtering
export type {
  EngineType,
  GameMetadata,
  MarketplaceFilter,
} from './game-metadata.js';

export {
  filterGamesForDevice,
  buildGameMetadata,
} from './game-metadata.js';
