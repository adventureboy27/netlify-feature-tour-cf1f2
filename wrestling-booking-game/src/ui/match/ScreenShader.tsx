// The moving picture behind everything on the broadcast ring's screen
// (ApronScreen.tsx): drawn on the graphics card, one small fragment shader,
// so it never stops moving the way a real arena wall never does.
//
//   energy  ribbons of light flowing through two colours (left to right)
//   fire    flames climbing the screen (a heel)
//   rays    light turning out from behind a face (a face, a star, a winner)
//   grid    a lit floor grid racing toward the camera (what it is for)
//
// Sparks glint over all of them. With no WebGL it draws nothing and the
// scenes' own gradients show; with reduced motion it draws one still frame.

import { memo, useEffect, useRef } from 'react';

export type Backdrop = { mode: 'energy' | 'fire' | 'rays' | 'grid'; a: string; b: string; /** Where rays come from, 0-1 across. */ focus?: number; /** How fast, 1 normal. */ speed?: number };

const MODES = { energy: 0, fire: 1, rays: 2, grid: 3 } as const;

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;
const FRAG = `
precision mediump float;
uniform vec2 uRes; uniform float uTime; uniform vec3 uA; uniform vec3 uB; uniform float uMode; uniform float uFocus;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  float asp = uRes.x / uRes.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec3 col = vec3(0.0);
  float t = uTime;
  if (uMode < 0.5) {
    // Energy: ribbons of light, bent by noise, flowing sideways.
    vec2 q = p * vec2(0.55, 1.4);
    float warp = fbm(q * 1.7 - vec2(t * 0.12, 0.0));
    float n = fbm(q * 2.2 + vec2(t * 0.22, 0.0) + warp * 1.6);
    float rib = 0.0;
    for (int k = 0; k < 3; k++) {
      float fk = float(k);
      float y = 0.5 + 0.32 * sin(uv.x * (3.0 + fk) + t * (0.6 + 0.25 * fk) + n * 4.0 + fk * 2.1);
      rib += 0.012 / (abs(uv.y - y) + 0.012) * (0.55 + 0.45 * n);
    }
    vec3 c = mix(uA, uB, smoothstep(0.15, 0.85, uv.x));
    col = c * (0.18 + 0.75 * n * n) + c * rib * 0.45 + vec3(1.0) * pow(rib * 0.25, 3.0);
  } else if (uMode < 1.5) {
    // Fire: flames climbing from the bottom edge.
    vec2 q = vec2(p.x * 1.3, uv.y * 1.6 - t * 1.4);
    float n = fbm(q * 2.4 + fbm(q * 1.3 + t * 0.3));
    float h = 1.0 - uv.y;
    float f = clamp(n * 1.9 * h + h * 0.55 - 0.42, 0.0, 1.0);
    col = mix(vec3(0.25, 0.0, 0.0), vec3(1.0, 0.35, 0.03), f) * f * 1.6 + vec3(1.0, 0.85, 0.45) * pow(f, 3.0);
    col += uA * 0.12 * (1.0 - uv.y);
  } else if (uMode < 2.5) {
    // Rays: light turning out from behind somebody.
    vec2 d = vec2((uv.x - uFocus) * asp, uv.y - 0.5);
    float a = atan(d.y, d.x);
    float r = length(d);
    float rays = pow(0.5 + 0.5 * sin(a * 16.0 + t * 0.9), 5.0) + 0.6 * pow(0.5 + 0.5 * sin(a * 7.0 - t * 0.55 + 1.3), 8.0);
    col = uA * rays * exp(-r * 0.12) * 1.1 + uA * exp(-r * 1.4) * 0.9 + mix(uA, uB, 0.5) * fbm(p * 2.0 + vec2(t * 0.2, 0.0)) * 0.3;
    col += vec3(1.0) * exp(-r * 4.0) * 0.35;
  } else {
    // Grid: a lit floor racing toward the camera under a glowing horizon.
    float hz = 0.46;
    if (uv.y < hz) {
      float z = 0.22 / (hz - uv.y + 0.001);
      float x = (uv.x - 0.5) * asp * z;
      float gx = abs(fract(x * 0.9) - 0.5);
      float gz = abs(fract(z * 0.7 - t * 1.6) - 0.5);
      float line = smoothstep(0.035 * z, 0.0, gx) + smoothstep(0.05 * z, 0.0, gz);
      float fade = clamp(1.2 - z * 0.12, 0.0, 1.0);
      col = uA * line * fade * 1.3 + uA * 0.08;
    } else {
      col = mix(uB * 0.35, vec3(0.0), smoothstep(hz, 1.0, uv.y)) + uB * fbm(p * 3.0 + vec2(t * 0.1, 0.0)) * 0.12;
    }
    col += mix(uA, vec3(1.0), 0.4) * exp(-abs(uv.y - hz) * 40.0) * 0.9;
  }
  // Sparks glinting over everything.
  vec2 g = floor(gl_FragCoord.xy / 3.0);
  float s = hash(g + floor(t * 7.0));
  col += step(0.9975, s) * vec3(1.0) * 0.9;
  // A soft vignette, as on any screen.
  col *= 0.65 + 0.35 * smoothstep(0.0, 0.25, uv.x) * smoothstep(1.0, 0.75, uv.x);
  gl_FragColor = vec4(col, 1.0);
}`;

const rgb = (hex: string): [number, number, number] => {
  const m = /^#?([0-9a-f]{6})/i.exec(hex);
  if (!m) return [1, 1, 1];
  const n = parseInt(m[1]!, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

export const ScreenShader = memo(function ScreenShader({ width, height, backdrop }: { width: number; height: number; backdrop: Backdrop }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const current = useRef(backdrop);
  current.current = backdrop;

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    el.width = Math.max(1, Math.round(width * dpr));
    el.height = Math.max(1, Math.round(height * dpr));
    const gl = el.getContext('webgl', { antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: true });
    if (!gl) return;
    const shader = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    };
    const vs = shader(gl.VERTEX_SHADER, VERT);
    const fs = shader(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const u = (n: string) => gl.getUniformLocation(prog, n);
    const uRes = u('uRes'), uTime = u('uTime'), uA = u('uA'), uB = u('uB'), uMode = u('uMode'), uFocus = u('uFocus');
    gl.viewport(0, 0, el.width, el.height);
    gl.uniform2f(uRes, el.width, el.height);

    const still = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const start = performance.now();
    // Time runs on through scene changes; each scene's speed scales its own clock.
    let clock = 0;
    let last = start;
    const draw = (now: number) => {
      const b = current.current;
      clock += ((now - last) / 1000) * (b.speed ?? 1);
      last = now;
      gl.uniform1f(uTime, still ? 3 : clock + 10);
      gl.uniform3fv(uA, rgb(b.a));
      gl.uniform3fv(uB, rgb(b.b));
      gl.uniform1f(uMode, MODES[b.mode]);
      gl.uniform1f(uFocus, b.focus ?? 0.12);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
    if (still) {
      draw(performance.now());
      return () => gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
    let raf = 0;
    let prev = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (now - prev < 30) return;
      prev = now;
      draw(now);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, [width, height]);

  return <canvas ref={canvas} className="absolute inset-0 h-full w-full" />;
});
