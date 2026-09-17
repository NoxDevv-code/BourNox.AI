const loginBox =
    document.getElementById("adminLogin");

const dashboard =
    document.getElementById("dashboard");

const errorBox =
    document.getElementById("adminError");

const usersList =
    document.getElementById("usersList");

const details =
    document.getElementById("userDetails");

const searchInput =
    document.getElementById("userIdInput");

const selectedUserLabel =
    document.getElementById("selectedUserLabel");

let allUsers = [];


// ======================================================
// API
// ======================================================

async function api(url, options = {}) {

    const response =
        await fetch(url, options);

    const data =
        await response
            .json()
            .catch(() => ({}));

    if (!response.ok) {

        throw new Error(
            data.error ||
            "Erreur serveur."
        );

    }

    return data;
}


// ======================================================
// SÉCURITÉ HTML
// ======================================================

function escapeHtml(value) {

    return String(value ?? "")
        .replace(/[&<>"']/g, char => ({

            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"

        }[char]));

}


// ======================================================
// STATISTIQUES
// ======================================================

function updateStats() {

    document.getElementById(
        "statUsers"
    ).textContent =
        allUsers.length;

}


// ======================================================
// ALERTES
// ======================================================

async function loadAlerts() {

    try {

        const data =
            await api(
                "/api/admin/alerts"
            );

        const box =
            document.getElementById(
                "alertsList"
            );

        const alerts =
            data.alerts || [];

        document.getElementById(
            "statAlerts"
        ).textContent =
            alerts.filter(
                alert => !alert.reviewed
            ).length;

        if (!alerts.length) {

            box.innerHTML = `
                <div class="admin-empty">
                    <div>✅</div>
                    <p>
                        Aucune alerte pour le moment.
                    </p>
                </div>
            `;

            return;
        }


        box.innerHTML =
            alerts.map(alert => `

                <div class="
                    admin-alert
                    ${alert.reviewed ? "reviewed" : ""}
                ">

                    <div>

                        <strong>

                            ${
                                alert.severity === "high"
                                    ? "🔴"
                                    : "🟠"
                            }

                            ${escapeHtml(
                                alert.category
                            )}

                        </strong>

                    </div>

                    <div>

                        <strong>
                            ID utilisateur :
                        </strong>

                        ${escapeHtml(
                            alert.user_id
                        )}

                    </div>

                    <div>

                        <strong>
                            Date :
                        </strong>

                        ${escapeHtml(
                            alert.created_at
                        )}

                    </div>

                    <div>

                        <strong>
                            Message signalé :
                        </strong>

                        ${escapeHtml(
                            alert.message_excerpt
                        )}

                    </div>

                    ${
                        alert.reviewed

                        ? `
                            <small>
                                ✓ Alerte vérifiée
                            </small>
                        `

                        : `
                            <button
                                class="admin-small-button"
                                onclick="
                                    reviewAlert(
                                        ${Number(alert.id)}
                                    )
                                "
                            >
                                Marquer comme vérifiée
                            </button>
                        `
                    }

                </div>

            `).join("");


    } catch (error) {

        document.getElementById(
            "alertsList"
        ).innerHTML = `

            <p class="admin-error">

                ⚠️

                ${escapeHtml(
                    error.message
                )}

            </p>

        `;

    }

}


async function reviewAlert(id) {

    try {

        await api(
            "/api/admin/alerts/" +
            id +
            "/review",
            {
                method: "POST"
            }
        );

        await loadAlerts();

    } catch (error) {

        alert(
            "Erreur : " +
            error.message
        );

    }

}


// ======================================================
// UTILISATEURS
// ======================================================

async function loadUsers() {

    try {

        const data =
            await api(
                "/api/admin/users"
            );

        allUsers =
            data.users || [];

        updateStats();

        renderUsers(
            allUsers
        );

    } catch (error) {

        usersList.innerHTML = `

            <p class="admin-error">

                ⚠️

                ${escapeHtml(
                    error.message
                )}

            </p>

        `;

    }

}


function renderUsers(users) {

    usersList.innerHTML = "";

    document.getElementById(
        "usersCount"
    ).textContent =
        users.length +
        " utilisateur" +
        (users.length > 1 ? "s" : "");


    if (!users.length) {

        usersList.innerHTML = `

            <div class="admin-empty">

                <div>
                    🔎
                </div>

                <p>
                    Aucun utilisateur trouvé.
                </p>

            </div>

        `;

        return;
    }


    users.forEach(user => {

        const button =
            document.createElement(
                "button"
            );

        button.className =
            "admin-user";

        button.innerHTML = `

            <strong>
                ${escapeHtml(
                    user.username
                )}
            </strong>

            <small>
                ${escapeHtml(
                    user.public_id
                )}
            </small>

            <small>
                Créé le
                ${escapeHtml(
                    user.created_at
                )}
            </small>

        `;

        button.onclick =
            () => loadUser(
                user.public_id
            );

        usersList.appendChild(
            button
        );

    });

}


// ======================================================
// RECHERCHE UTILISATEUR
// ======================================================

function searchUsers() {

    const query =
        searchInput.value
            .trim()
            .toLowerCase();


    if (!query) {

        renderUsers(
            allUsers
        );

        return;
    }


    const results =
        allUsers.filter(user => {

            const username =
                String(
                    user.username || ""
                ).toLowerCase();

            const publicId =
                String(
                    user.public_id || ""
                ).toLowerCase();

            return (
                username.includes(query) ||
                publicId.includes(query)
            );

        });


    renderUsers(
        results
    );

}


// ======================================================
// COMPTE UTILISATEUR
// ======================================================

async function loadUser(id) {

    try {

        selectedUserLabel.textContent =
            "Chargement...";


        const data =
            await api(
                "/api/admin/user/" +
                encodeURIComponent(id)
            );


        const grouped = {};


        (data.messages || [])
            .forEach(message => {

                if (
                    !grouped[
                        message.session_id
                    ]
                ) {

                    grouped[
                        message.session_id
                    ] = [];

                }

                grouped[
                    message.session_id
                ].push(message);

            });


        const messageCount =
            data.messages?.length || 0;

        const memoryCount =
            data.memories?.length || 0;

        const projectCount =
            data.projects?.length || 0;


        document.getElementById(
            "statMessages"
        ).textContent =
            messageCount;

        document.getElementById(
            "statMemories"
        ).textContent =
            memoryCount;

        document.getElementById(
            "statProjects"
        ).textContent =
            projectCount;


        selectedUserLabel.textContent =
            data.user.username +
            " • " +
            data.user.public_id;


        details.innerHTML = `

            <!-- PROFIL -->

            <div class="admin-profile">

                <div class="admin-profile-avatar">
                    ${escapeHtml(
                        data.user.username
                            .charAt(0)
                            .toUpperCase()
                    )}
                </div>

                <div>

                    <h3>
                        ${escapeHtml(
                            data.user.username
                        )}
                    </h3>

                    <p>
                        ID :
                        ${escapeHtml(
                            data.user.public_id
                        )}
                    </p>

                    <small>
                        Créé le
                        ${escapeHtml(
                            data.user.created_at
                        )}
                    </small>

                </div>

            </div>


            <!-- STATS DU COMPTE -->

            <div class="admin-user-stats">

                <div>

                    <strong>
                        ${messageCount}
                    </strong>

                    <small>
                        Messages
                    </small>

                </div>

                <div>

                    <strong>
                        ${memoryCount}
                    </strong>

                    <small>
                        Mémoires
                    </small>

                </div>

                <div>

                    <strong>
                        ${projectCount}
                    </strong>

                    <small>
                        Projets
                    </small>

                </div>

            </div>


            <!-- CONVERSATIONS -->

            <h3>
                💬 Conversations
            </h3>

            <div>

                ${
                    Object.entries(
                        grouped
                    )
                    .map(
                        (
                            [sessionId, messages],
                            index
                        ) => `

                            <details
                                class="admin-conversation"
                            >

                                <summary>

                                    Conversation
                                    ${index + 1}

                                    <small>
                                        ${escapeHtml(
                                            sessionId
                                        )}
                                    </small>

                                </summary>


                                <div>

                                    ${messages
                                        .map(message => `

                                            <div
                                                class="
                                                    admin-message
                                                    ${
                                                        message.role ===
                                                        "user"
                                                            ? "from-user"
                                                            : "from-bot"
                                                    }
                                                "
                                            >

                                                <strong>

                                                    ${
                                                        message.role ===
                                                        "user"
                                                            ? "Utilisateur"
                                                            : "Xyro.AI"
                                                    }

                                                </strong>

                                                <div>
                                                    ${escapeHtml(
                                                        message.content
                                                    )}
                                                </div>

                                                <small>
                                                    ${escapeHtml(
                                                        message.created_at
                                                    )}
                                                </small>

                                            </div>

                                        `)
                                        .join("")}

                                </div>

                            </details>

                        `
                    )
                    .join("")

                    ||

                    `
                        <p>
                            Aucune conversation.
                        </p>
                    `
                }

            </div>


            <!-- MÉMOIRE -->

            <h3>
                🧠 Mémoire
            </h3>

            <div>

                ${
                    (data.memories || [])
                        .map(memory => `

                            <div
                                class="admin-memory"
                            >

                                <strong>
                                    🧠 Souvenir
                                </strong>

                                <p>
                                    ${escapeHtml(
                                        memory.content
                                    )}
                                </p>

                                <small>
                                    ${escapeHtml(
                                        memory.created_at
                                    )}
                                </small>

                            </div>

                        `)
                        .join("")

                    ||

                    `
                        <p>
                            Aucune mémoire.
                        </p>
                    `
                }

            </div>


            <!-- PROJETS -->

            <h3>
                📁 Projets
            </h3>

            <div>

                ${
                    (data.projects || [])
                        .map(project => `

                            <div
                                class="admin-project"
                            >

                                <strong>
                                    📁
                                    ${escapeHtml(
                                        project.name
                                    )}
                                </strong>

                                <p>
                                    ${escapeHtml(
                                        project.context ||
                                        "Aucun contexte."
                                    )}
                                </p>

                                <small>
                                    Mis à jour :
                                    ${escapeHtml(
                                        project.updated_at
                                    )}
                                </small>

                            </div>

                        `)
                        .join("")

                    ||

                    `
                        <p>
                            Aucun projet.
                        </p>
                    `
                }

            </div>

        `;


    } catch (error) {

        selectedUserLabel.textContent =
            "Erreur";

        details.innerHTML = `

            <p class="admin-error">

                ⚠️

                ${escapeHtml(
                    error.message
                )}

            </p>

        `;

    }

}


// ======================================================
// CONNEXION ADMIN
// ======================================================

document
    .getElementById(
        "adminLoginBtn"
    )
    .onclick = async () => {

        errorBox.textContent = "";


        try {

            await api(
                "/api/admin/login",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({

                            username:
                                document
                                    .getElementById(
                                        "adminUsername"
                                    )
                                    .value
                                    .trim(),

                            password:
                                document
                                    .getElementById(
                                        "adminPassword"
                                    )
                                    .value

                        })

                }
            );


            loginBox
                .classList
                .add("hidden");

            dashboard
                .classList
                .remove("hidden");


            await loadUsers();

            await loadAlerts();

        } catch (error) {

            errorBox.textContent =
                "⚠️ " +
                error.message;

        }

    };


// ======================================================
// ENTER POUR SE CONNECTER
// ======================================================

document
    .getElementById(
        "adminPassword"
    )
    .addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter"
            ) {

                document
                    .getElementById(
                        "adminLoginBtn"
                    )
                    .click();

            }

        }
    );


// ======================================================
// RECHERCHE
// ======================================================

document
    .getElementById(
        "searchUser"
    )
    .onclick =
        searchUsers;


searchInput
    .addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter"
            ) {

                searchUsers();

            }

        }
    );


// ======================================================
// EFFACER RECHERCHE
// ======================================================

document
    .getElementById(
        "clearSearch"
    )
    .onclick = () => {

        searchInput.value = "";

        renderUsers(
            allUsers
        );

    };


// ======================================================
// ACTUALISER ALERTES
// ======================================================

document
    .getElementById(
        "refreshAlerts"
    )
    .onclick =
        loadAlerts;


// ======================================================
// DÉCONNEXION
// ======================================================

document
    .getElementById(
        "logoutAdmin"
    )
    .onclick = async () => {

        try {

            await api(
                "/api/admin/logout",
                {
                    method: "POST"
                }
            );

        } finally {

            dashboard
                .classList
                .add("hidden");

            loginBox
                .classList
                .remove("hidden");

            details.innerHTML = `
                <div class="admin-empty">

                    <div>
                        👤
                    </div>

                    <p>
                        Sélectionne un utilisateur.
                    </p>

                </div>
            `;

            selectedUserLabel.textContent =
                "Aucun utilisateur sélectionné.";

        }

    };
