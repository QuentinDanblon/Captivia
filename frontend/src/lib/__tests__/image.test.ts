import {
  ANIMAL_PHOTO_TARGET_BYTES,
  compressImageToDataUrl,
  computeTargetSize,
  dataUrlBytes,
  ImageTooLargeError,
  isImageTooLargeError,
  isUnsupportedImageError,
  IMAGE_JPEG_QUALITY,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_DIMENSION,
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
    expect(computeTargetSize(1600, 1600)).toEqual({ width: 1600, height: 1600 });
  });

  it('ramène le côté le plus long à 1600 px en conservant le ratio (paysage)', () => {
    expect(computeTargetSize(4000, 3000)).toEqual({ width: 1600, height: 1200 });
  });

  it('ramène le côté le plus long à 1600 px en conservant le ratio (portrait)', () => {
    expect(computeTargetSize(3000, 4500)).toEqual({ width: 1067, height: 1600 });
  });

  it('ne produit jamais une dimension nulle', () => {
    expect(computeTargetSize(100000, 1)).toEqual({ width: 1600, height: 1 });
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

  it('redimensionne à 1600 px max et encode en JPEG 0.82', async () => {
    mockImage(4000, 3000);
    const file = new File(['x'], 'photo.png', { type: 'image/png' });
    const result = await compressImageToDataUrl(file);

    expect(result).toBe('data:image/jpeg;base64,COMPRESSED');
    expect(canvasRef.width).toBe(MAX_IMAGE_DIMENSION);
    expect(canvasRef.height).toBe(1200);
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1600, 1200);
    expect(toDataURL).toHaveBeenCalledWith('image/jpeg', IMAGE_JPEG_QUALITY);
    expect(IMAGE_JPEG_QUALITY).toBe(0.82);
    // fond blanc pour les images transparentes
    expect(fillRect).toHaveBeenCalledWith(0, 0, 1600, 1200);
  });

  it("n'agrandit pas une petite image", async () => {
    mockImage(640, 480);
    const file = new File(['x'], 'small.jpg', { type: 'image/jpeg' });
    await compressImageToDataUrl(file);
    expect(canvasRef.width).toBe(640);
    expect(canvasRef.height).toBe(480);
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
    toDataURL
      .mockReturnValueOnce(fakeJpeg(ANIMAL_PHOTO_TARGET_BYTES * 2))
      .mockReturnValueOnce(fakeJpeg(ANIMAL_PHOTO_TARGET_BYTES + 10_000))
      .mockReturnValueOnce(fakeJpeg(ANIMAL_PHOTO_TARGET_BYTES - 10_000));
    const result = await compressImageToDataUrl(new File(['x'], 'p.jpg', { type: 'image/jpeg' }));
    expect(dataUrlBytes(result)).toBeLessThanOrEqual(ANIMAL_PHOTO_TARGET_BYTES);
    expect(toDataURL).toHaveBeenNthCalledWith(1, 'image/jpeg', 0.82);
    expect(toDataURL).toHaveBeenNthCalledWith(2, 'image/jpeg', 0.7);
    expect(toDataURL).toHaveBeenNthCalledWith(3, 'image/jpeg', 0.7);
    // 3e palier : côté le plus long ramené à 1280 px
    expect(canvasRef.width).toBe(1280);
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
