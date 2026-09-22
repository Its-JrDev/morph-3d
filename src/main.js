import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// Variante DÍPTICO (sin WebGL): pasado y presente coexisten en pantalla
// dividida. El scroll mueve el divisor de derecha a izquierda revelando la
// época siguiente; las tarjetas viven una a cada lado. Al avanzar de par,
// la foto "ahora" pasa a ser el "antes". Reemplaza los JPG en public/img/.
const ERAS = [
  { year: 1880, file: '/img/barrio-abajo-1880.jpg', sepia: 4, tag: '1880 · Fundación', title: 'Orígenes del Barrio Abajo', text: 'Calles de arena, casas de bahareque y palma.' },
  { year: 1920, file: '/img/barrio-abajo-1920.jpg', sepia: 3, tag: '1920 · Aduana y Tranvía', title: 'Puerto y modernidad', text: 'La Aduana, el tranvía y las casonas republicanas.' },
  { year: 1960, file: '/img/barrio-abajo-1960.jpg', sepia: 2, tag: '1960 · Industria y Carnaval', title: 'Consolidación popular', text: 'Fábricas junto al río, cumbiambas y danzas.' },
  { year: 1990, file: '/img/barrio-abajo-1990.jpg', sepia: 1, tag: '1990 · Resistencia', title: 'Memoria que resiste', text: 'Comparsas, cocinas tradicionales y vecindad.' },
  { year: 2026, file: '/img/barrio-abajo-2026.jpg', sepia: 0, tag: '2026 · Distrito Creativo', title: 'Presente vivo', text: 'Museo del Caribe, Plaza de la Aduana, Cumbiambero.' },
];
const N = ERAS.length;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const pastImg = document.getElementById('pastImg');
const nowImg = document.getElementById('nowImg');
const nowLayer = document.querySelector('.layer-now');
const divider = document.getElementById('divider');
const handleYears = document.getElementById('handleYears');
const tagPastYear = document.getElementById('tagPastYear');
const tagNowYear = document.getElementById('tagNowYear');
const hudEra = document.getElementById('hud-era');
const hudYear = document.getElementById('hud-year');
const progressFill = document.getElementById('progress-fill');
const dotsBox = document.getElementById('dots');
const cardPast = document.getElementById('cardPast');
const cardNow = document.getElementById('cardNow');

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (t) => t * t * (3 - 2 * t);

function setEraContent(prefix, era) {
  document.getElementById(`card${prefix}Year`).textContent = era.tag;
  document.getElementById(`card${prefix}Title`).textContent = era.title;
  document.getElementById(`card${prefix}Text`).textContent = era.text;
}

function setImg(img, era) {
  const url = era.file;
  if (img.dataset.src !== url) {
    img.dataset.src = url;
    img.src = url;
  }
  img.className = `sepia-${era.sepia}`;
}

// Dots: el dot i muestra la época i a pantalla completa (g = i)
const dotsScroll = { get: () => ({ start: 0, end: 1 }) };
ERAS.forEach((era, i) => {
  const b = document.createElement('button');
  b.textContent = era.year;
  b.addEventListener('click', () => {
    const st = dotsScroll.st;
    const target = st.start + (st.end - st.start) * (i / (N - 1));
    window.scrollTo({ top: target, behavior: 'smooth' });
  });
  dotsBox.appendChild(b);
});
const dotBtns = [...dotsBox.querySelectorAll('button')];

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

let curA = -1;
function render(g) {
  const gc = clamp01(g / (N - 1)) * (N - 1);
  const a = Math.min(Math.floor(gc), N - 2);
  const lastPair = gc >= N - 1;
  const ai = lastPair ? N - 2 : a;
  const f = lastPair ? 1 : gc - Math.floor(gc);
  const bi = Math.min(ai + 1, N - 1);
  const A = ERAS[ai], B = ERAS[bi];

  if (ai !== curA) {
    curA = ai;
    setImg(pastImg, A);
    setImg(nowImg, B);
    setEraContent('Past', A);
    setEraContent('Now', B);
    tagPastYear.textContent = A.year;
    tagNowYear.textContent = B.year;
    handleYears.textContent = `${A.year} → ${B.year}`;
  }

  // Fase del par: 0–0.2 pasado solo, 0.2–0.8 barrido, 0.8–1 ahora solo.
  // El barrido ocupa el 60% (asimétrico a propósito: se siente progresivo).
  const sweep = smooth(clamp01((f - 0.2) / 0.6));
  const hiddenPct = (1 - sweep) * 100; // inset-left de la capa "ahora"
  nowLayer.style.clipPath = `inset(0 0 0 ${hiddenPct.toFixed(2)}%)`;
  divider.style.left = `${(100 - hiddenPct).toFixed(2)}%`;

  // Parallax leve: cada foto cede ante el divisor
  if (!reduceMotion) {
    pastImg.style.transform = `scale(1.06) translateX(${(-(1 - sweep) * 24).toFixed(1)}px)`;
    nowImg.style.transform = `scale(1.06) translateX(${((sweep) * 0 - (1 - sweep) * -24).toFixed(1)}px)`;
  }

  // Tarjetas: la del pasado se apaga al cruzar la mitad, la del ahora enciende
  cardPast.style.opacity = (1 - smooth(clamp01((f - 0.35) / 0.2))).toFixed(2);
  cardPast.style.transform = `translateY(${(-smooth(clamp01((f - 0.35) / 0.2)) * 24).toFixed(1)}px)`;
  cardNow.style.opacity = smooth(clamp01((f - 0.45) / 0.2)).toFixed(2);
  cardNow.style.transform = `translateY(${((1 - smooth(clamp01((f - 0.45) / 0.2))) * 24).toFixed(1)}px)`;

  renderYear(A.year + (B.year - A.year) * f);
  const active = Math.round(gc);
  hudEra.textContent = `${String(active + 1).padStart(2, '0')} / ${String(N).padStart(2, '0')}`;
  progressFill.style.width = `${(gc / (N - 1)) * 100}%`;
  dotBtns.forEach((d, i) => d.classList.toggle('active', i === active));
}

// Mango arrastrable: arrastrar horizontalmente hace scrub del tiempo
const handle = document.getElementById('handle');
let dragging = false;
let lastX = 0;
handle.addEventListener('pointerdown', (e) => {
  dragging = true;
  lastX = e.clientX;
  handle.setPointerCapture(e.pointerId);
});
handle.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const dx = e.clientX - lastX;
  lastX = e.clientX;
  window.scrollBy({ top: -dx * 6 }); // arrastrar a la derecha = ir al pasado
});
handle.addEventListener('pointerup', () => { dragging = false; });

const st = ScrollTrigger.create({
  trigger: '#timeline-wrapper',
  start: 'top top',
  end: 'bottom bottom',
  scrub: 1,
  onUpdate: (self) => render(self.progress * (N - 1)),
});
dotsScroll.st = st;
render(0);
