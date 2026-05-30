self.addEventListener("push", (event) => {
  let payload = {
    title: "EduPulse reminder",
    body: "Open EduPulse to view the latest class update.",
    url: "/student/calendar",
    tag: "edupulse-reminder",
    icon: "/edupulse-logo.svg",
    badge: "/edupulse-logo.svg",
  };

  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch {
      payload.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.tag,
      icon: payload.icon,
      badge: payload.badge,
      data: {
        url: payload.url || "/student/calendar",
      },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/student/calendar";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(
      (clients) => {
        for (const client of clients) {
          if ("focus" in client) {
            client.navigate(url);
            return client.focus();
          }
        }

        return self.clients.openWindow(url);
      },
    ),
  );
});
