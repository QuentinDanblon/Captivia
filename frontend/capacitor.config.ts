import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor 7 (D-11, W6-03). L'app embarque l'export statique `out/` produit par
 * `npm run build:mobile` : JAMAIS de `server.url` (contenu distant = rejet Apple 4.2).
 * Origines de la WebView à autoriser dans CORS_ORIGIN du backend :
 *   iOS     capacitor://localhost
 *   Android https://localhost
 * Voir docs/MOBILE.md.
 */
const config: CapacitorConfig = {
  appId: 'app.captivia',
  appName: 'Captivia',
  webDir: 'out',
  // Projets natifs rangés sous mobile/ (créés par `npx cap add android|ios`, voir docs/MOBILE.md).
  android: { path: 'mobile/android' },
  ios: { path: 'mobile/ios' },
  server: {
    // Valeurs par défaut de Capacitor 7, explicitées car elles fixent les origines CORS ci-dessus.
    androidScheme: 'https',
    iosScheme: 'capacitor',
    hostname: 'localhost',
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_captivia',
      iconColor: '#0aa678',
    },
  },
};

export default config;
