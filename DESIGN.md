# DESIGN.md — Visuelles Designsystem für anti-website

Dieses Dokument definiert die visuelle Identität und die konkreten Design-Tokens für das Projekt **anti-website** (Neuaufbau von `antigravity.google` mit Inhalten von `www.moodtechsolutions.com`).

---

## 1. Visuelle Identität: "Gravitational Space CRM"
Das Design verbindet die mathematische Schwerelosigkeit von `antigravity.google` (Three.js-Partikel, interaktive physikalische Kräfte) mit der professionellen Seriosität einer CRM- und Plattform-Lösung von `MoodTech Solutions`. 
* **Ästhetik:** Dunkel, atmosphärisch, hochpräzise.
* **Elemente:** Glasmorphismus (Backdrop-Filter), hauchdünne Ränder, glühende Akzente und organische, scrollgesteuerte Bewegungen.

---

## 2. Farbpalette (Deep Space HSL)
Die Farbwerte sind als CSS Custom Properties hinterlegt und nutzen HSL für maximale Kontrolle über Transparenz (z. B. bei Glassmorphism-Effekten).

```css
:root {
  /* Backgrounds (Deep Space) */
  --color-bg-space: hsl(240 10% 2%);            /* Tiefschwarz */
  --color-bg-nebula: hsl(248 15% 4%);           /* Minimaler violetter Einschlag */
  --color-surface-card: hsla(240, 6%, 7%, 0.7);  /* Halbtransparente Karte */

  /* Borders & Dividers */
  --color-border-glow: hsla(244, 49%, 49%, 0.15); /* Subtiler violetter Schein */
  --color-border-mute: hsla(240, 5%, 15%, 0.8);  /* Standardrand */

  /* Typography */
  --color-text-main: hsl(0 0% 98%);              /* Sternenweiß */
  --color-text-dim: hsl(240 4% 70%);             /* Nebelgrau */
  --color-text-dark: hsl(240 3% 40%);            /* Dunkler Text / Inaktiv */

  /* MoodTech Accents (Futuristic Neon) */
  --color-accent-indigo: hsl(244 80% 64%);      /* Hauptakzent (Indigo) */
  --color-accent-cyan: hsl(190 95% 50%);        /* Zweitakzent (Glow / Interaktiv) */
  --color-accent-purple: hsl(270 85% 60%);      /* Drittakzent (Spezialzustände) */
}
```

---

## 3. Typografie (Outfit / Inter)
Wir verwenden Schriften, die das Technische mit dem Modernen verbinden.

* **Headings (Überschriften):** `Outfit` (sans-serif)
  * Charakteristik: Geometrisch, weit, minimalistisch.
  * Letter-Spacing: `tracking-tight` (-0.025em) bis `tracking-tighter` (-0.05em).
* **Body Text:** `Inter` (sans-serif)
  * Charakteristik: Perfekt lesbar auf Bildschirmen bei jeder Größe.
  * Line-Height: 1.625.
* **Daten / System-Meldungen:** `Roboto Mono` (monospace)
  * Charakteristik: Präzise, tabellarisch richtig ausgerichtet.
  * Verwendung: Zahlenwerte, CRM-IDs, API-Statusmeldungen.

---

## 4. UI-Komponenten-Muster

### Glassmorphism Cards (Schwebende Container)
Karten müssen das Gefühl vermitteln, vor dem Partikelhintergrund zu schweben.
```css
.design-card {
  background-color: var(--color-surface-card);
  backdrop-filter: blur(16px) saturate(120%);
  -webkit-backdrop-filter: blur(16px) saturate(120%);
  border: 1px solid var(--color-border-mute);
  border-radius: 16px;
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.4);
  transition: border-color 0.3s ease, transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.design-card:hover {
  border-color: var(--color-border-glow);
  transform: translateY(-2px);
}
```

### Buttons & Interaktive Elemente
* **Primary Button:** Indigo-Hintergrund mit subtilem Schattenwurf und weichem Cyan-Glow im `:hover`-Zustand.
* **Ghost Button:** Randlos, Text in `var(--color-text-dim)`. Bei Hover sanfter HSL-Übergang zu `var(--color-text-main)` und dezenter Hüll-Glow.

---

## 5. WebGL (Three.js) & Motion-Richtlinien (GSAP)

### Drei-Dimensionale Partikel (Space-Hintergrund)
* **Dichte:** Moderat (ca. 1000–2000 Partikel), um CPU/GPU nicht zu überlasten.
* **Physik:** Partikel reagieren auf die Mausbewegung. Sie werden durch Schwerkraft-Verzerrungen leicht weggedrückt oder angezogen (Attractor-Modus bei Klick).
* **Farbverlauf:** Partikel leuchten in Nuancen von `var(--color-accent-indigo)` bis `var(--color-accent-cyan)`.

### Scroll- und Hover-Effekte (GSAP)
* **Parallax-Effekte:** Content-Karten scrollen mit leicht unterschiedlicher Geschwindigkeit relativ zum Partikelhintergrund.
* **Entrance Animations:** Elemente faden nacheinander ein (Stagger-Effekt) unter Verwendung einer weichen, natürlichen Exponentialkurve (`power2.out`).
