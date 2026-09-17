const loginBox = document.getElementById("adminLogin");
const dashboard = document.getElementById("dashboard");
const errorBox = document.getElementById("adminError");
const usersList = document.getElementById("usersList");
const details = document.getElementById("userDetails");
const searchInput = document.getElementById("userIdInput");
const selectedUserLabel = document.getElementById("selectedUserLabel");

let allUsers = [];
let selectedUserId = null;

async function api(url, options = {}) {
    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Erreur serveur.");
    return data;
}

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;",
        '"': "&quot;", "'": "&#039;"
    }[char]));
}

function formatBan(user) {
    if (!user.banned) return "";
    if (user.permanent) return "♾️ BANNI • permanent";
    return "🔴 BANNI • jusqu'au " + escapeHtml(user.expires_at || "date inconnue");
}

function updateStats() {
    document.getElementById("statUsers").textContent = allUsers.length;
}

async function loadAlerts() {
    try {
        const data = await api("/api/admin/alerts");
        const box = document.getElementById("alertsList");
        const alerts = data.alerts || [];
        document.getElementById("statAlerts").textContent =
            alerts.filter(alert => !alert.reviewed).length;

        if (!alerts.length) {
            box.innerHTML = `<div class="admin-empty"><div>✅</div><p>Aucune alerte pour le moment.</p></div>`;
            return;
        }

        box.innerHTML = alerts.map(alert => `
            <div class="admin-alert ${alert.reviewed ? "reviewed" : ""}">
                <div><strong>${alert.severity === "high" ? "🔴" : "🟠"} ${escapeHtml(alert.category)}</strong></div>
                <div><strong>ID utilisateur :</strong> ${escapeHtml(alert.user_id)}</div>
                <div><strong>Date :</strong> ${escapeHtml(alert.created_at)}</div>
                <div><strong>Message signalé :</strong> ${escapeHtml(alert.message_excerpt)}</div>
                ${alert.reviewed
                    ? `<small>✓ Alerte vérifiée</small>`
                    : `<button class="admin-small-button" onclick="reviewAlert(${Number(alert.id)})">Marquer comme vérifiée</button>`}
            </div>
        `).join("");
    } catch (error) {
        document.getElementById("alertsList").innerHTML =
            `<p class="admin-error">⚠️ ${escapeHtml(error.message)}</p>`;
    }
}

async function reviewAlert(id) {
    try {
        await api("/api/admin/alerts/" + id + "/review", {method: "POST"});
        await loadAlerts();
    } catch (error) {
        alert("Erreur : " + error.message);
    }
}

async function loadUsers() {
    try {
        const data = await api("/api/admin/users");
        allUsers = data.users || [];
        updateStats();
        renderUsers(allUsers);
    } catch (error) {
        usersList.innerHTML = `<p class="admin-error">⚠️ ${escapeHtml(error.message)}</p>`;
    }
}

function renderUsers(users) {
    usersList.innerHTML = "";
    document.getElementById("usersCount").textContent =
        users.length + " utilisateur" + (users.length > 1 ? "s" : "");

    if (!users.length) {
        usersList.innerHTML = `<div class="admin-empty"><div>🔎</div><p>Aucun utilisateur trouvé.</p></div>`;
        return;
    }

    users.forEach(user => {
        const button = document.createElement("button");
        button.className = "admin-user" + (user.banned ? " user-banned" : "");
        button.innerHTML = `
            <span class="user-main">
                <strong>${escapeHtml(user.username)}</strong>
                <small>${escapeHtml(user.public_id)}</small>
            </span>
            <span class="user-status ${user.banned ? "banned" : "active"}">
                ${user.banned ? "🔴 BANNI" : "🟢 ACTIF"}
            </span>
            <span class="user-arrow">›</span>
        `;
        button.onclick = () => loadUser(user.public_id);
        usersList.appendChild(button);
    });
}

function searchUsers() {
    const query = searchInput.value.trim().toLowerCase();
    if (!query) return renderUsers(allUsers);

    renderUsers(allUsers.filter(user =>
        String(user.username || "").toLowerCase().includes(query) ||
        String(user.public_id || "").toLowerCase().includes(query)
    ));
}

async function loadUser(id) {
    try {
        selectedUserId = id;
        selectedUserLabel.textContent = "Chargement...";
        const data = await api("/api/admin/user/" + encodeURIComponent(id));

        const grouped = {};
        (data.messages || []).forEach(message => {
            if (!grouped[message.session_id]) grouped[message.session_id] = [];
            grouped[message.session_id].push(message);
        });

        const messageCount = data.messages?.length || 0;
        const memoryCount = data.memories?.length || 0;
        const projectCount = data.projects?.length || 0;
        const ban = data.ban;

        selectedUserLabel.textContent =
            data.user.username + " • " + data.user.public_id;

        details.innerHTML = `
            <div class="admin-profile ${ban ? "profile-banned" : ""}">
                <div class="admin-profile-avatar">
                    ${escapeHtml(data.user.username.charAt(0).toUpperCase())}
                </div>
                <div class="profile-main">
                    <h3>${escapeHtml(data.user.username)}</h3>
                    <p>ID : ${escapeHtml(data.user.public_id)}</p>
                    <small>Créé le ${escapeHtml(data.user.created_at)}</small>
                    <div class="account-status ${ban ? "is-banned" : "is-active"}">
                        ${ban ? (ban.permanent ? "🔴 Banni définitivement" : "🔴 Banni temporairement") : "🟢 Compte actif"}
                    </div>
                </div>
            </div>

            <div class="moderation-card">
                <div>
                    <strong>${ban ? "🚫 Utilisateur banni" : "🛡️ Modération du compte"}</strong>
                    <small>${ban ? escapeHtml(ban.reason || "Aucune raison indiquée.") : "Gérer l'accès à Xyro.AI."}</small>
                    ${ban && !ban.permanent && ban.expires_at ? `<small>Fin : ${escapeHtml(ban.expires_at)}</small>` : ""}
                </div>
                ${ban
                    ? `<button class="unban-btn" onclick="unbanUser('${escapeHtml(data.user.public_id)}')">🔓 Débannir</button>`
                    : `<button class="ban-btn" onclick="openBanModal('${escapeHtml(data.user.public_id)}', '${escapeHtml(data.user.username)}')">🚫 Bannir</button>`}
            </div>

            <div class="admin-user-stats">
                <div><strong>${messageCount}</strong><small>Messages</small></div>
                <div><strong>${memoryCount}</strong><small>Mémoires</small></div>
                <div><strong>${projectCount}</strong><small>Projets</small></div>
            </div>

            <h3>💬 Conversations</h3>
            <div>
                ${Object.entries(grouped).map(([sessionId, messages], index) => `
                    <details class="admin-conversation">
                        <summary>Conversation ${index + 1}<small>${escapeHtml(sessionId)}</small></summary>
                        <div>
                            ${messages.map(message => `
                                <div class="admin-message ${message.role === "user" ? "from-user" : "from-bot"}">
                                    <strong>${message.role === "user" ? "Utilisateur" : "Xyro.AI"}</strong>
                                    <div>${escapeHtml(message.content)}</div>
                                    <small>${escapeHtml(message.created_at)}</small>
                                </div>
                            `).join("")}
                        </div>
                    </details>
                `).join("") || `<p>Aucune conversation.</p>`}
            </div>

            <h3>🧠 Mémoire</h3>
            <div>
                ${(data.memories || []).map(memory => `
                    <div class="admin-memory">
                        <strong>🧠 Souvenir</strong>
                        <p>${escapeHtml(memory.content)}</p>
                        <small>${escapeHtml(memory.created_at)}</small>
                    </div>
                `).join("") || `<p>Aucune mémoire.</p>`}
            </div>

            <h3>📁 Projets</h3>
            <div>
                ${(data.projects || []).map(project => `
                    <div class="admin-project">
                        <strong>📁 ${escapeHtml(project.name)}</strong>
                        <p>${escapeHtml(project.context || "Aucun contexte.")}</p>
                        <small>Mis à jour : ${escapeHtml(project.updated_at)}</small>
                    </div>
                `).join("") || `<p>Aucun projet.</p>`}
            </div>
        `;
    } catch (error) {
        selectedUserLabel.textContent = "Erreur";
        details.innerHTML = `<p class="admin-error">⚠️ ${escapeHtml(error.message)}</p>`;
    }
}

const banModal = document.getElementById("banModal");
const banTarget = document.getElementById("banTarget");
const banError = document.getElementById("banError");
const banDuration = document.getElementById("banDuration");
const banReason = document.getElementById("banReason");

function openBanModal(id, username) {
    selectedUserId = id;
    banTarget.textContent = username + " • " + id;
    banDuration.value = "1h";
    banReason.value = "";
    banError.textContent = "";
    banModal.classList.remove("hidden");
}

function closeBanModal() {
    banModal.classList.add("hidden");
}

async function confirmBan() {
    if (!selectedUserId) return;

    banError.textContent = "";
    try {
        await api("/api/admin/user/" + encodeURIComponent(selectedUserId) + "/ban", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                duration: banDuration.value,
                reason: banReason.value.trim()
            })
        });

        closeBanModal();
        await loadUsers();
        await loadUser(selectedUserId);
    } catch (error) {
        banError.textContent = "⚠️ " + error.message;
    }
}

async function unbanUser(id) {
    if (!confirm("Débannir cet utilisateur ?")) return;

    try {
        await api("/api/admin/user/" + encodeURIComponent(id) + "/unban", {
            method: "POST"
        });
        await loadUsers();
        await loadUser(id);
    } catch (error) {
        alert("Erreur : " + error.message);
    }
}

document.getElementById("adminLoginBtn").onclick = async () => {
    errorBox.textContent = "";
    try {
        await api("/api/admin/login", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                username: document.getElementById("adminUsername").value.trim(),
                password: document.getElementById("adminPassword").value
            })
        });
        loginBox.classList.add("hidden");
        dashboard.classList.remove("hidden");
        await loadUsers();
        await loadAlerts();
    } catch (error) {
        errorBox.textContent = "⚠️ " + error.message;
    }
};

document.getElementById("adminPassword").addEventListener("keydown", event => {
    if (event.key === "Enter") document.getElementById("adminLoginBtn").click();
});

document.getElementById("searchUser").onclick = searchUsers;
searchInput.addEventListener("keydown", event => {
    if (event.key === "Enter") searchUsers();
});

document.getElementById("clearSearch").onclick = () => {
    searchInput.value = "";
    renderUsers(allUsers);
};

document.getElementById("logoutAdmin").onclick = async () => {
    try {
        await api("/api/admin/logout", {method: "POST"});
    } finally {
        dashboard.classList.add("hidden");
        loginBox.classList.remove("hidden");
        selectedUserId = null;
        details.innerHTML = `<div class="admin-empty"><div>👤</div><p>Sélectionne un utilisateur.</p></div>`;
        selectedUserLabel.textContent = "Aucun utilisateur sélectionné.";
    }
};

document.getElementById("closeBanModal").onclick = closeBanModal;
document.getElementById("cancelBan").onclick = closeBanModal;
document.getElementById("confirmBan").onclick = confirmBan;

banModal.addEventListener("click", event => {
    if (event.target === banModal) closeBanModal();
});
