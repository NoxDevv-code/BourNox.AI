const $ = id => document.getElementById(id);
let selectedPublicId = null;

async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Erreur serveur.");
  return data;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
}
function formatNumber(v){return Number(v||0).toLocaleString("fr-FR")}
function toast(message){
  const t=$("toast"); if(!t)return;
  t.textContent=message;t.classList.add("show");
  clearTimeout(window.__toast);window.__toast=setTimeout(()=>t.classList.remove("show"),2600);
}
function setOnline(online){
  const s=$("adminStatus");if(!s)return;
  s.className="status "+(online?"online":"offline");
  s.textContent=online?"● Xyro en ligne":"● Hors ligne";
}
function showDashboard(identity=""){
  $("adminLogin")?.classList.add("hidden");
  $("dashboard")?.classList.remove("hidden");
  if($("adminIdentity")) $("adminIdentity").textContent=identity?`Connecté : ${identity}`:"";
}

async function loadStats(){
  const d=await api("/api/admin/stats");
  ["Users","Messages","Memories","Projects"].forEach((name,i)=>{
    const ids=["statUsers","statMessages","statMemories","statProjects"];
    if($(ids[i])) $(ids[i]).textContent=formatNumber(d[name.toLowerCase()]);
  });
  if($("statAlerts")) $("statAlerts").textContent=formatNumber(d.open_alerts);
  setOnline(d.status==="online");
}

function renderUsers(users){
  const box=$("usersList");if(!box)return;
  if(!users.length){box.innerHTML='<div class="empty-state"><div>👥</div><p>Aucun compte enregistré.</p></div>';return;}
  box.innerHTML=users.map(u=>{
    const banned=Number(u.banned)===1;
    return `<button class="user-card ${selectedPublicId===u.public_id?"selected":""}" data-id="${escapeHtml(u.public_id)}">
      <div class="avatar">${escapeHtml((u.username||"?").charAt(0).toUpperCase())}</div>
      <div class="user-main">
        <strong>${escapeHtml(u.username)}</strong>
        <span>${escapeHtml(u.public_id)}</span>
        <small>${escapeHtml(u.created_at||"Date inconnue")}</small>
      </div>
      <span class="badge ${banned?"banned":"ok"}">${banned?"BANNI":"ACTIF"}</span>
    </button>`;
  }).join("");
  box.querySelectorAll(".user-card").forEach(b=>b.addEventListener("click",()=>loadUser(b.dataset.id)));
}

async function loadUsers(query=""){
  try{
    const endpoint=query?"/api/admin/search-users?q="+encodeURIComponent(query):"/api/admin/users";
    const d=await api(endpoint);
    renderUsers(Array.isArray(d.users)?d.users:[]);
  }catch(e){$("usersList").innerHTML=`<p class="error">⚠️ ${escapeHtml(e.message)}</p>`}
}

async function loadAlerts(){
  const box=$("alertsList");if(!box)return;
  try{
    const d=await api("/api/admin/alerts"), alerts=Array.isArray(d.alerts)?d.alerts:[];
    if(!alerts.length){box.innerHTML='<div class="empty-state"><div>✅</div><p>Aucune alerte.</p></div>';return;}
    box.innerHTML=alerts.map(a=>`<div class="alert-card ${a.reviewed?"reviewed":""}">
      <div class="alert-head"><strong>${escapeHtml(a.category)}</strong><span class="badge ${a.reviewed?"ok":"banned"}">${escapeHtml(a.severity)}</span></div>
      <p>${escapeHtml(a.message_excerpt)}</p>
      <small>${escapeHtml(a.created_at)} • ID ${escapeHtml(a.user_id||"")}</small>
      ${a.reviewed?"":`<div class="ban-actions"><button class="small-btn" onclick="reviewAlert(${Number(a.id)})">✓ Marquer comme vue</button></div>`}
    </div>`).join("");
  }catch(e){box.innerHTML=`<p class="error">⚠️ ${escapeHtml(e.message)}</p>`}
}
async function reviewAlert(id){
  try{await api(`/api/admin/alerts/${encodeURIComponent(id)}/review`,{method:"POST"});await loadAlerts();await loadStats();toast("Alerte marquée comme vue.");}
  catch(e){toast(e.message)}
}

function banPanel(user){
  const banned=Number(user.banned)===1;
  const expires=user.ban_expires_at?escapeHtml(user.ban_expires_at):"Définitif";
  return `<div class="ban-box">
    <h4>${banned?"🔴 Compte actuellement banni":"🛡️ Gestion du bannissement"}</h4>
    ${banned?`<p class="muted">Expiration : <strong>${expires}</strong></p><p class="muted">Raison : ${escapeHtml(user.ban_reason||"Aucune")}</p>
      <div class="ban-actions"><button class="success-btn" onclick="unbanUser('${escapeHtml(user.public_id)}')">Débannir</button></div>`
    :`<div class="ban-row">
        <select id="banDuration">
          <option value="10m">10 minutes</option><option value="1h">1 heure</option>
          <option value="6h">6 heures</option><option value="24h">24 heures</option>
          <option value="7d">7 jours</option><option value="30d">30 jours</option>
          <option value="permanent">Définitif</option>
        </select>
        <input id="banReason" maxlength="500" placeholder="Raison du bannissement">
      </div>
      <div class="ban-actions"><button class="danger-btn" onclick="banUser('${escapeHtml(user.public_id)}')">🚫 Bannir le compte</button></div>`}
  </div>`;
}

async function loadUser(publicId){
  selectedPublicId=publicId;
  try{
    const d=await api("/api/admin/user/"+encodeURIComponent(publicId));
    const u=d.user||{};
    const messages=Array.isArray(d.messages)?d.messages:[];
    const memories=Array.isArray(d.memories)?d.memories:[];
    const projects=Array.isArray(d.projects)?d.projects:[];
    $("selectedUserLabel").textContent=`${u.username} • ${u.public_id}`;

    $("userDetails").innerHTML=`
      <div class="profile-card">
        <h3>👤 ${escapeHtml(u.username)}</h3>
        <p><strong>ID Xyro :</strong> ${escapeHtml(u.public_id)}</p>
        <p><strong>Créé le :</strong> ${escapeHtml(u.created_at)}</p>
        <p><strong>Statut :</strong> <span class="badge ${Number(u.banned)===1?"banned":"ok"}">${Number(u.banned)===1?"BANNI":"ACTIF"}</span></p>
        <div class="admin-user-stats">
          <div><strong>${formatNumber(u.message_count)}</strong><small>Messages</small></div>
          <div><strong>${formatNumber(u.memory_count)}</strong><small>Mémoires</small></div>
          <div><strong>${formatNumber(u.project_count)}</strong><small>Projets</small></div>
        </div>
        ${Number(u.is_admin)===1?'<p class="muted">👑 Compte administrateur. Les actions de bannissement sont bloquées.</p>':banPanel(u)}
      </div>

      <h3>💬 Conversations</h3>
      ${messages.length?messages.map(m=>`<div class="admin-message ${m.role==="user"?"from-user":"from-bot"}">
        <strong>${m.role==="user"?"Utilisateur":"Xyro.AI"}</strong>
        <div>${escapeHtml(m.content)}</div><small>${escapeHtml(m.created_at)}</small>
      </div>`).join(""):'<p class="muted">Aucun message.</p>'}

      <h3>🧠 Mémoires</h3>
      ${memories.length?memories.map(m=>`<div class="admin-memory"><p>${escapeHtml(m.content)}</p><small>${escapeHtml(m.created_at)}</small></div>`).join(""):'<p class="muted">Aucune mémoire.</p>'}

      <h3>📁 Projets</h3>
      ${projects.length?projects.map(p=>`<div class="admin-project"><strong>${escapeHtml(p.name)}</strong><p>${escapeHtml(p.context)}</p><small>Mis à jour : ${escapeHtml(p.updated_at)}</small></div>`).join(""):'<p class="muted">Aucun projet.</p>'}
    `;
    await loadUsers($("userSearchInput")?.value.trim()||"");
  }catch(e){
    $("userDetails").innerHTML=`<p class="error">⚠️ ${escapeHtml(e.message)}</p>`;
  }
}

async function banUser(publicId){
  const duration=$("banDuration")?.value||"1h";
  const reason=$("banReason")?.value.trim()||"Aucune raison indiquée.";
  if(!confirm(`Bannir ce compte pour ${duration==="permanent"?"toujours":duration} ?`))return;
  try{
    await api("/api/admin/user/"+encodeURIComponent(publicId)+"/ban",{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({duration,reason})
    });
    toast("Compte banni.");
    await loadUser(publicId);await loadStats();
  }catch(e){toast(e.message)}
}
async function unbanUser(publicId){
  if(!confirm("Retirer le bannissement de ce compte ?"))return;
  try{
    await api("/api/admin/user/"+encodeURIComponent(publicId)+"/unban",{method:"POST"});
    toast("Compte débanni.");
    await loadUser(publicId);await loadStats();
  }catch(e){toast(e.message)}
}
window.reviewAlert=reviewAlert;window.banUser=banUser;window.unbanUser=unbanUser;

async function refreshAll(){
  try{await Promise.all([loadStats(),loadUsers(""),loadAlerts()]);}
  catch(e){$("adminError").textContent=e.message}
}

async function restoreSession(){
  try{
    const me=await api("/api/me");
    if(me?.user?.is_admin){
      showDashboard(me.user.username||"Admin");
      await refreshAll();
      return true;
    }
  }catch(_){}
  try{
    const me=await api("/api/admin/me");
    if(me?.authenticated){
      showDashboard(me.user?.username||"Admin");
      await refreshAll();
      return true;
    }
  }catch(_){}
  return false;
}

$("adminLoginBtn")?.addEventListener("click",async()=>{
  const error=$("adminError");error.textContent="";
  try{
    const username=$("adminUsername").value.trim();
    const password=$("adminPassword").value;
    if(!username||!password)throw new Error("Entre ton identifiant et ton mot de passe.");
    const d=await api("/api/admin/login",{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({username,password})
    });
    showDashboard(d.user?.username||username);
    await refreshAll();
  }catch(e){error.textContent=e.message}
});
$("adminPassword")?.addEventListener("keydown",e=>{if(e.key==="Enter")$("adminLoginBtn")?.click()});
$("searchUser")?.addEventListener("click",()=>loadUsers($("userSearchInput").value.trim()));
$("userSearchInput")?.addEventListener("keydown",e=>{if(e.key==="Enter")loadUsers(e.target.value.trim())});
$("refreshAll")?.addEventListener("click",refreshAll);
$("logoutAdmin")?.addEventListener("click",async()=>{
  await api("/api/admin/logout",{method:"POST"}).catch(()=>{});
  location.reload();
});
restoreSession();
