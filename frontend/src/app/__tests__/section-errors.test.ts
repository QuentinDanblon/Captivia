import fs from 'fs';
import path from 'path';
import { ApiError, BACKEND_UNAVAILABLE_MESSAGE } from '@/lib/api';
import { isPremiumLocked, sectionErrorKey } from '@/app/[locale]/(app)/mes-animaux/[id]/_components/sectionErrors';

/** Revue frontend, constat 15 : erreurs des sections traduites, jamais le message brut du backend. */
describe('sectionErrors', () => {
  it('403 = section Premium verrouillée (et rien d’autre)', () => {
    expect(isPremiumLocked(new ApiError(403, 'Forbidden'))).toBe(true);
    expect(isPremiumLocked(new ApiError(401, 'Unauthorized'))).toBe(false);
    expect(isPremiumLocked(new Error('403 premium'))).toBe(false);
  });

  it.each([
    [new ApiError(400, 'date must be a valid ISO 8601 date string'), 'animals.sectionErrors.invalid'],
    [new ApiError(422, 'x'), 'animals.sectionErrors.invalid'],
    [new ApiError(404, 'Not Found'), 'animals.sectionErrors.notFound'],
    [new ApiError(401, 'Unauthorized'), 'common.sessionExpired'],
    [new ApiError(500, 'Internal server error'), 'animals.sectionErrors.saveFailed'],
    [new Error(BACKEND_UNAVAILABLE_MESSAGE), 'animals.sectionErrors.unavailable'],
    ['boom', 'animals.sectionErrors.saveFailed'],
  ])('%p → %s', (err, key) => {
    expect(sectionErrorKey(err)).toBe(key);
  });

  it('chaque clé existe dans les 6 langues', () => {
    const keys = ['loadFailed', 'saveFailed', 'invalid', 'notFound', 'unavailable'];
    for (const locale of ['fr', 'en', 'es', 'de', 'it', 'pt']) {
      const messages = JSON.parse(
        fs.readFileSync(path.join(__dirname, '..', '..', '..', 'messages', `${locale}.json`), 'utf8'),
      );
      for (const key of keys) {
        expect(typeof messages.animals.sectionErrors[key]).toBe('string');
      }
      expect(typeof messages.common.sessionExpired).toBe('string');
    }
  });

  it('les sections n’affichent plus de message backend brut ni « Erreur » en dur', () => {
    const dir = path.join(__dirname, '..', '[locale]', '(app)', 'mes-animaux', '[id]', '_components');
    for (const file of [
      'BreedingSection.tsx',
      'HealthRecordsSection.tsx',
      'MeasurementsSection.tsx',
      'MedicationsSection.tsx',
      'VaccinationsSection.tsx',
      'VetAppointmentsSection.tsx',
    ]) {
      const src = fs.readFileSync(path.join(dir, file), 'utf8');
      expect(src).not.toMatch(/'Erreur'/);
      expect(src).not.toMatch(/Error\((?:err|msg)\b[^)]*\.message|FormError\(msg\)|Error\(err instanceof Error \? err\.message/);
      expect(src).not.toMatch(/toISOString\(\)\.slice\(0, ?10\)/);
    }
  });
});
