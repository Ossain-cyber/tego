let replyingTo = null;
let activeChat = null;
let currentProfile = null;
let messagesChannel = null;
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;

async function compressImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => {
            const img = new Image();
            img.onload = () => {
                let width = img.width;
                let height = img.height;
                const MAX = 1280;
                
                if (width > MAX || height > MAX) {
                    if (width > height) {
                        height = height * (MAX / width);
                        width = MAX;
                    } else {
                        width = width * (MAX / height);
                        height = MAX;
                    }
                }
                
                const canvas = document.createElement("canvas");
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob(
                    blob => {
                        resolve(new File([blob], file.name, {
                            type: "image/jpeg"
                        }));
                    },
                    "image/jpeg",
                    0.7
                );
            };
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

async function initChatPage() {
    const authenticated = await requireAuth();
    if (!authenticated) {
        return;
    }

    activeChat = getActiveChat();
    if (!activeChat) {
        window.location.href = "chats.html";
        return;
    }

    currentProfile = await getMyProfile();
    if (!currentProfile) {
        window.location.href = "profile.html";
        return;
    }

    setupChatHeader();
    bindChatEvents();
    
    const recordBtn = document.getElementById("record-btn");
    if (recordBtn) {
        recordBtn.addEventListener("click", toggleRecording);
    }

    await loadConversation();
    subscribeRealtimeMessages();
}

function setupChatHeader() {
    const avatar = document.getElementById("chat-avatar");
    if (avatar && activeChat.avatar_url) {
        avatar.src = activeChat.avatar_url;
    }
    
    const name = document.getElementById("chat-name");
    if (name) {
        name.textContent = activeChat.nickname || activeChat.contact_username || "Chat";
    }
}

function bindChatEvents() {
    const cancelReply = document.getElementById("cancel-reply");
    if (cancelReply) {
        cancelReply.addEventListener("click", () => {
            replyingTo = null;
            document.getElementById("reply-preview").classList.add("hidden");
        });
    }

    const sendBtn = document.getElementById("send-btn");
    if (sendBtn) {
        sendBtn.addEventListener("click", sendTextMessage);
    }

    const input = document.getElementById("message-input");
    if (input) {
        input.addEventListener("keydown", event => {
            if (event.key === "Enter") {
                event.preventDefault();
                sendTextMessage();
            }
        });
    }

    const mediaBtn = document.getElementById("media-btn");
    if (mediaBtn) {
        mediaBtn.addEventListener("click", () => {
            document.getElementById("media-input").click();
        });
    }

    const mediaInput = document.getElementById("media-input");
    if (mediaInput) {
        mediaInput.addEventListener("change", uploadAndSendMedia);
    }
}

async function loadConversation() {
    try {
        const { data, error } = await APP.supabase
            .from("messages")
            .select("*")
            .or(
                `and(sender_id.eq.${APP.user.id},receiver_id.eq.${activeChat.contact_auth_id}),and(sender_id.eq.${activeChat.contact_auth_id},receiver_id.eq.${APP.user.id})`
            )
            .order("created_at", { ascending: true });

        if (error) {
            throw error;
        }

        renderMessages(data || []);
        await markMessagesRead(activeChat.contact_tego_id);
    } catch {
        showToast("Unable to load messages");
    }
}

function renderMessages(messages) {
    const container = document.getElementById("messages");
    if (!container) {
        return;
    }
    
    container.innerHTML = "";
    
    if (messages.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                No messages yet
            </div>
        `;
        return;
    }
    
    messages.forEach(message => {
        const mine = message.sender_id === APP.user.id;
        const item = document.createElement("div");
        item.className = mine ? "message me" : "message other";
        
        let body = "";
        
        if (message.deleted_at) {
            body = `
                <i>Message deleted</i>
            `;
        } else if (message.mime_type === "audio/webm") {
            body = `
                <audio controls src="${message.media_url}">
                </audio>
            `;
        } else if (message.message_type === "image") {
            body = `
                <img src="${message.media_url}" class="chat-image" loading="lazy">
            `;
        } else if (message.message_type === "file") {
            body = `
                <a href="${message.media_url}" target="_blank" class="file-link">
                    ${message.file_name || "Download File"}
                </a>
            `;
        } else {
            body = escapeHtml(message.message || "");
        }
        
        item.innerHTML = `
            ${message.reply_text ? `
                <div class="reply-bubble">
                    ${escapeHtml(message.reply_text)}
                </div>
            ` : ""}
            <div class="message-body">
                ${body}
            </div>
            <div class="message-footer">
                <div class="message-time">
                    ${formatTime(message.created_at)}
                </div>
                ${mine ? `
                    <div class="message-status">
                        ${getStatusIcon(message.status)}
                    </div>
                ` : ""}
            </div>
            <button class="reply-btn" data-id="${message.id}">
                Reply
            </button>
            ${mine ? `
                <button class="delete-message-btn" data-id="${message.id}">
                    Delete
                </button>
            ` : ""}
        `;
        
        container.appendChild(item);
        
        const replyBtn = item.querySelector(".reply-btn");
        if (replyBtn) {
            replyBtn.addEventListener("click", () => {
                replyingTo = message;
                document.getElementById("reply-preview").classList.remove("hidden");
                document.getElementById("reply-text").textContent = message.message || message.file_name || "Media";
            });
        }
        
        const deleteBtn = item.querySelector(".delete-message-btn");
        if (deleteBtn) {
            deleteBtn.addEventListener("click", async () => {
                await deleteMessage(message.id);
            });
        }
    });
    
    scrollMessagesToBottom();
}

function getStatusIcon(status) {
    if (status === "read") {
        return "✓✓";
    }
    if (status === "delivered") {
        return "✓✓";
    }
    return "✓";
}

async function sendTextMessage() {
    const input = document.getElementById("message-input");
    const text = input.value.trim();
    
    if (!text) {
        return;
    }
    
    try {
        input.value = "";
        
        await sendMessage({
            sender_id: APP.user.id,
            receiver_id: activeChat.contact_auth_id,
            sender_tego_id: currentProfile.tego_id,
            receiver_tego_id: activeChat.contact_tego_id,
            message: text,
            message_type: "text",
            reply_to_id: replyingTo?.id || null,
            reply_text: replyingTo?.message || null,
            status: "delivered"
        });
        
        replyingTo = null;
        document.getElementById("reply-preview").classList.add("hidden");
        await loadConversation();
    } catch {
        showToast("Message failed");
    }
}

async function uploadAndSendMedia(event) {
    let file = event.target.files[0];
    
    if (file.type.startsWith("image/")) {
        file = await compressImage(file);
    }
    
    const MAX_FILE_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
        showToast("Maximum file size is 5MB");
        event.target.value = "";
        return;
    }

    if (!file) {
        return;
    }

    try {
        const url = await uploadMedia(file);
        const type = file.type.startsWith("image/") ? "image" : "file";

        await sendMediaMessage({
            receiver_id: activeChat.contact_auth_id,
            sender_tego_id: currentProfile.tego_id,
            receiver_tego_id: activeChat.contact_tego_id,
            media_url: url,
            file_name: file.name,
            file_size: file.size,
            mime_type: file.type
        });
        
        await loadConversation();
        event.target.value = "";
    } catch {
        showToast("Upload failed");
    }
}

function subscribeRealtimeMessages() {
    messagesChannel = subscribeMessages(async payload => {
        const row = payload.new;
        if (!row) {
            return;
        }

        const isCurrentChat = 
            (row.sender_id === APP.user.id && row.receiver_id === activeChat.contact_auth_id) ||
            (row.sender_id === activeChat.contact_auth_id && row.receiver_id === APP.user.id);

        if (isCurrentChat) {
            await loadConversation();
        }
    });
}

async function toggleRecording() {
    const button = document.getElementById("record-btn");
    
    if (!isRecording) {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: true
        });
        
        audioChunks = [];
        mediaRecorder = new MediaRecorder(stream);
        
        mediaRecorder.ondataavailable = event => {
            audioChunks.push(event.data);
        };
        
        mediaRecorder.onstop = async () => {
            const blob = new Blob(audioChunks, {
                type: "audio/webm"
            });
            const file = new File([blob], `voice-${Date.now()}.webm`, {
                type: "audio/webm"
            });
            
            const url = await uploadMedia(file);
            
            await sendMediaMessage({
                receiver_id: activeChat.contact_auth_id,
                sender_tego_id: currentProfile.tego_id,
                receiver_tego_id: activeChat.contact_tego_id,
                media_url: url,
                file_name: file.name,
                mime_type: "audio/webm"
            });
        };
        
        mediaRecorder.start();
        isRecording = true;
        button.classList.add("recording");
        button.textContent = "■";
    } else {
        mediaRecorder.stop();
        isRecording = false;
        button.classList.remove("recording");
        button.textContent = "🎤";
    }
}

function scrollMessagesToBottom() {
    const container = document.getElementById("messages");
    if (!container) {
        return;
    }
    
    setTimeout(() => {
        container.scrollTop = container.scrollHeight;
    }, 50);
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

window.addEventListener("beforeunload", () => {
    if (messagesChannel && APP.supabase) {
        APP.supabase.removeChannel(messagesChannel);
    }
});

async function markMessagesRead(senderTegoId) {
    await APP.supabase
        .from("messages")
        .update({ status: "read" })
        .eq("sender_tego_id", senderTegoId)
        .eq("receiver_tego_id", currentProfile.tego_id)
        .neq("status", "read");
}

async function deleteMessage(messageId) {
    try {
        await APP.supabase
            .from("messages")
            .update({
                message: "Message deleted",
                deleted_at: new Date().toISOString()
            })
            .eq("id", messageId);
        
        await loadConversation();
    } catch {
        showToast("Delete failed");
    }
}

window.initChatPage = initChatPage;
