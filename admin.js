const $ = (id) => document.getElementById(id);

const loginBox = $("adminLogin");
const dashboard = $("dashboard");
const errorBox = $("adminError");
const usersList = $("usersList");
const details = $("userDetails");

async function api(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Erreur serveur");
  return data;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#039;"
  }[char]));
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("fr-FR");
}

function setOnline(online) {
  const status = $("adminStatus");
  if (!status) return;
  status.className = "status " + (online ? "online" : "offline");
  status.textContent = online ? "● Xyro en ligne" : "● Hors ligne";
}

async function loadStats() {
  const data = await api("/api/admin/stats");
  $("statUsers").textContent = formatNumber(data.users);
  $("statMessages").textContent = formatNumber(data.messages);
  $("statMemories").textContent = formatNumber(data.memories);
  $("statProjects").textContent = formatNumber(data.projects);
  $("statAlerts").textContent = formatNumber(data.open_alerts);
  setOnline(data.status === "online");
}

function renderUsers(users) {
  usersList.innerHTML = "";

  if (!users.length) {
    usersList.innerHTML =
      `<div class="empty-state"><div>👥</div><p>Aucun compte enregistré.</p></div>`;
    return;
  }

  users.forEach(user => {
    const button = document.createElement("button");
    button.className = "user-card";
    button.innerHTML = `
      <div class="avatar">${escapeHtml((user.username || "?").charAt(0).toUpperCase())}</div>
      <div class="user-main">
        <strong>${escapeHtml(user.username)}</strong>
        <span>${escapeHtml(user.public_id)}</span>
        <small>Créé le ${escapeHtml(user.created_at || "inconnu")}</small>
      </div>
      <span class="arrow">›</span>
    `;
    button.addEventListener("click", () => loadUser(user.public_id));
    usersList.appendChild(button);
  });
}

async function loadUsers(query = "") {
  try {
    // Sans recherche, on récupère TOUS les comptes enregistrés.
    const endpoint = query
      ? "/api/admin/search-users?q=" + encodeURIComponent(query)
      : "/api/admin/users";

    const data = await api(endpoint);
    renderUsers(Array.isArray(data.users) ? data.users : []);
  } catch (error) {
    usersList.innerHTML =
      `<p class="error">⚠️ ${escapeHtml(error.message)}</p>`;
  }
}

async function loadAlerts() {
  try {
    const data = await api("/api/admin/alerts");
    const box = $("alertsList");

    if (!data.alerts.length) {
      box.innerHTML =
        `<div class="empty-state"><div>✅</div><p>Aucune alerte pour le moment.</p></div>`;
      return;
    }

    box.innerHTML = data.alerts.map(alert => `
      <div class="alert-card ${alert.reviewed ? "reviewed" : ""}">
        <strong>${escapeHtml(alert.category)}</strong>
        <span>${escapeHtml(alert.severity)}</span>
        <p>${escapeHtml(alert.message_excerpt)}</p>
        <small>${escapeHtml(alert.created_at)}</small>
        ${alert.reviewed ? "" :
          `<button onclick="reviewAlert(${Number(alert.id)})">Marquer comme vue</button>`}
      </div>
    `).join("");
  } catch (error) {
    $("alertsList").innerHTML =
      `<p class="error">⚠️ ${escapeHtml(error.message)}</p>`;
  }
}

async function reviewAlert(id) {
  try {
    await api(`/api/admin/alerts/${id}/review`, { method: "POST" });
    await loadAlerts();
    await loadStats();
  } catch (error) {
    alert(error.message);
  }
}

async function loadUser(publicId) {
  try {
    const data = await api("/api/admin/user/" + encodeURIComponent(publicId));
    const user = data.user;

    $("selectedUserLabel").textContent =
      `${user.username} • ${user.public_id}`;

    details.innerHTML = `
      <div class="profile-card">
        <h3>👤 ${escapeHtml(user.username)}</h3>
        <p><strong>ID :</strong> ${escapeHtml(user.public_id)}</p>
        <p><strong>Créé le :</strong> ${escapeHtml(user.created_at)}</p>
        <div class="admin-user-stats">
          <div><strong>${formatNumber(data.counts.messages)}</strong><small>Messages</small></div>
          <div><strong>${formatNumber(data.counts.memories)}</strong><small>Mémoires</small></div>
          <div><strong>${formatNumber(data.counts.projects)}</strong><small>Projets</small></div>
        </div>
      </div>

      <h3>💬 Conversations</h3>
      ${data.messages.length
        ? data.messages.map(m => `
          <div class="admin-message ${m.role === "user" ? "from-user" : "from-bot"}">
            <strong>${m.role === "user" ? "Utilisateur" : "Xyro"}</strong>
            <div>${escapeHtml(m.content)}</div>
            <small>${escapeHtml(m.created_at)}</small>
          </div>
        `).join("")
        : `<p class="muted">Aucun message.</p>`
      }

      <h3>🧠 Mémoires</h3>
      ${data.memories.length
        ? data.memories.map(m => `
          <div class="admin-memory">
            <p>${escapeHtml(m.content)}</p>
            <small>${escapeHtml(m.created_at)}</small>
          </div>
        `).join("")
        : `<p class="muted">Aucune mémoire.</p>`
      }

      <h3>📁 Projets</h3>
      ${data.projects.length
        ? data.projects.map(p => `
          <div class="admin-project">
            <strong>${escapeHtml(p.name)}</strong>
            <p>${escapeHtml(p.context)}</p>
            <small>Mis à jour : ${escapeHtml(p.updated_at)}</small>
          </div>
        `).join("")
        : `<p class="muted">Aucun projet.</p>`
      }
    `;
  } catch (error) {
    details.innerHTML =
      `<p class="error">⚠️ ${escapeHtml(error.message)}</p>`;
  }
}

async function refreshAll() {
  try {
    await Promise.all([
      loadStats(),
      loadUsers(""),
      loadAlerts()
    ]);
  } catch (error) {
    if (errorBox) errorBox.textContent = error.message;
  }
}

$("adminLoginBtn")?.addEventListener("click", async () => {
  try {
    errorBox.textContent = "";
    const data = await api("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: $("adminUsername").value,
        password: $("adminPassword").value
      })
    });

    loginBox.style.display = "none";
    dashboard.style.display = "block";
    await refreshAll();
  } catch (error) {
    errorBox.textContent = error.message;
  }
});

$("searchUser")?.addEventListener("click", () => {
  loadUsers($("userSearchInput").value.trim());
});

$("userSearchInput")?.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    loadUsers(event.target.value.trim());
  }
});

$("refreshAll")?.addEventListener("click", refreshAll);

$("logoutAdmin")?.addEventListener("click", async () => {
  await api("/api/admin/logout", { method: "POST" }).catch(() => {});
  location.reload();
});

window.reviewAlert = reviewAlert;

// Si la session admin est déjà active, charge immédiatement TOUS les comptes.
(async () => {
  try {
    const me = await api("/api/me");
    if (me && me.user && me.user.is_admin) {
      loginBox.style.display = "none";
      dashboard.style.display = "block";
      await refreshAll();
    }
  } catch (_) {
    // Le compte admin utilise sa propre session, donc on tente quand même le refresh.
    try {
      await refreshAll();
      loginBox.style.display = "none";
      dashboard.style.display = "block";
    } catch (_) {}
  }
})();
