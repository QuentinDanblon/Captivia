/**
 * Photo dans l'app native (W6-05) : `@capacitor/camera` propose « Prendre une photo » ou
 * « Choisir dans la galerie » (feuille native), puis le fichier est confié à la compression
 * existante (`src/lib/image.ts`). Plugin importé à la demande : absent du bundle web, où
 * l'`<input type="file">` reste inchangé.
 */
import { MAX_IMAGE_DIMENSION } from './image';

export interface PhotoPromptLabels {
  /** Titre de la feuille de choix. */
  header: string;
  /** « Prendre une photo » (appareil photo). */
  camera: string;
  /** « Choisir dans la galerie ». */
  library: string;
  cancel: string;
}

/** Accès à l'appareil photo ou aux photos refusé par l'utilisateur (réglages du téléphone). */
export class PhotoAccessDeniedError extends Error {
  constructor() {
    super('PHOTO_ACCESS_DENIED');
    this.name = 'PhotoAccessDeniedError';
  }
}

export function isPhotoAccessDeniedError(err: unknown): err is PhotoAccessDeniedError {
  return err instanceof PhotoAccessDeniedError;
}

const messageOf = (err: unknown): string =>
  err instanceof Error ? err.message : typeof err === 'string' ? err : '';

/** Annulation par l'utilisateur (« User cancelled photos app », « No image picked »…). */
export function isPhotoCancel(err: unknown): boolean {
  return /cancel|no image picked/i.test(messageOf(err));
}

/** Refus d'autorisation (« User denied access to photos », « …denied permission… »). */
export function isPhotoDenied(err: unknown): boolean {
  return /denied|permission|not authorized/i.test(messageOf(err));
}

/**
 * Ouvre la feuille native (appareil photo ou galerie) et renvoie l'image choisie.
 * @returns null si l'utilisateur annule.
 * @throws PhotoAccessDeniedError si l'accès est refusé ; toute autre erreur est relancée.
 */
export async function pickNativePhoto(labels: PhotoPromptLabels): Promise<Blob | null> {
  const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
  let webPath: string | undefined;
  try {
    const photo = await Camera.getPhoto({
      source: CameraSource.Prompt,
      resultType: CameraResultType.Uri,
      // Premier redimensionnement natif (mémoire de la WebView) ; la compression JPEG reste celle du web.
      width: MAX_IMAGE_DIMENSION,
      height: MAX_IMAGE_DIMENSION,
      quality: 90,
      correctOrientation: true,
      saveToGallery: false,
      promptLabelHeader: labels.header,
      promptLabelPicture: labels.camera,
      promptLabelPhoto: labels.library,
      promptLabelCancel: labels.cancel,
    });
    webPath = photo.webPath;
  } catch (err) {
    if (isPhotoCancel(err)) return null;
    if (isPhotoDenied(err)) throw new PhotoAccessDeniedError();
    throw err;
  }
  if (!webPath) return null;
  // `webPath` est servi par la WebView (capacitor://localhost/_capacitor_file_/…) : lecture locale.
  const res = await fetch(webPath);
  if (!res.ok) throw new Error(`photo read ${res.status}`);
  return res.blob();
}
