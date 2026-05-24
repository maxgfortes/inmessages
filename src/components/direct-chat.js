import { authService } from '../services/auth.js';
import { messagesService } from '../services/messages.js';

let currentConversationId = null;
let currentOtherUser = null;
let typingTimeout = null;
let isTyping = false;
let replyTo = null;
let actionsPanelOpen = false;

const viewList = document.getElementById('viewList');
const viewChat = document.getElementById('viewChat');
const convList = document.getElementById('conversationsList');
const searchInput = document.getElementById('searchInput');
const composeBtn = document.getElementById('composeBtn');
const editBtn = document.getElementById('editBtn');
const logoutBtn = document.getElementById('logoutBtn');

const chatName = document.getElementById('chatName');
const messagesContainer = document.getElementById('messagesContainer');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const typingIndicator = document.getElementById('typingIndicator');
const backBtn = document.getElementById('backBtn');
const blockBtn = document.getElementById('blockBtn');
const replyBar = document.getElementById('replyBar');
const replyBarText = document.getElementById('replyBarText');
const dismissReply = document.getElementById('dismissReply');

const actionsPanel = document.getElementById('actionsPanel');
const panelUsername = document.getElementById('panelUsername');
const blockUserBtn = document.getElementById('blockUserBtn');
const cancelActionsBtn = document.getElementById('cancelActionsBtn');

const composeModal = document.getElementById('composeModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const newUsername = document.getElementById('newUsername');
const firstMessage = document.getElementById('firstMessage');
const startChatBtn = document.getElementById('startChatBtn');
const composeError = document.getElementById('composeError');

function showChat() {
  viewList.classList.add('slide-out');
  viewChat.classList.add('slide-in');
}

function showList() {
  viewList.classList.remove('slide-out');
  viewChat.classList.remove('slide-in');
  closeActionsPanel();
}

authService.onAuthStateChanged((user) => {
  if (!user) { window.location.href = 'login.html'; return; }
  loadConversations();
});

function loadConversations() {
  convList.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
  messagesService.listenToConversations(renderConversations);
}

function renderConversations(conversations) {
  if (!conversations.length) {
    convList.innerHTML = `<div class="empty-state"><div class="empty-icon"></div><p>No conversations yet.<br>Tap + to start.</p></div>`;
    return;
  }

  convList.innerHTML = '';
  conversations.forEach(conv => {
    const el = document.createElement('div');
    el.className = 'conv-item';
    el.dataset.username = conv.otherUser.username;
    const initial = conv.otherUser.displayName.charAt(0).toUpperCase();
    const time = conv.lastMessageTime ? formatTime(conv.lastMessageTime) : '';
    const preview = conv.lastMessage ? conv.lastMessage.substring(0, 40) : 'No messages yet';

    el.innerHTML = `
      <div class="conv-avatar">${initial}</div>
      <div class="conv-body">
        <div class="conv-row">
          <span class="conv-name">${esc(conv.otherUser.displayName)}</span>
          <span class="conv-time">${time}</span>
        </div>
        <p class="conv-preview">${esc(preview)}</p>
      </div>
      <span class="conv-arrow">›</span>
    `;

    el.addEventListener('click', () => openConversation(conv));
    convList.appendChild(el);
  });
}

function openConversation(conv) {
  currentConversationId = conv.id;
  currentOtherUser = conv.otherUser;

  chatName.textContent = conv.otherUser.displayName;
  messagesContainer.innerHTML = '';
  clearReply();
  closeActionsPanel();

  panelUsername.textContent = `@${conv.otherUser.username}`;

  showChat();

  messagesService.listenToMessages(conv.id, renderMessages);
  messagesService.listenToTyping(conv.id, conv.otherUser.uid, (typing) => {
    typingIndicator.style.display = typing ? 'block' : 'none';
    typingIndicator.textContent = typing ? `${conv.otherUser.displayName} is typing…` : '';
  });

  setTimeout(() => messageInput.focus(), 400);
}

backBtn.addEventListener('click', () => {
  messagesService.unsubscribeAll();
  currentConversationId = null;
  currentOtherUser = null;
  showList();
});

function renderMessages(messages) {
  const uid = authService.currentUser.uid;
  messagesContainer.innerHTML = '';
  let lastDate = null;

  messages.forEach(msg => {
    let ts = msg.timestamp ?? null;
    if (ts && typeof ts.toDate === 'function') ts = ts.toDate();
    else if (ts && !(ts instanceof Date)) ts = new Date(ts);
    if (ts && isNaN(ts.getTime())) ts = null;

    const msgDate = ts ? ts.toDateString() : null;
    if (msgDate && msgDate !== lastDate) {
      const sep = document.createElement('div');
      sep.className = 'date-sep';
      sep.textContent = formatDate(ts);
      messagesContainer.appendChild(sep);
      lastDate = msgDate;
    }

    const isSent = msg.sender === uid;
    const wrap = document.createElement('div');
    wrap.className = `msg-wrap ${isSent ? 'sent' : 'received'}`;

    const replyHTML = msg.replyTo ? `
      <div class="msg-reply">
        <div class="msg-reply__label">${esc(msg.replyTo.sender)}</div>
        <div class="msg-reply__text">${esc(msg.replyTo.text)}</div>
      </div>` : '';

    const time = ts ? ts.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '';

    wrap.innerHTML = `
      <div class="msg-bubble">${replyHTML}<div class="msg-text">${esc(msg.text)}</div></div>
      <span class="msg-time">${time}</span>
    `;

    wrap.querySelector('.msg-bubble').addEventListener('click', () => {
      setReply({ id: msg.id, sender: msg.senderData?.displayName || '', text: msg.text });
    });

    messagesContainer.appendChild(wrap);
  });

  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function setReply(data) {
  replyTo = data;
  replyBarText.textContent = data.text;
  replyBar.classList.add('visible');
  messageInput.focus();
}

function clearReply() {
  replyTo = null;
  replyBar.classList.remove('visible');
}

dismissReply.addEventListener('click', clearReply);

sendBtn.addEventListener('click', sendMessage);

messageInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});

messageInput.addEventListener('input', () => {
  sendBtn.disabled = !messageInput.value.trim();
  autoResize();
  handleTyping();
});

firstMessage.addEventListener('input', () => {
  startChatBtn.disabled = !firstMessage.value.trim();
});

function autoResize() {
  messageInput.style.height = 'auto';
  messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
}

async function sendMessage() {
  const text = messageInput.value.trim();
  if (!text || !currentConversationId) return;

  sendBtn.disabled = true;
  messageInput.value = '';
  autoResize();

  const reply = replyTo;
  clearReply();
  await messagesService.setTyping(currentConversationId, false);
  isTyping = false;

  await messagesService.sendMessage(currentConversationId, text, reply);
}

function handleTyping() {
  if (!currentConversationId) return;
  if (!isTyping) { isTyping = true; messagesService.setTyping(currentConversationId, true); }
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    isTyping = false;
    messagesService.setTyping(currentConversationId, false);
  }, 3000);
}

blockBtn.addEventListener('click', () => {
  if (actionsPanelOpen) {
    closeActionsPanel();
  } else {
    openActionsPanel();
  }
});

function openActionsPanel() {
  if (!currentOtherUser) return;
  actionsPanelOpen = true;
  actionsPanel.classList.add('open');
  blockBtn.textContent = 'Done';
  const blocked = authService.isUserBlocked(currentOtherUser.uid);
  blockUserBtn.textContent = blocked ? 'Unblock' : 'Block';
  blockUserBtn.classList.toggle('unblock', blocked);
}

function closeActionsPanel() {
  actionsPanelOpen = false;
  actionsPanel.classList.remove('open');
  blockBtn.textContent = 'Edit';
}

cancelActionsBtn.addEventListener('click', closeActionsPanel);

blockUserBtn.addEventListener('click', async () => {
  if (!currentOtherUser) return;
  const blocked = authService.isUserBlocked(currentOtherUser.uid);
  if (blocked) {
    const r = await authService.unblockUser(currentOtherUser.username);
    if (r.success) {
      blockUserBtn.textContent = 'Block';
      blockUserBtn.classList.remove('unblock');
      closeActionsPanel();
    }
  } else {
    const r = await authService.blockUser(currentOtherUser.username);
    if (r.success) {
      messagesService.unsubscribeAll();
      showList();
    }
  }
});

let editMode = false;
editBtn.addEventListener('click', () => {
  editMode = !editMode;
  editBtn.textContent = editMode ? 'Done' : 'Edit';
  logoutBtn.parentElement.style.display = editMode ? 'block' : 'none';
  if (editMode) {

    logoutBtn.textContent = 'Sign Out';
  }
});

searchInput.addEventListener('input', () => {
  const q = searchInput.value.toLowerCase();
  document.querySelectorAll('.conv-item').forEach(item => {
    const name = item.querySelector('.conv-name').textContent.toLowerCase();
    item.style.display = name.includes(q) ? '' : 'none';
  });
});

logoutBtn.addEventListener('click', async () => {
  if (confirm('Sign out of your account?')) {
    messagesService.unsubscribeAll();
    await authService.logout();
    window.location.href = 'login.html';
  }
});

composeBtn.addEventListener('click', () => {
  composeModal.classList.add('visible');
  setTimeout(() => newUsername.focus(), 300);
});

closeModalBtn.addEventListener('click', closeModal);

function closeModal() {
  composeModal.classList.remove('visible');
  newUsername.value = '';
  firstMessage.value = '';
  composeError.textContent = '';
  startChatBtn.disabled = true;
  startChatBtn.textContent = 'Send';
}

startChatBtn.addEventListener('click', async () => {
  const username = newUsername.value.trim().toLowerCase();
  const text = firstMessage.value.trim();

  if (!username) { composeError.textContent = 'Enter a username'; return; }
  if (!text) { composeError.textContent = 'Write a message first'; return; }

  startChatBtn.disabled = true;
  startChatBtn.textContent = 'Sending…';
  composeError.textContent = '';

  const result = await messagesService.createOrGetConversation(username);

  if (!result.success) {
    composeError.textContent = result.error || 'User not found';
    startChatBtn.disabled = false;
    startChatBtn.textContent = 'Send';
    return;
  }

  await messagesService.sendMessage(result.conversationId, text);
  closeModal();

  setTimeout(() => {
    const item = document.querySelector(`[data-username="${result.otherUser.username}"]`);
    if (item) item.click();
  }, 600);
});

/* ── Helpers ── */
function esc(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

function formatTime(raw) {
  if (!raw) return '';
  let date = raw;
  if (typeof date.toDate === 'function') date = date.toDate();
  else if (!(date instanceof Date)) date = new Date(date);
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (date.toDateString() === now.toDateString())
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  if (date.toDateString() === yesterday.toDateString())
    return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDate(raw) {
  if (!raw) return '';
  let date = raw;
  if (typeof date.toDate === 'function') date = date.toDate();
  else if (!(date instanceof Date)) date = new Date(date);
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  if (date.toDateString() === now.toDateString()) return 'Today';
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}