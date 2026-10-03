import {
  ModerationMailData,
  renderModerationDecision,
} from './moderation-mail';

const base: ModerationMailData = {
  action: 'HIDE',
  targetType: 'POST',
  reason: 'SPAM',
  statement: 'Publicité répétée pour un élevage <b>commercial</b>.',
  automated: false,
  excerpt: 'Achetez mes geckos',
  suspendedUntil: null,
  decisionUrl: 'https://captivia.example/community/decisions/abc',
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
