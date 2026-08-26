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
            window.location.href = "profile.html";
            return;
        }

        bindContactsEvents();
        await loadContactsList();

        // Subscribe to contacts changes
        if (typeof subscribeContacts === 'function') {
            subscribeContacts(async () => {
                console.log("Contacts changed via subscription, reloading...");
                await loadContactsList();
                // Also notify chats page
                notifyChatsPage();
            });
        }

        // Listen for visibility change to refresh when user returns to tab
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Listen for storage changes (for cross-tab updates)
        window.addEventListener('storage', handleStorageChange);

        console.log("Contacts page initialized");

    } catch (error) {
        console.error("Initialization error:", error);
        showToast("Failed to initialize contacts page");
    }
}

// ============================================
// VISIBILITY & STORAGE HANDLERS
// ============================================
function handleVisibilityChange() {
    if (!document.hidden) {
        console.log("Tab became visible, refreshing contacts...");
        loadContactsList();
    }
}

function handleStorageChange(event) {
    if (event.key === 'contact_added' || 
        event.key === 'contact_removed' ||
        event.key === 'contacts_last_updated') {
        console.log("Contact change detected in another tab, refreshing...");
        loadContactsList();
    }
}

// ============================================
// NOTIFY CHATS PAGE
// ============================================
function notifyChatsPage() {
    try {
        // Store in localStorage for cross-tab communication
        localStorage.setItem('contacts_last_updated', Date.now().toString());
        localStorage.setItem('new_contact_added', 'true');
        
        // Store in sessionStorage for same tab
        sessionStorage.setItem('contact_added', Date.now().toString());
        
        // If the chats page is open, it will detect this change
        console.log("Notified chats page of contact changes");
    } catch (error) {
        console.error("Error notifying chats page:", error);
    }
}

// ============================================
// EVENT BINDING
// ============================================
function bindContactsEvents() {
    // Cleanup previous controller
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
        clearSearchResults();
        return;
    }

    showSearchLoading();

    searchTimeout = setTimeout(async () => {
        await searchUsers(value);
    }, 300);
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

        const avatarUrl = user.avatar_url || "icon-192.png";
        const displayName = user.display_name || user.username || user.tego_id;

        card.innerHTML = `
            <div class="list-item">
                <img 
                    class="avatar" 
                    src="${avatarUrl}"
                    alt="${displayName}'s avatar"
                    loading="lazy"
                    onerror="this.src='icon-192.png'"
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
                    data-user-id="${user.tego_id}"
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
                } catch (error) {
                    console.error("Add contact error:", error);
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
    // Validate
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
        // Ensure user is authenticated
        if (!APP?.user?.id) {
            showToast("Authentication error");
            return;
        }

        console.log("Adding contact:", user.tego_id);

        await addContact({
            owner_id: APP.user.id,
            contact_auth_id: user.auth_id,
            contact_tego_id: user.tego_id,
            contact_username: user.username,
            nickname: user.display_name || user.username
        });

        showToast("Contact added successfully");
        
        // Notify chats page about the new contact
        notifyChatsPage();
        
        // Reload contacts list
        await loadContactsList();
        
        // Refresh search results to update the button state
        renderSearchResults(contactResults);

        console.log("Contact added successfully:", user.tego_id);

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

        if (error.message && error.message.toLowerCase().includes("unauthorized")) {
            showToast("Please log in again");
            window.location.href = "profile.html";
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
        console.log("Contacts loaded:", myContacts.length);
        renderContacts(myContacts);
        
        // Store contact count for debugging
        sessionStorage.setItem('contacts_count', myContacts.length.toString());
        
        return myContacts;
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
        return [];
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
                <div style="text-align:center;padding:40px 20px;">
                    <div style="font-size:48px;margin-bottom:16px;">👥</div>
                    <div style="font-weight:500;margin-bottom:8px;">No contacts yet</div>
                    <div class="subtext">
                        Search for users above to add them
                    </div>
                </div>
            </div>
        `;
        return;
    }

    contacts.forEach(contact => {
        const card = document.createElement("div");
        card.className = "card";
        card.setAttribute("role", "listitem");

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
                    data-contact-id="${contact.id}"
                >
                    Remove
                </button>
            </div>
        `;

        const removeButton = card.querySelector(".danger-btn");
        removeButton.addEventListener("click", async (event) => {
            event.stopPropagation();
            
            if (!confirm(`Remove ${displayName} from your contacts?`)) {
                return;
            }
            
            removeButton.disabled = true;
            removeButton.textContent = "Removing...";
            
            try {
                await deleteContact(contact.id);
                // Notify chats page about removal
                try {
                    localStorage.setItem('contact_removed', Date.now().toString());
                } catch (e) {
                    // Ignore
                }
            } catch (error) {
                console.error("Remove contact error:", error);
                showToast("Failed to remove contact");
                removeButton.disabled = false;
                removeButton.textContent = "Remove";
            }
        });

        // Make the whole card clickable to go to chat
        card.addEventListener("click", (event) => {
            if (event.target.closest(".danger-btn")) {
                return;
            }
            
            // Save active chat and navigate
            if (typeof saveActiveChat === 'function') {
                saveActiveChat(contact);
            } else {
                // Fallback
                try {
                    localStorage.setItem('active_chat', JSON.stringify(contact));
                } catch (e) {
                    // Ignore
                }
            }
            
            window.location.href = "chat.html";
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
    if (!id) {
        showToast("Invalid contact");
        return;
    }

    try {
        await removeContact(id);
        showToast("Contact removed");
        
        // Notify chats page
        try {
            localStorage.setItem('contact_removed', Date.now().toString());
            localStorage.setItem('contacts_last_updated', Date.now().toString());
        } catch (e) {
            // Ignore
        }
        
        // Reload contacts
        await loadContactsList();
        
        // Update search results if they're visible
        if (elements.results && elements.results.children.length > 0) {
            renderSearchResults(contactResults);
        }
        
    } catch (error) {
        console.error("Delete contact error:", error);
        showToast(error.message || "Unable to remove contact");
        throw error;
    }
}

// ============================================
// FORCE REFRESH
// ============================================
function refreshContacts() {
    console.log("Manual refresh triggered");
    loadContactsList();
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
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('storage', handleStorageChange);
}

// ============================================
// EXPOSE FOR GLOBAL ACCESS
// ============================================
window.initContactsPage = initContactsPage;
window.loadContactsList = loadContactsList;
window.refreshContacts = refreshContacts;

// Run cleanup when page unloads
window.addEventListener("beforeunload", cleanup);

// ============================================
// TOAST NOTIFICATION (if not already defined)
// ============================================
if (typeof showToast === 'undefined') {
    window.showToast = function(message) {
        console.log("Toast:", message);
        alert(message);
    };
}

// ============================================
// SAVE ACTIVE CHAT HELPER (if not already defined)
// ============================================
if (typeof saveActiveChat === 'undefined') {
    window.saveActiveChat = function(chat) {
        try {
            localStorage.setItem('active_chat', JSON.stringify(chat));
            sessionStorage.setItem('active_chat', JSON.stringify(chat));
        } catch (error) {
            console.error("Error saving active chat:", error);
        }
    };
}
