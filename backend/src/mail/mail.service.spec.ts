import { Logger } from '@nestjs/common';
import { MAIL_MAX_ATTEMPTS, MailService } from './mail.service';
import {
  escapeHtml,
  renderCareReminder,
  renderPasswordReset,
  resolveMailLocale,
} from './mail.templates';

type Sendable = { sendMail: (opts: unknown) => Promise<unknown> };

describe('mail templates', () => {
  it('resolves the locale with an English fallback', () => {
    expect(resolveMailLocale('fr')).toBe('fr');
    expect(resolveMailLocale('fr-FR')).toBe('fr');
    expect(resolveMailLocale('EN_gb')).toBe('en');
    expect(resolveMailLocale('de')).toBe('en');
    expect(resolveMailLocale(undefined)).toBe('en');
  });

  it('escapes HTML special characters', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;',
    );
  });

  it('renders the password reset in French and English', () => {
    const link = 'https://app.example/reset-password?token=abc&x=1';
    const fr = renderPasswordReset('fr', link);
    expect(fr.subject).toMatch(/Réinitialisation/);
    expect(fr.text).toContain(link);
    expect(fr.html).toContain(
      'href="https://app.example/reset-password?token=abc&amp;x=1"',
    );
    expect(fr.html).toContain('lang="fr"');

    const en = renderPasswordReset('es', link);
    expect(en.subject).toBe('Reset your Captivia password');
    expect(en.html).toContain('lang="en"');
  });

  it('renders a care reminder with local time, escaped content and a one-line subject', () => {
    const mail = renderCareReminder('fr', {
      label: 'Bain <script>alert(1)</script>\r\nBcc: evil@x',
      animalName: 'Rex & "Co"',
      scheduledAt: new Date('2026-07-01T06:30:00Z'),
      timezone: 'Europe/Paris',
      appUrl: 'https://app.example',
    });
    expect(mail.subject).not.toMatch(/[\r\n]/);
    expect(mail.subject).toMatch(/^Rappel Captivia : Bain/);
    expect(mail.text).toContain('08:30');
    expect(mail.text).toContain('Rex & "Co"');
    expect(mail.html).not.toContain('<script>');
    expect(mail.html).toContain('&lt;script&gt;');
    expect(mail.html).toContain('Rex &amp; &quot;Co&quot;');
    expect(mail.html).toContain('href="https://app.example"');

    const en = renderCareReminder('en', {
      label: 'Feeding',
      scheduledAt: new Date('2026-07-01T06:30:00Z'),
      timezone: 'Not/AZone',
    });
    expect(en.subject).toBe('Captivia reminder: Feeding');
    expect(en.text).toContain('06:30'); // fuseau invalide → UTC
    expect(en.html).not.toContain('<a ');
  });
});

describe('MailService (jsonTransport)', () => {
  const OLD_ENV = process.env;
  let service: MailService;
  const logger = () => (service as unknown as { logger: Logger }).logger;
  const transport = () =>
    (service as unknown as { transporter: Sendable }).transporter;

  beforeEach(() => {
    process.env = { ...OLD_ENV };
    delete process.env.MAIL_HOST;
    process.env.MAIL_FROM = 'Captivia <noreply@captivia.test>';
    process.env.NODE_ENV = 'test';
    service = new MailService();
    service.retryDelaysMs = [0, 0];
  });
  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('serializes the message without SMTP and logs it at debug level outside production', async () => {
    const debug = jest.spyOn(logger(), 'debug').mockImplementation(() => {});
    const res = await service.sendPasswordReset(
      'user@example.com',
      'en',
      'http://localhost:3000/reset-password?token=t0k3n',
    );
    expect(res).toEqual({ sent: true, simulated: true, attempts: 1 });
    const logged = debug.mock.calls.flat().join(' ');
    expect(logged).toContain('user@example.com');
    expect(logged).toContain('noreply@captivia.test');
    expect(logged).toContain('reset-password?token=t0k3n');
  });

  it('never logs the message content in production', async () => {
    process.env.NODE_ENV = 'production';
    const spies = (['debug', 'log', 'warn', 'error'] as const).map((m) =>
      jest.spyOn(logger(), m).mockImplementation(() => {}),
    );
    await service.sendPasswordReset(
      'user@example.com',
      'fr',
      'https://app/reset-password?token=secret',
    );
    const logged = spies
      .flatMap((s) => s.mock.calls.flat() as unknown[])
      .join(' ');
    expect(logged).not.toContain('token=secret');
    expect(logged).not.toContain('user@example.com');
  });

  it('retries twice, then gives up without throwing', async () => {
    jest.spyOn(logger(), 'warn').mockImplementation(() => {});
    const error = jest.spyOn(logger(), 'error').mockImplementation(() => {});
    const sendMail = jest
      .spyOn(transport(), 'sendMail')
      .mockRejectedValue(new Error('SMTP down'));

    const res = await service.sendCareReminder('u@example.com', 'fr', {
      label: 'Bain',
      scheduledAt: new Date(),
      timezone: 'Europe/Paris',
    });

    expect(res.sent).toBe(false);
    expect(res.attempts).toBe(MAIL_MAX_ATTEMPTS);
    expect(sendMail).toHaveBeenCalledTimes(3);
    expect(error.mock.calls.flat().join(' ')).toContain('SMTP down');
  });

  it('succeeds on a retry after a transient failure', async () => {
    jest.spyOn(logger(), 'warn').mockImplementation(() => {});
    jest.spyOn(logger(), 'debug').mockImplementation(() => {});
    const t = transport();
    const real = t.sendMail.bind(t) as Sendable['sendMail'];
    jest
      .spyOn(transport(), 'sendMail')
      .mockRejectedValueOnce(new Error('ETIMEDOUT'))
      .mockImplementation(real);

    const res = await service.sendCareReminder('u@example.com', 'en', {
      label: 'Feeding',
      scheduledAt: new Date(),
      timezone: 'UTC',
    });
    expect(res).toEqual({ sent: true, simulated: true, attempts: 2 });
  });

  it('uses SMTP when MAIL_HOST is set', () => {
    process.env.MAIL_HOST = 'smtp.example.test';
    process.env.MAIL_PORT = '465';
    process.env.MAIL_SECURE = 'true';
    const smtp = new MailService();
    expect(smtp.simulated).toBe(false);
    const opts = (
      smtp as unknown as { transporter: { options: Record<string, unknown> } }
    ).transporter.options;
    expect(opts).toMatchObject({
      host: 'smtp.example.test',
      port: 465,
      secure: true,
    });
  });
});
