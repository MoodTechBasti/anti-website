precision highp float;

varying vec4 vSeeds;
varying vec2 vScreenPos;
varying vec2 vLocalPos;
varying float vScale;
varying float vVelocity;
varying float vDepth;

uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;

uniform vec2 uMousePos;
uniform vec2 uRez;

uniform float uAlpha;
uniform float uTime;
uniform float uBassEnergy;   // 0..1 — gepusht von Audio-Reactor (T2.3), default 0
uniform float uTrebleEnergy; // 0..1 — Color-Shift

uniform sampler2D uPointTex; // Pre-baked Gauss-Glow-Texture (glow-texture.js)

uniform int uColorScheme;

#define PI 3.1415926535897932384626433832795

void main() {
    // Glow-Mask aus pre-baked Texture statt analytischem discard.
    // Centered, ohne Y-Flip — Texture ist symmetrisch.
    vec4 sprite = texture2D(uPointTex, gl_PointCoord);

    if (sprite.a < 0.004) {
        discard;
    }

    // Farb-Mix nach Velocity (kinetische Energie):
    // 0..0.5 → color1→color2, 0.5..1 → color2→color3
    float progress = clamp(vVelocity * 0.7, 0.0, 1.0);
    vec3 baseColor = mix(
        mix(uColor1, uColor2, smoothstep(0.0, 0.5, progress)),
        mix(uColor2, uColor3, smoothstep(0.5, 1.0, progress)),
        step(0.5, progress)
    );

    // Treble pumpt Farbton in Cyan-Richtung.
    baseColor = mix(baseColor, vec3(0.55, 1.0, 1.0), uTrebleEnergy * 0.35);

    // HDR-Pump: schnelle Partikel und Bass-getriggerte Partikel werden >1.0,
    // damit Bloom sie aufgreift.
    float energy = 1.0 + vVelocity * 1.8 + uBassEnergy * 1.2;
    vec3 color = baseColor * energy;

    // Tiefen-Atmosphäre: hinten leicht ausbleichen, vorne saturieren.
    // vDepth ~ -mvPosition.z normalisiert; mehr Tiefe = größerer Wert.
    float depthFade = clamp(1.0 - vDepth * 0.05, 0.55, 1.0);
    color *= depthFade;

    // Sub-Pixel-Twinkle: jeder Partikel hat eine eigene Phase (vSeeds.x).
    color += vec3(0.5, 0.6, 1.0) * sin(uTime * 2.0 + vSeeds.x * 6.28) * 0.05;

    // Alpha: Sprite-Glow × Velocity-Boost × Scale-Fade.
    float a = uAlpha * sprite.a * smoothstep(0.05, 0.22, vScale);

    gl_FragColor = vec4(color, a);
}
