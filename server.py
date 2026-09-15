from flask import Flask, request, jsonify, send_from_directory
from openai import OpenAI
import sqlite3
import os
import re
import time
import uuid
from pathlib import Path

# ============================================================
# BourNox.AI - cerveau complet v2
# ============================================================
# Fonctionnalités :
# - vraie IA OpenAI
# - personnalité BourNox
# - historique persistant SQLite
# - mémoire longue durée locale
# - contexte des dernières conversations
# - détection de demandes nécessitant Internet
# - endpoints mémoire / historique / santé
# - limite simple anti-spam
#
# IMPORTANT :
# La clé OPENAI_API_KEY reste dans PowerShell / variables
# d'environnement. Ne la mets jamais dans script.js.
# ============================================================

app = Flask(__name__, static_folder=".", static_url_path="")

MODEL = os.getenv("BOURNOX_MODEL", "gpt-5.6-luna")
DB_PATH = Path(__file__).with_name("bournox.db")

client = OpenAI()

SYSTEM_PROMPT = """
Tu es BourNox.AI, une IA personnelle moderne, intelligente, rapide et amicale.
Ton créateur est Nox.
Tu es BourNox.AI, et non ChatGPT.
OpenAI fournit le modèle d'IA utilisé par ton système, mais ton identité et ton projet sont BourNox.AI.

IDENTITÉ
- Ton nom est BourNox.AI.
- Tu réponds principalement en français, sauf si l'utilisateur demande une autre langue.
- Tu es naturel, clair et humain dans ton style, sans prétendre être humain.
- Tu peux utiliser quelques emojis, sans en mettre partout.
- Tu peux être drôle quand le contexte s'y prête.
- Tu aides pour les devoirs, les explications, la rédaction, les idées, le code et les problèmes du quotidien.

RÈGLES
- Réponds directement à la demande.
- Si tu ne sais pas, dis-le au lieu d'inventer.
- Pour les informations récentes, utilise Internet quand l'outil de recherche est disponible.
- Pour le code, donne du code propre et explique brièvement ce qu'il fait.
- Ne révèle jamais de clé API, mot de passe ou secret.
- Ne prétends pas avoir effectué une action que tu n'as pas réellement effectuée.
- Respecte les règles de sécurité et refuse les demandes dangereuses ou illégales.
- Pour un devoir scolaire, aide l'élève à comprendre plutôt que de simplement faire semblant d'avoir réfléchi à sa place.
"""

# ---------- Base de données ----------

def db():
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    return con

def init_db():
    con = db()
    con.executescript("""
    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at REAL NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_messages_session
    ON messages(session_id, id);

    CREATE TABLE IF NOT EXISTS memories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        memory TEXT NOT NULL,
        created_at REAL NOT NULL,
        UNIQUE(user_id, memory)
    );

    CREATE INDEX IF NOT EXISTS idx_memories_user
    ON memories(user_id);
    """)
    con.commit()
    con.close()

init_db()

# ---------- Anti-spam local très simple ----------

rate_log = {}

def allowed(client_id, limit=25, window=60):
    now = time.time()
    events = [t for t in rate_log.get(client_id, []) if now - t < window]
    if len(events) >= limit:
        rate_log[client_id] = events
        return False
    events.append(now)
    rate_log[client_id] = events
    return True

# ---------- Historique ----------

def save_message(session_id, role, content):
    con = db()
    con.execute(
        "INSERT INTO messages(session_id, role, content, created_at) VALUES (?, ?, ?, ?)",
        (session_id, role, content, time.time())
    )
    con.commit()
    con.close()

def get_recent_messages(session_id, limit=18):
    con = db()
    rows = con.execute(
        """
        SELECT role, content
        FROM messages
        WHERE session_id = ?
        ORDER BY id DESC
        LIMIT ?
        """,
        (session_id, limit)
    ).fetchall()
    con.close()
    return list(reversed(rows))

# ---------- Mémoire longue durée ----------

MEMORY_PATTERNS = [
    r"\b(?:souviens[- ]toi|rappelle[- ]toi|mémorise|memorise|remember)\s*(?:que)?\s*(.+)",
    r"\bje m['’]appelle\s+(.+)",
    r"\bmon prénom est\s+(.+)",
    r"\bj['’]aime\s+(.+)",
    r"\bje préfère\s+(.+)",
]

def extract_explicit_memories(text):
    memories = []
    clean = " ".join(text.strip().split())

    for pattern in MEMORY_PATTERNS:
        match = re.search(pattern, clean, flags=re.IGNORECASE)
        if match:
            value = match.group(1).strip(" .!?")
            if value:
                memories.append(value)

    return memories[:3]

def save_memory(user_id, memory):
    memory = memory[:500]
    con = db()
    con.execute(
        "INSERT OR IGNORE INTO memories(user_id, memory, created_at) VALUES (?, ?, ?)",
        (user_id, memory, time.time())
    )
    con.commit()
    con.close()

def get_memories(user_id, limit=30):
    con = db()
    rows = con.execute(
        """
        SELECT memory
        FROM memories
        WHERE user_id = ?
        ORDER BY id DESC
        LIMIT ?
        """,
        (user_id, limit)
    ).fetchall()
    con.close()
    return [row["memory"] for row in rows]

# ---------- Détection Internet ----------

WEB_WORDS = (
    "actualité", "actualités", "aujourd'hui", "aujourd’hui", "maintenant",
    "récent", "récente", "dernières nouvelles", "news", "prix actuel",
    "cours actuel", "météo", "score", "résultat", "qui est le président",
    "cette semaine", "ce mois", "2026", "2025"
)

def needs_web(text):
    low = text.lower()
    return any(word in low for word in WEB_WORDS)

# ---------- Appels IA ----------

def build_input(session_id, user_id, message):
    memories = get_memories(user_id)
    history = get_recent_messages(session_id)

    memory_block = "\n".join(f"- {m}" for m in memories) if memories else "- Aucune mémoire enregistrée."

    history_block = []
    for row in history:
        history_block.append({
            "role": row["role"],
            "content": row["content"]
        })

    # Les instructions restent séparées du message utilisateur.
    contextual = f"""
MÉMOIRE UTILISATEUR :
{memory_block}

Utilise ces informations seulement si elles sont pertinentes.

HISTORIQUE RÉCENT :
{history_block}

NOUVEAU MESSAGE UTILISATEUR :
{message}
"""
    return contextual

def ask_ai(session_id, user_id, message):
    input_text = build_input(session_id, user_id, message)

    kwargs = {
        "model": MODEL,
        "instructions": SYSTEM_PROMPT,
        "input": input_text,
    }

    # On tente la recherche Web seulement quand la demande semble récente.
    # Si le compte/modèle ne supporte pas le nom d'outil, on retente sans outil.
    if needs_web(message):
        try:
            web_kwargs = dict(kwargs)
            web_kwargs["tools"] = [{"type": "web_search"}]
            response = client.responses.create(**web_kwargs)
            return response.output_text
        except Exception:
            try:
                web_kwargs = dict(kwargs)
                web_kwargs["tools"] = [{"type": "web_search_preview"}]
                response = client.responses.create(**web_kwargs)
                return response.output_text
            except Exception:
                pass

    response = client.responses.create(**kwargs)
    return response.output_text

# ---------- Routes ----------

@app.route("/")
def accueil():
    return send_from_directory(".", "index.html")

@app.route("/chat", methods=["POST"])
def chat():
    client_id = request.remote_addr or "local"
    if not allowed(client_id):
        return jsonify({"response": "Doucement 😭 Trop de messages en même temps. Réessaie dans quelques secondes."}), 429

    data = request.get_json(silent=True) or {}
    message = str(data.get("message", "")).strip()
    session_id = str(data.get("session_id") or "local-session")[:100]
    user_id = str(data.get("user_id") or "local-user")[:100]

    if not message:
        return jsonify({"response": "Écris-moi quelque chose et je te réponds 🤖."}), 400

    if len(message) > 8000:
        return jsonify({"response": "Ton message est trop long pour cette version de BourNox."}), 400

    save_message(session_id, "user", message)

    # Mémoire explicite : on ne mémorise pas tout automatiquement.
    for memory in extract_explicit_memories(message):
        save_memory(user_id, memory)

    try:
        answer = ask_ai(session_id, user_id, message)
        if not answer:
            answer = "Je n'ai pas réussi à produire une réponse cette fois-ci."
        save_message(session_id, "assistant", answer)
        return jsonify({
            "response": answer,
            "session_id": session_id,
            "memory_saved": extract_explicit_memories(message)
        })
    except Exception as e:
        # On garde le message utilisateur dans l'historique mais pas une fausse réponse.
        print("BOURNOX ERROR:", repr(e))
        return jsonify({
            "response": "Le cerveau BourNox a rencontré une erreur. Vérifie ta clé API et le terminal du serveur."
        }), 500

@app.route("/history", methods=["GET"])
def history():
    session_id = request.args.get("session_id", "local-session")[:100]
    rows = get_recent_messages(session_id, 100)
    return jsonify({
        "messages": [
            {"role": row["role"], "content": row["content"]}
            for row in rows
        ]
    })

@app.route("/history", methods=["DELETE"])
def clear_history():
    session_id = request.args.get("session_id", "local-session")[:100]
    con = db()
    con.execute("DELETE FROM messages WHERE session_id = ?", (session_id,))
    con.commit()
    con.close()
    return jsonify({"ok": True})

@app.route("/memory", methods=["GET"])
def memory_list():
    user_id = request.args.get("user_id", "local-user")[:100]
    return jsonify({"memories": get_memories(user_id, 100)})

@app.route("/memory", methods=["POST"])
def memory_add():
    data = request.get_json(silent=True) or {}
    user_id = str(data.get("user_id") or "local-user")[:100]
    memory = str(data.get("memory") or "").strip()
    if not memory:
        return jsonify({"error": "Mémoire vide"}), 400
    save_memory(user_id, memory)
    return jsonify({"ok": True, "memories": get_memories(user_id, 100)})

@app.route("/memory", methods=["DELETE"])
def memory_clear():
    user_id = request.args.get("user_id", "local-user")[:100]
    con = db()
    con.execute("DELETE FROM memories WHERE user_id = ?", (user_id,))
    con.commit()
    con.close()
    return jsonify({"ok": True})

@app.route("/health")
def health():
    return jsonify({
        "ok": True,
        "name": "BourNox.AI",
        "model": MODEL,
        "memory": True,
        "history": True,
        "web_detection": True
    })

if __name__ == "__main__":
    print("======================================")
    print("      BourNox.AI - CERVEAU ACTIF")
    print("======================================")
    print(f"Modèle : {MODEL}")
    print("URL    : http://127.0.0.1:5000")
    print("Arrêt  : Ctrl+C")
    print("======================================")
    app.run(host="0.0.0.0", port=5000, debug=True)
