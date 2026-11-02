import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
} from "react-native";
import { THEME, getAvatarTag, getAvatarColor } from "../theme";
import { useAuthStore } from "../store/authStore";
import { useChatStore } from "../store/chatStore";
import { api } from "../services/api";
import { cryptoEngine } from "../services/crypto";
import { SERVER_URL, getCustomRelayUrl, setCustomRelayUrl } from "../config";

export default function VaultScreen() {
  const { user, token, logout } = useAuthStore();
  const { wipeAllChats } = useChatStore();

  const [relayStatus, setRelayStatus] = useState<string>("Verifica in corso...");
  const [relayActive, setRelayActive] = useState<boolean | null>(null);
  const [customUrl, setCustomUrl] = useState<string>(getCustomRelayUrl() || "");
  const [copiedNotice, setCopiedNotice] = useState<string | null>(null);
  const [confirmWipeModal, setConfirmWipeModal] = useState<boolean>(false);

  useEffect(() => {
    checkRelay();
  }, []);

  const checkRelay = async () => {
    setRelayStatus("Ping relay...");
    const res = await api.checkRelayHealth();
    if (res && res.status === "active") {
      setRelayActive(true);
      setRelayStatus(`ATTIVO // ${res.relay_mode.toUpperCase()} [${res.e2ee_support}]`);
    } else {
      setRelayActive(false);
      setRelayStatus("DISCONNESSO O INACCESSIBILE");
    }
  };

  const handleSaveCustomRelay = () => {
    setCustomRelayUrl(customUrl.trim() || null);
    setCopiedNotice("Configurazione relay aggiornata. Ricarica la pagina per applicare.");
    setTimeout(() => setCopiedNotice(null), 4000);
  };

  const executePanicWipe = () => {
    // Distrugge tutte le memorie locali
    cryptoEngine.wipeVault();
    wipeAllChats();
    logout();
    if (typeof window !== "undefined" && window.location) {
      window.location.reload();
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header Sezione */}
      <View style={styles.header}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>VAULT CRITTOGRAFICO</Text>
        </View>
        <Text style={styles.title}>SICUREZZA & CHIAVI</Text>
        <Text style={styles.subtitle}>STATO DEL NODO E CONTROLLO SOVRANITÀ</Text>
      </View>

      {copiedNotice && (
        <View style={styles.noticeBanner}>
          <Text style={styles.noticeText}>[SISTEMA] {copiedNotice}</Text>
        </View>
      )}

      {/* Scheda Identità Nodo */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>IDENTITÀ DEL TUO NODO</Text>
        <View style={styles.nodeRow}>
          <View style={[styles.avatarBadge, { backgroundColor: getAvatarColor(user?.avatar) }]}>
            <Text style={styles.avatarText}>{getAvatarTag(user?.avatar)}</Text>
          </View>
          <View style={styles.nodeMeta}>
            <Text style={styles.nodeAlias}>@{user?.username || "sconosciuto"}</Text>
            <Text style={styles.nodeBadge}>E2EE MASTER NODE // ACTIVE</Text>
          </View>
        </View>

        <View style={styles.specBox}>
          <Text style={styles.specLabel}>CANALE CRITTOGRAFICO</Text>
          <Text style={styles.specVal}>AES-256-GCM (Autenticata a blocchi)</Text>
          <Text style={styles.specLabel}>DERIVAZIONE CHIAVI</Text>
          <Text style={styles.specVal}>PBKDF2 SHA-256 (50,000 iterazioni)</Text>
          <Text style={styles.specLabel}>MEMORIA SERVER</Text>
          <Text style={styles.specValGreen}>ZERO-LOG // SOLO CONSEGNA IN RAM EFFIMERA</Text>
        </View>
      </View>

      {/* Scheda Stato Relay */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>SERVER BLIND RELAY</Text>
          <TouchableOpacity onPress={checkRelay} style={styles.pingBtn}>
            <Text style={styles.pingBtnText}>[ PING ]</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.relayStatusRow}>
          <View style={[styles.statusDot, { backgroundColor: relayActive ? THEME.colors.online : THEME.colors.danger }]} />
          <Text style={[styles.relayStatusText, { color: relayActive ? THEME.colors.textSecondary : THEME.colors.textDanger }]}>
            {relayStatus}
          </Text>
        </View>

        <Text style={styles.relayUrlText}>ENDPOINT: {SERVER_URL}</Text>

        <View style={styles.customRelayBox}>
          <Text style={styles.fieldLabel}>URL RELAY PERSONALIZZATO (OPZIONALE)</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="es. http://192.168.1.50:8000"
              placeholderTextColor={THEME.colors.textMuted}
              value={customUrl}
              onChangeText={setCustomUrl}
              autoCapitalize="none"
            />
            <TouchableOpacity style={styles.saveRelayBtn} onPress={handleSaveCustomRelay}>
              <Text style={styles.saveRelayBtnText}>SALVA</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* KILL-SWITCH / PANIC BUTTON */}
      <View style={styles.dangerCard}>
        <View style={styles.dangerHeaderRow}>
          <Text style={styles.dangerTitle}>KILL-SWITCH DI EMERGENZA</Text>
          <View style={styles.dangerTag}>
            <Text style={styles.dangerTagText}>DANGER ZONE</Text>
          </View>
        </View>
        <Text style={styles.dangerDesc}>
          Se ritieni che il tuo dispositivo sia a rischio o sotto ispezione, premi il pulsante sottostante per polverizzare all'istante tutte le chiavi crittografiche, la sessione e la cronologia messaggi da questo dispositivo.
        </Text>

        {!confirmWipeModal ? (
          <TouchableOpacity
            style={styles.panicButton}
            onPress={() => setConfirmWipeModal(true)}
          >
            <Text style={styles.panicButtonText}>⚠️ [ WIPE TOTALE / KILL-SWITCH ]</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.confirmBox}>
            <Text style={styles.confirmWarning}>
              ATTENZIONE: L'azione è irreversibile. Tutte le memorie locali verranno distrutte.
            </Text>
            <View style={styles.confirmBtnRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setConfirmWipeModal(false)}
              >
                <Text style={styles.cancelBtnText}>ANNULLA</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmWipeBtn}
                onPress={executePanicWipe}
              >
                <Text style={styles.confirmWipeBtnText}>CONFERMA DISTRUZIONE</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Disconnessione Standard */}
      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Text style={styles.logoutBtnText}>[ DISCONNETTI NODO ]</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.bgApp,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    maxWidth: 650,
    width: "100%",
    alignSelf: "center",
  },
  header: {
    marginBottom: 20,
  },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(0, 255, 102, 0.08)",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(0, 255, 102, 0.3)",
    marginBottom: 6,
  },
  badgeText: {
    fontSize: 9,
    fontFamily: THEME.fonts.mono,
    color: THEME.colors.primary,
    letterSpacing: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: "900",
    color: THEME.colors.textPrimary,
    fontFamily: THEME.fonts.mono,
    letterSpacing: 1.5,
  },
  subtitle: {
    fontSize: 10,
    color: THEME.colors.textSecondary,
    fontFamily: THEME.fonts.mono,
    letterSpacing: 1,
    marginTop: 2,
  },
  noticeBanner: {
    backgroundColor: "rgba(0, 229, 255, 0.15)",
    borderWidth: 1,
    borderColor: THEME.colors.secondary,
    borderRadius: 6,
    padding: 10,
    marginBottom: 16,
  },
  noticeText: {
    color: THEME.colors.textCyan,
    fontFamily: THEME.fonts.mono,
    fontSize: 11,
  },
  card: {
    backgroundColor: THEME.colors.bgCard,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
    padding: 16,
    marginBottom: 16,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: THEME.colors.textSecondary,
    fontFamily: THEME.fonts.mono,
    letterSpacing: 1,
    marginBottom: 10,
  },
  nodeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  avatarBadge: {
    width: 44,
    height: 44,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#000",
    fontFamily: THEME.fonts.mono,
  },
  nodeMeta: {
    flex: 1,
  },
  nodeAlias: {
    fontSize: 17,
    fontWeight: "bold",
    color: THEME.colors.textPrimary,
    fontFamily: THEME.fonts.mono,
  },
  nodeBadge: {
    fontSize: 10,
    color: THEME.colors.primary,
    fontFamily: THEME.fonts.mono,
    marginTop: 2,
  },
  specBox: {
    backgroundColor: THEME.colors.bgInput,
    padding: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: THEME.colors.borderCard,
  },
  specLabel: {
    fontSize: 9,
    color: THEME.colors.textMuted,
    fontFamily: THEME.fonts.mono,
    marginTop: 4,
    letterSpacing: 0.5,
  },
  specVal: {
    fontSize: 11,
    color: THEME.colors.textCyan,
    fontFamily: THEME.fonts.mono,
    fontWeight: "bold",
  },
  specValGreen: {
    fontSize: 11,
    color: THEME.colors.primary,
    fontFamily: THEME.fonts.mono,
    fontWeight: "bold",
  },
  pingBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: "rgba(0, 229, 255, 0.1)",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: THEME.colors.secondary,
  },
  pingBtnText: {
    color: THEME.colors.secondary,
    fontFamily: THEME.fonts.mono,
    fontSize: 10,
    fontWeight: "bold",
  },
  relayStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  relayStatusText: {
    fontSize: 11,
    fontFamily: THEME.fonts.mono,
    fontWeight: "bold",
  },
  relayUrlText: {
    fontSize: 10,
    color: THEME.colors.textMuted,
    fontFamily: THEME.fonts.mono,
    marginBottom: 12,
  },
  customRelayBox: {
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.borderCard,
    paddingTop: 10,
  },
  fieldLabel: {
    fontSize: 9,
    color: THEME.colors.textSecondary,
    fontFamily: THEME.fonts.mono,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  inputRow: {
    flexDirection: "row",
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: THEME.colors.bgInput,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: THEME.colors.borderCard,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: THEME.colors.textPrimary,
    fontFamily: THEME.fonts.mono,
    fontSize: 12,
  },
  saveRelayBtn: {
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 14,
    justifyContent: "center",
    borderRadius: 6,
  },
  saveRelayBtnText: {
    color: "#000",
    fontFamily: THEME.fonts.mono,
    fontSize: 11,
    fontWeight: "bold",
  },
  dangerCard: {
    backgroundColor: "rgba(255, 23, 68, 0.05)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.colors.borderDanger,
    padding: 16,
    marginBottom: 16,
  },
  dangerHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  dangerTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: THEME.colors.textDanger,
    fontFamily: THEME.fonts.mono,
    letterSpacing: 1,
  },
  dangerTag: {
    backgroundColor: "rgba(255, 23, 68, 0.2)",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: THEME.colors.danger,
  },
  dangerTagText: {
    color: THEME.colors.textDanger,
    fontSize: 8,
    fontWeight: "bold",
    fontFamily: THEME.fonts.mono,
  },
  dangerDesc: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    fontFamily: THEME.fonts.mono,
    lineHeight: 16,
    marginBottom: 14,
  },
  panicButton: {
    backgroundColor: THEME.colors.danger,
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: "center",
    shadowColor: THEME.colors.danger,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  panicButtonText: {
    color: "#FFF",
    fontWeight: "bold",
    fontSize: 12,
    fontFamily: THEME.fonts.mono,
    letterSpacing: 1,
  },
  confirmBox: {
    backgroundColor: THEME.colors.bgInput,
    padding: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: THEME.colors.danger,
  },
  confirmWarning: {
    color: THEME.colors.textDanger,
    fontSize: 11,
    fontFamily: THEME.fonts.mono,
    marginBottom: 10,
    fontWeight: "bold",
    textAlign: "center",
  },
  confirmBtnRow: {
    flexDirection: "row",
    gap: 8,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: THEME.colors.bgCardLight,
    paddingVertical: 10,
    borderRadius: 4,
    alignItems: "center",
  },
  cancelBtnText: {
    color: THEME.colors.textMuted,
    fontFamily: THEME.fonts.mono,
    fontSize: 11,
  },
  confirmWipeBtn: {
    flex: 1,
    backgroundColor: THEME.colors.danger,
    paddingVertical: 10,
    borderRadius: 4,
    alignItems: "center",
  },
  confirmWipeBtnText: {
    color: "#FFF",
    fontFamily: THEME.fonts.mono,
    fontSize: 11,
    fontWeight: "bold",
  },
  logoutBtn: {
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: THEME.colors.borderCard,
  },
  logoutBtnText: {
    color: THEME.colors.textMuted,
    fontFamily: THEME.fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
  },
});
