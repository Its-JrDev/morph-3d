# Barrio Abajo — Timeline Morph 3D

Scroll vertical que avanza horizontalmente en el tiempo, con **morphing 3D WebGL** entre fotos JPG de distintas épocas (lugares y ángulos diferentes — sin necesidad de que sea la misma estructura).

## Por qué este shader funciona con fotos disímiles

No intenta deformar la geometría de una foto para encajar en la otra (eso se vería mal). En su lugar:

- **Vertex shader** (`src/shaders.js`): onda 3D sutil tipo "tela flotante" + empuje hacia cámara a mitad de transición (sensación zoom-through). Amplitud = 0 en los extremos, sin deformación residual.
- **Fragment shader**: distorsión UV por ruido simplex + **disolución con borde de quemado sepia** que oculta el corte entre fotos distintas + viñeta cinematográfica.
- **Sepia por época**: `ERAS[].sepia` (0.85 en 1880 → 0 en 2026) da cohesión de archivo histórico.

## Uso

```bash
npm install
npm run dev     # demo local
npm run build   # dist/ para desplegar
```

## Pon tus fotos reales

Reemplaza los archivos en `public/img/` manteniendo los nombres (1600×900 o similar, JPG):

- `barrio-abajo-1880.jpg` — fundación
- `barrio-abajo-1920.jpg` — aduana / tranvía
- `barrio-abajo-1960.jpg` — industria / carnaval
- `barrio-abajo-1990.jpg` — resistencia
- `barrio-abajo-2026.jpg` — actualidad

Los actuales son placeholders de `picsum.photos` (mismo peso/formato para probar el pipeline). El `TextureLoader` hace `cover` automático como `object-fit: cover`.

## Estructura

- `index.html` — 5 secciones `.era` (160vh de scroll cada una) + HUD + filmstrip horizontal
- `src/main.js` — escena Three.js, `ScrollTrigger scrub:1` → `state.global 0..4`, swap de texturas por par, deriva lateral de cámara
- `src/shaders.js` — vertex warp + fragment noise-dissolve
- `src/style.css` — tarjetas vidrio, grain, responsive

## Ajustes útiles

| Uniform | Efecto |
|---|---|
| `uNoiseScale` (4.0) | Grano de la disolución: mayor = parches más finos |
| `uEdgeWidth` (0.12) | Grosor del borde luminoso entre épocas |
| `uIntensity` (0.35) | Relieve 3D del plano |
| `uDissolveAmp` (0.035) | "Respiración" UV previa al corte |

`prefers-reduced-motion` congela el relieve automáticamente.
