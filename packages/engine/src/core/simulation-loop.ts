import type { BabylonRenderer } from '../renderer/babylon-renderer.js';
import type { RapierPhysics } from '../physics/rapier-physics.js';
import { generateHeightmap } from '../terrain/noise.js';
import type { TerrainComponent, WaterComponent, VoxelTerrainComponent } from './component.js';

// Voxel terrain subsystem imports
import { VoxelGrid } from '../terrain/voxel/voxel-grid.js';
import { ChunkMesher } from '../terrain/meshing/chunk-mesher.js';
import { ChunkRenderer } from '../terrain/rendering/chunk-renderer.js';
import { ChunkManager } from '../terrain/voxel/chunk-manager.js';
import { TerrainPhysics } from '../terrain/physics/terrain-physics.js';
import { TerrainGenerator } from '../terrain/generation/terrain-generator.js';
import type { TerrainRegion } from '../terrain/generation/cave-generator.js';
import { sampleSubmersion, computeBuoyancyForce, DEFAULT_BUOYANCY_CONFIG } from '../terrain/physics/voxel-buoyancy.js';
import type { BuoyancyConfig } from '../terrain/physics/voxel-buoyancy.js';

/**
 * The main simulation loop.
 * Orchestrates: sandbox scripts → physics step → sync transforms → render.
 *
 * Fixed timestep for physics (deterministic), variable render.
 */
export class SimulationLoop {
  private renderer: BabylonRenderer;
  private physics: RapierPhysics;
  private running = false;
  private physicsTimestep = 1 / 60; // 60 Hz fixed step
  private accumulator = 0;
  private lastTime = 0;
  private frameCallback: ((dt: number) => void) | null = null;

  // Entity tracking: maps entity IDs to physics body IDs
  private entityToBody: Map<string, string> = new Map();

  // Terrain & water state (legacy heightmap)
  private terrainBodyId: string | null = null;
  private terrainHeightData: Float32Array | null = null;
  private terrainConfig: { width: number; depth: number; subdivisions: number; maxHeight: number } | null = null;
  private waterLevel: number | null = null;
  private waterBuoyancy = 9.8;
  private waterDrag = 0.8;
  private waterWidth = 0;
  private waterDepth = 0;

  // ── Voxel terrain state ────────────────────────────────────────────
  private voxelGrid: VoxelGrid | null = null;
  private chunkManager: ChunkManager | null = null;
  private chunkRenderer: ChunkRenderer | null = null;
  private terrainPhysics: TerrainPhysics | null = null;
  private useVoxelTerrain = false;

  constructor(renderer: BabylonRenderer, physics: RapierPhysics) {
    this.renderer = renderer;
    this.physics = physics;
  }

  /**
   * Register a callback that runs each frame BEFORE physics.
   * This is where sandbox game logic executes.
   */
  onFrame(callback: (dt: number) => void): void {
    this.frameCallback = callback;
  }

  /**
   * Create a simulation entity with both visual and physics representation.
   */
  createEntity(
    entityId: string,
    shape: 'box' | 'sphere' | 'cylinder' | 'plane',
    options: {
      width?: number;
      height?: number;
      depth?: number;
      radius?: number;
      color?: string;
      position?: { x: number; y: number; z: number };
      mass?: number;
      isStatic?: boolean;
      friction?: number;
      restitution?: number;
    } = {},
  ): void {
    const pos = options.position ?? { x: 0, y: 0, z: 0 };
    const dims = {
      width: options.width ?? (options.radius ? options.radius * 2 : 1),
      height: options.height ?? 1,
      depth: options.depth ?? (options.width ?? 1),
    };

    // Create visual mesh
    this.renderer.createMesh(entityId, shape, {
      ...options,
      position: pos,
    });

    // Create physics body
    const bodyId = this.physics.addBody({
      position: pos,
      shape,
      dimensions: dims,
      mass: options.mass ?? 1,
      isStatic: options.isStatic ?? false,
      friction: options.friction ?? 0.5,
      restitution: options.restitution ?? 0.3,
    });

    this.entityToBody.set(entityId, bodyId);
  }

  /**
   * Create terrain with procedural heightmap, visual mesh, and physics collider.
   */
  createTerrain(terrain: TerrainComponent): void {
    const rows = terrain.subdivisions + 1;
    const cols = terrain.subdivisions + 1;

    // Generate procedural heightmap
    const heightData = generateHeightmap({
      rows,
      cols,
      scale: terrain.noiseScale,
      height: terrain.maxHeight,
      octaves: terrain.octaves,
      seed: terrain.seed,
    });

    this.terrainHeightData = heightData;
    this.terrainConfig = {
      width: terrain.width,
      depth: terrain.depth,
      subdivisions: terrain.subdivisions,
      maxHeight: terrain.maxHeight,
    };

    // Visual terrain mesh
    this.renderer.createTerrain({
      width: terrain.width,
      depth: terrain.depth,
      subdivisions: terrain.subdivisions,
      heightData,
      maxHeight: terrain.maxHeight,
      layers: terrain.layers,
    });

    // Physics trimesh collider from actual mesh data
    const meshData = this.renderer.getTerrainMeshData();
    if (meshData) {
      this.terrainBodyId = this.physics.addTrimesh({
        vertices: meshData.vertices,
        indices: meshData.indices,
      });
    }
  }

  /**
   * Create water plane with visual material. Enables buoyancy for physics bodies.
   */
  createWater(water: WaterComponent): void {
    this.waterLevel = water.waterLevel;
    this.waterBuoyancy = water.buoyancy;
    this.waterDrag = water.waterDrag;
    this.waterWidth = water.width;
    this.waterDepth = water.depth;

    this.renderer.createWater({
      width: water.width,
      depth: water.depth,
      waterLevel: water.waterLevel,
      color: water.color,
      waveHeight: water.waveHeight,
      waveSpeed: water.waveSpeed,
    });
  }

  // ── Voxel Terrain ──────────────────────────────────────────────────

  /**
   * Create voxel terrain: generates the grid, sets up chunk meshing,
   * physics colliders, and per-frame updates via ChunkManager.
   */
  createVoxelTerrain(voxelTerrain: VoxelTerrainComponent): void {
    this.useVoxelTerrain = true;

    // 1. Core data structures
    const grid = new VoxelGrid();
    const scene = this.renderer.getScene();
    const mesher = new ChunkMesher();
    const chunkRenderer = new ChunkRenderer(scene);
    const chunkManager = new ChunkManager(grid, mesher, chunkRenderer);

    // 2. Terrain physics (trimesh colliders per chunk)
    const rapierWorld = this.physics.getWorld();
    const terrainPhysics = new TerrainPhysics(rapierWorld, grid);
    chunkManager.setTerrainPhysics(terrainPhysics);

    // 3. Generate terrain from component config
    const region: TerrainRegion = {
      minX: voxelTerrain.minX,
      maxX: voxelTerrain.maxX,
      minY: voxelTerrain.minY,
      maxY: voxelTerrain.maxY,
      minZ: voxelTerrain.minZ,
      maxZ: voxelTerrain.maxZ,
    };

    const generator = new TerrainGenerator();
    generator.generate(grid, region, {
      biomes: voxelTerrain.biomes,
      seed: voxelTerrain.seed,
      biomeSize: voxelTerrain.biomeSize,
      blending: voxelTerrain.blending,
      caves: voxelTerrain.caves,
    });

    // 4. Mark all chunks dirty so they get meshed on first frames
    chunkManager.forceRemeshAll();

    // 5. Store references
    this.voxelGrid = grid;
    this.chunkManager = chunkManager;
    this.chunkRenderer = chunkRenderer;
    this.terrainPhysics = terrainPhysics;
  }

  /** Expose the voxel grid for external subsystems (editor, scripting). */
  getVoxelGrid(): VoxelGrid | null {
    return this.voxelGrid;
  }

  /** Expose the chunk manager for external subsystems. */
  getChunkManager(): ChunkManager | null {
    return this.chunkManager;
  }

  /** Expose terrain physics for raycasting and collider queries. */
  getTerrainPhysics(): TerrainPhysics | null {
    return this.terrainPhysics;
  }

  /**
   * Get terrain height at a world position (bilinear interpolation).
   * Legacy heightmap version.
   */
  getTerrainHeightAt(worldX: number, worldZ: number): number {
    if (!this.terrainHeightData || !this.terrainConfig) return 0;
    const { width, depth, subdivisions } = this.terrainConfig;
    const rows = subdivisions + 1;
    const cols = subdivisions + 1;

    // Convert world coords to grid coords
    const gx = ((worldX + width / 2) / width) * (cols - 1);
    const gz = ((worldZ + depth / 2) / depth) * (rows - 1);

    const x0 = Math.max(0, Math.min(cols - 2, Math.floor(gx)));
    const z0 = Math.max(0, Math.min(rows - 2, Math.floor(gz)));
    const fx = gx - x0;
    const fz = gz - z0;

    const h00 = this.terrainHeightData[z0 * cols + x0];
    const h10 = this.terrainHeightData[z0 * cols + x0 + 1];
    const h01 = this.terrainHeightData[(z0 + 1) * cols + x0];
    const h11 = this.terrainHeightData[(z0 + 1) * cols + x0 + 1];

    // Bilinear interpolation
    return (h00 * (1 - fx) * (1 - fz)) +
           (h10 * fx * (1 - fz)) +
           (h01 * (1 - fx) * fz) +
           (h11 * fx * fz);
  }

  removeEntity(entityId: string): void {
    const bodyId = this.entityToBody.get(entityId);
    if (bodyId) {
      this.physics.removeBody(bodyId);
      this.entityToBody.delete(entityId);
    }
    this.renderer.removeMesh(entityId);
  }

  /**
   * Set entity position from the UI (updates both physics body and visual mesh).
   */
  setEntityPosition(entityId: string, position: { x: number; y: number; z: number }): void {
    const bodyId = this.entityToBody.get(entityId);
    if (bodyId) {
      this.physics.setBodyPosition(bodyId, position);
    }
    this.renderer.updateMeshTransform(entityId, position);
  }

  applyForce(entityId: string, force: { x: number; y: number; z: number }): void {
    const bodyId = this.entityToBody.get(entityId);
    if (bodyId) {
      this.physics.applyForce(bodyId, force);
    }
  }

  applyImpulse(entityId: string, impulse: { x: number; y: number; z: number }): void {
    const bodyId = this.entityToBody.get(entityId);
    if (bodyId) {
      this.physics.applyImpulse(bodyId, impulse);
    }
  }

  getPosition(entityId: string): { x: number; y: number; z: number } {
    const bodyId = this.entityToBody.get(entityId);
    if (!bodyId) return { x: 0, y: 0, z: 0 };
    return this.physics.getBodyPosition(bodyId);
  }

  getVelocity(entityId: string): { x: number; y: number; z: number } {
    const bodyId = this.entityToBody.get(entityId);
    if (!bodyId) return { x: 0, y: 0, z: 0 };
    return this.physics.getVelocity(bodyId);
  }

  /**
   * Apply buoyancy forces to entities submerged in water.
   * Uses dynamic heightfield for wave-aware buoyancy and creates ripples.
   * Legacy path — used when voxel terrain is NOT active.
   */
  private applyBuoyancy(): void {
    // Voxel terrain path: use voxel-accurate water detection
    if (this.useVoxelTerrain && this.voxelGrid) {
      this.applyVoxelBuoyancy();
      return;
    }

    if (this.waterLevel === null) return;

    for (const [entityId, bodyId] of this.entityToBody) {
      const pos = this.physics.getBodyPosition(bodyId);
      // Use dynamic water height (base level + wave displacement)
      const waterHeight = this.renderer.getWaterHeightAt(pos.x, pos.z);
      const depth = waterHeight - pos.y;

      if (depth > 0) {
        // Submerged: apply upward buoyancy force proportional to depth
        const submersion = Math.min(depth, 2.0); // cap at 2 units
        const buoyancyForce = this.waterBuoyancy * submersion;
        this.physics.applyForce(bodyId, { x: 0, y: buoyancyForce, z: 0 });

        // Apply drag to slow submerged objects
        const vel = this.physics.getVelocity(bodyId);
        this.physics.applyForce(bodyId, {
          x: -vel.x * this.waterDrag,
          y: -vel.y * this.waterDrag * 0.5,
          z: -vel.z * this.waterDrag,
        });

        // Create ripples at water surface for objects near the surface
        if (depth < 1.0) {
          const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y + vel.z * vel.z);
          if (speed > 0.5) {
            this.renderer.addWaterDrop(pos.x, pos.z, 0.03, speed * 0.005);
          }
        }
      }
    }
  }

  /**
   * Voxel-accurate buoyancy: samples the VoxelGrid around each entity
   * to determine submersion fraction, then applies Archimedes-style forces.
   */
  private applyVoxelBuoyancy(): void {
    if (!this.voxelGrid) return;

    for (const [, bodyId] of this.entityToBody) {
      const pos = this.physics.getBodyPosition(bodyId);
      // Approximate entity AABB as 1×1×1 around center
      const halfSize = 0.5;
      const result = sampleSubmersion(this.voxelGrid, {
        minX: pos.x - halfSize,
        minY: pos.y - halfSize,
        minZ: pos.z - halfSize,
        maxX: pos.x + halfSize,
        maxY: pos.y + halfSize,
        maxZ: pos.z + halfSize,
      });

      if (result.submersion > 0) {
        const vel = this.physics.getVelocity(bodyId);
        const force = computeBuoyancyForce(result.submersion, 1.0, vel, DEFAULT_BUOYANCY_CONFIG);
        this.physics.applyForce(bodyId, {
          x: force.dragX,
          y: force.forceY + force.dragY,
          z: force.dragZ,
        });
      }
    }
  }

  /**
   * Sync physics positions to visual meshes.
   */
  private syncTransforms(): void {
    for (const [entityId, bodyId] of this.entityToBody) {
      const pos = this.physics.getBodyPosition(bodyId);
      const rot = this.physics.getBodyRotation(bodyId);
      this.renderer.updateMeshTransform(entityId, pos, rot);
    }
  }

  start(): void {
    this.running = true;
    this.lastTime = performance.now();
    this.tick();
  }

  stop(): void {
    this.running = false;
  }

  /** Dispose voxel terrain subsystems. */
  disposeVoxelTerrain(): void {
    if (this.chunkManager) {
      this.chunkManager.disposeAll();
      this.chunkManager = null;
    }
    if (this.chunkRenderer) {
      this.chunkRenderer.dispose();
      this.chunkRenderer = null;
    }
    if (this.terrainPhysics) {
      this.terrainPhysics.dispose();
      this.terrainPhysics = null;
    }
    this.voxelGrid = null;
    this.useVoxelTerrain = false;
  }

  private tick = (): void => {
    if (!this.running) return;

    const now = performance.now();
    const frameTime = Math.min((now - this.lastTime) / 1000, 0.1); // cap at 100ms
    this.lastTime = now;
    this.accumulator += frameTime;

    // Run sandbox game logic once per frame
    if (this.frameCallback) {
      this.frameCallback(frameTime);
    }

    // Fixed timestep physics
    while (this.accumulator >= this.physicsTimestep) {
      this.applyBuoyancy();
      this.physics.step(this.physicsTimestep);
      this.accumulator -= this.physicsTimestep;
    }

    // Sync physics → renderer
    this.syncTransforms();

    // Update voxel terrain chunk manager (LOD, meshing, unloading)
    if (this.chunkManager) {
      const cam = this.renderer.getCameraPosition();
      this.chunkManager.update(cam);
    }

    // Render
    this.renderer.render();

    requestAnimationFrame(this.tick);
  };
}
