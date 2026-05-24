import { defineConfig } from 'vite';

// __WEBGPU__ ist ein Build-Time-Flag, ueber das main.js dynamisch zwischen
// dem alten WebGL-Pfad (particles.js) und dem neuen WebGPU/TSL-Pfad
// (src/webgpu/ParticleUniverse.js) waehlt. Cutover entfernt die Verzweigung.
const WEBGPU = process.env.WEBGPU === '1';

export default defineConfig({
  server: {
    port: 3000,
    open: false
  },
  // Splat-Assets als statische Files behandeln, kein Hashing/Inlining.
  assetsInclude: ['**/*.ksplat', '**/*.splat', '**/*.ply'],
  optimizeDeps: {
    entries: ['index.html'],
    // mkkellogg-Viewer hat eigene Worker-Bootstrap-Logik, Vite-Dep-Optimizer
    // zerlegt sie sonst inkonsistent.
    exclude: ['@mkkellogg/gaussian-splats-3d']
  },
  define: {
    __WEBGPU__: JSON.stringify(WEBGPU)
  },
  build: {
    // top-level await fuer dynamic import in main.js + WebGPU async init
    target: 'esnext',
    outDir: 'dist',
    minify: 'terser',
    rollupOptions: {
      input: {
        main: './index.html'
      }
    }
  }
});
