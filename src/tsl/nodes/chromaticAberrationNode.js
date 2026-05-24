import { Fn, vec2, vec3, vec4, float, uv, dot } from 'three/tsl';

// Chromatic Aberration: R/G/B-Kanaele radial versetzt.
// 1:1 portiert aus postprocessing.js ChromaticAberrationShader.
// Wird im Pipeline als Node ueber den vorigen Pass gelegt.

export const chromaticAberration = Fn(([sceneTex, offset]) => {
  const center = uv().sub(0.5);
  const radial = dot(center, center);
  const off = center.mul(offset).mul(float(0.5).add(radial.mul(3.0)));

  const r = sceneTex.sample(uv().add(off)).r;
  const g = sceneTex.sample(uv()).g;
  const b = sceneTex.sample(uv().sub(off)).b;
  const a = sceneTex.sample(uv()).a;
  return vec4(r, g, b, a);
});
