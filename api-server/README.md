# Chat Segreta API v2.0

Server REST API + WebSocket per chat crittografata end-to-end.

## 🚀 Avvio Rapido

### 1. Installa dipendenze

```bash
pip install -r requirements.txt
```

### 2. Avvia il server

```bash
python main.py
```

Il server sarà disponibile su `http://localhost:8000`

### 3. Testa con il client Python

```bash
python test_client.py
```

## 📡 API Endpoints

### Autenticazione

- `POST /api/register` - Registra nuovo utente
- `POST /api/login` - Login utente
- `GET /api/me` - Info utente corrente

### Utenti

- `GET /api/users` - Lista tutti gli utenti
- `GET /api/users/online` - Lista utenti online

### Messaggi

- `GET /api/messages` - Cronologia messaggi
- `GET /api/messages/{username}` - Messaggi privati con utente

### WebSocket

- `WS /ws/{token}` - Connessione WebSocket per chat real-time

## 🔐 Sicurezza

- **JWT Authentication**: Token con scadenza 30 giorni
- **Crittografia Fernet**: Messaggi cifrati nel database
- **Password Hash**: bcrypt per le password
- **HTTPS Ready**: Usa con certificato SSL in produzione

## 📱 Per l'app iOS

L'app iOS dovrà:

1. **Registrazione/Login**
   ```swift
   POST http://your-server:8000/api/register
   Body: {"username": "...", "password": "..."}
   Response: {"access_token": "...", "token_type": "bearer"}
   ```

2. **WebSocket Connection**
   ```swift
   wss://your-server:8000/ws/{token}
   ```

3. **Invia messaggio**
   ```swift
   Send JSON: {"content": "...", "recipient": "username" or null}
   ```

4. **Ricevi messaggi**
   ```swift
   Receive JSON: {"sender": "...", "content": "...", "recipient": "..."}
   ```

## 🌐 Deployment

### Locale (solo per test con amici sulla stessa rete)

1. Trova il tuo IP locale: `ipconfig` (Windows) o `ifconfig` (Mac/Linux)
2. Avvia server: `python main.py`
3. Configura port forwarding sul router (porta 8000)
4. Gli amici si connettono al tuo IP pubblico

### VPS (consigliato per produzione)

1. Deploy su DigitalOcean, AWS, Linode, etc.
2. Configura NGINX come reverse proxy
3. Abilita HTTPS con Let's Encrypt
4. Usa dominio personalizzato (opzionale)

### Docker (opzionale)

```bash
docker build -t chat-server .
docker run -p 8000:8000 chat-server
```

## 📝 Note

- Database SQLite (`chat.db`) viene creato automaticamente
- Messaggi salvati permanentemente (crittografati)
- Per cancellare tutto: elimina `chat.db`

## 🔧 Configurazione

Modifica in `auth.py`:
- `SECRET_KEY`: Chiave per JWT (cambia in produzione!)
- `ACCESS_TOKEN_EXPIRE_DAYS`: Durata token

Modifica in `websocket_manager.py`:
- `SECRET_KEY`: Chiave Fernet per crittografia messaggi
