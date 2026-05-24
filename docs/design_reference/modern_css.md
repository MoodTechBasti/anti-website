# Modern CSS Reference — Webdesign-Techniken (Stand Mai 2026)

Dieses Dokument dient als technische Referenz für die Implementierung nativer, performanter und moderner CSS-Effekte ohne JavaScript-Overhead.

---

## 1. View Transitions API
Die View Transitions API ermöglicht flüssige Übergänge bei Zustandsänderungen oder Seitenwechseln.

### CSS-Gestaltung des Übergangs
Durch das Zuweisen von `view-transition-name` teilen wir dem Browser mit, welche Elemente beim Übergang ineinander übergehen (morphen) sollen.
```css
/* Dem Element, das animiert werden soll, einen eindeutigen Namen zuweisen */
.hero-title {
  view-transition-name: main-title;
}

/* Übergänge im globalen Scope anpassen (falls die Standard-Fade-Animation geändert werden soll) */
::view-transition-old(main-title) {
  animation: 250ms cubic-bezier(0.4, 0, 0.2, 1) both fade-out;
}

::view-transition-new(main-title) {
  animation: 300ms cubic-bezier(0.4, 0, 0.2, 1) both fade-in;
}

@keyframes fade-out {
  from { opacity: 1; transform: translateY(0); }
  to { opacity: 0; transform: translateY(-10px); }
}

@keyframes fade-in {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
```

### JavaScript-Trigger (für Single Page Apps / Dynamische DOM-Wechsel)
Wenn wir das DOM dynamisch per JavaScript ändern, kapseln wir das Update in `document.startViewTransition()`:
```javascript
function updateDOMAndTransition(newContent) {
  // Fallback für Browser, die die API noch nicht unterstützen
  if (!document.startViewTransition) {
    document.getElementById('content').innerHTML = newContent;
    return;
  }
  
  // Start des nativen Übergangs
  document.startViewTransition(() => {
    document.getElementById('content').innerHTML = newContent;
  });
}
```

---

## 2. CSS Scroll-driven Animations
Ermöglicht Animationen, deren Verlauf direkt an die Scrollposition des Nutzers gekoppelt ist. Komplett ohne JS-Scroll-Listener.

### Scroll-Timeline (Scrollfortschritt des Containers)
Koppelt die Animation an das Scrollen in einem bestimmten Element (standardmäßig das Dokument).
```css
@keyframes scroll-progress {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}

.progress-bar {
  transform-origin: left;
  animation: scroll-progress auto linear;
  /* Bindet die Animation an das vertikale Scrollen des nächstgelegenen Scroll-Containers */
  animation-timeline: scroll(y self);
}
```

### View-Timeline (Element im Viewport)
Koppelt die Animation an die Position eines Elements im sichtbaren Bereich des Bildschirms (hervorragend für "Einblendungen beim Scrollen").
```css
@keyframes reveal-card {
  from {
    opacity: 0;
    transform: translateY(40px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.reveal-on-scroll {
  /* Definiert eine View-Timeline auf dem Element */
  view-timeline-name: --card-reveal;
  view-timeline-axis: block;

  animation: reveal-card auto cubic-bezier(0.16, 1, 0.3, 1) both;
  /* Bindet die Animation an die Viewport-Sichtbarkeit des Elements */
  animation-timeline: --card-reveal;
  
  /* Definiert, wann die Animation startet und endet: 
     startet bei Eintritt ins Viewport-Ende (entry 0%),
     endet wenn das Element voll im Viewport ist (entry 100%) */
  animation-range: entry 0% entry 100%;
}
```

---

## 3. CSS `@property` (Typisierte Custom Properties)
Ermöglicht es dem Browser, den Inhalt von CSS-Variablen zu verstehen (z. B. als Farbe, Winkel oder Prozentsatz), wodurch diese Variablen direkt über Transitions oder Keyframes flüssig animiert werden können.

### Weicher Hover-Verlauf auf Background-Gradients
Standardmäßig können CSS-Gradients nicht weich animiert werden. Mit `@property` ist dies möglich:
```css
/* Variable registrieren */
@property --gradient-color-1 {
  syntax: '<color>';
  inherits: false;
  initial-value: hsl(244 80% 64%);
}

@property --gradient-color-2 {
  syntax: '<color>';
  inherits: false;
  initial-value: hsl(190 95% 50%);
}

.interactive-glow-card {
  background: linear-gradient(135deg, var(--gradient-color-1), var(--gradient-color-2));
  transition: --gradient-color-1 0.5s ease, --gradient-color-2 0.5s ease;
  border-radius: 12px;
  padding: 1px; /* Für feine Glüh-Ränder */
}

/* Im Hover-Zustand ändern sich die Farben der Variablen flüssig */
.interactive-glow-card:hover {
  --gradient-color-1: hsl(270 85% 60%);
  --gradient-color-2: hsl(340 90% 60%);
}
```

---

## 4. CSS Container Queries (`@container`)
Ermöglicht das Stylen einer Komponente in Abhängigkeit von der Breite ihres unmittelbaren Eltern-Containers, anstatt des gesamten Browser-Viewports. Das ist die Grundlage für echte, modulare UI-Komponenten.

```css
/* 1. Eltern-Element als Container deklarieren */
.card-wrapper {
  container-type: inline-size;
  container-name: card-container;
  width: 100%;
}

/* 2. Standard-Layout für die Komponente (z. B. mobile/schmale Container-Breite) */
.product-card {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* 3. Anpassung, sobald der Eltern-Container breiter als 500px wird */
@container card-container (min-width: 500px) {
  .product-card {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
  
  .product-card-image {
    width: 150px;
    height: 150px;
  }
}
```

---

## 5. CSS Grid & Subgrid
Mit `subgrid` können verschachtelte Grid-Elemente (z. B. Überschriften, Beschreibungen und CTAs in nebeneinanderstehenden Preis-Karten) exakt an den Zeilen des übergeordneten Grids ausgerichtet werden, selbst wenn die Textinhalte unterschiedlich lang sind.

```css
/* 1. Übergeordnetes Grid für die Cards */
.pricing-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2rem;
}

/* 2. Jede Card nimmt 3 Zeilen im Grid ein */
.pricing-card {
  display: grid;
  grid-row: span 3;
  /* Übernimmt das Zeilen-Grid des Eltern-Elements */
  grid-template-rows: subgrid;
  gap: 1rem;
  background: var(--color-surface-card);
  padding: 2rem;
  border-radius: 16px;
}

/* Die Kindelemente der Card richten sich jetzt perfekt 
   an den Grid-Zeilen der pricing-grid aus! */
.pricing-card h3 {
  grid-row: 1; /* Zeile 1: Titel */
}

.pricing-card p {
  grid-row: 2; /* Zeile 2: Beschreibung */
}

.pricing-card button {
  grid-row: 3; /* Zeile 3: CTA */
}
```
