import os
import re
import sqlite3
import uuid
from datetime import datetime

from flask import Flask, request, jsonify, send_from_directory
from openai import OpenAI


# =========================================================
# CONFIGURATION
# =========================================================

app = Flask(__name__, static_folder=".", static_url_path="")

client = OpenAI()

MODEL = os.getenv("BOURNOX_MODEL", "gpt-5.6-luna")

DB_FILE = "bournox.db"


# =========================================================
# IDENTITÉ DE BOURNOX
# =========================================================

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
- utile
- très bon en programmation

Tu aides l'utilisateur pour :
- les devoirs
- les cours
- le code
- les jeux
- les questions générales
- les projets
- les idées créatives

Tu ne prétends jamais être une personne réelle.

Quand l'utilisateur demande une image, utilise la fonction
de génération d'image du site lorsqu'elle est disponible.
"""


# =========================================================
# BASE DE DONNÉES
# =========================================================

def get_db():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()

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

    conn.commit()
    conn.close()


init_db()


# =========================================================
# MESSAGES
# =========================================================

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


def get_recent_messages(
    user_id,
    session_id,
    limit=12
):

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


# =========================================================
# MÉMOIRE
# =========================================================

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

    conn = get_db()

    rows = conn.execute(
        """
        SELECT content
        FROM memories
        WHERE user_id = ?
        ORDER BY id DESC
        LIMIT 30
        """,
        (user_id,)
    ).fetchall()

    conn.close()

    return [
        row["content"]
        for row in rows
    ]


def detect_memory(message):

    text = message.strip()

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
            text,
            re.IGNORECASE
        )

        if match:

            return match.group(1).strip()

    return None


# =========================================================
# INTERNET
# =========================================================

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


# =========================================================
# IA TEXTE
# =========================================================

def ask_ai(
    message,
    user_id,
    session_id
):

    memories = get_memories(
        user_id
    )

    recent_messages = get_recent_messages(
        user_id,
        session_id
    )

    memory_text = ""

    if memories:

        memory_text = (
            "\n\nVoici des informations "
            "mémorisées sur l'utilisateur :\n"
            +
            "\n".join(
                f"- {memory}"
                for memory in memories
            )
        )

    input_text = []

    for item in recent_messages:

        input_text.append({
            "role": item["role"],
            "content": item["content"]
        })

    input_text.append({
        "role": "user",
        "content": message
    })

    kwargs = {

        "model": MODEL,

        "instructions":
            SYSTEM_PROMPT +
            memory_text,

        "input": input_text
    }


    # =====================================================
    # RECHERCHE INTERNET
    # =====================================================

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


    # =====================================================
    # CHAT NORMAL
    # =====================================================

    response = client.responses.create(
        **kwargs
    )

    return response.output_text


# =========================================================
# GÉNÉRATION D'IMAGE
# =========================================================

def generate_image(prompt):

    print(
        "🎨 Demande d'image :",
        prompt
    )

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


    print(
        "✅ Image générée avec succès."
    )


    return image_data.b64_json


# =========================================================
# PAGE PRINCIPALE
# =========================================================

@app.route("/")
def accueil():

    return send_from_directory(
        ".",
        "index.html"
    )


# =========================================================
# CHAT
# =========================================================

@app.route(
    "/chat",
    methods=["POST"]
)
def chat():

    try:

        data = request.get_json() or {}

        message = data.get(
            "message",
            ""
        ).strip()


        user_id = data.get(
            "user_id",
            "local-user"
        )


        session_id = data.get(
            "session_id",
            str(uuid.uuid4())
        )


        if not message:

            return jsonify({

                "response":
                    "Écris-moi quelque chose 😎"

            }), 400


        save_message(

            user_id,

            session_id,

            "user",

            message
        )


        memory = detect_memory(
            message
        )


        if memory:

            save_memory(
                user_id,
                memory
            )


        response = ask_ai(

            message,

            user_id,

            session_id
        )


        save_message(

            user_id,

            session_id,

            "assistant",

            response
        )


        return jsonify({

            "response":
                response,

            "session_id":
                session_id

        })


    except Exception as error:

        print(
            "ERREUR CHAT :",
            error
        )


        return jsonify({

            "response":
                "⚠️ Le cerveau BourNox "
                "a rencontré une erreur : "
                + str(error)

        }), 500


# =========================================================
# GÉNÉRATION D'IMAGE
# =========================================================

@app.route(
    "/generate-image",
    methods=["POST"]
)
def generate_image_route():

    try:

        data = request.get_json() or {}

        prompt = data.get(
            "prompt",
            ""
        ).strip()


        if not prompt:

            return jsonify({

                "error":
                    "Décris l'image que tu veux créer."

            }), 400


        print(
            "🎨 Génération d'image :",
            prompt
        )


        image_base64 = generate_image(
            prompt
        )


        return jsonify({

            "image":
                image_base64,

            "format":
                "png"

        })


    except Exception as error:

        print(
            "ERREUR IMAGE :",
            error
        )


        return jsonify({

            "error":
                "Impossible de générer l'image : "
                + str(error)

        }), 500


# =========================================================
# HISTORIQUE
# =========================================================

@app.route(
    "/history",
    methods=["GET"]
)
def history():

    user_id = request.args.get(
        "user_id",
        "local-user"
    )


    session_id = request.args.get(
        "session_id"
    )


    if not session_id:

        return jsonify([])


    messages = get_recent_messages(

        user_id,

        session_id,

        100
    )


    return jsonify(
        messages
    )


# =========================================================
# MÉMOIRE
# =========================================================

@app.route(
    "/memory",
    methods=["GET"]
)
def memory_get():

    user_id = request.args.get(
        "user_id",
        "local-user"
    )


    return jsonify({

        "memories":
            get_memories(user_id)

    })


@app.route(
    "/memory",
    methods=["POST"]
)
def memory_post():

    data = request.get_json() or {}


    user_id = data.get(
        "user_id",
        "local-user"
    )


    content = data.get(
        "content",
        ""
    ).strip()


    if not content:

        return jsonify({

            "error":
                "Mémoire vide."

        }), 400


    save_memory(

        user_id,

        content
    )


    return jsonify({

        "success":
            True

    })


# =========================================================
# SANTÉ DU SERVEUR
# =========================================================

@app.route("/health")
def health():

    return jsonify({

        "status":
            "online",

        "name":
            "BourNox.AI",

        "model":
            MODEL

    })


# =========================================================
# LANCEMENT
# =========================================================

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
