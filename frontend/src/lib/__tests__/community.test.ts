import { ApiError, BACKEND_UNAVAILABLE_MESSAGE } from '../api';
import {
  availabilityFromStatus,
  communityErrorKey,
  formatPostTime,
  isAllowedMediaUrl,
  isValidHandleFormat,
  parseCommunityFlag,
  photoAlt,
  probeCommunity,
  reasonToErrorKey,
  suspendedUntilFromError,
} from '../community';

describe('drapeau de build NEXT_PUBLIC_COMMUNITY_ENABLED', () => {
  it('false / 0 / off coupent le volet', () => {
    expect(parseCommunityFlag('false')).toBe('off');
    expect(parseCommunityFlag(' 0 ')).toBe('off');
    expect(parseCommunityFlag('OFF')).toBe('off');
  });
  it('true ouvre la landing, absent laisse la détection décider', () => {
    expect(parseCommunityFlag('true')).toBe('on');
    expect(parseCommunityFlag(undefined)).toBe('auto');
    expect(parseCommunityFlag('')).toBe('auto');
    expect(parseCommunityFlag('peut-être')).toBe('auto');
  });
});

describe("détection de l'ouverture par l'API", () => {
  it('404 = COMMUNITY_ENABLED=false côté serveur', () => {
    expect(availabilityFromStatus(404)).toBe('unavailable');
  });
  it('200, 401 (authentification exigée) et 403 = routes présentes', () => {
    expect(availabilityFromStatus(200)).toBe('available');
    expect(availabilityFromStatus(401)).toBe('available');
    expect(availabilityFromStatus(403)).toBe('available');
  });
  it('5xx ou 429 : inconnu (pas de lien, pas de conclusion hâtive)', () => {
    expect(availabilityFromStatus(500)).toBe('unknown');
    expect(availabilityFromStatus(503)).toBe('unknown');
    expect(availabilityFromStatus(429)).toBe('unknown');
  });
  it('sonde /community/rules sans jeton ni cookie', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ status: 401 });
    await expect(probeCommunity(fetchImpl as unknown as typeof fetch, 'https://api.test')).resolves.toBe('available');
    expect(fetchImpl).toHaveBeenCalledWith('https://api.test/community/rules', expect.objectContaining({ method: 'GET', credentials: 'omit' }));
    const init = fetchImpl.mock.calls[0][1] as RequestInit;
    expect(init.headers).toBeUndefined();
  });
  it('404 → fermé ; réseau coupé → inconnu', async () => {
    await expect(probeCommunity(jest.fn().mockResolvedValue({ status: 404 }) as unknown as typeof fetch, 'https://api.test')).resolves.toBe('unavailable');
    await expect(probeCommunity(jest.fn().mockRejectedValue(new TypeError('Failed to fetch')) as unknown as typeof fetch, 'https://api.test')).resolves.toBe(
      'unknown',
    );
  });
});

describe('codes d’erreur → messages', () => {
  const err = (status: number, code?: string) => new ApiError(status, 'raw message from API', code);

  it.each([
    [403, 'GUEST_ACCOUNT', 'guest'],
    [403, 'EMAIL_NOT_VERIFIED', 'emailNotVerified'],
    [403, 'AGE_CONFIRMATION_REQUIRED', 'ageRequired'],
    [403, 'COMMUNITY_PROFILE_REQUIRED', 'profileRequired'],
    [403, 'COMMUNITY_RULES_NOT_ACCEPTED', 'rulesNotAccepted'],
    [400, 'COMMUNITY_RULES_VERSION_MISMATCH', 'rulesNotAccepted'],
    [403, 'COMMUNITY_SUSPENDED', 'suspended'],
    [429, 'COMMUNITY_RATE_LIMITED', 'rateLimited'],
    [400, 'COMMUNITY_LINKS_NOT_ALLOWED', 'linksNotAllowed'],
    [409, 'HANDLE_TAKEN', 'handleTaken'],
    [400, 'HANDLE_RESERVED', 'handleReserved'],
    [400, 'HANDLE_INVALID', 'handleInvalid'],
    [415, 'MEDIA_UNSUPPORTED_TYPE', 'mediaType'],
    [413, 'MEDIA_TOO_LARGE', 'mediaTooLarge'],
    [400, 'MEDIA_INVALID_IMAGE', 'mediaInvalid'],
    [400, 'COMMUNITY_CANNOT_REPORT_OWN', 'cannotReportOwn'],
    [400, 'COMMUNITY_APPEAL_NOT_ALLOWED', 'appealNotAllowed'],
    [503, 'MEDIA_BUSY', 'mediaBusy'],
    [403, 'GUEST_ACCOUNT', 'guest'],
  ] as const)('%i %s → %s', (status, code, key) => {
    expect(communityErrorKey(err(status, code))).toBe(key);
  });

  it('codes à venir : tolérance par famille, jamais de blocage', () => {
    expect(communityErrorKey(err(400, 'MEDIA_DIMENSIONS_TOO_LARGE'))).toBe('mediaDimensions');
    expect(communityErrorKey(err(413, 'MEDIA_ASPECT_RATIO'))).toBe('mediaDimensions');
    expect(communityErrorKey(err(413, 'MEDIA_SOMETHING_NEW'))).toBe('mediaTooLarge');
    expect(communityErrorKey(err(409, 'HANDLE_RECENTLY_USED'))).toBe('handleTaken');
    expect(communityErrorKey(err(400, 'HANDLE_LOOKALIKE'))).toBe('handleReserved');
    expect(communityErrorKey(err(418, 'TOTALLY_UNKNOWN'))).toBe('generic');
  });

  it('statuts sans code, réseau, et clés héritées de l’objet (« constructor »)', () => {
    expect(communityErrorKey(err(429))).toBe('rateLimited');
    expect(communityErrorKey(err(401))).toBe('session');
    expect(communityErrorKey(err(404))).toBe('notFound');
    expect(communityErrorKey(err(403))).toBe('forbidden');
    expect(communityErrorKey(err(400, 'constructor'))).toBe('generic');
    expect(communityErrorKey(new Error(BACKEND_UNAVAILABLE_MESSAGE))).toBe('network');
    expect(communityErrorKey('oops')).toBe('generic');
  });

  it('date de fin lue dans un refus 403 COMMUNITY_SUSPENDED (activation après un départ)', () => {
    const refusal = new ApiError(403, 'Publishing is suspended until 2026-11-02T10:00:00.000Z.', 'COMMUNITY_SUSPENDED');
    expect(suspendedUntilFromError(refusal)).toBe('2026-11-02T10:00:00.000Z');
    expect(suspendedUntilFromError(new ApiError(403, 'Publishing is suspended.', 'COMMUNITY_SUSPENDED'))).toBeNull();
    expect(suspendedUntilFromError(new ApiError(403, 'until 2026-11-02T10:00:00.000Z', 'OTHER'))).toBeNull();
  });

  it('motifs d’inéligibilité du profil', () => {
    expect(reasonToErrorKey('GUEST_ACCOUNT')).toBe('guest');
    expect(reasonToErrorKey('COMMUNITY_SUSPENDED')).toBe('suspended');
  });
});

describe('pseudo (contrôle avant envoi)', () => {
  it.each(['kaa', 'Gecko_Lea', 'boa.2026', '@kaa_et_moi'])('accepte %s', (h) => expect(isValidHandleFormat(h)).toBe(true));
  it.each(['ab', '_kaa', 'kaa.', 'k..aa', '12345', 'élise', 'a'.repeat(31), 'kaa moi'])('refuse %s', (h) =>
    expect(isValidHandleFormat(h)).toBe(false),
  );
});

describe('médias', () => {
  it("n'accepte que l'origine des médias configurée", () => {
    expect(isAllowedMediaUrl('https://media.captivia.app/abc.webp', 'https://media.captivia.app', 'https://api.test')).toBe(true);
    expect(isAllowedMediaUrl('https://evil.example/abc.webp', 'https://media.captivia.app', 'https://api.test')).toBe(false);
    expect(isAllowedMediaUrl('javascript:alert(1)', 'https://media.captivia.app', 'https://api.test')).toBe(false);
    expect(isAllowedMediaUrl(null, 'https://media.captivia.app', 'https://api.test')).toBe(false);
  });
  it("sans origine dédiée, les images viennent de l'API (pilote local)", () => {
    expect(isAllowedMediaUrl('https://api.test/community/media/x.webp', undefined, 'https://api.test')).toBe(true);
    expect(isAllowedMediaUrl('https://media.captivia.app/x.webp', undefined, 'https://api.test')).toBe(false);
  });

  const labels = { photoOf: (n: number, t: number) => `Photo ${n}/${t}`, byAuthor: (h: string) => `par @${h}`, fallback: 'photo' };
  it('alt : légende, sinon animal, sinon auteur', () => {
    const author = { handle: 'kaa_fan', avatarUrl: null };
    expect(photoAlt({ body: 'Kaa  au soleil\nce matin', animal: null, author }, 0, 1, labels)).toBe('Kaa au soleil ce matin');
    expect(photoAlt({ body: '', animal: { name: 'Kaa', species: 'Boa', scientificName: 'Boa constrictor' }, author }, 1, 2, labels)).toBe(
      'Photo 2/2 · Kaa, Boa',
    );
    expect(photoAlt({ body: '', animal: null, author }, 0, 1, labels)).toBe('par @kaa_fan');
    expect(photoAlt({ body: 'x'.repeat(300), animal: null, author }, 0, 1, labels)).toHaveLength(120);
  });
});

describe('dates relatives', () => {
  const now = new Date('2026-10-03T12:00:00Z');
  it('à l’instant, minutes, heures, jours, puis la date', () => {
    expect(formatPostTime('2026-10-03T11:59:30Z', 'fr', 'à l’instant', now)).toBe('à l’instant');
    expect(formatPostTime('2026-10-03T11:55:00Z', 'fr', '', now)).toMatch(/5\s*min/);
    expect(formatPostTime('2026-10-03T09:00:00Z', 'fr', '', now)).toMatch(/3\s*h/);
    expect(formatPostTime('2026-09-01T09:00:00Z', 'fr', '', now)).toMatch(/1 sept/);
    expect(formatPostTime('2025-09-01T09:00:00Z', 'fr', '', now)).toMatch(/2025/);
    expect(formatPostTime('pas une date', 'fr', '', now)).toBe('—');
  });
});
