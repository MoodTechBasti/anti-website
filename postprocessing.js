import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { AfterimagePass } from 'three/examples/jsm/postprocessing/AfterimagePass.js';
import { FilmPass } from 'three/examples/jsm/postprocessing/FilmPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

// Chromatic Aberration — RGB-Kanäle leicht versetzt abtasten.
// Intensität wächst radial vom Bildzentrum nach außen (wie eine Anamorphote-Linse).
const ChromaticAberrationShader = {
    uniforms: {
        tDiffuse: { value: null },
        uOffset:  { value: 0.0025 },
        uRez:     { value: new THREE.Vector2(1, 1) }
    },
    vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: /* glsl */ `
        precision highp float;
        uniform sampler2D tDiffuse;
        uniform float uOffset;
        varying vec2 vUv;
        void main() {
            vec2 dir = vUv - 0.5;
            float radial = dot(dir, dir);
            vec2 off = dir * uOffset * (0.5 + radial * 3.0);

            float r = texture2D(tDiffuse, vUv + off).r;
            float g = texture2D(tDiffuse, vUv).g;
            float b = texture2D(tDiffuse, vUv - off).b;
            float a = texture2D(tDiffuse, vUv).a;
            gl_FragColor = vec4(r, g, b, a);
        }
    `
};

export function createComposer(renderer, scene, camera, options = {}) {
    const width = renderer.domElement.clientWidth;
    const height = renderer.domElement.clientHeight;

    const composer = new EffectComposer(renderer);
    composer.setSize(width, height);
    composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    composer.addPass(new RenderPass(scene, camera));

    // Trails — Vorgänger-Frame fadet langsam aus, neue Frames darüber blendend.
    const afterimage = new AfterimagePass(options.trailDamp ?? 0.88);
    afterimage.enabled = options.trails !== false;
    composer.addPass(afterimage);

    // Bloom — der Hauptgrund, warum HDR-Colors (>1.0) im Fragment-Shader sinnvoll sind.
    const bloom = new UnrealBloomPass(
        new THREE.Vector2(width, height),
        options.bloomStrength ?? 0.95,
        options.bloomRadius ?? 0.55,
        options.bloomThreshold ?? 0.18
    );
    composer.addPass(bloom);

    // Chromatic Aberration — winzig, wirkt "Linsen-physikalisch" statt billig.
    const chromatic = new ShaderPass(ChromaticAberrationShader);
    chromatic.uniforms.uRez.value.set(width, height);
    chromatic.uniforms.uOffset.value = options.chromaticOffset ?? 0.0022;
    composer.addPass(chromatic);

    // Film — subtiles Grain, killt sichtbares Color-Banding bei Glow-Übergängen.
    // FilmPass (modern API) takes (intensity, grayscale).
    const film = new FilmPass(options.filmIntensity ?? 0.18, false);
    composer.addPass(film);

    composer.addPass(new OutputPass());

    return {
        composer,
        passes: { afterimage, bloom, chromatic, film },
        resize(w, h) {
            // setPixelRatio neu anwenden, damit Multi-Monitor-DPR-Wechsel
            // (Drag Window zwischen Retina und 1x-Display) korrekt funktioniert.
            // setPixelRatio ruft intern setSize, deshalb explicit zuerst.
            composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            composer.setSize(w, h);
            chromatic.uniforms.uRez.value.set(w, h);
            bloom.setSize(w, h);
        }
    };
}
