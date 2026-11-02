import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Platform,
} from "react-native";
import { THEME } from "../theme";
import { SERVER_URL } from "../config";
import { useAuthStore } from "../store/authStore";
import { wsService } from "../services/websocket";

export default function AuthScreen() {
  const { setAuth } = useAuthStore();
  const [mode, setMode] = useState<"login" | "register">("login");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState("aegis");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    const cleanUser = username.trim();
    if (!cleanUser || cleanUser.length < 3) {
      setError("Il nome utente deve contenere almeno 3 caratteri.");
      return;
    }
    if (!password || password.length < 4) {
      setError("La password deve contenere almeno 4 caratteri.");
      return;
    }

    setLoading(true);
    try {
      const endpoint = mode === "register" ? "/api/register" : "/api/login";
      const payload: any = { username: cleanUser, password };
      if (mode === "register") {
        payload.avatar = selectedAvatar;
      }

      const res = await fetch(`${SERVER_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Errore durante l'autenticazione.");
      }

      setAuth(data.token, {
        username: data.username,
        avatar: data.avatar || "aegis",
      });
      wsService.connect(data.token);
    } catch (e: any) {
      setError(e.message || "Impossibile contattare il server relay.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          {/* Brand Header */}
          <View style={styles.brandContainer}>
            <View style={styles.brandLogo}>
              <Text style={styles.brandLogoText}>S</Text>
            </View>
            <Text style={styles.brandTitle}>SOVEREIGN</Text>
            <Text style={styles.brandSubtitle}>
              Blind Relay Cifrato End-to-End • Zero Log
            </Text>

            <View style={styles.statusBadge}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>AES-256-GCM // CLIENT-SIDE READY</Text>
            </View>
          </View>

          {/* Segmented Mode Switcher */}
          <View style={styles.segmentContainer}>
            <TouchableOpacity
              activeOpacity={0.8}
              style={[styles.segmentBtn, mode === "login" && styles.segmentBtnActive]}
              onPress={() => {
                setMode("login");
                setError(null);
              }}
            >
              <Text style={[styles.segmentText, mode === "login" && styles.segmentTextActive]}>
                Accedi
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              style={[styles.segmentBtn, mode === "register" && styles.segmentBtnActive]}
              onPress={() => {
                setMode("register");
                setError(null);
              }}
            >
              <Text style={[styles.segmentText, mode === "register" && styles.segmentTextActive]}>
                Crea Account
              </Text>
            </TouchableOpacity>
          </View>

          {/* Error Message */}
          {error && (
            <View style={styles.errorBox}>
              <View style={styles.errorIndicator} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Form */}
          <View style={styles.formGroup}>
            <Text style={styles.fieldLabel}>Nome utente</Text>
            <TextInput
              style={styles.input}
              placeholder="Inserisci il tuo alias"
              placeholderTextColor={THEME.colors.textMuted}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.fieldLabel}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••••••"
              placeholderTextColor={THEME.colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              onSubmitEditing={handleSubmit}
            />
          </View>

          {/* Avatar Selector (Only for Registration) */}
          {mode === "register" && (
            <View style={styles.avatarSection}>
              <Text style={styles.fieldLabel}>Profilo identificativo</Text>
              <View style={styles.avatarGrid}>
                {THEME.avatars.map((av) => {
                  const isSelected = selectedAvatar === av.id;
                  return (
                    <TouchableOpacity
                      key={av.id}
                      activeOpacity={0.7}
                      style={[
                        styles.avatarOption,
                        isSelected && {
                          borderColor: av.color,
                          backgroundColor: `${av.color}18`,
                        },
                      ]}
                      onPress={() => setSelectedAvatar(av.id)}
                    >
                      <View style={[styles.avatarTagCircle, { backgroundColor: av.color }]}>
                        <Text style={styles.avatarTagText}>{av.tag}</Text>
                      </View>
                      <Text
                        style={[
                          styles.avatarLabel,
                          isSelected && { color: av.color, fontWeight: "600" },
                        ]}
                      >
                        {av.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Submit Button */}
          <TouchableOpacity
            activeOpacity={0.85}
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.submitButtonText}>
                {mode === "login" ? "Accedi alla Sessione" : "Crea Account Cifrato"}
              </Text>
            )}
          </TouchableOpacity>

          {/* Security Footnote */}
          <View style={styles.footnoteContainer}>
            <Text style={styles.footnoteText}>
              Cifratura AES-256-GCM client-side. Zero archiviazione di messaggi su disco.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.bgVoid,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
  },
  card: {
    maxWidth: 420,
    width: "100%",
    alignSelf: "center",
    backgroundColor: THEME.colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.colors.borderCard,
    padding: 28,
    ...(Platform.OS === "web"
      ? {
          boxShadow: "0 16px 36px rgba(0, 0, 0, 0.4)",
        }
      : {
          elevation: 6,
        }),
  },
  brandContainer: {
    alignItems: "center",
    marginBottom: 26,
  },
  brandLogo: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: THEME.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  brandLogoText: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: THEME.colors.textPrimary,
    letterSpacing: -0.4,
  },
  brandSubtitle: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    marginTop: 4,
    textAlign: "center",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(16, 185, 129, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.2)",
    borderRadius: 16,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginTop: 12,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: THEME.colors.online,
    marginRight: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "500",
    color: THEME.colors.online,
  },
  segmentContainer: {
    flexDirection: "row",
    backgroundColor: THEME.colors.bgInput,
    borderRadius: 10,
    padding: 3,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 8,
  },
  segmentBtnActive: {
    backgroundColor: THEME.colors.bgCardLight,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: "500",
    color: THEME.colors.textMuted,
  },
  segmentTextActive: {
    color: THEME.colors.textPrimary,
    fontWeight: "600",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(220, 38, 38, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(220, 38, 38, 0.25)",
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
  },
  errorIndicator: {
    width: 3,
    height: 14,
    backgroundColor: THEME.colors.danger,
    borderRadius: 2,
    marginRight: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: THEME.colors.textDanger,
    fontWeight: "500",
  },
  formGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: THEME.colors.textSecondary,
    marginBottom: 6,
  },
  input: {
    backgroundColor: THEME.colors.bgInput,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    color: THEME.colors.textPrimary,
  },
  avatarSection: {
    marginBottom: 18,
  },
  avatarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  avatarOption: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: THEME.colors.bgInput,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  avatarTagCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  avatarTagText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  avatarLabel: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
  },
  submitButton: {
    backgroundColor: THEME.colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
    ...(Platform.OS === "web"
      ? {
          cursor: "pointer",
        }
      : {}),
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  footnoteContainer: {
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.06)",
  },
  footnoteText: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    textAlign: "center",
    lineHeight: 15,
  },
});
