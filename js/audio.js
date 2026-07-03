// =========================
// 音效系统 (Web Audio API)
// =========================

import { settings } from "./state.js";

let audioCtx = null;

function getAudioCtx() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtx;
}

/** 播放一个简单音调 */
function playTone(freq, duration, type = "square", volume = 0.08, delay = 0) {
    try {
        const ctx = getAudioCtx();
        const t = ctx.currentTime + delay;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(volume, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(t);
        osc.stop(t + duration);
    } catch (_) { /* 静默处理音频错误 */ }
}

/** 从设置中获取当前音量倍率 (0–1) */
function volScale() {
    return settings.volume / 100;
}


// --- 音效预设 ---

export function sfxClick() {
    if (settings.volume <= 0) return;
    playTone(800, 0.06, "square", 0.04 * volScale());
}

export function sfxFlag() {
    if (settings.volume <= 0) return;
    const v = volScale();
    playTone(1200, 0.08, "sine", 0.05 * v);
    playTone(1400, 0.06, "sine", 0.04 * v, 0.06);
}

export function sfxReveal() {
    if (settings.volume <= 0) return;
    const v = volScale();
    playTone(500, 0.12, "sine", 0.03 * v);
    playTone(700, 0.10, "sine", 0.03 * v, 0.08);
}

export function sfxLose() {
    if (settings.volume <= 0) return;
    const v = volScale();
    const notes = [600, 500, 400, 300, 200];
    notes.forEach((freq, i) => {
        playTone(freq, 0.25, "sawtooth", 0.06 * v, i * 0.15);
    });
    setTimeout(() => playTone(80, 0.8, "sawtooth", 0.08 * v), notes.length * 150);
}

export function sfxWin() {
    if (settings.volume <= 0) return;
    const v = volScale();
    const notes = [523, 659, 784, 1047, 1319, 1568];
    notes.forEach((freq, i) => {
        playTone(freq, 0.22, "sine", 0.07 * v, i * 0.12);
    });
    setTimeout(() => {
        playTone(523, 0.5, "triangle", 0.06 * v, 0);
        playTone(659, 0.5, "triangle", 0.06 * v, 0);
        playTone(784, 0.5, "triangle", 0.06 * v, 0);
        playTone(1047, 0.5, "triangle", 0.06 * v, 0);
    }, notes.length * 120 + 60);
}
