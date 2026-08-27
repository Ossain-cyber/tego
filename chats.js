// ============================================
// LOAD CHATS - FIXED VERSION
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
                // Get last message - FIXED: No continue on error
                let lastMessage = null;
                
                try {
                    const { data } = await APP.supabase
                        .from("messages")
                        .select("*")
                        .or(
                            `and(sender_tego_id.eq.${currentProfile.tego_id},receiver_tego_id.eq.${contact.contact_tego_id}),and(sender_tego_id.eq.${contact.contact_tego_id},receiver_tego_id.eq.${currentProfile.tego_id})`
                        )
                        .order("created_at", { ascending: false })
                        .limit(1);
                    
                    lastMessage = data?.[0] || null;
                } catch (e) {
                    console.log(
                        "No messages yet for",
                        contact.contact_tego_id
                    );
                    lastMessage = null;
                }

                // Get unread count - with proper error handling
                let unreadCount = 0;
                try {
                    const { count, error: countError } = 
                        await APP.supabase
                            .from("messages")
                            .select("*", { count: "exact", head: true })
                            .eq("sender_tego_id", contact.contact_tego_id)
                            .eq("receiver_tego_id", currentProfile.tego_id)
                            .neq("status", "read");

                    if (!countError) {
                        unreadCount = count || 0;
                    }
                } catch (e) {
                    console.log("Error counting unread for", contact.contact_tego_id);
                    unreadCount = 0;
                }

                conversations.push({
                    ...contact,
                    lastMessage,
                    unreadCount: unreadCount
                });

            } catch (error) {
                console.error("Error processing contact:", error);
                // Don't skip the contact - add it with default values
                conversations.push({
                    ...contact,
                    lastMessage: null,
                    unreadCount: 0
                });
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
// GET LAST MESSAGE TEXT - FIXED
// ============================================
function getLastMessageText(message) {
    if (!message) {
        return "Start chatting";  // Changed from "No messages yet"
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
