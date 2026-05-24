# DESIGN_PRINCIPLES.md — Universelle Design- und Qualitätsrichtlinien

Diese Richtlinien definieren das übergeordnete Qualitäts- und Gestaltungsniveau für alle Frontend-Arbeiten. Sie sind technologieneutral und dienen als konzeptioneller Leitfaden.

## 1. Designer-Mindset
* **Kontext vor Schablone:** Jedes Interface wird basierend auf seinem Zweck und seiner Zielgruppe individuell gestaltet. Es gibt keine standardmäßige "Einheitsoptik".
* **Visuelle Hierarchie:** Wichtige Elemente (CTAs, Key-Metriken) erhalten bewussten visuellen Vorrang durch Größe, Gewicht und Kontrast.
* **Whitespace als Gestaltungsmittel:** Abstände werden großzügig und bewusst eingesetzt, um das Interface atmen zu lassen und kognitive Last zu reduzieren.
* **Typografie als Design-Träger:** Schriften werden gezielt ausgewählt. Überschriften erhalten durch gezielte Spationierung (Letter-Spacing) und Strichstärken Charakter.

## 2. Fluid Typography & Spacing
* **Stufenlose Skalierung:** Anstelle von zahllosen statischen `@media`-Breakpoints werden Schriftgrößen und Abstände flüssig über mathematische CSS-Funktionen wie `clamp()`, `min()` und `max()` definiert.
* **Beispiel-Skala:**
  ```css
  --fs-h1: clamp(2.5rem, 6vw + 1rem, 5rem);
  --fs-body: clamp(1rem, 0.2vw + 0.9rem, 1.125rem);
  --spacing-section: clamp(3rem, 8vw, 8rem);
  --spacing-card: clamp(1rem, 2vw + 0.5rem, 2rem);
  ```
* **Vorteil:** Die Benutzeroberfläche passt sich stufenlos jeder Displaygröße an, ohne dass das Design "springt".

## 3. Semantische CSS Custom Properties (Design Tokens)
* **Funktionale Benennung:** Farbvariablen werden nach ihrer semantischen Funktion im Layout benannt, nicht nach ihrem Farbnamen.
* **Struktur:**
  ```css
  :root {
    /* Backgrounds & Surfaces */
    --color-bg: hsl(240 10% 3.9%);
    --color-surface: hsl(240 10% 10%);
    --color-border: hsl(240 5% 15%);

    /* Foreground / Text */
    --color-text-primary: hsl(0 0% 98%);
    --color-text-muted: hsl(240 5% 65%);

    /* Interaction / Brand */
    --color-accent: hsl(217.2 91.2% 59.8%);
    --color-accent-hover: hsl(221.2 83.2% 53.3%);
    --color-accent-ghost: hsla(217.2, 91.2%, 59.8%, 0.1);
  }
  ```
* **Wartbarkeit:** Das Theming (z. B. Dark/Light-Wechsel oder Rebranding) wird zentral über CSS-Variablen gesteuert. Der restliche CSS-Code bleibt unberührt.

## 4. Motion Design & Micro-Interactions
* **Subtil und funktional:** Animationen dürfen niemals ablenken oder den Fluss des Nutzers behindern. Sie dienen als visuelles Feedback für Interaktionen.
* **Native View Transitions API:** Für Seitenübergänge oder Zustandswechsel (z. B. Filterungen) wird bevorzugt die native Browser-API verwendet, um flüssige Morph-Effekte ohne JS-Bibliotheken zu erzielen.
* **Einfache Übergänge:** CSS-Transitions nutzen standardmäßig standardisierte Easings (`cubic-bezier(0.4, 0, 0.2, 1)`) und kurze Dauern (150ms bis 250ms).

## 5. Barrierefreiheit (a11y)
* **Semantische Struktur:** Logischer Einsatz von HTML5-Elementen (`<main>`, `<nav>`, `<aside>`, `<header>`, `<footer>`). Pro Seite gibt es genau ein `<h1>`.
* **Kontraste:** Textfarben müssen einen Mindestkontrast von 4,5:1 zum Hintergrund aufweisen (WCAG AA).
* **Interaktive Elemente:** Jedes fokussierbare Element benötigt einen deutlichen, gut sichtbaren `:focus-visible`-Ring für Tastaturbedienung. Links müssen ein klares Ziel beschreiben (keine leeren Symbole ohne `aria-label`).

## 6. Performance-Driven Design
* **Optimierte Medien:** Bilder werden standardmäßig im **AVIF-Format** bereitgestellt, um Dateigrößen bei gleicher Qualität zu minimieren.
* **Variable Fonts:** Verwendung von variablen Schriftdateien. Dies reduziert die HTTP-Requests für verschiedene Schriftschnitte drastisch.
* **Schlanker Fußabdruck:** Keine unnötigen JS-Bibliotheken für Effekte, die nativ mit modernem CSS oder HTML realisiert werden können (z. B. Dialoge via `<dialog>`-Element).

## 7. Iteratives Prototyping
* Bei komplexen UI-Entscheidungen erstellen wir funktionale CSS/HTML-Entwürfe, um die visuelle Balance und UX direkt im Browser zu bewerten, bevor die Logik implementiert wird.
