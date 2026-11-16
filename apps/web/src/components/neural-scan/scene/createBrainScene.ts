// Escena Three.js del Neural Scan: nube de partículas, línea de escaneo, órbitas y satélite.
// No sabe nada de emociones: recibe canales (zona + color) e intensidades por frame.
import * as THREE from 'three';
import { sampleBrain } from '../brain/sampleBrain';
import { ZONE_COUNT } from '../brain/zones';

const FOV = 35;
const BASE_YAW = 0.6;
const BASE_PITCH = 0.14;
const SWAY = (20 * Math.PI) / 180; // balanceo de ±20°, sin giro completo
const SCAN_TOP = 0.85;
const SCAN_BOTTOM = -1.05;

const VERT = /* glsl */ `
uniform float uTime;
uniform float uPulse;
uniform float uScanY;
uniform float uSize;
uniform float uScale;
uniform vec3 uZoneColor[${ZONE_COUNT}];
uniform float uZoneInt[${ZONE_COUNT}];
attribute float aBright;
attribute float aZone;
attribute float aZoneW;
attribute float aSeed;
varying vec3 vColor;

void main() {
  vec3 p = position * (1.0 + uPulse * 0.04 * (0.5 + 0.5 * aSeed));
  vec4 world = modelMatrix * vec4(p, 1.0);
  vec4 mv = viewMatrix * world;
  gl_Position = projectionMatrix * mv;

  int zi = int(aZone + 0.5);
  float glow = uZoneInt[zi] * aZoneW;
  float scan = smoothstep(0.07, 0.0, abs(world.y - uScanY));
  float twinkle = 0.85 + 0.15 * sin(uTime * 2.0 + aSeed * 40.0);

  vec3 base = mix(vec3(0.05, 0.12, 0.30), vec3(0.20, 0.62, 0.95), aBright);
  float g = min(glow, 1.0);
  vColor = base * (0.10 + 0.65 * aBright * aBright) * (1.0 - 0.8 * g) * (1.0 + uPulse * 0.6) * twinkle
         + uZoneColor[zi] * glow * (1.0 + 2.2 * aBright)
         + vec3(0.45, 0.85, 1.0) * scan * 0.5;

  gl_PointSize = uSize * uScale * (1.0 + glow * 0.9 + scan * 0.6) / -mv.z;
}
`;

const FRAG = /* glsl */ `
varying vec3 vColor;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);
  gl_FragColor = vec4(vColor, a * a);
}
`;

export type BrainFrame = {
  /** Segundos de animación (balanceo, escaneo, órbitas). */
  time: number;
  /** Latido 0–1. */
  pulse: number;
  /** Intensidad por canal, en el orden de setChannels. */
  intensities: number[];
  /** false = escena estática (prefers-reduced-motion). */
  animate: boolean;
};

export type BrainScene = {
  readonly maxCount: number;
  setChannels: (channels: { zone: number; color: string }[]) => void;
  render: (frame: BrainFrame) => void;
  /** Posición en píxeles CSS del centro de una zona, con la pose actual. */
  project: (zone: number) => { x: number; y: number };
  /** Igual, con la pose de reposo (para decidir a qué lado va cada etiqueta). */
  projectRest: (zone: number) => { x: number; y: number };
  resize: (width: number, height: number) => void;
  setCount: (n: number) => void;
  dispose: () => void;
};

function ellipse(radius: number, segments = 160): THREE.BufferGeometry {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
  }
  return new THREE.BufferGeometry().setFromPoints(pts);
}

export function createBrainScene(canvas: HTMLCanvasElement, maxCount: number): BrainScene {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 50);
  camera.position.set(0, 0.02, 4.0);
  camera.lookAt(0, -0.12, 0);

  // --- Cerebro ---
  const cloud = sampleBrain(maxCount);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(cloud.position, 3));
  geometry.setAttribute('aBright', new THREE.BufferAttribute(cloud.bright, 1));
  geometry.setAttribute('aZone', new THREE.BufferAttribute(cloud.zone, 1));
  geometry.setAttribute('aZoneW', new THREE.BufferAttribute(cloud.zoneW, 1));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(cloud.seed, 1));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, -0.1, 0), 1.3);

  const zoneColors = Array.from({ length: ZONE_COUNT }, () => new THREE.Color(0, 0, 0));
  const zoneInt: number[] = new Array(ZONE_COUNT).fill(0);
  const uniforms = {
    uTime: { value: 0 },
    uPulse: { value: 0 },
    uScanY: { value: 99 },
    uSize: { value: 0.014 },
    uScale: { value: 1 },
    uZoneColor: { value: zoneColors },
    uZoneInt: { value: zoneInt },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const brain = new THREE.Points(geometry, material);
  brain.rotation.set(BASE_PITCH, BASE_YAW, 0);
  scene.add(brain);

  // --- Línea de escaneo ---
  const scanMat = new THREE.LineBasicMaterial({ color: 0x7fe9ff, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthTest: false });
  const scanRing = new THREE.LineLoop(ellipse(1.12), scanMat);
  scene.add(scanRing);

  // --- Órbitas punteadas y satélite ---
  const disposables: { dispose: () => void }[] = [geometry, material, scanRing.geometry, scanMat];
  const orbits: THREE.Line[] = [];
  const orbitDefs = [
    { r: 1.5, rx: 1.25, rz: 0.25, color: 0x3fd0ff },
    { r: 1.72, rx: 1.42, rz: -0.35, color: 0xa07bff },
  ];
  for (const o of orbitDefs) {
    const mat = new THREE.LineDashedMaterial({ color: o.color, dashSize: 0.035, gapSize: 0.05, transparent: true, opacity: 0.4, depthTest: false });
    const line = new THREE.Line(ellipse(o.r), mat);
    line.computeLineDistances();
    line.rotation.set(o.rx, 0, o.rz);
    scene.add(line);
    orbits.push(line);
    disposables.push(line.geometry, mat);
  }
  const satGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3()]);
  const satTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.25, 'rgba(160,235,255,0.8)');
    grad.addColorStop(1, 'rgba(63,208,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  const satMat = new THREE.PointsMaterial({ map: satTex, size: 0.16, transparent: true, depthTest: false, blending: THREE.AdditiveBlending });
  const satellite = new THREE.Points(satGeo, satMat);
  orbits[0].add(satellite);
  disposables.push(satGeo, satMat, satTex);

  let width = 1;
  let height = 1;
  let channelZones: number[] = [];
  const tmp = new THREE.Vector3();

  const projectWith = (zone: number): { x: number; y: number } => {
    tmp.fromArray(cloud.anchors, zone * 3).applyMatrix4(brain.matrixWorld).project(camera);
    return { x: (tmp.x * 0.5 + 0.5) * width, y: (-tmp.y * 0.5 + 0.5) * height };
  };

  return {
    maxCount,
    setChannels(channels) {
      zoneColors.forEach((c) => c.setRGB(0, 0, 0));
      zoneInt.fill(0);
      channelZones = channels.map((c) => c.zone);
      channels.forEach((c) => zoneColors[c.zone].set(c.color));
    },
    render(f) {
      const t = f.animate ? f.time : 0;
      uniforms.uTime.value = t;
      uniforms.uPulse.value = f.animate ? f.pulse : 0;
      zoneInt.fill(0);
      channelZones.forEach((z, i) => (zoneInt[z] = f.intensities[i] ?? 0));

      brain.rotation.y = BASE_YAW + (f.animate ? Math.sin(t * 0.28) * SWAY : 0);

      const scanY = SCAN_TOP + (SCAN_BOTTOM - SCAN_TOP) * ((t % 5) / 5);
      uniforms.uScanY.value = f.animate ? scanY : 99;
      scanRing.visible = f.animate;
      scanRing.position.y = scanY;
      const k = 1 - Math.abs((scanY + 0.1) / 1.0) ** 2 * 0.75; // el anillo se estrecha en los extremos
      scanRing.scale.set(Math.max(0.2, k), 1, Math.max(0.2, k));

      const a = t * 0.45 + 0.8;
      satellite.position.set(Math.cos(a) * orbitDefs[0].r, 0, Math.sin(a) * orbitDefs[0].r);
      if (f.animate) orbits[1].rotation.y = t * 0.03;

      renderer.render(scene, camera);
    },
    project(zone) {
      brain.updateMatrixWorld();
      return projectWith(zone);
    },
    projectRest(zone) {
      const y = brain.rotation.y;
      brain.rotation.y = BASE_YAW;
      brain.updateMatrixWorld(true);
      const p = projectWith(zone);
      brain.rotation.y = y;
      brain.updateMatrixWorld(true);
      return p;
    },
    resize(w, h) {
      width = Math.max(1, w);
      height = Math.max(1, h);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      // En pantallas estrechas se aleja la cámara para que quepa el cerebro con sus órbitas.
      camera.position.z = camera.aspect < 1.15 ? 4.6 / Math.max(0.55, camera.aspect) : 4.0;
      camera.updateProjectionMatrix();
      const buf = renderer.getDrawingBufferSize(new THREE.Vector2());
      uniforms.uScale.value = buf.y / (2 * Math.tan((FOV * Math.PI) / 360));
    },
    setCount(n) {
      geometry.setDrawRange(0, Math.max(1, Math.min(maxCount, Math.floor(n))));
    },
    dispose() {
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
    },
  };
}
