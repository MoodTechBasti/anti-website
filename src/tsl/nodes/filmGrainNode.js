import { Fn, vec3, vec4, float, uv, sin, fract, dot, mix } from 'three/tsl';

// Film-Grain — subtiler Noise overlay, killt Color-Banding bei Glow-Uebergaengen.
// Aequivalent zu FilmPass(intensity, false) im alten postprocessing.js.

const rand = Fn(([co]) => {
  return fract(sin(dot(co, vec3(12.9898, 78.233, 45.164))).mul(43758.5453));
});

export const filmGrain = Fn(([sceneTex, intensity, time]) => {
  const c = sceneTex.sample(uv());
  const n = rand(vec3(uv().x, uv().y, time));
  return vec4(mix(c.rgb, c.rgb.mul(float(1.0).add(n.sub(0.5).mul(0.6))), intensity), c.a);
});
