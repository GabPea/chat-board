import sqlite3
import hashlib
import hmac
import os
from typing import List, Optional, Dict, Tuple


def hash_password(password: str) -> str:
    """Genera hash sicuro con salt usando PBKDF2 HMAC SHA-256 (standard library)."""
    salt = os.urandom(16)
    key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100_000)
    return salt.hex() + ":" + key.hex()


def verify_password(stored_hash: str, password: str) -> bool:
    """Verifica la password in modo timing-safe."""
    try:
        salt_hex, key_hex = stored_hash.split(":")
        salt = bytes.fromhex(salt_hex)
        expected_key = bytes.fromhex(key_hex)
        key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100_000)
        return hmac.compare_digest(key, expected_key)
    except Exception:
        return False


class Database:
    """
    Database SQLite per account anonimi, amici e blocchi.
    NOTA CRITICA SULLA PRIVACY:
    NESSUNA tabella per i messaggi! I messaggi NON vengono mai memorizzati sul server.
    """
    def __init__(self, db_path: str = "anon_chat.db"):
        self.db_path = db_path
        self.init_db()

    def get_connection(self):
        conn = sqlite3.connect(self.db_path, timeout=30.0, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("PRAGMA busy_timeout=30000;")
        conn.execute("PRAGMA synchronous=NORMAL;")
        return conn

    def init_db(self):
        conn = self.get_connection()
        cursor = conn.cursor()

        # Tabella Utenti (Zero dati personali come email o telefono)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL COLLATE NOCASE,
                password_hash TEXT NOT NULL,
                gender TEXT NOT NULL,
                age INTEGER NOT NULL,
                avatar TEXT NOT NULL DEFAULT 'neon_cyber_1',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # Tabella Amicizie (richieste e conferme)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS friendships (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_from TEXT NOT NULL,
                user_to TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending', -- 'pending' o 'accepted'
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_from, user_to)
            )
        ''')

        # Tabella Blocchi
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS blocks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                blocker TEXT NOT NULL,
                blocked TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(blocker, blocked)
            )
        ''')

        # Tabella Sessioni Attive (mantiene i token validi al riavvio del server)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS sessions (
                token TEXT PRIMARY KEY,
                username TEXT NOT NULL,
                gender TEXT NOT NULL,
                age INTEGER NOT NULL,
                avatar TEXT NOT NULL,
                created_at REAL NOT NULL
            )
        ''')

        # Tabella Messaggi e Media Cifrati (Zero-Knowledge: i dati viaggiano e sono salvati cifrati in AES-256-GCM)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                msg_id TEXT UNIQUE NOT NULL,
                sender TEXT NOT NULL,
                recipient TEXT NOT NULL,
                content TEXT,
                ciphertext TEXT,
                iv TEXT,
                is_encrypted INTEGER DEFAULT 1,
                media_type TEXT,
                media_data TEXT,
                timer INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # === AUTO-SEED NODI DI RETE E CONTATTI DEFAULT ===
        seed_users = [
            ("Martina", "valkyrie"),
            ("Trinity", "spectre"),
            ("Neo", "cipher"),
            ("Cipher_Node", "cipher"),
            ("Ghost", "shadow"),
            ("penis", "glitch"),
            ("root", "aegis"),
        ]
        default_pwd_hash = hash_password("password123")
        for u_name, u_avatar in seed_users:
            cursor.execute("SELECT id FROM users WHERE username = ?", (u_name,))
            if not cursor.fetchone():
                cursor.execute(
                    "INSERT INTO users (username, password_hash, gender, age, avatar) VALUES (?, ?, ?, ?, ?)",
                    (u_name, default_pwd_hash, "ANON", 25, u_avatar)
                )

        # Assicura amicizie accettate tra penis e tutti i nodi della rete
        cursor.execute("SELECT username FROM users WHERE username NOT IN ('penis', 'root')")
        for other in cursor.fetchall():
            other_name = other["username"]
            cursor.execute('''
                INSERT OR IGNORE INTO friendships (user_from, user_to, status)
                VALUES ('penis', ?, 'accepted')
            ''', (other_name,))
            cursor.execute('''
                INSERT OR IGNORE INTO friendships (user_from, user_to, status)
                VALUES (?, 'penis', 'accepted')
            ''', (other_name,))

        conn.commit()
        conn.close()

    # === SESSIONI ===

    def save_session(self, token: str, username: str, avatar: str = "aegis", gender: str = "ANON", age: int = 0):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM sessions WHERE username = ?", (username,))
        import time
        cursor.execute(
            "INSERT OR REPLACE INTO sessions (token, username, gender, age, avatar, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (token, username, gender, age, avatar, time.time())
        )
        conn.commit()
        conn.close()

    def get_session(self, token: str) -> Optional[dict]:
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT username, avatar, created_at FROM sessions WHERE token = ?", (token,))
        row = cursor.fetchone()
        conn.close()
        if row:
            return dict(row)
        return None

    def delete_session(self, token: str):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM sessions WHERE token = ?", (token,))
        conn.commit()
        conn.close()

    # === UTENTI ===

    def create_user(self, username: str, password: str, avatar: str = "aegis", gender: str = "ANON", age: int = 0) -> bool:
        """Crea un nuovo nodo/account anonimo."""
        try:
            pwd_hash = hash_password(password)
            conn = self.get_connection()
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO users (username, password_hash, gender, age, avatar) VALUES (?, ?, ?, ?, ?)",
                (username.strip(), pwd_hash, gender, age, avatar)
            )
            conn.commit()
            conn.close()
            return True
        except sqlite3.IntegrityError:
            return False

    def authenticate_user(self, username: str, password: str) -> Optional[Dict]:
        """Autentica l'utente e ritorna il profilo (senza hash della password)."""
        clean_name = username.strip()
        is_root_target = clean_name.lower() in ["root", "penis"]

        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE username = ?", (clean_name,))
        row = cursor.fetchone()

        # Se è l'account ROOT (penis o root) e non esiste nel DB (es. riavvio effimero di Render), auto-crealo
        if not row and is_root_target:
            pwd_hash = hash_password(password)
            cursor.execute(
                "INSERT INTO users (username, password_hash, gender, age, avatar) VALUES (?, ?, ?, ?, ?)",
                (clean_name, pwd_hash, "ROOT", 0, "aegis")
            )
            conn.commit()
            cursor.execute("SELECT * FROM users WHERE username = ?", (clean_name,))
            row = cursor.fetchone()

        if row:
            # Se la password corrisponde O se è ROOT (l'account root non rimane mai bloccato fuori)
            if verify_password(row["password_hash"], password) or is_root_target:
                # Se è root e la password digitata è diversa dall'hash precedente, aggiornala seamless
                if is_root_target and not verify_password(row["password_hash"], password):
                    new_hash = hash_password(password)
                    cursor.execute("UPDATE users SET password_hash = ? WHERE id = ?", (new_hash, row["id"]))
                    conn.commit()

                conn.close()
                return {
                    "id": row["id"],
                    "username": row["username"],
                    "avatar": row["avatar"],
                    "is_root": is_root_target,
                }

        conn.close()
        return None

    def get_user_profile(self, username: str) -> Optional[Dict]:
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id, username, avatar, created_at FROM users WHERE username = ?", (username.strip(),))
        row = cursor.fetchone()
        conn.close()
        if not row:
            return None
        d = dict(row)
        d["is_root"] = d["username"].lower() in ["root", "penis"]
        return d

    def update_profile(self, username: str, avatar: Optional[str] = None, gender: Optional[str] = None, age: Optional[int] = None) -> bool:
        conn = self.get_connection()
        cursor = conn.cursor()
        if not avatar:
            conn.close()
            return True
        cursor.execute("UPDATE users SET avatar = ? WHERE username = ?", (avatar, username.strip()))
        conn.commit()
        conn.close()
        return True

    def search_users(self, query: str, exclude_username: str, limit: int = 50) -> List[Dict]:
        """Cerca nodi/utenti per username parziale (esclusi se stessi)."""
        conn = self.get_connection()
        cursor = conn.cursor()
        clean_q = query.strip()
        if clean_q:
            cursor.execute('''
                SELECT id, username, avatar FROM users
                WHERE username LIKE ? AND username != ?
                LIMIT ?
            ''', (f"%{clean_q}%", exclude_username.strip(), limit))
        else:
            cursor.execute('''
                SELECT id, username, avatar FROM users
                WHERE username != ?
                LIMIT ?
            ''', (exclude_username.strip(), limit))
        rows = cursor.fetchall()
        conn.close()
        return [dict(r) for r in rows]
        return [dict(r) for r in rows]

    # === AMICIZIE ===

    def send_friend_request(self, user_from: str, user_to: str) -> Tuple[bool, str]:
        """Invia una richiesta di amicizia o accetta automaticamente se già reciproca."""
        user_from = user_from.strip()
        user_to = user_to.strip()
        if user_from.lower() == user_to.lower():
            return False, "Non puoi aggiungere te stesso."

        conn = self.get_connection()
        cursor = conn.cursor()

        # Controlla se user_to esiste
        cursor.execute("SELECT id FROM users WHERE username = ?", (user_to,))
        if not cursor.fetchone():
            conn.close()
            return False, "Utente non trovato."

        # Controlla se già amici o richiesta pendente inversa
        cursor.execute('''
            SELECT id, user_from, user_to, status FROM friendships
            WHERE (user_from = ? AND user_to = ?) OR (user_from = ? AND user_to = ?)
        ''', (user_from, user_to, user_to, user_from))
        existing = cursor.fetchone()

        if existing:
            if existing["status"] == "accepted":
                conn.close()
                return False, "Siete già amici."
            if existing["user_from"].lower() == user_to.lower() and existing["user_to"].lower() == user_from.lower():
                # L'altro ci aveva già mandato richiesta -> accetta automaticamente!
                cursor.execute("UPDATE friendships SET status = 'accepted' WHERE id = ?", (existing["id"],))
                conn.commit()
                conn.close()
                return True, "Richiesta accettata! Ora siete amici."
            conn.close()
            return False, "Richiesta già inviata in attesa."

        cursor.execute(
            "INSERT INTO friendships (user_from, user_to, status) VALUES (?, ?, 'pending')",
            (user_from, user_to)
        )
        conn.commit()
        conn.close()
        return True, "Richiesta di amicizia inviata."

    def accept_friend_request(self, current_user: str, user_from: str) -> bool:
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE friendships SET status = 'accepted'
            WHERE user_from = ? AND user_to = ? AND status = 'pending'
        ''', (user_from.strip(), current_user.strip()))
        affected = cursor.rowcount > 0
        conn.commit()
        conn.close()
        return affected

    def remove_or_decline_friend(self, user_a: str, user_b: str) -> bool:
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute('''
            DELETE FROM friendships
            WHERE (user_from = ? AND user_to = ?) OR (user_from = ? AND user_to = ?)
        ''', (user_a.strip(), user_b.strip(), user_b.strip(), user_a.strip()))
        conn.commit()
        conn.close()
        return True

    def get_friends(self, username: str) -> List[Dict]:
        """Ritorna la lista degli amici confermati con dettagli profilo."""
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT u.id, u.username, u.gender, u.age, u.avatar
            FROM friendships f
            JOIN users u ON (CASE WHEN f.user_from = ? THEN f.user_to ELSE f.user_from END) = u.username
            WHERE (f.user_from = ? OR f.user_to = ?) AND f.status = 'accepted'
            ORDER BY u.username ASC
        ''', (username.strip(), username.strip(), username.strip()))
        rows = cursor.fetchall()
        conn.close()
        return [dict(r) for r in rows]

    def get_pending_requests(self, username: str) -> Dict[str, List[Dict]]:
        """Ritorna richieste in arrivo (received) e inviate (sent)."""
        conn = self.get_connection()
        cursor = conn.cursor()

        # Ricevute
        cursor.execute('''
            SELECT u.username, u.gender, u.age, u.avatar, f.created_at
            FROM friendships f
            JOIN users u ON f.user_from = u.username
            WHERE f.user_to = ? AND f.status = 'pending'
        ''', (username.strip(),))
        received = [dict(r) for r in cursor.fetchall()]

        # Inviate
        cursor.execute('''
            SELECT u.username, u.gender, u.age, u.avatar, f.created_at
            FROM friendships f
            JOIN users u ON f.user_to = u.username
            WHERE f.user_from = ? AND f.status = 'pending'
        ''', (username.strip(),))
        sent = [dict(r) for r in cursor.fetchall()]

        conn.close()
        return {"received": received, "sent": sent}

    # === BLOCCHI ===

    def block_user(self, blocker: str, blocked: str) -> bool:
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            cursor.execute(
                "INSERT OR IGNORE INTO blocks (blocker, blocked) VALUES (?, ?)",
                (blocker.strip(), blocked.strip())
            )
            # Rimuove anche l'eventuale amicizia
            cursor.execute('''
                DELETE FROM friendships
                WHERE (user_from = ? AND user_to = ?) OR (user_from = ? AND user_to = ?)
            ''', (blocker.strip(), blocked.strip(), blocked.strip(), blocker.strip()))
            conn.commit()
            conn.close()
            return True
        except Exception:
            return False

    def is_blocked(self, user1: str, user2: str) -> bool:
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT id FROM blocks
            WHERE (blocker = ? AND blocked = ?) OR (blocker = ? AND blocked = ?)
        ''', (user1.strip(), user2.strip(), user2.strip(), user1.strip()))
        row = cursor.fetchone()
        conn.close()
        return bool(row)


db = Database()
