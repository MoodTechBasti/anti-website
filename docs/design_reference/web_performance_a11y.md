# Web Performance & Accessibility Reference (Stand Mai 2026)

Dieses Dokument dient als technische Referenz zur Sicherstellung erstklassiger Performance (Core Web Vitals) und Barrierefreiheit (a11y) in allen Frontend-Arbeiten.

---

## 1. Core Web Vitals (Performance-Optimierung)

### LCP (Largest Contentful Paint)
Die LCP-Metrik misst die Zeit, bis das größte sichtbare Inhaltselement (oft das Hero-Image oder die Hauptüberschrift) im Viewport gerendert ist. Zielwert: **< 2,5 Sekunden**.

* **Preloading kritischer Assets:** LCP-Bilder oder variable Schriftarten im `<head>` vorladen.
  ```html
  <link rel="preload" href="/fonts/outfit-variable.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="/images/hero-bg.avif" as="image" type="image/avif">
  ```
* **Fetch Priority setzen:** Dem LCP-Bild die höchste Ladepriorität zuweisen.
  ```html
  <img src="/images/hero-bg.avif" fetchpriority="high" alt="MoodTech Space Canvas" />
  ```
* **Render-Blocking vermeiden:** CSS- und JS-Dateien, die für das anfängliche Rendern nicht benötigt werden, asynchron laden (`defer` oder `async` bei Scripten, Medien-spezifisches Stylesheet-Laden).

### CLS (Cumulative Layout Shift)
Die CLS-Metrik misst unerwartete Layout-Verschiebungen während des Ladens. Zielwert: **< 0,1**.

* **Aspect-Ratio erzwingen:** Für Bilder, Videos und WebGL-Canvas immer feste Platzhalter-Dimensionen reservieren.
  ```css
  .webgl-canvas-container {
    width: 100%;
    aspect-ratio: 16 / 9; /* Reserviert den Raum vor dem Laden von Three.js */
    background-color: var(--color-bg-space);
  }
  ```
* **Font-Loading-Optimierung:** FOUT (Flash of Unstyled Text) verhindern, indem die System-Schriftart als nahtloser Fallback konfiguriert wird (z. B. mit passendem `size-adjust`).
  ```css
  @font-face {
    font-family: 'Outfit';
    src: url('/fonts/outfit.woff2') format('woff2');
    font-display: swap; /* Text bleibt sofort sichtbar, wechselt nach dem Laden */
  }
  ```

### INP (Interaction to Next Paint)
Die INP-Metrik misst die Latenzzeit bei Nutzerinteraktionen (Klicks, Tastendrücke) über den gesamten Lebenszyklus einer Seite hinweg. Zielwert: **< 200 Millisekunden**.

* **Lange JavaScript-Tasks aufbrechen:** Aufgaben, die länger als 50ms dauern, blockieren den Hauptthread und erhöhen die INP. Zerlege sie mit `setTimeout` oder `requestIdleCallback`.
  ```javascript
  // Schlechte, blockierende Schleife
  function processLargeDataSync(items) {
    items.forEach(item => doHeavyCalculation(item)); // Blockiert den Hauptthread
  }

  // Gute, asynchrone Zerlegung
  async function processLargeDataAsync(items) {
    for (const item of items) {
      doHeavyCalculation(item);
      // Erlaubt dem Browser, zwischen den Items ein Frame zu rendern (INP sinkt)
      await new Promise(resolve => requestAnimationFrame(resolve));
    }
  }
  ```

---

## 2. Accessibility (Barrierefreiheit nach WCAG)

### Semantisches HTML & ARIA-Attribute
Verwende immer die semantisch treffendsten HTML5-Tags. ARIA-Attribute dienen nur als Ergänzung, wenn HTML-Mittel nicht ausreichen.

* **Akkordeons / Dropdowns:**
  ```html
  <button aria-expanded="false" aria-controls="dropdown-content-1" id="dropdown-btn-1">
    Menü öffnen
  </button>
  <div id="dropdown-content-1" aria-labelledby="dropdown-btn-1" hidden>
    <!-- Inhalt -->
  </div>
  ```
* **Screenreader-Live-Regionen (z. B. für dynamische Meldungen im CRM):**
  ```html
  <div aria-live="polite" class="sr-only" id="crm-status-announcer">
    Datensatz erfolgreich aktualisiert.
  </div>
  ```

### Tastatur-Fokus-Management
Jedes interaktive Element muss ohne Maus erreichbar und steuerbar sein.

* **Fokusfalle (Focus Trap) bei Modals:**
  Sobald ein Dialog-Fenster (Modal) geöffnet wird, muss der Tastatur-Fokus innerhalb des Fensters gefangen bleiben. Nutze das native `<dialog>`-Element, welches dies automatisch handhabt.
  ```html
  <dialog id="settings-dialog">
    <form method="dialog">
      <h2>Einstellungen</h2>
      <button autofocus>Schließen</button>
    </form>
  </dialog>
  ```
  ```javascript
  // Öffnen des Dialogs als modales Fenster (erzwingt Fokusfalle)
  document.getElementById('settings-dialog').showModal();
  ```

* **Sichtbarer Tastatur-Fokus:**
  Deaktiviere niemals den Outline-Effekt, ohne einen hochwertigen `:focus-visible`-Ersatz zu implementieren.
  ```css
  /* Fokus-Ring nur bei Tastatur-Steuerung anzeigen (nicht bei Mausklicks) */
  *:focus-visible {
    outline: 2px solid var(--color-accent-cyan);
    outline-offset: 4px;
  }
  ```

### Barrierefreie Farb-Kontraste
* **Textkontrast:** Kontrastverhältnis zwischen Text und Hintergrund muss mindestens **4,5:1** betragen. Bei großer Schrift (ab 24px) mindestens **3:1**.
* **Interaktive Ränder:** Grenzen von Eingabefeldern und Buttons müssen einen Kontrast von mindestens **3:1** aufweisen.
