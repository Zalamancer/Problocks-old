/**
 * Section 1.8 -- Chunk Renderer
 *
 * Converts ChunkMeshData (from Marching Cubes) into Babylon.js meshes
 * positioned at the correct world-space origin. Manages solid and water
 * meshes independently, reusing existing meshes when chunks are re-meshed.
 */

import * as BABYLON from "@babylonjs/core";
import type { ChunkMeshData } from "../meshing/marching-cubes.js";
import type { Chunk } from "../voxel/chunk.js";
import { CHUNK_WORLD_SIZE } from "../voxel/constants.js";
import { TerrainMaterial, MATERIAL_DEFS } from "../voxel/terrain-materials.js";
import { createTriplanarMaterial } from "./triplanar-material.js";

// ── Helpers ────────────────────────────────────────────────────────────

/**
 * Expand RGB (3 floats per vertex) to RGBA (4 floats per vertex).
 * Babylon.js VertexData expects colors in RGBA format.
 */
function expandRGBtoRGBA(rgb: Float32Array, vertexCount: number): Float32Array {
  const rgba = new Float32Array(vertexCount * 4);
  for (let i = 0; i < vertexCount; i++) {
    const src = i * 3;
    const dst = i * 4;
    rgba[dst] = rgb[src];
    rgba[dst + 1] = rgb[src + 1];
    rgba[dst + 2] = rgb[src + 2];
    rgba[dst + 3] = 1.0;
  }
  return rgba;
}

// ── ChunkRenderer ──────────────────────────────────────────────────────

export class ChunkRenderer {
  private scene: BABYLON.Scene;
  private meshes: Map<string, BABYLON.Mesh> = new Map();
  private waterMeshes: Map<string, BABYLON.Mesh> = new Map();
  private solidMaterial: BABYLON.StandardMaterial;
  private waterMaterial: BABYLON.StandardMaterial;
  private emissiveMeshes: Map<string, BABYLON.Mesh> = new Map();
  private emissiveMaterial: BABYLON.StandardMaterial;
  private pulseObserver: BABYLON.Nullable<BABYLON.Observer<BABYLON.Scene>> = null;
  private triplanarMat: BABYLON.ShaderMaterial | null = null;

  /** Enable triplanar texturing for solid terrain (Phase 9.4). */
  useTriplanar: boolean = false;

  constructor(scene: BABYLON.Scene) {
    this.scene = scene;

    // Solid terrain material — dim specular
    this.solidMaterial = new BABYLON.StandardMaterial("terrain_solid_mat", scene);
    this.solidMaterial.backFaceCulling = true;
    this.solidMaterial.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);

    // Water material — translucent, double-sided, slight sheen
    this.waterMaterial = new BABYLON.StandardMaterial("terrain_water_mat", scene);
    this.waterMaterial.alpha = 0.6;
    this.waterMaterial.backFaceCulling = false;
    this.waterMaterial.specularColor = new BABYLON.Color3(0.6, 0.6, 0.7);

    // Emissive material — for CrackedLava and other glowing surfaces
    this.emissiveMaterial = new BABYLON.StandardMaterial("terrain_emissive_mat", scene);
    this.emissiveMaterial.backFaceCulling = true;
    this.emissiveMaterial.specularColor = new BABYLON.Color3(0.2, 0.15, 0.1);
    this.emissiveMaterial.emissiveColor = new BABYLON.Color3(232 / 255, 156 / 255, 74 / 255);
    this.emissiveMaterial.zOffset = -1;

    // Pulsing emissive glow animation
    const emCol = this.emissiveMaterial.emissiveColor;
    const baseR = 232 / 255;
    const baseG = 156 / 255;
    const baseB = 74 / 255;
    this.pulseObserver = scene.onBeforeRenderObservable.add(() => {
      const elapsed = performance.now() * 0.001;
      const pulse = 0.7 + 0.3 * Math.sin(elapsed * 2.0);
      emCol.r = baseR * pulse;
      emCol.g = baseG * pulse;
      emCol.b = baseB * pulse;
    });
  }

  // ── Solid mesh ─────────────────────────────────────────────────────

  /**
   * Create or update the solid terrain mesh for a chunk.
   * Returns null if meshData has no geometry (and disposes any prior mesh).
   */
  createOrUpdateMesh(
    chunkKey: string,
    chunk: Chunk,
    meshData: ChunkMeshData,
  ): BABYLON.Mesh | null {
    const solidMat = this.useTriplanar
      ? this.getTriplanarMaterial()
      : this.solidMaterial;

    const mesh = this.applyMeshData(
      chunkKey,
      chunk,
      meshData,
      this.meshes,
      solidMat,
      `terrain_solid_${chunkKey}`,
    );

    // Build emissive overlay (CrackedLava glow)
    this.buildEmissiveOverlay(chunkKey, chunk, meshData);

    return mesh;
  }

  // ── Water mesh ─────────────────────────────────────────────────────

  /**
   * Create or update the water mesh for a chunk.
   * Returns null if meshData has no geometry (and disposes any prior mesh).
   */
  createOrUpdateWaterMesh(
    chunkKey: string,
    chunk: Chunk,
    meshData: ChunkMeshData,
  ): BABYLON.Mesh | null {
    return this.applyMeshData(
      chunkKey,
      chunk,
      meshData,
      this.waterMeshes,
      this.waterMaterial,
      `terrain_water_${chunkKey}`,
    );
  }

  // ── Disposal ───────────────────────────────────────────────────────

  /** Dispose solid, water, and emissive meshes for a single chunk. */
  disposeMesh(chunkKey: string): void {
    const solid = this.meshes.get(chunkKey);
    if (solid) {
      solid.dispose();
      this.meshes.delete(chunkKey);
    }

    const water = this.waterMeshes.get(chunkKey);
    if (water) {
      water.dispose();
      this.waterMeshes.delete(chunkKey);
    }

    const emissive = this.emissiveMeshes.get(chunkKey);
    if (emissive) {
      emissive.dispose();
      this.emissiveMeshes.delete(chunkKey);
    }
  }

  /** Dispose every managed mesh. */
  disposeAll(): void {
    for (const mesh of this.meshes.values()) {
      mesh.dispose();
    }
    this.meshes.clear();

    for (const mesh of this.waterMeshes.values()) {
      mesh.dispose();
    }
    this.waterMeshes.clear();

    for (const mesh of this.emissiveMeshes.values()) {
      mesh.dispose();
    }
    this.emissiveMeshes.clear();
  }

  /** Clean up observers and materials. */
  dispose(): void {
    this.disposeAll();
    if (this.pulseObserver) {
      this.scene.onBeforeRenderObservable.remove(this.pulseObserver);
      this.pulseObserver = null;
    }
    this.solidMaterial.dispose();
    this.waterMaterial.dispose();
    this.emissiveMaterial.dispose();
    if (this.triplanarMat) {
      this.triplanarMat.dispose();
      this.triplanarMat = null;
    }
  }

  // ── Emissive overlay ───────────────────────────────────────────────

  /**
   * Extract emissive-material triangles into a separate overlay mesh
   * for pulsing glow effects (CrackedLava).
   */
  private buildEmissiveOverlay(
    chunkKey: string,
    chunk: Chunk,
    meshData: ChunkMeshData,
  ): void {
    if (meshData.vertexCount === 0 || meshData.materialIds.length === 0) {
      const existing = this.emissiveMeshes.get(chunkKey);
      if (existing) {
        existing.dispose();
        this.emissiveMeshes.delete(chunkKey);
      }
      return;
    }

    // Collect triangles where any vertex has an emissive material
    const emissiveIdx: number[] = [];
    for (let tri = 0; tri < meshData.triangleCount; tri++) {
      const i0 = meshData.indices[tri * 3];
      const i1 = meshData.indices[tri * 3 + 1];
      const i2 = meshData.indices[tri * 3 + 2];

      if (
        MATERIAL_DEFS[meshData.materialIds[i0] as TerrainMaterial]?.isEmissive ||
        MATERIAL_DEFS[meshData.materialIds[i1] as TerrainMaterial]?.isEmissive ||
        MATERIAL_DEFS[meshData.materialIds[i2] as TerrainMaterial]?.isEmissive
      ) {
        emissiveIdx.push(i0, i1, i2);
      }
    }

    if (emissiveIdx.length === 0) {
      const existing = this.emissiveMeshes.get(chunkKey);
      if (existing) {
        existing.dispose();
        this.emissiveMeshes.delete(chunkKey);
      }
      return;
    }

    const vertexData = new BABYLON.VertexData();
    vertexData.positions = meshData.positions;
    vertexData.normals = meshData.normals;
    vertexData.indices = new Uint32Array(emissiveIdx);
    vertexData.colors = expandRGBtoRGBA(meshData.colors, meshData.vertexCount);

    let mesh = this.emissiveMeshes.get(chunkKey);
    if (mesh) {
      vertexData.applyToMesh(mesh, true);
    } else {
      mesh = new BABYLON.Mesh(`terrain_emissive_${chunkKey}`, this.scene);
      vertexData.applyToMesh(mesh, true);
      this.emissiveMeshes.set(chunkKey, mesh);
    }

    mesh.material = this.emissiveMaterial;
    mesh.useVertexColors = true;
    mesh.isPickable = false;

    const origin = chunk.worldOrigin;
    mesh.position.set(origin.x, origin.y, origin.z);
  }

  // ── Internal ───────────────────────────────────────────────────────

  /** Lazily create the triplanar ShaderMaterial. */
  private getTriplanarMaterial(): BABYLON.ShaderMaterial {
    if (!this.triplanarMat) {
      this.triplanarMat = createTriplanarMaterial(this.scene);
    }
    return this.triplanarMat;
  }

  private applyMeshData(
    chunkKey: string,
    chunk: Chunk,
    meshData: ChunkMeshData,
    map: Map<string, BABYLON.Mesh>,
    material: BABYLON.Material,
    meshName: string,
  ): BABYLON.Mesh | null {
    // No geometry — dispose existing and bail
    if (meshData.vertexCount === 0) {
      const existing = map.get(chunkKey);
      if (existing) {
        existing.dispose();
        map.delete(chunkKey);
      }
      return null;
    }

    // Build Babylon VertexData
    const vertexData = new BABYLON.VertexData();
    vertexData.positions = meshData.positions;
    vertexData.normals = meshData.normals;
    vertexData.indices = meshData.indices;
    vertexData.colors = expandRGBtoRGBA(meshData.colors, meshData.vertexCount);

    // Reuse existing mesh or create a new one
    let mesh = map.get(chunkKey);
    if (mesh) {
      vertexData.applyToMesh(mesh, true);
    } else {
      mesh = new BABYLON.Mesh(meshName, this.scene);
      vertexData.applyToMesh(mesh, true);
      map.set(chunkKey, mesh);
    }

    mesh.material = material;
    mesh.useVertexColors = true;
    mesh.isPickable = false;

    // Position at chunk world origin
    const origin = chunk.worldOrigin;
    mesh.position.set(origin.x, origin.y, origin.z);

    return mesh;
  }
}
