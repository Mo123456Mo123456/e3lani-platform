/** GLSL for the living planet surface, atmosphere and clouds. */

export const PLANET_VERTEX = /* glsl */ `
varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vPosW;
void main() {
  vUv = uv;
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vPosW = worldPos.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

export const PLANET_FRAGMENT = /* glsl */ `
uniform sampler2D dayMap;
uniform sampler2D nightMap;
uniform float useNight;
uniform vec3 sunDirection;
uniform float glowStrength;
varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vPosW;

void main() {
  vec2 uv = vec2(vUv.x, 1.0 - vUv.y);
  vec3 day = texture2D(dayMap, uv).rgb;
  vec3 night = texture2D(nightMap, uv).rgb;
  vec3 nrm = normalize(vNormalW);
  float diffuse = dot(nrm, normalize(sunDirection));
  float dayFactor = smoothstep(-0.08, 0.3, diffuse);
  vec3 lit = day * (0.16 + 0.95 * dayFactor);
  vec3 nightSide = night * (1.0 - dayFactor) * 1.35 * useNight;
  vec3 viewDir = normalize(cameraPosition - vPosW);
  float fresnel = pow(1.0 - max(dot(nrm, viewDir), 0.0), 3.0);
  vec3 rim = vec3(0.25, 0.55, 1.0) * fresnel * glowStrength * (0.35 + 0.65 * dayFactor);
  gl_FragColor = vec4(lit + nightSide + rim, 1.0);
}
`;

export const ATMOSPHERE_VERTEX = /* glsl */ `
varying vec3 vNormalW;
varying vec3 vPosW;
void main() {
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vPosW = worldPos.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

export const ATMOSPHERE_FRAGMENT = /* glsl */ `
uniform vec3 glowColor;
uniform float intensity;
varying vec3 vNormalW;
varying vec3 vPosW;
void main() {
  vec3 viewDir = normalize(cameraPosition - vPosW);
  float rim = pow(max(dot(normalize(vNormalW), viewDir) * -1.0 + 1.0, 0.0), 2.2);
  gl_FragColor = vec4(glowColor, 1.0) * rim * intensity;
}
`;

export const CLOUDS_VERTEX = PLANET_VERTEX;

export const CLOUDS_FRAGMENT = /* glsl */ `
uniform float time;
uniform vec3 sunDirection;
uniform float opacity;
varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vPosW;

// cheap value-noise fbm for drifting cloud bands
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p *= 2.03;
    a *= 0.55;
  }
  return v;
}

void main() {
  vec2 uv = vec2(vUv.x + time * 0.004, 1.0 - vUv.y);
  float bands = fbm(uv * vec2(9.0, 5.0) + vec2(time * 0.01, 0.0));
  float cover = smoothstep(0.52, 0.78, bands);
  vec3 nrm = normalize(vNormalW);
  float diffuse = max(dot(nrm, normalize(sunDirection)), 0.0);
  vec3 col = vec3(0.9, 0.95, 1.0) * (0.25 + 0.75 * diffuse);
  gl_FragColor = vec4(col, cover * opacity * (0.25 + 0.75 * diffuse));
}
`;

export const STORM_POINTS_VERTEX = /* glsl */ `
uniform float time;
attribute float phase;
attribute float size;
varying float vPhase;
void main() {
  vPhase = phase;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float pulse = 0.7 + 0.3 * sin(time * 2.0 + phase * 6.2831);
  gl_PointSize = size * pulse * (280.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}
`;

export const STORM_POINTS_FRAGMENT = /* glsl */ `
uniform vec3 color;
varying float vPhase;
void main() {
  vec2 c = gl_PointCoord - vec2(0.5);
  float d = length(c);
  if (d > 0.5) discard;
  float alpha = smoothstep(0.5, 0.0, d);
  gl_FragColor = vec4(color, alpha * 0.9);
}
`;
