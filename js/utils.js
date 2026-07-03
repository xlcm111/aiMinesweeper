// =========================
// 工具函数 / 存储操作 / 游戏记录
// =========================

import { DIFFICULTY, USER_STORAGE_KEY, SESSION_KEY } from "./config.js";
import {
    ROWS, COLS,
    currentUser, currentMode, currentDifficulty,
} from "./state.js";


// =========================
// 游戏工具
// =========================

export function inBounds(r, c) {
    return r >= 0 && r < ROWS && c >= 0 && c < COLS;
}

/** 格式化数字为 3 位 LED 显示 */
export function fmtLED(n) {
    return String(Math.max(0, Math.min(999, n))).padStart(3, "0");
}

/**
 * 为格子添加长按插旗支持（触屏设备绝对防穿透版）
 * @param {HTMLElement} el - 格子 DOM 元素
 * @param {Function} onFlag - 插旗回调
 */
export function addLongPressSupport(el, onFlag) {
    let pressTimer = null;
    let startX = 0, startY = 0;
    
    // 用 el 本身的属性来存状态，比局部变量更稳固，方便外部或 click 事件直接读取
    el.dataset.isLongPress = "false"; 

    el.addEventListener("touchstart", (e) => {
        if (e.touches.length > 1) return;

        const touch = e.touches[0];
        startX = touch.clientX;
        startY = touch.clientY;
        el.dataset.isLongPress = "false"; // 每次刚按下时重置

        pressTimer = setTimeout(() => {
            pressTimer = null;
            el.dataset.isLongPress = "true"; // 标记当前已经是长按行为
            
            if (navigator.vibrate) {
                navigator.vibrate(40); 
            }
            
            onFlag();
        }, 280);
    }, { passive: true }); // 修改为 true：不阻止默认滚动，提升触屏平滑度

    el.addEventListener("touchmove", (e) => {
        if (!pressTimer) return;
        const touch = e.touches[0];
        
        if (Math.abs(touch.clientX - startX) > 24 ||
            Math.abs(touch.clientY - startY) > 24) {
            clearTimeout(pressTimer);
            pressTimer = null;
        }
    }, { passive: true });

    el.addEventListener("touchend", (e) => {
        if (pressTimer) {
            clearTimeout(pressTimer);
            pressTimer = null;
        }
        
        // 【核心拦截一】如果是长按触发的抬起，强行阻止一切后续冒泡和默认点击
        if (el.dataset.isLongPress === "true") {
            e.preventDefault();
            e.stopPropagation();
            // 延时清除标记，确保后续零点几秒内的原生 click 穿透过来时也能被挡住
            setTimeout(() => { el.dataset.isLongPress = "false"; }, 100);
        }
    }, { passive: false }); // 必须为 false，否则 e.preventDefault() 会失效

    el.addEventListener("touchcancel", () => {
        if (pressTimer) {
            clearTimeout(pressTimer);
            pressTimer = null;
        }
        el.dataset.isLongPress = "false";
    });

    // 【核心拦截二】直接在 DOM 节点的普通点击事件上挂起防御盾牌
    // 如果发现刚刚才发生过长按，直接把普通的“点开格子”逻辑原地拦截掉！
    el.addEventListener("click", (e) => {
        if (el.dataset.isLongPress === "true") {
            e.preventDefault();
            e.stopPropagation();
        }
    }, { capture: true }); // 使用捕获模式，确保比游戏自身的点击逻辑更早执行
}

// =========================
// HTML 转义
// =========================

export function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}


// =========================
// API 通信
// =========================

/**
 * 调用服务端 API，失败时返回 null（不抛异常）
 * 内置 10 秒超时，避免手机端网络不通时长时间卡死
 */
export async function apiCall(endpoint, data) {
    try {
        const base = window.location.origin;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        const res = await fetch(base + endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
            signal: controller.signal,
        });
        clearTimeout(timeoutId);
        const json = await res.json();
        return json;
    } catch (_) {
        return null;
    }
}

/**
 * 使用 SubtleCrypto 计算 SHA-256 哈希（hex 字符串）
 */
export async function sha256(message) {
    try {
        const encoder = new TextEncoder();
        const data = encoder.encode(message);
        const hashBuffer = await crypto.subtle.digest("SHA-256", data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
    } catch (_) {
        console.warn("[sha256] crypto.subtle 不可用，返回 null（可能为非安全上下文）");
        return null;
    }
}


// =========================
// 表单验证
// =========================

export function isValidUsername(name) {
    return /^[a-zA-Z0-9_]{4,20}$/.test(name);
}

export function isValidPassword(pw) {
    return pw.length >= 6 && pw.length <= 30;
}


// =========================
// 用户界面辅助
// =========================

/** 根据用户名字符串生成稳定的颜色 */
export function avatarColor(username) {
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
        hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash) % 360;
    const s = 55 + (Math.abs(hash) % 25);
    const l = 45 + (Math.abs(hash >> 8) % 15);
    return `hsl(${h}, ${s}%, ${l}%)`;
}

/** 根据总局数计算等级 */
export function calcLevel(games) {
    if (games < 5) return { title: "见习矿工", icon: "🪨" };
    if (games < 20) return { title: "初级矿工", icon: "⛏️" };
    if (games < 50) return { title: "资深矿工", icon: "💎" };
    if (games < 100) return { title: "扫雷专家", icon: "🧨" };
    if (games < 200) return { title: "排爆大师", icon: "🏅" };
    return { title: "雷神降临", icon: "👑" };
}

/** 获取难度可读名称 */
export function getDifficultyLabel(diff) {
    if (!diff) return "9×9 · 10雷";
    for (const [key, cfg] of Object.entries(DIFFICULTY)) {
        if (cfg.rows === diff.rows && cfg.cols === diff.cols && cfg.mines === diff.mines) {
            return cfg.label + " (" + cfg.rows + "×" + cfg.cols + " · " + cfg.mines + "雷)";
        }
    }
    return diff.rows + "×" + diff.cols + " · " + diff.mines + "雷";
}


// =========================
// Toast 通知
// =========================

let toastTimer = null;

export function showToast(message, type) {
    const toast = document.getElementById("multi-toast");
    if (!toast) return;

    if (toastTimer) clearTimeout(toastTimer);

    toast.textContent = message;
    toast.className = "multi-toast " + type + " show";

    toastTimer = setTimeout(() => {
        toast.classList.remove("show");
        toastTimer = null;
    }, 3000);
}


// =========================
// localStorage 用户存储
// =========================

export function loadUsers() {
    try {
        return JSON.parse(localStorage.getItem(USER_STORAGE_KEY)) || {};
    } catch (_) {
        return {};
    }
}

export function saveUsers(users) {
    try {
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(users));
    } catch (_) { /* 忽略 */ }
}

/** 大小写不敏感查找用户 */
export function findUserLocal(username) {
    const users = loadUsers();
    const normalizedKey = (username || "").toLowerCase();
    const entry = Object.entries(users).find(
        ([key]) => key.toLowerCase() === normalizedKey
    );
    return entry ? { key: entry[0], user: entry[1] } : null;
}

export function getSession() {
    try {
        return JSON.parse(localStorage.getItem(SESSION_KEY));
    } catch (_) {
        return null;
    }
}

export function saveSession(username) {
    try {
        localStorage.setItem(SESSION_KEY, JSON.stringify({ username }));
    } catch (_) { /* 忽略 */ }
}

export function clearSession() {
    try {
        localStorage.removeItem(SESSION_KEY);
    } catch (_) { /* 忽略 */ }
}


// =========================
// 统计数据
// =========================

export function createDefaultStats() {
    return {
        games: 0,
        wins: 0,
        losses: 0,
        totalSeconds: 0,
        history: [],
        bestTimes: {
            beginner: null,
            intermediate: null,
            expert: null,
        },
    };
}

/**
 * 记录一局游戏（在游戏结束时调用）
 */
export function recordGame(win, seconds, mode) {
    if (!currentUser) return;

    const users = loadUsers();
    const username = currentUser.username;
    if (!users[username]) return;

    const stats = users[username].stats;
    stats.games++;
    stats.totalSeconds = (stats.totalSeconds || 0) + seconds;

    const gameMode = mode || currentMode;
    const diffKey = currentDifficulty === "custom" ? null : currentDifficulty;

    if (win) {
        stats.wins++;
        if (gameMode === "classic" && diffKey && DIFFICULTY[diffKey]) {
            const prev = stats.bestTimes[diffKey];
            if (prev === null || seconds < prev) {
                stats.bestTimes[diffKey] = seconds;
            }
        }
    } else {
        stats.losses++;
    }

    if (!stats.history) stats.history = [];
    stats.history.unshift({
        mode: gameMode,
        difficulty: diffKey || "custom",
        result: win ? "win" : "lose",
        seconds: seconds,
        date: new Date().toISOString(),
    });
    if (stats.history.length > 20) {
        stats.history = stats.history.slice(0, 20);
    }

    saveUsers(users);

    // 异步同步到服务端（不阻塞游戏流程）
    const user = users[username];
    apiCall("/api/save-stats", {
        username,
        stats,
        friends: user.friends,
        friendRequestsSent: user.friendRequestsSent,
        friendRequestsReceived: user.friendRequestsReceived,
    });
}
