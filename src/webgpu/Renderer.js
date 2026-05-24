import * as THREE from 'three/webgpu';

// WebGPURenderer-Factory mit Auto-Fallback auf WebGL2-Backend.
//
// Browser-Matrix:
//   - Chrome/Edge 132+, Safari 18.2+, Firefox 134+ (mit Flag) → nativer WebGPU
//   - Safari 17.x, iOS <17 → forceWebGL=true Fallback (Transform-Feedback Compute)
//
// Detection geschieht in zwei Schritten:
//   1. navigator.gpu existiert ueberhaupt?  → Hint fuer forceWebGL=true
//   2. Nach init() pruefen wir renderer.backend.isWebGLBackend, weil der
//      Constructor selbst noch downgraden kann (z.B. WebGPU init failt silent)
//   → diese zweite Info kommt aus init() zurueck, ParticleUniverse cap'd
//     darauf die Partikel-Zahl.

export async function createRenderer({ canvas }) {
  const hasWebGPU = typeof navigator !== 'undefined' && 'gpu' in navigator;

  const renderer = new THREE.WebGPURenderer({
    canvas,
    antialias: false,    // PostProcessing macht eigenes AA, Bloom-Smearing reicht
    alpha: true,
    forceWebGL: !hasWebGPU,
    powerPreference: 'high-performance'
  });

  // ColorSpace + Tone-Mapping wie alter Pfad (particles.js:266-268).
  // ACES laeuft jetzt im RenderPipeline-Output statt im Renderer-Property —
  // wir setzen es trotzdem als Default, falls eine Material noch direkt
  // gerendert wird (Splat-Layer).
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  await renderer.init();

  // Backend-Info fuer Particle-Count-Cap
  const isWebGLBackend = renderer.backend?.isWebGLBackend === true;

  return { renderer, isWebGLBackend };
}
