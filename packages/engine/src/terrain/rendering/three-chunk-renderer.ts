/**
 * Three.js Chunk Renderer
 *
 * Converts ChunkMeshData (from Marching Cubes) into Three.js meshes.
 * Uses vertex colors + triplanar-style material for terrain surfaces.
 */

import * as THREE from "three";
import type { ChunkMeshData } from "../meshing/marching-cubes.js";
import type { Chunk } from "../voxel/chunk.js";

// ── Terrain material with vertex colors ─────────────────────────────

function createTerrainMaterial(): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
    roughness: 0.85,
    metalness: 0.0,
  });
  return mat;
}

function createWaterMaterial(): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color: 0x0c545c,
    transparent: true,
    opacity: 0.6,
    side: THREE.DoubleSide,
    roughness: 0.2,
    metalness: 0.1,
  });
  return mat;
}

// ── ThreeChunkRenderer ──────────────────────────────────────────────

export class ThreeChunkRenderer {
  private scene: THREE.Scene;
  private solidMeshes: Map<string, THREE.Mesh> = new Map();
  private waterMeshes: Map<string, THREE.Mesh> = new Map();
  private solidMaterial: THREE.MeshStandardMaterial;
  private waterMaterial: THREE.MeshStandardMaterial;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.solidMaterial = createTerrainMaterial();
    this.waterMaterial = createWaterMaterial();
  }

  /** Set water material (for compatibility with ChunkManager API). */
  setWaterMaterial(_mat: any): void {
    // Using our own Three.js water material
  }

  // ── Solid mesh ─────────────────────────────────────────────────

  createOrUpdateMesh(
    chunkKey: string,
    chunk: Chunk,
    meshData: ChunkMeshData,
  ): THREE.Mesh | null {
    if (meshData.vertexCount === 0) {
      this.disposeSolid(chunkKey);
      return null;
    }

    const geom = this.buildGeometry(meshData);
    let mesh = this.solidMeshes.get(chunkKey);

    if (mesh) {
      mesh.geometry.dispose();
      mesh.geometry = geom;
    } else {
      mesh = new THREE.Mesh(geom, this.solidMaterial);
      mesh.name = `terrain_solid_${chunkKey}`;
      this.scene.add(mesh);
      this.solidMeshes.set(chunkKey, mesh);
    }

    const origin = chunk.worldOrigin;
    mesh.position.set(origin.x, origin.y, origin.z);
    return mesh;
  }

  // ── Water mesh ─────────────────────────────────────────────────

  createOrUpdateWaterMesh(
    chunkKey: string,
    chunk: Chunk,
    meshData: ChunkMeshData,
  ): THREE.Mesh | null {
    if (meshData.vertexCount === 0) {
      this.disposeWater(chunkKey);
      return null;
    }

    const geom = this.buildGeometry(meshData);
    let mesh = this.waterMeshes.get(chunkKey);

    if (mesh) {
      mesh.geometry.dispose();
      mesh.geometry = geom;
    } else {
      mesh = new THREE.Mesh(geom, this.waterMaterial);
      mesh.name = `terrain_water_${chunkKey}`;
      this.scene.add(mesh);
      this.waterMeshes.set(chunkKey, mesh);
    }

    const origin = chunk.worldOrigin;
    mesh.position.set(origin.x, origin.y, origin.z);
    return mesh;
  }

  // ── Disposal ───────────────────────────────────────────────────

  disposeMesh(chunkKey: string): void {
    this.disposeSolid(chunkKey);
    this.disposeWater(chunkKey);
  }

  disposeAll(): void {
    for (const mesh of this.solidMeshes.values()) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
    }
    this.solidMeshes.clear();

    for (const mesh of this.waterMeshes.values()) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
    }
    this.waterMeshes.clear();
  }

  dispose(): void {
    this.disposeAll();
    this.solidMaterial.dispose();
    this.waterMaterial.dispose();
  }

  // ── Internal ───────────────────────────────────────────────────

  private buildGeometry(meshData: ChunkMeshData): THREE.BufferGeometry {
    const geom = new THREE.BufferGeometry();

    geom.setAttribute("position", new THREE.BufferAttribute(meshData.positions, 3));
    geom.setAttribute("normal", new THREE.BufferAttribute(meshData.normals, 3));
    geom.setIndex(new THREE.BufferAttribute(meshData.indices, 1));

    // Expand RGB colors to vertex colors (Three.js wants RGB float)
    const colors = new Float32Array(meshData.vertexCount * 3);
    for (let i = 0; i < meshData.vertexCount; i++) {
      colors[i * 3] = meshData.colors[i * 3] ;
      colors[i * 3 + 1] = meshData.colors[i * 3 + 1];
      colors[i * 3 + 2] = meshData.colors[i * 3 + 2];
    }
    geom.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    return geom;
  }

  private disposeSolid(chunkKey: string): void {
    const mesh = this.solidMeshes.get(chunkKey);
    if (mesh) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      this.solidMeshes.delete(chunkKey);
    }
  }

  private disposeWater(chunkKey: string): void {
    const mesh = this.waterMeshes.get(chunkKey);
    if (mesh) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      this.waterMeshes.delete(chunkKey);
    }
  }
}
