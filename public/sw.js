// Service Worker for Web Push Notifications

self.addEventListener('push', (event) => {
  if (!event.data) {
    console.log('Push event received but contains no data.');
    return;
  }

  try {
    const payload = event.data.json();
    const title = payload.title || 'Notification';
    const options = {
      body: payload.body || '',
      icon: payload.icon || '/favicon.ico',
      badge: payload.badge || '/favicon.ico',
      data: {
        url: payload.url || '/'
      },
      tag: payload.tag || 'general-notification',
      renotify: true
    };

    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  } catch (error) {
    console.error('Error displaying push notification:', error);
    
    // Fallback if data is not JSON
    const text = event.data.text();
    event.waitUntil(
      self.registration.showNotification('PV Verified Alert', {
        body: text,
        icon: '/favicon.ico',
        badge: '/favicon.ico'
      })
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((windowClients) => {
      // If a window client is already open, focus it and navigate
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // If no window is open, open a new tab
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
