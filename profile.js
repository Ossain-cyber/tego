// Profile page module
let profileAvatarFile = null;
let generatedTegoId = "";
let isInitialized = false;

// Initialize the profile page
async function initProfilePage() {
    try {
        // Check if supabase is available
        if (!window.APP || !window.APP.supabase) {
            console.error("Supabase not initialized");
            showToast("System not ready. Please refresh.");
            return;
        }

        // Get current session
        const session = await getCurrentSession();
        if (!session) {
            window.location.href = "login.html";
            return;
        }

        // Set current user
        const user = await getCurrentUser();
        if (user) {
            APP.user = user;
        }

        // Bind events
        bindProfileEvents();

        // Load existing profile
        await loadExistingProfile();

        isInitialized = true;
        console.log("Profile page initialized successfully");

    } catch (error) {
        console.error("Failed to initialize profile page:", error);
        showToast("Failed to load profile. Please refresh.");
    }
}

// Bind all DOM events
function bindProfileEvents() {
    // Avatar input
    const avatarInput = document.getElementById("avatar");
    if (avatarInput) {
        avatarInput.addEventListener("change", handleAvatarChange);
    }

    // Save button
    const saveButton = document.getElementById("save-profile");
    if (saveButton) {
        saveButton.addEventListener("click", saveProfile);
    }

    // Copy Tego ID button
    const copyBtn = document.getElementById("copy-tego-id");
    if (copyBtn) {
        copyBtn.addEventListener("click", copyTegoId);
    }

    // Optional: Auto-save on blur for fields
    const usernameField = document.getElementById("username");
    if (usernameField) {
        usernameField.addEventListener("blur", async () => {
            const username = usernameField.value.trim().toLowerCase();
            if (username && username.length >= 2) {
                try {
                    const available = await usernameAvailable(username);
                    const existing = await getMyProfile();
                    if (!available && (!existing || existing.username !== username)) {
                        showToast("Username already taken", "error");
                        usernameField.style.borderColor = "red";
                    } else {
                        usernameField.style.borderColor = "green";
                    }
                } catch (error) {
                    console.warn("Username check failed:", error);
                }
            }
        });
    }
}

// Load existing profile data
async function loadExistingProfile() {
    try {
        const profile = await getMyProfile();
        
        if (profile) {
            // Profile exists - populate fields
            generatedTegoId = profile.tego_id || "";
            
            const bioField = document.getElementById("bio");
            if (bioField) {
                bioField.value = profile.bio || "";
            }
            
            const tegoElement = document.getElementById("tego-id");
            if (tegoElement) {
                tegoElement.textContent = profile.tego_id || "Not set";
            }
            
            const usernameField = document.getElementById("username");
            if (usernameField) {
                usernameField.value = profile.username || "";
            }
            
            const displayNameField = document.getElementById("display-name");
            if (displayNameField) {
                displayNameField.value = profile.display_name || "";
            }
            
            const avatarPreview = document.getElementById("avatar-preview");
            if (avatarPreview && profile.avatar_url) {
                avatarPreview.src = profile.avatar_url;
                avatarPreview.style.display = "block";
            }
            
            return;
        }
        
        // No profile exists - generate new Tego ID
        const currentUser = await getCurrentUser();
        if (!currentUser) {
            throw new Error("User not authenticated");
        }
        
        generatedTegoId = await generateUniqueTegoId();
        const tegoElement = document.getElementById("tego-id");
        if (tegoElement) {
            tegoElement.textContent = generatedTegoId;
        }
        
        console.log("Generated new Tego ID:", generatedTegoId);
        
    } catch (error) {
        console.error("Error loading profile:", error);
        showToast("Could not load profile data", "error");
        throw error;
    }
}

// Handle avatar file selection
function handleAvatarChange(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) {
        profileAvatarFile = null;
        return;
    }
    
    // Validate file type
    if (!file.type.startsWith("image/")) {
        showToast("Please select an image file", "error");
        event.target.value = "";
        return;
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
        showToast("Image must be smaller than 5MB", "error");
        event.target.value = "";
        return;
    }
    
    profileAvatarFile = file;
    
    const preview = document.getElementById("avatar-preview");
    if (preview) {
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.src = e.target.result;
            preview.style.display = "block";
        };
        reader.readAsDataURL(file);
    }
}

// Generate a unique Tego ID
async function generateUniqueTegoId() {
    let attempts = 0;
    const maxAttempts = 50;
    
    while (attempts < maxAttempts) {
        attempts++;
        
        // Generate random string
        const part1 = Math.random().toString(36).substring(2, 6).toUpperCase();
        const part2 = Math.random().toString(36).substring(2, 6).toUpperCase();
        const candidate = `TEGO-${part1}-${part2}`;
        
        try {
            const available = await isTegoIdAvailable(candidate);
            if (available) {
                return candidate;
            }
        } catch (error) {
            console.warn("Tego ID check failed, retrying:", error);
            // Continue to next attempt
        }
    }
    
    // Fallback: use timestamp-based ID
    const timestamp = Date.now().toString(36).toUpperCase().slice(-6);
    return `TEGO-${timestamp.slice(0,3)}-${timestamp.slice(3)}`;
}

// Check if username is available
async function usernameAvailable(username) {
    if (!username || username.trim().length < 2) {
        return false;
    }
    
    username = username.trim().toLowerCase();
    
    try {
        // Check if username exists
        const { data, error } = await APP.supabase
            .from("profiles")
            .select("id, username")
            .eq("username", username);
        
        if (error) {
            console.error("Username check error:", error);
            return false;
        }
        
        // If no data, username is available
        if (!data || data.length === 0) {
            return true;
        }
        
        // Get current user's profile
        const currentProfile = await getMyProfile();
        
        // If the username belongs to the current user, it's available
        if (currentProfile && currentProfile.username === username) {
            return true;
        }
        
        // Username is taken by someone else
        return false;
        
    } catch (error) {
        console.error("Username availability check failed:", error);
        return false;
    }
}

// Save the profile
async function saveProfile() {
    const button = document.getElementById("save-profile");
    if (!button) {
        console.error("Save button not found");
        return;
    }
    
    // Prevent double submission
    if (button.disabled) {
        return;
    }
    
    try {
        // Get form values
        const usernameField = document.getElementById("username");
        const displayNameField = document.getElementById("display-name");
        const bioField = document.getElementById("bio");
        
        if (!usernameField || !displayNameField) {
            showToast("Required fields missing", "error");
            return;
        }
        
        const username = usernameField.value.trim().toLowerCase();
        const displayName = displayNameField.value.trim();
        const bio = bioField ? bioField.value.trim() : "";
        
        // Validate required fields
        if (!username) {
            showToast("Username is required", "error");
            usernameField.focus();
            return;
        }
        
        if (username.length < 2) {
            showToast("Username must be at least 2 characters", "error");
            usernameField.focus();
            return;
        }
        
        if (!displayName) {
            showToast("Display name is required", "error");
            displayNameField.focus();
            return;
        }
        
        if (displayName.length < 2) {
            showToast("Display name must be at least 2 characters", "error");
            displayNameField.focus();
            return;
        }
        
        // Check username availability
        const available = await usernameAvailable(username);
        if (!available) {
            showToast("Username already taken. Please choose another.", "error");
            usernameField.focus();
            usernameField.select();
            return;
        }
        
        // Disable button during save
        button.disabled = true;
        button.textContent = "Saving...";
        
        // Upload avatar if changed
        let avatarUrl = null;
        if (profileAvatarFile) {
            try {
                avatarUrl = await uploadAvatar(profileAvatarFile);
            } catch (uploadError) {
                console.error("Avatar upload failed:", uploadError);
                showToast("Failed to upload avatar. Continuing without it.", "warning");
            }
        }
        
        // Get current user
        const user = await getCurrentUser();
        if (!user) {
            throw new Error("User not authenticated");
        }
        
        // Check if profile exists
        const existing = await getMyProfile();
        let result;
        
        if (existing) {
            // Update existing profile
            const updateData = {
                username,
                display_name: displayName,
                bio,
                updated_at: new Date().toISOString()
            };
            
            if (avatarUrl) {
                updateData.avatar_url = avatarUrl;
            }
            
            result = await updateProfile(updateData);
            console.log("Profile updated:", result);
        } else {
            // Create new profile
            if (!generatedTegoId) {
                generatedTegoId = await generateUniqueTegoId();
            }
            
            const createData = {
                auth_id: user.id,
                username,
                display_name: displayName,
                avatar_url: avatarUrl,
                bio,
                tego_id: generatedTegoId
            };
            
            result = await createProfile(createData);
            console.log("Profile created:", result);
        }
        
        showToast("Profile saved successfully!", "success");
        
        // Navigate to chats after short delay
        setTimeout(() => {
            window.location.href = "chats.html";
        }, 600);
        
    } catch (error) {
        console.error("Save profile error:", error);
        showToast(error.message || "Failed to save profile", "error");
        
        // Re-enable button
        if (button) {
            button.disabled = false;
            button.textContent = "Save Profile";
        }
    }
}

// Copy Tego ID to clipboard
async function copyTegoId() {
    const tegoElement = document.getElementById("tego-id");
    if (!tegoElement) {
        showToast("Tego ID not found", "error");
        return;
    }
    
    const tegoId = tegoElement.textContent.trim();
    if (!tegoId || tegoId === "Not set") {
        showToast("No Tego ID available", "error");
        return;
    }
    
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(tegoId);
            showToast("Tego ID copied to clipboard!", "success");
        } else {
            // Fallback for older browsers
            const textArea = document.createElement("textarea");
            textArea.value = tegoId;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand("copy");
            document.body.removeChild(textArea);
            showToast("Tego ID copied!", "success");
        }
    } catch (error) {
        console.error("Copy failed:", error);
        showToast("Failed to copy. Please copy manually.", "error");
    }
}

// Show toast notification
function showToast(message, type = "info") {
    // Remove existing toast
    const existingToast = document.querySelector(".toast-notification");
    if (existingToast) {
        existingToast.remove();
    }
    
    // Create new toast
    const toast = document.createElement("div");
    toast.className = `toast-notification toast-${type}`;
    toast.textContent = message;
    
    // Style the toast
    Object.assign(toast.style, {
        position: "fixed",
        bottom: "20px",
        left: "50%",
        transform: "translateX(-50%)",
        padding: "12px 24px",
        borderRadius: "8px",
        backgroundColor: type === "error" ? "#dc3545" : 
                        type === "warning" ? "#ffc107" : 
                        type === "success" ? "#28a745" : "#007bff",
        color: "white",
        fontWeight: "bold",
        zIndex: "9999",
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        maxWidth: "90%",
        textAlign: "center",
        animation: "slideUp 0.3s ease",
        opacity: "0",
        transition: "opacity 0.3s ease"
    });
    
    document.body.appendChild(toast);
    
    // Fade in
    requestAnimationFrame(() => {
        toast.style.opacity = "1";
    });
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3000);
}

// Add CSS animation for toast
const style = document.createElement("style");
style.textContent = `
    @keyframes slideUp {
        from {
            transform: translateX(-50%) translateY(20px);
            opacity: 0;
        }
        to {
            transform: translateX(-50%) translateY(0);
            opacity: 1;
        }
    }
`;
document.head.appendChild(style);

// Export for global access
window.initProfilePage = initProfilePage;
window.saveProfile = saveProfile;
window.usernameAvailable = usernameAvailable;
window.generateUniqueTegoId = generateUniqueTegoId;
window.copyTegoId = copyTegoId;
window.showToast = showToast;

// Auto-initialize if page is loaded
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initProfilePage);
} else {
    initProfilePage();
}

console.log("Profile page module loaded");
