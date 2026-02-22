import { Storage } from './storage.js';

let audioCtx = null;
export let musicPlaying = false;
export let bgMusic = null;

let sfxMasterGain = null;
let musicVolume = Storage.load('loveJourneyVolume', 0.3);
let sfxVolume = Storage.load('loveJourneySfxVolume', 0.7);

const soundBuffers = {};
const soundCooldowns = {};
let soundsReady = false;

export function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        initSoundBuffers();
    }
}

function getSfxDest() {
    if (!audioCtx) return null;
    if (!sfxMasterGain) {
        sfxMasterGain = audioCtx.createGain();
        sfxMasterGain.gain.value = sfxVolume;
        sfxMasterGain.connect(audioCtx.destination);
    }
    return sfxMasterGain;
}

export function getMusicVolume() { return musicVolume; }
export function getSfxVolume() { return sfxVolume; }

export function changeVolume(pct) {
    musicVolume = pct / 100;
    if (bgMusic) {
        bgMusic.volume = musicVolume;
    }
    Storage.save('loveJourneyVolume', musicVolume);
}

export function changeSfxVolume(pct) {
    sfxVolume = pct / 100;
    if (sfxMasterGain) {
        sfxMasterGain.gain.value = sfxVolume;
    }
    Storage.save('loveJourneySfxVolume', sfxVolume);
}

export function startMusic() {
    if (musicPlaying) return;
    if (!bgMusic) {
        bgMusic = new Audio('photos/music.mp3');
        bgMusic.loop = true;
        bgMusic.volume = musicVolume;
    }
    bgMusic.play().then(() => {
        musicPlaying = true;
        const btn = document.getElementById('musicBtn');
        if (btn) {
            btn.classList.remove('off');
            btn.textContent = '🎵';
        }
    }).catch(() => { });
}

export function stopMusic() {
    if (bgMusic) bgMusic.pause();
    musicPlaying = false;
    const btn = document.getElementById('musicBtn');
    if (btn) {
        btn.classList.add('off');
        btn.textContent = '🔇';
    }
}

let allMuted = false;

export function toggleMusic() {
    allMuted = !allMuted;
    const btn = document.getElementById('musicBtn');

    if (allMuted) {
        // Mute everything
        if (bgMusic) bgMusic.pause();
        musicPlaying = false;
        if (sfxMasterGain) sfxMasterGain.gain.value = 0;
        if (btn) {
            btn.classList.add('off');
            btn.textContent = '🔇';
        }
    } else {
        // Unmute SFX and Music
        if (sfxMasterGain) sfxMasterGain.gain.value = sfxVolume;
        if (bgMusic) {
            bgMusic.play().then(() => { musicPlaying = true; }).catch(() => { });
        } else {
            startMusic();
        }
        if (btn) {
            btn.classList.remove('off');
            btn.textContent = '🎵';
        }
    }
}

async function renderSound(duration, buildFn) {
    const sr = 44100;
    const offline = new OfflineAudioContext(1, Math.ceil(sr * duration), sr);
    await buildFn(offline);
    return await offline.startRendering();
}

function createNoiseBuffer(ctx, duration) {
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
}

function addTone(ctx, freq, type, vol, start, dur, fFreq, fType, freqEnd) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, start);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, start + dur);
    g.gain.setValueAtTime(vol, start);
    g.gain.exponentialRampToValueAtTime(0.001, start + dur);
    o.connect(g);
    if (fFreq) {
        const f = ctx.createBiquadFilter();
        f.type = fType || 'lowpass'; f.frequency.value = fFreq; f.Q.value = 1;
        g.connect(f); f.connect(ctx.destination);
    } else { g.connect(ctx.destination); }
    o.start(start); o.stop(start + dur + 0.01);
}

function addNoise(ctx, vol, start, dur, fFreq, fType) {
    const src = ctx.createBufferSource();
    src.buffer = createNoiseBuffer(ctx, dur + 0.05);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, start);
    g.gain.exponentialRampToValueAtTime(0.001, start + dur);
    const f = ctx.createBiquadFilter();
    f.type = fType || 'lowpass'; f.frequency.value = fFreq || 2000; f.Q.value = 0.7;
    src.connect(g); g.connect(f); f.connect(ctx.destination);
    src.start(start); src.stop(start + dur + 0.02);
}

async function initSoundBuffers() {
    if (soundsReady) return;
    try {
        soundBuffers['select'] = await renderSound(0.15, async (c) => {
            addTone(c, 880, 'sine', 0.25, 0, 0.1, 2500);
            addTone(c, 1320, 'triangle', 0.1, 0.01, 0.08, 2000);
            addNoise(c, 0.04, 0, 0.02, 6000, 'highpass');
        });
        soundBuffers['swap'] = await renderSound(0.18, async (c) => {
            addTone(c, 350, 'triangle', 0.25, 0, 0.1, 1800);
            addTone(c, 550, 'triangle', 0.18, 0.04, 0.1, 2200);
        });
        soundBuffers['match'] = await renderSound(0.45, async (c) => {
            addTone(c, 698, 'sine', 0.3, 0, 0.25, 2500);
            addTone(c, 1396, 'sine', 0.1, 0, 0.15, 3500);
            addTone(c, 523, 'triangle', 0.15, 0.01, 0.15, 1800);
            addTone(c, 698, 'sine', 0.08, 0.15, 0.2, 1500);
        });
        soundBuffers['combo'] = await renderSound(0.55, async (c) => {
            addTone(c, 523, 'sine', 0.25, 0, 0.4, 2500);
            addTone(c, 659, 'sine', 0.2, 0, 0.35, 3000);
            addTone(c, 784, 'sine', 0.15, 0, 0.35, 3000);
            addTone(c, 262, 'sawtooth', 0.08, 0, 0.3, 600);
            addTone(c, 1047, 'sine', 0.06, 0.05, 0.25, 2000);
        });
        soundBuffers['shuffle'] = await renderSound(0.3, async (c) => {
            addTone(c, 500, 'sawtooth', 0.12, 0, 0.2, 1200, 'lowpass', 180);
            addNoise(c, 0.06, 0, 0.2, 1000);
        });
        soundBuffers['win'] = await renderSound(2.0, async (c) => {
            [523, 659, 784, 1047, 1319].forEach((fr, i) => {
                addTone(c, fr, 'sine', 0.22, i * 0.12, 0.7, 3000);
                addTone(c, fr, 'sine', 0.06, i * 0.12 + 0.18, 0.4, 1500);
            });
            addTone(c, 262, 'triangle', 0.1, 0, 1.5, 1200);
            addTone(c, 330, 'triangle', 0.08, 0, 1.3, 1200);
            addTone(c, 392, 'triangle', 0.06, 0, 1.2, 1200);
        });
        soundBuffers['lose'] = await renderSound(1.8, async (c) => {
            [440, 415, 370, 330, 294].forEach((fr, i) => {
                addTone(c, fr, 'sine', 0.15, i * 0.2, 0.6, 1800);
                addTone(c, fr * 0.5, 'triangle', 0.06, i * 0.2, 0.5, 800);
            });
            addTone(c, 147, 'sine', 0.08, 0.8, 0.7, 600);
        });
        soundBuffers['bomb'] = await renderSound(1.0, async (c) => {
            addTone(c, 50, 'sine', 0.5, 0, 0.8, 150, 'lowpass', 15);
            addTone(c, 100, 'sawtooth', 0.15, 0, 0.5, 350, 'lowpass', 30);
            addNoise(c, 0.4, 0, 0.04, 4000);
            addNoise(c, 0.2, 0.01, 0.5, 2000);
            addNoise(c, 0.12, 0.03, 0.6, 300);
            addNoise(c, 0.06, 0.08, 0.35, 6000, 'highpass');
        });
        soundBuffers['rocket'] = await renderSound(0.6, async (c) => {
            addTone(c, 120, 'sawtooth', 0.2, 0, 0.5, 2000, 'lowpass', 1800);
            addTone(c, 400, 'sine', 0.08, 0, 0.4, 3000, 'lowpass', 2500);
            addNoise(c, 0.15, 0, 0.4, 4000, 'bandpass');
            addTone(c, 1200, 'sine', 0.05, 0.25, 0.25, 1500, 'lowpass', 300);
        });
        soundBuffers['rainbow'] = await renderSound(1.4, async (c) => {
            [523, 587, 659, 698, 784, 880, 988, 1047, 1175, 1319].forEach((fr, i) => {
                addTone(c, fr, 'sine', 0.15, i * 0.07, 0.6, 3500);
                addTone(c, fr, 'sine', 0.04, i * 0.07 + 0.1, 0.35, 2000);
            });
            addTone(c, 1047, 'triangle', 0.06, 0, 1.0, 2000);
            addTone(c, 1319, 'triangle', 0.04, 0.1, 0.9, 2000);
            addNoise(c, 0.03, 0.3, 0.6, 8000, 'highpass');
        });
        soundBuffers['stage-up'] = await renderSound(1.4, async (c) => {
            [392, 523, 659, 784].forEach((fr, i) => {
                addTone(c, fr, 'sine', 0.25, i * 0.1, 0.6, 3000);
                addTone(c, fr, 'sawtooth', 0.04, i * 0.1, 0.35, 1500);
            });
            addTone(c, 784, 'sine', 0.15, 0.45, 0.7, 2500);
            addTone(c, 988, 'sine', 0.1, 0.45, 0.6, 2500);
            addTone(c, 131, 'sine', 0.25, 0, 0.35, 400);
            addNoise(c, 0.08, 0, 0.06, 600);
        });
        soundBuffers['timer-warning'] = await renderSound(0.45, async (c) => {
            addTone(c, 880, 'square', 0.1, 0, 0.09, 2500);
            addTone(c, 988, 'square', 0.1, 0.1, 0.09, 2500);
            addTone(c, 880, 'square', 0.08, 0.2, 0.07, 2000);
            addTone(c, 988, 'sine', 0.05, 0.3, 0.07, 1800);
        });
        soundBuffers['congrats'] = await renderSound(2.2, async (c) => {
            [523, 659, 784, 1047, 1319, 1568].forEach((fr, i) => {
                addTone(c, fr, 'sine', 0.18, i * 0.14, 0.9, 3500);
                addTone(c, fr, 'sine', 0.05, i * 0.14 + 0.12, 0.5, 1800);
            });
            [262, 330, 392].forEach(fr => addTone(c, fr, 'triangle', 0.09, 0, 1.6, 1200));
            addTone(c, 131, 'sine', 0.08, 0, 1.2, 400);
            addNoise(c, 0.02, 0.6, 0.8, 10000, 'highpass');
            addTone(c, 523, 'sine', 0.12, 0.9, 1.0, 2500);
            addTone(c, 659, 'sine', 0.1, 0.9, 0.9, 2500);
        });
        soundBuffers['lightning'] = await renderSound(0.5, async (c) => {
            addTone(c, 2200, 'sawtooth', 0.25, 0, 0.08, 4000);
            addTone(c, 3300, 'square', 0.15, 0.02, 0.06, 5000);
            addTone(c, 1800, 'sawtooth', 0.2, 0.08, 0.1, 3500);
            addTone(c, 4000, 'square', 0.1, 0.15, 0.05, 6000);
            addNoise(c, 0.12, 0, 0.15, 3000, 'highpass');
            addTone(c, 800, 'sine', 0.1, 0.1, 0.3, 1500);
            addNoise(c, 0.06, 0.2, 0.2, 5000, 'highpass');
        });
        soundBuffers['button'] = await renderSound(0.1, async (c) => {
            addTone(c, 700, 'sine', 0.15, 0, 0.06, 3000);
            addTone(c, 1100, 'sine', 0.06, 0, 0.04, 4000);
            addNoise(c, 0.03, 0, 0.02, 8000, 'highpass');
        });
        soundsReady = true;
    } catch (e) {
        console.warn('[SFX] Sound init failed:', e);
    }
}

export function playSound(type) {
    if (!audioCtx || allMuted) return;
    const dest = getSfxDest();
    if (!dest) return;

    if (!soundsReady) { initSoundBuffers(); return; }
    const buf = soundBuffers[type];
    if (!buf) return;

    const now = performance.now();
    const cooldownMs = { bomb: 100, rainbow: 150, rocket: 100, lightning: 100, congrats: 500 };
    if (cooldownMs[type]) {
        if (soundCooldowns[type] && now - soundCooldowns[type] < cooldownMs[type]) return;
        soundCooldowns[type] = now;
    }

    try {
        const src = audioCtx.createBufferSource();
        src.buffer = buf;
        src.connect(dest);
        src.start();
    } catch (e) { }
}
