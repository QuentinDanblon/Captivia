// Service Worker for Push Notifications
self.addEventListener('push', function (event) {
  const data = event.data ? event.data.json() : {};
  
  const title = data.title || 'Captivia';
  const options = {
    body: data.body || 'Notification',
    icon: data.icon || '/icons/icon-192.png',
    badge: '/badge.png',
    data: data.data || {},
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  const data = event.notification.data || {};

  // Préfixe de locale si fourni dans la charge utile (data.locale), sinon sans préfixe.
  const prefix = /^[a-z]{2}(-[A-Za-z]{2})?$/.test(data.locale || '') ? `/${data.locale}` : '';

  // Navigate to animal detail if animalId present
  const url = data.animalId
    ? `${prefix}/mes-animaux/${encodeURIComponent(data.animalId)}`
    : `${prefix}/mes-animaux`;

  event.waitUntil(
    clients.openWindow(url)
  );
});
