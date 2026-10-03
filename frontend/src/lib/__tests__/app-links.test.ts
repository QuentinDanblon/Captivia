import {
  APP_LINK_PATHS,
  buildAppleAppSiteAssociation,
  buildAssetLinks,
  normalizeFingerprint,
  parseFingerprints,
  readAppLinksEnv,
  wellKnownPayload,
} from '../app-links';

const LOCALES = ['fr', 'en', 'es', 'de', 'it', 'pt'];
const FP = '14:6D:E9:83:C5:73:06:50:D8:EE:B9:95:2F:34:FC:64:16:A0:83:42:E6:1D:BE:A8:8A:04:96:B2:3F:CF:44:E5';
const FP2 = 'AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99';

describe('empreintes SHA-256', () => {
  it('normalise les formats acceptés', () => {
    expect(normalizeFingerprint(FP)).toBe(FP);
    expect(normalizeFingerprint(FP.toLowerCase())).toBe(FP);
    expect(normalizeFingerprint(FP.replace(/:/g, ''))).toBe(FP);
    expect(normalizeFingerprint(`  ${FP}  `)).toBe(FP);
  });

  it('refuse les empreintes invalides', () => {
    expect(normalizeFingerprint('')).toBeNull();
    expect(normalizeFingerprint('AB:CD')).toBeNull();
    expect(normalizeFingerprint(FP.replace('14', 'ZZ'))).toBeNull();
    expect(normalizeFingerprint(`${FP}:00`)).toBeNull();
    // Empreinte SHA-1 (20 octets) au lieu de SHA-256
    expect(normalizeFingerprint('DA:39:A3:EE:5E:6B:4B:0D:32:55:BF:EF:95:60:18:90:AF:D8:07:09')).toBeNull();
    // Séparateurs incohérents
    expect(normalizeFingerprint(FP.replace('14:6D', '146D'))).toBeNull();
  });

  it('lit une liste (upload + Play App Signing), sans doublon', () => {
    expect(parseFingerprints(`${FP}, ${FP2}`)).toEqual([FP, FP2]);
    expect(parseFingerprints(`${FP}\n${FP2};${FP}`)).toEqual([FP, FP2]);
    expect(parseFingerprints(FP.toLowerCase())).toEqual([FP]);
  });

  it('liste vide ou contenant une valeur invalide → null', () => {
    expect(parseFingerprints(undefined)).toBeNull();
    expect(parseFingerprints('')).toBeNull();
    expect(parseFingerprints(' , ')).toBeNull();
    expect(parseFingerprints(`${FP},pas-une-empreinte`)).toBeNull();
  });
});

describe('apple-app-site-association', () => {
  it('déclare les chemins de l’app, avec et sans préfixe de locale', () => {
    const aasa = buildAppleAppSiteAssociation({ APPLE_TEAM_ID: 'ABCDE12345' }, LOCALES)!;
    expect(aasa.applinks.details).toHaveLength(1);
    const [detail] = aasa.applinks.details;
    expect(detail.appIDs).toEqual(['ABCDE12345.app.captivia']);
    const paths = detail.components.map((c) => c['/']);
    expect(paths).toHaveLength(APP_LINK_PATHS.length * (LOCALES.length + 1));
    for (const p of ['/mes-animaux/*', '/animal-public/*', '/species/*', '/especes', '/reset-password', '/verifier-email']) {
      expect(paths).toContain(p);
      expect(paths).toContain(`/en${p}`);
      expect(paths).toContain(`/pt${p}`);
    }
    // Landing et pages légales restent dans le navigateur.
    expect(paths).not.toContain('/');
    expect(paths.some((p) => p.includes('cgu'))).toBe(false);
    expect(JSON.parse(JSON.stringify(aasa))).toEqual(aasa);
  });

  it('identifiant de bundle personnalisé', () => {
    const aasa = buildAppleAppSiteAssociation({ APPLE_TEAM_ID: 'ABCDE12345', IOS_BUNDLE_ID: ' com.example.app ' }, [])!;
    expect(aasa.applinks.details[0].appIDs).toEqual(['ABCDE12345.com.example.app']);
    expect(aasa.applinks.details[0].components).toHaveLength(APP_LINK_PATHS.length);
  });

  it('valeur manquante ou invalide → null (404)', () => {
    expect(buildAppleAppSiteAssociation({}, LOCALES)).toBeNull();
    expect(buildAppleAppSiteAssociation({ APPLE_TEAM_ID: '' }, LOCALES)).toBeNull();
    expect(buildAppleAppSiteAssociation({ APPLE_TEAM_ID: 'abcde12345' }, LOCALES)).toBeNull();
    expect(buildAppleAppSiteAssociation({ APPLE_TEAM_ID: 'ABC' }, LOCALES)).toBeNull();
    expect(buildAppleAppSiteAssociation({ APPLE_TEAM_ID: 'ABCDE12345', IOS_BUNDLE_ID: 'captivia' }, LOCALES)).toBeNull();
    expect(buildAppleAppSiteAssociation({ APPLE_TEAM_ID: 'ABCDE12345', IOS_BUNDLE_ID: 'app captivia' }, LOCALES)).toBeNull();
  });

  it('ignore une locale mal formée', () => {
    const aasa = buildAppleAppSiteAssociation({ APPLE_TEAM_ID: 'ABCDE12345' }, ['fr', '../x'])!;
    expect(aasa.applinks.details[0].components.some((c) => c['/'].includes('..'))).toBe(false);
  });
});

describe('assetlinks.json', () => {
  it('déclare le paquet et ses empreintes', () => {
    expect(buildAssetLinks({ ANDROID_SHA256_CERT_FINGERPRINTS: `${FP},${FP2}` })).toEqual([
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: { namespace: 'android_app', package_name: 'app.captivia', sha256_cert_fingerprints: [FP, FP2] },
      },
    ]);
  });

  it('nom de paquet personnalisé', () => {
    const links = buildAssetLinks({ ANDROID_PACKAGE_NAME: 'com.example.app', ANDROID_SHA256_CERT_FINGERPRINTS: FP })!;
    expect(links[0].target.package_name).toBe('com.example.app');
  });

  it('valeur manquante ou invalide → null (404)', () => {
    expect(buildAssetLinks({})).toBeNull();
    expect(buildAssetLinks({ ANDROID_SHA256_CERT_FINGERPRINTS: '' })).toBeNull();
    expect(buildAssetLinks({ ANDROID_SHA256_CERT_FINGERPRINTS: 'xyz' })).toBeNull();
    expect(buildAssetLinks({ ANDROID_PACKAGE_NAME: '1app.captivia', ANDROID_SHA256_CERT_FINGERPRINTS: FP })).toBeNull();
    expect(buildAssetLinks({ ANDROID_PACKAGE_NAME: 'captivia', ANDROID_SHA256_CERT_FINGERPRINTS: FP })).toBeNull();
  });
});

describe('wellKnownPayload', () => {
  it('JSON en application/json', () => {
    const res = wellKnownPayload({ a: 1 });
    expect(res.status).toBe(200);
    expect(res.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(res.body)).toEqual({ a: 1 });
  });

  it('404 sans JSON quand le fichier ne peut pas être produit', () => {
    const res = wellKnownPayload(null);
    expect(res.status).toBe(404);
    expect(res.headers['Content-Type']).toContain('text/plain');
    expect(res.headers['Cache-Control']).toBe('no-store');
    expect(() => JSON.parse(res.body)).toThrow();
  });
});

describe('readAppLinksEnv', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it('lit les quatre variables', () => {
    process.env.APPLE_TEAM_ID = 'ABCDE12345';
    process.env.ANDROID_SHA256_CERT_FINGERPRINTS = FP;
    delete process.env.IOS_BUNDLE_ID;
    delete process.env.ANDROID_PACKAGE_NAME;
    expect(readAppLinksEnv()).toEqual({
      APPLE_TEAM_ID: 'ABCDE12345',
      IOS_BUNDLE_ID: undefined,
      ANDROID_PACKAGE_NAME: undefined,
      ANDROID_SHA256_CERT_FINGERPRINTS: FP,
    });
  });
});
