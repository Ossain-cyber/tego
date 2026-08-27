const APP = {
    supabase: null,
    session: null,
    user: null,
    profile: null,
    installPrompt: null
};

document.addEventListener("DOMContentLoaded", async () => {
    await initializeApp();
});

async function initializeApp() {
    registerServiceWorker();
    setupInstallPrompt();

    if (typeof createSupabase === "function") {
        APP.supabase = createSupabase();

        try {
            const {
                data: { session }
            } = await APP.supabase.auth.getSession();

            APP.session = session;
            APP.user = session?.user || null;

        } catch (e) {
            console.error(e);
        }
    }

    protectRoutes();
    setupLogoutButtons();
}

function protectRoutes() {
    const page = getCurrentPage();

    const publicPages = [
        "index.html",
        "login.html",
        "register.html"
    ];

    const requiresAuth = !publicPages.includes(page);

    if (requiresAuth && !APP.user) {
        window.location.replace("login.html");
        return;
    }

    if (!requiresAuth && APP.user) {
        if (
            page === "login.html" ||
            page === "register.html"
        ) {
            window.location.replace("chats.html");
        }
    }
}

function getCurrentPage() {
    const path = window.location.pathname;
    return path.split("/").pop() || "index.html";
}

async function logout() {
async function logout() {

    try {

        if (APP.supabase) {
            await APP.supabase.auth.signOut();
        }

    } catch (error) {
        console.error(error);
    }

    localStorage.removeItem("activeChat");
    sessionStorage.clear();

    window.location.href = "login.html";

}

function setupLogoutButtons() {
    document.querySelectorAll("[data-logout]").forEach(btn => {
        btn.addEventListener("click", logout);
    });
}

function showToast(message = "") {

    let toast = document.getElementById("tego-toast");

    if (!toast) {
        toast = document.createElement("div");

        toast.id = "tego-toast";

        toast.style.position = "fixed";
        toast.style.bottom = "100px";
        toast.style.left = "50%";
        toast.style.transform = "translateX(-50%)";
        toast.style.background = "#2563eb";
        toast.style.color = "#fff";
        toast.style.padding = "12px 18px";
        toast.style.borderRadius = "14px";
        toast.style.zIndex = "99999";
        toast.style.fontSize = "14px";
        toast.style.fontWeight = "600";

        document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.style.display = "block";

    clearTimeout(toast.timer);

    toast.timer = setTimeout(() => {
        toast.style.display = "none";
    }, 2500);
}

function formatTime(dateString) {
    const date = new Date(dateString);

    return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
    });
}

function formatDate(dateString) {
    const date = new Date(dateString);

    return date.toLocaleDateString();
}

function generateAvatar(name = "") {
    return `https://ui-avatars.com/api/?background=2563eb&color=fff&name=${encodeURIComponent(name)}`;
}

function setupInstallPrompt() {

    window.addEventListener("beforeinstallprompt", (e) => {

        e.preventDefault();

        APP.installPrompt = e;

        const installBtn = document.getElementById("install-app");

        if (installBtn) {
            installBtn.classList.remove("hidden");

            installBtn.addEventListener("click", async () => {

                if (!APP.installPrompt) return;

                APP.installPrompt.prompt();

                await APP.installPrompt.userChoice;

                APP.installPrompt = null;
            });
        }
    });
}

async function registerServiceWorker() {

    if (!("serviceWorker" in navigator)) return;

    try {

        await navigator.serviceWorker.register("sw.js");

    } catch (err) {

        console.error(err);

    }
}

async function getProfile() {

    if (!APP.user) return null;

    const {
        data,
        error
    } = await APP.supabase
        .from("profiles")
        .select("*")
        .eq("auth_id", APP.user.id)
        .single();

    if (error) return null;

    APP.profile = data;

    return data;
}function openChat(chat) {

    localStorage.setItem(
        "activeChat",
        JSON.stringify(chat)
    );

    window.location.href =
    "chat.html";

}

function openProfile() {
    window.location.href = "profile.html";
}

function openContacts() {
    window.location.href = "contacts.html";
}

function openChats() {
    window.location.href = "chats.html";
}

function openSettings() {
    window.location.href = "settings.html";
}
function getActiveChat() {

    const data =
    localStorage.getItem(
        "activeChat"
    );

    if (!data) {
        return null;
    }

    try {

        return JSON.parse(
            data
        );

    } catch {

        return null;

    }

}
function saveActiveChat(
    contact
) {

    localStorage.setItem(
        "activeChat",
        JSON.stringify(
            contact
        )
    );

}

window.saveActiveChat =
saveActiveChat;
window.getActiveChat =
getActiveChat;
window.APP = APP;
window.logout = logout;
window.showToast = showToast;
window.formatTime = formatTime;
window.formatDate = formatDate;
window.generateAvatar = generateAvatar;
window.getProfile = getProfile;
window.openChat = openChat;
window.openProfile = openProfile;
window.openContacts = openContacts;
window.openChats = openChats;
window.openSettings = openSettings;
