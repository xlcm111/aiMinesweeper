// =========================
// 排行榜面板
// =========================

import { currentUser, currentLbSort, setCurrentLbSort } from "./state.js";
import { loadUsers, escapeHtml, apiCall } from "./utils.js";


// =========================
// DOM 元素
// =========================

const lbTabs        = document.querySelectorAll(".lb-tab");
const lbList        = document.getElementById("lb-list");
const lbEmpty       = document.getElementById("lb-empty");


// =========================
// 面板开关
// =========================

export function openLeaderboard() {
    document.getElementById("leaderboard-overlay").classList.add("open");
    document.getElementById("leaderboard-panel").classList.add("open");
    document.getElementById("leaderboard-toggle").style.opacity = "0";
    document.getElementById("leaderboard-toggle").style.pointerEvents = "none";
    renderLeaderboard();
}

export function closeLeaderboard() {
    document.getElementById("leaderboard-overlay").classList.remove("open");
    document.getElementById("leaderboard-panel").classList.remove("open");
    document.getElementById("leaderboard-toggle").style.opacity = "";
    document.getElementById("leaderboard-toggle").style.pointerEvents = "";
}


// =========================
// 渲染排行榜
// =========================

async function renderLeaderboard() {
    let userList = [];

    // 尝试从服务端拉取
    try {
        const base = window.location.origin;
        const res = await fetch(base + "/api/leaderboard?by=" + currentLbSort);
        const json = await res.json();
        if (json.ok && json.leaderboard) {
            userList = json.leaderboard.map(u => ({
                username: u.username,
                nickname: u.nickname || u.username,
                avatar: u.avatar || "👤",
                games: u.games,
                wins: u.wins,
                losses: u.losses,
                winrate: u.winRate,
                bestBeginner: u.bestTimes?.beginner ?? null,
                bestIntermediate: u.bestTimes?.intermediate ?? null,
                bestExpert: u.bestTimes?.expert ?? null,
            }));
        }
    } catch (_) { /* 忽略 */ }

    // 降级到 localStorage
    if (userList.length === 0) {
        const users = loadUsers();
        for (const [username, data] of Object.entries(users)) {
            const stats = data.stats;
            const winrate = stats.games > 0 ? Math.round((stats.wins / stats.games) * 100) : 0;
            userList.push({
                username,
                nickname: data.nickname || username,
                avatar: data.avatar || "👤",
                games: stats.games,
                wins: stats.wins,
                losses: stats.losses,
                winrate,
                bestBeginner: stats.bestTimes?.beginner ?? null,
                bestIntermediate: stats.bestTimes?.intermediate ?? null,
                bestExpert: stats.bestTimes?.expert ?? null,
            });
        }
    }

    if (userList.length === 0) {
        lbEmpty.style.display = "";
        lbList.style.display = "none";
        return;
    }

    lbEmpty.style.display = "none";
    lbList.style.display = "";

    // 排序
    switch (currentLbSort) {
        case "winrate":
            userList.sort((a, b) => b.winrate - a.winrate || b.wins - a.wins);
            break;
        case "wins":
            userList.sort((a, b) => b.wins - a.wins || b.winrate - a.winrate);
            break;
        case "beginner":
            userList.sort((a, b) => {
                if (a.bestBeginner === null && b.bestBeginner === null) return 0;
                if (a.bestBeginner === null) return 1;
                if (b.bestBeginner === null) return -1;
                return a.bestBeginner - b.bestBeginner;
            });
            break;
        case "intermediate":
            userList.sort((a, b) => {
                if (a.bestIntermediate === null && b.bestIntermediate === null) return 0;
                if (a.bestIntermediate === null) return 1;
                if (b.bestIntermediate === null) return -1;
                return a.bestIntermediate - b.bestIntermediate;
            });
            break;
        case "expert":
            userList.sort((a, b) => {
                if (a.bestExpert === null && b.bestExpert === null) return 0;
                if (a.bestExpert === null) return 1;
                if (b.bestExpert === null) return -1;
                return a.bestExpert - b.bestExpert;
            });
            break;
    }

    const top20 = userList.slice(0, 20);
    const currentUsername = currentUser ? currentUser.username : null;

    let html = "";
    top20.forEach((u, i) => {
        const isMe = u.username === currentUsername;
        let statText = "";
        switch (currentLbSort) {
            case "winrate":  statText = u.winrate + "%"; break;
            case "wins":     statText = u.wins + " 胜"; break;
            case "beginner": statText = u.bestBeginner !== null ? u.bestBeginner + " 秒" : "-"; break;
            case "intermediate": statText = u.bestIntermediate !== null ? u.bestIntermediate + " 秒" : "-"; break;
            case "expert":   statText = u.bestExpert !== null ? u.bestExpert + " 秒" : "-"; break;
        }

        const displayName = u.nickname && u.nickname !== u.username
            ? escapeHtml(u.nickname) + " @" + escapeHtml(u.username)
            : escapeHtml(u.username);
        html += `<div class="lb-row${isMe ? " me" : ""}">
            <div class="lb-rank">${i + 1}</div>
            <span class="lb-avatar-small">${escapeHtml(u.avatar || "👤")}</span>
            <div class="lb-name">${displayName}${isMe ? " (我)" : ""}</div>
            <div class="lb-stat">${statText}</div>
        </div>`;
    });

    lbList.innerHTML = html;
}


// =========================
// 选项卡切换
// =========================

lbTabs.forEach(tab => {
    tab.addEventListener("click", () => {
        lbTabs.forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        setCurrentLbSort(tab.dataset.lb);
        renderLeaderboard();
    });
});


// =========================
// 事件绑定
// =========================

document.getElementById("leaderboard-toggle").addEventListener("click", openLeaderboard);
document.getElementById("leaderboard-close").addEventListener("click", closeLeaderboard);
document.getElementById("leaderboard-overlay").addEventListener("click", closeLeaderboard);
