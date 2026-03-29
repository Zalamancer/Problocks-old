/**
 * GLSL shaders for the water surface, ported from webgpu-water
 * (github.com/jeantimex/webgpu-water) approach.
 *
 * Vertex: samples heightfield texture, displaces Y, computes normals
 * Fragment: Fresnel blending between sky reflection and water color
 */

export const WATER_VERTEX_SHADER = /* glsl */ `
precision highp float;

attribute vec3 position;
attribute vec2 uv;

uniform mat4 worldViewProjection;
uniform mat4 world;
uniform sampler2D heightMap;
uniform float texelSize;

varying vec3 vWorldPos;
varying vec3 vNormal;
varying vec2 vUV;

void main() {
  vUV = uv;

  // Sample height at this vertex and 4 neighbors
  float h  = texture2D(heightMap, uv).r;
  float hR = texture2D(heightMap, uv + vec2(texelSize, 0.0)).r;
  float hL = texture2D(heightMap, uv - vec2(texelSize, 0.0)).r;
  float hU = texture2D(heightMap, uv + vec2(0.0, texelSize)).r;
  float hD = texture2D(heightMap, uv - vec2(0.0, texelSize)).r;

  // Displace vertex Y by heightfield value
  vec3 pos = position;
  pos.y = h;

  // Compute normal via cross product of tangent vectors (finite differences)
  vec3 dx = vec3(texelSize * 2.0, hR - hL, 0.0);
  vec3 dz = vec3(0.0, hU - hD, texelSize * 2.0);
  vNormal = normalize(cross(dz, dx));

  vWorldPos = (world * vec4(pos, 1.0)).xyz;
  gl_Position = worldViewProjection * vec4(pos, 1.0);
}
`;

export const WATER_FRAGMENT_SHADER = /* glsl */ `
precision highp float;

varying vec3 vWorldPos;
varying vec3 vNormal;
varying vec2 vUV;

uniform vec3 cameraPosition;
uniform vec3 waterColor;
uniform vec3 skyColor;
uniform vec3 lightDir;
uniform sampler2D reflectionSampler;
uniform vec2 resolution;

void main() {
  vec3 normal = normalize(vNormal);
  vec3 viewDir = normalize(cameraPosition - vWorldPos);

  // Fresnel — from webgpu-water: mix(0.25, 1.0, pow(1 - dot(n,v), 3))
  float fresnel = mix(0.25, 1.0, pow(1.0 - max(dot(normal, viewDir), 0.0), 3.0));

  // Reflection — sample mirror texture with normal perturbation
  vec2 screenUV = gl_FragCoord.xy / resolution;
  screenUV.y = 1.0 - screenUV.y;
  vec2 perturbedUV = clamp(screenUV + normal.xz * 0.04, 0.0, 1.0);
  vec3 reflectedColor = texture2D(reflectionSampler, perturbedUV).rgb;

  // Sun specular highlight
  vec3 sunDir = normalize(lightDir);
  vec3 reflectDir = reflect(-viewDir, normal);
  float sunSpec = pow(max(dot(sunDir, reflectDir), 0.0), 256.0);
  reflectedColor += vec3(sunSpec) * vec3(1.0, 0.95, 0.8);

  // Refraction — water tint (simple depth approximation)
  vec3 refractedColor = waterColor * 0.35;

  // Fresnel blend between refraction and reflection
  vec3 finalColor = mix(refractedColor, reflectedColor, fresnel);

  gl_FragColor = vec4(finalColor, 0.9);
}
`;
