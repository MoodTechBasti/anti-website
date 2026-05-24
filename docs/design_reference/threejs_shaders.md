# WebGL & Three.js Shader Reference — Partikel & Gravitation (Stand Mai 2026)

Dieses Dokument dient als technische Referenz für die Implementierung hochperformanter 3D-Partikelsysteme und interaktiver physikalischer Shader-Effekte mit Three.js und GLSL.

---

## 1. Performante Partikel-Architektur
Anstatt Tausende von einzelnen `THREE.Mesh`-Objekten zu erstellen (was zu Performance-Einbrüchen durch Draw Calls führt), nutzen wir ein einziges `THREE.Points`-Objekt mit einer optimierten `THREE.BufferGeometry` und einem benutzerdefinierten `THREE.ShaderMaterial`.

### Three.js Setup (JavaScript)
```javascript
import * as THREE from 'three';

function createParticleSystem(count = 50000) {
  const geometry = new THREE.BufferGeometry();
  
  // Arrays für Positionen und Custom Attribute (z. B. Partikel-Zufallswerte)
  const positions = new Float32Array(count * 3);
  const randoms = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    // Initial-Positionen (z. B. in einer Kugel oder Box verteilt)
    positions[i * 3] = (Math.random() - 0.5) * 10;     // X
    positions[i * 3 + 1] = (Math.random() - 0.5) * 10; // Y
    positions[i * 3 + 2] = (Math.random() - 0.5) * 10; // Z

    randoms[i] = Math.random(); // Eigener Zufallswert für Shader-Varianz
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 1));

  // ShaderMaterial mit Uniforms für Zeit, Maus und Auflösung
  const material = new THREE.ShaderMaterial({
    vertexShader: vertexShaderSource,
    fragmentShader: fragmentShaderSource,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector3(0, 0, 0) }, // Maus-Position in 3D-Space
      uMouseStrength: { value: 0.0 }                 // Stärke der Interaktion
    }
  });

  const points = new THREE.Points(geometry, material);
  return { points, material, geometry };
}
```

---

## 2. Vertex Shader (Physikalische Kräfte auf der GPU)
Im Vertex Shader berechnen wir die Position jedes einzelnen Partikels. Um maximale Performance zu erzielen, berechnen wir die organische Bewegung (Noise) und die Schwerkraftverzerrung (Maus-Attraktor) direkt auf der GPU.

```glsl
// GLSL Vertex Shader
uniform float uTime;
uniform vec3 uMouse;
uniform float uMouseStrength;

attribute float aRandom;

varying float vRandom;
varying vec3 vPosition;

// Einfache 3D-Simplex-Noise-Funktion zur Erzeugung organischer Wellen
// (Hier verkürzt dargestellt, nutze im produktiven Shader eine vollständige Implementierung)
float hash(float n) { return fract(sin(n) * 43758.5453123); }
float noise(vec3 x) {
    vec3 p = floor(x);
    vec3 f = fract(x);
    f = f*f*(3.0-2.0*f);
    float n = p.x + p.y*157.0 + 113.0*p.z;
    return mix(mix(mix(hash(n+0.0), hash(n+1.0), f.x),
                   mix(hash(n+157.0), hash(n+158.0), f.x), f.y),
               mix(mix(hash(n+113.0), hash(n+114.0), f.x),
                   mix(hash(n+270.0), hash(n+271.0), f.x), f.y), f.z);
}

void main() {
    vRandom = aRandom;
    vec3 pos = position;

    // 1. Organische Bewegung via Noise hinzufügen (strombasiertes Rauschen)
    float speed = 0.2;
    float scale = 0.5;
    pos.x += noise(pos * scale + uTime * speed) * 0.5;
    pos.y += noise(pos * scale + uTime * speed + 10.0) * 0.5;
    pos.z += noise(pos * scale + uTime * speed + 20.0) * 0.5;

    // 2. Gravitationsattraktor / Repulsor berechnen
    vec3 toMouse = pos - uMouse;
    float dist = length(toMouse);
    float effectRadius = 3.0; // Wirkungsbereich der Maus

    if (dist < effectRadius) {
        // Kraft nimmt mit der Entfernung ab (Glockenkurve / Smoothstep)
        float force = smoothstep(effectRadius, 0.0, dist) * uMouseStrength;
        
        // Repulsion (Maus drückt Partikel weg)
        pos += normalize(toMouse) * force * 1.2;
        
        // Alternativ Attraction (Maus zieht Partikel an):
        // pos -= normalize(toMouse) * force * 1.2;
    }

    vPosition = pos;

    // Transformation in View-Space
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // Partikelgröße basierend auf der Z-Tiefe anpassen (Perspektive)
    gl_PointSize = (15.0 / -mvPosition.z) * (0.8 + aRandom * 0.4);
}
```

---

## 3. Fragment Shader (Visuelle Ästhetik & Glow)
Der Fragment Shader bestimmt das Aussehen jedes Partikelpixels. Anstatt harte Quadrate zu zeichnen, generieren wir weiche, glühende Kreise.

```glsl
// GLSL Fragment Shader
varying float vRandom;
varying vec3 vPosition;

uniform float uTime;

void main() {
    // Berechne Distanz vom Zentrum des Partikels (gl_PointCoord geht von 0.0 bis 1.0)
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);

    // Wenn die Distanz > 0.5 ist, verwerfe das Pixel (Partikel ist kreisförmig)
    if (dist > 0.5) {
        discard;
    }

    // Weicher Glührand (Glow-Effekt)
    float alpha = smoothstep(0.5, 0.0, dist);
    
    // Intensiver Kern
    float core = smoothstep(0.15, 0.0, dist) * 0.5;
    alpha = alpha * 0.4 + core;

    // Dynamische Farbmischung basierend auf Position und Eigengewicht
    vec3 color1 = vec3(0.22, 0.37, 0.96); // MoodTech Indigo (#38bdf8 / #3b82f6)
    vec3 color2 = vec3(0.1, 0.95, 0.8);   // MoodTech Cyan (#00f3cc)
    
    // Weicher Farbverlauf im Raum
    vec3 finalColor = mix(color1, color2, sin(vPosition.y * 0.2 + uTime * 0.1) * 0.5 + 0.5);
    
    // Zusätzlicher Glüh-Weißwert im Zentrum des Partikels
    finalColor += vec3(core * 0.8);

    gl_FragColor = vec4(finalColor, alpha * (0.6 + sin(uTime + vRandom * 6.28) * 0.3));
}
```

---

## 4. WebGL Performance-Richtlinien

### 1. Garbage Collection (GC) vermeiden
Erstelle **niemals** neue `THREE.Vector3`, `THREE.Color` oder andere mathematische Objekte innerhalb deiner `requestAnimationFrame`-Schleife (Render Loop). Das führt zu periodischen Rucklern (Stuttering), wenn der Garbage Collector des Browsers den Speicher freigibt.

* **Schlecht:**
  ```javascript
  function tick() {
    const mousePos = new THREE.Vector3(mouseX, mouseY, 0); // FALSCH: Erzeugt Müll
    material.uniforms.uMouse.value = mousePos;
  }
  ```
* **Gut (Wiederverwendung von Objekten):**
  ```javascript
  const tempMouseVec = new THREE.Vector3(); // Global oder im Scope einmal anlegen
  
  function tick() {
    tempMouseVec.set(mouseX, mouseY, 0);   // Richtig: Bestehendes Objekt aktualisieren
    material.uniforms.uMouse.value.copy(tempMouseVec);
  }
  ```

### 2. Draw Call Minimierung
Wenn du geometrische Objekte statt einfacher Punkte zeichnest, nutze `THREE.InstancedMesh`. Damit kannst du Hunderttausende identischer Objekte (wie z. B. kleine 3D-Karten oder geometrische Datenpunkte) mit einem einzigen Draw Call rendern.

### 3. Speicherbereinigung (Memory Leak Prevention)
Wenn eine Szene verlassen oder neu geladen wird (z. B. durch Page Transitions), müssen alle WebGL-Ressourcen explizit freigegeben werden. Der Browser löscht WebGL-Daten nicht automatisch aus dem Grafikspeicher.

```javascript
function destroyScene(scene, renderer, points, material, geometry) {
  // 1. Aus der Szene entfernen
  scene.remove(points);

  // 2. Geometrie freigeben
  geometry.dispose();

  // 3. Material (und ggf. Texturen) freigeben
  material.dispose();
  if (material.uniforms.uTexture?.value) {
    material.uniforms.uTexture.value.dispose();
  }

  // 4. WebGL Context-Ressourcen des Renderers leeren
  renderer.dispose();
}
```
