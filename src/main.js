import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { vertexShader, fragmentShader } from './shaders.js';

gsap.registerPlugin(ScrollTrigger);

// ---------------------------------------------------------------------------
// Config: reemplaza estos JPG por tus fotos reales de Barrio Abajo.
// Mantén nombres y aspecto 16/9, `object-fit` lo resuelve el shader (cover).
// ---------------------------------------------------------------------------
const ERAS = [
  { year: '1880', file: '/img/barrio-abajo-1880.jpg', sepia: 0.85, label: '1880' },
  { year: '1920', file: '/img/barrio-abajo-1920.jpg', sepia: 0.65, label: '1920' },
  { year: '1960', file: '/img/barrio-abajo-1960.jpg', sepia: 0.35, label: '1960' },
  { year: '1990', file: '/img/barrio-abajo-1990.jpg', sepia: 0.12, label: '1990' },
  { year: '2026', file: '/img/barrio-abajo-2026.jpg', sepia: 0.0, label: '2026' },
];

const container = document.getElementById('canvas-container');
const hudEra = document.getElementById('hud-era');
const hudYear = document.getElementById('hud-year');
const progressFill = document.getElementById('progress-fill');
const dotsBox = document.getElementById('dots');
const stripInner = document.getElementById('filmstrip-inner');

// Dots + filmstrip -----------------------------------------------
ERAS.forEach((era, i) => {
  const b = document.createElement('button');
  b.textContent = era.label;
  b.addEventListener('click', () => {
    const y = document.querySelectorAll('.era')[i].offsetTop + window.innerHeight * 0.4;
    window.scrollTo({ top: y, behavior: 'smooth' });
  });
  dotsBox.appendChild(b);

  const img = document.createElement('img');
  img.src = era.file;
  img.alt = `Miniatura ${era.year}`;
  stripInner.appendChild(img);
});
const dotBtns = [...dotsBox.querySelectorAll('button')];

// Escena Three.js ------------------------------------------------
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  document.getElementById('fallback').hidden = false;
  throw e;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 20);
camera.position.z = 3.2;

// Plano 16:9 con segmentos para el relieve 3D (vertex warp)
const geometry = new THREE.PlaneGeometry(7.2, 4.05, 48, 27);
const loader = new THREE.TextureLoader();
loader.setCrossOrigin('anonymous');

function loadTex(url) {
  return new Promise((resolve) => {
    loader.load(url, (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      // Cover: recorta como object-fit:cover según aspecto de pantalla
      const screenAsp = window.innerWidth / window.innerHeight;
      const imgAsp = t.image.width / t.image.height;
      if (imgAsp > screenAsp) {
        const w = screenAsp / imgAsp;
        t.wrapS = THREE.ClampToEdgeWrapping;
        t.repeat.x = w; t.offset.x = (1 - w) / 2;
      } else {
        const h = imgAsp / screenAsp;
        t.repeat.y = h; t.offset.y = (1 - h) / 2;
      }
      resolve(t);
    }, undefined, () => resolve(null));
  });
}

// Textura 1x1 de fallback (si aún no hay JPGs reales)
function placeholderTex(hex) {
  const c = document.createElement('canvas');
  c.width = 16; c.height = 9;
  const g = c.getContext('2d');
  g.fillStyle = hex; g.fillRect(0, 0, 16, 9);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const material = new THREE.ShaderMaterial({
  vertexShader,
  fragmentShader,
  uniforms: {
    uTex1: { value: placeholderTex('#2b2118') },
    uTex2: { value: placeholderTex('#1a2b33') },
    uProgress: { value: 0 },
    uIntensity: { value: 0.35 },
    uNoiseScale: { value: 4.0 },
    uEdgeWidth: { value: 0.12 },
    uSepia1: { value: ERAS[0].sepia },
    uSepia2: { value: ERAS[1].sepia },
    uDissolveAmp: { value: 0.035 },
  },
});
scene.add(new THREE.Mesh(geometry, material));

const textures = new Array(ERAS.length);
for (let i = 0; i < ERAS.length; i++) textures[i] = placeholderTex(['#3a2c1c', '#33424a', '#4a3330', '#2c3a2e', '#1f2c44'][i % 5]);
material.uniforms.uTex1.value = textures[0];
material.uniforms.uTex2.value = textures[1];
// Carga progresiva: a medida que llega cada JPG real, sustituye el placeholder
ERAS.forEach((era, i) => {
  loadTex(era.file).then((t) => {
    if (!t) return;
    textures[i] = t;
    applyState();
  });
});

// Estado global de scroll ----------------------------------------
const state = { global: 0, pairIndex: 0, pairFract: 0 };
const N = ERAS.length;

function applyState() {
  const g = THREE.MathUtils.clamp(state.global, 0, N - 1);
  const idx = Math.min(Math.floor(g), N - 2);
  const fract = g - Math.floor(g);
  // Última era: fract llega a 1 dentro del último par
  const lastPair = g >= N - 1;
  state.pairIndex = lastPair ? N - 2 : idx;
  state.pairFract = lastPair ? 1 : (idx === Math.floor(g) ? fract : fract);

  const a = state.pairIndex;
  const b = Math.min(a + 1, N - 1);
  if (material.uniforms.uTex1.value !== textures[a]) material.uniforms.uTex1.value = textures[a];
  if (material.uniforms.uTex2.value !== textures[b]) material.uniforms.uTex2.value = textures[b];
  material.uniforms.uProgress.value = state.pairFract;
  material.uniforms.uSepia1.value = ERAS[a].sepia;
  material.uniforms.uSepia2.value = ERAS[b].sepia;

  // HUD: año interpolado + era activa
  const activeFloat = g;
  const active = Math.round(activeFloat);
  hudEra.textContent = `${String(active + 1).padStart(2, '0')} / ${String(N).padStart(2, '0')}`;
  hudYear.textContent = ERAS[active].year;
  progressFill.style.width = `${(g / (N - 1)) * 100}%`;
  dotBtns.forEach((d, i) => d.classList.toggle('active', i === active));

  // Movimiento horizontal fantasma: la tira inferior se desplaza en X
  const maxShift = Math.max(0, stripInner.scrollWidth - window.innerWidth);
  stripInner.style.transform = `translateX(${-maxShift * (g / (N - 1))}px)`;

  // Leve deriva lateral de cámara = sensación de travelling horizontal
  camera.position.x = THREE.MathUtils.lerp(-0.25, 0.25, g / (N - 1));
  camera.lookAt(0, 0, 0);
}

// Scroll vertical -> progreso global (scrub suavizado) -----------
const sections = gsap.utils.toArray('.era');
sections.forEach((sec) => {
  const card = sec.querySelector('.info-card');
  gsap.fromTo(card, { y: 50, opacity: 0 }, {
    y: 0, opacity: 1, ease: 'none',
    scrollTrigger: { trigger: sec, start: 'top 75%', end: 'center center', scrub: true },
  });
  gsap.to(card, {
    y: -60, opacity: 0, ease: 'none',
    scrollTrigger: { trigger: sec, start: 'center center', end: 'bottom 30%', scrub: true },
  });
});

ScrollTrigger.create({
  trigger: '#timeline-wrapper',
  start: 'top top',
  end: 'bottom bottom',
  scrub: 1,
  onUpdate: (self) => {
    state.global = self.progress * (N - 1);
    applyState();
  },
});
applyState();

// Loop + resize ---------------------------------------------------
function tick() {
  requestAnimationFrame(tick);
  renderer.render(scene, camera);
}
tick();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Reduce motion: congela el relieve 3D pero mantiene el fundido
if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  material.uniforms.uIntensity.value = 0.0;
  material.uniforms.uDissolveAmp.value = 0.0;
}
