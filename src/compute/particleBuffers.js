import * as THREE from 'three/webgpu';
import { instancedArray } from 'three/tsl';

// Pro-Partikel-Persistent-Storage. Ersetzt die 256x256-FBO-Ping-Pong-Architektur
// des alten particles.js komplett. instancedArray ist in WebGPU ein echter
// StorageBuffer mit Read-Write-Zugriff aus Compute-Kerneln, in WebGL2-Fallback
// wird er auf ein TransformFeedback-Mapping gemappt (langsamer, daher das Cap
// in createParticleBuffers).
//
// Layout-Entscheidungen:
// - positions  : vec3 (x, y, z) — Welt-Raum nach Scale * 5 (gleicher Faktor
//                wie particles.js:389 mesh.scale.set(5, -5, 5))
// - velocities : vec3 — wird im Sim-Kernel zur Daempfung gebraucht
// - refs       : vec2 — statische Poisson-Basis-Position (refPos im alten Shader)
// - targets    : vec2 * 5 — alle 5 Shape-Targets concat hintereinander.
//                Lookup im Kernel: targets.element(uActiveShape * N + i).
//                Spart 5 separate StorageBuffer und damit 5 Bindings.
// - seeds      : vec4 — Random-Phasen fuer Lifetime, Twinkle, Z-Swell, Stagger
//                (1:1 aus particles.js:347-350)
// - scaleVel   : vec2 (scale, velocityMag) — wird im Vertex-Pfad fuer
//                gl_PointSize-Aequivalent und kinetische Einfaerbung gebraucht.
//                Getrennt von velocities damit Material-Pfad nur 1 Buffer liest.
//
// N = 65_536 ist gewaehlt weil:
//   a) Power-of-Two passt sauber zu typischen Compute-Workgroup-Sizes (256)
//   b) Auf einer RTX-3060-Klasse-GPU laeuft das mit ~60fps inklusive Post-FX
//   c) Faktor ~230x mehr Partikel als alter Pfad (280) — daher der Wow-Effekt

export function createParticleBuffers({ count }) {
  const N = count;

  const positions  = instancedArray(N, 'vec3');
  const velocities = instancedArray(N, 'vec3');
  const refs       = instancedArray(N, 'vec2');
  const targets    = instancedArray(N * 5, 'vec2');
  const seeds      = instancedArray(N, 'vec4');
  const scaleVel   = instancedArray(N, 'vec2');

  return { N, positions, velocities, refs, targets, seeds, scaleVel };
}

// Detection: WebGPU-Backend verfuegbar? Falls nicht (Safari <18.2, alte Android),
// auto-Cap auf 8000 Partikel — Transform-Feedback-Pfad in WebGL2-Backend ist
// 10-15x langsamer als nativer Compute-Pfad.
export function pickParticleCount({ rendererBackendIsWebGL, preferred = 65_536, fallback = 8_000 }) {
  return rendererBackendIsWebGL ? fallback : preferred;
}
