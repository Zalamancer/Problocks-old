import * as BABYLON from '@babylonjs/core';
import { GridMaterial, WaterMaterial } from '@babylonjs/materials';
import { Renderer, type RendererOptions } from './renderer.js';
import { UnifiedGizmo } from './unified-gizmo.js';
import type { TerrainLayer } from '../core/component.js';

interface MeshEntry {
  mesh: BABYLON.AbstractMesh;
  entityId: string;
}

export interface TerrainRenderOptions {
  width: number;
  depth: number;
  subdivisions: number;
  heightData: Float32Array;
  maxHeight: number;
  layers: TerrainLayer[];
}

export interface WaterRenderOptions {
  width: number;
  depth: number;
  waterLevel: number;
  color: string;
  waveHeight: number;
  waveSpeed: number;
}

/**
 * Babylon.js implementation of the renderer abstraction.
 */
export class BabylonRenderer extends Renderer {
  readonly mode = '3d' as const;

  private engine!: BABYLON.Engine;
  private scene!: BABYLON.Scene;
  private camera!: BABYLON.ArcRotateCamera;
  private meshes: Map<string, MeshEntry> = new Map();
  private gizmo: UnifiedGizmo | null = null;
  private attachedGizmoEntityId: string | null = null;
  private terrainMesh: BABYLON.GroundMesh | null = null;
  private waterMesh: BABYLON.Mesh | null = null;
  private waterMaterial: WaterMaterial | null = null;

  async init(options: RendererOptions): Promise<void> {
    const canvas = options.canvas;
    const rect = canvas.parentElement?.getBoundingClientRect() ?? { width: 800, height: 600 };
    canvas.width = rect.width;
    canvas.height = rect.height;
    canvas.style.width = '100%';
    canvas.style.height = '100%';

    this.engine = new BABYLON.Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
    });

    this.scene = new BABYLON.Scene(this.engine);
    this.scene.clearColor = new BABYLON.Color4(0.12, 0.12, 0.18, 1);

    // Camera
    this.camera = new BABYLON.ArcRotateCamera(
      'camera', -Math.PI / 4, Math.PI / 3, 40,
      new BABYLON.Vector3(0, 5, 0), this.scene,
    );
    this.camera.attachControl(canvas, true);
    this.camera.lowerRadiusLimit = 2;
    this.camera.upperRadiusLimit = 200;
    this.camera.wheelPrecision = 20;

    // Disable default wheel zoom — Viewport handles wheel events for orbit/zoom
    const wheelInput = this.camera.inputs.attached['mousewheel'];
    if (wheelInput) this.camera.inputs.remove(wheelInput);

    // Lights
    const hemi = new BABYLON.HemisphericLight('hemi', new BABYLON.Vector3(0, 1, 0), this.scene);
    hemi.intensity = 0.9;
    hemi.groundColor = new BABYLON.Color3(0.3, 0.3, 0.4);

    const dir = new BABYLON.DirectionalLight('dir', new BABYLON.Vector3(-1, -2, -1), this.scene);
    dir.intensity = 0.7;

    // Grid ground
    const ground = BABYLON.MeshBuilder.CreateGround('__ground', { width: 30, height: 30 }, this.scene);
    const groundMat = new GridMaterial('groundMat', this.scene);
    groundMat.majorUnitFrequency = 5;
    groundMat.minorUnitVisibility = 0.3;
    groundMat.gridRatio = 1;
    groundMat.backFaceCulling = false;
    groundMat.mainColor = new BABYLON.Color3(0.15, 0.15, 0.2);
    groundMat.lineColor = new BABYLON.Color3(0.3, 0.3, 0.4);
    groundMat.opacity = 0.9;
    ground.material = groundMat;
  }

  createMesh(
    entityId: string,
    shape: 'box' | 'sphere' | 'cylinder' | 'plane',
    options: {
      width?: number; height?: number; depth?: number; radius?: number;
      color?: string;
      position?: { x: number; y: number; z: number };
    } = {},
  ): void {
    let mesh: BABYLON.AbstractMesh;

    switch (shape) {
      case 'box':
        mesh = BABYLON.MeshBuilder.CreateBox(entityId, {
          width: options.width ?? 1, height: options.height ?? 1, depth: options.depth ?? 1,
        }, this.scene);
        break;
      case 'sphere':
        mesh = BABYLON.MeshBuilder.CreateSphere(entityId, {
          diameter: (options.radius ?? 0.5) * 2, segments: 32,
        }, this.scene);
        break;
      case 'cylinder':
        mesh = BABYLON.MeshBuilder.CreateCylinder(entityId, {
          diameter: (options.radius ?? 0.5) * 2, height: options.height ?? 1,
        }, this.scene);
        break;
      case 'plane':
        mesh = BABYLON.MeshBuilder.CreateGround(entityId, {
          width: options.width ?? 10, height: options.height ?? 10,
        }, this.scene);
        break;
    }

    const mat = new BABYLON.StandardMaterial(`${entityId}_mat`, this.scene);
    if (options.color) {
      mat.diffuseColor = BABYLON.Color3.FromHexString(options.color);
    }
    mesh.material = mat;

    if (options.position) {
      mesh.position = new BABYLON.Vector3(options.position.x, options.position.y, options.position.z);
    }

    this.meshes.set(entityId, { mesh, entityId });
  }

  updateMeshTransform(
    entityId: string,
    position: { x: number; y: number; z: number },
    rotation?: { x: number; y: number; z: number },
  ): void {
    const entry = this.meshes.get(entityId);
    if (!entry) return;
    entry.mesh.position.set(position.x, position.y, position.z);
    if (rotation) entry.mesh.rotation.set(rotation.x, rotation.y, rotation.z);
  }

  removeMesh(entityId: string): void {
    const entry = this.meshes.get(entityId);
    if (entry) { entry.mesh.dispose(); this.meshes.delete(entityId); }
  }

  render(): void { this.scene.render(); }

  resize(_w: number, _h: number): void { this.engine.resize(); }

  dispose(): void {
    this.meshes.forEach(e => e.mesh.dispose());
    this.meshes.clear();
    this.scene.dispose();
    this.engine.dispose();
  }

  startRenderLoop(): void {
    this.engine.runRenderLoop(() => this.scene.render());
  }

  handleResize(): void { this.engine.resize(); }

  getScene(): BABYLON.Scene { return this.scene; }

  getMesh(entityId: string): BABYLON.AbstractMesh | null {
    return this.meshes.get(entityId)?.mesh ?? null;
  }

  attachGizmo(entityId: string): void {
    const entry = this.meshes.get(entityId);
    if (!entry) return;

    if (!this.gizmo) {
      this.gizmo = new UnifiedGizmo(this.scene);
    }

    this.gizmo.attach(entry.mesh);
    this.attachedGizmoEntityId = entityId;
  }

  detachGizmo(): void {
    if (this.gizmo) {
      this.gizmo.detach();
    }
    this.attachedGizmoEntityId = null;
  }

  getAttachedGizmoEntityId(): string | null {
    return this.attachedGizmoEntityId;
  }

  // ── Terrain ──────────────────────────────────────────────

  createTerrain(options: TerrainRenderOptions): BABYLON.GroundMesh {
    if (this.terrainMesh) {
      this.terrainMesh.dispose();
    }

    const { width, depth, subdivisions, heightData, maxHeight, layers } = options;
    const rows = subdivisions + 1;
    const cols = subdivisions + 1;

    // Create a subdivided ground
    const ground = BABYLON.MeshBuilder.CreateGround('__terrain', {
      width,
      height: depth,
      subdivisions,
      updatable: true,
    }, this.scene) as BABYLON.GroundMesh;

    // Get vertex positions and set heights from heightmap
    const positions = ground.getVerticesData(BABYLON.VertexBuffer.PositionKind)!;
    const colors = new Float32Array((positions.length / 3) * 4);

    for (let i = 0; i < positions.length / 3; i++) {
      // Ground mesh vertices are laid out row by row
      const row = Math.floor(i / cols);
      const col = i % cols;
      const heightIdx = row * cols + col;
      const h = heightData[heightIdx] ?? 0;

      // Set Y position
      positions[i * 3 + 1] = h;

      // Compute normalized height for coloring [0, 1]
      const normalizedH = maxHeight > 0 ? h / maxHeight : 0;

      // Blend terrain layer colors based on height
      const color = this.blendTerrainColor(normalizedH, layers);
      colors[i * 4 + 0] = color.r;
      colors[i * 4 + 1] = color.g;
      colors[i * 4 + 2] = color.b;
      colors[i * 4 + 3] = 1.0;
    }

    ground.updateVerticesData(BABYLON.VertexBuffer.PositionKind, positions);
    ground.setVerticesData(BABYLON.VertexBuffer.ColorKind, colors);

    // Recompute normals for proper lighting
    const indices = ground.getIndices()!;
    const normals = new Float32Array(positions.length);
    BABYLON.VertexData.ComputeNormals(positions, indices, normals);
    ground.updateVerticesData(BABYLON.VertexBuffer.NormalKind, normals);

    // Material that uses vertex colors
    const mat = new BABYLON.StandardMaterial('__terrainMat', this.scene);
    mat.diffuseColor = BABYLON.Color3.White();
    mat.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
    mat.backFaceCulling = true;
    // Enable vertex color usage by setting the vertex color flag
    ground.useVertexColors = true;
    ground.material = mat;

    ground.receiveShadows = true;
    this.terrainMesh = ground;
    return ground;
  }

  private blendTerrainColor(
    normalizedHeight: number,
    layers: TerrainLayer[],
  ): { r: number; g: number; b: number } {
    let totalWeight = 0;
    let r = 0, g = 0, b = 0;

    for (const layer of layers) {
      const [lo, hi] = layer.heightRange;
      // Smooth weight: full inside range, fades at edges
      let weight = 0;
      if (normalizedHeight >= lo && normalizedHeight <= hi) {
        const mid = (lo + hi) / 2;
        const halfSpan = (hi - lo) / 2;
        // Bell-curve-ish weight
        const dist = Math.abs(normalizedHeight - mid) / halfSpan;
        weight = 1 - dist * dist;
      }
      if (weight > 0) {
        const c = BABYLON.Color3.FromHexString(layer.tint);
        r += c.r * weight;
        g += c.g * weight;
        b += c.b * weight;
        totalWeight += weight;
      }
    }

    if (totalWeight > 0) {
      return { r: r / totalWeight, g: g / totalWeight, b: b / totalWeight };
    }
    return { r: 0.5, g: 0.5, b: 0.5 };
  }

  getTerrainMesh(): BABYLON.GroundMesh | null {
    return this.terrainMesh;
  }

  getTerrainMeshData(): { vertices: Float32Array; indices: Uint32Array } | null {
    if (!this.terrainMesh) return null;
    const positions = this.terrainMesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
    const indices = this.terrainMesh.getIndices();
    if (!positions || !indices) return null;
    return {
      vertices: new Float32Array(positions),
      indices: new Uint32Array(indices),
    };
  }

  // ── Water ────────────────────────────────────────────────

  createWater(options: WaterRenderOptions): BABYLON.Mesh {
    if (this.waterMesh) {
      this.waterMesh.dispose();
    }

    const { width, depth, waterLevel, color, waveHeight, waveSpeed } = options;

    const water = BABYLON.MeshBuilder.CreateGround('__water', {
      width,
      height: depth,
      subdivisions: 64,
    }, this.scene);
    water.position.y = waterLevel;

    const waterMat = new WaterMaterial('__waterMat', this.scene, new BABYLON.Vector2(512, 512));
    waterMat.bumpTexture = new BABYLON.Texture(
      'https://assets.babylonjs.com/textures/waterbump.png',
      this.scene,
    );
    const waterColor = BABYLON.Color3.FromHexString(color);
    waterMat.waterColor = waterColor;
    waterMat.colorBlendFactor = 0.3;
    waterMat.windForce = waveSpeed * -5;
    waterMat.waveHeight = waveHeight;
    waterMat.waveSpeed = waveSpeed * 50;
    waterMat.waveLength = 0.3;
    waterMat.windDirection = new BABYLON.Vector2(1, 1);
    waterMat.bumpHeight = 0.1;

    // Add terrain + entity meshes to reflection/refraction
    if (this.terrainMesh) {
      waterMat.addToRenderList(this.terrainMesh);
    }
    for (const [, entry] of this.meshes) {
      waterMat.addToRenderList(entry.mesh);
    }

    water.material = waterMat;
    this.waterMesh = water;
    this.waterMaterial = waterMat;
    return water;
  }

  getWaterLevel(): number {
    return this.waterMesh?.position.y ?? 0;
  }

  addToWaterRenderList(mesh: BABYLON.AbstractMesh): void {
    if (this.waterMaterial) {
      this.waterMaterial.addToRenderList(mesh);
    }
  }
}
