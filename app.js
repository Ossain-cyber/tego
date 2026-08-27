// App state - initialized with defaults
const APP = {
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

// Wait for DOM and initialize
document.addEventListener("DOMContentLoaded", async () => {
    try {
        await initializeApp();
    } catch (error) {
        console.error("App initialization failed:", error);
        showToast("App failed to initialize. Please refresh.");
    }
});

// Main initialization function
async function initializeApp() {
    // Prevent double initialization
    if (APP.initialized) {
        console.log("App already initialized");
        return;
    }

    console.log("Initializing app...");

    // Register service worker
    await registerServiceWorker();

    // Setup install prompt
    setupInstallPrompt();

    // Initialize Supabase if available
    await initializeSupabase();

    // Protect routes based on auth state
    await protectRoutes();

    // Setup UI elements
    setupLogoutButtons();

    // Initialize profile if user is logged in
    if (APP.user) {
        await getProfile();
    }

    APP.initialized = true;
    console.log("App initialized successfully");
}

// Initialize Supabase client
async function initializeSupabase() {
    try {
        // Check if createSupabase function exists
        if (typeof createSupabase !== "function") {
            console.warn("createSupabase function not found");
            return;
        }

        // Create Supabase client
        const supabase = createSupabase();
        if (!supabase) {
            throw new Error("Failed to create Supabase client");
        }

        APP.supabase = supabase;

        // Get session
        try {
            const { data, error } = await APP.supabase.auth.getSession();
            if (error) {
                console.warn("Failed to get session:", error);
                APP.session = null;
                APP.user = null;
                return;
            }

            APP.session = data?.session || null;
            APP.user = data?.session?.user || null;
            console.log("Session:", APP.session);
console.log("User:", APP.user);

            // Update user if session exists
            if (APP.user) {
                console.log("User authenticated:", APP.user.email);
            } else {
                console.log("No active session");
            }

        } catch (error) {
            console.error("Session retrieval failed:", error);
            APP.session = null;
            APP.user = null;
        }

    } catch (error) {
        console.error("Supabase initialization failed:", error);
        APP.supabase = null;
        APP.session = null;
        APP.user = null;
        throw error;
    }
}

// Route protection - SIMPLIFIED FIXED VERSION
async function protectRoutes() {
    return;
}

// Get current page name
function getCurrentPage() {
    try {
        const path = window.location.pathname;
        const filename = path.split("/").pop() || "index.html";
        return filename;
    } catch (error) {
        console.warn("Failed to get current page:", error);
        return "index.html";
    }
}

// Logout function
async function logout() {
    try {
        // Prevent multiple logout attempts
        if (APP.isRedirecting) {
            return;
        }
        APP.isRedirecting = true;

        // Show loading state
        const logoutButtons = document.querySelectorAll("[data-logout]");
        logoutButtons.forEach(btn => {
            btn.disabled = true;
            btn.textContent = "Logging out...";
        });

        // Sign out from Supabase
        if (APP.supabase) {
            try {
                await APP.supabase.auth.signOut();
            } catch (error) {
                console.error("Supabase signout failed:", error);
                // Continue with local cleanup even if remote signout fails
            }
        }

        // Clear local state
        APP.user = null;
        APP.session = null;
        APP.profile = null;
        APP.initialized = false;

        // Clear localStorage items except theme/preferences
        const keepKeys = ['theme', 'preferences'];
        const keysToRemove = [];
        
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && !keepKeys.includes(key)) {
                keysToRemove.push(key);
            }
        }
        
        keysToRemove.forEach(key => localStorage.removeItem(key));
        
        // Clear session storage
        try {
            sessionStorage.clear();
        } catch (error) {
            console.warn("SessionStorage clear failed:", error);
        }

        // Redirect to login
        window.location.href = "login.html";

    } catch (error) {
        console.error("Logout failed:", error);
        showToast("Logout failed. Please try again.");
        APP.isRedirecting = false;
        
        // Re-enable buttons
        const logoutButtons = document.querySelectorAll("[data-logout]");
        logoutButtons.forEach(btn => {
            btn.disabled = false;
            btn.textContent = "Logout";
        });
    }
}

// Setup logout buttons
function setupLogoutButtons() {
    try {
        const buttons = document.querySelectorAll("[data-logout]");
        if (buttons.length === 0) return;

        buttons.forEach(btn => {
            // Remove existing listener to avoid duplicates
            btn.removeEventListener("click", logout);
            btn.addEventListener("click", async (e) => {
                e.preventDefault();
                await logout();
            });
        });
    } catch (error) {
        console.warn("Failed to setup logout buttons:", error);
    }
}

// Show toast notification
function showToast(message = "", duration = 3000) {
    if (!message) return;

    try {
        let toast = document.getElementById("tego-toast");

        if (!toast) {
            toast = document.createElement("div");
            toast.id = "tego-toast";
            
            // Apply styles
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
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                opacity: "0",
                transition: "opacity 0.3s ease",
                pointerEvents: "none"
            });

            document.body.appendChild(toast);
        }

        toast.textContent = message;
        toast.style.display = "block";
        toast.style.opacity = "1";

        // Clear existing timer
        if (toast.timer) {
            clearTimeout(toast.timer);
        }

        // Hide after duration
        toast.timer = setTimeout(() => {
            toast.style.opacity = "0";
            setTimeout(() => {
                toast.style.display = "none";
            }, 300);
        }, duration);

    } catch (error) {
        console.warn("Toast display failed:", error);
        // Fallback to alert if toast fails
        if (message) alert(message);
    }
}

// Format time
function formatTime(dateString) {
    if (!dateString) return "";
    
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return "";
        
        return date.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
        });
    } catch (error) {
        console.warn("Time formatting failed:", error);
        return "";
    }
}

// Format date
function formatDate(dateString) {
    if (!dateString) return "";
    
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return "";
        
        return date.toLocaleDateString();
    } catch (error) {
        console.warn("Date formatting failed:", error);
        return "";
    }
}

// Generate avatar URL
function generateAvatar(name = "") {
    if (!name) {
        name = "User";
    }
    
    try {
        return `https://ui-avatars.com/api/?background=2563eb&color=fff&name=${encodeURIComponent(name)}`;
    } catch (error) {
        console.warn("Avatar generation failed:", error);
        return `https://ui-avatars.com/api/?background=2563eb&color=fff&name=User`;
    }
}

// Setup install prompt
function setupInstallPrompt() {
    try {
        window.addEventListener("beforeinstallprompt", (e) => {
            e.preventDefault();
            APP.installPrompt = e;

            const installBtn = document.getElementById("install-app");
            if (installBtn) {
                installBtn.classList.remove("hidden");
                
                // Remove existing listeners to avoid duplicates
                const newBtn = installBtn.cloneNode(true);
                installBtn.parentNode.replaceChild(newBtn, installBtn);
                
                newBtn.addEventListener("click", async () => {
                    if (!APP.installPrompt) {
                        showToast("Installation not available");
                        return;
                    }

                    try {
                        const result = await APP.installPrompt.prompt();
                        console.log("Install prompt result:", result);
                        
                        if (result && result.outcome === "accepted") {
                            showToast("App installed successfully!");
                        }
                        
                        APP.installPrompt = null;
                    } catch (error) {
                        console.error("Install prompt failed:", error);
                        showToast("Installation failed");
                        APP.installPrompt = null;
                    }
                });
            }
        });

        // Handle successful installation
        window.addEventListener("appinstalled", () => {
            console.log("App installed");
            showToast("Thank you for installing!");
            APP.installPrompt = null;
        });

    } catch (error) {
        console.warn("Install prompt setup failed:", error);
    }
}

// Register service worker
async function registerServiceWorker() {
    try {
        if (!("serviceWorker" in navigator)) {
            console.log("Service workers not supported");
            return;
        }

        // Check if sw.js exists before registering
        try {
            const response = await fetch("sw.js", { method: "HEAD" });
            if (!response.ok) {
                console.warn("sw.js not found, skipping registration");
                return;
            }
        } catch (error) {
            console.warn("sw.js not accessible:", error);
            return;
        }

        const registration = await navigator.serviceWorker.register("sw.js");
        console.log("Service worker registered:", registration.scope);

        // Check for updates
        registration.addEventListener("updatefound", () => {
            console.log("Service worker update found");
        });

    } catch (error) {
        console.warn("Service worker registration failed:", error);
    }
}

// Get user profile
async function getProfile() {
    if (!APP.user) {
        console.warn("Cannot get profile: No user logged in");
        return null;
    }

    if (!APP.supabase) {
        console.warn("Cannot get profile: Supabase not initialized");
        return null;
    }

    try {
        const { data, error } = await APP.supabase
            .from("profiles")
            .select("*")
            .eq("auth_id", APP.user.id)
            .single();

        if (error) {
            if (error.code === "PGRST116") {
                // No profile found - that's ok
                console.log("No profile found for user");
                APP.profile = null;
                return null;
            }
            console.warn("Profile fetch error:", error);
            return null;
        }

        APP.profile = data;
        return data;

    } catch (error) {
        console.error("Failed to get profile:", error);
        return null;
    }
}

// Navigation functions
function openChat(chat) {
    if (!chat) {
        console.warn("No chat data provided");
        return;
    }

    try {
        localStorage.setItem("activeChat", JSON.stringify(chat));
        window.location.href = "chat.html";
    } catch (error) {
        console.error("Failed to open chat:", error);
        showToast("Failed to open chat");
    }
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

// Get active chat from localStorage
function getActiveChat() {
    try {
        const data = localStorage.getItem("activeChat");
        if (!data) return null;

        return JSON.parse(data);
    } catch (error) {
        console.warn("Failed to parse active chat:", error);
        return null;
    }
}

// Save active chat to localStorage
function saveActiveChat(contact) {
    if (!contact) {
        console.warn("No contact provided to save");
        return;
    }

    try {
        localStorage.setItem("activeChat", JSON.stringify(contact));
    } catch (error) {
        console.error("Failed to save active chat:", error);
    }
}

async function login(email, password) {
    try {
        const result = await signIn(email, password);

        return {
            success: true,
            data: result
        };

    } catch (error) {
        return {
            success: false,
            message: error.message
        };
    }
}

async function register(email, password) {
    try {
        const result = await signUp(email, password);

        return {
            success: true,
            data: result
        };

    } catch (error) {
        return {
            success: false,
            message: error.message
        };
    }
}

async function logoutUser() {

    try {

        await signOutUser();

        localStorage.removeItem("activeChat");
        localStorage.removeItem("tego_logged_in");

        sessionStorage.clear();

        window.location.replace("login.html");

    } catch (error) {

        alert(
            error && error.message
                ? error.message
                : "Logout failed"
        );

    }
}

async function requireAuth() {

    try {

        const session = await getCurrentSession();

        if (!session || !session.user) {

            window.location.replace("login.html");

            return false;
        }

        window.APP.user = session.user;
        window.APP.session = session;

        return true;

    } catch (error) {

        window.location.replace("login.html");

        return false;
    }
}

async function requireGuest() {

    try {

        const session = await getCurrentSession();

        if (session && session.user) {

            window.location.replace("chats.html");

            return false;
        }

        return true;

    } catch (error) {

        return true;
    }
}

async function getLoggedInUser() {

    try {
        return await getCurrentUser();
    } catch (error) {
        return null;
    }
}

async function getLoggedInProfile() {

    try {
        return await getMyProfile();
    } catch (error) {
        return null;
    }
}

async function ensureProfile() {

    const profile = await getLoggedInProfile();

    if (!profile) {

        window.location.replace("profile.html");

        return false;
    }

    return true;
}

function saveActiveChat(chat) {

    localStorage.setItem(
        "activeChat",
        JSON.stringify(chat)
    );
}

function getActiveChat() {

    const chat = localStorage.getItem("activeChat");

    if (!chat) {
        return null;
    }

    try {
        return JSON.parse(chat);
    } catch (error) {
        return null;
    }
}

function clearActiveChat() {

    localStorage.removeItem("activeChat");
}

window.login = login;
window.register = register;
window.logoutUser = logoutUser;
window.requireAuth = requireAuth;
window.requireGuest = requireGuest;
window.getLoggedInUser = getLoggedInUser;
window.getLoggedInProfile = getLoggedInProfile;
window.ensureProfile = ensureProfile;
window.saveActiveChat = saveActiveChat;
window.getActiveChat = getActiveChat;
window.clearActiveChat = clearActiveChat;
