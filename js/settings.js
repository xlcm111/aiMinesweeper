// =========================
// 设置面板
// =========================

import { DEFAULT_SETTINGS } from "./config.js";
import { settings } from "./state.js";


// =========================
// DOM 元素
// =========================

const settingsToggleBtn = document.getElementById("settings-toggle");
const settingsOverlay   = document.getElementById("settings-overlay");
const settingsPanel     = document.getElementById("settings-panel");
const settingsCloseBtn  = document.getElementById("settings-close");
const settingVolume     = document.getElementById("setting-volume");
const volumeVal         = document.getElementById("volume-val");
const settingParticles  = document.getElementById("setting-particles");
const settingAnimations = document.getElementById("setting-animations");
const settingCustom     = document.getElementById("setting-custom");
const settingsResetBtn  = document.getElementById("settings-reset");
const customFields      = document.getElementById("custom-difficulty-fields");
const customRows        = document.getElementById("custom-rows");
const customCols        = document.getElementById("custom-cols");
const customMines       = document.getElementById("custom-mines");
const maxMinesHint      = document.getElementById("max-mines-hint");
const applyCustomBtn    = document.getElementById("apply-custom");
const bgCanvas          = document.getElementById("bg-canvas");


// =========================
// 设置操作
// =========================

export function persistSettings() {
    try {
        localStorage.setItem("minesweeper-settings", JSON.stringify(settings));
    } catch (_) { /* 忽略 */ }
}

export function resetSettings() {
    Object.assign(settings, DEFAULT_SETTINGS);
    persistSettings();
    applySettingsUI();
}

export function applySettingsUI() {
    settingVolume.value = settings.volume;
    volumeVal.textContent = settings.volume + "%";
    settingParticles.checked = settings.particles;
    settingAnimations.checked = settings.animations;
    settingCustom.checked = settings.custom;

    if (settings.custom) {
        customFields.classList.remove("collapsed");
    } else {
        customFields.classList.add("collapsed");
    }

    if (bgCanvas) {
        bgCanvas.style.display = settings.particles ? "" : "none";
    }

    document.documentElement.classList.toggle("no-anim", !settings.animations);
    document.documentElement.setAttribute("data-theme", settings.theme);
    document.querySelectorAll("#theme-grid .theme-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.theme === settings.theme);
    });
}


// =========================
// 面板开关
// =========================

function openSettings() {
    settingsOverlay.classList.add("open");
    settingsPanel.classList.add("open");
    settingsToggleBtn.style.opacity = "0";
    settingsToggleBtn.style.pointerEvents = "none";
}

function closeSettings() {
    settingsOverlay.classList.remove("open");
    settingsPanel.classList.remove("open");
    settingsToggleBtn.style.opacity = "";
    settingsToggleBtn.style.pointerEvents = "";
}


// =========================
// 自定义难度
// =========================

function updateMaxMinesHint() {
    const rows = parseInt(customRows.value) || 9;
    const cols = parseInt(customCols.value) || 9;
    const maxMines = Math.max(1, rows * cols - 9);
    maxMinesHint.textContent = maxMines;
    customMines.max = maxMines;
    if (parseInt(customMines.value) > maxMines) {
        customMines.value = maxMines;
    }
}

export function getCustomDifficulty() {
    const rows = Math.max(5, Math.min(30, parseInt(customRows.value) || 9));
    const cols = Math.max(5, Math.min(40, parseInt(customCols.value) || 9));
    const maxMines = Math.max(1, rows * cols - 9);
    const mines = Math.max(1, Math.min(maxMines, parseInt(customMines.value) || 10));

    customRows.value = rows;
    customCols.value = cols;
    customMines.value = mines;

    return {
        rows,
        cols,
        mines,
        cellSize: rows > 12 || cols > 20 ? 26 : rows > 9 ? 30 : 32,
    };
}


// =========================
// 事件绑定
// =========================

settingsToggleBtn.addEventListener("click", openSettings);
settingsCloseBtn.addEventListener("click", closeSettings);
settingsOverlay.addEventListener("click", closeSettings);

settingVolume.addEventListener("input", () => {
    settings.volume = parseInt(settingVolume.value);
    volumeVal.textContent = settings.volume + "%";
    persistSettings();
});

settingParticles.addEventListener("change", () => {
    settings.particles = settingParticles.checked;
    persistSettings();
    if (bgCanvas) {
        bgCanvas.style.display = settings.particles ? "" : "none";
    }
});

settingAnimations.addEventListener("change", () => {
    settings.animations = settingAnimations.checked;
    persistSettings();
    document.documentElement.classList.toggle("no-anim", !settings.animations);
});

settingCustom.addEventListener("change", () => {
    settings.custom = settingCustom.checked;
    persistSettings();
    if (settings.custom) {
        customFields.classList.remove("collapsed");
    } else {
        customFields.classList.add("collapsed");
    }
});

settingsResetBtn.addEventListener("click", () => {
    resetSettings();
});

// 主题切换
document.querySelectorAll("#theme-grid .theme-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        settings.theme = btn.dataset.theme;
        persistSettings();
        applySettingsUI();
    });
});

customRows.addEventListener("input", updateMaxMinesHint);
customCols.addEventListener("input", updateMaxMinesHint);

// applyCustomBtn 的回调由 main.js 绑定（需要调用 classic.js 的 restart）
export function bindApplyCustom(callback) {
    applyCustomBtn.addEventListener("click", () => {
        callback();
        closeSettings();
    });
}

updateMaxMinesHint();
