import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { vertexShader, fragmentShader } from './shaders.js';

gsap.registerPlugin(ScrollTrigger);

// Reemplaza los JPG en public/img/ por tus fotos reales de Barrio Abajo.
const ERAS = [
  { year: 1880, file: '/img/barrio-abajo-1880.jpg', sepia: 0.85, label: '1880' },
  { year: 1920, file: '/img/barrio-abajo-1920.jpg', sepia: 0.65, label: '1920' },
  { year: 1960, file: '/img/barrio-abajo-1960.jpg', sepia: 0.35, label: '1960' },
  { year: 1990, file: '/img/barrio-abajo-1990.jpg', sepia: 0.12, label: '1990' },
  { year: 2026, file: '/img/barrio-abajo-2026.jpg', sepia: 0.0, label: '2026' },
];
const CALM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const container = document.getElementById('canvas-container');
const hudEra = document.getElementById('hud-era');
const hudYear = document.getElementById('hud-year');
const progressFill = document.getElementById('progress-fill');
const dotsBox = document.getElementById('dots');
const stripInner = document.getElementById('filmstrip-inner');
const speedEl = document.getElementById('speed');

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

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 20);
camera.position.z = 3.2;

const geometry = new THREE.PlaneGeometry(7.2, 4.05, 32, 18);
const loader = new THREE.TextureLoader();
loader.setCrossOrigin('anonymous');

function loadTex(url) {
  return new Promise((resolve) => {
    loader.load(url, (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      const screenAsp = window.innerWidth / window.innerHeight;
      const imgAsp = t.image.width / t.image.height;
      if (imgAsp > screenAsp) {
        const w = screenAsp / imgAsp;
        t.repeat.x = w; t.offset.x = (1 - w) / 2;
      } else {
        const h = imgAsp / screenAsp;
        t.repeat.y = h; t.offset.y = (1 - h) / 2;
      }
      resolve(t);
    }, undefined, () => resolve(null));
  });
}

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
    uSepia1: { value: ERAS[0].sepia },
    uSepia2: { value: ERAS[1].sepia },
    uCalm: { value: CALM ? 1 : 0 },
  },
});
scene.add(new THREE.Mesh(geometry, material));

const textures = new Array(ERAS.length);
for (let i = 0; i < ERAS.length; i++) textures[i] = placeholderTex(['#3a2c1c', '#33424a', '#4a3330', '#2c3a2e', '#1f2c44'][i % 5]);
material.uniforms.uTex1.value = textures[0];
material.uniforms.uTex2.value = textures[1];
ERAS.forEach((era, i) => {
  loadTex(era.file).then((t) => {
    if (!t) return;
    textures[i] = t;
    applyState();
  });
});

// Odómetro: el año rueda en continuo durante el vuelo
let shownYear = -1;
let rollTimer = 0;
function renderYear(floatYear) {
  const y = Math.round(floatYear);
  if (y === shownYear) return;
  shownYear = y;
  hudYear.textContent = y;
  hudYear.classList.add('rolling');
  clearTimeout(rollTimer);
  rollTimer = setTimeout(() => hudYear.classList.remove('rolling'), 150);
}

const state = { global: 0 };
const N = ERAS.length;

function applyState() {
  const g = THREE.MathUtils.clamp(state.global, 0, N - 1);
  const a = Math.min(Math.floor(g), N - 2);
  const lastPair = g >= N - 1;
  const ai = lastPair ? N - 2 : a;
  const fract = lastPair ? 1 : g - Math.floor(g);
  const bi = Math.min(ai + 1, N - 1);

  if (material.uniforms.uTex1.value !== textures[ai]) material.uniforms.uTex1.value = textures[ai];
  if (material.uniforms.uTex2.value !== textures[bi]) material.uniforms.uTex2.value = textures[bi];
  material.uniforms.uProgress.value = fract;
  material.uniforms.uSepia1.value = ERAS[ai].sepia;
  material.uniforms.uSepia2.value = ERAS[bi].sepia;

  renderYear(ERAS[ai].year + (ERAS[bi].year - ERAS[ai].year) * fract);
  const active = Math.round(g);
  hudEra.textContent = `${String(active + 1).padStart(2, '0')} / ${String(N).padStart(2, '0')}`;
  progressFill.style.width = `${(g / (N - 1)) * 100}%`;
  dotBtns.forEach((d, i) => d.classList.toggle('active', i === active));
  const maxShift = Math.max(0, stripInner.scrollWidth - window.innerWidth);
  stripInner.style.transform = `translateX(${-maxShift * (g / (N - 1))}px)`;
}

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
  scrub: 1.5, // más inercia: el vuelo se siente pesado y cinematográfico
  onUpdate: (self) => { state.global = self.progress * (N - 1); applyState(); },
});
applyState();

// Viñeta de velocidad ligada a la velocidad real de scroll
let prevG = state.global;
let speedV = 0;
(function tick() {
  requestAnimationFrame(tick);
  const v = Math.min(1, Math.abs(state.global - prevG) * 6);
  prevG = state.global;
  speedV += (v - speedV) * 0.08;
  if (!CALM) speedEl.style.opacity = speedV.toFixed(3);
  renderer.render(scene, camera);
})();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
