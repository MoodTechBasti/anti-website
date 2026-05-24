precision highp float;
attribute vec4 seeds;

uniform sampler2D uPosition;
uniform float uTime;
uniform float uParticleScale;
uniform float uPixelRatio;
uniform int uColorScheme;
uniform float uIsHovering;
uniform float uPulseProgress;
uniform float uBassEnergy;

varying vec4 vSeeds;
varying float vVelocity;
varying vec2 vLocalPos;
varying vec2 vScreenPos;
varying float vScale;
varying float vDepth;

// Simplex 3D Noise by Ian McEwan, Ashima Arts
vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
vec4 permute(vec4 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
float permute(float x) { return floor(mod(((x * 34.0) + 1.0) * x, 289.0)); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float taylorInvSqrt(float r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);

    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);

    vec3 x1 = x0 - i1 + 1.0 * C.xxx;
    vec3 x2 = x0 - i2 + 2.0 * C.xxx;
    vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;

    i = mod(i, 289.0);
    vec4 p = permute(permute(permute(
                i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));

    float n_ = 1.0 / 7.0;
    vec3 ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);

    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);

    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);

    vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

    vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1),
                                  dot(p2, x2), dot(p3, x3)));
}

void main() {
    vec4 pos = texture2D(uPosition, uv);
    vSeeds = seeds;

    // Position-Texture: xy = 2D-Position, z = scale (Sim-Output), w = velocity.
    // Eigene Z-Tiefe pro Partikel: persistente Verteilung via seeds.w → ±zRange.
    // Bass-Energy moduliert die Schwingungs-Amplitude.
    float zBase = (seeds.w - 0.5) * 0.65;
    float zSwell = sin(uTime * 0.6 + seeds.x * 6.28) * 0.08 * (0.5 + uBassEnergy * 1.5);
    float zCoord = zBase + zSwell;

    // 3D-Noise-Pertubation (statt wie vorher 2D mit Time als Z-Surrogate)
    vec3 noiseInput = vec3(pos.xy * 0.8, uTime * 0.18 + seeds.x * 10.0);
    float noiseX = snoise(noiseInput);
    float noiseY = snoise(noiseInput + vec3(100.0));
    float noiseZ = snoise(noiseInput + vec3(200.0));

    // Smooth disc pulse influence (für Tab-Switch-Pulse)
    float cDist = length(pos.xy);
    float progress = uPulseProgress;
    float t = smoothstep(progress - 0.25, progress, cDist) - smoothstep(progress, progress + 0.25, cDist);
    t *= smoothstep(1.0, 0.0, cDist);
    pos.xy *= 1.0 + (t * 0.02);

    float morphInfluence = smoothstep(0.0, 0.9, pos.w);
    morphInfluence = mix(0.0, morphInfluence, uIsHovering);

    pos.x += noiseX * 0.025 + noiseX * 0.005 * morphInfluence;
    pos.y += noiseY * 0.025 + noiseY * 0.005 * morphInfluence;
    zCoord += noiseZ * 0.04;

    vVelocity = pos.w;
    vScale = pos.z;
    vLocalPos = pos.xy;

    vec4 viewSpace = modelViewMatrix * vec4(pos.xy, zCoord, 1.0);
    gl_Position = projectionMatrix * viewSpace;
    vScreenPos = gl_Position.xy;

    // vDepth = positiver Abstand zur Kamera (für Fragment-Tiefen-Fade)
    vDepth = -viewSpace.z;

    float minScale = 0.25;
    minScale += float(uColorScheme) * 0.75;

    // Perspektivische Skalierung: 1/-mvPosition.z lässt entfernte Partikel schrumpfen.
    // Bass pumpt Partikel-Größe.
    float perspective = 300.0 / max(vDepth, 0.5);
    float bassPump = 1.0 + uBassEnergy * 0.6;
    gl_PointSize = ((vScale * 9.0) * (uPixelRatio * 0.5) * uParticleScale * bassPump * perspective * 0.06)
                 + (minScale * uPixelRatio);
}
