'use client';

/**
 * Pièces communes des sections de la fiche animal : liste d'entrées datées, actions en icône,
 * formulaire en modale, confirmation de suppression, états « chargement / erreur / réservé ».
 * Tout passe par les composants `ui/` et les jetons (aucune couleur brute, aucun `dark:`).
 */
import type { FormEvent, ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Pencil, Trash2, type LucideIcon } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Alert, Button, Modal, Skeleton, SkeletonGroup, buttonClasses, cx } from '@/components/ui';

/** Action d'une entrée, en icône : le libellé est lu (aria-label) et affiché au survol (title). */
export function IconAction({
  icon: Icon,
  label,
  onClick,
  disabled,
  loading,
  tone = 'default',
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  tone?: 'default' | 'danger';
}) {
  return (
    <Button
      variant="quiet"
      size="sm"
      onClick={onClick}
      disabled={disabled}
      loading={loading}
      aria-label={label}
      title={label}
      className={cx('min-w-9 px-0 pointer-coarse:min-w-11', tone === 'danger' ? 'text-danger hover:not-disabled:bg-danger-soft' : 'text-ink-2')}
    >
      {loading ? null : <Icon size={16} strokeWidth={1.75} aria-hidden="true" />}
    </Button>
  );
}

export function EditAction(props: { label: string; onClick: () => void; disabled?: boolean }) {
  return <IconAction icon={Pencil} {...props} />;
}

export function DeleteAction(props: { label: string; onClick: () => void; disabled?: boolean; loading?: boolean }) {
  return <IconAction icon={Trash2} tone="danger" {...props} />;
}

/** Liste d'entrées du carnet, séparées par des filets. */
export function RecordList({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <ul aria-label={label} className="m-0 grid list-none divide-y divide-line p-0">
      {children}
    </ul>
  );
}

/**
 * Une entrée : titre, pastilles, ligne de mesures (mono), notes, et actions à droite.
 * `muted` : entrée close (traitement arrêté, routine en pause).
 */
export function RecordItem({
  title,
  eyebrow,
  badges,
  meta,
  notes,
  actions,
  muted,
}: {
  title: ReactNode;
  eyebrow?: ReactNode;
  badges?: ReactNode;
  meta?: ReactNode;
  notes?: ReactNode;
  actions?: ReactNode;
  muted?: boolean;
}) {
  return (
    <li className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
      <div className={cx('grid min-w-0 flex-1 gap-0.5', muted && 'text-ink-2')}>
        {eyebrow ? <p className="m-0 text-meta font-medium text-accent-text">{eyebrow}</p> : null}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className={cx('m-0 font-sans text-body font-semibold', muted ? 'text-ink-2' : 'text-ink')}>{title}</h3>
          {badges}
        </div>
        {meta ? <p className="m-0 text-ui text-ink-2">{meta}</p> : null}
        {notes ? <p className="m-0 mt-1 line-clamp-2 text-ui text-ink-2">{notes}</p> : null}
      </div>
      {actions ? <div className="-mt-1 -mr-2 flex shrink-0 items-center">{actions}</div> : null}
    </li>
  );
}

/** Valeur chiffrée (date, dose, poids) : mono, chiffres tabulaires. */
export function Mono({ children }: { children: ReactNode }) {
  return <span className="font-mono text-ink">{children}</span>;
}

/** Message d'erreur d'un formulaire de section (jamais le message brut du backend). */
export function FormError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="m-0 text-ui font-medium text-danger">
      {children}
    </p>
  );
}

/** Chargement d'une section : gabarits à la forme des entrées. */
export function SectionLoading({ rows = 2 }: { rows?: number }) {
  const t = useTranslations();
  return (
    <SkeletonGroup label={t('common.loading')} className="grid gap-4">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="grid gap-2">
          <Skeleton width={`${55 - i * 10}%`} height={18} />
          <Skeleton width="35%" />
        </div>
      ))}
    </SkeletonGroup>
  );
}

/** Échec de chargement d'une section : le reste de la fiche reste utilisable. */
export function SectionError({ message }: { message: string }) {
  return <Alert severity="warning" title={message} />;
}

/** Section refusée par l'API (403) : la valeur, puis le chemin vers l'abonnement. */
export function LockedNote({ message }: { message: string }) {
  const t = useTranslations();
  return (
    <Alert
      severity="info"
      title={message}
      action={
        <Link href="/parametres/abonnement" className={buttonClasses({ variant: 'secondary', size: 'sm' })}>
          {t('premiumLock.goPremium')}
        </Link>
      }
    />
  );
}

/**
 * Formulaire de section en modale : titre, champs, puis « Enregistrer » (principal) et
 * « Annuler ». La modale reste ouverte pendant l'envoi (fermeture bloquée).
 */
export function FormDialog({
  open,
  title,
  description,
  onClose,
  onSubmit,
  submitting,
  error,
  children,
}: {
  open: boolean;
  title: ReactNode;
  description?: ReactNode;
  onClose: () => void;
  onSubmit: (e: FormEvent) => void;
  submitting: boolean;
  error?: string;
  children: ReactNode;
}) {
  const t = useTranslations();
  return (
    <Modal open={open} onClose={onClose} title={title} description={description} dismissible={!submitting} closeOnOverlayClick={false}>
      <form onSubmit={onSubmit} className="grid gap-4">
        {children}
        <FormError>{error}</FormError>
        <div className="flex flex-wrap gap-3 border-t border-line pt-4">
          <Button type="submit" loading={submitting}>
            {t('common.save')}
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            {t('common.cancel')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** Confirmation d'une suppression (alertdialog : ni clic extérieur, ni fermeture pendant l'envoi). */
export function ConfirmDelete({
  open,
  title,
  message,
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: ReactNode;
  message: ReactNode;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations();
  return (
    <Modal open={open} onClose={onCancel} title={title} description={message} variant="alertdialog" size="sm" dismissible={!busy} hideCloseButton>
      <div className="flex flex-wrap gap-3">
        <Button variant="danger" onClick={onConfirm} loading={busy}>
          {t('common.delete')}
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          {t('common.cancel')}
        </Button>
      </div>
    </Modal>
  );
}
