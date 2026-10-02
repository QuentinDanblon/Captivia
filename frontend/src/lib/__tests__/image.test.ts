import {
  compressImageToDataUrl,
  computeTargetSize,
  ImageTooLargeError,
  isImageTooLargeError,
  IMAGE_JPEG_QUALITY,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_DIMENSION,
} from '../image';

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

  it('refuse un fichier de plus de 10 Mo', async () => {
    const big = new File([new Uint8Array(MAX_IMAGE_BYTES + 1)], 'big.jpg', { type: 'image/jpeg' });
    await expect(compressImageToDataUrl(big)).rejects.toBeInstanceOf(ImageTooLargeError);
    const err = await compressImageToDataUrl(big).catch((e: unknown) => e);
    expect(isImageTooLargeError(err)).toBe(true);
    expect(isImageTooLargeError(new Error('autre'))).toBe(false);
  });

  it('accepte un fichier de exactement 10 Mo', async () => {
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

  it("retombe sur le data URL d'origine si l'image ne peut pas être décodée", async () => {
    mockImage(0, 0, true);
    const file = new File(['hello'], 'weird.heic', { type: 'image/heic' });
    const result = await compressImageToDataUrl(file);
    expect(result.startsWith('data:image/heic;base64,')).toBe(true);
    expect(toDataURL).not.toHaveBeenCalled();
  });

  it("retombe sur le data URL d'origine si l'encodage JPEG échoue", async () => {
    mockImage(100, 100);
    toDataURL.mockReturnValue('data:,');
    const file = new File(['hello'], 'p.png', { type: 'image/png' });
    const result = await compressImageToDataUrl(file);
    expect(result.startsWith('data:image/png;base64,')).toBe(true);
  });
});
