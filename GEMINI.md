# GEMINI.md — anti-website

This file provides guidance to Gemini CLI when working in this repository.

## Project Context
Rebuilding antigravity.google with www.moodtechsolutions.com content.

## Tooling Pointer
- The machine-wide Windows CLI baseline lives in `C:\Tools\TOOLING.md`.
- Default Python command is `python`.

## Core Commands
- Dev Server: `npm run dev`
- Build: `npm run build`
- Validate: `pwsh C:\Tools\check-tooling-pointer.ps1`

## Design & Code Quality Guidelines
- **Zwingende Referenzen:** Lies vor jeder Frontend- und UI-Entwicklung zwingend folgende Dokumente:
  * Allgemeine Prinzipien: [DESIGN_PRINCIPLES.md](file:///E:/anti-website/DESIGN_PRINCIPLES.md) (Qualitätsstandards und Workflows)
  * Projektspezifische Tokens: [DESIGN.md](file:///E:/anti-website/DESIGN.md) (Farben, Typografie, GSAP & WebGL-Stil)
  * Technisches CSS: [modern_css.md](file:///E:/anti-website/docs/design_reference/modern_css.md) (View Transitions, CSS Scroll/View, `@property`, subgrid)
  * WebGL/Shader: [threejs_shaders.md](file:///E:/anti-website/docs/design_reference/threejs_shaders.md) (GPU-Kräfte, GLSL-Noise, WebGL-Performance)
  * GSAP-Animationen: [gsap_animations.md](file:///E:/anti-website/docs/design_reference/gsap_animations.md) (ScrollTrigger, Timelines, matchMedia, Cleanups)
  * Performance & Barrierefreiheit: [web_performance_a11y.md](file:///E:/anti-website/docs/design_reference/web_performance_a11y.md) (LCP/CLS/INP, WCAG Kontraste, Focus Trap)
- **Designer-Mindset:** Denke wie ein kreativer Designer. Löse dich von starren UI-Kopiervorlagen. Wähle das passende visuelle Konzept kontextabhängig für das Produkt aus.
- **Technologische Offenheit:** Nutze moderne CSS-Standards (CSS Custom Properties, Container Queries `@container`, native View Transitions API) und wähle die am besten geeignete Technologie (Vanilla CSS, CSS Modules, etc.) ohne starre Tool-Einschränkungen.
- **Iterativer Workflow:** Implementiere komplexe Benutzeroberflächen schrittweise in drei Phasen:
  1. *Struktur & Layout* (Reine Platzhalter und Anordnungen über Flex/Grid).
  2. *Design-Anwendung* (Farben, Typografie und Spacing gemäß DESIGN.md).
  3. *Feinschliff & Interaktion* (Transitionen, Hover- und Focus-States, Performance-Optimierung).
- **Barrierefreiheit (a11y) & Performance:** Setze ab der ersten Zeile Code auf semantisches HTML, WCAG-konforme Kontraste, variable Schriftarten, AVIF-Medien und Tastaturzugänglichkeit.
- **Autonome Subagenten-Nutzung:** Warte nicht auf explizite Anweisungen des Benutzers, um Subagents zu spawnen. Nutze bei komplexen Aufgaben (z. B. anspruchsvolle Shader-Mathematik oder umfangreiche Refactorings) selbstständig spezialisierte Subagents wie einen `shader-specialist` zur Arbeitsteilung und etabliere vor Abschluss jedes Tasks zwingend einen `design-auditor` Subagenten zur finalen Gegenprüfung des Codes gegen `DESIGN.md` (Zwei-Augen-Prinzip).

