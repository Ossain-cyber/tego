const SUPABASE_URL = 'https://wepbechfempjhabhzbyk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndlcGJlY2hmZW1wamhhYmh6YnlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyMzc5NTksImV4cCI6MjEwMjgxMzk1OX0.msTHVjOeJBEdzr6vguP9fXiIHUxQbXHCG3X8M-hCl6c';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let currentProfile = null;
let currentChat = null;
let realtimeChannel = null;
let deferredInstallPrompt = null;

function generateTegoId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const part1 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  const part2 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `TEGO-${part1}-${part2}`;
}

function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const screen = document.getElementById(screenId);
  if (screen) screen.classList.add('active');
}

function showLoading() {
  document.getElementById('loading').style.display = 'flex';
}

function hideLoading() {
  document.getElementById('loading').style.display = 'none';
}

function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) {
    const div = document.createElement('div');
    div.id = 'toast';
    div.className = 'toast';
    document.body.appendChild(div);
  }
  const toastEl = document.getElementById('toast');
  toastEl.textContent = message;
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), 3000);
}

function showAuthError(message) {
  const errorEl = document.getElementById('auth-error');
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.classList.add('show');
  }
}

function getInitials(name) {
  if (!name) return '?';
  return name.charAt(0).toUpperCase();
}

function formatTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) return 'now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diff < 604800000) return date.toLocaleDateString([], { weekday: 'short' });
  return date.toLocaleDateString();
}

function renderAuth() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div id="auth-screen" class="screen auth-screen active">
      <div class="auth-container">
        <div class="auth-header">
          <div class="auth-logo">T</div>
          <h1>Tego</h1>
          <p>Simple. Fast. Private.</p>
        </div>
        <div class="auth-error" id="auth-error"></div>
        <div id="auth-forms">
          <div id="login-form">
            <div class="form-group">
              <label>Email</label>
              <input type="email" id="login-email" placeholder="you@example.com">
            </div>
            <div class="form-group">
              <label>Password</label>
              <input type="password" id="login-password" placeholder="Your password">
            </div>
            <button class="btn btn-primary" id="login-btn">Login</button>
            <div class="auth-link">
              Don't have an account? <a href="#" id="show-signup">Sign up</a>
            </div>
          </div>
          <div id="signup-form" style="display:none;">
            <div class="form-group">
              <label>Username</label>
              <input type="text" id="signup-username" placeholder="username">
            </div>
            <div class="form-group">
              <label>Email</label>
              <input type="email" id="signup-email" placeholder="you@example.com">
            </div>
            <div class="form-group">
              <label>Password</label>
              <input type="password" id="signup-password" placeholder="Create a password">
            </div>
            <div class="form-group">
              <label>Display Name</label>
              <input type="text" id="signup-display-name" placeholder="Your name">
            </div>
            <button class="btn btn-primary" id="signup-btn">Create Account</button>
            <div class="auth-link">
              Already have an account? <a href="#" id="show-login">Login</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  
  document.getElementById('show-signup').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('signup-form').style.display = 'block';
  });
  
  document.getElementById('show-login').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('signup-form').style.display = 'none';
    document.getElementById('login-form').style.display = 'block';
  });
  
  document.getElementById('login-btn').addEventListener('click', handleLogin);
  document.getElementById('signup-btn').addEventListener('click', handleSignup);
}

async function handleLogin() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  
  if (!email || !password) {
    showAuthError('Please enter email and password');
    return;
  }
  
  const btn = document.getElementById('login-btn');
  btn.disabled = true;
  btn.textContent = 'Logging in...';
  
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  
  if (error) {
    showAuthError(error.message);
    btn.disabled = false;
    btn.textContent = 'Login';
  }
}

async function handleSignup() {
  const username = document.getElementById('signup-username').value.trim().toLowerCase();
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;
  const displayName = document.getElementById('signup-display-name').value.trim();
  
  if (!username || !email || !password) {
    showAuthError('Please fill in all required fields');
    return;
  }
  
  if (username.length < 3) {
    showAuthError('Username must be at least 3 characters');
    return;
  }
  
  const btn = document.getElementById('signup-btn');
  btn.disabled = true;
  btn.textContent = 'Creating account...';
  
  const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
  
  if (authError) {
    showAuthError(authError.message);
    btn.disabled = false;
    btn.textContent = 'Create Account';
    return;
  }
  
  if (authData.user) {
    const tegoId = generateTegoId();
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        auth_id: authData.user.id,
        username,
        tego_id: tegoId,
        display_name: displayName || username
      });
    
    if (profileError) {
      showAuthError(profileError.message);
      btn.disabled = false;
      btn.textContent = 'Create Account';
    }
  }
}

function renderMainApp() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div id="install-banner" class="install-banner">
      <span>Install Tego</span>
      <button class="install-btn" id="install-btn">Install</button>
    </div>
    
    <div id="chats-screen" class="screen active">
      <div class="main-header">
        <h2>Tego</h2>
        <div class="header-avatar" id="header-avatar">
          <img src="${currentProfile?.avatar_url || ''}" alt="${currentProfile?.display_name || 'User'}" onerror="this.style.display='none';this.parentElement.textContent='${getInitials(currentProfile?.display_name)}'">
        </div>
      </div>
      <div class="chat-list" id="chat-list"></div>
    </div>
    
    <div id="contacts-screen" class="screen">
      <div class="main-header">
        <h2>Contacts</h2>
      </div>
      <div class="contacts-search">
        <input type="text" id="contact-search" placeholder="Search by username or Tego ID">
        <div class="search-results" id="search-results"></div>
      </div>
      <div class="contacts-list" id="contacts-list"></div>
    </div>
    
    <div id="profile-screen" class="screen">
      <div class="main-header">
        <h2>Profile</h2>
      </div>
      <div class="profile-screen">
        <div class="profile-header">
          <div class="profile-avatar" id="profile-avatar">
            <img src="${currentProfile?.avatar_url || ''}" alt="${currentProfile?.display_name || 'User'}" onerror="this.style.display='none';this.parentElement.textContent='${getInitials(currentProfile?.display_name)}'">
          </div>
          <div class="profile-name">${currentProfile?.display_name || 'User'}</div>
          <div class="profile-username">@${currentProfile?.username || 'username'}</div>
          <div class="profile-tego-id">${currentProfile?.tego_id || ''}</div>
        </div>
        <div class="profile-actions">
          <div class="profile-action" id="logout-btn">
            <span>🚪</span> Logout
          </div>
        </div>
        <div style="text-align:center;margin-top:32px;color:var(--text-secondary);font-size:12px;">
          Need help? Contact rabbibrandsend@gmail.com
        </div>
      </div>
    </div>
    
    <div id="chat-screen" class="screen">
      <div class="main-header">
        <button class="back-btn" id="back-btn">←</button>
        <div class="chat-header-info">
          <div class="chat-header-name" id="chat-header-name"></div>
          <div class="chat-header-status" id="chat-header-status"></div>
        </div>
      </div>
      <div class="chat-messages" id="chat-messages"></div>
      <div class="chat-input-container">
        <input type="text" class="chat-input" id="chat-input" placeholder="Type a message">
        <button class="send-btn" id="send-btn">➤</button>
      </div>
    </div>
    
    <div class="bottom-nav" id="bottom-nav">
      <div class="nav-item active" data-screen="chats-screen">
        <span>💬</span> Chats
      </div>
      <div class="nav-item" data-screen="contacts-screen">
        <span>👥</span> Contacts
      </div>
      <div class="nav-item" data-screen="profile-screen">
        <span>👤</span> Profile
      </div>
    </div>
  `;
  
  document.getElementById('header-avatar').addEventListener('click', () => showScreen('profile-screen'));
  document.getElementById('profile-avatar').addEventListener('click', () => showScreen('profile-screen'));
  document.getElementById('logout-btn').addEventListener('click', handleLogout);
  document.getElementById('back-btn').addEventListener('click', () => showScreen('chats-screen'));
  document.getElementById('send-btn').addEventListener('click', sendMessage);
  document.getElementById('chat-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
  });
  document.getElementById('contact-search').addEventListener('input', searchContacts);
  
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      showScreen(item.dataset.screen);
    });
  });
  
  loadChats();
  loadContacts();
  setupRealtime();
  setupInstallPrompt();
}

async function loadChats() {
  const chatList = document.getElementById('chat-list');
  if (!chatList) return;
  
  chatList.innerHTML = `
    <div class="chat-item" data-chat="saved">
      <div class="chat-avatar saved">📝</div>
      <div class="chat-info">
        <div class="chat-name">Saved Messages</div>
        <div class="chat-preview">Notes to yourself</div>
      </div>
    </div>
  `;
  
  const { data: messages, error } = await supabase
    .from('messages')
    .select('*')
    .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`)
    .order('created_at', { ascending: false })
    .limit(50);
  
  if (messages && messages.length > 0) {
    const chatMap = new Map();
    
    messages.forEach(msg => {
      const isSender = msg.sender_id === currentUser.id;
      const otherId = isSender ? msg.receiver_id : msg.sender_id;
      const otherTegoId = isSender ? msg.receiver_tego_id : msg.sender_tego_id;
      
      if (!chatMap.has(otherId)) {
        chatMap.set(otherId, {
          id: otherId,
          tegoId: otherTegoId,
          lastMessage: msg.message,
          timestamp: msg.created_at,
          status: msg.status
        });
      }
    });
    
    for (const [id, chat] of chatMap) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, username, tego_id, avatar_url')
        .eq('tego_id', chat.tegoId)
        .single();
      
      const chatItem = document.createElement('div');
      chatItem.className = 'chat-item';
      chatItem.dataset.chat = id;
      chatItem.innerHTML = `
        <div class="chat-avatar">${profile ? getInitials(profile.display_name) : '?'}</div>
        <div class="chat-info">
          <div class="chat-name">${profile?.display_name || chat.tegoId}</div>
          <div class="chat-preview">${chat.lastMessage || ''}</div>
        </div>
        <div class="chat-meta">
          <div class="chat-time">${formatTime(chat.timestamp)}</div>
          ${chat.status === 'sent' && currentUser.id === chat.id ? '<span class="chat-badge">✓</span>' : ''}
        </div>
      `;
      chatItem.addEventListener('click', () => openChat(id, profile));
      chatList.appendChild(chatItem);
    }
  }
  
  const savedItem = chatList.querySelector('[data-chat="saved"]');
  if (savedItem) {
    savedItem.addEventListener('click', () => openSavedMessages());
  }
}

async function loadContacts() {
  const contactsList = document.getElementById('contacts-list');
  if (!contactsList) return;
  
  const { data: contacts, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('owner_id', currentUser.id);
  
  if (contacts && contacts.length > 0) {
    contactsList.innerHTML = contacts.map(contact => `
      <div class="contact-item" data-tego-id="${contact.contact_tego_id}">
        <div class="chat-avatar">${getInitials(contact.nickname || contact.contact_username)}</div>
        <div class="contact-info">
          <div class="contact-name">${contact.nickname || contact.contact_username}</div>
          <div class="contact-username">${contact.contact_tego_id}</div>
        </div>
      </div>
    `).join('');
    
    contactsList.querySelectorAll('.contact-item').forEach(item => {
      item.addEventListener('click', () => {
        openChatByTegoId(item.dataset.tegoId);
      });
    });
  } else {
    contactsList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">👥</div>
        <h3>No contacts yet</h3>
        <p>Search for someone to start chatting</p>
      </div>
    `;
  }
}

async function searchContacts() {
  const query = document.getElementById('contact-search').value.trim();
  const resultsDiv = document.getElementById('search-results');
  
  if (query.length < 2) {
    resultsDiv.innerHTML = '';
    return;
  }
  
  const { data: results, error } = await supabase.rpc('search_profiles', { search: query });
  
  if (results && results.length > 0) {
    resultsDiv.innerHTML = results.map(profile => `
      <div class="search-result" data-tego-id="${profile.tego_id}">
        <div class="chat-avatar">${getInitials(profile.display_name || profile.username)}</div>
        <div class="contact-info">
          <div class="contact-name">${profile.display_name || profile.username}</div>
          <div class="contact-username">@${profile.username} · ${profile.tego_id}</div>
        </div>
        <button class="add-contact-btn" data-tego-id="${profile.tego_id}">Add</button>
      </div>
    `).join('');
    
    resultsDiv.querySelectorAll('.add-contact-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        await addContact(btn.dataset.tegoId, btn.dataset.username);
      });
    });
    
    resultsDiv.querySelectorAll('.search-result').forEach(item => {
      item.addEventListener('click', () => {
        openChatByTegoId(item.dataset.tegoId);
      });
    });
  } else {
    resultsDiv.innerHTML = '<div class="empty-state"><p>No results found</p></div>';
  }
}

async function addContact(tegoId, username) {
  const { error } = await supabase
    .from('contacts')
    .insert({
      owner_id: currentUser.id,
      contact_tego_id: tegoId,
      contact_username: username
    });
  
  if (error) {
    showToast('Failed to add contact');
  } else {
    showToast('Contact added');
    loadContacts();
  }
}

function openChat(otherId, profile) {
  currentChat = {
    id: otherId,
    profile
  };
  
  document.getElementById('chat-header-name').textContent = profile?.display_name || profile?.username || 'Chat';
  document.getElementById('chat-header-status').textContent = 'online';
  document.getElementById('chat-messages').innerHTML = '';
  showScreen('chat-screen');
  document.getElementById('bottom-nav').style.display = 'none';
  loadMessages(otherId);
}

function openSavedMessages() {
  currentChat = {
    id: currentUser.id,
    profile: {
      display_name: 'Saved Messages',
      username: 'saved',
      tego_id: currentProfile.tego_id
    },
    saved: true
  };
  
  document.getElementById('chat-header-name').textContent = 'Saved Messages';
  document.getElementById('chat-header-status').textContent = '';
  document.getElementById('chat-messages').innerHTML = '';
  showScreen('chat-screen');
  document.getElementById('bottom-nav').style.display = 'none';
  loadMessages(currentUser.id, true);
}

async function openChatByTegoId(tegoId) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('tego_id', tegoId)
    .single();
  
  if (profile) {
    openChat(profile.auth_id, profile);
  }
}

async function loadMessages(otherId, saved = false) {
  const messagesDiv = document.getElementById('chat-messages');
  
  let query = supabase
    .from('messages')
    .select('*');
  
  if (saved) {
    query = query.eq('sender_id', currentUser.id).eq('receiver_id', currentUser.id);
  } else {
    query = query.or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`)
      .or(`sender_id.eq.${otherId},receiver_id.eq.${otherId}`);
  }
  
  const { data: messages } = await query.order('created_at', { ascending: true });
  
  if (messages && messages.length > 0) {
    messagesDiv.innerHTML = messages.map(msg => {
      const isSent = msg.sender_id === currentUser.id;
      const statusIcon = msg.status === 'read' ? '✓✓' : msg.status === 'delivered' ? '✓✓' : '✓';
      
      return `
        <div class="message ${isSent ? 'sent' : 'received'}">
          <div>${msg.message || ''}</div>
          <div class="message-meta">
            ${formatTime(msg.created_at)}
            ${isSent ? statusIcon : ''}
          </div>
        </div>
      `;
    }).join('');
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }
}

async function sendMessage() {
  const input = document.getElementById('chat-input');
  const message = input.value.trim();
  
  if (!message || !currentChat) return;
  
  const isSaved = currentChat.saved;
  const receiverId = isSaved ? currentUser.id : currentChat.id;
  const receiverTegoId = isSaved ? currentProfile.tego_id : currentChat.profile.tego_id;
  
  const { error } = await supabase
    .from('messages')
    .insert({
      sender_id: currentUser.id,
      receiver_id: receiverId,
      sender_tego_id: currentProfile.tego_id,
      receiver_tego_id: receiverTegoId,
      message,
      status: 'sent'
    });
  
  if (!error) {
    input.value = '';
    loadMessages(currentChat.id, isSaved);
  }
}

function setupRealtime() {
  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel);
  }
  
  realtimeChannel = supabase
    .channel('tego-changes')
    .on('postgres_changes', 
      { event: '*', schema: 'public', table: 'messages', filter: `sender_id=eq.${currentUser.id}` },
      () => loadChats()
    )
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'messages', filter: `receiver_id=eq.${currentUser.id}` },
      () => {
        loadChats();
        if (currentChat && !currentChat.saved) {
          loadMessages(currentChat.id);
        }
      }
    )
    .subscribe();
}

function setupInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    document.getElementById('install-banner').classList.add('show');
  });
  
  document.getElementById('install-btn').addEventListener('click', async () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      document.getElementById('install-banner').classList.remove('show');
    }
  });
}

async function handleLogout() {
  await supabase.auth.signOut();
}

async function init() {
  showLoading();
  
  const { data: { session } } = await supabase.auth.getSession();
  
  if (session) {
    currentUser = session.user;
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('auth_id', currentUser.id)
      .single();
    
    if (profile) {
      currentProfile = profile;
      renderMainApp();
      hideLoading();
    } else {
      await supabase.auth.signOut();
      renderAuth();
      hideLoading();
    }
  } else {
    renderAuth();
    hideLoading();
  }
}

supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN' && session) {
    currentUser = session.user;
    supabase
      .from('profiles')
      .select('*')
      .eq('auth_id', currentUser.id)
      .single()
      .then(({ data: profile }) => {
        if (profile) {
          currentProfile = profile;
          renderMainApp();
        }
      });
  } else if (event === 'SIGNED_OUT') {
    currentUser = null;
    currentProfile = null;
    currentChat = null;
    renderAuth();
  }
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

init();
