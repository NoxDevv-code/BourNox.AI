const input = document.getElementById("msg");
const send = document.getElementById("send");
const chat = document.querySelector(".chat");
const composer = document.querySelector(".composer");

const SESSION_KEY = "bournox_session_id";
const USER_KEY = "bournox_user_id";

let sessionId = localStorage.getItem(SESSION_KEY);
if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, sessionId);
}

let userId = localStorage.getItem(USER_KEY);
if (!userId) {
    userId = "local-user";
    localStorage.setItem(USER_KEY, userId);
}

send.addEventListener("click", envoyer);

input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        envoyer();
    }
});

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
    title.innerHTML = `
        <span class="mini-bn">BN</span>
        BourNox.AI <i>● En ligne</i>
    `;

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

async function envoyer() {
    const message = input.value.trim();
    if (!message) return;

    input.value = "";
    send.disabled = true;

    ajouterMessageUser(message);
    const loading = ajouterChargement();

    try {
        const response = await fetch("/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                message,
                session_id: sessionId,
                user_id: userId
            })
        });

        const data = await response.json();

        loading.remove();

        if (!response.ok) {
            ajouterMessageBot(data.response || "Erreur du serveur.");
            return;
        }

        if (data.session_id) {
            sessionId = data.session_id;
            localStorage.setItem(SESSION_KEY, sessionId);
        }

        ajouterMessageBot(data.response || "Je n'ai pas reçu de réponse.");
    } catch (error) {
        console.error(error);
        loading.remove();
        ajouterMessageBot("Impossible de contacter le cerveau BourNox. Vérifie que server.py tourne dans PowerShell.");
    } finally {
        send.disabled = false;
        input.focus();
    }
}
