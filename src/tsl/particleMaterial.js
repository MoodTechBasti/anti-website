import * as THREE from 'three/webgpu';
import {
  Fn, instanceIndex, vec2, vec3, vec4, float, uv,
  positionLocal, modelViewMatrix, cameraProjectionMatrix,
  mix, smoothstep, clamp, sin, abs, length, texture, pointUV, normalize
} from 'three/tsl';

// PointsNodeMaterial mit Node-Graph statt GLSL. Portiert vertex_shader.glsl
// und fragment_shader.glsl 1:1, aber:
//   - Statt gl_PointSize: material.sizeNode
//   - Statt gl_PointCoord: pointUV in colorNode
//   - Statt sampler2D-uniform: texture(glowTex)
//   - Z-Tiefe ist jetzt direkt in positions.element(i).z (Buffer-Wert),
//     der Z-Swell-Math (Zeile 95-97 alt) bleibt im positionNode

export function createParticleMaterial({ buffers, uniforms, glowTexture }) {
  const { positions, seeds, scaleVel } = buffers;

  const mat = new THREE.SpriteNodeMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  // positionNode: ersetzt den vertex_shader.glsl-Hauptteil ab Zeile 88
  mat.positionNode = Fn(() => {
    const i = instanceIndex;
    const p = positions.element(i);          // vec3 (xy = sim plane, z = base depth slot, ignored here)
    const s = seeds.element(i);              // vec4
    const sv = scaleVel.element(i);          // vec2

    // Z-Swell (vertex_shader.glsl:95-97)
    const zBase = s.w.sub(0.5).mul(0.65);
    const zSwell = sin(uniforms.uTime.mul(0.6).add(s.x.mul(6.28))).mul(0.08).mul(float(0.5).add(uniforms.uBassEnergy.mul(1.5)));
    const zCoord = zBase.add(zSwell);

    // 3D-Noise-Pertubation kuerzten wir auf 2D-Curl im Sim — hier nur leichter Jitter
    // ueber Seeds als Persistenz (statt teurer 3D-Snoise pro Vertex pro Frame)
    const jitterX = sin(s.x.mul(12.0).add(uniforms.uTime.mul(0.3))).mul(0.025);
    const jitterY = sin(s.y.mul(12.0).add(uniforms.uTime.mul(0.27))).mul(0.025);

    // Tab-Switch-Pulse (vertex_shader.glsl:106-110)
    const cDist = length(p.xy);
    const t = smoothstep(uniforms.uPulseProgress.sub(0.25), uniforms.uPulseProgress, cDist)
      .sub(smoothstep(uniforms.uPulseProgress, uniforms.uPulseProgress.add(0.25), cDist));
    const pulseScale = float(1.0).add(t.mul(smoothstep(1.0, 0.0, cDist)).mul(0.02));

    // mesh.scale.set(5, -5, 5) → manuelle Anwendung als particles.js es so machte
    const x = p.x.add(jitterX).mul(pulseScale).mul(5.0);
    const y = p.y.add(jitterY).mul(pulseScale).mul(-5.0);
    const z = zCoord.mul(5.0);

    return vec3(x, y, z);
  })();

  // sizeNode: ersetzt gl_PointSize (vertex_shader.glsl:130-138)
  // SpriteNodeMaterial nimmt scaleNode (vec2). Wir geben isotropic.
  mat.scaleNode = Fn(() => {
    const sv = scaleVel.element(instanceIndex);
    const scale = sv.x;
    const bassPump = float(1.0).add(uniforms.uBassEnergy.mul(0.6));
    const finalScale = scale.mul(0.09).mul(uniforms.uParticleScale).mul(bassPump);
    return vec2(finalScale, finalScale);
  })();

  // colorNode: ersetzt fragment_shader.glsl komplett.
  // pointUV/uv() in SpriteNodeMaterial gibt das Quad-UV [0,1]^2.
  mat.colorNode = Fn(() => {
    const sv = scaleVel.element(instanceIndex);
    const s = seeds.element(instanceIndex);
    const velocity = sv.y;
    const scale = sv.x;

    // Glow-Sprite-Sampling
    const sprite = texture(glowTexture, uv());

    // Velocity → 3-Stop-Gradient (uColor1/2/3)
    const progress = clamp(velocity.mul(0.7), 0.0, 1.0);
    const baseColor = mix(
      mix(uniforms.uColor1, uniforms.uColor2, smoothstep(0.0, 0.5, progress)),
      mix(uniforms.uColor2, uniforms.uColor3, smoothstep(0.5, 1.0, progress)),
      smoothstep(0.5, 0.5001, progress)  // step(0.5,...) Aequivalent
    );

    // Treble-Shift Richtung Cyan
    const trebleShifted = mix(baseColor, vec3(0.55, 1.0, 1.0), uniforms.uTrebleEnergy.mul(0.35));

    // HDR-Pump
    const energy = float(1.0).add(velocity.mul(1.8)).add(uniforms.uBassEnergy.mul(1.2));
    const colored = trebleShifted.mul(energy);

    // Sub-Pixel-Twinkle
    const twinkle = vec3(0.5, 0.6, 1.0).mul(sin(uniforms.uTime.mul(2.0).add(s.x.mul(6.28)))).mul(0.05);
    const finalColor = colored.add(twinkle);

    // Alpha: sprite × scale-fade × global uAlpha (fuer Splat-Crossfade)
    const a = uniforms.uAlpha.mul(sprite.a).mul(smoothstep(0.05, 0.22, scale));

    return vec4(finalColor, a);
  })();

  return mat;
}
