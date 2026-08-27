const CACHE_NAME = "tego-static-v1";

const STATIC_ASSETS = [
    "./",
    "./style.css",
    "./manifest.json",
    "./icon-192.png",
    "./icon-512.png"
];

// INSTALL
self.addEventListener("install", event => {

    event.waitUntil(
        caches.open(CACHE_NAME)
        .then(cache => cache.addAll(STATIC_ASSETS))
    );

    self.skipWaiting();

});

// ACTIVATE
self.addEventListener("activate", event => {

    event.waitUntil(
        caches.keys()
        .then(keys =>
            Promise.all(
                keys.map(key => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            )
        )
    );

    self.clients.claim();

});

// FETCH
self.addEventListener("fetch", event => {

    if (event.request.method !== "GET") {
        return;
    }

    const url = new URL(event.request.url);

    // Never cache Supabase requests
    if (
        url.hostname.includes("supabase.co") ||
        url.pathname.includes("/auth/") ||
        url.pathname.includes("/storage/") ||
        url.pathname.includes("/rest/")
    ) {
        event.respondWith(fetch(event.request));
        return;
    }

    // Never cache HTML pages
    if (
        event.request.destination === "document" ||
        url.pathname.endsWith(".html")
    ) {

        event.respondWith(

            fetch(event.request)
            .catch(() => caches.match("./index.html"))

        );

        return;
    }

    // Never cache JavaScript files
    if (
        event.request.destination === "script" ||
        url.pathname.endsWith(".js")
    ) {

        event.respondWith(fetch(event.request));
        return;
    }

    // Cache-first for images, icons, css, manifest
    event.respondWith(

        caches.match(event.request)
        .then(cached => {

            if (cached) {
                return cached;
            }

            return fetch(event.request)
            .then(response => {

                if (
                    response &&
                    response.status === 200 &&
                    response.type === "basic"
                ) {

                    const clone = response.clone();

                    caches.open(CACHE_NAME)
                    .then(cache => {
                        cache.put(event.request, clone);
                    });

                }

                return response;

            });

        })

    );

});

// PUSH NOTIFICATIONS
self.addEventListener("push", event => {

    let data = {
        title: "Tego",
        body: "New message received"
    };

    if (event.data) {

        try {
            data = event.data.json();
        } catch {}

    }

    event.waitUntil(

        self.registration.showNotification(
            data.title,
            {
                body: data.body,
                icon: "./icon-192.png",
                badge: "./icon-192.png"
            }
        )

    );

});

// NOTIFICATION CLICK
self.addEventListener("notificationclick", event => {

    event.notification.close();

    event.waitUntil(

        clients.matchAll({
            type: "window",
            includeUncontrolled: true
        })
        .then(clientList => {

            for (const client of clientList) {

                if ("focus" in client) {
                    return client.focus();
                }

            }

            if (clients.openWindow) {
                return clients.openWindow("./chats.html");
            }

        })

    );

});
