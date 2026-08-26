let contactResults = [];
let myContacts = [];
let searchTimeout = null;
let myProfile = null;

async function initContactsPage() {

    const authenticated =
    await requireAuth();

    if (!authenticated) {
        return;
    }

    myProfile =
    await getMyProfile();

    if (!myProfile) {

        window.location.href =
        "profile.html";

        return;
    }

    bindContactsEvents();

    await loadContactsList();

    subscribeContacts(
        async () => {

            await loadContactsList();

        }
    );

}

function bindContactsEvents() {

    const search =
    document.getElementById(
        "search"
    );

    if (search) {

        search.addEventListener(
            "input",
            handleSearchInput
        );

    }

}

function handleSearchInput() {

    clearTimeout(
        searchTimeout
    );

    const value =
    document
    .getElementById(
        "search"
    )
    .value
    .trim();

    if (value.length < 2) {

        const results =
        document.getElementById(
            "results"
        );

        if (results) {
            results.innerHTML = "";
        }

        return;
    }

    searchTimeout =
    setTimeout(
        async () => {

            await searchUsers(
                value
            );

        },
        300
    );

}

async function searchUsers(
    query
) {

    try {

        const users =
        await searchProfiles(
            query
        );

        contactResults =
        users || [];

        renderSearchResults(
            contactResults
        );

    } catch {

        showToast(
            "Search failed"
        );

    }

}

function renderSearchResults(
    users
) {

    const container =
    document.getElementById(
        "results"
    );

    if (!container) {
        return;
    }

    container.innerHTML = "";

    users.forEach(user => {

        if (
            user.tego_id ===
            myProfile.tego_id
        ) {
            return;
        }

        const exists =
        myContacts.some(
            contact =>
            contact.contact_tego_id ===
            user.tego_id
        );

        const card =
        document.createElement(
            "div"
        );

        card.className =
        "card";

        card.innerHTML = `

        <div class="list-item">

            <img
            class="avatar"
            src="${
                user.avatar_url ||
                "icon-192.png"
            }"
            >

            <div class="info">

                <div class="name">
                    ${
                        user.display_name ||
                        user.username
                    }
                </div>

                <div class="subtext">
                    ${user.tego_id}
                </div>

            </div>

            <button
            class="btn"
            style="
            width:auto;
            padding:0 16px;
            "
            ${
                exists
                ? "disabled"
                : ""
            }
            >
                ${
                    exists
                    ? "Added"
                    : "Add"
                }
            </button>

        </div>

        `;

        const button =
        card.querySelector(
            "button"
        );

        if (!exists) {

            button.addEventListener(
                "click",
                async () => {

                    await addUserToContacts(
                        user
                    );

                }
            );

        }

        container.appendChild(
            card
        );

    });

}

async function addUserToContacts(
    user
) {

    try {

        await addContact({

            owner_id:
            APP.user.id,

            contact_auth_id:
            user.auth_id,

            contact_tego_id:
            user.tego_id,

            contact_username:
            user.username,

            nickname:
            user.display_name ||
            user.username

        });

        showToast(
            "Contact added"
        );

        await loadContactsList();

        renderSearchResults(
            contactResults
        );

    } catch (error) {

if(
error.message &&
error.message.includes(
"contacts_unique_contact"
)
){

showToast(
"Already in contacts"
);

return;

}

showToast(
error.message ||
"Unable to add contact"
);

}
}

async function loadContactsList() {

    try {

        myContacts =
        await getContacts();

        console.log(
            "Contacts:",
            myContacts
        );

        renderContacts(
            myContacts
        );

    } catch (error) {

        console.error(
            "Contacts error:",
            error
        );

        alert(
            error?.message ||
            JSON.stringify(error)
        );

        showToast(
            "Unable to load contacts"
        );

    }

}
function renderContacts(
    contacts
) {

    const container =
    document.getElementById(
        "my-contacts"
    );

    if (!container) {
        return;
    }

    container.innerHTML = "";

    if (
        contacts.length === 0
    ) {

        container.innerHTML = `

        <div class="card">

            <div class="subtext">
                No contacts yet
            </div>

        </div>

        `;

        return;
    }

    contacts.forEach(contact => {

        const card =
        document.createElement(
            "div"
        );

        card.className =
        "card";

        card.innerHTML = `

        <div class="list-item">

            <img
            class="avatar"
            src="icon-192.png"
            >

            <div class="info">

                <div class="name">
                    ${
                        contact.nickname ||
                        contact.contact_username
                    }
                </div>

                <div class="subtext">
                    ${
                        contact.contact_tego_id
                    }
                </div>

            </div>

            <button
            class="danger-btn"
            >
                Remove
            </button>

        </div>

        `;

        const removeButton =
        card.querySelector(
            ".danger-btn"
        );

        removeButton.addEventListener(
            "click",
            async event => {

                event.stopPropagation();

                await deleteContact(
                    contact.id
                );

            }
        );

        card.addEventListener(
            "click",
            () => {

                saveActiveChat(
                    contact
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

async function deleteContact(
    id
) {

    try {

        await removeContact(
            id
        );

        showToast(
            "Contact removed"
        );

        await loadContactsList();

    } catch {

        showToast(
            "Unable to remove"
        );

    }

}

window.initContactsPage =
initContactsPage;
