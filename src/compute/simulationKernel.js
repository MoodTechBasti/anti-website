import {
  Fn, instanceIndex, uniform, vec2, vec3, vec4, float, int,
  If, select, mix, length, normalize, smoothstep, step, abs, exp,
  sin, cos, floor, fract, mod, max as tslMax, min as tslMin, clamp,
  dot
} from 'three/tsl';
import * as THREE from 'three/webgpu';

// TSL-Port der gesamten Physik aus simulation_shader.glsl.
// Verglichen mit dem alten GLSL-Pfad:
//
//   alt: 256x256 RGBA-Float-FBO Ping-Pong, jeden Frame Texture-Read+Write
//   neu: instancedArray vec3, direct read/write im selben Buffer (atomic
//        nicht noetig weil jeder Partikel nur seine eigene Zelle anfasst)
//
// Funktional 1:1 portiert, inklusive:
//   - Per-Particle-Stagger fuer Morph (alte simulation_shader Zeile 83-87)
//   - Anti-Gravity-Polarity-Flip (Zeile 127-128)
//   - Curl-Noise-Drift mit Bass/Transition-Boost (Zeile 100-106)
//   - r2-Gravity + Vortex + Push + Pull (Zeile 108-129)
//   - Click-Impulse-Burst (Zeile 131-136)
//   - Lifetime-Respawn (Zeile 138-142)
//   - Scale-Steuerung mit Bass-Pump (Zeile 144-150)

// Simplex 2D Noise als TSL-Fn — Ashima-Arts-Permute, identisch zu noise.glsl.
const permuteV3 = Fn(([x]) => {
  return x.mul(34.0).add(1.0).mul(x).mod(289.0);
});

const snoise2 = Fn(([v]) => {
  const C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  const i  = floor(v.add(dot(v, C.yy)));
  const x0 = v.sub(i).add(dot(i, C.xx));
  const i1 = select(x0.x.greaterThan(x0.y), vec2(1.0, 0.0), vec2(0.0, 1.0));
  const x12 = x0.xyxy.add(C.xxzz).toVar();
  x12.xy.subAssign(i1);
  const iMod = i.mod(289.0);
  const p = permuteV3(
    permuteV3(iMod.y.add(vec3(0.0, i1.y, 1.0)))
      .add(iMod.x)
      .add(vec3(0.0, i1.x, 1.0))
  );
  const m0 = tslMax(
    float(0.5).sub(vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw))),
    float(0.0)
  );
  const m1 = m0.mul(m0);
  const m  = m1.mul(m1);
  const xx = fract(p.mul(C.www)).mul(2.0).sub(1.0);
  const h  = abs(xx).sub(0.5);
  const a0 = xx.sub(floor(xx.add(0.5)));
  const mm = m.mul(float(1.79284291400159).sub(float(0.85373472095314).mul(a0.mul(a0).add(h.mul(h)))));
  const g = vec3(
    a0.x.mul(x0.x).add(h.x.mul(x0.y)),
    a0.y.mul(x12.x).add(h.y.mul(x12.y)),
    a0.z.mul(x12.z).add(h.z.mul(x12.w))
  );
  return float(130.0).mul(dot(mm, g));
});

const curlNoise2 = Fn(([p, time]) => {
  const eps = float(0.005);
  const n1 = snoise2(p.add(vec2(0.0, eps.x)).add(time));
  const n2 = snoise2(p.sub(vec2(0.0, eps.x)).add(time));
  const n3 = snoise2(p.add(vec2(eps.x, 0.0)).add(time));
  const n4 = snoise2(p.sub(vec2(eps.x, 0.0)).add(time));
  return vec2(n1.sub(n2).div(eps.mul(2.0)), n3.sub(n4).div(eps.mul(2.0)).negate());
});

const hash2 = Fn(([p]) => {
  const q = fract(sin(p.mul(vec2(2127.1, 81.17))).mul(43758.5453));
  return q;
});

export function createSimulationKernel({ buffers, uniforms, count }) {
  const { positions, refs, targets, seeds, scaleVel } = buffers;
  const N = int(count);

  const kernel = Fn(() => {
    const i = instanceIndex;

    const pPrev = positions.element(i).toVar();        // vec3 (pos in -1..1 plane)
    const refPos = refs.element(i);                    // vec2
    const sv = scaleVel.element(i).toVar();            // vec2 (scale, |v|)
    const s = seeds.element(i);                        // vec4 (h.x,h.y,h.z,h.w)

    // Active shape lookup: targets[uActiveShape * N + i].
    // Plus 6tes Slot fuer morphToText, deshalb uActiveShape kann bis 5 gehen.
    const activeOffset = uniforms.uActiveShape.mul(N);
    const nearestPos = targets.element(activeOffset.add(i));

    const h = vec2(s.x, s.y);
    const pos = pPrev.xy.toVar();
    const time = uniforms.uTime.mul(0.5);

    // Lifetime-Respawn — 1:1 aus simulation_shader.glsl:74-76, 138-142
    const lifeEnd = float(3.0).add(sin(h.y.mul(100.0)).mul(1.0));
    const lifeTime = h.x.mul(100.0).add(time).mod(lifeEnd);

    // Stagger-Morph: jeder Partikel hat eigene Morph-Phase (Zeile 83-84)
    const particlePhase = clamp(uniforms.uIsHovering.sub(h.x.mul(0.45)).div(0.55), 0.0, 1.0);
    const morphInfluence = particlePhase.mul(particlePhase);

    // Target-Anziehung
    const targetPos = mix(refPos, nearestPos, morphInfluence);
    const toTarget = targetPos.sub(pos);
    const dist = length(toTarget);
    const distRadius = float(0.25);
    const distStrength = smoothstep(distRadius, 0.0, dist);

    If(dist.greaterThan(0.003), () => {
      const dirN = toTarget.div(dist);
      pos.addAssign(dirN.mul(0.012).mul(distStrength).mul(float(1.0).sub(uniforms.uAntiGravity)));
    });

    // Transition-Boost fuer Curl-Drift (Zeile 98)
    const transitionEnergy = float(4.0).mul(morphInfluence).mul(float(1.0).sub(morphInfluence));

    // Curl-Drift (Zeile 100-106)
    const drift = curlNoise2(pos.mul(2.2), uniforms.uTime.mul(0.12));
    const driftAmp = float(0.0009).mul(float(1.0).sub(uniforms.uIsHovering.mul(0.85)))
      .add(float(0.0008).mul(uniforms.uBassEnergy))
      .add(float(0.0025).mul(uniforms.uAntiGravity))
      .add(float(0.0035).mul(transitionEnergy));
    pos.addAssign(drift.mul(driftAmp));

    // Maus-Interaktion (Zeile 108-129)
    const toMouse = pos.sub(uniforms.uMouse);
    const mouseDist = length(toMouse);
    const mouseRadius = float(0.40);

    If(mouseDist.lessThan(mouseRadius).and(mouseDist.greaterThan(0.0001)), () => {
      const dirN = toMouse.div(mouseDist);
      const fLinear = smoothstep(mouseRadius, 0.0, mouseDist);

      // r2-Gravity (T2.1) mit Singularitaets-Cap
      const invSq = tslMin(
        float(1.0).div(mouseDist.mul(mouseDist).mul(50.0).add(0.05)),
        float(8.0)
      );

      const pushForce = dirN.mul(fLinear).mul(0.018).mul(float(1.0).sub(uniforms.uMouseDown));
      const pullForce = dirN.negate().mul(fLinear).mul(0.015).mul(uniforms.uMouseDown);
      const vortex = vec2(toMouse.y.negate(), toMouse.x).div(mouseDist).mul(fLinear).mul(0.028).mul(uniforms.uMouseDown);
      const gravity = dirN.negate().mul(invSq).mul(0.0015).mul(uniforms.uMouseMass);

      const polarity = float(1.0).sub(uniforms.uAntiGravity.mul(2.0));
      pos.addAssign(
        pushForce.add(pullForce).add(vortex).add(gravity).mul(uniforms.uIsHovering).mul(polarity)
      );
    });

    // Click-Impulse-Burst (T2.2 — Zeile 131-136)
    If(uniforms.uImpulse.greaterThan(0.001).and(mouseDist.lessThan(0.6)).and(mouseDist.greaterThan(0.0001)), () => {
      const burstDir = toMouse.div(mouseDist);
      const burstFall = exp(mouseDist.mul(-4.0));
      pos.addAssign(burstDir.mul(uniforms.uImpulse).mul(burstFall).mul(0.06));
    });

    // Lifetime-Respawn an Ref-Position
    const scaleVar = sv.x.toVar();
    If(lifeTime.lessThan(0.01), () => {
      pos.assign(refPos);
      scaleVar.assign(0.0);
    });

    // Scale-Steuerung (Zeile 144-150)
    const targetScale = smoothstep(0.01, 0.5, lifeTime)
      .sub(smoothstep(0.5, 1.0, lifeTime.div(lifeEnd)))
      .add(smoothstep(0.1, 0.0, smoothstep(0.001, 0.1, dist)).mul(1.8).mul(uniforms.uIsHovering))
      .add(uniforms.uBassEnergy.mul(0.35));
    scaleVar.addAssign(targetScale.sub(scaleVar).mul(0.15));

    // Velocity-Magnitude fuer Material-Pfad (kinetische Einfaerbung)
    const diff = pos.sub(pPrev.xy).mul(0.25);
    const velocity = length(diff).mul(12.0).mul(tslMax(uniforms.uIsHovering, uniforms.uAntiGravity.mul(0.15)));

    // Write back
    positions.element(i).assign(vec3(pPrev.xy.add(diff), pPrev.z));
    scaleVel.element(i).assign(vec2(scaleVar, velocity));
  })().compute(count);

  return kernel;
}
