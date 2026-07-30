import { useEffect, useMemo, useRef } from "react";
import type { CSSProperties } from "react";
import * as THREE from "three";

import type { Region, WorldEvent } from "@/packages/simulation-models/src";

interface PlanetGlobeProps {
  seed: number;
  regions: Region[];
  events: WorldEvent[];
  selectedRegionId: string;
  pollution: number;
  onSelectRegion: (regionId: string) => void;
}

interface SceneState {
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
  scene: THREE.Scene;
  group: THREE.Group;
  globe: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  markers: THREE.Group;
  texture: THREE.CanvasTexture | null;
  frameId: number;
  resizeObserver: ResizeObserver;
}

const biomeColors: Record<Region["biome"], [number, number, number]> = {
  ocean: [7, 53, 83],
  coast: [31, 126, 127],
  plains: [86, 125, 62],
  rainforest: [20, 91, 48],
  temperate_forest: [35, 104, 61],
  desert: [172, 131, 72],
  mountain: [91, 91, 83],
  tundra: [128, 144, 132],
  wetland: [46, 110, 91],
  steppe: [133, 124, 70],
  volcanic: [91, 49, 37],
  ice: [198, 228, 235],
};

const markerColors: Partial<Record<WorldEvent["kind"], number>> = {
  WAR_STARTED: 0xff4f55,
  VOLCANO_ERUPTED: 0xff7a2f,
  MIGRATION_STARTED: 0xb668ff,
  CIVILIZATION_FOUNDED: 0xe5b84b,
  TECHNOLOGY_DISCOVERED: 0x43d9ff,
  CLIMATE_CHANGED: 0x70d8ff,
  CONTRIBUTION_INTRODUCED: 0x46e6bf,
  CONTRIBUTION_SPREAD: 0x7bf273,
  RESOURCE_DISCOVERED: 0xe7be61,
};

function regionVector(region: Region, radius = 1) {
  const latitude = THREE.MathUtils.degToRad(region.latitude);
  const longitude = THREE.MathUtils.degToRad(region.longitude);
  return new THREE.Vector3(
    Math.cos(latitude) * Math.cos(longitude) * radius,
    Math.sin(latitude) * radius,
    Math.cos(latitude) * Math.sin(longitude) * radius,
  );
}

function surfaceTexture(regions: Region[], seed: number) {
  const canvas = document.createElement("canvas");
  canvas.width = 320;
  canvas.height = 160;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) return canvas;
  const image = context.createImageData(canvas.width, canvas.height);
  const vectors = regions.map((region) => ({
    region,
    vector: regionVector(region),
  }));
  let offset = 0;
  for (let y = 0; y < canvas.height; y += 1) {
    const latitude = Math.PI / 2 - (y / (canvas.height - 1)) * Math.PI;
    const cosLatitude = Math.cos(latitude);
    const sinLatitude = Math.sin(latitude);
    for (let x = 0; x < canvas.width; x += 1) {
      const longitude = (x / canvas.width) * Math.PI * 2 - Math.PI;
      const px = cosLatitude * Math.cos(longitude);
      const py = sinLatitude;
      const pz = cosLatitude * Math.sin(longitude);
      let nearest = vectors[0];
      let nearestDot = -2;
      for (const entry of vectors) {
        const dot = px * entry.vector.x + py * entry.vector.y + pz * entry.vector.z;
        if (dot > nearestDot) {
          nearestDot = dot;
          nearest = entry;
        }
      }
      const base = biomeColors[nearest.region.biome];
      const grain =
        (((x * 19 + y * 31 + seed * 7) ^ ((x + seed) * (y + 11))) & 15) / 15 - 0.5;
      const elevationShade = nearest.region.elevation * 18;
      image.data[offset] = Math.max(0, Math.min(255, base[0] + elevationShade + grain * 7));
      image.data[offset + 1] = Math.max(0, Math.min(255, base[1] + elevationShade + grain * 9));
      image.data[offset + 2] = Math.max(0, Math.min(255, base[2] + elevationShade + grain * 12));
      image.data[offset + 3] = 255;
      offset += 4;
    }
  }
  context.putImageData(image, 0, 0);
  return canvas;
}

const globeVertexShader = `
  varying vec2 vUv;
  varying vec3 vNormalWorld;
  void main() {
    vUv = uv;
    vNormalWorld = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const globeFragmentShader = `
  uniform sampler2D uSurface;
  uniform float uTime;
  uniform float uPollution;
  varying vec2 vUv;
  varying vec3 vNormalWorld;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    vec3 surface = texture2D(uSurface, vUv).rgb;
    vec3 sunDirection = normalize(vec3(-0.65, 0.28, 0.72));
    float diffuse = dot(normalize(vNormalWorld), sunDirection);
    float daylight = smoothstep(-0.18, 0.36, diffuse);
    float ocean = smoothstep(surface.r * 1.28, surface.b, 0.15);
    float wave = sin(vUv.y * 170.0 + uTime * 0.8) * sin(vUv.x * 260.0 - uTime) * 0.018;
    vec3 dayColor = surface * (0.42 + max(0.0, diffuse) * 0.9);
    dayColor += ocean * vec3(0.02, 0.13, 0.2) * (0.45 + wave);
    float cityPattern = step(0.91, hash(floor(vUv * vec2(390.0, 190.0))));
    float city = cityPattern * (1.0 - ocean) * (1.0 - daylight);
    vec3 nightColor = surface * 0.105 + city * vec3(1.0, 0.56, 0.16) * 1.7;
    vec3 color = mix(nightColor, dayColor, daylight);
    color = mix(color, vec3(0.32, 0.29, 0.24), uPollution * 0.24);
    float rim = pow(1.0 - max(0.0, dot(normalize(vNormalWorld), vec3(0.0, 0.0, 1.0))), 3.0);
    color += vec3(0.03, 0.2, 0.34) * rim;
    gl_FragColor = vec4(color, 1.0);
  }
`;

const cloudVertexShader = `
  varying vec2 vUv;
  varying vec3 vNormalWorld;
  void main() {
    vUv = uv;
    vNormalWorld = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const cloudFragmentShader = `
  uniform float uTime;
  uniform float uSeed;
  varying vec2 vUv;
  varying vec3 vNormalWorld;
  float noise(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233)) + uSeed) * 43758.5453);
  }
  void main() {
    vec2 cell = floor((vUv + vec2(uTime * 0.0018, 0.0)) * vec2(110.0, 48.0));
    float a = noise(cell);
    float b = noise(floor(cell * 0.43));
    float bands = sin(vUv.y * 48.0 + sin(vUv.x * 18.0) * 2.2) * 0.12;
    float cloud = smoothstep(0.62, 0.82, a * 0.56 + b * 0.44 + bands);
    float light = 0.35 + max(0.0, dot(vNormalWorld, normalize(vec3(-0.65, 0.28, 0.72)))) * 0.75;
    gl_FragColor = vec4(vec3(0.72, 0.86, 0.94) * light, cloud * 0.45);
  }
`;

const containerStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  minHeight: 300,
  overflow: "hidden",
  position: "relative",
  cursor: "grab",
  touchAction: "none",
};

export default function PlanetGlobe({
  seed,
  regions,
  events,
  selectedRegionId,
  pollution,
  onSelectRegion,
}: PlanetGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SceneState | null>(null);
  const regionsRef = useRef(regions);
  const selectRef = useRef(onSelectRegion);
  regionsRef.current = regions;
  selectRef.current = onSelectRegion;
  const surfaceKey = useMemo(
    () => `${seed}:${regions.map((region) => `${region.id}:${region.biome}:${region.elevation}`).join("|")}`,
    [regions, seed],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 0.08, 3.05);
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    const group = new THREE.Group();
    group.rotation.set(-0.12, 0.28, 0);
    scene.add(group);

    const globeMaterial = new THREE.ShaderMaterial({
      vertexShader: globeVertexShader,
      fragmentShader: globeFragmentShader,
      uniforms: {
        uSurface: { value: new THREE.Texture() },
        uTime: { value: 0 },
        uPollution: { value: pollution },
      },
    });
    const globe = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), globeMaterial);
    group.add(globe);

    const clouds = new THREE.Mesh(
      new THREE.SphereGeometry(1.018, 72, 48),
      new THREE.ShaderMaterial({
        vertexShader: cloudVertexShader,
        fragmentShader: cloudFragmentShader,
        uniforms: { uTime: { value: 0 }, uSeed: { value: seed % 10_000 } },
        transparent: true,
        depthWrite: false,
      }),
    );
    group.add(clouds);

    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(1.075, 64, 48),
      new THREE.ShaderMaterial({
        vertexShader: `
          varying vec3 vNormal;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          varying vec3 vNormal;
          void main() {
            float intensity = pow(0.72 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.2);
            gl_FragColor = vec4(0.05, 0.58, 0.94, intensity * 0.72);
          }
        `,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      }),
    );
    group.add(atmosphere);

    const markers = new THREE.Group();
    group.add(markers);

    const starCount = 720;
    const starPositions = new Float32Array(starCount * 3);
    for (let index = 0; index < starCount; index += 1) {
      const radius = 8 + ((index * 37 + seed) % 100) / 20;
      const theta = ((index * 0.61803398875 + seed * 0.00001) % 1) * Math.PI * 2;
      const phi = Math.acos(2 * (((index * 73 + seed) % 997) / 997) - 1);
      starPositions[index * 3] = radius * Math.sin(phi) * Math.cos(theta);
      starPositions[index * 3 + 1] = radius * Math.cos(phi);
      starPositions[index * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    }
    const starsGeometry = new THREE.BufferGeometry();
    starsGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    scene.add(
      new THREE.Points(
        starsGeometry,
        new THREE.PointsMaterial({ color: 0x87cfff, size: 0.018, transparent: true, opacity: 0.62 }),
      ),
    );

    let dragging = false;
    let moved = 0;
    let previousX = 0;
    let previousY = 0;
    const onPointerDown = (event: PointerEvent) => {
      dragging = true;
      moved = 0;
      previousX = event.clientX;
      previousY = event.clientY;
      renderer.domElement.setPointerCapture(event.pointerId);
      container.style.cursor = "grabbing";
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      const dx = event.clientX - previousX;
      const dy = event.clientY - previousY;
      moved += Math.abs(dx) + Math.abs(dy);
      group.rotation.y += dx * 0.006;
      group.rotation.x = clampRotation(group.rotation.x + dy * 0.0045);
      previousX = event.clientX;
      previousY = event.clientY;
    };
    const onPointerUp = (event: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      container.style.cursor = "grab";
      if (moved < 7) {
        const rect = renderer.domElement.getBoundingClientRect();
        const pointer = new THREE.Vector2(
          ((event.clientX - rect.left) / rect.width) * 2 - 1,
          -((event.clientY - rect.top) / rect.height) * 2 + 1,
        );
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(pointer, camera);
        const hit = raycaster.intersectObject(globe, false)[0];
        if (hit) {
          const local = group.worldToLocal(hit.point.clone()).normalize();
          let nearestId = regionsRef.current[0]?.id;
          let nearestDot = -2;
          for (const region of regionsRef.current) {
            const dot = local.dot(regionVector(region));
            if (dot > nearestDot) {
              nearestDot = dot;
              nearestId = region.id;
            }
          }
          if (nearestId) selectRef.current(nearestId);
        }
      }
    };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      camera.position.z = THREE.MathUtils.clamp(camera.position.z + event.deltaY * 0.0018, 2.18, 4.25);
    };
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("pointercancel", onPointerUp);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });

    const resize = () => {
      const width = Math.max(1, container.clientWidth);
      const height = Math.max(1, container.clientHeight);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    resize();

    const clock = new THREE.Clock();
    const render = () => {
      const elapsed = clock.getElapsedTime();
      globeMaterial.uniforms.uTime.value = elapsed;
      (clouds.material as THREE.ShaderMaterial).uniforms.uTime.value = elapsed;
      if (!dragging) group.rotation.y += 0.00065;
      renderer.render(scene, camera);
      const current = sceneRef.current;
      if (current) current.frameId = requestAnimationFrame(render);
    };

    sceneRef.current = {
      renderer,
      camera,
      scene,
      group,
      globe,
      markers,
      texture: null,
      frameId: requestAnimationFrame(render),
      resizeObserver,
    };

    return () => {
      const current = sceneRef.current;
      if (current) cancelAnimationFrame(current.frameId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("pointercancel", onPointerUp);
      renderer.domElement.removeEventListener("wheel", onWheel);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Points) {
          object.geometry.dispose();
          if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
          else object.material.dispose();
        }
      });
      sceneRef.current?.texture?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      sceneRef.current = null;
    };
  }, [seed]);

  useEffect(() => {
    const current = sceneRef.current;
    if (!current) return;
    const texture = new THREE.CanvasTexture(surfaceTexture(regionsRef.current, seed));
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.anisotropy = Math.min(8, current.renderer.capabilities.getMaxAnisotropy());
    current.texture?.dispose();
    current.texture = texture;
    current.globe.material.uniforms.uSurface.value = texture;
    current.globe.material.needsUpdate = true;
  }, [seed, surfaceKey]);

  useEffect(() => {
    const current = sceneRef.current;
    if (!current) return;
    current.globe.material.uniforms.uPollution.value = pollution;
    current.markers.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
      else object.material.dispose();
    });
    current.markers.clear();
    const regionById = new Map(regions.map((region) => [region.id, region]));
    const visibleEvents = events.slice(0, 14);
    for (const event of visibleEvents) {
      const region = regionById.get(event.regionId);
      if (!region) continue;
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(event.regionId === selectedRegionId ? 0.026 : 0.016, 10, 10),
        new THREE.MeshBasicMaterial({
          color: markerColors[event.kind] ?? 0x48cfff,
          transparent: true,
          opacity: 0.94,
        }),
      );
      marker.position.copy(regionVector(region, 1.035));
      current.markers.add(marker);
    }
    const selectedRegion = regionById.get(selectedRegionId);
    if (selectedRegion) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.044, 0.004, 8, 28),
        new THREE.MeshBasicMaterial({ color: 0x6ee7ff, transparent: true, opacity: 0.92 }),
      );
      const normal = regionVector(selectedRegion).normalize();
      ring.position.copy(normal.clone().multiplyScalar(1.042));
      ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
      current.markers.add(ring);
    }
  }, [events, pollution, regions, selectedRegionId]);

  return (
    <div
      ref={containerRef}
      style={containerStyle}
      role="img"
      aria-label="كوكب إجرائي ثلاثي الأبعاد؛ اسحب للتدوير ومرر للتكبير وانقر لاختيار إقليم"
    />
  );
}

function clampRotation(value: number) {
  return THREE.MathUtils.clamp(value, -1.15, 1.15);
}
