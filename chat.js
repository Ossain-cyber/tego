let replyingTo = null;
let activeChat = null;
let currentProfile = null;
let messagesChannel = null;
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let isPageVisible = true;

// Add visibility change listener to reload messages when tab becomes visible
document.addEventListener('visibilitychange', () => {
    isPageVisible = !document.hidden;
    if (isPageVisible && activeChat && currentProfile) {
        loadConversation();
    }
});

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
                        if (blob) {
                            resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
                                type: "image/jpeg"
                            }));
                        } else {
                            reject(new Error("Failed to compress image"));
                        }
                    },
                    "image/jpeg",
                    0.7
                );
            };
            img.onerror = () => reject(new Error("Failed to load image"));
            img.src = e.target.result;
        };
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
    });
}

async function initChatPage() {
    try {
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
        
        console.log('Chat initialized:', {
            activeChat,
            currentProfileTegoId: currentProfile.tego_id,
            contactTegoId: activeChat.contact_tego_id
        });
    } catch (error) {
        console.error('Init chat error:', error);
        showToast("Failed to initialize chat");
    }
}

function setupChatHeader() {
    const avatar = document.getElementById("chat-avatar");
    if (avatar && activeChat.avatar_url) {
        avatar.src = activeChat.avatar_url;
        avatar.onerror = () => {
            avatar.src = 'default-avatar.png'; // Add a default avatar
        };
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
            document.getElementById("reply-text").textContent = "";
        });
    }

    const sendBtn = document.getElementById("send-btn");
    if (sendBtn) {
        sendBtn.addEventListener("click", sendTextMessage);
    }

    const input = document.getElementById("message-input");
    if (input) {
        input.addEventListener("keydown", event => {
            if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                sendTextMessage();
            }
        });
        
        // Auto-resize textarea if it's a textarea
        if (input.tagName === 'TEXTAREA') {
            input.addEventListener('input', () => {
                input.style.height = 'auto';
                input.style.height = Math.min(input.scrollHeight, 150) + 'px';
            });
        }
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
    if (!currentProfile || !activeChat) {
        console.error('Missing profile or chat');
        return;
    }
    
    try {
        const { data, error } = await APP.supabase
            .from("messages")
            .select("*")
            .or(
                `and(sender_tego_id.eq.${currentProfile.tego_id},receiver_tego_id.eq.${activeChat.contact_tego_id}),and(sender_tego_id.eq.${activeChat.contact_tego_id},receiver_tego_id.eq.${currentProfile.tego_id})`
            )
            .order("created_at", { ascending: true });

        if (error) {
            throw error;
        }

        console.log('Loaded messages:', data?.length || 0);
        renderMessages(data || []);
        await markMessagesRead(activeChat.contact_tego_id);
    } catch (error) {
        console.error('Load conversation error:', error);
        showToast("Unable to load messages");
    }
}

function renderMessages(messages) {
    const container = document.getElementById("messages");
    if (!container) {
        return;
    }
    
    container.innerHTML = "";
    
    if (!messages || messages.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>No messages yet</p>
                <p class="text-sm text-gray-500">Say hello! 👋</p>
            </div>
        `;
        return;
    }
    
    messages.forEach(message => {
        // Use sender_tego_id to determine if message is mine
        const mine = message.sender_tego_id === currentProfile.tego_id;
        const item = document.createElement("div");
        item.className = `message ${mine ? "me" : "other"} ${message.status || ''}`;
        item.dataset.messageId = message.id;
        
        let body = "";
        
        if (message.deleted_at) {
            body = `<i>Message deleted</i>`;
        } else if (message.mime_type && message.mime_type.startsWith("audio/")) {
            body = `
                <audio controls preload="metadata">
                    <source src="${message.media_url}" type="${message.mime_type}">
                    Your browser does not support the audio element.
                </audio>
            `;
        } else if (message.message_type === "image" && message.media_url) {
            body = `
                <img src="${message.media_url}" class="chat-image" loading="lazy" 
                     onclick="window.open(this.src, '_blank')">
            `;
        } else if (message.message_type === "file" && message.media_url) {
            body = `
                <a href="${message.media_url}" target="_blank" class="file-link" download>
                    <div class="file-info">
                        <span class="file-icon">📎</span>
                        <span>${escapeHtml(message.file_name || "Download File")}</span>
                        ${message.file_size ? `<span class="file-size">${formatFileSize(message.file_size)}</span>` : ''}
                    </div>
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
            <button class="reply-btn" data-id="${message.id}" title="Reply">
                ↩️
            </button>
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
            
            ${mine && !message.deleted_at ? `
                <button class="delete-message-btn" data-id="${message.id}" title="Delete">
                    🗑️
                </button>
            ` : ""}
        `;
        
        container.appendChild(item);
        
        // Bind events using event delegation instead of individual listeners
    });
    
    // Use event delegation for better performance
    container.onclick = (event) => {
        const replyBtn = event.target.closest('.reply-btn');
        if (replyBtn) {
            const messageId = replyBtn.dataset.id;
            const message = messages.find(m => m.id === messageId);
            if (message) {
                replyingTo = message;
                const replyPreview = document.getElementById("reply-preview");
                const replyText = document.getElementById("reply-text");
                if (replyPreview && replyText) {
                    replyPreview.classList.remove("hidden");
                    replyText.textContent = message.message || message.file_name || "Media";
                }
                document.getElementById("message-input")?.focus();
            }
        }
        
        const deleteBtn = event.target.closest('.delete-message-btn');
        if (deleteBtn) {
            const messageId = deleteBtn.dataset.id;
            if (confirm("Delete this message?")) {
                deleteMessage(messageId);
            }
        }
    };
    
    scrollMessagesToBottom();
}

function getStatusIcon(status) {
    switch(status) {
        case "read":
            return "✓✓";
        case "delivered":
            return "✓✓"; // Use different styling in CSS to differentiate
        case "sent":
            return "✓";
        default:
            return "✓";
    }
}

async function sendTextMessage() {
    const input = document.getElementById("message-input");
    const text = input.value.trim();
    
    if (!text) {
        return;
    }
    
    const sendBtn = document.getElementById("send-btn");
    
    try {
        // Disable send button to prevent double sends
        if (sendBtn) sendBtn.disabled = true;
        input.value = "";
        
        // Create temporary message for optimistic UI
        const tempMessage = {
            id: `temp-${Date.now()}`,
            sender_tego_id: currentProfile.tego_id,
            receiver_tego_id: activeChat.contact_tego_id,
            message: text,
            message_type: "text",
            created_at: new Date().toISOString(),
            status: "sending",
            reply_to_id: replyingTo?.id || null,
            reply_text: replyingTo?.message || replyingTo?.file_name || "Media"
        };
        
        // Add temp message to UI immediately
        addTempMessage(tempMessage);
        
        const result = await sendMessage({
            sender_id: APP.user.id,
            receiver_id: activeChat.contact_auth_id,
            sender_tego_id: currentProfile.tego_id,
            receiver_tego_id: activeChat.contact_tego_id,
            message: text,
            message_type: "text",
            reply_to_id: replyingTo?.id || null,
            reply_text: replyingTo?.message || replyingTo?.file_name || "Media",
            status: "delivered"
        });
        
        console.log('Message sent result:', result);
        
        replyingTo = null;
        const replyPreview = document.getElementById("reply-preview");
        if (replyPreview) replyPreview.classList.add("hidden");
        
        // Reload conversation to get the actual message with proper ID
        await loadConversation();
    } catch (error) {
        console.error('Send message error:', error);
        showToast("Message failed to send");
        // Restore the input value
        input.value = text;
    } finally {
        if (sendBtn) sendBtn.disabled = false;
        input.focus();
    }
}

function addTempMessage(message) {
    const container = document.getElementById("messages");
    if (!container) return;
    
    // Remove empty state if present
    const emptyState = container.querySelector('.empty-state');
    if (emptyState) emptyState.remove();
    
    const tempDiv = document.createElement("div");
    tempDiv.className = "message me sending";
    tempDiv.dataset.tempId = message.id;
    tempDiv.innerHTML = `
        ${message.reply_text ? `
            <div class="reply-bubble">
                ${escapeHtml(message.reply_text)}
            </div>
        ` : ""}
        <div class="message-body">
            ${escapeHtml(message.message)}
        </div>
        <div class="message-footer">
            <div class="message-time">
                ${formatTime(message.created_at)}
            </div>
            <div class="message-status">
                ⏳
            </div>
        </div>
    `;
    container.appendChild(tempDiv);
    scrollMessagesToBottom();
}

async function uploadAndSendMedia(event) {
    const fileInput = event.target;
    let file = fileInput.files[0];
    
    if (!file) return;
    
    try {
        // Validate file type
        const allowedTypes = ['image/', 'audio/', 'video/', 'application/pdf', 'text/'];
        if (!allowedTypes.some(type => file.type.startsWith(type))) {
            showToast("Unsupported file type");
            fileInput.value = "";
            return;
        }
        
        // Compress images
        if (file.type.startsWith("image/")) {
            file = await compressImage(file);
        }
        
        // Check file size
        const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
        if (file.size > MAX_FILE_SIZE) {
            showToast("Maximum file size is 5MB");
            fileInput.value = "";
            return;
        }
        
        showToast("Uploading...");
        
        const url = await uploadMedia(file);
        const type = file.type.startsWith("image/") ? "image" : 
                    file.type.startsWith("audio/") ? "audio" : "file";
        
        await sendMediaMessage({
            receiver_id: activeChat.contact_auth_id,
            sender_tego_id: currentProfile.tego_id,
            receiver_tego_id: activeChat.contact_tego_id,
            media_url: url,
            file_name: file.name,
            file_size: file.size,
            mime_type: file.type,
            message_type: type
        });
        
        await loadConversation();
        fileInput.value = "";
    } catch (error) {
        console.error('Upload error:', error);
        showToast("Upload failed: " + (error.message || "Unknown error"));
        fileInput.value = "";
    }
}

function subscribeRealtimeMessages() {
    // Clean up existing subscription
    if (messagesChannel) {
        APP.supabase.removeChannel(messagesChannel);
        messagesChannel = null;
    }
    
    if (!currentProfile || !activeChat) return;
    
    // Create realtime subscription for this specific conversation
    messagesChannel = APP.supabase
        .channel(`messages-${currentProfile.tego_id}-${activeChat.contact_tego_id}`)
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'messages',
                filter: `or(and(sender_tego_id.eq.${currentProfile.tego_id},receiver_tego_id.eq.${activeChat.contact_tego_id}),and(sender_tego_id.eq.${activeChat.contact_tego_id},receiver_tego_id.eq.${currentProfile.tego_id}))`
            },
            async (payload) => {
                console.log('Realtime message event:', payload.eventType);
                if (isPageVisible) {
                    await loadConversation();
                }
            }
        )
        .subscribe((status) => {
            console.log('Realtime subscription status:', status);
            if (status === 'SUBSCRIBED') {
                console.log('Successfully subscribed to messages');
            }
        });
}

async function toggleRecording() {
    const button = document.getElementById("record-btn");
    
    if (!isRecording) {
        let stream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true
                }
            });
        } catch (error) {
            console.error('Microphone error:', error);
            showToast("Microphone permission denied");
            return;
        }
        
        audioChunks = [];
        mediaRecorder = new MediaRecorder(stream);
        
        mediaRecorder.ondataavailable = event => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };
        
        mediaRecorder.onstop = async () => {
            try {
                // Stop all tracks
                stream.getTracks().forEach(track => track.stop());
                
                if (audioChunks.length === 0) {
                    showToast("Recording was empty");
                    return;
                }
                
                const blob = new Blob(audioChunks, {
                    type: mediaRecorder.mimeType || "audio/webm"
                });
                
                if (blob.size > 5 * 1024 * 1024) {
                    showToast("Recording too large (max 5MB)");
                    return;
                }
                
                const file = new File([blob], `voice-${Date.now()}.webm`, {
                    type: mediaRecorder.mimeType || "audio/webm"
                });
                
                showToast("Uploading audio...");
                const url = await uploadMedia(file);
                
                await sendMediaMessage({
                    receiver_id: activeChat.contact_auth_id,
                    sender_tego_id: currentProfile.tego_id,
                    receiver_tego_id: activeChat.contact_tego_id,
                    media_url: url,
                    file_name: file.name,
                    file_size: file.size,
                    mime_type: file.type,
                    message_type: "audio"
                });
                
                await loadConversation();
            } catch (error) {
                console.error('Audio upload error:', error);
                showToast("Failed to send audio message");
            }
        };
        
        mediaRecorder.start(1000); // Collect data every second
        isRecording = true;
        button.classList.add("recording");
        button.textContent = "■ Stop";
        button.disabled = false;
    } else {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
        }
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
    
    // Use requestAnimationFrame for smoother scrolling
    requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight;
    });
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

function formatFileSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

window.addEventListener("beforeunload", () => {
    if (messagesChannel && APP.supabase) {
        APP.supabase.removeChannel(messagesChannel);
        messagesChannel = null;
    }
    
    // Stop recording if in progress
    if (isRecording && mediaRecorder) {
        mediaRecorder.stop();
        isRecording = false;
    }
});

async function markMessagesRead(senderTegoId) {
    try {
        const { data, error } = await APP.supabase
            .from("messages")
            .update({ status: "read" })
            .eq("sender_tego_id", senderTegoId)
            .eq("receiver_tego_id", currentProfile.tego_id)
            .neq("status", "read")
            .select();
            
        if (error) {
            console.error('Mark read error:', error);
        } else if (data && data.length > 0) {
            console.log('Marked messages as read:', data.length);
        }
    } catch (error) {
        console.error('Mark read error:', error);
    }
}

async function deleteMessage(messageId) {
    try {
        const { data, error } = await APP.supabase
            .from("messages")
            .update({
                message: "Message deleted",
                deleted_at: new Date().toISOString(),
                edited_at: new Date().toISOString()
            })
            .eq("id", messageId)
            .select();
            
        if (error) throw error;
        
        await loadConversation();
    } catch (error) {
        console.error('Delete error:', error);
        showToast("Delete failed");
    }
}

window.initChatPage = initChatPage;
