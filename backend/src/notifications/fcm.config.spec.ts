import { generateKeyPairSync } from 'crypto';
import { readFcmConfig } from './fcm.config';

const { privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

const account = (overrides: Record<string, unknown> = {}) => ({
  type: 'service_account',
  project_id: 'captivia-app',
  private_key_id: 'abc',
  private_key: privateKey,
  client_email: 'fcm@captivia-app.iam.gserviceaccount.com',
  token_uri: 'https://evil.example/token',
  ...overrides,
});
const b64 = (value: unknown) =>
  Buffer.from(JSON.stringify(value)).toString('base64');

describe('readFcmConfig', () => {
  it('absente : canal désactivé sans erreur', () => {
    expect(readFcmConfig({})).toEqual({ config: null, reason: 'absent' });
    expect(readFcmConfig({ FCM_SERVICE_ACCOUNT_JSON: '   ' })).toEqual({
      config: null,
      reason: 'absent',
    });
  });

  it('lit le JSON encodé en base64 (format recommandé)', () => {
    const res = readFcmConfig({ FCM_SERVICE_ACCOUNT_JSON: b64(account()) });
    expect(res.config).toEqual({
      projectId: 'captivia-app',
      clientEmail: 'fcm@captivia-app.iam.gserviceaccount.com',
      privateKey,
    });
  });

  it('accepte aussi le JSON brut, avec des \\n échappés dans la clé', () => {
    const raw = JSON.stringify(
      account({ private_key: privateKey.replace(/\n/g, '\\n') }),
    );
    const res = readFcmConfig({ FCM_SERVICE_ACCOUNT_JSON: raw });
    expect(res.config?.privateKey).toBe(privateKey);
  });

  it('FCM_PROJECT_ID prime sur project_id', () => {
    const res = readFcmConfig({
      FCM_SERVICE_ACCOUNT_JSON: b64(account()),
      FCM_PROJECT_ID: 'captivia-prod',
    });
    expect(res.config?.projectId).toBe('captivia-prod');
  });

  it.each([
    ['contenu illisible', 'pas du json ni du base64 !'],
    ['tableau', b64([1, 2])],
    ['mauvais type', b64(account({ type: 'authorized_user' }))],
    ['sans client_email', b64(account({ client_email: undefined }))],
    ['clé privée invalide', b64(account({ private_key: 'nope' }))],
    ['projet invalide', b64(account({ project_id: '../../etc' }))],
    ['projet absent', b64(account({ project_id: undefined }))],
  ])('invalide (%s) : canal désactivé, sans divulguer la clé', (_, value) => {
    const res = readFcmConfig({ FCM_SERVICE_ACCOUNT_JSON: value });
    expect(res.config).toBeNull();
    expect(res).toMatchObject({ reason: 'invalid' });
    expect(JSON.stringify(res)).not.toContain('PRIVATE KEY');
  });

  it("refuse une clé non RSA (FCM n'accepte que RS256)", () => {
    const ec = generateKeyPairSync('ec', {
      namedCurve: 'prime256v1',
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    });
    const res = readFcmConfig({
      FCM_SERVICE_ACCOUNT_JSON: b64(account({ private_key: ec.privateKey })),
    });
    expect(res.config).toBeNull();
  });
});
