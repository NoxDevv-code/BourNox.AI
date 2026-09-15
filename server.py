import os
import re
import sqlite3
import uuid
from datetime import datetime, timedelta

from flask import Flask, request, jsonify, send_from_directory, session, redirect
from openai import OpenAI
from werkzeug.security import generate_password_hash, check_password_hash


# ============================================================
# CONFIGURATION
# ============================================================

app = Flask(__name__, static_folder=".", static_url_path="")

app.secret_key = os.getenv(
    "BOURNOX_SECRET_KEY",
    "CHANGE-ME-IN-RENDER"
)

app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["SESSION_COOKIE_SECURE"] = (
    os.getenv("RENDER", "").lower() == "true"
)

app.permanent_session_lifetime = timedelta(days=30)

client = OpenAI()

MODEL = os.getenv(
    "BOURNOX_MODEL",
    "gpt-5.6-luna"
)

DB_FILE = "bournox.db"


# ============================================================
# ADMIN NOX
# ============================================================

BOOTSTRAP_ADMIN_USERNAME = "Nox"

BOOTSTRAP_ADMIN_PASSWORD_HASH = (
    "pbkdf2:sha256:600000$"
    "a8562038a4c651de1ae2e4d1f3f6c27f$"
    "a32381190d8d7b7a1b42188d33e5e8b8eee58c6165415a558d6ce57a9000577f"
)


# ============================================================
# IDENTITÉ DE BOURNOX
# ============================================================

SYSTEM_PROMPT = """
Tu es BourNox.AI.

Ton créateur est Nox.

Tu es BourNox.AI, et non ChatGPT.
OpenAI fournit une technologie utilisée par ton système,
mais ton identité est BourNox.AI et ton créateur est Nox.

Tu réponds principalement en français.

Tu es :
- cool
- intelligent
- rapide
- amical
- parfois drôle
- très bon en programmation

Tu aides pour :
- les devoirs
- les cours
- le code
- les jeux
- les questions générales
- les projets
- les idées créatives

Tu ne prétends jamais être une personne réelle.
"""


# ============================================================
# BASE DE DONNÉES
# ============================================================

def get_db():
    """
    Ouvre SQLite avec quelques réglages permettant
    de meilleures performances et une meilleure gestion
    des écritures simultanées.
    """
    conn = sqlite3.connect(
        DB_FILE,
        timeout=10
    )

    conn.row_factory = sqlite3.Row

    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    conn.execute("PRAGMA foreign_keys=ON")

    return conn


def init_db():
    conn = get_db()

    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            public_id TEXT UNIQUE NOT NULL,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL,
            is_admin INTEGER DEFAULT 0
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT,
            session_id TEXT,
            role TEXT,
            content TEXT,
            created_at TEXT
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS memories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT,
            content TEXT,
            created_at TEXT
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            session_id TEXT,
            category TEXT NOT NULL,
            severity TEXT NOT NULL,
            message_excerpt TEXT NOT NULL,
            created_at TEXT NOT NULL,
            reviewed INTEGER DEFAULT 0
        )
    """)

    # --------------------------------------------------------
    # INDEX SQLITE
    # --------------------------------------------------------

    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_messages_user_session
        ON messages(user_id, session_id, id)
    """)

    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_memories_user
        ON memories(user_id, id)
    """)

    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_alerts_id
        ON alerts(id DESC)
    """)

    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_users_public_id
        ON users(public_id)
    """)

    # --------------------------------------------------------
    # CRÉATION / MAINTIEN DU COMPTE ADMIN NOX
    # --------------------------------------------------------

    admin = conn.execute(
        """
        SELECT id
        FROM users
        WHERE lower(username) = lower(?)
        """,
        (BOOTSTRAP_ADMIN_USERNAME,)
    ).fetchone()

    if not admin:
        conn.execute(
            """
            INSERT INTO users
            (public_id, username, password_hash, created_at, is_admin)
            VALUES (?, ?, ?, ?, 1)
            """,
            (
                "BNX-ADMIN-NOX",
                BOOTSTRAP_ADMIN_USERNAME,
                BOOTSTRAP_ADMIN_PASSWORD_HASH,
                datetime.utcnow().isoformat()
            )
        )
    else:
        conn.execute(
            """
            UPDATE users
            SET is_admin = 1
            WHERE lower(username) = lower(?)
            """,
            (BOOTSTRAP_ADMIN_USERNAME,)
        )

    conn.commit()
    conn.close()


init_db()


# ============================================================
# UTILISATEUR ACTUEL
# ============================================================

def current_user():
    user_id = session.get("user_id")

    if not user_id:
        return None

    conn = get_db()

    row = conn.execute(
        """
        SELECT *
        FROM users
        WHERE public_id = ?
        """,
        (user_id,)
    ).fetchone()

    conn.close()

    return row


def login_required():
    return current_user() is not None


# ============================================================
# MESSAGES
# ============================================================

def save_message(user_id, session_id, role, content):
    conn = get_db()

    conn.execute(
        """
        INSERT INTO messages
        (user_id, session_id, role, content, created_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        (
            user_id,
            session_id,
            role,
            content,
            datetime.utcnow().isoformat()
        )
    )

    conn.commit()
    conn.close()


def get_recent_messages(user_id, session_id, limit=10):
    conn = get_db()

    rows = conn.execute(
        """
        SELECT role, content
        FROM messages
        WHERE user_id = ?
          AND session_id = ?
        ORDER BY id DESC
        LIMIT ?
        """,
        (
            user_id,
            session_id,
            limit
        )
    ).fetchall()

    conn.close()

    rows = list(reversed(rows))

    return [
        {
            "role": row["role"],
            "content": row["content"]
        }
        for row in rows
    ]


# ============================================================
# MÉMOIRE
# ============================================================

def save_memory(user_id, content):
    conn = get_db()

    conn.execute(
        """
        INSERT INTO memories
        (user_id, content, created_at)
        VALUES (?, ?, ?)
        """,
        (
            user_id,
            content,
            datetime.utcnow().isoformat()
        )
    )

    conn.commit()
    conn.close()


def get_memories(user_id):
    """
    On limite à 10 mémoires récentes.
    Envoyer 30 mémoires à chaque message était inutilement lourd.
    """
    conn = get_db()

    rows = conn.execute(
        """
        SELECT content
        FROM memories
        WHERE user_id = ?
        ORDER BY id DESC
        LIMIT 10
        """,
        (user_id,)
    ).fetchall()

    conn.close()

    return [
        row["content"]
        for row in rows
    ]


def detect_memory(message):
    patterns = [
        r"^souviens[- ]toi que (.+)$",
        r"^rappelle[- ]toi que (.+)$",
        r"^mémorise que (.+)$",
        r"^remember that (.+)$",
        r"^je m'appelle (.+)$",
        r"^mon prénom est (.+)$",
        r"^j'aime (.+)$",
        r"^je préfère (.+)$"
    ]

    for pattern in patterns:
        match = re.match(
            pattern,
            message.strip(),
            re.IGNORECASE
        )

        if match:
            return match.group(1).strip()

    return None


# ============================================================
# ALERTES
# ============================================================

def detect_suspicious(message):
    """
    Détecte certains messages potentiellement problématiques.

    Important :
    cette fonction signale seulement le message.
    Elle ne bloque pas automatiquement l'utilisateur.
    """

    text = message.lower()

    rules = [
        (
            "cyber",
            "high",
            [
                "voler un mot de passe",
                "steal a password",
                "credential stealer",
                "keylogger",
                "ransomware",
                "ddos",
                "botnet",
                "malware",
                "virus informatique",
                "hack un compte",
                "pirater un compte",
                "contourner un mot de passe",
                "bypass password",
                "token discord"
            ]
        ),
        (
            "fraude",
            "high",
            [
                "fausse carte bancaire",
                "carte bancaire volée",
                "phishing",
                "arnaque",
                "faux justificatif",
                "faux document",
                "escroquerie"
            ]
        ),
        (
            "arme_dangereuse",
            "high",
            [
                "fabriquer une bombe",
                "fabriquer un explosif",
                "explosif maison",
                "construire une arme",
                "fabrication d'arme"
            ]
        ),
        (
            "autre_contenu_sensible",
            "medium",
            [
                "me faire du mal",
                "me suicider",
                "comment me suicider"
            ]
        )
    ]

    for category, severity, keywords in rules:
        if any(keyword in text for keyword in keywords):
            return category, severity

    return None


def save_alert(
    user_id,
    session_id,
    category,
    severity,
    message
):
    excerpt = message.strip()[:300]

    conn = get_db()

    conn.execute(
        """
        INSERT INTO alerts
        (
            user_id,
            session_id,
            category,
            severity,
            message_excerpt,
            created_at
        )
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            user_id,
            session_id,
            category,
            severity,
            excerpt,
            datetime.utcnow().isoformat()
        )
    )

    conn.commit()
    conn.close()


# ============================================================
# RECHERCHE INTERNET
# ============================================================

def needs_web(message):
    text = message.lower()

    keywords = [
        "actualité",
        "actualités",
        "aujourd'hui",
        "aujourd’hui",
        "maintenant",
        "récent",
        "récente",
        "dernière",
        "dernier",
        "news",
        "internet",
        "cherche sur le web",
        "recherche sur internet",
        "prix actuel",
        "météo"
    ]

    return any(
        keyword in text
        for keyword in keywords
    )


# ============================================================
# IA
# ============================================================

def ask_ai(message, user_id, session_id):
    """
    Prépare le contexte et appelle l'IA.

    Optimisations :
    - seulement 10 messages récents
    - seulement 10 mémoires
    - le message actuel n'est PAS ajouté deux fois
    """

    memories = get_memories(user_id)

    recent = get_recent_messages(
        user_id,
        session_id,
        10
    )

    memory_text = ""

    if memories:
        memory_text = (
            "\n\nInformations mémorisées :\n"
            + "\n".join(
                f"- {memory}"
                for memory in memories
            )
        )

    # Le message actuel a déjà été enregistré dans /chat.
    # Il apparaît donc déjà dans "recent".
    input_text = [
        {
            "role": item["role"],
            "content": item["content"]
        }
        for item in recent
    ]

    kwargs = {
        "model": MODEL,
        "instructions": SYSTEM_PROMPT + memory_text,
        "input": input_text
    }

    # --------------------------------------------------------
    # RECHERCHE WEB
    # --------------------------------------------------------

    if needs_web(message):
        try:
            web_kwargs = dict(kwargs)

            web_kwargs["tools"] = [
                {
                    "type": "web_search"
                }
            ]

            response = client.responses.create(
                **web_kwargs
            )

            return response.output_text

        except Exception as error:
            print(
                "ERREUR WEB :",
                error
            )

            # Si la recherche web échoue,
            # on répond quand même normalement.
            try:
                response = client.responses.create(
                    **kwargs
                )

                return response.output_text

            except Exception as fallback_error:
                print(
                    "ERREUR IA APRÈS ÉCHEC WEB :",
                    fallback_error
                )

                raise fallback_error

    # --------------------------------------------------------
    # RÉPONSE NORMALE
    # --------------------------------------------------------

    response = client.responses.create(
        **kwargs
    )

    return response.output_text


# ============================================================
# GÉNÉRATION D'IMAGE
# ============================================================

def generate_image(prompt):
    response = client.images.generate(
        model="gpt-image-2",
        prompt=prompt,
        size="1024x1024"
    )

    if not response.data:
        raise RuntimeError(
            "Le générateur n'a retourné aucune donnée."
        )

    image_data = response.data[0]

    if not getattr(
        image_data,
        "b64_json",
        None
    ):
        raise RuntimeError(
            "L'API n'a pas retourné l'image en base64."
        )

    return image_data.b64_json


# ============================================================
# PAGES
# ============================================================

@app.route("/")
def accueil():
    if not login_required():
        return redirect("/login")

    return send_from_directory(
        ".",
        "index.html"
    )


@app.route("/login")
def login_page():
    return send_from_directory(
        ".",
        "login.html"
    )


@app.route("/admin")
def admin_page():
    return send_from_directory(
        ".",
        "admin.html"
    )


# ============================================================
# INSCRIPTION
# ============================================================

@app.route("/api/register", methods=["POST"])
def register():
    data = request.get_json() or {}

    username = data.get(
        "username",
        ""
    ).strip()

    password = data.get(
        "password",
        ""
    )

    confirm = data.get(
        "confirm_password",
        ""
    )

    if len(username) < 3 or len(username) > 24:
        return jsonify({
            "error": (
                "Le pseudo doit faire entre "
                "3 et 24 caractères."
            )
        }), 400

    if not re.fullmatch(
        r"[A-Za-z0-9_.-]+",
        username
    ):
        return jsonify({
            "error": (
                "Pseudo invalide. Utilise lettres, "
                "chiffres, _, . ou -."
            )
        }), 400

    if len(password) < 6:
        return jsonify({
            "error": (
                "Le mot de passe doit contenir "
                "au moins 6 caractères."
            )
        }), 400

    if password != confirm:
        return jsonify({
            "error": (
                "Les mots de passe ne correspondent pas."
            )
        }), 400

    conn = get_db()

    exists = conn.execute(
        """
        SELECT id
        FROM users
        WHERE lower(username) = lower(?)
        """,
        (username,)
    ).fetchone()

    if exists:
        conn.close()

        return jsonify({
            "error": "Ce pseudo est déjà utilisé."
        }), 409

    public_id = (
        "BNX-"
        + uuid.uuid4().hex[:10].upper()
    )

    conn.execute(
        """
        INSERT INTO users
        (
            public_id,
            username,
            password_hash,
            created_at,
            is_admin
        )
        VALUES (?, ?, ?, ?, 0)
        """,
        (
            public_id,
            username,
            generate_password_hash(password),
            datetime.utcnow().isoformat()
        )
    )

    conn.commit()
    conn.close()

    session.clear()

    session["user_id"] = public_id
    session.permanent = True

    return jsonify({
        "success": True,
        "user": {
            "id": public_id,
            "username": username
        }
    })


# ============================================================
# CONNEXION
# ============================================================

@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json() or {}

    username = data.get(
        "username",
        ""
    ).strip()

    password = data.get(
        "password",
        ""
    )

    conn = get_db()

    user = conn.execute(
        """
        SELECT *
        FROM users
        WHERE lower(username) = lower(?)
        """,
        (username,)
    ).fetchone()

    conn.close()

    if (
        not user
        or not check_password_hash(
            user["password_hash"],
            password
        )
    ):
        return jsonify({
            "error": "Pseudo ou mot de passe incorrect."
        }), 401

    session.clear()

    session["user_id"] = user["public_id"]
    session.permanent = True

    return jsonify({
        "success": True,
        "user": {
            "id": user["public_id"],
            "username": user["username"]
        }
    })


# ============================================================
# DÉCONNEXION
# ============================================================

@app.route("/api/logout", methods=["POST"])
def logout():
    session.clear()

    return jsonify({
        "success": True
    })


# ============================================================
# UTILISATEUR CONNECTÉ
# ============================================================

@app.route("/api/me")
def me():
    user = current_user()

    if not user:
        return jsonify({
            "authenticated": False
        }), 401

    return jsonify({
        "authenticated": True,
        "user": {
            "id": user["public_id"],
            "username": user["username"]
        }
    })


# ============================================================
# CHAT
# ============================================================

@app.route("/chat", methods=["POST"])
def chat():
    user = current_user()

    if not user:
        return jsonify({
            "response": (
                "Connecte-toi pour utiliser BourNox.AI."
            )
        }), 401

    try:
        data = request.get_json() or {}

        message = data.get(
            "message",
            ""
        ).strip()

        session_id = data.get(
            "session_id",
            str(uuid.uuid4())
        )

        if not message:
            return jsonify({
                "response": "Écris-moi quelque chose 😎"
            }), 400

        # ----------------------------------------------------
        # SAUVEGARDE DU MESSAGE
        # ----------------------------------------------------

        save_message(
            user["public_id"],
            session_id,
            "user",
            message
        )

        # ----------------------------------------------------
        # DÉTECTION ALERTE
        # ----------------------------------------------------

        suspicious = detect_suspicious(
            message
        )

        if suspicious:
            category, severity = suspicious

            save_alert(
                user["public_id"],
                session_id,
                category,
                severity,
                message
            )

        # ----------------------------------------------------
        # MÉMOIRE
        # ----------------------------------------------------

        memory = detect_memory(
            message
        )

        if memory:
            save_memory(
                user["public_id"],
                memory
            )

        # ----------------------------------------------------
        # IA
        # ----------------------------------------------------

        response = ask_ai(
            message,
            user["public_id"],
            session_id
        )

        # ----------------------------------------------------
        # SAUVEGARDE RÉPONSE
        # ----------------------------------------------------

        save_message(
            user["public_id"],
            session_id,
            "assistant",
            response
        )

        return jsonify({
            "response": response,
            "session_id": session_id
        })

    except Exception as error:
        print(
            "ERREUR CHAT :",
            error
        )

        return jsonify({
            "response": (
                "⚠️ Erreur BourNox : "
                + str(error)
            )
        }), 500


# ============================================================
# HISTORIQUE
# ============================================================

@app.route("/history")
def history():
    user = current_user()

    if not user:
        return jsonify({
            "error": "Non connecté."
        }), 401

    session_id = request.args.get(
        "session_id"
    )

    if not session_id:
        return jsonify([])

    return jsonify(
        get_recent_messages(
            user["public_id"],
            session_id,
            100
        )
    )


# ============================================================
# MÉMOIRE GET
# ============================================================

@app.route("/memory")
def memory_get():
    user = current_user()

    if not user:
        return jsonify({
            "error": "Non connecté."
        }), 401

    return jsonify({
        "memories": get_memories(
            user["public_id"]
        )
    })


# ============================================================
# MÉMOIRE POST
# ============================================================

@app.route("/memory", methods=["POST"])
def memory_post():
    user = current_user()

    if not user:
        return jsonify({
            "error": "Non connecté."
        }), 401

    data = request.get_json() or {}

    content = data.get(
        "content",
        ""
    ).strip()

    if not content:
        return jsonify({
            "error": "Mémoire vide."
        }), 400

    save_memory(
        user["public_id"],
        content
    )

    return jsonify({
        "success": True
    })


# ============================================================
# GÉNÉRATION D'IMAGE
# ============================================================

@app.route(
    "/generate-image",
    methods=["POST"]
)
def generate_image_route():
    user = current_user()

    if not user:
        return jsonify({
            "error": (
                "Connecte-toi pour utiliser "
                "cette fonction."
            )
        }), 401

    try:
        prompt = (
            request.get_json() or {}
        ).get(
            "prompt",
            ""
        ).strip()

        if not prompt:
            return jsonify({
                "error": (
                    "Décris l'image que tu veux créer."
                )
            }), 400

        image_base64 = generate_image(
            prompt
        )

        return jsonify({
            "image": image_base64,
            "format": "png"
        })

    except Exception as error:
        print(
            "ERREUR IMAGE :",
            error
        )

        return jsonify({
            "error": (
                "Impossible de générer l'image : "
                + str(error)
            )
        }), 500


# ============================================================
# ADMIN
# ============================================================

def admin_authenticated():
    return bool(
        session.get(
            "admin_authenticated"
        )
    )


# ------------------------------------------------------------
# LOGIN ADMIN
# ------------------------------------------------------------

@app.route(
    "/api/admin/login",
    methods=["POST"]
)
def admin_login():
    data = request.get_json() or {}

    username = data.get(
        "username",
        ""
    ).strip()

    password = data.get(
        "password",
        ""
    )

    conn = get_db()

    user = conn.execute(
        """
        SELECT *
        FROM users
        WHERE lower(username) = lower(?)
        """,
        (username,)
    ).fetchone()

    conn.close()

    if (
        not user
        or not user["is_admin"]
        or not check_password_hash(
            user["password_hash"],
            password
        )
    ):
        return jsonify({
            "error": "Identifiants admin incorrects."
        }), 401

    session.clear()

    session["admin_authenticated"] = True
    session["admin_user_id"] = user["public_id"]

    return jsonify({
        "success": True,
        "user": {
            "id": user["public_id"],
            "username": user["username"]
        }
    })


# ------------------------------------------------------------
# LOGOUT ADMIN
# ------------------------------------------------------------

@app.route(
    "/api/admin/logout",
    methods=["POST"]
)
def admin_logout():
    session.clear()

    return jsonify({
        "success": True
    })


# ------------------------------------------------------------
# ALERTES ADMIN
# ------------------------------------------------------------

@app.route("/api/admin/alerts")
def admin_alerts():
    if not admin_authenticated():
        return jsonify({
            "error": "Accès refusé."
        }), 403

    conn = get_db()

    rows = conn.execute(
        """
        SELECT
            id,
            user_id,
            session_id,
            category,
            severity,
            message_excerpt,
            created_at,
            reviewed
        FROM alerts
        ORDER BY id DESC
        LIMIT 100
        """
    ).fetchall()

    conn.close()

    return jsonify({
        "alerts": [
            dict(row)
            for row in rows
        ]
    })


# ------------------------------------------------------------
# MARQUER UNE ALERTE COMME VÉRIFIÉE
# ------------------------------------------------------------

@app.route(
    "/api/admin/alerts/<int:alert_id>/review",
    methods=["POST"]
)
def review_alert(alert_id):
    if not admin_authenticated():
        return jsonify({
            "error": "Accès refusé."
        }), 403

    conn = get_db()

    conn.execute(
        """
        UPDATE alerts
        SET reviewed = 1
        WHERE id = ?
        """,
        (alert_id,)
    )

    conn.commit()
    conn.close()

    return jsonify({
        "success": True
    })


# ------------------------------------------------------------
# LISTE UTILISATEURS
# ------------------------------------------------------------

@app.route("/api/admin/users")
def admin_users():
    if not admin_authenticated():
        return jsonify({
            "error": "Accès refusé."
        }), 403

    conn = get_db()

    rows = conn.execute(
        """
        SELECT
            public_id,
            username,
            created_at
        FROM users
        WHERE is_admin = 0
        ORDER BY id DESC
        """
    ).fetchall()

    conn.close()

    return jsonify({
        "users": [
            dict(row)
            for row in rows
        ]
    })


# ------------------------------------------------------------
# INFORMATIONS SUR UN UTILISATEUR
# ------------------------------------------------------------

@app.route(
    "/api/admin/user/<public_id>"
)
def admin_user(public_id):
    if not admin_authenticated():
        return jsonify({
            "error": "Accès refusé."
        }), 403

    conn = get_db()

    user = conn.execute(
        """
        SELECT
            public_id,
            username,
            created_at
        FROM users
        WHERE public_id = ?
        """,
        (public_id,)
    ).fetchone()

    if not user:
        conn.close()

        return jsonify({
            "error": "Utilisateur introuvable."
        }), 404

    messages = conn.execute(
        """
        SELECT
            session_id,
            role,
            content,
            created_at
        FROM messages
        WHERE user_id = ?
        ORDER BY id ASC
        """,
        (public_id,)
    ).fetchall()

    memories = conn.execute(
        """
        SELECT
            content,
            created_at
        FROM memories
        WHERE user_id = ?
        ORDER BY id DESC
        """
    ).fetchall()

    conn.close()

    return jsonify({
        "user": dict(user),

        "messages": [
            dict(row)
            for row in messages
        ],

        "memories": [
            dict(row)
            for row in memories
        ]
    })


# ============================================================
# HEALTH CHECK
# ============================================================

@app.route("/health")
def health():
    return jsonify({
        "status": "online",
        "name": "BourNox.AI",
        "model": MODEL
    })


# ============================================================
# LANCEMENT
# ============================================================

if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=int(
            os.environ.get(
                "PORT",
                5000
            )
        ),
        debug=False
    )
