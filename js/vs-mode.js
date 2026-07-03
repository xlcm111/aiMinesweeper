// =========================
// 人机对战模式
// =========================

import { DIFFICULTY, DIRECTIONS, AI_DIFFICULTY } from "./config.js";
import { ROWS, COLS, MINE_COUNT, CELL_SIZE, currentDifficulty, currentAiDifficulty, setCurrentAiDifficulty } from "./state.js";
import { Cell } from "./cell.js";
import { fmtLED, addLongPressSupport, recordGame } from "./utils.js";
import { sfxClick, sfxFlag, sfxReveal, sfxLose, sfxWin } from "./audio.js";
import { AiSolver } from "./ai-solver.js";
import {
    board, flagCount, setFlagCount, addToFlagCount,
    placeMines, calculateNumbers,
} from "./classic.js";


// =========================
// VS 状态 (module-private)
// =========================

let vsAiBoard = [];

export let vsGameActive = false;
let vsGameEnded = false;
let vsHumanFirstClick = true;
let vsAiFirstClick = true;
let vsHumanDead = false;
let vsAiDead = false;

let vsTimerInterval = null;
let vsSecondsElapsed = 0;
let vsAiTimerInterval = null;
let vsAiSecondsElapsed = 0;

let vsAiStepInterval = null;

let vsHumanScore = 0;
let vsAiScore = 0;

let vsMineSnapshot = null;


// =========================
// DOM 元素
// =========================

const vsBoardHumanEl   = document.getElementById("vs-board-human");
const vsBoardAiEl      = document.getElementById("vs-board-ai");
const vsMineCountEl    = document.getElementById("vs-mine-count");
const vsTimerEl        = document.getElementById("vs-timer");
const vsAiMineCountEl  = document.getElementById("vs-ai-mine-count");
const vsAiTimerEl      = document.getElementById("vs-ai-timer");
const vsRestartBtn     = document.getElementById("vs-restart");
const vsAiFaceEl       = document.getElementById("vs-ai-face");
const vsStatusEl       = document.getElementById("vs-status");
const vsStartBtn       = document.getElementById("vs-start-btn");
const vsHumanWinsEl    = document.getElementById("vs-human-wins");
const vsAiWinsEl       = document.getElementById("vs-ai-wins");

const aiDiffBtns = document.querySelectorAll(".ai-diff-btn");


// =========================
// VS 模式 — 动态格子大小
// =========================

function computeVsCellSize() {
    const maxWidth = window.innerWidth - 40;        // 页面边距
    const gamePaddingX = 18 * 2 + 5 * 2;            // .game 内边距 + 边框 = 46px
    const centerWidth = 172;                         // 中间状态栏 + 间距
    const isStacked = window.innerWidth <= 768;      // 移动端竖向堆叠

    // 每个棋盘可用的最大宽度
    const availablePerBoard = isStacked
        ? maxWidth - 40                              // 竖向堆叠时，单板占满宽
        : (maxWidth - centerWidth) / 2;              // 横向并排时，各占一半

    const maxCellSizeByWidth = Math.floor((availablePerBoard - gamePaddingX) / COLS);
    // 不小于 12px，不大于原始 CELL_SIZE
    return Math.max(12, Math.min(CELL_SIZE, maxCellSizeByWidth));
}

// =========================
// VS 模式初始化
// =========================

export function initVsMode() {
    stopVsGame();

    vsBoardHumanEl.innerHTML = "";
    vsBoardAiEl.innerHTML = "";

    // 根据屏幕宽度动态计算 VS 模式下的格子大小
    const vsCellSize = computeVsCellSize();

    vsBoardHumanEl.style.display = "grid";
    vsBoardHumanEl.style.gridTemplateColumns = `repeat(${COLS}, ${vsCellSize}px)`;
    vsBoardHumanEl.style.setProperty("--cell-size", `${vsCellSize}px`);
    vsBoardAiEl.style.display = "grid";
    vsBoardAiEl.style.gridTemplateColumns = `repeat(${COLS}, ${vsCellSize}px)`;
    vsBoardAiEl.style.setProperty("--cell-size", `${vsCellSize}px`);

    // 初始化 AI 棋盘
    vsAiBoard = [];
    for (let r = 0; r < ROWS; r++) {
        vsAiBoard[r] = [];
        for (let c = 0; c < COLS; c++) {
            vsAiBoard[r][c] = new Cell(r, c);
        }
    }

    // 重置人类棋盘
    board.length = 0;
    for (let r = 0; r < ROWS; r++) {
        board[r] = [];
        for (let c = 0; c < COLS; c++) {
            board[r][c] = new Cell(r, c);
        }
    }

    renderVsHumanBoard();
    renderVsAiBoard();

    vsGameActive = false;
    vsGameEnded = false;
    vsHumanFirstClick = true;
    vsAiFirstClick = true;
    vsHumanDead = false;
    vsAiDead = false;
    vsMineSnapshot = null;

    vsMineCountEl.querySelector(".led-value").textContent = fmtLED(MINE_COUNT);
    vsAiMineCountEl.querySelector(".led-value").textContent = fmtLED(MINE_COUNT);
    vsTimerEl.querySelector(".led-value").textContent = "000";
    vsAiTimerEl.querySelector(".led-value").textContent = "000";
    vsRestartBtn.textContent = "😊";
    vsAiFaceEl.textContent = "🤖";
    vsStatusEl.textContent = "准备就绪 - 点击开始对战！";
    vsStatusEl.className = "vs-status";
    vsStartBtn.disabled = false;

    // 重置 flagCount
    setFlagCount(0);
}


// =========================
// 渲染 VS 棋盘
// =========================

function renderVsHumanBoard() {
    vsBoardHumanEl.innerHTML = "";
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const cell = board[r][c];
            const el = document.createElement("div");
            el.classList.add("cell");
            el.dataset.row = r;
            el.dataset.col = c;

            el.addEventListener("click", () => vsOnHumanClick(cell));
            el.addEventListener("contextmenu", (e) => {
                e.preventDefault();
                vsOnHumanRightClick(cell);
            });
            addLongPressSupport(el, () => vsOnHumanRightClick(cell));

            cell.element = el;
            vsBoardHumanEl.appendChild(el);
        }
    }
}

function renderVsAiBoard() {
    vsBoardAiEl.innerHTML = "";
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const cell = vsAiBoard[r][c];
            const el = document.createElement("div");
            el.classList.add("cell");
            cell.element = el;
            vsBoardAiEl.appendChild(el);
        }
    }
}


// =========================
// 雷位快照
// =========================

function captureMineSnapshot() {
    const mines = [];
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (board[r][c].mine) {
                mines.push({ r, c });
            }
        }
    }
    return mines;
}

function applyMineSnapshot(mines) {
    for (const { r, c } of mines) {
        vsAiBoard[r][c].mine = true;
    }
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (vsAiBoard[r][c].mine) continue;
            let count = 0;
            for (const [dr, dc] of DIRECTIONS) {
                const nr = r + dr, nc = c + dc;
                if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && vsAiBoard[nr][nc].mine) {
                    count++;
                }
            }
            vsAiBoard[r][c].number = count;
        }
    }
}


// =========================
// VS 模式：人类操作
// =========================

function vsOnHumanClick(cell) {
    if (!vsGameActive || vsGameEnded || vsHumanDead) return;
    if (cell.open || cell.flag) return;

    if (vsHumanFirstClick) {
        vsHumanFirstClick = false;
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
        vsMineSnapshot = captureMineSnapshot();
        applyMineSnapshot(vsMineSnapshot);
        vsStartTimers();
        vsStartAiTimer();
        startVsAiSteps();
    }

    sfxClick();
    vsOpenHumanCell(cell);

    if (!vsHumanDead && !vsGameEnded) {
        vsCheckHumanWin();
    }
}

function vsOnHumanRightClick(cell) {
    if (!vsGameActive || vsGameEnded || vsHumanDead) return;
    if (cell.open) return;

    cell.flag = !cell.flag;
    addToFlagCount(cell.flag ? 1 : -1);
    sfxFlag();
    updateVsCellDisplay(cell);
    vsMineCountEl.querySelector(".led-value").textContent = fmtLED(MINE_COUNT - flagCount);
}

function vsOpenHumanCell(cell) {
    if (cell.open || cell.flag) return;
    cell.open = true;

    if (cell.mine) {
        cell.element.classList.add("mine-death");
        sfxLose();
        vsHumanDead = true;
        vsHumanLose();
        return;
    }

    updateVsCellDisplay(cell);

    if (cell.number === 0) {
        for (const [dr, dc] of DIRECTIONS) {
            const nr = cell.row + dr, nc = cell.col + dc;
            if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
                vsOpenHumanCell(board[nr][nc]);
            }
        }
    }
}

function vsCheckHumanWin() {
    let allOpened = true;
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (!board[r][c].mine && !board[r][c].open) {
                allOpened = false;
            }
        }
    }
    if (allOpened && !vsHumanDead) {
        vsHumanWin();
    }
}


// =========================
// VS 模式：AI 操作
// =========================

function vsAiOpenCell(cell) {
    if (cell.open || cell.flag) return;
    
    // 【新增修复】：如果 AI 是第一次点击，且这格正好有雷，直接强行把雷移走
    if (vsAiFirstClick) {
        vsAiFirstClick = false;
        if (cell.mine) {
            cell.mine = false;
            // 重新找一个没雷的地方放雷
            let mineRelocated = false;
            for (let rr = 0; rr < ROWS && !mineRelocated; rr++) {
                for (let cc = 0; cc < COLS; cc++) {
                    // 不能移到当前格，也不能移到人类已经开了的格子或人类的雷上
                    if (rr === cell.row && cc === cell.col) continue;
                    if (!vsAiBoard[rr][cc].mine) {
                        vsAiBoard[rr][cc].mine = true;
                        mineRelocated = true;
                        break;
                    }
                }
            }
            // 重新计算 AI 棋盘周围的数字
            recalculateAiBoardNumbers();
        }
    }

    cell.open = true;

    if (cell.mine) {
        cell.element.classList.add("mine-death");
        vsAiDead = true;
        vsAiLose();
        return;
    }

    updateVsCellDisplay(cell);

    if (cell.number === 0) {
        for (const [dr, dc] of DIRECTIONS) {
            const nr = cell.row + dr, nc = cell.col + dc;
            if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
                vsAiOpenCell(vsAiBoard[nr][nc]);
            }
        }
    }
}

function vsCheckAiWin() {
    let allOpened = true;
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (!vsAiBoard[r][c].mine && !vsAiBoard[r][c].open) {
                allOpened = false;
            }
        }
    }
    if (allOpened && !vsAiDead) {
        vsAiWin();
    }
}

function vsAiStep() {
    if (!vsGameActive || vsGameEnded || vsAiDead) return;

    const diffCfg = AI_DIFFICULTY[currentAiDifficulty];
    const solver = new AiSolver(vsAiBoard, ROWS, COLS, currentAiDifficulty, diffCfg);
    const { safe, mines } = solver.deduce();

    if (diffCfg.mistakeRate > 0 && Math.random() < diffCfg.mistakeRate) {
        const unknowns = solver.getUnknownCells();
        if (unknowns.length > 0) {
            const pick = unknowns[Math.floor(Math.random() * unknowns.length)];
            vsAiOpenCell(pick);
            vsCheckAiWin();
            return;
        }
    }

    if (diffCfg.useFlags && mines.length > 0) {
        for (const cell of mines) {
            if (cell.flag || cell.open) continue;
            cell.flag = true;
            updateVsCellDisplay(cell);
            const aiFlags = countAiFlags();
            vsAiMineCountEl.querySelector(".led-value").textContent = fmtLED(MINE_COUNT - aiFlags);
        }
        vsCheckAiWin();
        return;
    }

    if (safe.length > 0) {
        const numCells = safe.filter(c => c.number > 0);
        const pick = numCells.length > 0 ? numCells[0] : safe[0];
        vsAiOpenCell(pick);
        vsCheckAiWin();
        return;
    }

// ===== 如果规则推导不出安全格子，AI 必须开始盲猜 =====
    const unknowns = solver.getUnknownCells();
    if (unknowns.length > 0) {
        let pick = null; // 1. 初始化 pick 变量

        // 2. 只有高级(high)和专家(expert)难度，才允许启动概率启发式盲猜
        if (diffCfg.probHeuristic && currentAiDifficulty !== "medium") { 
            pick = solver.getBestGuess();
        } 
        // 3. 如果有角落优先配置，则走角落优先（如果没有，pick 依旧为 null）
        else if (diffCfg.cornerPrefer) {
            // ... 你的边缘/角落优先逻辑可以写在这里
        } 

        // 4. 【核心修复】：如果上面两项高级策略都没选出格子（比如当前是中级难度），
        // 或者策略失效，则兜底执行像普通人类一样的随机瞎猜！
        if (!pick) {
            pick = unknowns[Math.floor(Math.random() * unknowns.length)];
        }

        // 5. 确保这一段脱离任何猜测策略的绑定，只要选出 pick 必然执行点击
        if (pick) {
            vsAiOpenCell(pick);
            vsCheckAiWin();
        }
    }
}

function countAiFlags() {
    let count = 0;
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (vsAiBoard[r][c].flag) count++;
        }
    }
    return count;
}

function recalculateAiBoardNumbers() {
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (vsAiBoard[r][c].mine) continue;
            let count = 0;
            for (const [dr, dc] of DIRECTIONS) {
                const nr = r + dr, nc = c + dc;
                if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && vsAiBoard[nr][nc].mine) {
                    count++;
                }
            }
            vsAiBoard[r][c].number = count;
        }
    }
}

// =========================
// VS 模式：胜负判定
// =========================

function vsHumanWin() {
    if (vsGameEnded) return;
    vsGameEnded = true;
    vsGameActive = false;
    vsHumanScore++;
    updateVsScoreDisplay();
    stopVsTimers();
    stopVsAiStep();

    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (board[r][c].mine && !board[r][c].flag) {
                board[r][c].flag = true;
                updateVsCellDisplay(board[r][c]);
            }
        }
    }
    setFlagCount(MINE_COUNT);
    vsMineCountEl.querySelector(".led-value").textContent = fmtLED(MINE_COUNT - flagCount);
    vsRestartBtn.textContent = "😎";
    vsAiFaceEl.textContent = "😵";
    vsStatusEl.textContent = "🎉 你赢了！";
    vsStatusEl.className = "vs-status win";
    sfxWin();
    recordGame(true, vsSecondsElapsed);
    vsStartBtn.disabled = false;
}

function vsHumanLose() {
    if (vsGameEnded) return;
    vsGameEnded = true;
    vsGameActive = false;
    vsAiScore++;
    updateVsScoreDisplay();
    stopVsTimers();
    stopVsAiStep();

    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const cell = board[r][c];
            if (cell.mine) {
                cell.open = true;
                updateVsCellDisplay(cell);
            }
            if (cell.flag && !cell.mine) {
                cell.element.classList.add("flag-wrong");
                cell.element.textContent = "❌";
            }
        }
    }
    vsRestartBtn.textContent = "😵";
    vsAiFaceEl.textContent = "😎";
    vsStatusEl.textContent = "💀 你踩雷了！AI 获胜";
    vsStatusEl.className = "vs-status lose";
    recordGame(false, vsSecondsElapsed);
    vsStartBtn.disabled = false;
}

function vsAiWin() {
    if (vsGameEnded) return;
    vsGameEnded = true;
    vsGameActive = false;
    vsAiScore++;
    updateVsScoreDisplay();
    stopVsTimers();
    stopVsAiStep();

    let aiFlags = 0;
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (vsAiBoard[r][c].mine && !vsAiBoard[r][c].flag) {
                vsAiBoard[r][c].flag = true;
                updateVsCellDisplay(vsAiBoard[r][c]);
            }
            if (vsAiBoard[r][c].flag) aiFlags++;
        }
    }
    vsAiMineCountEl.querySelector(".led-value").textContent = fmtLED(MINE_COUNT - aiFlags);
    vsAiFaceEl.textContent = "😎";
    vsRestartBtn.textContent = "😵";
    vsStatusEl.textContent = "🤖 AI 赢了！再来一局？";
    vsStatusEl.className = "vs-status lose";
    recordGame(false, vsSecondsElapsed);
    vsStartBtn.disabled = false;
}

function vsAiLose() {
    if (vsGameEnded) return;
    vsGameEnded = true;
    vsGameActive = false;
    vsHumanScore++;
    updateVsScoreDisplay();
    stopVsTimers();
    stopVsAiStep();

    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const cell = vsAiBoard[r][c];
            if (cell.mine) {
                cell.open = true;
                updateVsCellDisplay(cell);
            }
        }
    }
    vsAiFaceEl.textContent = "😵";
    vsRestartBtn.textContent = "😎";
    vsStatusEl.textContent = "🎉 AI 踩雷了！你赢了！";
    vsStatusEl.className = "vs-status win";
    sfxWin();
    recordGame(true, vsSecondsElapsed);
    vsStartBtn.disabled = false;
}


// =========================
// VS 模式：计时器
// =========================

function vsStartTimers() {
    vsSecondsElapsed = 0;
    vsAiSecondsElapsed = 0;
    vsTimerEl.querySelector(".led-value").textContent = "000";
    vsAiTimerEl.querySelector(".led-value").textContent = "000";

    vsTimerInterval = setInterval(() => {
        vsSecondsElapsed++;
        if (vsSecondsElapsed > 999) vsSecondsElapsed = 999;
        vsTimerEl.querySelector(".led-value").textContent = fmtLED(vsSecondsElapsed);
    }, 1000);
}

function vsStartAiTimer() {
    vsAiTimerInterval = setInterval(() => {
        vsAiSecondsElapsed++;
        if (vsAiSecondsElapsed > 999) vsAiSecondsElapsed = 999;
        vsAiTimerEl.querySelector(".led-value").textContent = fmtLED(vsAiSecondsElapsed);
    }, 1000);
}

function stopVsTimers() {
    clearInterval(vsTimerInterval);
    vsTimerInterval = null;
    clearInterval(vsAiTimerInterval);
    vsAiTimerInterval = null;
}


// =========================
// VS 模式：AI 自动走子
// =========================

function scheduleAiStep() {
    if (!vsGameActive || vsGameEnded || vsAiDead) {
        vsAiStepInterval = null;
        return;
    }
    const diffCfg = AI_DIFFICULTY[currentAiDifficulty];
    const delay = diffCfg.speedMin + Math.random() * (diffCfg.speedMax - diffCfg.speedMin);
    vsAiStepInterval = setTimeout(() => {
        vsAiStep();
        scheduleAiStep();
    }, delay);
}

function startVsAiSteps() {
    stopVsAiStep();
    scheduleAiStep();
}

function stopVsAiStep() {
    clearTimeout(vsAiStepInterval);
    vsAiStepInterval = null;
}


// =========================
// VS 模式：更新格子外观
// =========================

function updateVsCellDisplay(cell) {
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
// VS 模式：开始 / 重新开始
// =========================

export function startVsBattle() {
    if (vsGameActive) return;

    initVsMode();
    vsGameActive = true;
    vsGameEnded = false;
    vsHumanFirstClick = true;
    vsAiFirstClick = true;
    vsHumanDead = false;
    vsAiDead = false;
    vsMineSnapshot = null;

    vsSecondsElapsed = 0;
    vsAiSecondsElapsed = 0;
    vsTimerEl.querySelector(".led-value").textContent = "000";
    vsAiTimerEl.querySelector(".led-value").textContent = "000";

    vsStatusEl.textContent = "⚡ 对战中...你先走！";
    vsStatusEl.className = "vs-status";
    vsStartBtn.disabled = true;
}

export function vsRestart() {
    stopVsGame();
    initVsMode();
    vsGameActive = true;
    vsGameEnded = false;
    vsHumanFirstClick = true;
    vsAiFirstClick = true;
    vsHumanDead = false;
    vsAiDead = false;
    vsMineSnapshot = null;
    vsSecondsElapsed = 0;
    vsAiSecondsElapsed = 0;
    vsTimerEl.querySelector(".led-value").textContent = "000";
    vsAiTimerEl.querySelector(".led-value").textContent = "000";
    vsStatusEl.textContent = "⚡ 对战中...你先走！";
    vsStatusEl.className = "vs-status";
    vsStartBtn.disabled = true;
}

export function stopVsGame() {
    vsGameActive = false;
    vsGameEnded = false;
    stopVsTimers();
    stopVsAiStep();
}


// =========================
// VS 模式：更新比分显示
// =========================

function updateVsScoreDisplay() {
    vsHumanWinsEl.textContent = vsHumanScore;
    vsAiWinsEl.textContent = vsAiScore;
}

export function resetVsScores() {
    vsHumanScore = 0;
    vsAiScore = 0;
    updateVsScoreDisplay();
}


// =========================
// AI 难度选择
// =========================

export function setAiDifficulty(level) {
    if (level === currentAiDifficulty) return;
    setCurrentAiDifficulty(level);

    aiDiffBtns.forEach(btn => btn.classList.toggle("active", btn.dataset.ai === level));

    if (vsGameActive && !vsGameEnded && vsAiStepInterval) {
        stopVsAiStep();
        scheduleAiStep();
    }
}


// =========================
// 事件绑定
// =========================

vsStartBtn.addEventListener("click", startVsBattle);
vsRestartBtn.addEventListener("click", vsRestart);

aiDiffBtns.forEach(btn => {
    btn.addEventListener("click", () => setAiDifficulty(btn.dataset.ai));
});
