// ============================================
// STATE
// ============================================
let chatItems = [];
let currentProfile = null;
let chatUpdateTimeout = null;
let isFirstLoad = true;

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
        isFirstLoad = false;

        // Subscribe to messages
        if (typeof subscribeMessages === 'function') {
            subscribeMessages(async () => {
                console.log("Messages changed, refreshing chats...");
                await loadChats();
            });
        }

        // Subscribe to contacts changes
        if (typeof subscribeContacts === 'function') {
            console.log("Subscribing to contacts changes...");
            subscribeContacts(async () => {
                console.log("Contacts changed, refreshing chats...");
                await loadChats();
            });
        }

        // Listen for visibility change
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Listen for storage changes
        window.addEventListener('storage', handleStorageChange);

        // Check for contact updates from other tabs
        checkForContactUpdates();

        // Periodic refresh every 30 seconds (to catch any missed updates)
        setInterval(() => {
            if (!document.hidden) {
                loadChats();
            }
        }, 30000);

        console.log("Chats page initialized successfully");

    } catch (error) {
        console.error("Chats initialization error:", error);
        showToast("Failed to initialize chats");
    }
}

// ============================================
// CHECK FOR CONTACT UPDATES
// ============================================
function checkForContactUpdates() {
    try {
        const lastUpdate = localStorage.getItem('contacts_last_updated');
        const currentTime = Date.now();
        
        if (lastUpdate) {
            const timeDiff = currentTime - parseInt(lastUpdate);
            if (timeDiff < 5000) {
                // Contacts were updated recently, refresh
                console.log("Recent contact update detected, refreshing...");
                setTimeout(() => loadChats(), 500);
            }
        }
    } catch (error) {
        console.error("Error checking for contact updates:", error);
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
        console.log("Tab became visible, refreshing chats...");
        loadChats();
    }
}

function handleStorageChange(event) {
    console.log("Storage changed:", event.key);
    
    if (event.key === 'contacts_last_updated' || 
        event.key === 'new_contact_added' ||
        event.key === 'contact_removed') {
        console.log("Contact change detected in another tab, refreshing...");
        loadChats();
    }
}

// ============================================
// LOAD CHATS
// ============================================
async function loadChats() {
    // Store current search query if any
    const currentSearch = elements.chatSearch?.value?.trim()?.toLowerCase() || '';

    // Show loading state (only if not searching)
    if (elements.chatList && !currentSearch) {
        elements.chatList.innerHTML = `
            <div class="card">
                <div class="subtext" style="text-align:center;padding:20px;">
                    Loading chats...
                </div>
            </div>
        `;
    }

    try {
        console.log("Loading contacts...");
        const contacts = await getContacts();
        console.log("Contacts loaded:", contacts?.length || 0);
        
        if (!contacts || contacts.length === 0) {
            console.log("No contacts found");
            chatItems = [];
            renderChats([]);
            return;
        }

        const conversations = [];

        // Process each contact
        for (const contact of contacts) {
            try {
                // Get last message
                let lastMessage = null;

                try {
                    const { data } =
                    await APP.supabase
                        .from("messages")
                        .select("*")
                        .or(
                            `and(sender_tego_id.eq.${currentProfile.tego_id},receiver_tego_id.eq.${contact.contact_tego_id}),and(sender_tego_id.eq.${contact.contact_tego_id},receiver_tego_id.eq.${currentProfile.tego_id})`
                        )
                        .order("created_at", {
                            ascending: false
                        })
                        .limit(1);

                    lastMessage = data?.[0] || null;

                } catch (e) {
                    console.log(
                        "No messages yet for",
                        contact.contact_tego_id
                    );
                    lastMessage = null;
                }

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
                continue;
            }
        }

        // Sort by last message time
        conversations.sort((a, b) => {
            const aTime = a.lastMessage?.created_at || "";
            const bTime = b.lastMessage?.created_at || "";
            return new Date(bTime) - new Date(aTime);
        });

        chatItems = conversations;
        console.log("Chat items updated:", chatItems.length);

        // Render based on search filter
        if (currentSearch) {
            const filtered = filterChatsBySearch(currentSearch);
            renderChats(filtered);
        } else {
            renderChats(conversations);
        }

        // Store update time
        try {
            localStorage.setItem('chats_last_updated', Date.now().toString());
        } catch (e) {
            // Ignore
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
// FILTER CHATS BY SEARCH
// ============================================
function filterChatsBySearch(query) {
    if (!query) return chatItems;
    
    return chatItems.filter(chat => {
        const name = (chat.nickname || chat.contact_username || "").toLowerCase();
        return name.includes(query);
    });
}

// ============================================
// RENDER CHATS
// ============================================
function renderChats(items) {
    if (!elements.chatList) {
        console.error("Chat list element not found");
        return;
    }

    elements.chatList.innerHTML = "";

    if (!items || items.length === 0) {
        // Check if it's because there are no contacts or just no messages
        if (chatItems.length === 0) {
            elements.chatList.innerHTML = `
                <div class="card">
                    <div style="text-align:center;padding:40px 20px;">
                        <div style="font-size:48px;margin-bottom:16px;">👥</div>
                        <div style="font-weight:500;margin-bottom:8px;">No contacts yet</div>
                        <div class="subtext">
                            Add friends from the Contacts page to start chatting
                        </div>
                        <button class="btn" style="margin-top:16px;" onclick="window.location.href='contacts.html'">
                            Go to Contacts
                        </button>
                    </div>
                </div>
            `;
        } else {
            elements.chatList.innerHTML = `
                <div class="card">
                    <div style="text-align:center;padding:40px 20px;">
                        <div style="font-size:48px;margin-bottom:16px;">💬</div>
                        <div style="font-weight:500;margin-bottom:8px;">No chats yet</div>
                        <div class="subtext">
                            Start a conversation with your contacts
                        </div>
                    </div>
                </div>
            `;
        }
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

    // Highlight if there are unread messages
    if (chat.unreadCount > 0) {
        card.style.borderLeft = "3px solid #4CAF50";
    }

    // Always use the contact's ID to ensure uniqueness
    const contactId = chat.contact_tego_id || chat.id || 'unknown';
    card.dataset.contactId = contactId;

    card.innerHTML = `
        <div class="list-item">
            <img 
                class="avatar" 
                src="icon-192.png"
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
        return "Start chatting";
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

    const filtered = filterChatsBySearch(query);
    renderChats(filtered);
}

// ============================================
// FORCE REFRESH
// ============================================
function refreshChats() {
    console.log("Manual refresh triggered");
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
