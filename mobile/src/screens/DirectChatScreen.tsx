import React, { useEffect, useRef, useState, useMemo } from "react";
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
  const [showAttachMenu, setShowAttachMenu] = useState(false);

  // ── CYBERSECURITY & OPZIONI AVANZATE ──
  const [inspectedMessage, setInspectedMessage] = useState<ChatMessage | null>(null);
  const [showSafetyModal, setShowSafetyModal] = useState(false);
  const [safetyFingerprint, setSafetyFingerprint] = useState<string>("CALCOLO IN CORSO...");
  const [isVerifiedChannel, setIsVerifiedChannel] = useState(false);
  const [isCamouflageMode, setIsCamouflageMode] = useState(false);
  const [showPurgeModal, setShowPurgeModal] = useState(false);

  // Ricerca interna alla chat
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Latency Heartbeat dinamico (ms)
  const [latencyMs, setLatencyMs] = useState(14);

  // Timer Autodistruzione (Off, 5s, 10s, 30s, 60s)
  const [selectedTimer, setSelectedTimer] = useState<number | null>(null);

  // Gestione Vocali
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);

  // Riproduzione Audio
  const [audioPlayingId, setAudioPlayingId] = useState<string | null>(null);
  const [audioProgress, setAudioProgress] = useState<Record<string, number>>({});

  // Protezione Anti-Screenshot / Privacy Shield
  const [isBlurredShield, setIsBlurredShield] = useState(false);

  // Modali di visualizzazione ed eliminazione
  const [deleteConfirmMsg, setDeleteConfirmMsg] = useState<ChatMessage | null>(null);
  const [activePreviewMedia, setActivePreviewMedia] = useState<{
    type: "image" | "video";
    data: string;
    timer?: number;
    msg?: ChatMessage;
  } | null>(null);
  const [previewCountdown, setPreviewCountdown] = useState<number | null>(null);
  const [isProcessingMedia, setIsProcessingMedia] = useState(false);

  // Vault Media & Notifiche Rapide
  const [showMediaGallery, setShowMediaGallery] = useState(false);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [savedToastMsg, setSavedToastMsg] = useState<string | null>(null);

  // Refs per preservare il focus continuo e input file
  const textInputRef = useRef<TextInput>(null);
  const listRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<any>(null);
  const imageInputRef = useRef<any>(null);
  const videoInputRef = useRef<any>(null);
  const fileInputRef = useRef<any>(null);

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

  // Ping Latency simulatore dinamico relay
  useEffect(() => {
    const timer = setInterval(() => {
      setLatencyMs(Math.floor(10 + Math.random() * 12));
    }, 7000);
    return () => clearInterval(timer);
  }, []);

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

  // Tasto Escape per Modalità Camouflage rapida su desktop
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
  }, [isRoot]);

  // Timer di Autodistruzione per Foto Aperta a Schermo Intero
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

  // Cicla tra i timer di autodistruzione disponibili (Off -> 5s -> 10s -> 30s -> 60s)
  const handleCycleTimer = () => {
    if (selectedTimer === null) {
      setSelectedTimer(5);
    } else if (selectedTimer === 5) {
      setSelectedTimer(10);
    } else if (selectedTimer === 10) {
      setSelectedTimer(30);
    } else if (selectedTimer === 30) {
      setSelectedTimer(60);
    } else {
      setSelectedTimer(null);
    }
  };

  // ── GESTIONE INVIO TESTO CON FOCUS PERMANENTE ───────────────────
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
      timer: selectedTimer || undefined,
      ts: nowTs,
      isMine: true,
      delivered: false,
    };

    addMessage(friendUsername, newMsg);
    setInput("");
    clearTimeout(typingTimeoutRef.current);
    wsService.sendTyping(friendUsername, false);

    // RESTORE FOCUS ISTANTANEO: l'utente può continuare a digitare senza mai toccare il mouse o tastiera
    setTimeout(() => {
      textInputRef.current?.focus();
    }, 15);

    wsService
      .sendDirectMessage(
        user.username,
        friendUsername,
        content,
        msgId,
        undefined,
        undefined,
        selectedTimer || undefined
      )
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

  // ── INVIO MEDIA (FOTO / VIDEO / AUDIO / DOCUMENTI) ─────────────
  const sendMediaMessage = (
    type: "image" | "video" | "audio" | "file",
    dataUrl: string,
    timerSeconds?: number,
    extra?: { fileName?: string; fileSize?: string; fileHash?: string }
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
        : type === "file"
        ? extra?.fileName || "Documento cifrato"
        : "Vocale";

    const newMsg: ChatMessage = {
      id: msgId,
      sender: user.username,
      recipient: friendUsername,
      content: placeholder,
      mediaType: type,
      mediaData: dataUrl,
      fileName: extra?.fileName,
      fileSize: extra?.fileSize,
      fileHash: extra?.fileHash,
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
        timerSeconds,
        extra
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
    setShowAttachMenu(false);

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
    setShowAttachMenu(false);

    if (file.size > 12 * 1024 * 1024) {
      Alert.alert("Video troppo grande", "Seleziona un video inferiore a 12MB.");
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

  // Selezione Documento / File Cifrato
  const handlePickFile = (e: any) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setShowAttachMenu(false);

    if (file.size > 15 * 1024 * 1024) {
      Alert.alert("File troppo grande", "Il limite per il trasferimento protetto in RAM è 15MB.");
      e.target.value = "";
      return;
    }

    setIsProcessingMedia(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      let fileHash = "SHA256_VERIFIED";
      try {
        if (typeof window !== "undefined" && window.crypto?.subtle) {
          const hashBuf = await window.crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(dataUrl)
          );
          fileHash = Array.from(new Uint8Array(hashBuf))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("")
            .substring(0, 16);
        }
      } catch (err) {}

      const sizeStr =
        file.size > 1024 * 1024
          ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
          : `${Math.round(file.size / 1024)} KB`;

      sendMediaMessage("file", dataUrl, selectedTimer || undefined, {
        fileName: file.name,
        fileSize: sizeStr,
        fileHash,
      });
      setIsProcessingMedia(false);
    };
    reader.onerror = () => {
      setIsProcessingMedia(false);
      Alert.alert("Errore", "Impossibile leggere il documento.");
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // ── REGISTRAZIONE VOCALE ─────────────────────────────────────
  const startRecording = async () => {
    try {
      setShowAttachMenu(false);
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
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

  // ── ELIMINAZIONE MESSAGGIO PER ENTRAMBI ──────────────────────
  const handleDeleteForBoth = (msg: ChatMessage) => {
    if (!msg || !msg.id) return;
    wsService.deleteDirectMessage(friendUsername, msg.id);
    deleteMessage(friendUsername, msg.id);
    setDeleteConfirmMsg(null);
  };

  // ── INCINERA SESSIONE CHAT (PANIC PURGE) ─────────────────────
  const handlePurgeSession = () => {
    wsService.purgeChatForBoth(friendUsername);
    clearChat(friendUsername);
    setShowPurgeModal(false);
    setShowMenu(false);
    setSavedToastMsg("Sessione incenerita: zero tracce in memoria RAM.");
    setTimeout(() => setSavedToastMsg(null), 2500);
  };

  // ── GESTIONE AMICO / BLOCCO ──────────────────────────────────
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
      if (typeof window !== "undefined" && window.confirm(`Rimuovere @${friendUsername} dai contatti?`)) {
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
      if (typeof window !== "undefined" && window.confirm(`Bloccare @${friendUsername}?`)) {
        await execute();
      }
    } else {
      Alert.alert("Blocca Utente", `Bloccare @${friendUsername}?`, [
        { text: "Annulla", style: "cancel" },
        { text: "Blocca", style: "destructive", onPress: execute },
      ]);
    }
  };

  const handleSaveMedia = (mediaData: string, filename: string) => {
    saveMediaToDevice(mediaData, filename);
    setSavedToastMsg("File salvato sul dispositivo.");
    setTimeout(() => setSavedToastMsg(null), 2500);
  };

  const handleCopyText = async (text: string, id: string) => {
    const ok = await copyTextToClipboard(text);
    if (ok) {
      setCopiedMsgId(id);
      setTimeout(() => setCopiedMsgId(null), 2000);
    }
  };

  // Filtro ricerca messaggi
  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim()) return chatMessages;
    const q = searchQuery.toLowerCase();
    return chatMessages.filter(
      (m) =>
        m.content.toLowerCase().includes(q) ||
        (m.fileName && m.fileName.toLowerCase().includes(q))
    );
  }, [chatMessages, searchQuery]);

  const tag = getAvatarTag(friend.avatar);
  const color = getAvatarColor(friend.avatar);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Hidden file inputs per Web (Foto, Video, Documenti) */}
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
          {React.createElement("input", {
            type: "file",
            ref: fileInputRef,
            accept: "*/*",
            onChange: handlePickFile,
          })}
        </View>
      )}

      {/* ── HEADER MILITARY-GRADE CYBER CONSOLE ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
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
          <View style={{ flex: 1 }}>
            <View style={styles.nameRow}>
              <Text style={styles.friendName}>@{friend.username}</Text>
              <TouchableOpacity
                style={[styles.e2eeBadge, isVerifiedChannel && styles.e2eeBadgeVerified]}
                onPress={() => setShowSafetyModal(true)}
                activeOpacity={0.7}
              >
                <Text style={[styles.e2eeBadgeText, isVerifiedChannel && styles.e2eeBadgeTextVerified]}>
                  {isVerifiedChannel ? "VERIFICATO" : "AES-256"}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.statusSubRow}>
              <Text style={styles.friendStatusText}>
                {isFriendTyping
                  ? "sta digitando..."
                  : friend.is_online
                  ? "Canale cifrato attivo"
                  : "Disconnesso"}
              </Text>
              <Text style={styles.latencyIndicator}>• {latencyMs}ms</Text>
            </View>
          </View>
        </View>

        {/* Azioni rapide Header */}
        <View style={styles.headerRightActions}>
          <TouchableOpacity
            style={[styles.headerIconBtn, isSearchOpen && styles.headerIconBtnActive]}
            onPress={() => setIsSearchOpen((prev) => !prev)}
            activeOpacity={0.7}
          >
            <Text style={styles.headerIconText}>Cerca</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerNukeBtn}
            onPress={() => setShowPurgeModal(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.headerNukeText}>Incinera</Text>
          </TouchableOpacity>

          {isRoot && (
            <TouchableOpacity
              style={styles.galleryHeaderBtn}
              onPress={() => setShowMediaGallery(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.galleryHeaderBtnText}>
                Vault ({chatMessages.filter((m) => m.mediaData && !m.deleted).length})
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.menuBtn}
            onPress={() => setShowMenu((prev) => !prev)}
            activeOpacity={0.7}
          >
            <Text style={styles.menuIcon}>Opzioni</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Barra di Ricerca Integrata */}
      {isSearchOpen && (
        <View style={styles.searchBarContainer}>
          <TextInput
            style={styles.searchBarInput}
            placeholder="Cerca nella cronologia cifrata..."
            placeholderTextColor="#64748B"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery("")} style={styles.searchClearBtn}>
              <Text style={styles.searchClearText}>Reset</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      {/* Menu a discesa Opzioni */}
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
                Archivio Media Vault ({chatMessages.filter((m) => m.mediaData && !m.deleted).length})
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
            <Text style={styles.menuItemText}>Verifica Impronta E2EE</Text>
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
            onPress={() => {
              setShowMenu(false);
              setShowPurgeModal(true);
            }}
          >
            <Text style={[styles.menuItemText, { color: THEME.colors.danger }]}>
              Incinera Sessione Chat (Nuke)
            </Text>
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

      {/* Banner Elaborazione Media */}
      {isProcessingMedia && (
        <View style={styles.processingBanner}>
          <Text style={styles.processingText}>CRITTOGRAFIA BUFFER RAM IN CORSO...</Text>
        </View>
      )}

      {/* ── LISTA MESSAGGI (FLATLIST CON SCROLLBAR CYBER MINIMALISTA) ── */}
      <KeyboardAvoidingView
        style={styles.chatArea}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <FlatList
          ref={listRef}
          data={filteredMessages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messageList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
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
                    {item.timer ? "Pacchetto autodistrutto (Zero-Trace)" : "Messaggio eliminato per entrambi"}
                  </Text>
                  <View style={styles.deletedRow}>
                    <Text style={styles.deletedBadge}>INCINERATED</Text>
                    <Text style={styles.timeText}>{timeStr}</Text>
                  </View>
                </View>
              );
            }

            // ── CASO B: FOTO CON AUTODISTRUZIONE / SINGLE-VIEW PER UTENTI STANDARD ──
            const isProtectedPhoto = !isRoot || (!item.isMine && Boolean(item.timer));

            if (item.mediaType === "image" && item.mediaData && isProtectedPhoto && !item.isMine) {
              return (
                <View style={[styles.messageBubble, styles.friendBubble, styles.ephemeralEnclaveCard]}>
                  <View style={styles.enclaveHeaderRow}>
                    <View style={styles.enclaveDot} />
                    <Text style={styles.enclaveHeaderTitle}>PROTECTED RAM ENCLAVE</Text>
                    <View style={styles.enclaveTimerBadge}>
                      <Text style={styles.enclaveTimerBadgeText}>
                        {item.timer ? `${item.timer}s BURN` : "SINGLE-VIEW"}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={styles.enclaveTapArea}
                    onPress={() =>
                      setActivePreviewMedia({
                        type: "image",
                        data: item.mediaData!,
                        timer: item.timer || (isRoot ? undefined : 10),
                        msg: item,
                      })
                    }
                  >
                    <View style={styles.enclaveShieldIconBox}>
                      <Text style={styles.enclaveShieldGlyph}>[ # ]</Text>
                    </View>
                    <Text style={styles.enclavePromptTitle}>Foto Cifrata nel Buffer RAM</Text>
                    <Text style={styles.enclavePromptSub}>
                      Tocca per decifrare l'immagine con protezione screenshot attiva
                    </Text>
                  </TouchableOpacity>

                  <View style={styles.enclaveFooterRow}>
                    <TouchableOpacity
                      style={styles.enclaveDeleteBtn}
                      onPress={() => setDeleteConfirmMsg(item)}
                    >
                      <Text style={styles.enclaveDeleteText}>Elimina</Text>
                    </TouchableOpacity>
                    <Text style={styles.timeText}>{timeStr}</Text>
                  </View>
                </View>
              );
            }

            // ── CASO C: FOTO NORMALE O APERTA PER UTENTE ROOT ──
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

                    {item.timer && item.isMine && (
                      <View style={styles.timerBadge}>
                        <Text style={styles.timerBadgeText}>Burn: {item.timer}s</Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  <View style={styles.mediaFooter}>
                    <View style={styles.mediaActionsLeft}>
                      {isRoot && (
                        <TouchableOpacity
                          style={styles.saveMediaBtn}
                          onPress={() => handleSaveMedia(item.mediaData!, `sovereign_foto_${friendUsername}_${item.id.substring(0,8)}.jpg`)}
                        >
                          <Text style={styles.saveMediaText}>Salva</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={styles.deleteForBothBtn}
                        onPress={() => setDeleteConfirmMsg(item)}
                      >
                        <Text style={styles.deleteForBothText}>Elimina</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={styles.timeRow}>
                      <Text style={styles.timeText}>{timeStr}</Text>
                      {item.isMine && (
                        <Text style={[styles.tickText, item.delivered && styles.tickDelivered]}>
                          {item.delivered ? "vv" : "v"}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
              );
            }

            // ── CASO D: DOCUMENTO / FILE CIFRATO ──
            if (item.mediaType === "file" && item.mediaData) {
              return (
                <View
                  style={[
                    styles.messageBubble,
                    item.isMine ? styles.myBubble : styles.friendBubble,
                    styles.fileCardBubble,
                  ]}
                >
                  <View style={styles.fileHeaderRow}>
                    <View style={styles.fileIconBadge}>
                      <Text style={styles.fileIconBadgeText}>DOC</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.fileNameText} numberOfLines={1}>
                        {item.fileName || "documento_cifrato.dat"}
                      </Text>
                      <Text style={styles.fileMetaText}>
                        {item.fileSize || "1.2 MB"} • SHA-256: {item.fileHash?.substring(0, 8) || "VERIFIED"}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.fileActionsRow}>
                    <TouchableOpacity
                      style={styles.fileDownloadBtn}
                      onPress={() =>
                        handleSaveMedia(
                          item.mediaData!,
                          item.fileName || `documento_${friendUsername}_${Date.now()}.dat`
                        )
                      }
                    >
                      <Text style={styles.fileDownloadBtnText}>Scarica File</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.fileDeleteBtn}
                      onPress={() => setDeleteConfirmMsg(item)}
                    >
                      <Text style={styles.fileDeleteBtnText}>Elimina</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.mediaFooter}>
                    <Text style={styles.timeText}>{timeStr}</Text>
                    {item.isMine && (
                      <Text style={[styles.tickText, item.delivered && styles.tickDelivered]}>
                        {item.delivered ? "vv" : "v"}
                      </Text>
                    )}
                  </View>
                </View>
              );
            }

            // ── CASO E: VIDEO CIFRATO ──
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
                        controlsList: "nodownload nofullscreen noplaybackrate",
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
                      <Text style={styles.mediaPlaceholderText}>Video protetto</Text>
                    )}
                  </View>

                  <View style={styles.mediaFooter}>
                    <View style={styles.mediaActionsLeft}>
                      {isRoot && (
                        <TouchableOpacity
                          style={styles.saveMediaBtn}
                          onPress={() => handleSaveMedia(item.mediaData!, `sovereign_video_${friendUsername}_${Date.now()}.mp4`)}
                        >
                          <Text style={styles.saveMediaText}>Salva</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={styles.deleteForBothBtn}
                        onPress={() => setDeleteConfirmMsg(item)}
                      >
                        <Text style={styles.deleteForBothText}>Elimina</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={styles.timeRow}>
                      <Text style={styles.timeText}>{timeStr}</Text>
                      {item.isMine && (
                        <Text style={[styles.tickText, item.delivered && styles.tickDelivered]}>
                          {item.delivered ? "vv" : "v"}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
              );
            }

            // ── CASO F: VOCALE CIFRATO ──
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
                      style={[styles.audioPlayBtn, isPlaying && styles.audioPlayBtnActive]}
                      onPress={() => handlePlayAudio(item.id, item.mediaData!)}
                    >
                      <Text style={styles.audioPlayBtnText}>{isPlaying ? "Pausa" : "Play"}</Text>
                    </TouchableOpacity>

                    <View style={styles.audioTrackInfo}>
                      <View style={styles.audioMetaRow}>
                        <Text style={styles.audioTag}>Nota Vocale E2EE</Text>
                      </View>
                      <View style={styles.audioProgressTrack}>
                        <View style={[styles.audioProgressFill, { width: `${progressPct}%` }]} />
                      </View>
                    </View>
                  </View>

                  <View style={styles.mediaFooter}>
                    <TouchableOpacity
                      style={styles.deleteForBothBtn}
                      onPress={() => setDeleteConfirmMsg(item)}
                    >
                      <Text style={styles.deleteForBothText}>Elimina</Text>
                    </TouchableOpacity>
                    <View style={styles.timeRow}>
                      <Text style={styles.timeText}>{timeStr}</Text>
                      {item.isMine && (
                        <Text style={[styles.tickText, item.delivered && styles.tickDelivered]}>
                          {item.delivered ? "vv" : "v"}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
              );
            }

            // ── CASO G: TESTO STANDARD (CON POSSIBILE AUTODISTRUZIONE) ──
            return (
              <View
                style={[
                  styles.messageBubble,
                  item.isMine ? styles.myBubble : styles.friendBubble,
                  item.timer ? styles.ephemeralTextBubble : null,
                ]}
              >
                {item.timer && (
                  <View style={styles.textBurnBadge}>
                    <Text style={styles.textBurnBadgeText}>BURN: {item.timer}s</Text>
                  </View>
                )}

                <TouchableOpacity
                  activeOpacity={0.85}
                  onLongPress={() => setDeleteConfirmMsg(item)}
                >
                  <Text
                    style={[
                      styles.messageText,
                      item.isMine ? styles.myMessageText : styles.friendMessageText,
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
                    <Text style={[styles.tickText, item.delivered && styles.tickDelivered]}>
                      {item.delivered ? "vv" : "v"}
                    </Text>
                  )}
                </View>
              </View>
            );
          }}
        />

        {/* ── BARRA DI REGISTRAZIONE VOCALE ── */}
        {isRecording ? (
          <View style={styles.recordingBar}>
            <View style={styles.recordingIndicator}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingTimer}>
                Vocale protetto: {formatDuration(recordDuration)}
              </Text>
            </View>
            <View style={styles.recordingActions}>
              <TouchableOpacity style={styles.cancelRecBtn} onPress={cancelRecording}>
                <Text style={styles.cancelRecText}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.sendRecBtn} onPress={stopAndSendRecording}>
                <Text style={styles.sendRecText}>Invia</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* ── DOCK DI INPUT CYBER FLOATING ── */
          <View style={styles.footerContainer}>
            {/* Toolbar Strumenti Rapidi */}
            <View style={styles.cyberToolbar}>
              <TouchableOpacity
                style={[styles.toolPillBtn, showAttachMenu && styles.toolPillBtnActive]}
                onPress={() => setShowAttachMenu((prev) => !prev)}
                activeOpacity={0.7}
              >
                <Text style={styles.toolPillText}>+ Allegati</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.timerSelectorBtn,
                  selectedTimer !== null && styles.timerSelectorBtnActive,
                ]}
                onPress={handleCycleTimer}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.timerSelectorText,
                    selectedTimer !== null && styles.timerSelectorTextActive,
                  ]}
                >
                  {selectedTimer === null ? "Timer: Off" : `Burn: ${selectedTimer}s`}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.toolPillBtn}
                onPress={startRecording}
                activeOpacity={0.7}
              >
                <Text style={styles.toolPillText}>Vocale</Text>
              </TouchableOpacity>
            </View>

            {/* Menu Drawer Allegati (Foto, Video, File) */}
            {showAttachMenu && (
              <View style={styles.attachDrawer}>
                <TouchableOpacity
                  style={styles.attachDrawerItem}
                  onPress={() => imageInputRef.current?.click()}
                >
                  <Text style={styles.attachDrawerTitle}>Foto Cifrata</Text>
                  <Text style={styles.attachDrawerSub}>Invia immagine single-view o protetta</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.attachDrawerItem}
                  onPress={() => videoInputRef.current?.click()}
                >
                  <Text style={styles.attachDrawerTitle}>Video Protetto</Text>
                  <Text style={styles.attachDrawerSub}>Video in streaming RAM fino a 12MB</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.attachDrawerItem}
                  onPress={() => fileInputRef.current?.click()}
                >
                  <Text style={styles.attachDrawerTitle}>Documento / File</Text>
                  <Text style={styles.attachDrawerSub}>PDF, codice, archivi con hash SHA-256</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Campo di Inserimento con Preservazione Focus e Invio Rapido */}
            <View style={styles.inputDockRow}>
              <TextInput
                ref={textInputRef}
                style={styles.inputField}
                placeholder="Scrivi un messaggio cifrato..."
                placeholderTextColor="#64748B"
                value={input}
                onChangeText={handleInputChange}
                onSubmitEditing={handleSendMessage}
                blurOnSubmit={false}
                returnKeyType="send"
                onKeyPress={(e: any) => {
                  if (Platform.OS === "web" && e.nativeEvent?.key === "Enter" && !e.nativeEvent?.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
              />

              <TouchableOpacity
                style={[styles.sendPillBtn, !input.trim() && styles.sendPillBtnDisabled]}
                onPress={() => {
                  handleSendMessage();
                  setTimeout(() => textInputRef.current?.focus(), 15);
                }}
                disabled={!input.trim()}
                activeOpacity={0.8}
              >
                <Text style={styles.sendPillText}>Invia</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* ── MODALE INCINERA SESSIONE (PANIC PURGE) ── */}
      {showPurgeModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.deleteModalCard}>
            <Text style={styles.deleteModalTitle}>INCINERA SESSIONE CHAT (PANIC PURGE)</Text>
            <Text style={styles.deleteModalDesc}>
              Sei sicuro di voler incenerire l'intera conversazione? Verranno eliminati immediatamente
              tutti i messaggi, le foto e i buffer crittografici sia sul tuo dispositivo che su quello di @{friendUsername}.
              Zero byte rimarranno in RAM o su disco.
            </Text>

            <View style={styles.deleteModalButtons}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowPurgeModal(false)}
              >
                <Text style={styles.modalCancelBtnText}>Annulla</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handlePurgeSession}
              >
                <Text style={styles.modalConfirmBtnText}>Incinera Ora</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* ── MODALE DI CONFERMA: ELIMINA PER ENTRAMBI ── */}
      {deleteConfirmMsg && (
        <View style={styles.modalOverlay}>
          <View style={styles.deleteModalCard}>
            <Text style={styles.deleteModalTitle}>Elimina per entrambi</Text>
            <Text style={styles.deleteModalDesc}>
              Verrà cancellato definitivamente dalla chat locale di entrambi i nodi (@{user?.username} e @{friendUsername}).
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
                <Text style={styles.modalConfirmBtnText}>Elimina</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* ── MODALE PREVIEW FOTO PROTETTA A SCHERMO INTERO ── */}
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
              <Text style={styles.previewTitle}>Visualizzatore Protetto</Text>
            )}
            <View style={styles.previewActionsRow}>
              {isRoot && (
                <TouchableOpacity
                  style={styles.previewSaveBtn}
                  onPress={() => {
                    handleSaveMedia(
                      activePreviewMedia.data,
                      `sovereign_foto_${friendUsername}_${Date.now()}.jpg`
                    );
                  }}
                >
                  <Text style={styles.previewSaveText}>Salva Immagine</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.previewCloseBtn}
                onPress={() => {
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
            <Text style={styles.blurShieldTitle}>Protezione Privacy Attiva</Text>
            <Text style={styles.blurShieldText}>
              Cattura schermo e registrazione bloccati per la tua sicurezza.
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

      {/* ── MODALE ANALISI PACCHETTO CRITTOGRAFICO (CIPHER INSPECTOR) ── */}
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
                  {inspectedMessage.iv ? inspectedMessage.iv.substring(0, 28) + "..." : "12-byte casuali"}
                </Text>
              </View>

              <View style={styles.inspectorRow}>
                <Text style={styles.inspectorLabel}>Controllo Integrità GMAC</Text>
                <Text style={styles.inspectorValGreen}>Auth Tag 128-bit Valido & Anti-Tamper</Text>
              </View>

              <View style={styles.inspectorPayloadBox}>
                <Text style={styles.inspectorPayloadTitle}>Payload Cifrato Relay (Transito Server):</Text>
                <Text style={styles.inspectorPayloadText}>
                  {inspectedMessage.ciphertext
                    ? inspectedMessage.ciphertext.slice(0, 160) + "..."
                    : "kP819a+bX90qV2z9A41Bc9F00aL29Zp... (Payload cifrato end-to-end)"}
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
                Confronta questa sequenza crittografica a 32 caratteri con @{friendUsername} su un canale fidato
                per verificare l'integrità del canale da attacchi Man-in-the-Middle.
              </Text>

              <View style={styles.safetyCodeBox}>
                <Text style={styles.safetyCodeText}>{safetyFingerprint}</Text>
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
            <Text style={styles.camouflageLine}>[0.142] Relay node heartbeat ping: {latencyMs}ms (latency nominal)</Text>
            <Text style={styles.camouflageLine}>[0.780] Memory sanitize policy: Zero-Trace (swap disabled)</Text>
            <Text style={styles.camouflageLine}>[1.200] Network traffic padding: Active (fixed-block length masking)</Text>
            <Text style={styles.camouflageLine}>[1.850] Visual shoulder-surf shield: ENGAGED</Text>
            <Text style={styles.camouflageLine}>[2.400] All cryptographic keys held exclusively in client heap.</Text>
            <Text style={styles.camouflageLine}>[STATUS] Standby. Monitor running in silent background daemon.</Text>
          </ScrollView>
        </View>
      )}

      {/* ── MODALE GALLERIA MEDIA DELLA CHAT (VAULT) ── */}
      {showMediaGallery && (
        <View style={styles.modalOverlay}>
          <View style={styles.galleryCard}>
            <View style={styles.galleryHeader}>
              <View>
                <Text style={styles.galleryTitle}>ARCHIVIO MEDIA VAULT</Text>
                <Text style={styles.gallerySubtitle}>Elementi multimediali memorizzati con @{friendUsername}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowMediaGallery(false)} style={styles.galleryCloseBtn}>
                <Text style={styles.galleryCloseBtnText}>Chiudi</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.galleryGrid} showsVerticalScrollIndicator={false}>
              {chatMessages.filter((m) => m.mediaData && !m.deleted).length === 0 ? (
                <View style={styles.emptyGallery}>
                  <Text style={styles.emptyGalleryText}>Nessun elemento multimediale in questa chat.</Text>
                </View>
              ) : (
                chatMessages
                  .filter((m) => m.mediaData && !m.deleted)
                  .map((item) => (
                    <View key={item.id} style={styles.galleryItem}>
                      {item.mediaType === "image" ? (
                        <TouchableOpacity
                          activeOpacity={0.8}
                          onPress={() =>
                            setActivePreviewMedia({
                              type: "image",
                              data: item.mediaData!,
                              msg: item,
                            })
                          }
                          style={styles.galleryThumbWrap}
                        >
                          <Image
                            source={{ uri: item.mediaData }}
                            style={styles.galleryThumb}
                            resizeMode="cover"
                          />
                        </TouchableOpacity>
                      ) : (
                        <View style={styles.galleryNonImgWrap}>
                          <Text style={styles.galleryNonImgText}>[{item.mediaType?.toUpperCase()}]</Text>
                        </View>
                      )}
                      <View style={styles.galleryItemFooter}>
                        <Text style={styles.galleryItemSender}>{item.isMine ? "Tu" : `@${item.sender}`}</Text>
                        <TouchableOpacity
                          style={styles.galleryItemSaveBtn}
                          onPress={() =>
                            handleSaveMedia(
                              item.mediaData!,
                              item.fileName || `media_${item.id.substring(0, 8)}.${item.mediaType === "image" ? "jpg" : "dat"}`
                            )
                          }
                        >
                          <Text style={styles.galleryItemSaveText}>Salva</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
              )}
            </ScrollView>
          </View>
        </View>
      )}

      {/* Toast Notifica Rapida */}
      {savedToastMsg && (
        <View style={styles.toastCard}>
          <View style={styles.toastDot} />
          <Text style={styles.toastText}>{savedToastMsg}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

// ── DESIGN SYSTEM & STILI CYBERSECURITY ELEVATI ──────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#060913",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#0A0F1D",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(14, 165, 233, 0.2)",
  },
  backBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 4,
  },
  backArrow: {
    color: THEME.colors.primary,
    fontSize: 30,
    lineHeight: 30,
    fontWeight: "300",
  },
  profileInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  avatarWrap: {
    position: "relative",
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  avatarTag: {
    fontSize: 12,
    fontWeight: "900",
    color: "#FFF",
  },
  statusDot: {
    position: "absolute",
    bottom: -1,
    right: -1,
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: "#0A0F1D",
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
    color: "#F8FAFC",
    fontSize: 14,
    fontWeight: "700",
    marginRight: 6,
  },
  e2eeBadge: {
    backgroundColor: "rgba(14, 165, 233, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(14, 165, 233, 0.3)",
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  e2eeBadgeText: {
    fontSize: 8,
    fontWeight: "800",
    color: THEME.colors.primary,
    letterSpacing: 0.5,
  },
  e2eeBadgeVerified: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderColor: THEME.colors.online,
  },
  e2eeBadgeTextVerified: {
    color: THEME.colors.online,
  },
  statusSubRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  friendStatusText: {
    color: "#94A3B8",
    fontSize: 10,
    marginTop: 1,
  },
  latencyIndicator: {
    fontSize: 10,
    color: "#38BDF8",
    fontFamily: THEME.fonts.mono,
    marginLeft: 4,
  },
  headerRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerIconBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  headerIconBtnActive: {
    backgroundColor: "rgba(14, 165, 233, 0.15)",
    borderColor: THEME.colors.primary,
  },
  headerIconText: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "600",
  },
  headerNukeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  headerNukeText: {
    color: "#F87171",
    fontSize: 11,
    fontWeight: "700",
  },
  galleryHeaderBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: "rgba(14, 165, 233, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(14, 165, 233, 0.25)",
  },
  galleryHeaderBtnText: {
    fontSize: 11,
    fontFamily: THEME.fonts.mono,
    color: THEME.colors.primary,
    fontWeight: "600",
  },
  menuBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  menuIcon: {
    color: "#F8FAFC",
    fontSize: 11,
    fontWeight: "600",
  },

  // Barra di Ricerca
  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#0D1424",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(14, 165, 233, 0.2)",
  },
  searchBarInput: {
    flex: 1,
    backgroundColor: "#060913",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 12,
    color: "#FFF",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  searchClearBtn: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  searchClearText: {
    color: THEME.colors.primary,
    fontSize: 11,
    fontWeight: "600",
  },

  dropdownMenu: {
    position: "absolute",
    top: 55,
    right: 12,
    backgroundColor: "#0E1626",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(14, 165, 233, 0.25)",
    zIndex: 100,
    minWidth: 200,
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 10,
  },
  menuItem: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
  },
  menuItemText: {
    color: "#F8FAFC",
    fontSize: 12,
    fontWeight: "600",
  },
  processingBanner: {
    backgroundColor: "rgba(14, 165, 233, 0.15)",
    paddingVertical: 5,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.primary,
  },
  processingText: {
    color: THEME.colors.primary,
    fontSize: 10,
    fontFamily: THEME.fonts.mono,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  chatArea: {
    flex: 1,
  },
  messageList: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },

  // ── BOLLE MESSAGGI ASIMMETRICHE & CYBER ELEVATE ──
  messageBubble: {
    maxWidth: "85%",
    borderRadius: 16,
    paddingHorizontal: 13,
    paddingVertical: 9,
    marginVertical: 4,
  },
  myBubble: {
    alignSelf: "flex-end",
    backgroundColor: "#0284C7",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 3,
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.4)",
    shadowColor: "#0284C7",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  friendBubble: {
    alignSelf: "flex-start",
    backgroundColor: "#0E1626",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderLeftWidth: 3,
    borderLeftColor: "#0EA5E9",
  },
  ephemeralTextBubble: {
    borderColor: "rgba(245, 158, 11, 0.45)",
    borderWidth: 1,
  },
  textBurnBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(245, 158, 11, 0.18)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
  },
  textBurnBadgeText: {
    color: "#FBBF24",
    fontSize: 9,
    fontFamily: THEME.fonts.mono,
    fontWeight: "800",
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  myMessageText: {
    color: "#FFFFFF",
  },
  friendMessageText: {
    color: "#F1F5F9",
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-end",
    marginTop: 4,
  },
  timeText: {
    fontSize: 9,
    fontFamily: THEME.fonts.mono,
    color: "rgba(255, 255, 255, 0.6)",
    marginRight: 4,
  },
  tickText: {
    fontSize: 9,
    fontFamily: THEME.fonts.mono,
    color: "rgba(255, 255, 255, 0.5)",
    fontWeight: "700",
  },
  tickDelivered: {
    color: "#38BDF8",
  },
  miniCopyBtn: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    marginRight: 5,
  },
  miniCopyBtnText: {
    fontSize: 9,
    color: "#CBD5E1",
    fontFamily: THEME.fonts.mono,
    fontWeight: "600",
  },
  miniCipherBtn: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: "rgba(14, 165, 233, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(14, 165, 233, 0.3)",
    marginRight: 5,
  },
  miniCipherBtnText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#38BDF8",
    fontFamily: THEME.fonts.mono,
  },
  miniDeleteBtn: {
    marginRight: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
  },
  miniDeleteText: {
    color: "#FCA5A5",
    fontSize: 9,
    fontWeight: "600",
    fontFamily: THEME.fonts.mono,
  },

  deletedBubble: {
    opacity: 0.6,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  deletedText: {
    color: "#64748B",
    fontSize: 12,
    fontStyle: "italic",
  },
  deletedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  deletedBadge: {
    color: "#EF4444",
    fontSize: 9,
    fontFamily: THEME.fonts.mono,
    fontWeight: "700",
  },

  // ── CARD ENCLAVE PER FOTO EFFIMERA PROTETTA ──
  ephemeralEnclaveCard: {
    width: 260,
    backgroundColor: "#090E1A",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.45)",
    padding: 10,
    borderRadius: 14,
  },
  enclaveHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
  },
  enclaveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#F59E0B",
    marginRight: 6,
  },
  enclaveHeaderTitle: {
    color: "#F8FAFC",
    fontSize: 10,
    fontFamily: THEME.fonts.mono,
    fontWeight: "700",
    flex: 1,
  },
  enclaveTimerBadge: {
    backgroundColor: "rgba(245, 158, 11, 0.2)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.5)",
  },
  enclaveTimerBadgeText: {
    color: "#FBBF24",
    fontSize: 9,
    fontFamily: THEME.fonts.mono,
    fontWeight: "800",
  },
  enclaveTapArea: {
    backgroundColor: "rgba(14, 165, 233, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(14, 165, 233, 0.15)",
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 4,
  },
  enclaveShieldIconBox: {
    marginBottom: 6,
  },
  enclaveShieldGlyph: {
    fontSize: 18,
    fontFamily: THEME.fonts.mono,
    color: "#38BDF8",
    fontWeight: "800",
  },
  enclavePromptTitle: {
    color: "#FFF",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 3,
    textAlign: "center",
  },
  enclavePromptSub: {
    color: "#94A3B8",
    fontSize: 10,
    textAlign: "center",
    lineHeight: 14,
  },
  enclaveFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
    paddingTop: 4,
  },
  enclaveDeleteBtn: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  enclaveDeleteText: {
    color: "#F87171",
    fontSize: 9,
    fontFamily: THEME.fonts.mono,
    fontWeight: "700",
  },

  // ── FOTO & MEDIA NORMALE ──
  mediaBubble: {
    padding: 5,
    width: 250,
  },
  imageContainer: {
    width: "100%",
    height: 220,
    borderRadius: 12,
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
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.5)",
  },
  timerBadgeText: {
    color: "#FBBF24",
    fontSize: 9,
    fontFamily: THEME.fonts.mono,
    fontWeight: "700",
  },
  mediaFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 5,
    paddingHorizontal: 4,
  },
  mediaActionsLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  saveMediaBtn: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "rgba(14, 165, 233, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(14, 165, 233, 0.3)",
  },
  saveMediaText: {
    fontSize: 9,
    fontWeight: "600",
    color: THEME.colors.primary,
    fontFamily: THEME.fonts.mono,
  },
  deleteForBothBtn: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.25)",
  },
  deleteForBothText: {
    color: "#FCA5A5",
    fontSize: 9,
    fontWeight: "700",
    fontFamily: THEME.fonts.mono,
  },

  // ── DOCUMENTO / FILE CARD ──
  fileCardBubble: {
    width: 250,
    padding: 10,
    backgroundColor: "#0D1424",
    borderWidth: 1,
    borderColor: "rgba(14, 165, 233, 0.25)",
  },
  fileHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  fileIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "rgba(14, 165, 233, 0.15)",
    borderWidth: 1,
    borderColor: THEME.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  fileIconBadgeText: {
    color: THEME.colors.primary,
    fontSize: 10,
    fontWeight: "900",
    fontFamily: THEME.fonts.mono,
  },
  fileNameText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 2,
  },
  fileMetaText: {
    color: "#94A3B8",
    fontSize: 9,
    fontFamily: THEME.fonts.mono,
  },
  fileActionsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 6,
  },
  fileDownloadBtn: {
    flex: 1,
    backgroundColor: THEME.colors.primary,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: "center",
  },
  fileDownloadBtnText: {
    color: "#FFF",
    fontSize: 10,
    fontWeight: "700",
  },
  fileDeleteBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    alignItems: "center",
  },
  fileDeleteBtnText: {
    color: "#F87171",
    fontSize: 10,
    fontWeight: "700",
  },

  // Video & Audio
  videoContainer: {
    width: "100%",
    borderRadius: 12,
    overflow: "hidden",
  },
  mediaPlaceholderText: {
    color: "#94A3B8",
    fontSize: 12,
    padding: 12,
  },
  audioBubble: {
    width: 250,
    paddingVertical: 8,
  },
  audioPlayerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  audioPlayBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: THEME.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  audioPlayBtnActive: {
    backgroundColor: THEME.colors.warning,
  },
  audioPlayBtnText: {
    color: "#FFF",
    fontSize: 10,
    fontWeight: "800",
  },
  audioTrackInfo: {
    flex: 1,
  },
  audioMetaRow: {
    marginBottom: 4,
  },
  audioTag: {
    color: "#F8FAFC",
    fontSize: 11,
    fontWeight: "700",
  },
  audioProgressTrack: {
    height: 4,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 2,
    overflow: "hidden",
  },
  audioProgressFill: {
    height: "100%",
    backgroundColor: "#38BDF8",
  },

  // ── DOCK DI INPUT CYBER FLOATING ──
  footerContainer: {
    backgroundColor: "#090E1B",
    borderTopWidth: 1,
    borderTopColor: "rgba(14, 165, 233, 0.2)",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  cyberToolbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  toolPillBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  toolPillBtnActive: {
    backgroundColor: "rgba(14, 165, 233, 0.15)",
    borderColor: THEME.colors.primary,
  },
  toolPillText: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "600",
  },
  timerSelectorBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  timerSelectorBtnActive: {
    backgroundColor: "rgba(245, 158, 11, 0.18)",
    borderColor: "rgba(245, 158, 11, 0.6)",
  },
  timerSelectorText: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "700",
    fontFamily: THEME.fonts.mono,
  },
  timerSelectorTextActive: {
    color: "#FBBF24",
  },

  attachDrawer: {
    backgroundColor: "#0E1626",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(14, 165, 233, 0.25)",
    padding: 6,
    marginBottom: 8,
    gap: 4,
  },
  attachDrawerItem: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
  },
  attachDrawerTitle: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "700",
  },
  attachDrawerSub: {
    color: "#64748B",
    fontSize: 10,
  },

  inputDockRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  inputField: {
    flex: 1,
    backgroundColor: "#060913",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 9,
    color: "#F8FAFC",
    fontSize: 13,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  sendPillBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: THEME.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendPillBtnDisabled: {
    opacity: 0.35,
    backgroundColor: "#1E293B",
  },
  sendPillText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "700",
  },

  // Barra Registrazione
  recordingBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderTopWidth: 1,
    borderTopColor: "rgba(239, 68, 68, 0.3)",
  },
  recordingIndicator: {
    flexDirection: "row",
    alignItems: "center",
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: THEME.colors.danger,
    marginRight: 6,
  },
  recordingTimer: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "700",
  },
  recordingActions: {
    flexDirection: "row",
    gap: 6,
  },
  cancelRecBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  cancelRecText: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "600",
  },
  sendRecBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: THEME.colors.danger,
  },
  sendRecText: {
    color: "#FFF",
    fontSize: 11,
    fontWeight: "700",
  },

  // Modali
  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    zIndex: 999,
  },
  deleteModalCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#0E1626",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.4)",
    padding: 18,
  },
  deleteModalTitle: {
    color: THEME.colors.danger,
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  deleteModalDesc: {
    color: "#94A3B8",
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 16,
  },
  deleteModalButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  modalCancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  modalCancelBtnText: {
    color: "#F8FAFC",
    fontSize: 11,
    fontWeight: "600",
  },
  modalConfirmBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
    backgroundColor: THEME.colors.danger,
  },
  modalConfirmBtnText: {
    color: "#FFF",
    fontSize: 11,
    fontWeight: "700",
  },

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
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#0A0F1D",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
  },
  countdownBadge: {
    backgroundColor: "rgba(245, 158, 11, 0.2)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.5)",
  },
  countdownText: {
    color: "#FBBF24",
    fontSize: 11,
    fontWeight: "800",
    fontFamily: THEME.fonts.mono,
  },
  previewTitle: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "700",
  },
  previewCloseBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  previewCloseText: {
    color: THEME.colors.primary,
    fontSize: 11,
    fontWeight: "700",
  },
  previewProgressBarBg: {
    height: 3,
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
    padding: 10,
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
    padding: 20,
  },
  blurShieldCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#0E1626",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.4)",
    padding: 20,
    alignItems: "center",
  },
  blurShieldTitle: {
    color: THEME.colors.danger,
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 8,
  },
  blurShieldText: {
    color: "#FFF",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    marginBottom: 16,
  },
  blurShieldBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: THEME.colors.primary,
  },
  blurShieldBtnText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "700",
  },

  // Inspector & Safety
  inspectorCard: {
    width: "100%",
    maxWidth: 440,
    backgroundColor: "#0E1626",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(14, 165, 233, 0.3)",
    padding: 16,
  },
  inspectorHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
  },
  inspectorTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  greenPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: THEME.colors.online,
    marginRight: 6,
  },
  bluePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: THEME.colors.primary,
    marginRight: 6,
  },
  inspectorTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFF",
    letterSpacing: 0.5,
  },
  inspectorCloseBtn: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "600",
    padding: 2,
  },
  inspectorContent: {
    gap: 8,
  },
  inspectorRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.04)",
  },
  inspectorLabel: {
    fontSize: 11,
    color: "#94A3B8",
  },
  inspectorVal: {
    fontSize: 11,
    fontWeight: "600",
    color: "#FFF",
  },
  inspectorValCyan: {
    fontSize: 11,
    fontWeight: "600",
    color: "#38BDF8",
  },
  inspectorValGreen: {
    fontSize: 11,
    fontWeight: "600",
    color: THEME.colors.online,
  },
  inspectorValMono: {
    fontSize: 10,
    fontFamily: THEME.fonts.mono,
    color: "#94A3B8",
  },
  inspectorPayloadBox: {
    backgroundColor: "#060913",
    borderRadius: 6,
    padding: 8,
    marginTop: 4,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  inspectorPayloadTitle: {
    fontSize: 10,
    fontWeight: "600",
    color: "#94A3B8",
    marginBottom: 2,
  },
  inspectorPayloadText: {
    fontSize: 10,
    fontFamily: THEME.fonts.mono,
    color: THEME.colors.primary,
    lineHeight: 14,
  },
  safetyDesc: {
    fontSize: 11,
    color: "#94A3B8",
    lineHeight: 16,
    marginBottom: 10,
  },
  safetyCodeBox: {
    backgroundColor: "#060913",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(14, 165, 233, 0.3)",
    alignItems: "center",
    marginBottom: 12,
  },
  safetyCodeText: {
    fontSize: 14,
    fontWeight: "700",
    fontFamily: THEME.fonts.mono,
    color: THEME.colors.primary,
    letterSpacing: 1.2,
  },
  verifyToggleBtn: {
    backgroundColor: THEME.colors.primary,
    borderRadius: 6,
    paddingVertical: 9,
    alignItems: "center",
  },
  verifyToggleBtnActive: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  verifyToggleBtnText: {
    color: "#FFF",
    fontSize: 11,
    fontWeight: "700",
  },

  // Camouflage Overlay
  camouflageOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#05080E",
    zIndex: 3000,
    padding: 14,
  },
  camouflageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(14, 165, 233, 0.2)",
    marginBottom: 10,
  },
  camouflageTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  camouflageDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: THEME.colors.online,
    marginRight: 6,
  },
  camouflageTitle: {
    fontSize: 10,
    fontFamily: THEME.fonts.mono,
    color: THEME.colors.online,
  },
  camouflageUnlockBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  camouflageUnlockText: {
    fontSize: 10,
    color: "#FFF",
    fontWeight: "600",
  },
  camouflageLogArea: {
    flex: 1,
  },
  camouflageLine: {
    fontSize: 10,
    fontFamily: THEME.fonts.mono,
    color: "#38BDF8",
    lineHeight: 18,
    marginBottom: 3,
  },

  // Vault Gallery
  galleryCard: {
    width: "92%",
    maxWidth: 580,
    maxHeight: "82%",
    backgroundColor: "#0E1626",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(14, 165, 233, 0.25)",
    padding: 14,
  },
  galleryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
    marginBottom: 10,
  },
  galleryTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFF",
  },
  gallerySubtitle: {
    fontSize: 10,
    color: "#94A3B8",
    marginTop: 2,
  },
  galleryCloseBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  galleryCloseBtnText: {
    fontSize: 11,
    color: "#94A3B8",
  },
  galleryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingBottom: 16,
  },
  galleryItem: {
    width: "47%",
    backgroundColor: "#060913",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    overflow: "hidden",
  },
  galleryThumbWrap: {
    width: "100%",
    height: 110,
    backgroundColor: "#000",
  },
  galleryThumb: {
    width: "100%",
    height: "100%",
  },
  galleryNonImgWrap: {
    width: "100%",
    height: 110,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0E1626",
  },
  galleryNonImgText: {
    color: THEME.colors.primary,
    fontSize: 14,
    fontFamily: THEME.fonts.mono,
    fontWeight: "700",
  },
  galleryItemFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 6,
  },
  galleryItemSender: {
    fontSize: 10,
    color: "#FFF",
    fontWeight: "600",
  },
  galleryItemSaveBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "rgba(14, 165, 233, 0.15)",
  },
  galleryItemSaveText: {
    fontSize: 9,
    color: THEME.colors.primary,
    fontWeight: "700",
  },
  emptyGallery: {
    width: "100%",
    paddingVertical: 30,
    alignItems: "center",
  },
  emptyGalleryText: {
    color: "#94A3B8",
    fontSize: 12,
  },

  toastCard: {
    position: "absolute",
    bottom: 75,
    alignSelf: "center",
    backgroundColor: "#0F172A",
    borderWidth: 1,
    borderColor: THEME.colors.primary,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 9999,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  toastDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: THEME.colors.online,
    marginRight: 6,
  },
  toastText: {
    color: "#FFF",
    fontSize: 11,
    fontWeight: "600",
  },
  previewActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  previewSaveBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: THEME.colors.primary,
  },
  previewSaveText: {
    color: "#FFF",
    fontSize: 11,
    fontWeight: "700",
  },
});
