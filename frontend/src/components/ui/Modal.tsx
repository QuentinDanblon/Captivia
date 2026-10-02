'use client';

import { ReactNode, RefObject, useLayoutEffect, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useTranslations } from 'next-intl';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

const SIZE_CLASSES: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
};

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** Titre obligatoire : il nomme la modale pour les lecteurs d'écran (aria-labelledby). */
  title: ReactNode;
  /** Texte descriptif optionnel, relié par aria-describedby. */
  description?: ReactNode;
  children?: ReactNode;
  /** Largeur maximale du contenu (défaut : lg). */
  size?: ModalSize;
  /**
   * `alertdialog` pour les confirmations destructives : le clic extérieur ne ferme plus la modale
   * et le lecteur d'écran annonce immédiatement le message.
   */
  variant?: 'dialog' | 'alertdialog';
  /** Autorise la fermeture par Échap, clic extérieur et bouton « Fermer » (false pendant un envoi). */
  dismissible?: boolean;
  /** Autorise le clic sur le fond pour fermer (défaut : true, toujours false pour alertdialog). */
  closeOnOverlayClick?: boolean;
  /** Masque la croix de fermeture quand la modale a ses propres boutons. */
  hideCloseButton?: boolean;
  /** Élément à focaliser à l'ouverture (défaut : premier élément focusable). */
  initialFocusRef?: RefObject<HTMLElement | null>;
  className?: string;
  titleClassName?: string;
  descriptionClassName?: string;
}

/**
 * Modale accessible basée sur Radix Dialog : focus piégé, Échap, aria-labelledby/describedby,
 * retour du focus à l'élément déclencheur et blocage du scroll de la page.
 */
export default function Modal({
  open,
  onClose,
  title,
  description,
  children,
  size = 'lg',
  variant = 'dialog',
  dismissible = true,
  closeOnOverlayClick = true,
  hideCloseButton = false,
  initialFocusRef,
  className = '',
  titleClassName = 'text-lg font-semibold mb-4 text-gray-900 dark:text-white',
  descriptionClassName = 'text-sm text-gray-600 dark:text-gray-300 mb-4',
}: ModalProps) {
  const t = useTranslations('common');
  const isAlert = variant === 'alertdialog';

  // Radix ne rend le focus qu'à un Dialog.Trigger : on mémorise l'élément actif à l'ouverture
  // (avant que Radix ne déplace le focus) pour le restaurer à la fermeture.
  const returnFocusRef = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (open) returnFocusRef.current = document.activeElement as HTMLElement | null;
  }, [open]);

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && dismissible && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-in fade-in" />
        <Dialog.Content
          role={isAlert ? 'alertdialog' : 'dialog'}
          // Sans description, on neutralise aria-describedby pour éviter un lien vers un id inexistant.
          {...(description ? {} : { 'aria-describedby': undefined })}
          onEscapeKeyDown={(e) => {
            if (!dismissible) e.preventDefault();
          }}
          onInteractOutside={(e) => {
            if (!dismissible || isAlert || !closeOnOverlayClick) e.preventDefault();
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            const target = returnFocusRef.current;
            if (target && target.isConnected) target.focus();
          }}
          onOpenAutoFocus={(e) => {
            const target = initialFocusRef?.current;
            if (target) {
              e.preventDefault();
              target.focus();
            }
          }}
          className={`
            fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50
            w-[calc(100%-2rem)] ${SIZE_CLASSES[size]} max-h-[90vh] overflow-y-auto
            bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6
            animate-in fade-in zoom-in-95
            ${className}
          `.trim()}
        >
          <Dialog.Title className={titleClassName}>{title}</Dialog.Title>
          {description ? (
            <Dialog.Description className={descriptionClassName}>{description}</Dialog.Description>
          ) : null}
          {children}
          {!hideCloseButton && (
            <Dialog.Close asChild>
              <button
                type="button"
                disabled={!dismissible}
                className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50"
                aria-label={t('close')}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </Dialog.Close>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
