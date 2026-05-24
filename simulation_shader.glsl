precision highp float;

uniform sampler2D uPosition;
uniform sampler2D uPosRefs;
uniform sampler2D uPosNearest;

uniform vec2 uMousePos;
uniform float uTime;
uniform float uDeltaTime;
uniform float uIsHovering;
uniform float uMouseDown;     // Weich interpolierter Klick-Zustand
uniform float uMouseMass;     // T2.1: r²-Gravitations-Sog beim Halten, 0..1
uniform float uImpulse;       // T2.2: kurze Explosion bei Click-Edge, 0..1, decay
uniform float uBassEnergy;    // T2.3: Audio-Reactor, 0..1
uniform float uAntiGravity;   // T5.1: Easter-Egg, 0 oder 1

// Simplex 2D Noise (Ashima Arts) — Basis für Curl-Felder
vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }

float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
             -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1;
    i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod(i, 289.0);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
                          + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy),
                             dot(x12.zw, x12.zw)), 0.0);
    m = m * m;
    m = m * m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 a0 = x - floor(x + 0.5);
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    vec3 g;
    g.x  = a0.x  * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
}

// 2D Curl-Noise (divergenzfreies Strömungsfeld). Z-Drift kommt im Vertex-Shader
// dazu, hier reicht 2D — der Sim-State ist xy=Position, z=Scale, w=Velocity.
vec2 curlNoise(vec2 p, float time) {
    float eps = 0.005;
    float n1 = snoise(p + vec2(0.0, eps) + time);
    float n2 = snoise(p - vec2(0.0, eps) + time);
    float n3 = snoise(p + vec2(eps, 0.0) + time);
    float n4 = snoise(p - vec2(eps, 0.0) + time);
    return vec2((n1 - n2) / (2.0 * eps), -(n3 - n4) / (2.0 * eps));
}

vec2 hash(vec2 p) {
    p = fract(sin(p * vec2(2127.1, 81.17)) * 43758.5453);
    return p;
}

varying vec2 vUv;

void main() {
    vec4 pFrame = texture2D(uPosition, vUv);

    float scale = pFrame.z;
    float velocity = pFrame.w;
    vec2 refPos = texture2D(uPosRefs, vUv).xy;
    vec2 nearestPos = texture2D(uPosNearest, vUv).xy;
    vec2 h = hash(vUv);

    float time = uTime * 0.5;
    float lifeEnd = 3.0 + sin(h.y * 100.0) * 1.0;
    float lifeTime = mod((h.x * 100.0) + time, lifeEnd);

    vec2 pos = pFrame.xy;
    float distRadius = 0.25;

    // T3.2 — Per-Particle-Stagger: jeder Partikel hat eigene Morph-Phase,
    // sodass Shape-Übergänge wellenartig statt schlagartig laufen.
    // Phase = (uIsHovering verschoben durch Particle-spezifischen Seed).
    float particlePhase = clamp((uIsHovering - h.x * 0.45) / 0.55, 0.0, 1.0);
    float morphInfluence = particlePhase * particlePhase;

    // Target: Stagger-Mix zwischen Ref und Nearest.
    vec2 targetPos = mix(refPos, nearestPos, morphInfluence);
    float dist = length(targetPos - pos);
    vec2 direction = dist > 0.0001 ? (targetPos - pos) / dist : vec2(0.0);
    float distStrength = smoothstep(distRadius, 0.0, dist);

    if (dist > 0.003) {
        pos += direction * 0.012 * distStrength * (1.0 - uAntiGravity);
    }

    // T3.2 — Transition-Boost: Während uIsHovering 0→1 (oder 1→0) wechselt,
    // wabert das Curl-Feld 3× stärker. fract-Trick: max bei phase=0.5, 0 an Endpunkten.
    float transitionEnergy = 4.0 * morphInfluence * (1.0 - morphInfluence);

    // Organischer Curl-Drift. Bass + AntiGravity + Transition boosten Amplitude.
    vec2 drift = curlNoise(pos * 2.2, uTime * 0.12);
    float driftAmp = 0.0009 * (1.0 - uIsHovering * 0.85)
                   + 0.0008 * uBassEnergy
                   + 0.0025 * uAntiGravity
                   + 0.0035 * transitionEnergy;
    pos += drift * driftAmp;

    // Maus-Interaktion: Push (Hover) + Vortex (Drag) + r²-Gravity (T2.1)
    vec2 toMouse = pos - uMousePos;
    float mouseDist = length(toMouse);
    float mouseRadius = 0.40;

    if (mouseDist < mouseRadius && mouseDist > 0.0001) {
        vec2 dirN = toMouse / mouseDist;
        float fLinear = smoothstep(mouseRadius, 0.0, mouseDist);

        // r²-Falloff für gravitativen Sog (uMouseMass), capped um Singularität zu vermeiden.
        float invSq = 1.0 / (mouseDist * mouseDist * 50.0 + 0.05);
        invSq = min(invSq, 8.0);

        vec2 pushForce  =  dirN * fLinear * 0.018 * (1.0 - uMouseDown);
        vec2 pullForce  = -dirN * fLinear * 0.015 * uMouseDown;
        vec2 vortex     = vec2(-toMouse.y, toMouse.x) / mouseDist * fLinear * 0.028 * uMouseDown;
        vec2 gravity    = -dirN * invSq * 0.0015 * uMouseMass;

        // AntiGravity-Mode invertiert alle Maus-Forces
        float polarity = 1.0 - 2.0 * uAntiGravity;
        pos += (pushForce + pullForce + vortex + gravity) * uIsHovering * polarity;
    }

    // T2.2: Click-Impulse (radial explosion vom Maus-Punkt)
    if (uImpulse > 0.001 && mouseDist < 0.6 && mouseDist > 0.0001) {
        vec2 burstDir = toMouse / mouseDist;
        float burstFall = exp(-mouseDist * 4.0);
        pos += burstDir * uImpulse * burstFall * 0.06;
    }

    if (lifeTime < 0.01) {
        pos = refPos;
        pFrame.xy = refPos;
        scale = 0.0;
    }

    // Scale-Steuerung
    float targetScale = smoothstep(0.01, 0.5, lifeTime) - smoothstep(0.5, 1.0, lifeTime / lifeEnd);
    targetScale += smoothstep(0.1, 0.0, smoothstep(0.001, 0.1, dist)) * 1.8 * uIsHovering;
    targetScale += uBassEnergy * 0.35;

    float scaleDiff = (targetScale - scale) * 0.15;
    scale += scaleDiff;

    vec2 diff = (pos - pFrame.xy) * 0.25;

    // Geschwindigkeits-Magnitude für kinetische Einfärbung im Fragment-Shader
    velocity = length(diff) * 12.0 * max(uIsHovering, 0.15 * uAntiGravity);

    gl_FragColor = vec4(pFrame.xy + diff, scale, velocity);
}
