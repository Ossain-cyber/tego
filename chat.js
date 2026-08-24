let activeChat = null;
let currentProfile = null;
let messagesChannel = null;

async function initChatPage() {

    const authenticated =
    await requireAuth();

    if (!authenticated) {
        return;
    }

    activeChat =
    getActiveChat();

    if (!activeChat) {

        window.location.href =
        "chats.html";

        return;
    }

    currentProfile =
    await getMyProfile();

    if (!currentProfile) {

        window.location.href =
        "profile.html";

        return;
    }

    setupChatHeader();

    bindChatEvents();

    await loadConversation();

    subscribeRealtimeMessages();

}

function setupChatHeader() {

    const name =
    document.getElementById(
        "chat-name"
    );

    if (name) {

        name.textContent =
        activeChat.nickname ||
        activeChat.contact_username ||
        "Chat";

    }

}

function bindChatEvents() {

    const sendBtn =
    document.getElementById(
        "send-btn"
    );

    if (sendBtn) {

        sendBtn.addEventListener(
            "click",
            sendTextMessage
        );

    }

    const input =
    document.getElementById(
        "message-input"
    );

    if (input) {

        input.addEventListener(
            "keydown",
            event => {

                if (
                    event.key === "Enter"
                ) {

                    event.preventDefault();

                    sendTextMessage();

                }

            }
        );

    }

    const mediaBtn =
    document.getElementById(
        "media-btn"
    );

    if (mediaBtn) {

        mediaBtn.addEventListener(
            "click",
            () => {

                document
                .getElementById(
                    "media-input"
                )
                .click();

            }
        );

    }

    const mediaInput =
    document.getElementById(
        "media-input"
    );

    if (mediaInput) {

        mediaInput.addEventListener(
            "change",
            uploadAndSendMedia
        );

    }

}

async function loadConversation() {

    try {

        const { data, error } =
        await APP.supabase
        .from("messages")
        .select("*")
        .or(
            `and(sender_id.eq.${APP.user.id},receiver_id.eq.${activeChat.contact_auth_id}),and(sender_id.eq.${activeChat.contact_auth_id},receiver_id.eq.${APP.user.id})`
        )
        .order(
            "created_at",
            {
                ascending:true
            }
        );

        if (error) {
            throw error;
        }

        renderMessages(
            data || []
        );

        await markMessagesRead(
            activeChat.contact_tego_id
        );

    } catch {

        showToast(
            "Unable to load messages"
        );

    }

}

function renderMessages(
    messages
) {

    const container =
    document.getElementById(
        "messages"
    );

    if (!container) {
        return;
    }

    container.innerHTML = "";

    messages.forEach(
        message => {

            const mine =
            message.sender_id ===
            APP.user.id;

            const item =
            document.createElement(
                "div"
            );

            item.className =
            mine
            ? "message me"
            : "message other";

            let body =
            "";

            if (
                message.message_type ===
                "image"
            ) {

                body = `
<img
src="${message.media_url || message.message}"
class="chat-image"
loading="lazy"
>
`;

            } else if (
                message.message_type ===
                "file"
            ) {

                body = `
<a
href="${message.media_url}"
target="_blank"
class="file-link"
>
${message.file_name || "Download File"}
</a>
`;

            } else {

                body =
                escapeHtml(
                    message.message || ""
                );

            }

            item.innerHTML = `

            <div class="message-body">
                ${body}
            </div>

            <div class="message-time">
                ${formatTime(
                    message.created_at
                )}
            </div>

            `;

            container.appendChild(
                item
            );

        }
    );

    scrollMessagesToBottom();

}

async function sendTextMessage() {

    const input =
    document.getElementById(
        "message-input"
    );

    const text =
    input.value.trim();

    if (!text) {
        return;
    }

    try {

        input.value = "";

        await sendMessage({

            sender_id:
            APP.user.id,

            receiver_id:
            activeChat.contact_auth_id,

            sender_tego_id:
            currentProfile.tego_id,

            receiver_tego_id:
            activeChat.contact_tego_id,

            message:
            text,

            message_type:
            "text",

            status:"delivered"

        });

    } catch {

        showToast(
            "Message failed"
        );

    }

}

async function uploadAndSendMedia(
    event
) {

    const file =
    event.target.files[0];

    if (!file) {
        return;
    }

    try {

        const url =
        await uploadMedia(
            file
        );

        const type =
        file.type.startsWith(
            "image/"
        )
        ? "image"
        : "file";

        await sendMediaMessage({

receiver_id:
activeChat.contact_auth_id,

sender_tego_id:
currentProfile.tego_id,

receiver_tego_id:
activeChat.contact_tego_id,

media_url:
url,

file_name:
file.name,

file_size:
file.size,

mime_type:
file.type

});

        event.target.value =
        "";

    } catch {

        showToast(
            "Upload failed"
        );

    }

}

function subscribeRealtimeMessages() {

    messagesChannel =
    subscribeMessages(
        async payload => {

            const row =
            payload.new;

            if (!row) {
                return;
            }

            const senderMatch =
            row.sender_id ===
            activeChat.contact_auth_id;

            const receiverMatch =
            row.receiver_id ===
            activeChat.contact_auth_id;

            if (
                senderMatch ||
                receiverMatch
            ) {

                await loadConversation();

            }

        }
    );

}

function scrollMessagesToBottom() {

    const container =
    document.getElementById(
        "messages"
    );

    if (!container) {
        return;
    }

    setTimeout(
        () => {

            container.scrollTop =
            container.scrollHeight;

        },
        50
    );

}

function escapeHtml(
    text
) {

    const div =
    document.createElement(
        "div"
    );

    div.textContent =
    text;

    return div.innerHTML;

}

window.addEventListener(
    "beforeunload",
    () => {

        if (
            messagesChannel &&
            APP.supabase
        ) {

            APP.supabase.removeChannel(
                messagesChannel
            );

        }

    }
);

window.initChatPage =
initChatPage;
