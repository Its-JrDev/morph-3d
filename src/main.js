import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// Reemplaza los JPG en public/img/ por tus fotos reales de Barrio Abajo.
// Mismos nombres, 16/9 aprox, `object-fit: cover` hace el resto.
const YEARS = ['1880', '1920', '1960', '1990', '2026'];
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const track = document.querySelector('.timeline-track');
const items = gsap.utils.toArray('.timeline-item');
const hudEra = document.getElementById('hud-era');
const hudYear = document.getElementById('hud-year');
const progressFill = document.getElementById('progress-fill');
const dotsBox = document.getElementById('dots');

// Dots navegables ---------------------------------------------
YEARS.forEach((y, i) => {
  const b = document.createElement('button');
  b.textContent = y;
  b.addEventListener('click', () => {
    const st = scrollTween.scrollTrigger;
    const target = st.start + (st.end - st.start) * (i / (items.length - 1));
    window.scrollTo({ top: target, behavior: 'smooth' });
  });
  dotsBox.appendChild(b);
});
const dotBtns = [...dotsBox.querySelectorAll('button')];

function setActive(i) {
  hudEra.textContent = `${String(i + 1).padStart(2, '0')} / ${String(items.length).padStart(2, '0')}`;
  hudYear.textContent = YEARS[i];
  dotBtns.forEach((d, k) => d.classList.toggle('active', k === i));
}

// 1. Scroll vertical -> desplazamiento horizontal (pin + scrub)
const scrollTween = gsap.to(track, {
  x: () => -(track.scrollWidth - window.innerWidth),
  ease: 'none',
  scrollTrigger: {
    trigger: '.timeline-wrapper',
    pin: true,
    scrub: 1,
    end: () => `+=${track.scrollWidth}`,
    onUpdate: (self) => {
      progressFill.style.width = `${self.progress * 100}%`;
      setActive(Math.min(items.length - 1, Math.round(self.progress * (items.length - 1))));
    },
  },
});
setActive(0);

// 2. Por cada hito: revelado clip-path + zoom-through del anterior
items.forEach((item, index) => {
  if (index === 0) {
    // Primer item: su tarjeta entra al cargar
    gsap.fromTo(item.querySelector('.info-card'),
      { y: 50, opacity: 0 },
      {
        y: 0, opacity: 1, ease: 'none',
        scrollTrigger: {
          trigger: item,
          containerAnimation: scrollTween,
          start: 'left 90%',
          end: 'center center',
          scrub: true,
        },
      });
    return;
  }

  const prev = items[index - 1];
  const prevImg = prev.querySelector('.timeline-img');
  const prevCard = prev.querySelector('.info-card');
  const mask = item.querySelector('.clip-mask');
  const img = item.querySelector('.timeline-img');
  const card = item.querySelector('.info-card');

  gsap.timeline({
    scrollTrigger: {
      trigger: item,
      containerAnimation: scrollTween,
      start: 'left right',   // el item entrante toca el borde derecho
      end: 'center center',  // hasta quedar centrado
      scrub: true,
    },
  })
    // Zoom-through: la foto anterior se acerca, se desenfoca y se apaga
    .to(prevImg, {
      scale: reduceMotion ? 1 : 1.3,
      opacity: 0.15,
      filter: 'blur(10px)',
      ease: 'power1.in',
    }, 0)
    .to(prevCard, { y: -40, opacity: 0, ease: 'power1.in' }, 0)
    // Revelado lente: la foto nueva se expande desde el centro
    .fromTo(mask,
      { clipPath: 'circle(0% at 50% 50%)' },
      { clipPath: 'circle(75% at 50% 50%)', ease: 'power2.inOut' },
      0)
    // Asentamiento interno de la foto nueva
    .fromTo(img,
      { scale: reduceMotion ? 1 : 1.2 },
      { scale: 1, ease: 'power1.out' },
      0)
    // Entrada de la tarjeta
    .fromTo(card,
      { y: 50, opacity: 0 },
      { y: 0, opacity: 1, ease: 'power2.out' },
      0.35);
});

// Refrescar medidas al redimensionar (track.scrollWidth cambia)
window.addEventListener('resize', () => ScrollTrigger.refresh());
