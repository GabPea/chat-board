import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  RefreshControl,
} from "react-native";
import { THEME, getAvatarTag, getAvatarColor } from "../theme";
import { api, FriendItem, PendingRequests, UserSearchItem } from "../services/api";
import { useAuthStore } from "../store/authStore";
import { useChatStore } from "../store/chatStore";
import { wsService } from "../services/websocket";

interface FriendsScreenProps {
  onSelectFriend: (friend: FriendItem) => void;
}

export default function FriendsScreen({ onSelectFriend }: FriendsScreenProps) {
  const { token, user } = useAuthStore();
  const { messages, unreadCounts } = useChatStore();

  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [requests, setRequests] = useState<PendingRequests>({ received: [], sent: [] });
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserSearchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!token) return;
    try {
      const [friendsData, requestsData] = await Promise.all([
        api.getFriends(token),
        api.getFriendRequests(token),
      ]);
      setFriends(friendsData);
      setRequests(requestsData);
    } catch (e) {
      console.error("Errore caricamento amici:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    loadData();
    const timer = setInterval(loadData, 8000);
    return () => clearInterval(timer);
  }, [loadData]);

  useEffect(() => {
    const handler = (data: any) => {
      if (data.type === "friend_status") {
        setFriends((prev) =>
          prev.map((f) =>
            f.username.toLowerCase() === data.username.toLowerCase()
              ? { ...f, is_online: data.status === "online" }
              : f
          )
        );
      } else if (data.type === "friend_request_received" || data.type === "friend_accepted") {
        loadData();
      }
    };

    wsService.addHandler(handler);
    return () => wsService.removeHandler(handler);
  }, [loadData]);

  const handleSearch = async (text: string) => {
    setSearchQuery(text);
    const clean = text.trim();
    if (!clean) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      if (token) {
        const results = await api.searchUsers(token, clean);
        // Escludi se stessi
        const filtered = results.filter(
          (u) => u.username.toLowerCase() !== user?.username.toLowerCase()
        );
        setSearchResults(filtered);
      }
    } catch (e) {
      console.error("Errore ricerca:", e);
    } finally {
      setSearching(false);
    }
  };

  const handleSendFriendRequest = async (targetUsername: string) => {
    if (!token) return;
    try {
      const msg = await api.sendFriendRequest(token, targetUsername);
      setActionNotice(msg || `Richiesta di amicizia inviata a @${targetUsername}`);
      setTimeout(() => setActionNotice(null), 3500);
      loadData();
      if (searchQuery.trim()) {
        handleSearch(searchQuery);
      }
    } catch (e: any) {
      setActionNotice(e.message || "Impossibile inviare richiesta di amicizia.");
      setTimeout(() => setActionNotice(null), 3500);
    }
  };

  const handleAcceptRequest = async (fromUsername: string) => {
    if (!token) return;
    try {
      const msg = await api.acceptFriendRequest(token, fromUsername);
      setActionNotice(msg || `Hai accettato la richiesta di @${fromUsername}. Ora potete chattare!`);
      setTimeout(() => setActionNotice(null), 3500);
      loadData();
    } catch (e: any) {
      setActionNotice(e.message || "Errore accettazione richiesta.");
      setTimeout(() => setActionNotice(null), 3500);
    }
  };

  const handleDeclineRequest = async (fromUsername: string) => {
    if (!token) return;
    try {
      await api.removeFriend(token, fromUsername);
      setActionNotice(`Richiesta di @${fromUsername} rifiutata.`);
      setTimeout(() => setActionNotice(null), 3000);
      loadData();
    } catch (e: any) {}
  };

  const getLastMessage = (username: string) => {
    const chat = messages[username.toLowerCase()];
    if (!chat || chat.length === 0) return null;
    return chat[chat.length - 1];
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header Cyber Elegante */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View>
            <Text style={styles.title}>Messaggi</Text>
            <Text style={styles.subtitle}>Crittografia E2EE (Nessun log su disco)</Text>
          </View>
          <View style={styles.onlineBadge}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlineText}>RELAY ATTIVO</Text>
          </View>
        </View>

        {/* Barra di Ricerca Utenti Registrati */}
        <View style={styles.searchBar}>
          <TextInput
            style={styles.searchInput}
            placeholder="Cerca utenti registrati per nome..."
            placeholderTextColor="#64748B"
            value={searchQuery}
            onChangeText={handleSearch}
            autoCapitalize="none"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => handleSearch("")}>
              <Text style={styles.clearSearch}>Cancella</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Banner Notifica Azione */}
      {actionNotice && (
        <View style={styles.noticeBar}>
          <Text style={styles.noticeText}>{actionNotice}</Text>
        </View>
      )}

      {/* ── MODALITÀ A: RISULTATI DI RICERCA UTENTI ── */}
      {searchQuery.trim().length > 0 ? (
        <View style={styles.searchSection}>
          <Text style={styles.sectionHeader}>
            UTENTI REGISTRATI TROVATI ({searchResults.length})
          </Text>

          {searching ? (
            <ActivityIndicator color={THEME.colors.primary} style={{ marginTop: 20 }} />
          ) : searchResults.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyCardTitle}>Nessun utente trovato</Text>
              <Text style={styles.emptyCardSub}>
                Nessun account registrato corrisponde a "{searchQuery}".
              </Text>
            </View>
          ) : (
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.username}
              renderItem={({ item }) => {
                const tag = getAvatarTag(item.avatar);
                const color = getAvatarColor(item.avatar);

                const isAlreadyFriend = friends.some(
                  (f) => f.username.toLowerCase() === item.username.toLowerCase()
                );

                const hasSentRequest = requests.sent.some(
                  (r) => r.username.toLowerCase() === item.username.toLowerCase()
                );

                const hasReceivedRequest = requests.received.some(
                  (r) => r.username.toLowerCase() === item.username.toLowerCase()
                );

                return (
                  <View style={styles.userCard}>
                    <View style={styles.userLeft}>
                      <View style={[styles.userAvatar, { backgroundColor: color }]}>
                        <Text style={styles.userAvatarTag}>{tag}</Text>
                        <View
                          style={[
                            styles.userStatusDot,
                            item.is_online ? styles.statusOnline : styles.statusOffline,
                          ]}
                        />
                      </View>
                      <View>
                        <View style={styles.nameRow}>
                          <Text style={styles.userName}>@{item.username}</Text>
                        </View>
                        <Text style={styles.userMeta}>
                          {item.is_online ? "Attivo ora" : "Non connesso"}
                        </Text>
                      </View>
                    </View>

                    {/* Azioni Amicizia / Chat */}
                    <View style={styles.userActions}>
                      {isAlreadyFriend ? (
                        <TouchableOpacity
                          style={styles.chatNowBtn}
                          onPress={() =>
                            onSelectFriend({
                              id: item.id,
                              username: item.username,
                              avatar: item.avatar,
                              is_online: item.is_online ?? false,
                            })
                          }
                        >
                          <Text style={styles.chatNowBtnText}>Chatta</Text>
                        </TouchableOpacity>
                      ) : hasSentRequest ? (
                        <View style={styles.requestSentBadge}>
                          <Text style={styles.requestSentText}>Richiesta Inviata</Text>
                        </View>
                      ) : hasReceivedRequest ? (
                        <TouchableOpacity
                          style={styles.acceptSmallBtn}
                          onPress={() => handleAcceptRequest(item.username)}
                        >
                          <Text style={styles.acceptSmallBtnText}>Accetta Amicizia</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={styles.addFriendBtn}
                          onPress={() => handleSendFriendRequest(item.username)}
                        >
                          <Text style={styles.addFriendBtnText}>+ Invia Richiesta</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              }}
            />
          )}
        </View>
      ) : (
        /* ── MODALITÀ B: LISTA AMICI EFFETTIVI & RICHIESTE IN ARRIVO ── */
        <View style={styles.mainContent}>
          {/* Sezione Richieste di Amicizia Ricevute */}
          {requests.received.length > 0 && (
            <View style={styles.requestsSection}>
              <Text style={styles.sectionHeader}>
                RICHIESTE DI AMICIZIA IN ARRIVO ({requests.received.length})
              </Text>
              {requests.received.map((req) => (
                <View key={req.username} style={styles.requestCard}>
                  <View style={styles.userLeft}>
                    <View
                      style={[
                        styles.userAvatar,
                        { backgroundColor: getAvatarColor(req.avatar) },
                      ]}
                    >
                      <Text style={styles.userAvatarTag}>{getAvatarTag(req.avatar)}</Text>
                    </View>
                    <View>
                      <Text style={styles.userName}>@{req.username}</Text>
                      <Text style={styles.userMeta}>Vuole iniziare a chattare</Text>
                    </View>
                  </View>
                  <View style={styles.requestActions}>
                    <TouchableOpacity
                      style={styles.acceptBtn}
                      onPress={() => handleAcceptRequest(req.username)}
                    >
                      <Text style={styles.acceptBtnText}>Accetta</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.declineBtn}
                      onPress={() => handleDeclineRequest(req.username)}
                    >
                      <Text style={styles.declineBtnText}>Rifiuta</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Lista Conversazioni Attive con Amici Accettati */}
          <Text style={styles.sectionHeader}>CONVERSAZIONI ATTIVE ({friends.length})</Text>

          {loading ? (
            <ActivityIndicator color={THEME.colors.primary} style={{ marginTop: 40 }} />
          ) : friends.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconBox}>
                <Text style={styles.emptyIconGlyph}>§</Text>
              </View>
              <Text style={styles.emptyTitle}>Nessuna conversazione</Text>
              <Text style={styles.emptyDesc}>
                Cerca un altro utente registrato nella barra in alto e inviagli una richiesta di amicizia per iniziare a chattare.
              </Text>
            </View>
          ) : (
            <FlatList
              data={friends}
              keyExtractor={(item) => item.username}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => {
                    setRefreshing(true);
                    loadData();
                  }}
                  tintColor={THEME.colors.primary}
                />
              }
              contentContainerStyle={{ paddingBottom: 20 }}
              renderItem={({ item }) => {
                const lastMsg = getLastMessage(item.username);
                const unread = unreadCounts[item.username.toLowerCase()] || 0;
                const tag = getAvatarTag(item.avatar);
                const color = getAvatarColor(item.avatar);

                return (
                  <TouchableOpacity
                    style={styles.friendRow}
                    onPress={() => onSelectFriend(item)}
                    activeOpacity={0.75}
                  >
                    <View style={styles.avatarContainer}>
                      <View style={[styles.friendAvatar, { backgroundColor: color }]}>
                        <Text style={styles.friendAvatarTag}>{tag}</Text>
                      </View>
                      <View
                        style={[
                          styles.statusBadge,
                          item.is_online ? styles.statusOnline : styles.statusOffline,
                        ]}
                      />
                    </View>

                    <View style={styles.friendDetails}>
                      <View style={styles.friendTopRow}>
                        <View style={styles.friendNameWithBadge}>
                          <Text style={styles.friendName}>@{item.username}</Text>
                          <View style={styles.miniE2EE}>
                            <Text style={styles.miniE2EEText}>E2EE</Text>
                          </View>
                        </View>
                        <Text
                          style={[
                            styles.statusIndicatorText,
                            item.is_online ? styles.statusOnlineText : styles.statusOfflineText,
                          ]}
                        >
                          {item.is_online ? "Attivo" : "Silente"}
                        </Text>
                      </View>

                      <View style={styles.friendBottomRow}>
                        <Text
                          style={[
                            styles.lastMessageText,
                            unread > 0 && styles.lastMessageUnread,
                          ]}
                          numberOfLines={1}
                        >
                          {lastMsg
                            ? `${lastMsg.isMine ? "Tu: " : ""}${lastMsg.content}`
                            : item.is_online
                            ? "Canale cifrato pronto"
                            : "Tocca per scrivere..."}
                        </Text>

                        {unread > 0 && (
                          <View style={styles.unreadBadge}>
                            <Text style={styles.unreadBadgeText}>{unread}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#060913",
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    backgroundColor: "#0A0F1E",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(14, 165, 233, 0.2)",
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    color: "#F8FAFC",
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  subtitle: {
    color: "#94A3B8",
    fontSize: 11,
    marginTop: 2,
    fontFamily: THEME.fonts.mono,
  },
  onlineBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: THEME.colors.online,
    marginRight: 6,
  },
  onlineText: {
    color: THEME.colors.online,
    fontSize: 9,
    fontWeight: "800",
    fontFamily: THEME.fonts.mono,
    letterSpacing: 0.5,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#060913",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  searchInput: {
    flex: 1,
    color: "#F8FAFC",
    fontSize: 13,
  },
  clearSearch: {
    color: THEME.colors.primary,
    fontSize: 11,
    fontWeight: "700",
    paddingHorizontal: 6,
  },
  noticeBar: {
    backgroundColor: "rgba(14, 165, 233, 0.15)",
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  noticeText: {
    color: THEME.colors.primary,
    fontSize: 11,
    fontWeight: "700",
    fontFamily: THEME.fonts.mono,
    textAlign: "center",
  },
  sectionHeader: {
    color: "#94A3B8",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
    fontFamily: THEME.fonts.mono,
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 8,
  },
  searchSection: {
    flex: 1,
    paddingHorizontal: 16,
  },
  mainContent: {
    flex: 1,
  },
  emptyCard: {
    backgroundColor: "#0A0F1E",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    padding: 24,
    alignItems: "center",
    marginTop: 8,
  },
  emptyCardTitle: {
    color: "#FFF",
    fontSize: 13,
    fontWeight: "700",
  },
  emptyCardSub: {
    color: "#64748B",
    fontSize: 11,
    marginTop: 4,
    textAlign: "center",
  },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#0D1424",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(14, 165, 233, 0.2)",
    padding: 12,
    marginVertical: 4,
  },
  userLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    position: "relative",
  },
  userAvatarTag: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "900",
  },
  userStatusDot: {
    position: "absolute",
    bottom: -1,
    right: -1,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#0D1424",
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  userName: {
    color: "#FFF",
    fontSize: 13,
    fontWeight: "700",
  },
  userMeta: {
    color: "#64748B",
    fontSize: 10,
    marginTop: 2,
  },
  userActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  chatNowBtn: {
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  chatNowBtnText: {
    color: "#FFF",
    fontSize: 11,
    fontWeight: "700",
  },
  addFriendBtn: {
    backgroundColor: "rgba(14, 165, 233, 0.15)",
    borderWidth: 1,
    borderColor: THEME.colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addFriendBtnText: {
    color: THEME.colors.primary,
    fontSize: 11,
    fontWeight: "700",
  },
  requestSentBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  requestSentText: {
    color: "#94A3B8",
    fontSize: 10,
    fontWeight: "600",
  },
  acceptSmallBtn: {
    backgroundColor: THEME.colors.online,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  acceptSmallBtnText: {
    color: "#FFF",
    fontSize: 10,
    fontWeight: "700",
  },

  // Richieste
  requestsSection: {
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  requestCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#0D1424",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.35)",
    padding: 12,
    marginVertical: 4,
  },
  requestActions: {
    flexDirection: "row",
    gap: 6,
  },
  acceptBtn: {
    backgroundColor: THEME.colors.online,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  acceptBtnText: {
    color: "#FFF",
    fontSize: 11,
    fontWeight: "700",
  },
  declineBtn: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  declineBtnText: {
    color: "#94A3B8",
    fontSize: 11,
  },

  // Lista Amici
  friendRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.04)",
  },
  avatarContainer: {
    position: "relative",
    marginRight: 12,
  },
  friendAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  friendAvatarTag: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "900",
  },
  statusBadge: {
    position: "absolute",
    bottom: -1,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: "#060913",
  },
  statusOnline: {
    backgroundColor: THEME.colors.online,
  },
  statusOffline: {
    backgroundColor: "#475569",
  },
  friendDetails: {
    flex: 1,
  },
  friendTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  friendNameWithBadge: {
    flexDirection: "row",
    alignItems: "center",
  },
  friendName: {
    color: "#F8FAFC",
    fontSize: 14,
    fontWeight: "700",
    marginRight: 6,
  },
  miniE2EE: {
    backgroundColor: "rgba(14, 165, 233, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(14, 165, 233, 0.25)",
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  miniE2EEText: {
    color: THEME.colors.primary,
    fontSize: 8,
    fontWeight: "800",
    fontFamily: THEME.fonts.mono,
  },
  statusIndicatorText: {
    fontSize: 10,
    fontFamily: THEME.fonts.mono,
  },
  statusOnlineText: {
    color: THEME.colors.online,
    fontWeight: "700",
  },
  statusOfflineText: {
    color: "#64748B",
  },
  friendBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  lastMessageText: {
    color: "#94A3B8",
    fontSize: 12,
    flex: 1,
    marginRight: 10,
  },
  lastMessageUnread: {
    color: "#FFF",
    fontWeight: "700",
  },
  unreadBadge: {
    backgroundColor: THEME.colors.primary,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  unreadBadgeText: {
    color: "#FFF",
    fontSize: 10,
    fontWeight: "800",
  },
  emptyContainer: {
    paddingHorizontal: 24,
    paddingVertical: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyIconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(14, 165, 233, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(14, 165, 233, 0.25)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyIconGlyph: {
    color: THEME.colors.primary,
    fontSize: 22,
    fontFamily: THEME.fonts.mono,
    fontWeight: "900",
  },
  emptyTitle: {
    color: "#F8FAFC",
    fontSize: 15,
    fontWeight: "700",
  },
  emptyDesc: {
    color: "#64748B",
    fontSize: 12,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18,
    maxWidth: 280,
  },
});
