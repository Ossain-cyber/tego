const supabase = window.supabase.createClient(
SUPABASE_URL,
SUPABASE_ANON_KEY
)

const authScreen = document.getElementById("authScreen")
const mainScreen = document.getElementById("mainScreen")

const loginTab = document.getElementById("loginTab")
const signupTab = document.getElementById("signupTab")

const loginForm = document.getElementById("loginForm")
const signupForm = document.getElementById("signupForm")

const currentUsername = document.getElementById("currentUsername")
const profileUsername = document.getElementById("profileUsername")
const profileName = document.getElementById("profileName")
const profileTegoId = document.getElementById("profileTegoId")

const avatarInput = document.getElementById("avatarInput")
const avatarPreview = document.getElementById("avatarPreview")
const avatarFallback = document.getElementById("avatarFallback")

const copyTegoBtn = document.getElementById("copyTegoBtn")

const navButtons = document.querySelectorAll(".navBtn")
const views = document.querySelectorAll(".view")

const chatListScreen = document.getElementById("chatListScreen")
const chatScreen = document.getElementById("chatScreen")

const messagesContainer = document.getElementById("messagesContainer")
const messageForm = document.getElementById("messageForm")
const messageInput = document.getElementById("messageInput")

const contactSearch = document.getElementById("contactSearch")
const findContactBtn = document.getElementById("findContactBtn")
const contactResults = document.getElementById("contactResults")
const contactsList = document.getElementById("contactsList")

let currentUser = null
let currentProfile = null
let activeChat = "saved"
let activeReceiver = null

loginTab.onclick = () => {
loginTab.classList.add("active")
signupTab.classList.remove("active")
loginForm.classList.remove("hidden")
signupForm.classList.add("hidden")
}

signupTab.onclick = () => {
signupTab.classList.add("active")
loginTab.classList.remove("active")
signupForm.classList.remove("hidden")
loginForm.classList.add("hidden")
}

function generateTegoId(){
const a = Math.random().toString(36).substring(2,6).toUpperCase()
const b = Math.random().toString(36).substring(2,6).toUpperCase()
return `TEGO-${a}-${b}`
}

async function createSavedMessages(){
const { data } = await supabase
.from("contacts")
.select("*")
.eq("owner_id", currentProfile.id)
.eq("contact_tego_id","saved")
.limit(1)

if(data && data.length){
return
}

await supabase
.from("contacts")
.insert({
owner_id: currentProfile.id,
contact_tego_id: "saved",
contact_username: "saved",
nickname: "Saved Messages"
})
}

signupForm.addEventListener("submit", async e => {

e.preventDefault()

const displayName =
document.getElementById("displayName").value.trim()

const username =
document.getElementById("username").value.trim().toLowerCase()

const email =
document.getElementById("signupEmail").value.trim()

const password =
document.getElementById("signupPassword").value

const { data,error } =
await supabase.auth.signUp({
email,
password
})

if(error){
alert(error.message)
return
}

const authId = data.user.id

const tegoId = generateTegoId()

const { error: profileError } =
await supabase
.from("profiles")
.insert({
auth_id: authId,
display_name: displayName,
username,
tego_id: tegoId
})

if(profileError){
alert(profileError.message)
return
}

alert("Account created. Login now.")
loginTab.click()

})

loginForm.addEventListener("submit", async e => {

e.preventDefault()

const email =
document.getElementById("loginEmail").value

const password =
document.getElementById("loginPassword").value

const { error } =
await supabase.auth.signInWithPassword({
email,
password
})

if(error){
alert(error.message)
return
}

await boot()

})

async function boot(){

const { data:{ user } } =
await supabase.auth.getUser()

if(!user){
return
}

currentUser = user

const { data: profile } =
await supabase
.from("profiles")
.select("*")
.eq("auth_id", user.id)
.single()

currentProfile = profile

await createSavedMessages()

currentUsername.textContent =
`@${profile.username}`

profileUsername.textContent =
`@${profile.username}`

profileName.textContent =
profile.display_name

profileTegoId.textContent =
profile.tego_id

avatarFallback.textContent =
profile.display_name.charAt(0).toUpperCase()

authScreen.classList.remove("active")
mainScreen.classList.add("active")

loadContacts()
}

copyTegoBtn.onclick = async () => {
await navigator.clipboard.writeText(
profileTegoId.textContent
)
alert("Copied")
}

navButtons.forEach(button => {

button.onclick = () => {

navButtons.forEach(b =>
b.classList.remove("active")
)

button.classList.add("active")

views.forEach(v =>
v.classList.remove("active")
)

document
.getElementById(
button.dataset.screen
)
.classList.add("active")

}

})

document
.querySelector(".saved")
.addEventListener("click",() => {

views.forEach(v =>
v.classList.remove("active")
)

chatScreen.classList.add("active")

activeChat = "saved"

document.getElementById("chatTitle")
.textContent = "Saved Messages"

loadSavedMessages()

})

document
.getElementById("backBtn")
.onclick = () => {

views.forEach(v =>
v.classList.remove("active")
)

chatListScreen.classList.add("active")

}

messageForm.addEventListener("submit", async e => {

e.preventDefault()

const text = messageInput.value.trim()

if(!text){
return
}

if(activeChat === "saved"){

await supabase
.from("messages")
.insert({
sender_id: currentProfile.id,
receiver_id: currentProfile.id,
sender_tego_id: currentProfile.tego_id,
receiver_tego_id: currentProfile.tego_id,
message: text,
message_type: "text",
status: "saved"
})

messageInput.value = ""

loadSavedMessages()

return
}

if(activeReceiver){

await supabase
.from("messages")
.insert({
sender_id: currentProfile.id,
receiver_id: activeReceiver.id,
sender_tego_id: currentProfile.tego_id,
receiver_tego_id: activeReceiver.tego_id,
message: text,
message_type: "text",
status: "sent"
})

messageInput.value = ""

}

})

async function loadSavedMessages(){

messagesContainer.innerHTML = ""

const { data } =
await supabase
.from("messages")
.select("*")
.eq("sender_id", currentProfile.id)
.eq("receiver_id", currentProfile.id)
.order("created_at")

data.forEach(msg => {

const div =
document.createElement("div")

div.className = "message me"

div.textContent = msg.message

messagesContainer.appendChild(div)

})

}

findContactBtn.onclick = async () => {

const value =
contactSearch.value.trim()

if(!value){
return
}

let query =
supabase
.from("profiles")
.select("*")

if(value.startsWith("@")){

query =
query.eq(
"username",
value.replace("@","").toLowerCase()
)

}else{

query =
query.eq("tego_id", value)

}

const { data } =
await query.limit(1)

contactResults.innerHTML = ""

if(!data || !data.length){

contactResults.innerHTML =
"<p>User not found</p>"

return
}

const user = data[0]

const card =
document.createElement("div")

card.className = "card"

card.innerHTML = `
<h3>${user.display_name}</h3>
<p>@${user.username}</p>
<button id="addContactNow">
Add Contact
</button>
`

contactResults.appendChild(card)

document
.getElementById("addContactNow")
.onclick = async () => {

await supabase
.from("contacts")
.insert({
owner_id: currentProfile.id,
contact_tego_id: user.tego_id,
contact_username: user.username,
nickname: user.display_name
})

loadContacts()

}

}

async function loadContacts(){

const { data } =
await supabase
.from("contacts")
.select("*")
.eq("owner_id", currentProfile.id)

contactsList.innerHTML = ""

data.forEach(contact => {

if(contact.contact_tego_id === "saved"){
return
}

const item =
document.createElement("div")

item.className = "chatItem"

item.innerHTML = `
<div class="chatAvatar">
${contact.nickname.charAt(0)}
</div>
<div class="chatBody">
<h4>${contact.nickname}</h4>
<p>@${contact.contact_username}</p>
</div>
`

item.onclick = async () => {

const { data:user } =
await supabase
.from("profiles")
.select("*")
.eq(
"tego_id",
contact.contact_tego_id
)
.single()

activeReceiver = user

views.forEach(v =>
v.classList.remove("active")
)

chatScreen.classList.add("active")

document.getElementById("chatTitle")
.textContent = contact.nickname

loadConversation()

}

contactsList.appendChild(item)

})

}

async function loadConversation(){

messagesContainer.innerHTML = ""

const { data } =
await supabase
.from("messages")
.select("*")
.order("created_at")

const conversation =
data.filter(msg => {

const a =
msg.sender_id === currentProfile.id &&
msg.receiver_id === activeReceiver.id

const b =
msg.sender_id === activeReceiver.id &&
msg.receiver_id === currentProfile.id

return a || b

})

conversation.forEach(msg => {

const div =
document.createElement("div")

div.className =
msg.sender_id === currentProfile.id
? "message me"
: "message"

div.textContent =
msg.message

messagesContainer.appendChild(div)

})

}

supabase
.channel("messages")
.on(
"postgres_changes",
{
event:"*",
schema:"public",
table:"messages"
},
() => {

if(activeChat === "saved"){
loadSavedMessages()
}

if(activeReceiver){
loadConversation()
}

}
)
.subscribe()

avatarInput.addEventListener(
"change",
async e => {

const file =
e.target.files[0]

if(!file){
return
}

const path =
`${currentProfile.id}-${Date.now()}`

await supabase
.storage
.from("avatars")
.upload(
path,
file,
{
upsert:true
}
)

const { data } =
supabase
.storage
.from("avatars")
.getPublicUrl(path)

await supabase
.from("profiles")
.update({
avatar_url:data.publicUrl
})
.eq("id",currentProfile.id)

avatarPreview.src =
data.publicUrl

avatarPreview.style.display =
"block"

avatarFallback.style.display =
"none"

}
)

boot()
