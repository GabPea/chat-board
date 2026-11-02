import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Platform,
} from "react-native";
import { THEME } from "./src/theme";
import { useAuthStore } from "./src/store/authStore";
import { useChatStore } from "./src/store/chatStore";
import { wsService } from "./src/services/websocket";
import { FriendItem } from "./src/services/api";

import AuthScreen from "./src/screens/AuthScreen";
import FriendsScreen from "./src/screens/FriendsScreen";
import DirectChatScreen from "./src/screens/DirectChatScreen";
import ProfileScreen from "./src/screens/ProfileScreen";

type Tab = "chats" | "profile";

export default function App() {
  const { token, isAuthenticated, loadStoredAuth } = useAuthStore();
  const { loadStoredChats, unreadCounts } = useChatStore();

  // Tab di default su Messaggi / Chat
  const [activeTab, setActiveTab] = useState<Tab>("chats");
  const [selectedFriend, setSelectedFriend] = useState<FriendItem | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    loadStoredAuth();
    loadStoredChats();
    setInitialized(true);
  }, [loadStoredAuth, loadStoredChats]);

  useEffect(() => {
    if (isAuthenticated && token) {
      wsService.connect(token);
    } else {
      wsService.disconnect();
    }
  }, [isAuthenticated, token]);

  if (!initialized) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={THEME.colors.primary} size="large" />
      </View>
    );
  }

  // Wrapper responsivo desktop
  const renderScreenContent = () => {
    if (!isAuthenticated || !token) {
      return <AuthScreen />;
    }

    if (selectedFriend) {
      return (
        <DirectChatScreen
          friend={selectedFriend}
          onBack={() => setSelectedFriend(null)}
          onFriendRemoved={() => setSelectedFriend(null)}
        />
      );
    }

    return (
      <View style={styles.mainLayout}>
        <View style={styles.tabContent}>
          {activeTab === "chats" && (
            <FriendsScreen onSelectFriend={(friend) => setSelectedFriend(friend)} />
          )}
          {activeTab === "profile" && <ProfileScreen />}
        </View>

        {/* Navigation Bar Professionale */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === "chats" && styles.tabButtonActive]}
            onPress={() => setActiveTab("chats")}
            activeOpacity={0.8}
          >
            <View style={styles.tabLabelRow}>
              <Text style={[styles.tabButtonText, activeTab === "chats" && styles.tabButtonTextActive]}>
                Messaggi
              </Text>
              {totalUnread > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>{totalUnread > 99 ? "99+" : totalUnread}</Text>
                </View>
              )}
            </View>
            {activeTab === "chats" && <View style={styles.activeBar} />}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === "profile" && styles.tabButtonActive]}
            onPress={() => setActiveTab("profile")}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabButtonText, activeTab === "profile" && styles.tabButtonTextActive]}>
              Sicurezza & Profilo
            </Text>
            {activeTab === "profile" && <View style={styles.activeBar} />}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const totalUnread = Object.values(unreadCounts).reduce((acc, curr) => acc + curr, 0);

  return (
    <SafeAreaView style={styles.outerContainer}>
      <StatusBar barStyle="light-content" />
      {/* Contenitore centrato per evitare deformazioni su browser desktop */}
      <View style={styles.appCanvas}>
        {renderScreenContent()}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: THEME.colors.bgVoid,
    alignItems: "center",
    justifyContent: "center",
  },
  appCanvas: {
    width: "100%",
    maxWidth: 580,
    height: "100%",
    backgroundColor: THEME.colors.bgApp,
    overflow: "hidden",
    ...(Platform.OS === "web"
      ? {
          boxShadow: "0 25px 60px rgba(0, 0, 0, 0.5), 0 0 1px rgba(255, 255, 255, 0.1)",
          borderLeftWidth: 1,
          borderRightWidth: 1,
          borderColor: "rgba(255, 255, 255, 0.08)",
        }
      : {}),
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: THEME.colors.bgApp,
    alignItems: "center",
    justifyContent: "center",
  },
  mainLayout: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: THEME.colors.bgCard,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.08)",
    paddingVertical: 12,
    paddingHorizontal: 16,
    justifyContent: "space-around",
    alignItems: "center",
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    position: "relative",
  },
  tabButtonActive: {},
  tabLabelRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: "500",
    color: THEME.colors.textMuted,
  },
  tabButtonTextActive: {
    color: THEME.colors.textPrimary,
    fontWeight: "600",
  },
  activeBar: {
    position: "absolute",
    bottom: -6,
    width: 24,
    height: 2,
    backgroundColor: THEME.colors.primary,
    borderRadius: 1,
  },
  unreadBadge: {
    marginLeft: 6,
    backgroundColor: THEME.colors.primary,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  unreadBadgeText: {
    color: "#FFF",
    fontSize: 10,
    fontWeight: "700",
  },
});
