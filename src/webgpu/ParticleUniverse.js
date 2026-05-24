import * as THREE from 'three/webgpu';
import { uniform } from 'three/tsl';
import { gsap } from 'gsap';

import { createRenderer } from './Renderer.js';
import { createParticleBuffers, pickParticleCount } from '../compute/particleBuffers.js';
import { createSimulationKernel } from '../compute/simulationKernel.js';
import { buildShapeTargets, buildTextTargets, generateBasePoints } from '../compute/shapeTargets.js';
import { createParticleMaterial } from '../tsl/particleMaterial.js';
import { createRenderPipeline } from '../tsl/pipeline.js';
import { generateGlowTexture } from '../../glow-texture.js';

// WebGPU/TSL-Aequivalent von ParticlesMain (particles.js).
// API-Kontrakt MUSS bit-identisch sein — main.js und audio-reactor.js
// rufen folgende Methoden direkt auf:
//
//   await init()
//   morphTo(index)               // 0..4 Standard-Shapes, 5 = Text
//   morphToText(text, opts?)
//   disperse()
//   setColors(c1, c2, c3)
//   setTheme(themeName)          // legacy — dark-only Pfad in WebGPU
//   setAudioBands(bass, mid, treble)
//   setMouseMass(v)
//   setAntiGravity(on)
//   triggerBurst(strength)
//   triggerBurstAt(x, y, strength)
//   setPulseProgress(p)
//   onResize()
//   dispose()
//   camera                       // PerspectiveCamera, GSAP tweent direkt position.z
//
// Erweiterungen ueber den alten Vertrag hinaus:
//   alpha   — Getter/Setter, treibt uAlpha-Uniform (fuer Splat-Crossfade)

const sharedGlowTexture = (() => {
  let tex = null;
  return () => (tex ??= generateGlowTexture(64));
})();

export default class ParticleUniverse {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.theme = options.theme || 'dark';
    this.density = options.density ?? 280;
    this.particlesScale = options.particlesScale ?? 1.0;
    this.cameraZoom = options.cameraZoom ?? 10.0;

    this.colors = {
      color1: new THREE.Color(options.color1 || '#ff3b30'),
      color2: new THREE.Color(options.color2 || '#007aff'),
      color3: new THREE.Color(options.color3 || '#34c759')
    };

    this.interactiveHover = options.interactiveHover !== false;
    this.hoverProgress = 0.0;
    this.pushProgress = 0.0;
    this.mouseDownProgress = 0.0;
    this.mouseMassProgress = 0.0;
    this.impulseValue = 0.0;
    this._alpha = 1.0;

    this.postOptions = options.post ?? {};

    this.mousePos = new THREE.Vector2(0, 0);
    this.clock = new THREE.Clock();
    this.lastTime = 0;

    this.activeTargetIndex = 0;
    this._disposed = false;
  }

  // alpha-Setter: feuert in uAlpha-Uniform (Splat-Crossfade-Hook).
  get alpha() { return this._alpha; }
  set alpha(v) {
    this._alpha = v;
    if (this.uniforms) this.uniforms.uAlpha.value = v;
  }

  async init() {
    const width  = this.canvas.clientWidth  || window.innerWidth;
    const height = this.canvas.clientHeight || window.innerHeight;

    // Renderer + Backend-Detection
    const { renderer, isWebGLBackend } = await createRenderer({ canvas: this.canvas });
    this.renderer = renderer;
    this.isWebGLBackend = isWebGLBackend;
    renderer.setSize(width, height, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Scene + Camera (kompatibel zu main.js, der camera.position.z tweent)
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    this.camera.position.set(0, 0, this.cameraZoom);

    // Particle-Count: 65k auf WebGPU-Backend, 8k im Fallback
    const N = pickParticleCount({
      rendererBackendIsWebGL: isWebGLBackend,
      preferred: 65_536,
      fallback: 8_000
    });
    this.count = N;

    // Buffers
    this.buffers = createParticleBuffers({ count: N });

    // Uniforms (alle live via .value tunable)
    const pixelRatio = renderer.getPixelRatio();
    const particleScale = (this.canvas.width / pixelRatio / 2000.0) * this.particlesScale;

    this.uniforms = {
      uTime:           uniform(0),
      uMouse:          uniform(new THREE.Vector2(0, 0)),
      uIsHovering:     uniform(0),
      uMouseDown:      uniform(0),
      uMouseMass:      uniform(0),
      uImpulse:        uniform(0),
      uBassEnergy:     uniform(0),
      uTrebleEnergy:   uniform(0),
      uAntiGravity:    uniform(0),
      uPulseProgress:  uniform(0),
      uActiveShape:    uniform(0),         // int 0..5 (5 = morphToText slot)
      uColor1:         uniform(this.colors.color1),
      uColor2:         uniform(this.colors.color2),
      uColor3:         uniform(this.colors.color3),
      uAlpha:          uniform(1.0),
      uParticleScale:  uniform(particleScale),

      uBloomStrength:  uniform(this.postOptions.bloomStrength ?? 0.95),
      uBloomRadius:    uniform(this.postOptions.bloomRadius ?? 0.55),
      uBloomThreshold: uniform(this.postOptions.bloomThreshold ?? 0.18),
      uChromaticOffset: uniform(this.postOptions.chromaticOffset ?? 0.0022),
      uFilmIntensity:  uniform(this.postOptions.filmIntensity ?? 0.18),
      uTrailDamp:      uniform(this.postOptions.trailDamp ?? 0.88)
    };

    // Shape-Targets (5 Standard + 1 Text-Slot leer init)
    const basePoints = generateBasePoints(this.density);
    const shapeFlat = await buildShapeTargets({ count: N });
    // Refs = ein zyklisches Sampling der Poisson-Basis (kompatibel mit alter
    // 1-Punkt-pro-Pixel-Architektur, aber jetzt fuer N Partikel beliebig oft wiederholt)
    const refs = new Float32Array(N * 2);
    for (let i = 0; i < N; i++) {
      const b = basePoints[i % basePoints.length];
      refs[i * 2 + 0] = (b[0] - 250) / 250;
      refs[i * 2 + 1] = (b[1] - 250) / 250;
    }

    // Initial-Upload der Buffers via TSL-Helper (instancedArray nimmt direkt
    // ArrayBuffer in den .array-Slot, dann needsUpdate=true).
    this._writeArrayBuffer(this.buffers.refs, refs);
    this._writeArrayBuffer(this.buffers.targets, shapeFlat);

    // Seeds + initiale Positionen + scaleVel
    const seeds = new Float32Array(N * 4);
    const positions = new Float32Array(N * 3);
    const scaleVel = new Float32Array(N * 2);
    for (let i = 0; i < N; i++) {
      seeds[i * 4 + 0] = Math.random();
      seeds[i * 4 + 1] = Math.random();
      seeds[i * 4 + 2] = Math.random();
      seeds[i * 4 + 3] = Math.random();
      positions[i * 3 + 0] = refs[i * 2 + 0];
      positions[i * 3 + 1] = refs[i * 2 + 1];
      positions[i * 3 + 2] = 0;
    }
    this._writeArrayBuffer(this.buffers.seeds, seeds);
    this._writeArrayBuffer(this.buffers.positions, positions);
    this._writeArrayBuffer(this.buffers.scaleVel, scaleVel);

    // Compute-Kernel
    this.simKernel = createSimulationKernel({
      buffers: this.buffers,
      uniforms: this.uniforms,
      count: N
    });

    // Material + Points-Mesh
    this.material = createParticleMaterial({
      buffers: this.buffers,
      uniforms: this.uniforms,
      glowTexture: sharedGlowTexture()
    });

    // SpriteNodeMaterial wird mit InstancedMesh + 1x1-Plane gerendert
    const geo = new THREE.PlaneGeometry(1, 1);
    this.mesh = new THREE.InstancedMesh(geo, this.material, N);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);

    // RenderPipeline (PostProcessing)
    this.pipeline = createRenderPipeline({
      renderer: this.renderer,
      scene: this.scene,
      camera: this.camera,
      uniforms: this.uniforms
    });

    // Mouse-Tracking + Resize
    this._setupMouseTracking();
    this._onResize = this.onResize.bind(this);
    window.addEventListener('resize', this._onResize);

    this._animate();
  }

  // instancedArray nimmt direkt ArrayBuffer via .value zuweisung in r184
  // (interner StorageBufferAttribute-Wrapper). Helper kapselt das wegen
  // moeglicher API-Drift zwischen Minor-Versions.
  _writeArrayBuffer(storageBufferNode, data) {
    const bufferAttr = storageBufferNode.value ?? storageBufferNode;
    if (bufferAttr.array) {
      bufferAttr.array.set(data);
      bufferAttr.needsUpdate = true;
    } else if (bufferAttr.buffer) {
      // Fallback fuer Renderer-spezifische Wrapper
      new Float32Array(bufferAttr.buffer).set(data);
    }
  }

  _setupMouseTracking() {
    this._onCanvasMouseMove = (e) => {
      if (!this.interactiveHover) return;
      const rect = this.canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this.mousePos.set(x, y);
      this.uniforms.uMouse.value = this.mousePos;
    };
    this._onCanvasMouseEnter = () => {
      if (!this.interactiveHover) return;
      gsap.to(this, {
        hoverProgress: 1.0,
        duration: 1.0,
        ease: 'power2.out',
        onUpdate: () => { this.uniforms.uIsHovering.value = this.hoverProgress; }
      });
    };
    this._onCanvasMouseLeave = () => {
      if (!this.interactiveHover) return;
      gsap.to(this, {
        hoverProgress: 0.0,
        duration: 1.2,
        ease: 'power2.inOut',
        onUpdate: () => { this.uniforms.uIsHovering.value = this.hoverProgress; }
      });
    };
    this._onMouseDown = () => {
      if (!this.interactiveHover) return;
      gsap.killTweensOf(this, { mouseDownProgress: true });
      gsap.to(this, {
        mouseDownProgress: 1.0,
        duration: 0.45,
        ease: 'power2.out',
        onUpdate: () => { this.uniforms.uMouseDown.value = this.mouseDownProgress; }
      });
      gsap.killTweensOf(this, { mouseMassProgress: true });
      gsap.to(this, {
        mouseMassProgress: 1.0,
        duration: 1.2,
        ease: 'power2.in',
        onUpdate: () => this.setMouseMass(this.mouseMassProgress)
      });
      this.triggerBurst(0.7);
    };
    this._onMouseUp = () => {
      if (!this.interactiveHover) return;
      gsap.killTweensOf(this, { mouseDownProgress: true });
      gsap.to(this, {
        mouseDownProgress: 0.0,
        duration: 0.75,
        ease: 'power2.out',
        onUpdate: () => { this.uniforms.uMouseDown.value = this.mouseDownProgress; }
      });
      gsap.killTweensOf(this, { mouseMassProgress: true });
      gsap.to(this, {
        mouseMassProgress: 0.0,
        duration: 0.6,
        ease: 'power2.out',
        onUpdate: () => this.setMouseMass(this.mouseMassProgress ?? 0)
      });
      this.triggerBurst(0.35);
    };

    this.canvas.addEventListener('mousemove', this._onCanvasMouseMove);
    this.canvas.addEventListener('mouseenter', this._onCanvasMouseEnter);
    this.canvas.addEventListener('mouseleave', this._onCanvasMouseLeave);
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
  }

  onResize() {
    if (this._disposed) return;
    const width  = this.canvas.clientWidth  || window.innerWidth;
    const height = this.canvas.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    const pixelRatio = this.renderer.getPixelRatio();
    this.uniforms.uParticleScale.value = (this.canvas.width / pixelRatio / 2000.0) * this.particlesScale;
  }

  _animate() {
    this._animationFrameId = requestAnimationFrame(() => this._animate());
    this._render();
  }

  async _render() {
    const elapsed = this.clock.getElapsedTime();
    const deltaTime = elapsed - this.lastTime;
    this.lastTime = elapsed;

    // Impulse-Decay (T2.2)
    if (this.impulseValue > 0.0005) {
      this.impulseValue *= Math.exp(-deltaTime * 5.0);
      this.uniforms.uImpulse.value = this.impulseValue;
    } else if (this.impulseValue !== 0) {
      this.impulseValue = 0;
      this.uniforms.uImpulse.value = 0;
    }

    this.uniforms.uTime.value = elapsed;

    // Compute-Pass: schreibt in positions/scaleVel-Buffer
    await this.renderer.computeAsync(this.simKernel);

    // Render-Pipeline (Scene + Post + Output)
    await this.pipeline.render();
  }

  // ===== Public API =====

  morphTo(index) {
    if (index < 0 || index > 5) return;
    this.activeTargetIndex = index;
    this.uniforms.uActiveShape.value = index;
    gsap.killTweensOf(this, { hoverProgress: true });
    gsap.to(this, {
      hoverProgress: 1.0,
      duration: 1.5,
      ease: 'power2.out',
      onUpdate: () => { this.uniforms.uIsHovering.value = this.hoverProgress; }
    });
  }

  morphToText(text, options = {}) {
    if (!text || text.length === 0) return;
    const textTargets = buildTextTargets({ text, count: this.count, font: options.font });
    // Schreibe in Slot 5 (das 6te Shape im Targets-Buffer)
    const bufferAttr = this.buffers.targets.value ?? this.buffers.targets;
    if (bufferAttr.array) {
      bufferAttr.array.set(textTargets, this.count * 5 * 2);
      bufferAttr.needsUpdate = true;
    }
    this.morphTo(5);
  }

  disperse() {
    gsap.killTweensOf(this, { hoverProgress: true });
    gsap.to(this, {
      hoverProgress: 0.0,
      duration: 1.5,
      ease: 'power2.inOut',
      onUpdate: () => { this.uniforms.uIsHovering.value = this.hoverProgress; }
    });
  }

  setColors(c1, c2, c3) {
    if (c1) { this.colors.color1.set(c1); this.uniforms.uColor1.value = this.colors.color1; }
    if (c2) { this.colors.color2.set(c2); this.uniforms.uColor2.value = this.colors.color2; }
    if (c3) { this.colors.color3.set(c3); this.uniforms.uColor3.value = this.colors.color3; }
  }

  setTheme(themeName) {
    // Legacy-Pfad: alter Code unterstuetzte light/dark Color-Scheme.
    // WebGPU-Pfad ist dark-only — wir setzen die Property, aber kein Effekt.
    this.theme = themeName;
  }

  setAudioBands(bass, mid, treble) {
    this.uniforms.uBassEnergy.value = bass;
    this.uniforms.uTrebleEnergy.value = treble;
    // Bloom-Strength live moduliert wie particles.js:724
    const base = this.postOptions.bloomStrength ?? 0.95;
    this.uniforms.uBloomStrength.value = base + bass * 0.6 + mid * 0.2;
  }

  setMouseMass(v) { this.uniforms.uMouseMass.value = v; }
  setAntiGravity(on) { this.uniforms.uAntiGravity.value = on ? 1.0 : 0.0; }

  triggerBurst(strength = 1.0) {
    this.impulseValue = Math.max(this.impulseValue, strength);
    this.uniforms.uImpulse.value = this.impulseValue;
  }

  triggerBurstAt(x, y, strength = 1.0) {
    this.uniforms.uMouse.value = this.mousePos.set(x, y);
    this.triggerBurst(strength);
  }

  setPulseProgress(progress) {
    this.pushProgress = progress;
    this.uniforms.uPulseProgress.value = progress;
  }

  dispose() {
    if (this._disposed) return;
    this._disposed = true;

    if (this._animationFrameId) cancelAnimationFrame(this._animationFrameId);
    this._animationFrameId = null;

    if (this._onResize) window.removeEventListener('resize', this._onResize);
    if (this._onMouseDown) window.removeEventListener('mousedown', this._onMouseDown);
    if (this._onMouseUp) window.removeEventListener('mouseup', this._onMouseUp);
    if (this._onCanvasMouseMove) {
      this.canvas.removeEventListener('mousemove', this._onCanvasMouseMove);
      this.canvas.removeEventListener('mouseenter', this._onCanvasMouseEnter);
      this.canvas.removeEventListener('mouseleave', this._onCanvasMouseLeave);
    }

    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh = null;
    }
    if (this.material) {
      this.material.dispose();
      this.material = null;
    }
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }
  }
}
