import { envValidationSchema, isExampleJwtSecret } from './env.validation';

const STRONG_SECRET = 'k3Jf9sLq2Zx8Vb7Nm1Pw4Rt6Yu0Io5Ae3Dg7Hh9Jk2L';

function validate(env: Record<string, unknown>) {
  const result = envValidationSchema.validate(env, {
    allowUnknown: true,
    abortEarly: false,
  });
  return { ...result, value: result.value as Record<string, unknown> };
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

    it('communauté : désactivée par défaut ; activée, elle exige le pilote s3 complet', () => {
      expect(validate(baseProd).value.COMMUNITY_ENABLED).toBe('false');
      expect(validate(baseProd).value.MEDIA_DRIVER).toBe('local');
      expect(
        validate({ ...baseProd, COMMUNITY_ENABLED: 'true' }).error?.message,
      ).toContain('MEDIA_DRIVER');
      expect(
        validate({
          ...baseProd,
          COMMUNITY_ENABLED: 'true',
          MEDIA_DRIVER: 'local',
        }).error?.message,
      ).toContain('MEDIA_DRIVER');
      const missing = validate({
        ...baseProd,
        COMMUNITY_ENABLED: 'true',
        MEDIA_DRIVER: 's3',
      }).error?.message;
      for (const name of [
        'MEDIA_PUBLIC_BASE_URL',
        'MEDIA_BUCKET',
        'S3_ACCESS_KEY_ID',
        'S3_SECRET_ACCESS_KEY',
      ]) {
        expect(missing).toContain(name);
      }
      const ok = validate({
        ...baseProd,
        COMMUNITY_ENABLED: 'true',
        MEDIA_DRIVER: 's3',
        MEDIA_BUCKET: 'captivia-media',
        MEDIA_PUBLIC_BASE_URL: 'https://media.captivia.example',
        S3_ENDPOINT: 'https://acc.r2.cloudflarestorage.com',
        S3_ACCESS_KEY_ID: 'key',
        S3_SECRET_ACCESS_KEY: 'secret',
      });
      expect(ok.error).toBeUndefined();
      expect(ok.value).toMatchObject({
        S3_REGION: 'auto',
        COMMUNITY_HIDE_THRESHOLD: 3,
        COMMUNITY_REPORT_MIN_ACCOUNT_AGE_DAYS: 7,
        COMMUNITY_POSTS_PER_HOUR: 5,
        COMMUNITY_COMMENTS_PER_MINUTE: 5,
        MEDIA_MAX_BYTES: 8 * 1024 * 1024,
      });
    });

    it('communauté : bornes des réglages anti-abus', () => {
      expect(
        validate({ ...baseProd, COMMUNITY_HIDE_THRESHOLD: 0 }).error?.message,
      ).toContain('COMMUNITY_HIDE_THRESHOLD');
      expect(
        validate({ ...baseProd, COMMUNITY_REPORT_MIN_ACCOUNT_AGE_DAYS: -1 })
          .error?.message,
      ).toContain('COMMUNITY_REPORT_MIN_ACCOUNT_AGE_DAYS');
      expect(
        validate({ ...baseProd, MEDIA_MAX_BYTES: 50 * 1024 * 1024 }).error
          ?.message,
      ).toContain('MEDIA_MAX_BYTES');
      expect(
        validate({ ...baseProd, COMMUNITY_CONTACT_EMAIL: 'pas-un-email' }).error
          ?.message,
      ).toContain('COMMUNITY_CONTACT_EMAIL');
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
