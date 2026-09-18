import os
import sqlite3
import sys

import psycopg
from psycopg.rows import dict_row


SQL = """
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    public_id TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL,
    is_admin INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS messages (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT,
    session_id TEXT,
    role TEXT,
    content TEXT,
    created_at TEXT
);

CREATE TABLE IF NOT EXISTS memories (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT,
    content TEXT,
    created_at TEXT
);

CREATE TABLE IF NOT EXISTS alerts (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    session_id TEXT,
    category TEXT NOT NULL,
    severity TEXT NOT NULL,
    message_excerpt TEXT NOT NULL,
    created_at TEXT NOT NULL,
    reviewed INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS projects (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    context TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(user_id, name)
);

CREATE TABLE IF NOT EXISTS bans (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT UNIQUE NOT NULL,
    reason TEXT DEFAULT '',
    banned_at TEXT NOT NULL,
    expires_at TEXT,
    active INTEGER DEFAULT 1,
    banned_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_messages_user_session
ON messages(user_id, session_id, id);

CREATE INDEX IF NOT EXISTS idx_memories_user
ON memories(user_id, id);

CREATE INDEX IF NOT EXISTS idx_alerts_user
ON alerts(user_id, id);

CREATE INDEX IF NOT EXISTS idx_projects_user
ON projects(user_id, updated_at);

CREATE INDEX IF NOT EXISTS idx_bans_user_active
ON bans(user_id, active, expires_at);
"""


TABLES = [
    "users",
    "messages",
    "memories",
    "alerts",
    "projects",
    "bans",
]


def main():
    database_url = os.getenv("DATABASE_URL", "").strip()
    sqlite_file = os.getenv("SQLITE_FILE", "bournox.db")

    if not database_url:
        print("ERREUR : définis DATABASE_URL avant de lancer la migration.")
        sys.exit(1)

    if not os.path.exists(sqlite_file):
        print(f"ERREUR : fichier SQLite introuvable : {sqlite_file}")
        sys.exit(1)

    sqlite_conn = sqlite3.connect(sqlite_file)
    sqlite_conn.row_factory = sqlite3.Row

    pg = psycopg.connect(database_url)

    try:
        with pg.cursor() as cur:
            cur.execute(SQL)

        for table in TABLES:
            columns = {
                "users": ["id", "public_id", "username", "password_hash", "created_at", "is_admin"],
                "messages": ["id", "user_id", "session_id", "role", "content", "created_at"],
                "memories": ["id", "user_id", "content", "created_at"],
                "alerts": ["id", "user_id", "session_id", "category", "severity", "message_excerpt", "created_at", "reviewed"],
                "projects": ["id", "user_id", "name", "context", "created_at", "updated_at"],
                "bans": ["id", "user_id", "reason", "banned_at", "expires_at", "active", "banned_by"],
            }[table]

            rows = sqlite_conn.execute(
                f"SELECT {', '.join(columns)} FROM {table}"
            ).fetchall()

            if not rows:
                print(f"{table}: 0 ligne")
                continue

            placeholders = ", ".join(["%s"] * len(columns))
            column_sql = ", ".join(columns)

            # On conserve les IDs existants et on évite les doublons.
            conflict_column = {
                "users": "public_id",
                "messages": "id",
                "memories": "id",
                "alerts": "id",
                "projects": "id",
                "bans": "user_id",
            }[table]

            query = f"""
                INSERT INTO {table} ({column_sql})
                VALUES ({placeholders})
                ON CONFLICT ({conflict_column}) DO NOTHING
            """

            with pg.cursor() as cur:
                for row in rows:
                    cur.execute(query, tuple(row[col] for col in columns))

            print(f"{table}: {len(rows)} ligne(s) traitée(s)")

        # Remet les séquences PostgreSQL après conservation des IDs SQLite.
        with pg.cursor() as cur:
            for table in TABLES:
                cur.execute(
                    f"""
                    SELECT setval(
                        pg_get_serial_sequence(%s, 'id'),
                        COALESCE((SELECT MAX(id) FROM {table}), 1),
                        (SELECT COUNT(*) > 0 FROM {table})
                    )
                    """,
                    (table,),
                )

        pg.commit()
        print("\nMigration terminée.")
    except Exception:
        pg.rollback()
        raise
    finally:
        sqlite_conn.close()
        pg.close()


if __name__ == "__main__":
    main()
