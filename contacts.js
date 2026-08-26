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
        cacheElements();

        const authenticated = await requireAuth();
        if (!authenticated) {
            return;
        }

        myProfile = await getMyProfile();
        if (!myProfile) {
            window.location.href = ROUTES.PROFILE;
            return;
        }

        bindContactsEvents();
        await loadContactsList();

        subscribeContacts(async () => {
            await loadContactsList();
        });

    } catch (error) {
        console.error("Initialization error:", error);
        showToast("Failed to initialize contacts page");
    }
}

// ============================================
// EVENT BINDING
// ============================================
function bindContactsEvents() {
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

    if (value.length < 2) {
        if (elements.results) {
            elements.results.innerHTML = "";
        }
        return;
    }

    // Show loading state
    if (elements.results) {
        elements.results.innerHTML = `
            <div class="card">
                <div class="subtext" style="text-align:center;padding:20px;">
                    Searching...
                </div>
            </div>
        `;
    }

    searchTimeout = setTimeout(async () => {
        await searchUsers(value);
    }, 300);
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
        showToast("Search failed");
        
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
    let hasResults = false;

    users.forEach(user => {
        // Skip current user
        if (user.tego_id === myProfile?.tego_id) {
            return;
        }

        const exists = myContacts.some(
            contact => contact.contact_tego_id === user.tego_id
        );

        const card = document.createElement("div");
        card.className = "card";
        card.setAttribute("role", "listitem");

        // Keep original avatar URL structure - just use what comes from the API
        const avatarUrl = user.avatar_url || UI.DEFAULT_AVATAR;
        const displayName = user.display_name || user.username || user.tego_id;

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
                    <div class="subtext">${user.tego_id}</div>
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

        fragment.appendChild(card);
        hasResults = true;
    });

    elements.results.innerHTML = "";

    if (!hasResults) {
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

// ============================================
// ADD CONTACT
// ============================================
async function addUserToContacts(user) {
    // Keep original data structure - don't add avatar_url here
    try {
        await addContact({
            owner_id: APP.user.id,
            contact_auth_id: user.auth_id,
            contact_tego_id: user.tego_id,
            contact_username: user.username,
            nickname: user.display_name || user.username
        });

        showToast("Contact added");
        await loadContactsList();
        renderSearchResults(contactResults);

    } catch (error) {
        console.error("Add contact error:", error);
        
        if (error.message && error.message.includes("contacts_unique_contact")) {
            showToast("Already in contacts");
            return;
        }

        if (error.message && error.message.toLowerCase().includes("network")) {
            showToast("Network error, please try again");
            return;
        }

        showToast(error.message || "Unable to add contact");
    }
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
        console.log("Contacts:", myContacts);
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
        const card = document.createElement("div");
        card.className = "card";
        card.setAttribute("role", "listitem");

        // Keep original avatar structure - use default icon as you had
        const displayName = contact.nickname || contact.contact_username || contact.contact_tego_id;

        card.innerHTML = `
            <div class="list-item">
                <img 
                    class="avatar" 
                    src="icon-192.png"
                    alt="${displayName}'s avatar"
                    loading="lazy"
                >
                <div class="info">
                    <div class="name">${displayName}</div>
                    <div class="subtext">${contact.contact_tego_id}</div>
                </div>
                <button 
                    class="danger-btn" 
                    aria-label="Remove ${displayName} from contacts"
                >
                    Remove
                </button>
            </div>
        `;

        const removeButton = card.querySelector(".danger-btn");
        removeButton.addEventListener("click", async (event) => {
            event.stopPropagation();
            
            // Confirm removal for better UX
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

        card.addEventListener("click", (event) => {
            if (event.target.closest(".danger-btn")) {
                return;
            }
            saveActiveChat(contact);
            window.location.href = ROUTES.CHAT;
        });

        fragment.appendChild(card);
    });

    elements.myContacts.innerHTML = "";
    elements.myContacts.appendChild(fragment);
}

// ============================================
// DELETE CONTACT
// ============================================
async function deleteContact(id) {
    try {
        await removeContact(id);
        showToast("Contact removed");
        await loadContactsList();
    } catch (error) {
        console.error("Delete contact error:", error);
        showToast("Unable to remove");
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
