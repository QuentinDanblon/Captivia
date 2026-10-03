'use client';

import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Camera, HelpCircle, ImagePlus, Lock, X } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { api, type Animal } from '@/lib/api';
import {
  COMMUNITY_CATEGORIES,
  COMMUNITY_LIMITS,
  communityApi,
  communityErrorKey,
  formatLongDate,
  type CommunityCategory,
  type CommunityErrorKey,
  type CommunityPostType,
} from '@/lib/community';
import { isImageTooLargeError, isUnsupportedImageError, prepareCommunityImage } from '@/lib/image';
import { communityPostPath } from '@/lib/platform';
import { usePhotoPicker } from '@/components/usePhotoPicker';
import { Button, Card, Field, SectionHeader, cx } from '@/components/ui';
import CommunityGate, { CommunityNotice, CommunityPage, EligibilityNotice, useCommunity } from '@/components/community/CommunityGate';
import { BackLink, CharCount } from '@/components/community/primitives';
import { RulesDigest } from '@/components/community/CommunityAside';

interface Photo {
  key: string;
  blob: Blob;
  filename: string;
  preview: string;
  converted: boolean;
  /** Description facultative de la photo (texte alternatif publié avec elle). */
  alt: string;
}

/** Fichiers proposés au sélecteur : JPEG, PNG, WebP, et HEIC (converti si le navigateur le lit). */
const ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif';

function revoke(url: string) {
  try {
    URL.revokeObjectURL(url);
  } catch {
    // ignoré
  }
}

function Composer() {
  const t = useTranslations('community');
  const locale = useLocale();
  const router = useRouter();
  const { token, isGuest, me } = useCommunity();
  const formId = useId();
  const [type, setType] = useState<CommunityPostType>('PHOTO');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [photoErrors, setPhotoErrors] = useState<string[]>([]);
  const [preparing, setPreparing] = useState(0);
  const [body, setBody] = useState('');
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [animalId, setAnimalId] = useState('');
  const [category, setCategory] = useState<CommunityCategory | ''>('');
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [submitError, setSubmitError] = useState<CommunityErrorKey | null>(null);
  const [suspendedUntil, setSuspendedUntil] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<'photos' | 'body' | null>(null);
  const photosRef = useRef<Photo[]>([]);
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);
  // Aperçus libérés au départ de la page.
  useEffect(() => () => photosRef.current.forEach((p) => revoke(p.preview)), []);

  useEffect(() => {
    if (isGuest) return;
    let cancelled = false;
    api
      .getMyAnimals(token)
      .then((data: unknown) => {
        if (!cancelled && Array.isArray(data)) setAnimals(data as Animal[]);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [token, isGuest]);

  const maxPhotos = type === 'PHOTO' ? COMMUNITY_LIMITS.photosMax : COMMUNITY_LIMITS.questionPhotosMax;

  const addFiles = async (files: Blob[]) => {
    const room = maxPhotos - photosRef.current.length;
    const accepted = files.slice(0, Math.max(0, room));
    const errors: string[] = files.length > room ? [t('compose.tooManyPhotos', { max: maxPhotos })] : [];
    setPreparing((n) => n + accepted.length);
    for (const file of accepted) {
      const name = (file as File).name || t('compose.unnamedPhoto');
      try {
        const prepared = await prepareCommunityImage(file);
        const photo: Photo = {
          key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          blob: prepared.blob,
          filename: prepared.filename,
          preview: URL.createObjectURL(prepared.blob),
          converted: prepared.converted,
          alt: '',
        };
        setPhotos((prev) => (prev.length < maxPhotos ? [...prev, photo] : (revoke(photo.preview), prev)));
      } catch (err) {
        if (isUnsupportedImageError(err)) {
          errors.push(t(`compose.photoError.${err.reason}`, { name }));
        } else if (isImageTooLargeError(err)) {
          errors.push(t('compose.photoError.tooLarge', { name }));
        } else {
          errors.push(t('compose.photoError.unreadable', { name }));
        }
      } finally {
        setPreparing((n) => n - 1);
      }
    }
    setPhotoErrors(errors);
    if (errors.length === 0) setFieldError((e) => (e === 'photos' ? null : e));
  };

  const picker = usePhotoPicker({
    onFile: (file) => addFiles([file]),
    onError: (message) => setPhotoErrors([message]),
  });

  const onInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length) void addFiles(files);
  };

  const setPhotoAlt = (key: string, alt: string) => {
    setPhotos((prev) => prev.map((p) => (p.key === key ? { ...p, alt } : p)));
  };

  const removePhoto = (key: string) => {
    setPhotos((prev) => {
      const target = prev.find((p) => p.key === key);
      if (target) revoke(target.preview);
      return prev.filter((p) => p.key !== key);
    });
  };

  const switchType = (next: CommunityPostType) => {
    setType(next);
    setFieldError(null);
    // Question : une seule photo facultative ; les suivantes sont retirées.
    if (next === 'QUESTION') {
      setPhotos((prev) => {
        prev.slice(COMMUNITY_LIMITS.questionPhotosMax).forEach((p) => revoke(p.preview));
        return prev.slice(0, COMMUNITY_LIMITS.questionPhotosMax);
      });
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitError(null);
    if (type === 'PHOTO' && photos.length < COMMUNITY_LIMITS.photosMin) {
      setFieldError('photos');
      return;
    }
    if (type === 'QUESTION' && !body.trim()) {
      setFieldError('body');
      return;
    }
    if (body.length > COMMUNITY_LIMITS.postBody) return;
    setFieldError(null);
    setProgress({ done: 0, total: photos.length });
    try {
      const mediaIds: string[] = [];
      for (const [index, photo] of photos.entries()) {
        const media = await communityApi.uploadMedia(token, photo.blob, photo.filename);
        mediaIds.push(media.id);
        setProgress({ done: index + 1, total: photos.length });
      }
      const created = await communityApi.createPost(token, {
        type,
        ...(body.trim() ? { body: body.trim() } : {}),
        ...(mediaIds.length ? { mediaIds } : {}),
        ...(photos.some((p) => p.alt.trim()) ? { mediaAlts: photos.map((p) => p.alt.trim()) } : {}),
        ...(animalId ? { animalId } : {}),
        ...(category ? { speciesCategory: category } : {}),
      });
      router.replace(communityPostPath(created.id));
    } catch (err) {
      const key = communityErrorKey(err);
      setSubmitError(key);
      setProgress(null);
      // Suspension prononcée depuis le chargement de la page : relire sa fin dans le profil (le
      // brouillon reste affiché).
      if (key === 'suspended') {
        communityApi
          .me(token)
          .then((fresh) => setSuspendedUntil(fresh.suspendedUntil ?? null))
          .catch(() => undefined);
      }
    }
  };

  if (isGuest) return <CommunityNotice errorKey="guest" severity="info" />;
  if (!me.canPublish) return <EligibilityNotice />;

  const selectedAnimal = animals.find((a) => a.id === animalId) ?? null;
  const speciesName = (selectedAnimal as (Animal & { speciesName?: string }) | null)?.speciesName;
  const busy = progress !== null;
  const bodyLabel = type === 'QUESTION' ? t('compose.questionLabel') : t('compose.captionLabel');

  return (
    <div className="grid gap-8 lg:grid-cols-12">
      <Card as="section" className="lg:col-span-8" padding="lg">
        <form id={formId} onSubmit={submit} className="grid gap-6" noValidate aria-busy={busy}>
          <fieldset className="m-0 grid gap-3 border-0 p-0">
            <legend className="mb-3 text-ui font-medium text-ink">{t('compose.typeLegend')}</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {(['PHOTO', 'QUESTION'] as const).map((value) => {
                const Icon = value === 'PHOTO' ? Camera : HelpCircle;
                return (
                  <label
                    key={value}
                    className="grid cursor-pointer grid-cols-[auto_minmax(0,1fr)] items-start gap-3 rounded-control border border-line-field px-4 py-3 transition-colors hover:bg-sunken has-[:checked]:border-accent has-[:checked]:bg-accent-soft"
                  >
                    <input type="radio" name={`${formId}-type`} value={value} checked={type === value} onChange={() => switchType(value)} className="sr-only" />
                    <Icon size={22} strokeWidth={1.5} aria-hidden="true" className="mt-0.5 text-accent-text" />
                    <span className="grid gap-0.5">
                      <span className="font-medium text-ink">{t(`compose.type.${value}.title`)}</span>
                      <span className="text-meta text-ink-2">{t(`compose.type.${value}.hint`)}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="grid gap-2">
            <p className="m-0 text-ui font-medium text-ink" id={`${formId}-photos`}>
              {type === 'PHOTO' ? t('compose.photosLabel', { max: maxPhotos }) : t('compose.questionPhotoLabel')}
              {type === 'PHOTO' ? (
                <span aria-hidden="true" className="ml-0.5 text-danger">
                  *
                </span>
              ) : null}
            </p>
            <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-4" aria-labelledby={`${formId}-photos`}>
              {photos.map((photo, index) => (
                <li key={photo.key} className="relative">
                  <div className="cv-photo aspect-square">
                    {/* eslint-disable-next-line @next/next/no-img-element -- aperçu local (blob:) avant l'envoi */}
                    <img src={photo.preview} alt={t('compose.previewAlt', { n: index + 1 })} className="absolute inset-0 size-full object-cover" />
                  </div>
                  {photo.converted ? <p className="m-0 mt-1 font-mono text-meta text-ink-2">{t('compose.converted')}</p> : null}
                  <button
                    type="button"
                    onClick={() => removePhoto(photo.key)}
                    disabled={busy}
                    className="absolute top-1.5 right-1.5 inline-flex size-9 items-center justify-center rounded-full border border-line bg-surface text-ink transition-colors hover:bg-sunken pointer-coarse:size-11"
                    aria-label={t('compose.removePhoto', { n: index + 1 })}
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                </li>
              ))}
              {photos.length + preparing < maxPhotos ? (
                <li>
                  <button
                    type="button"
                    onClick={() => void picker.open()}
                    disabled={busy}
                    aria-describedby={`${formId}-photo-hint`}
                    className={cx(
                      'flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-control border border-dashed bg-transparent px-2 text-center text-ui text-accent-text transition-colors hover:bg-sunken',
                      fieldError === 'photos' ? 'border-danger' : 'border-line-strong',
                    )}
                  >
                    <ImagePlus size={24} strokeWidth={1.5} aria-hidden="true" />
                    {t('compose.addPhoto')}
                  </button>
                </li>
              ) : null}
              {Array.from({ length: preparing }, (_, i) => (
                <li key={`preparing-${i}`} className="cv-photo aspect-square motion-safe:animate-pulse" aria-hidden="true" />
              ))}
            </ul>
            <input ref={picker.inputRef} type="file" accept={ACCEPT} multiple={type === 'PHOTO'} onChange={onInputChange} className="hidden" tabIndex={-1} aria-hidden="true" />
            <p id={`${formId}-photo-hint`} className="m-0 text-meta text-ink-2">
              {t('compose.photoHint')}
            </p>
            {preparing > 0 ? (
              <p role="status" className="m-0 text-meta text-ink-2">
                {t('compose.preparing')}
              </p>
            ) : null}
            {fieldError === 'photos' ? (
              <p role="alert" className="m-0 text-meta font-medium text-danger">
                {t('compose.photosRequired')}
              </p>
            ) : null}
            {photoErrors.length > 0 ? (
              <ul role="alert" className="m-0 grid list-none gap-1 p-0 text-meta font-medium text-danger">
                {photoErrors.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            ) : null}
          </div>

          {photos.length > 0 ? (
            <div className="grid gap-3">
              <p id={`${formId}-alt-hint`} className="m-0 text-meta text-ink-2">
                {t('compose.altHint')}
              </p>
              <ul className="m-0 grid list-none gap-4 p-0">
                {photos.map((photo, index) => (
                  <li key={photo.key} className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-start gap-3">
                    <div className="cv-photo aspect-square">
                      {/* eslint-disable-next-line @next/next/no-img-element -- aperçu local (blob:), décoratif : la photo est décrite par le champ voisin */}
                      <img src={photo.preview} alt="" className="absolute inset-0 size-full object-cover" />
                    </div>
                    <Field
                      label={photos.length > 1 ? t('compose.altLabelN', { n: index + 1 }) : t('compose.altLabel')}
                      hint={<CharCount value={photo.alt} max={COMMUNITY_LIMITS.mediaAlt} />}
                    >
                      <input
                        type="text"
                        value={photo.alt}
                        maxLength={COMMUNITY_LIMITS.mediaAlt}
                        autoComplete="off"
                        placeholder={t('compose.altPlaceholder')}
                        aria-describedby={`${formId}-alt-hint`}
                        disabled={busy}
                        onChange={(e) => setPhotoAlt(photo.key, e.target.value)}
                      />
                    </Field>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <Field
            label={bodyLabel}
            required={type === 'QUESTION'}
            error={fieldError === 'body' ? t('compose.bodyRequired') : body.length > COMMUNITY_LIMITS.postBody ? t('compose.bodyTooLong') : undefined}
            hint={
              <span className="flex flex-wrap justify-between gap-2">
                <span>{type === 'QUESTION' ? t('compose.questionHint') : t('compose.captionHint')}</span>
                <CharCount value={body} max={COMMUNITY_LIMITS.postBody} />
              </span>
            }
          >
            <textarea rows={type === 'QUESTION' ? 5 : 3} value={body} onChange={(e) => setBody(e.target.value)} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('compose.animalLabel')} hint={t('compose.animalHint')}>
              <select value={animalId} onChange={(e) => setAnimalId(e.target.value)}>
                <option value="">{t('compose.noAnimal')}</option>
                {animals.map((animal) => (
                  <option key={animal.id} value={animal.id}>
                    {animal.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('compose.categoryLabel')} hint={animalId ? t('compose.categoryFromAnimal') : t('compose.categoryHint')}>
              <select value={category} onChange={(e) => setCategory(e.target.value as CommunityCategory | '')}>
                <option value="">{t('compose.noCategory')}</option>
                {COMMUNITY_CATEGORIES.map((value) => (
                  <option key={value} value={value}>
                    {t(`categories.${value}`)}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {selectedAnimal ? (
            <div className="flex items-start gap-3 rounded-control bg-info-soft px-4 py-3 shadow-[inset_3px_0_0_var(--info)]" role="status">
              <Lock size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-info" />
              <p className="m-0 text-ui text-ink">
                {t('compose.animalVisible', { name: selectedAnimal.name })}
                {speciesName ? <span className="text-ink-2"> · {speciesName}</span> : null}
                <span className="mt-0.5 block text-ink-2">{t('compose.animalPrivate')}</span>
              </p>
            </div>
          ) : null}

          {submitError ? <CommunityNotice
              errorKey={submitError}
              severity="urgent"
              token={token}
              suspendedUntil={suspendedUntil ? formatLongDate(suspendedUntil, locale) : null}
              accountWide={submitError === 'suspended'}
            /> : null}

          <div className="flex flex-wrap items-center gap-4">
            <Button type="submit" size="lg" loading={busy} disabled={preparing > 0}>
              {t('compose.submit')}
            </Button>
            {progress && progress.total > 0 ? (
              <p role="status" className="m-0 font-mono text-meta text-ink-2">
                {progress.done < progress.total ? t('compose.uploading', { n: progress.done + 1, total: progress.total }) : t('compose.publishing')}
              </p>
            ) : null}
          </div>
        </form>
      </Card>

      <div className="grid content-start gap-4 lg:col-span-4">
        <RulesDigest />
        <p className="m-0 text-meta text-ink-2">{t('compose.privacy')}</p>
      </div>
    </div>
  );
}

/** Nouvelle publication : photo (1 à 4 images) ou question (texte, une image facultative). */
export default function NewCommunityPostPage() {
  const t = useTranslations('community');
  return (
    <CommunityGate>
      <CommunityPage>
        <BackLink href="/communaute">{t('post.backToFeed')}</BackLink>
        <SectionHeader title={t('compose.title')} description={t('compose.lead')} />
        <Composer />
      </CommunityPage>
    </CommunityGate>
  );
}
