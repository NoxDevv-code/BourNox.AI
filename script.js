// ======================================================
// Xyro.AI V2.0
// Script principal
// ======================================================

"use strict";

// ======================================================
// DOM
// ======================================================

const input = document.getElementById("msg");
const send = document.getElementById("send");
const chatArea = document.getElementById("chat-area");

const SESSION_KEY = "xyro_session_id";
const SETTINGS_KEY = "xyro_settings";
const THEME_KEY = "xyro_theme";
const PROJECT_KEY = "xyro_project";

// ======================================================
// SESSION
// ======================================================

let sessionId = localStorage.getItem(SESSION_KEY);

if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, sessionId);
}

// ======================================================
// PARAMÈTRES
// ======================================================

const defaultSettings = {
    mode: "normal",
    response_style: "court",
    personality: "cool",
    autoRead: true
};

let settings = {
    ...defaultSettings
};

try {
    const saved = JSON.parse(
        localStorage.getItem(SETTINGS_KEY)
    );

    if (saved) {
        settings = {
            ...defaultSettings,
            ...saved
        };
    }
} catch {
    settings = {
        ...defaultSettings
    };
}

// ======================================================
// UTILITAIRES
// ======================================================

function $(selector) {
    return document.querySelector(selector);
}

function $$(selector) {
    return document.querySelectorAll(selector);
}

function escapeHTML(text) {
    const div = document.createElement("div");
    div.textContent = String(text ?? "");
    return div.innerHTML;
}

function afficherNotification(message) {
    const container = document.getElementById(
        "toast-container"
    );

    if (!container) return;

    const toast = document.createElement("div");

    toast.className = "toast";
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateY(8px)";

        setTimeout(() => toast.remove(), 200);
    }, 3000);
}

function scrollChat() {
    if (!chatArea) return;

    chatArea.scrollTop = chatArea.scrollHeight;
}

function fermerModal(id) {
    const modal = document.getElementById(id);

    if (modal) {
        modal.classList.remove("open");
    }
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

        const data = await response.json();

        if (data.user) {
            const username =
                data.user.username || "Utilisateur";

            const avatar = username
                .slice(0, 2)
                .toUpperCase();

            const topAvatar =
                document.querySelector(".avatar");

            const topUsername =
                document.getElementById("username-top");

            const settingsUsername =
                document.getElementById("settings-username");

            const settingsAvatar =
                document.getElementById("settings-avatar");

            const publicId =
                document.getElementById("settings-public-id");

            if (topAvatar) {
                topAvatar.textContent = avatar;
            }

            if (topUsername) {
                topUsername.textContent = username;
            }

            if (settingsUsername) {
                settingsUsername.textContent = username;
            }

            if (settingsAvatar) {
                settingsAvatar.textContent = avatar;
            }

            if (publicId) {
                publicId.textContent =
                    data.user.public_id
                        ? `ID : ${data.user.public_id}`
                        : "ID Xyro";
            }
        }

        return data;
    } catch (error) {
        console.error("Erreur compte :", error);
        return null;
    }
}

// ======================================================
// DÉCONNEXION
// ======================================================

async function deconnexion() {
    try {
        await fetch("/api/logout", {
            method: "POST"
        });
    } catch (error) {
        console.error(
            "Erreur déconnexion :",
            error
        );
    }

    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(PROJECT_KEY);

    window.location.href = "/login";
}

// ======================================================
// NAVIGATION V2
// ======================================================

const viewTitles = {
    home: "Accueil",
    chat: "Chat",
    projects: "Projets",
    memory: "Mémoire",
    tools: "Outils",
    internet: "Internet",
    voice: "Voix",
    settings: "Paramètres"
};

function ouvrirVue(viewName) {
    const view = document.getElementById(
        `view-${viewName}`
    );

    if (!view) return;

    $$(".view").forEach(element => {
        element.classList.remove("active");
    });

    view.classList.add("active");

    $$(".nav-btn[data-view]").forEach(button => {
        button.classList.toggle(
            "active",
            button.dataset.view === viewName
        );
    });

    const title = document.getElementById(
        "topbar-title"
    );

    if (title) {
        title.textContent =
            viewTitles[viewName] || "Xyro.AI";
    }

    if (viewName === "memory") {
        chargerMemoire();
    }

    if (viewName === "projects") {
        chargerProjets();
    }

    if (viewName === "chat") {
        setTimeout(() => input?.focus(), 100);
    }

    if (viewName === "settings") {
        chargerParametresUI();
    }

    if (viewName === "home") {
        chargerMemoire();
    }
}

// ======================================================
// NOUVELLE DISCUSSION
// ======================================================

function nouvelleDiscussion() {
    sessionId = crypto.randomUUID();

    localStorage.setItem(
        SESSION_KEY,
        sessionId
    );

    if (chatArea) {
        chatArea.innerHTML = `
            <div class="welcome-chat">

                <div class="welcome-icon">
                    XY
                </div>

                <h2>Nouvelle discussion 👋</h2>

                <p>
                    Une nouvelle conversation avec
                    <strong>Xyro.AI</strong>.
                </p>

            </div>
        `;
    }

    ouvrirVue("chat");

    afficherNotification(
        "Nouvelle discussion créée."
    );
}

// ======================================================
// CHAT
// ======================================================

function ajouterMessageUser(message) {
    if (!chatArea) return;

    const welcome = chatArea.querySelector(
        ".welcome-chat"
    );

    if (welcome) {
        welcome.remove();
    }

    const el = document.createElement("div");

    el.className = "message user";
    el.textContent = message;

    chatArea.appendChild(el);

    scrollChat();
}

function ajouterMessageBot(message) {
    if (!chatArea) return;

    const welcome = chatArea.querySelector(
        ".welcome-chat"
    );

    if (welcome) {
        welcome.remove();
    }

    const el = document.createElement("div");

    el.className = "message bot";

    const title = document.createElement("div");

    title.className = "bot-title";

    title.innerHTML = `
        <span class="mini-bn">XY</span>
        Xyro.AI
        <i>● En ligne</i>
    `;

    el.appendChild(title);

    const content =
        afficherMessageFormate(message);

    el.appendChild(content);

    chatArea.appendChild(el);

    scrollChat();

    if (
        settings.autoRead &&
        "speechSynthesis" in window
    ) {
        lireTexte(
            nettoyerTextePourVoix(message)
        );
    }
}

function ajouterChargement() {
    if (!chatArea) return null;

    const el = document.createElement("div");

    el.className =
        "message bot bournox-loading";

    el.innerHTML = `
        <div class="bot-title">

            <span class="mini-bn">
                XY
            </span>

            Xyro.AI

            <i>
                ● réfléchit...
            </i>

        </div>

        <div class="thinking-animation">

            <span>🧠</span>

            <span>
                Xyro réfléchit
            </span>

            <div class="thinking-dots">
                <span></span>
                <span></span>
                <span></span>
            </div>

        </div>
    `;

    chatArea.appendChild(el);

    scrollChat();

    return el;
}

// ======================================================
// ENVOI CHAT
// ======================================================

async function envoyer(messageForce = null) {
    if (!input || !send) return;

    const message =
        messageForce ||
        input.value.trim();

    if (!message || send.disabled) {
        return;
    }

    input.value = "";

    ajusterHauteurInput();

    send.disabled = true;

    ouvrirVue("chat");

    ajouterMessageUser(message);

    const loading = ajouterChargement();

    try {
        const response = await fetch("/chat", {
            method: "POST",

            headers: {
                "Content-Type":
                    "application/json"
            },

            body: JSON.stringify({
                message,

                session_id:
                    sessionId,

                mode:
                    settings.mode,

                response_style:
                    settings.response_style,

                personality:
                    settings.personality,

                project:
                    window.xyroProject || ""
            })
        });

        const data =
            await response.json().catch(
                () => ({})
            );

        if (loading) {
            loading.remove();
        }

        if (response.status === 401) {
            window.location.href = "/login";
            return;
        }

        if (response.status === 429) {
            ajouterMessageBot(
                data.error ||
                data.response ||
                "🟠 Xyro est temporairement limité par l'API. Réessaie dans quelques minutes."
            );

            return;
        }

        if (!response.ok) {
            ajouterMessageBot(
                data.response ||
                data.error ||
                "⚠️ Une erreur est survenue."
            );

            return;
        }

        if (data.session_id) {
            sessionId = data.session_id;

            localStorage.setItem(
                SESSION_KEY,
                sessionId
            );
        }

        ajouterMessageBot(
            data.response ||
            "Je n'ai pas reçu de réponse."
        );

    } catch (error) {
        console.error(
            "Erreur Xyro :",
            error
        );

        if (loading) {
            loading.remove();
        }

        ajouterMessageBot(
            "⚠️ Impossible de contacter le cerveau de Xyro."
        );
    } finally {
        send.disabled = false;
        input.focus();
    }
}

function envoyerCommande(message) {
    if (!message) return;

    ouvrirVue("chat");
    envoyer(message);
}

// ======================================================
// ENTER
// ======================================================

input?.addEventListener(
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

input?.addEventListener(
    "input",
    ajusterHauteurInput
);

function ajusterHauteurInput() {
    if (!input) return;

    input.style.height = "auto";

    input.style.height =
        Math.min(
            input.scrollHeight,
            150
        ) + "px";
}

// ======================================================
// HISTORIQUE
// ======================================================

async function chargerHistorique() {
    if (!chatArea) return;

    try {
        const response = await fetch(
            `/history?session_id=${encodeURIComponent(sessionId)}`
        );

        if (response.status === 401) {
            window.location.href = "/login";
            return;
        }

        if (!response.ok) return;

        const data = await response.json();

        const messages =
            data.messages ||
            data.history ||
            [];

        if (!Array.isArray(messages)) {
            return;
        }

        chatArea.innerHTML = "";

        if (!messages.length) {
            chatArea.innerHTML = `
                <div class="welcome-chat">

                    <div class="welcome-icon">
                        XY
                    </div>

                    <h2>Nouvelle discussion 👋</h2>

                    <p>
                        Commence une conversation avec Xyro.AI.
                    </p>

                </div>
            `;

            return;
        }

        messages.forEach(item => {
            if (item.role === "user") {
                ajouterMessageUser(
                    item.content
                );
            } else if (
                item.role === "assistant"
            ) {
                ajouterMessageBot(
                    item.content
                );
            }
        });

    } catch (error) {
        console.error(
            "Erreur historique :",
            error
        );
    }
}

// ======================================================
// FORMATAGE CODE
// ======================================================

function detecterLangage(code) {
    if (
        /\b(def|import|print|class|self|elif)\b/
            .test(code)
    ) {
        return "Python";
    }

    if (
        /\b(const|let|var|function|console\.log|document\.)\b/
            .test(code)
    ) {
        return "JavaScript";
    }

    if (
        /<!DOCTYPE html>|<html|<body|<div|<section|<header/i
            .test(code)
    ) {
        return "HTML";
    }

    if (
        /\b(color|background|margin|padding|display|font-size)\s*:/
            .test(code)
    ) {
        return "CSS";
    }

    if (
        /\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b/i
            .test(code)
    ) {
        return "SQL";
    }

    if (
        /\b(public|private|static|void|System\.out)\b/
            .test(code)
    ) {
        return "Java";
    }

    if (
        /#include\s*<|std::/
            .test(code)
    ) {
        return "C++";
    }

    return "Code";
}

function coloriserCode(code, langage) {
    let result = escapeHTML(code);

    result = result.replace(
        /(["'`])(?:\\.|(?!\1).)*?\1/g,
        '<span class="code-value">$&</span>'
    );

    result = result.replace(
        /\b(def|class|import|from|return|if|else|elif|for|while|in|True|False|None|const|let|var|function|new|async|await|public|private|static|void|SELECT|FROM|WHERE|INSERT|UPDATE|DELETE)\b/g,
        '<span class="code-keyword">$1</span>'
    );

    result = result.replace(
        /\b([a-zA-Z_$][\w$]*)\s*(?=\()/g,
        '<span class="code-function">$1</span>'
    );

    if (langage === "HTML") {
        result = result.replace(
            /(&lt;\/?)([\w-]+)/g,
            '$1<span class="code-tag">$2</span>'
        );
    }

    return result;
}

function creerBlocCode(code, langage) {
    const wrapper =
        document.createElement("div");

    wrapper.className = "bournox-code";

    const header =
        document.createElement("div");

    header.className = "code-header";

    const language =
        document.createElement("span");

    language.className =
        "code-language";

    language.textContent = langage;

    const actions =
        document.createElement("div");

    actions.className =
        "code-actions";

    const copyButton =
        document.createElement("button");

    copyButton.className =
        "code-action";

    copyButton.textContent =
        "📋 Copier";

    const downloadButton =
        document.createElement("button");

    downloadButton.className =
        "code-action";

    downloadButton.textContent =
        "⬇️ Télécharger";

    actions.append(
        copyButton,
        downloadButton
    );

    header.append(
        language,
        actions
    );

    const codeWrapper =
        document.createElement("div");

    codeWrapper.className =
        "code-wrapper";

    const lineNumbers =
        document.createElement("div");

    lineNumbers.className =
        "code-line-numbers";

    const codeContent =
        document.createElement("pre");

    codeContent.className =
        "code-content";

    const lines =
        code.split("\n");

    lineNumbers.innerHTML =
        lines
            .map(
                (_, index) =>
                    index + 1
            )
            .join("<br>");

    codeContent.innerHTML =
        coloriserCode(
            code,
            langage
        );

    codeWrapper.append(
        lineNumbers,
        codeContent
    );

    wrapper.append(
        header,
        codeWrapper
    );

    copyButton.addEventListener(
        "click",
        async () => {
            try {
                await navigator.clipboard
                    .writeText(code);

                copyButton.textContent =
                    "✅ Copié !";

                copyButton.classList.add(
                    "copied"
                );

                setTimeout(() => {
                    copyButton.textContent =
                        "📋 Copier";

                    copyButton.classList.remove(
                        "copied"
                    );
                }, 1500);

            } catch {
                afficherNotification(
                    "Impossible de copier le code."
                );
            }
        }
    );

    downloadButton.addEventListener(
        "click",
        () => {
            const extension =
                obtenirExtension(
                    langage
                );

            const blob =
                new Blob(
                    [code],
                    {
                        type:
                            "text/plain;charset=utf-8"
                    }
                );

            const url =
                URL.createObjectURL(
                    blob
                );

            const link =
                document.createElement("a");

            link.href = url;

            link.download =
                `xyro-code.${extension}`;

            document.body.appendChild(link);

            link.click();

            link.remove();

            URL.revokeObjectURL(url);
        }
    );

    return wrapper;
}

function obtenirExtension(langage) {
    switch (
        langage.toLowerCase()
    ) {
        case "python":
            return "py";

        case "javascript":
            return "js";

        case "html":
            return "html";

        case "css":
            return "css";

        case "sql":
            return "sql";

        case "java":
            return "java";

        case "c++":
            return "cpp";

        default:
            return "txt";
    }
}

function afficherMessageFormate(message) {
    const container =
        document.createElement("div");

    container.className =
        "message-text";

    const regex =
        /```(\w+)?\n?([\s\S]*?)```/g;

    let dernierIndex = 0;
    let match;

    while (
        (match = regex.exec(message)) !== null
    ) {
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
                    .replace(
                        /\n/g,
                        "<br>"
                    );

            container.appendChild(texte);
        }

        const code =
            match[2].trim();

        const langage =
            match[1] ||
            detecterLangage(code);

        container.appendChild(
            creerBlocCode(
                code,
                langage
            )
        );

        dernierIndex =
            regex.lastIndex;
    }

    const texteFinal =
        message.slice(dernierIndex);

    if (texteFinal.trim()) {
        const texte =
            document.createElement("div");

        texte.innerHTML =
            escapeHTML(texteFinal)
                .replace(
                    /\n/g,
                    "<br>"
                );

        container.appendChild(texte);
    }

    return container;
}

// ======================================================
// IMAGE
// ======================================================

function ouvrirCreateurImage() {
    ouvrirVue("chat");

    const existing =
        document.getElementById(
            "image-creator"
        );

    if (existing) {
        existing.remove();
    }

    const el =
        document.createElement("div");

    el.id = "image-creator";
    el.className = "message bot";

    el.innerHTML = `
        <div class="bot-title">
            <span class="mini-bn">XY</span>
            Xyro.AI
            <i>● Générateur d'image</i>
        </div>

        <div>
            🎨 Décris l'image que tu veux créer :
        </div>

        <textarea
            id="image-prompt"
            style="
                width:100%;
                min-height:100px;
                margin-top:12px;
                padding:12px;
                border:1px solid #1b4569;
                border-radius:10px;
                background:#030b15;
                color:white;
                resize:vertical;
            "
            placeholder="Ex : un robot XY dans une ville futuriste..."
        ></textarea>

        <div
            style="
                display:flex;
                gap:7px;
                margin-top:10px;
            "
        >
            <button
                id="create-image-btn"
                class="primary-btn"
            >
                🎨 Créer
            </button>

            <button
                id="cancel-image-btn"
                class="secondary-btn"
            >
                Annuler
            </button>
        </div>
    `;

    chatArea.appendChild(el);

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

    scrollChat();
}

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

        loading?.remove();

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

        afficherImage(data.image);

    } catch (error) {
        console.error(
            "Erreur image :",
            error
        );

        loading?.remove();

        ajouterMessageBot(
            "⚠️ La génération d'image a échoué."
        );
    }
}

function afficherImage(base64) {
    const el =
        document.createElement("div");

    el.className = "message bot";

    const title =
        document.createElement("div");

    title.className = "bot-title";

    title.innerHTML = `
        <span class="mini-bn">XY</span>
        Xyro.AI
        <i>● Image créée</i>
    `;

    const image =
        document.createElement("img");

    image.src =
        "data:image/png;base64," +
        base64;

    image.alt =
        "Image générée par Xyro.AI";

    image.style.maxWidth = "100%";
    image.style.borderRadius = "14px";
    image.style.display = "block";
    image.style.marginTop = "8px";

    el.append(
        title,
        image
    );

    chatArea.appendChild(el);

    scrollChat();
}

// ======================================================
// MÉMOIRE
// ======================================================

async function chargerMemoire() {
    const container =
        document.getElementById(
            "memory-container"
        );

    if (!container) return;

    try {
        const response =
            await fetch("/memory");

        if (response.status === 401) {
            window.location.href = "/login";
            return;
        }

        const data =
            await response.json();

        const memories =
            data.memories ||
            data.memory ||
            [];

        container.innerHTML = "";

        if (
            !Array.isArray(memories) ||
            memories.length === 0
        ) {
            container.innerHTML = `
                <div class="empty-state">

                    <div>🧠</div>

                    <h3>
                        Ta mémoire est encore vide
                    </h3>

                    <p>
                        Dis « souviens-toi que... »
                        pendant une conversation.
                    </p>

                </div>
            `;

            mettreAJourMemoireDroite(0);

            return;
        }

        memories.forEach(memory => {
            const content =
                typeof memory === "string"
                    ? memory
                    : (
                        memory.content ||
                        memory.memory ||
                        ""
                    );

            const date =
                typeof memory === "object"
                    ? (
                        memory.created_at ||
                        ""
                    )
                    : "";

            const item =
                document.createElement("div");

            item.className =
                "memory-item";

            item.innerHTML = `
                <div class="memory-item-icon">
                    🧠
                </div>

                <div class="memory-item-content">

                    <strong>
                        Souvenir enregistré
                    </strong>

                    <p>
                        ${escapeHTML(content)}
                    </p>

                </div>

                ${
                    date
                        ? `
                            <span class="memory-date">
                                ${escapeHTML(date)}
                            </span>
                          `
                        : ""
                }
            `;

            container.appendChild(item);
        });

        mettreAJourMemoireDroite(
            memories.length
        );

    } catch (error) {
        console.error(
            "Erreur mémoire :",
            error
        );

        container.innerHTML = `
            <div class="empty-state">
                <div>⚠️</div>
                <h3>
                    Impossible de charger la mémoire
                </h3>
            </div>
        `;
    }
}

function mettreAJourMemoireDroite(count) {
    const preview =
        document.getElementById(
            "right-memory-preview"
        );

    if (!preview) return;

    preview.innerHTML = `
        <div class="mini-memory">

            <span>🧠</span>

            <div>

                <strong>
                    Mémoire active
                </strong>

                <small>
                    ${
                        count
                            ? `${count} souvenir${count > 1 ? "s" : ""} enregistré${count > 1 ? "s" : ""}`
                            : "Aucun souvenir"
                    }
                </small>

            </div>

        </div>
    `;
}

function demanderMemoire() {
    ouvrirVue("memory");
    chargerMemoire();
}

// ======================================================
// PROJETS
// ======================================================

async function chargerProjets() {
    const container =
        document.getElementById(
            "projects-container"
        );

    if (!container) return;

    try {
        const response =
            await fetch("/projects");

        if (response.status === 401) {
            window.location.href = "/login";
            return;
        }

        const data =
            await response.json();

        const projects =
            data.projects || [];

        container.innerHTML = "";

        if (!projects.length) {
            container.innerHTML = `
                <div class="empty-state">

                    <div>📁</div>

                    <h3>
                        Aucun projet
                    </h3>

                    <p>
                        Crée ton premier projet pour donner
                        un contexte permanent à Xyro.
                    </p>

                    <button
                        class="primary-btn"
                        style="margin-top:12px"
                        onclick="ouvrirCreationProjet()"
                    >
                        ＋ Créer un projet
                    </button>

                </div>
            `;

            return;
        }

        projects.forEach(project => {
            const name =
                project.name ||
                "Projet";

            const context =
                project.context ||
                "Aucun contexte défini.";

            const item =
                document.createElement("div");

            item.className =
                "project-card";

            item.innerHTML = `
                <div class="project-card-icon">
                    📁
                </div>

                <h3>
                    ${escapeHTML(name)}
                </h3>

                <p>
                    ${escapeHTML(context)}
                </p>

                <div class="project-card-footer">

                    <button
                        onclick="selectionnerProjet(${JSON.stringify(name)})"
                    >
                        Ouvrir
                    </button>

                    <button
                        class="danger"
                        onclick="supprimerProjet(${JSON.stringify(name)})"
                    >
                        Supprimer
                    </button>

                </div>
            `;

            container.appendChild(item);
        });

    } catch (error) {
        console.error(
            "Erreur projets :",
            error
        );

        container.innerHTML = `
            <div class="empty-state">
                <div>⚠️</div>
                <h3>
                    Impossible de charger les projets
                </h3>
            </div>
        `;
    }
}

function ouvrirCreationProjet() {
    const modal =
        document.getElementById(
            "project-modal"
        );

    if (!modal) return;

    modal.classList.add("open");

    document.getElementById(
        "project-name"
    )?.focus();
}

async function creerProjet() {
    const nameInput =
        document.getElementById(
            "project-name"
        );

    const contextInput =
        document.getElementById(
            "project-context"
        );

    const name =
        nameInput?.value.trim();

    const context =
        contextInput?.value.trim() || "";

    if (!name) {
        afficherNotification(
            "Donne un nom au projet."
        );

        nameInput?.focus();

        return;
    }

    try {
        const response =
            await fetch(
                "/projects",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        name,
                        context
                    })
                }
            );

        const data =
            await response
                .json()
                .catch(() => ({}));

        if (!response.ok) {
            afficherNotification(
                data.error ||
                "Impossible de créer le projet."
            );

            return;
        }

        fermerModal("project-modal");

        if (nameInput) {
            nameInput.value = "";
        }

        if (contextInput) {
            contextInput.value = "";
        }

        chargerProjets();

        afficherNotification(
            "Projet créé avec succès."
        );

    } catch (error) {
        console.error(
            "Erreur création projet :",
            error
        );

        afficherNotification(
            "Erreur lors de la création du projet."
        );
    }
}

function selectionnerProjet(name) {
    window.xyroProject = name;

    localStorage.setItem(
        PROJECT_KEY,
        name
    );

    ouvrirVue("chat");

    afficherNotification(
        `Projet "${name}" sélectionné.`
    );

    envoyer(
        `Je travaille maintenant sur le projet "${name}".`
    );
}

async function supprimerProjet(name) {
    if (
        !confirm(
            `Supprimer le projet "${name}" ?`
        )
    ) {
        return;
    }

    try {
        const response =
            await fetch(
                `/projects/${encodeURIComponent(name)}`,
                {
                    method: "DELETE"
                }
            );

        if (!response.ok) {
            afficherNotification(
                "Impossible de supprimer le projet."
            );

            return;
        }

        if (
            window.xyroProject === name
        ) {
            window.xyroProject = "";

            localStorage.removeItem(
                PROJECT_KEY
            );
        }

        chargerProjets();

        afficherNotification(
            "Projet supprimé."
        );

    } catch (error) {
        console.error(
            "Erreur suppression projet :",
            error
        );
    }
}

// ======================================================
// OUTILS
// ======================================================

function preparerDevoirs() {
    ouvrirVue("chat");

    envoyer(
        "Aide-moi à faire mes devoirs. Explique-moi étape par étape et adapte tes explications à mon niveau."
    );
}

function afficherOutils() {
    ouvrirVue("tools");
}

// ======================================================
// INTERNET
// ======================================================

function lancerRechercheInternet() {
    const inputWeb =
        document.getElementById(
            "internet-input"
        );

    const query =
        inputWeb?.value.trim();

    if (!query) {
        inputWeb?.focus();
        return;
    }

    ouvrirVue("chat");

    envoyer(
        `Utilise Internet pour répondre à cette demande : ${query}`
    );
}

function rechercheRapide(query) {
    const inputWeb =
        document.getElementById(
            "internet-input"
        );

    if (inputWeb) {
        inputWeb.value = query;
    }

    lancerRechercheInternet();
}

function demanderInternet() {
    ouvrirVue("internet");
}

// ======================================================
// VOIX
// ======================================================

let recognition = null;
let isListening = false;

function obtenirSpeechRecognition() {
    return (
        window.SpeechRecognition ||
        window.webkitSpeechRecognition ||
        null
    );
}

function demarrerDictation() {
    const Recognition =
        obtenirSpeechRecognition();

    if (!Recognition) {
        afficherNotification(
            "La reconnaissance vocale n'est pas disponible dans ce navigateur."
        );

        return;
    }

    if (isListening) {
        recognition?.stop();
        return;
    }

    recognition =
        new Recognition();

    recognition.lang = "fr-FR";
    recognition.continuous = false;
    recognition.interimResults = true;

    isListening = true;

    mettreAJourEtatVoix(true);

    recognition.onresult = event => {
        let transcript = "";

        for (
            let i = event.resultIndex;
            i < event.results.length;
            i++
        ) {
            transcript +=
                event.results[i][0].transcript;
        }

        if (input) {
            input.value = transcript;
            ajusterHauteurInput();
        }
    };

    recognition.onend = () => {
        isListening = false;

        mettreAJourEtatVoix(false);

        if (input?.value.trim()) {
            envoyer();
        }
    };

    recognition.onerror = event => {
        console.error(
            "Erreur voix :",
            event.error
        );

        isListening = false;

        mettreAJourEtatVoix(false);

        afficherNotification(
            "La reconnaissance vocale a rencontré un problème."
        );
    };

    recognition.start();
}

function mettreAJourEtatVoix(listening) {
    const orb =
        document.getElementById(
            "voice-orb"
        );

    const status =
        document.getElementById(
            "voice-status"
        );

    const description =
        document.getElementById(
            "voice-description"
        );

    const button =
        document.getElementById(
            "voice-button"
        );

    if (orb) {
        orb.classList.toggle(
            "listening",
            listening
        );
    }

    if (status) {
        status.textContent =
            listening
                ? "Je t'écoute..."
                : "Prêt à écouter";
    }

    if (description) {
        description.textContent =
            listening
                ? "Parle maintenant."
                : "Appuie sur le bouton pour commencer la dictée.";
    }

    if (button) {
        button.textContent =
            listening
                ? "⏹️ Arrêter"
                : "🎙️ Parler";
    }
}

function afficherVoix() {
    ouvrirVue("voice");
}

function lireTexte(text) {
    if (
        !settings.autoRead ||
        !("speechSynthesis" in window) ||
        !text
    ) {
        return;
    }

    window.speechSynthesis.cancel();

    const utterance =
        new SpeechSynthesisUtterance(
            text.slice(0, 1800)
        );

    utterance.lang = "fr-FR";
    utterance.rate = 0.98;
    utterance.pitch = 1;

    window.speechSynthesis.speak(
        utterance
    );
}

function nettoyerTextePourVoix(text) {
    return String(text)
        .replace(
            /```[\s\S]*?```/g,
            " bloc de code "
        )
        .replace(
            /[*_#>`]/g,
            ""
        )
        .replace(
            /\s+/g,
            " "
        )
        .trim();
}

// ======================================================
// PARAMÈTRES
// ======================================================

function chargerParametresUI() {
    const mode =
        document.getElementById(
            "setting-mode"
        );

    const personality =
        document.getElementById(
            "setting-personality"
        );

    const style =
        document.getElementById(
            "setting-style"
        );

    const autoRead =
        document.getElementById(
            "voice-auto-read"
        );

    if (mode) {
        mode.value =
            settings.mode;
    }

    if (personality) {
        personality.value =
            settings.personality;
    }

    if (style) {
        style.value =
            settings.response_style;
    }

    if (autoRead) {
        autoRead.checked =
            settings.autoRead;
    }

    mettreAJourModeUI();
}

function sauvegarderParametres() {
    const mode =
        document.getElementById(
            "setting-mode"
        );

    const personality =
        document.getElementById(
            "setting-personality"
        );

    const style =
        document.getElementById(
            "setting-style"
        );

    const autoRead =
        document.getElementById(
            "voice-auto-read"
        );

    if (mode) {
        settings.mode =
            mode.value;
    }

    if (personality) {
        settings.personality =
            personality.value;
    }

    if (style) {
        settings.response_style =
            style.value;
    }

    if (autoRead) {
        settings.autoRead =
            autoRead.checked;
    }

    localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify(settings)
    );

    mettreAJourModeUI();

    afficherNotification(
        "Paramètres enregistrés."
    );
}

function mettreAJourModeUI() {
    const label =
        document.getElementById(
            "current-mode-label"
        );

    if (!label) return;

    const names = {
        normal: "Normal",
        professeur: "Professeur",
        developpeur: "Développeur",
        gamer: "Gamer",
        creatif: "Créatif",
        nox: "Nox"
    };

    label.textContent =
        `Mode ${names[settings.mode] || "Normal"}`;
}

// ======================================================
// THÈME
// ======================================================

function appliquerTheme() {
    const theme =
        localStorage.getItem(
            THEME_KEY
        ) || "dark";

    document.body.classList.toggle(
        "light",
        theme === "light"
    );

    const button =
        document.getElementById(
            "theme-toggle"
        );

    if (button) {
        button.textContent =
            theme === "light"
                ? "☀"
                : "☾";
    }
}

function basculerTheme() {
    const current =
        localStorage.getItem(
            THEME_KEY
        ) || "dark";

    const next =
        current === "dark"
            ? "light"
            : "dark";

    localStorage.setItem(
        THEME_KEY,
        next
    );

    appliquerTheme();
}

appliquerTheme();

chargerParametresUI();

// ======================================================
// NOTIFICATIONS
// ======================================================

function afficherNotifications() {
    afficherNotification(
        "🔔 Xyro.AI fonctionne normalement."
    );
}

// ======================================================
// RACCOURCIS CLAVIER
// ======================================================

document.addEventListener(
    "keydown",
    event => {
        if (
            event.ctrlKey &&
            event.key.toLowerCase() === "k"
        ) {
            event.preventDefault();

            ouvrirVue("chat");

            input?.focus();
        }

        if (event.key === "Escape") {
            document
                .querySelectorAll(
                    ".modal-overlay.open"
                )
                .forEach(
                    modal =>
                        modal.classList.remove(
                            "open"
                        )
                );
        }
    }
);

// ======================================================
// MODALE
// ======================================================

document.addEventListener(
    "click",
    event => {
        if (
            event.target.classList.contains(
                "modal-overlay"
            )
        ) {
            event.target.classList.remove(
                "open"
            );
        }
    }
);

// ======================================================
// PROJET ACTIF
// ======================================================

window.xyroProject =
    localStorage.getItem(
        PROJECT_KEY
    ) || "";

// ======================================================
// INITIALISATION
// ======================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {
        chargerCompte();

        chargerHistorique();

        chargerMemoire();

        mettreAJourModeUI();

        console.log(
            "🚀 Xyro.AI V2.0 initialisé."
        );
    }
);
