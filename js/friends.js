// =========================
// 好友系统
// =========================

import { DIFFICULTY } from "./config.js";
import { currentUser, currentDifficulty } from "./state.js";
import { loadUsers, saveUsers, escapeHtml, showToast } from "./utils.js";

// 由 main.js 注入 multiplayer 依赖
let _wsConnected = () => false;
let _sendMessage = null;
let _connectToServer = null;
let _getWsUrl = null;

export function injectMultiplayerDeps(deps) {
    _wsConnected = deps.wsConnected;
    _sendMessage = deps.sendMessage;
    _connectToServer = deps.connectToServer;
    _getWsUrl = deps.getWsUrl;
}


// =========================
// DOM 元素
// =========================

const friendsToggleBtn  = document.getElementById("friends-toggle");
const friendsOverlay    = document.getElementById("friends-overlay");
const friendsPanel      = document.getElementById("friends-panel");
const friendsCloseBtn   = document.getElementById("friends-close");
const friendsSearchInput = document.getElementById("friends-search-input");
const friendsAddBtn     = document.getElementById("friends-add-btn");
const friendsAddMsg     = document.getElementById("friends-add-msg");
const friendsListEl     = document.getElementById("friends-list");
const friendsEmptyEl    = document.getElementById("friends-empty");
const friendsRequestsSection = document.getElementById("friends-requests-section");
const friendsRequestsList    = document.getElementById("friends-requests-list");


// =========================
// 好友数据
// =========================

function getFriendData() {
    if (!currentUser) return null;
    const users = loadUsers();
    const user = users[currentUser.username];
    if (!user) return null;

    if (!user.friends) user.friends = [];
    if (!user.friendRequestsSent) user.friendRequestsSent = [];
    if (!user.friendRequestsReceived) user.friendRequestsReceived = [];

    return user;
}


// =========================
// 面板开关
// =========================

function openFriendsPanel() {
    if (!currentUser) {
        showToast("请先登录", "error");
        return;
    }

    friendsOverlay.classList.add("open");
    friendsPanel.classList.add("open");
    friendsToggleBtn.style.opacity = "0";
    friendsToggleBtn.style.pointerEvents = "none";

    refreshFriendsUI();
}

function closeFriendsPanel() {
    friendsOverlay.classList.remove("open");
    friendsPanel.classList.remove("open");
    friendsToggleBtn.style.opacity = "";
    friendsToggleBtn.style.pointerEvents = "";

    friendsAddMsg.textContent = "";
    friendsAddMsg.className = "auth-msg";
    friendsSearchInput.value = "";
}


// =========================
// 刷新 UI
// =========================

function refreshFriendsUI() {
    const user = getFriendData();
    if (!user) return;

    const users = loadUsers();

    // 收到的好友请求
    const received = user.friendRequestsReceived || [];
    if (received.length > 0) {
        friendsRequestsSection.style.display = "";
        let reqHTML = "";
        for (const reqUsername of received) {
            const reqUser = users[reqUsername];
            const avatar = reqUser ? (reqUser.avatar || "👤") : "👤";
            const nickname = reqUser ? (reqUser.nickname || reqUsername) : reqUsername;

            reqHTML += `<div class="friend-item request-item">
                <span class="friend-avatar">${avatar}</span>
                <span class="friend-name">${escapeHtml(nickname)}</span>
                <div class="friend-actions">
                    <button class="friend-accept-btn" data-username="${escapeHtml(reqUsername)}">✅</button>
                    <button class="friend-decline-btn" data-username="${escapeHtml(reqUsername)}">❌</button>
                </div>
            </div>`;
        }
        friendsRequestsList.innerHTML = reqHTML;

        friendsRequestsList.querySelectorAll(".friend-accept-btn").forEach(btn => {
            btn.addEventListener("click", () => acceptFriendRequest(btn.dataset.username));
        });
        friendsRequestsList.querySelectorAll(".friend-decline-btn").forEach(btn => {
            btn.addEventListener("click", () => declineFriendRequest(btn.dataset.username));
        });
    } else {
        friendsRequestsSection.style.display = "none";
        friendsRequestsList.innerHTML = "";
    }

    // 好友列表
    const friends = user.friends || [];
    if (friends.length > 0) {
        friendsEmptyEl.style.display = "none";
        let listHTML = "";
        for (const friendName of friends) {
            const friendUser = users[friendName];
            const avatar = friendUser ? (friendUser.avatar || "👤") : "👤";
            const nickname = friendUser ? (friendUser.nickname || friendName) : friendName;
            const isMutual = friendUser && (friendUser.friends || []).includes(currentUser.username);

            listHTML += `<div class="friend-item">
                <span class="friend-avatar">${avatar}</span>
                <div class="friend-info">
                    <span class="friend-name">${escapeHtml(nickname)}</span>
                    <span class="friend-username-hint">@${escapeHtml(friendName)}</span>
                </div>
                <span class="friend-status ${isMutual ? "mutual" : "oneway"}" title="${isMutual ? "互为好友" : "等待对方确认"}">
                    ${isMutual ? "🤝" : "📤"}
                </span>
                <button class="friend-challenge-btn" data-username="${escapeHtml(friendName)}" title="发起对战">⚔️</button>
                <button class="friend-remove-btn" data-username="${escapeHtml(friendName)}" title="删除好友">🗑️</button>
            </div>`;
        }
        friendsListEl.innerHTML = listHTML;

        friendsListEl.querySelectorAll(".friend-remove-btn").forEach(btn => {
            btn.addEventListener("click", () => removeFriend(btn.dataset.username));
        });
        friendsListEl.querySelectorAll(".friend-challenge-btn").forEach(btn => {
            btn.addEventListener("click", () => challengeFriend(btn.dataset.username));
        });
    } else {
        friendsEmptyEl.style.display = "";
        friendsListEl.innerHTML = "";
    }
}


// =========================
// 好友操作
// =========================

function sendFriendRequest() {
    const targetName = (friendsSearchInput.value || "").trim();
    friendsAddMsg.textContent = "";
    friendsAddMsg.className = "auth-msg";

    if (!targetName) {
        friendsAddMsg.textContent = "⚠ 请输入用户名";
        friendsAddMsg.className = "auth-msg error";
        return;
    }
    if (targetName === currentUser.username) {
        friendsAddMsg.textContent = "⚠ 不能添加自己为好友";
        friendsAddMsg.className = "auth-msg error";
        return;
    }

    const users = loadUsers();
    if (!users[targetName]) {
        friendsAddMsg.textContent = "⚠ 该用户不存在";
        friendsAddMsg.className = "auth-msg error";
        return;
    }

    const user = getFriendData();
    if (!user) return;

    if ((user.friends || []).includes(targetName)) {
        friendsAddMsg.textContent = "⚠ 你们已经是好友了";
        friendsAddMsg.className = "auth-msg error";
        return;
    }

    if ((user.friendRequestsSent || []).includes(targetName)) {
        friendsAddMsg.textContent = "⚠ 已发送过好友请求，等待对方确认";
        friendsAddMsg.className = "auth-msg error";
        return;
    }

    if (!user.friendRequestsSent) user.friendRequestsSent = [];
    user.friendRequestsSent.push(targetName);

    const target = users[targetName];
    if (!target.friendRequestsReceived) target.friendRequestsReceived = [];
    target.friendRequestsReceived.push(currentUser.username);

    saveUsers(users);

    friendsAddMsg.textContent = "✅ 好友请求已发送！";
    friendsAddMsg.className = "auth-msg success";
    friendsSearchInput.value = "";

    setTimeout(() => {
        friendsAddMsg.textContent = "";
        friendsAddMsg.className = "auth-msg";
    }, 2500);
}

function acceptFriendRequest(fromUsername) {
    const users = loadUsers();
    const user = users[currentUser.username];
    const fromUser = users[fromUsername];
    if (!user || !fromUser) return;

    user.friendRequestsReceived = (user.friendRequestsReceived || []).filter(n => n !== fromUsername);
    fromUser.friendRequestsSent = (fromUser.friendRequestsSent || []).filter(n => n !== currentUser.username);

    if (!user.friends) user.friends = [];
    if (!fromUser.friends) fromUser.friends = [];
    if (!user.friends.includes(fromUsername)) user.friends.push(fromUsername);
    if (!fromUser.friends.includes(currentUser.username)) fromUser.friends.push(currentUser.username);

    saveUsers(users);
    refreshFriendsUI();
}

function declineFriendRequest(fromUsername) {
    const users = loadUsers();
    const user = users[currentUser.username];
    const fromUser = users[fromUsername];
    if (!user || !fromUser) return;

    user.friendRequestsReceived = (user.friendRequestsReceived || []).filter(n => n !== fromUsername);
    fromUser.friendRequestsSent = (fromUser.friendRequestsSent || []).filter(n => n !== currentUser.username);

    saveUsers(users);
    refreshFriendsUI();
}

function removeFriend(friendName) {
    const users = loadUsers();
    const user = users[currentUser.username];
    const friendUser = users[friendName];
    if (!user) return;

    user.friends = (user.friends || []).filter(n => n !== friendName);
    if (friendUser && friendUser.friends) {
        friendUser.friends = friendUser.friends.filter(n => n !== currentUser.username);
    }

    saveUsers(users);
    refreshFriendsUI();
}

function challengeFriend(friendName) {
    if (!currentUser) {
        showToast("请先登录", "error");
        return;
    }

    if (!_wsConnected || !_wsConnected()) {
        showToast("正在连接服务器...", "info");
        if (_connectToServer && _getWsUrl) {
            _connectToServer(_getWsUrl());
        }
        const checkConnection = setInterval(() => {
            if (_wsConnected && _wsConnected()) {
                clearInterval(checkConnection);
                sendChallengeRequest(friendName);
            }
        }, 300);
        setTimeout(() => {
            clearInterval(checkConnection);
            if (!_wsConnected || !_wsConnected()) {
                showToast("无法连接到服务器，请检查服务器地址", "error");
            }
        }, 5000);
        return;
    }

    sendChallengeRequest(friendName);
}

function sendChallengeRequest(friendName) {
    const diff = DIFFICULTY[currentDifficulty] || DIFFICULTY.beginner;
    _sendMessage({
        type: "challenge_friend",
        from: currentUser.username,
        to: friendName,
        difficulty: { rows: diff.rows, cols: diff.cols, mines: diff.mines },
    });
}


// =========================
// 事件绑定
// =========================

if (friendsToggleBtn) {
    friendsToggleBtn.addEventListener("click", openFriendsPanel);
}
if (friendsCloseBtn) {
    friendsCloseBtn.addEventListener("click", closeFriendsPanel);
}
if (friendsOverlay) {
    friendsOverlay.addEventListener("click", closeFriendsPanel);
}
if (friendsAddBtn) {
    friendsAddBtn.addEventListener("click", sendFriendRequest);
}
if (friendsSearchInput) {
    friendsSearchInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") sendFriendRequest();
    });
}
