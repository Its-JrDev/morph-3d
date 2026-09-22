// Shaders para morphing 3D entre JPGs de DISTINTAS escenas.
// Clave: NO deformar geometría para "encajar" (se vería mal con fotos
// disímiles). En su lugar:
//  - Vertex: onda 3D sutil (tela flotante) con amplitud máxima a mitad de transición.
//  - Fragment: distorsión UV por ruido + disolución con borde de "quemado de archivo"
//    (sepia brillante) que oculta el corte entre fotos distintas.

export const vertexShader = /* glsl */ `
uniform float uProgress;   // 0..1 dentro del par actual
uniform float uIntensity;  // amplitud del relieve 3D
varying vec2 vUv;

void main() {
  vUv = uv;
  vec3 pos = position;

  // Envolvente: 0 en los extremos, 1 en el medio -> sin deformación residual
  float env = sin(uProgress * 3.14159265);

  float w1 = sin(pos.x * 3.0 + uProgress * 6.2831) * 0.5;
  float w2 = sin(pos.y * 4.0 - uProgress * 6.2831) * 0.5;
  pos.z += (w1 + w2) * uIntensity * env;

  // Leve empuje hacia la cámara a mitad del morph (sensación "zoom-through")
  pos.z += env * 0.35;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

export const fragmentShader = /* glsl */ `
precision highp float;

uniform sampler2D uTex1;
uniform sampler2D uTex2;
uniform float uProgress;  // 0..1
uniform float uNoiseScale; // escala del ruido de disolución
uniform float uEdgeWidth;  // grosor del borde de transición
uniform float uSepia1;     // 1 = foto antigua sepia, 0 = color actual
uniform float uSepia2;
uniform float uDissolveAmp; // amplitud de distorsión UV previa al corte
varying vec2 vUv;

// --- Simplex noise 2D (Ashima) ---
vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                      -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
                 + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy),
                          dot(x12.zw, x12.zw)), 0.0);
  m = m*m; m = m*m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

vec3 applySepia(vec3 c, float amt) {
  vec3 sep = vec3(
    dot(c, vec3(0.393, 0.769, 0.189)),
    dot(c, vec3(0.349, 0.686, 0.168)),
    dot(c, vec3(0.272, 0.534, 0.131))
  );
  return mix(c, sep, amt);
}

void main() {
  // Ruido de disolución (dos octavas para borde orgánico)
  float n = snoise(vUv * uNoiseScale) * 0.5 + 0.5;
  n = n * 0.7 + (snoise(vUv * uNoiseScale * 2.3 + 7.7) * 0.5 + 0.5) * 0.3;

  // Distorsión UV previa al corte: "respira" antes de disolver
  float env = sin(uProgress * 3.14159265);
  vec2 distortedUv = vUv + (vec2(n - 0.5), vec2(snoise(vUv * 3.0 - uProgress) * 0.5)) * uDissolveAmp * env;

  vec3 tex1 = texture2D(uTex1, distortedUv).rgb;
  vec3 tex2 = texture2D(uTex2, distortedUv).rgb;

  tex1 = applySepia(tex1, uSepia1);
  tex2 = applySepia(tex2, uSepia2);

  // Máscara de disolución con borde luminoso (oculta el corte entre fotos distintas)
  float edge = uEdgeWidth;
  float mask = smoothstep(uProgress - edge, uProgress + edge, n);

  // Borde de "quemado de archivo": línea cálida donde una época devora a la otra
  float band = smoothstep(uProgress - edge * 2.2, uProgress, n)
             - smoothstep(uProgress, uProgress + edge * 2.2, n);
  vec3 burn = vec3(1.0, 0.72, 0.32) * band * 0.85;

  vec3 col = mix(tex1, tex2, mask) + burn;

  // Viñeta cinematográfica
  float d = distance(vUv, vec2(0.5));
  col *= smoothstep(0.95, 0.35, d) * 0.35 + 0.65;

  gl_FragColor = vec4(col, 1.0);
}
`;
