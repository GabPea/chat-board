import { SERVER_URL } from "../config";

const getHeaders = (token?: string | null) => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["x-session-token"] = token;
  }
  return headers;
};

export interface UserSearchItem {
  id: number;
  username: string;
  avatar: string;
  is_online: boolean;
}

export interface FriendItem {
  id: number;
  username: string;
  avatar: string;
  is_online: boolean;
  gender?: string;
  age?: number;
}

export interface PendingRequests {
  received: Array<{
    username: string;
    avatar: string;
    created_at: string;
  }>;
  sent: Array<{
    username: string;
    avatar: string;
    created_at: string;
  }>;
}

export const api = {
  async checkRelayHealth(): Promise<{ status: string; relay_mode: string; e2ee_support: string } | null> {
    try {
      const res = await fetch(`${SERVER_URL}/api/health`, { method: "GET" });
      if (res.ok) {
        return await res.json();
      }
      return null;
    } catch (e) {
      return null;
    }
  },

  async getFriends(token: string): Promise<FriendItem[]> {
    const res = await fetch(`${SERVER_URL}/api/friends`, {
      headers: getHeaders(token),
    });
    if (!res.ok) throw new Error("Errore recupero nodi collegati");
    const data = await res.json();
    return data.friends || [];
  },

  async getFriendRequests(token: string): Promise<PendingRequests> {
    const res = await fetch(`${SERVER_URL}/api/friends/requests`, {
      headers: getHeaders(token),
    });
    if (!res.ok) throw new Error("Errore recupero richieste di collegamento");
    return await res.json();
  },

  async searchUsers(token: string, query: string): Promise<UserSearchItem[]> {
    if (!query.trim()) return [];
    const res = await fetch(`${SERVER_URL}/api/search-users?q=${encodeURIComponent(query.trim())}`, {
      headers: getHeaders(token),
    });
    if (!res.ok) throw new Error("Errore ricerca nodi");
    const data = await res.json();
    return data.users || [];
  },

  async sendFriendRequest(token: string, targetUsername: string): Promise<string> {
    const res = await fetch(`${SERVER_URL}/api/friends/request`, {
      method: "POST",
      headers: getHeaders(token),
      body: JSON.stringify({ target_username: targetUsername }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Impossibile inviare handshake di collegamento");
    return data.message || "Richiesta inviata";
  },

  async acceptFriendRequest(token: string, targetUsername: string): Promise<string> {
    const res = await fetch(`${SERVER_URL}/api/friends/accept`, {
      method: "POST",
      headers: getHeaders(token),
      body: JSON.stringify({ target_username: targetUsername }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Impossibile stabilire collegamento");
    return data.message || "Collegamento stabilito";
  },

  async removeFriend(token: string, targetUsername: string): Promise<string> {
    const res = await fetch(`${SERVER_URL}/api/friends/remove`, {
      method: "POST",
      headers: getHeaders(token),
      body: JSON.stringify({ target_username: targetUsername }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Impossibile rimuovere nodo");
    return data.message || "Nodo rimosso";
  },

  async blockUser(token: string, targetUsername: string): Promise<string> {
    const res = await fetch(`${SERVER_URL}/api/block`, {
      method: "POST",
      headers: getHeaders(token),
      body: JSON.stringify({ target_username: targetUsername }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Impossibile bloccare nodo");
    return data.message || "Nodo bloccato";
  },

  async getMe(token: string) {
    const res = await fetch(`${SERVER_URL}/api/me`, {
      headers: getHeaders(token),
    });
    if (!res.ok) throw new Error("Impossibile recuperare il profilo nodo");
    return await res.json();
  },

  async updateMe(token: string, update: { avatar?: string }) {
    const res = await fetch(`${SERVER_URL}/api/me`, {
      method: "PUT",
      headers: getHeaders(token),
      body: JSON.stringify(update),
    });
    if (!res.ok) throw new Error("Impossibile aggiornare identità nodo");
    return await res.json();
  },
};
