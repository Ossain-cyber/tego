// Supabase Configuration
const SUPABASE_URL = "https://wepbechfempjhabhzbyk.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndlcGJlY2hmZW1wamhhYmh6YnlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyMzc5NTksImV4cCI6MjEwMjgxMzk1OX0.msTHVjOeJBEdzr6vguP9fXiIHUxQbXHCG3X8M-hCl6c";

// Initialize APP if it doesn't exist
if (typeof window.APP === 'undefined') {
    window.APP = {};
}

// Core initialization function
function createSupabase() {
    try {
        // Check if Supabase SDK is loaded
        if (typeof window.supabase === 'undefined' || !window.supabase.createClient) {
            console.error("Supabase SDK not loaded");
            return null;
        }

        // Create client with configuration
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

        // Store in APP
        window.APP.supabase = client;
        return client;

    } catch (error) {
        console.error("Failed to create Supabase client:", error);
        window.APP.supabase = null;
        return null;
    }
}

// Initialize Supabase if not already initialized
if (!window.APP.supabase) {
    window.APP.supabase = createSupabase();
}

// Helper function to ensure user is authenticated
function ensureAuthenticated() {
    if (!window.APP || !window.APP.user) {
        throw new Error("User not authenticated. Please log in.");
    }
    return true;
}

// Helper function to ensure Supabase is initialized
function ensureSupabase() {
    if (!window.APP || !window.APP.supabase) {
        throw new Error("Supabase not initialized. Please refresh.");
    }
    return window.APP.supabase;
}

// Authentication Functions
async function signUp(email, password) {
    try {
        // Validate inputs
        if (!email || typeof email !== 'string') {
            throw new Error("Email is required");
        }
        if (!password || typeof password !== 'string') {
            throw new Error("Password is required");
        }
        if (password.length < 6) {
            throw new Error("Password must be at least 6 characters");
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            throw new Error("Invalid email format");
        }

        const supabase = ensureSupabase();
        
        const { data, error } = await supabase.auth.signUp({
            email: email.trim(),
            password: password
        });

        if (error) throw error;
        return data;

    } catch (error) {
        console.error("Sign up failed:", error);
        throw error;
    }
}

async function signIn(email, password) {
    try {
        // Validate inputs
        if (!email || typeof email !== 'string') {
            throw new Error("Email is required");
        }
        if (!password || typeof password !== 'string') {
            throw new Error("Password is required");
        }

        const supabase = ensureSupabase();
        
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password: password
        });

        if (error) throw error;
        
        // Update APP state
        if (data && data.user) {
            window.APP.user = data.user;
            window.APP.session = data.session;
        }
        
        return data;

    } catch (error) {
        console.error("Sign in failed:", error);
        throw error;
    }
}

async function signOutUser() {
    try {
        const supabase = ensureSupabase();
        
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        
        // Clear APP state
        window.APP.user = null;
        window.APP.session = null;
        window.APP.profile = null;
        
        return true;

    } catch (error) {
        console.error("Sign out failed:", error);
        throw error;
    }
}

// User Management Functions
async function getCurrentUser() {
    try {
        const supabase = ensureSupabase();
        
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) throw error;
        
        if (user) {
            window.APP.user = user;
        }
        
        return user;

    } catch (error) {
        console.error("Get current user failed:", error);
        return null;
    }
}

async function getCurrentSession() {
    try {
        const supabase = ensureSupabase();
        
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        
        if (session) {
            window.APP.session = session;
        }
        
        return session;

    } catch (error) {
        console.error("Get current session failed:", error);
        return null;
    }
}

// Profile Functions
async function createProfile(payload) {
    try {
        // Validate payload
        if (!payload || typeof payload !== 'object') {
            throw new Error("Profile data is required");
        }
        if (!payload.auth_id) {
            throw new Error("auth_id is required");
        }

        const supabase = ensureSupabase();
        
        const { data, error } = await supabase
            .from("profiles")
            .insert(payload)
            .select()
            .single();

        if (error) throw error;
        
        if (data) {
            window.APP.profile = data;
        }
        
        return data;

    } catch (error) {
        console.error("Create profile failed:", error);
        throw error;
    }
}

async function updateProfile(payload) {
    try {
        // Validate
        if (!payload || typeof payload !== 'object') {
            throw new Error("Profile data is required");
        }
        ensureAuthenticated();
        
        const supabase = ensureSupabase();
        
        const { data, error } = await supabase
            .from("profiles")
            .update(payload)
            .eq("auth_id", window.APP.user.id)
            .select()
            .single();

        if (error) throw error;
        
        if (data) {
            window.APP.profile = data;
        }
        
        return data;

    } catch (error) {
        console.error("Update profile failed:", error);
        throw error;
    }
}

async function getMyProfile() {
    try {
        ensureAuthenticated();
        
        const supabase = ensureSupabase();
        
        const { data, error } = await supabase
            .from("profiles")
            .select("*")
            .eq("auth_id", window.APP.user.id)
            .single();

        if (error) {
            // If no profile found, return null (not an error)
            if (error.code === "PGRST116") {
                return null;
            }
            throw error;
        }
        
        if (data) {
            window.APP.profile = data;
        }
        
        return data;

    } catch (error) {
        console.error("Get profile failed:", error);
        return null;
    }
}

// Search Functions
async function searchProfiles(query) {
    try {
        if (!query || typeof query !== 'string' || query.trim().length < 2) {
            return [];
        }

        const supabase = ensureSupabase();
        
        const { data, error } = await supabase
            .rpc("search_profiles", {
                search: query.trim()
            });

        if (error) throw error;
        return data || [];

    } catch (error) {
        console.error("Search profiles failed:", error);
        return [];
    }
}

// Contact Functions
async function addContact(contact) {
    try {
        // Validate
        if (!contact || typeof contact !== 'object') {
            throw new Error("Contact data is required");
        }
        ensureAuthenticated();

        const supabase = ensureSupabase();
        
        const { data, error } = await supabase
            .from("contacts")
            .insert(contact)
            .select()
            .single();

        if (error) throw error;
        return data;

    } catch (error) {
        console.error("Add contact failed:", error);
        throw error;
    }
}

async function removeContact(id) {
    try {
        if (!id) {
            throw new Error("Contact ID is required");
        }
        
        const supabase = ensureSupabase();
        
        const { error } = await supabase
            .from("contacts")
            .delete()
            .eq("id", id);

        if (error) throw error;
        return true;

    } catch (error) {
        console.error("Remove contact failed:", error);
        throw error;
    }
}

async function getContacts() {
    try {
        ensureAuthenticated();
        
        const supabase = ensureSupabase();
        
        const { data, error } = await supabase
            .from("contacts")
            .select("*")
            .eq("owner_id", window.APP.user.id)
            .order("created_at", { ascending: false });

        if (error) throw error;
        return data || [];

    } catch (error) {
        console.error("Get contacts failed:", error);
        throw error;
    }
}

// Message Functions
async function sendMessage(payload) {
    try {
        // Validate
        if (!payload || typeof payload !== 'object') {
            throw new Error("Message data is required");
        }
        if (!payload.receiver_id) {
            throw new Error("receiver_id is required");
        }
        if (!payload.message && !payload.media_url) {
            throw new Error("Message or media is required");
        }

        const supabase = ensureSupabase();
        
        const { data, error } = await supabase
            .from("messages")
            .insert(payload)
            .select()
            .single();

        if (error) throw error;
        return data;

    } catch (error) {
        console.error("Send message failed:", error);
        throw error;
    }
}

async function getMessages(senderId, receiverId) {
    try {
        if (!senderId || !receiverId) {
            throw new Error("Sender ID and Receiver ID are required");
        }

        const supabase = ensureSupabase();
        
        const { data, error } = await supabase
            .from("messages")
            .select("*")
            .or(
                `and(sender_id.eq.${senderId},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${senderId})`
            )
            .order("created_at", { ascending: true });

        if (error) throw error;
        return data || [];

    } catch (error) {
        console.error("Get messages failed:", error);
        throw error;
    }
}

async function markMessagesRead(senderTegoId) {
    try {
        if (!senderTegoId) {
            throw new Error("Sender Tego ID is required");
        }

        const supabase = ensureSupabase();
        
        const { error } = await supabase
            .rpc("mark_messages_read", {
                target_sender_tego_id: senderTegoId
            });

        if (error) throw error;
        return true;

    } catch (error) {
        console.error("Mark messages read failed:", error);
        throw error;
    }
}

// Media Upload Functions
async function uploadAvatar(file) {
    try {
        if (!file || !(file instanceof File)) {
            throw new Error("Valid file is required");
        }
        ensureAuthenticated();

        // Validate file type
        if (!file.type.startsWith("image/")) {
            throw new Error("File must be an image");
        }
        
        // Validate file size (5MB limit)
        if (file.size > 5 * 1024 * 1024) {
            throw new Error("File must be less than 5MB");
        }

        const supabase = ensureSupabase();
        
        const fileName = `${window.APP.user.id}-${Date.now()}-${file.name}`;
        
        const { error } = await supabase.storage
            .from("avatars")
            .upload(fileName, file, { upsert: true });

        if (error) throw error;

        const { data } = supabase.storage
            .from("avatars")
            .getPublicUrl(fileName);

        return data.publicUrl;

    } catch (error) {
        console.error("Upload avatar failed:", error);
        throw error;
    }
}

async function uploadMedia(file) {
    try {
        if (!file || !(file instanceof File)) {
            throw new Error("Valid file is required");
        }
        ensureAuthenticated();

        // Validate file size (10MB limit)
        if (file.size > 10 * 1024 * 1024) {
            throw new Error("File must be less than 10MB");
        }

        const supabase = ensureSupabase();
        
        const fileName = `${window.APP.user.id}-${Date.now()}-${file.name}`;
        
        const { error } = await supabase.storage
            .from("chat-media")
            .upload(fileName, file, { upsert: true });

        if (error) throw error;

        const { data } = supabase.storage
            .from("chat-media")
            .getPublicUrl(fileName);

        return data.publicUrl;

    } catch (error) {
        console.error("Upload media failed:", error);
        throw error;
    }
}

// Subscription Functions
function subscribeMessages(callback) {
    try {
        if (typeof callback !== 'function') {
            throw new Error("Callback must be a function");
        }

        const supabase = ensureSupabase();
        
        return supabase
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

    } catch (error) {
        console.error("Subscribe messages failed:", error);
        throw error;
    }
}

function subscribeContacts(callback) {
    try {
        if (typeof callback !== 'function') {
            throw new Error("Callback must be a function");
        }
        ensureAuthenticated();

        const supabase = ensureSupabase();
        
        return supabase
            .channel(`contacts-${window.APP.user.id}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "contacts",
                    filter: `owner_id=eq.${window.APP.user.id}`
                },
                callback
            )
            .subscribe();

    } catch (error) {
        console.error("Subscribe contacts failed:", error);
        throw error;
    }
}

function subscribeProfiles(callback) {
    try {
        if (typeof callback !== 'function') {
            throw new Error("Callback must be a function");
        }

        const supabase = ensureSupabase();
        
        return supabase
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

    } catch (error) {
        console.error("Subscribe profiles failed:", error);
        throw error;
    }
}

// Utility Functions
async function isUsernameAvailable(username) {
    try {
        if (!username || typeof username !== 'string' || username.trim().length < 2) {
            return false;
        }

        const supabase = ensureSupabase();
        username = username.trim().toLowerCase();

        let query = supabase
            .from("profiles")
            .select("id")
            .ilike("username", username);

        // If user is logged in, exclude their own profile
        if (window.APP && window.APP.user && window.APP.user.id) {
            query = query.neq("auth_id", window.APP.user.id);
        }

        const { data, error } = await query;
        if (error) throw error;

        return data.length === 0;

    } catch (error) {
        console.error("Check username availability failed:", error);
        return false;
    }
}

async function isTegoIdAvailable(tegoId) {
    try {
        if (!tegoId || typeof tegoId !== 'string' || tegoId.trim().length < 3) {
            return false;
        }

        const supabase = ensureSupabase();
        
        const { data, error } = await supabase
            .from("profiles")
            .select("id")
            .eq("tego_id", tegoId.trim());

        if (error) throw error;
        return data.length === 0;

    } catch (error) {
        console.error("Check Tego ID availability failed:", error);
        return false;
    }
}

async function updateLastSeen() {
    try {
        ensureAuthenticated();
        
        const supabase = ensureSupabase();
        
        const { error } = await supabase
            .from("profiles")
            .update({
                last_seen: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq("auth_id", window.APP.user.id);

        if (error) throw error;
        return true;

    } catch (error) {
        console.error("Update last seen failed:", error);
        return false;
    }
}

async function updateMessageStatus(messageId, status) {
    try {
        if (!messageId || !status) {
            throw new Error("Message ID and status are required");
        }

        const supabase = ensureSupabase();
        
        const { error } = await supabase
            .from("messages")
            .update({ status })
            .eq("id", messageId);

        if (error) throw error;
        return true;

    } catch (error) {
        console.error("Update message status failed:", error);
        throw error;
    }
}

async function editMessage(messageId, text) {
    try {
        if (!messageId) {
            throw new Error("Message ID is required");
        }
        if (!text || typeof text !== 'string' || text.trim().length === 0) {
            throw new Error("Message text is required");
        }

        const supabase = ensureSupabase();
        
        const { error } = await supabase
            .from("messages")
            .update({
                message: text.trim(),
                edited_at: new Date().toISOString()
            })
            .eq("id", messageId);

        if (error) throw error;
        return true;

    } catch (error) {
        console.error("Edit message failed:", error);
        throw error;
    }
}

async function softDeleteMessage(messageId) {
    try {
        if (!messageId) {
            throw new Error("Message ID is required");
        }

        const supabase = ensureSupabase();
        
        const { error } = await supabase
            .from("messages")
            .update({ deleted_at: new Date().toISOString() })
            .eq("id", messageId);

        if (error) throw error;
        return true;

    } catch (error) {
        console.error("Soft delete message failed:", error);
        throw error;
    }
}

async function deleteMessage(messageId) {
    try {
        if (!messageId) {
            throw new Error("Message ID is required");
        }

        const supabase = ensureSupabase();
        
        const { error } = await supabase
            .from("messages")
            .delete()
            .eq("id", messageId);

        if (error) throw error;
        return true;

    } catch (error) {
        console.error("Delete message failed:", error);
        throw error;
    }
}

async function sendMediaMessage({
    receiver_id,
    sender_tego_id,
    receiver_tego_id,
    media_url,
    file_name,
    file_size,
    mime_type
}) {
    try {
        // Validate required fields
        if (!receiver_id || !sender_tego_id || !receiver_tego_id || !media_url) {
            throw new Error("Missing required fields for media message");
        }
        ensureAuthenticated();

        const supabase = ensureSupabase();
        
        // Determine message type
        let messageType = "file";
        if (mime_type) {
            if (mime_type.startsWith("image/")) messageType = "image";
            else if (mime_type.startsWith("audio/")) messageType = "audio";
            else if (mime_type.startsWith("video/")) messageType = "video";
        }

        const payload = {
            sender_id: window.APP.user.id,
            receiver_id,
            sender_tego_id,
            receiver_tego_id,
            message: file_name || "Media",
            media_url,
            file_name: file_name || null,
            file_size: file_size || null,
            mime_type: mime_type || null,
            message_type: messageType,
            status: "sent"
        };

        const { data, error } = await supabase
            .from("messages")
            .insert(payload)
            .select()
            .single();

        if (error) throw error;
        return data;

    } catch (error) {
        console.error("Send media message failed:", error);
        throw error;
    }
}

async function getProfileByTegoId(tegoId) {
    try {
        if (!tegoId || typeof tegoId !== 'string') {
            return null;
        }

        const supabase = ensureSupabase();
        
        const { data, error } = await supabase
            .from("profiles")
            .select("*")
            .eq("tego_id", tegoId.trim())
            .single();

        if (error) {
            if (error.code === "PGRST116") {
                return null;
            }
            throw error;
        }
        return data;

    } catch (error) {
        console.error("Get profile by Tego ID failed:", error);
        return null;
    }
}

// Initialize user on page load
async function initAuth() {
    try {
        const supabase = ensureSupabase();
        
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) throw error;
        
        if (user) {
            window.APP.user = user;
        }
        
        return user;

    } catch (error) {
        console.warn("No active session:", error);
        window.APP.user = null;
        return null;
    }
}



// Export to global scope - check if window exists first
if (typeof window !== 'undefined') {
    // Core
    window.APP = window.APP || {};
    window.createSupabase = createSupabase;
    window.initAuth = initAuth;
    
    // Auth
    window.signUp = signUp;
    window.signIn = signIn;
    
    window.logoutUser = signOutUser; // Alias
    window.getCurrentUser = getCurrentUser;
    window.getCurrentSession = getCurrentSession;
    
    // Profile
    window.createProfile = createProfile;
    window.updateProfile = updateProfile;
    window.getMyProfile = getMyProfile;
    window.searchProfiles = searchProfiles;
    
    // Contacts
    window.addContact = addContact;
    window.removeContact = removeContact;
    window.getContacts = getContacts;
    
    // Messages
    window.sendMessage = sendMessage;
    window.getMessages = getMessages;
    window.markMessagesRead = markMessagesRead;
    window.sendMediaMessage = sendMediaMessage;
    window.editMessage = editMessage;
    window.softDeleteMessage = softDeleteMessage;
    window.deleteMessage = deleteMessage;
    window.updateMessageStatus = updateMessageStatus;
    
    // Media
    window.uploadAvatar = uploadAvatar;
    window.uploadMedia = uploadMedia;
    
    // Subscriptions
    window.subscribeMessages = subscribeMessages;
    window.subscribeContacts = subscribeContacts;
    window.subscribeProfiles = subscribeProfiles;
    
    // Utilities
    window.isUsernameAvailable = isUsernameAvailable;
    window.isTegoIdAvailable = isTegoIdAvailable;
    window.updateLastSeen = updateLastSeen;
    window.getProfileByTegoId = getProfileByTegoId;
}

console.log("Supabase API module loaded successfully");
