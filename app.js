const SUPABASE_URL = 'https://wepbechfempjhabhzbyk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndlcGJlY2hmZW1wamhhYmh6YnlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyMzc5NTksImV4cCI6MjEwMjgxMzk1OX0.msTHVjOeJBEdzr6vguP9fXiIHUxQbXHCG3X8M-hCl6c';

let supabase;
let currentUser = null;
let currentProfile = null;
let currentChat = null;
let realtimeChannel = null;
let deferredInstallPrompt = null;

function generateTegoId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const part1 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  const part2 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return 'TEGO-' + part1 + '-' + part2;
}

function showScreen(screenId) {
  const screens = document.querySelectorAll('.screen');
  for (let i = 0; i < screens.length; i++) {
    screens[i].classList.remove('active');
  }
  const screen = document.getElementById(screenId);
  if (screen) screen.classList.add('active');
}

function showToast(message) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(function() {
    toast.classList.remove('show');
  }, 3000);
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
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm';
  if (diff < 86400000) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return date.toLocaleDateString();
}

function renderAuth() {
  document.getElementById('loading').style.display = 'none';
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
          Need an account? <a href="#" id="show-signup">Sign up</a>
        </div>
        <div id="signup-fields" style="display:none;">
          <div class="form-group" style="margin-top:16px;">
            <label>Username</label>
            <input type="text" id="signup-username" placeholder="username">
          </div>
          <div class="form-group">
            <label>Display Name</label>
            <input type="text" id="signup-display-name" placeholder="Your name">
          </div>
          <button class="btn btn-primary" id="signup-btn">Create Account</button>
        </div>
      </div>
    </div>
  `;
  
  document.getElementById('show-signup').addEventListener('click', function(e) {
    e.preventDefault();
    const signupFields = document.getElementById('signup-fields');
    if (signupFields.style.display === 'none') {
      signupFields.style.display = 'block';
    } else {
      signupFields.style.display = 'none';
    }
  });
  
  document.getElementById('login-btn').addEventListener('click', handleLogin);
  document.getElementById('signup-btn').addEventListener('click', handleSignup);
}

async function handleLogin() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errorEl = document.getElementById('auth-error');
  
  if (!email || !password) {
    errorEl.textContent = 'Please enter email and password';
    errorEl.classList.add('show');
    return;
  }
  
  const btn = document.getElementById('login-btn');
  btn.disabled = true;
  btn.textContent = 'Logging in...';
  
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email: email, password: password });
    if (error) {
      errorEl.textContent = error.message;
      errorEl.classList.add('show');
      btn.disabled = false;
      btn.textContent = 'Login';
    }
  } catch (err) {
    errorEl.textContent = 'Connection failed';
    errorEl.classList.add('show');
    btn.disabled = false;
    btn.textContent = 'Login';
  }
}

async function handleSignup() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const username = document.getElementById('signup-username').value.trim().toLowerCase();
  const displayName = document.getElementById('signup-display-name').value.trim();
  const errorEl = document.getElementById('auth-error');
  
  if (!email || !password || !username) {
    errorEl.textContent = 'Please fill in all fields';
    errorEl.classList.add('show');
    return;
  }
  
  const btn = document.getElementById('signup-btn');
  btn.disabled = true;
  btn.textContent = 'Creating...';
  
  try {
    const { data: authData, error: authError } = await supabase.auth.signUp({ email: email, password: password });
    
    if (authError) {
      errorEl.textContent = authError.message;
      errorEl.classList.add('show');
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
          username: username,
          tego_id: tegoId,
          display_name: displayName || username
        });
      
      if (profileError) {
        errorEl.textContent = profileError.message;
        errorEl.classList.add('show');
        btn.disabled = false;
        btn.textContent = 'Create Account';
      }
    }
  } catch (err) {
    errorEl.textContent = 'Connection failed';
    errorEl.classList.add('show');
    btn.disabled = false;
    btn.textContent = 'Create Account';
  }
}

function renderMainApp() {
  document.getElementById('loading').style.display = 'none';
  const app = document.getElementById('app');
  const displayName = currentProfile ? currentProfile.display_name : 'User';
  const username = currentProfile ? currentProfile.username : '';
  const tegoId = currentProfile ? currentProfile.tego_id : '';
  
  app.innerHTML = `
    <div id="install-banner" class="install-banner">
      <span>Install Tego</span>
      <button class="install-btn" id="install-btn">Install</button>
    </div>
    <div id="chats-screen" class="screen active">
      <div class="main-header">
        <h2>Tego</h2>
        <div class="header-avatar" id="header-avatar">${getInitials(displayName)}</div>
      </div>
      <div class="chat-list" id="chat-list"></div>
    </div>
    <div id="contacts-screen" class="screen">
      <div class="main-header">
        <h2>Contacts</h2>
      </div>
      <div class="contacts-search">
        <input type="text" id="contact-search" placeholder="Search username or Tego ID">
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
          <div class="profile-avatar">${getInitials(displayName)}</div>
          <div class="profile-name">${displayName}</div>
          <div class="profile-username">@${username}</div>
          <div class="profile-tego-id">${tegoId}</div>
        </div>
        <div class="profile-actions">
          <div class="profile-action" id="logout-btn">
            <span>🚪</span> Logout
          </div>
        </div>
        <div style="text-align:center;margin-top:32px;color:#6B7280;font-size:12px;">
          Contact: rabbibrandsend@gmail.com
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
    <div class="bottom-nav">
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
  
  document.getElementById('header-avatar').addEventListener('click', function() {
    const navItems = document.querySelectorAll('.nav-item');
    for (let i = 0; i < navItems.length; i++) navItems[i].classList.remove('active');
    navItems[2].classList.add('active');
    showScreen('profile-screen');
  });
  
  document.getElementById('logout-btn').addEventListener('click', handleLogout);
  
  document.getElementById('back-btn').addEventListener('click', function() {
    showScreen('chats-screen');
    const bottomNav = document.querySelector('.bottom-nav');
    if (bottomNav) bottomNav.style.display = 'flex';
  });
  
  document.getElementById('send-btn').addEventListener('click', sendMessage);
  document.getElementById('chat-input').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') sendMessage();
  });
  document.getElementById('contact-search').addEventListener('input', searchContacts);
  
  const navItems = document.querySelectorAll('.nav-item');
  for (let i = 0; i < navItems.length; i++) {
    navItems[i].addEventListener('click', function() {
      for (let j = 0; j < navItems.length; j++) navItems[j].classList.remove('active');
      navItems[i].classList.add('active');
      showScreen(navItems[i].getAttribute('data-screen'));
    });
  }
  
  loadChats();
  loadContacts();
  setupRealtime();
  setupInstallPrompt();
}

async function loadChats() {
  const chatList = document.getElementById('chat-list');
  if (!chatList) return;
  
  chatList.innerHTML = `
    <div class="chat-item" id="saved-chat">
      <div class="chat-avatar saved">📝</div>
      <div class="chat-info">
        <div class="chat-name">Saved Messages</div>
        <div class="chat-preview">Notes to yourself</div>
      </div>
    </div>
  `;
  
  document.getElementById('saved-chat').addEventListener('click', openSavedMessages);
  
  try {
    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .or('sender_id.eq.' + currentUser.id + ',receiver_id.eq.' + currentUser.id)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (messages && messages.length > 0) {
      const chatMap = {};
      
      for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        const isSender = msg.sender_id === currentUser.id;
        const otherId = isSender ? msg.receiver_id : msg.sender_id;
        const otherTegoId = isSender ? msg.receiver_tego_id : msg.sender_tego_id;
        
        if (otherId !== currentUser.id && !chatMap[otherId]) {
          chatMap[otherId] = {
            id: otherId,
            tegoId: otherTegoId,
            lastMessage: msg.message,
            timestamp: msg.created_at
          };
        }
      }
      
      const chatIds = Object.keys(chatMap);
      
      for (let i = 0; i < chatIds.length; i++) {
        const id = chatIds[i];
        const chat = chatMap[id];
        
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name, username, tego_id')
          .eq('tego_id', chat.tegoId)
          .single();
        
        const chatItem = document.createElement('div');
        chatItem.className = 'chat-item';
        chatItem.innerHTML = `
          <div class="chat-avatar">${profile ? getInitials(profile.display_name) : '?'}</div>
          <div class="chat-info">
            <div class="chat-name">${profile ? profile.display_name : chat.tegoId}</div>
            <div class="chat-preview">${chat.lastMessage || ''}</div>
          </div>
          <div class="chat-meta">
            <div class="chat-time">${formatTime(chat.timestamp)}</div>
          </div>
        `;
        
        (function(otherId, profileData) {
          chatItem.addEventListener('click', function() {
            openChat(otherId, profileData);
          });
        })(id, profile);
        
        chatList.appendChild(chatItem);
      }
    }
  } catch (err) {
    console.log('Chats error:', err);
  }
}

async function loadContacts() {
  const contactsList = document.getElementById('contacts-list');
  if (!contactsList) return;
  
  try {
    const { data: contacts, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('owner_id', currentUser.id);
    
    if (contacts && contacts.length > 0) {
      let html = '';
      for (let i = 0; i < contacts.length; i++) {
        const contact = contacts[i];
        html += `
          <div class="contact-item" data-tego-id="${contact.contact_tego_id}">
            <div class="chat-avatar">${getInitials(contact.nickname || contact.contact_username)}</div>
            <div class="contact-info">
              <div class="contact-name">${contact.nickname || contact.contact_username}</div>
              <div class="contact-username">${contact.contact_tego_id}</div>
            </div>
          </div>
        `;
      }
      contactsList.innerHTML = html;
      
      const items = contactsList.querySelectorAll('.contact-item');
      for (let i = 0; i < items.length; i++) {
        items[i].addEventListener('click', function() {
          openChatByTegoId(items[i].getAttribute('data-tego-id'));
        });
      }
    } else {
      contactsList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">👥</div>
          <h3>No contacts yet</h3>
          <p>Search for someone to start chatting</p>
        </div>
      `;
    }
  } catch (err) {
    console.log('Contacts error:', err);
  }
}

async function searchContacts() {
  const query = document.getElementById('contact-search').value.trim();
  const resultsDiv = document.getElementById('search-results');
  
  if (query.length < 2) {
    resultsDiv.innerHTML = '';
    return;
  }
  
  try {
    const { data: results, error } = await supabase.rpc('search_profiles', { search: query });
    
    if (results && results.length > 0) {
      let html = '';
      for (let i = 0; i < results.length; i++) {
        const profile = results[i];
        html += `
          <div class="search-result">
            <div class="chat-avatar">${getInitials(profile.display_name || profile.username)}</div>
            <div class="contact-info">
              <div class="contact-name">${profile.display_name || profile.username}</div>
              <div class="contact-username">@${profile.username} · ${profile.tego_id}</div>
            </div>
            <button class="add-contact-btn" data-tego-id="${profile.tego_id}" data-username="${profile.username}">Add</button>
          </div>
        `;
      }
      resultsDiv.innerHTML = html;
      
      const addButtons = resultsDiv.querySelectorAll('.add-contact-btn');
      for (let i = 0; i < addButtons.length; i++) {
        addButtons[i].addEventListener('click', function(e) {
          e.stopPropagation();
          addContact(addButtons[i].getAttribute('data-tego-id'), addButtons[i].getAttribute('data-username'));
        });
      }
    } else {
      resultsDiv.innerHTML = '<div class="empty-state"><p>No results found</p></div>';
    }
  } catch (err) {
    console.log('Search error:', err);
  }
}

async function addContact(tegoId, username) {
  try {
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
  } catch (err) {
    showToast('Failed to add contact');
  }
}

function openChat(otherId, profile) {
  currentChat = {
    id: otherId,
    profile: profile
  };
  
  document.getElementById('chat-header-name').textContent = profile && profile.display_name ? profile.display_name : 'Chat';
  document.getElementById('chat-header-status').textContent = 'online';
  document.getElementById('chat-messages').innerHTML = '';
  showScreen('chat-screen');
  const bottomNav = document.querySelector('.bottom-nav');
  if (bottomNav) bottomNav.style.display = 'none';
  loadMessages(otherId);
}

function openSavedMessages() {
  currentChat = {
    id: currentUser.id,
    profile: {
      display_name: 'Saved Messages',
      tego_id: currentProfile.tego_id
    },
    saved: true
  };
  
  document.getElementById('chat-header-name').textContent = 'Saved Messages';
  document.getElementById('chat-header-status').textContent = '';
  document.getElementById('chat-messages').innerHTML = '';
  showScreen('chat-screen');
  const bottomNav = document.querySelector('.bottom-nav');
  if (bottomNav) bottomNav.style.display = 'none';
  loadMessages(currentUser.id, true);
}

async function openChatByTegoId(tegoId) {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('tego_id', tegoId)
      .single();
    
    if (profile) {
      openChat(profile.auth_id, profile);
    }
  } catch (err) {
    showToast('Could not open chat');
  }
}

async function loadMessages(otherId, saved) {
  const messagesDiv = document.getElementById('chat-messages');
  if (!messagesDiv) return;
  
  try {
    let query = supabase.from('messages').select('*');
    
    if (saved) {
      query = query.eq('sender_id', currentUser.id).eq('receiver_id', currentUser.id);
    } else {
      query = query.or('and(sender_id.eq.' + currentUser.id + ',receiver_id.eq.' + otherId + '),and(sender_id.eq.' + otherId + ',receiver_id.eq.' + currentUser.id + ')');
    }
    
    const { data: messages } = await query.order('created_at', { ascending: true });
    
    if (messages && messages.length > 0) {
      let html = '';
      for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        const isSent = msg.sender_id === currentUser.id;
        const statusIcon = msg.status === 'read' ? '✓✓' : '✓';
        
        html += `
          <div class="message ${isSent ? 'sent' : 'received'}">
            <div>${msg.message || ''}</div>
            <div class="message-meta">
              ${formatTime(msg.created_at)}
              ${isSent ? statusIcon : ''}
            </div>
          </div>
        `;
      }
      messagesDiv.innerHTML = html;
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    } else {
      messagesDiv.innerHTML = '<div class="empty-state"><p>No messages yet</p></div>';
    }
  } catch (err) {
    console.log('Messages error:', err);
  }
}

async function sendMessage() {
  const input = document.getElementById('chat-input');
  const message = input.value.trim();
  
  if (!message || !currentChat) return;
  
  const isSaved = currentChat.saved;
  const receiverId = isSaved ? currentUser.id : currentChat.id;
  const receiverTegoId = isSaved ? currentProfile.tego_id : currentChat.profile.tego_id;
  
  try {
    const { error } = await supabase
      .from('messages')
      .insert({
        sender_id: currentUser.id,
        receiver_id: receiverId,
        sender_tego_id: currentProfile.tego_id,
        receiver_tego_id: receiverTegoId,
        message: message,
        status: 'sent'
      });
    
    if (!error) {
      input.value = '';
      loadMessages(currentChat.id, isSaved);
      loadChats();
    } else {
      showToast('Failed to send');
    }
  } catch (err) {
    showToast('Failed to send');
  }
}

function setupRealtime() {
  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel);
  }
  
  try {
    realtimeChannel = supabase
      .channel('tego-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'messages', filter: 'receiver_id=eq.' + currentUser.id },
        function() {
          loadChats();
          if (currentChat) {
            loadMessages(currentChat.id, currentChat.saved);
          }
        }
      )
      .subscribe();
  } catch (err) {
    console.log('Realtime error:', err);
  }
}

function setupInstallPrompt() {
  window.addEventListener('beforeinstallprompt', function(e) {
    e.preventDefault();
    deferredInstallPrompt = e;
    const banner = document.getElementById('install-banner');
    if (banner) banner.classList.add('show');
  });
  
  const installBtn = document.getElementById('install-btn');
  if (installBtn) {
    installBtn.addEventListener('click', async function() {
      if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        await deferredInstallPrompt.userChoice;
        deferredInstallPrompt = null;
        const banner = document.getElementById('install-banner');
        if (banner) banner.classList.remove('show');
      }
    });
  }
}

async function handleLogout() {
  await supabase.auth.signOut();
}

async function init() {
  try {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    const { data, error } = await supabase.auth.getSession();
    
    if (error) {
      renderAuth();
      return;
    }
    
    if (data && data.session) {
      currentUser = data.session.user;
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('auth_id', currentUser.id)
        .single();
      
      if (profile) {
        currentProfile = profile;
        renderMainApp();
      } else {
        await supabase.auth.signOut();
        renderAuth();
      }
    } else {
      renderAuth();
    }
  } catch (err) {
    renderAuth();
  }
}

supabase.auth.onAuthStateChange(function(event, session) {
  if (event === 'SIGNED_IN' && session) {
    currentUser = session.user;
    supabase
      .from('profiles')
      .select('*')
      .eq('auth_id', currentUser.id)
      .single()
      .then(function(result) {
        if (result.data) {
          currentProfile = result.data;
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
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('sw.js').catch(function() {});
  });
}

init();
