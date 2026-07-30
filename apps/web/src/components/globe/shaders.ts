/**
 * Custom GLSL for the planet surface, atmosphere rim and clouds.
 * Textures come from the simulation (terrain+water mask, night lights, clouds).
 */

export const surfaceVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const surfaceFragment = /* glsl */ `
  uniform sampler2D uDay;
  uniform sampler2D uNight;
  uniform vec3 uSunDir;
  uniform float uNightBoost;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  void main() {
    vec4 day = texture2D(uDay, vUv);
    vec3 night = texture2D(uNight, vUv).rgb;
    vec3 n = normalize(vNormal);
    float diffuse = dot(n, normalize(uSunDir));
    float dayAmount = smoothstep(-0.08, 0.25, diffuse);
    // terrain rgb; day.a carries the water mask for specular
    vec3 dayColor = day.rgb * (0.22 + 0.9 * max(0.0, diffuse));
    // ocean specular glint
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    vec3 halfVec = normalize(normalize(uSunDir) + viewDir);
    float spec = pow(max(dot(n, halfVec), 0.0), 42.0) * step(0.5, day.a) * dayAmount * 0.65;
    vec3 nightColor = night * uNightBoost * (1.0 - dayAmount);
    vec3 color = dayColor * dayAmount + day.rgb * 0.06 + nightColor + spec;
    gl_FragColor = vec4(color, 1.0);
  }
`;

export const atmosphereVertex = /* glsl */ `
  varying vec3 vNormal;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const atmosphereFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  varying vec3 vNormal;
  void main() {
    float rim = pow(0.72 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.5);
    gl_FragColor = vec4(uColor, 1.0) * rim * uIntensity;
  }
`;

export const cloudsVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const cloudsFragment = /* glsl */ `
  uniform sampler2D uClouds;
  uniform vec3 uSunDir;
  varying vec2 vUv;
  varying vec3 vNormal;
  void main() {
    vec4 c = texture2D(uClouds, vUv);
    float diffuse = max(0.12, dot(normalize(vNormal), normalize(uSunDir)));
    gl_FragColor = vec4(c.rgb * diffuse, c.a * 0.82);
  }
`;
