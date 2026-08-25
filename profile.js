let profileAvatarFile = null;
let generatedTegoId = "";

async function initProfilePage() {

    const session =
    await getCurrentSession();

    if (!session) {

        window.location.href =
        "login.html";

        return;

    }

    bindProfileEvents();

    await loadExistingProfile();

}

function bindProfileEvents() {

    const avatarInput =
    document.getElementById(
        "avatar"
    );

    if (avatarInput) {

        avatarInput.addEventListener(
            "change",
            handleAvatarChange
        );

    }

    const saveButton =
    document.getElementById(
        "save-profile"
    );

    if (saveButton) {

        saveButton.addEventListener(
            "click",
            saveProfile
        );

    }

}

async function loadExistingProfile() {

    const profile =
    await getMyProfile();

    if (profile) {

        generatedTegoId =
        profile.tego_id;

        const bioField =
        document.getElementById(
            "bio"
        );

        if (bioField) {

            bioField.value =
            profile.bio || "";

        }

        const tegaElement =
        document.getElementById(
            "tego-id"
        );

        if (tegaElement) {

            tegaElement.textContent =
            profile.tego_id;

        }

        const username =
        document.getElementById(
            "username"
        );

        if (username) {

            username.value =
            profile.username || "";

        }

        const displayName =
        document.getElementById(
            "display-name"
        );

        if (displayName) {

            displayName.value =
            profile.display_name || "";

        }

        const avatar =
        document.getElementById(
            "avatar-preview"
        );

        if (
            avatar &&
            profile.avatar_url
        ) {

            avatar.src =
            profile.avatar_url;

        }

        return;

    }

    generatedTegoId =
    await generateUniqueTegoId();

    const tegaElement =
    document.getElementById(
        "tego-id"
    );

    if (tegaElement) {

        tegaElement.textContent =
        generatedTegoId;

    }

}

function handleAvatarChange(
    event
) {

    const file =
    event.target.files[0];

    if (!file) return;

    profileAvatarFile =
    file;

    const preview =
    document.getElementById(
        "avatar-preview"
    );

    if (preview) {

        preview.src =
        URL.createObjectURL(
            file
        );

    }

}

async function generateUniqueTegoId() {

    while (true) {

        const part1 =
        Math.random()
        .toString(36)
        .substring(2, 6)
        .toUpperCase();

        const part2 =
        Math.random()
        .toString(36)
        .substring(2, 6)
        .toUpperCase();

        const candidate =
        `TEGO-${part1}-${part2}`;

        const available =
        await isTegoIdAvailable(
            candidate
        );

        if (available) {

            return candidate;

        }

    }

}

async function usernameAvailable(
    username
) {

    const {
        data,
        error
    } = await APP.supabase
    .from("profiles")
    .select("id")
    .eq(
        "username",
        username
    );

    if (error) {

        throw error;

    }

    if (
        !data ||
        data.length === 0
    ) {

        return true;

    }

    const profile =
    await getMyProfile();

    if (
        profile &&
        profile.username === username
    ) {

        return true;

    }

    return false;

}

async function saveProfile() {

    const button =
    document.getElementById(
        "save-profile"
    );

    const username =
    document
    .getElementById(
        "username"
    )
    .value
    .trim()
    .toLowerCase();

    const displayName =
    document
    .getElementById(
        "display-name"
    )
    .value
    .trim();

    const bio =
    document
    .getElementById(
        "bio"
    )
    .value
    .trim();

    if (
        !username ||
        !displayName
    ) {

        showToast(
            "Complete all fields"
        );

        return;

    }

    try {

        button.disabled =
        true;

        button.textContent =
        "Saving...";

        const available =
        await usernameAvailable(
            username
        );

        if (!available) {

            throw new Error(
                "Username already exists"
            );

        }

        let avatarUrl =
        null;

        if (
            profileAvatarFile
        ) {

            avatarUrl =
            await uploadAvatar(
                profileAvatarFile
            );

        }

        const user =
        await getCurrentUser();

        const existing =
        await getMyProfile();

        if (existing) {

            const updateData = {

                username,

                display_name:
                displayName,

                bio,

                updated_at:
                new Date()
                .toISOString()

            };

            if (
                avatarUrl
            ) {

                updateData.avatar_url =
                avatarUrl;

            }

            await updateProfile(
                updateData
            );

        } else {

            await createProfile({

                auth_id:
                user.id,

                username,

                display_name:
                displayName,

                avatar_url:
                avatarUrl,

                bio,

                tego_id:
                generatedTegoId

            });

        }

        showToast(
            "Profile saved"
        );

        setTimeout(
            () => {

                window.location.href =
                "chats.html";

            },
            600
        );

    } catch (error) {

        showToast(
            error.message ||
            "Failed"
        );

        button.disabled =
        false;

        button.textContent =
        "Continue";

    }

}

window.initProfilePage =
initProfilePage;
