import { Platform } from "react-native";

// Elite Cybersecurity & Privacy Messenger Theme
export const THEME = {
  colors: {
    // Sfondi Obsidian & Tactical Charcoal
    bgVoid: "#070A0F",       // Canvas esterno profondo
    bgApp: "#0A0E17",        // Canvas principale applicazione
    bgCard: "#111726",       // Superficie schede e pannelli
    bgCardLight: "#182033",  // Superficie elevata / hover
    bgInput: "#080C14",      // Campi di inserimento

    // Accenti Cybersecurity Eleganti (Electric Cyan, Teal & Emerald)
    primary: "#0EA5E9",       // Cyber Sky Blue
    primaryHover: "#0284C7",
    primaryGlow: "rgba(14, 165, 233, 0.25)",
    secondary: "#06B6D4",     // Tactical Teal
    secondaryGlow: "rgba(6, 182, 212, 0.25)",
    accentAmber: "#F59E0B",   // Ambra per timer di autodistruzione
    accentPurple: "#8B5CF6",  // Violetto cifratura secondaria

    // Stati di Sicurezza & Rete
    online: "#10B981",        // Emerald Green verificato
    offline: "#475569",       // Slate disconnesso
    danger: "#EF4444",        // Rosso allarme / Kill-Switch
    dangerGlow: "rgba(239, 68, 68, 0.25)",
    warning: "#F59E0B",

    // Tipografia ad Alta Leggibilità
    textPrimary: "#F8FAFC",   // Bianco ottico neutro
    textSecondary: "#94A3B8", // Slate neutro leggibile
    textCyan: "#38BDF8",      // Ciano tattico
    textMuted: "#64748B",     // Metadati secondari
    textCyber: "#0EA5E9",     // Accento cyber
    textDanger: "#F87171",

    // Bordi e Separatori Raffinati
    borderSubtle: "rgba(255, 255, 255, 0.08)",
    borderActive: "#0EA5E9",
    borderCyan: "rgba(14, 165, 233, 0.3)",
    borderCard: "rgba(255, 255, 255, 0.07)",
    borderDanger: "rgba(239, 68, 68, 0.3)",
  },

  fonts: {
    sans: Platform.OS === "web"
      ? "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
      : Platform.OS === "ios" ? "System" : "sans-serif",
    mono: Platform.OS === "web"
      ? "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace"
      : "monospace",
  },

  // Profili Identificativi Tattici (Monogrammi senza emoji)
  avatars: [
    { id: "aegis", label: "Aegis", tag: "AG", color: "#0EA5E9" },
    { id: "cipher", label: "Cipher", tag: "CP", color: "#10B981" },
    { id: "spectre", label: "Spectre", tag: "SP", color: "#8B5CF6" },
    { id: "valkyrie", label: "Valkyrie", tag: "VK", color: "#F43F5E" },
    { id: "shadow", label: "Shadow", tag: "SH", color: "#64748B" },
    { id: "nexus", label: "Nexus", tag: "NX", color: "#06B6D4" },
    { id: "proxy", label: "Proxy", tag: "PX", color: "#F59E0B" },
    { id: "zero", label: "Zero", tag: "ZR", color: "#14B8A6" },
  ],
};

export const getAvatarTag = (avatarId?: string): string => {
  const match = THEME.avatars.find((a) => a.id === avatarId);
  return match ? match.tag : "US";
};

export const getAvatarColor = (avatarId?: string): string => {
  const match = THEME.avatars.find((a) => a.id === avatarId);
  return match ? match.color : THEME.colors.primary;
};

export const getAvatarEmoji = (avatarId?: string): string => {
  return getAvatarTag(avatarId);
};
