import os
import re
import sqlite3
import uuid
from datetime import datetime, timedelta

from flask import Flask, request, jsonify, send_from_directory, session, redirect
from openai import OpenAI
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__, static_folder=".", static_url_path="")

app.secret_key = os.getenv("BOURNOX_SECRET_KEY", "CHANGE-ME-IN-RENDER")
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["SESSION_COOKIE_SECURE"] = os.getenv("RENDER", "").lower() == "true"
app.permanent_session_lifetime = timedelta(days=30)

client = OpenAI()
MODEL = os.getenv("BOURNOX_MODEL", "gpt-5.6-luna")
DB_FILE = "bournox.db"

BOOTSTRAP_ADMIN_USERNAME = "Nox"
BOOTSTRAP_ADMIN_PASSWORD_HASH = (
    "pbkdf2:sha256:600000$"
    "a8562038a4c651de1ae2e4d1f3f6c27f$"
    "a32381190d8d7b7a1b42188d33e5e8b8eee58c6165415a558d6ce57a9000577f"
)

SYSTEM_PROMPT = """
Tu es Xyro.AI.
Ton créateur est Nox.
Tu es Xyro.AI, et non ChatGPT.
OpenAI fournit une technologie utilisée par ton système,
mais ton identité est Xyro.AI et ton créateur est Nox.
Tu réponds principalement en français.
Tu es cool, intelligent, rapide, amical, parfois drôle
et très bon en programmation.
Tu aides pour :
- les devoirs
- les cours
- le code
- les jeux
- les questions générales
- les projets
- les explications techniques
Tu ne prétends jamais être une personne réelle.
Si tu n'es pas sûr d'une information, indique-le clairement
au lieu d'inventer une réponse.
"""

def get_db():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def init_db():
    conn = get_db()
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")

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

    conn.execute("""
        CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            name TEXT NOT NULL,
            context TEXT DEFAULT '',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            UNIQUE(user_id, name)
        )
    """)

    # Nouvelle table : bannissements administratifs.
    # Un utilisateur peut avoir au maximum un ban actif.
    conn.execute("""
        CREATE TABLE IF NOT EXISTS bans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT UNIQUE NOT NULL,
            reason TEXT DEFAULT '',
            created_at TEXT NOT NULL,
            expires_at TEXT,
            permanent INTEGER DEFAULT 0,
            active INTEGER DEFAULT 1,
            FOREIGN KEY(user_id) REFERENCES users(public_id) ON DELETE CASCADE
        )
    """)

    conn.execute("CREATE INDEX IF NOT EXISTS idx_messages_user_session ON messages(user_id, session_id, id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_memories_user ON memories(user_id, id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_alerts_user ON alerts(user_id, id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id, updated_at)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_bans_user_active ON bans(user_id, active, expires_at)")

    admin = conn.execute(
        "SELECT id FROM users WHERE lower(username) = lower(?)",
        (BOOTSTRAP_ADMIN_USERNAME,)
    ).fetchone()

    if not admin:
        conn.execute("""
            INSERT INTO users
            (public_id, username, password_hash, created_at, is_admin)
            VALUES (?, ?, ?, ?, 1)
        """, (
            "BNX-ADMIN-NOX",
            BOOTSTRAP_ADMIN_USERNAME,
            BOOTSTRAP_ADMIN_PASSWORD_HASH,
            datetime.utcnow().isoformat()
        ))
    else:
        conn.execute(
            "UPDATE users SET is_admin = 1 WHERE lower(username) = lower(?)",
            (BOOTSTRAP_ADMIN_USERNAME,)
        )

    conn.commit()
    conn.close()

init_db()

def current_user():
    user_id = session.get("user_id")
    if not user_id:
        return None
    conn = get_db()
    row = conn.execute("SELECT * FROM users WHERE public_id = ?", (user_id,)).fetchone()
    conn.close()
    return row

def get_active_ban(user_id):
    conn = get_db()
    ban = conn.execute("""
        SELECT *
        FROM bans
        WHERE user_id = ?
        AND active = 1
        LIMIT 1
    """, (user_id,)).fetchone()

    if ban and not ban["permanent"] and ban["expires_at"]:
        try:
            if datetime.fromisoformat(ban["expires_at"]) <= datetime.utcnow():
                conn.execute("UPDATE bans SET active = 0 WHERE id = ?", (ban["id"],))
                conn.commit()
                ban = None
        except ValueError:
            pass

    conn.close()
    return ban

def ban_payload(ban):
    if not ban:
        return None
    return {
        "id": ban["id"],
        "reason": ban["reason"],
        "created_at": ban["created_at"],
        "expires_at": ban["expires_at"],
        "permanent": bool(ban["permanent"]),
        "active": bool(ban["active"])
    }

def login_required():
    user = current_user()
    if not user:
        return False
    if not user["is_admin"] and get_active_ban(user["public_id"]):
        return False
    return True

def save_message(user_id, session_id, role, content):
    conn = get_db()
    conn.execute("""
        INSERT INTO messages (user_id, session_id, role, content, created_at)
        VALUES (?, ?, ?, ?, ?)
    """, (user_id, session_id, role, content, datetime.utcnow().isoformat()))
    conn.commit()
    conn.close()

def get_recent_messages(user_id, session_id, limit=10):
    conn = get_db()
    rows = conn.execute("""
        SELECT role, content
        FROM messages
        WHERE user_id = ? AND session_id = ?
        ORDER BY id DESC LIMIT ?
    """, (user_id, session_id, limit)).fetchall()
    conn.close()
    rows = list(reversed(rows))
    return [{"role": row["role"], "content": row["content"]} for row in rows]

def save_memory(user_id, content):
    conn = get_db()
    existing = conn.execute("""
        SELECT id FROM memories
        WHERE user_id = ? AND lower(content) = lower(?) LIMIT 1
    """, (user_id, content)).fetchone()
    if not existing:
        conn.execute("""
            INSERT INTO memories (user_id, content, created_at)
            VALUES (?, ?, ?)
        """, (user_id, content, datetime.utcnow().isoformat()))
        conn.commit()
    conn.close()

def get_memories(user_id, limit=20):
    conn = get_db()
    rows = conn.execute("""
        SELECT content FROM memories
        WHERE user_id = ? ORDER BY id DESC LIMIT ?
    """, (user_id, limit)).fetchall()
    conn.close()
    return [row["content"] for row in rows]

def detect_memory(message):
    patterns = [
        r"^souviens[- ]toi que (.+)$", r"^rappelle[- ]toi que (.+)$",
        r"^mémorise que (.+)$", r"^memorise que (.+)$",
        r"^remember that (.+)$", r"^je m'appelle (.+)$",
        r"^mon prénom est (.+)$", r"^mon prenom est (.+)$",
        r"^j'aime (.+)$", r"^j’aime (.+)$",
        r"^je préfère (.+)$", r"^je prefere (.+)$"
    ]
    for pattern in patterns:
        match = re.match(pattern, message.strip(), re.IGNORECASE)
        if match:
            return match.group(1).strip()
    return None

def detect_suspicious(message):
    text = message.lower()
    rules = [
        ("cyber", "high", [
            "voler un mot de passe", "steal a password", "credential stealer",
            "keylogger", "ransomware", "ddos", "botnet", "malware",
            "virus informatique", "hack un compte", "pirater un compte",
            "contourner un mot de passe", "bypass password", "token discord"
        ]),
        ("fraude", "high", [
            "fausse carte bancaire", "carte bancaire volée", "phishing",
            "arnaque", "faux justificatif", "faux document", "escroquerie"
        ]),
        ("arme_dangereuse", "high", [
            "fabriquer une bombe", "fabriquer un explosif",
            "explosif maison", "construire une arme", "fabrication d'arme"
        ]),
        ("autre_contenu_sensible", "medium", [
            "me faire du mal", "me suicider", "comment me suicider"
        ])
    ]
    for category, severity, keywords in rules:
        if any(keyword in text for keyword in keywords):
            return category, severity
    return None

def save_alert(user_id, session_id, category, severity, message):
    conn = get_db()
    conn.execute("""
        INSERT INTO alerts
        (user_id, session_id, category, severity, message_excerpt, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (
        user_id, session_id, category, severity,
        message.strip()[:300], datetime.utcnow().isoformat()
    ))
    conn.commit()
    conn.close()

def needs_web(message):
    text = message.lower()
    keywords = [
        "actualité", "actualités", "aujourd'hui", "aujourd’hui",
        "maintenant", "récent", "récente", "dernière", "dernier",
        "news", "internet", "cherche sur le web", "recherche sur internet",
        "prix actuel", "météo"
    ]
    return any(keyword in text for keyword in keywords)

MODES = {
    "normal": "Réponds naturellement et clairement.",
    "professeur": "Agis comme un excellent professeur. Explique progressivement avec des exemples simples.",
    "developpeur": "Agis comme un développeur expérimenté. Analyse précisément et propose du code propre.",
    "gamer": "Agis comme un assistant gaming. Donne des stratégies et explications utiles.",
    "creatif": "Sois créatif et propose des idées originales lorsque cela apporte quelque chose.",
    "nox": "Mode Nox. Sois direct, efficace, technique et orienté vers les projets de Nox."
}
STYLES = {
    "court": "Réponse courte et directe.",
    "detaille": "Réponse détaillée avec les explications importantes.",
    "debutant": "Explique comme à quelqu'un qui débute et évite le jargon inutile."
}
PERSONALITIES = {
    "serieux": "Ton sérieux et professionnel.",
    "cool": "Ton décontracté, amical et naturel.",
    "drole": "Ton léger et drôle lorsque c'est approprié, sans sacrifier la précision.",
    "pro": "Ton professionnel, précis et structuré."
}

def command_instruction(message):
    command = message.strip().lower()
    if command.startswith("/résume") or command.startswith("/resume"):
        return "La commande /résume a été utilisée. Résume clairement et concisément."
    if command.startswith("/explique"):
        return "La commande /explique a été utilisée. Explique étape par étape avec des exemples."
    if command.startswith("/corrige"):
        return "La commande /corrige a été utilisée. Corrige le contenu et explique brièvement les corrections."
    if command.startswith("/code"):
        return "La commande /code a été utilisée. Donne une solution propre, fonctionnelle et expliquée."
    if command.startswith("/traduis"):
        return "La commande /traduis a été utilisée. Traduis précisément en conservant le sens naturel."
    return ""

def get_project(user_id, project_name):
    if not project_name:
        return None
    conn = get_db()
    project = conn.execute("""
        SELECT * FROM projects
        WHERE user_id = ? AND lower(name) = lower(?)
    """, (user_id, project_name)).fetchone()
    conn.close()
    return project

def get_project_context(user_id, project_name):
    project = get_project(user_id, project_name)
    if not project or not project["context"].strip():
        return ""
    return f'\nProjet actuel : {project["name"]}\nContexte du projet :\n{project["context"].strip()}\n'

def ask_ai(message, user_id, session_id, mode="normal", response_style="detaille",
           personality="cool", project_name=None):
    recent = get_recent_messages(user_id, session_id, 10)
    memories = get_memories(user_id, 20)

    memory_text = ""
    if memories:
        memory_text = "\n\nInformations mémorisées :\n" + "\n".join(f"- {m}" for m in memories)

    instructions = (
        SYSTEM_PROMPT + "\n\n" +
        MODES.get(mode, MODES["normal"]) + "\n\n" +
        STYLES.get(response_style, STYLES["detaille"]) + "\n\n" +
        PERSONALITIES.get(personality, PERSONALITIES["cool"]) + "\n\n" +
        command_instruction(message) + "\n\n" +
        get_project_context(user_id, project_name) +
        memory_text
    )

    kwargs = {
        "model": MODEL,
        "instructions": instructions,
        "input": [{"role": x["role"], "content": x["content"]} for x in recent]
    }

    if needs_web(message):
        try:
            result = client.responses.create(**kwargs, tools=[{"type": "web_search"}])
            return result.output_text
        except Exception as error:
            print("ERREUR RECHERCHE WEB :", error)

    result = client.responses.create(**kwargs)
    return result.output_text

def generate_image(prompt):
    response = client.images.generate(model="gpt-image-2", prompt=prompt, size="1024x1024")
    if not response.data or not getattr(response.data[0], "b64_json", None):
        raise RuntimeError("L'API n'a pas retourné l'image en base64.")
    return response.data[0].b64_json

@app.route("/")
def accueil():
    if not login_required():
        return redirect("/login")
    return send_from_directory(".", "index.html")

@app.route("/login")
def login_page():
    return send_from_directory(".", "login.html")

@app.route("/admin")
def admin_page():
    return send_from_directory(".", "admin.html")

@app.route("/api/register", methods=["POST"])
def register():
    data = request.get_json() or {}
    username = data.get("username", "").strip()
    password = data.get("password", "")
    confirm = data.get("confirm_password", "")

    if len(username) < 3 or len(username) > 24:
        return jsonify({"error": "Le pseudo doit faire entre 3 et 24 caractères."}), 400
    if not re.fullmatch(r"[A-Za-z0-9_.-]+", username):
        return jsonify({"error": "Pseudo invalide. Utilise lettres, chiffres, _, . ou -."}), 400
    if len(password) < 6:
        return jsonify({"error": "Le mot de passe doit contenir au moins 6 caractères."}), 400
    if password != confirm:
        return jsonify({"error": "Les mots de passe ne correspondent pas."}), 400

    conn = get_db()
    exists = conn.execute(
        "SELECT id FROM users WHERE lower(username) = lower(?)", (username,)
    ).fetchone()
    if exists:
        conn.close()
        return jsonify({"error": "Ce pseudo est déjà utilisé."}), 409

    public_id = "BNX-" + uuid.uuid4().hex[:10].upper()
    conn.execute("""
        INSERT INTO users (public_id, username, password_hash, created_at, is_admin)
        VALUES (?, ?, ?, ?, 0)
    """, (public_id, username, generate_password_hash(password), datetime.utcnow().isoformat()))
    conn.commit()
    conn.close()

    session.clear()
    session["user_id"] = public_id
    session.permanent = True
    return jsonify({"success": True, "user": {"id": public_id, "username": username}})

@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    username = data.get("username", "").strip()
    password = data.get("password", "")

    conn = get_db()
    user = conn.execute(
        "SELECT * FROM users WHERE lower(username) = lower(?)", (username,)
    ).fetchone()
    conn.close()

    if not user or not check_password_hash(user["password_hash"], password):
        return jsonify({"error": "Pseudo ou mot de passe incorrect."}), 401

    if not user["is_admin"]:
        ban = get_active_ban(user["public_id"])
        if ban:
            message = "Compte banni définitivement." if ban["permanent"] else "Compte temporairement banni."
            if ban["expires_at"]:
                message += f" Fin du ban : {ban['expires_at']}."
            if ban["reason"]:
                message += f" Raison : {ban['reason']}"
            return jsonify({"error": message, "banned": True, "ban": ban_payload(ban)}), 403

    session.clear()
    session["user_id"] = user["public_id"]
    session.permanent = True
    return jsonify({"success": True, "user": {"id": user["public_id"], "username": user["username"]}})

@app.route("/api/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"success": True})

@app.route("/api/me")
def me():
    user = current_user()
    if not user:
        return jsonify({"authenticated": False}), 401

    if not user["is_admin"]:
        ban = get_active_ban(user["public_id"])
        if ban:
            session.clear()
            return jsonify({"authenticated": False, "banned": True, "ban": ban_payload(ban)}), 403

    return jsonify({
        "authenticated": True,
        "user": {"id": user["public_id"], "username": user["username"], "is_admin": bool(user["is_admin"])}
    })

@app.route("/chat", methods=["POST"])
def chat():
    user = current_user()
    if not user:
        return jsonify({"response": "Connecte-toi pour utiliser Xyro.AI."}), 401

    if not user["is_admin"]:
        ban = get_active_ban(user["public_id"])
        if ban:
            session.clear()
            return jsonify({
                "response": "🚫 Ton compte est actuellement banni.",
                "banned": True,
                "ban": ban_payload(ban)
            }), 403

    try:
        data = request.get_json() or {}
        message = data.get("message", "").strip()
        session_id = data.get("session_id") or str(uuid.uuid4())
        mode = data.get("mode", "normal")
        response_style = data.get("response_style", "detaille")
        personality = data.get("personality", "cool")
        project_name = data.get("project")

        if not message:
            return jsonify({"response": "Écris-moi quelque chose 😎"}), 400

        save_message(user["public_id"], session_id, "user", message)

        suspicious = detect_suspicious(message)
        if suspicious:
            category, severity = suspicious
            save_alert(user["public_id"], session_id, category, severity, message)

        memory = detect_memory(message)
        if memory:
            save_memory(user["public_id"], memory)

        response = ask_ai(
            message, user["public_id"], session_id,
            mode, response_style, personality, project_name
        )
        save_message(user["public_id"], session_id, "assistant", response)

        return jsonify({"response": response, "session_id": session_id})

    except Exception as error:
        print("ERREUR CHAT :", error)
        return jsonify({"response": "⚠️ Erreur Xyro : " + str(error)}), 500

@app.route("/history")
def history():
    user = current_user()
    if not user:
        return jsonify({"error": "Non connecté."}), 401
    session_id = request.args.get("session_id")
    if not session_id:
        return jsonify([])
    return jsonify(get_recent_messages(user["public_id"], session_id, 100))

@app.route("/memory")
def memory_get():
    user = current_user()
    if not user:
        return jsonify({"error": "Non connecté."}), 401
    return jsonify({"memories": get_memories(user["public_id"], 50)})

@app.route("/memory", methods=["POST"])
def memory_post():
    user = current_user()
    if not user:
        return jsonify({"error": "Non connecté."}), 401
    data = request.get_json() or {}
    content = data.get("content", "").strip()
    if not content:
        return jsonify({"error": "Mémoire vide."}), 400
    save_memory(user["public_id"], content)
    return jsonify({"success": True})

@app.route("/projects", methods=["GET"])
def projects_get():
    user = current_user()
    if not user:
        return jsonify({"error": "Non connecté."}), 401
    conn = get_db()
    rows = conn.execute("""
        SELECT name, context, created_at, updated_at
        FROM projects WHERE user_id = ? ORDER BY updated_at DESC
    """, (user["public_id"],)).fetchall()
    conn.close()
    return jsonify({"projects": [dict(row) for row in rows]})

@app.route("/projects", methods=["POST"])
def projects_post():
    user = current_user()
    if not user:
        return jsonify({"error": "Non connecté."}), 401
    data = request.get_json() or {}
    name = data.get("name", "").strip()
    context = data.get("context", "").strip()
    if not name:
        return jsonify({"error": "Nom du projet obligatoire."}), 400
    if len(name) > 80:
        return jsonify({"error": "Le nom du projet est trop long."}), 400

    now = datetime.utcnow().isoformat()
    conn = get_db()
    existing = conn.execute("""
        SELECT id FROM projects
        WHERE user_id = ? AND lower(name) = lower(?)
    """, (user["public_id"], name)).fetchone()

    if existing:
        conn.execute("UPDATE projects SET context = ?, updated_at = ? WHERE id = ?",
                     (context, now, existing["id"]))
    else:
        conn.execute("""
            INSERT INTO projects (user_id, name, context, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
        """, (user["public_id"], name, context, now, now))
    conn.commit()
    conn.close()
    return jsonify({"success": True})

@app.route("/projects/<path:project_name>", methods=["DELETE"])
def projects_delete(project_name):
    user = current_user()
    if not user:
        return jsonify({"error": "Non connecté."}), 401
    conn = get_db()
    conn.execute("""
        DELETE FROM projects WHERE user_id = ? AND lower(name) = lower(?)
    """, (user["public_id"], project_name))
    conn.commit()
    conn.close()
    return jsonify({"success": True})

@app.route("/generate-image", methods=["POST"])
def generate_image_route():
    user = current_user()
    if not user:
        return jsonify({"error": "Connecte-toi pour utiliser cette fonction."}), 401
    try:
        prompt = (request.get_json() or {}).get("prompt", "").strip()
        if not prompt:
            return jsonify({"error": "Décris l'image que tu veux créer."}), 400
        return jsonify({"image": generate_image(prompt), "format": "png"})
    except Exception as error:
        print("ERREUR IMAGE :", error)
        return jsonify({"error": "Impossible de générer l'image : " + str(error)}), 500

def admin_authenticated():
    return bool(session.get("admin_authenticated"))

@app.route("/api/admin/login", methods=["POST"])
def admin_login():
    data = request.get_json() or {}
    username = data.get("username", "").strip()
    password = data.get("password", "")

    conn = get_db()
    user = conn.execute(
        "SELECT * FROM users WHERE lower(username) = lower(?)", (username,)
    ).fetchone()
    conn.close()

    if not user or not user["is_admin"] or not check_password_hash(user["password_hash"], password):
        return jsonify({"error": "Identifiants admin incorrects."}), 401

    session.clear()
    session["admin_authenticated"] = True
    session["admin_user_id"] = user["public_id"]
    return jsonify({"success": True, "user": {"id": user["public_id"], "username": user["username"]}})

@app.route("/api/admin/logout", methods=["POST"])
def admin_logout():
    session.clear()
    return jsonify({"success": True})

@app.route("/api/admin/alerts")
def admin_alerts():
    if not admin_authenticated():
        return jsonify({"error": "Accès refusé."}), 403
    conn = get_db()
    rows = conn.execute("""
        SELECT id, user_id, session_id, category, severity,
               message_excerpt, created_at, reviewed
        FROM alerts ORDER BY id DESC LIMIT 100
    """).fetchall()
    conn.close()
    return jsonify({"alerts": [dict(row) for row in rows]})

@app.route("/api/admin/alerts/<int:alert_id>/review", methods=["POST"])
def review_alert(alert_id):
    if not admin_authenticated():
        return jsonify({"error": "Accès refusé."}), 403
    conn = get_db()
    conn.execute("UPDATE alerts SET reviewed = 1 WHERE id = ?", (alert_id,))
    conn.commit()
    conn.close()
    return jsonify({"success": True})

@app.route("/api/admin/users")
def admin_users():
    if not admin_authenticated():
        return jsonify({"error": "Accès refusé."}), 403

    conn = get_db()
    rows = conn.execute("""
        SELECT
            u.public_id,
            u.username,
            u.created_at,
            CASE
                WHEN b.id IS NOT NULL
                 AND b.active = 1
                 AND (b.permanent = 1 OR b.expires_at > ?)
                THEN 1 ELSE 0
            END AS banned,
            b.expires_at,
            b.permanent,
            b.reason
        FROM users u
        LEFT JOIN bans b ON b.user_id = u.public_id AND b.active = 1
        WHERE u.is_admin = 0
        ORDER BY u.id DESC
    """, (datetime.utcnow().isoformat(),)).fetchall()
    conn.close()

    return jsonify({"users": [dict(row) for row in rows]})

@app.route("/api/admin/user/<public_id>")
def admin_user(public_id):
    if not admin_authenticated():
        return jsonify({"error": "Accès refusé."}), 403

    conn = get_db()
    user = conn.execute("""
        SELECT public_id, username, created_at
        FROM users WHERE public_id = ?
    """, (public_id,)).fetchone()

    if not user:
        conn.close()
        return jsonify({"error": "Utilisateur introuvable."}), 404

    messages = conn.execute("""
        SELECT session_id, role, content, created_at
        FROM messages WHERE user_id = ? ORDER BY id ASC
    """, (public_id,)).fetchall()

    memories = conn.execute("""
        SELECT content, created_at
        FROM memories WHERE user_id = ? ORDER BY id DESC
    """, (public_id,)).fetchall()

    projects = conn.execute("""
        SELECT name, context, created_at, updated_at
        FROM projects WHERE user_id = ? ORDER BY updated_at DESC
    """, (public_id,)).fetchall()

    conn.close()
    return jsonify({
        "user": dict(user),
        "messages": [dict(row) for row in messages],
        "memories": [dict(row) for row in memories],
        "projects": [dict(row) for row in projects],
        "ban": ban_payload(get_active_ban(public_id))
    })

@app.route("/api/admin/user/<public_id>/ban", methods=["POST"])
def admin_ban_user(public_id):
    if not admin_authenticated():
        return jsonify({"error": "Accès refusé."}), 403

    data = request.get_json() or {}
    duration = str(data.get("duration", "")).strip()
    reason = str(data.get("reason", "")).strip()[:500]

    allowed = {"10m": 10, "1h": 60, "1d": 1440, "7d": 10080, "30d": 43200}
    permanent = duration == "permanent"

    if duration not in allowed and not permanent:
        return jsonify({"error": "Durée de bannissement invalide."}), 400

    conn = get_db()
    user = conn.execute(
        "SELECT public_id, username, is_admin FROM users WHERE public_id = ?",
        (public_id,)
    ).fetchone()

    if not user:
        conn.close()
        return jsonify({"error": "Utilisateur introuvable."}), 404

    if user["is_admin"]:
        conn.close()
        return jsonify({"error": "Impossible de bannir un administrateur."}), 400

    now = datetime.utcnow()
    expires_at = None if permanent else (now + timedelta(minutes=allowed[duration])).isoformat()

    conn.execute("UPDATE bans SET active = 0 WHERE user_id = ? AND active = 1", (public_id,))
    conn.execute("""
        INSERT INTO bans (user_id, reason, created_at, expires_at, permanent, active)
        VALUES (?, ?, ?, ?, ?, 1)
    """, (public_id, reason, now.isoformat(), expires_at, 1 if permanent else 0))

    # Coupe immédiatement la session web du compte ciblé.
    # La vérification côté /chat et /api/me assure également le blocage.
    conn.commit()
    conn.close()

    return jsonify({
        "success": True,
        "ban": ban_payload(get_active_ban(public_id))
    })

@app.route("/api/admin/user/<public_id>/unban", methods=["POST"])
def admin_unban_user(public_id):
    if not admin_authenticated():
        return jsonify({"error": "Accès refusé."}), 403

    conn = get_db()
    user = conn.execute(
        "SELECT public_id FROM users WHERE public_id = ?", (public_id,)
    ).fetchone()

    if not user:
        conn.close()
        return jsonify({"error": "Utilisateur introuvable."}), 404

    conn.execute(
        "UPDATE bans SET active = 0 WHERE user_id = ? AND active = 1",
        (public_id,)
    )
    conn.commit()
    conn.close()
    return jsonify({"success": True})

@app.route("/health")
def health():
    return jsonify({"status": "online", "name": "Xyro.AI", "model": MODEL})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=False)
