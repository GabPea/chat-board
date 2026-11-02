from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Header, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from datetime import datetime, timezone
from typing import Optional, List
import json
import os
import uvicorn

from database import db
from models import (
    RegisterRequest,
    LoginRequest,
    AuthResponse,
    UserProfile,
    UpdateProfileRequest,
    FriendActionRequest,
    ReportRequest,
)
from session_manager import session_manager
from websocket_manager import manager

app = FastAPI(
    title="Sovereign Cyber Relay API",
    version="3.0",
    description="Blind Zero-Log Relay per messaggistica cifrata End-to-End. Nessun log su disco, nessuna telemetria Big Tech.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def require_user(x_session_token: Optional[str] = Header(None)) -> dict:
    if not x_session_token:
        raise HTTPException(status_code=401, detail="Token di sessione mancante.")
    session = session_manager.get_session(x_session_token)
    if not session:
        raise HTTPException(status_code=401, detail="Sessione scaduta o non valida. Effettua nuovamente l'accesso.")
    return session


@app.get("/api/health")
def health_check():
    """Endpoint di controllo stato del Relay."""
    return {
        "status": "active",
        "relay_mode": "blind_zero_log",
        "e2ee_support": "AES-256-GCM",
        "active_nodes": len(manager.active_connections),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ─────────────────────────────────────────────────────────────────
# AUTENTICAZIONE ANONIMA DEL NODO (ZERO EMAIL, ZERO TELEFONO)
# ─────────────────────────────────────────────────────────────────

@app.post("/api/register", response_model=AuthResponse)
def register(req: RegisterRequest):
    """Inizializzazione nuovo nodo anonimo: Alias + Master Passphrase."""
    avatar = req.avatar or "aegis"
    success = db.create_user(
        username=req.username,
        password=req.password,
        avatar=avatar,
    )
    if not success:
        raise HTTPException(status_code=400, detail="Questo identificativo nodo è già in uso. Scegline un altro.")

    user = db.authenticate_user(req.username, req.password)
    token = session_manager.create_session(user)
    return AuthResponse(token=token, **user)


@app.post("/api/login", response_model=AuthResponse)
def login(req: LoginRequest):
    """Accesso al nodo: recupera l'identità con Alias e Master Passphrase."""
    user = db.authenticate_user(req.username, req.password)
    if not user:
        raise HTTPException(status_code=401, detail="Credenziali nodo non valide.")

    token = session_manager.create_session(user)
    return AuthResponse(token=token, **user)


@app.get("/api/me", response_model=UserProfile)
def get_me(x_session_token: Optional[str] = Header(None)):
    session = require_user(x_session_token)
    user = db.get_user_profile(session["username"])
    if not user:
        raise HTTPException(status_code=404, detail="Nodo non trovato.")
    return UserProfile(username=user["username"], avatar=user.get("avatar", "aegis"))


@app.put("/api/me")
def update_me(req: UpdateProfileRequest, x_session_token: Optional[str] = Header(None)):
    session = require_user(x_session_token)
    username = session["username"]
    db.update_profile(username, avatar=req.avatar)
    if req.avatar:
        session["avatar"] = req.avatar
    return {"status": "ok", "message": "Identità nodo aggiornata."}


@app.get("/api/search-users")
def search_users(q: str = Query(..., min_length=2), x_session_token: Optional[str] = Header(None)):
    session = require_user(x_session_token)
    results = db.search_users(q, exclude_username=session["username"])
    for r in results:
        r["is_online"] = manager.is_connected(r["username"])
    return {"users": results}


# ─────────────────────────────────────────────────────────────────
# GESTIONE NODI / PEER VERIFICATI (AMICI)
# ─────────────────────────────────────────────────────────────────

@app.get("/api/friends")
def get_friends(x_session_token: Optional[str] = Header(None)):
    session = require_user(x_session_token)
    friends = db.get_friends(session["username"])
    for f in friends:
        f["is_online"] = manager.is_connected(f["username"])
    return {"friends": friends}


@app.get("/api/friends/requests")
def get_friend_requests(x_session_token: Optional[str] = Header(None)):
    session = require_user(x_session_token)
    return db.get_pending_requests(session["username"])


@app.post("/api/friends/request")
async def send_friend_request(req: FriendActionRequest, x_session_token: Optional[str] = Header(None)):
    session = require_user(x_session_token)
    me = session["username"]
    target = req.target_username

    success, msg = db.send_friend_request(me, target)
    if not success:
        raise HTTPException(status_code=400, detail=msg)

    # Notifica in tempo reale via WebSocket se il nodo è online
    await manager.send_to_user(target, {
        "type": "friend_request_received",
        "from": me,
        "avatar": session["avatar"],
    })
    return {"status": "ok", "message": msg}


@app.post("/api/friends/accept")
async def accept_friend_request(req: FriendActionRequest, x_session_token: Optional[str] = Header(None)):
    session = require_user(x_session_token)
    me = session["username"]
    target = req.target_username

    success = db.accept_friend_request(me, target)
    if not success:
        raise HTTPException(status_code=400, detail="Impossibile accettare il collegamento nodo.")

    await manager.send_to_user(target, {
        "type": "friend_accepted",
        "username": me,
        "avatar": session["avatar"],
    })
    return {"status": "ok", "message": f"Collegamento stabilito con il nodo {target}."}


@app.post("/api/friends/remove")
def remove_friend(req: FriendActionRequest, x_session_token: Optional[str] = Header(None)):
    session = require_user(x_session_token)
    db.remove_or_decline_friend(session["username"], req.target_username)
    return {"status": "ok", "message": "Collegamento rimosso."}


@app.post("/api/block")
def block_user(req: FriendActionRequest, x_session_token: Optional[str] = Header(None)):
    session = require_user(x_session_token)
    db.block_user(session["username"], req.target_username)
    return {"status": "ok", "message": f"Nodo {req.target_username} bloccato."}


# ─────────────────────────────────────────────────────────────────
# WEBSOCKET BLIND RELAY (ZERO LOG - SOLO RAM)
# ─────────────────────────────────────────────────────────────────

@app.websocket("/ws/{token}")
async def websocket_endpoint(websocket: WebSocket, token: str):
    session = session_manager.get_session(token)
    if not session:
        await websocket.close(code=4001, reason="Token di sessione non valido.")
        return

    username = session["username"]
    await manager.connect(username, websocket)

    # Invia conferma di connessione al nodo
    await websocket.send_text(json.dumps({
        "type": "connected",
        "username": username,
        "avatar": session["avatar"],
        "relay_mode": "blind_zero_log",
    }))

    # Consegna e svuota eventuali pacchetti effimeri offline dalla RAM
    offline_msgs = session_manager.pop_offline_messages(username)
    for off_msg in offline_msgs:
        await websocket.send_text(json.dumps(off_msg))

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                continue

            action = data.get("action")

            # ── 1. INOLTRO CIECO PACCHETTO CIFRATO (BLIND RELAY E2EE) ──
            if action == "direct_msg":
                recipient = data.get("recipient", "").strip()
                msg_id = data.get("msg_id", "")
                content = data.get("content", "")
                ciphertext = data.get("ciphertext")
                iv = data.get("iv")
                is_encrypted = data.get("is_encrypted", False)
                media_type = data.get("media_type")
                media_data = data.get("media_data")
                timer = data.get("timer")

                # Se non c'è destinatario o nessun payload (né chiaro né cifrato né media)
                if not recipient or (not content and not ciphertext and not media_data):
                    continue

                if db.is_blocked(username, recipient):
                    await websocket.send_text(json.dumps({
                        "type": "error", "content": "Impossibile trasmettere: nodo bloccato."
                    }))
                    continue

                now_ts = datetime.now(timezone.utc).isoformat()
                
                # Il server non ispeziona il contenuto: inoltra il pacchetto grezzo
                payload = {
                    "type": "direct_msg",
                    "msg_id": msg_id,
                    "sender": username,
                    "recipient": recipient,
                    "content": content,
                    "ciphertext": ciphertext,
                    "iv": iv,
                    "is_encrypted": is_encrypted,
                    "media_type": media_type,
                    "media_data": media_data,
                    "timer": timer,
                    "ts": now_ts,
                }

                # Consegna immediata in RAM
                is_delivered = await manager.send_to_user(recipient, payload)
                if not is_delivered:
                    # Conserva effimeramente in RAM fino alla riconnessione
                    session_manager.push_offline_message(recipient, payload)

                # Conferma di trasmissione (ACK crittografico) al mittente
                await websocket.send_text(json.dumps({
                    "type": "msg_ack",
                    "msg_id": msg_id,
                    "recipient": recipient,
                    "delivered": is_delivered,
                    "ts": now_ts,
                }))

            # ── 2. ELIMINA PACCHETTO PER ENTRAMBI (REMOTE WIPE) ──────
            elif action == "delete_msg":
                recipient = data.get("recipient", "").strip()
                msg_id = data.get("msg_id", "")
                if recipient and msg_id:
                    del_payload = {
                        "type": "msg_deleted",
                        "msg_id": msg_id,
                        "sender": username,
                        "recipient": recipient,
                    }
                    is_delivered = await manager.send_to_user(recipient, del_payload)
                    if not is_delivered:
                        session_manager.push_offline_message(recipient, del_payload)
                    await websocket.send_text(json.dumps(del_payload))

            # ── 3. INCINERA SESSIONE CHAT (REMOTE CHAT PURGE) ─────────
            elif action == "purge_chat":
                recipient = data.get("recipient", "").strip()
                if recipient:
                    purge_payload = {
                        "type": "chat_purged",
                        "sender": username,
                        "recipient": recipient,
                    }
                    is_delivered = await manager.send_to_user(recipient, purge_payload)
                    if not is_delivered:
                        session_manager.push_offline_message(recipient, purge_payload)
                    await websocket.send_text(json.dumps(purge_payload))

            # ── 4. SEGNALE DI DIGITAZIONE ─────────────────────────────
            elif action == "typing":
                recipient = data.get("recipient", "").strip()
                is_typing = bool(data.get("is_typing", False))
                if recipient:
                    await manager.send_to_user(recipient, {
                        "type": "typing",
                        "sender": username,
                        "is_typing": is_typing,
                    })

            # ── 4. KEEP-ALIVE PING/PONG ───────────────────────────────
            elif action == "ping":
                await websocket.send_text(json.dumps({"type": "pong", "ts": datetime.now(timezone.utc).isoformat()}))

    except WebSocketDisconnect:
        pass
    finally:
        await manager.disconnect(username)


# ─────────────────────────────────────────────────────────────────
# SERVE FRONTEND PWA BUNDLE (SINGLE-ORIGIN HOSTING)
# ─────────────────────────────────────────────────────────────────

LOCAL_DIST = os.path.abspath(os.path.join(os.path.dirname(__file__), "dist"))
PARENT_DIST = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "mobile", "dist"))
DIST_DIR = LOCAL_DIST if os.path.exists(LOCAL_DIST) else PARENT_DIST

if os.path.exists(DIST_DIR):
    expo_static = os.path.join(DIST_DIR, "_expo")
    if os.path.exists(expo_static):
        app.mount("/_expo", StaticFiles(directory=expo_static), name="expo_static")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith("api/") or full_path.startswith("ws/"):
            raise HTTPException(status_code=404, detail="Not Found")
        target_file = os.path.join(DIST_DIR, full_path)
        if full_path and os.path.isfile(target_file):
            return FileResponse(target_file)
        index_file = os.path.join(DIST_DIR, "index.html")
        if os.path.isfile(index_file):
            return FileResponse(index_file)
        raise HTTPException(status_code=404, detail="Frontend non trovato.")
else:
    @app.get("/")
    def root_fallback():
        return {
            "status": "active",
            "message": "Sovereign Cyber Relay API is running.",
            "health": "/api/health",
        }


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
