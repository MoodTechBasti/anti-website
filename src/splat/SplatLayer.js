// Gaussian Splatting Layer — fotorealistischer 3D-Effekt in
// #try-solutions-section. Wrappt mkkellogg/gaussian-splats-3d Viewer so,
// dass er in den existierenden Renderer/Scene/Camera-Stack einklinkt
// (selfDrivenMode: false → unser eigener Render-Loop in ParticleUniverse
// fuehrt update() + render() aus).
//
// Asset-TODO: bis ein eigener Earth-Splat per Polycam-Photogrammetrie
// produziert ist, nutzen wir Stand-In. Falls Loading-URL nicht erreichbar
// (z.B. offline dev), bleibt der Layer einfach unsichtbar — kein Crash.

import { Viewer } from '@mkkellogg/gaussian-splats-3d';

const DEFAULT_SPLAT_URL = '/assets/galaxy.ksplat'; // TODO: durch Earth-Splat ersetzen

export class SplatLayer {
  constructor({ renderer, scene, camera, url = DEFAULT_SPLAT_URL } = {}) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.url = url;
    this.viewer = null;
    this.loaded = false;
    this.visible = false;
  }

  async load() {
    try {
      this.viewer = new Viewer({
        useBuiltInControls: false,
        threeScene: this.scene,
        renderer: this.renderer,
        camera: this.camera,
        selfDrivenMode: false,
        sharedMemoryForWorkers: false,
        ignoreDevicePixelRatio: false
      });
      await this.viewer.addSplatScene(this.url, { showLoadingUI: false });
      this.loaded = true;
      this.setVisible(false);  // erst aktivieren wenn ScrollTrigger feuert
    } catch (err) {
      console.warn('[SplatLayer] Asset nicht ladbar (offline / 404). Layer bleibt inaktiv.', err);
      this.loaded = false;
    }
  }

  update() {
    if (!this.loaded || !this.visible || !this.viewer) return;
    this.viewer.update();
    this.viewer.render();
  }

  setVisible(v) {
    this.visible = v;
    if (this.viewer?.splatMesh) this.viewer.splatMesh.visible = v;
  }

  dispose() {
    try {
      this.viewer?.dispose?.();
    } catch (_) {}
    this.viewer = null;
    this.loaded = false;
  }
}
