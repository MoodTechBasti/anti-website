import * as THREE from 'three/webgpu';
import { pass, mrt, output, emissive } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { afterImage } from 'three/addons/tsl/display/AfterImageNode.js';
import { chromaticAberration } from './nodes/chromaticAberrationNode.js';
import { filmGrain } from './nodes/filmGrainNode.js';

// PostProcessing-Graph fuer den WebGPU-Pfad. Ersetzt EffectComposer +
// 5 Passes aus postprocessing.js durch einen einzigen Node-Graph.
//
// Reihenfolge (gleich wie alt):
//   scenePass → afterImage(damp) → bloom(strength, radius, threshold)
//   → chromaticAberration(offset) → filmGrain(intensity) → output
//
// Vorteile gegenueber EffectComposer:
//   - Ein einziger GPU-Pass (kein Pingpong zwischen Passes)
//   - Bloom, ChromaticAberration etc. werden in einen kombinierten Compute-Shader
//     compiled, weniger Memory-Bandwidth-Druck
//   - Live tunable via uniform(): bloomStrength wird von setAudioBands gepusht

export function createRenderPipeline({ renderer, scene, camera, uniforms }) {
  const post = new THREE.PostProcessing(renderer);

  // Scene Pass mit MRT fuer separates emissive-Channel-Bloom (HDR-correct).
  const scenePass = pass(scene, camera);
  scenePass.setMRT(mrt({
    output: output,
    emissive: emissive
  }));

  const outputTex = scenePass.getTextureNode('output');
  const emissiveTex = scenePass.getTextureNode('emissive');

  // Trail (Afterimage) — addon BloomNode/AfterImageNode haben dieselbe
  // ?-strength-property wie composer.passes — wir wrappen damit GSAP/Audio
  // weiterhin live tunen kann.
  const trailed = afterImage(outputTex, uniforms.uTrailDamp);

  // Bloom auf das emissive-MRT (Partikel haben energy > 1.0)
  // Strength/Radius/Threshold sind die Konstanten aus options.post in main.js.
  const bl = bloom(emissiveTex, uniforms.uBloomStrength, uniforms.uBloomRadius, uniforms.uBloomThreshold);

  const combined = trailed.add(bl);

  // Chromatic Aberration als Custom-Node (siehe nodes/chromaticAberrationNode.js)
  const aberrated = chromaticAberration(combined, uniforms.uChromaticOffset);

  // Film-Grain finalisiert
  const filmed = filmGrain(aberrated, uniforms.uFilmIntensity, uniforms.uTime);

  post.outputNode = filmed;

  return {
    post,
    bloomNode: bl,           // damit setAudioBands.strength tunen kann
    async render() { await post.renderAsync(); }
  };
}
