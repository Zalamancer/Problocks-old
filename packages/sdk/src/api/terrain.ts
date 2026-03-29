/**
 * Terrain API — student-facing type definitions for `pb.terrain`.
 *
 * Students don't import this directly; it exists so that the SDK can
 * provide autocomplete and documentation for the `pb.terrain` namespace
 * available inside the QuickJS sandbox.
 *
 * ## Quick Examples
 *
 * ```ts
 * // Create a grass hill
 * pb.terrain.fillBall({ x: 0, y: 0, z: 0 }, 40, 'Grass');
 *
 * // Build a stone wall
 * pb.terrain.fillBlock({ x: 100, y: 0, z: 0 }, { x: 4, y: 32, z: 64 }, 'Rock');
 *
 * // Read the height at a position
 * const y = pb.terrain.getHeight(50, 50);
 *
 * // Tint the water blue
 * pb.terrain.waterColor = { r: 0.1, g: 0.3, b: 0.8 };
 * ```
 */

// ── Helper types ───────────────────────────────────────────────────────

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface VoxelData {
  /** Flat array of material IDs, indexed [x][y][z] in row-major order. */
  materials: number[];
  /** Flat array of occupancy values (0.0–1.0), same indexing. */
  occupancy: number[];
  sizeX: number;
  sizeY: number;
  sizeZ: number;
}

/**
 * Terrain material names accepted by fill and paint methods.
 *
 * Use any of these strings wherever a method asks for `material`:
 * `'Grass'`, `'Sand'`, `'Rock'`, `'Snow'`, `'Water'`, `'Mud'`,
 * `'Ground'`, `'Ice'`, `'Sandstone'`, `'Slate'`, `'Concrete'`,
 * `'Limestone'`, `'Basalt'`, `'Brick'`, `'Cobblestone'`, `'Asphalt'`,
 * `'Pavement'`, `'Salt'`, `'CrackedLava'`, `'Glacier'`,
 * `'LeafyGrass'`, `'WoodPlanks'`.
 */
export type TerrainMaterialName =
  | 'Grass'
  | 'Sand'
  | 'Rock'
  | 'Snow'
  | 'Water'
  | 'Mud'
  | 'Ground'
  | 'Ice'
  | 'Sandstone'
  | 'Slate'
  | 'Concrete'
  | 'Limestone'
  | 'Basalt'
  | 'Brick'
  | 'Cobblestone'
  | 'Asphalt'
  | 'Pavement'
  | 'Salt'
  | 'CrackedLava'
  | 'Glacier'
  | 'LeafyGrass'
  | 'WoodPlanks';

// ── Terrain namespace ──────────────────────────────────────────────────

export interface TerrainAPI {
  // ── Fill operations ──

  /**
   * Fill a sphere of terrain.
   * @param center  Center position in world units.
   * @param radius  Radius in world units.
   * @param material  Material name (e.g. `'Grass'`, `'Rock'`).
   * @returns Number of voxels written.
   *
   * ```ts
   * pb.terrain.fillBall({ x: 0, y: 10, z: 0 }, 20, 'Sand');
   * ```
   */
  fillBall(center: Vec3, radius: number, material: TerrainMaterialName): number;

  /**
   * Fill a box of terrain.
   * @param position  Corner position in world units.
   * @param size      Extent in each axis (world units).
   * @param material  Material name.
   * @returns Number of voxels written.
   *
   * ```ts
   * pb.terrain.fillBlock({ x: 0, y: 0, z: 0 }, { x: 40, y: 4, z: 40 }, 'Concrete');
   * ```
   */
  fillBlock(position: Vec3, size: Vec3, material: TerrainMaterialName): number;

  /**
   * Fill a cylinder of terrain.
   * @param position  Base center position in world units.
   * @param height    Height in world units (extends upward).
   * @param radius    Radius in world units.
   * @param material  Material name.
   * @returns Number of voxels written.
   *
   * ```ts
   * pb.terrain.fillCylinder({ x: 50, y: 0, z: 50 }, 20, 10, 'Rock');
   * ```
   */
  fillCylinder(position: Vec3, height: number, radius: number, material: TerrainMaterialName): number;

  /**
   * Fill a rectangular region of terrain.
   * @param min  Minimum corner in world units.
   * @param max  Maximum corner in world units.
   * @param material  Material name.
   * @returns Number of voxels written.
   *
   * ```ts
   * pb.terrain.fillRegion({ x: 0, y: 0, z: 0 }, { x: 100, y: 20, z: 100 }, 'Grass');
   * ```
   */
  fillRegion(min: Vec3, max: Vec3, material: TerrainMaterialName): number;

  /**
   * Fill a wedge (ramp) of terrain.
   * The wedge slopes along +X: full height at x=0, tapering to zero at x=size.x.
   * @param position  Corner position in world units.
   * @param size      Extent in each axis (world units).
   * @param material  Material name.
   * @returns Number of voxels written.
   *
   * ```ts
   * pb.terrain.fillWedge({ x: 0, y: 0, z: 0 }, { x: 40, y: 20, z: 20 }, 'Rock');
   * ```
   */
  fillWedge(position: Vec3, size: Vec3, material: TerrainMaterialName): number;

  // ── Read / write ──

  /**
   * Set a single voxel.
   * @param x  World X coordinate.
   * @param y  World Y coordinate.
   * @param z  World Z coordinate.
   * @param occupancy  Density 0.0 (air) to 1.0 (solid).
   * @param material  Material name.
   */
  setVoxel(x: number, y: number, z: number, occupancy: number, material: TerrainMaterialName): void;

  /**
   * Get the material name at a world position.
   * Returns `'Air'` for empty space.
   */
  getMaterial(x: number, y: number, z: number): TerrainMaterialName | 'Air';

  /**
   * Get the world Y of the topmost solid voxel at (x, z).
   * Returns 0 if no terrain is found.
   */
  getHeight(x: number, z: number): number;

  /**
   * Read a 3D region of voxels.
   * @param min  Minimum corner in world units.
   * @param max  Maximum corner in world units.
   * @returns Object with flat `materials` and `occupancy` arrays plus dimensions.
   *
   * ```ts
   * const data = pb.terrain.readVoxels({ x: 0, y: 0, z: 0 }, { x: 40, y: 40, z: 40 });
   * pb.log('Total voxels:', data.sizeX * data.sizeY * data.sizeZ);
   * ```
   */
  readVoxels(min: Vec3, max: Vec3): VoxelData;

  /**
   * Write a 3D region of voxels from previously read data.
   * @param min   Minimum corner to paste at (world units).
   * @param data  Voxel data object (as returned by `readVoxels`).
   *
   * ```ts
   * const data = pb.terrain.readVoxels(from, to);
   * pb.terrain.writeVoxels({ x: 200, y: 0, z: 0 }, data);
   * ```
   */
  writeVoxels(min: Vec3, data: VoxelData): number;

  /**
   * Clear all terrain voxels.
   */
  clear(): void;

  // ── Water properties ──

  /** Water tint color (RGB, each 0–1). */
  waterColor: RGB;
  /** Water reflectance (0–1). */
  waterReflectance: number;
  /** Water transparency (0–1). */
  waterTransparency: number;
  /** Wave amplitude (0–1). */
  waterWaveSize: number;
  /** Wave animation speed (0–100). */
  waterWaveSpeed: number;

  // ── Decoration ──

  /** Enable/disable grass and decoration rendering. */
  decoration: boolean;
  /** Grass blade height scale (0.1–1.0). */
  grassLength: number;

  // ── Material color overrides ──

  /**
   * Override the display color of a material.
   * @param name   Material name.
   * @param color  RGB color (0–255 per channel).
   */
  setMaterialColor(name: TerrainMaterialName, color: RGB): void;

  /**
   * Get the current display color of a material (including overrides).
   */
  getMaterialColor(name: TerrainMaterialName): RGB;

  /**
   * Reset a material's color to its default.
   */
  resetMaterialColor(name: TerrainMaterialName): void;
}
