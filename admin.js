```javascript
const $ = (id) => document.getElementById(id);

const loginBox = $("adminLogin");
const dashboard = $("dashboard");
const errorBox = $("adminError");
const usersList = $("usersList");
const details = $("userDetails");

let selectedUserId = null;


/* =========================
   API
========================= */

async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...options
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.error || `Erreur serveur (${response.status})`
    );
  }

  return data;
}


/* =========================
   UTILITAIRES
========================= */

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


/* =========================
   STATISTIQUES
========================= */

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


/* =========================
   LISTE DES UTILISATEURS
========================= */

function renderUsers(users) {
  if (!usersList) return;

  usersList.innerHTML = "";

  if (!users.length) {
    usersList.innerHTML = `
      <div class="empty-state">
        <div>👥</div>
        <p>Aucun compte enregistré.</p>
      </div>
    `;
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
          ${escapeHtml(user.username || "Sans pseudo")}
        </strong>

        <span>
          ID : ${escapeHtml(user.public_id || "inconnu")}
        </span>

        <small>
          Créé le :
          ${escapeHtml(user.created_at || "inconnu")}
        </small>

        ${
          user.banned
            ? `<small class="ban-label">🚫 Banni</small>`
            : ""
        }
      </div>

      <span class="arrow">›</span>
    `;

    button.addEventListener("click", () => {
      loadUser(user.public_id);
    });

    usersList.appendChild(button);
  });
}

async function loadUsers(query = "") {
  if (!usersList) return;

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
    usersList.innerHTML = `
      <p class="error">
        ⚠️ ${escapeHtml(error.message)}
      </p>
    `;
  }
}


/* =========================
   FICHE UTILISATEUR
========================= */

async function loadUser(publicId) {
  if (!details) return;

  try {
    const data = await api(
      "/api/admin/user/" +
      encodeURIComponent(publicId)
    );

    const user = data.user;

    if (!user) {
      throw new Error("Utilisateur introuvable.");
    }

    selectedUserId = user.public_id;

    if ($("selectedUserLabel")) {
      $("selectedUserLabel").textContent =
        `${user.username} • ${user.public_id}`;
    }

    const counts = data.counts || {};

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

    const isBanned = Boolean(user.banned);

    details.innerHTML = `

      <!-- =========================
           INFORMATIONS DU COMPTE
      ========================== -->

      <div class="profile-card">

        <h3>
          👤 ${escapeHtml(
            user.username || "Sans pseudo"
          )}
        </h3>

        <p>
          <strong>Pseudo :</strong>
          ${escapeHtml(user.username || "inconnu")}
        </p>

        <p>
          <strong>ID :</strong>
          ${escapeHtml(user.public_id || "inconnu")}
        </p>

        <p>
          <strong>Créé le :</strong>
          ${escapeHtml(user.created_at || "inconnu")}
        </p>

        <p>
          <strong>Statut :</strong>

          ${
            isBanned
              ? `<span class="ban-label">
                   🚫 Banni
                 </span>`
              : `<span>
                   🟢 Actif
                 </span>`
          }
        </p>

        ${
          isBanned && user.banned_until
            ? `
              <p>
                <strong>Fin du ban :</strong>
                ${escapeHtml(user.banned_until)}
              </p>
            `
            : ""
        }

        ${
          isBanned && user.ban_reason
            ? `
              <p>
                <strong>Raison :</strong>
                ${escapeHtml(user.ban_reason)}
              </p>
            `
            : ""
        }

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


      <!-- =========================
           MODERATION
      ========================== -->

      <div class="admin-moderation-card">

        <h3>🛡️ Modération</h3>

        ${
          isBanned
            ? `
              <div class="ban-info">
                <strong>🚫 Cet utilisateur est banni.</strong>

                ${
                  user.banned_until
                    ? `
                      <p>
                        Ban jusqu'au :
                        ${escapeHtml(user.banned_until)}
                      </p>
                    `
                    : `
                      <p>
                        Ban permanent
                      </p>
                    `
                }
              </div>

              <button
                type="button"
                id="unbanUserBtn"
                class="admin-button"
              >
                ✅ Débannir
              </button>
            `
            : `
              <label for="banDuration">
                Durée du bannissement
              </label>

              <select id="banDuration">

                <option value="10m">
                  10 minutes
                </option>

                <option value="1h">
                  1 heure
                </option>

                <option value="6h">
                  6 heures
                </option>

                <option value="12h">
                  12 heures
                </option>

                <option value="1d">
                  1 jour
                </option>

                <option value="3d">
                  3 jours
                </option>

                <option value="7d">
                  7 jours
                </option>

                <option value="30d">
                  30 jours
                </option>

                <option value="permanent">
                  Permanent
                </option>

              </select>

              <label for="banReason">
                Raison
              </label>

              <textarea
                id="banReason"
                placeholder="Raison du bannissement..."
                maxlength="500"
              ></textarea>

              <button
                type="button"
                id="banUserBtn"
                class="admin-button danger"
              >
                🚫 Bannir l'utilisateur
              </button>
            `
        }

      </div>


      <!-- =========================
           CONVERSATIONS
      ========================== -->

      <h3>💬 Conversations</h3>

      ${
        messages.length
          ? messages.map(message => `
              <div class="admin-message ${
                message.role === "user"
                  ? "from-user"
                  : "from-bot"
              }">

                <strong>
                  ${
                    message.role === "user"
                      ? "Utilisateur"
                      : "Xyro"
                  }
                </strong>

                <div>
                  ${escapeHtml(message.content)}
                </div>

                <small>
                  ${escapeHtml(
                    message.created_at
                  )}
                </small>

              </div>
            `).join("")
          : `<p class="muted">Aucun message.</p>`
      }


      <!-- =========================
           MEMOIRES
      ========================== -->

      <h3>🧠 Mémoires</h3>

      ${
        memories.length
          ? memories.map(memory => `
              <div class="admin-memory">

                <p>
                  ${escapeHtml(memory.content)}
                </p>

                <small>
                  ${escapeHtml(
                    memory.created_at
                  )}
                </small>

              </div>
            `).join("")
          : `<p class="muted">Aucune mémoire.</p>`
      }


      <!-- =========================
           PROJETS
      ========================== -->

      <h3>📁 Projets</h3>

      ${
        projects.length
          ? projects.map(project => `
              <div class="admin-project">

                <strong>
                  ${escapeHtml(project.name)}
                </strong>

                <p>
                  ${escapeHtml(
                    project.context
                  )}
                </p>

                <small>
                  Mis à jour :
                  ${escapeHtml(
                    project.updated_at
                  )}
                </small>

              </div>
            `).join("")
          : `<p class="muted">Aucun projet.</p>`
      }
    `;


    /* =========================
       BOUTON BAN
    ========================== */

    $("banUserBtn")?.addEventListener(
      "click",
      async () => {

        const duration =
          $("banDuration")?.value;

        const reason =
          $("banReason")?.value.trim();

        if (!duration) {
          alert("Choisis une durée.");
          return;
        }

        const confirmation =
          confirm(
            `Bannir ${user.username} ?\n\n` +
            `Durée : ${duration}` +
            (reason
              ? `\nRaison : ${reason}`
              : "")
          );

        if (!confirmation) return;

        try {

          await api(
            "/api/admin/user/" +
            encodeURIComponent(
              user.public_id
            ) +
            "/ban",
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json"
              },

              body: JSON.stringify({
                duration,
                reason
              })
            }
          );

          await loadUser(
            user.public_id
          );

          await loadUsers(
            $("userSearchInput")
              ?.value
              ?.trim() || ""
          );

          await loadStats();

        } catch (error) {

          alert(
            "Impossible de bannir l'utilisateur :\n" +
            error.message
          );
        }
      }
    );


    /* =========================
       BOUTON DEBAN
    ========================== */

    $("unbanUserBtn")?.addEventListener(
      "click",
      async () => {

        const confirmation =
          confirm(
            `Débannir ${user.username} ?`
          );

        if (!confirmation) return;

        try {

          await api(
            "/api/admin/user/" +
            encodeURIComponent(
              user.public_id
            ) +
            "/unban",
            {
              method: "POST"
            }
          );

          await loadUser(
            user.public_id
          );

          await loadUsers(
            $("userSearchInput")
              ?.value
              ?.trim() || ""
          );

          await loadStats();

        } catch (error) {

          alert(
            "Impossible de débannir l'utilisateur :\n" +
            error.message
          );
        }
      }
    );

  } catch (error) {

    details.innerHTML = `
      <p class="error">
        ⚠️ ${escapeHtml(
          error.message
        )}
      </p>
    `;
  }
}


/* =========================
   ALERTES
========================= */

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

      box.innerHTML = `
        <div class="empty-state">
          <div>✅</div>
          <p>Aucune alerte pour le moment.</p>
        </div>
      `;

      return;
    }

    box.innerHTML =
      alerts.map(alert => `

        <div class="alert-card ${
          alert.reviewed
            ? "reviewed"
            : ""
        }">

          <strong>
            ${escapeHtml(
              alert.category
            )}
          </strong>

          <span>
            ${escapeHtml(
              alert.severity
            )}
          </span>

          <p>
            ${escapeHtml(
              alert.message_excerpt
            )}
          </p>

          <small>
            ${escapeHtml(
              alert.created_at
            )}
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

    box.innerHTML = `
      <p class="error">
        ⚠️ ${escapeHtml(
          error.message
        )}
      </p>
    `;
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

    await Promise.all([
      loadAlerts(),
      loadStats()
    ]);

  } catch (error) {

    alert(error.message);
  }
}


/* =========================
   REFRESH
========================= */

async function refreshAll() {

  const results =
    await Promise.allSettled([
      loadStats(),
      loadUsers(""),
      loadAlerts()
    ]);

  const failed =
    results.find(
      result =>
        result.status === "rejected"
    );

  if (failed && errorBox) {

    errorBox.textContent =
      failed.reason?.message ||
      "Erreur lors du chargement.";
  }
}


/* =========================
   AFFICHAGE
========================= */

function showDashboard() {

  if (loginBox) {
    loginBox.style.display = "none";
  }

  if (dashboard) {
    dashboard.style.display = "block";
  }
}

function showLogin() {

  if (loginBox) {
    loginBox.style.display = "";
  }

  if (dashboard) {
    dashboard.style.display = "none";
  }
}


/* =========================
   LOGIN
========================= */

$("adminLoginBtn")?.addEventListener(
  "click",
  async () => {

    try {

      if (errorBox) {
        errorBox.textContent = "";
      }

      const username =
        $("adminUsername")
          ?.value
          ?.trim() || "";

      const password =
        $("adminPassword")
          ?.value || "";

      if (!username || !password) {
        throw new Error(
          "Entre ton identifiant et ton mot de passe."
        );
      }

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

      showDashboard();

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
      input?.value?.trim() || ""
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
   AUTRES BOUTONS
========================= */

$("refreshAll")?.addEventListener(
  "click",
  refreshAll
);

$("logoutAdmin")?.addEventListener(
  "click",
  async () => {

    try {

      await api(
        "/api/admin/logout",
        {
          method: "POST"
        }
      );

    } catch (_) {}

    location.reload();
  }
);

window.reviewAlert = reviewAlert;


/* =========================
   SESSION ADMIN
========================= */

(async () => {

  try {

    const me =
      await api("/api/me");

    if (me?.user?.is_admin) {

      showDashboard();

      await refreshAll();

    } else {

      showLogin();
    }

  } catch (_) {

    showLogin();
  }

})();
```
