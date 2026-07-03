// =========================
// 扫雷 — 主入口文件
// 导入所有模块，协调初始化与跨模块事件绑定
// =========================

import { DIFFICULTY } from "./config.js";
import {
    currentDifficulty, currentMode,
    ROWS, COLS, MINE_COUNT, CELL_SIZE,
    settings,
    setCurrentDifficulty, setDifficultyConfig, setCurrentMode,
} from "./state.js";
import { initBgParticles } from "./particles.js";
import { getColorMode, applyColorMode } from "./theme.js";
import {
    applySettingsUI, getCustomDifficulty,
    bindApplyCustom,
} from "./settings.js";
import { restoreSession, injectMultiplayerDeps as injectAuthDeps } from "./auth.js";
import { injectMultiplayerDeps as injectFriendsDeps } from "./friends.js";
import "./leaderboard.js";  // 副作用导入：注册排行榜面板事件监听

import {
    initClassicMode, restart,
    stopTimer,
} from "./classic.js";

import {
    initVsMode, stopVsGame, resetVsScores,
} from "./vs-mode.js";

import {
    showMultiLobby, resetMultiState, multiStopTimer,
    connectToServer, disconnectFromServer, getWsUrl,
    sendMessage, wsConnected, isInMultiRoom,
} from "./multiplayer.js";


// =========================
// 注入 multiplayer 依赖到 auth 和 friends
// （避免循环依赖，使用依赖注入模式）
// =========================

injectAuthDeps({ wsConnected: () => wsConnected, sendMessage, getWsUrl, connectToServer });
injectFriendsDeps({ wsConnected: () => wsConnected, sendMessage, getWsUrl, connectToServer });


// =========================
// 从 localStorage 加载设置
// =========================

(function loadSettings() {
    try {
        const saved = JSON.parse(localStorage.getItem("minesweeper-settings"));
        if (saved) {
            settings.volume     = saved.volume     ?? settings.volume;
            settings.particles  = saved.particles  ?? settings.particles;
            settings.animations = saved.animations ?? settings.animations;
            settings.custom     = saved.custom     ?? settings.custom;
            settings.theme      = saved.theme      ?? settings.theme;
            if (saved.sound === false) settings.volume = 0;
        }
    } catch (_) { /* 忽略 */ }
})();


// =========================
// DOM 引用
// =========================

const modeButtons    = document.querySelectorAll(".mode-btn");
const gameClassic    = document.getElementById("game-classic");
const gameVs         = document.getElementById("game-vs");
const diffButtons    = document.querySelectorAll(".difficulty-bar:not(#multi-diff-bar) > .diff-btn");


// =========================
// 模式切换
// =========================

function switchMode(mode) {
    if (mode === currentMode) return;

    // 清理上一个模式
    if (currentMode === "multiplayer") {
        if (isInMultiRoom()) {
            sendMessage({ type: "leave_room" });
        }
        disconnectFromServer();
        multiStopTimer();
        resetMultiState();
    }
    if (currentMode === "vs") {
        stopVsGame();
    }

    setCurrentMode(mode);

    modeButtons.forEach(btn => btn.classList.toggle("active", btn.dataset.mode === mode));

    // 隐藏所有游戏容器
    gameClassic.style.display = "none";
    gameVs.style.display = "none";
    const gameMultiEl = document.getElementById("game-multi");
    if (gameMultiEl) gameMultiEl.style.display = "none";

    if (mode === "classic") {
        gameClassic.style.display = "";
        restart();
    } else if (mode === "vs") {
        gameVs.style.display = "flex";
        stopTimer();
        resetVsScores();
        initVsMode();
    } else if (mode === "multiplayer") {
        document.getElementById("game-multi").style.display = "flex";
        showMultiLobby();
        if (!wsConnected) {
            connectToServer(getWsUrl());
        }
    }
}

modeButtons.forEach(btn => {
    btn.addEventListener("click", () => switchMode(btn.dataset.mode));
});


// =========================
// 切换难度
// =========================

function setDifficulty(level) {
    if (level === currentDifficulty) return;
    setCurrentDifficulty(level);

    diffButtons.forEach(btn => {
        btn.classList.toggle("active", btn.dataset.level === level);
    });

    const cfg = DIFFICULTY[level];
    setDifficultyConfig(cfg.rows, cfg.cols, cfg.mines, cfg.cellSize);

    if (currentMode === "vs") {
        initVsMode();
    } else if (currentMode === "multiplayer") {
        // 多人模式难度由房间面板控制，不重置
    } else {
        restart();
    }
}

diffButtons.forEach(btn => {
    btn.addEventListener("click", () => {
        setDifficulty(btn.dataset.level);
    });
});


// =========================
// 自定义难度应用按钮
// =========================

bindApplyCustom(() => {
    const custom = getCustomDifficulty();
    setDifficultyConfig(custom.rows, custom.cols, custom.mines, custom.cellSize);
    setCurrentDifficulty("custom");

    diffButtons.forEach(btn => btn.classList.remove("active"));

    if (currentMode === "vs") {
        initVsMode();
    } else if (currentMode === "multiplayer") {
        // 多人模式难度由房间面板控制
    } else {
        restart();
    }
});


// =========================
// 程序入口初始化
// =========================

applyColorMode(getColorMode());
applySettingsUI();
restoreSession();
initClassicMode();
initBgParticles();
