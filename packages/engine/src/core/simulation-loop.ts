import type { BabylonRenderer } from '../renderer/babylon-renderer.js';
import type { RapierPhysics } from '../physics/rapier-physics.js';
import { generateHeightmap } from '../terrain/noise.js';
import type { TerrainComponent, WaterComponent } from './component.js';

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

  // Terrain & water state
  private terrainBodyId: string | null = null;
  private terrainHeightData: Float32Array | null = null;
  private terrainConfig: { width: number; depth: number; subdivisions: number; maxHeight: number } | null = null;
  private waterLevel: number | null = null;
  private waterBuoyancy = 9.8;
  private waterDrag = 0.8;

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

    this.renderer.createWater({
      width: water.width,
      depth: water.depth,
      waterLevel: water.waterLevel,
      color: water.color,
      waveHeight: water.waveHeight,
      waveSpeed: water.waveSpeed,
    });
  }

  /**
   * Get terrain height at a world position (bilinear interpolation).
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
   */
  private applyBuoyancy(): void {
    if (this.waterLevel === null) return;

    for (const [entityId, bodyId] of this.entityToBody) {
      const pos = this.physics.getBodyPosition(bodyId);
      const depth = this.waterLevel - pos.y;

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

    // Render
    this.renderer.render();

    requestAnimationFrame(this.tick);
  };
}
