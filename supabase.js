const SUPABASE_URL = "https://wepbechfempjhabhzbyk.supabase.co";

const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndlcGJlY2hmZW1wamhhYmh6YnlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyMzc5NTksImV4cCI6MjEwMjgxMzk1OX0.msTHVjOeJBEdzr6vguP9fXiIHUxQbXHCG3X8M-hCl6c";

function createSupabase() {

if (!window.supabase) {  
    throw new Error("Supabase SDK not loaded");  
}  

return window.supabase.createClient(  
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

}

async function signUp(email, password) {

const supabase = APP.supabase;  

const { data, error } = await supabase.auth.signUp({  
    email,  
    password  
});  

if (error) throw error;  

return data;

}

async function signIn(email, password) {

const supabase = APP.supabase;  

const { data, error } = await supabase.auth.signInWithPassword({  
    email,  
    password  
});  

if (error) throw error;  

return data;

}

async function signOutUser() {

const { error } = await APP.supabase.auth.signOut();  

if (error) throw error;  

return true;

}

async function getCurrentUser() {

const {  
    data: { user }  
} = await APP.supabase.auth.getUser();  

return user;

}

async function getCurrentSession() {

const {  
    data: { session }  
} = await APP.supabase.auth.getSession();  

return session;

}

async function createProfile(payload) {

const { data, error } = await APP.supabase  
    .from("profiles")  
    .insert(payload)  
    .select()  
    .single();  

if (error) throw error;  

return data;

}

async function updateProfile(payload) {

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

const { data, error } = await APP.supabase  
    .from("profiles")  
    .select("*")  
    .eq("auth_id", APP.user.id)  
    .single();  

if (error) return null;  

return data;

}

async function searchProfiles(query) {

const { data, error } = await APP.supabase  
    .rpc("search_profiles", {  
        search: query  
    });  

if (error) throw error;  

return data || [];

}

async function addContact(contact) {

const { data, error } = await APP.supabase  
    .from("contacts")  
    .insert(contact)  
    .select()  
    .single();  

if (error) throw error;  

return data;

}

async function removeContact(id) {

const { error } = await APP.supabase  
    .from("contacts")  
    .delete()  
    .eq("id", id);  

if (error) throw error;  

return true;

}

async function getContacts() {

    const {
        data,
        error
    } = await APP.supabase
    .from("contacts")
    .select("*")
    .eq(
        "owner_id",
        APP.user.id
    )
    .order(
        "created_at",
        {
            ascending:false
        }
    );

    if (error) {

        console.error(error);

        throw error;

    }

    return data || [];

}

async function sendMessage(payload) {

const { data, error } = await APP.supabase  
    .from("messages")  
    .insert(payload)  
    .select()  
    .single();  

if (error) throw error;  

return data;

}

async function getMessages(senderId, receiverId) {

const { data, error } = await APP.supabase  
    .from("messages")  
    .select("*")  
    .or(  
        `and(sender_id.eq.${senderId},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${senderId})`  
    )  
    .order("created_at", {  
        ascending: true  
    });  

if (error) throw error;  

return data || [];

}

async function markMessagesRead(senderTegoId) {

const { error } = await APP.supabase  
    .rpc(  
        "mark_messages_read",  
        {  
            target_sender_tego_id: senderTegoId  
        }  
    );  

if (error) throw error;  

return true;

}

async function uploadAvatar(file) {

const fileName =  
    APP.user.id +  
    "-" +  
    Date.now() +  
    "-" +  
    file.name;  

const { error } = await APP.supabase.storage  
    .from("avatars")  
    .upload(  
        fileName,  
        file,  
        {  
            upsert: true  
        }  
    );  

if (error) throw error;  

const {  
    data  
} = APP.supabase.storage  
    .from("avatars")  
    .getPublicUrl(fileName);  

return data.publicUrl;

}

async function uploadMedia(file) {

const fileName =  
    APP.user.id +  
    "-" +  
    Date.now() +  
    "-" +  
    file.name;  

const { error } = await APP.supabase.storage  
    .from("chat-media")  
    .upload(  
        fileName,  
        file,  
        {  
            upsert: true  
        }  
    );  

if (error) throw error;  

const {  
    data  
} = APP.supabase.storage  
    .from("chat-media")  
    .getPublicUrl(fileName);  

return data.publicUrl;

}

function subscribeMessages(callback) {

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

return APP.supabase  
    .channel("contacts-channel")  
    .on(  
        "postgres_changes",  
        {  
            event: "*",  
            schema: "public",  
            table: "contacts"  
        },  
        callback  
    )  
    .subscribe();

}

function subscribeProfiles(callback) {

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

window.createSupabase = createSupabase;

window.signUp = signUp;
window.signIn = signIn;
window.signOutUser = signOutUser;

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

async function isUsernameAvailable(username) {

    const profile =
    await getMyProfile();

    let query =
    APP.supabase
    .from("profiles")
    .select("id")
    .ilike("username", username); // ✅ FIX 1: Case-insensitive search

    if (profile) {

        query =
        query.neq(
            "auth_id",
            APP.user.id
        );

    }

    const {
        data,
        error
    } = await query;

    if (error) throw error;

    return data.length === 0;
}

async function isTegoIdAvailable(tegoId) {

    const {
        data,
        error
    } = await APP.supabase
    .from("profiles")
    .select("id")
    .eq("tego_id", tegoId);

    if (error) throw error;

    return data.length === 0;
}

async function updateLastSeen() {

    if (!APP.user) return;

    const {
        error
    } = await APP.supabase
    .from("profiles")
    .update({
        last_seen:
        new Date()
        .toISOString(),
        updated_at:
        new Date()
        .toISOString()
    })
    .eq(
        "auth_id",
        APP.user.id
    );

    if (error) throw error;

    return true;
}

async function updateMessageStatus(
    messageId,
    status
) {

    const {
        error
    } = await APP.supabase
    .from("messages")
    .update({
        status
    })
    .eq(
        "id",
        messageId
    );

    if (error) throw error;

    return true;
}

async function editMessage(
    messageId,
    text
) {

    const {
        error
    } = await APP.supabase
    .from("messages")
    .update({
        message:text,
        edited_at:
        new Date()
        .toISOString()
    })
    .eq(
        "id",
        messageId
    );

    if (error) throw error;

    return true;
}

async function softDeleteMessage(
    messageId
) {

    const {
        error
    } = await APP.supabase
    .from("messages")
    .update({
        deleted_at:
        new Date()
        .toISOString()
    })
    .eq(
        "id",
        messageId
    );

    if (error) throw error;

    return true;
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

    const {
        data,
        error
    } = await APP.supabase
    .from("messages")
    .insert({

        sender_id:
        APP.user.id,

        receiver_id,

        sender_tego_id,

        receiver_tego_id,

        message:
        file_name,

        media_url,

        file_name,

        file_size,

        mime_type,

        message_type:
(mime_type || "").startsWith("image/")
? "image"
: (mime_type || "").startsWith("audio/")
? "audio"
: "file",
        status:
        "sent"

    })
    .select()
    .single();

    if (error) throw error;

    return data;
}

// ✅ FIX 3: Add alias for logout compatibility
window.logoutUser = signOutUser;

// ✅ FIX 4: Add helper function
async function getProfileByTegoId(tegoId) {
    const { data, error } = await APP.supabase
        .from("profiles")
        .select("*")
        .eq("tego_id", tegoId)
        .single();
    
    if (error) {
        return null;
    }
    return data;
}
async function deleteMessage(
messageId
){

const { error } =
await APP.supabase
.from("messages")
.delete()
.eq(
"id",
messageId
);

if(error){
throw error;
}

    }
window.deleteMessage =
deleteMessage;
window.isUsernameAvailable = isUsernameAvailable;
window.isTegoIdAvailable = isTegoIdAvailable;
window.updateLastSeen = updateLastSeen;
window.updateMessageStatus = updateMessageStatus;
window.editMessage = editMessage;
window.softDeleteMessage = softDeleteMessage;
window.sendMediaMessage = sendMediaMessage;
window.getProfileByTegoId = getProfileByTegoId; // ✅ Export the new helper
