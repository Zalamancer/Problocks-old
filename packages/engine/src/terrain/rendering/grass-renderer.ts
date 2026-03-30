/**
 * Section 9.1 -- Animated Grass Renderer
 *
 * 1:1 replica of https://github.com/James-Smyth/three-grass-demo
 * adapted for Babylon.js. Generates 5-vertex grass blades on
 * Grass/LeafyGrass terrain surfaces with wind animation and
 * scrolling cloud shadows via custom ShaderMaterial.
 */

import * as BABYLON from "@babylonjs/core";
import { type Chunk } from "../voxel/chunk.js";
import { CHUNK_SIZE, VOXEL_SIZE, MC_THRESHOLD } from "../voxel/constants.js";
import { TerrainMaterial, MATERIAL_DEFS } from "../voxel/terrain-materials.js";
import { voxelIndex } from "../voxel/voxel.js";

// ── Parameters (matching three-grass-demo) ─────────────────────────

const BLADE_COUNT_PER_VOXEL = 6;
const BLADE_WIDTH = 0.3;
const BLADE_HEIGHT = 1.8;
const BLADE_HEIGHT_VARIATION = 1.2;
const MID_WIDTH = BLADE_WIDTH * 0.5;
const TIP_OFFSET = 0.2;
const VERTS_PER_BLADE = 5;
const INDICES_PER_BLADE = 9; // 3 triangles

// ── GLSL Shaders (ported from three-grass-demo) ────────────────────

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

    // Wind animation — identical to three-grass-demo
    float waveSize = 10.0;
    float tipDistance = 0.3;
    float centerDistance = 0.1;

    // Use world position for continuous wind across chunks
    vec4 wp = world * vec4(position, 1.0);

    if (color.x > 0.6) {
        // Tip vertices (white): large displacement
        cpos.x += sin((iTime / 500.0) + (uv.x * waveSize)) * tipDistance;
        cpos.z += cos((iTime / 500.0) * 0.7 + (uv.y * waveSize)) * tipDistance * 0.5;
    } else if (color.x > 0.0) {
        // Mid vertices (gray): smaller displacement
        cpos.x += sin((iTime / 500.0) + (uv.x * waveSize)) * centerDistance;
        cpos.z += cos((iTime / 500.0) * 0.7 + (uv.y * waveSize)) * centerDistance * 0.5;
    }
    // Base vertices (black): no displacement

    // Scrolling cloud shadow UVs
    cloudUV.x += iTime / 20000.0;
    cloudUV.y += iTime / 10000.0;

    gl_Position = worldViewProjection * vec4(cpos, 1.0);
}
`;

const GRASS_FRAG = /* glsl */ `
precision highp float;

varying vec2 vUv;
varying vec2 cloudUV;
varying vec3 vColor;

uniform sampler2D grassTex;
uniform bool hasGrassTex;

// Procedural cloud noise (replaces cloud.jpg texture)
float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float cloudNoise(vec2 uv) {
    float n = noise(uv * 3.0) * 0.5
            + noise(uv * 6.0) * 0.25
            + noise(uv * 12.0) * 0.125;
    return n + 0.5;
}

void main() {
    vec3 color;

    if (hasGrassTex) {
        // Sample grass color texture — identical to three-grass-demo
        float contrast = 1.5;
        float brightness = 0.1;
        color = texture2D(grassTex, vUv).rgb * contrast;
        color = color + vec3(brightness);
    } else {
        // Fallback: use vertex color (material color from terrain)
        float contrast = 1.3;
        float brightness = 0.05;
        color = vColor * contrast + vec3(brightness);
    }

    // Scrolling cloud shadow — mix 40% (identical to three-grass-demo)
    vec3 cloud = vec3(cloudNoise(cloudUV * 2.0));
    color = mix(color, cloud, 0.4);

    // Darken base, brighten tips for depth
    float heightGrad = vColor.x; // 0 at base, 1 at tip
    color *= mix(0.6, 1.1, heightGrad);

    gl_FragColor = vec4(color, 1.0);
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

    // Register shaders
    BABYLON.Effect.ShadersStore["grassBladeVertexShader"] = GRASS_VERT;
    BABYLON.Effect.ShadersStore["grassBladeFragmentShader"] = GRASS_FRAG;

    this.material = new BABYLON.ShaderMaterial("terrain_grass_mat", scene, "grassBlade", {
      attributes: ["position", "uv", "color"],
      uniforms: ["worldViewProjection", "world", "iTime", "hasGrassTex"],
      samplers: ["grassTex"],
    });
    this.material.backFaceCulling = false; // DoubleSide — identical to demo

    // Try to load grass texture (uses the Grass005 color map)
    try {
      const tex = new BABYLON.Texture("/textures/Grass005_1K-JPG_Color.jpg", scene);
      this.material.setTexture("grassTex", tex);
      this.material.setInt("hasGrassTex", 1);
    } catch {
      this.material.setInt("hasGrassTex", 0);
    }

    // Animation tick — update iTime uniform each frame (identical to demo)
    this.animObserver = scene.onBeforeRenderObservable.add(() => {
      const elapsed = Date.now() - this.startTime;
      this.material.setFloat("iTime", elapsed);
    });
  }

  // ── Per-chunk update ───────────────────────────────────────────────

  /**
   * Rebuild grass blades for a chunk — uses 5-vertex blade geometry
   * identical to three-grass-demo's generateBlade().
   */
  updateChunk(chunkKey: string, chunk: Chunk): void {
    if (!this.decoration) {
      this.disposeChunk(chunkKey);
      return;
    }

    const heightScale = this.grassLength;
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

          // Voxel above must be air
          const aboveIdx = voxelIndex(x, y + 1, z);
          if (occ[aboveIdx] >= MC_THRESHOLD) continue;

          // Approximate surface Y via MC interpolation
          const occBelow = occ[idx];
          const occAbove = occ[aboveIdx];
          const denom = occAbove - occBelow;
          const t = denom === 0 ? 0.5 : (MC_THRESHOLD - occBelow) / denom;
          const surfaceY = (y + t) * VOXEL_SIZE;

          // Place blades with deterministic random offsets
          for (let b = 0; b < BLADE_COUNT_PER_VOXEL; b++) {
            const seed = b * 7 + 13;
            const offX = hash(x, z, b, seed) * VOXEL_SIZE;
            const offZ = hash(z, x, b, seed + 37) * VOXEL_SIZE;

            const baseX = x * VOXEL_SIZE + offX;
            const baseZ = z * VOXEL_SIZE + offZ;

            // UV based on world position mapped to [0,1] — identical to demo
            const worldX = chunk.worldOrigin.x + baseX;
            const worldZ = chunk.worldOrigin.z + baseZ;
            const u = (worldX + 128) / 256; // normalize to ~[0,1]
            const v = (worldZ + 128) / 256;

            // Generate 5-vertex blade — identical to demo's generateBlade()
            const height = (BLADE_HEIGHT + hash(x, y, z + b, seed + 99) * BLADE_HEIGHT_VARIATION) * heightScale;

            // Random yaw (facing direction)
            const yaw = hash(x, y, z + b, seed + 71) * Math.PI * 2;
            const yawSin = Math.sin(yaw);
            const yawCos = -Math.cos(yaw);

            // Random tip bend direction (separate from yaw)
            const tipBend = hash(x + b, y, z, seed + 53) * Math.PI * 2;
            const tipSin = Math.sin(tipBend);
            const tipCos = -Math.cos(tipBend);

            // bl: bottom-left
            const blX = baseX + yawSin * (BLADE_WIDTH / 2);
            const blZ = baseZ + yawCos * (BLADE_WIDTH / 2);
            positions.push(blX, surfaceY, blZ);
            uvs.push(u, v);
            colors.push(0, 0, 0, 0); // black = base, no wind

            // br: bottom-right
            const brX = baseX - yawSin * (BLADE_WIDTH / 2);
            const brZ = baseZ - yawCos * (BLADE_WIDTH / 2);
            positions.push(brX, surfaceY, brZ);
            uvs.push(u, v);
            colors.push(0, 0, 0, 0); // black

            // tr: top-right (mid height)
            const trX = baseX - yawSin * (MID_WIDTH / 2);
            const trZ = baseZ - yawCos * (MID_WIDTH / 2);
            positions.push(trX, surfaceY + height / 2, trZ);
            uvs.push(u, v);
            colors.push(0.5, 0.5, 0.5, 0.5); // gray = mid, partial wind

            // tl: top-left (mid height)
            const tlX = baseX + yawSin * (MID_WIDTH / 2);
            const tlZ = baseZ + yawCos * (MID_WIDTH / 2);
            positions.push(tlX, surfaceY + height / 2, tlZ);
            uvs.push(u, v);
            colors.push(0.5, 0.5, 0.5, 0.5); // gray

            // tc: tip center (full height, offset by tipBend)
            const tcX = baseX + tipSin * TIP_OFFSET;
            const tcZ = baseZ + tipCos * TIP_OFFSET;
            positions.push(tcX, surfaceY + height, tcZ);
            uvs.push(u, v);
            colors.push(1, 1, 1, 1); // white = tip, full wind

            // 3 triangles — identical winding to demo
            // Triangle 1: bl, br, tr
            indices.push(vtx, vtx + 1, vtx + 2);
            // Triangle 2: tr, tc, tl
            indices.push(vtx + 2, vtx + 4, vtx + 3);
            // Triangle 3: tl, bl, tr
            indices.push(vtx + 3, vtx, vtx + 2);

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
