const input = document.getElementById("msg");
const send = document.getElementById("send");
const chat = document.querySelector(".chat");
const composer = document.querySelector(".composer");

const SESSION_KEY = "bournox_session_id";
const USER_KEY = "bournox_user_id";


// =========================================================
// IDENTIFIANTS
// =========================================================

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


// =========================================================
// ENVOI NORMAL
// =========================================================

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

    chat.insertBefore(
        el,
        composer
    );
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

    chat.insertBefore(
        el,
        composer
    );
}


function ajouterChargement() {

    const el = document.createElement("div");

    el.className =
        "message bot bournox-loading";

    el.innerHTML = `
        <div class="bot-title">
            <span class="mini-bn">BN</span>
            BourNox.AI
            <i>● réfléchit...</i>
        </div>

        🧠 Je réfléchis...
    `;

    chat.insertBefore(
        el,
        composer
    );

    return el;
}


async function envoyer(messageForce = null) {

    const message =
        messageForce ||
        input.value.trim();

    if (!message || send.disabled) {
        return;
    }

    input.value = "";

    send.disabled = true;

    ajouterMessageUser(message);

    const loading =
        ajouterChargement();

    try {

        const response =
            await fetch(
                "/chat",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        message: message,
                        session_id: sessionId,
                        user_id: userId
                    })
                }
            );

        let data = {};

        try {
            data = await response.json();
        }

        catch {
            data = {};
        }

        loading.remove();

        if (!response.ok) {

            ajouterMessageBot(
                data.response ||
                `Erreur du serveur (${response.status}).`
            );

            return;
        }

        if (data.session_id) {

            sessionId =
                data.session_id;

            localStorage.setItem(
                SESSION_KEY,
                sessionId
            );
        }

        ajouterMessageBot(
            data.response ||
            "Je n'ai pas reçu de réponse."
        );

    }

    catch (error) {

        console.error(
            "Erreur BourNox :",
            error
        );

        loading.remove();

        ajouterMessageBot(
            "⚠️ Impossible de contacter le cerveau BourNox."
        );

    }

    finally {

        send.disabled = false;

        input.focus();
    }
}


// =========================================================
// GÉNÉRATION D'IMAGE
// =========================================================

async function genererImage(prompt) {

    if (!prompt) {

        ajouterMessageBot(
            "🎨 Décris-moi l'image que tu veux créer."
        );

        return;
    }

    ajouterMessageUser(
        "🖼️ Crée cette image : " + prompt
    );

    const loading =
        ajouterChargement();

    try {

        const response =
            await fetch(
                "/generate-image",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        prompt: prompt
                    })
                }
            );

        const data =
            await response.json();

        loading.remove();

        if (!response.ok) {

            ajouterMessageBot(
                "⚠️ " +
                (
                    data.error ||
                    "Impossible de créer l'image."
                )
            );

            return;
        }

        afficherImage(
            data.image
        );

    }

    catch (error) {

        console.error(
            "Erreur génération image :",
            error
        );

        loading.remove();

        ajouterMessageBot(
            "⚠️ La génération d'image a échoué."
        );
    }
}


function afficherImage(imageBase64) {

    const el =
        document.createElement(
            "div"
        );

    el.className =
        "message bot";

    const title =
        document.createElement(
            "div"
        );

    title.className =
        "bot-title";

    title.innerHTML = `
        <span class="mini-bn">BN</span>
        BourNox.AI
        <i>● Image créée</i>
    `;

    const image =
        document.createElement(
            "img"
        );

    image.src =
        "data:image/png;base64," +
        imageBase64;

    image.alt =
        "Image générée par BourNox.AI";

    image.style.maxWidth =
        "100%";

    image.style.borderRadius =
        "16px";

    image.style.marginTop =
        "10px";

    image.style.display =
        "block";

    el.appendChild(title);

    el.appendChild(image);

    chat.insertBefore(
        el,
        composer
    );
}


// =========================================================
// BOUTONS RAPIDES
// =========================================================

document
    .querySelectorAll(".quick button")
    .forEach((button) => {

        button.addEventListener(
            "click",
            () => {

                const texte =
                    button.textContent
                    .toLowerCase();

                if (
                    texte.includes(
                        "devoirs"
                    )
                ) {

                    envoyer(
                        "Aide-moi à faire mes devoirs."
                    );
                }

                else if (
                    texte.includes(
                        "internet"
                    )
                ) {

                    envoyer(
                        "Utilise Internet pour répondre à ma demande."
                    );
                }

                else if (
                    texte.includes(
                        "image"
                    )
                ) {

                    const prompt =
                        window.prompt(
                            "🎨 Décris l'image que tu veux créer :"
                        );

                    if (prompt) {

                        genererImage(
                            prompt
                        );
                    }
                }
            }
        );
    });


// =========================================================
// SIDEBAR
// =========================================================

document
    .querySelectorAll(
        ".sidebar nav button"
    )
    .forEach((button) => {

        button.addEventListener(
            "click",
            () => {

                document
                    .querySelectorAll(
                        ".sidebar nav button"
                    )
                    .forEach(
                        (btn) =>
                            btn.classList
                            .remove(
                                "active"
                            )
                    );

                button.classList.add(
                    "active"
                );

                const texte =
                    button.textContent
                    .toLowerCase();

                if (
                    texte.includes(
                        "accueil"
                    ) ||
                    texte.includes(
                        "chat"
                    )
                ) {

                    input.focus();
                }

                else if (
                    texte.includes(
                        "mémoire"
                    )
                ) {

                    envoyer(
                        "Montre-moi ce que tu sais de ma mémoire."
                    );
                }

                else if (
                    texte.includes(
                        "outils"
                    )
                ) {

                    ajouterMessageBot(
                        "🔧 Les outils BourNox arrivent bientôt."
                    );
                }

                else if (
                    texte.includes(
                        "internet"
                    )
                ) {

                    envoyer(
                        "Utilise Internet pour répondre à ma demande."
                    );
                }

                else if (
                    texte.includes(
                        "voix"
                    )
                ) {

                    ajouterMessageBot(
                        "🎙️ Le mode vocal BourNox arrive bientôt."
                    );
                }

                else if (
                    texte.includes(
                        "paramètres"
                    )
                ) {

                    ajouterMessageBot(
                        "⚙️ Les paramètres BourNox arrivent bientôt."
                    );
                }
            }
        );
    });


// =========================================================
// RACCOURCIS DU PANNEAU DROIT
// =========================================================

document
    .querySelectorAll(
        ".rightbar .grid button"
    )
    .forEach((button) => {

        button.addEventListener(
            "click",
            () => {

                const texte =
                    button.textContent
                    .toLowerCase();

                if (
                    texte.includes(
                        "devoirs"
                    )
                ) {

                    envoyer(
                        "Aide-moi avec mes devoirs."
                    );
                }

                else if (
                    texte.includes(
                        "internet"
                    )
                ) {

                    envoyer(
                        "Utilise Internet pour répondre à ma demande."
                    );
                }

                else if (
                    texte.includes(
                        "images"
                    )
                ) {

                    const prompt =
                        window.prompt(
                            "🎨 Décris l'image que tu veux créer :"
                        );

                    if (prompt) {

                        genererImage(
                            prompt
                        );
                    }
                }

                else if (
                    texte.includes(
                        "voix"
                    )
                ) {

                    ajouterMessageBot(
                        "🎙️ Le mode vocal BourNox arrive bientôt."
                    );
                }
            }
        );
    });
