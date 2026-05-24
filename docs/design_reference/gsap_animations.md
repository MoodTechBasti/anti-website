# GSAP Animation Reference — ScrollTrigger & Timelines (Stand Mai 2026)

Dieses Dokument dient als technische Referenz für die Implementierung flüssiger, performanter und responsiver Animationen mit der GreenSock Animation Platform (GSAP).

---

## 1. ScrollTrigger Best Practices
`ScrollTrigger` ermöglicht es, Animationen an das Scrollen des Nutzers zu binden oder beim Erreichen bestimmter Scrollpositionen auszulösen.

### Performante Trigger-Konfiguration
Um Layout-Ruckler (Jank) zu vermeiden, sollten Animationen fast ausschließlich CSS-Eigenschaften nutzen, die die GPU direkt verarbeiten kann (`transform` und `opacity`). Vermeide das Animieren von Abständen (`margin`, `padding`) oder Breiten/Höhen, da diese bei jedem Frame ein zeitintensives Browser-Reflow auslösen.

```javascript
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Plugin zwingend registrieren
gsap.registerPlugin(ScrollTrigger);

function initScrollAnimations() {
  // Eine Card-Fade-In-Animation beim Scrollen
  gsap.from('.feature-card', {
    scrollTrigger: {
      trigger: '.features-section', // Das auslösende Element
      start: 'top 80%',             // Start, wenn das Element 80% des Viewports erreicht
      end: 'bottom 20%',            // Ende
      toggleActions: 'play none none reverse', // play bei Eintritt, reverse bei Rückwärtsscroll
      // scrub: true,                // Bindet Animation direkt an Scrollfortschritt
      // pin: true,                  // Fixiert das Element im Viewport während des Triggers
    },
    y: 30,
    opacity: 0,
    duration: 0.8,
    stagger: 0.1,                  // Partielles, nacheinander ablaufendes Einblenden
    ease: 'power2.out'
  });
}
```

---

## 2. Timelines & Staggering
Timelines sind das mächtigste Werkzeug in GSAP, um komplexe, aufeinander aufbauende Sequenzen zu steuern, ohne unübersichtliche Verschachtelungen (`setTimeout`) zu verwenden.

```javascript
function playHeroSequence() {
  const tl = gsap.timeline({
    defaults: { ease: 'power3.out', duration: 0.6 }
  });

  // Sequenzieller Ablauf
  tl.from('.hero-badge', { scale: 0.8, opacity: 0 })
    .from('.hero-title', { y: 40, opacity: 0 }, '-=0.35')  // Startet 0.35s vor Ende des vorherigen Tweens
    .from('.hero-subtitle', { y: 20, opacity: 0 }, '-=0.25')
    .from('.hero-cta', { y: 15, opacity: 0 }, '-=0.2')
    // Staggered Animation auf Grid-Karten am Ende
    .from('.hero-card', { 
      opacity: 0, 
      y: 20, 
      stagger: {
        each: 0.1,
        from: 'center' // Startet die Stagger-Animation in der Mitte des Grids
      }
    }, '-=0.1');
}
```

---

## 3. Responsive Animationen via `gsap.matchMedia()`
Animationen müssen auf Mobilgeräten oft reduziert oder komplett abgeschaltet werden, um Akkulaufzeit und GPU-Performance zu schonen. `gsap.matchMedia()` erlaubt die Definition media-query-spezifischer Animationssätze.

```javascript
function setupResponsiveAnimations() {
  const mm = gsap.matchMedia();

  // Desktop: Volles Animationsprogramm inklusive Scroll-Pinning
  mm.add('(min-width: 1024px)', () => {
    gsap.to('.animated-panel', {
      scrollTrigger: {
        trigger: '.panel-section',
        start: 'top top',
        end: '+=200%',
        pin: true,
        scrub: 1
      },
      xPercent: -100
    });
    
    // Optionaler Cleanup-Code speziell für diese Query
    return () => {
      // Wird automatisch aufgerufen, wenn die Media Query nicht mehr zutrifft
    };
  });

  // Mobil: Vereinfachtes Layout ohne Pinning oder Scrubbing
  mm.add('(max-width: 1023px)', () => {
    gsap.from('.animated-panel', {
      scrollTrigger: {
        trigger: '.panel-section',
        start: 'top 80%'
      },
      opacity: 0,
      y: 20,
      duration: 0.6
    });
  });
}
```

---

## 4. Animations-Cleanup bei Page Transitions
Wenn Inhalte dynamisch gewechselt werden (z. B. durch Single-Page-Navigation oder AJAX-DOM-Updates), bleiben laufende Tweens und ScrollTrigger als "Waisenkinder" im Speicher und verursachen schwerwiegende Memory Leaks sowie visuelle Artefakte.

Ein konsistenter Cleanup vor jedem DOM-Wechsel ist zwingend erforderlich:

```javascript
function cleanupAnimations() {
  // 1. Alle aktiven ScrollTrigger töten
  const allTriggers = ScrollTrigger.getAll();
  allTriggers.forEach(trigger => {
    trigger.kill(true); // true erzwingt das Zurücksetzen des Elements in den Ausgangszustand
  });

  // 2. Alle laufenden GSAP Tweens killen
  gsap.killTweensOf('*');
  
  console.log('GSAP Animationen & ScrollTrigger erfolgreich bereinigt.');
}
```
