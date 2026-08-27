const APP = window.APP || {};

APP.supabase = APP.supabase || null;
APP.session = APP.session || null;
APP.user = APP.user || null;
APP.profile = APP.profile || null;
APP.installPrompt = null;
APP.initialized = false;
APP.initError = null;
APP.isRedirecting = false;

window.APP = APP;

async function initializeApp() {
    if (APP.initialized) return;

    try {
        if (typeof createSupabase === "function") {
            const supabase = createSupabase();

            if (supabase) {
                APP.supabase = supabase;

                const {
                    data,
                    error
                } = await supabase.auth.getSession();

                if (!error && data && data.session) {
                    APP.session = data.session;
                    APP.user = data.session.user;
                }
            }
        }

        await registerServiceWorker();
        setupInstallPrompt();
        setupLogoutButtons();

        if (APP.user && typeof getProfile === "function") {
            await getProfile();
        }

        APP.initialized = true;

    } catch (error) {
        console.error("App initialization failed:", error);
        APP.initError = error;
    }
}

function getCurrentPage() {
    const path = window.location.pathname;
    return path.split("/").pop() || "index.html";
}

async function registerServiceWorker() {
    try {
        if (!("serviceWorker" in navigator)) return;

        const response = await fetch("sw.js", {
            method: "HEAD",
            cache: "no-store"
        });

        if (!response.ok) return;

        await navigator.serviceWorker.register("sw.js");

    } catch (error) {
        console.warn("Service worker unavailable:", error);
    }
}

function setupInstallPrompt() {
    window.addEventListener("beforeinstallprompt", event => {
        event.preventDefault();

        APP.installPrompt = event;

        const button = document.getElementById("install-app");

        if (!button) return;

        button.classList.remove("hidden");

        button.onclick = async () => {
            if (!APP.installPrompt) {
                showToast("Installation is not available");
                return;
            }

            try {
                await APP.installPrompt.prompt();
                APP.installPrompt = null;
                button.classList.add("hidden");
            } catch (error) {
                console.error(error);
            }
        };
    });

    window.addEventListener("appinstalled", () => {
        APP.installPrompt = null;

        const button = document.getElementById("install-app");

        if (button) {
            button.classList.add("hidden");
        }
    });
}

function setupLogoutButtons() {
    const buttons = document.querySelectorAll("[data-logout]");

    buttons.forEach(button => {
        button.onclick = async event => {
            event.preventDefault();
            await logoutUser();
        };
    });
}

async function logout() {
    await logoutUser();
}

function showToast(message = "", duration = 3000) {
    if (!message) return;

    let toast = document.getElementById("tego-toast");

    if (!toast) {
        toast = document.createElement("div");
        toast.id = "tego-toast";

        Object.assign(toast.style, {
            position: "fixed",
            bottom: "100px",
            left: "50%",
            transform: "translateX(-50%)",
            background: "#2563eb",
            color: "#fff",
            padding: "12px 18px",
            borderRadius: "14px",
            zIndex: "99999",
            fontSize: "14px",
            fontWeight: "600",
            maxWidth: "90%",
            textAlign: "center",
            boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
            opacity: "0",
            transition: "opacity 0.3s ease",
            pointerEvents: "none"
        });

        document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.style.display = "block";
    toast.style.opacity = "1";

    if (toast.timer) {
        clearTimeout(toast.timer);
    }

    toast.timer = setTimeout(() => {
        toast.style.opacity = "0";

        setTimeout(() => {
            toast.style.display = "none";
        }, 300);

    }, duration);
}

function formatTime(dateString) {
    if (!dateString) return "";

    const date = new Date(dateString);

    if (isNaN(date.getTime())) return "";

    return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
    });
}

function formatDate(dateString) {
    if (!dateString) return "";

    const date = new Date(dateString);

    if (isNaN(date.getTime())) return "";

    return date.toLocaleDateString();
}

function generateAvatar(name = "User") {
    return `https://ui-avatars.com/api/?background=2563eb&color=fff&name=${encodeURIComponent(name)}`;
}

async function getProfile() {
    if (!APP.user || !APP.supabase) {
        return null;
    }

    try {
        const {
            data,
            error
        } = await APP.supabase
            .from("profiles")
            .select("*")
            .eq("auth_id", APP.user.id)
            .single();

        if (error) {
            if (error.code === "PGRST116") {
                APP.profile = null;
                return null;
            }

            console.warn("Profile error:", error);
            return null;
        }

        APP.profile = data;

        return data;

    } catch (error) {
        console.error("Profile loading failed:", error);
        return null;
    }
}

function openChat(chat) {
    if (!chat) {
        showToast("Chat not found");
        return;
    }

    try {
        localStorage.setItem(
            "activeChat",
            JSON.stringify(chat)
        );

        window.location.href = "chat.html";

    } catch (error) {
        console.error("Failed to open chat:", error);
        showToast("Unable to open chat");
    }
}

function openChats() {
    window.location.href = "chats.html";
}

function openContacts() {
    window.location.href = "contacts.html";
}

function openProfile() {
    window.location.href = "profile.html";
}

function openSettings() {
    window.location.href = "settings.html";
}

function saveActiveChat(chat) {
    if (!chat) return;

    localStorage.setItem(
        "activeChat",
        JSON.stringify(chat)
    );
}

function getActiveChat() {
    try {
        const chat = localStorage.getItem("activeChat");

        if (!chat) return null;

        return JSON.parse(chat);

    } catch (error) {
        return null;
    }
}

function clearActiveChat() {
    localStorage.removeItem("activeChat");
}

document.addEventListener("DOMContentLoaded", async () => {
    await initializeApp();
});

window.APP = APP;

window.openChat = openChat;
window.openChats = openChats;
window.openContacts = openContacts;
window.openProfile = openProfile;
window.openSettings = openSettings;

window.logout = logout;

window.showToast = showToast;
window.formatTime = formatTime;
window.formatDate = formatDate;
window.generateAvatar = generateAvatar;

window.getProfile = getProfile;

window.saveActiveChat = saveActiveChat;
window.getActiveChat = getActiveChat;
window.clearActiveChat = clearActiveChat;
