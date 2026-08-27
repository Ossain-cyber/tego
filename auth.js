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
            message: error && error.message
                ? error.message
                : "Login failed"
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
            message: error && error.message
                ? error.message
                : "Registration failed"
        };
    }
}

async function logoutUser() {
    try {
        if (window.APP) {
            window.APP.isRedirecting = true;
        }

        await signOutUser();

        localStorage.removeItem("activeChat");
        localStorage.removeItem("tego_logged_in");

        sessionStorage.clear();

        window.location.replace("login.html");

    } catch (error) {
        if (window.APP) {
            window.APP.isRedirecting = false;
        }

        showToast(
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

        window.APP.session = session;
        window.APP.user = session.user;

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

window.login = login;
window.register = register;
window.logoutUser = logoutUser;

window.requireAuth = requireAuth;
window.requireGuest = requireGuest;

window.getLoggedInUser = getLoggedInUser;
window.getLoggedInProfile = getLoggedInProfile;
window.ensureProfile = ensureProfile;
