import { Platform } from "react-native";

// Indirizzo IP di default del server relay
const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = "8000";

const getRelayHost = (): string => {
  // Se l'app gira sul browser, usa esattamente l'hostname corrente (es. localhost o IP LAN)
  if (Platform.OS === "web" && typeof window !== "undefined" && window.location?.hostname) {
    return window.location.hostname || "localhost";
  }
  return "127.0.0.1";
};

// Verifica eventuale override salvato nel Vault locale
export const getCustomRelayUrl = (): string | null => {
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      return window.localStorage.getItem("CYBER_RELAY_OVERRIDE");
    } catch (e) {}
  }
  return null;
};

export const setCustomRelayUrl = (url: string | null): void => {
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      if (url) {
        window.localStorage.setItem("CYBER_RELAY_OVERRIDE", url.trim());
      } else {
        window.localStorage.removeItem("CYBER_RELAY_OVERRIDE");
      }
    } catch (e) {}
  }
};

const envUrl = process.env.EXPO_PUBLIC_API_URL;
const customUrl = getCustomRelayUrl();
const host = getRelayHost();
export const SERVER_URL = customUrl
  ? customUrl.replace(/\/$/, "")
  : envUrl
  ? envUrl.replace(/\/$/, "")
  : `http://${host}:${DEFAULT_PORT}`;
export const WS_URL = SERVER_URL.replace(/^http/, "ws");
