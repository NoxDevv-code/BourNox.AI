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


/* =========================================================
   COMPTE
========================================================= */

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

        if (avatar) {
            avatar.textContent =
                data.user.username.slice(0, 2).toUpperCase();
        }
    }
});

async function deconnexion() {
    await fetch("/api/logout", {
        method: "POST"
    });

    localStorage.removeItem(SESSION_KEY);
    window.location.href = "/login";
}


/* =========================================================
   UTILITAIRES CODE
========================================================= */

function escapeHTML(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

function detecterLangage(code, langage = "") {
    langage = langage.toLowerCase().trim();

    if (langage) {
        const correspondances = {
            js: "JavaScript",
            javascript: "JavaScript",
            jsx: "JSX",
            ts: "TypeScript",
            typescript: "TypeScript",
            py: "Python",
            python: "Python",
            html: "HTML",
            css: "CSS",
            json: "JSON",
            java: "Java",
            c: "C",
            cpp: "C++",
            "c++": "C++",
            cs: "C#",
            "c#": "C#",
            php: "PHP",
            sql: "SQL",
            bash: "Bash",
            sh: "Bash",
            shell: "Bash",
            xml: "XML",
            yaml: "YAML",
            yml: "YAML",
            markdown: "Markdown",
            md: "Markdown"
        };

        return correspondances[langage] || langage;
    }

    if (/^\s*(def |import |from |print\(|class )/m.test(code)) {
        return "Python";
    }

    if (/^\s*(const |let |var |function |console\.log)/m.test(code)) {
        return "JavaScript";
    }

    if (/<(!DOCTYPE|html|head|body|div|script|style)/i.test(code)) {
        return "HTML";
    }

    if (/[.#][a-zA-Z0-9_-]+\s*\{[\s\S]*\}/.test(code)) {
        return "CSS";
    }

    if (/^\s*\{[\s\S]*\}\s*$/m.test(code)) {
        return "JSON";
    }

    if (/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE TABLE)\b/im.test(code)) {
        return "SQL";
    }

    return "Code";
}


/* =========================================================
   COLORATION SIMPLE DU CODE
========================================================= */

function coloriserCode(code, langage) {
    let html = escapeHTML(code);

    const lang = langage.toLowerCase();

    /*
       On applique uniquement une coloration légère.
       Le but est de rester compatible avec tous les navigateurs
       sans ajouter une bibliothèque externe.
    */

    if (
        lang.includes("javascript") ||
        lang.includes("typescript") ||
        lang === "js" ||
        lang === "ts"
    ) {
        html = html
            .replace(
                /\b(const|let|var|function|return|if|else|for|while|class|new|async|await|import|from|export)\b/g,
                '<span class="code-keyword">$1</span>'
            )
            .replace(
                /\b(true|false|null|undefined)\b/g,
                '<span class="code-value">$1</span>'
            );
    }

    else if (lang.includes("python")) {
        html = html
            .replace(
                /\b(def|return|if|else|elif|for|while|in|import|from|class|try|except|with|as|True|False|None)\b/g,
                '<span class="code-keyword">$1</span>'
            )
            .replace(
                /\b(print|len|str|int|float|list|dict|range|input)\b/g,
                '<span class="code-function">$1</span>'
            );
    }

    else if (
        lang.includes("html") ||
        lang.includes("xml")
    ) {
        html = html.replace(
            /(&lt;\/?)([a-zA-Z0-9-]+)/g,
            '$1<span class="code-tag">$2</span>'
        );
    }

    else if (lang.includes("css")) {
        html = html
            .replace(
                /([a-zA-Z-]+)(\s*:)/g,
                '<span class="code-property">$1</span>$2'
            );
    }

    return html;
}


/* =========================================================
   CRÉATION D'UN BLOC DE CODE
========================================================= */

function creerBlocCode(code, langage = "") {
    const container = document.createElement("div");
    container.className = "bournox-code";

    const nomLangage = detecterLangage(code, langage);

    const header = document.createElement("div");
    header.className = "code-header";

    const languageName = document.createElement("span");
    languageName.className = "code-language";
    languageName.textContent = nomLangage;

    const actions = document.createElement("div");
    actions.className = "code-actions";

    const copyButton = document.createElement("button");
    copyButton.className = "code-action";
    copyButton.type = "button";
    copyButton.textContent = "📋 Copier";

    const downloadButton = document.createElement("button");
    downloadButton.className = "code-action";
    downloadButton.type = "button";
    downloadButton.textContent = "📥 Télécharger";

    actions.appendChild(copyButton);
    actions.appendChild(downloadButton);

    header.appendChild(languageName);
    header.appendChild(actions);


    const codeWrapper = document.createElement("div");
    codeWrapper.className = "code-wrapper";


    const lineNumbers = document.createElement("div");
    lineNumbers.className = "code-line-numbers";

    const lignes = code.split("\n");

    lignes.forEach((ligne, index) => {
        const lineNumber = document.createElement("span");
        lineNumber.textContent = index + 1;
        lineNumbers.appendChild(lineNumber);
    });


    const codeContent = document.createElement("pre");
    codeContent.className = "code-content";

    const codeElement = document.createElement("code");

    codeElement.innerHTML = coloriserCode(
        code,
        nomLangage
    );

    codeContent.appendChild(codeElement);


    codeWrapper.appendChild(lineNumbers);
    codeWrapper.appendChild(codeContent);


    container.appendChild(header);
    container.appendChild(codeWrapper);


    /* COPIER */

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


    /* TÉLÉCHARGER */

    downloadButton.addEventListener("click", () => {

        let extension = "txt";

        const extensions = {
            python: "py",
            javascript: "js",
            typescript: "ts",
            html: "html",
            css: "css",
            json: "json",
            java: "java",
            "c++": "cpp",
            "c#": "cs",
            php: "php",
            sql: "sql",
            bash: "sh",
            xml: "xml",
            yaml: "yml",
            markdown: "md"
        };

        const key = nomLangage.toLowerCase();

        if (extensions[key]) {
            extension = extensions[key];
        }

        const blob = new Blob(
            [code],
            {
                type: "text/plain;charset=utf-8"
            }
        );

        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");

        link.href = url;
        link.download = `bournox-code.${extension}`;

        document.body.appendChild(link);
        link.click();
        link.remove();

        URL.revokeObjectURL(url);
    });


    return container;
}


/* =========================================================
   AFFICHAGE D'UN MESSAGE AVEC CODE
========================================================= */

function afficherMessageFormate(parent, message) {

    /*
       Détection des blocs :

       ```python
       print("Salut")
       ```

       ou

       ```
       print("Salut")
       ```
    */

    const regex = /```([a-zA-Z0-9+#_-]*)\n?([\s\S]*?)```/g;

    let dernierIndex = 0;
    let match;

    while ((match = regex.exec(message)) !== null) {

        const texteAvant = message.slice(
            dernierIndex,
            match.index
        );

        if (texteAvant.trim()) {
            const textNode = document.createElement("div");
            textNode.className = "message-text";
            textNode.textContent = texteAvant;
            parent.appendChild(textNode);
        }

        const langage = match[1];
        const code = match[2].replace(/\n$/, "");

        parent.appendChild(
            creerBlocCode(code, langage)
        );

        dernierIndex = regex.lastIndex;
    }


    const texteApres = message.slice(dernierIndex);

    if (texteApres.trim()) {
        const textNode = document.createElement("div");
        textNode.className = "message-text";
        textNode.textContent = texteApres;
        parent.appendChild(textNode);
    }


    /*
       Si aucun bloc de code n'a été trouvé,
       on affiche simplement le texte.
    */

    if (!message.includes("```")) {
        parent.textContent = message;
    }
}


/* =========================================================
   MESSAGES
========================================================= */

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
        BourNox.AI
        <i>● En ligne</i>
    `;


    const body = document.createElement("div");

    body.className = "bot-body";


    afficherMessageFormate(
        body,
        message
    );


    el.appendChild(title);
    el.appendChild(body);

    chat.insertBefore(
        el,
        composer
    );
}


/* =========================================================
   CHARGEMENT
========================================================= */

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

        <div class="thinking-animation">
            <span></span>
            <span></span>
            <span></span>
            <b>🧠 BourNox réfléchit...</b>
        </div>
    `;

    chat.insertBefore(
        el,
        composer
    );

    return el;
}


/* =========================================================
   ENVOI MESSAGE
========================================================= */

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
                        session_id: sessionId
                    })
                }
            );


        const data =
            await response
                .json()
                .catch(() => ({}));


        loading.remove();


        if (response.status === 401) {
            window.location.href = "/login";
            return;
        }


        if (!response.ok) {

            ajouterMessageBot(
                data.response ||
                "⚠️ Erreur du serveur."
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

        console.error(error);

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


/* =========================================================
   CLAVIER
========================================================= */

send.addEventListener(
    "click",
    () => envoyer()
);


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


/* =========================================================
   GÉNÉRATEUR D'IMAGE
========================================================= */

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

    el.id = "image-creator";

    el.className =
        "message bot";


    el.innerHTML = `
        <div class="bot-title">
            <span class="mini-bn">BN</span>
            BourNox.AI
            <i>● Générateur d'image</i>
        </div>

        <div class="image-generator-title">
            🎨 <strong>
                Décris l'image que tu veux créer :
            </strong>
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

    }

    catch {

        loading.remove();

        ajouterMessageBot(
            "⚠️ La génération d'image a échoué."
        );
    }
}


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


    el.append(
        title,
        image
    );


    chat.insertBefore(
        el,
        composer
    );
}


/* =========================================================
   BOUTONS RAPIDES
========================================================= */

document
    .querySelectorAll(".quick button")
    .forEach(button => {

        button.addEventListener(
            "click",
            () => {

                const text =
                    button.textContent
                        .toLowerCase();


                if (
                    text.includes("devoirs")
                ) {

                    envoyer(
                        "Aide-moi à faire mes devoirs."
                    );

                }

                else if (
                    text.includes("internet")
                ) {

                    envoyer(
                        "Utilise Internet pour répondre à ma demande."
                    );

                }

                else if (
                    text.includes("image")
                ) {

                    ouvrirCreateurImage();
                }
            }
        );
    });


/* =========================================================
   SIDEBAR
========================================================= */

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
                    .forEach(btn =>
                        btn.classList.remove(
                            "active"
                        )
                    );


                button.classList.add(
                    "active"
                );


                const text =
                    button.textContent
                        .toLowerCase();


                if (
                    text.includes("accueil") ||
                    text.includes("chat")
                ) {

                    input.focus();

                }

                else if (
                    text.includes("mémoire")
                ) {

                    envoyer(
                        "Montre-moi ce que tu sais de ma mémoire."
                    );

                }

                else if (
                    text.includes("outils")
                ) {

                    ajouterMessageBot(
                        "🔧 Les outils BourNox arrivent bientôt."
                    );

                }

                else if (
                    text.includes("internet")
                ) {

                    envoyer(
                        "Utilise Internet pour répondre à ma demande."
                    );

                }

                else if (
                    text.includes("voix")
                ) {

                    ajouterMessageBot(
                        "🎙️ Le mode vocal BourNox arrive bientôt."
                    );

                }

                else if (
                    text.includes("paramètres")
                ) {

                    ajouterMessageBot(
                        "⚙️ Les paramètres BourNox arrivent bientôt."
                    );
                }
            }
        );
    });


/* =========================================================
   RIGHTBAR
========================================================= */

document
    .querySelectorAll(".rightbar .grid button")
    .forEach(button => {

        button.addEventListener(
            "click",
            () => {

                const text =
                    button.textContent
                        .toLowerCase();


                if (
                    text.includes("devoirs")
                ) {

                    envoyer(
                        "Aide-moi avec mes devoirs."
                    );

                }

                else if (
                    text.includes("internet")
                ) {

                    envoyer(
                        "Utilise Internet pour répondre à ma demande."
                    );

                }

                else if (
                    text.includes("images")
                ) {

                    ouvrirCreateurImage();

                }

                else if (
                    text.includes("voix")
                ) {

                    ajouterMessageBot(
                        "🎙️ Le mode vocal BourNox arrive bientôt."
                    );
                }
            }
        );
    });
