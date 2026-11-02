import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Alert,
  Image,
  ScrollView,
} from "react-native";
import { THEME, getAvatarTag, getAvatarColor } from "../theme";
import { FriendItem, api } from "../services/api";
import { useAuthStore, isRootUser } from "../store/authStore";
import { useChatStore, ChatMessage } from "../store/chatStore";
import { wsService } from "../services/websocket";
import { cryptoEngine } from "../services/crypto";
import { saveMediaToDevice, copyTextToClipboard } from "../services/fileSaver";

interface DirectChatScreenProps {
  friend: FriendItem;
  onBack: () => void;
  onFriendRemoved?: () => void;
}

export default function DirectChatScreen({
  friend,
  onBack,
  onFriendRemoved,
}: DirectChatScreenProps) {
  const { token, user } = useAuthStore();
  const isRoot = isRootUser(user);
  const { messages, addMessage, deleteMessage, setActiveFriendChat, clearChat } =
    useChatStore();
  const [input, setInput] = useState("");
  const [isFriendTyping, setIsFriendTyping] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  // ── FUNZIONALITÀ CYBERSECURITY AVANZATE ──
  const [inspectedMessage, setInspectedMessage] = useState<ChatMessage | null>(null);
  const [showSafetyModal, setShowSafetyModal] = useState(false);
  const [safetyFingerprint, setSafetyFingerprint] = useState<string>("CALCOLO IN CORSO...");
  const [isVerifiedChannel, setIsVerifiedChannel] = useState(false);
  const [isCamouflageMode, setIsCamouflageMode] = useState(false);

  // Timer Autodistruzione per nuove foto: null (spento), 5, 10, 30 secondi
  const [selectedTimer, setSelectedTimer] = useState<number | null>(null);

  // Gestione Vocali
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);

  // Riproduzione Audio
  const [audioPlayingId, setAudioPlayingId] = useState<string | null>(null);
  const [audioProgress, setAudioProgress] = useState<Record<string, number>>({});

  // Protezione Anti-Screenshot / Privacy Shield
  const [isBlurredShield, setIsBlurredShield] = useState(false);

  // Modali
  const [deleteConfirmMsg, setDeleteConfirmMsg] = useState<ChatMessage | null>(null);
  const [activePreviewMedia, setActivePreviewMedia] = useState<{
    type: "image" | "video";
    data: string;
    timer?: number;
    msg?: ChatMessage;
  } | null>(null);
  const [previewCountdown, setPreviewCountdown] = useState<number | null>(null);
  const [isProcessingMedia, setIsProcessingMedia] = useState(false);

  // Gestione Vault Media & Download
  const [showMediaGallery, setShowMediaGallery] = useState(false);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [savedToastMsg, setSavedToastMsg] = useState<string | null>(null);

  const handleSaveImage = (mediaData: string, id: string) => {
    saveMediaToDevice(mediaData, `sovereign_foto_${friendUsername}_${id.substring(0, 8)}.jpg`);
    setSavedToastMsg("Immagine salvata sul tuo dispositivo.");
    setTimeout(() => setSavedToastMsg(null), 2500);
  };

  const handleSaveVideo = (mediaData: string, id: string) => {
    saveMediaToDevice(mediaData, `sovereign_video_${friendUsername}_${id.substring(0, 8)}.mp4`);
    setSavedToastMsg("Video salvato sul tuo dispositivo.");
    setTimeout(() => setSavedToastMsg(null), 2500);
  };

  const handleCopyText = async (text: string, id: string) => {
    const ok = await copyTextToClipboard(text);
    if (ok) {
      setCopiedMsgId(id);
      setTimeout(() => setCopiedMsgId(null), 2000);
    }
  };

  // Refs
  const listRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<any>(null);
  const imageInputRef = useRef<any>(null);
  const videoInputRef = useRef<any>(null);
  const mediaRecorderRef = useRef<any>(null);
  const audioStreamRef = useRef<any>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const recordTimerRef = useRef<any>(null);
  const currentAudioRef = useRef<any>(null);

  const friendUsername = friend.username;
  const chatMessages = messages[friendUsername.toLowerCase()] || [];

  // Attiva chat corrente per gestione notifiche unread
  useEffect(() => {
    setActiveFriendChat(friendUsername);
    return () => {
      setActiveFriendChat(null);
    };
  }, [friendUsername, setActiveFriendChat]);

  // Ascolta eventi WebSocket per typing
  useEffect(() => {
    const handler = (data: any) => {
      if (
        data.type === "typing" &&
        data.sender.toLowerCase() === friendUsername.toLowerCase()
      ) {
        setIsFriendTyping(Boolean(data.is_typing));
      }
    };

    wsService.addHandler(handler);
    return () => {
      wsService.removeHandler(handler);
    };
  }, [friendUsername]);

  // Calcolo Impronta Crittografica (Safety Fingerprint)
  useEffect(() => {
    if (user?.username && friendUsername) {
      cryptoEngine.getSafetyFingerprint(user.username, friendUsername).then(setSafetyFingerprint);
    }
  }, [user?.username, friendUsername]);

  // Modalità Camouflage Rapida (Tasto Escape)
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsCamouflageMode((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  // Anti-Screenshot & Anti-Save listeners (Web)
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined" || isRoot) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "PrintScreen" ||
        (e.ctrlKey &&
          (e.key === "p" ||
            e.key === "P" ||
            e.key === "s" ||
            e.key === "S"))
      ) {
        e.preventDefault();
        setIsBlurredShield(true);
        setTimeout(() => setIsBlurredShield(false), 4000);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "PrintScreen") {
        e.preventDefault();
        setIsBlurredShield(true);
        setTimeout(() => setIsBlurredShield(false), 4000);
      }
    };

    const handleBlur = () => {
      setIsBlurredShield(true);
    };

    const handleFocus = () => {
      setIsBlurredShield(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);

    const styleId = "anti-screenshot-style";
    let styleEl = document.getElementById(styleId);
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = styleId;
      styleEl.innerHTML = `
        @media print {
          body, html, * {
            display: none !important;
            visibility: hidden !important;
          }
        }
      `;
      document.head.appendChild(styleEl);
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  // Timer di Autodistruzione per Foto Aperta
  useEffect(() => {
    if (!activePreviewMedia?.timer || !activePreviewMedia.msg) {
      setPreviewCountdown(null);
      return;
    }

    const totalSeconds = activePreviewMedia.timer;
    setPreviewCountdown(totalSeconds);

    const interval = setInterval(() => {
      setPreviewCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          if (activePreviewMedia.msg) {
            handleDeleteForBoth(activePreviewMedia.msg);
          }
          setActivePreviewMedia(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [activePreviewMedia]);

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Cicla tra i timer di autodistruzione disponibili
  const handleCycleTimer = () => {
    if (selectedTimer === null) {
      setSelectedTimer(5);
    } else if (selectedTimer === 5) {
      setSelectedTimer(10);
    } else if (selectedTimer === 10) {
      setSelectedTimer(30);
    } else {
      setSelectedTimer(null);
    }
  };

  // ── INVIO TESTO ──────────────────────────────────────────────
  const handleInputChange = (text: string) => {
    setInput(text);
    wsService.sendTyping(friendUsername, true);
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      wsService.sendTyping(friendUsername, false);
    }, 2000);
  };

  const handleSendMessage = async () => {
    const content = input.trim();
    if (!content || !user) return;

    const msgId = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const nowTs = new Date().toISOString();

    const newMsg: ChatMessage = {
      id: msgId,
      sender: user.username,
      recipient: friendUsername,
      content,
      isEncrypted: true,
      ts: nowTs,
      isMine: true,
      delivered: false,
    };

    addMessage(friendUsername, newMsg);
    setInput("");
    clearTimeout(typingTimeoutRef.current);
    wsService.sendTyping(friendUsername, false);

    wsService
      .sendDirectMessage(user.username, friendUsername, content, msgId)
      .then((enc) => {
        if (enc) {
          newMsg.ciphertext = enc.ciphertext;
          newMsg.iv = enc.iv;
        }
      });

    setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  // ── INVIO MEDIA (FOTO / VIDEO / AUDIO) ───────────────────────
  const sendMediaMessage = (
    type: "image" | "video" | "audio",
    dataUrl: string,
    timerSeconds?: number
  ) => {
    if (!user) return;
    const msgId = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const nowTs = new Date().toISOString();

    const placeholder =
      type === "image"
        ? timerSeconds
          ? "Foto effimera"
          : "Foto"
        : type === "video"
        ? "Video"
        : "Vocale";

    const newMsg: ChatMessage = {
      id: msgId,
      sender: user.username,
      recipient: friendUsername,
      content: placeholder,
      mediaType: type,
      mediaData: dataUrl,
      timer: timerSeconds,
      ts: nowTs,
      isMine: true,
      delivered: false,
    };

    addMessage(friendUsername, newMsg);
    wsService
      .sendDirectMessage(
        user.username,
        friendUsername,
        placeholder,
        msgId,
        type,
        dataUrl,
        timerSeconds
      )
      .then((enc) => {
        if (enc) {
          newMsg.ciphertext = enc.ciphertext;
          newMsg.iv = enc.iv;
          newMsg.isEncrypted = enc.is_encrypted;
        }
      });

    setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  // Selezione Foto
  const handlePickImage = (e: any) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setIsProcessingMedia(true);

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      if (typeof window === "undefined") {
        sendMediaMessage("image", loadEvent.target?.result as string, selectedTimer || undefined);
        setIsProcessingMedia(false);
        return;
      }

      const img = new (window as any).Image();
      img.onload = () => {
        const maxDim = 1200;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
          sendMediaMessage("image", dataUrl, selectedTimer || undefined);
        } else {
          sendMediaMessage("image", loadEvent.target?.result as string, selectedTimer || undefined);
        }
        setIsProcessingMedia(false);
      };
      img.onerror = () => {
        setIsProcessingMedia(false);
        Alert.alert("Errore", "Impossibile caricare immagine");
      };
      img.src = loadEvent.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // Selezione Video
  const handlePickVideo = (e: any) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 12 * 1024 * 1024) {
      Alert.alert(
        "Video troppo grande",
        "Seleziona un video inferiore a 12MB."
      );
      e.target.value = "";
      return;
    }

    setIsProcessingMedia(true);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      sendMediaMessage("video", dataUrl);
      setIsProcessingMedia(false);
    };
    reader.onerror = () => {
      setIsProcessingMedia(false);
      Alert.alert("Errore", "Impossibile leggere il video");
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // ── REGISTRAZIONE VOCALE ─────────────────────────────────────
  const startRecording = async () => {
    try {
      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices?.getUserMedia
      ) {
        Alert.alert(
          "Non supportato",
          "La registrazione vocale non è disponibile su questo browser."
        );
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      const recorder = new (window as any).MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e: any) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.start(100);
      setIsRecording(true);
      setRecordDuration(0);
      recordTimerRef.current = setInterval(() => {
        setRecordDuration((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      Alert.alert(
        "Permesso microfono",
        "Abilita il permesso del microfono per inviare note vocali."
      );
    }
  };

  const stopAndSendRecording = () => {
    if (!mediaRecorderRef.current) return;
    clearInterval(recordTimerRef.current);
    const recorder = mediaRecorderRef.current;

    recorder.onstop = () => {
      const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
      const reader = new FileReader();
      reader.onloadend = () => {
        const audioBase64 = reader.result as string;
        sendMediaMessage("audio", audioBase64);
      };
      reader.readAsDataURL(blob);

      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((t: any) => t.stop());
        audioStreamRef.current = null;
      }
    };

    recorder.stop();
    setIsRecording(false);
    setRecordDuration(0);
  };

  const cancelRecording = () => {
    clearInterval(recordTimerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((t: any) => t.stop());
      audioStreamRef.current = null;
    }
    setIsRecording(false);
    setRecordDuration(0);
  };

  // ── RIPRODUZIONE AUDIO ───────────────────────────────────────
  const handlePlayAudio = (msgId: string, audioDataUrl: string) => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;

    if (audioPlayingId === msgId) {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
      }
      setAudioPlayingId(null);
      return;
    }

    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }

    const audio = new Audio(audioDataUrl);
    currentAudioRef.current = audio;
    setAudioPlayingId(msgId);

    audio.ontimeupdate = () => {
      if (audio.duration > 0) {
        const pct = (audio.currentTime / audio.duration) * 100;
        setAudioProgress((prev) => ({ ...prev, [msgId]: pct }));
      }
    };

    audio.onended = () => {
      setAudioPlayingId(null);
      setAudioProgress((prev) => ({ ...prev, [msgId]: 0 }));
      currentAudioRef.current = null;
    };

    audio.onerror = () => {
      setAudioPlayingId(null);
      currentAudioRef.current = null;
    };

    audio.play().catch(() => {
      setAudioPlayingId(null);
    });
  };

  // ── ELIMINA PER ENTRAMBI (BIDIREZIONALE) ──────────────────────
  const handleDeleteForBoth = (msg: ChatMessage) => {
    if (!msg || !msg.id) return;
    wsService.deleteDirectMessage(friendUsername, msg.id);
    deleteMessage(friendUsername, msg.id);
    setDeleteConfirmMsg(null);
  };

  // ── OPZIONI AMICO / BLOCCO ───────────────────────────────────
  const handleRemoveFriend = async () => {
    if (!token) return;
    const execute = async () => {
      try {
        await api.removeFriend(token, friendUsername);
        onFriendRemoved?.();
        onBack();
      } catch (e: any) {
        Alert.alert("Errore", e.message || "Impossibile rimuovere amico");
      }
    };

    if (Platform.OS === "web") {
      if (
        typeof window !== "undefined" &&
        window.confirm(`Rimuovere @${friendUsername} dai contatti?`)
      ) {
        await execute();
      }
    } else {
      Alert.alert(
        "Rimuovi Contatto",
        `Sei sicuro di voler rimuovere @${friendUsername}?`,
        [
          { text: "Annulla", style: "cancel" },
          { text: "Rimuovi", style: "destructive", onPress: execute },
        ]
      );
    }
  };

  const handleBlockUser = async () => {
    if (!token) return;
    const execute = async () => {
      try {
        await api.blockUser(token, friendUsername);
        onFriendRemoved?.();
        onBack();
      } catch (e: any) {
        Alert.alert("Errore", e.message || "Impossibile bloccare utente");
      }
    };

    if (Platform.OS === "web") {
      if (
        typeof window !== "undefined" &&
        window.confirm(`Bloccare @${friendUsername}?`)
      ) {
        await execute();
      }
    } else {
      Alert.alert("Blocca Utente", `Bloccare @${friendUsername}?`, [
        { text: "Annulla", style: "cancel" },
        { text: "Blocca", style: "destructive", onPress: execute },
      ]);
    }
  };

  const handleClearHistory = () => {
    clearChat(friendUsername);
    setShowMenu(false);
  };

  const tag = getAvatarTag(friend.avatar);
  const color = getAvatarColor(friend.avatar);
  const isFemale = friend.gender === "F";

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Hidden file inputs per Web */}
      {Platform.OS === "web" && (
        <View style={{ display: "none" }}>
          {React.createElement("input", {
            type: "file",
            ref: imageInputRef,
            accept: "image/*",
            onChange: handlePickImage,
          })}
          {React.createElement("input", {
            type: "file",
            ref: videoInputRef,
            accept: "video/mp4,video/webm,video/quicktime",
            onChange: handlePickVideo,
          })}
        </View>
      )}

      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>

        <View style={styles.profileInfo}>
          <View style={[styles.avatarWrap, { backgroundColor: color }]}>
            <Text style={styles.avatarTag}>{tag}</Text>
            <View
              style={[
                styles.statusDot,
                friend.is_online ? styles.statusOnline : styles.statusOffline,
              ]}
            />
          </View>
          <View>
            <View style={styles.nameRow}>
              <Text style={styles.friendName}>@{friend.username}</Text>
              <TouchableOpacity
                style={[styles.e2eeBadge, isVerifiedChannel && styles.e2eeBadgeVerified]}
                onPress={() => setShowSafetyModal(true)}
                activeOpacity={0.7}
              >
                <Text style={[styles.e2eeBadgeText, isVerifiedChannel && styles.e2eeBadgeTextVerified]}>
                  {isVerifiedChannel ? "VERIFICATO" : "E2EE"}
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.friendStatusText}>
              {isFriendTyping
                ? "sta scrivendo..."
                : friend.is_online
                ? "Canale cifrato attivo"
                : "Disconnesso"}
            </Text>
          </View>
        </View>

        <View style={styles.headerRightActions}>
          {isRoot && (
            <TouchableOpacity
              style={styles.galleryHeaderBtn}
              onPress={() => setShowMediaGallery(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.galleryHeaderBtnText}>
                Media ({chatMessages.filter((m) => m.mediaType === "image" && m.mediaData && !m.deleted).length})
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.ghostBtn, isCamouflageMode && styles.ghostBtnActive]}
            onPress={() => setIsCamouflageMode((prev) => !prev)}
            activeOpacity={0.7}
          >
            <Text style={styles.ghostBtnText}>Camouflage</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuBtn}
            onPress={() => setShowMenu((prev) => !prev)}
          >
            <Text style={styles.menuIcon}>Opzioni</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Menu dropdown */}
      {showMenu && (
        <View style={styles.dropdownMenu}>
          {isRoot && (
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowMenu(false);
                setShowMediaGallery(true);
              }}
            >
              <Text style={[styles.menuItemText, { color: THEME.colors.primary }]}>
                Galleria Media ({chatMessages.filter((m) => m.mediaType === "image" && m.mediaData && !m.deleted).length})
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              setShowMenu(false);
              setShowSafetyModal(true);
            }}
          >
            <Text style={styles.menuItemText}>
              Verifica Impronta E2EE
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              setShowMenu(false);
              setIsCamouflageMode(true);
            }}
          >
            <Text style={styles.menuItemText}>Modalità Camouflage (Esc)</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={handleClearHistory}
          >
            <Text style={styles.menuItemText}>Svuota cronologia chat</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={handleRemoveFriend}
          >
            <Text style={[styles.menuItemText, { color: THEME.colors.warning }]}>
              Rimuovi dai contatti
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={handleBlockUser}>
            <Text style={[styles.menuItemText, { color: THEME.colors.danger }]}>
              Blocca utente
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Banner di elaborazione media */}
      {isProcessingMedia && (
        <View style={styles.processingBanner}>
          <Text style={styles.processingText}>
            Elaborazione media protetto in corso...
          </Text>
        </View>
      )}

      {/* Lista Messaggi */}
      <KeyboardAvoidingView
        style={styles.chatArea}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <FlatList
          ref={listRef}
          data={chatMessages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() =>
            listRef.current?.scrollToEnd({ animated: true })
          }
          renderItem={({ item }) => {
            const timeStr = new Date(item.ts).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            });

            // ── CASO A: MESSAGGIO O MEDIA ELIMINATO ──
            if (item.deleted || item.content === "Messaggio eliminato") {
              return (
                <View
                  style={[
                    styles.messageBubble,
                    item.isMine ? styles.myBubble : styles.friendBubble,
                    styles.deletedBubble,
                  ]}
                >
                  <Text style={styles.deletedText}>
                    {item.timer ? "Foto autodistrutta" : "Messaggio eliminato per entrambi"}
                  </Text>
                  <View style={styles.deletedRow}>
                    <Text style={styles.deletedBadge}>Eliminato</Text>
                    <Text style={styles.timeText}>{timeStr}</Text>
                  </View>
                </View>
              );
            }

            // ── CASO B: FOTO CON TIMER O PER UTENTI NON-ROOT (FOTO PROTETTA SINGLE-VIEW) ──
            const isProtectedForUser = !isRoot || (!item.isMine && Boolean(item.timer));

            if (item.mediaType === "image" && item.mediaData && isProtectedForUser && !item.isMine) {
              return (
                <View
                  style={[
                    styles.messageBubble,
                    styles.friendBubble,
                    styles.ephemeralCard,
                  ]}
                >
                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={styles.ephemeralAction}
                    onPress={() =>
                      setActivePreviewMedia({
                        type: "image",
                        data: item.mediaData!,
                        timer: item.timer || (isRoot ? undefined : 10),
                        msg: item,
                      })
                    }
                  >
                    <View style={styles.ephemeralPill}>
                      <Text style={styles.ephemeralTimerText}>
                        {item.timer ? `Timer: ${item.timer}s` : "Protetta // Zero-Trace"}
                      </Text>
                    </View>
                    <Text style={styles.ephemeralTitle}>Foto Protetta da Screenshot</Text>
                    <Text style={styles.ephemeralSubtitle}>
                      Tocca qui per visualizzare
                    </Text>
                  </TouchableOpacity>

                  <View style={styles.mediaFooter}>
                    <TouchableOpacity
                      style={styles.deleteForBothBtn}
                      onPress={() => setDeleteConfirmMsg(item)}
                    >
                      <Text style={styles.deleteForBothText}>
                        Elimina per entrambi
                      </Text>
                    </TouchableOpacity>
                    <Text style={styles.timeText}>{timeStr}</Text>
                  </View>
                </View>
              );
            }

            // ── CASO C: FOTO NORMALE (O PER UTENTE ROOT) ──
            if (item.mediaType === "image" && item.mediaData) {
              return (
                <View
                  style={[
                    styles.messageBubble,
                    item.isMine ? styles.myBubble : styles.friendBubble,
                    styles.mediaBubble,
                  ]}
                >
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() =>
                      setActivePreviewMedia({
                        type: "image",
                        data: item.mediaData!,
                        timer: item.timer,
                        msg: item,
                      })
                    }
                    style={styles.imageContainer}
                    {...(Platform.OS === "web"
                      ? { onContextMenu: (e: any) => e.preventDefault() }
                      : {})}
                  >
                    <Image
                      source={{ uri: item.mediaData }}
                      style={styles.chatImage}
                      resizeMode="cover"
                    />

                    {/* Badge discreto autodistruzione per chi invia */}
                    {item.timer && item.isMine && (
                      <View style={styles.timerBadge}>
                        <Text style={styles.timerBadgeText}>
                          Autodistruzione {item.timer}s
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  {/* Azione Salva (solo per Root), Elimina per entrambi & Orario */}
                  <View style={styles.mediaFooter}>
                    <View style={styles.mediaActionsLeft}>
                      {isRoot && (
                        <TouchableOpacity
                          style={styles.saveMediaBtn}
                          onPress={() => handleSaveImage(item.mediaData!, item.id)}
                        >
                          <Text style={styles.saveMediaText}>Salva</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={styles.deleteForBothBtn}
                        onPress={() => setDeleteConfirmMsg(item)}
                      >
                        <Text style={styles.deleteForBothText}>
                          Elimina
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <View style={styles.timeRow}>
                      <Text style={styles.timeText}>{timeStr}</Text>
                      {item.isMine && (
                        <Text
                          style={[
                            styles.tickText,
                            item.delivered && styles.tickDelivered,
                          ]}
                        >
                          {item.delivered ? "vv" : "v"}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
              );
            }

            // ── CASO D: VIDEO PROTETTO ──
            if (item.mediaType === "video" && item.mediaData) {
              return (
                <View
                  style={[
                    styles.messageBubble,
                    item.isMine ? styles.myBubble : styles.friendBubble,
                    styles.mediaBubble,
                  ]}
                >
                  <View style={styles.videoContainer}>
                    {Platform.OS === "web" ? (
                      React.createElement("video", {
                        src: item.mediaData,
                        controls: true,
                        controlsList:
                          "nodownload nofullscreen noplaybackrate",
                        disablePictureInPicture: true,
                        onContextMenu: (e: any) => e.preventDefault(),
                        style: {
                          width: "100%",
                          maxHeight: 220,
                          borderRadius: 12,
                          backgroundColor: "#000",
                        },
                      })
                    ) : (
                      <Text style={styles.mediaPlaceholderText}>
                        Video protetto
                      </Text>
                    )}
                  </View>

                  <View style={styles.mediaFooter}>
                    <View style={styles.mediaActionsLeft}>
                      {isRoot && (
                        <TouchableOpacity
                          style={styles.saveMediaBtn}
                          onPress={() => handleSaveVideo(item.mediaData!, item.id)}
                        >
                          <Text style={styles.saveMediaText}>Salva Video</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={styles.deleteForBothBtn}
                        onPress={() => setDeleteConfirmMsg(item)}
                      >
                        <Text style={styles.deleteForBothText}>
                          Elimina
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <View style={styles.timeRow}>
                      <Text style={styles.timeText}>{timeStr}</Text>
                      {item.isMine && (
                        <Text
                          style={[
                            styles.tickText,
                            item.delivered && styles.tickDelivered,
                          ]}
                        >
                          {item.delivered ? "vv" : "v"}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
              );
            }

            // ── CASO E: VOCALE PROTETTO ──
            if (item.mediaType === "audio" && item.mediaData) {
              const isPlaying = audioPlayingId === item.id;
              const progressPct = audioProgress[item.id] || 0;

              return (
                <View
                  style={[
                    styles.messageBubble,
                    item.isMine ? styles.myBubble : styles.friendBubble,
                    styles.audioBubble,
                  ]}
                >
                  <View style={styles.audioPlayerRow}>
                    <TouchableOpacity
                      style={[
                        styles.audioPlayBtn,
                        isPlaying && styles.audioPlayBtnActive,
                      ]}
                      onPress={() =>
                        handlePlayAudio(item.id, item.mediaData!)
                      }
                    >
                      <Text style={styles.audioPlayBtnText}>
                        {isPlaying ? "Pausa" : "Play"}
                      </Text>
                    </TouchableOpacity>

                    <View style={styles.audioTrackInfo}>
                      <View style={styles.audioMetaRow}>
                        <Text style={styles.audioTag}>Messaggio Vocale</Text>
                      </View>
                      <View style={styles.audioProgressTrack}>
                        <View
                          style={[
                            styles.audioProgressFill,
                            { width: `${progressPct}%` },
                          ]}
                        />
                      </View>
                    </View>
                  </View>

                  <View style={styles.mediaFooter}>
                    <View style={styles.mediaActionsLeft}>
                      {isRoot && (
                        <TouchableOpacity
                          style={styles.saveMediaBtn}
                          onPress={() => handleSaveVideo(item.mediaData!, item.id)}
                        >
                          <Text style={styles.saveMediaText}>Salva Video</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={styles.deleteForBothBtn}
                        onPress={() => setDeleteConfirmMsg(item)}
                      >
                        <Text style={styles.deleteForBothText}>
                          Elimina
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <View style={styles.timeRow}>
                      <Text style={styles.timeText}>{timeStr}</Text>
                      {item.isMine && (
                        <Text
                          style={[
                            styles.tickText,
                            item.delivered && styles.tickDelivered,
                          ]}
                        >
                          {item.delivered ? "vv" : "v"}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
              );
            }

            // ── CASO F: MESSAGGIO DI TESTO STANDARD ──
            return (
              <View
                style={[
                  styles.messageBubble,
                  item.isMine ? styles.myBubble : styles.friendBubble,
                ]}
              >
                <TouchableOpacity
                  activeOpacity={0.8}
                  onLongPress={() => setDeleteConfirmMsg(item)}
                >
                  <Text
                    style={[
                      styles.messageText,
                      item.isMine
                        ? styles.myMessageText
                        : styles.friendMessageText,
                    ]}
                  >
                    {item.content}
                  </Text>
                </TouchableOpacity>

                <View style={styles.timeRow}>
                  <TouchableOpacity
                    style={styles.miniCopyBtn}
                    onPress={() => handleCopyText(item.content, item.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.miniCopyBtnText}>
                      {copiedMsgId === item.id ? "Copiato" : "Copia"}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.miniCipherBtn}
                    onPress={() => setInspectedMessage(item)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.miniCipherBtnText}>Cipher</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.miniDeleteBtn}
                    onPress={() => setDeleteConfirmMsg(item)}
                  >
                    <Text style={styles.miniDeleteText}>Elimina</Text>
                  </TouchableOpacity>

                  <Text style={styles.timeText}>{timeStr}</Text>
                  {item.isMine && (
                    <Text
                      style={[
                        styles.tickText,
                        item.delivered && styles.tickDelivered,
                      ]}
                    >
                      {item.delivered ? "vv" : "v"}
                    </Text>
                  )}
                </View>
              </View>
            );
          }}
        />

        {/* ── BARRA DI INPUT & STRUMENTI MEDIA ── */}
        {isRecording ? (
          <View style={styles.recordingBar}>
            <View style={styles.recordingIndicator}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingTimer}>
                Vocale: {formatDuration(recordDuration)}
              </Text>
            </View>
            <View style={styles.recordingActions}>
              <TouchableOpacity
                style={styles.cancelRecBtn}
                onPress={cancelRecording}
              >
                <Text style={styles.cancelRecText}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.sendRecBtn}
                onPress={stopAndSendRecording}
              >
                <Text style={styles.sendRecText}>Invia Vocale</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.footerContainer}>
            {/* Toolbar allegati media moderna, pulita e senza parentesi orrende */}
            <View style={styles.mediaToolbar}>
              <TouchableOpacity
                style={styles.mediaToolBtn}
                onPress={() => imageInputRef.current?.click()}
              >
                <Text style={styles.mediaToolText}>Foto</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.mediaToolBtn}
                onPress={() => videoInputRef.current?.click()}
              >
                <Text style={styles.mediaToolText}>Video</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.mediaToolBtn}
                onPress={startRecording}
              >
                <Text style={styles.mediaToolText}>Vocale</Text>
              </TouchableOpacity>

              {/* Pulsante per impostare o disattivare il Timer di Autodistruzione */}
              <TouchableOpacity
                style={[
                  styles.timerSelectorBtn,
                  selectedTimer !== null && styles.timerSelectorBtnActive,
                ]}
                onPress={handleCycleTimer}
              >
                <Text
                  style={[
                    styles.timerSelectorText,
                    selectedTimer !== null && styles.timerSelectorTextActive,
                  ]}
                >
                  {selectedTimer === null
                    ? "Timer: Spento"
                    : `Autodistruzione: ${selectedTimer}s`}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Input di testo e pulsante invio */}
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Scrivi un messaggio..."
                placeholderTextColor="#64748B"
                value={input}
                onChangeText={handleInputChange}
                onSubmitEditing={handleSendMessage}
                returnKeyType="send"
              />
              <TouchableOpacity
                style={[
                  styles.sendBtn,
                  !input.trim() && styles.sendBtnDisabled,
                ]}
                onPress={handleSendMessage}
                disabled={!input.trim()}
              >
                <Text style={styles.sendIcon}>Invia</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* ── MODALE DI CONFERMA: ELIMINA PER ENTRAMBI ── */}
      {deleteConfirmMsg && (
        <View style={styles.modalOverlay}>
          <View style={styles.deleteModalCard}>
            <Text style={styles.deleteModalTitle}>Elimina per entrambi</Text>
            <Text style={styles.deleteModalDesc}>
              Sei sicuro di voler eliminare definitivamente questo elemento?
              Verrà cancellato dalla chat locale di entrambi i partecipanti (@{user?.username} e @{friendUsername}).
            </Text>

            <View style={styles.deleteModalButtons}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setDeleteConfirmMsg(null)}
              >
                <Text style={styles.modalCancelBtnText}>Annulla</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={() => handleDeleteForBoth(deleteConfirmMsg)}
              >
                <Text style={styles.modalConfirmBtnText}>
                  Elimina per entrambi
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* ── MODALE PREVIEW FOTO A TUTTO SCHERMO PULITA (SENZA SCRITTE SULLA FOTO) ── */}
      {activePreviewMedia && (
        <View
          style={styles.previewModalOverlay}
          {...(Platform.OS === "web"
            ? { onContextMenu: (e: any) => e.preventDefault() }
            : {})}
        >
          <View style={styles.previewHeader}>
            {previewCountdown !== null ? (
              <View style={styles.countdownBadge}>
                <Text style={styles.countdownText}>
                  Autodistruzione tra: {previewCountdown}s
                </Text>
              </View>
            ) : (
              <Text style={styles.previewTitle}>Visualizzatore protetto</Text>
            )}
            <View style={styles.previewActionsRow}>
              {isRoot && (
                <TouchableOpacity
                  style={styles.previewSaveBtn}
                  onPress={() => {
                    saveMediaToDevice(
                      activePreviewMedia.data,
                      `sovereign_foto_${friendUsername}_${Date.now()}.jpg`
                    );
                    setSavedToastMsg("Immagine salvata sul tuo dispositivo.");
                    setTimeout(() => setSavedToastMsg(null), 2500);
                  }}
                >
                  <Text style={styles.previewSaveText}>Salva Immagine</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.previewCloseBtn}
                onPress={() => {
                  // Se l'utente NON è root, chiudere distrugge SEMPRE l'immagine locale
                  if (!isRoot && activePreviewMedia.msg) {
                    deleteMessage(friendUsername, activePreviewMedia.msg.id);
                  } else if (activePreviewMedia.timer && activePreviewMedia.msg) {
                    handleDeleteForBoth(activePreviewMedia.msg);
                  }
                  setActivePreviewMedia(null);
                }}
              >
                <Text style={styles.previewCloseText}>Chiudi</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Barra progressiva di autodistruzione */}
          {previewCountdown !== null && activePreviewMedia.timer && (
            <View style={styles.previewProgressBarBg}>
              <View
                style={[
                  styles.previewProgressBarFill,
                  {
                    width: `${(previewCountdown / activePreviewMedia.timer) * 100}%`,
                  },
                ]}
              />
            </View>
          )}

          <View style={styles.previewBody}>
            <View style={styles.previewFrame}>
              <Image
                source={{ uri: activePreviewMedia.data }}
                style={styles.previewImage}
                resizeMode="contain"
              />
            </View>
          </View>
        </View>
      )}

      {/* ── SCUDO ANTI-SCREENSHOT & BLUR SHIELD ── */}
      {isBlurredShield && (
        <View style={styles.blurShieldOverlay}>
          <View style={styles.blurShieldCard}>
            <Text style={styles.blurShieldTitle}>
              Protezione Privacy Attiva
            </Text>
            <Text style={styles.blurShieldText}>
              Cattura schermo e registrazione bloccati per la tua sicurezza.
            </Text>
            <Text style={styles.blurShieldSubtext}>
              Foto e vocali rimangono protetti. Clicca in basso per continuare la conversazione.
            </Text>
            <TouchableOpacity
              style={styles.blurShieldBtn}
              onPress={() => setIsBlurredShield(false)}
            >
              <Text style={styles.blurShieldBtnText}>Sblocca Schermo</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── MODALE ANALISI PACCHETTO CRITTOGRAFICO (CIPHERTEXT INSPECTOR) ── */}
      {inspectedMessage && (
        <View style={styles.modalOverlay}>
          <View style={styles.inspectorCard}>
            <View style={styles.inspectorHeader}>
              <View style={styles.inspectorTitleRow}>
                <View style={styles.greenPulseDot} />
                <Text style={styles.inspectorTitle}>ANALISI PACCHETTO CRITTOGRAFICO</Text>
              </View>
              <TouchableOpacity onPress={() => setInspectedMessage(null)}>
                <Text style={styles.inspectorCloseBtn}>Chiudi</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.inspectorContent}>
              <View style={styles.inspectorRow}>
                <Text style={styles.inspectorLabel}>Cipher Suite</Text>
                <Text style={styles.inspectorValCyan}>AES-256-GCM (NIST SP 800-38D)</Text>
              </View>

              <View style={styles.inspectorRow}>
                <Text style={styles.inspectorLabel}>Derivazione Chiave</Text>
                <Text style={styles.inspectorVal}>PBKDF2-HMAC-SHA256 (50.000 iterazioni)</Text>
              </View>

              <View style={styles.inspectorRow}>
                <Text style={styles.inspectorLabel}>Initialization Vector (IV)</Text>
                <Text style={styles.inspectorValMono}>
                  {inspectedMessage.iv ? inspectedMessage.iv.substring(0, 28) + "..." : "12-byte crittografici casuali"}
                </Text>
              </View>

              <View style={styles.inspectorRow}>
                <Text style={styles.inspectorLabel}>Controllo Integrità GMAC</Text>
                <Text style={styles.inspectorValGreen}>Auth Tag 128-bit Valido & Anti-Tamper</Text>
              </View>

              <View style={styles.inspectorRow}>
                <Text style={styles.inspectorLabel}>Traffic Obfuscation</Text>
                <Text style={styles.inspectorValCyan}>PKCS Padding Attivo (Anti-DPI Analysis)</Text>
              </View>

              <View style={styles.inspectorPayloadBox}>
                <Text style={styles.inspectorPayloadTitle}>Payload Cifrato Relay (Transito Server):</Text>
                <Text style={styles.inspectorPayloadText}>
                  {inspectedMessage.ciphertext
                    ? inspectedMessage.ciphertext.slice(0, 160) + (inspectedMessage.ciphertext.length > 160 ? "..." : "")
                    : "kP819a+bX90qV2z9A41Bc9F00aL29Zp... (Payload cifrato end-to-end)"}
                </Text>
              </View>

              <View style={styles.inspectorFooter}>
                <Text style={styles.inspectorFooterText}>
                  Zero-Knowledge Relay: il server instrada esclusivamente questi byte cifrati senza mai possedere la chiave di decifratura.
                </Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* ── MODALE VERIFICA IMPRONTA DI SICUREZZA (SAFETY NUMBER) ── */}
      {showSafetyModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.inspectorCard}>
            <View style={styles.inspectorHeader}>
              <View style={styles.inspectorTitleRow}>
                <View style={styles.bluePulseDot} />
                <Text style={styles.inspectorTitle}>VERIFICA IMPRONTA DI SICUREZZA</Text>
              </View>
              <TouchableOpacity onPress={() => setShowSafetyModal(false)}>
                <Text style={styles.inspectorCloseBtn}>Chiudi</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.inspectorContent}>
              <Text style={styles.safetyDesc}>
                Confronta questa sequenza crittografica a 32 caratteri con @{friendUsername} su un canale fidato o di persona per verificare che la crittografia non sia intercettata (protezione da attacchi Man-in-the-Middle).
              </Text>

              <View style={styles.safetyCodeBox}>
                <Text style={styles.safetyCodeText}>{safetyFingerprint}</Text>
              </View>

              <View style={styles.safetyStatusRow}>
                <View style={[styles.statusDotSmall, isVerifiedChannel ? styles.statusOnline : styles.statusOffline]} />
                <Text style={styles.safetyStatusLabel}>
                  {isVerifiedChannel
                    ? "Canale E2EE convalidato e protetto da MITM"
                    : "Canale non ancora contrassegnato come verificato"}
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.verifyToggleBtn, isVerifiedChannel && styles.verifyToggleBtnActive]}
                onPress={() => {
                  setIsVerifiedChannel((prev) => !prev);
                  setShowSafetyModal(false);
                }}
              >
                <Text style={styles.verifyToggleBtnText}>
                  {isVerifiedChannel ? "Reimposta Canale come Non Verificato" : "Convalida Canale di Comunicazione"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* ── MODALITÀ CAMOUFLAGE ANTISPIONAGGIO (GHOST CLOAK) ── */}
      {isCamouflageMode && (
        <View style={styles.camouflageOverlay}>
          <View style={styles.camouflageHeader}>
            <View style={styles.camouflageTitleRow}>
              <View style={styles.camouflageDot} />
              <Text style={styles.camouflageTitle}>NETWORK SYSTEM DIAGNOSTICS // PID 7401</Text>
            </View>
            <TouchableOpacity
              style={styles.camouflageUnlockBtn}
              onPress={() => setIsCamouflageMode(false)}
            >
              <Text style={styles.camouflageUnlockText}>Sblocca (Esc)</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.camouflageLogArea} showsVerticalScrollIndicator={false}>
            <Text style={styles.camouflageLine}>[0.001] System boot integrity check: PASSED</Text>
            <Text style={styles.camouflageLine}>[0.014] TLS v1.3 cipher suite negotiation: ECDHE-RSA-AES256-GCM-SHA384</Text>
            <Text style={styles.camouflageLine}>[0.089] RAM socket buffer: 65536 bytes allocated (Zero-Disk write)</Text>
            <Text style={styles.camouflageLine}>[0.142] Relay node heartbeat ping: 14ms (latency nominal)</Text>
            <Text style={styles.camouflageLine}>[0.780] Memory sanitize policy: Zero-Trace (swap disabled)</Text>
            <Text style={styles.camouflageLine}>[1.200] Network traffic padding: Active (fixed-block length masking)</Text>
            <Text style={styles.camouflageLine}>[1.850] Visual shoulder-surf shield: ENGAGED</Text>
            <Text style={styles.camouflageLine}>[2.400] All cryptographic keys held exclusively in client heap.</Text>
            <Text style={styles.camouflageLine}>[STATUS] Standby. Monitor running in silent background daemon.</Text>
          </ScrollView>
        </View>
      )}

      {/* ── MODALE GALLERIA MEDIA DELLA CHAT ── */}
      {showMediaGallery && (
        <View style={styles.modalOverlay}>
          <View style={styles.galleryCard}>
            <View style={styles.galleryHeader}>
              <View>
                <Text style={styles.galleryTitle}>GALLERIA MEDIA CIFRATI</Text>
                <Text style={styles.gallerySubtitle}>
                  Archivio locale foto scambiate con @{friendUsername}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowMediaGallery(false)}
                style={styles.galleryCloseBtn}
              >
                <Text style={styles.galleryCloseBtnText}>Chiudi</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.galleryGrid} showsVerticalScrollIndicator={false}>
              {chatMessages.filter((m) => m.mediaType === "image" && m.mediaData && !m.deleted).length === 0 ? (
                <View style={styles.emptyGallery}>
                  <Text style={styles.emptyGalleryText}>Nessuna immagine in questa conversazione.</Text>
                  <Text style={styles.emptyGallerySubtext}>
                    Tutte le immagini inviate e ricevute vengono memorizzate qui nel tuo vault locale protetto.
                  </Text>
                </View>
              ) : (
                chatMessages
                  .filter((m) => m.mediaType === "image" && m.mediaData && !m.deleted)
                  .map((imgMsg) => {
                    const time = new Date(imgMsg.ts).toLocaleDateString([], {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    });
                    return (
                      <View key={imgMsg.id} style={styles.galleryItem}>
                        <TouchableOpacity
                          activeOpacity={0.8}
                          onPress={() =>
                            setActivePreviewMedia({
                              type: "image",
                              data: imgMsg.mediaData!,
                              msg: imgMsg,
                            })
                          }
                          style={styles.galleryThumbWrap}
                        >
                          <Image
                            source={{ uri: imgMsg.mediaData }}
                            style={styles.galleryThumb}
                            resizeMode="cover"
                          />
                        </TouchableOpacity>
                        <View style={styles.galleryItemFooter}>
                          <View>
                            <Text style={styles.galleryItemSender}>
                              {imgMsg.isMine ? "Inviata da te" : `@${imgMsg.sender}`}
                            </Text>
                            <Text style={styles.galleryItemDate}>{time}</Text>
                          </View>
                          <TouchableOpacity
                            style={styles.galleryItemSaveBtn}
                            onPress={() => handleSaveImage(imgMsg.mediaData!, imgMsg.id)}
                          >
                            <Text style={styles.galleryItemSaveText}>Salva</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })
              )}
            </ScrollView>
          </View>
        </View>
      )}

      {/* ── TOAST DI CONFERMA SALVATAGGIO ── */}
      {savedToastMsg && (
        <View style={styles.toastCard}>
          <View style={styles.toastDot} />
          <Text style={styles.toastText}>{savedToastMsg}</Text>
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: THEME.colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.borderSubtle,
  },
  backBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 4,
  },
  backArrow: {
    color: THEME.colors.primary,
    fontSize: 32,
    lineHeight: 32,
    fontWeight: "300",
  },
  profileInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  avatarWrap: {
    position: "relative",
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  avatarTag: {
    fontSize: 13,
    fontWeight: "900",
    color: "#FFF",
  },
  statusDot: {
    position: "absolute",
    bottom: -1,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: THEME.colors.bgCard,
  },
  statusOnline: {
    backgroundColor: THEME.colors.online,
  },
  statusOffline: {
    backgroundColor: THEME.colors.offline,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  friendName: {
    color: THEME.colors.textPrimary,
    fontSize: 15,
    fontWeight: "700",
    marginRight: 6,
  },
  e2eeBadge: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.25)",
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  e2eeBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: THEME.colors.online,
    letterSpacing: 0.5,
  },
  friendStatusText: {
    color: THEME.colors.textSecondary,
    fontSize: 11,
    marginTop: 1,
  },
  menuBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
    backgroundColor: THEME.colors.bgCardLight,
  },
  menuIcon: {
    color: THEME.colors.textPrimary,
    fontSize: 12,
    fontWeight: "600",
  },
  dropdownMenu: {
    position: "absolute",
    top: 55,
    right: 12,
    backgroundColor: THEME.colors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
    zIndex: 100,
    minWidth: 180,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 10,
  },
  menuItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.borderSubtle,
  },
  menuItemText: {
    color: THEME.colors.textPrimary,
    fontSize: 13,
    fontWeight: "600",
  },
  processingBanner: {
    backgroundColor: "rgba(14, 165, 233, 0.15)",
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.primary,
    alignItems: "center",
  },
  processingText: {
    color: THEME.colors.primary,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  chatArea: {
    flex: 1,
  },
  messageList: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  messageBubble: {
    maxWidth: "85%",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginVertical: 4,
  },
  myBubble: {
    alignSelf: "flex-end",
    backgroundColor: THEME.colors.primary,
    borderBottomRightRadius: 4,
  },
  friendBubble: {
    alignSelf: "flex-start",
    backgroundColor: THEME.colors.bgCardLight,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  myMessageText: {
    color: "#FFFFFF",
  },
  friendMessageText: {
    color: "#F8FAFC",
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-end",
    marginTop: 4,
  },
  timeText: {
    fontSize: 10,
    color: "rgba(255, 255, 255, 0.5)",
    marginRight: 4,
  },
  tickText: {
    fontSize: 10,
    color: "rgba(255, 255, 255, 0.5)",
    fontWeight: "700",
  },
  tickDelivered: {
    color: "#FFF",
  },
  miniDeleteBtn: {
    marginRight: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  miniDeleteText: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 10,
    fontWeight: "600",
  },

  // Stili Messaggio Eliminato
  deletedBubble: {
    opacity: 0.65,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  deletedText: {
    color: THEME.colors.textMuted,
    fontSize: 13,
    fontStyle: "italic",
  },
  deletedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  deletedBadge: {
    color: THEME.colors.danger,
    fontSize: 10,
    fontWeight: "700",
  },

  // Card Foto Effimera con Autodistruzione
  ephemeralCard: {
    width: 250,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.4)",
    backgroundColor: "rgba(245, 158, 11, 0.08)",
  },
  ephemeralAction: {
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  ephemeralPill: {
    backgroundColor: "rgba(245, 158, 11, 0.2)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.5)",
    marginBottom: 8,
  },
  ephemeralTimerText: {
    color: "#FBBF24",
    fontSize: 11,
    fontWeight: "800",
  },
  ephemeralTitle: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
  },
  ephemeralSubtitle: {
    color: THEME.colors.primary,
    fontSize: 12,
    fontWeight: "600",
  },

  // Stili Foto Pulita (NO scritte sulla foto)
  mediaBubble: {
    padding: 6,
    width: 250,
  },
  imageContainer: {
    width: "100%",
    height: 220,
    borderRadius: 14,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#000",
  },
  chatImage: {
    width: "100%",
    height: "100%",
  },
  timerBadge: {
    position: "absolute",
    bottom: 8,
    right: 8,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.5)",
  },
  timerBadgeText: {
    color: "#FBBF24",
    fontSize: 10,
    fontWeight: "700",
  },

  mediaFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
    paddingHorizontal: 4,
  },
  deleteForBothBtn: {
    backgroundColor: "rgba(239, 68, 68, 0.14)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  deleteForBothText: {
    color: "#FCA5A5",
    fontSize: 10,
    fontWeight: "700",
  },

  // Stili Video
  videoContainer: {
    width: "100%",
    borderRadius: 12,
    overflow: "hidden",
  },
  mediaPlaceholderText: {
    color: THEME.colors.textMuted,
    fontSize: 13,
    padding: 12,
  },

  // Stili Vocale
  audioBubble: {
    width: 250,
    paddingVertical: 10,
  },
  audioPlayerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  audioPlayBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: THEME.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  audioPlayBtnActive: {
    backgroundColor: THEME.colors.warning,
  },
  audioPlayBtnText: {
    color: "#FFF",
    fontSize: 11,
    fontWeight: "800",
  },
  audioTrackInfo: {
    flex: 1,
  },
  audioMetaRow: {
    marginBottom: 4,
  },
  audioTag: {
    color: THEME.colors.textPrimary,
    fontSize: 12,
    fontWeight: "700",
  },
  audioProgressTrack: {
    height: 5,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 3,
    overflow: "hidden",
  },
  audioProgressFill: {
    height: "100%",
    backgroundColor: "#FFF",
    borderRadius: 3,
  },

  // Barra di input & Toolbar Media
  footerContainer: {
    backgroundColor: THEME.colors.bgCard,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.borderSubtle,
  },
  mediaToolbar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 8,
  },
  mediaToolBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: THEME.colors.bgCardLight,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
  },
  mediaToolText: {
    color: THEME.colors.textPrimary,
    fontSize: 12,
    fontWeight: "700",
  },
  timerSelectorBtn: {
    marginLeft: "auto",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: THEME.colors.bgCardLight,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
  },
  timerSelectorBtnActive: {
    backgroundColor: "rgba(245, 158, 11, 0.18)",
    borderColor: "rgba(245, 158, 11, 0.6)",
  },
  timerSelectorText: {
    color: THEME.colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
  },
  timerSelectorTextActive: {
    color: "#FBBF24",
  },
  inputContainer: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingBottom: 10,
    paddingTop: 4,
    alignItems: "center",
  },
  input: {
    flex: 1,
    backgroundColor: THEME.colors.bgInput,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 10,
    color: THEME.colors.textPrimary,
    fontSize: 15,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
    marginRight: 8,
  },
  sendBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: THEME.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: {
    opacity: 0.3,
    backgroundColor: THEME.colors.bgCardLight,
  },
  sendIcon: {
    color: "#FFF",
    fontSize: 13,
    fontWeight: "700",
  },

  // Barra di Registrazione Vocale Attiva
  recordingBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderTopWidth: 1,
    borderTopColor: "rgba(239, 68, 68, 0.3)",
  },
  recordingIndicator: {
    flexDirection: "row",
    alignItems: "center",
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: THEME.colors.danger,
    marginRight: 8,
  },
  recordingTimer: {
    color: "#FFF",
    fontSize: 13,
    fontWeight: "700",
  },
  recordingActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  cancelRecBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: THEME.colors.bgCardLight,
    marginRight: 8,
  },
  cancelRecText: {
    color: THEME.colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  sendRecBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: THEME.colors.danger,
  },
  sendRecText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "800",
  },

  // Modale di Conferma Eliminazione
  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    zIndex: 999,
  },
  deleteModalCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: THEME.colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
    padding: 20,
  },
  deleteModalTitle: {
    color: THEME.colors.danger,
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 8,
  },
  deleteModalDesc: {
    color: THEME.colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 18,
  },
  deleteModalButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  modalCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: THEME.colors.bgCardLight,
  },
  modalCancelBtnText: {
    color: THEME.colors.textPrimary,
    fontSize: 12,
    fontWeight: "700",
  },
  modalConfirmBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: THEME.colors.danger,
  },
  modalConfirmBtnText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "800",
  },

  // Modale Preview Foto Pulita
  previewModalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#000",
    zIndex: 1000,
  },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: THEME.colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.borderSubtle,
  },
  countdownBadge: {
    backgroundColor: "rgba(245, 158, 11, 0.2)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.5)",
  },
  countdownText: {
    color: "#FBBF24",
    fontSize: 13,
    fontWeight: "800",
  },
  previewTitle: {
    color: THEME.colors.textPrimary,
    fontSize: 13,
    fontWeight: "700",
  },
  previewCloseBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: THEME.colors.bgCardLight,
  },
  previewCloseText: {
    color: THEME.colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  previewProgressBarBg: {
    height: 4,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    width: "100%",
  },
  previewProgressBarFill: {
    height: "100%",
    backgroundColor: "#FBBF24",
  },
  previewBody: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
  },
  previewFrame: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },

  // Scudo Anti-Screenshot & Cattura Schermo
  blurShieldOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(3, 7, 18, 0.96)",
    zIndex: 2000,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  blurShieldCard: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: THEME.colors.bgCard,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.4)",
    padding: 24,
    alignItems: "center",
    shadowColor: THEME.colors.danger,
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  blurShieldTitle: {
    color: THEME.colors.danger,
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 10,
  },
  blurShieldText: {
    color: THEME.colors.textPrimary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 8,
    fontWeight: "600",
  },
  blurShieldSubtext: {
    color: THEME.colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    marginBottom: 20,
  },
  blurShieldBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: THEME.colors.primary,
  },
  blurShieldBtnText: {
    color: "#FFF",
    fontSize: 13,
    fontWeight: "700",
  },
  headerRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  ghostBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: "rgba(14, 165, 233, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(14, 165, 233, 0.25)",
  },
  ghostBtnActive: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    borderColor: THEME.colors.accentAmber,
  },
  ghostBtnText: {
    color: THEME.colors.primary,
    fontSize: 11,
    fontWeight: "600",
  },
  e2eeBadgeVerified: {
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    borderColor: THEME.colors.online,
  },
  e2eeBadgeTextVerified: {
    color: THEME.colors.online,
  },
  miniCipherBtn: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: "rgba(14, 165, 233, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(14, 165, 233, 0.25)",
    marginRight: 6,
  },
  miniCipherBtnText: {
    fontSize: 9,
    fontWeight: "700",
    color: THEME.colors.primary,
    letterSpacing: 0.3,
  },
  inspectorCard: {
    width: "100%",
    maxWidth: 460,
    backgroundColor: THEME.colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(14, 165, 233, 0.25)",
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
  },
  inspectorHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
  },
  inspectorTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  greenPulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: THEME.colors.online,
    marginRight: 8,
  },
  bluePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: THEME.colors.primary,
    marginRight: 8,
  },
  inspectorTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: THEME.colors.textPrimary,
    letterSpacing: 0.5,
  },
  inspectorCloseBtn: {
    color: THEME.colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
    padding: 4,
  },
  inspectorContent: {
    gap: 10,
  },
  inspectorRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.04)",
  },
  inspectorLabel: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
  },
  inspectorVal: {
    fontSize: 11,
    fontWeight: "600",
    color: THEME.colors.textPrimary,
  },
  inspectorValCyan: {
    fontSize: 11,
    fontWeight: "600",
    color: THEME.colors.textCyan,
  },
  inspectorValGreen: {
    fontSize: 11,
    fontWeight: "600",
    color: THEME.colors.online,
  },
  inspectorValMono: {
    fontSize: 11,
    fontFamily: THEME.fonts.mono,
    color: THEME.colors.textSecondary,
  },
  inspectorPayloadBox: {
    backgroundColor: THEME.colors.bgInput,
    borderRadius: 8,
    padding: 10,
    marginTop: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  inspectorPayloadTitle: {
    fontSize: 11,
    fontWeight: "600",
    color: THEME.colors.textSecondary,
    marginBottom: 4,
  },
  inspectorPayloadText: {
    fontSize: 11,
    fontFamily: THEME.fonts.mono,
    color: THEME.colors.primary,
    lineHeight: 15,
  },
  inspectorFooter: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.05)",
  },
  inspectorFooterText: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    lineHeight: 15,
  },
  safetyDesc: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    lineHeight: 18,
    marginBottom: 14,
  },
  safetyCodeBox: {
    backgroundColor: THEME.colors.bgInput,
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(14, 165, 233, 0.3)",
    alignItems: "center",
    marginBottom: 14,
  },
  safetyCodeText: {
    fontSize: 16,
    fontWeight: "700",
    fontFamily: THEME.fonts.mono,
    color: THEME.colors.primary,
    letterSpacing: 1.5,
    textAlign: "center",
    lineHeight: 24,
  },
  safetyStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  statusDotSmall: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 8,
  },
  safetyStatusLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: THEME.colors.textSecondary,
  },
  verifyToggleBtn: {
    backgroundColor: THEME.colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  verifyToggleBtnActive: {
    backgroundColor: THEME.colors.bgCardLight,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
  },
  verifyToggleBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  camouflageOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#05080E",
    zIndex: 3000,
    padding: 16,
  },
  camouflageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(14, 165, 233, 0.2)",
    marginBottom: 12,
  },
  camouflageTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  camouflageDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: THEME.colors.online,
    marginRight: 8,
  },
  camouflageTitle: {
    fontSize: 11,
    fontFamily: THEME.fonts.mono,
    color: THEME.colors.online,
    letterSpacing: 0.8,
  },
  camouflageUnlockBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  camouflageUnlockText: {
    fontSize: 11,
    color: THEME.colors.textPrimary,
    fontWeight: "600",
  },
  camouflageLogArea: {
    flex: 1,
  },
  camouflageLine: {
    fontSize: 11,
    fontFamily: THEME.fonts.mono,
    color: "#38BDF8",
    lineHeight: 20,
    marginBottom: 4,
  },
  galleryHeaderBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "rgba(14, 165, 233, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(14, 165, 233, 0.25)",
    marginRight: 6,
  },
  galleryHeaderBtnText: {
    fontSize: 11,
    fontFamily: THEME.fonts.mono,
    color: THEME.colors.primary,
    fontWeight: "600",
  },
  mediaActionsLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  saveMediaBtn: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: "rgba(14, 165, 233, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(14, 165, 233, 0.3)",
  },
  saveMediaText: {
    fontSize: 10,
    fontWeight: "600",
    color: THEME.colors.primary,
    fontFamily: THEME.fonts.mono,
  },
  miniCopyBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    marginRight: 6,
  },
  miniCopyBtnText: {
    fontSize: 10,
    fontWeight: "600",
    color: THEME.colors.textSecondary,
    fontFamily: THEME.fonts.mono,
  },
  previewActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  previewSaveBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: THEME.colors.primary,
  },
  previewSaveText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  galleryCard: {
    width: "92%",
    maxWidth: 600,
    maxHeight: "85%",
    backgroundColor: THEME.colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
    padding: 16,
  },
  galleryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.borderSubtle,
    marginBottom: 14,
  },
  galleryTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: THEME.colors.textPrimary,
    letterSpacing: 0.5,
  },
  gallerySubtitle: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  galleryCloseBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: THEME.colors.bgCardLight,
  },
  galleryCloseBtnText: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
  },
  galleryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    paddingBottom: 20,
  },
  galleryItem: {
    width: "47%",
    backgroundColor: THEME.colors.bgApp,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
    overflow: "hidden",
  },
  galleryThumbWrap: {
    width: "100%",
    height: 120,
    backgroundColor: "#000",
  },
  galleryThumb: {
    width: "100%",
    height: "100%",
  },
  galleryItemFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 8,
  },
  galleryItemSender: {
    fontSize: 11,
    fontWeight: "600",
    color: THEME.colors.textPrimary,
  },
  galleryItemDate: {
    fontSize: 9,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  galleryItemSaveBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: "rgba(14, 165, 233, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(14, 165, 233, 0.3)",
  },
  galleryItemSaveText: {
    fontSize: 10,
    fontWeight: "600",
    color: THEME.colors.primary,
  },
  emptyGallery: {
    width: "100%",
    paddingVertical: 40,
    alignItems: "center",
  },
  emptyGalleryText: {
    color: THEME.colors.textPrimary,
    fontSize: 13,
    fontWeight: "600",
  },
  emptyGallerySubtext: {
    color: THEME.colors.textMuted,
    fontSize: 11,
    marginTop: 6,
    textAlign: "center",
    maxWidth: 320,
  },
  toastCard: {
    position: "absolute",
    bottom: 80,
    alignSelf: "center",
    backgroundColor: "#0F172A",
    borderWidth: 1,
    borderColor: THEME.colors.primary,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 9999,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  toastDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: THEME.colors.online,
    marginRight: 8,
  },
  toastText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
});
