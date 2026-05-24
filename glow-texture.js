import * as THREE from 'three';

// Procedural Gauss-Glow-Sprite. Center pixel = (1,1,1,1), falloff exponentiell zum Rand.
// Result wird im Fragment-Shader via texture2D(uPointTex, gl_PointCoord) gesampelt
// und ersetzt den harten discard durch einen weichen Halo + dichten Kern.
export function generateGlowTexture(size = 64) {
    const data = new Uint8Array(size * size * 4);
    const radius = size / 2;
    const inner = size * 0.08;

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const dx = x - radius + 0.5;
            const dy = y - radius + 0.5;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const n = dist / radius;

            // Gauss-Halo + harte Core
            const halo = Math.exp(-n * n * 6.0);
            const core = Math.exp(-Math.max(0, dist - inner) * 0.35);
            const v = Math.min(1, halo * 0.55 + core * 0.55);

            const idx = (y * size + x) * 4;
            data[idx + 0] = 255;
            data[idx + 1] = 255;
            data[idx + 2] = 255;
            data[idx + 3] = Math.round(v * 255);
        }
    }

    const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    return tex;
}
