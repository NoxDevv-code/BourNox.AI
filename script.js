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
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                message: message,
                session_id: sessionId,
                user_id: userId
            })
        });

        let data = {};

        try {
            data = await response.json();
        } catch {
            data = {};
        }

        loading.remove();

        if (!response.ok) {
            ajouterMessageBot(
                data.response || `Erreur du serveur (${response.status}).`
            );
            return;
        }

        if (data.session_id) {
            sessionId = data.session_id;
            localStorage.setItem(SESSION_KEY, sessionId);
        }

        ajouterMessageBot(
            data.response || "Je n'ai pas reçu de réponse."
        );

    } catch (error) {
        console.error("Erreur BourNox :", error);
        loading.remove();

        ajouterMessageBot(
            "⚠️ Impossible de contacter BourNox. Le serveur est peut-être en train de se réveiller."
        );

    } finally {
        send.disabled = false;
        input.focus();
    }
}


/* BOUTONS RAPIDES */

document.querySelectorAll(".quick button").forEach((button) => {
    button.addEventListener("click", () => {
        const texte = button.textContent.toLowerCase();

        if (texte.includes("devoirs")) {
            envoyer("Aide-moi à faire mes devoirs.");
        } 
        else if (texte.includes("internet")) {
            envoyer("Utilise Internet pour répondre à ma demande.");
        } 
        else if (texte.includes("image")) {
            envoyer("Je veux créer une image. Aide-moi à préparer le prompt.");
        }
    });
});


/* BOUTONS SIDEBAR */

document.querySelectorAll(".sidebar nav button").forEach((button) => {
    button.addEventListener("click", () => {

        document.querySelectorAll(".sidebar nav button")
            .forEach(btn => btn.classList.remove("active"));

        button.classList.add("active");

        const texte = button.textContent.toLowerCase();

        if (texte.includes("accueil") || texte.includes("chat")) {
            input.focus();
        }

        else if (texte.includes("mémoire")) {
            envoyer("Montre-moi ce que tu sais de ma mémoire.");
        }

        else if (texte.includes("outils")) {
            ajouterMessageBot("🔧 Les outils BourNox sont en développement.");
        }

        else if (texte.includes("internet")) {
            envoyer("Je veux utiliser Internet pour ma demande.");
        }

        else if (texte.includes("voix")) {
            ajouterMessageBot("🎙️ Le mode vocal BourNox arrive bientôt.");
        }

        else if (texte.includes("paramètres")) {
            ajouterMessageBot("⚙️ Les paramètres BourNox arrivent bientôt.");
        }
    });
});


/* RACCOURCIS DU PANNEAU DROIT */

document.querySelectorAll(".rightbar .grid button").forEach((button) => {
    button.addEventListener("click", () => {

        const texte = button.textContent.toLowerCase();

        if (texte.includes("devoirs")) {
            envoyer("Aide-moi avec mes devoirs.");
        }

        else if (texte.includes("internet")) {
            envoyer("Utilise Internet pour répondre à ma demande.");
        }

        else if (texte.includes("images")) {
            envoyer("Je veux créer une image. Aide-moi.");
        }

        else if (texte.includes("voix")) {
            ajouterMessageBot("🎙️ Le mode vocal BourNox arrive bientôt.");
        }
    });
});
