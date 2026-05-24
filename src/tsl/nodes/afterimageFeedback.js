import * as THREE from 'three/webgpu';
import { Fn, vec4, uv, mix, texture, float } from 'three/tsl';

// Manueller Afterimage-Feedback-Loop. Wird gebraucht, falls die three/tsl
// PostProcessing-Komposition kein eingebautes afterimage()-Node in
// der aktuellen Version anbietet.
//
// Funktion: zwei RenderTargets ping-pong, jeder Frame mix(prev, current, damp).
//
// API:
//   const ai = new AfterimageFeedback(renderer, width, height);
//   const node = ai.process(sceneNode, dampUniform);  // gibt TSL-Node zurueck
//   onResize(w,h) { ai.setSize(w,h); }
//   dispose()    { ai.dispose(); }

export class AfterimageFeedback {
  constructor(renderer, width, height) {
    this.renderer = renderer;
    const opts = {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
      stencilBuffer: false
    };
    this.rtA = new THREE.RenderTarget(width, height, opts);
    this.rtB = new THREE.RenderTarget(width, height, opts);
  }

  // Liefert einen Node der: aktueller Frame gemischt mit prev-Frame * damp
  process(sceneTextureNode, dampNode) {
    const prev = texture(this.rtA.texture);
    return Fn(() => {
      const cur = sceneTextureNode.sample(uv());
      const old = prev.sample(uv());
      return mix(cur, old, dampNode);
    })();
  }

  swap() {
    const tmp = this.rtA;
    this.rtA = this.rtB;
    this.rtB = tmp;
  }

  setSize(w, h) {
    this.rtA.setSize(w, h);
    this.rtB.setSize(w, h);
  }

  dispose() {
    this.rtA.dispose();
    this.rtB.dispose();
  }
}
