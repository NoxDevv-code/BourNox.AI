const loginBox = document.getElementById("adminLogin");
const dashboard = document.getElementById("dashboard");
const errorBox = document.getElementById("adminError");
const usersList = document.getElementById("usersList");
const details = document.getElementById("userDetails");

async function api(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Erreur");
  return data;
}


async function loadAlerts() {
  try {
    const data = await api("/api/admin/alerts");
    const box = document.getElementById("alertsList");
    if (!data.alerts.length) {
      box.innerHTML = "<p>✅ Aucune alerte pour le moment.</p>";
      return;
    }
    box.innerHTML = data.alerts.map(alert => `
      <div class="admin-alert ${alert.reviewed ? "reviewed" : ""}">
        <div><strong>${alert.severity === "high" ? "🔴" : "🟠"} ${escapeHtml(alert.category)}</strong></div>
        <div><strong>ID utilisateur :</strong> ${escapeHtml(alert.user_id)}</div>
        <div><strong>Date :</strong> ${escapeHtml(alert.created_at)}</div>
        <div><strong>Message signalé :</strong> ${escapeHtml(alert.message_excerpt)}</div>
        ${alert.reviewed ? "<small>✓ Vérifiée</small>" : `<button onclick="reviewAlert(${alert.id})">Marquer comme vérifiée</button>`}
      </div>
    `).join("");
  } catch (error) {
    document.getElementById("alertsList").innerHTML = `<p class="admin-error">⚠️ ${escapeHtml(error.message)}</p>`;
  }
}

async function reviewAlert(id) {
  await api("/api/admin/alerts/" + id + "/review", {method: "POST"});
  loadAlerts();
}

async function loadUsers() {
  try {
    const data = await api("/api/admin/users");
    usersList.innerHTML = "";

    if (!data.users.length) {
      usersList.innerHTML = "<p>Aucun compte utilisateur.</p>";
      return;
    }

    data.users.forEach(user => {
      const button = document.createElement("button");
      button.className = "admin-user";
      button.innerHTML = `<strong>${escapeHtml(user.username)}</strong><small>${escapeHtml(user.public_id)}</small>`;
      button.onclick = () => loadUser(user.public_id);
      usersList.appendChild(button);
    });
  } catch (error) {
    errorBox.textContent = "⚠️ " + error.message;
  }
}

async function loadUser(id) {
  try {
    const data = await api("/api/admin/user/" + encodeURIComponent(id));
    const grouped = {};

    data.messages.forEach(msg => {
      if (!grouped[msg.session_id]) grouped[msg.session_id] = [];
      grouped[msg.session_id].push(msg);
    });

    details.innerHTML = `
      <div class="profile">
        <h3>👤 ${escapeHtml(data.user.username)}</h3>
        <p><strong>ID :</strong> ${escapeHtml(data.user.public_id)}</p>
        <p><strong>Créé le :</strong> ${escapeHtml(data.user.created_at)}</p>
      </div>

      <h3>💬 Conversations</h3>
      ${Object.entries(grouped).map(([sessionId, messages], index) => `
        <div class="conversation">
          <strong>Conversation ${index + 1}</strong>
          <small>${escapeHtml(sessionId)}</small>
          ${messages.map(m => `
            <div class="admin-message ${m.role === "user" ? "from-user" : "from-bot"}">
              <b>${m.role === "user" ? "Utilisateur" : "BourNox.AI"}</b>
              <div>${escapeHtml(m.content)}</div>
              <small>${escapeHtml(m.created_at)}</small>
            </div>
          `).join("")}
        </div>
      `).join("") || "<p>Aucune conversation.</p>"}

      <h3>🧠 Mémoire</h3>
      ${data.memories.map(m => `
        <div class="memory-item">${escapeHtml(m.content)}<small>${escapeHtml(m.created_at)}</small></div>
      `).join("") || "<p>Aucune mémoire.</p>"}
    `;
  } catch (error) {
    details.innerHTML = `<p class="admin-error">⚠️ ${escapeHtml(error.message)}</p>`;
  }
}

document.getElementById("adminLoginBtn").onclick = async () => {
  errorBox.textContent = "";

  try {
    await api("/api/admin/login", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        username: document.getElementById("adminUsername").value,
        password: document.getElementById("adminPassword").value
      })
    });

    loginBox.classList.add("hidden");
    dashboard.classList.remove("hidden");
    loadUsers();
    loadAlerts();
  } catch (error) {
    errorBox.textContent = "⚠️ " + error.message;
  }
};

document.getElementById("searchUser").onclick = () => {
  const id = document.getElementById("userIdInput").value.trim();
  if (id) loadUser(id);
};

document.getElementById("logoutAdmin").onclick = async () => {
  await api("/api/admin/logout", {method: "POST"});
  dashboard.classList.add("hidden");
  loginBox.classList.remove("hidden");
};

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}
