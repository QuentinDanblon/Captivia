import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { isAllowedPushEndpoint } from './push-endpoint';
import { PushSubscriptionDto } from './dto/push-subscription.dto';

/** Revue de sécurité, constat 2 : liste blanche des services Web Push (anti-SSRF). */
describe('isAllowedPushEndpoint', () => {
  it.each([
    'https://fcm.googleapis.com/fcm/send/abc:APA91b',
    'https://updates.push.services.mozilla.com/wpush/v2/gAAAA',
    'https://web.push.apple.com/QGuQyavXutnMH',
    'https://wns2-par02p.notify.windows.com/w/?token=BQYAAA',
    'https://db5p.wns.windows.com/w/?token=x',
    'https://FCM.googleapis.com/fcm/send/upper-case-host',
    'https://fcm.googleapis.com:443/fcm/send/default-port',
  ])('accepts a known push service: %s', (endpoint) => {
    expect(isAllowedPushEndpoint(endpoint)).toBe(true);
  });

  it.each([
    // adresses internes / métadonnées
    'https://127.0.0.1/x',
    'https://127.0.0.1:8443/internal/admin',
    'https://localhost/x',
    'https://169.254.169.254/latest/meta-data/',
    'https://[::1]/x',
    'https://10.0.0.5/x',
    // schéma, port, identifiants
    'http://fcm.googleapis.com/fcm/send/x',
    'https://fcm.googleapis.com:8443/fcm/send/x',
    'https://user:pass@fcm.googleapis.com/fcm/send/x',
    // hôtes voisins ou usurpés
    'https://push.example.com/x',
    'https://fcm.googleapis.com.evil.test/x',
    'https://evilfcm.googleapis.com/x',
    'https://push.apple.com/x',
    'https://evilpush.apple.com/x',
    'https://notify.windows.com/x',
    'https://push.services.mozilla.com.evil.test/x',
    'https://fcm.googleapis.com./x',
    // valeurs invalides
    'javascript:alert(1)',
    'not a url',
    '',
    `https://fcm.googleapis.com/${'a'.repeat(500)}`,
  ])('refuses: %s', (endpoint) => {
    expect(isAllowedPushEndpoint(endpoint)).toBe(false);
  });

  it('refuses non-strings', () => {
    expect(isAllowedPushEndpoint(undefined)).toBe(false);
    expect(isAllowedPushEndpoint(42)).toBe(false);
  });

  it('is enforced by the subscription DTO', async () => {
    const keys = { p256dh: 'k', auth: 'a' };
    const errorsFor = async (endpoint: string) =>
      validate(plainToInstance(PushSubscriptionDto, { endpoint, keys }));
    expect(
      await errorsFor('https://fcm.googleapis.com/fcm/send/ok'),
    ).toHaveLength(0);
    const errors = await errorsFor('https://127.0.0.1:8443/internal');
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('isAllowedPushEndpoint');
  });
});
