/**
 * GLSL shaders for the planet surface and atmosphere.
 * The surface shader blends a data-driven day map with city-light night map
 * across the terminator, plus an analytical layer overlay and limb rim.
 */

export const PLANET_VERTEX = /* glsl */ `
varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vPosW;

void main() {
  vUv = uv;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vec4 world = modelMatrix * vec4(position, 1.0);
  vPosW = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const PLANET_FRAGMENT = /* glsl */ `
uniform sampler2D dayMap;
uniform sampler2D nightMap;
uniform sampler2D overlayMap;
uniform float overlayMix;
uniform vec3 sunDir;

varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vPosW;

void main() {
  vec3 day = texture2D(dayMap, vUv).rgb;
  vec3 night = texture2D(nightMap, vUv).rgb;
  vec4 overlay = texture2D(overlayMap, vUv);

  vec3 N = normalize(vNormalW);
  vec3 S = normalize(sunDir);
  float ndl = dot(N, S);
  float dayness = smoothstep(-0.12, 0.28, ndl);

  vec3 dayColor = mix(day, overlay.rgb, overlay.a * overlayMix);
  vec3 col = dayColor * (0.10 + dayness * 1.0) + night * (1.0 - dayness) * 1.6;

  // soft limb rim to sell the sphere
  vec3 V = normalize(cameraPosition - vPosW);
  float rim = pow(1.0 - max(0.0, dot(N, V)), 4.0);
  col += vec3(0.25, 0.45, 0.75) * rim * 0.35;

  gl_FragColor = vec4(col, 1.0);
}
`;

export const ATMOSPHERE_VERTEX = /* glsl */ `
varying vec3 vNormalW;
varying vec3 vPosW;

void main() {
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vec4 world = modelMatrix * vec4(position, 1.0);
  vPosW = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const ATMOSPHERE_FRAGMENT = /* glsl */ `
uniform vec3 color;
uniform float intensityScale;

varying vec3 vNormalW;
varying vec3 vPosW;

void main() {
  vec3 V = normalize(cameraPosition - vPosW);
  float intensity = pow(0.62 - dot(normalize(vNormalW), V), 2.4) * intensityScale;
  gl_FragColor = vec4(color, 1.0) * max(0.0, intensity);
}
`;
