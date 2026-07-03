// =========================
// 黑夜/白天模式切换
// =========================

import { THEME_STORAGE_KEY } from "./config.js";

const themeToggleBtn = document.getElementById("theme-toggle");

/** 检查 localStorage 或系统偏好，返回 "dark" 或 "light" */
export function getColorMode() {
    try {
        const saved = localStorage.getItem(THEME_STORAGE_KEY);
        if (saved === "light" || saved === "dark") return saved;
    } catch (_) { /* 忽略 */ }
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) {
        return "light";
    }
    return "dark";
}

/** 应用颜色模式到 DOM */
export function applyColorMode(mode) {
    if (mode === "light") {
        document.body.classList.add("light-mode");
        document.body.classList.remove("dark-mode");
        if (themeToggleBtn) {
            themeToggleBtn.textContent = "🌙";
            themeToggleBtn.title = "切换至黑夜模式";
        }
    } else {
        document.body.classList.remove("light-mode");
        document.body.classList.add("dark-mode");
        if (themeToggleBtn) {
            themeToggleBtn.textContent = "☀️";
            themeToggleBtn.title = "切换至白天模式";
        }
    }
    try { localStorage.setItem(THEME_STORAGE_KEY, mode); } catch (_) { /* 忽略 */ }
}

/** 切换模式 */
export function toggleColorMode() {
    const isLight = document.body.classList.contains("light-mode");
    applyColorMode(isLight ? "dark" : "light");
}

// 事件绑定
if (themeToggleBtn) {
    themeToggleBtn.addEventListener("click", toggleColorMode);
}
