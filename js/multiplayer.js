// =========================
// 多人对战 — WebSocket / 房间 / 游戏逻辑
// =========================

import { DIFFICULTY, DIRECTIONS, WS_MAX_RECONNECT, WS_RECONNECT_DELAYS } from "./config.js";
import { currentUser, currentDifficulty, currentMode } from "./state.js";
import { Cell } from "./cell.js";
import {
    fmtLED, addLongPressSupport, escapeHtml,
    getDifficultyLabel, recordGame, showToast,
} from "./utils.js";
import { sfxClick, sfxFlag, sfxLose, sfxWin } from "./audio.js";


// =========================
// WebSocket 连接管理
// =========================

let ws = null;
export let wsConnected = false;
let wsReconnectAttempts = 0;
let _connectTimeoutId = null;  // 用于在断开时清除连接超时定时器

export function getWsUrl() {
    const inputEl = document.getElementById("multi-server-url");
    const customUrl = (inputEl.value || "").trim();
    if (customUrl) return customUrl;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    // 处理 file:// 协议或空 hostname（本地直接打开 HTML 文件）
    const host = window.location.hostname || "localhost";
    const port = window.location.port || "3000";
    const autoUrl = protocol + "//" + host + ":" + port;

    if (inputEl) inputEl.value = autoUrl;
    return autoUrl;
}

export function connectToServer(url) {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        return;
    }

    const targetUrl = url || getWsUrl();
    updateConnStatus("connecting", "● 连接中...");

    try {
        ws = new WebSocket(targetUrl);
    } catch (e) {
        updateConnStatus("disconnected", "● 未连接");
        showToast("无法连接到服务器，单机模式不受影响 😊", "error");
        return;
    }

    clearConnectTimeout();
    _connectTimeoutId = setTimeout(() => {
        _connectTimeoutId = null;
        if (ws && ws.readyState === WebSocket.CONNECTING) {
            ws.close();
            ws = null;
            wsConnected = false;
            updateConnStatus("disconnected", "● 未连接");
            showToast("无法连接到服务器，单机模式不受影响 😊", "error");
        }
    }, 5000);

    ws.addEventListener("open", () => {
        clearConnectTimeout();
        wsConnected = true;
        wsReconnectAttempts = 0;
        updateConnStatus("connected", "● 已连接");
        showToast("已连接到服务器", "success");

        if (currentUser) {
            sendMessage({ type: "set_username", username: currentUser.username });
        }
    });

    ws.addEventListener("message", (event) => {
        handleServerMessage(event);
    });

    ws.addEventListener("close", () => {
        clearConnectTimeout();
        wsConnected = false;
        updateConnStatus("disconnected", "● 未连接");

        if (multiRoomCode && wsReconnectAttempts < WS_MAX_RECONNECT) {
            const delay = WS_RECONNECT_DELAYS[wsReconnectAttempts];
            wsReconnectAttempts++;
            updateConnStatus("connecting", `● 重连中(${wsReconnectAttempts}/${WS_MAX_RECONNECT})...`);
            showToast(`连接断开，${delay/1000}秒后自动重连...`, "error");
            setTimeout(() => connectToServer(targetUrl), delay);
        } else if (wsReconnectAttempts >= WS_MAX_RECONNECT) {
            showToast("无法重新连接，单机模式不受影响 😊", "error");
            resetMultiState();
            showMultiLobby();
        }
    });

    ws.addEventListener("error", () => {
        // close 事件会随之触发
    });
}

function clearConnectTimeout() {
    if (_connectTimeoutId) {
        clearTimeout(_connectTimeoutId);
        _connectTimeoutId = null;
    }
}

export function disconnectFromServer() {
    wsReconnectAttempts = WS_MAX_RECONNECT;
    clearConnectTimeout();
    if (ws) {
        ws.close();
        ws = null;
    }
    wsConnected = false;
    updateConnStatus("disconnected", "● 未连接");
}

export function sendMessage(msg) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg));
        return true;
    }
    showToast("未连接到服务器", "error");
    return false;
}

function updateConnStatus(status, text) {
    const el = document.getElementById("multi-conn-status");
    if (el) {
        el.className = "multi-conn-status " + status;
        el.textContent = text;
    }
}


// =========================
// 多人对战 — 状态变量
// =========================

let multiRoomCode = null;
export function isInMultiRoom() { return !!multiRoomCode; }
let multiIsHost = false;
let multiMyPlayerId = null;
let multiPlayers = [];
let multiGameActive = false;
let multiGameEnded = false;
let multiMineLayout = null;
let multiTotalCells = 0;
let multiRows = 9;
let multiCols = 9;
let multiMines = 10;
let multiSecondsElapsed = 0;
let multiTimerInterval = null;
let multiMyFlagCount = 0;
let multiMyOpenedCount = 0;
let multiMyBoard = [];
export let multiCurrentDiff = "beginner";  // 被 main.js 的 setDifficulty 读取
let multiMyFirstClick = true;
let multiProgressDebounce = null;


// =========================
// 多人对战 — 辅助函数
// =========================

function getMultiUsername() {
    if (currentUser) return currentUser.username;
    return "Guest_" + Math.random().toString(36).substring(2, 6).toUpperCase();
}

function countMultiOpened() {
    let count = 0;
    for (let r = 0; r < multiRows; r++) {
        for (let c = 0; c < multiCols; c++) {
            if (multiMyBoard[r] && multiMyBoard[r][c] && multiMyBoard[r][c].open && !multiMyBoard[r][c].mine) {
                count++;
            }
        }
    }
    return count;
}

function sendProgress() {
    if (!multiGameActive || multiGameEnded) return;

    if (multiProgressDebounce) return;
    multiProgressDebounce = setTimeout(() => {
        multiProgressDebounce = null;
        multiMyOpenedCount = countMultiOpened();
        sendMessage({
            type: "cell_open",
            openedCount: multiMyOpenedCount,
            seconds: multiSecondsElapsed,
        });
    }, 300);
}


// =========================
// 多人对战 — 棋盘初始化
// =========================

function initMultiBoard(rows, cols) {
    multiMyBoard = [];
    for (let r = 0; r < rows; r++) {
        multiMyBoard[r] = [];
        for (let c = 0; c < cols; c++) {
            multiMyBoard[r][c] = new Cell(r, c);
        }
    }
}

function applyMineLayout(mineLayout) {
    for (let r = 0; r < multiRows; r++) {
        for (let c = 0; c < multiCols; c++) {
            multiMyBoard[r][c].mine = false;
        }
    }
    for (const { r, c } of mineLayout) {
        if (r >= 0 && r < multiRows && c >= 0 && c < multiCols) {
            multiMyBoard[r][c].mine = true;
        }
    }
    for (let r = 0; r < multiRows; r++) {
        for (let c = 0; c < multiCols; c++) {
            if (multiMyBoard[r][c].mine) continue;
            let count = 0;
            for (const [dr, dc] of DIRECTIONS) {
                const nr = r + dr, nc = c + dc;
                if (nr >= 0 && nr < multiRows && nc >= 0 && nc < multiCols && multiMyBoard[nr][nc].mine) {
                    count++;
                }
            }
            multiMyBoard[r][c].number = count;
        }
    }
}

function renderMultiBoard() {
    const boardEl = document.getElementById("multi-board-self");
    if (!boardEl) return;

    boardEl.innerHTML = "";
    boardEl.style.display = "grid";
    const diffCfg = DIFFICULTY[multiCurrentDiff];
    const cellSize = diffCfg ? diffCfg.cellSize : (multiRows > 12 || multiCols > 20 ? 26 : multiRows > 9 ? 30 : 32);
    document.documentElement.style.setProperty("--cell-size", `${cellSize}px`);
    boardEl.style.gridTemplateColumns = `repeat(${multiCols}, ${cellSize}px)`;

    for (let r = 0; r < multiRows; r++) {
        for (let c = 0; c < multiCols; c++) {
            const cell = multiMyBoard[r][c];
            const el = document.createElement("div");
            el.classList.add("cell");
            el.dataset.row = r;
            el.dataset.col = c;

            el.addEventListener("click", () => multiOnCellClick(cell));
            el.addEventListener("contextmenu", (e) => {
                e.preventDefault();
                multiOnCellRightClick(cell);
            });
            addLongPressSupport(el, () => multiOnCellRightClick(cell));

            cell.element = el;
            boardEl.appendChild(el);
        }
    }
}

function multiUpdateCellDisplay(cell) {
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
// 多人对战 — 游戏逻辑
// =========================

function multiOpenCell(cell) {
    if (!multiGameActive || multiGameEnded) return;
    if (cell.open || cell.flag) return;

    cell.open = true;

    if (cell.mine) {
        cell.element.classList.add("mine-death");
        sfxLose();
        multiOnLose();
        return;
    }

    multiUpdateCellDisplay(cell);

    if (cell.number === 0) {
        for (const [dr, dc] of DIRECTIONS) {
            const nr = cell.row + dr, nc = cell.col + dc;
            if (nr >= 0 && nr < multiRows && nc >= 0 && nc < multiCols) {
                multiOpenCell(multiMyBoard[nr][nc]);
            }
        }
    }
}

function multiOnCellClick(cell) {
    if (!multiGameActive || multiGameEnded) return;
    if (cell.open || cell.flag) return;

    if (multiMyFirstClick) {
        multiMyFirstClick = false;
        multiStartTimer();
    }

    sfxClick();
    multiOpenCell(cell);

    if (!multiGameEnded) {
        multiCheckWin();
        sendProgress();
    }
}

function multiOnCellRightClick(cell) {
    if (!multiGameActive || multiGameEnded) return;
    if (cell.open) return;

    cell.flag = !cell.flag;
    multiMyFlagCount += cell.flag ? 1 : -1;
    sfxFlag();
    multiUpdateCellDisplay(cell);

    const mineCountEl = document.getElementById("multi-mine-count");
    if (mineCountEl) {
        mineCountEl.querySelector(".led-value").textContent = fmtLED(multiMines - multiMyFlagCount);
    }

    sendMessage({
        type: "cell_flag",
        flagCount: multiMyFlagCount,
        seconds: multiSecondsElapsed,
    });
}

function multiCheckWin() {
    let allOpened = true;
    for (let r = 0; r < multiRows; r++) {
        for (let c = 0; c < multiCols; c++) {
            if (!multiMyBoard[r][c].mine && !multiMyBoard[r][c].open) {
                allOpened = false;
            }
        }
    }
    if (allOpened) {
        multiOnWin();
    }
}

function multiOnWin() {
    if (multiGameEnded) return;
    multiGameEnded = true;
    multiGameActive = false;
    multiStopTimer();

    for (let r = 0; r < multiRows; r++) {
        for (let c = 0; c < multiCols; c++) {
            if (multiMyBoard[r][c].mine && !multiMyBoard[r][c].flag) {
                multiMyBoard[r][c].flag = true;
                multiUpdateCellDisplay(multiMyBoard[r][c]);
            }
        }
    }
    multiMyFlagCount = multiMines;
    const mineCountEl = document.getElementById("multi-mine-count");
    if (mineCountEl) {
        mineCountEl.querySelector(".led-value").textContent = fmtLED(0);
    }

    const faceEl = document.getElementById("multi-face");
    if (faceEl) faceEl.textContent = "😎";
    sfxWin();

    sendMessage({
        type: "game_result",
        result: "win",
        seconds: multiSecondsElapsed,
    });

    recordGame(true, multiSecondsElapsed, "multi");
    updateOwnStatusInOpponents("win");
}

function multiOnLose() {
    if (multiGameEnded) return;
    multiGameEnded = true;
    multiGameActive = false;
    multiStopTimer();

    for (let r = 0; r < multiRows; r++) {
        for (let c = 0; c < multiCols; c++) {
            const cell = multiMyBoard[r][c];
            if (cell.mine) {
                cell.open = true;
                multiUpdateCellDisplay(cell);
            }
            if (cell.flag && !cell.mine) {
                cell.element.classList.add("flag-wrong");
                cell.element.textContent = "❌";
            }
        }
    }

    const faceEl = document.getElementById("multi-face");
    if (faceEl) faceEl.textContent = "😵";

    sendMessage({
        type: "game_result",
        result: "lose",
        seconds: multiSecondsElapsed,
    });

    recordGame(false, multiSecondsElapsed, "multi");
    updateOwnStatusInOpponents("lose");
}


// =========================
// 多人对战 — 计时器
// =========================

function multiStartTimer() {
    multiSecondsElapsed = 0;
    const timerEl = document.getElementById("multi-timer");
    if (timerEl) timerEl.querySelector(".led-value").textContent = "000";

    multiTimerInterval = setInterval(() => {
        multiSecondsElapsed++;
        if (multiSecondsElapsed > 999) multiSecondsElapsed = 999;
        const el = document.getElementById("multi-timer");
        if (el) el.querySelector(".led-value").textContent = fmtLED(multiSecondsElapsed);
    }, 1000);
}

export function multiStopTimer() {
    clearInterval(multiTimerInterval);
    multiTimerInterval = null;
}


// =========================
// 多人对战 — 房间管理
// =========================

export function showMultiLobby() {
    document.getElementById("multi-lobby").style.display = "";
    document.getElementById("multi-room").style.display = "none";
    document.getElementById("multi-game").style.display = "none";
    document.getElementById("multi-join-msg").textContent = "";
    document.getElementById("multi-join-msg").className = "multi-msg";
    document.getElementById("multi-room-input").value = "";
    document.getElementById("multi-created-info").style.display = "none";
    document.getElementById("multi-copy-ok").style.display = "none";
}

function showMultiRoom() {
    document.getElementById("multi-lobby").style.display = "none";
    document.getElementById("multi-room").style.display = "";
    document.getElementById("multi-game").style.display = "none";
    document.getElementById("multi-room-msg").textContent = "";
    document.getElementById("multi-room-msg").className = "multi-msg";
}

function showMultiGame() {
    document.getElementById("multi-lobby").style.display = "none";
    document.getElementById("multi-room").style.display = "none";
    document.getElementById("multi-game").style.display = "";
}

function renderPlayerList() {
    const listEl = document.getElementById("multi-player-list");
    if (!listEl) return;

    const countEl = document.getElementById("multi-player-count");
    if (countEl) countEl.textContent = multiPlayers.length;

    const startBtn = document.getElementById("multi-start-btn");
    const isHost = multiIsHost;
    if (startBtn) {
        startBtn.disabled = !(isHost && multiPlayers.length >= 2);
        startBtn.textContent = isHost
            ? (multiPlayers.length >= 2 ? "🚀 开始游戏" : "🚀 开始游戏 (需要至少2人)")
            : "🔒 等待房主开始...";
    }

    const diffBtns = document.querySelectorAll("#multi-diff-bar .diff-btn");
    diffBtns.forEach(btn => {
        btn.disabled = !isHost;
        btn.style.opacity = isHost ? "" : "0.5";
        btn.style.cursor = isHost ? "" : "not-allowed";
        btn.classList.toggle("active", btn.dataset.level === multiCurrentDiff);
    });

    let html = "";
    for (const p of multiPlayers) {
        const isMe = p.id === multiMyPlayerId;
        const hostClass = p.isHost ? " is-host" : "";
        html += `<div class="multi-player-card${hostClass}">
            <div class="multi-player-avatar">${isMe ? "🧑" : "👤"}</div>
            <div class="multi-player-name">${escapeHtml(p.username)}</div>
            ${p.isHost ? '<span class="multi-player-badge host">房主</span>' : ""}
            ${isMe ? '<span class="multi-player-badge you">你</span>' : ""}
        </div>`;
    }

    listEl.innerHTML = html;
}

export function resetMultiState() {
    multiRoomCode = null;
    multiIsHost = false;
    multiMyPlayerId = null;
    multiPlayers = [];
    multiGameActive = false;
    multiGameEnded = false;
    multiMineLayout = null;
    multiTotalCells = 0;
    multiMyBoard = [];
    multiMyFirstClick = true;
    multiSecondsElapsed = 0;
    multiMyFlagCount = 0;
    multiMyOpenedCount = 0;
    multiStopTimer();
    if (multiProgressDebounce) {
        clearTimeout(multiProgressDebounce);
        multiProgressDebounce = null;
    }

    const playAgainEl = document.getElementById("multi-play-again");
    if (playAgainEl) playAgainEl.style.display = "none";
    const rankingEl = document.getElementById("multi-ranking");
    if (rankingEl) rankingEl.style.display = "none";
    const rankingListEl = document.getElementById("multi-ranking-list");
    if (rankingListEl) rankingListEl.innerHTML = "";
    const opponentsEl = document.getElementById("multi-opponents-list");
    if (opponentsEl) opponentsEl.innerHTML = "";
}

function getMultiDifficulty() {
    const cfg = DIFFICULTY[multiCurrentDiff];
    return { rows: cfg.rows, cols: cfg.cols, mines: cfg.mines };
}


// =========================
// 多人对战 — 房间操作
// =========================

function handleCreateRoom() {
    if (!wsConnected) {
        showToast("请先点击「连接」按钮连接到服务器", "error");
        return;
    }

    const diff = getMultiDifficulty();
    sendMessage({
        type: "create_room",
        username: getMultiUsername(),
        difficulty: diff,
    });
}

function handleJoinRoom() {
    if (!wsConnected) {
        showToast("请先连接到服务器", "error");
        return;
    }

    const codeInput = document.getElementById("multi-room-input");
    const code = (codeInput.value || "").toUpperCase().trim();
    if (!code || code.length < 4) {
        document.getElementById("multi-join-msg").textContent = "⚠ 请输入有效的房间码";
        document.getElementById("multi-join-msg").className = "multi-msg error";
        return;
    }

    document.getElementById("multi-join-msg").textContent = "";
    document.getElementById("multi-join-msg").className = "multi-msg";

    sendMessage({
        type: "join_room",
        roomCode: code,
        username: getMultiUsername(),
    });
}

function handleLeaveRoom() {
    sendMessage({ type: "leave_room" });
    resetMultiState();
    showMultiLobby();
}

function handleStartGame() {
    if (!multiIsHost) return;
    const diff = getMultiDifficulty();
    sendMessage({
        type: "start_game",
        difficulty: diff,
    });
}

function handlePlayAgain() {
    if (!multiIsHost) return;
    sendMessage({ type: "play_again" });
}


// =========================
// 多人对战 — 对手进度显示
// =========================

function renderOpponentCards() {
    const listEl = document.getElementById("multi-opponents-list");
    if (!listEl) return;

    const others = multiPlayers.filter(p => p.id !== multiMyPlayerId);
    if (others.length === 0) {
        listEl.innerHTML = '<div style="color:rgba(255,255,255,0.3);text-align:center;padding:12px;font-size:13px;">等待其他玩家...</div>';
        return;
    }

    let html = "";
    for (const p of others) {
        const nonMineCount = multiRows * multiCols - multiMines;
        const progress = nonMineCount > 0 ? Math.min(100, Math.round((p.openedCount / nonMineCount) * 100)) : 0;
        const statusClass = !p.alive ? "dead" : p.finished ? "finished" : "";
        const fillClass = !p.alive ? "dead" : p.finished ? "finished" : "";
        const statusIcon = !p.alive ? "💀" : p.finished ? "🏁" : "🟢";
        const statusText = !p.alive ? "已踩雷" : p.finished ? "已完成" : "进行中";

        html += `<div class="multi-opponent-card ${statusClass}" data-player-id="${p.id}">
            <div class="multi-opponent-header">
                <span class="multi-opponent-name">${escapeHtml(p.username)}</span>
                <span class="multi-opponent-status" title="${statusText}">${statusIcon}</span>
            </div>
            <div class="multi-progress-bar">
                <div class="multi-progress-fill ${fillClass}" style="width:${progress}%"></div>
            </div>
            <div style="display:flex;justify-content:space-between;">
                <span class="multi-progress-text">${progress}% (${p.openedCount}/${nonMineCount})</span>
                <span class="multi-opponent-timer">⏱ ${fmtLED(p.seconds)}</span>
            </div>
        </div>`;
    }

    listEl.innerHTML = html;
}

function updateOpponentCards() {
    const others = multiPlayers.filter(p => p.id !== multiMyPlayerId);
    const nonMineCount = multiRows * multiCols - multiMines;

    for (const p of others) {
        const card = document.querySelector(`.multi-opponent-card[data-player-id="${p.id}"]`);
        if (!card) { renderOpponentCards(); return; }

        const progress = nonMineCount > 0 ? Math.min(100, Math.round((p.openedCount / nonMineCount) * 100)) : 0;
        const fillEl = card.querySelector(".multi-progress-fill");
        const textEl = card.querySelector(".multi-progress-text");
        const timerEl = card.querySelector(".multi-opponent-timer");
        const statusEl = card.querySelector(".multi-opponent-status");

        if (fillEl) fillEl.style.width = progress + "%";
        if (textEl) textEl.textContent = `${progress}% (${p.openedCount}/${nonMineCount})`;
        if (timerEl) timerEl.textContent = `⏱ ${fmtLED(p.seconds)}`;

        if (!p.alive) {
            card.classList.add("dead");
            if (fillEl) fillEl.classList.add("dead");
            if (statusEl) { statusEl.textContent = "💀"; statusEl.title = "已踩雷"; }
        }
        if (p.finished && p.alive) {
            card.classList.add("finished");
            if (fillEl) fillEl.classList.add("finished");
            if (statusEl) { statusEl.textContent = "🏁"; statusEl.title = "已完成"; }
        }
    }
}

function updateOwnStatusInOpponents(_result) {
    // 自己完成/失败后更新对手列表中自己的显示
}

function renderRankings(rankings) {
    const rankingDiv = document.getElementById("multi-ranking");
    const listEl = document.getElementById("multi-ranking-list");
    if (!rankingDiv || !listEl) return;

    rankingDiv.style.display = "";
    const playAgainBtn = document.getElementById("multi-play-again");
    if (playAgainBtn) {
        playAgainBtn.style.display = multiIsHost ? "" : "none";
    }

    let html = "";
    const ranked = rankings.filter(r => r.rank !== null);
    const unranked = rankings.filter(r => r.rank === null);

    const all = [...ranked, ...unranked];
    for (const r of all) {
        const isMe = multiPlayers.find(p => p.id === multiMyPlayerId);
        const isMeName = isMe && isMe.username === r.username;
        const rankDisplay = r.rank || "-";
        const resultClass = r.result === "win" ? "win" : r.result === "lose" ? "lose" : "unfinished";
        const resultText = r.result === "win" ? `🏆 ${r.seconds}s` :
                           r.result === "lose" ? `💀 ${r.seconds}s` :
                           r.result === "forfeit" ? "🚫 弃权" : "⏳ 未完成";

        html += `<div class="multi-ranking-row">
            <div class="multi-ranking-rank">${rankDisplay}</div>
            <div class="multi-ranking-name">${escapeHtml(r.username)}${isMeName ? " (我)" : ""}</div>
            <div class="multi-ranking-result ${resultClass}">${resultText}</div>
        </div>`;
    }

    listEl.innerHTML = html;
}


// =========================
// 多人对战 — 服务器消息处理
// =========================

function handleServerMessage(event) {
    let msg;
    try {
        msg = JSON.parse(event.data);
    } catch (_) {
        return;
    }

    switch (msg.type) {

        case "room_created":
            multiRoomCode = msg.roomCode;
            multiIsHost = true;
            multiMyPlayerId = msg.players[0]?.id;
            multiPlayers = msg.players;
            multiCurrentDiff = "beginner";

            document.getElementById("multi-room-code-display").textContent = msg.roomCode;
            document.getElementById("multi-room-code-label").textContent = msg.roomCode;
            document.getElementById("multi-created-info").style.display = "";
            document.getElementById("multi-copy-ok").style.display = "none";

            renderPlayerList();
            showMultiRoom();
            showToast("房间创建成功！", "success");
            break;

        case "room_joined":
            multiRoomCode = msg.roomCode;
            multiIsHost = false;
            multiMyPlayerId = msg.yourId;
            multiPlayers = msg.players;

            if (msg.difficulty) {
                for (const [key, cfg] of Object.entries(DIFFICULTY)) {
                    if (cfg.rows === msg.difficulty.rows && cfg.cols === msg.difficulty.cols && cfg.mines === msg.difficulty.mines) {
                        multiCurrentDiff = key;
                        break;
                    }
                }
            }

            document.getElementById("multi-room-code-label").textContent = msg.roomCode;
            renderPlayerList();
            showMultiRoom();
            showToast("已加入房间！", "success");
            break;

        case "player_joined":
            multiPlayers = msg.players;
            renderPlayerList();
            showToast(`${msg.player.username} 加入了房间`, "info");
            break;

        case "player_left":
            multiPlayers = msg.players;
            multiIsHost = multiPlayers.some(p => p.id === multiMyPlayerId && p.isHost);
            renderPlayerList();

            if (multiGameActive) {
                renderOpponentCards();
            }
            break;

        case "game_started":
            multiMineLayout = msg.mineLayout;
            multiRows = msg.rows;
            multiCols = msg.cols;
            multiMines = msg.mines;
            multiTotalCells = multiRows * multiCols - multiMines;
            multiPlayers = msg.players;

            const me = multiPlayers.find(p => p.id === multiMyPlayerId);
            if (me) multiIsHost = me.isHost;

            multiGameActive = true;
            multiGameEnded = false;
            multiMyFirstClick = true;
            multiSecondsElapsed = 0;
            multiMyFlagCount = 0;
            multiMyOpenedCount = 0;
            if (multiProgressDebounce) {
                clearTimeout(multiProgressDebounce);
                multiProgressDebounce = null;
            }
            multiStopTimer();

            initMultiBoard(multiRows, multiCols);
            applyMineLayout(multiMineLayout);
            renderMultiBoard();

            const faceEl = document.getElementById("multi-face");
            if (faceEl) faceEl.textContent = "😊";
            const mineCountEl = document.getElementById("multi-mine-count");
            if (mineCountEl) mineCountEl.querySelector(".led-value").textContent = fmtLED(multiMines);
            const timerEl = document.getElementById("multi-timer");
            if (timerEl) timerEl.querySelector(".led-value").textContent = "000";

            document.getElementById("multi-play-again").style.display = "none";
            document.getElementById("multi-ranking").style.display = "none";

            renderOpponentCards();
            showMultiGame();
            showToast("游戏开始！你先走！", "info");
            break;

        case "player_progress": {
            const target = multiPlayers.find(p => p.id === msg.playerId);
            if (target) {
                target.openedCount = msg.openedCount;
                target.flagCount = msg.flagCount;
                target.seconds = msg.seconds;
                target.alive = msg.alive;
                target.finished = msg.finished;
            }
            updateOpponentCards();
            break;
        }

        case "player_result": {
            const tp = multiPlayers.find(p => p.id === msg.playerId);
            if (tp) {
                tp.finished = true;
                tp.alive = (msg.result === "win");
                tp.seconds = msg.seconds;
            }

            updateOpponentCards();

            if (msg.rankings) {
                renderRankings(msg.rankings);
            }

            if (!multiGameEnded && msg.playerId !== multiMyPlayerId) {
                const resultText = msg.result === "win" ? "完成了！🏁" :
                                   msg.result === "lose" ? "踩雷了💀" : "断线了🚫";
                showToast(`${msg.username} ${resultText}`, "info");
            }
            break;
        }

        case "game_ended":
            if (msg.rankings) {
                renderRankings(msg.rankings);
            }
            if (!multiGameEnded) {
                multiGameActive = false;
                multiGameEnded = true;
                multiStopTimer();
            }
            showToast("游戏结束！", "info");
            break;

        case "room_reset": {
            const savedPlayerId = multiMyPlayerId;
            const roomCodeLabel = document.getElementById("multi-room-code-label");
            const savedRoomCode = multiRoomCode || (roomCodeLabel ? roomCodeLabel.textContent : "");

            if (msg.difficulty) {
                for (const [key, cfg] of Object.entries(DIFFICULTY)) {
                    if (cfg.rows === msg.difficulty.rows && cfg.cols === msg.difficulty.cols && cfg.mines === msg.difficulty.mines) {
                        multiCurrentDiff = key;
                        break;
                    }
                }
            }
            resetMultiState();
            multiMyPlayerId = savedPlayerId;
            multiRoomCode = savedRoomCode;
            multiPlayers = msg.players;
            const myself = multiPlayers.find(p => p.id === multiMyPlayerId);
            if (myself) multiIsHost = myself.isHost;
            renderPlayerList();
            showMultiRoom();
            showToast("房间已重置，准备新一局！", "success");
            break;
        }

        case "difficulty_updated":
            if (msg.difficulty) {
                for (const [key, cfg] of Object.entries(DIFFICULTY)) {
                    if (cfg.rows === msg.difficulty.rows && cfg.cols === msg.difficulty.cols && cfg.mines === msg.difficulty.mines) {
                        multiCurrentDiff = key;
                        break;
                    }
                }
            }
            renderPlayerList();
            break;

        case "room_closed":
            showToast("房间已关闭: " + (msg.reason || "房主离开"), "error");
            resetMultiState();
            showMultiLobby();
            break;

        case "left_room":
            resetMultiState();
            showMultiLobby();
            break;

        case "username_set":
            console.log("[好友] 在线注册成功: " + msg.username);
            break;

        case "challenge_sent":
            showToast("⚔️ 已向 " + msg.to + " 发起挑战！", "success");
            break;

        case "challenge_error":
            showToast("⚠ " + msg.message, "error");
            break;

        case "challenge_received": {
            const fromName = msg.from;
            const diff = msg.difficulty || { rows: 9, cols: 9, mines: 10 };
            const diffLabel = getDifficultyLabel(diff);

            const accepted = confirm(
                `⚔️ ${fromName} 向你发起扫雷挑战！\n\n` +
                `难度：${diffLabel}\n\n` +
                `点击"确定"接受挑战，"取消"则拒绝。`
            );

            sendMessage({
                type: "challenge_response",
                from: currentUser ? currentUser.username : "Guest",
                to: fromName,
                accepted: accepted,
                difficulty: diff,
            });

            if (accepted) {
                showToast("✅ 已接受挑战，正在进入房间...", "success");
            }
            break;
        }

        case "challenge_accepted": {
            showToast("⚔️ 挑战开始！进入房间 " + msg.roomCode, "success");

            if (currentMode !== "multiplayer") {
                // 将由 main.js 中的 switchMode 处理
                document.querySelector(".mode-btn[data-mode=\"multiplayer\"]")?.click();
            }

            if (!wsConnected) {
                connectToServer(getWsUrl());
                const waitConnect = setInterval(() => {
                    if (wsConnected) {
                        clearInterval(waitConnect);
                        sendMessage({
                            type: "join_room",
                            roomCode: msg.roomCode,
                            username: currentUser ? currentUser.username : "Guest",
                        });
                    }
                }, 200);
                setTimeout(() => clearInterval(waitConnect), 8000);
            } else {
                sendMessage({
                    type: "join_room",
                    roomCode: msg.roomCode,
                    username: currentUser ? currentUser.username : "Guest",
                });
            }
            break;
        }

        case "challenge_declined":
            showToast("❌ " + (msg.message || (msg.from + " 拒绝了你的挑战")), "error");
            break;

        case "challenge_cancelled":
            showToast("ℹ️ " + msg.from + " 取消了挑战", "info");
            break;

        case "kicked":
            showToast("⚠ " + msg.message, "error");
            disconnectFromServer();
            break;

        case "error":
            showToast(msg.message, "error");
            var multiRoomEl = document.getElementById("multi-room");
            if (multiRoomEl && multiRoomEl.style.display !== "none") {
                var multiRoomMsgEl = document.getElementById("multi-room-msg");
                if (multiRoomMsgEl) {
                    multiRoomMsgEl.textContent = "⚠ " + msg.message;
                    multiRoomMsgEl.className = "multi-msg error";
                }
            }
            var multiLobbyEl = document.getElementById("multi-lobby");
            if (multiLobbyEl && multiLobbyEl.style.display !== "none") {
                var multiJoinMsgEl = document.getElementById("multi-join-msg");
                if (multiJoinMsgEl) {
                    multiJoinMsgEl.textContent = "⚠ " + msg.message;
                    multiJoinMsgEl.className = "multi-msg error";
                }
            }
            break;
    }
}


// =========================
// 多人对战 — 更新难度按钮
// =========================

export function updateMultiDiffButtons() {
    const diffBar = document.getElementById("multi-diff-bar");
    if (!diffBar) return;
    diffBar.querySelectorAll(".diff-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.level === multiCurrentDiff);
    });
}


// =========================
// 多人对战 — 事件绑定
// =========================

document.getElementById("multi-connect-btn").addEventListener("click", () => {
    connectToServer(getWsUrl());
});

document.getElementById("multi-create-btn").addEventListener("click", handleCreateRoom);
document.getElementById("multi-join-btn").addEventListener("click", handleJoinRoom);

document.getElementById("multi-room-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleJoinRoom();
});

document.getElementById("multi-copy-code").addEventListener("click", () => {
    const code = document.getElementById("multi-room-code-display").textContent;
    if (code && code !== "------") {
        navigator.clipboard.writeText(code).then(() => {
            document.getElementById("multi-copy-ok").style.display = "";
            setTimeout(() => {
                document.getElementById("multi-copy-ok").style.display = "none";
            }, 2000);
        }).catch(() => {
            showToast("复制失败，请手动复制", "error");
        });
    }
});

document.getElementById("multi-leave-btn").addEventListener("click", handleLeaveRoom);
document.getElementById("multi-start-btn").addEventListener("click", handleStartGame);
document.getElementById("multi-play-again").addEventListener("click", handlePlayAgain);

document.querySelectorAll("#multi-diff-bar .diff-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        if (!multiIsHost) return;
        const level = btn.dataset.level;
        if (level === multiCurrentDiff) return;

        multiCurrentDiff = level;
        const diff = getMultiDifficulty();
        renderPlayerList();

        sendMessage({
            type: "update_difficulty",
            difficulty: diff,
        });
    });
});
