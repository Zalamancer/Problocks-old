/**
 * Game metadata for marketplace filtering.
 *
 * Published games include hardware requirement metadata so the
 * marketplace can filter based on device tier.
 */

import type { DeviceTier } from './hardware-detect.js';
import { getGameMinTier } from './hardware-detect.js';

// ── Types ────────────────────────────────────────────────────────────

/** Engine type for a published game. */
export type EngineType = '2d' | '3d';

/** Game metadata stored alongside published simulations. */
export interface GameMetadata {
  /** Unique game/simulation ID. */
  gameId: string;
  /** Engine type used. */
  engineType: EngineType;
  /** Maximum vertex count (3D games). */
  maxVertices?: number;
  /** Whether a low-polygon mode is available. */
  hasLowPolyMode: boolean;
  /** Minimum device tier required. Auto-calculated if not specified. */
  minTier: DeviceTier;
}

/** Marketplace filter options. */
export interface MarketplaceFilter {
  /** Device tier to filter for. */
  deviceTier?: DeviceTier;
  /** Engine type filter. */
  engineType?: EngineType;
  /** Only show games assigned by teacher. */
  teacherAssigned?: boolean;
}

// ── Filtering ────────────────────────────────────────────────────────

/**
 * Filter a list of games based on device capabilities and preferences.
 *
 * Games above the device tier are hidden unless teacher-assigned.
 */
export function filterGamesForDevice(
  games: GameMetadata[],
  deviceTier: DeviceTier,
  teacherAssignedIds: Set<string> = new Set(),
): GameMetadata[] {
  const tierRank: Record<DeviceTier, number> = { low: 0, mid: 1, high: 2 };
  const deviceRank = tierRank[deviceTier];

  return games.filter((game) => {
    const minTier = getGameMinTier({
      engineType: game.engineType,
      maxVertices: game.maxVertices,
      hasLowPolyMode: game.hasLowPolyMode,
      minTier: game.minTier,
    });
    const gameRank = tierRank[minTier];

    // Always show teacher-assigned games
    if (teacherAssignedIds.has(game.gameId)) return true;

    // Filter out games above device tier
    return deviceRank >= gameRank;
  });
}

/**
 * Build game metadata from publish-time info.
 * Auto-calculates minTier if not provided.
 */
export function buildGameMetadata(
  gameId: string,
  engineType: EngineType,
  options?: {
    maxVertices?: number;
    hasLowPolyMode?: boolean;
    minTier?: DeviceTier;
  },
): GameMetadata {
  const hasLowPolyMode = options?.hasLowPolyMode ?? false;
  const minTier = options?.minTier ?? getGameMinTier({
    engineType,
    maxVertices: options?.maxVertices,
    hasLowPolyMode,
  });

  return {
    gameId,
    engineType,
    maxVertices: options?.maxVertices,
    hasLowPolyMode,
    minTier,
  };
}
