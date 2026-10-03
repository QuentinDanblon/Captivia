'use client';

import { useRef, type ChangeEvent } from 'react';
import { useTranslations } from 'next-intl';
import { isNative } from '@/lib/platform';
import { isPhotoAccessDeniedError, pickNativePhoto } from '@/lib/native-photo';

interface PhotoPickerOptions<C> {
  /** Image choisie (fichier du navigateur ou photo native), avec le contexte passé à `open`. */
  onFile: (file: Blob, context: C | undefined) => void | Promise<void>;
  /** Message traduit à afficher (accès refusé, lecture impossible). */
  onError?: (message: string) => void;
}

/**
 * Choix d'une photo (W6-05). Web : clic sur l'`<input type="file">` (inchangé) ; app native :
 * feuille « Prendre une photo / Choisir dans la galerie » de `@capacitor/camera`.
 *
 * Rendre `<input ref={inputRef} type="file" accept="image/*" onChange={onChange} … />` et
 * appeler `open(context)` au clic sur le bouton.
 */
export function usePhotoPicker<C = undefined>({ onFile, onError }: PhotoPickerOptions<C>) {
  const t = useTranslations('photoPicker');
  const inputRef = useRef<HTMLInputElement>(null);
  const contextRef = useRef<C | undefined>(undefined);

  const open = async (context?: C) => {
    if (!isNative()) {
      contextRef.current = context;
      inputRef.current?.click();
      return;
    }
    try {
      const blob = await pickNativePhoto({
        header: t('header'),
        camera: t('camera'),
        library: t('library'),
        cancel: t('cancel'),
      });
      if (blob) await onFile(blob, context);
    } catch (err) {
      onError?.(isPhotoAccessDeniedError(err) ? t('accessDenied') : t('error'));
    }
  };

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Remis à zéro tout de suite : choisir à nouveau le même fichier redéclenche `change`.
    event.target.value = '';
    const context = contextRef.current;
    contextRef.current = undefined;
    if (file) void onFile(file, context);
  };

  return { inputRef, open, onChange };
}
