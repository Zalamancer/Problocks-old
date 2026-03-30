/**
 * Section 9.1 -- Animated Grass Renderer
 *
 * Generates grass blades on Grass/LeafyGrass terrain surfaces with
 * wind animation via a custom ShaderMaterial. Each chunk gets its own
 * grass mesh rebuilt when the terrain is re-meshed.
 */

import * as BABYLON from "@babylonjs/core";
import { type Chunk } from "../voxel/chunk.js";
import { CHUNK_SIZE, VOXEL_SIZE, MC_THRESHOLD } from "../voxel/constants.js";
import { TerrainMaterial, MATERIAL_DEFS } from "../voxel/terrain-materials.js";
import { voxelIndex } from "../voxel/voxel.js";

// ── GLSL Shaders ────────────────────────────────────────────────────

const GRASS_VERT = /* glsl */ `
precision highp float;

attribute vec3 position;
attribute vec4 color;

uniform mat4 worldViewProjection;
uniform mat4 world;
uniform float time;
uniform float windSpeed;
uniform float windStrength;

varying vec4 vColor;
varying float vFade;

void main() {
    vec3 pos = position;
    float windFactor = color.a;

    // World position for continuous wind across chunks
    vec4 wp = world * vec4(pos, 1.0);
    float windAngle = wp.x * 0.15 + wp.z * 0.1 + time * windSpeed;
    pos.x += sin(windAngle) * windFactor * windStrength;
    pos.z += cos(windAngle * 0.7 + 1.3) * windFactor * windStrength * 0.5;

    gl_Position = worldViewProjection * vec4(pos, 1.0);
    vColor = vec4(color.rgb, 1.0);
    vFade = windFactor;
}
`;

const GRASS_FRAG = /* glsl */ `
precision highp float;

varying vec4 vColor;
varying float vFade;

void main() {
    float shade = mix(0.55, 1.15, vFade);
    gl_FragColor = vec4(vColor.rgb * shade, 1.0);
}
`;

// ── Constants ────────────────────────────────────────────────────────

const BLADES_PER_VOXEL = 4;
const VERTS_PER_BLADE = 3;
const BLADE_HALF_WIDTH = 0.15;

/** Materials that trigger grass blade generation. */
const GRASS_MATERIALS = new Set<number>([
  TerrainMaterial.Grass as number,
  TerrainMaterial.LeafyGrass as number,
]);

// ── Deterministic pseudo-random ─────────────────────────────────────

function hash(x: number, y: number, z: number, seed: number): number {
  let h = (seed + x * 374761393 + y * 668265263 + z * 1274126177) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  return (h & 0x7fffffff) / 0x7fffffff;
}

// ── GrassRenderer ───────────────────────────────────────────────────

export class GrassRenderer {
  /** Toggle grass rendering on/off. */
  decoration: boolean = true;
  /** Blade height scale (0.1–1.0). */
  grassLength: number = 0.5;
  /** Wind oscillation speed. */
  windSpeed: number = 1.5;
  /** Wind displacement magnitude. */
  windStrength: number = 1.2;

  private scene: BABYLON.Scene;
  private material: BABYLON.ShaderMaterial;
  private meshes: Map<string, BABYLON.Mesh> = new Map();
  private time: number = 0;
  private animObserver: BABYLON.Nullable<BABYLON.Observer<BABYLON.Scene>> = null;

  constructor(scene: BABYLON.Scene) {
    this.scene = scene;

    // Register shaders in the Effect store
    BABYLON.Effect.ShadersStore["grassVertexShader"] = GRASS_VERT;
    BABYLON.Effect.ShadersStore["grassFragmentShader"] = GRASS_FRAG;

    this.material = new BABYLON.ShaderMaterial("terrain_grass_mat", scene, "grass", {
      attributes: ["position", "color"],
      uniforms: ["worldViewProjection", "world", "time", "windSpeed", "windStrength"],
    });
    this.material.backFaceCulling = false;

    // Animation tick — update time uniform each frame
    this.animObserver = scene.onBeforeRenderObservable.add(() => {
      const dt = scene.getEngine().getDeltaTime() / 1000;
      this.time += dt;
      this.material.setFloat("time", this.time);
      this.material.setFloat("windSpeed", this.windSpeed);
      this.material.setFloat("windStrength", this.windStrength);
    });
  }

  // ── Per-chunk update ───────────────────────────────────────────────

  /**
   * Rebuild grass blades for a chunk after its terrain mesh is updated.
   * Scans chunk voxel data for upward-facing Grass/LeafyGrass surfaces
   * and generates triangle blades at each surface voxel.
   */
  updateChunk(chunkKey: string, chunk: Chunk): void {
    if (!this.decoration) {
      this.disposeChunk(chunkKey);
      return;
    }

    const bladeHeight = this.grassLength * VOXEL_SIZE * 0.75;
    const occ = chunk.data.occupancy;
    const mat = chunk.data.materials;

    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    let vtx = 0;

    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let y = 0; y < CHUNK_SIZE - 1; y++) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
          const idx = voxelIndex(x, y, z);
          const matId = mat[idx];

          if (!GRASS_MATERIALS.has(matId)) continue;
          if (occ[idx] < MC_THRESHOLD) continue;

          // Voxel above must be air
          const aboveIdx = voxelIndex(x, y + 1, z);
          if (occ[aboveIdx] >= MC_THRESHOLD) continue;

          // Approximate surface Y via MC interpolation
          const occBelow = occ[idx];
          const occAbove = occ[aboveIdx];
          const denom = occAbove - occBelow;
          const t = denom === 0 ? 0.5 : (MC_THRESHOLD - occBelow) / denom;
          const surfaceY = (y + t) * VOXEL_SIZE;

          // Material color (normalized)
          const def = MATERIAL_DEFS[matId as TerrainMaterial];
          const cr = def.color[0] / 255;
          const cg = def.color[1] / 255;
          const cb = def.color[2] / 255;

          // Place blades with deterministic random offsets
          for (let b = 0; b < BLADES_PER_VOXEL; b++) {
            const seed = b * 7 + 13;
            const offX = hash(x, z, b, seed) * VOXEL_SIZE;
            const offZ = hash(z, x, b, seed + 37) * VOXEL_SIZE;
            const angle = hash(x, y, z + b, seed + 71) * Math.PI * 2;

            const baseX = x * VOXEL_SIZE + offX;
            const baseZ = z * VOXEL_SIZE + offZ;

            const cosA = Math.cos(angle);
            const sinA = Math.sin(angle);

            // v0: base left
            positions.push(
              baseX - BLADE_HALF_WIDTH * cosA,
              surfaceY,
              baseZ - BLADE_HALF_WIDTH * sinA,
            );
            colors.push(cr * 0.85, cg * 0.85, cb * 0.85, 0.0);

            // v1: base right
            positions.push(
              baseX + BLADE_HALF_WIDTH * cosA,
              surfaceY,
              baseZ + BLADE_HALF_WIDTH * sinA,
            );
            colors.push(cr * 0.85, cg * 0.85, cb * 0.85, 0.0);

            // v2: tip
            positions.push(baseX, surfaceY + bladeHeight, baseZ);
            colors.push(
              Math.min(cr * 1.1, 1.0),
              Math.min(cg * 1.1, 1.0),
              Math.min(cb * 1.1, 1.0),
              1.0,
            );

            indices.push(vtx, vtx + 1, vtx + 2);
            vtx += VERTS_PER_BLADE;
          }
        }
      }
    }

    if (vtx === 0) {
      this.disposeChunk(chunkKey);
      return;
    }

    const vertexData = new BABYLON.VertexData();
    vertexData.positions = new Float32Array(positions);
    vertexData.colors = new Float32Array(colors);
    vertexData.indices = new Uint32Array(indices);

    let mesh = this.meshes.get(chunkKey);
    if (mesh) {
      vertexData.applyToMesh(mesh, true);
    } else {
      mesh = new BABYLON.Mesh(`terrain_grass_${chunkKey}`, this.scene);
      vertexData.applyToMesh(mesh, true);
      this.meshes.set(chunkKey, mesh);
    }

    mesh.material = this.material;
    mesh.isPickable = false;

    const origin = chunk.worldOrigin;
    mesh.position.set(origin.x, origin.y, origin.z);
  }

  // ── Disposal ──────────────────────────────────────────────────────

  /** Remove grass for a single chunk. */
  disposeChunk(chunkKey: string): void {
    const mesh = this.meshes.get(chunkKey);
    if (mesh) {
      mesh.dispose();
      this.meshes.delete(chunkKey);
    }
  }

  /** Remove grass for all chunks. */
  disposeAll(): void {
    for (const mesh of this.meshes.values()) {
      mesh.dispose();
    }
    this.meshes.clear();
  }

  /** Full cleanup: meshes, observer, material. */
  dispose(): void {
    this.disposeAll();
    if (this.animObserver) {
      this.scene.onBeforeRenderObservable.remove(this.animObserver);
      this.animObserver = null;
    }
    this.material.dispose();
  }
}
