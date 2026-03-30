/**
 * Section 9.4 -- Triplanar Texturing Material
 *
 * Custom ShaderMaterial using triplanar projection for terrain surfaces.
 * Samples color, normal, roughness, and AO textures using world-space
 * UV coordinates projected along each axis, blended by surface normal.
 *
 * Falls back to procedural noise detail when no textures are provided.
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
uniform float textureMix;
uniform sampler2D colorTex;
uniform sampler2D normalTex;
uniform sampler2D roughnessTex;
uniform sampler2D aoTex;
uniform bool hasTextures;

// Simple directional light
vec3 lightDir = normalize(vec3(-1.0, 2.0, 1.0));

void main() {
    // Triplanar blend weights from surface normal
    vec3 w = abs(vWorldNormal);
    w = pow(w, vec3(4.0)); // sharpen blend to reduce stretching
    w = w / (w.x + w.y + w.z + 0.0001);

    // Triplanar UV projections
    vec2 uvX = vWorldPos.yz * textureScale;
    vec2 uvY = vWorldPos.xz * textureScale;
    vec2 uvZ = vWorldPos.xy * textureScale;

    vec3 finalColor;

    if (hasTextures) {
        // Sample color texture triplanarly
        vec3 colX = texture2D(colorTex, uvX).rgb;
        vec3 colY = texture2D(colorTex, uvY).rgb;
        vec3 colZ = texture2D(colorTex, uvZ).rgb;
        vec3 texColor = w.x * colX + w.y * colY + w.z * colZ;

        // Sample AO texture triplanarly
        float aoX = texture2D(aoTex, uvX).r;
        float aoY = texture2D(aoTex, uvY).r;
        float aoZ = texture2D(aoTex, uvZ).r;
        float ao = w.x * aoX + w.y * aoY + w.z * aoZ;

        // Sample normal map triplanarly for lighting detail
        vec3 nX = texture2D(normalTex, uvX).rgb * 2.0 - 1.0;
        vec3 nY = texture2D(normalTex, uvY).rgb * 2.0 - 1.0;
        vec3 nZ = texture2D(normalTex, uvZ).rgb * 2.0 - 1.0;
        // Swizzle normal map axes for each projection
        vec3 detailNormal = normalize(
            w.x * vec3(nX.z, nX.y, nX.x) +
            w.y * vec3(nY.x, nY.z, nY.y) +
            w.z * vec3(nZ.x, nZ.y, nZ.z)
        );
        // Blend detail normal with surface normal
        vec3 N = normalize(vWorldNormal + detailNormal * 0.4);

        // Basic diffuse lighting
        float NdotL = max(dot(N, lightDir), 0.0);
        float diffuse = 0.4 + 0.6 * NdotL;

        // Mix texture color with vertex color
        vec3 blended = mix(vColor, texColor, textureMix);
        finalColor = blended * diffuse * mix(1.0, ao, 0.5);
    } else {
        // Fallback: directional ambient only
        float ao = 0.85 + 0.15 * max(vWorldNormal.y, 0.0);
        float NdotL = max(dot(vWorldNormal, lightDir), 0.0);
        finalColor = vColor * (0.4 + 0.6 * NdotL) * ao;
    }

    gl_FragColor = vec4(finalColor, 1.0);
}
`;

// ── Factory ─────────────────────────────────────────────────────────

export interface TriplanarTextureOptions {
  colorPath?: string;
  normalPath?: string;
  roughnessPath?: string;
  aoPath?: string;
}

/**
 * Create a triplanar terrain ShaderMaterial.
 *
 * @param textureScale  UV scaling factor (smaller = larger patterns). Default 0.08.
 * @param textureMix    How much texture blends with vertex color (0–1). Default 0.6.
 * @param textures      Optional paths to PBR texture files.
 */
export function createTriplanarMaterial(
  scene: BABYLON.Scene,
  name: string = "terrain_triplanar_mat",
  textureScale: number = 0.08,
  textureMix: number = 0.6,
  textures?: TriplanarTextureOptions,
): BABYLON.ShaderMaterial {
  BABYLON.Effect.ShadersStore["triplanarTerrainVertexShader"] = TRIPLANAR_VERT;
  BABYLON.Effect.ShadersStore["triplanarTerrainFragmentShader"] = TRIPLANAR_FRAG;

  const samplers: string[] = [];
  if (textures) {
    samplers.push("colorTex", "normalTex", "roughnessTex", "aoTex");
  }

  const mat = new BABYLON.ShaderMaterial(name, scene, "triplanarTerrain", {
    attributes: ["position", "normal", "color"],
    uniforms: [
      "worldViewProjection", "world",
      "textureScale", "textureMix", "hasTextures",
    ],
    samplers,
  });

  mat.backFaceCulling = false;
  mat.setFloat("textureScale", textureScale);
  mat.setFloat("textureMix", textureMix);

  if (textures) {
    mat.setInt("hasTextures", 1);

    if (textures.colorPath) {
      const colorTex = new BABYLON.Texture(textures.colorPath, scene);
      colorTex.uScale = 1;
      colorTex.vScale = 1;
      mat.setTexture("colorTex", colorTex);
    }
    if (textures.normalPath) {
      const normalTex = new BABYLON.Texture(textures.normalPath, scene);
      mat.setTexture("normalTex", normalTex);
    }
    if (textures.roughnessPath) {
      const roughTex = new BABYLON.Texture(textures.roughnessPath, scene);
      mat.setTexture("roughnessTex", roughTex);
    }
    if (textures.aoPath) {
      const aoTex = new BABYLON.Texture(textures.aoPath, scene);
      mat.setTexture("aoTex", aoTex);
    }
  } else {
    mat.setInt("hasTextures", 0);
  }

  return mat;
}
