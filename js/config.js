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
        speedMin: 1200,      // 思考速度不慢不紧
        speedMax: 2000,
        useFlags: true,      // 【不让他装傻】：初级也必须学会插旗！
        useRule2: false,     // 【限制脑容量】：关闭规则 2。
        mistakeRate: 0,      // 【绝不无脑自杀】：拿掉手抖！AI 在自己懂的逻辑里绝对不犯错。
        cornerPrefer: false,
        probHeuristic: false,
        patterns: false,
    },
    medium: {
        label: "⚡ 中级",
        speedMin: 800,       // 稍微敏捷一些
        speedMax: 1500,
        useFlags: true,      
        useRule2: true,      // 【脑子还给它】：中级可以看懂规则 2 
        mistakeRate: 0,      // 【绝不无脑自杀】：拿掉手抖！
        cornerPrefer: false, 
        probHeuristic: false, // 【关键防线】：关闭概率盲猜。
        patterns: false,
    },
    hard: {
        label: "💀 高级",
        speedMin: 300,       
        speedMax: 600,
        useFlags: true,
        useRule2: true,      
        mistakeRate: 0,      
        cornerPrefer: true,  
        probHeuristic: true, // 高级开始拥有高超的概率盲猜能力，死局极难被炸死
        patterns: false,     
    },
    expert: {
        label: "👾 专家",
        speedMin: 50,        
        speedMax: 180,
        useFlags: true,
        useRule2: true,
        mistakeRate: 0,
        cornerPrefer: true,
        probHeuristic: true,
        patterns: true,      // 只有专家懂 1-2-1 等高阶定式
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
