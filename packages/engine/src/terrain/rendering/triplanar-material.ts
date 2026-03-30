/**
 * Section 9.4 -- Triplanar Texturing Material
 *
 * Custom ShaderMaterial using triplanar projection for procedural
 * terrain detail. Adds subtle noise patterns based on world-space
 * UV coordinates, enhancing flat vertex colors with visual variety.
 *
 * When real texture assets are available, this shader can be upgraded
 * to sample from a Texture2DArray using per-vertex material IDs.
 */

import * as BABYLON from "@babylonjs/core";

// ── GLSL Shaders ────────────────────────────────────────────────────

const TRIPLANAR_VERT = /* glsl */ `
precision highp float;

attribute vec3 position;
attribute vec3 normal;
attribute vec4 color;

uniform mat4 worldViewProjection;
uniform mat4 world;

varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying vec3 vColor;

void main() {
    vec4 wp = world * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    vWorldNormal = normalize((world * vec4(normal, 0.0)).xyz);
    vColor = color.rgb;
    gl_Position = worldViewProjection * vec4(position, 1.0);
}
`;

const TRIPLANAR_FRAG = /* glsl */ `
precision highp float;

varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying vec3 vColor;

uniform float textureScale;
uniform float detailIntensity;

// Hash-based noise for procedural detail
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

float detail(vec2 uv) {
    float n = noise(uv) * 0.5
            + noise(uv * 2.0) * 0.25
            + noise(uv * 4.0) * 0.125;
    return 1.0 - detailIntensity + n * detailIntensity * 2.0;
}

void main() {
    // Triplanar blend weights from surface normal
    vec3 w = abs(vWorldNormal);
    w = w / (w.x + w.y + w.z + 0.0001);

    // Triplanar UV projections
    vec2 uvX = vWorldPos.yz * textureScale;
    vec2 uvY = vWorldPos.xz * textureScale;
    vec2 uvZ = vWorldPos.xy * textureScale;

    // Blended procedural detail
    float d = w.x * detail(uvX) + w.y * detail(uvY) + w.z * detail(uvZ);

    // Directional ambient: slightly darker on side faces
    float ao = 0.85 + 0.15 * max(vWorldNormal.y, 0.0);

    gl_FragColor = vec4(vColor * d * ao, 1.0);
}
`;

// ── Factory ─────────────────────────────────────────────────────────

/**
 * Create a triplanar terrain ShaderMaterial with procedural detail.
 *
 * @param textureScale  UV scaling factor (smaller = larger patterns). Default 0.25.
 * @param detailIntensity  How much procedural noise affects the color (0–1). Default 0.15.
 */
export function createTriplanarMaterial(
  scene: BABYLON.Scene,
  name: string = "terrain_triplanar_mat",
  textureScale: number = 0.25,
  detailIntensity: number = 0.15,
): BABYLON.ShaderMaterial {
  BABYLON.Effect.ShadersStore["triplanarTerrainVertexShader"] = TRIPLANAR_VERT;
  BABYLON.Effect.ShadersStore["triplanarTerrainFragmentShader"] = TRIPLANAR_FRAG;

  const mat = new BABYLON.ShaderMaterial(name, scene, "triplanarTerrain", {
    attributes: ["position", "normal", "color"],
    uniforms: ["worldViewProjection", "world", "textureScale", "detailIntensity"],
  });

  mat.backFaceCulling = true;
  mat.setFloat("textureScale", textureScale);
  mat.setFloat("detailIntensity", detailIntensity);

  return mat;
}
