// =========================
// 共享可变状态
// 所有跨模块使用的状态集中管理，避免循环依赖
//
// 重要：ES module 的 import 绑定是只读的，因此跨模块修改
// 基本类型值时必须使用导出的 setter 函数。
// 对象类型（如 settings）可以直接修改其属性。
// =========================

import { DIFFICULTY, DEFAULT_SETTINGS } from "./config.js";

// --- 当前难度配置 ---
export let currentDifficulty = "beginner";
export let ROWS, COLS, MINE_COUNT, CELL_SIZE;

// 初始化难度相关变量
(function initDifficultyVars() {
    const cfg = DIFFICULTY[currentDifficulty];
    ROWS       = cfg.rows;
    COLS       = cfg.cols;
    MINE_COUNT = cfg.mines;
    CELL_SIZE  = cfg.cellSize;
})();

// Setter — 由 main.js 调用
export function setCurrentDifficulty(level) { currentDifficulty = level; }
export function setDifficultyConfig(rows, cols, mines, cellSize) {
    ROWS = rows;
    COLS = cols;
    MINE_COUNT = mines;
    CELL_SIZE = cellSize;
}

// --- 设置状态 ---
// 对象类型，属性可直接跨模块修改
export const settings = { ...DEFAULT_SETTINGS };

// --- 当前用户 ---
export let currentUser = null;  // { username } | null
export function setCurrentUser(v) { currentUser = v; }

// --- 当前游戏模式 ---
export let currentMode = "classic";  // "classic" | "vs" | "multiplayer"
export function setCurrentMode(v) { currentMode = v; }

// --- 当前 AI 难度 ---
export let currentAiDifficulty = "medium";
export function setCurrentAiDifficulty(v) { currentAiDifficulty = v; }

// --- 排行榜排序 ---
export let currentLbSort = "winrate";
export function setCurrentLbSort(v) { currentLbSort = v; }
