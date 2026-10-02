/**
 * Gabarits d'e-mails transactionnels (W3-01) : texte + HTML, localisés (fr, en ; repli en).
 * Toute donnée interpolée dans le HTML passe par `escapeHtml`.
 */

export type MailLocale = 'fr' | 'en';

export interface RenderedMail {
  subject: string;
  text: string;
  html: string;
}

export interface CareReminderData {
  /** Libellé de l'événement (ex. « Nourrissage », « 💊 Vermifuge (1 ml) »). */
  label: string;
  animalName?: string | null;
  scheduledAt: Date;
  /** Fuseau IANA de l'utilisateur, pour afficher l'heure locale. */
  timezone: string;
  /** URL de l'application (lien « Ouvrir Captivia »), facultative. */
  appUrl?: string | null;
}

const SUPPORTED: readonly MailLocale[] = ['fr', 'en'];

/** `fr`, `fr-FR`, `FR_ca` → `fr` ; inconnu ou absent → `en`. */
export function resolveMailLocale(locale?: string | null): MailLocale {
  const base = (locale ?? '').trim().toLowerCase().split(/[-_]/)[0];
  return (SUPPORTED as readonly string[]).includes(base)
    ? (base as MailLocale)
    : 'en';
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value: string | null | undefined): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

/** Un sujet d'e-mail tient sur une ligne (pas d'injection d'en-tête) et reste court. */
function oneLine(value: string, max = 150): string {
  return value
    .replace(/[\r\n\t]+/g, ' ')
    .trim()
    .slice(0, max);
}

function layout(lang: MailLocale, bodyHtml: string): string {
  return (
    `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"></head>` +
    `<body style="font-family:Arial,Helvetica,sans-serif;color:#1f2933;line-height:1.5">` +
    `${bodyHtml}<p style="color:#6b7280;font-size:12px">Captivia</p></body></html>`
  );
}

const RESET_TEXT: Record<
  MailLocale,
  {
    subject: string;
    hello: string;
    intro: string;
    expiry: string;
    ignore: string;
    sign: string;
  }
> = {
  fr: {
    subject: 'Réinitialisation de votre mot de passe Captivia',
    hello: 'Bonjour,',
    intro:
      'Cliquez sur le lien suivant pour réinitialiser votre mot de passe :',
    expiry: 'Ce lien expire dans 1 heure.',
    ignore:
      "Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.",
    sign: "L'équipe Captivia",
  },
  en: {
    subject: 'Reset your Captivia password',
    hello: 'Hello,',
    intro: 'Click the following link to reset your password:',
    expiry: 'This link expires in 1 hour.',
    ignore: "If you didn't request this, you can ignore this email.",
    sign: 'The Captivia team',
  },
};

export function renderPasswordReset(
  locale: string | null | undefined,
  resetLink: string,
): RenderedMail {
  const lang = resolveMailLocale(locale);
  const t = RESET_TEXT[lang];
  const link = escapeHtml(resetLink);
  return {
    subject: t.subject,
    text: `${t.hello}\n\n${t.intro}\n${resetLink}\n\n${t.expiry}\n${t.ignore}\n\n${t.sign}`,
    html: layout(
      lang,
      `<p>${t.hello}</p><p>${t.intro}</p><p><a href="${link}">${link}</a></p>` +
        `<p>${t.expiry}<br>${t.ignore}</p><p>${t.sign}</p>`,
    ),
  };
}

const REMINDER_TEXT: Record<
  MailLocale,
  {
    subject: (label: string) => string;
    line: (label: string, time: string, animal?: string) => string;
    open: string;
    footer: string;
  }
> = {
  fr: {
    subject: (label) => `Rappel Captivia : ${label}`,
    line: (label, time, animal) =>
      `C'est l'heure : ${label}${animal ? ` pour ${animal}` : ''} (${time}).`,
    open: 'Ouvrir Captivia',
    footer:
      'Vous recevez cet e-mail car les rappels par e-mail sont activés dans vos préférences de notification.',
  },
  en: {
    subject: (label) => `Captivia reminder: ${label}`,
    line: (label, time, animal) =>
      `It's time: ${label}${animal ? ` for ${animal}` : ''} (${time}).`,
    open: 'Open Captivia',
    footer:
      'You receive this email because email reminders are enabled in your notification preferences.',
  },
};

/** Heure locale « HH:mm » dans le fuseau donné (repli UTC si le fuseau est invalide). */
export function formatLocalTime(
  date: Date,
  timezone: string,
  lang: MailLocale,
): string {
  const opts: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  };
  try {
    return new Intl.DateTimeFormat(lang, {
      ...opts,
      timeZone: timezone,
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat(lang, { ...opts, timeZone: 'UTC' }).format(
      date,
    );
  }
}

export function renderCareReminder(
  locale: string | null | undefined,
  data: CareReminderData,
): RenderedMail {
  const lang = resolveMailLocale(locale);
  const t = REMINDER_TEXT[lang];
  const label = oneLine(data.label || '', 120);
  const animal = data.animalName ? oneLine(data.animalName, 80) : undefined;
  const time = formatLocalTime(data.scheduledAt, data.timezone, lang);
  const appUrl = data.appUrl?.trim() || null;

  const textLines = [t.line(label, time, animal)];
  if (appUrl) {
    textLines.push('', `${t.open}${lang === 'fr' ? ' :' : ':'} ${appUrl}`);
  }
  textLines.push('', t.footer);

  const htmlLine = escapeHtml(t.line(label, time, animal));
  const htmlLink = appUrl
    ? `<p><a href="${escapeHtml(appUrl)}">${escapeHtml(t.open)}</a></p>`
    : '';
  return {
    subject: oneLine(t.subject(label)),
    text: textLines.join('\n'),
    html: layout(
      lang,
      `<p>${htmlLine}</p>${htmlLink}<p style="color:#6b7280;font-size:12px">${escapeHtml(t.footer)}</p>`,
    ),
  };
}
