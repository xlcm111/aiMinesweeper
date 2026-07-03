// =========================
// 用户认证 & 个人中心
// =========================

import { AVATAR_OPTIONS, SESSION_KEY } from "./config.js";
import { currentUser, setCurrentUser } from "./state.js";
import {
    loadUsers, saveUsers, findUserLocal,
    getSession, saveSession, clearSession,
    sha256, apiCall, isValidUsername, isValidPassword,
    avatarColor, calcLevel, createDefaultStats, escapeHtml,
    showToast,
} from "./utils.js";

// 需要从 multiplayer 导入（由 main.js 注入以避免循环依赖）
let _wsConnected = () => false;
let _sendMessage = null;
let _getWsUrl = null;
let _connectToServer = null;

export function injectMultiplayerDeps(deps) {
    _wsConnected = deps.wsConnected;
    _sendMessage = deps.sendMessage;
    _getWsUrl = deps.getWsUrl;
    _connectToServer = deps.connectToServer;
}


// =========================
// DOM 元素
// =========================

const userToggleBtn      = document.getElementById("user-toggle");
const authOverlay        = document.getElementById("auth-overlay");
const authPanel          = document.getElementById("auth-panel");
const authCloseBtn       = document.getElementById("auth-close");
const authCloseBtn2      = document.getElementById("auth-close2");
const authTitle          = document.getElementById("auth-title");

const authViewLogin      = document.getElementById("auth-view-login");
const authViewProfile    = document.getElementById("auth-view-profile");

const loginForm          = document.getElementById("login-form");
const loginUsername      = document.getElementById("login-username");
const loginPassword      = document.getElementById("login-password");
const loginRemember      = document.getElementById("login-remember");
const loginMsg           = document.getElementById("login-msg");

const registerForm       = document.getElementById("register-form");
const regUsername        = document.getElementById("reg-username");
const regPassword        = document.getElementById("reg-password");
const regPassword2       = document.getElementById("reg-password2");
const regMsg             = document.getElementById("reg-msg");

const profileUsername    = document.getElementById("profile-username");
const profileJoinDate    = document.getElementById("profile-join-date");
const statGames          = document.getElementById("stat-games");
const statWins           = document.getElementById("stat-wins");
const statLosses         = document.getElementById("stat-losses");
const statWinrate        = document.getElementById("stat-winrate");
const bestTimesEl        = document.getElementById("best-times");
const logoutBtn          = document.getElementById("logout-btn");
const switchAccountBtn   = document.getElementById("switch-account-btn");
const editProfileBtn     = document.getElementById("edit-profile-btn");

const editProfileOverlay = document.getElementById("edit-profile-overlay");
const editProfilePanel   = document.getElementById("edit-profile-panel");
const editProfileClose   = document.getElementById("edit-profile-close");
const editProfileCancel  = document.getElementById("edit-profile-cancel");
const editProfileSave    = document.getElementById("edit-profile-save");
const editProfileMsg     = document.getElementById("edit-profile-msg");
const profileNicknameInput = document.getElementById("profile-nickname-input");
const avatarPicker       = document.getElementById("avatar-picker");

const authTabs           = document.querySelectorAll(".auth-tab");


// =========================
// 面板开关
// =========================

export function openAuthPanel() {
    authOverlay.classList.add("open");
    authPanel.classList.add("open");
    userToggleBtn.style.opacity = "0";
    userToggleBtn.style.pointerEvents = "none";

    if (currentUser) {
        showProfileView();
    } else {
        showLoginView();
    }
}

export function closeAuthPanel() {
    authOverlay.classList.remove("open");
    authPanel.classList.remove("open");
    userToggleBtn.style.opacity = "";
    userToggleBtn.style.pointerEvents = "";
}

function showLoginView() {
    authViewLogin.style.display = "";
    authViewProfile.style.display = "none";
    switchAuthTab("login");
}

function showProfileView() {
    authViewLogin.style.display = "none";
    authViewProfile.style.display = "";
    updateProfileUI();
}


// =========================
// 选项卡切换
// =========================

function switchAuthTab(tab) {
    authTabs.forEach(t => t.classList.toggle("active", t.dataset.tab === tab));

    if (tab === "login") {
        loginForm.classList.add("active");
        registerForm.classList.remove("active");
        authTitle.textContent = "🔐 登 录";
    } else {
        loginForm.classList.remove("active");
        registerForm.classList.add("active");
        authTitle.textContent = "📝 注 册";
    }

    loginMsg.textContent = "";
    loginMsg.className = "auth-msg";
    regMsg.textContent = "";
    regMsg.className = "auth-msg";
}

authTabs.forEach(tab => {
    tab.addEventListener("click", () => {
        switchAuthTab(tab.dataset.tab);
    });
});


// =========================
// 注册
// =========================

async function handleRegister(e) {
    e.preventDefault();

    const username = regUsername.value.trim();
    const password = regPassword.value;
    const password2 = regPassword2.value;

    regMsg.textContent = "";
    regMsg.className = "auth-msg";

    if (!isValidUsername(username)) {
        regMsg.textContent = "⚠ 用户名需为4-20位字母/数字/下划线";
        regMsg.className = "auth-msg error";
        return;
    }
    if (!isValidPassword(password)) {
        regMsg.textContent = "⚠ 密码至少需要6位";
        regMsg.className = "auth-msg error";
        return;
    }
    if (password !== password2) {
        regMsg.textContent = "⚠ 两次输入的密码不一致";
        regMsg.className = "auth-msg error";
        return;
    }

    const submitBtn = registerForm.querySelector("button[type=submit]");
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "注册中..."; }

    regMsg.textContent = "⏳ 正在注册...";
    regMsg.className = "auth-msg";
    const result = await apiCall("/api/register", { username, password });

    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "注 册"; }

    if (result && result.ok) {
        regMsg.textContent = "✅ 注册成功！请切换到登录";
        regMsg.className = "auth-msg success";
        showToast("✅ 注册成功！请切换到登录页面", "success");
    } else if (result && !result.ok) {
        regMsg.textContent = "⚠ " + result.message;
        regMsg.className = "auth-msg error";
        showToast(result.message, "error");

        if (result.message && result.message.includes("已被注册")) {
            setTimeout(() => {
                switchAuthTab("login");
                loginUsername.value = username;
                loginMsg.textContent = "💡 该账号已存在，请直接登录";
                loginMsg.className = "auth-msg success";
            }, 1500);
        }
        return;
    } else {
        // ======= 本地离线注册校验 =======
        const users = loadUsers();
        const normalizedKey = username.toLowerCase();
        const existingEntry = Object.entries(users).find(
            ([key]) => key.toLowerCase() === normalizedKey
        );
        
        if (existingEntry) {
            const existingName = existingEntry[0];
            regMsg.textContent = `⚠ 该用户名已被注册（已存在：${existingName}），请直接登录`;
            regMsg.className = "auth-msg error";
            showToast("该账号已存在，请切换到登录页面", "error");
            
            if (submitBtn) submitBtn.disabled = false; // 记得恢复按钮状态

            setTimeout(() => {
                switchAuthTab("login");
                loginUsername.value = username;
                loginMsg.textContent = "💡 该账号已存在，请直接登录";
                loginMsg.className = "auth-msg success";
            }, 1500);
            
            return; // 【核心修复】：必须加 return 强制终止函数！绝对不允许往下覆盖原有用户数据！
        }

        const passwordHash = await sha256(password);
        if (passwordHash === null) {
            regMsg.textContent = "⚠ 当前浏览器不支持安全加密，请使用 HTTPS 访问或连接服务器后重试";
            regMsg.className = "auth-msg error";
            if (submitBtn) submitBtn.disabled = false;
            return;
        }
        
        // 只有真正没被注册过的新账号，才能走到这一步
        users[username] = {
            passwordHash,
            createdAt: new Date().toISOString(),
            nickname: username,
            avatar: "👤",
            stats: createDefaultStats(),
            friends: [],
            friendRequestsSent: [],
            friendRequestsReceived: [],
        };
        saveUsers(users);

        regMsg.textContent = "✅ 注册成功（本地模式）！请切换到登录";
        regMsg.className = "auth-msg success";
        showToast("⚠ 已离线注册（仅本设备有效），单机模式完全可用", "error");
    }

    regUsername.value = "";
    regPassword.value = "";
    regPassword2.value = "";

    setTimeout(() => {
        switchAuthTab("login");
        loginUsername.value = username;
        loginMsg.textContent = "✅ 注册成功，请登录";
        loginMsg.className = "auth-msg success";
    }, 1000);
}

registerForm.addEventListener("submit", handleRegister);


// =========================
// 登录
// =========================

async function handleLogin(e) {
    e.preventDefault();

    const username = loginUsername.value.trim();
    const password = loginPassword.value;

    loginMsg.textContent = "";
    loginMsg.className = "auth-msg";

    if (!username || !password) {
        loginMsg.textContent = "⚠ 请输入用户名和密码";
        loginMsg.className = "auth-msg error";
        return;
    }

    const submitBtn = loginForm.querySelector("button[type=submit]");
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "登录中..."; }

    loginMsg.textContent = "⏳ 正在验证...";
    loginMsg.className = "auth-msg";
    const result = await apiCall("/api/login", { username, password });

    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "登 录"; }

    let finalUsername = username;

    if (result && result.ok) {
        loginMsg.textContent = "✅ 登录成功！";
        loginMsg.className = "auth-msg success";
        finalUsername = result.user.username;

        try {
            const passwordHash = await sha256(password);
            if (passwordHash) {
                const users = loadUsers();
                users[finalUsername] = {
                    passwordHash,
                    createdAt: result.user.createdAt,
                    nickname: result.user.nickname,
                    avatar: result.user.avatar,
                    stats: result.user.stats,
                    friends: result.user.friends || [],
                    friendRequestsSent: result.user.friendRequestsSent || [],
                    friendRequestsReceived: result.user.friendRequestsReceived || [],
                };
                saveUsers(users);
            }
        } catch (_) {
            console.warn("[handleLogin] 本地缓存同步失败，已跳过");
        }
    } else if (result && !result.ok) {
        loginMsg.textContent = "⚠ " + result.message;
        loginMsg.className = "auth-msg error";
        return;
    } else {
        const found = findUserLocal(username);

        if (!found) {
            loginMsg.textContent = "⚠ 用户不存在，请先注册";
            loginMsg.className = "auth-msg error";
            return;
        }

        finalUsername = found.key;
        const user = found.user;

        const passwordHash = await sha256(password);
        if (passwordHash === null) {
            loginMsg.textContent = "⚠ 当前浏览器不支持安全加密，请使用 HTTPS 访问或连接服务器后重试";
            loginMsg.className = "auth-msg error";
            return;
        }
        if (passwordHash !== user.passwordHash) {
            loginMsg.textContent = "⚠ 密码错误";
            loginMsg.className = "auth-msg error";
            return;
        }

        loginMsg.textContent = "✅ 登录成功！（本地模式）";
        loginMsg.className = "auth-msg success";
    }

    // 设置登录状态
    setCurrentUser({ username: finalUsername });

    if (loginRemember.checked) {
        saveSession(finalUsername);
        try { sessionStorage.removeItem(SESSION_KEY); } catch (_) { /* 忽略 */ }
    } else {
        clearSession();
        try {
            sessionStorage.setItem(SESSION_KEY, JSON.stringify({ username: finalUsername }));
        } catch (_) { /* 忽略 */ }
    }

    updateUserButtonState();

    // 通知服务器上线
    if (_wsConnected && _wsConnected()) {
        try {
            _sendMessage({ type: "set_username", username: finalUsername });
        } catch (_) {
            console.warn("[handleLogin] WebSocket 注册失败，已忽略");
        }
    }

    setTimeout(() => {
        closeAuthPanel();
        loginUsername.value = "";
        loginPassword.value = "";
        loginRemember.checked = false;
        loginMsg.textContent = "";
        loginMsg.className = "auth-msg";
    }, 600);
}

loginForm.addEventListener("submit", handleLogin);


// =========================
// 退出登录
// =========================

function handleLogout() {
    // ==========================================
    // 【核心修复】：退出登录时，如果 WebSocket 连着，强制通知后端清除房间/断开
    // ==========================================
    if (_wsConnected && _wsConnected()) {
        try {
            // 如果你的后端支持 leave_room 协议，可以先发一条指令
            _sendMessage({ type: "leave_room" }); 
        } catch (_) { /* 忽略 */ }
    }

    setCurrentUser(null);
    clearSession();
    try { sessionStorage.removeItem(SESSION_KEY); } catch (_) { /* 忽略 */ }

    updateUserButtonState();
    closeAuthPanel();
}

logoutBtn.addEventListener("click", handleLogout);


// =========================
// 切换账号
// =========================

export function switchAccount() {
    handleLogout();
    setTimeout(() => {
        openAuthPanel();
    }, 200);
}

if (switchAccountBtn) {
    switchAccountBtn.addEventListener("click", switchAccount);
}


// =========================
// 编辑资料
// =========================

if (editProfileBtn) {
    editProfileBtn.addEventListener("click", openEditProfileModal);
}
if (editProfileClose) {
    editProfileClose.addEventListener("click", closeEditProfileModal);
}
if (editProfileCancel) {
    editProfileCancel.addEventListener("click", closeEditProfileModal);
}
if (editProfileOverlay) {
    editProfileOverlay.addEventListener("click", closeEditProfileModal);
}
if (editProfileSave) {
    editProfileSave.addEventListener("click", saveProfile);
}


// =========================
// 更新按钮状态
// =========================

export function updateUserButtonState() {
    if (currentUser) {
        userToggleBtn.classList.add("logged-in");

        const users = loadUsers();
        const user = users[currentUser.username];
        const displayName = (user && user.nickname) ? user.nickname : currentUser.username;
        const avatar = (user && user.avatar) ? user.avatar : "👤";

        userToggleBtn.textContent = avatar;
        userToggleBtn.title = displayName;
    } else {
        userToggleBtn.classList.remove("logged-in");
        userToggleBtn.textContent = "👤";
        userToggleBtn.title = "用户";
    }
}


// =========================
// 更新个人中心 UI
// =========================

function updateProfileUI() {
    if (!currentUser) return;

    const users = loadUsers();
    const user = users[currentUser.username];
    if (!user) return;

    let needsSave = false;
    if (!user.avatar) { user.avatar = "👤"; needsSave = true; }
    if (!user.nickname) { user.nickname = currentUser.username; needsSave = true; }
    if (needsSave) saveUsers(users);

    const stats = user.stats;

    const avatarEl = document.getElementById("profile-avatar");
    const userAvatar = user.avatar || "👤";
    avatarEl.textContent = userAvatar;
    avatarEl.style.background = avatarColor(currentUser.username);

    const displayName = user.nickname || currentUser.username;
    profileUsername.textContent = displayName;
    const created = new Date(user.createdAt);
    profileJoinDate.textContent = `注册于 ${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, "0")}-${String(created.getDate()).padStart(2, "0")}`;

    if (profileNicknameInput) {
        profileNicknameInput.value = user.nickname || "";
    }
    if (avatarPicker) {
        renderAvatarPicker(userAvatar);
    }

    const lvl = calcLevel(stats.games);
    document.getElementById("profile-level").textContent = lvl.icon + " " + lvl.title;

    statGames.textContent = stats.games;
    statWins.textContent = stats.wins;
    statLosses.textContent = stats.losses;

    let winRate = 0;
    if (stats.games > 0) {
        winRate = Math.round((stats.wins / stats.games) * 100);
        statWinrate.textContent = winRate + "%";
    } else {
        statWinrate.textContent = "-";
    }
    document.getElementById("winrate-fill").style.width = winRate + "%";

    const totalSec = stats.totalSeconds || 0;
    const totalTimeEl = document.getElementById("total-time");
    if (totalSec > 0) {
        const h = Math.floor(totalSec / 3600);
        const m = Math.floor((totalSec % 3600) / 60);
        if (h > 0) {
            totalTimeEl.innerHTML = "⏱ 总游戏时长 <strong>" + h + "</strong> 小时 <strong>" + m + "</strong> 分钟";
        } else {
            totalTimeEl.innerHTML = "⏱ 总游戏时长 <strong>" + m + "</strong> 分钟";
        }
    } else {
        totalTimeEl.textContent = "";
    }

    const diffs = [
        { key: "beginner", label: "初级", icon: "🌱", medal: "🥇" },
        { key: "intermediate", label: "中级", icon: "⚡", medal: "🥈" },
        { key: "expert", label: "高级", icon: "💀", medal: "🥉" },
    ];

    let timesHTML = "";
    for (const d of diffs) {
        const best = stats.bestTimes ? stats.bestTimes[d.key] : null;
        if (best !== null && best !== undefined) {
            timesHTML += `<div class="best-time-row rank-${diffs.indexOf(d) + 1}">
                <span class="best-time-diff">
                    <span class="best-time-medal">${d.medal}</span>${d.icon} ${d.label}
                </span>
                <span class="best-time-value">${best} 秒</span>
            </div>`;
        } else {
            timesHTML += `<div class="best-time-row">
                <span class="best-time-diff">
                    <span class="best-time-medal">⬜</span>${d.icon} ${d.label}
                </span>
                <span class="best-time-none">暂无记录</span>
            </div>`;
        }
    }
    bestTimesEl.innerHTML = timesHTML;

    const history = stats.history || [];
    const historyEl = document.getElementById("game-history");
    const historyEmptyEl = document.getElementById("game-history-empty");

    if (history.length === 0) {
        historyEl.innerHTML = "";
        historyEl.style.display = "none";
        historyEmptyEl.style.display = "";
    } else {
        historyEmptyEl.style.display = "none";
        historyEl.style.display = "";

        let histHTML = "";
        const modeLabels = { classic: "🎮 经典", vs: "🤖 人机", multi: "👥 多人" };
        const diffLabels = { beginner: "初级", intermediate: "中级", expert: "高级", custom: "自定义" };

        for (const h of history.slice(0, 10)) {
            const resultIcon = h.result === "win" ? "🏆" : "💀";
            const modeLabel = modeLabels[h.mode] || h.mode;
            const diffLabel = diffLabels[h.difficulty] || h.difficulty;
            const date = new Date(h.date);
            const dateStr = `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

            histHTML += `<div class="history-item">
                <span class="history-result">${resultIcon}</span>
                <div class="history-info">
                    <div class="history-mode">${modeLabel} · ${diffLabel}</div>
                    <div class="history-detail">${dateStr} · ${h.result === "win" ? "胜利" : "失败"}</div>
                </div>
                <span class="history-time">${h.seconds}s</span>
            </div>`;
        }
        historyEl.innerHTML = histHTML;
    }
}


// =========================
// 头像选择器
// =========================

function renderAvatarPicker(selected) {
    if (!avatarPicker) return;
    let html = "";
    for (const emoji of AVATAR_OPTIONS) {
        const selClass = emoji === selected ? " selected" : "";
        html += `<button class="avatar-option${selClass}" data-avatar="${emoji}">${emoji}</button>`;
    }
    avatarPicker.innerHTML = html;

    avatarPicker.querySelectorAll(".avatar-option").forEach(btn => {
        btn.addEventListener("click", () => {
            avatarPicker.querySelectorAll(".avatar-option").forEach(b => b.classList.remove("selected"));
            btn.classList.add("selected");
        });
    });
}


// =========================
// 编辑资料弹窗
// =========================

async function saveProfile() {
    if (!currentUser) return;

    const nickname = (profileNicknameInput.value || "").trim();
    if (nickname && nickname.length > 12) {
        editProfileMsg.textContent = "⚠ 昵称最多12个字符";
        editProfileMsg.className = "auth-msg error";
        return;
    }

    let avatar = null;
    const selectedBtn = avatarPicker.querySelector(".avatar-option.selected");
    if (selectedBtn) {
        avatar = selectedBtn.dataset.avatar;
    }

    await apiCall("/api/save-profile", {
        username: currentUser.username,
        nickname: nickname || undefined,
        avatar: avatar || undefined,
    });

    const users = loadUsers();
    const user = users[currentUser.username];
    if (user) {
        if (nickname) user.nickname = nickname;
        if (avatar) user.avatar = avatar;
        if (!user.avatar) user.avatar = "👤";
        if (!user.nickname) user.nickname = currentUser.username;
        saveUsers(users);
    }

    updateProfileUI();
    updateUserButtonState();
    closeEditProfileModal();
}

function openEditProfileModal() {
    if (!currentUser) return;

    const users = loadUsers();
    const user = users[currentUser.username];
    if (!user) return;

    profileNicknameInput.value = user.nickname || "";
    renderAvatarPicker(user.avatar || "👤");

    editProfileMsg.textContent = "";
    editProfileMsg.className = "auth-msg";

    editProfileOverlay.classList.add("open");
    editProfilePanel.classList.add("open");
}

function closeEditProfileModal() {
    editProfileOverlay.classList.remove("open");
    editProfilePanel.classList.remove("open");
    editProfileMsg.textContent = "";
    editProfileMsg.className = "auth-msg";
}


// =========================
// 恢复会话
// =========================

export function restoreSession() {
    let session = getSession();

    if (!session) {
        try {
            session = JSON.parse(sessionStorage.getItem(SESSION_KEY));
        } catch (_) { /* 忽略 */ }
    }

    if (session && session.username) {
        const users = loadUsers();
        if (users[session.username]) {
            setCurrentUser(session);
        } else {
            setCurrentUser(null);
            clearSession();
            try { sessionStorage.removeItem(SESSION_KEY); } catch (_) { /* 忽略 */ }
        }
    }

    updateUserButtonState();
}


// =========================
// 用户面板事件绑定
// =========================

userToggleBtn.addEventListener("click", openAuthPanel);
authCloseBtn.addEventListener("click", closeAuthPanel);
authCloseBtn2.addEventListener("click", closeAuthPanel);
authOverlay.addEventListener("click", closeAuthPanel);
