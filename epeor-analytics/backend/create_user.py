#!/usr/bin/env python3
"""Utility to manage EPEOR auth users.

Usage:
  python create_user.py --list
  python create_user.py --create admin --display-name "Administrateur" --admin
  python create_user.py --reset-password admin
  python create_user.py --set-admin admin
  python create_user.py --unset-admin admin
  python create_user.py --delete admin
"""

import argparse
import hashlib
import os
import secrets
import sqlite3
import sys
from getpass import getpass

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
AUTH_DB_PATH = os.path.join(BASE_DIR, "users.db")


def _get_auth_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(AUTH_DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def _hash_password(password: str, salt: str | None = None) -> tuple[str, str]:
    if salt is None:
        salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        200_000,
    )
    return salt, key.hex()


def _hash_username(username: str) -> str:
    normalized = username.strip().lower()
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def _ensure_auth_db() -> None:
    with _get_auth_conn() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                username_hash TEXT NOT NULL DEFAULT '',
                display_name TEXT NOT NULL DEFAULT '',
                salt TEXT NOT NULL,
                password TEXT NOT NULL,
                is_admin INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS sessions (
                token TEXT NOT NULL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                expires_at TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
            CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
        """)
        try:
            conn.execute("ALTER TABLE users ADD COLUMN username_hash TEXT DEFAULT ''")
        except sqlite3.OperationalError:
            pass
        rows = conn.execute(
            "SELECT id, username FROM users WHERE username_hash IS NULL OR username_hash = ''"
        ).fetchall()
        for row in rows:
            conn.execute(
                "UPDATE users SET username_hash = ? WHERE id = ?",
                (_hash_username(row["username"]), row["id"]),
            )
        conn.commit()
        conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_hash ON users(username_hash)")


def _list_users() -> None:
    with _get_auth_conn() as conn:
        rows = conn.execute(
            "SELECT id, username, display_name, is_admin, created_at FROM users ORDER BY id"
        ).fetchall()

    if not rows:
        print("Aucun utilisateur trouvé.")
        return

    print("Utilisateurs EPEOR :")
    for row in rows:
        admin_flag = "(admin)" if row[3] else ""
        print(
            f"  - {row['username']} {admin_flag}\n      Affichage: {row['display_name']}\n      Créé le: {row['created_at']}"
        )


def _prompt_password(prompt: str = "Mot de passe") -> str:
    while True:
        password = getpass(f"{prompt} : ")
        if not password:
            print("Le mot de passe ne peut pas être vide.")
            continue
        confirm = getpass("Confirmer le mot de passe : ")
        if password != confirm:
            print("Les mots de passe ne correspondent pas. Réessayez.")
            continue
        return password


def _count_admins(conn: sqlite3.Connection, exclude_username: str | None = None) -> int:
    if exclude_username is not None:
        row = conn.execute(
            "SELECT COUNT(*) FROM users WHERE is_admin = 1 AND username != ?",
            (exclude_username.strip().lower(),),
        ).fetchone()
    else:
        row = conn.execute("SELECT COUNT(*) FROM users WHERE is_admin = 1").fetchone()
    return row[0]


def _create_user(username: str, display_name: str, password: str, is_admin: bool) -> None:
    username = username.strip().lower()
    username_hash = _hash_username(username)
    display_name = display_name.strip() or username
    salt, hashed = _hash_password(password)
    with _get_auth_conn() as conn:
        if is_admin and _count_admins(conn) > 0:
            raise ValueError("Un seul administrateur est autorisé dans le système.")
        conn.execute(
            "INSERT INTO users (username, username_hash, display_name, salt, password, is_admin) VALUES (?,?,?,?,?,?)",
            (username, username_hash, display_name, salt, hashed, int(is_admin)),
        )
    print(f"Utilisateur '{username}' créé avec succès.")


def _update_password(username: str, password: str) -> None:
    username = username.strip().lower()
    salt, hashed = _hash_password(password)
    with _get_auth_conn() as conn:
        result = conn.execute(
            "UPDATE users SET salt = ?, password = ? WHERE username = ?",
            (salt, hashed, username),
        )
        if result.rowcount == 0:
            raise ValueError(f"Utilisateur introuvable : {username}")
    print(f"Mot de passe mis à jour pour '{username}'.")


def _set_admin(username: str, is_admin: bool) -> None:
    username = username.strip().lower()
    with _get_auth_conn() as conn:
        row = conn.execute(
            "SELECT is_admin FROM users WHERE username = ?",
            (username,),
        ).fetchone()
        if row is None:
            raise ValueError(f"Utilisateur introuvable : {username}")
        currently_admin = bool(row["is_admin"])
        if is_admin and not currently_admin and _count_admins(conn) > 0:
            raise ValueError("Un seul administrateur est autorisé dans le système.")
        if not is_admin and currently_admin:
            raise ValueError("Le compte administrateur ne peut pas être rétrogradé.")
        result = conn.execute(
            "UPDATE users SET is_admin = ? WHERE username = ?",
            (int(is_admin), username),
        )
        if result.rowcount == 0:
            raise ValueError(f"Utilisateur introuvable : {username}")
    role = "administrateur" if is_admin else "utilisateur standard"
    print(f"'{username}' est maintenant {role}.")


def _delete_user(username: str) -> None:
    username = username.strip().lower()
    with _get_auth_conn() as conn:
        row = conn.execute(
            "SELECT is_admin FROM users WHERE username = ?",
            (username,),
        ).fetchone()
        if row is None:
            raise ValueError(f"Utilisateur introuvable : {username}")
        if row["is_admin"]:
            raise ValueError("Le compte administrateur ne peut pas être supprimé.")
        result = conn.execute("DELETE FROM users WHERE username = ?", (username,))
        if result.rowcount == 0:
            raise ValueError(f"Utilisateur introuvable : {username}")
    print(f"Utilisateur '{username}' supprimé.")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Gestion des utilisateurs EPEOR (authentification SQLite)."
    )
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--list", action="store_true", help="Lister les utilisateurs existants")
    group.add_argument("--create", metavar="USERNAME", help="Créer un nouvel utilisateur")
    group.add_argument("--reset-password", metavar="USERNAME", help="Changer le mot de passe d'un utilisateur")
    group.add_argument("--set-admin", metavar="USERNAME", help="Passer l'utilisateur en administrateur")
    group.add_argument("--unset-admin", metavar="USERNAME", help="Retirer les droits administrateur d'un utilisateur")
    group.add_argument("--delete", metavar="USERNAME", help="Supprimer un utilisateur")
    parser.add_argument("--display-name", default="", help="Nom affiché pour le compte")
    parser.add_argument("--password", help="Mot de passe en clair (non recommandé, préférer l'invite interactive)")
    parser.add_argument("--admin", action="store_true", help="Créer un utilisateur administrateur")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    _ensure_auth_db()

    try:
        if args.list:
            _list_users()
            return 0

        if args.create:
            username = args.create
            display_name = args.display_name or username
            password = args.password or _prompt_password()
            _create_user(username, display_name, password, args.admin)
            return 0

        if args.reset_password:
            username = args.reset_password
            password = args.password or _prompt_password("Nouveau mot de passe")
            _update_password(username, password)
            return 0

        if args.set_admin:
            _set_admin(args.set_admin, True)
            return 0

        if args.unset_admin:
            _set_admin(args.unset_admin, False)
            return 0

        if args.delete:
            _delete_user(args.delete)
            return 0

    except ValueError as exc:
        print(f"Erreur : {exc}")
        return 1
    except sqlite3.IntegrityError as exc:
        print(f"Erreur de base de données : {exc}")
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
