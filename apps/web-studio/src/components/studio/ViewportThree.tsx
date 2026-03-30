import { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// ── Grass shaders (exact from codesandbox webgl-grass src/shaders.js) ──

const grassVertexShader = /* glsl */ `
  uniform float uTime;

  varying vec3 vPosition;
  varying vec2 vUv;
  varying vec3 vNormal;

  float wave(float waveSize, float tipDistance, float centerDistance) {
    bool isTip = (gl_VertexID + 1) % 5 == 0;
    float waveDistance = isTip ? tipDistance : centerDistance;
    return sin((uTime / 500.0) + waveSize) * waveDistance;
  }

  void main() {
    vPosition = position;
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);

    if (vPosition.y < 0.0) {
      vPosition.y = 0.0;
    } else {
      vPosition.x += wave(uv.x * 10.0, 0.3, 0.1);
    }

    gl_Position = projectionMatrix * modelViewMatrix * vec4(vPosition, 1.0);
  }
`;

const grassFragmentShader = /* glsl */ `
  uniform sampler2D uCloud;

  varying vec3 vPosition;
  varying vec2 vUv;
  varying vec3 vNormal;

  vec3 green = vec3(0.2, 0.6, 0.3);

  void main() {
    vec3 color = mix(green * 0.7, green, vPosition.y);
    color = mix(color, texture2D(uCloud, vUv).rgb, 0.4);

    float lighting = normalize(dot(vNormal, vec3(10)));
    gl_FragColor = vec4(color + lighting * 0.03, 1.0);
  }
`;

// ── Grass blade generation (exact from codesandbox Grass.js) ────────

const BLADE_WIDTH = 0.1;
const BLADE_HEIGHT = 0.8;
const BLADE_HEIGHT_VARIATION = 0.6;
const BLADE_VERTEX_COUNT = 5;
const BLADE_TIP_OFFSET = 0.1;

function interpolate(val: number, oldMin: number, oldMax: number, newMin: number, newMax: number) {
  return ((val - oldMin) * (newMax - newMin)) / (oldMax - oldMin) + newMin;
}

function computeBlade(center: number[], index: number) {
  const height = BLADE_HEIGHT + Math.random() * BLADE_HEIGHT_VARIATION;
  const vIndex = index * BLADE_VERTEX_COUNT;

  const yaw = Math.random() * Math.PI * 2;
  const yawVec = [Math.sin(yaw), 0, -Math.cos(yaw)];
  const bend = Math.random() * Math.PI * 2;
  const bendVec = [Math.sin(bend), 0, -Math.cos(bend)];

  const bl = yawVec.map((n, i) => n * (BLADE_WIDTH / 2) * 1 + center[i]);
  const br = yawVec.map((n, i) => n * (BLADE_WIDTH / 2) * -1 + center[i]);
  const tl = yawVec.map((n, i) => n * (BLADE_WIDTH / 4) * 1 + center[i]);
  const tr = yawVec.map((n, i) => n * (BLADE_WIDTH / 4) * -1 + center[i]);
  const tc = bendVec.map((n, i) => n * BLADE_TIP_OFFSET + center[i]);

  tl[1] += height / 2;
  tr[1] += height / 2;
  tc[1] += height;

  return {
    positions: [...bl, ...br, ...tr, ...tl, ...tc],
    indices: [
      vIndex, vIndex + 1, vIndex + 2,
      vIndex + 2, vIndex + 4, vIndex + 3,
      vIndex + 3, vIndex, vIndex + 2,
    ],
  };
}

function createGrassField(scene: THREE.Scene): THREE.ShaderMaterial {
  const size = 30;
  const count = 100000;

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i < count; i++) {
    const surfaceMin = (size / 2) * -1;
    const surfaceMax = size / 2;
    const radius = (size / 2) * Math.random();
    const theta = Math.random() * 2 * Math.PI;

    const x = radius * Math.cos(theta);
    const y = radius * Math.sin(theta);

    uvs.push(
      ...Array.from({ length: BLADE_VERTEX_COUNT }).flatMap(() => [
        interpolate(x, surfaceMin, surfaceMax, 0, 1),
        interpolate(y, surfaceMin, surfaceMax, 0, 1),
      ]),
    );

    const blade = computeBlade([x, 0, y], i);
    positions.push(...blade.positions);
    indices.push(...blade.indices);
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  geom.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();

  const cloudCanvas = document.createElement('canvas');
  cloudCanvas.width = 256;
  cloudCanvas.height = 256;
  const ctx = cloudCanvas.getContext('2d')!;
  for (let py = 0; py < 256; py++) {
    for (let px = 0; px < 256; px++) {
      const v = Math.floor(
        (Math.sin(px * 0.05) * Math.cos(py * 0.05) * 0.5 + 0.5) * 200 + Math.random() * 55,
      );
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(px, py, 1, 1);
    }
  }
  const cloudTexture = new THREE.CanvasTexture(cloudCanvas);
  cloudTexture.wrapS = cloudTexture.wrapT = THREE.RepeatWrapping;

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uCloud: { value: cloudTexture },
      uTime: { value: 0 },
    },
    side: THREE.DoubleSide,
    vertexShader: grassVertexShader,
    fragmentShader: grassFragmentShader,
  });

  const grassMesh = new THREE.Mesh(geom, material);
  scene.add(grassMesh);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(15, 8).rotateX(Math.PI / 2),
    material,
  );
  floor.position.y = -Number.EPSILON;
  grassMesh.add(floor);

  return material;
}

// ── Viewport ────────────────────────────────────────────────────────

export function ViewportThree() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [fps, setFps] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let disposed = false;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0.53, 0.72, 0.9);

    const camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight);
    camera.position.set(-7, 3, 7);
    camera.lookAt(0, 0, 0);

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.maxPolarAngle = Math.PI / 2.2;
    controls.maxDistance = 15;

    // Spawn the grass field
    const grassMaterial = createGrassField(scene);

    setReady(true);

    // Render loop
    let frameCount = 0;
    let fpsAccum = 0;
    let lastTime = performance.now();

    function animate(time: number) {
      if (disposed) return;

      const now = performance.now();
      frameCount++;
      fpsAccum += now - lastTime;
      lastTime = now;
      if (fpsAccum >= 500) {
        setFps(Math.round(frameCount / (fpsAccum / 1000)));
        frameCount = 0;
        fpsAccum = 0;
      }

      grassMaterial.uniforms.uTime.value = time;
      controls.update();
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);

    const resizeObs = new ResizeObserver(() => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    });
    if (containerRef.current) resizeObs.observe(containerRef.current);

    return () => {
      disposed = true;
      resizeObs.disconnect();
      renderer.dispose();
    };
  }, []);

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-black">
      <canvas ref={canvasRef} className="h-full w-full" />
      <div className="absolute bottom-2 left-2 flex gap-2">
        <span className="rounded bg-black/70 px-2 py-0.5 text-[10px] text-gray-400">
          FPS: {ready ? fps : '--'}
        </span>
        <span className="rounded bg-black/70 px-2 py-0.5 text-[10px] text-gray-400">
          Three.js
        </span>
      </div>
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <span className="text-sm text-gray-400">Loading...</span>
        </div>
      )}
    </div>
  );
}
