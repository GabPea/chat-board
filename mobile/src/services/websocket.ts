import { WS_URL } from "../config";
import { useChatStore } from "../store/chatStore";
import { cryptoEngine } from "./crypto";

type MessageHandler = (msg: any) => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private token: string | null = null;
  private handlers: Set<MessageHandler> = new Set();
  private reconnectTimer: any = null;
  private heartbeatTimer: any = null;
  private isExplicitDisconnect: boolean = false;

  connect(token: string) {
    if (this.ws && this.token === token && this.ws.readyState === WebSocket.OPEN) {
      return;
    }
    this.token = token;
    this.isExplicitDisconnect = false;
    this._initWs();
  }

  private _initWs() {
    if (!this.token) return;
    try {
      this.ws = new WebSocket(`${WS_URL}/ws/${this.token}`);

      this.ws.onopen = () => {
        console.log("[CYBER RELAY] Connesso al Blind Relay.");
        this._startHeartbeat();
      };

      this.ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          await this._handleSystemMessage(data);
          this.handlers.forEach((h) => h(data));
        } catch (e) {
          console.error("[WS] Errore parsing pacchetto:", e);
        }
      };

      this.ws.onclose = () => {
        this._stopHeartbeat();
        if (!this.isExplicitDisconnect && this.token) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = setTimeout(() => this._initWs(), 3000);
        }
      };

      this.ws.onerror = (err) => {
        console.warn("[WS] Segnale interrotto o relay non raggiungibile.");
      };
    } catch (e) {
      console.error("[WS] Errore inizializzazione socket:", e);
    }
  }

  private _startHeartbeat() {
    this._stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.send({ action: "ping" });
    }, 25000);
  }

  private _stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private async _handleSystemMessage(data: any) {
    if (data.type === "direct_msg") {
      const chatStore = useChatStore.getState();
      let displayContent = data.content || "";
      let mediaType = data.media_type;
      let mediaData = data.media_data;
      let timer = data.timer;
      const isEncrypted = Boolean(data.is_encrypted && data.ciphertext);

      if (isEncrypted) {
        // Decifra il payload sul client
        const decrypted = await cryptoEngine.decrypt(
          data.sender,
          data.recipient,
          data.ciphertext,
          data.iv
        );
        if (decrypted) {
          displayContent = decrypted.content || "";
          mediaType = decrypted.mediaType;
          mediaData = decrypted.mediaData;
          timer = decrypted.timer ?? timer;
        } else {
          displayContent = "[ERRORE DECIFRATURA: PACCHETTO CORROTTO O CHIAVE DISALLINEATA]";
        }
      }

      chatStore.addMessage(data.sender, {
        id: data.msg_id || Math.random().toString(),
        sender: data.sender,
        recipient: data.recipient,
        content: displayContent,
        ciphertext: data.ciphertext,
        iv: data.iv,
        isEncrypted: isEncrypted,
        mediaType: mediaType,
        mediaData: mediaData,
        timer: timer,
        ts: data.ts,
        isMine: false,
      });
    } else if (data.type === "msg_ack") {
      const chatStore = useChatStore.getState();
      chatStore.markDelivered(data.msg_id, data.recipient);
    } else if (data.type === "msg_deleted") {
      const chatStore = useChatStore.getState();
      chatStore.deleteMessage(data.sender, data.msg_id);
      chatStore.deleteMessage(data.recipient, data.msg_id);
    }
  }

  disconnect() {
    this.isExplicitDisconnect = true;
    clearTimeout(this.reconnectTimer);
    this._stopHeartbeat();
    if (this.ws) {
      this.ws.close();
    }
    this.ws = null;
    this.token = null;
  }

  addHandler(handler: MessageHandler) {
    this.handlers.add(handler);
  }

  removeHandler(handler: MessageHandler) {
    this.handlers.delete(handler);
  }

  send(payload: object) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  /**
   * Cifra ed invia un messaggio End-to-End attraverso il blind relay
   */
  async sendEncryptedDirectMessage(
    sender: string,
    recipient: string,
    content: string,
    msgId: string,
    mediaType?: "image" | "video" | "audio",
    mediaData?: string,
    timer?: number
  ) {
    // 1. Cifra client-side
    const encResult = await cryptoEngine.encrypt(sender, recipient, {
      content,
      mediaType,
      mediaData,
      timer,
    });

    // 2. Invia al relay solo i byte cifrati
    this.send({
      action: "direct_msg",
      recipient,
      msg_id: msgId,
      ciphertext: encResult.ciphertext,
      iv: encResult.iv,
      is_encrypted: encResult.is_encrypted,
      timer: timer,
    });

    return encResult;
  }

  async sendDirectMessage(
    sender: string,
    recipient: string,
    content: string,
    msgId: string,
    mediaType?: "image" | "video" | "audio",
    mediaData?: string,
    timer?: number
  ) {
    return this.sendEncryptedDirectMessage(
      sender,
      recipient,
      content,
      msgId,
      mediaType,
      mediaData,
      timer
    );
  }

  sendTyping(recipient: string, isTyping: boolean) {
    this.send({
      action: "typing",
      recipient,
      is_typing: isTyping,
    });
  }

  deleteMessageForBoth(recipient: string, msgId: string) {
    this.send({
      action: "delete_msg",
      recipient,
      msg_id: msgId,
    });
  }

  deleteDirectMessage(recipient: string, msgId: string) {
    this.deleteMessageForBoth(recipient, msgId);
  }
}

export const wsService = new WebSocketService();
