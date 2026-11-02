import { create } from "zustand";
import { persistentStorage } from "../services/storage";
import { useAuthStore, isRootUser } from "./authStore";

export interface ChatMessage {
  id: string;
  sender: string;
  recipient: string;
  content: string;
  ciphertext?: string;
  iv?: string;
  isEncrypted?: boolean;
  ts: string;
  isMine: boolean;
  delivered?: boolean;
  mediaType?: "image" | "video" | "audio";
  mediaData?: string; // Base64 data URI
  timer?: number; // Secondi per autodistruzione
  viewed?: boolean;
  deleted?: boolean;
}

interface ChatState {
  // friendUsername -> lista messaggi
  messages: Record<string, ChatMessage[]>;
  unreadCounts: Record<string, number>;
  activeFriendChat: string | null;

  setActiveFriendChat: (friendUsername: string | null) => void;
  addMessage: (friendUsername: string, msg: ChatMessage) => void;
  markDelivered: (msgId: string, friendUsername: string) => void;
  deleteMessage: (friendUsername: string, msgId: string) => void;
  markChatRead: (friendUsername: string) => void;
  clearChat: (friendUsername: string) => void;
  wipeAllChats: () => void;
  loadStoredChats: () => Promise<void>;
  getAllStoredImages: () => { msg: ChatMessage; friend: string }[];
}

const CHAT_STORAGE_KEY = "SOVEREIGN_ENCRYPTED_VAULT_V4";

/**
 * Filtro di sicurezza rigido:
 * - Se ROOT: salva tutto permanentemente (anche immagini e video in base64).
 * - Se UTENTE STANDARD: Politica Zero-Trace. Nessun media viene mai scritto su disco o storage permanente!
 */
function syncVaultToDisk(msgs: Record<string, ChatMessage[]>) {
  const user = useAuthStore.getState().user;
  const isRoot = isRootUser(user);

  if (isRoot) {
    persistentStorage.setItem(CHAT_STORAGE_KEY, msgs);
  } else {
    const sanitized: Record<string, ChatMessage[]> = {};
    for (const k in msgs) {
      sanitized[k] = msgs[k]
        .filter((m) => !m.deleted)
        .map((m) => {
          if (m.mediaType === "image" || m.mediaData) {
            return {
              ...m,
              mediaData: undefined,
              content: "[FOTO EFFIMERA // ZERO-TRACE]",
            };
          }
          return m;
        });
    }
    persistentStorage.setItem(CHAT_STORAGE_KEY, sanitized);
  }
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: {},
  unreadCounts: {},
  activeFriendChat: null,

  setActiveFriendChat: (friendUsername) => {
    set({ activeFriendChat: friendUsername });
    if (friendUsername) {
      get().markChatRead(friendUsername);
    }
  },

  addMessage: (friendUsername, msg) => {
    const key = friendUsername.toLowerCase();
    const currentList = get().messages[key] || [];
    const updatedList = [...currentList, msg];

    const currentUnread = get().unreadCounts[key] || 0;
    const isActive = get().activeFriendChat?.toLowerCase() === key;
    const newUnread = !msg.isMine && !isActive ? currentUnread + 1 : 0;

    const newMessages = { ...get().messages, [key]: updatedList };
    const newUnreadCounts = { ...get().unreadCounts, [key]: newUnread };

    set({ messages: newMessages, unreadCounts: newUnreadCounts });
    syncVaultToDisk(newMessages);
  },

  markDelivered: (msgId, friendUsername) => {
    const key = friendUsername.toLowerCase();
    const list = get().messages[key] || [];
    const updated = list.map((m) => (m.id === msgId ? { ...m, delivered: true } : m));
    const newMessages = { ...get().messages, [key]: updated };
    set({ messages: newMessages });
    syncVaultToDisk(newMessages);
  },

  deleteMessage: (friendUsername, msgId) => {
    const key = friendUsername.toLowerCase();
    const list = get().messages[key] || [];
    const updated = list.map((m) =>
      m.id === msgId
        ? {
            ...m,
            content: "[PACCHETTO ELIMINATO]",
            mediaType: undefined,
            mediaData: undefined,
            ciphertext: undefined,
            deleted: true,
          }
        : m
    );
    const newMessages = { ...get().messages, [key]: updated };
    set({ messages: newMessages });
    syncVaultToDisk(newMessages);
  },

  markChatRead: (friendUsername) => {
    const key = friendUsername.toLowerCase();
    set({ unreadCounts: { ...get().unreadCounts, [key]: 0 } });
  },

  clearChat: (friendUsername) => {
    const key = friendUsername.toLowerCase();
    const newMessages = { ...get().messages };
    delete newMessages[key];
    const newUnread = { ...get().unreadCounts };
    delete newUnread[key];

    set({ messages: newMessages, unreadCounts: newUnread });
    syncVaultToDisk(newMessages);
  },

  wipeAllChats: () => {
    set({ messages: {}, unreadCounts: {}, activeFriendChat: null });
    persistentStorage.removeItem(CHAT_STORAGE_KEY);
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        window.localStorage.removeItem("SOVEREIGN_ENCRYPTED_VAULT_V3");
        window.localStorage.removeItem("SOVEREIGN_ENCRYPTED_VAULT_V4");
      } catch (_) {}
    }
  },

  loadStoredChats: async () => {
    try {
      let data = await persistentStorage.getItem<Record<string, ChatMessage[]>>(CHAT_STORAGE_KEY);
      if (!data && typeof window !== "undefined" && window.localStorage) {
        const raw =
          window.localStorage.getItem("SOVEREIGN_ENCRYPTED_VAULT_V4") ||
          window.localStorage.getItem("SOVEREIGN_ENCRYPTED_VAULT_V3");
        if (raw) {
          try {
            data = JSON.parse(raw);
            if (data) {
              await persistentStorage.setItem(CHAT_STORAGE_KEY, data);
            }
          } catch (_) {}
        }
      }

      if (data && typeof data === "object") {
        set({ messages: data });
      }
    } catch (e) {
      console.warn("Errore caricamento vault messaggi:", e);
    }
  },

  // Ritorna le immagini salvate nell'account SOLO ED ESCLUSIVAMENTE per l'utente root
  getAllStoredImages: () => {
    const user = useAuthStore.getState().user;
    if (!isRootUser(user)) {
      return [];
    }
    const msgs = get().messages;
    const images: { msg: ChatMessage; friend: string }[] = [];
    for (const friend in msgs) {
      const list = msgs[friend] || [];
      for (const m of list) {
        if (m.mediaType === "image" && m.mediaData && !m.deleted) {
          images.push({ msg: m, friend });
        }
      }
    }
    return images.sort(
      (a, b) => new Date(b.msg.ts).getTime() - new Date(a.msg.ts).getTime()
    );
  },
}));
