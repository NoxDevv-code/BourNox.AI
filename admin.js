const $ = id => document.getElementById(id);
const loginBox = $("adminLogin"), dashboard = $("dashboard"), errorBox = $("adminError");
const usersList = $("usersList"), details = $("userDetails");

async function api(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Erreur serveur");
  return data;
}
function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c])); }
function formatNumber(value) { return Number(value || 0).toLocaleString("fr-FR"); }
function formatBanDate(value) { if (!value) return "Permanent"; const d = new Date(value + "Z"); return Number.isNaN(d.getTime()) ? value : d.toLocaleString("fr-FR"); }
function setOnline(online) { const s = $("adminStatus"); s.className = "status " + (online ? "online" : "offline"); s.textContent = online ? "● Xyro en ligne" : "● Hors ligne"; }

async function loadStats() {
  const data = await api("/api/admin/stats");
  $("statUsers").textContent = formatNumber(data.users); $("statMessages").textContent = formatNumber(data.messages);
  $("statMemories").textContent = formatNumber(data.memories); $("statProjects").textContent = formatNumber(data.projects);
  $("statAlerts").textContent = formatNumber(data.open_alerts); setOnline(data.status === "online");
}

function userStatus(user) {
  if (user.banned) return `<span class="badge banned">🔴 BANNI${user.ban_expires_at ? " · jusqu'au " + escapeHtml(formatBanDate(user.ban_expires_at)) : " · À VIE"}</span>`;
  return `<span class="badge active">🟢 ACTIF</span>`;
}
function renderUsers(users) {
  usersList.innerHTML = "";
  if (!users.length) { usersList.innerHTML = `<div class="empty-state"><div>🔎</div><p>Aucun utilisateur trouvé.</p></div>`; return; }
  users.forEach(user => {
    const button = document.createElement("button"); button.className = "user-card" + (user.banned ? " is-banned" : "");
    button.innerHTML = `<div class="avatar">${escapeHtml(user.username.charAt(0).toUpperCase())}</div><div class="user-main"><strong>${escapeHtml(user.username)}</strong><span>${escapeHtml(user.public_id)}</span><small>Créé le ${escapeHtml(user.created_at)}</small>${userStatus(user)}</div><span class="arrow">›</span>`;
    button.onclick = () => loadUser(user.public_id); usersList.appendChild(button);
  });
}
async function loadUsers(query = "") {
  try { const data = query ? await api("/api/admin/search-users?q=" + encodeURIComponent(query)) : await api("/api/admin/users"); renderUsers(data.users || []); }
  catch (e) { usersList.innerHTML = `<p class="error">⚠️ ${escapeHtml(e.message)}</p>`; }
}
async function loadAlerts() {
  try {
    const data = await api("/api/admin/alerts"), box = $("alertsList");
    if (!data.alerts.length) { box.innerHTML = `<div class="empty-state"><div>✅</div><p>Aucune alerte pour le moment.</p></div>`; return; }
    box.innerHTML = data.alerts.map(a => `<article class="alert ${a.reviewed ? "reviewed" : ""}"><div class="alert-title"><strong>${a.severity === "high" ? "🔴" : "🟠"} ${escapeHtml(a.category)}</strong>${a.reviewed ? `<span class="reviewed-badge">✓ Vérifiée</span>` : ""}</div><div class="alert-meta">${escapeHtml(a.user_id)} · ${escapeHtml(a.created_at)}</div><p>${escapeHtml(a.message_excerpt)}</p>${a.reviewed ? "" : `<button class="small-btn" onclick="reviewAlert(${Number(a.id)})">Marquer comme vérifiée</button>`}</article>`).join("");
  } catch (e) { $("alertsList").innerHTML = `<p class="error">⚠️ ${escapeHtml(e.message)}</p>`; }
}
async function reviewAlert(id) { try { await api(`/api/admin/alerts/${id}/review`, {method:"POST"}); await Promise.all([loadAlerts(), loadStats()]); } catch(e) { alert("Erreur : " + e.message); } }

function banPanel(user) {
  if (user.is_admin) return `<div class="admin-note">🛡️ Compte administrateur. Ce compte ne peut pas être banni depuis cette console.</div>`;
  if (user.banned) return `<div class="ban-current"><strong>🔴 Compte actuellement banni</strong><span>${user.ban_expires_at ? "Fin : " + escapeHtml(formatBanDate(user.ban_expires_at)) : "Bannissement permanent"}</span>${user.ban_reason ? `<p>Raison : ${escapeHtml(user.ban_reason)}</p>` : ""}<button class="unban-btn" onclick="unbanUser('${escapeHtml(user.public_id)}')">Débannir ce compte</button></div>`;
  return `<div class="ban-box"><h4>🚫 Bannir ce compte</h4><div class="ban-row"><select id="banDuration"><option value="10m">10 minutes</option><option value="1h">1 heure</option><option value="1d">1 jour</option><option value="7d">7 jours</option><option value="30d">30 jours</option><option value="permanent">À vie</option></select><input id="banReason" maxlength="500" placeholder="Raison du bannissement (facultatif)"><button class="ban-btn" onclick="banUser('${escapeHtml(user.public_id)}')">Bannir</button></div></div>`;
}
async function loadUser(id) {
  try {
    $("selectedUserLabel").textContent = "Chargement...";
    const data = await api("/api/admin/user/" + encodeURIComponent(id)), user = data.user;
    $("selectedUserLabel").textContent = `${user.username} · ${user.public_id}`;
    const grouped = {}; (data.messages || []).forEach(m => { (grouped[m.session_id] ||= []).push(m); });
    details.innerHTML = `<div class="profile-summary"><div class="big-avatar">${escapeHtml(user.username.charAt(0).toUpperCase())}</div><div><h3>${escapeHtml(user.username)}</h3><p>${escapeHtml(user.public_id)}</p><small>Créé le ${escapeHtml(user.created_at)}</small><div>${userStatus(user)}</div></div></div>${banPanel(user)}<div class="mini-stats"><div><strong>${formatNumber(user.message_count)}</strong><span>Messages</span></div><div><strong>${formatNumber(user.memory_count)}</strong><span>Mémoires</span></div><div><strong>${formatNumber(user.project_count)}</strong><span>Projets</span></div></div><h3 class="section-title">💬 Conversations</h3><div class="conversations">${Object.entries(grouped).map(([sid,msgs],i)=>`<details class="conversation"><summary><strong>Conversation ${i+1}</strong><span>${escapeHtml(sid)}</span></summary><div class="messages">${msgs.map(m=>`<div class="admin-message ${m.role === "user" ? "from-user" : "from-bot"}"><b>${m.role === "user" ? "Utilisateur" : "Xyro.AI"}</b><div>${escapeHtml(m.content)}</div><small>${escapeHtml(m.created_at)}</small></div>`).join("")}</div></details>`).join("") || `<p class="muted">Aucune conversation.</p>`}</div><h3 class="section-title">🧠 Mémoire</h3><div class="memory-list">${(data.memories||[]).map(m=>`<div class="memory-item"><span>${escapeHtml(m.content)}</span><small>${escapeHtml(m.created_at)}</small></div>`).join("") || `<p class="muted">Aucune mémoire.</p>`}</div><h3 class="section-title">📁 Projets</h3><div class="project-list">${(data.projects||[]).map(p=>`<div class="project-item"><strong>${escapeHtml(p.name)}</strong><p>${escapeHtml(p.context||"Aucun contexte.")}</p><small>Mis à jour : ${escapeHtml(p.updated_at)}</small></div>`).join("") || `<p class="muted">Aucun projet.</p>`}</div>`;
  } catch(e) { $("selectedUserLabel").textContent = "Erreur"; details.innerHTML = `<p class="error">⚠️ ${escapeHtml(e.message)}</p>`; }
}
async function banUser(id) {
  const duration = $("banDuration")?.value, reason = $("banReason")?.value.trim() || ""; if (!duration) return;
  if (!confirm("Bannir ce compte ?")) return;
  try { await api(`/api/admin/user/${encodeURIComponent(id)}/ban`, {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({duration, reason})}); await Promise.all([loadUsers($("userSearchInput").value.trim()), loadStats()]); await loadUser(id); }
  catch(e) { alert("Erreur : " + e.message); }
}
async function unbanUser(id) {
  if (!confirm("Débannir ce compte ?")) return;
  try { await api(`/api/admin/user/${encodeURIComponent(id)}/unban`, {method:"POST"}); await Promise.all([loadUsers($("userSearchInput").value.trim()), loadStats()]); await loadUser(id); }
  catch(e) { alert("Erreur : " + e.message); }
}
window.reviewAlert = reviewAlert; window.banUser = banUser; window.unbanUser = unbanUser;
async function refreshAll() { await Promise.all([loadStats(), loadUsers($("userSearchInput").value.trim()), loadAlerts()]); }

$("adminLoginBtn").onclick = async () => { errorBox.textContent = ""; try { await api("/api/admin/login", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({username:$("adminUsername").value.trim(), password:$("adminPassword").value})}); loginBox.classList.add("hidden"); dashboard.classList.remove("hidden"); await refreshAll(); } catch(e) { errorBox.textContent = "⚠️ " + e.message; } };
$("adminPassword").addEventListener("keydown", e => { if(e.key === "Enter") $("adminLoginBtn").click(); });
$("searchUser").onclick = () => loadUsers($("userSearchInput").value.trim()); $("userSearchInput").addEventListener("keydown", e => { if(e.key === "Enter") $("searchUser").click(); });
$("refreshAll").onclick = refreshAll;
$("logoutAdmin").onclick = async () => { try { await api("/api/admin/logout", {method:"POST"}); } finally { dashboard.classList.add("hidden"); loginBox.classList.remove("hidden"); setOnline(false); } };
