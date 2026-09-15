const input = document.getElementById("msg");
const send = document.getElementById("send");
const chat = document.querySelector(".chat");
const composer = document.querySelector(".composer");

const SESSION_KEY = "bournox_session_id";
let sessionId = localStorage.getItem(SESSION_KEY);

if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, sessionId);
}

async function chargerCompte() {
    const response = await fetch("/api/me");
    if (!response.ok) {
        window.location.href = "/login";
        return null;
    }
    return await response.json();
}

chargerCompte().then(data => {
    if (data?.user) {
        const avatar = document.querySelector(".avatar");
        if (avatar) avatar.textContent = data.user.username.slice(0, 2).toUpperCase();
    }
});

async function deconnexion() {
    await fetch("/api/logout", {method: "POST"});
    localStorage.removeItem(SESSION_KEY);
    window.location.href = "/login";
}

function ajouterMessageUser(message) {
    const el = document.createElement("div");
    el.className = "message user";
    el.textContent = message;
    chat.insertBefore(el, composer);
}

function ajouterMessageBot(message) {
    const el = document.createElement("div");
    el.className = "message bot";

    const title = document.createElement("div");
    title.className = "bot-title";
    title.innerHTML = `<span class="mini-bn">BN</span> BourNox.AI <i>● En ligne</i>`;

    const body = document.createElement("div");
    body.textContent = message;

    el.appendChild(title);
    el.appendChild(body);
    chat.insertBefore(el, composer);
}

function ajouterChargement() {
    const el = document.createElement("div");
    el.className = "message bot bournox-loading";
    el.innerHTML = `
        <div class="bot-title">
            <span class="mini-bn">BN</span>
            BourNox.AI <i>● réfléchit...</i>
        </div>
        🧠 Je réfléchis...
    `;
    chat.insertBefore(el, composer);
    return el;
}

async function envoyer(messageForce = null) {
    const message = messageForce || input.value.trim();

    if (!message || send.disabled) return;

    input.value = "";
    send.disabled = true;
    ajouterMessageUser(message);
    const loading = ajouterChargement();

    try {
        const response = await fetch("/chat", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({message, session_id: sessionId})
        });

        const data = await response.json().catch(() => ({}));
        loading.remove();

        if (response.status === 401) {
            window.location.href = "/login";
            return;
        }

        if (!response.ok) {
            ajouterMessageBot(data.response || "⚠️ Erreur du serveur.");
            return;
        }

        if (data.session_id) {
            sessionId = data.session_id;
            localStorage.setItem(SESSION_KEY, sessionId);
        }

        ajouterMessageBot(data.response || "Je n'ai pas reçu de réponse.");
    } catch (error) {
        loading.remove();
        ajouterMessageBot("⚠️ Impossible de contacter le cerveau BourNox.");
    } finally {
        send.disabled = false;
        input.focus();
    }
}

send.addEventListener("click", () => envoyer());

input.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        envoyer();
    }
});

function ouvrirCreateurImage() {
    const ancien = document.getElementById("image-creator");
    if (ancien) ancien.remove();

    const el = document.createElement("div");
    el.id = "image-creator";
    el.className = "message bot";
    el.innerHTML = `
        <div class="bot-title">
            <span class="mini-bn">BN</span> BourNox.AI
            <i>● Générateur d'image</i>
        </div>
        <div style="margin-top:10px;">🎨 <strong>Décris l'image que tu veux créer :</strong></div>
        <textarea id="image-prompt" placeholder="Exemple : un robot BN dans une ville futuriste..."></textarea>
        <div style="display:flex;gap:8px;margin-top:10px;">
            <button id="create-image-btn">🎨 Créer l'image</button>
            <button id="cancel-image-btn">Annuler</button>
        </div>
    `;

    chat.insertBefore(el, composer);

    const promptInput = document.getElementById("image-prompt");
    document.getElementById("create-image-btn").onclick = () => {
        const prompt = promptInput.value.trim();
        if (!prompt) return promptInput.focus();
        el.remove();
        genererImage(prompt);
    };
    document.getElementById("cancel-image-btn").onclick = () => el.remove();
    promptInput.focus();
}

async function genererImage(prompt) {
    ajouterMessageUser("🖼️ Crée cette image : " + prompt);
    const loading = ajouterChargement();

    try {
        const response = await fetch("/generate-image", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({prompt})
        });

        const data = await response.json().catch(() => ({}));
        loading.remove();

        if (!response.ok) {
            ajouterMessageBot("⚠️ " + (data.error || "Impossible de créer l'image."));
            return;
        }

        afficherImage(data.image);
    } catch {
        loading.remove();
        ajouterMessageBot("⚠️ La génération d'image a échoué.");
    }
}

function afficherImage(base64) {
    const el = document.createElement("div");
    el.className = "message bot";

    const title = document.createElement("div");
    title.className = "bot-title";
    title.innerHTML = `<span class="mini-bn">BN</span> BourNox.AI <i>● Image créée</i>`;

    const image = document.createElement("img");
    image.src = "data:image/png;base64," + base64;
    image.alt = "Image générée par BourNox.AI";
    image.style.maxWidth = "100%";
    image.style.borderRadius = "16px";
    image.style.marginTop = "10px";

    el.append(title, image);
    chat.insertBefore(el, composer);
}

document.querySelectorAll(".quick button").forEach(button => {
    button.addEventListener("click", () => {
        const text = button.textContent.toLowerCase();
        if (text.includes("devoirs")) envoyer("Aide-moi à faire mes devoirs.");
        else if (text.includes("internet")) envoyer("Utilise Internet pour répondre à ma demande.");
        else if (text.includes("image")) ouvrirCreateurImage();
    });
});

document.querySelectorAll(".sidebar nav button").forEach(button => {
    button.addEventListener("click", () => {
        document.querySelectorAll(".sidebar nav button").forEach(btn => btn.classList.remove("active"));
        button.classList.add("active");

        const text = button.textContent.toLowerCase();

        if (text.includes("accueil") || text.includes("chat")) input.focus();
        else if (text.includes("mémoire")) envoyer("Montre-moi ce que tu sais de ma mémoire.");
        else if (text.includes("outils")) ajouterMessageBot("🔧 Les outils BourNox arrivent bientôt.");
        else if (text.includes("internet")) envoyer("Utilise Internet pour répondre à ma demande.");
        else if (text.includes("voix")) ajouterMessageBot("🎙️ Le mode vocal BourNox arrive bientôt.");
        else if (text.includes("paramètres")) ajouterMessageBot("⚙️ Les paramètres BourNox arrivent bientôt.");
    });
});

document.querySelectorAll(".rightbar .grid button").forEach(button => {
    button.addEventListener("click", () => {
        const text = button.textContent.toLowerCase();
        if (text.includes("devoirs")) envoyer("Aide-moi avec mes devoirs.");
        else if (text.includes("internet")) envoyer("Utilise Internet pour répondre à ma demande.");
        else if (text.includes("images")) ouvrirCreateurImage();
        else if (text.includes("voix")) ajouterMessageBot("🎙️ Le mode vocal BourNox arrive bientôt.");
    });
});
