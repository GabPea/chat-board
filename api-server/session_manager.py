import uuid
import time
from typing import Dict, Optional, List
from database import db


class SessionManager:
    """
    Gestore dello stato in memoria (RAM) per:
    - Sessioni attive dei nodi autenticati
    - Buffer effimero di consegna in RAM (zero log su disco!)
    """
    def __init__(self):
        # token -> dict(username, avatar, connected_at)
        self.sessions: Dict[str, dict] = {}
        # username -> token
        self.user_to_token: Dict[str, str] = {}

        # Buffer effimero messaggi offline (SOLO in RAM, svuotato alla consegna, zero salvataggio su disco)
        self.offline_queue: Dict[str, List[dict]] = {}

    # === SESSIONI ===

    def create_session(self, user_info: dict) -> str:
        username = user_info["username"]
        # Se c'era già un token per questo username, lo invalidiamo
        if username in self.user_to_token:
            old_token = self.user_to_token[username]
            self.sessions.pop(old_token, None)
            db.delete_session(old_token)

        token = str(uuid.uuid4())
        avatar = user_info.get("avatar", "aegis")

        session_data = {
            "username": username,
            "avatar": avatar,
            "connected_at": time.time(),
        }
        self.sessions[token] = session_data
        self.user_to_token[username] = token
        db.save_session(token, username, avatar)
        return token

    def get_session(self, token: str) -> Optional[dict]:
        session = self.sessions.get(token)
        if not session:
            db_session = db.get_session(token)
            if db_session:
                self.sessions[token] = db_session
                self.user_to_token[db_session["username"]] = token
                return db_session
        return session

    def remove_session(self, token: str):
        session = self.sessions.pop(token, None)
        db.delete_session(token)
        if session:
            username = session["username"]
            self.user_to_token.pop(username, None)

    def get_username(self, token: str) -> Optional[str]:
        session = self.sessions.get(token)
        return session["username"] if session else None

    def get_token(self, username: str) -> Optional[str]:
        return self.user_to_token.get(username)

    def is_online(self, username: str) -> bool:
        return username in self.user_to_token

    # === BUFFER EFFIMERO IN RAM (ZERO DISK LOG) ===

    def push_offline_message(self, recipient: str, msg_payload: dict):
        if recipient not in self.offline_queue:
            self.offline_queue[recipient] = []
        if len(self.offline_queue[recipient]) < 100:
            self.offline_queue[recipient].append(msg_payload)

    def pop_offline_messages(self, recipient: str) -> List[dict]:
        return self.offline_queue.pop(recipient, [])


session_manager = SessionManager()
