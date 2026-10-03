import {
  ModerationMailData,
  frontendLocalePrefix,
  renderModerationDecision,
  renderReportDecision,
} from './moderation-mail';
import { decisionUrl } from './community-moderation.service';

const base: ModerationMailData = {
  action: 'HIDE',
  targetType: 'POST',
  reason: 'SPAM',
  statement: 'Publicité répétée pour un élevage <b>commercial</b>.',
  automated: false,
  excerpt: 'Achetez mes geckos',
  suspendedUntil: null,
  decisionUrl: 'https://captivia.example/communaute/decisions/abc',
  appealDeadline: new Date('2027-04-04T00:00:00Z'),
  contactEmail: 'moderation@captivia.example',
};

describe('renderModerationDecision (DSA art. 17)', () => {
  it('contient décision, motif, explication, recours et point de contact (fr)', () => {
    const mail = renderModerationDecision('fr', base);
    expect(mail.subject).toBe('Captivia : décision de modération');
    expect(mail.text).toContain('Votre publication a été masqué(e)');
    expect(mail.text).toContain('Motif : Spam ou publicité');
    expect(mail.text).toContain(base.statement);
    expect(mail.text).toContain('Contenu concerné : Achetez mes geckos');
    expect(mail.text).toContain(
      "contester cette décision gratuitement depuis l'application jusqu'au 4 avril 2027",
    );
    expect(mail.text).toContain(base.decisionUrl);
    expect(mail.text).toContain('règlement extrajudiciaire');
    expect(mail.text).toContain(
      'Point de contact : moderation@captivia.example',
    );
  });

  it('échappe le HTML de l’explication', () => {
    const mail = renderModerationDecision('fr', base);
    expect(mail.html).toContain('&lt;b&gt;commercial&lt;/b&gt;');
    expect(mail.html).not.toContain('<b>commercial</b>');
  });

  it('signale une décision automatisée (anglais)', () => {
    const mail = renderModerationDecision('en', {
      ...base,
      action: 'AUTO_HIDE',
      automated: true,
      contactEmail: null,
    });
    expect(mail.text).toContain('was hidden automatically');
    expect(mail.text).toContain('automated means');
    expect(mail.text).not.toContain('Point of contact');
  });

  it('un rétablissement n’ouvre pas de recours ; la réponse à un recours le précise', () => {
    const restored = renderModerationDecision('fr', {
      ...base,
      action: 'RESTORE',
      reason: null,
    });
    expect(restored.text).not.toContain('contester');
    const appeal = renderModerationDecision('fr', {
      ...base,
      appealOutcome: 'UPHELD',
    });
    expect(appeal.subject).toBe('Captivia : réponse à votre recours');
    expect(appeal.text).toContain('la décision est maintenue');
    expect(appeal.text).not.toContain('contester');
  });

  it('suspension : date de fin', () => {
    const mail = renderModerationDecision('fr', {
      ...base,
      action: 'SUSPEND',
      targetType: 'USER',
      excerpt: null,
      suspendedUntil: new Date('2026-10-10T00:00:00Z'),
    });
    expect(mail.text).toContain(
      "suspendue pour votre compte jusqu'au 10 octobre 2026",
    );
  });
});

describe('decisionUrl (page frontend de la décision)', () => {
  const prev = process.env.FRONTEND_URL;
  afterEach(() => {
    process.env.FRONTEND_URL = prev;
  });

  it('pointe vers /communaute/decisions/:id, préfixe de locale hors français', () => {
    process.env.FRONTEND_URL = 'https://app.captivia.example/';
    expect(decisionUrl('abc', 'fr')).toBe(
      'https://app.captivia.example/communaute/decisions/abc',
    );
    expect(decisionUrl('abc', null)).toBe(
      'https://app.captivia.example/communaute/decisions/abc',
    );
    expect(decisionUrl('abc', 'en')).toBe(
      'https://app.captivia.example/en/communaute/decisions/abc',
    );
    expect(decisionUrl('abc', 'de-DE')).toBe(
      'https://app.captivia.example/de/communaute/decisions/abc',
    );
  });

  it('ignore une locale inconnue du frontend', () => {
    expect(frontendLocalePrefix('xx')).toBe('');
    expect(frontendLocalePrefix('pt')).toBe('/pt');
    expect(frontendLocalePrefix(undefined)).toBe('');
  });
});

describe('renderReportDecision (DSA art. 16(5))', () => {
  const data = {
    targetType: 'POST' as const,
    reportReason: 'HATE' as const,
    reportedAt: new Date('2026-10-01T10:00:00Z'),
    action: 'HIDE' as const,
    contactEmail: 'moderation@captivia.example',
  };

  it('informe le signalant de la décision, sans extrait ni identité de l’auteur', () => {
    const mail = renderReportDecision('fr', data);
    expect(mail.subject).toBe('Captivia : suite donnée à votre signalement');
    expect(mail.text).toContain(
      'Vous avez signalé une publication le 1 octobre 2026 (motif : Discours haineux).',
    );
    expect(mail.text).toContain("l'équipe de modération a masqué ce contenu");
    expect(mail.text).toContain('règlement extrajudiciaire');
    expect(mail.text).toContain(
      'Point de contact : moderation@captivia.example',
    );
  });

  it('suppression, classement (anglais)', () => {
    expect(
      renderReportDecision('fr', { ...data, action: 'DELETE' }).text,
    ).toContain('a supprimé ce contenu');
    const kept = renderReportDecision('en', {
      ...data,
      targetType: 'COMMENT',
      action: 'DISMISS',
      contactEmail: null,
    });
    expect(kept.subject).toBe('Captivia: outcome of your report');
    expect(kept.text).toContain('You reported a comment');
    expect(kept.text).toContain('found no breach');
    expect(kept.text).not.toContain('Point of contact');
  });
});
