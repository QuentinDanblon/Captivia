import {
  CommunityModerationActionType,
  CommunityModerationTarget,
  CommunityReason,
} from '@prisma/client';
import {
  MailLocale,
  RenderedMail,
  escapeHtml,
  resolveMailLocale,
} from '../mail/mail.templates';

/**
 * Notification d'une décision de modération à l'auteur (DSA art. 17 : exposé des motifs).
 * Contenu : décision, contenu visé (extrait), motif (liste fermée), explication de l'opérateur,
 * mention d'une décision automatisée, voies de recours (recours interne dans l'application,
 * règlement extrajudiciaire, juridiction) et point de contact.
 */
export interface ModerationMailData {
  action: CommunityModerationActionType;
  targetType: CommunityModerationTarget;
  reason: CommunityReason | null;
  statement: string;
  automated: boolean;
  excerpt: string | null;
  suspendedUntil: Date | null;
  /** Page de la décision (lecture et recours). */
  decisionUrl: string;
  appealDeadline: Date | null;
  contactEmail: string | null;
  /** Issue d'un recours (notification de la réponse au recours). */
  appealOutcome?: 'UPHELD' | 'REVERSED';
}

const REASONS: Record<MailLocale, Record<CommunityReason, string>> = {
  fr: {
    SPAM: 'Spam ou publicité',
    HARASSMENT: 'Harcèlement ou intimidation',
    HATE: 'Discours haineux',
    VIOLENCE: 'Violence ou menace',
    ANIMAL_WELFARE: 'Maltraitance animale',
    ILLEGAL_TRADE: "Commerce illégal d'animaux ou d'espèces protégées",
    DANGEROUS_ADVICE: 'Conseil dangereux pour la santé des animaux',
    NUDITY: 'Contenu sexuel ou nudité',
    PERSONAL_DATA: 'Divulgation de données personnelles',
    IMPERSONATION: "Usurpation d'identité",
    OTHER: 'Autre manquement aux règles de la communauté',
  },
  en: {
    SPAM: 'Spam or advertising',
    HARASSMENT: 'Harassment or bullying',
    HATE: 'Hate speech',
    VIOLENCE: 'Violence or threats',
    ANIMAL_WELFARE: 'Animal cruelty',
    ILLEGAL_TRADE: 'Illegal trade in animals or protected species',
    DANGEROUS_ADVICE: 'Advice that endangers animal health',
    NUDITY: 'Sexual content or nudity',
    PERSONAL_DATA: 'Disclosure of personal data',
    IMPERSONATION: 'Impersonation',
    OTHER: 'Other breach of the community rules',
  },
};

export function reasonLabel(
  reason: CommunityReason | null,
  locale?: string | null,
): string | null {
  return reason ? REASONS[resolveMailLocale(locale)][reason] : null;
}

const T = {
  fr: {
    subject: 'Captivia : décision de modération',
    appealSubject: 'Captivia : réponse à votre recours',
    hello: 'Bonjour,',
    target: {
      POST: 'votre publication',
      COMMENT: 'votre commentaire',
      USER: 'votre compte',
    },
    decision: (
      a: CommunityModerationActionType,
      target: string,
      until: string | null,
    ) =>
      ({
        AUTO_HIDE: `${capital(target)} a été masqué(e) automatiquement après plusieurs signalements, en attendant l'examen d'un modérateur.`,
        HIDE: `${capital(target)} a été masqué(e) par l'équipe de modération.`,
        DELETE: `${capital(target)} a été supprimé(e) par l'équipe de modération.`,
        RESTORE: `${capital(target)} a été rétabli(e) après examen.`,
        DISMISS: `Les signalements visant ${target} ont été classés sans suite.`,
        SUSPEND: `La publication dans la communauté est suspendue pour votre compte${until ? ` jusqu'au ${until}` : ''}.`,
        UNSUSPEND: 'La suspension de publication de votre compte est levée.',
      })[a],
    excerpt: 'Contenu concerné',
    reason: 'Motif',
    statement: 'Explication',
    automated:
      'Cette décision a été prise par un moyen automatisé (seuil de signalements distincts) ; elle sera revue par une personne sur demande.',
    appeal: (deadline: string | null) =>
      `Vous pouvez contester cette décision gratuitement depuis l'application${deadline ? ` jusqu'au ${deadline}` : ''} :`,
    appealOutcome: {
      UPHELD: 'Après un nouvel examen, la décision est maintenue.',
      REVERSED: 'Après un nouvel examen, la décision est annulée.',
    },
    other:
      'Vous pouvez aussi recourir à un organe de règlement extrajudiciaire des litiges certifié (règlement européen sur les services numériques, art. 21) ou saisir la juridiction compétente.',
    contact: (email: string) => `Point de contact : ${email}`,
    sign: "L'équipe Captivia",
  },
  en: {
    subject: 'Captivia: moderation decision',
    appealSubject: 'Captivia: response to your appeal',
    hello: 'Hello,',
    target: {
      POST: 'your post',
      COMMENT: 'your comment',
      USER: 'your account',
    },
    decision: (
      a: CommunityModerationActionType,
      target: string,
      until: string | null,
    ) =>
      ({
        AUTO_HIDE: `${capital(target)} was hidden automatically after several reports, pending review by a moderator.`,
        HIDE: `${capital(target)} was hidden by the moderation team.`,
        DELETE: `${capital(target)} was removed by the moderation team.`,
        RESTORE: `${capital(target)} was restored after review.`,
        DISMISS: `The reports about ${target} were dismissed.`,
        SUSPEND: `Posting in the community is suspended for your account${until ? ` until ${until}` : ''}.`,
        UNSUSPEND: 'The posting suspension on your account has been lifted.',
      })[a],
    excerpt: 'Content concerned',
    reason: 'Reason',
    statement: 'Explanation',
    automated:
      'This decision was taken by automated means (threshold of distinct reports); a person will review it on request.',
    appeal: (deadline: string | null) =>
      `You can appeal this decision free of charge from the app${deadline ? ` until ${deadline}` : ''}:`,
    appealOutcome: {
      UPHELD: 'After a new review, the decision is upheld.',
      REVERSED: 'After a new review, the decision is reversed.',
    },
    other:
      'You may also use a certified out-of-court dispute settlement body (EU Digital Services Act, art. 21) or bring the matter before the competent court.',
    contact: (email: string) => `Point of contact: ${email}`,
    sign: 'The Captivia team',
  },
} as const;

function capital(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function day(d: Date | null, lang: MailLocale): string | null {
  if (!d) return null;
  return d.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** Une décision défavorable ouvre droit au recours interne (DSA art. 20). */
export const APPEALABLE_ACTIONS: readonly CommunityModerationActionType[] = [
  'AUTO_HIDE',
  'HIDE',
  'DELETE',
  'SUSPEND',
];

export function renderModerationDecision(
  locale: string | null | undefined,
  d: ModerationMailData,
): RenderedMail {
  const lang = resolveMailLocale(locale);
  const t = T[lang];
  const lines: string[] = [];
  if (d.appealOutcome) lines.push(t.appealOutcome[d.appealOutcome]);
  lines.push(
    t.decision(d.action, t.target[d.targetType], day(d.suspendedUntil, lang)),
  );
  const fields: [string, string][] = [];
  if (d.excerpt) fields.push([t.excerpt, d.excerpt]);
  const reason = reasonLabel(d.reason, lang);
  if (reason) fields.push([t.reason, reason]);
  fields.push([t.statement, d.statement]);
  const appealable = !d.appealOutcome && APPEALABLE_ACTIONS.includes(d.action);
  const tail: string[] = [];
  if (d.automated) tail.push(t.automated);
  if (appealable) tail.push(t.appeal(day(d.appealDeadline, lang)));
  const after: string[] = [];
  if (appealable || d.appealOutcome === 'UPHELD') after.push(t.other);
  if (d.contactEmail) after.push(t.contact(d.contactEmail));

  const text = [
    t.hello,
    '',
    ...lines,
    '',
    ...fields.map(([k, v]) => `${k} : ${v}`),
    '',
    ...tail,
    ...(appealable ? [d.decisionUrl] : []),
    ...(after.length ? ['', ...after] : []),
    '',
    t.sign,
  ].join('\n');

  const html =
    `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"></head>` +
    `<body style="font-family:Arial,Helvetica,sans-serif;color:#1f2933;line-height:1.5">` +
    `<p>${t.hello}</p>` +
    lines.map((l) => `<p>${escapeHtml(l)}</p>`).join('') +
    `<ul>${fields
      .map(
        ([k, v]) =>
          `<li><strong>${escapeHtml(k)}</strong> : ${escapeHtml(v)}</li>`,
      )
      .join('')}</ul>` +
    tail.map((l) => `<p>${escapeHtml(l)}</p>`).join('') +
    (appealable
      ? `<p><a href="${escapeHtml(d.decisionUrl)}">${escapeHtml(d.decisionUrl)}</a></p>`
      : '') +
    after.map((l) => `<p style="color:#6b7280">${escapeHtml(l)}</p>`).join('') +
    `<p>${t.sign}</p><p style="color:#6b7280;font-size:12px">Captivia</p></body></html>`;

  return {
    subject: d.appealOutcome ? t.appealSubject : t.subject,
    text,
    html,
  };
}

/** Locales du frontend (`frontend/i18n/routing.ts`) ; « fr » (défaut) n'a pas de préfixe. */
const FRONTEND_LOCALES: readonly string[] = [
  'fr',
  'en',
  'es',
  'de',
  'it',
  'pt',
];
const FRONTEND_DEFAULT_LOCALE = 'fr';

/**
 * Préfixe de locale d'un lien vers le frontend (next-intl, `localePrefix: 'as-needed'`) : aucun
 * pour le français (locale par défaut), `/<locale>` pour les autres locales prises en charge.
 */
export function frontendLocalePrefix(
  locale: string | null | undefined,
): string {
  const lang = (locale ?? '').trim().toLowerCase().slice(0, 2);
  return FRONTEND_LOCALES.includes(lang) && lang !== FRONTEND_DEFAULT_LOCALE
    ? `/${lang}`
    : '';
}

/**
 * Notification à l'auteur d'un signalement de la décision prise (DSA art. 16(5)) : type du
 * contenu visé (ni extrait ni pseudo de l'auteur), motif du signalement, décision, voies de
 * recours et point de contact.
 */
export interface ReportDecisionMailData {
  targetType: 'POST' | 'COMMENT';
  reportReason: CommunityReason;
  reportedAt: Date;
  /** HIDE / DELETE : contenu retiré ; RESTORE / DISMISS : aucun manquement retenu. */
  action: CommunityModerationActionType;
  contactEmail: string | null;
}

const R = {
  fr: {
    subject: 'Captivia : suite donnée à votre signalement',
    hello: 'Bonjour,',
    target: { POST: 'une publication', COMMENT: 'un commentaire' },
    reported: (target: string, date: string, reason: string) =>
      `Vous avez signalé ${target} le ${date} (motif : ${reason}).`,
    hidden: "Après examen, l'équipe de modération a masqué ce contenu.",
    removed: "Après examen, l'équipe de modération a supprimé ce contenu.",
    kept: "Après examen, l'équipe de modération n'a pas retenu de manquement aux règles de la communauté : le contenu reste visible.",
    follow:
      "Le suivi de vos signalements est disponible dans l'application (Communauté, « Mes signalements »).",
    other:
      'Si vous contestez cette décision, vous pouvez écrire au point de contact, recourir à un organe de règlement extrajudiciaire des litiges certifié (règlement européen sur les services numériques, art. 21) ou saisir la juridiction compétente.',
    contact: (email: string) => `Point de contact : ${email}`,
    sign: "L'équipe Captivia",
  },
  en: {
    subject: 'Captivia: outcome of your report',
    hello: 'Hello,',
    target: { POST: 'a post', COMMENT: 'a comment' },
    reported: (target: string, date: string, reason: string) =>
      `You reported ${target} on ${date} (reason: ${reason}).`,
    hidden: 'After review, the moderation team hid this content.',
    removed: 'After review, the moderation team removed this content.',
    kept: 'After review, the moderation team found no breach of the community rules: the content remains visible.',
    follow: 'You can follow your reports in the app (Community, “My reports”).',
    other:
      'If you disagree with this decision, you may write to the point of contact, use a certified out-of-court dispute settlement body (EU Digital Services Act, art. 21) or bring the matter before the competent court.',
    contact: (email: string) => `Point of contact: ${email}`,
    sign: 'The Captivia team',
  },
} as const;

export function renderReportDecision(
  locale: string | null | undefined,
  d: ReportDecisionMailData,
): RenderedMail {
  const lang = resolveMailLocale(locale);
  const t = R[lang];
  const outcome =
    d.action === 'DELETE'
      ? t.removed
      : d.action === 'HIDE' || d.action === 'AUTO_HIDE'
        ? t.hidden
        : t.kept;
  const lines = [
    t.reported(
      t.target[d.targetType],
      day(d.reportedAt, lang) ?? '',
      reasonLabel(d.reportReason, lang) ?? '',
    ),
    outcome,
    t.follow,
  ];
  const after = [
    t.other,
    ...(d.contactEmail ? [t.contact(d.contactEmail)] : []),
  ];
  const text = [t.hello, '', ...lines, '', ...after, '', t.sign].join('\n');
  const html =
    `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"></head>` +
    `<body style="font-family:Arial,Helvetica,sans-serif;color:#1f2933;line-height:1.5">` +
    `<p>${t.hello}</p>` +
    lines.map((l) => `<p>${escapeHtml(l)}</p>`).join('') +
    after.map((l) => `<p style="color:#6b7280">${escapeHtml(l)}</p>`).join('') +
    `<p>${t.sign}</p><p style="color:#6b7280;font-size:12px">Captivia</p></body></html>`;
  return { subject: t.subject, text, html };
}
