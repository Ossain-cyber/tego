// ============================================
// CONSTANTS & CONFIGURATION
// ============================================
const ROUTES = {
    PROFILE: "profile.html",
    CHAT: "chat.html"
};

const UI = {
    DEBOUNCE_DELAY: 300,
    MIN_SEARCH_LENGTH: 2,
    DEFAULT_AVATAR: "icon-192.png"
};

const ERROR_CODES = {
    DUPLICATE_CONTACT: 'DUPLICATE_CONTACT',
    NETWORK_ERROR: 'NETWORK_ERROR',
    UNAUTHORIZED: 'UNAUTHORIZED',
    NOT_FOUND: 'NOT_FOUND'
};

// ============================================
// STATE
// ============================================
let contactResults = [];
let myContacts = [];
let searchTimeout = null;
let myProfile = null;
let abortController = null;

// ============================================
// DOM CACHE
// ============================================
const getElement = (id) => document.getElementById(id);
const elements = {};

function cacheElements() {
    elements.search = getElement("search");
    elements.results = getElement("results");
    elements.myContacts = getElement("my-contacts");
}

// ============================================
// INITIALIZATION
// ============================================
async function initContactsPage() {
    try {
        // Cache DOM elements
        cacheElements();

        // Authentication check
        const authenticated = await requireAuth();
        if (!authenticated) {
            return;
        }

        // Load user profile
        myProfile = await getMyProfile();
        if (!myProfile) {
            navigateTo(ROUTES.PROFILE);
            return;
        }

        // Setup event listeners
        bindContactsEvents();

        // Load initial contacts
        await loadContactsList();

        // Subscribe to real-time updates
        subscribeContacts(async () => {
            await loadContactsList();
        });

    } catch (error) {
        console.error("Initialization error:", error);
        showToast("Failed to initialize contacts page");
    }
}

// ============================================
// NAVIGATION
// ============================================
function navigateTo(route) {
    window.location.href = route;
}

// ============================================
// EVENT BINDING
// ============================================
function bindContactsEvents() {
    // Cleanup previous controller if exists
    if (abortController) {
        abortController.abort();
    }
    abortController = new AbortController();

    if (elements.search) {
        elements.search.addEventListener(
            "input",
            handleSearchInput,
            { signal: abortController.signal }
        );
    }
}

// ============================================
// SEARCH HANDLING
// ============================================
function handleSearchInput() {
    clearTimeout(searchTimeout);

    const value = elements.search?.value?.trim() || "";

    if (value.length < UI.MIN_SEARCH_LENGTH) {
        clearSearchResults();
        return;
    }

    // Show loading state
    showSearchLoading();

    searchTimeout = setTimeout(async () => {
        await searchUsers(value);
    }, UI.DEBOUNCE_DELAY);
}

function clearSearchResults() {
    if (elements.results) {
        elements.results.innerHTML = "";
    }
}

function showSearchLoading() {
    if (elements.results) {
        elements.results.innerHTML = `
            <div class="card">
                <div class="subtext" style="text-align:center;padding:20px;">
                    Searching...
                </div>
            </div>
        `;
    }
}

// ============================================
// SEARCH USERS
// ============================================
async function searchUsers(query) {
    try {
        const users = await searchProfiles(query);
        contactResults = users || [];
        renderSearchResults(contactResults);
    } catch (error) {
        console.error("Search error:", error);
        
        if (error.message?.includes("network")) {
            showToast("Network error, please try again");
        } else {
            showToast("Search failed");
        }
        
        // Show error state
        if (elements.results) {
            elements.results.innerHTML = `
                <div class="card">
                    <div class="subtext" style="text-align:center;padding:20px;color:#e74c3c;">
                        Failed to load search results
                    </div>
                </div>
            `;
        }
    }
}

// ============================================
// RENDER SEARCH RESULTS
// ============================================
function renderSearchResults(users) {
    if (!elements.results) return;

    const fragment = document.createDocumentFragment();

    users.forEach(user => {
        // Skip current user
        if (user.tego_id === myProfile?.tego_id) {
            return;
        }

        const card = createSearchResultCard(user);
        fragment.appendChild(card);
    });

    elements.results.innerHTML = "";

    if (fragment.children.length === 0) {
        elements.results.innerHTML = `
            <div class="card">
                <div class="subtext" style="text-align:center;padding:20px;">
                    No users found
                </div>
            </div>
        `;
    } else {
        elements.results.appendChild(fragment);
    }
}

function createSearchResultCard(user) {
    const exists = myContacts.some(
        contact => contact.contact_tego_id === user.tego_id
    );

    const card = document.createElement("div");
    card.className = "card";
    card.setAttribute("role", "listitem");

    const displayName = sanitizeText(user.display_name || user.username);
    const avatarUrl = sanitizeUrl(user.avatar_url) || UI.DEFAULT_AVATAR;
    const tegoId = sanitizeText(user.tego_id);

    card.innerHTML = `
        <div class="list-item">
            <img 
                class="avatar" 
                src="${avatarUrl}"
                alt="${displayName}'s avatar"
                loading="lazy"
                onerror="this.src='${UI.DEFAULT_AVATAR}'"
            >
            <div class="info">
                <div class="name">${displayName}</div>
                <div class="subtext">${tegoId}</div>
            </div>
            <button 
                class="btn" 
                style="width:auto;padding:0 16px;"
                ${exists ? "disabled" : ""}
                aria-label="${exists ? 'Already added' : 'Add contact'}"
            >
                ${exists ? "Added" : "Add"}
            </button>
        </div>
    `;

    if (!exists) {
        const button = card.querySelector("button");
        button.addEventListener("click", async (event) => {
            event.stopPropagation();
            button.disabled = true;
            button.textContent = "Adding...";
            
            try {
                await addUserToContacts(user);
            } finally {
                button.disabled = false;
                button.textContent = "Add";
            }
        });
    }

    return card;
}

// ============================================
// ADD CONTACT
// ============================================
async function addUserToContacts(user) {
    // Validate user object
    if (!user?.auth_id || !user?.tego_id) {
        showToast("Invalid user data");
        return;
    }

    // Check if already in contacts
    if (myContacts.some(contact => contact.contact_tego_id === user.tego_id)) {
        showToast("Already in contacts");
        return;
    }

    try {
        // Ensure APP.user exists
        if (!APP?.user?.id) {
            showToast("Authentication error");
            return;
        }

        await addContact({
            owner_id: APP.user.id,
            contact_auth_id: user.auth_id,
            contact_tego_id: user.tego_id,
            contact_username: user.username || user.tego_id,
            nickname: user.display_name || user.username || user.tego_id,
            avatar_url: user.avatar_url || UI.DEFAULT_AVATAR
        });

        showToast("Contact added successfully");
        
        // Reload contacts and refresh search results
        await loadContactsList();
        renderSearchResults(contactResults);

    } catch (error) {
        console.error("Add contact error:", error);
        handleContactError(error);
    }
}

// ============================================
// ERROR HANDLING
// ============================================
function handleContactError(error) {
    const errorMessage = error?.message || "";
    const errorCode = error?.code || "";

    if (errorCode === ERROR_CODES.DUPLICATE_CONTACT || 
        errorMessage.includes("contacts_unique_contact") ||
        errorMessage.includes("duplicate")) {
        showToast("Already in contacts");
        return;
    }

    if (errorCode === ERROR_CODES.NETWORK_ERROR || 
        errorMessage.toLowerCase().includes("network")) {
        showToast("Network error, please try again");
        return;
    }

    if (errorCode === ERROR_CODES.UNAUTHORIZED || 
        errorMessage.includes("unauthorized")) {
        showToast("Please log in again");
        navigateTo(ROUTES.PROFILE);
        return;
    }

    showToast(errorMessage || "Unable to add contact");
}

// ============================================
// LOAD CONTACTS
// ============================================
async function loadContactsList() {
    // Show loading state
    if (elements.myContacts) {
        elements.myContacts.innerHTML = `
            <div class="card">
                <div class="subtext" style="text-align:center;padding:20px;">
                    Loading contacts...
                </div>
            </div>
        `;
    }

    try {
        myContacts = await getContacts() || [];
        console.log("Contacts loaded:", myContacts.length);
        renderContacts(myContacts);
    } catch (error) {
        console.error("Contacts error:", error);
        
        if (elements.myContacts) {
            elements.myContacts.innerHTML = `
                <div class="card" style="border-color:#e74c3c;">
                    <div class="subtext" style="text-align:center;padding:20px;color:#e74c3c;">
                        Failed to load contacts
                        <br>
                        <button class="btn" style="margin-top:10px;" onclick="loadContactsList()">
                            Retry
                        </button>
                    </div>
                </div>
            `;
        }
        
        showToast("Unable to load contacts");
    }
}

// ============================================
// RENDER CONTACTS
// ============================================
function renderContacts(contacts) {
    if (!elements.myContacts) return;

    const fragment = document.createDocumentFragment();

    if (!contacts || contacts.length === 0) {
        elements.myContacts.innerHTML = `
            <div class="card">
                <div class="subtext" style="text-align:center;padding:20px;">
                    No contacts yet
                    <br>
                    <span style="font-size:0.9em;opacity:0.7;">
                        Search for users above to add them
                    </span>
                </div>
            </div>
        `;
        return;
    }

    contacts.forEach(contact => {
        const card = createContactCard(contact);
        fragment.appendChild(card);
    });

    elements.myContacts.innerHTML = "";
    elements.myContacts.appendChild(fragment);
}

function createContactCard(contact) {
    const card = document.createElement("div");
    card.className = "card";
    card.setAttribute("role", "listitem");

    const displayName = sanitizeText(contact.nickname || contact.contact_username || contact.contact_tego_id);
    const avatarUrl = sanitizeUrl(contact.avatar_url) || UI.DEFAULT_AVATAR;
    const tegoId = sanitizeText(contact.contact_tego_id);

    card.innerHTML = `
        <div class="list-item">
            <img 
                class="avatar" 
                src="${avatarUrl}"
                alt="${displayName}'s avatar"
                loading="lazy"
                onerror="this.src='${UI.DEFAULT_AVATAR}'"
            >
            <div class="info">
                <div class="name">${displayName}</div>
                <div class="subtext">${tegoId}</div>
            </div>
            <button 
                class="danger-btn" 
                aria-label="Remove ${displayName} from contacts"
            >
                Remove
            </button>
        </div>
    `;

    // Remove button handler
    const removeButton = card.querySelector(".danger-btn");
    removeButton.addEventListener("click", async (event) => {
        event.stopPropagation();
        
        // Confirm removal
        if (!confirm(`Remove ${displayName} from your contacts?`)) {
            return;
        }
        
        removeButton.disabled = true;
        removeButton.textContent = "Removing...";
        
        try {
            await deleteContact(contact.id);
        } finally {
            removeButton.disabled = false;
            removeButton.textContent = "Remove";
        }
    });

    // Chat navigation
    card.addEventListener("click", (event) => {
        // Don't navigate if clicking the remove button
        if (event.target.closest(".danger-btn")) {
            return;
        }
        
        saveActiveChat(contact);
        navigateTo(ROUTES.CHAT);
    });

    return card;
}

// ============================================
// DELETE CONTACT
// ============================================
async function deleteContact(id) {
    if (!id) {
        showToast("Invalid contact");
        return;
    }

    try {
        await removeContact(id);
        showToast("Contact removed");
        await loadContactsList();
        
        // Update search results if they're visible
        if (elements.results && elements.results.children.length > 0) {
            renderSearchResults(contactResults);
        }
    } catch (error) {
        console.error("Delete contact error:", error);
        showToast(error.message || "Unable to remove contact");
    }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================
function sanitizeText(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

function sanitizeUrl(url) {
    if (!url) return null;
    try {
        const parsed = new URL(url, window.location.origin);
        // Only allow http/https protocols
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
            return null;
        }
        return parsed.href;
    } catch {
        return null;
    }
}

// ============================================
// CLEANUP
// ============================================
function cleanup() {
    if (abortController) {
        abortController.abort();
        abortController = null;
    }
    clearTimeout(searchTimeout);
}

// ============================================
// EXPOSE FOR GLOBAL ACCESS
// ============================================
window.initContactsPage = initContactsPage;
window.loadContactsList = loadContactsList;

// Run cleanup when page unloads
window.addEventListener("beforeunload", cleanup);

// ============================================
// TOAST NOTIFICATION (if not already defined)
// ============================================
// Note: Make sure showToast is defined elsewhere or add this fallback
if (typeof showToast === 'undefined') {
    window.showToast = function(message) {
        console.log("Toast:", message);
        // You can implement a simple toast here if needed
        alert(message); // Fallback
    };
}
