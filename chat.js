let activeChat = null;
let currentProfile = null;
let messagesChannel = null;
async function compressImage(file){

return new Promise(
(resolve,reject)=>{

const reader =
new FileReader();

reader.onload = e => {

const img =
new Image();

img.onload = ()=>{

let width =
img.width;

let height =
img.height;

const MAX =
1280;

if(
width > MAX ||
height > MAX
){

if(width > height){

height =
height *
(MAX/width);

width = MAX;

}else{

width =
width *
(MAX/height);

height = MAX;

}

}

const canvas =
document.createElement(
"canvas"
);

canvas.width =
width;

canvas.height =
height;

const ctx =
canvas.getContext(
"2d"
);

ctx.drawImage(
img,
0,
0,
width,
height
);

canvas.toBlob(

blob=>{

resolve(
new File(
[blob],
file.name,
{
type:"image/jpeg"
}
)
);

},

"image/jpeg",
0.7

);

};

img.src =
e.target.result;

};

reader.onerror =
reject;

reader.readAsDataURL(
file
);

}
);

}
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
const avatar =
document.getElementById(
    "chat-avatar"
);

if (
    avatar &&
    activeChat.avatar_url
) {

    avatar.src =
    activeChat.avatar_url;

}
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
${
mine
? `
<button
class="delete-msg"
data-id="${message.id}"
>
Delete
</button>
`
: ""
        }
            container.appendChild(
                item
            );
            const deleteBtn =
item.querySelector(
".delete-msg"
);

if(deleteBtn){

deleteBtn.addEventListener(
"click",
async e => {

e.stopPropagation();

const confirmed =
confirm(
"Delete this message?"
);

if(!confirmed){
return;
}

await deleteMessage(
message.id
);

await loadConversation();

}
);

}

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
        scrollMessagesToBottom();

await loadConversation();

    } catch {

        showToast(
            "Message failed"
        );

    }

}

async function uploadAndSendMedia(
    event
) {
let file =
event.target.files[0];
    if(
file.type.startsWith(
"image/"
)
){

file =
await compressImage(
file
);

            }
    const MAX_FILE_SIZE =
5 * 1024 * 1024;

if(
file.size >
MAX_FILE_SIZE
){

showToast(
"Maximum file size is 5MB"
);

event.target.value =
"";

return;

}

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
await loadConversation();
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

            const isCurrentChat =

(
    row.sender_id === APP.user.id &&
    row.receiver_id === activeChat.contact_auth_id
)

||

(
    row.sender_id === activeChat.contact_auth_id &&
    row.receiver_id === APP.user.id
);

if (isCurrentChat) {

    await loadConversation();

}

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
