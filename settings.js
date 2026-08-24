let deferredInstallPrompt = null;

async function initSettingsPage() {

    const authenticated =
    await requireAuth();

    if (!authenticated) {
        return;
    }

    const profile =
    await getMyProfile();

    if (!profile) {

        window.location.href =
        "profile.html";

        return;
    }

    renderProfile(profile);

    bindSettingsEvents();

    setupInstallPrompt();

}

function renderProfile(profile) {

    const avatar =
    document.getElementById(
        "avatar"
    );

    const displayName =
    document.getElementById(
        "display-name"
    );

    const username =
    document.getElementById(
        "username"
    );

    const tegoId =
    document.getElementById(
        "tego-id"
    );

    if (
        avatar &&
        profile.avatar_url
    ) {

        avatar.src =
        profile.avatar_url;

    }

    if (displayName) {

        displayName.textContent =
        profile.display_name ||
        profile.username;

    }

    if (username) {

        username.textContent =
        "@" +
        profile.username;

    }

    if (tegoId) {

        tegoId.textContent =
        profile.tego_id;

    }

}

function bindSettingsEvents() {

    const logoutButton =
    document.getElementById(
        "logout-btn"
    );

    if (logoutButton) {

        logoutButton.addEventListener(
            "click",
            handleLogout
        );

    }

    const editButton =
    document.getElementById(
        "edit-profile"
    );

    if (editButton) {

        editButton.addEventListener(
            "click",
            () => {

                window.location.href =
                "profile.html";

            }
        );

    }

    const clearButton =
    document.getElementById(
        "clear-cache"
    );

    if (clearButton) {

        clearButton.addEventListener(
            "click",
            clearApplicationCache
        );

    }

    const installButton =
    document.getElementById(
        "install-app"
    );

    if (installButton) {

        installButton.addEventListener(
            "click",
            installApplication
        );

    }

}

async function handleLogout() {

    const confirmed =
    confirm(
        "Logout from Tego?"
    );

    if (!confirmed) {
        return;
    }

    try {

        await logoutUser();

    } catch {

        showToast(
            "Logout failed"
        );

    }

}

async function clearApplicationCache() {

    try {

        localStorage.removeItem(
            "activeChat"
        );

        if (
            "caches" in window
        ) {

            const keys =
            await caches.keys();

            await Promise.all(

                keys.map(
                    key =>

                    caches.delete(
                        key
                    )
                )

            );

        }

        showToast(
            "Cache cleared"
        );

    } catch {

        showToast(
            "Failed"
        );

    }

}

function setupInstallPrompt() {

    window.addEventListener(
        "beforeinstallprompt",
        event => {

            event.preventDefault();

            deferredInstallPrompt =
            event;

            const button =
            document.getElementById(
                "install-app"
            );

            if (button) {

                button.classList.remove(
                    "hidden"
                );

            }

        }
    );

}

async function installApplication() {

    if (
        !deferredInstallPrompt
    ) {
        return;
    }

    deferredInstallPrompt.prompt();

    await deferredInstallPrompt.userChoice;

    deferredInstallPrompt =
    null;

    const button =
    document.getElementById(
        "install-app"
    );

    if (button) {

        button.classList.add(
            "hidden"
        );

    }

}

window.initSettingsPage =
initSettingsPage;
