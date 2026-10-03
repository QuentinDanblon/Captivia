// Service Worker for Push Notifications (W3-03)
// Enregistré uniquement quand l'utilisateur active les notifications (Paramètres > Notifications).

self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim());
});

function readPayload(event) {
  if (!event.data) return {};
  try {
    return event.data.json() || {};
  } catch (e) {
    return { body: event.data.text() };
  }
}

// URL ouverte au clic : préfixe de locale si fourni dans la charge utile (data.locale,
// ex. "fr", "pt"), sinon sans préfixe ; fiche de l'animal si animalId est présent.
function targetUrl(data) {
  const prefix = /^[a-z]{2}(-[A-Za-z]{2})?$/.test((data && data.locale) || '') ? '/' + data.locale : '';
  return data && data.animalId
    ? prefix + '/mes-animaux/' + encodeURIComponent(data.animalId)
    : prefix + '/mes-animaux';
}

self.addEventListener('push', function (event) {
  const payload = readPayload(event);

  const title = payload.title || 'Captivia';
  const options = {
    body: payload.body || 'Notification',
    icon: payload.icon || '/icons/icon-192.png',
    badge: '/badge.png',
    data: payload.data || {},
  };
  // Un même rappel reçu deux fois remplace la notification précédente au lieu de s'empiler.
  if (payload.data && payload.data.eventId) options.tag = String(payload.data.eventId);

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  const url = targetUrl(event.notification.data || {});

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(function (windowClients) {
        // Réutilise un onglet Captivia déjà ouvert plutôt que d'en ouvrir un nouveau.
        for (const client of windowClients) {
          if ('focus' in client && 'navigate' in client) {
            return client.focus().then(function () {
              return client.navigate(url);
            });
          }
        }
        return self.clients.openWindow(url);
      })
      .catch(function () {
        return self.clients.openWindow(url);
      }),
  );
});
