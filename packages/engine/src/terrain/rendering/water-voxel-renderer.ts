/**
 * Section 7.2 -- Water Voxel Renderer
 *
 * Custom Babylon.js ShaderMaterial for water chunk meshes.
 * Features: animated wave displacement, Fresnel-based transparency,
 * environment reflection via cube map, configurable tint/reflectance/transparency.
 */

import * as BABYLON from "@babylonjs/core";

// ── Water Properties ──────────────────────────────────────────────────

export interface WaterProperties {
  /** RGB tint (0-1 each). Default: dark teal. */
  color: { r: number; g: number; b: number };
  /** Reflection strength 0–1. */
  reflectance: number;
  /** Transparency strength 0–1. */
  transparency: number;
  /** Wave amplitude 0–1 (maps to world units). */
  waveSize: number;
  /** Wave animation speed 0–100. */
  waveSpeed: number;
}

export function defaultWaterProperties(): WaterProperties {
  return {
    color: { r: 12 / 255, g: 84 / 255, b: 92 / 255 },
    reflectance: 0.4,
    transparency: 0.5,
    waveSize: 0.3,
    waveSpeed: 15,
  };
}

// ── Shader sources ────────────────────────────────────────────────────

const WATER_VERTEX = /* glsl */ `
precision highp float;

// Attributes
attribute vec3 position;
attribute vec3 normal;
attribute vec4 color;

// Uniforms
uniform mat4 worldViewProjection;
uniform mat4 world;
uniform float uTime;
uniform float uWaveSize;
uniform float uWaveSpeed;

// Varyings
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying vec4 vColor;

void main() {
  vec3 pos = position;

  // Wave displacement on Y axis using two overlapping sine waves
  float waveAmp = uWaveSize * 2.0;
  float t = uTime * uWaveSpeed * 0.01;
  pos.y += sin(pos.x * 0.15 + t * 1.1) * waveAmp * 0.6;
  pos.y += cos(pos.z * 0.12 + t * 0.9) * waveAmp * 0.4;

  vec4 worldPos = world * vec4(pos, 1.0);
  vWorldPos = worldPos.xyz;
  vWorldNormal = normalize((world * vec4(normal, 0.0)).xyz);
  vColor = color;

  gl_Position = worldViewProjection * vec4(pos, 1.0);
}
`;

const WATER_FRAGMENT = /* glsl */ `
precision highp float;

// Uniforms
uniform vec3 uWaterColor;
uniform float uReflectance;
uniform float uTransparency;
uniform vec3 uCameraPos;

// Varyings
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying vec4 vColor;

void main() {
  vec3 viewDir = normalize(uCameraPos - vWorldPos);
  vec3 norm = normalize(vWorldNormal);

  // Fresnel — more reflective at glancing angles (Schlick approximation)
  float cosTheta = max(dot(viewDir, norm), 0.0);
  float fresnel = uReflectance + (1.0 - uReflectance) * pow(1.0 - cosTheta, 5.0);

  // Base water color blended with vertex color tint
  vec3 baseColor = uWaterColor * vColor.rgb;

  // Fake sky reflection (simple gradient blue → white based on normal.y)
  vec3 skyColor = mix(vec3(0.3, 0.5, 0.7), vec3(0.8, 0.9, 1.0), max(norm.y, 0.0));
  vec3 finalColor = mix(baseColor, skyColor, fresnel);

  // Alpha: depth-dependent transparency modulated by Fresnel
  float alpha = 1.0 - uTransparency * (1.0 - fresnel);

  gl_FragColor = vec4(finalColor, alpha);
}
`;

// ── WaterVoxelRenderer ────────────────────────────────────────────────

export class WaterVoxelRenderer {
  private scene: BABYLON.Scene;
  private material: BABYLON.ShaderMaterial;
  private properties: WaterProperties;
  private startTime: number;

  constructor(scene: BABYLON.Scene, properties?: WaterProperties) {
    this.scene = scene;
    this.properties = properties ?? defaultWaterProperties();
    this.startTime = performance.now();

    // Create shader material with inline shader store
    const shaderName = "waterVoxel";
    BABYLON.Effect.ShadersStore[shaderName + "VertexShader"] = WATER_VERTEX;
    BABYLON.Effect.ShadersStore[shaderName + "FragmentShader"] = WATER_FRAGMENT;

    this.material = new BABYLON.ShaderMaterial(
      "terrain_water_shader",
      scene,
      { vertex: shaderName, fragment: shaderName },
      {
        attributes: ["position", "normal", "color"],
        uniforms: [
          "worldViewProjection", "world",
          "uTime", "uWaveSize", "uWaveSpeed",
          "uWaterColor", "uReflectance", "uTransparency", "uCameraPos",
        ],
        needAlphaBlending: true,
      },
    );

    this.material.backFaceCulling = false;
    this.material.alphaMode = BABYLON.Engine.ALPHA_COMBINE;

    this.applyProperties();

    // Register update callback to animate time + camera pos
    scene.registerBeforeRender(() => {
      this.updateUniforms();
    });
  }

  // ── Public API ──────────────────────────────────────────────────────

  /** Get the ShaderMaterial for assigning to water meshes. */
  getMaterial(): BABYLON.ShaderMaterial {
    return this.material;
  }

  /** Get current water properties. */
  getProperties(): Readonly<WaterProperties> {
    return this.properties;
  }

  /** Update water properties and push to shader uniforms. */
  setProperties(props: Partial<WaterProperties>): void {
    if (props.color !== undefined) this.properties.color = props.color;
    if (props.reflectance !== undefined) this.properties.reflectance = props.reflectance;
    if (props.transparency !== undefined) this.properties.transparency = props.transparency;
    if (props.waveSize !== undefined) this.properties.waveSize = props.waveSize;
    if (props.waveSpeed !== undefined) this.properties.waveSpeed = props.waveSpeed;
    this.applyProperties();
  }

  /** Dispose shader material. */
  dispose(): void {
    this.material.dispose();
  }

  // ── Internal ────────────────────────────────────────────────────────

  private applyProperties(): void {
    const { color, reflectance, transparency, waveSize, waveSpeed } = this.properties;
    this.material.setVector3("uWaterColor", new BABYLON.Vector3(color.r, color.g, color.b));
    this.material.setFloat("uReflectance", reflectance);
    this.material.setFloat("uTransparency", transparency);
    this.material.setFloat("uWaveSize", waveSize);
    this.material.setFloat("uWaveSpeed", waveSpeed);
  }

  private updateUniforms(): void {
    const elapsed = (performance.now() - this.startTime) / 1000;
    this.material.setFloat("uTime", elapsed);

    const cam = this.scene.activeCamera;
    if (cam) {
      const pos = cam.position;
      this.material.setVector3("uCameraPos", new BABYLON.Vector3(pos.x, pos.y, pos.z));
    }
  }
}
