let chatItems = [];
let currentProfile = null;

async function initChatsPage() {

    const authenticated =
    await requireAuth();

    if (!authenticated) {
        return;
    }

    currentProfile =
    await getMyProfile();

    if (!currentProfile) {

        window.location.href =
        "profile.html";

        return;
    }

    bindChatsEvents();

    await loadChats();

    subscribeMessages(
        async () => {

            await loadChats();

        }
    );

}

function bindChatsEvents() {

    const search =
    document.getElementById(
        "chat-search"
    );

    if (search) {

        search.addEventListener(
            "input",
            searchChats
        );

    }

    const newChat =
    document.getElementById(
        "new-chat-btn"
    );

    if (newChat) {

        newChat.addEventListener(
            "click",
            () => {

                window.location.href =
                "contacts.html";

            }
        );

    }

}

async function loadChats() {

    try {

        const contacts =
        await getContacts();

        const conversations = [];

        for (const contact of contacts) {

            const {
                data,
                error
            } =
            await APP.supabase
            .from("messages")
            .select("*")
            .or(
                `and(sender_tego_id.eq.${currentProfile.tego_id},receiver_tego_id.eq.${contact.contact_tego_id}),and(sender_tego_id.eq.${contact.contact_tego_id},receiver_tego_id.eq.${currentProfile.tego_id})`
            )
            .order(
                "created_at",
                {
                    ascending: false
                }
            )
            .limit(1);

            if (error) {

                console.error(error);

                continue;

            }

            const lastMessage =
            data?.[0] || null;

            conversations.push({

                ...contact,

                lastMessage

            });

        }

        conversations.sort(
            (a, b) => {

                const aTime =
                a.lastMessage
                ?.created_at || "";

                const bTime =
                b.lastMessage
                ?.created_at || "";

                return (
                    new Date(bTime) -
                    new Date(aTime)
                );

            }
        );

        chatItems =
        conversations;

        renderChats(
            conversations
        );

    } catch (error) {

        console.error(error);

        showToast(
            "Unable to load chats"
        );

    }

}

function renderChats(
    items
) {

    const container =
    document.getElementById(
        "chat-list"
    );

    const empty =
    document.getElementById(
        "empty-state"
    );

    if (!container) {
        return;
    }

    container.innerHTML = "";

    if (
        !items ||
        items.length === 0
    ) {

        if (empty) {
            empty.style.display =
            "block";
        }

        return;

    }

    if (empty) {
        empty.style.display =
        "none";
    }

    items.forEach(chat => {

        const card =
        document.createElement(
            "div"
        );

        card.className =
        "card";

        const lastText =
        getLastMessageText(
            chat.lastMessage
        );

        const lastTime =
        chat.lastMessage
        ? formatTime(
            chat.lastMessage.created_at
        )
        : "";

        card.innerHTML = `

        <div class="list-item">

            <img
            class="avatar"
            src="icon-192.png"
            alt=""
            >

            <div class="info">

                <div class="name">
                    ${
                        chat.nickname ||
                        chat.contact_username ||
                        "Unknown"
                    }
                </div>

                <div class="subtext">
                    ${lastText}
                </div>

            </div>

            <div class="subtext">
                ${lastTime}
            </div>

        </div>

        `;

        card.addEventListener(
            "click",
            () => {

                saveActiveChat(
                    chat
                );

                window.location.href =
                "chat.html";

            }
        );

        container.appendChild(
            card
        );

    });

}

function getLastMessageText(
    message
) {

    if (!message) {
        return "No messages yet";
    }

    if (
        message.deleted_at
    ) {
        return "Message deleted";
    }

    if (
        message.message_type ===
        "image"
    ) {
        return "📷 Photo";
    }

    if (
        message.message_type ===
        "file"
    ) {
        return "📎 File";
    }

    return (
        message.message ||
        "Message"
    );

}

function searchChats() {

    const input =
    document.getElementById(
        "chat-search"
    );

    if (!input) {
        return;
    }

    const query =
    input.value
    .trim()
    .toLowerCase();

    if (!query) {

        renderChats(
            chatItems
        );

        return;

    }

    const filtered =
    chatItems.filter(
        chat => {

            const name =
            (
                chat.nickname ||
                chat.contact_username ||
                ""
            )
            .toLowerCase();

            return name.includes(
                query
            );

        }
    );

    renderChats(
        filtered
    );

}

window.initChatsPage =
initChatsPage;
