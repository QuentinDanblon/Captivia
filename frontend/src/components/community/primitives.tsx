'use client';

import { useState, type ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowLeft, PawPrint } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button, Modal, cx } from '@/components/ui';
import { formatLongDate, formatPostTime, isAllowedMediaUrl } from '@/lib/community';

export { useCommunityAvailability } from './useCommunityAvailability';

/**
 * Texte d'un membre, rendu en TEXTE BRUT : React échappe tout, les sauts de ligne sont conservés
 * par CSS, aucun lien n'est rendu cliquable (même une URL écrite en clair). Jamais de
 * `dangerouslySetInnerHTML` dans la communauté.
 */
export function PlainText({
  text,
  clamp = false,
  className,
  as: Element = 'p',
}: {
  text: string;
  /** Fil : coupé à 6 lignes (le détail montre tout). */
  clamp?: boolean;
  className?: string;
  as?: 'p' | 'div' | 'blockquote';
}) {
  return (
    <Element
      dir="auto"
      data-plain-text=""
      className={cx('m-0 whitespace-pre-line break-words [overflow-wrap:anywhere]', clamp && 'line-clamp-6', className)}
    >
      {text}
    </Element>
  );
}

/**
 * Avatar d'un membre : sa photo (si servie par l'origine des médias autorisée), sinon une patte au
 * trait sur papier creusé — jamais d'initiales. Décoratif : le pseudo est toujours écrit à côté.
 */
export function CommunityAvatar({ url, size = 32, className }: { url: string | null | undefined; size?: number; className?: string }) {
  const style = { width: size, height: size };
  // Image retirée ou masquée (404 côté serveur) : repli sur la patte, sans icône cassée.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (url && failedUrl !== url && isAllowedMediaUrl(url)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- avatar distant non optimisé (export statique mobile)
      <img
        src={url}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        onError={() => setFailedUrl(url)}
        className={cx('shrink-0 rounded-full border border-line object-cover', className)}
        style={style}
      />
    );
  }
  return (
    <span aria-hidden="true" className={cx('inline-flex shrink-0 items-center justify-center rounded-full border border-line bg-sunken text-ink-3', className)} style={style}>
      <PawPrint size={Math.round(size * 0.5)} strokeWidth={1.5} />
    </span>
  );
}

/** Date relative (« il y a 5 min ») avec la date complète en attribut et en infobulle. */
export function PostTime({ iso, className }: { iso: string; className?: string }) {
  const locale = useLocale();
  const t = useTranslations('community');
  const full = formatLongDate(iso, locale);
  return (
    <time dateTime={iso} title={full} className={cx('font-mono text-meta text-ink-2', className)} suppressHydrationWarning>
      {formatPostTime(iso, locale, t('time.justNow'))}
    </time>
  );
}

/** Retour vers une page parente, en tête de page (texte + flèche). */
export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex min-h-11 items-center gap-2 self-start text-ui font-medium text-accent-text no-underline hover:underline">
      <ArrowLeft size={16} aria-hidden="true" />
      {children}
    </Link>
  );
}

/** Confirmation d'une action destructive ou engageante (`alertdialog`). */
export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel,
  busy,
  tone = 'danger',
  onConfirm,
  onCancel,
  error,
}: {
  open: boolean;
  title: ReactNode;
  message: ReactNode;
  confirmLabel: ReactNode;
  busy: boolean;
  tone?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
  error?: ReactNode;
}) {
  const t = useTranslations('common');
  return (
    <Modal open={open} onClose={onCancel} title={title} description={message} variant="alertdialog" size="sm" dismissible={!busy} hideCloseButton>
      {error ? (
        <p role="alert" className="m-0 mb-4 text-ui font-medium text-danger">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Button variant={tone} onClick={onConfirm} loading={busy}>
          {confirmLabel}
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          {t('cancel')}
        </Button>
      </div>
    </Modal>
  );
}

/** Compteur de caractères d'un champ (mono, annoncé seulement près de la limite). */
export function CharCount({ value, max, id }: { value: string; max: number; id?: string }) {
  const t = useTranslations('community');
  const left = max - value.length;
  return (
    <span id={id} className={cx('font-mono text-meta', left < 0 ? 'text-danger' : 'text-ink-2')} aria-live={left <= 50 ? 'polite' : 'off'}>
      {t('form.charCount', { count: value.length, max })}
    </span>
  );
}
