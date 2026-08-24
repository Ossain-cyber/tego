const CACHE_NAME = "tego-v1";

const ASSETS = [
    "./",
    "./index.html",
    "./login.html",
    "./register.html",
    "./profile.html",
    "./chats.html",
    "./chat.html",
    "./contacts.html",
    "./settings.html",
    "./style.css",
    "./app.js",
    "./supabase.js",
    "./manifest.json",
    "./icon-192.png",
    "./icon-512.png"
];

self.addEventListener("install", event => {

    event.waitUntil(

        caches.open(CACHE_NAME)
        .then(cache => cache.addAll(ASSETS))

    );

    self.skipWaiting();

});

self.addEventListener("activate", event => {

    event.waitUntil(

        caches.keys()
        .then(keys =>

            Promise.all(

                keys.map(key => {

                    if(key !== CACHE_NAME){
                        return caches.delete(key);
                    }

                })

            )

        )

    );

    self.clients.claim();

});

self.addEventListener("fetch", event => {

    if(event.request.method !== "GET"){
        return;
    }

    event.respondWith(

        caches.match(event.request)
        .then(cached => {

            if(cached){
                return cached;
            }

            return fetch(event.request)
            .then(response => {

                const clone =
                response.clone();

                caches.open(CACHE_NAME)
                .then(cache => {

                    cache.put(
                        event.request,
                        clone
                    );

                });

                return response;

            })
            .catch(() => {

                return caches.match(
                    "./index.html"
                );

            });

        })

    );

});

self.addEventListener(
"notificationclick",
event => {

    event.notification.close();

    event.waitUntil(

        clients.matchAll({
            type:"window",
            includeUncontrolled:true
        })
        .then(clientList => {

            for(const client of clientList){

                if(
                    client.url &&
                    "focus" in client
                ){
                    return client.focus();
                }

            }

            if(clients.openWindow){

                return clients.openWindow(
                    "/chats.html"
                );

            }

        })

    );

});

self.addEventListener(
"push",
event => {

    let data = {
        title:"Tego",
        body:"New message received"
    };

    if(event.data){

        try{

            data =
            event.data.json();

        }catch{}

    }

    event.waitUntil(

        self.registration.showNotification(
            data.title,
            {
                body:data.body,
                icon:"icon-192.png",
                badge:"icon-192.png"
            }
        )

    );

});
