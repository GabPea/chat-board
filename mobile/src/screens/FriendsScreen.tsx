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
  const { token } = useAuthStore();
  const { messages, unreadCounts } = useChatStore();

  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [requests, setRequests] = useState<PendingRequests>({ received: [], sent: [] });
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserSearchItem[]>([]);
  const [loading, setLoading] = useState(true);
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
    const timer = setInterval(loadData, 10000);
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
    if (!text.trim() || text.length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      if (token) {
        const results = await api.searchUsers(token, text);
        setSearchResults(results);
      }
    } catch (e) {
      console.error("Errore ricerca:", e);
    }
  };

  const handleSendRequest = async (targetUsername: string) => {
    if (!token) return;
    try {
      const msg = await api.sendFriendRequest(token, targetUsername);
      setActionNotice(msg);
      setTimeout(() => setActionNotice(null), 3000);
      loadData();
      handleSearch(searchQuery);
    } catch (e: any) {
      setActionNotice(e.message || "Errore invio richiesta");
      setTimeout(() => setActionNotice(null), 3000);
    }
  };

  const handleAcceptRequest = async (fromUsername: string) => {
    if (!token) return;
    try {
      const msg = await api.acceptFriendRequest(token, fromUsername);
      setActionNotice(msg);
      setTimeout(() => setActionNotice(null), 3000);
      loadData();
    } catch (e: any) {
      setActionNotice(e.message || "Errore accettazione richiesta");
      setTimeout(() => setActionNotice(null), 3000);
    }
  };

  const handleDeclineRequest = async (fromUsername: string) => {
    if (!token) return;
    try {
      await api.removeFriend(token, fromUsername);
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

      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Conversazioni Cifrate</Text>
          <View style={styles.onlineBadge}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlineText}>RELAY E2EE ATTIVO</Text>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchBar}>
          <TextInput
            style={styles.searchInput}
            placeholder="Cerca contatti o inserisci un username..."
            placeholderTextColor="#64748B"
            value={searchQuery}
            onChangeText={handleSearch}
            autoCapitalize="none"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => handleSearch("")}>
              <Text style={styles.clearSearch}>Annulla</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Action Notice */}
      {actionNotice && (
        <View style={styles.noticeBar}>
          <Text style={styles.noticeText}>{actionNotice}</Text>
        </View>
      )}

      {/* Search Results */}
      {searchQuery.trim().length >= 2 && (
        <View style={styles.searchSection}>
          <Text style={styles.sectionHeader}>UTENTI TROVATI</Text>
          {searchResults.length === 0 ? (
            <Text style={styles.emptyText}>Nessun utente trovato con questo nome.</Text>
          ) : (
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.username}
              renderItem={({ item }) => {
                const isAlreadyFriend = friends.some(
                  (f) => f.username.toLowerCase() === item.username.toLowerCase()
                );
                const tag = getAvatarTag(item.avatar);
                const color = getAvatarColor(item.avatar);
                return (
                  <View style={styles.userCard}>
                    <View style={styles.userLeft}>
                      <View style={[styles.userAvatar, { backgroundColor: color }]}>
                        <Text style={styles.userAvatarTag}>{tag}</Text>
                      </View>
                      <View>
                        <Text style={styles.userName}>@{item.username}</Text>
                        <Text style={styles.userMeta}>Contatto Cifrato E2EE</Text>
                      </View>
                    </View>
                    {isAlreadyFriend ? (
                      <View style={styles.alreadyFriendBadge}>
                        <Text style={styles.alreadyFriendText}>Connesso</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.addBtn}
                        onPress={() => handleSendRequest(item.username)}
                      >
                        <Text style={styles.addBtnText}>Collega</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              }}
            />
          )}
        </View>
      )}

      {/* Richieste di contatto in arrivo */}
      {requests.received.length > 0 && !searchQuery && (
        <View style={styles.requestsSection}>
          <Text style={styles.sectionHeader}>
            RICHIESTE DI CONNESSIONE ({requests.received.length})
          </Text>
          {requests.received.map((req) => (
            <View key={req.username} style={styles.requestCard}>
              <View style={styles.userLeft}>
                <View style={[styles.userAvatar, { backgroundColor: getAvatarColor(req.avatar) }]}>
                  <Text style={styles.userAvatarTag}>{getAvatarTag(req.avatar)}</Text>
                </View>
                <View>
                  <Text style={styles.userName}>@{req.username}</Text>
                  <Text style={styles.userMeta}>Richiesta di connessione</Text>
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

      {/* Lista Amici */}
      {!searchQuery && (
        <View style={styles.friendsSection}>
          <Text style={styles.sectionHeader}>CONTATTI ({friends.length})</Text>

          {loading ? (
            <ActivityIndicator color={THEME.colors.primary} style={{ marginTop: 30 }} />
          ) : friends.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>Nessuna chat attiva</Text>
              <Text style={styles.emptyDesc}>
                Cerca un utente in alto per inviare una richiesta e avviare una conversazione cifrata.
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
                    activeOpacity={0.7}
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
                          {item.is_online ? "Connesso" : "Silente"}
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
                            ? "Canale cifrato attivo"
                            : "Avvia conversazione cifrata"}
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
    backgroundColor: THEME.colors.bgApp,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.borderSubtle,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    color: THEME.colors.textPrimary,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  onlineBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(16, 185, 129, 0.1)",
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
    fontSize: 10,
    fontWeight: "800",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: THEME.colors.bgInput,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
  },
  searchInput: {
    flex: 1,
    color: THEME.colors.textPrimary,
    fontSize: 14,
  },
  clearSearch: {
    color: THEME.colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    paddingHorizontal: 6,
  },
  noticeBar: {
    backgroundColor: THEME.colors.bgCardLight,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  noticeText: {
    color: THEME.colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  sectionHeader: {
    color: THEME.colors.textMuted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    marginHorizontal: 20,
    marginTop: 14,
    marginBottom: 8,
  },
  searchSection: {
    flex: 1,
    paddingHorizontal: 20,
  },
  emptyText: {
    color: THEME.colors.textSecondary,
    fontSize: 13,
    textAlign: "center",
    marginTop: 20,
  },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: THEME.colors.bgCard,
    padding: 12,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
  },
  userLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  userAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  userAvatarTag: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "900",
  },
  userName: {
    color: THEME.colors.textPrimary,
    fontSize: 15,
    fontWeight: "700",
  },
  userMeta: {
    color: THEME.colors.textSecondary,
    fontSize: 12,
  },
  addBtn: {
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addBtnText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "700",
  },
  alreadyFriendBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  alreadyFriendText: {
    color: THEME.colors.textMuted,
    fontSize: 11,
    fontWeight: "600",
  },
  requestsSection: {
    backgroundColor: "rgba(225, 29, 72, 0.06)",
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.borderSubtle,
    paddingBottom: 8,
  },
  requestCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: THEME.colors.bgCard,
    marginHorizontal: 20,
    marginBottom: 6,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
  },
  requestActions: {
    flexDirection: "row",
  },
  acceptBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: THEME.colors.online,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  acceptBtnText: {
    color: "#FFF",
    fontSize: 11,
    fontWeight: "800",
  },
  declineBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "rgba(239, 68, 68, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: THEME.colors.danger,
  },
  declineBtnText: {
    color: THEME.colors.danger,
    fontSize: 11,
    fontWeight: "700",
  },
  friendsSection: {
    flex: 1,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    marginTop: 50,
  },
  emptyTitle: {
    color: THEME.colors.textPrimary,
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 6,
  },
  emptyDesc: {
    color: THEME.colors.textSecondary,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  friendRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.borderSubtle,
  },
  avatarContainer: {
    position: "relative",
    marginRight: 12,
  },
  friendAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  friendAvatarTag: {
    fontSize: 14,
    fontWeight: "900",
    color: "#FFF",
  },
  statusBadge: {
    position: "absolute",
    bottom: -1,
    right: -1,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: THEME.colors.bgApp,
  },
  statusOnline: {
    backgroundColor: THEME.colors.online,
  },
  statusOffline: {
    backgroundColor: THEME.colors.offline,
  },
  friendDetails: {
    flex: 1,
  },
  friendTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 3,
  },
  friendNameWithBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  friendName: {
    color: THEME.colors.textPrimary,
    fontSize: 15,
    fontWeight: "700",
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
    fontSize: 9,
    fontWeight: "700",
    color: THEME.colors.primary,
    letterSpacing: 0.3,
  },
  statusIndicatorText: {
    fontSize: 11,
    fontWeight: "500",
  },
  statusOnlineText: {
    color: THEME.colors.online,
  },
  statusOfflineText: {
    color: THEME.colors.textMuted,
  },
  friendBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  lastMessageText: {
    flex: 1,
    color: THEME.colors.textSecondary,
    fontSize: 13,
    marginRight: 8,
  },
  lastMessageUnread: {
    color: THEME.colors.textPrimary,
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
});
