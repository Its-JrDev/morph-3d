// Variante TÚNEL: la cámara ATRAVIESA cada foto en vez de fundirla.
// - Vertex: empuje fuerte en Z + expansión radial a mitad del vuelo.
// - Fragment: zoom radial continuo (tex1 se adentra, tex2 emerge desde
//   adentro), blur de velocidad, aberración cromática en bordes, flash
//   cálido que oculta el corte entre fotos de lugares distintos.

export const vertexShader = /* glsl */ `
uniform float uProgress; // 0..1 dentro del par actual
uniform float uCalm;     // 1 = reduced-motion (vuelo casi plano)
varying vec2 vUv;

void main() {
  vUv = uv;
  vec3 pos = position;
  float env = sin(uProgress * 3.14159265); // 0 en extremos, 1 a mitad
  float amp = mix(2.2, 0.4, uCalm);
  pos.z += env * amp;
  pos.xy *= 1.0 + env * 0.12 * (1.0 - uCalm);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

export const fragmentShader = /* glsl */ `
precision highp float;

uniform sampler2D uTex1;
uniform sampler2D uTex2;
uniform float uProgress;
uniform float uSepia1;
uniform float uSepia2;
uniform float uCalm;
varying vec2 vUv;

vec3 applySepia(vec3 c, float amt) {
  vec3 sep = vec3(
    dot(c, vec3(0.393, 0.769, 0.189)),
    dot(c, vec3(0.349, 0.686, 0.168)),
    dot(c, vec3(0.272, 0.534, 0.131))
  );
  return mix(c, sep, amt);
}

// Blur de 9 taps con aberración cromática radial (bordes se separan en vuelo)
vec3 flightSample(sampler2D t, vec2 uv, vec2 dir, float radius, float aberr) {
  vec2 px = dir * radius;
  vec2 ab = dir * aberr;
  float r = texture2D(t, uv + px + ab).r;
  float g2 = texture2D(t, uv).g;
  float b = texture2D(t, uv - px - ab).b;
  vec3 col = vec3(r, g2, b) * 0.4;
  col += texture2D(t, uv + px * 2.0).rgb * 0.15;
  col += texture2D(t, uv - px * 2.0).rgb * 0.15;
  col += texture2D(t, uv + vec2(px.y, -px.x) * 2.0).rgb * 0.15;
  col += texture2D(t, uv - vec2(px.y, -px.x) * 2.0).rgb * 0.15;
  return col;
}

void main() {
  float f = uProgress;
  float env = sin(f * 3.14159265);
  float calmK = 1.0 - uCalm;
  float zoomAmp = mix(1.8, 0.5, uCalm);

  vec2 ctr = vec2(0.5);
  vec2 dir = vUv - ctr;
  float rlen = max(length(dir), 1e-4);
  vec2 rdir = dir / rlen;

  // tex1: la cámara se adentra (muestreo cada vez más central)
  vec2 uv1 = ctr + dir / (1.0 + f * zoomAmp);
  // tex2: emerge desde el interior (empieza muy adentro, aterriza en 1.0)
  vec2 uv2 = ctr + dir / (1.0 + (1.0 - f) * zoomAmp);

  float radius = (0.003 + env * 0.011) * calmK + 0.001;
  float aberr = env * 0.014 * calmK;

  vec3 c1 = applySepia(flightSample(uTex1, uv1, rdir, radius, aberr), uSepia1);
  vec3 c2 = applySepia(flightSample(uTex2, uv2, rdir, radius, aberr), uSepia2);

  // El corte ocurre a mitad del vuelo, tapado por blur + flash
  float cross = smoothstep(0.38, 0.62, f);
  vec3 col = mix(c1, c2, cross);

  // Flash cálido de "salto temporal"
  float flash = smoothstep(0.30, 0.50, f) * (1.0 - smoothstep(0.50, 0.70, f));
  col += vec3(1.0, 0.84, 0.58) * flash * 0.85 * calmK;

  // Polvo/estelas en el aire durante el vuelo
  vec2 grid = floor(vUv * vec2(200.0, 112.0));
  float h = fract(sin(dot(grid + floor(f * 30.0), vec2(12.9898, 78.233))) * 43758.5453);
  col += step(0.986, h) * env * 0.45 * calmK;

  // Viñeta cinematográfica reforzada en vuelo
  float d = distance(vUv, ctr) * (1.0 + env * 0.25);
  col *= smoothstep(1.0, 0.3, d) * 0.4 + 0.6;

  gl_FragColor = vec4(col, 1.0);
}
`;
