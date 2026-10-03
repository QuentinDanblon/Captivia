/**
 * Génère une paire de clés VAPID pour les notifications Web Push (W3-03).
 *
 * Usage (depuis backend/) :
 *   npm run vapid:generate
 *
 * Copier les lignes affichées :
 *   - VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT → variables d'environnement du
 *     backend (Render : dashboard > Environment ; en local : backend/.env) ;
 *   - la clé publique n'a PAS besoin d'être exposée côté frontend : elle est servie par
 *     GET /notifications/vapid-public-key.
 *
 * Ne JAMAIS committer la clé privée. Changer de paire rend les abonnements existants
 * inutilisables : chaque navigateur se réabonnera depuis Paramètres > Notifications.
 */
import * as webPush from 'web-push';

const { publicKey, privateKey } = webPush.generateVAPIDKeys();

console.log('# Clés VAPID générées — à copier dans les variables d’environnement du backend');
console.log(`VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
console.log('VAPID_SUBJECT=mailto:contact@captivia.com');
console.log('');
console.log('# La clé privée est un secret : ne la committez pas.');
