from fastapi import WebSocket
from typing import Dict, Optional, List
import json
from database import db


class WebSocketManager:
    """
    Gestione pura in memoria dei WebSocket.
    Instradamento in tempo reale dei messaggi tra amici e nei match radar.
    ZERO LOG su disco.
    """
    def __init__(self):
        # username -> WebSocket
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, username: str, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[username] = websocket
        await self.notify_friends_presence(username, "online")

    async def disconnect(self, username: str):
        self.active_connections.pop(username, None)
        await self.notify_friends_presence(username, "offline")

    async def notify_friends_presence(self, username: str, status: str):
        """Notifica agli amici confermati lo stato di connessione."""
        try:
            friends = db.get_friends(username)
            payload = json.dumps({
                "type": "friend_status",
                "username": username,
                "status": status,
            })
            for f in friends:
                friend_name = f["username"]
                if friend_name in self.active_connections:
                    try:
                        await self.active_connections[friend_name].send_text(payload)
                    except Exception:
                        pass
        except Exception:
            pass

    async def send_to_user(self, username: str, payload: dict) -> bool:
        """Invia un messaggio a un utente se online."""
        ws = self.active_connections.get(username)
        if ws:
            try:
                await ws.send_text(json.dumps(payload))
                return True
            except Exception:
                self.active_connections.pop(username, None)
                return False
        return False

    def is_connected(self, username: str) -> bool:
        return username in self.active_connections


manager = WebSocketManager()
