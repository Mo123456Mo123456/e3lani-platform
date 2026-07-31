/** Custom GLSL for the living planet. All coloring derives from real
 *  simulation data textures — nothing painted statically. */

export const GLOBE_VERTEX = /* glsl */ `
  uniform sampler2D uElevation;
  uniform float uSeaLevel;
  uniform float uRelief;
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vPosW;
  varying float vElev;

  void main() {
    vUv = uv;
    float elev = texture2D(uElevation, uv).r;
    vElev = elev;
    float above = max(elev - uSeaLevel, 0.0);
    vec3 displaced = position + normal * above * uRelief;
    vec4 world = modelMatrix * vec4(displaced, 1.0);
    vPosW = world.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

export const GLOBE_FRAGMENT = /* glsl */ `
  precision highp float;
  uniform sampler2D uElevation;
  uniform sampler2D uBiome;
  uniform sampler2D uTemperature;
  uniform sampler2D uMoisture;
  uniform sampler2D uPollution;
  uniform sampler2D uIce;
  uniform sampler2D uRiver;
  uniform sampler2D uNightLights;
  uniform float uSeaLevel;
  uniform vec3 uSunDir;
  uniform int uLayerMode; // 0 natural, 1 biomes, 2 temperature, 3 pollution
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vPosW;
  varying float vElev;

  vec3 biomeColor(float b) {
    if (b < 0.5) return vec3(0.05, 0.16, 0.34);   // ocean
    if (b < 1.5) return vec3(0.76, 0.70, 0.50);   // coast
    if (b < 2.5) return vec3(0.42, 0.62, 0.30);   // plains
    if (b < 3.5) return vec3(0.05, 0.42, 0.20);   // rainforest
    if (b < 4.5) return vec3(0.12, 0.48, 0.24);   // temperate forest
    if (b < 5.5) return vec3(0.85, 0.72, 0.45);   // desert
    if (b < 6.5) return vec3(0.45, 0.40, 0.38);   // mountains
    if (b < 7.5) return vec3(0.62, 0.66, 0.60);   // tundra
    if (b < 8.5) return vec3(0.25, 0.42, 0.32);   // swamp
    if (b < 9.5) return vec3(0.62, 0.58, 0.34);   // steppe
    if (b < 10.5) return vec3(0.55, 0.22, 0.12);  // volcanic
    return vec3(0.88, 0.93, 0.97);                // ice
  }

  void main() {
    float biome = texture2D(uBiome, vUv).r * 11.0 + 0.5;
    float temp = texture2D(uTemperature, vUv).r * 2.0 - 1.0;
    float moist = texture2D(uMoisture, vUv).r;
    float pollution = texture2D(uPollution, vUv).r;
    float ice = texture2D(uIce, vUv).r;
    float river = texture2D(uRiver, vUv).r;
    float lights = texture2D(uNightLights, vUv).r;
    bool ocean = vElev <= uSeaLevel;

    vec3 base = biomeColor(biome);
    if (ocean) {
      float depth = clamp((uSeaLevel - vElev) * 2.4, 0.0, 1.0);
      base = mix(vec3(0.10, 0.30, 0.52), vec3(0.02, 0.09, 0.24), depth);
    } else {
      float shade = 0.85 + 0.3 * clamp((vElev - uSeaLevel) * 3.0, 0.0, 1.0);
      base *= shade;
      if (river > 0.5) base = mix(base, vec3(0.15, 0.45, 0.70), 0.65);
      base = mix(base, vec3(0.9, 0.94, 0.98), clamp(ice, 0.0, 1.0));
      base = mix(base, vec3(0.42, 0.30, 0.22), clamp(pollution * 1.4, 0.0, 0.55));
    }

    // Layer overlays recolor the surface with the selected data channel.
    if (uLayerMode == 1) {
      base = biomeColor(biome);
      if (ocean) base *= 0.55;
    } else if (uLayerMode == 2) {
      base = mix(vec3(0.05, 0.20, 0.55), vec3(0.90, 0.25, 0.10), clamp(temp * 0.5 + 0.5, 0.0, 1.0));
    } else if (uLayerMode == 3) {
      base = mix(vec3(0.05, 0.10, 0.08), vec3(0.95, 0.55, 0.10), clamp(pollution * 2.2, 0.0, 1.0));
      if (ocean) base *= 0.4;
    }

    // Day/night.
    float ndotl = dot(normalize(vNormalW), normalize(uSunDir));
    float day = smoothstep(-0.12, 0.25, ndotl);
    vec3 color = base * (0.08 + 0.95 * day);

    // Ocean specular glint.
    if (ocean && day > 0.0) {
      vec3 viewDir = normalize(cameraPosition - vPosW);
      vec3 halfVec = normalize(normalize(uSunDir) + viewDir);
      float spec = pow(max(dot(normalize(vNormalW), halfVec), 0.0), 60.0);
      color += vec3(0.35, 0.45, 0.55) * spec * day;
    }

    // City lights on the night side.
    float night = 1.0 - day;
    color += vec3(1.0, 0.80, 0.45) * lights * night * 1.6;

    gl_FragColor = vec4(color, 1.0);
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
  precision highp float;
  uniform vec3 uSunDir;
  varying vec3 vNormalW;
  varying vec3 vPosW;
  void main() {
    vec3 viewDir = normalize(cameraPosition - vPosW);
    float rim = 1.0 - abs(dot(viewDir, normalize(vNormalW)));
    float glow = pow(rim, 2.6);
    float day = clamp(dot(normalize(vNormalW), normalize(uSunDir)) * 0.5 + 0.5, 0.0, 1.0);
    vec3 color = mix(vec3(0.10, 0.25, 0.55), vec3(0.35, 0.65, 1.0), day);
    gl_FragColor = vec4(color, glow * 0.9);
  }
`;

export const CLOUD_VERTEX = /* glsl */ `
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

export const CLOUD_FRAGMENT = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform sampler2D uMoisture;
  uniform vec3 uSunDir;
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vPosW;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0; float a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.1; a *= 0.5; }
    return v;
  }

  void main() {
    // Cloud density follows real moisture data, animated by time.
    float moist = texture2D(uMoisture, vUv).r;
    vec2 drift = vec2(uTime * 0.004, uTime * 0.001);
    float n = fbm(vUv * vec2(18.0, 9.0) + drift);
    float cover = smoothstep(0.62, 0.95, n * (0.35 + moist));
    float day = clamp(dot(normalize(vNormalW), normalize(uSunDir)) * 0.5 + 0.5, 0.05, 1.0);
    gl_FragColor = vec4(vec3(0.9, 0.93, 0.97) * day, cover * 0.55);
  }
`;
