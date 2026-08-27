// Configuration
const SUPABASE_URL = "https://wepbechfempjhabhzbyk.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndlcGJlY2hmZW1wamhhYmh6YnlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyMzc5NTksImV4cCI6MjEwMjgxMzk1OX0.msTHVjOeJBEdzr6vguP9fXiIHUxQbXHCG3X8M-hCl6c";

// Initialize APP object if it doesn't exist
window.APP = window.APP || {};

// Core initialization
function createSupabase() {
    if (!window.supabase) {
        throw new Error("Supabase SDK not loaded. Please include the Supabase JS library.");
    }
    
    const client = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_ANON_KEY,
        {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true
            },
            realtime: {
                params: {
                    eventsPerSecond: 20
                }
            }
        }
    );
    
    // Store in APP for global access
    APP.supabase = client;
    return client;
}

// Initialize supabase
APP.supabase = APP.supabase || createSupabase();

// Helper function to validate email
function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Helper function to validate password
function validatePassword(password) {
    return password && password.length >= 6;
}

// Authentication Functions
async function signUp(email, password) {
    if (!validateEmail(email)) {
        throw new Error("Invalid email format");
    }
    if (!validatePassword(password)) {
        throw new Error("Password must be at least 6 characters");
    }
    
    const { data, error } = await APP.supabase.auth.signUp({
        email,
        password
    });
    
    if (error) throw error;
    return data;
}

async function signIn(email, password) {
    if (!validateEmail(email)) {
        throw new Error("Invalid email format");
    }
    if (!password) {
        throw new Error("Password is required");
    }
    
    const { data, error } = await APP.supabase.auth.signInWithPassword({
        email,
        password
    });
    
    if (error) throw error;
    
    // Update user in APP
    APP.user = data.user;
    return data;
}

async function signOutUser() {
    const { error } = await APP.supabase.auth.signOut();
    if (error) throw error;
    
    // Clear user from APP
    APP.user = null;
    return true;
}

// User Management
async function getCurrentUser() {
    const { data: { user }, error } = await APP.supabase.auth.getUser();
    if (error) throw error;
    
    APP.user = user;
    return user;
}

async function getCurrentSession() {
    const { data: { session }, error } = await APP.supabase.auth.getSession();
    if (error) throw error;
    return session;
}

// Profile Functions
async function createProfile(payload) {
    if (!payload || !payload.auth_id) {
        throw new Error("Profile must include auth_id");
    }
    
    const { data, error } = await APP.supabase
        .from("profiles")
        .insert(payload)
        .select()
        .single();
    
    if (error) throw error;
    return data;
}

async function updateProfile(payload) {
    if (!APP.user || !APP.user.id) {
        throw new Error("User not authenticated");
    }
    
    const { data, error } = await APP.supabase
        .from("profiles")
        .update(payload)
        .eq("auth_id", APP.user.id)
        .select()
        .single();
    
    if (error) throw error;
    return data;
}

async function getMyProfile() {
    if (!APP.user || !APP.user.id) {
        throw new Error("User not authenticated");
    }
    
    const { data, error } = await APP.supabase
        .from("profiles")
        .select("*")
        .eq("auth_id", APP.user.id)
        .single();
    
    if (error) {
        console.warn("Profile not found:", error);
        return null;
    }
    return data;
}

async function searchProfiles(query) {
    if (!query || query.trim().length < 2) {
        return [];
    }
    
    const { data, error } = await APP.supabase
        .rpc("search_profiles", {
            search: query.trim()
        });
    
    if (error) throw error;
    return data || [];
}

// Contacts Functions
async function addContact(contact) {
    if (!contact || !contact.contact_id) {
        throw new Error("Contact must include contact_id");
    }
    
    const { data, error } = await APP.supabase
        .from("contacts")
        .insert(contact)
        .select()
        .single();
    
    if (error) throw error;
    console.log("Contact inserted:", data);
    return data;
}

async function removeContact(id) {
    if (!id) {
        throw new Error("Contact ID is required");
    }
    
    const { error } = await APP.supabase
        .from("contacts")
        .delete()
        .eq("id", id);
    
    if (error) throw error;
    return true;
}

async function getContacts() {
    if (!APP.user || !APP.user.id) {
        throw new Error("User not authenticated");
    }
    
    const { data, error } = await APP.supabase
        .from("contacts")
        .select("*")
        .eq("owner_id", APP.user.id)
        .order("created_at", { ascending: false });
    
    if (error) {
        console.error("Error fetching contacts:", error);
        throw error;
    }
    
    console.log("Current user:", APP.user.id);
    console.log("Contacts fetched:", data);
    return data || [];
}

// Message Functions
async function sendMessage(payload) {
    if (!payload || !payload.receiver_id || !payload.message) {
        throw new Error("Message must include receiver_id and message");
    }
    
    const { data, error } = await APP.supabase
        .from("messages")
        .insert(payload)
        .select()
        .single();
    
    if (error) throw error;
    return data;
}

async function getMessages(senderId, receiverId) {
    if (!senderId || !receiverId) {
        throw new Error("Sender ID and Receiver ID are required");
    }
    
    const { data, error } = await APP.supabase
        .from("messages")
        .select("*")
        .or(
            `and(sender_id.eq.${senderId},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${senderId})`
        )
        .order("created_at", { ascending: true });
    
    if (error) throw error;
    return data || [];
}

async function markMessagesRead(senderTegoId) {
    if (!senderTegoId) {
        throw new Error("Sender tego ID is required");
    }
    
    const { error } = await APP.supabase
        .rpc("mark_messages_read", {
            target_sender_tego_id: senderTegoId
        });
    
    if (error) throw error;
    return true;
}

// Media Upload Functions
async function uploadAvatar(file) {
    if (!file || !file.name) {
        throw new Error("File is required");
    }
    
    if (!APP.user || !APP.user.id) {
        throw new Error("User not authenticated");
    }
    
    const fileName = `${APP.user.id}-${Date.now()}-${file.name}`;
    
    const { error } = await APP.supabase.storage
        .from("avatars")
        .upload(fileName, file, { upsert: true });
    
    if (error) throw error;
    
    const { data } = APP.supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);
    
    return data.publicUrl;
}

async function uploadMedia(file) {
    if (!file || !file.name) {
        throw new Error("File is required");
    }
    
    if (!APP.user || !APP.user.id) {
        throw new Error("User not authenticated");
    }
    
    const fileName = `${APP.user.id}-${Date.now()}-${file.name}`;
    
    const { error } = await APP.supabase.storage
        .from("chat-media")
        .upload(fileName, file, { upsert: true });
    
    if (error) throw error;
    
    const { data } = APP.supabase.storage
        .from("chat-media")
        .getPublicUrl(fileName);
    
    return data.publicUrl;
}

// Subscription Functions
function subscribeMessages(callback) {
    if (typeof callback !== 'function') {
        throw new Error("Callback must be a function");
    }
    
    return APP.supabase
        .channel("messages-channel")
        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "messages"
            },
            callback
        )
        .subscribe();
}

function subscribeContacts(callback) {
    if (typeof callback !== 'function') {
        throw new Error("Callback must be a function");
    }
    
    if (!APP.user || !APP.user.id) {
        throw new Error("User not authenticated");
    }
    
    return APP.supabase
        .channel(`contacts-${APP.user.id}`)
        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "contacts",
                filter: `owner_id=eq.${APP.user.id}`
            },
            callback
        )
        .subscribe();
}

function subscribeProfiles(callback) {
    if (typeof callback !== 'function') {
        throw new Error("Callback must be a function");
    }
    
    return APP.supabase
        .channel("profiles-channel")
        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "profiles"
            },
            callback
        )
        .subscribe();
}

// Utility Functions
async function isUsernameAvailable(username) {
    if (!username || username.trim().length < 2) {
        throw new Error("Username must be at least 2 characters");
    }
    
    const profile = await getMyProfile();
    let query = APP.supabase
        .from("profiles")
        .select("id")
        .ilike("username", username.trim());
    
    if (profile) {
        query = query.neq("auth_id", APP.user.id);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    
    return data.length === 0;
}

async function isTegoIdAvailable(tegoId) {
    if (!tegoId || tegoId.trim().length < 3) {
        throw new Error("Tego ID must be at least 3 characters");
    }
    
    const { data, error } = await APP.supabase
        .from("profiles")
        .select("id")
        .eq("tego_id", tegoId.trim());
    
    if (error) throw error;
    return data.length === 0;
}

async function updateLastSeen() {
    if (!APP.user || !APP.user.id) {
        console.warn("User not authenticated, skipping last_seen update");
        return false;
    }
    
    const { error } = await APP.supabase
        .from("profiles")
        .update({
            last_seen: new Date().toISOString(),
            updated_at: new Date().toISOString()
        })
        .eq("auth_id", APP.user.id);
    
    if (error) throw error;
    return true;
}

async function updateMessageStatus(messageId, status) {
    if (!messageId) {
        throw new Error("Message ID is required");
    }
    if (!status) {
        throw new Error("Status is required");
    }
    
    const { error } = await APP.supabase
        .from("messages")
        .update({ status })
        .eq("id", messageId);
    
    if (error) throw error;
    return true;
}

async function editMessage(messageId, text) {
    if (!messageId) {
        throw new Error("Message ID is required");
    }
    if (!text || text.trim().length === 0) {
        throw new Error("Message text is required");
    }
    
    const { error } = await APP.supabase
        .from("messages")
        .update({
            message: text.trim(),
            edited_at: new Date().toISOString()
        })
        .eq("id", messageId);
    
    if (error) throw error;
    return true;
}

// Soft delete message (hide from user)
async function softDeleteMessage(messageId) {
    if (!messageId) {
        throw new Error("Message ID is required");
    }
    
    const { error } = await APP.supabase
        .from("messages")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", messageId);
    
    if (error) throw error;
    return true;
}

// Hard delete message (permanent removal)
async function deleteMessage(messageId) {
    if (!messageId) {
        throw new Error("Message ID is required");
    }
    
    const { error } = await APP.supabase
        .from("messages")
        .delete()
        .eq("id", messageId);
    
    if (error) throw error;
    return true;
}

// Send media message
async function sendMediaMessage({
    receiver_id,
    sender_tego_id,
    receiver_tego_id,
    media_url,
    file_name,
    file_size,
    mime_type
}) {
    if (!receiver_id || !sender_tego_id || !receiver_tego_id || !media_url) {
        throw new Error("Missing required fields for media message");
    }
    
    const messageType = (mime_type || "").startsWith("image/") ? "image" :
                       (mime_type || "").startsWith("audio/") ? "audio" : "file";
    
    const { data, error } = await APP.supabase
        .from("messages")
        .insert({
            sender_id: APP.user.id,
            receiver_id,
            sender_tego_id,
            receiver_tego_id,
            message: file_name || "Media",
            media_url,
            file_name,
            file_size,
            mime_type,
            message_type: messageType,
            status: "sent"
        })
        .select()
        .single();
    
    if (error) throw error;
    return data;
}

// Get profile by tego ID
async function getProfileByTegoId(tegoId) {
    if (!tegoId) {
        throw new Error("Tego ID is required");
    }
    
    const { data, error } = await APP.supabase
        .from("profiles")
        .select("*")
        .eq("tego_id", tegoId)
        .single();
    
    if (error) {
        console.warn("Profile not found for tego ID:", tegoId);
        return null;
    }
    return data;
}

// Initialize user on page load
async function initAuth() {
    try {
        const user = await getCurrentUser();
        APP.user = user;
        return user;
    } catch (error) {
        console.warn("No active session:", error);
        APP.user = null;
        return null;
    }
}

// Auto-initialize when script loads
initAuth().catch(console.warn);

// Export functions to global scope
window.APP = APP;
window.createSupabase = createSupabase;
window.signUp = signUp;
window.signIn = signIn;
window.signOutUser = signOutUser;
window.logoutUser = signOutUser; // Alias for compatibility
window.getCurrentUser = getCurrentUser;
window.getCurrentSession = getCurrentSession;
window.createProfile = createProfile;
window.updateProfile = updateProfile;
window.getMyProfile = getMyProfile;
window.searchProfiles = searchProfiles;
window.addContact = addContact;
window.removeContact = removeContact;
window.getContacts = getContacts;
window.sendMessage = sendMessage;
window.getMessages = getMessages;
window.markMessagesRead = markMessagesRead;
window.uploadAvatar = uploadAvatar;
window.uploadMedia = uploadMedia;
window.subscribeMessages = subscribeMessages;
window.subscribeContacts = subscribeContacts;
window.subscribeProfiles = subscribeProfiles;
window.isUsernameAvailable = isUsernameAvailable;
window.isTegoIdAvailable = isTegoIdAvailable;
window.updateLastSeen = updateLastSeen;
window.updateMessageStatus = updateMessageStatus;
window.editMessage = editMessage;
window.softDeleteMessage = softDeleteMessage;
window.deleteMessage = deleteMessage;
window.sendMediaMessage = sendMediaMessage;
window.getProfileByTegoId = getProfileByTegoId;
window.initAuth = initAuth;

console.log("📦 Supabase API initialized successfully");
