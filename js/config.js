// =========================
// 难度配置
// =========================

export const DIFFICULTY = {
    beginner:     { label: "初级", rows: 9,  cols: 9,  mines: 10, cellSize: 32 },
    intermediate: { label: "中级", rows: 16, cols: 16, mines: 40, cellSize: 30 },
    expert:       { label: "高级", rows: 16, cols: 30, mines: 99, cellSize: 28 },
};


// =========================
// 8 方向偏移
// =========================

export const DIRECTIONS = [
    [-1, -1], [-1, 0], [-1, 1],
    [ 0, -1],          [ 0, 1],
    [ 1, -1], [ 1, 0], [ 1, 1]
];


// =========================
// 默认设置
// =========================

export const DEFAULT_SETTINGS = {
    volume: 30,
    particles: true,
    animations: true,
    custom: false,
    theme: "night",
};


// =========================
// AI 难度配置
// =========================

export const AI_DIFFICULTY = {
    easy: {
        label: "🌱 初级",
        speedMin: 800,
        speedMax: 1200,
        useFlags: false,
        useRule2: false,
        mistakeRate: 0.25,
        cornerPrefer: false,
        probHeuristic: false,
        patterns: false,
    },
    medium: {
        label: "⚡ 中级",
        speedMin: 500,
        speedMax: 900,
        useFlags: true,
        useRule2: true,
        mistakeRate: 0,
        cornerPrefer: true,
        probHeuristic: false,
        patterns: false,
    },
    hard: {
        label: "💀 高级",
        speedMin: 200,
        speedMax: 450,
        useFlags: true,
        useRule2: true,
        mistakeRate: 0,
        cornerPrefer: true,
        probHeuristic: true,
        patterns: false,
    },
    expert: {
        label: "👾 专家",
        speedMin: 60,
        speedMax: 200,
        useFlags: true,
        useRule2: true,
        mistakeRate: 0,
        cornerPrefer: true,
        probHeuristic: true,
        patterns: true,
    },
};


// =========================
// 头像选项
// =========================

export const AVATAR_OPTIONS = [
    "👤", "😊", "😎", "🤖", "👻", "🐱", "🐶", "🦊",
    "🐼", "🐨", "🦁", "🐯", "🐸", "🐵", "🐙", "🦄",
    "🌸", "🔥", "⭐", "🌈", "💎", "🎮", "🚀", "⚡",
    "🎯", "🏆", "💣", "🧨", "⛏️", "💀", "👑", "🗿",
];


// =========================
// 存储键名常量
// =========================

export const THEME_STORAGE_KEY = "minesweeper-color-mode";
export const USER_STORAGE_KEY = "minesweeper-users";
export const SESSION_KEY = "minesweeper-session";


// =========================
// WebSocket 重连配置
// =========================

export const WS_MAX_RECONNECT = 3;
export const WS_RECONNECT_DELAYS = [1000, 2000, 4000];
