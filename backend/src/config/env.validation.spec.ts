/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- tests : mocks axios/supertest typés any */
import { envValidationSchema, isExampleJwtSecret } from './env.validation';

const STRONG_SECRET = 'k3Jf9sLq2Zx8Vb7Nm1Pw4Rt6Yu0Io5Ae3Dg7Hh9Jk2L';

function validate(env: Record<string, unknown>) {
  return envValidationSchema.validate(env, {
    allowUnknown: true,
    abortEarly: false,
  });
}

const baseProd = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  JWT_SECRET: STRONG_SECRET,
  CORS_ORIGIN: 'https://captivia.example',
  FRONTEND_URL: 'https://captivia.example',
};

describe('envValidationSchema', () => {
  describe('production', () => {
    it('accepte une configuration complète', () => {
      const { error } = validate(baseProd);
      expect(error).toBeUndefined();
    });

    it.each([
      'dev-only-change-me-captivia-docker-secret-32-chars',
      'change-me-to-a-strong-random-secret-at-least-32-chars',
      'dev-only-' + 'x'.repeat(40),
      'change-me-' + 'x'.repeat(40),
      'CHANGE-ME-' + 'x'.repeat(40),
    ])("refuse le secret d'exemple %s", (secret) => {
      const { error } = validate({ ...baseProd, JWT_SECRET: secret });
      expect(error).toBeDefined();
      expect(error!.message).toContain('JWT_SECRET');
    });

    it('refuse un JWT_SECRET de moins de 32 caractères', () => {
      const { error } = validate({ ...baseProd, JWT_SECRET: 'a'.repeat(31) });
      expect(error?.message).toContain('JWT_SECRET');
    });

    it('IAP_ENABLED=true exige REVENUECAT_WEBHOOK_SECRET (≥ 32) ; sinon facultatif (W6-08)', () => {
      expect(validate(baseProd).error).toBeUndefined();
      expect(
        validate({ ...baseProd, IAP_ENABLED: 'true' }).error?.message,
      ).toContain('REVENUECAT_WEBHOOK_SECRET');
      expect(
        validate({
          ...baseProd,
          IAP_ENABLED: 'true',
          REVENUECAT_WEBHOOK_SECRET: 'short',
        }).error?.message,
      ).toContain('REVENUECAT_WEBHOOK_SECRET');
      expect(
        validate({
          ...baseProd,
          IAP_ENABLED: 'true',
          REVENUECAT_WEBHOOK_SECRET: STRONG_SECRET,
        }).error,
      ).toBeUndefined();
    });

    it('accepte un JWT_SECRET de 32 caractères', () => {
      const { error } = validate({ ...baseProd, JWT_SECRET: 'a1'.repeat(16) });
      expect(error).toBeUndefined();
    });

    it('exige CORS_ORIGIN et FRONTEND_URL', () => {
      const { CORS_ORIGIN, FRONTEND_URL, ...rest } = baseProd;
      void CORS_ORIGIN;
      void FRONTEND_URL;
      const { error } = validate(rest);
      expect(error?.message).toContain('CORS_ORIGIN');
      expect(error?.message).toContain('FRONTEND_URL');
    });

    it('exige FRONTEND_URL en https (http toléré seulement sur loopback)', () => {
      expect(
        validate({ ...baseProd, FRONTEND_URL: 'http://captivia.example' }).error
          ?.message,
      ).toContain('FRONTEND_URL');
      expect(
        validate({ ...baseProd, FRONTEND_URL: 'not a url' }).error?.message,
      ).toContain('FRONTEND_URL');
      expect(
        validate({ ...baseProd, FRONTEND_URL: 'http://localhost:3000' }).error,
      ).toBeUndefined();
    });

    it('PUBLIC_WEB_URL est optionnel mais doit être une URI', () => {
      expect(
        validate({ ...baseProd, PUBLIC_WEB_URL: 'https://captivia.example' })
          .error,
      ).toBeUndefined();
      expect(
        validate({ ...baseProd, PUBLIC_WEB_URL: 'nope' }).error?.message,
      ).toContain('PUBLIC_WEB_URL');
    });
  });

  describe('hors production', () => {
    it.each(['development', 'test', undefined])(
      "accepte les valeurs d'exemple (NODE_ENV=%s)",
      (nodeEnv) => {
        const { error } = validate({
          NODE_ENV: nodeEnv,
          DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
          JWT_SECRET: 'dev-only-change-me-captivia-docker-secret-32-chars',
        });
        expect(error).toBeUndefined();
      },
    );

    it('conserve le minimum de 16 caractères', () => {
      const env = { DATABASE_URL: 'postgresql://u:p@localhost:5432/db' };
      expect(
        validate({ ...env, JWT_SECRET: 'a'.repeat(15) }).error?.message,
      ).toContain('JWT_SECRET');
      expect(
        validate({ ...env, JWT_SECRET: 'a'.repeat(16) }).error,
      ).toBeUndefined();
    });

    it('applique NODE_ENV=development par défaut', () => {
      const { value } = validate({
        DATABASE_URL: 'x',
        JWT_SECRET: 'a'.repeat(16),
      });
      expect(value.NODE_ENV).toBe('development');
    });

    it('refuse un NODE_ENV inconnu', () => {
      const { error } = validate({
        NODE_ENV: 'prod',
        DATABASE_URL: 'x',
        JWT_SECRET: 'a'.repeat(16),
      });
      expect(error?.message).toContain('NODE_ENV');
    });
  });

  describe('TRUST_PROXY', () => {
    it.each(['true', 'false', '1', '2'])('accepte %s', (value) => {
      const { error } = validate({ ...baseProd, TRUST_PROXY: value });
      expect(error).toBeUndefined();
    });

    it('refuse une valeur invalide', () => {
      expect(validate({ ...baseProd, TRUST_PROXY: 'yes' }).error).toBeDefined();
    });
  });

  describe('GUEST_RETENTION_DAYS (mode invité)', () => {
    it('vaut 90 par défaut et accepte un entier de 1 à 3650', () => {
      expect(validate(baseProd).value.GUEST_RETENTION_DAYS).toBe(90);
      expect(
        validate({ ...baseProd, GUEST_RETENTION_DAYS: '30' }).value
          .GUEST_RETENTION_DAYS,
      ).toBe(30);
    });

    it.each(['0', '-1', '1.5', 'abc', '4000'])('refuse %s', (value) => {
      const { error } = validate({ ...baseProd, GUEST_RETENTION_DAYS: value });
      expect(error?.message).toContain('GUEST_RETENTION_DAYS');
    });
  });

  describe('intégrations externes (W3-05) : variables optionnelles', () => {
    it('SPECIESPLUS_API_TOKEN, NCBI_API_KEY et NCBI_EMAIL sont facultatifs (absents ou vides)', () => {
      expect(validate(baseProd).error).toBeUndefined();
      const empty = validate({
        ...baseProd,
        SPECIESPLUS_API_TOKEN: '',
        NCBI_API_KEY: '',
        NCBI_EMAIL: '',
      });
      expect(empty.error).toBeUndefined();
    });

    it('accepte des valeurs renseignées', () => {
      const { error, value } = validate({
        ...baseProd,
        SPECIESPLUS_API_TOKEN: 'jeton',
        NCBI_API_KEY: 'cle',
        NCBI_EMAIL: 'contact@example.test',
      });
      expect(error).toBeUndefined();
      expect(value.SPECIESPLUS_API_TOKEN).toBe('jeton');
    });
  });

  describe('isExampleJwtSecret', () => {
    it("détecte les valeurs d'exemple et laisse passer un vrai secret", () => {
      expect(isExampleJwtSecret('dev-only-anything')).toBe(true);
      expect(isExampleJwtSecret('change-me-anything')).toBe(true);
      expect(isExampleJwtSecret(STRONG_SECRET)).toBe(false);
    });
  });
});
