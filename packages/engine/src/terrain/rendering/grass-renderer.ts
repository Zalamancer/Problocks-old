/**
 * Section 9.1 -- Animated Grass Renderer
 *
 * Port of https://codesandbox.io/p/sandbox/webgl-grass-3rk1o6
 * Blade geometry from GrassGeometry.computeBlade(), shaders from
 * src/shaders.js. Adapted for Babylon.js chunk-based terrain.
 *
 * Key adaptation: Three.js demo uses blade-local positions (y=0 at
 * base, y=1.4 at tip). Our chunks use world-offset positions, so we
 * pass normalized blade height (0=base, 1=tip) as a varying instead
 * of relying on raw position.y.
 */

import * as BABYLON from "@babylonjs/core";
import { type Chunk } from "../voxel/chunk.js";
import { CHUNK_SIZE, VOXEL_SIZE, MC_THRESHOLD } from "../voxel/constants.js";
import { TerrainMaterial } from "../voxel/terrain-materials.js";
import { voxelIndex } from "../voxel/voxel.js";

// ── Parameters (from Grass.js) ─────────────────────────────────────

const BLADES_PER_VOXEL = 24;
const BLADE_VERTEX_COUNT = 5;

const SCALE = 2.0;
const BLADE_WIDTH = 0.1 * SCALE;
const BLADE_HEIGHT = 0.8 * SCALE;
const BLADE_HEIGHT_VARIATION = 0.6 * SCALE;
const BLADE_TIP_OFFSET = 0.1 * SCALE;

// ── Vertex shader ──────────────────────────────────────────────────
// Exact logic from demo's shaders.js, adapted:
// - color.x encodes blade height (0=base, 0.5=mid, 1.0=tip)
//   replacing gl_VertexID which isn't reliable in Babylon ShaderMaterial
// - Wind: only vertices with color.x > 0 get displaced (same as
//   demo's "if (vPosition.y < 0.0) ... else ..." check)

const GRASS_VERT = /* glsl */ `
precision highp float;

attribute vec3 position;
attribute vec2 uv;
attribute vec4 color;
attribute vec3 normal;

uniform mat4 worldViewProjection;
uniform mat4 world;
uniform float uTime;

varying float vBladeHeight;
varying vec2 vUv;
varying vec3 vNormal;

void main() {
    vUv = uv;
    vBladeHeight = color.x; // 0.0=base, 0.5=mid, 1.0=tip
    vNormal = normalize((world * vec4(normal, 0.0)).xyz);

    vec3 cpos = position;

    // Wave — exact from demo: sin((uTime / 500.0) + waveSize) * waveDistance
    // Demo uses gl_VertexID to detect tip; we use color.x
    if (color.x > 0.0) {
        float waveSize = uv.x * 10.0;
        bool isTip = color.x > 0.9;
        float tipDistance = 0.3;
        float centerDistance = 0.1;
        float waveDistance = isTip ? tipDistance : centerDistance;
        cpos.x += sin((uTime / 500.0) + waveSize) * waveDistance;
    }

    gl_Position = worldViewProjection * vec4(cpos, 1.0);
}
`;

// ── Fragment shader ────────────────────────────────────────────────
// Exact from demo's shaders.js, using vBladeHeight instead of
// vPosition.y for the green gradient (since our positions are in
// chunk-space, not blade-local space).

const GRASS_FRAG = /* glsl */ `
precision highp float;

uniform sampler2D uCloud;

varying float vBladeHeight;
varying vec2 vUv;
varying vec3 vNormal;

vec3 green = vec3(0.2, 0.6, 0.3);

void main() {
    // Demo: mix(green * 0.7, green, vPosition.y)
    // vPosition.y in demo is 0 (base) to ~1.4 (tip)
    // We use vBladeHeight which is 0.0 (base) to 1.0 (tip)
    vec3 color = mix(green * 0.7, green, vBladeHeight);

    // Demo: mix(color, texture2D(uCloud, vUv).rgb, 0.4)
    color = mix(color, texture2D(uCloud, vUv).rgb, 0.4);

    // Demo: normalize(dot(vNormal, vec3(10)))
    float lighting = dot(normalize(vNormal), normalize(vec3(10.0, 10.0, 10.0)));

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
      attributes: ["position", "uv", "color", "normal"],
      uniforms: ["worldViewProjection", "world", "uTime"],
      samplers: ["uCloud"],
    });
    this.material.backFaceCulling = false; // THREE.DoubleSide

    // Cloud texture (wrapS = wrapT = RepeatWrapping)
    try {
      const cloudTex = new BABYLON.Texture("/textures/Grass005_1K-JPG_AmbientOcclusion.jpg", scene);
      cloudTex.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
      cloudTex.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
      this.material.setTexture("uCloud", cloudTex);
    } catch { /* shader falls back gracefully */ }

    this.animObserver = scene.onBeforeRenderObservable.add(() => {
      this.material.setFloat("uTime", performance.now());
    });
  }

  // ── Per-chunk blade generation ─────────────────────────────────────
  // Exact port of GrassGeometry.computeBlade()

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

          const occBelow = occ[idx];
          const occAbove = occ[aboveIdx];
          const denom = occAbove - occBelow;
          const t = denom === 0 ? 0.5 : (MC_THRESHOLD - occBelow) / denom;
          const surfaceY = (y + t) * VOXEL_SIZE;

          for (let b = 0; b < BLADES_PER_VOXEL; b++) {
            const seed = b * 7 + 13;
            const offX = hash(x, z, b, seed) * VOXEL_SIZE;
            const offZ = hash(z, x, b, seed + 37) * VOXEL_SIZE;

            const cx = x * VOXEL_SIZE + offX;
            const cz = z * VOXEL_SIZE + offZ;

            // UV = world pos normalized to [0,1]
            const worldX = chunk.worldOrigin.x + cx;
            const worldZ = chunk.worldOrigin.z + cz;
            const u = (worldX + 128) / 256;
            const v = (worldZ + 128) / 256;

            const height = BLADE_HEIGHT + hash(x, y, z + b, seed + 99) * BLADE_HEIGHT_VARIATION;

            const yaw = hash(x, y, z + b, seed + 71) * Math.PI * 2;
            const yawX = Math.sin(yaw);
            const yawZ = -Math.cos(yaw);

            const bend = hash(x + b, y, z, seed + 53) * Math.PI * 2;
            const bendX = Math.sin(bend);
            const bendZ = -Math.cos(bend);

            // bl — base left
            positions.push(cx + yawX * (BLADE_WIDTH / 2), surfaceY, cz + yawZ * (BLADE_WIDTH / 2));
            uvs.push(u, v);
            colors.push(0, 0, 0, 0); // height=0 (base)

            // br — base right
            positions.push(cx - yawX * (BLADE_WIDTH / 2), surfaceY, cz - yawZ * (BLADE_WIDTH / 2));
            uvs.push(u, v);
            colors.push(0, 0, 0, 0); // height=0 (base)

            // tr — mid right (BLADE_WIDTH / 4, matching demo)
            positions.push(cx - yawX * (BLADE_WIDTH / 4), surfaceY + height / 2, cz - yawZ * (BLADE_WIDTH / 4));
            uvs.push(u, v);
            colors.push(0.5, 0.5, 0.5, 0.5); // height=0.5 (mid)

            // tl — mid left
            positions.push(cx + yawX * (BLADE_WIDTH / 4), surfaceY + height / 2, cz + yawZ * (BLADE_WIDTH / 4));
            uvs.push(u, v);
            colors.push(0.5, 0.5, 0.5, 0.5); // height=0.5 (mid)

            // tc — tip
            positions.push(cx + bendX * BLADE_TIP_OFFSET, surfaceY + height, cz + bendZ * BLADE_TIP_OFFSET);
            uvs.push(u, v);
            colors.push(1, 1, 1, 1); // height=1.0 (tip)

            // 3 triangles — exact same winding as demo
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

    const posF32 = new Float32Array(positions);
    const idxU32 = new Uint32Array(indices);
    const normals: number[] = [];
    BABYLON.VertexData.ComputeNormals(posF32, idxU32, normals);

    const vertexData = new BABYLON.VertexData();
    vertexData.positions = posF32;
    vertexData.indices = idxU32;
    vertexData.normals = new Float32Array(normals);
    vertexData.uvs = new Float32Array(uvs);
    vertexData.colors = new Float32Array(colors);

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
