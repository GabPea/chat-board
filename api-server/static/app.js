// Configurazione
const API_URL = window.location.origin;
const WS_URL = API_URL.replace('http', 'ws');

// Stato globale
let token = localStorage.getItem('token');
let username = localStorage.getItem('username');
let ws = null;
let currentRecipient = null;
let chatListenersSetup = false;
let activeChats = new Map(); // Map<username, messages[]>
let typingTimeout = null;
let usersTyping = new Set(); // Set di utenti che stanno scrivendo
let messageReactions = new Map(); // Map<messageId, reactions>

// ============================================
// INIZIALIZZAZIONE
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // Se già loggato, vai alla chat
    if (token && username) {
        showChatScreen();
    } else {
        showAuthScreen();
    }
    
    // Event listeners per auth (sempre disponibili)
    setupAuthListeners();
    // setupChatListeners() verrà chiamato in showChatScreen()
});

// ============================================
// AUTENTICAZIONE UI
// ============================================

function setupAuthListeners() {
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            
            // Switch tabs
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
            
            btn.classList.add('active');
            document.getElementById(`${tab}-form`).classList.add('active');
            
            // Clear errors
            document.querySelectorAll('.error-message').forEach(e => e.classList.remove('show'));
        });
    });
    
    // Login form
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = document.getElementById('login-username').value.trim();
        const pass = document.getElementById('login-password').value;
        await handleLogin(user, pass);
    });
    
    // Register form
    document.getElementById('register-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = document.getElementById('register-username').value.trim();
        const pass = document.getElementById('register-password').value;
        const passConfirm = document.getElementById('register-password-confirm').value;
        
        if (pass !== passConfirm) {
            showError('register', 'Le password non coincidono');
            return;
        }
        
        await handleRegister(user, pass);
    });
}

async function handleLogin(user, pass) {
    try {
        const response = await fetch(`${API_URL}/api/login`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({username: user, password: pass})
        });
        
        if (response.ok) {
            const data = await response.json();
            token = data.access_token;
            username = data.username;
            
            localStorage.setItem('token', token);
            localStorage.setItem('username', username);
            
            showChatScreen();
        } else {
            const error = await response.json();
            showError('login', error.detail || 'Errore durante il login');
        }
    } catch (err) {
        showError('login', 'Errore di connessione al server');
    }
}

async function handleRegister(user, pass) {
    try {
        const response = await fetch(`${API_URL}/api/register`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({username: user, password: pass})
        });
        
        if (response.ok) {
            const data = await response.json();
            token = data.access_token;
            username = data.username;
            
            localStorage.setItem('token', token);
            localStorage.setItem('username', username);
            
            showChatScreen();
        } else {
            const error = await response.json();
            showError('register', error.detail || 'Errore durante la registrazione');
        }
    } catch (err) {
        showError('register', 'Errore di connessione al server');
    }
}

function showError(formType, message) {
    const errorEl = document.getElementById(`${formType}-error`);
    errorEl.textContent = message;
    errorEl.classList.add('show');
}

// ============================================
// CHAT UI
// ============================================

function setupChatListeners() {
    // Logout
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
    
    // Invio messaggio
    document.getElementById('send-btn').addEventListener('click', sendMessage);
    document.getElementById('message-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
    
    // Detect typing in input
    document.getElementById('message-input').addEventListener('input', (e) => {
        // Invia evento typing
        if (ws && ws.readyState === WebSocket.OPEN) {
            // Clear timeout precedente
            if (typingTimeout) clearTimeout(typingTimeout);
            
            // Invia typing event
            ws.send(JSON.stringify({
                type: 'typing',
                recipient: currentRecipient
            }));
            
            // Stop typing dopo 2 secondi di inattività
            typingTimeout = setTimeout(() => {
                ws.send(JSON.stringify({
                    type: 'stop_typing',
                    recipient: currentRecipient
                }));
            }, 2000);
        }
    });
    
    // Pulsante attach
    document.getElementById('attach-btn').addEventListener('click', () => {
        document.getElementById('image-input').click();
    });
    
    // Upload immagine
    document.getElementById('image-input').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        // Mostra loading
        const input = document.getElementById('message-input');
        const originalPlaceholder = input.placeholder;
        input.placeholder = 'Uploading image...';
        input.disabled = true;
        
        try {
            // Upload file
            const formData = new FormData();
            formData.append('file', file);
            
            const response = await fetch('/api/upload', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Upload failed');
            }
            
            const data = await response.json();
            
            // Invia messaggio con immagine
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    content: '',
                    recipient: currentRecipient,
                    imageUrl: data.url
                }));
            }
            
            showToast('Image uploaded successfully', 'success');
        } catch (error) {
            showToast(error.message || 'Failed to upload image', 'error');
        } finally {
            input.placeholder = originalPlaceholder;
            input.disabled = false;
            e.target.value = ''; // Reset input
        }
    });
    
    // Chat generale
    const chatList = document.querySelector('.chat-list');
    chatList.addEventListener('click', (e) => {
        const chatItem = e.target.closest('.chat-item');
        if (!chatItem) return;
        
        const chatType = chatItem.dataset.chat;
        const chatUser = chatItem.dataset.user;
        
        // Update active
        document.querySelectorAll('.chat-item').forEach(item => item.classList.remove('active'));
        chatItem.classList.add('active');
        
        if (chatType === 'broadcast') {
            currentRecipient = null;
            document.getElementById('chat-title').textContent = 'General Chat';
            document.getElementById('chat-subtitle').textContent = 'End-to-end encrypted';
            document.getElementById('message-input').placeholder = 'Type a message...';
            document.getElementById('dm-hint').classList.remove('show');
            loadBroadcastMessages();
        } else if (chatType === 'dm') {
            currentRecipient = chatUser;
            document.getElementById('chat-title').textContent = chatUser;
            document.getElementById('chat-subtitle').textContent = 'Direct message';
            document.getElementById('message-input').placeholder = `Message ${chatUser}...`;
            document.getElementById('dm-hint').classList.remove('show');
            loadDirectMessages(chatUser);
        }
    });
}

function showAuthScreen() {
    document.getElementById('auth-screen').classList.add('active');
    document.getElementById('chat-screen').classList.remove('active');
}

function showChatScreen() {
    document.getElementById('auth-screen').classList.remove('active');
    document.getElementById('chat-screen').classList.add('active');
    
    document.getElementById('current-user-name').textContent = username;
    
    // Set user avatar initial
    const initial = username.charAt(0).toUpperCase();
    document.getElementById('user-avatar-sidebar').textContent = initial;
    
    // Setup chat listeners (solo una volta)
    if (!chatListenersSetup) {
        setupChatListeners();
        chatListenersSetup = true;
    }
    
    // Connetti WebSocket
    connectWebSocket();
    
    // Carica utenti online
    loadOnlineUsers();
    
    // Carica cronologia
    loadMessageHistory();
}

function handleLogout() {
    if (ws) ws.close();
    
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    
    token = null;
    username = null;
    
    showAuthScreen();
}

// ============================================
// WEBSOCKET
// ============================================

function connectWebSocket() {
    const wsUrl = `${WS_URL}/ws/${token}`;
    
    ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
        console.log('Connected to WebSocket');
        showToast('Connected to chat', 'success');
    };
    
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        // Gestisci eventi typing
        if (data.type === 'typing') {
            if (data.sender !== username && 
                (!currentRecipient || currentRecipient === data.sender)) {
                showTypingIndicator(data.sender);
            }
            return;
        }
        
        if (data.type === 'stop_typing') {
            hideTypingIndicator(data.sender);
            return;
        }
        
        // Gestisci reazioni
        if (data.type === 'reaction') {
            updateMessageReaction(data.messageId, data.reaction, data.username);
            return;
        }
        
        // Messaggio normale
        const message = data;
        
        // Nascondi typing indicator quando arriva un messaggio
        if (message.sender) {
            hideTypingIndicator(message.sender);
        }
        
        // Mostra il messaggio solo se è pertinente alla chat corrente
        const isRelevant = 
            (!currentRecipient && !message.recipient) || // Broadcast e siamo in generale
            (currentRecipient && 
                ((message.sender === currentRecipient && message.recipient === username) || 
                 (message.sender === username && message.recipient === currentRecipient)));
        
        if (isRelevant) {
            displayMessage(message);
        }
        
        // Notifica se è un DM e non siamo in quella chat
        if (message.recipient === username && message.sender !== 'SYSTEM' && 
            currentRecipient !== message.sender) {
            showToast(`New message from ${message.sender}`, 'info');
            
            // Apri automaticamente la chat se non esiste
            if (!document.querySelector(`[data-user="${message.sender}"]`)) {
                const chatList = document.querySelector('.chat-list');
                const initial = message.sender.charAt(0).toUpperCase();
                
                const chatItem = document.createElement('div');
                chatItem.className = 'chat-item';
                chatItem.dataset.chat = 'dm';
                chatItem.dataset.user = message.sender;
                chatItem.innerHTML = `
                    <div class="chat-avatar">${initial}</div>
                    <div class="chat-info">
                        <div class="chat-name">${escapeHtml(message.sender)}</div>
                        <div class="chat-preview">Direct message</div>
                    </div>
                `;
                
                chatList.appendChild(chatItem);
            }
        }
    };
    
    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        showToast('Connection error', 'error');
    };
    
    ws.onclose = () => {
        console.log('WebSocket disconnected');
        showToast('Disconnected from chat', 'warning');
        
        // Riconnetti dopo 3 secondi
        setTimeout(() => {
            if (token) connectWebSocket();
        }, 3000);
    };
}

function sendMessage() {
    const input = document.getElementById('message-input');
    let content = input.value.trim();
    
    if (!content) return;
    
    let recipient = null;
    
    // Parse @username
    if (content.startsWith('@')) {
        const match = content.match(/@(\w+)\s+(.+)/);
        if (match) {
            recipient = match[1];
            content = match[2];
        } else {
            showToast('Formato DM: @username messaggio', 'warning');
            return;
        }
    }
    
    const message = {
        content: content,
        recipient: recipient
    };
    
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
        input.value = '';
        document.getElementById('dm-hint').classList.remove('show');
        
        // Aggiungi il proprio messaggio alla chat (se non è comando)
        if (!content.startsWith('/')) {
            displayMessage({
                sender: username,
                content: content,
                recipient: recipient,
                timestamp: new Date().toISOString()
            });
        }
    } else {
        showToast('Not connected. Reconnecting...', 'error');
    }
}

// ============================================
// MESSAGGI
// ============================================

function displayMessage(message) {
    const container = document.getElementById('messages-container');
    const messageEl = document.createElement('div');
    
    // ID unico per il messaggio (timestamp + sender)
    const messageId = `${message.timestamp || Date.now()}-${message.sender}`;
    messageEl.dataset.messageId = messageId;
    
    // Determina tipo messaggio
    const isSent = message.sender === username;
    const isSystem = message.sender === 'SYSTEM' || message.sender === 'SERVER';
    const isDM = message.recipient !== null && message.recipient !== undefined;
    
    if (isSystem) {
        messageEl.className = 'message system';
        messageEl.innerHTML = `
            <div class="message-content">
                <div class="message-text">${escapeHtml(message.content)}</div>
            </div>
        `;
    } else {
        messageEl.className = `message ${isSent ? 'sent' : 'received'}`;
        
        const avatar = message.sender.charAt(0).toUpperCase();
        const dmBadge = isDM ? `<div class="message-dm-badge">DM ${isSent ? 'a ' + message.recipient : 'da ' + message.sender}</div>` : '';
        
        // Contenuto immagine o testo
        let contentHtml = '';
        if (message.imageUrl) {
            contentHtml = `<img src="${message.imageUrl}" class="message-image" onclick="window.open('${message.imageUrl}', '_blank')" />`;
            if (message.content) {
                contentHtml += `<div class="message-text">${escapeHtml(message.content)}</div>`;
            }
        } else {
            contentHtml = `<div class="message-text">${escapeHtml(message.content)}</div>`;
        }
        
        messageEl.innerHTML = `
            <div class="message-avatar">${avatar}</div>
            <div class="message-content">
                ${!isSent ? `<div class="message-sender">${escapeHtml(message.sender)}</div>` : ''}
                ${dmBadge}
                ${contentHtml}
                <div class="message-actions">
                    <button class="action-btn" onclick="toggleReactionPicker('${messageId}')" title="React">+</button>
                    <div class="reaction-picker" id="picker-${messageId}">
                        <button onclick="addReaction('${messageId}', '1')">👍</button>
                        <button onclick="addReaction('${messageId}', '2')">❤️</button>
                        <button onclick="addReaction('${messageId}', '3')">😂</button>
                        <button onclick="addReaction('${messageId}', '4')">😮</button>
                        <button onclick="addReaction('${messageId}', '5')">😢</button>
                    </div>
                </div>
                <div class="message-reactions" id="reactions-${messageId}"></div>
            </div>
        `;
    }
    
    container.appendChild(messageEl);
    container.scrollTop = container.scrollHeight;
}

async function loadMessageHistory() {
    // Carica solo i messaggi broadcast all'inizio
    loadBroadcastMessages();
}

async function loadBroadcastMessages() {
    try {
        const response = await fetch(`${API_URL}/api/messages?limit=50`, {
            headers: {'Authorization': `Bearer ${token}`}
        });
        
        if (response.ok) {
            const data = await response.json();
            const container = document.getElementById('messages-container');
            container.innerHTML = '';
            
            // Filtra solo messaggi broadcast (senza recipient)
            const broadcastMessages = data.messages.filter(msg => !msg.recipient);
            
            broadcastMessages.forEach(msg => {
                displayMessage({
                    sender: msg.sender,
                    content: msg.content,
                    recipient: msg.recipient,
                    timestamp: msg.timestamp
                });
            });
        }
    } catch (err) {
        console.error('Errore caricamento cronologia:', err);
    }
}

async function loadDirectMessages(otherUser) {
    try {
        const response = await fetch(`${API_URL}/api/messages/${otherUser}?limit=50`, {
            headers: {'Authorization': `Bearer ${token}`}
        });
        
        if (response.ok) {
            const data = await response.json();
            const container = document.getElementById('messages-container');
            container.innerHTML = '';
            
            data.messages.forEach(msg => {
                displayMessage({
                    sender: msg.sender,
                    content: msg.content,
                    recipient: msg.recipient,
                    timestamp: msg.timestamp
                });
            });
        }
    } catch (err) {
        console.error('Errore caricamento messaggi diretti:', err);
    }
}

// ============================================
// UTENTI ONLINE
// ============================================

async function loadOnlineUsers() {
    try {
        const response = await fetch(`${API_URL}/api/users/online`, {
            headers: {'Authorization': `Bearer ${token}`}
        });
        
        if (response.ok) {
            const data = await response.json();
            displayOnlineUsers(data.online_users);
        }
    } catch (err) {
        console.error('Errore caricamento utenti online:', err);
    }
    
    // Ricarica ogni 5 secondi
    setTimeout(loadOnlineUsers, 5000);
}

function displayOnlineUsers(users) {
    const container = document.getElementById('online-users-list');
    const count = document.getElementById('online-count');
    
    // Rimuovi se stesso dalla lista
    const otherUsers = users.filter(u => u !== username);
    
    count.textContent = otherUsers.length;
    
    container.innerHTML = otherUsers.map(user => {
        const initial = user.charAt(0).toUpperCase();
        return `
            <div class="online-user" data-username="${user}">
                <div class="online-dot"></div>
                <span>${escapeHtml(user)}</span>
            </div>
        `;
    }).join('');
    
    // Click per aprire chat privata
    container.querySelectorAll('.online-user').forEach(el => {
        el.addEventListener('click', () => {
            const user = el.dataset.username;
            openPrivateChat(user);
        });
    });
}

function openPrivateChat(user) {
    // Controlla se la chat esiste già
    const existingChat = document.querySelector(`[data-user="${user}"]`);
    
    if (!existingChat) {
        // Crea nuovo chat item
        const chatList = document.querySelector('.chat-list');
        const initial = user.charAt(0).toUpperCase();
        
        const chatItem = document.createElement('div');
        chatItem.className = 'chat-item';
        chatItem.dataset.chat = 'dm';
        chatItem.dataset.user = user;
        chatItem.innerHTML = `
            <div class="chat-avatar">${initial}</div>
            <div class="chat-info">
                <div class="chat-name">${escapeHtml(user)}</div>
                <div class="chat-preview">Direct message</div>
            </div>
        `;
        
        chatList.appendChild(chatItem);
    }
    
    // Attiva la chat
    document.querySelectorAll('.chat-item').forEach(item => item.classList.remove('active'));
    const targetChat = document.querySelector(`[data-user="${user}"]`);
    targetChat.classList.add('active');
    
    // Imposta destinatario e carica messaggi
    currentRecipient = user;
    document.getElementById('chat-title').textContent = user;
    document.getElementById('chat-subtitle').textContent = 'Direct message';
    document.getElementById('message-input').placeholder = `Message ${user}...`;
    document.getElementById('dm-hint').classList.remove('show');
    
    loadDirectMessages(user);
}

// ============================================
// UTILITY
// ============================================

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'toastOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showTypingIndicator(user) {
    usersTyping.add(user);
    updateTypingIndicator();
}

function hideTypingIndicator(user) {
    usersTyping.delete(user);
    updateTypingIndicator();
}

function updateTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    const textEl = indicator.querySelector('.typing-text');
    
    if (usersTyping.size === 0) {
        indicator.classList.remove('show');
    } else {
        const users = Array.from(usersTyping);
        if (users.length === 1) {
            textEl.textContent = `${users[0]} is typing...`;
        } else if (users.length === 2) {
            textEl.textContent = `${users[0]} and ${users[1]} are typing...`;
        } else {
            textEl.textContent = `${users[0]} and ${users.length - 1} others are typing...`;
        }
        indicator.classList.add('show');
    }
}

// ============================================
// REAZIONI
// ============================================

function toggleReactionPicker(messageId) {
    const picker = document.getElementById(`picker-${messageId}`);
    // Chiudi tutti gli altri picker
    document.querySelectorAll('.reaction-picker').forEach(p => {
        if (p.id !== `picker-${messageId}`) {
            p.classList.remove('show');
        }
    });
    picker.classList.toggle('show');
}

function addReaction(messageId, reaction) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    
    // Invia reazione al server
    ws.send(JSON.stringify({
        type: 'reaction',
        messageId: messageId,
        reaction: reaction,
        username: username
    }));
    
    // Chiudi picker
    const picker = document.getElementById(`picker-${messageId}`);
    if (picker) picker.classList.remove('show');
}

function updateMessageReaction(messageId, reaction, user) {
    const reactionsContainer = document.getElementById(`reactions-${messageId}`);
    if (!reactionsContainer) return;
    
    // Ottieni reazioni correnti
    if (!messageReactions.has(messageId)) {
        messageReactions.set(messageId, {});
    }
    
    const reactions = messageReactions.get(messageId);
    
    // Aggiungi/rimuovi reazione
    if (!reactions[reaction]) {
        reactions[reaction] = new Set();
    }
    
    if (reactions[reaction].has(user)) {
        reactions[reaction].delete(user);
        if (reactions[reaction].size === 0) {
            delete reactions[reaction];
        }
    } else {
        reactions[reaction].add(user);
    }
    
    // Aggiorna UI
    renderReactions(messageId, reactions, reactionsContainer);
}

function renderReactions(messageId, reactions, container) {
    const reactionEmojis = {'1': '👍', '2': '❤️', '3': '😂', '4': '😮', '5': '😢'};
    
    container.innerHTML = '';
    
    for (const [reaction, users] of Object.entries(reactions)) {
        if (users.size === 0) continue;
        
        const reactionEl = document.createElement('div');
        reactionEl.className = `reaction ${users.has(username) ? 'own' : ''}`;
        reactionEl.onclick = () => addReaction(messageId, reaction);
        reactionEl.innerHTML = `
            <span>${reactionEmojis[reaction] || reaction}</span>
            <span class="reaction-count">${users.size}</span>
        `;
        container.appendChild(reactionEl);
    }
}

// Animazione toast out
const style = document.createElement('style');
style.textContent = `
    .btn-icon svg {
        transition: all 0.3s ease;
    }
    
    .btn-icon:hover svg {
        transform: scale(1.1);
    }
    
    /* Glow effect on focus */
    input:focus,
    button:focus {
        outline: none;
    }
    
    /* Smooth transitions */
    * {
        transition: background-color 0.3s ease, border-color 0.3s ease, color 0.3s ease;
    }
`;
document.head.appendChild(style);
