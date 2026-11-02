/**
 * Storage asincrono basato su IndexedDB per memorizzare in modo permanente
 * e illimitato (senza limiti di 5MB di localStorage) messaggi, immagini e media cifrati.
 */

const DB_NAME = "SOVEREIGN_CYBER_VAULT";
const DB_VERSION = 1;
const STORE_NAME = "chat_vault";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      return reject(new Error("IndexedDB non supportato"));
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = (event: any) => {
      resolve(event.target.result);
    };

    request.onerror = (event: any) => {
      reject(event.target.error);
    };
  });
}

export const persistentStorage = {
  async setItem(key: string, value: any): Promise<void> {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(value, key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      // Fallback a localStorage se IndexedDB fallisce
      if (typeof window !== "undefined" && window.localStorage) {
        try {
          window.localStorage.setItem(key, JSON.stringify(value));
        } catch (_) {}
      }
    }
  },

  async getItem<T = any>(key: string): Promise<T | null> {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      if (typeof window !== "undefined" && window.localStorage) {
        try {
          const raw = window.localStorage.getItem(key);
          return raw ? JSON.parse(raw) : null;
        } catch (_) {}
      }
      return null;
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      if (typeof window !== "undefined" && window.localStorage) {
        try {
          window.localStorage.removeItem(key);
        } catch (_) {}
      }
    }
  },

  async clear(): Promise<void> {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      if (typeof window !== "undefined" && window.localStorage) {
        try {
          window.localStorage.clear();
        } catch (_) {}
      }
    }
  },
};

