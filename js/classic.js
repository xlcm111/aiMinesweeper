// =========================
// 经典模式 — 核心游戏逻辑
// =========================

import { DIFFICULTY, DIRECTIONS } from "./config.js";
import { ROWS, COLS, MINE_COUNT, CELL_SIZE, currentDifficulty } from "./state.js";
import { Cell } from "./cell.js";
import { inBounds, fmtLED, addLongPressSupport, recordGame } from "./utils.js";
import { sfxClick, sfxFlag, sfxReveal, sfxLose, sfxWin } from "./audio.js";


// =========================
// 游戏状态 (module-private)
// =========================

export const board = [];

export let gameOver = false;
export let gameWin = false;
export let firstClick = true;
export let flagCount = 0;

// Setter functions for cross-module mutation (ES module imports are read-only)
export function setFlagCount(v) { flagCount = v; }
export function addToFlagCount(v) { flagCount += v; }

export let timerInterval = null;
export let secondsElapsed = 0;


// =========================
// DOM 元素
// =========================

const boardElement   = document.getElementById("board");
const mineCountEl    = document.getElementById("mine-count");
const timerEl        = document.getElementById("timer");
const restartBtn     = document.getElementById("restart");


// =========================
// 初始化棋盘数据
// =========================

export function initBoard() {
    board.length = 0;
    for (let r = 0; r < ROWS; r++) {
        board[r] = [];
        for (let c = 0; c < COLS; c++) {
            board[r][c] = new Cell(r, c);
        }
    }
}


// =========================
// 埋雷（避开首次点击位置及其周围 8 格）
// =========================

export function placeMines(safeRow, safeCol) {
    const candidates = [];

    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (Math.abs(r - safeRow) <= 1 && Math.abs(c - safeCol) <= 1) {
                continue;
            }
            candidates.push({ r, c });
        }
    }

    // Fisher-Yates 洗牌
    for (let i = candidates.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    for (let i = 0; i < MINE_COUNT && i < candidates.length; i++) {
        const { r, c } = candidates[i];
        board[r][c].mine = true;
    }

    // 绝对安全：显式清除第一步格（及周围 8 格）的雷
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            const rr = safeRow + dr;
            const cc = safeCol + dc;
            if (inBounds(rr, cc)) {
                board[rr][cc].mine = false;
            }
        }
    }
}


// =========================
// 计算数字
// =========================

export function calculateNumbers() {
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (board[r][c].mine) continue;
            let count = 0;
            for (const [dr, dc] of DIRECTIONS) {
                const nr = r + dr;
                const nc = c + dc;
                if (inBounds(nr, nc) && board[nr][nc].mine) {
                    count++;
                }
            }
            board[r][c].number = count;
        }
    }
}


// =========================
// 渲染棋盘
// =========================

export function renderBoard() {
    boardElement.innerHTML = "";
    boardElement.style.gridTemplateColumns = `repeat(${COLS}, ${CELL_SIZE}px)`;
    document.documentElement.style.setProperty("--cell-size", `${CELL_SIZE}px`);

    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const cell = board[r][c];
            const el = document.createElement("div");

            el.classList.add("cell");
            el.dataset.row = r;
            el.dataset.col = c;

            el.addEventListener("click", () => onCellClick(cell));
            el.addEventListener("contextmenu", (e) => {
                e.preventDefault();
                onCellRightClick(cell);
            });
            addLongPressSupport(el, () => onCellRightClick(cell));

            cell.element = el;
            boardElement.appendChild(el);
        }
    }
}


// =========================
// 更新格子外观
// =========================

export function updateCellDisplay(cell) {
    const el = cell.element;
    if (!el) return;

    el.classList.remove("open", "flag", "mine", "mine-death", "flag-wrong");
    el.textContent = "";

    if (cell.open) {
        el.classList.add("open");
        if (cell.mine) {
            el.classList.add("mine");
            el.textContent = "💣";
        } else if (cell.number > 0) {
            el.textContent = cell.number;
            el.classList.add(`n${cell.number}`);
        }
    } else if (cell.flag) {
        el.classList.add("flag");
        el.textContent = "🚩";
    }
}


// =========================
// 翻开 & 展开
// =========================

export function openCell(cell) {
    if (gameOver || gameWin) return;
    if (cell.open || cell.flag) return;

    cell.open = true;

    if (cell.mine) {
        cell.element.classList.add("mine-death");
        sfxLose();
        triggerGameOver(cell);
        return;
    }

    updateCellDisplay(cell);

    if (cell.number === 0) {
        for (const [dr, dc] of DIRECTIONS) {
            const nr = cell.row + dr;
            const nc = cell.col + dc;
            if (inBounds(nr, nc)) {
                openCell(board[nr][nc]);
            }
        }
    }
}


// =========================
// 左键点击
// =========================

function onCellClick(cell) {
    if (gameOver || gameWin) return;
    if (cell.flag) return;

    const wasFirst = firstClick;

    if (firstClick) {
        firstClick = false;
        placeMines(cell.row, cell.col);

        if (cell.mine) {
            cell.mine = false;
            for (let rr = 0; rr < ROWS; rr++) {
                for (let cc = 0; cc < COLS; cc++) {
                    if (Math.abs(rr - cell.row) <= 1 && Math.abs(cc - cell.col) <= 1) continue;
                    if (!board[rr][cc].mine) {
                        board[rr][cc].mine = true;
                        break;
                    }
                }
            }
        }

        calculateNumbers();
        startTimer();
    }

    sfxClick();

    openCell(cell);

    if (!cell.mine && cell.number === 0 && !wasFirst) {
        sfxReveal();
    }

    if (!gameOver) {
        checkWin();
    }
}


// =========================
// 右键插旗 / 取消
// =========================

function onCellRightClick(cell) {
    if (gameOver || gameWin) return;
    if (cell.open) return;

    cell.flag = !cell.flag;

    if (cell.flag) {
        flagCount++;
    } else {
        flagCount--;
    }

    sfxFlag();
    updateCellDisplay(cell);
    updateMineCountDisplay();
}


// =========================
// 游戏结束
// =========================

function triggerGameOver(clickedCell) {
    gameOver = true;
    stopTimer();
    restartBtn.textContent = "😵";

    recordGame(false, secondsElapsed);

    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const cell = board[r][c];
            if (cell.mine && cell !== clickedCell) {
                cell.open = true;
                updateCellDisplay(cell);
            }
            if (cell.flag && !cell.mine) {
                cell.element.classList.add("flag-wrong");
                cell.element.textContent = "❌";
            }
        }
    }
}


// =========================
// 检查胜利
// =========================

function checkWin() {
    let allOpened = true;

    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const cell = board[r][c];
            if (!cell.mine && !cell.open) {
                allOpened = false;
            }
        }
    }

    if (allOpened) {
        gameWin = true;
        stopTimer();

        recordGame(true, secondsElapsed);

        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const cell = board[r][c];
                if (cell.mine && !cell.flag) {
                    cell.flag = true;
                    updateCellDisplay(cell);
                }
            }
        }

        flagCount = MINE_COUNT;
        updateMineCountDisplay();
        restartBtn.textContent = "😎";
        sfxWin();
    }
}


// =========================
// 计时器
// =========================

export function startTimer() {
    secondsElapsed = 0;
    timerEl.querySelector(".led-value").textContent = "000";

    timerInterval = setInterval(() => {
        secondsElapsed++;
        if (secondsElapsed > 999) secondsElapsed = 999;
        timerEl.querySelector(".led-value").textContent = fmtLED(secondsElapsed);
    }, 1000);
}

export function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
}


// =========================
// 更新剩余雷数
// =========================

export function updateMineCountDisplay() {
    const remaining = MINE_COUNT - flagCount;
    mineCountEl.querySelector(".led-value").textContent = fmtLED(remaining);
}


// =========================
// 重新开始
// =========================

export function restart() {
    stopTimer();

    gameOver = false;
    gameWin = false;
    firstClick = true;
    flagCount = 0;
    secondsElapsed = 0;

    timerEl.querySelector(".led-value").textContent = "000";
    updateMineCountDisplay();
    restartBtn.textContent = "😊";

    initBoard();
    renderBoard();
}


// =========================
// 经典模式初始化
// =========================

export function initClassicMode() {
    initBoard();
    renderBoard();
    updateMineCountDisplay();
}


// =========================
// 事件绑定
// =========================

restartBtn.addEventListener("click", restart);
