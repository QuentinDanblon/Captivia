import fs from 'fs';
import path from 'path';
import { ApiError, BACKEND_UNAVAILABLE_MESSAGE } from '../api';
import { errorKey } from '../api-errors';

/** Messages d'erreur : toujours une clé traduite, jamais le texte brut de l'API. */
describe('errorKey', () => {
  it.each([
    [new ApiError(400, 'name must be shorter than or equal to 100 characters'), 'apiErrors.invalid'],
    [new ApiError(422, 'x'), 'apiErrors.invalid'],
    [new ApiError(404, 'Not Found'), 'apiErrors.notFound'],
    [new ApiError(429, 'ThrottlerException: Too Many Requests'), 'apiErrors.tooManyRequests'],
    [new ApiError(401, 'Unauthorized'), 'common.sessionExpired'],
    [new ApiError(500, 'Internal server error'), 'apiErrors.generic'],
    [new Error(BACKEND_UNAVAILABLE_MESSAGE), 'apiErrors.unavailable'],
    [new Error('Father must be a male animal'), 'apiErrors.generic'],
    ['boom', 'apiErrors.generic'],
  ])('%p → %s', (err, key) => {
    expect(errorKey(err)).toBe(key);
  });

  it('le code machine prime sur le statut, puis le statut sur les règles par défaut', () => {
    const map = {
      codes: { EMAIL_NOT_VERIFIED: 'publicLink.emailNotVerified' },
      statuses: { 403: 'publicLink.premiumRequired', 409: 'auth.emailAlreadyUsed' },
      fallback: 'publicLink.updateError',
    };
    expect(errorKey(new ApiError(403, 'Verify your email', 'EMAIL_NOT_VERIFIED'), map)).toBe('publicLink.emailNotVerified');
    expect(errorKey(new ApiError(403, 'Premium subscription required'), map)).toBe('publicLink.premiumRequired');
    expect(errorKey(new ApiError(409, 'Email already registered'), map)).toBe('auth.emailAlreadyUsed');
    expect(errorKey(new ApiError(503, 'x'), map)).toBe('publicLink.updateError');
  });

  it('chaque clé générique existe dans les 6 langues', () => {
    for (const locale of ['fr', 'en', 'es', 'de', 'it', 'pt']) {
      const messages = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'messages', `${locale}.json`), 'utf8'));
      for (const key of ['unavailable', 'invalid', 'notFound', 'tooManyRequests', 'generic']) {
        expect(typeof messages.apiErrors[key]).toBe('string');
      }
    }
  });

  it('les écrans corrigés n’affichent plus le message brut de l’API', () => {
    const root = path.join(__dirname, '..', '..', 'app', '[locale]');
    const files = [
      '(auth)/register/page.tsx',
      '(auth)/forgot-password/page.tsx',
      '(auth)/reset-password/page.tsx',
      '(auth)/login/page.tsx',
      '(app)/mes-animaux/_components/AddAnimalFlow.tsx',
      '(app)/mes-animaux/[id]/_components/EditAnimalModal.tsx',
      '(app)/mes-animaux/[id]/_components/ShareQrSection.tsx',
      '(app)/parametres/notifications/page.tsx',
      '(app)/parametres/grade/page.tsx',
      '(app)/parametres/compte/page.tsx',
      '(app)/magasin/page.tsx',
      '(marketing)/animal-public/[slug]/page.tsx',
    ];
    for (const file of files) {
      const src = fs.readFileSync(path.join(root, file), 'utf8');
      expect({ file, raw: /\b(?:err|error|e)\.message\b|res(?:ponse)?\??\.message|data as \{ message/.test(src) }).toEqual({ file, raw: false });
    }
  });
});
