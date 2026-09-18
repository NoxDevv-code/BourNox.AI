```javascript
const $ = (id) => document.getElementById(id);

const loginBox = $("adminLogin");
const dashboard = $("dashboard");
const errorBox = $("adminError");
const usersList = $("usersList");
const details = $("userDetails");

async function api(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Erreur serveur");
  }

  return data;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("fr-FR");
}

function setOnline(online) {
  const status = $("adminStatus");

  if (!status) return;

  status.className =
    "status " + (online ? "online" : "offline");

  status.textContent =
    online ? "● Xyro en ligne" : "● Hors ligne";
}

async function loadStats() {
  const data = await api("/api/admin/stats");

  if ($("statUsers")) {
    $("statUsers").textContent =
      formatNumber(data.users);
  }

  if ($("statMessages")) {
    $("statMessages").textContent =
      formatNumber(data.messages);
  }

  if ($("statMemories")) {
    $("statMemories").textContent =
      formatNumber(data.memories);
  }

  if ($("statProjects")) {
    $("statProjects").textContent =
      formatNumber(data.projects);
  }

  if ($("statAlerts")) {
    $("statAlerts").textContent =
      formatNumber(data.open_alerts);
  }

  setOnline(data.status === "online");
}

function renderUsers(users) {
  if (!usersList) return;

  usersList.innerHTML = "";

  if (!users.length) {
    usersList.innerHTML =
      `<div class="empty-state">
        <div>👥</div>
        <p>Aucun compte enregistré.</p>
      </div>`;

    return;
  }

  users.forEach(user => {
    const button = document.createElement("button");

    button.className = "user-card";

    button.innerHTML = `
      <div class="avatar">
        ${escapeHtml(
          (user.username || "?")
            .charAt(0)
            .toUpperCase()
        )}
      </div>

      <div class="user-main">
        <strong>
          ${escapeHtml(user.username)}
        </strong>

        <span>
          ${escapeHtml(user.public_id)}
        </span>

        <small>
          Créé le
          ${escapeHtml(
            user.created_at || "inconnu"
          )}
        </small>
      </div>

      <span class="arrow">›</span>
    `;

    button.addEventListener(
      "click",
      () => loadUser(user.public_id)
    );

    usersList.appendChild(button);
  });
}

async function loadUsers(query = "") {
  try {
    const endpoint = query
      ? "/api/admin/search-users?q=" +
        encodeURIComponent(query)
      : "/api/admin/users";

    const data = await api(endpoint);

    renderUsers(
      Array.isArray(data.users)
        ? data.users
        : []
    );

  } catch (error) {

    if (usersList) {
      usersList.innerHTML =
        `<p class="error">
          ⚠️ ${escapeHtml(error.message)}
        </p>`;
    }
  }
}

async function loadAlerts() {
  const box = $("alertsList");

  if (!box) return;

  try {
    const data =
      await api("/api/admin/alerts");

    const alerts =
      Array.isArray(data.alerts)
        ? data.alerts
        : [];

    if (!alerts.length) {
      box.innerHTML =
        `<div class="empty-state">
          <div>✅</div>
          <p>Aucune alerte pour le moment.</p>
        </div>`;

      return;
    }

    box.innerHTML = alerts.map(alert => `
      <div class="alert-card ${
        alert.reviewed ? "reviewed" : ""
      }">

        <strong>
          ${escapeHtml(alert.category)}
        </strong>

        <span>
          ${escapeHtml(alert.severity)}
        </span>

        <p>
          ${escapeHtml(
            alert.message_excerpt
          )}
        </p>

        <small>
          ${escapeHtml(alert.created_at)}
        </small>

        ${
          alert.reviewed
            ? ""
            : `
              <button
                type="button"
                onclick="reviewAlert(${Number(alert.id)})"
              >
                Marquer comme vue
              </button>
            `
        }

      </div>
    `).join("");

  } catch (error) {

    box.innerHTML =
      `<p class="error">
        ⚠️ ${escapeHtml(error.message)}
      </p>`;
  }
}

async function reviewAlert(id) {
  try {

    await api(
      `/api/admin/alerts/${encodeURIComponent(id)}/review`,
      {
        method: "POST"
      }
    );

    await loadAlerts();
    await loadStats();

  } catch (error) {
    alert(error.message);
  }
}

async function loadUser(publicId) {
  try {

    const data =
      await api(
        "/api/admin/user/" +
        encodeURIComponent(publicId)
      );

    const user = data.user;

    if (!user) {
      throw new Error(
        "Utilisateur introuvable."
      );
    }

    if ($("selectedUserLabel")) {
      $("selectedUserLabel").textContent =
        `${user.username} • ${user.public_id}`;
    }

    const counts =
      data.counts || {};

    const messages =
      Array.isArray(data.messages)
        ? data.messages
        : [];

    const memories =
      Array.isArray(data.memories)
        ? data.memories
        : [];

    const projects =
      Array.isArray(data.projects)
        ? data.projects
        : [];

    details.innerHTML = `
      <div class="profile-card">

        <h3>
          👤 ${escapeHtml(user.username)}
        </h3>

        <p>
          <strong>ID :</strong>
          ${escapeHtml(user.public_id)}
        </p>

        <p>
          <strong>Créé le :</strong>
          ${escapeHtml(user.created_at)}
        </p>

        <div class="admin-user-stats">

          <div>
            <strong>
              ${formatNumber(counts.messages)}
            </strong>
            <small>Messages</small>
          </div>

          <div>
            <strong>
              ${formatNumber(counts.memories)}
            </strong>
            <small>Mémoires</small>
          </div>

          <div>
            <strong>
              ${formatNumber(counts.projects)}
            </strong>
            <small>Projets</small>
          </div>

        </div>
      </div>

      <h3>💬 Conversations</h3>

      ${
        messages.length
          ? messages.map(m => `
              <div class="admin-message ${
                m.role === "user"
                  ? "from-user"
                  : "from-bot"
              }">

                <strong>
                  ${
                    m.role === "user"
                      ? "Utilisateur"
                      : "Xyro"
                  }
                </strong>

                <div>
                  ${escapeHtml(m.content)}
                </div>

                <small>
                  ${escapeHtml(m.created_at)}
                </small>

              </div>
            `).join("")
          : `<p class="muted">
               Aucun message.
             </p>`
      }

      <h3>🧠 Mémoires</h3>

      ${
        memories.length
          ? memories.map(m => `
              <div class="admin-memory">
                <p>
                  ${escapeHtml(m.content)}
                </p>

                <small>
                  ${escapeHtml(m.created_at)}
                </small>
              </div>
            `).join("")
          : `<p class="muted">
               Aucune mémoire.
             </p>`
      }

      <h3>📁 Projets</h3>

      ${
        projects.length
          ? projects.map(p => `
              <div class="admin-project">

                <strong>
                  ${escapeHtml(p.name)}
                </strong>

                <p>
                  ${escapeHtml(p.context)}
                </p>

                <small>
                  Mis à jour :
                  ${escapeHtml(p.updated_at)}
                </small>

              </div>
            `).join("")
          : `<p class="muted">
               Aucun projet.
             </p>`
      }
    `;

  } catch (error) {

    if (details) {
      details.innerHTML =
        `<p class="error">
          ⚠️ ${escapeHtml(error.message)}
        </p>`;
    }
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

    if (errorBox) {
      errorBox.textContent =
        error.message;
    }
  }
}


/* =========================
   CONNEXION ADMIN
========================= */

$("adminLoginBtn")?.addEventListener(
  "click",
  async () => {

    try {

      if (errorBox) {
        errorBox.textContent = "";
      }

      const username =
        $("adminUsername")?.value || "";

      const password =
        $("adminPassword")?.value || "";

      const data =
        await api(
          "/api/admin/login",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body: JSON.stringify({
              username,
              password
            })
          }
        );

      if (loginBox) {
        loginBox.style.display = "none";
      }

      if (dashboard) {
        dashboard.style.display = "block";
      }

      await refreshAll();

    } catch (error) {

      if (errorBox) {
        errorBox.textContent =
          error.message;
      }
    }
  }
);


/* =========================
   RECHERCHE
========================= */

$("searchUser")?.addEventListener(
  "click",
  () => {

    const input =
      $("userSearchInput");

    loadUsers(
      input
        ? input.value.trim()
        : ""
    );
  }
);

$("userSearchInput")?.addEventListener(
  "keydown",
  event => {

    if (event.key === "Enter") {
      loadUsers(
        event.target.value.trim()
      );
    }
  }
);


/* =========================
   REFRESH
========================= */

$("refreshAll")?.addEventListener(
  "click",
  refreshAll
);


/* =========================
   DECONNEXION
========================= */

$("logoutAdmin")?.addEventListener(
  "click",
  async () => {

    await api(
      "/api/admin/logout",
      {
        method: "POST"
      }
    ).catch(() => {});

    location.reload();
  }
);


/* =========================
   ALERTES
========================= */

window.reviewAlert =
  reviewAlert;


/* =========================
   SESSION ADMIN
========================= */

(async () => {

  try {

    const me =
      await api("/api/admin/me");

    if (
      me &&
      me.user &&
      me.user.is_admin
    ) {

      if (loginBox) {
        loginBox.style.display = "none";
      }

      if (dashboard) {
        dashboard.style.display = "block";
      }

      await refreshAll();
    }

  } catch (_) {

    /*
      On ne fait rien ici.
      La page de connexion reste affichée
      normalement jusqu'à la connexion admin.
    */

  }

})();
```