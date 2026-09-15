// ======================================================
// BourNox.AI V2
// Script principal
// ======================================================

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


// ======================================================
// COMPTE
// ======================================================

async function chargerCompte() {
    try {
        const response = await fetch("/api/me");

        if (!response.ok) {
            window.location.href = "/login";
            return null;
        }

        return await response.json();

    } catch (error) {
        console.error("Erreur compte :", error);
        return null;
    }
}


chargerCompte().then(data => {

    if (!data?.user) return;

    const avatar = document.querySelector(".avatar");

    if (avatar) {
        avatar.textContent = data.user.username
            .slice(0, 2)
            .toUpperCase();
    }
});


// ======================================================
// DÉCONNEXION
// ======================================================

async function deconnexion() {

    try {
        await fetch("/api/logout", {
            method: "POST"
        });
    } catch (error) {
        console.error("Erreur déconnexion :", error);
    }

    localStorage.removeItem(SESSION_KEY);

    window.location.href = "/login";
}


// ======================================================
// UTILITAIRES
// ======================================================

function escapeHTML(text) {

    const div = document.createElement("div");

    div.textContent = text;

    return div.innerHTML;
}


function scrollChat() {

    if (!chat) return;

    chat.scrollTop = chat.scrollHeight;
}


// ======================================================
// DÉTECTION DU LANGAGE
// ======================================================

function detecterLangage(code) {

    if (
        /\b(def|import|print|class|self|elif)\b/.test(code)
    ) {
        return "Python";
    }

    if (
        /\b(const|let|var|function|console\.log|document\.)\b/.test(code)
    ) {
        return "JavaScript";
    }

    if (
        /<!DOCTYPE html>|<html|<body|<div|<section|<header/i.test(code)
    ) {
        return "HTML";
    }

    if (
        /\b(color|background|margin|padding|display|font-size)\s*:/.test(code)
    ) {
        return "CSS";
    }

    if (
        /\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b/i.test(code)
    ) {
        return "SQL";
    }

    if (
        /\b(public|private|static|void|System\.out)\b/.test(code)
    ) {
        return "Java";
    }

    if (
        /#include\s*<|std::/.test(code)
    ) {
        return "C++";
    }

    return "Code";
}


// ======================================================
// COLORATION CODE
// ======================================================

function coloriserCode(code, langage) {

    let result = escapeHTML(code);

    // chaînes de caractères
    result = result.replace(
        /(["'`])(?:\\.|(?!\1).)*?\1/g,
        '<span class="code-value">$&</span>'
    );

    // mots-clés
    result = result.replace(
        /\b(def|class|import|from|return|if|else|elif|for|while|in|True|False|None|const|let|var|function|new|async|await|public|private|static|void|SELECT|FROM|WHERE|INSERT|UPDATE|DELETE)\b/g,
        '<span class="code-keyword">$1</span>'
    );

    // fonctions
    result = result.replace(
        /\b([a-zA-Z_$][\w$]*)\s*(?=\()/g,
        '<span class="code-function">$1</span>'
    );

    // HTML
    if (langage === "HTML") {

        result = result.replace(
            /(&lt;\/?)([\w-]+)/g,
            '$1<span class="code-tag">$2</span>'
        );
    }

    return result;
}


// ======================================================
// CRÉATION D'UN BLOC DE CODE
// ======================================================

function creerBlocCode(code, langage) {

    const wrapper = document.createElement("div");

    wrapper.className = "bournox-code";


    // HEADER
    const header = document.createElement("div");

    header.className = "code-header";


    const language = document.createElement("span");

    language.className = "code-language";

    language.textContent = langage;


    const actions = document.createElement("div");

    actions.className = "code-actions";


    // BOUTON COPIER
    const copyButton = document.createElement("button");

    copyButton.className = "code-action";

    copyButton.textContent = "📋 Copier";


    // BOUTON TÉLÉCHARGER
    const downloadButton = document.createElement("button");

    downloadButton.className = "code-action";

    downloadButton.textContent = "⬇️ Télécharger";


    actions.appendChild(copyButton);
    actions.appendChild(downloadButton);

    header.appendChild(language);
    header.appendChild(actions);


    // CONTENU
    const codeWrapper = document.createElement("div");

    codeWrapper.className = "code-wrapper";


    const lineNumbers = document.createElement("div");

    lineNumbers.className = "code-line-numbers";


    const codeContent = document.createElement("pre");

    codeContent.className = "code-content";


    const lines = code.split("\n");


    lineNumbers.innerHTML = lines
        .map((_, index) => index + 1)
        .join("<br>");


    codeContent.innerHTML =
        coloriserCode(code, langage);


    codeWrapper.appendChild(lineNumbers);
    codeWrapper.appendChild(codeContent);


    wrapper.appendChild(header);
    wrapper.appendChild(codeWrapper);


    // ==================================================
    // COPIER
    // ==================================================

    copyButton.addEventListener("click", async () => {

        try {

            await navigator.clipboard.writeText(code);

            copyButton.textContent = "✅ Copié !";

            copyButton.classList.add("copied");


            setTimeout(() => {

                copyButton.textContent = "📋 Copier";

                copyButton.classList.remove("copied");

            }, 1500);


        } catch (error) {

            copyButton.textContent = "❌ Erreur";


            setTimeout(() => {

                copyButton.textContent = "📋 Copier";

            }, 1500);
        }
    });


    // ==================================================
    // TÉLÉCHARGEMENT
    // ==================================================

    downloadButton.addEventListener("click", () => {

        let extension = "txt";


        switch (langage.toLowerCase()) {

            case "python":
                extension = "py";
                break;

            case "javascript":
                extension = "js";
                break;

            case "html":
                extension = "html";
                break;

            case "css":
                extension = "css";
                break;

            case "sql":
                extension = "sql";
                break;

            case "java":
                extension = "java";
                break;

            case "c++":
                extension = "cpp";
                break;
        }


        const blob = new Blob(
            [code],
            {
                type: "text/plain;charset=utf-8"
            }
        );


        const url =
            URL.createObjectURL(blob);


        const link =
            document.createElement("a");


        link.href = url;

        link.download =
            `bournox-code.${extension}`;


        document.body.appendChild(link);

        link.click();

        link.remove();


        URL.revokeObjectURL(url);
    });


    return wrapper;
}


// ======================================================
// AFFICHAGE MESSAGE AVEC CODE
// ======================================================

function afficherMessageFormate(message) {

    const container =
        document.createElement("div");

    container.className = "message-text";


    const regex =
        /```(\w+)?\n?([\s\S]*?)```/g;


    let dernierIndex = 0;

    let match;


    while (
        (match = regex.exec(message)) !== null
    ) {

        // TEXTE AVANT LE CODE
        const texteAvant =
            message.slice(
                dernierIndex,
                match.index
            );


        if (texteAvant.trim()) {

            const texte =
                document.createElement("div");


            texte.innerHTML =
                escapeHTML(texteAvant)
                    .replace(/\n/g, "<br>");


            container.appendChild(texte);
        }


        // CODE
        const code =
            match[2].trim();


        const langage =
            match[1] ||
            detecterLangage(code);


        const bloc =
            creerBlocCode(
                code,
                langage
            );


        container.appendChild(bloc);


        dernierIndex =
            regex.lastIndex;
    }


    // TEXTE APRÈS LE CODE
    const texteFinal =
        message.slice(dernierIndex);


    if (texteFinal.trim()) {

        const texte =
            document.createElement("div");


        texte.innerHTML =
            escapeHTML(texteFinal)
                .replace(/\n/g, "<br>");


        container.appendChild(texte);
    }


    return container;
}


// ======================================================
// MESSAGE UTILISATEUR
// ======================================================

function ajouterMessageUser(message) {

    const el =
        document.createElement("div");


    el.className =
        "message user";


    el.textContent =
        message;


    chat.insertBefore(
        el,
        composer
    );


    scrollChat();
}


// ======================================================
// MESSAGE BOURNOX
// ======================================================

function ajouterMessageBot(message) {

    const el =
        document.createElement("div");


    el.className =
        "message bot";


    const title =
        document.createElement("div");


    title.className =
        "bot-title";


    title.innerHTML = `
        <span class="mini-bn">BN</span>
        BourNox.AI
        <i>● En ligne</i>
    `;


    el.appendChild(title);


    const contenu =
        afficherMessageFormate(message);


    el.appendChild(contenu);


    chat.insertBefore(
        el,
        composer
    );


    scrollChat();
}


// ======================================================
// CHARGEMENT
// ======================================================

function ajouterChargement() {

    const el =
        document.createElement("div");


    el.className =
        "message bot bournox-loading";


    el.innerHTML = `
        <div class="bot-title">
            <span class="mini-bn">BN</span>
            BourNox.AI
            <i>● réfléchit...</i>
        </div>

        <div class="thinking-animation">
            🧠 Je réfléchis...
        </div>
    `;


    chat.insertBefore(
        el,
        composer
    );


    scrollChat();


    return el;
}


// ======================================================
// ENVOYER UN MESSAGE
// ======================================================

async function envoyer(messageForce = null) {

    const message =
        messageForce ||
        input.value.trim();


    if (
        !message ||
        send.disabled
    ) {
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
                        message,
                        session_id:
                            sessionId
                    })
                }
            );


        const data =
            await response
                .json()
                .catch(() => ({}));


        loading.remove();


        // SESSION EXPIRÉE
        if (
            response.status === 401
        ) {

            window.location.href =
                "/login";

            return;
        }


        // ERREUR SERVEUR
        if (!response.ok) {

            ajouterMessageBot(
                data.response ||
                "⚠️ Erreur du serveur BourNox."
            );

            return;
        }


        // NOUVELLE SESSION
        if (data.session_id) {

            sessionId =
                data.session_id;


            localStorage.setItem(
                SESSION_KEY,
                sessionId
            );
        }


        // RÉPONSE
        ajouterMessageBot(
            data.response ||
            "Je n'ai pas reçu de réponse."
        );


    } catch (error) {

        console.error(
            "Erreur BourNox :",
            error
        );


        loading.remove();


        ajouterMessageBot(
            "⚠️ Impossible de contacter le cerveau BourNox."
        );


    } finally {

        send.disabled = false;

        input.focus();
    }
}


// ======================================================
// ENVOI AVEC ENTRÉE
// ======================================================

if (send) {

    send.addEventListener(
        "click",
        () => envoyer()
    );
}


if (input) {

    input.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter" &&
                !event.shiftKey
            ) {

                event.preventDefault();

                envoyer();
            }
        }
    );
}


// ======================================================
// GÉNÉRATEUR D'IMAGE
// ======================================================

function ouvrirCreateurImage() {

    const ancien =
        document.getElementById(
            "image-creator"
        );


    if (ancien) {
        ancien.remove();
    }


    const el =
        document.createElement("div");


    el.id =
        "image-creator";


    el.className =
        "message bot image-generator";


    el.innerHTML = `
        <div class="bot-title">
            <span class="mini-bn">BN</span>
            BourNox.AI
            <i>● Générateur d'image</i>
        </div>

        <div class="image-generator-title">
            🎨 Décris l'image que tu veux créer :
        </div>

        <textarea
            id="image-prompt"
            placeholder="Exemple : un robot BN dans une ville futuriste..."
        ></textarea>

        <div class="image-generator-buttons">

            <button id="create-image-btn">
                🎨 Créer l'image
            </button>

            <button id="cancel-image-btn">
                Annuler
            </button>

        </div>
    `;


    chat.insertBefore(
        el,
        composer
    );


    const promptInput =
        document.getElementById(
            "image-prompt"
        );


    document.getElementById(
        "create-image-btn"
    ).onclick = () => {

        const prompt =
            promptInput.value.trim();


        if (!prompt) {

            promptInput.focus();

            return;
        }


        el.remove();

        genererImage(prompt);
    };


    document.getElementById(
        "cancel-image-btn"
    ).onclick = () => {

        el.remove();
    };


    promptInput.focus();
}


// ======================================================
// GÉNÉRER IMAGE
// ======================================================

async function genererImage(prompt) {

    ajouterMessageUser(
        "🖼️ Crée cette image : " +
        prompt
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
                        prompt
                    })
                }
            );


        const data =
            await response
                .json()
                .catch(() => ({}));


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


    } catch (error) {

        console.error(
            "Erreur image :",
            error
        );


        loading.remove();


        ajouterMessageBot(
            "⚠️ La génération d'image a échoué."
        );
    }
}


// ======================================================
// AFFICHER IMAGE
// ======================================================

function afficherImage(base64) {

    const el =
        document.createElement("div");


    el.className =
        "message bot";


    const title =
        document.createElement("div");


    title.className =
        "bot-title";


    title.innerHTML = `
        <span class="mini-bn">BN</span>
        BourNox.AI
        <i>● Image créée</i>
    `;


    const image =
        document.createElement("img");


    image.src =
        "data:image/png;base64," +
        base64;


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


    el.append(
        title,
        image
    );


    chat.insertBefore(
        el,
        composer
    );


    scrollChat();
}


// ======================================================
// RACCOURCIS
// ======================================================

function envoyerCommande(message) {

    if (!input) return;

    input.value = message;

    envoyer();
}


// ======================================================
// ACCUEIL
// ======================================================

function allerAccueil() {

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

    if (input) {
        input.focus();
    }
}


// ======================================================
// CHAT
// ======================================================

function allerChat() {

    if (input) {
        input.focus();
    }
}


// ======================================================
// MÉMOIRE
// ======================================================

function demanderMemoire() {

    envoyer(
        "Montre-moi ce que tu sais de ma mémoire."
    );
}


// ======================================================
// OUTILS
// ======================================================

function afficherOutils() {

    ajouterMessageBot(
        "🔧 Les outils BourNox V2 sont en développement."
    );
}


// ======================================================
// INTERNET
// ======================================================

function demanderInternet() {

    envoyer(
        "Utilise Internet pour répondre à ma demande."
    );
}


// ======================================================
// VOIX
// ======================================================

function afficherVoix() {

    ajouterMessageBot(
        "🎙️ Le mode vocal BourNox V2 arrive bientôt."
    );
}


// ======================================================
// PARAMÈTRES
// ======================================================

function afficherParametres() {

    ajouterMessageBot(
        "⚙️ Les paramètres BourNox V2 arrivent bientôt."
    );
}


// ======================================================
// BOUTONS QUICK
// ======================================================

document
    .querySelectorAll(".quick button")
    .forEach(button => {

        button.addEventListener(
            "click",
            () => {

                const text =
                    button.textContent.toLowerCase();


                if (
                    text.includes("devoirs")
                ) {

                    envoyer(
                        "Aide-moi à faire mes devoirs."
                    );


                } else if (
                    text.includes("internet")
                ) {

                    demanderInternet();


                } else if (
                    text.includes("image")
                ) {

                    ouvrirCreateurImage();
                }
            }
        );
    });


// ======================================================
// SIDEBAR
// ======================================================

document
    .querySelectorAll(".sidebar nav button")
    .forEach(button => {

        button.addEventListener(
            "click",
            () => {

                document
                    .querySelectorAll(
                        ".sidebar nav button"
                    )
                    .forEach(btn => {

                        btn.classList.remove(
                            "active"
                        );
                    });


                button.classList.add(
                    "active"
                );


                const text =
                    button.textContent.toLowerCase();


                if (
                    text.includes("accueil") ||
                    text.includes("chat")
                ) {

                    allerChat();


                } else if (
                    text.includes("mémoire")
                ) {

                    demanderMemoire();


                } else if (
                    text.includes("outils")
                ) {

                    afficherOutils();


                } else if (
                    text.includes("internet")
                ) {

                    demanderInternet();


                } else if (
                    text.includes("voix")
                ) {

                    afficherVoix();


                } else if (
                    text.includes("paramètres")
                ) {

                    afficherParametres();
                }
            }
        );
    });


// ======================================================
// RACCOURCIS DE LA RIGHTBAR
// ======================================================

document
    .querySelectorAll(
        ".rightbar .grid button"
    )
    .forEach(button => {

        button.addEventListener(
            "click",
            () => {

                const text =
                    button.textContent.toLowerCase();


                if (
                    text.includes("devoirs")
                ) {

                    envoyer(
                        "Aide-moi avec mes devoirs."
                    );


                } else if (
                    text.includes("internet")
                ) {

                    demanderInternet();


                } else if (
                    text.includes("images")
                ) {

                    ouvrirCreateurImage();


                } else if (
                    text.includes("voix")
                ) {

                    afficherVoix();
                }
            }
        );
    });


// ======================================================
// RACCOURCI CLAVIER CTRL + K
// ======================================================

document.addEventListener(
    "keydown",
    event => {

        if (
            event.ctrlKey &&
            event.key.toLowerCase() === "k"
        ) {

            event.preventDefault();

            if (input) {
                input.focus();
            }
        }
    }
);


// ======================================================
// MESSAGE DE DÉMARRAGE V2
// ======================================================

console.log(
    "🚀 BourNox.AI V2 démarré avec succès."
);
