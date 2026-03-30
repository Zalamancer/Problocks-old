/**
 * Section 9.1 -- Animated Grass Renderer
 *
 * Port of https://codesandbox.io/p/sandbox/webgl-grass-3rk1o6
 * adapted for Babylon.js chunk-based terrain. Blade geometry from
 * GrassGeometry.computeBlade(), shaders from src/shaders.js.
 */

import * as BABYLON from "@babylonjs/core";
import { type Chunk } from "../voxel/chunk.js";
import { CHUNK_SIZE, VOXEL_SIZE, MC_THRESHOLD } from "../voxel/constants.js";
import { TerrainMaterial } from "../voxel/terrain-materials.js";
import { voxelIndex } from "../voxel/voxel.js";

// ── Parameters (from Grass.js) ─────────────────────────────────────

const BLADES_PER_VOXEL = 24;
const BLADE_VERTEX_COUNT = 5;

// Original values scaled 2x for our 4-unit voxel world
const SCALE = 2.0;
const BLADE_WIDTH = 0.1 * SCALE;
const BLADE_HEIGHT = 0.8 * SCALE;
const BLADE_HEIGHT_VARIATION = 0.6 * SCALE;
const BLADE_TIP_OFFSET = 0.1 * SCALE;

// ── Vertex shader (from src/shaders.js — ported to Babylon.js) ─────
// Original uses gl_VertexID to detect tip; we use color.x instead
// (0.0 = base, 0.5 = mid, 1.0 = tip) since Babylon ShaderMaterial
// doesn't guarantee gl_VertexID availability.

const GRASS_VERT = /* glsl */ `
precision highp float;

attribute vec3 position;
attribute vec2 uv;
attribute vec4 color;

uniform mat4 worldViewProjection;
uniform mat4 world;
uniform mat4 normalMatrix;
uniform float uTime;

varying vec3 vPosition;
varying vec2 vUv;
varying vec3 vNormal;

float wave(float waveSize, float tipDistance, float centerDistance) {
    // color.x: 0.0 = base, 0.5 = mid, 1.0 = tip
    bool isTip = color.x > 0.9;
    float waveDistance = isTip ? tipDistance : centerDistance;
    return sin((uTime / 500.0) + waveSize) * waveDistance;
}

void main() {
    vPosition = position;
    vUv = uv;
    vNormal = vec3(0.0, 1.0, 0.0);

    if (vPosition.y < 0.0) {
        vPosition.y = 0.0;
    } else if (color.x > 0.0) {
        // Only animate non-base vertices (mid + tip)
        vPosition.x += wave(uv.x * 10.0, 0.3, 0.1);
    }

    gl_Position = worldViewProjection * vec4(vPosition, 1.0);
}
`;

// ── Fragment shader (from src/shaders.js — exact port) ──────────────

const GRASS_FRAG = /* glsl */ `
precision highp float;

uniform sampler2D uCloud;
uniform float uTime;

varying vec3 vPosition;
varying vec2 vUv;
varying vec3 vNormal;

vec3 green = vec3(0.2, 0.6, 0.3);

void main() {
    vec3 color = mix(green * 0.7, green, vPosition.y);
    color = mix(color, texture2D(uCloud, vUv).rgb, 0.4);

    float lighting = normalize(dot(vNormal, vec3(10.0)));
    gl_FragColor = vec4(color + lighting * 0.03, 1.0);
}
`;

// ── Deterministic pseudo-random ─────────────────────────────────────

function hash(x: number, y: number, z: number, seed: number): number {
  let h = (seed + x * 374761393 + y * 668265263 + z * 1274126177) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  return (h & 0x7fffffff) / 0x7fffffff;
}

const GRASS_MATERIALS = new Set<number>([
  TerrainMaterial.Grass as number,
  TerrainMaterial.LeafyGrass as number,
]);

// ── GrassRenderer ───────────────────────────────────────────────────

export class GrassRenderer {
  decoration: boolean = true;
  grassLength: number = 0.5;
  windSpeed: number = 1.5;
  windStrength: number = 1.2;

  private scene: BABYLON.Scene;
  private material: BABYLON.ShaderMaterial;
  private meshes: Map<string, BABYLON.Mesh> = new Map();
  private animObserver: BABYLON.Nullable<BABYLON.Observer<BABYLON.Scene>> = null;

  constructor(scene: BABYLON.Scene) {
    this.scene = scene;

    BABYLON.Effect.ShadersStore["grassFieldVertexShader"] = GRASS_VERT;
    BABYLON.Effect.ShadersStore["grassFieldFragmentShader"] = GRASS_FRAG;

    this.material = new BABYLON.ShaderMaterial("terrain_grass_mat", scene, "grassField", {
      attributes: ["position", "uv", "color"],
      uniforms: ["worldViewProjection", "world", "normalMatrix", "uTime"],
      samplers: ["uCloud"],
    });
    // side: THREE.DoubleSide
    this.material.backFaceCulling = false;

    // Load cloud texture (wrapS = wrapT = RepeatWrapping)
    try {
      const cloudTex = new BABYLON.Texture("/textures/Grass005_1K-JPG_AmbientOcclusion.jpg", scene);
      cloudTex.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
      cloudTex.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
      this.material.setTexture("uCloud", cloudTex);
    } catch { /* procedural fallback in shader if needed */ }

    // Animation — update uTime each frame
    this.animObserver = scene.onBeforeRenderObservable.add(() => {
      this.material.setFloat("uTime", performance.now());
    });
  }

  // ── Per-chunk blade generation ─────────────────────────────────────
  // Port of GrassGeometry.computeBlade() from src/Grass.js

  updateChunk(chunkKey: string, chunk: Chunk): void {
    if (!this.decoration) {
      this.disposeChunk(chunkKey);
      return;
    }

    const occ = chunk.data.occupancy;
    const mat = chunk.data.materials;

    const positions: number[] = [];
    const uvs: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    let vtx = 0;

    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let y = 0; y < CHUNK_SIZE - 1; y++) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
          const idx = voxelIndex(x, y, z);
          if (!GRASS_MATERIALS.has(mat[idx])) continue;
          if (occ[idx] < MC_THRESHOLD) continue;

          const aboveIdx = voxelIndex(x, y + 1, z);
          if (occ[aboveIdx] >= MC_THRESHOLD) continue;

          // Surface Y via MC interpolation
          const occBelow = occ[idx];
          const occAbove = occ[aboveIdx];
          const denom = occAbove - occBelow;
          const t = denom === 0 ? 0.5 : (MC_THRESHOLD - occBelow) / denom;
          const surfaceY = (y + t) * VOXEL_SIZE;

          for (let b = 0; b < BLADES_PER_VOXEL; b++) {
            const seed = b * 7 + 13;

            // Random position within voxel
            const offX = hash(x, z, b, seed) * VOXEL_SIZE;
            const offZ = hash(z, x, b, seed + 37) * VOXEL_SIZE;

            const cx = x * VOXEL_SIZE + offX;
            const cz = z * VOXEL_SIZE + offZ;

            // UV — interpolate world pos to [0,1] (same as demo's interpolate())
            const worldX = chunk.worldOrigin.x + cx;
            const worldZ = chunk.worldOrigin.z + cz;
            const u = (worldX + 128) / 256;
            const v = (worldZ + 128) / 256;

            // computeBlade() — exact port from Grass.js
            const height = BLADE_HEIGHT + hash(x, y, z + b, seed + 99) * BLADE_HEIGHT_VARIATION;

            // yaw = random rotation
            const yaw = hash(x, y, z + b, seed + 71) * Math.PI * 2;
            const yawX = Math.sin(yaw);
            const yawZ = -Math.cos(yaw);

            // bend = random tip lean (separate from yaw)
            const bend = hash(x + b, y, z, seed + 53) * Math.PI * 2;
            const bendX = Math.sin(bend);
            const bendZ = -Math.cos(bend);

            // bl = yawVec * (BLADE_WIDTH / 2) * 1 + center
            const blX = cx + yawX * (BLADE_WIDTH / 2);
            const blZ = cz + yawZ * (BLADE_WIDTH / 2);
            positions.push(blX, surfaceY, blZ);
            uvs.push(u, v);
            colors.push(0, 0, 0, 0); // base

            // br = yawVec * (BLADE_WIDTH / 2) * -1 + center
            const brX = cx - yawX * (BLADE_WIDTH / 2);
            const brZ = cz - yawZ * (BLADE_WIDTH / 2);
            positions.push(brX, surfaceY, brZ);
            uvs.push(u, v);
            colors.push(0, 0, 0, 0); // base

            // tr = yawVec * (BLADE_WIDTH / 4) * -1 + center, y += height/2
            const trX = cx - yawX * (BLADE_WIDTH / 4);
            const trZ = cz - yawZ * (BLADE_WIDTH / 4);
            positions.push(trX, surfaceY + height / 2, trZ);
            uvs.push(u, v);
            colors.push(0.5, 0.5, 0.5, 0.5); // mid

            // tl = yawVec * (BLADE_WIDTH / 4) * 1 + center, y += height/2
            const tlX = cx + yawX * (BLADE_WIDTH / 4);
            const tlZ = cz + yawZ * (BLADE_WIDTH / 4);
            positions.push(tlX, surfaceY + height / 2, tlZ);
            uvs.push(u, v);
            colors.push(0.5, 0.5, 0.5, 0.5); // mid

            // tc = bendVec * BLADE_TIP_OFFSET + center, y += height
            const tcX = cx + bendX * BLADE_TIP_OFFSET;
            const tcZ = cz + bendZ * BLADE_TIP_OFFSET;
            positions.push(tcX, surfaceY + height, tcZ);
            uvs.push(u, v);
            colors.push(1, 1, 1, 1); // tip

            // Indices — exact same as demo
            indices.push(vtx, vtx + 1, vtx + 2);
            indices.push(vtx + 2, vtx + 4, vtx + 3);
            indices.push(vtx + 3, vtx, vtx + 2);

            vtx += BLADE_VERTEX_COUNT;
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
    vertexData.uvs = new Float32Array(uvs);
    vertexData.colors = new Float32Array(colors);
    vertexData.indices = new Uint32Array(indices);
    vertexData.normals = []; // trigger computeNormals — same as demo's computeVertexNormals()
    BABYLON.VertexData.ComputeNormals(
      vertexData.positions, vertexData.indices, vertexData.normals,
    );

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
    mesh.position.set(chunk.worldOrigin.x, chunk.worldOrigin.y, chunk.worldOrigin.z);
  }

  // ── Disposal ──────────────────────────────────────────────────────

  disposeChunk(chunkKey: string): void {
    const m = this.meshes.get(chunkKey);
    if (m) { m.dispose(); this.meshes.delete(chunkKey); }
  }

  disposeAll(): void {
    for (const m of this.meshes.values()) m.dispose();
    this.meshes.clear();
  }

  dispose(): void {
    this.disposeAll();
    if (this.animObserver) {
      this.scene.onBeforeRenderObservable.remove(this.animObserver);
      this.animObserver = null;
    }
    this.material.dispose();
  }
}
