import * as THREE from 'three';
import { gsap } from 'gsap';

import simulationShader from './simulation_shader.glsl?raw';
import vertexShader from './vertex_shader.glsl?raw';
import fragmentShader from './fragment_shader.glsl?raw';

import { generateGlowTexture } from './glow-texture.js';
import { createComposer } from './postprocessing.js';

// Geteilte Glow-Texture für alle Particle-Instanzen — eine GPU-Allokation reicht.
let sharedGlowTexture = null;
function getGlowTexture() {
    if (!sharedGlowTexture) sharedGlowTexture = generateGlowTexture(64);
    return sharedGlowTexture;
}

// Standard 2D Poisson Disk Sampling helper for base and target points
function generateBasePoints(density) {
    const minDst = ((density - 0) * (2 - 10)) / (300 - 0) + 10;
    const maxDst = ((density - 0) * (3 - 11)) / (300 - 0) + 11;
    const width = 500;
    const height = 500;
    const activeList = [];
    const samples = [];
    const cellSize = maxDst / Math.sqrt(2);
    const gridWidth = Math.ceil(width / cellSize);
    const gridHeight = Math.ceil(height / cellSize);
    const grid = new Int32Array(gridWidth * gridHeight).fill(-1);

    function getGridIndex(p) {
        const gx = Math.floor(p[0] / cellSize);
        const gy = Math.floor(p[1] / cellSize);
        return gx + gy * gridWidth;
    }

    function insertSample(p) {
        const idx = samples.length;
        samples.push(p);
        activeList.push(idx);
        grid[getGridIndex(p)] = idx;
    }

    insertSample([Math.random() * width, Math.random() * height]);

    const tries = 20;
    while (activeList.length > 0) {
        const activeIdx = activeList[Math.floor(Math.random() * activeList.length)];
        const p = samples[activeIdx];

        let gotSample = false;
        for (let t = 0; t < tries; t++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = minDst + Math.random() * (maxDst - minDst);
            const nx = p[0] + Math.cos(angle) * dist;
            const ny = p[1] + Math.sin(angle) * dist;
            const np = [nx, ny];

            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                let tooClose = false;
                const gx = Math.floor(nx / cellSize);
                const gy = Math.floor(ny / cellSize);
                const searchRadius = Math.ceil(maxDst / cellSize);

                for (let cx = -searchRadius; cx <= searchRadius && !tooClose; cx++) {
                    for (let cy = -searchRadius; cy <= searchRadius && !tooClose; cy++) {
                        const tgx = gx + cx;
                        const tgy = gy + cy;
                        if (tgx >= 0 && tgx < gridWidth && tgy >= 0 && tgy < gridHeight) {
                            const sIdx = grid[tgx + tgy * gridWidth];
                            if (sIdx !== -1) {
                                const sp = samples[sIdx];
                                const d = Math.sqrt((nx - sp[0]) ** 2 + (ny - sp[1]) ** 2);
                                if (d < minDst) {
                                    tooClose = true;
                                }
                            }
                        }
                    }
                }
                if (!tooClose) {
                    insertSample(np);
                    gotSample = true;
                    break;
                }
            }
        }
        if (!gotSample) {
            const idxInActive = activeList.indexOf(activeIdx);
            if (idxInActive !== -1) {
                activeList.splice(idxInActive, 1);
            }
        }
    }

    return samples;
}

// Generate the 2D ImageData for the 5 shapes
function getShapeImageData(shapeIndex) {
    const canvas = document.createElement('canvas');
    canvas.width = 500;
    canvas.height = 500;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 500, 500);
    ctx.fillStyle = '#000000';
    ctx.strokeStyle = '#000000';

    if (shapeIndex === 0) {
        ctx.font = 'bold 360px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('M', 250, 250);
    } else if (shapeIndex === 1) {
        ctx.font = 'bold 360px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('T', 250, 250);
    } else if (shapeIndex === 2) {
        ctx.lineWidth = 18;
        const cx = 250, cy = 250;
        const outerRadius = 140;
        const innerRadius = 90;
        const holeRadius = 35;
        const teeth = 8;
        const theta = Math.PI / teeth;

        ctx.beginPath();
        for (let i = 0; i < teeth * 2; i++) {
            const angle = i * theta;
            const r = i % 2 === 0 ? outerRadius : innerRadius;
            const x = cx + Math.cos(angle) * r;
            const y = cy + Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx, cy, holeRadius, 0, Math.PI * 2);
        ctx.stroke();
    } else if (shapeIndex === 3) {
        ctx.lineWidth = 15;
        const cx = 250, cy = 250;
        const r = 150;

        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(cx - r * 0.86, cy - r * 0.5);
        ctx.lineTo(cx + r * 0.86, cy - r * 0.5);
        ctx.moveTo(cx - r, cy);
        ctx.lineTo(cx + r, cy);
        ctx.moveTo(cx - r * 0.86, cy + r * 0.5);
        ctx.lineTo(cx + r * 0.86, cy + r * 0.5);
        ctx.stroke();

        ctx.beginPath();
        ctx.ellipse(cx, cy, r * 0.4, r, 0, 0, Math.PI * 2);
        ctx.ellipse(cx, cy, r * 0.7, r, 0, 0, Math.PI * 2);
        ctx.moveTo(cx, cy - r);
        ctx.lineTo(cx, cy + r);
        ctx.stroke();
    } else if (shapeIndex === 4) {
        ctx.lineWidth = 15;
        const cx = 250, cy = 250;
        const size = 120;
        const dx = size * Math.cos(Math.PI / 6);
        const dy = size * Math.sin(Math.PI / 6);

        const pCenter = [cx, cy];
        const pTop = [cx, cy - size];
        const pBottom = [cx, cy + size];
        const pTopLeft = [cx - dx, cy - dy];
        const pTopRight = [cx + dx, cy - dy];
        const pBottomLeft = [cx - dx, cy + dy];
        const pBottomRight = [cx + dx, cy + dy];

        ctx.beginPath();
        ctx.moveTo(pTop[0], pTop[1]);
        ctx.lineTo(pTopRight[0], pTopRight[1]);
        ctx.lineTo(pBottomRight[0], pBottomRight[1]);
        ctx.lineTo(pBottom[0], pBottom[1]);
        ctx.lineTo(pBottomLeft[0], pBottomLeft[1]);
        ctx.lineTo(pTopLeft[0], pTopLeft[1]);
        ctx.closePath();
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(pCenter[0], pCenter[1]);
        ctx.lineTo(pTop[0], pTop[1]);
        ctx.moveTo(pCenter[0], pCenter[1]);
        ctx.lineTo(pBottomLeft[0], pBottomLeft[1]);
        ctx.moveTo(pCenter[0], pCenter[1]);
        ctx.lineTo(pBottomRight[0], pBottomRight[1]);
        ctx.stroke();
    }

    return ctx.getImageData(0, 0, 500, 500);
}

class ParticlesMain {
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.theme = options.theme || 'dark';
        this.density = options.density !== undefined ? options.density : 100;
        this.particlesScale = options.particlesScale || 1.0;
        this.cameraZoom = options.cameraZoom || 10.0;

        this.colorScheme = this.theme === 'dark' ? 0 : 1;
        this.colors = {
            color1: new THREE.Color(options.color1 || '#ff3b30'),
            color2: new THREE.Color(options.color2 || '#007aff'),
            color3: new THREE.Color(options.color3 || '#34c759')
        };

        this.interactiveHover = options.interactiveHover !== undefined ? options.interactiveHover : true;
        this.hoverProgress = 0.0;
        this.pushProgress = 0.0;

        // Post-FX-Tuning pro Instanz: bloomStrength, bloomRadius, bloomThreshold,
        // chromaticOffset, filmIntensity, trails (bool), trailDamp (0..1).
        this.postOptions = options.post ?? {};

        // Impulse-Decay-State für T2.2 (Click-Explosion).
        this.impulseValue = 0.0;

        this.mousePos = new THREE.Vector2(0, 0);
        this.clock = new THREE.Clock();
        this.lastTime = 0;
        this.everRendered = false;

        this.activeTargetIndex = 0;
        this.nearestPointsData = [];
        this.targetTextures = [];
    }

    async init() {
        // Fallback auf window.innerWidth/Height, falls CSS-Layout noch nicht
        // geflusht ist (clientWidth/Height==0 bei font-blocking @import etc.).
        // Sonst camera.aspect=NaN und renderer.setSize(0,0) → schwarzer Canvas
        // bis zum ersten Resize-Event.
        const width  = this.canvas.clientWidth  || window.innerWidth;
        const height = this.canvas.clientHeight || window.innerHeight;

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
        this.camera.position.set(0, 0, this.cameraZoom);

        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: false, // EffectComposer macht eigenes AA via SMAA falls nötig
            alpha: true,
            powerPreference: 'high-performance'
        });
        this.renderer.setSize(width, height, false);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        // HDR-Pipeline: Fragment-Shader gibt >1.0-Werte aus, Bloom frisst sie auf,
        // ACES-Tone-Mapping (im OutputPass) komprimiert dann sauber zurück nach 0..1.
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.05;

        // Generate base points
        const basePoints = generateBasePoints(this.density);
        this.count = basePoints.length;

        // FBO texture setups
        this.size = 256;
        this.length = this.size * this.size;

        this.pointsData = [];
        for (let i = 0; i < basePoints.length; i++) {
            this.pointsData.push(basePoints[i][0] - 250, basePoints[i][1] - 250);
        }

        this.posTex = this.createDataTexturePosition(this.pointsData);

        // Pre-initialize targets using parallel Web Workers
        await this.initTargets(basePoints);

        this.rt1 = this.createRenderTarget();
        this.rt2 = this.createRenderTarget();

        // Clear targets
        this.renderer.setRenderTarget(this.rt1);
        this.renderer.setClearColor(new THREE.Color(0, 0, 0), 0);
        this.renderer.clear();
        this.renderer.setRenderTarget(this.rt2);
        this.renderer.clear();
        this.renderer.setRenderTarget(null);

        // FBO simulation setup
        this.simScene = new THREE.Scene();
        this.simCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

        const simVertexShader = `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = vec4(position, 1.0);
            }
        `;

        this.simMaterial = new THREE.ShaderMaterial({
            uniforms: {
                uPosition:    { value: this.posTex },
                uPosRefs:     { value: this.posTex },
                uPosNearest:  { value: this.posNearestTex },
                uMousePos:    { value: this.mousePos },
                uDeltaTime:   { value: 0 },
                uIsHovering:  { value: this.hoverProgress },
                uMouseDown:   { value: 0.0 },
                uMouseMass:   { value: 0.0 }, // T2.1 — r²-Gravity
                uImpulse:     { value: 0.0 }, // T2.2 — Click-Burst
                uBassEnergy:  { value: 0.0 }, // T2.3 — Audio
                uAntiGravity: { value: 0.0 }, // T5.1 — Konami
                uTime:        { value: 0 }
            },
            vertexShader: simVertexShader,
            fragmentShader: simulationShader
        });

        // Geometry-Ref festhalten, damit dispose() sie freigeben kann.
        this.simQuadGeometry = new THREE.PlaneGeometry(2, 2);
        const simQuad = new THREE.Mesh(this.simQuadGeometry, this.simMaterial);
        this.simScene.add(simQuad);

        // Particle mesh setup
        const particleGeo = new THREE.BufferGeometry();
        const uvsArray = new Float32Array(this.count * 2);
        const positionArray = new Float32Array(this.count * 3);
        const seedsArray = new Float32Array(this.count * 4);

        for (let i = 0; i < this.count; i++) {
            const u = ((i % this.size) + 0.5) / this.size;
            const v = (Math.floor(i / this.size) + 0.5) / this.size;
            uvsArray[i * 2 + 0] = u;
            uvsArray[i * 2 + 1] = v;

            seedsArray[i * 4 + 0] = Math.random();
            seedsArray[i * 4 + 1] = Math.random();
            seedsArray[i * 4 + 2] = Math.random();
            seedsArray[i * 4 + 3] = Math.random();
        }

        particleGeo.setAttribute('position', new THREE.BufferAttribute(positionArray, 3));
        particleGeo.setAttribute('uv', new THREE.BufferAttribute(uvsArray, 2));
        particleGeo.setAttribute('seeds', new THREE.BufferAttribute(seedsArray, 4));

        const pixelRatio = this.renderer.getPixelRatio();
        this.particleScale = (this.canvas.width / pixelRatio / 2000.0) * this.particlesScale;

        this.renderMaterial = new THREE.ShaderMaterial({
            uniforms: {
                uPosition: { value: this.posTex },
                uTime: { value: 0 },
                uColor1: { value: this.colors.color1 },
                uColor2: { value: this.colors.color2 },
                uColor3: { value: this.colors.color3 },
                uAlpha: { value: 1.0 },
                uIsHovering: { value: this.hoverProgress },
                uPulseProgress: { value: this.pushProgress },
                uMousePos: { value: this.mousePos },
                uRez: { value: new THREE.Vector2(width, height) },
                uParticleScale: { value: this.particleScale },
                uPixelRatio: { value: pixelRatio },
                uColorScheme: { value: this.colorScheme },
                uPointTex: { value: getGlowTexture() },
                uBassEnergy: { value: 0.0 },
                uTrebleEnergy: { value: 0.0 }
            },
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            transparent: true,
            depthTest: false,
            depthWrite: false,
            blending: THREE.AdditiveBlending // Glühende Partikel addieren sich
        });

        this.mesh = new THREE.Points(particleGeo, this.renderMaterial);
        // Flip y scale to match Canvas 2D orientation
        this.mesh.scale.set(5.0, -5.0, 5.0);
        this.scene.add(this.mesh);

        // Post-Processing-Pipeline (Bloom + Trails + Chromatic + Film)
        // Pro Instanz konfigurierbar via Constructor-Options.
        const postOptions = this.postOptions ?? {};
        this.post = createComposer(this.renderer, this.scene, this.camera, postOptions);

        // Bind events and start loops.
        // _onResize MUSS als named ref gespeichert werden, sonst kann
        // removeEventListener in dispose() ihn nicht mehr abmelden
        // (.bind erzeugt jedes Mal eine neue Funktion).
        this.setupMouseTracking();
        this._onResize = this.onResize.bind(this);
        window.addEventListener('resize', this._onResize);

        this.animate();
    }

    async initTargets(basePoints) {
        const promises = [];
        const numShapes = 5;
        for (let idx = 0; idx < numShapes; idx++) {
            const imgData = getShapeImageData(idx);
            promises.push(this.createPointsDistanceDataWorker(imgData, basePoints, idx));
        }
        const results = await Promise.all(promises);
        results.sort((a, b) => a.index - b.index);

        this.nearestPointsData = results.map(r => r.nearestPoints);
        this.targetTextures = this.nearestPointsData.map(data => this.createDataTexturePosition(data));
        this.posNearestTex = this.targetTextures[0];
    }

    createPointsDistanceDataWorker(imageData, pointsBase, index) {
        return new Promise((resolve, reject) => {
            const workerCode = `
                self.onmessage = function(e) {
                    const { imageData, pointsBase, index } = e.data;

                    const distanceFunction = function(point, imgData) {
                        const x = Math.round(point[0]);
                        const y = Math.round(point[1]);
                        if (x < 0 || x >= imgData.width || y < 0 || y >= imgData.height) return 1.0;
                        const pixelRedIndex = (x + y * imgData.width) * 4;
                        const pixel = imgData.data[pixelRedIndex] / 255;
                        return pixel * pixel * pixel;
                    };

                    const width = imageData.width;
                    const height = imageData.height;
                    const samples = [];

                    // Fast deterministic grid sampling of the shape contour
                    const step = 6;
                    for (let y = 0; y < height; y += step) {
                        for (let x = 0; x < width; x += step) {
                            const p = [x, y];
                            if (distanceFunction(p, imageData) < 0.95) {
                                samples.push(p);
                            }
                        }
                    }

                    if (samples.length === 0) {
                        samples.push([width / 2, height / 2]);
                    }

                    const nearestPoints = [];
                    for (let i = 0; i < pointsBase.length; i++) {
                        const nearestPoint = samples[i % samples.length];
                        nearestPoints.push(
                            nearestPoint[0] - 250,
                            nearestPoint[1] - 250
                        );
                    }

                    self.postMessage({ nearestPoints, index });
                };
            `;

            const blob = new Blob([workerCode], { type: 'application/javascript' });
            const blobUrl = URL.createObjectURL(blob);
            const worker = new Worker(blobUrl);

            worker.onmessage = (eData) => {
                const { nearestPoints, index: resIdx } = eData.data;
                worker.terminate();
                URL.revokeObjectURL(blobUrl);
                resolve({ nearestPoints, index: resIdx });
            };

            worker.onerror = (err) => {
                worker.terminate();
                URL.revokeObjectURL(blobUrl);
                reject(err);
            };

            worker.postMessage({
                imageData,
                pointsBase,
                index,
                density: this.density
            });
        });
    }

    createDataTexturePosition(coords) {
        const data = new Float32Array(this.length * 4);
        for (let i = 0; i < this.count; i++) {
            const o = i * 4;
            data[o + 0] = coords[i * 2 + 0] * (1 / 250);
            data[o + 1] = coords[i * 2 + 1] * (1 / 250);
            data[o + 2] = 0.0;
            data[o + 3] = 0.0;
        }

        const texture = new THREE.DataTexture(
            data,
            this.size,
            this.size,
            THREE.RGBAFormat,
            THREE.FloatType
        );
        texture.minFilter = THREE.NearestFilter;
        texture.magFilter = THREE.NearestFilter;
        texture.generateMipmaps = false;
        texture.flipY = false;
        texture.needsUpdate = true;
        return texture;
    }

    createRenderTarget() {
        return new THREE.WebGLRenderTarget(this.size, this.size, {
            wrapS: THREE.ClampToEdgeWrapping,
            wrapT: THREE.ClampToEdgeWrapping,
            minFilter: THREE.NearestFilter,
            magFilter: THREE.NearestFilter,
            format: THREE.RGBAFormat,
            type: THREE.FloatType,
            depthBuffer: false,
            stencilBuffer: false
        });
    }

    setupMouseTracking() {
        // Named refs, damit dispose() die Listener wieder abmelden kann.
        this._onCanvasMouseMove = (e) => {
            if (!this.interactiveHover) return;
            const rect = this.canvas.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            this.mousePos.set(x, y);
        };
        this._onCanvasMouseEnter = () => {
            if (!this.interactiveHover) return;
            gsap.to(this, {
                hoverProgress: 1.0,
                duration: 1.0,
                ease: 'power2.out',
                onUpdate: () => {
                    this.simMaterial.uniforms.uIsHovering.value = this.hoverProgress;
                    this.renderMaterial.uniforms.uIsHovering.value = this.hoverProgress;
                }
            });
        };
        this._onCanvasMouseLeave = () => {
            if (!this.interactiveHover) return;
            gsap.to(this, {
                hoverProgress: 0.0,
                duration: 1.2,
                ease: 'power2.inOut',
                onUpdate: () => {
                    this.simMaterial.uniforms.uIsHovering.value = this.hoverProgress;
                    this.renderMaterial.uniforms.uIsHovering.value = this.hoverProgress;
                }
            });
        };

        this.canvas.addEventListener('mousemove', this._onCanvasMouseMove);
        this.canvas.addEventListener('mouseenter', this._onCanvasMouseEnter);
        this.canvas.addEventListener('mouseleave', this._onCanvasMouseLeave);

        // Klick-Aktionen zur Steuerung der uMouseDown Singularität
        this.mouseDownProgress = 0.0;
        this._onMouseDown = () => {
            if (!this.interactiveHover) return;
            gsap.killTweensOf(this, { mouseDownProgress: true });
            gsap.to(this, {
                mouseDownProgress: 1.0,
                duration: 0.45,
                ease: 'power2.out',
                onUpdate: () => {
                    this.simMaterial.uniforms.uMouseDown.value = this.mouseDownProgress;
                }
            });
            // T2.1 — Halten erhöht Mass (Sog wächst)
            gsap.killTweensOf(this, { mouseMassProgress: true });
            this.mouseMassProgress = this.mouseMassProgress ?? 0;
            gsap.to(this, {
                mouseMassProgress: 1.0,
                duration: 1.2,
                ease: 'power2.in',
                onUpdate: () => this.setMouseMass(this.mouseMassProgress)
            });
            // T2.2 — sofortiger Burst-Trigger
            this.triggerBurst(0.7);
        };

        this._onMouseUp = () => {
            if (!this.interactiveHover) return;
            gsap.killTweensOf(this, { mouseDownProgress: true });
            gsap.to(this, {
                mouseDownProgress: 0.0,
                duration: 0.75,
                ease: 'power2.out',
                onUpdate: () => {
                    this.simMaterial.uniforms.uMouseDown.value = this.mouseDownProgress;
                }
            });
            // T2.1 — Loslassen entspannt Mass
            gsap.killTweensOf(this, { mouseMassProgress: true });
            gsap.to(this, {
                mouseMassProgress: 0.0,
                duration: 0.6,
                ease: 'power2.out',
                onUpdate: () => this.setMouseMass(this.mouseMassProgress ?? 0)
            });
            // T2.2 — beim Release noch ein kleiner Echo-Burst
            this.triggerBurst(0.35);
        };

        window.addEventListener('mousedown', this._onMouseDown);
        window.addEventListener('mouseup', this._onMouseUp);
    }

    onResize() {
        if (this._disposed) return; // Defensive: Listener-Leak-Schutz fuer Altlasten.
        const width  = this.canvas.clientWidth  || window.innerWidth;
        const height = this.canvas.clientHeight || window.innerHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize(width, height, false);

        const pixelRatio = this.renderer.getPixelRatio();
        this.particleScale = (this.canvas.width / pixelRatio / 2000.0) * this.particlesScale;

        this.renderMaterial.uniforms.uRez.value.set(width, height);
        this.renderMaterial.uniforms.uPixelRatio.value = pixelRatio;
        this.renderMaterial.uniforms.uParticleScale.value = this.particleScale;
        this.renderMaterial.needsUpdate = true;

        if (this.post) this.post.resize(width, height);
    }

    animate() {
        this.animationFrameId = requestAnimationFrame(this.animate.bind(this));
        this.render();
    }

    render() {
        const elapsed = this.clock.getElapsedTime();
        const deltaTime = elapsed - this.lastTime;
        this.lastTime = elapsed;

        // Impulse-Decay (T2.2): exponentielles Abklingen ohne weiteren Trigger
        if (this.impulseValue > 0.0005) {
            this.impulseValue *= Math.exp(-deltaTime * 5.0);
            this.simMaterial.uniforms.uImpulse.value = this.impulseValue;
        } else if (this.impulseValue !== 0) {
            this.impulseValue = 0;
            this.simMaterial.uniforms.uImpulse.value = 0;
        }

        // Step 1: FBO Physics Simulation
        this.simMaterial.uniforms.uPosition.value = this.everRendered ? this.rt1.texture : this.posTex;
        this.simMaterial.uniforms.uTime.value = elapsed;
        this.simMaterial.uniforms.uDeltaTime.value = deltaTime;
        this.simMaterial.uniforms.uMousePos.value = this.mousePos;
        this.simMaterial.uniforms.uPosNearest.value = this.posNearestTex;

        this.renderer.setRenderTarget(this.rt2);
        this.renderer.render(this.simScene, this.simCamera);
        this.renderer.setRenderTarget(null);

        // Step 2: Particle-Material uses sim output
        this.renderMaterial.uniforms.uPosition.value = this.rt2.texture;
        this.renderMaterial.uniforms.uTime.value = elapsed;
        this.renderMaterial.uniforms.uMousePos.value = this.mousePos;
        this.renderMaterial.uniforms.uParticleScale.value = this.particleScale;

        // Step 3: Composer rendert Scene → Trail → Bloom → Chromatic → Film → Output.
        // Fällt zurück auf direct render, falls Composer nicht initialisiert.
        if (this.post) {
            this.post.composer.render(deltaTime);
        } else {
            this.renderer.render(this.scene, this.camera);
        }

        // Step 4: Swap double buffers
        const temp = this.rt1;
        this.rt1 = this.rt2;
        this.rt2 = temp;
        this.everRendered = true;
    }

    // T2.1 — Public API: setze Maus-Gravitations-Sog (0..1).
    setMouseMass(v) {
        if (this.simMaterial) this.simMaterial.uniforms.uMouseMass.value = v;
    }

    // T2.2 — Public API: triggere Explosion vom aktuellen Maus-Punkt.
    triggerBurst(strength = 1.0) {
        this.impulseValue = Math.max(this.impulseValue, strength);
        if (this.simMaterial) this.simMaterial.uniforms.uImpulse.value = this.impulseValue;
    }

    // Bonus: Burst von beliebiger Position (im sim-space, normalerweise -0.5..0.5).
    // Setzt mousePos temporär, decay des Impulses sorgt für sauberen Burst.
    triggerBurstAt(x, y, strength = 1.0) {
        if (!this.simMaterial) return;
        this.simMaterial.uniforms.uMousePos.value.set(x, y);
        this.triggerBurst(strength);
    }

    // T2.3 — Public API: speist Audio-Bands ein.
    setAudioBands(bass, mid, treble) {
        if (this.simMaterial)    this.simMaterial.uniforms.uBassEnergy.value = bass;
        if (this.renderMaterial) {
            this.renderMaterial.uniforms.uBassEnergy.value = bass;
            this.renderMaterial.uniforms.uTrebleEnergy.value = treble;
        }
        if (this.post?.passes?.bloom) {
            this.post.passes.bloom.strength = (this.postOptions.bloomStrength ?? 0.95)
                                            + bass * 0.6 + mid * 0.2;
        }
    }

    // T5.1 — Public API: toggle Anti-Gravity-Easter-Egg.
    setAntiGravity(on) {
        if (this.simMaterial) this.simMaterial.uniforms.uAntiGravity.value = on ? 1.0 : 0.0;
    }

    // Public API Methods

    // T2.4 — Morph zu einer Live-erzeugten Wort-Shape.
    // text: String, options: { font, size }
    morphToText(text, options = {}) {
        const font = options.font || 'bold 360px sans-serif';
        const size = 500;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, size, size);
        ctx.fillStyle = '#000000';
        ctx.font = font;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Auto-Fit: schrumpfe Font bis es passt
        let fontSize = 360;
        while (ctx.measureText(text).width > size * 0.88 && fontSize > 30) {
            fontSize -= 10;
            ctx.font = `bold ${fontSize}px sans-serif`;
        }
        ctx.fillText(text, size / 2, size / 2);

        const imageData = ctx.getImageData(0, 0, size, size);
        const samples = [];
        const step = 4;
        for (let y = 0; y < size; y += step) {
            for (let x = 0; x < size; x += step) {
                const idx = (x + y * size) * 4;
                const v = imageData.data[idx] / 255;
                if (v * v * v < 0.95) samples.push([x, y]);
            }
        }
        if (samples.length === 0) samples.push([size / 2, size / 2]);

        const nearestPoints = new Float32Array(this.count * 2);
        for (let i = 0; i < this.count; i++) {
            const p = samples[i % samples.length];
            nearestPoints[i * 2 + 0] = p[0] - 250;
            nearestPoints[i * 2 + 1] = p[1] - 250;
        }
        const tex = this.createDataTexturePosition(Array.from(nearestPoints));
        this._textShapeTex?.dispose?.();
        this._textShapeTex = tex;
        this.posNearestTex = tex;
        this.simMaterial.uniforms.uPosNearest.value = tex;

        gsap.killTweensOf(this);
        gsap.to(this, {
            hoverProgress: 1.0,
            duration: 1.0,
            ease: 'power3.inOut',
            onUpdate: () => {
                this.simMaterial.uniforms.uIsHovering.value = this.hoverProgress;
                this.renderMaterial.uniforms.uIsHovering.value = this.hoverProgress;
            }
        });
    }

    morphTo(index) {
        if (index < 0 || index >= this.targetTextures.length) return;
        this.activeTargetIndex = index;
        this.posNearestTex = this.targetTextures[index];
        this.simMaterial.uniforms.uPosNearest.value = this.posNearestTex;

        gsap.killTweensOf(this);
        gsap.to(this, {
            hoverProgress: 1.0,
            duration: 1.5,
            ease: 'power2.out',
            onUpdate: () => {
                this.simMaterial.uniforms.uIsHovering.value = this.hoverProgress;
                this.renderMaterial.uniforms.uIsHovering.value = this.hoverProgress;
            }
        });
    }

    disperse() {
        gsap.killTweensOf(this);
        gsap.to(this, {
            hoverProgress: 0.0,
            duration: 1.5,
            ease: 'power2.inOut',
            onUpdate: () => {
                this.simMaterial.uniforms.uIsHovering.value = this.hoverProgress;
                this.renderMaterial.uniforms.uIsHovering.value = this.hoverProgress;
            }
        });
    }

    setColors(c1, c2, c3) {
        if (c1) {
            this.colors.color1.set(c1);
            this.renderMaterial.uniforms.uColor1.value.copy(this.colors.color1);
        }
        if (c2) {
            this.colors.color2.set(c2);
            this.renderMaterial.uniforms.uColor2.value.copy(this.colors.color2);
        }
        if (c3) {
            this.colors.color3.set(c3);
            this.renderMaterial.uniforms.uColor3.value.copy(this.colors.color3);
        }
    }

    setTheme(themeName) {
        this.theme = themeName;
        this.colorScheme = themeName === 'dark' ? 0 : 1;
        this.renderMaterial.uniforms.uColorScheme.value = this.colorScheme;
        this.renderMaterial.needsUpdate = true;
    }

    setPulseProgress(progress) {
        this.pushProgress = progress;
        this.renderMaterial.uniforms.uPulseProgress.value = this.pushProgress;
    }

    dispose() {
        // Idempotent: schuetzt vor mehrfachem Aufruf via window-Aliase
        // (heroParticles/leftParticles/rightParticles/formParticles zeigen
        // alle auf dieselbe Instanz).
        if (this._disposed) return;
        this._disposed = true;

        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        // Listener-Cleanup — alle mit gespeicherter Referenz, sonst greift
        // removeEventListener nicht (bind erzeugt neue Funktion).
        if (this._onResize) {
            window.removeEventListener('resize', this._onResize);
            this._onResize = null;
        }
        if (this._onMouseDown) {
            window.removeEventListener('mousedown', this._onMouseDown);
            this._onMouseDown = null;
        }
        if (this._onMouseUp) {
            window.removeEventListener('mouseup', this._onMouseUp);
            this._onMouseUp = null;
        }
        if (this._onCanvasMouseMove) {
            this.canvas.removeEventListener('mousemove', this._onCanvasMouseMove);
            this.canvas.removeEventListener('mouseenter', this._onCanvasMouseEnter);
            this.canvas.removeEventListener('mouseleave', this._onCanvasMouseLeave);
            this._onCanvasMouseMove = null;
            this._onCanvasMouseEnter = null;
            this._onCanvasMouseLeave = null;
        }

        // Composer + alle Passes (Bloom mit Mipmap-Chain, Afterimage mit
        // Ping-Pong-Targets, ChromaticShaderPass, FilmPass, OutputPass)
        // halten je eigene RenderTargets/Materials. composer.dispose alleine
        // reicht nicht — Passes explizit auflisten.
        if (this.post?.composer) {
            try {
                this.post.composer.passes.forEach(p => {
                    if (typeof p.dispose === 'function') p.dispose();
                });
                if (typeof this.post.composer.dispose === 'function') {
                    this.post.composer.dispose();
                }
            } catch (e) {
                console.warn('Composer dispose warning:', e);
            }
            this.post = null;
        }

        if (this.mesh) {
            this.scene.remove(this.mesh);
            this.mesh.geometry.dispose();
            this.mesh.material.dispose();
            this.mesh = null;
        }

        if (this.simScene) this.simScene.clear();
        if (this.simQuadGeometry) {
            this.simQuadGeometry.dispose();
            this.simQuadGeometry = null;
        }
        if (this.simMaterial) {
            this.simMaterial.dispose();
            this.simMaterial = null;
        }

        if (this.rt1) { this.rt1.dispose(); this.rt1 = null; }
        if (this.rt2) { this.rt2.dispose(); this.rt2 = null; }
        if (this.posTex) { this.posTex.dispose(); this.posTex = null; }

        this.targetTextures.forEach(tex => {
            if (tex) tex.dispose();
        });
        this.targetTextures = [];

        if (this.renderer) {
            this.renderer.dispose();
            this.renderer = null;
        }
    }
}

// Attach API directly to window for simple hook-ups in main.js
window.ParticlesMain = ParticlesMain;

export default ParticlesMain;
