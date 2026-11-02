# Sovereign Cyber Chat

Applicazione di messaggistica istantanea blind-relay con crittografia End-to-End (E2EE), architettura Zero-Knowledge e privilegi di amministrazione crittografica per utente Root.

---

## Caratteristiche Principali

- **Crittografia E2EE Avanzata**:
  - Suite crittografica AES-256-GCM (NIST SP 800-38D).
  - Derivazione chiavi PBKDF2-HMAC-SHA256 con 50.000 iterazioni.
  - Mascheramento del traffico con PKCS Padding (anti-DPI analysis).
  - Impronte crittografiche di sicurezza a 32 caratteri anti-MITM.

- **Architettura Zero-Knowledge & Blind Relay**:
  - Il server relay non conserva messaggi su disco, non legge payload e gestisce i pacchetti cifrati esclusivamente in RAM effimera.
  - Nessuna richiesta di email, numero di telefono o metadati personali.

- **Politica di Sicurezza Asimmetrica (Root vs Standard)**:
  - **Utenti Standard**: Politica Zero-Trace assoluta. Foto e video sono effimeri, protetti da screenshot (anti-screen shield su focus blur e shortcut di cattura), non scaricabili e non memorizzati in memoria permanente.
  - **Utente Root**: Accesso alla cassaforte media privata dell'account, download silenzioso dei media sul disco locale senza notificare l'altro interlocutore, e gestione completa dei pacchetti.

- **Single-Origin Deployment**:
  - Il backend FastAPI serve direttamente il bundle PWA (React Native Web) da una singola porta (8000), supportando WebSockets e REST API su un unico dominio.

---

## Struttura del Progetto

```text
├── api-server/         # Backend FastAPI + WebSockets Blind Relay (Python)
├── mobile/             # Frontend React Native / Expo Web / PWA (TypeScript)
│   └── dist/           # Bundle web compilato e ottimizzato per il deploy
├── .gitignore
└── README.md
```

---

## Avvio Locale

### 1. Backend (FastAPI Relay)
```bash
cd api-server
pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

### 2. Frontend (Expo Web)
```bash
cd mobile
npm install
npx expo start --web
```
Oppure accedi direttamente a `http://localhost:8000` per visualizzare la Web App unificata servita dal relay.
