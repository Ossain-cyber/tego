// ============================================
// STATE
// ============================================
let chatItems = [];
let currentProfile = null;
let chatUpdateTimeout = null;

// ============================================
// DOM CACHE
// ============================================
const getElement = (id) => document.getElementById(id);
const elements = {};

function cacheElements() {
    elements.chatSearch = getElement("chat-search");
    elements.chatList = getElement("chat-list");
}

// ============================================
// INITIALIZATION
// ============================================
async function initChatsPage() {
    try {
        cacheElements();

        const authenticated = await requireAuth();
        if (!authenticated) {
            return;
        }

        currentProfile = await getMyProfile();
        if (!currentProfile) {
            window.location.href = "profile.html";
            return;
        }

        bindChatsEvents();

        // Load chats immediately
        await loadChats();

        // Subscribe to both messages AND contacts changes
        subscribeMessages(async () => {
            await loadChats();
        });

        // Also subscribe to contact changes
        if (typeof subscribeContacts === 'function') {
            subscribeContacts(async () => {
                await loadChats();
            });
        }

        // Listen for visibility change to refresh when user returns to tab
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Listen for storage changes (in case contacts are updated in another tab)
        window.addEventListener('storage', handleStorageChange);

    } catch (error) {
        console.error("Chats initialization error:", error);
        showToast("Failed to initialize chats");
    }
}

// ============================================
// EVENT BINDING
// ============================================
function bindChatsEvents() {
    if (elements.chatSearch) {
        elements.chatSearch.addEventListener(
            "input",
            searchChats
        );
    }
}

// ============================================
// VISIBILITY & STORAGE HANDLERS
// ============================================
function handleVisibilityChange() {
    if (!document.hidden) {
        // Refresh when user comes back to the tab
        loadChats();
    }
}

function handleStorageChange(event) {
    if (event.key === 'contacts_updated' || event.key === 'new_contact_added') {
        loadChats();
    }
}

// ============================================
// LOAD CHATS
// ============================================
async function loadChats() {
    // Show loading state
    if (elements.chatList) {
        elements.chatList.innerHTML = `
            <div class="card">
                <div class="subtext" style="text-align:center;padding:20px;">
                    Loading chats...
                </div>
            </div>
        `;
    }

    try {
        const contacts = await getContacts();
        
        if (!contacts || contacts.length === 0) {
            renderChats([]);
            return;
        }

        const conversations = [];

        // Process each contact to get their last message and unread count
        for (const contact of contacts) {
            try {
                // Get last message
                const { data: lastMessageData, error: lastMsgError } = 
                    await APP.supabase
                        .from("messages")
                        .select("*")
                        .or(
                            `and(sender_tego_id.eq.${currentProfile.tego_id},receiver_tego_id.eq.${contact.contact_tego_id}),and(sender_tego_id.eq.${contact.contact_tego_id},receiver_tego_id.eq.${currentProfile.tego_id})`
                        )
                        .order("created_at", { ascending: false })
                        .limit(1);

                if (lastMsgError) {
                    console.error("Error fetching last message:", lastMsgError);
                    continue;
                }

                const lastMessage = lastMessageData?.[0] || null;

                // Get unread count
                const { count, error: countError } = 
                    await APP.supabase
                        .from("messages")
                        .select("*", { count: "exact", head: true })
                        .eq("sender_tego_id", contact.contact_tego_id)
                        .eq("receiver_tego_id", currentProfile.tego_id)
                        .neq("status", "read");

                if (countError) {
                    console.error("Error counting unread:", countError);
                }

                conversations.push({
                    ...contact,
                    lastMessage,
                    unreadCount: count || 0
                });

            } catch (error) {
                console.error("Error processing contact:", error);
                // Continue with next contact
                continue;
            }
        }

        // Sort conversations by last message time
        conversations.sort((a, b) => {
            const aTime = a.lastMessage?.created_at || "";
            const bTime = b.lastMessage?.created_at || "";
            return new Date(bTime) - new Date(aTime);
        });

        chatItems = conversations;
        renderChats(conversations);

        // Store the current chat list in session storage for cross-tab updates
        try {
            sessionStorage.setItem('chat_items_updated', Date.now().toString());
        } catch (e) {
            // Ignore storage errors
        }

    } catch (error) {
        console.error("Load chats error:", error);
        showToast("Unable to load chats");
        
        if (elements.chatList) {
            elements.chatList.innerHTML = `
                <div class="card" style="border-color:#e74c3c;">
                    <div class="subtext" style="text-align:center;padding:20px;color:#e74c3c;">
                        Failed to load chats
                        <br>
                        <button class="btn" style="margin-top:10px;" onclick="loadChats()">
                            Retry
                        </button>
                    </div>
                </div>
            `;
        }
    }
}

// ============================================
// RENDER CHATS
// ============================================
function renderChats(items) {
    if (!elements.chatList) {
        return;
    }

    elements.chatList.innerHTML = "";

    if (!items || items.length === 0) {
        elements.chatList.innerHTML = `
            <div class="card">
                <div style="text-align:center;padding:40px 20px;">
                    <div style="font-size:48px;margin-bottom:16px;">💬</div>
                    <div style="font-weight:500;margin-bottom:8px;">No chats yet</div>
                    <div class="subtext">
                        Go to Contacts to add friends and start chatting
                    </div>
                    <button class="btn" style="margin-top:16px;" onclick="window.location.href='contacts.html'">
                        Go to Contacts
                    </button>
                </div>
            </div>
        `;
        return;
    }

    const fragment = document.createDocumentFragment();

    items.forEach(chat => {
        const card = createChatCard(chat);
        fragment.appendChild(card);
    });

    elements.chatList.appendChild(fragment);
}

// ============================================
// CREATE CHAT CARD
// ============================================
function createChatCard(chat) {
    const card = document.createElement("div");
    card.className = "card";
    card.setAttribute("role", "listitem");

    const lastText = getLastMessageText(chat.lastMessage);
    const lastTime = chat.lastMessage 
        ? formatTime(chat.lastMessage.created_at) 
        : "";
    
    const displayName = chat.nickname || chat.contact_username || "Unknown";
    const avatarUrl = chat.avatar_url || "icon-192.png";

    // Highlight if there are unread messages
    if (chat.unreadCount > 0) {
        card.style.borderLeft = "3px solid #4CAF50";
    }

    card.innerHTML = `
        <div class="list-item">
            <img 
                class="avatar" 
                src="${avatarUrl}"
                alt="${displayName}'s avatar"
                loading="lazy"
                onerror="this.src='icon-192.png'"
            >
            <div class="info">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
                    <div class="name">${displayName}</div>
                    <div class="subtext">${lastTime}</div>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
                    <div class="subtext" style="${chat.unreadCount > 0 ? 'font-weight:500;' : ''}">
                        ${lastText}
                    </div>
                    ${chat.unreadCount > 0 ? `
                        <div class="badge" style="
                            background:#4CAF50;
                            color:white;
                            border-radius:50%;
                            padding:2px 8px;
                            font-size:12px;
                            font-weight:bold;
                            min-width:20px;
                            text-align:center;
                        ">
                            ${chat.unreadCount}
                        </div>
                    ` : ""}
                </div>
            </div>
        </div>
    `;

    card.addEventListener("click", () => {
        saveActiveChat(chat);
        window.location.href = "chat.html";
    });

    return card;
}

// ============================================
// GET LAST MESSAGE TEXT
// ============================================
function getLastMessageText(message) {
    if (!message) {
        return "No messages yet";
    }

    if (message.deleted_at) {
        return "Message deleted";
    }

    if (message.message_type === "image") {
        return "📷 Photo";
    }

    if (message.message_type === "file") {
        return "📎 File";
    }

    return message.message || "Message";
}

// ============================================
// SEARCH CHATS
// ============================================
function searchChats() {
    if (!elements.chatSearch) {
        return;
    }

    const query = elements.chatSearch.value.trim().toLowerCase();

    if (!query) {
        renderChats(chatItems);
        return;
    }

    const filtered = chatItems.filter(chat => {
        const name = (chat.nickname || chat.contact_username || "").toLowerCase();
        return name.includes(query);
    });

    renderChats(filtered);
}

// ============================================
// FORCE REFRESH (for external calls)
// ============================================
function refreshChats() {
    loadChats();
}

// ============================================
// CLEANUP
// ============================================
function cleanup() {
    if (chatUpdateTimeout) {
        clearTimeout(chatUpdateTimeout);
        chatUpdateTimeout = null;
    }
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('storage', handleStorageChange);
}

// ============================================
// EXPOSE FOR GLOBAL ACCESS
// ============================================
window.initChatsPage = initChatsPage;
window.loadChats = loadChats;
window.refreshChats = refreshChats;

// Run cleanup when page unloads
window.addEventListener("beforeunload", cleanup);

// ============================================
// TOAST NOTIFICATION (if not already defined)
// ============================================
if (typeof showToast === 'undefined') {
    window.showToast = function(message) {
        console.log("Toast:", message);
        alert(message);
    };
}

// ============================================
// FORMAT TIME HELPER (if not already defined)
// ============================================
if (typeof formatTime === 'undefined') {
    window.formatTime = function(timestamp) {
        if (!timestamp) return '';
        
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return Math.floor(diff / 60000) + 'm';
        if (diff < 86400000) return Math.floor(diff / 3600000) + 'h';
        if (diff < 604800000) return Math.floor(diff / 86400000) + 'd';
        
        return date.toLocaleDateString();
    };
}

// ============================================
// SAVE ACTIVE CHAT HELPER (if not already defined)
// ============================================
if (typeof saveActiveChat === 'undefined') {
    window.saveActiveChat = function(chat) {
        try {
            localStorage.setItem('active_chat', JSON.stringify(chat));
            sessionStorage.setItem('active_chat', JSON.stringify(chat));
        } catch (error) {
            console.error("Error saving active chat:", error);
        }
    };
}
