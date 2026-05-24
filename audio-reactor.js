// Web-Audio-Reactor: liefert kontinuierlich Bass / Mid / Treble (0..1).
// Source-Modi:
//   'mic'   — getUserMedia, braucht User-Consent (Click-Geste)
//   'tone'  — interner Oscillator + Noise, immer aktiv, kein Consent nötig
//   'mute'  — alle Bänder bleiben 0
//
// Listener werden via subscribe(fn) registriert und pro RAF mit (bass, mid, treble) aufgerufen.

const BANDS = {
    bass:   [20, 220],
    mid:    [220, 2000],
    treble: [2000, 16000]
};

export class AudioReactor {
    constructor() {
        this.ctx = null;
        this.analyser = null;
        this.dataArray = null;
        this.source = null;
        this.mode = 'mute';
        this.bass = 0;
        this.mid = 0;
        this.treble = 0;
        this.listeners = new Set();
        this._smooth = { bass: 0, mid: 0, treble: 0 };
        this._raf = null;
        this._running = false;
    }

    subscribe(fn) {
        this.listeners.add(fn);
        return () => this.listeners.delete(fn);
    }

    async start(mode = 'mic') {
        await this._ensureContext();
        if (this.source) this._detachSource();

        if (mode === 'mic') {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                this.source = this.ctx.createMediaStreamSource(stream);
                this._micStream = stream;
                this.mode = 'mic';
            } catch (err) {
                console.warn('Audio: Mikro-Permission verweigert, fallback auf Tone-Generator.', err);
                return this.start('tone');
            }
        } else if (mode === 'tone') {
            // Self-sustaining Ambient Drone: 3 Oscillators + Noise-Buffer
            const merger = this.ctx.createGain();
            merger.gain.value = 0.25;

            const freqs = [55, 110, 220];
            this._toneNodes = freqs.map((f, i) => {
                const osc = this.ctx.createOscillator();
                osc.type = i === 2 ? 'triangle' : 'sine';
                osc.frequency.value = f;
                const lfo = this.ctx.createOscillator();
                lfo.frequency.value = 0.07 + i * 0.05;
                const lfoGain = this.ctx.createGain();
                lfoGain.gain.value = f * 0.04;
                lfo.connect(lfoGain).connect(osc.frequency);
                const g = this.ctx.createGain();
                g.gain.value = 0.18;
                osc.connect(g).connect(merger);
                osc.start();
                lfo.start();
                return { osc, lfo, g };
            });

            const noiseBuf = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
            const ch = noiseBuf.getChannelData(0);
            for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * 0.15;
            const noise = this.ctx.createBufferSource();
            noise.buffer = noiseBuf;
            noise.loop = true;
            const noiseGain = this.ctx.createGain();
            noiseGain.gain.value = 0.05;
            noise.connect(noiseGain).connect(merger);
            noise.start();
            this._noiseNode = noise;

            this.source = merger;
            this.mode = 'tone';
        } else {
            this.mode = 'mute';
            return;
        }

        this.source.connect(this.analyser);
        // _running MUSS vor _loop() gesetzt werden — _loop()s eigener Guard
        // `if (!this._running) return` haette sonst beim ersten Aufruf direkt
        // beendet und nie ein RAF geplant.
        if (!this._running) {
            this._running = true;
            this._loop();
        }
    }

    stop() {
        this._running = false;
        if (this._raf) cancelAnimationFrame(this._raf);
        this._raf = null;
        this._detachSource();
        this.mode = 'mute';
        this.bass = this.mid = this.treble = 0;
        this._smooth.bass = this._smooth.mid = this._smooth.treble = 0;
        // Subscribers mit (0,0,0) flushen, damit Bloom-Strength + Audio-Uniforms
        // nicht am letzten Non-Zero-Wert haengen bleiben.
        for (const fn of this.listeners) {
            try { fn(0, 0, 0); } catch (_) {}
        }
    }

    dispose() {
        this.stop();
        if (this.ctx && this.ctx.state !== 'closed') {
            try { this.ctx.close(); } catch (_) {}
        }
        this.ctx = null;
        this.analyser = null;
        this.dataArray = null;
        this.listeners.clear();
    }

    _detachSource() {
        try { this.source?.disconnect(); } catch (_) {}
        this.source = null;
        if (this._toneNodes) {
            this._toneNodes.forEach(n => { try { n.osc.stop(); n.lfo.stop(); } catch (_) {} });
            this._toneNodes = null;
        }
        if (this._noiseNode) { try { this._noiseNode.stop(); } catch (_) {} this._noiseNode = null; }
        if (this._micStream) {
            this._micStream.getTracks().forEach(t => t.stop());
            this._micStream = null;
        }
    }

    async _ensureContext() {
        if (this.ctx) {
            if (this.ctx.state === 'suspended') await this.ctx.resume();
            return;
        }
        const AC = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AC();
        if (this.ctx.state === 'suspended') await this.ctx.resume();
        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 1024;
        this.analyser.smoothingTimeConstant = 0.78;
        this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    }

    _bandEnergy(loHz, hiHz) {
        const nyquist = this.ctx.sampleRate / 2;
        const binWidth = nyquist / this.analyser.frequencyBinCount;
        const loBin = Math.max(0, Math.floor(loHz / binWidth));
        const hiBin = Math.min(this.dataArray.length, Math.ceil(hiHz / binWidth));
        let sum = 0;
        for (let i = loBin; i < hiBin; i++) sum += this.dataArray[i];
        const avg = sum / Math.max(1, hiBin - loBin);
        return avg / 255;
    }

    _loop() {
        if (!this._running) return;
        this.analyser.getByteFrequencyData(this.dataArray);
        const rawBass   = this._bandEnergy(...BANDS.bass);
        const rawMid    = this._bandEnergy(...BANDS.mid);
        const rawTreble = this._bandEnergy(...BANDS.treble);

        // Asymmetric smoothing: schnell rauf, langsam runter — fühlt sich punchy an.
        const up = 0.55, down = 0.08;
        this._smooth.bass   += (rawBass   - this._smooth.bass)   * (rawBass   > this._smooth.bass   ? up : down);
        this._smooth.mid    += (rawMid    - this._smooth.mid)    * (rawMid    > this._smooth.mid    ? up : down);
        this._smooth.treble += (rawTreble - this._smooth.treble) * (rawTreble > this._smooth.treble ? up : down);

        const gain = 1.6;
        this.bass   = Math.min(1, this._smooth.bass   * gain * 1.3);
        this.mid    = Math.min(1, this._smooth.mid    * gain);
        this.treble = Math.min(1, this._smooth.treble * gain * 0.9);

        for (const fn of this.listeners) fn(this.bass, this.mid, this.treble);
        this._raf = requestAnimationFrame(() => this._loop());
    }
}

export function attachAudioToggle(audio, particleInstances) {
    audio.subscribe((b, m, t) => {
        for (const p of particleInstances) p?.setAudioBands?.(b, m, t);
    });

    let btn = document.getElementById('audio-toggle');
    if (!btn) {
        btn = document.createElement('button');
        btn.id = 'audio-toggle';
        btn.type = 'button';
        btn.className = 'audio-toggle';
        btn.setAttribute('aria-label', 'Audio-Reaktivitaet an/aus');

        const dot = document.createElement('span');
        dot.className = 'audio-toggle-dot';
        const label = document.createElement('span');
        label.className = 'audio-toggle-label';
        label.textContent = 'SOUND';
        btn.appendChild(dot);
        btn.appendChild(label);

        const header = document.querySelector('#main-header .header-container, header, body');
        header?.appendChild(btn);
    }

    const labelEl = btn.querySelector('.audio-toggle-label');
    let state = 'off';
    const setLabel = (s) => {
        btn.dataset.state = s;
        labelEl.textContent = s === 'mic' ? 'MIC LIVE' : s === 'tone' ? 'AMBIENT' : 'SOUND';
    };
    setLabel(state);

    btn.addEventListener('click', async () => {
        if (state === 'off') {
            await audio.start('tone');
            state = 'tone';
        } else if (state === 'tone') {
            await audio.start('mic');
            state = audio.mode;
        } else {
            audio.stop();
            state = 'off';
        }
        setLabel(state);
    });

    return btn;
}
