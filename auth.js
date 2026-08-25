async function login(email,password){

    try{

        const result =
        await signIn(
            email,
            password
        );

        return {
            success:true,
            data:result
        };

    }catch(error){

        return {
            success:false,
            message:error.message
        };

    }

}

async function register(email,password){

    try{

        const result =
        await signUp(
            email,
            password
        );

        return {
            success:true,
            data:result
        };

    }catch(error){

        return {
            success:false,
            message:error.message
        };

    }

}

async function logoutUser(){

    try{

        await signOutUser();

        localStorage.removeItem(
            "activeChat"
        );

        sessionStorage.clear();

        window.location.href =
        "login.html";

    }catch(error){

        showToast(
            error.message
        );

    }

}

async function requireAuth(){

    const session =
    await getCurrentSession();

    if(!session){

        window.location.replace(
            "login.html"
        );

        return false;

    }

    return true;

}

async function requireGuest(){

    const session =
    await getCurrentSession();

    if(session){

        window.location.replace(
            "chats.html"
        );

        return false;

    }

    return true;

}

async function getLoggedInUser(){

    try{

        return await getCurrentUser();

    }catch{

        return null;

    }

}

async function getLoggedInProfile(){

    try{

        const profile =
        await getMyProfile();

        return profile;

    }catch{

        return null;

    }

}

async function ensureProfile(){

    const profile =
    await getLoggedInProfile();

    if(!profile){

        window.location.replace(
            "profile.html"
        );

        return false;

    }

    return true;

}

function saveActiveChat(chat){

    localStorage.setItem(
        "activeChat",
        JSON.stringify(chat)
    );

}

function getActiveChat(){

    const chat =
    localStorage.getItem(
        "activeChat"
    );

    if(!chat){
        return null;
    }

    try{

        return JSON.parse(chat);

    }catch{

        return null;

    }

}

function clearActiveChat(){

    localStorage.removeItem(
        "activeChat"
    );

}
async function requireAuth() {

    const session =
    await getCurrentSession();

    if (!session) {

        window.location.href =
        "login.html";

        return false;

    }

    APP.user =
    session.user;

    return true;
}

window.requireAuth =
requireAuth;
window.login = login;
window.register = register;
window.logoutUser = logoutUser;

window.requireAuth = requireAuth;
window.requireGuest = requireGuest;

window.getLoggedInUser =
getLoggedInUser;

window.getLoggedInProfile =
getLoggedInProfile;

window.ensureProfile =
ensureProfile;

window.saveActiveChat =
saveActiveChat;

window.getActiveChat =
getActiveChat;

window.clearActiveChat =
clearActiveChat;
