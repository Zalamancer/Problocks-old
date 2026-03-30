/**
 * Section 9.1 -- Animated Grass Renderer
 *
 * 1:1 replica of https://github.com/James-Smyth/three-grass-demo
 * adapted for Babylon.js chunk-based terrain. All blade geometry,
 * shaders, and parameters match the original exactly, only scaled
 * to fit our 4-unit voxel grid.
 */

import * as BABYLON from "@babylonjs/core";
import { type Chunk } from "../voxel/chunk.js";
import { CHUNK_SIZE, VOXEL_SIZE, MC_THRESHOLD } from "../voxel/constants.js";
import { TerrainMaterial } from "../voxel/terrain-materials.js";
import { voxelIndex } from "../voxel/voxel.js";

// ── Parameters ─────────────────────────────────────────────────────
// Original demo: 100,000 blades in 30x30 area = ~111 blades/sq unit
// Our voxel = 4x4 = 16 sq units → ~1778 blades equivalent
// We use 24 per voxel as practical density (per-chunk budget)

const BLADES_PER_VOXEL = 24;
const VERTS_PER_BLADE = 5;

// Original demo values (in demo world units)
// Scaled by 2x for our world (demo field ~30 units, our chunks ~64 units)
const SCALE = 2.0;
const BLADE_WIDTH = 0.1 * SCALE;
const BLADE_HEIGHT = 0.8 * SCALE;
const BLADE_HEIGHT_VARIATION = 0.6 * SCALE;
const MID_WIDTH = BLADE_WIDTH * 0.5;
const TIP_OFFSET = 0.1 * SCALE;

// ── GLSL — vertex shader (exact port from demo's grass.vert.glsl) ──

const GRASS_VERT = /* glsl */ `
precision highp float;

attribute vec3 position;
attribute vec2 uv;
attribute vec4 color;

uniform mat4 worldViewProjection;
uniform mat4 world;
uniform float iTime;

varying vec2 vUv;
varying vec2 cloudUV;
varying vec3 vColor;

void main() {
    vUv = uv;
    cloudUV = uv;
    vColor = color.rgb;
    vec3 cpos = position;

    float waveSize = 10.0;
    float tipDistance = 0.3;
    float centerDistance = 0.1;

    if (color.x > 0.6) {
        cpos.x += sin((iTime / 500.0) + (uv.x * waveSize)) * tipDistance;
    } else if (color.x > 0.0) {
        cpos.x += sin((iTime / 500.0) + (uv.x * waveSize)) * centerDistance;
    }

    cloudUV.x += iTime / 20000.0;
    cloudUV.y += iTime / 10000.0;

    gl_Position = worldViewProjection * vec4(cpos, 1.0);
}
`;

// ── GLSL — fragment shader (exact port from demo's grass.frag.glsl) ─

const GRASS_FRAG = /* glsl */ `
precision highp float;

varying vec2 vUv;
varying vec2 cloudUV;
varying vec3 vColor;

uniform sampler2D grassTex;
uniform sampler2D cloudTex;
uniform bool hasTextures;

// Fallback procedural cloud when no cloud texture loaded
float hash2(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float noise2(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash2(i), hash2(i+vec2(1,0)), f.x),
               mix(hash2(i+vec2(0,1)), hash2(i+vec2(1,1)), f.x), f.y);
}

void main() {
    float contrast = 1.5;
    float brightness = 0.1;

    vec3 color;
    if (hasTextures) {
        color = texture2D(grassTex, vUv).rgb * contrast;
    } else {
        // Fallback: green vertex color with contrast
        color = vec3(0.42, 0.5, 0.25) * contrast;
    }
    color = color + vec3(brightness, brightness, brightness);

    // Cloud shadow mix at 40%
    vec3 cloud;
    if (hasTextures) {
        cloud = texture2D(cloudTex, cloudUV).rgb;
    } else {
        float n = noise2(cloudUV * 3.0) * 0.5 + noise2(cloudUV * 6.0) * 0.25 + 0.5;
        cloud = vec3(n);
    }
    color = mix(color, cloud, 0.4);

    gl_FragColor.rgb = color;
    gl_FragColor.a = 1.0;
}
`;

// ── Deterministic pseudo-random ─────────────────────────────────────

function hash(x: number, y: number, z: number, seed: number): number {
  let h = (seed + x * 374761393 + y * 668265263 + z * 1274126177) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  return (h & 0x7fffffff) / 0x7fffffff;
}

/** Materials that trigger grass blade generation. */
const GRASS_MATERIALS = new Set<number>([
  TerrainMaterial.Grass as number,
  TerrainMaterial.LeafyGrass as number,
]);

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
  private startTime: number = Date.now();
  private animObserver: BABYLON.Nullable<BABYLON.Observer<BABYLON.Scene>> = null;

  constructor(scene: BABYLON.Scene) {
    this.scene = scene;

    BABYLON.Effect.ShadersStore["grassBladeVertexShader"] = GRASS_VERT;
    BABYLON.Effect.ShadersStore["grassBladeFragmentShader"] = GRASS_FRAG;

    this.material = new BABYLON.ShaderMaterial("terrain_grass_mat", scene, "grassBlade", {
      attributes: ["position", "uv", "color"],
      uniforms: ["worldViewProjection", "world", "iTime", "hasTextures"],
      samplers: ["grassTex", "cloudTex"],
    });
    // DoubleSide — identical to demo: side: THREE.DoubleSide
    this.material.backFaceCulling = false;

    // Load textures
    let loaded = false;
    try {
      const grassTex = new BABYLON.Texture("/textures/Grass005_1K-JPG_Color.jpg", scene);
      this.material.setTexture("grassTex", grassTex);

      // Use AO map as cloud shadow substitute (similar grayscale noise pattern)
      const cloudTex = new BABYLON.Texture("/textures/Grass005_1K-JPG_AmbientOcclusion.jpg", scene);
      cloudTex.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
      cloudTex.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
      this.material.setTexture("cloudTex", cloudTex);

      this.material.setInt("hasTextures", 1);
      loaded = true;
    } catch { /* fallback to procedural */ }
    if (!loaded) this.material.setInt("hasTextures", 0);

    // Animation tick — update iTime each frame
    this.animObserver = scene.onBeforeRenderObservable.add(() => {
      const elapsed = Date.now() - this.startTime;
      this.material.setFloat("iTime", elapsed);
    });
  }

  // ── Per-chunk update ───────────────────────────────────────────────

  /**
   * Rebuild grass blades for a chunk.
   * Blade geometry matches demo's generateBlade() exactly.
   */
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
          const matId = mat[idx];

          if (!GRASS_MATERIALS.has(matId)) continue;
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

            // Random position within voxel — demo uses r*sqrt(random) disc
            const offX = hash(x, z, b, seed) * VOXEL_SIZE;
            const offZ = hash(z, x, b, seed + 37) * VOXEL_SIZE;

            const baseX = x * VOXEL_SIZE + offX;
            const baseZ = z * VOXEL_SIZE + offZ;

            // UV = world position normalized — identical to demo's convertRange
            const worldX = chunk.worldOrigin.x + baseX;
            const worldZ = chunk.worldOrigin.z + baseZ;
            const u = (worldX + 128) / 256;
            const v = (worldZ + 128) / 256;

            // Height with variation — identical to demo
            const height = BLADE_HEIGHT + hash(x, y, z + b, seed + 99) * BLADE_HEIGHT_VARIATION;

            // Random yaw — identical to demo
            const yaw = hash(x, y, z + b, seed + 71) * Math.PI * 2;
            const yawSin = Math.sin(yaw);
            const yawCos = -Math.cos(yaw);

            // Random tip bend — identical to demo (separate from yaw)
            const tipBend = hash(x + b, y, z, seed + 53) * Math.PI * 2;
            const tipSin = Math.sin(tipBend);
            const tipCos = -Math.cos(tipBend);

            // v0: bl (bottom-left) — demo: center + yawVec * (WIDTH/2)
            positions.push(
              baseX + yawSin * (BLADE_WIDTH / 2),
              surfaceY,
              baseZ + yawCos * (BLADE_WIDTH / 2),
            );
            uvs.push(u, v);
            colors.push(0, 0, 0, 0); // black = no wind

            // v1: br (bottom-right) — demo: center - yawVec * (WIDTH/2)
            positions.push(
              baseX - yawSin * (BLADE_WIDTH / 2),
              surfaceY,
              baseZ - yawCos * (BLADE_WIDTH / 2),
            );
            uvs.push(u, v);
            colors.push(0, 0, 0, 0); // black

            // v2: tr (top-right, mid) — demo: center - yawVec * (MID_WIDTH/2), y += height/2
            positions.push(
              baseX - yawSin * (MID_WIDTH / 2),
              surfaceY + height / 2,
              baseZ - yawCos * (MID_WIDTH / 2),
            );
            uvs.push(u, v);
            colors.push(0.5, 0.5, 0.5, 0.5); // gray = partial wind

            // v3: tl (top-left, mid) — demo: center + yawVec * (MID_WIDTH/2), y += height/2
            positions.push(
              baseX + yawSin * (MID_WIDTH / 2),
              surfaceY + height / 2,
              baseZ + yawCos * (MID_WIDTH / 2),
            );
            uvs.push(u, v);
            colors.push(0.5, 0.5, 0.5, 0.5); // gray

            // v4: tc (tip) — demo: center + tipBendVec * TIP_OFFSET, y += height
            positions.push(
              baseX + tipSin * TIP_OFFSET,
              surfaceY + height,
              baseZ + tipCos * TIP_OFFSET,
            );
            uvs.push(u, v);
            colors.push(1, 1, 1, 1); // white = full wind

            // 3 triangles — exact same winding as demo
            indices.push(vtx, vtx + 1, vtx + 2);       // bl, br, tr
            indices.push(vtx + 2, vtx + 4, vtx + 3);   // tr, tc, tl
            indices.push(vtx + 3, vtx, vtx + 2);        // tl, bl, tr

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
    vertexData.uvs = new Float32Array(uvs);
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

  disposeChunk(chunkKey: string): void {
    const mesh = this.meshes.get(chunkKey);
    if (mesh) {
      mesh.dispose();
      this.meshes.delete(chunkKey);
    }
  }

  disposeAll(): void {
    for (const mesh of this.meshes.values()) mesh.dispose();
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
