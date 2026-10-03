import {
  ANIMAL_PHOTO_MAX_DIMENSION,
  checkPhotoUrl,
  ANIMAL_PHOTO_TARGET_BYTES,
  compressImageToDataUrl,
  computeTargetSize,
  dataUrlBytes,
  ImageTooLargeError,
  isImageTooLargeError,
  isUnsupportedImageError,
  IMAGE_JPEG_QUALITY,
  MAX_IMAGE_BYTES,
  UnsupportedImageError,
} from '../image';

/** Data URL JPEG factice d'environ `bytes` octets décodés. */
function fakeJpeg(bytes: number): string {
  return `data:image/jpeg;base64,${'A'.repeat(Math.ceil((bytes * 4) / 3))}`;
}

const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0, 0, 0]);
const HEIC_HEAD = new Uint8Array([0, 0, 0, 0x18, ...Array.from('ftypheic').map((c) => c.charCodeAt(0)), 0, 0, 0, 0]);

describe('computeTargetSize', () => {
  it('ne modifie pas une image déjà assez petite', () => {
    expect(computeTargetSize(800, 600)).toEqual({ width: 800, height: 600 });
    expect(computeTargetSize(1080, 1080)).toEqual({ width: 1080, height: 1080 });
  });

  it('ramène le côté le plus long au maximum par défaut en conservant le ratio (paysage)', () => {
    expect(computeTargetSize(4000, 3000)).toEqual({ width: 1080, height: 810 });
  });

  it('ramène le côté le plus long au maximum par défaut en conservant le ratio (portrait)', () => {
    expect(computeTargetSize(3000, 4500)).toEqual({ width: 720, height: 1080 });
  });

  it('ne produit jamais une dimension nulle', () => {
    expect(computeTargetSize(100000, 1)).toEqual({ width: 1080, height: 1 });
  });

  it('accepte un maximum personnalisé', () => {
    expect(computeTargetSize(2000, 1000, 500)).toEqual({ width: 500, height: 250 });
  });
});

describe('compressImageToDataUrl', () => {
  const realImage = global.Image;
  const realCreateObjectURL = URL.createObjectURL;
  const realRevokeObjectURL = URL.revokeObjectURL;
  const realCreateElement = document.createElement.bind(document);

  let drawImage: jest.Mock;
  let fillRect: jest.Mock;
  let toDataURL: jest.Mock;
  let canvasRef: { width: number; height: number };

  function mockImage(width: number, height: number, fail = false) {
    class FakeImage {
      naturalWidth = width;
      naturalHeight = height;
      width = width;
      height = height;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_v: string) {
        setTimeout(() => (fail ? this.onerror?.() : this.onload?.()), 0);
      }
    }
    // @ts-expect-error — remplacement de l'Image jsdom par un faux décodeur
    global.Image = FakeImage;
  }

  beforeEach(() => {
    drawImage = jest.fn();
    fillRect = jest.fn();
    toDataURL = jest.fn(() => 'data:image/jpeg;base64,COMPRESSED');
    canvasRef = { width: 0, height: 0 };
    URL.createObjectURL = jest.fn(() => 'blob:fake');
    URL.revokeObjectURL = jest.fn();
    jest.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'canvas') {
        const canvas = canvasRef as unknown as HTMLCanvasElement;
        Object.assign(canvas, {
          getContext: () => ({ drawImage, fillRect, fillStyle: '' }),
          toDataURL,
        });
        return canvas;
      }
      return realCreateElement(tag);
    });
  });

  afterEach(() => {
    global.Image = realImage;
    URL.createObjectURL = realCreateObjectURL;
    URL.revokeObjectURL = realRevokeObjectURL;
    jest.restoreAllMocks();
  });

  it('refuse un fichier de plus de 30 Mo', async () => {
    const big = new File([new Uint8Array(MAX_IMAGE_BYTES + 1)], 'big.jpg', { type: 'image/jpeg' });
    await expect(compressImageToDataUrl(big)).rejects.toBeInstanceOf(ImageTooLargeError);
    const err = await compressImageToDataUrl(big).catch((e: unknown) => e);
    expect(isImageTooLargeError(err)).toBe(true);
    expect(isImageTooLargeError(new Error('autre'))).toBe(false);
  });

  it('accepte un fichier de exactement 30 Mo', async () => {
    mockImage(100, 100);
    const edge = new File([new Uint8Array(MAX_IMAGE_BYTES)], 'edge.jpg', { type: 'image/jpeg' });
    await expect(compressImageToDataUrl(edge)).resolves.toBe('data:image/jpeg;base64,COMPRESSED');
  });

  it('photo d’animal : ramène à 600 px max et encode en JPEG 0.75 si le WebP est indisponible', async () => {
    mockImage(4000, 3000);
    const file = new File(['x'], 'photo.png', { type: 'image/png' });
    const result = await compressImageToDataUrl(file);

    expect(result).toBe('data:image/jpeg;base64,COMPRESSED');
    expect(canvasRef.width).toBe(ANIMAL_PHOTO_MAX_DIMENSION);
    expect(canvasRef.height).toBe(450);
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 600, 450);
    expect(toDataURL).toHaveBeenCalledWith('image/webp', IMAGE_JPEG_QUALITY);
    expect(toDataURL).toHaveBeenCalledWith('image/jpeg', IMAGE_JPEG_QUALITY);
    // fond blanc pour les images transparentes
    expect(fillRect).toHaveBeenCalledWith(0, 0, 600, 450);
  });

  it('garde le WebP quand il est plus léger que le JPEG', async () => {
    mockImage(4000, 3000);
    toDataURL.mockImplementation((type: string) =>
      type === 'image/webp' ? 'data:image/webp;base64,SMALL' : 'data:image/jpeg;base64,MUCHBIGGER',
    );
    const result = await compressImageToDataUrl(new File(['x'], 'p.jpg', { type: 'image/jpeg' }));
    expect(result).toBe('data:image/webp;base64,SMALL');
  });

  it("n'agrandit pas une petite image", async () => {
    mockImage(400, 300);
    const file = new File(['x'], 'small.jpg', { type: 'image/jpeg' });
    await compressImageToDataUrl(file);
    expect(canvasRef.width).toBe(400);
    expect(canvasRef.height).toBe(300);
  });

  it("HEIC illisible ici : refus explicite (UnsupportedImageError 'heic'), jamais le fichier brut", async () => {
    mockImage(0, 0, true);
    const file = new File([HEIC_HEAD], 'IMG_0001.heic', { type: 'image/heic' });
    const err = await compressImageToDataUrl(file).catch((e: unknown) => e);
    expect(isUnsupportedImageError(err)).toBe(true);
    expect((err as UnsupportedImageError).reason).toBe('heic');
    expect(toDataURL).not.toHaveBeenCalled();
  });

  it("format inconnu illisible : refus explicite (UnsupportedImageError 'type')", async () => {
    mockImage(0, 0, true);
    const file = new File(['hello'], 'weird.bin', { type: 'application/octet-stream' });
    const err = await compressImageToDataUrl(file).catch((e: unknown) => e);
    expect(isUnsupportedImageError(err)).toBe(true);
    expect((err as UnsupportedImageError).reason).toBe('type');
  });

  it("retombe sur l'original (format accepté par l'API, < 2 Mo) si l'encodage JPEG échoue", async () => {
    mockImage(100, 100);
    toDataURL.mockReturnValue('data:,');
    const file = new File([PNG_SIGNATURE], 'p.png', { type: 'image/png' });
    const result = await compressImageToDataUrl(file);
    expect(result.startsWith('data:image/png;base64,')).toBe(true);
  });

  it("original illisible de plus de 2 Mo : refus (ImageTooLargeError) plutôt qu'un envoi refusé par l'API", async () => {
    mockImage(0, 0, true);
    const big = new Uint8Array(3 * 1024 * 1024);
    big.set(PNG_SIGNATURE);
    const file = new File([big], 'big.png', { type: 'image/png' });
    await expect(compressImageToDataUrl(file)).rejects.toBeInstanceOf(ImageTooLargeError);
  });

  it('baisse la qualité puis la taille jusqu’à passer sous la cible', async () => {
    mockImage(4000, 3000);
    const sizes = [ANIMAL_PHOTO_TARGET_BYTES * 3, ANIMAL_PHOTO_TARGET_BYTES + 5_000, ANIMAL_PHOTO_TARGET_BYTES - 5_000];
    const jpegQualities: number[] = [];
    // WebP indisponible (Safari ancien) : seul le JPEG compte.
    toDataURL.mockImplementation((type: string, quality: number) => {
      if (type !== 'image/jpeg') return 'data:image/png;base64,X';
      jpegQualities.push(quality);
      return fakeJpeg(sizes.shift() ?? 1);
    });
    const result = await compressImageToDataUrl(new File(['x'], 'p.jpg', { type: 'image/jpeg' }));
    expect(dataUrlBytes(result)).toBeLessThanOrEqual(ANIMAL_PHOTO_TARGET_BYTES);
    expect(jpegQualities).toEqual([0.75, 0.6, 0.6]);
    // 3e palier : côté le plus long ramené à 480 px
    expect(canvasRef.width).toBe(480);
  });

  it('jamais sous la limite de l’API (2 Mo) même au dernier palier : ImageTooLargeError', async () => {
    mockImage(4000, 3000);
    toDataURL.mockReturnValue(fakeJpeg(3 * 1024 * 1024));
    await expect(
      compressImageToDataUrl(new File(['x'], 'p.jpg', { type: 'image/jpeg' })),
    ).rejects.toBeInstanceOf(ImageTooLargeError);
  });
});

describe('dataUrlBytes', () => {
  it('calcule la taille décodée d’une data URL base64', () => {
    expect(dataUrlBytes('data:image/jpeg;base64,QUJD')).toBe(3);
    expect(dataUrlBytes('data:image/jpeg;base64,QUI=')).toBe(2);
    expect(dataUrlBytes('data:image/jpeg;base64,QQ==')).toBe(1);
  });
});

describe('checkPhotoUrl (adresse de photo saisie à la main)', () => {
  it('accepte une adresse https, une data URL ou un champ vide', () => {
    expect(checkPhotoUrl('https://example.org/chat.jpg')).toBe('ok');
    expect(checkPhotoUrl('  ')).toBe('ok');
    expect(checkPhotoUrl(fakeJpeg(10))).toBe('ok');
  });

  it('refuse une adresse http:// (refusée en 400 par l’API)', () => {
    expect(checkPhotoUrl('http://example.org/chat.jpg')).toBe('insecure');
  });

  it('refuse une adresse illisible, un autre protocole ou une adresse trop longue', () => {
    expect(checkPhotoUrl('chat.jpg')).toBe('invalid');
    expect(checkPhotoUrl('ftp://example.org/chat.jpg')).toBe('invalid');
    expect(checkPhotoUrl(`https://example.org/${'a'.repeat(2100)}`)).toBe('invalid');
  });
});
