import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { AudioReactor, attachAudioToggle } from './audio-reactor.js';

// Build-Time-Flag aus vite.config.js. WEBGPU=1 npm run dev → WebGPU/TSL-Pfad,
// sonst klassischer WebGL/Three.js-r163-Pfad. Tree-Shaking eliminiert den
// jeweils ungenutzten Import komplett aus dem Bundle.
const ParticlesCtor = __WEBGPU__
  ? (await import('./src/webgpu/ParticleUniverse.js')).default
  : (await import('./particles.js')).default;
const SplatLayerCtor = __WEBGPU__
  ? (await import('./src/splat/SplatLayer.js')).SplatLayer
  : null;

console.log("main.js execution started!");
window.testMainLoaded = true;

// Register GSAP plugins
gsap.registerPlugin(ScrollTrigger);

// Modul-level Cleanup-Registry. Jede Listener-/Timer-Registrierung legt
// hier eine Remove-Funktion ab. cleanupAllAppModules ruft sie alle auf.
// Dadurch kann HMR-Dispose den Vorzustand sauber abbauen.
const _cleanups = [];
const registerCleanup = (fn) => { _cleanups.push(fn); };

async function initApp() {
    // Tier 3 — Single-Canvas-Architektur: EIN globales Particle-Universum statt 4.
    // Hohe Dichte, kräftige Post-FX, lebt im fixed #universe-canvas hinter allem.
    const universeCanvas = document.getElementById('universe-canvas');
    let universe = null;
    if (universeCanvas) {
        // Canvas auf Viewport-Size sizen, bevor init() läuft
        const sizeUniverse = () => {
            const dpr = Math.min(window.devicePixelRatio, 2);
            universeCanvas.style.width = '100vw';
            universeCanvas.style.height = '100vh';
            universeCanvas.width = Math.floor(window.innerWidth * dpr);
            universeCanvas.height = Math.floor(window.innerHeight * dpr);
        };
        sizeUniverse();
        window.addEventListener('resize', sizeUniverse);
        registerCleanup(() => window.removeEventListener('resize', sizeUniverse));

        universe = new ParticlesCtor(universeCanvas, {
            theme: 'dark',
            density: 280,
            particlesScale: 1.45,
            cameraZoom: 9.5,
            color1: '#6366f1',
            color2: '#00f3cc',
            color3: '#a855f7',
            post: {
                bloomStrength: 1.25,
                bloomRadius: 0.7,
                bloomThreshold: 0.1,
                chromaticOffset: 0.0032,
                filmIntensity: 0.18,
                trails: true,
                trailDamp: 0.88
            }
        });
        try {
            await universe.init();
            window.universe = universe;
            window.heroParticles = universe;
            window.leftParticles = universe;
            window.rightParticles = universe;
            window.formParticles = universe;
            universe.morphTo(0);
        } catch (err) {
            console.error('[WebGPU init failed] Falling back to WebGL legacy path:', err);
            // Sichtbar im DOM, damit man auch ohne DevTools merkt was los ist
            const banner = document.createElement('div');
            banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#a00;color:#fff;padding:8px;font:14px monospace;text-align:center';
            banner.textContent = '[Migration] WebGPU init failed — fallback active. Siehe DevTools-Console fuer Details.';
            document.body.appendChild(banner);
            // Graceful fallback: legacy ParticlesMain laden und verwenden
            try {
                const LegacyCtor = (await import('./particles.js')).default;
                universe = new LegacyCtor(universeCanvas, {
                    theme: 'dark', density: 280, particlesScale: 1.45, cameraZoom: 9.5,
                    color1: '#6366f1', color2: '#00f3cc', color3: '#a855f7',
                    post: { bloomStrength: 1.25, bloomRadius: 0.7, bloomThreshold: 0.1,
                            chromaticOffset: 0.0032, filmIntensity: 0.18, trails: true, trailDamp: 0.88 }
                });
                await universe.init();
                window.universe = universe;
                window.heroParticles = universe;
                window.leftParticles = universe;
                window.rightParticles = universe;
                window.formParticles = universe;
                universe.morphTo(0);
            } catch (legacyErr) {
                console.error('[Legacy fallback also failed]:', legacyErr);
            }
        }
    }
    // Lokale Refs für die bestehende Logik unten — alles zeigt aufs Universum.
    const heroParticles = universe;
    const leftParticles = universe;
    const rightParticles = universe;
    const formParticles = universe;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ambientVideos = document.querySelectorAll('.section-loop');
    if (prefersReducedMotion) {
        ambientVideos.forEach((video) => {
            video.pause();
            video.removeAttribute('autoplay');
        });
    } else {
        ambientVideos.forEach((video) => {
            video.muted = true;
            video.playsInline = true;
            const playVideo = () => {
                const playPromise = video.play();
                if (playPromise?.catch) playPromise.catch(() => {});
            };
            if (video.readyState >= 2) playVideo();
            else video.addEventListener('loadeddata', playVideo, { once: true });
        });
    }
    registerCleanup(() => ambientVideos.forEach((video) => video.pause()));

    const header = document.getElementById('main-header');
    if (header) {
        const syncHeaderState = () => header.classList.toggle('is-scrolled', window.scrollY > 14);
        syncHeaderState();
        window.addEventListener('scroll', syncHeaderState, { passive: true });
        registerCleanup(() => window.removeEventListener('scroll', syncHeaderState));
    }

    // 2. Wire Tab Switcher to WebGL Particle Morphing
    const tabButtons = document.querySelectorAll('.tab-btn');
    
    function switchTab(tabId) {
        // Update DOM classes & ARIA attributes for accessibility
        tabButtons.forEach(btn => {
            const isSelected = btn.id === `tab-btn-${tabId}`;
            btn.classList.toggle('active', isSelected);
            btn.setAttribute('aria-selected', isSelected ? 'true' : 'false');
            btn.setAttribute('tabindex', isSelected ? '0' : '-1'); // Dynamic tabindex for keyboard tabs
        });

        document.querySelectorAll('.tab-content').forEach(content => {
            const isActive = content.id === `tab-content-${tabId}`;
            content.classList.toggle('active', isActive);
        });

        // Morph particles dynamically based on active pillar
        if (heroParticles) {
            if (tabId === 'website') {
                heroParticles.morphTo(0); // Shape 0 (M - Websites)
            } else if (tabId === 'visibility') {
                heroParticles.morphTo(3); // Shape 3 (Globe - Visibility)
            } else if (tabId === 'automation') {
                heroParticles.morphTo(2); // Shape 2 (Gear - Workflows)
            }
        }
    }

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.id.replace('tab-btn-', '');
            if (document.startViewTransition) {
                document.startViewTransition(() => switchTab(tabId));
            } else {
                switchTab(tabId);
            }
        });
    });

    // WAI-ARIA keyboard navigation for tabs (Arrow keys)
    const tabList = document.querySelector('.feature-tabs');
    if (tabList) {
        tabList.addEventListener('keydown', (e) => {
            const activeBtn = document.activeElement;
            if (!activeBtn.classList.contains('tab-btn')) return;
            
            let index = Array.from(tabButtons).indexOf(activeBtn);
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault();
                index = (index + 1) % tabButtons.length;
                tabButtons[index].focus();
                tabButtons[index].click();
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault();
                index = (index - 1 + tabButtons.length) % tabButtons.length;
                tabButtons[index].focus();
                tabButtons[index].click();
            }
        });
    }

    window.switchTab = switchTab;

    // 3. Typewriter Title Animation
    const typedTitle = document.getElementById('typed-hero-title');
    if (typedTitle) {
        const rawText = typedTitle.innerText;
        typedTitle.innerHTML = '';
        const words = rawText.split(' ');
        const allSpans = [];
        
        words.forEach((word, wIdx) => {
            const wordSpan = document.createElement('span');
            wordSpan.className = 'hero-word';
            wordSpan.dataset.wordIndex = String(wIdx);
            wordSpan.style.display = 'inline-block';
            wordSpan.style.whiteSpace = 'nowrap';
            
            const chars = word.split('');
            chars.forEach((c) => {
                const charSpan = document.createElement('span');
                charSpan.className = 'hero-char';
                charSpan.textContent = c;
                charSpan.style.opacity = '0';
                charSpan.style.display = 'inline-block';
                wordSpan.appendChild(charSpan);
                allSpans.push(charSpan);
            });
            
            typedTitle.appendChild(wordSpan);
            
            // Add a space span after the word (except the last one)
            if (wIdx < words.length - 1) {
                const spaceSpan = document.createElement('span');
                spaceSpan.innerHTML = '&nbsp;';
                spaceSpan.style.opacity = '0';
                spaceSpan.style.display = 'inline-block';
                typedTitle.appendChild(spaceSpan);
                allSpans.push(spaceSpan);
            }
        });

        if (prefersReducedMotion) {
            gsap.set(allSpans, { opacity: 1 });
        } else {
            gsap.to(allSpans, {
                opacity: 1,
                duration: 0.05,
                stagger: {
                    each: 0.04
                },
                ease: 'none',
                scrollTrigger: {
                    trigger: typedTitle,
                    start: 'top 80%',
                    once: true
                }
            });
        }
    }

    const heroSurface = document.querySelector('.hero-command-surface');
    if (!prefersReducedMotion) {
        const heroTimeline = gsap.timeline({
            defaults: { ease: 'power3.out', duration: 0.62 }
        });

        heroTimeline
            .from('.hero-kicker', { y: 20, autoAlpha: 0 })
            .from('.logo-container', { scale: 0.88, autoAlpha: 0 }, '-=0.55')
            .from('.header-container', { y: 36, autoAlpha: 0 }, '-=0.5')
            .from('.hero-subtitle', { y: 24, autoAlpha: 0 }, '-=0.42')
            .from('.welcome-cta .button', { y: 18, autoAlpha: 0, stagger: 0.08 }, '-=0.35')
            .from('.hero-proof', { y: 18, autoAlpha: 0, stagger: 0.07 }, '-=0.28')
            .from('.hero-command-surface', { x: 44, y: 24, rotateY: -7, autoAlpha: 0, duration: 0.9 }, '-=1.05')
            .from('.signal-card-mini', { x: -18, autoAlpha: 0, stagger: 0.08 }, '-=0.58');

        heroTimeline.eventCallback('onComplete', () => {
            gsap.set('.hero-kicker, .logo-container, .header-container, .hero-subtitle, .welcome-cta .button, .hero-proof, .hero-command-surface, .signal-card-mini', {
                clearProps: 'opacity,visibility,transform'
            });
        });

        if (heroSurface) {
            const handleSurfaceMove = (event) => {
                const rect = heroSurface.getBoundingClientRect();
                const x = (event.clientX - rect.left) / rect.width;
                const y = (event.clientY - rect.top) / rect.height;
                const tiltX = (0.5 - y) * 8;
                const tiltY = (x - 0.5) * 10;

                gsap.to(heroSurface, {
                    '--tilt-x': `${tiltX}deg`,
                    '--tilt-y': `${tiltY}deg`,
                    '--pointer-x': `${Math.max(0, Math.min(100, x * 100))}%`,
                    '--pointer-y': `${Math.max(0, Math.min(100, y * 100))}%`,
                    duration: 0.45,
                    ease: 'power3.out'
                });
            };

            const resetSurface = () => {
                gsap.to(heroSurface, {
                    '--tilt-x': '0deg',
                    '--tilt-y': '0deg',
                    '--pointer-x': '50%',
                    '--pointer-y': '50%',
                    duration: 0.7,
                    ease: 'elastic.out(1, 0.55)'
                });
            };

            heroSurface.addEventListener('pointermove', handleSurfaceMove);
            heroSurface.addEventListener('pointerleave', resetSurface);
            registerCleanup(() => {
                heroSurface.removeEventListener('pointermove', handleSurfaceMove);
                heroSurface.removeEventListener('pointerleave', resetSurface);
            });
        }

        gsap.utils.toArray('.welcome-cta .button, .landing-latest-blogs-header .button, .solutions-cta .button, .proof-copy .button').forEach((button) => {
            const handleButtonMove = (event) => {
                const rect = button.getBoundingClientRect();
                const x = event.clientX - (rect.left + rect.width / 2);
                const y = event.clientY - (rect.top + rect.height / 2);
                gsap.to(button, { x: x * 0.12, y: y * 0.18, duration: 0.25, ease: 'power2.out' });
            };
            const resetButton = () => gsap.to(button, { x: 0, y: 0, duration: 0.42, ease: 'elastic.out(1, 0.5)' });

            button.addEventListener('pointermove', handleButtonMove);
            button.addEventListener('pointerleave', resetButton);
            registerCleanup(() => {
                button.removeEventListener('pointermove', handleButtonMove);
                button.removeEventListener('pointerleave', resetButton);
            });
        });
    } else {
        gsap.set('.hero-kicker, .logo-container, .header-container, .hero-subtitle, .welcome-cta .button, .hero-proof, .hero-command-surface, .signal-card-mini', {
            clearProps: 'all',
            autoAlpha: 1
        });
    }

    // 4. Bouncing Floating Icons Wave Animation (GSAP)
    const bouncers = gsap.utils.toArray('.bouncer');
    const bouncerList = document.querySelector('.icon-list');
    const bouncerSection = document.getElementById('agent-first-section');

    if (!prefersReducedMotion && bouncers.length > 0 && bouncerList && bouncerSection) {
        const amplitude = 35; // Amplitude of the bounce
        const freqRatio = 1;
        let wavelength = window.innerWidth / freqRatio;
        const positions = [];

        // Get relative horizontal position of each bouncer icon
        const calculatePositions = () => {
            positions.length = 0;
            bouncers.forEach(b => {
                const rect = b.getBoundingClientRect();
                const listRect = bouncerList.getBoundingClientRect();
                positions.push(rect.left - listRect.left + rect.width / 2);
            });
            wavelength = window.innerWidth / freqRatio;
        };
        calculatePositions();

        const setters = bouncers.map(b => gsap.quickSetter(b, 'y', 'px'));
        const animState = { phase: 0 };

        const updateWave = () => {
            const p = animState.phase;
            for (let h = 0; h < bouncers.length; h++) {
                const angle = ((positions[h] + p) / wavelength) * Math.PI * 2;
                const offset = Math.sin(angle) * amplitude;
                setters[h](offset);
            }
        };

        // Loop the wave tween
        let waveTween = gsap.to(animState, {
            phase: wavelength,
            duration: 7,
            ease: 'none',
            repeat: -1,
            onUpdate: updateWave
        });

        // Update positions on resize to fix the wave breaking bug
        const onWaveResize = () => {
            calculatePositions();
            waveTween.vars.phase = wavelength;
            waveTween.invalidate().restart();
        };
        window.addEventListener('resize', onWaveResize);
        registerCleanup(() => window.removeEventListener('resize', onWaveResize));
        registerCleanup(() => { try { waveTween.kill(); } catch (_) {} });

        // Horizontal scrolling offset scrub
        gsap.to(bouncerList, {
            x: -250,
            ease: 'none',
            scrollTrigger: {
                trigger: bouncerSection,
                start: 'top bottom',
                end: 'bottom top',
                scrub: true,
                onToggle: self => {
                    if (self.isActive) waveTween.play();
                    else waveTween.pause();
                }
            }
        });

        // Initialize positions
        bouncers.forEach((b, h) => {
            const startY = Math.sin((positions[h] / wavelength) * Math.PI * 2) * amplitude;
            gsap.set(b, { x: 0, y: startY, opacity: 1 });
        });
    }

    // 5. Staggered Entrance Animations for Cards and Sections (GSAP)
    if (!prefersReducedMotion) {
        gsap.from('.showcase-card', {
            scrollTrigger: {
                trigger: '.showcase-grid',
                start: 'top 85%',
                toggleActions: 'play none none reverse'
            },
            opacity: 0,
            y: 40,
            duration: 0.8,
            stagger: 0.15,
            ease: 'power2.out'
        });

        gsap.from('.solution-section', {
            scrollTrigger: {
                trigger: '.try-solutions-section',
                start: 'top 80%',
                toggleActions: 'play none none reverse'
            },
            opacity: 0,
            scale: 0.95,
            y: 30,
            duration: 1.0,
            stagger: 0.2,
            ease: 'power3.out'
        });

        gsap.from('.landing-latest-blogs .list-item', {
            scrollTrigger: {
                trigger: '.landing-latest-blogs-list',
                start: 'top 85%',
                toggleActions: 'play none none reverse'
            },
            opacity: 0,
            y: 35,
            duration: 0.8,
            stagger: 0.15,
            ease: 'power2.out'
        });

        gsap.from('.atlas-metric', {
            scrollTrigger: {
                trigger: '.atlas-metrics',
                start: 'top 85%',
                toggleActions: 'play none none reverse'
            },
            opacity: 0,
            y: 26,
            duration: 0.72,
            stagger: 0.1,
            ease: 'power2.out'
        });

        gsap.from('.operator-step', {
            scrollTrigger: {
                trigger: '.operator-steps',
                start: 'top 86%',
                toggleActions: 'play none none reverse'
            },
            opacity: 0,
            x: 28,
            duration: 0.74,
            stagger: 0.12,
            ease: 'power3.out'
        });

        gsap.from('.proof-rail-item', {
            scrollTrigger: {
                trigger: '.proof-rail',
                start: 'top 86%',
                toggleActions: 'play none none reverse'
            },
            opacity: 0,
            y: 32,
            duration: 0.76,
            stagger: 0.12,
            ease: 'power2.out'
        });

        gsap.utils.toArray('.showcase-header, .feature-tabs, .feature-copy, .feature-media, .atlas-copy, .media-stage, .operating-header, .proof-copy, .landing-latest-blogs-header, .download-section').forEach((el) => {
            gsap.from(el, {
                scrollTrigger: {
                    trigger: el,
                    start: 'top 88%',
                    toggleActions: 'play none none reverse'
                },
                opacity: 0,
                y: 28,
                duration: 0.82,
                ease: 'power3.out'
            });
        });

        gsap.utils.toArray('.feature-bullets li').forEach((el, index) => {
            gsap.from(el, {
                scrollTrigger: {
                    trigger: el.closest('.feature-copy') || el,
                    start: 'top 84%',
                    once: true
                },
                opacity: 0,
                x: -16,
                duration: 0.48,
                delay: index % 3 * 0.05,
                ease: 'power2.out'
            });
        });

        // 6. Smooth Parallax effects for grid sections relative to viewport
        gsap.utils.toArray('.showcase-card').forEach((card, idx) => {
            gsap.to(card, {
                yPercent: idx % 2 === 0 ? -5 : 5,
                ease: 'none',
                scrollTrigger: {
                    trigger: '.showcase-section',
                    start: 'top bottom',
                    end: 'bottom top',
                    scrub: true
                }
            });
        });

        gsap.utils.toArray('.media-stage').forEach((stage, idx) => {
            gsap.to(stage, {
                yPercent: idx % 2 === 0 ? -3 : 3,
                ease: 'none',
                scrollTrigger: {
                    trigger: stage,
                    start: 'top bottom',
                    end: 'bottom top',
                    scrub: true
                }
            });
        });
    }

    // 7. Audio-Reactor wiring — drei-Stufen-Toggle (off → ambient → mic).
    const allParticles = [heroParticles, leftParticles, rightParticles, formParticles].filter(Boolean);
    const audio = new AudioReactor();
    window.audioReactor = audio;
    attachAudioToggle(audio, allParticles);

    // 8. Hover-Text-Morph — bei Hover über Hero-Title formen die Partikel das Wort.
    const heroTitle = document.getElementById('typed-hero-title');
    if (heroTitle && heroParticles) {
        let restoreTimer = null;
        const morphHotspots = heroTitle.querySelectorAll('span > span');
        const candidates = morphHotspots.length > 0
            ? Array.from(heroTitle.querySelectorAll('span')).filter(s => s.children.length === 0 || s.children[0].tagName !== 'SPAN')
            : [heroTitle];

        const wordTargets = Array.from(heroTitle.querySelectorAll('span')).filter(s => {
            const txt = s.textContent.trim();
            return txt.length >= 3 && !txt.match(/^[\s ]+$/);
        });

        wordTargets.forEach(el => {
            el.style.cursor = 'crosshair';
            el.addEventListener('mouseenter', () => {
                clearTimeout(restoreTimer);
                const word = el.textContent.trim().toUpperCase();
                if (word.length > 0) heroParticles.morphToText(word);
            });
            el.addEventListener('mouseleave', () => {
                restoreTimer = setTimeout(() => heroParticles.morphTo(0), 350);
            });
        });
    }

    // Tier 3 — Master-Scroll-Choreographie: Shape + Kamera + Farbpalette pro Section.
    // 0=M, 1=T, 2=Gear, 3=Globe, 4=Hexagon.
    const sectionStages = [
        { sel: '#hero-section',              shape: 0, cameraZ: 9.5,  colors: ['#6366f1', '#00f3cc', '#a855f7'] },
        { sel: '#showcase-section',          shape: 2, cameraZ: 11.5, colors: ['#00f3cc', '#6366f1', '#f9f9fb'] },
        { sel: '#agent-first-section',       shape: 4, cameraZ: 12.5, colors: ['#a855f7', '#6366f1', '#00f3cc'] },
        { sel: '#leistungen',                shape: 0, cameraZ: 10.5, colors: ['#6366f1', '#00f3cc', '#f9f9fb'] },
        { sel: '#signal-atlas',              shape: 3, cameraZ: 10.8, colors: ['#00f3cc', '#6366f1', '#f9c846'] },
        { sel: '#operating-room',            shape: 2, cameraZ: 11.8, colors: ['#6366f1', '#27f570', '#00f3cc'] },
        { sel: '#gravity-proof',             shape: 4, cameraZ: 12.2, colors: ['#f9c846', '#00f3cc', '#6366f1'] },
        { sel: '#try-solutions-section',     shape: 3, cameraZ: 11,   colors: ['#a855f7', '#00f3cc', '#f9f9fb'] },
        { sel: '#latest-blogs',              shape: 1, cameraZ: 13,   colors: ['#6366f1', '#a855f7', '#00f3cc'] },
        { sel: '#analysis-section',          shape: 1, cameraZ: 14,   colors: ['#0d0e12', '#6366f1', '#00f3cc'] }
    ];
    if (universe) {
        const applyStage = (stage) => {
            universe.morphTo(stage.shape);
            gsap.to(universe.camera.position, {
                z: stage.cameraZ,
                duration: 1.4,
                ease: 'power2.inOut',
                onUpdate: () => universe.camera.updateProjectionMatrix()
            });
            universe.setColors(stage.colors[0], stage.colors[1], stage.colors[2]);
        };
        sectionStages.forEach((stage) => {
            const el = document.querySelector(stage.sel);
            if (!el) return;
            ScrollTrigger.create({
                trigger: el,
                start: 'top 60%',
                end: 'bottom 40%',
                onEnter: () => applyStage(stage),
                onEnterBack: () => applyStage(stage)
            });
        });

        // Gaussian-Splat-Layer (nur WebGPU-Pfad). Bei Eintritt in
        // #try-solutions-section dimmt das Partikel-Universum auf 25 % Alpha
        // und der Splat-Viewer wird sichtbar — gibt der "globalen Reach"-
        // Narrative der Section einen fotorealistischen 3D-Anker.
        if (SplatLayerCtor && universe.renderer && universe.scene && universe.camera) {
            const splat = new SplatLayerCtor({
                renderer: universe.renderer,
                scene: universe.scene,
                camera: universe.camera
            });
            splat.load();  // async, kein await — Layer bleibt einfach unsichtbar bis loaded
            window.splatLayer = splat;
            ScrollTrigger.create({
                trigger: '#try-solutions-section',
                start: 'top 70%',
                end: 'bottom 30%',
                onEnter: () => {
                    splat.setVisible(true);
                    gsap.to(universe, { alpha: 0.25, duration: 0.8, ease: 'power2.out' });
                },
                onLeave: () => {
                    gsap.to(universe, {
                        alpha: 1.0, duration: 0.8, ease: 'power2.in',
                        onComplete: () => splat.setVisible(false)
                    });
                },
                onEnterBack: () => {
                    splat.setVisible(true);
                    gsap.to(universe, { alpha: 0.25, duration: 0.8, ease: 'power2.out' });
                },
                onLeaveBack: () => {
                    gsap.to(universe, {
                        alpha: 1.0, duration: 0.8, ease: 'power2.in',
                        onComplete: () => splat.setVisible(false)
                    });
                }
            });
            registerCleanup(() => { try { splat.dispose(); } catch (_) {} window.splatLayer = null; });
        }
    }

    // Bonus: Cinematic Auto-Bursts — alle 7-12s spontaner Particle-Pop an Random-Position.
    // Macht die Page auch ohne Interaktion lebendig (TV-Werbespot-Niveau).
    if (!prefersReducedMotion && heroParticles) {
        let burstTimer = null;
        let burstStopped = false;
        const scheduleBurst = () => {
            if (burstStopped) return;
            const delay = 7000 + Math.random() * 5000;
            burstTimer = setTimeout(() => {
                if (burstStopped) return;
                if (document.hidden) { scheduleBurst(); return; }
                // Disposed-Guard: nach cleanupAllAppModules ist die Instanz tot.
                if (heroParticles._disposed) return;
                const x = (Math.random() - 0.5) * 0.7;
                const y = (Math.random() - 0.5) * 0.7;
                heroParticles.triggerBurstAt(x, y, 0.5 + Math.random() * 0.5);
                scheduleBurst();
            }, delay);
        };
        scheduleBurst();
        registerCleanup(() => {
            burstStopped = true;
            if (burstTimer) clearTimeout(burstTimer);
            burstTimer = null;
        });
    }

    // 9. Easter-Egg: Konami-Code → Anti-Gravity Mode toggle.
    // ↑ ↑ ↓ ↓ ← → ← → b a
    const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
                    'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
    let konamiIdx = 0;
    let antiGravity = false;
    const onKonamiKey = (e) => {
        const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
        if (k === KONAMI[konamiIdx]) {
            konamiIdx++;
            if (konamiIdx === KONAMI.length) {
                antiGravity = !antiGravity;
                allParticles.forEach(p => p.setAntiGravity?.(antiGravity));
                document.body.classList.toggle('anti-gravity-mode', antiGravity);
                konamiIdx = 0;
            }
        } else {
            konamiIdx = k === KONAMI[0] ? 1 : 0;
        }
    };
    window.addEventListener('keydown', onKonamiKey);
    registerCleanup(() => window.removeEventListener('keydown', onKonamiKey));
}
initApp();

// Globale Deinitialisierungs- und Cleanup-Routine zur Vermeidung von Memory Leaks.
// WICHTIG: heroParticles/leftParticles/rightParticles/formParticles sind seit
// dem Tier-3-Single-Canvas-Refactor ALLE Aliase auf dieselbe universe-Instanz.
// Frueher wurden vier separate Instanzen disposed — jetzt nur noch eine, sonst
// laeuft Three.js' interner Dispose-Pfad gegen schon disposed Objekte und wirft.
window.cleanupAllAppModules = () => {
    // 1. Listener/Timer/Audio-Subscriptions zuerst stoppen — verhindert,
    //    dass Hintergrund-Callbacks waehrend dispose auf disposed Objekte feuern.
    while (_cleanups.length) {
        const fn = _cleanups.pop();
        try { fn(); } catch (e) { console.warn('Cleanup hook failed:', e); }
    }

    // 2. Audio-Reactor abschalten und AudioContext schliessen
    //    (verhindert AudioContext-Leak ueber HMR-Reloads).
    if (window.audioReactor) {
        try { window.audioReactor.dispose(); } catch (e) { console.warn(e); }
        window.audioReactor = null;
    }

    // 3. Particle-Universe genau einmal disposen.
    if (window.universe) {
        try { window.universe.dispose(); } catch (e) { console.warn(e); }
        window.universe = null;
    }
    // Aliase mit-nullen (zeigen jetzt auf disposed Instanz).
    window.heroParticles = null;
    window.leftParticles = null;
    window.rightParticles = null;
    window.formParticles = null;

    // 4. GSAP-Aufraeumung
    ScrollTrigger.getAll().forEach(trigger => trigger.kill(true));
    gsap.killTweensOf('*');

    console.log('WebGL & GSAP Module erfolgreich bereinigt.');
};

// Vite HMR: vor jedem Modul-Reload das alte App-State abbauen, damit
// Listener, Timer, GPU-Ressourcen nicht ueber Edits hinweg kumulieren.
if (import.meta.hot) {
    import.meta.hot.dispose(() => {
        if (typeof window.cleanupAllAppModules === 'function') {
            window.cleanupAllAppModules();
        }
    });
}
