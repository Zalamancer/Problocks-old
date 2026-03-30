/**
 * Core constants for the voxel terrain system.
 * All measurements in world units unless noted.
 */

/** World units per voxel (Roblox uses 4 studs) */
export const VOXEL_SIZE = 4;

/** Voxels per chunk axis */
export const CHUNK_SIZE = 16;

/** Total voxels per chunk (16^3) */
export const CHUNK_VOLUME = CHUNK_SIZE ** 3;

/** World units per chunk axis (16 voxels * 4 units = 64) */
export const CHUNK_WORLD_SIZE = CHUNK_SIZE * VOXEL_SIZE;

/** Marching Cubes isosurface threshold — occupancy above this = solid */
export const MC_THRESHOLD = 0.5;
