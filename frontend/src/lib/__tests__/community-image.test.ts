import {
  COMMUNITY_SOURCE_MAX_BYTES,
  ImageTooLargeError,
  UnsupportedImageError,
  hasExtremeDimensions,
  prepareCommunityImage,
  sniffImageBytes,
} from '../image';

const bytes = (...values: number[]) => new Uint8Array(values);
const ascii = (text: string) => Array.from(text).map((c) => c.charCodeAt(0));

const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0x10, ...ascii('JFIF'), 0, 1);
const PNG = bytes(0x89, ...ascii('PNG'), 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d);
const WEBP = bytes(...ascii('RIFF'), 0x24, 0, 0, 0, ...ascii('WEBPVP8 '));
const HEIC = bytes(0, 0, 0, 0x18, ...ascii('ftypheic'), 0, 0, 0, 0);
const GIF = bytes(...ascii('GIF89a'), 1, 0, 1, 0);

function file(head: Uint8Array, name: string, type = '', size?: number): File {
  const f = new File([head as BlobPart], name, { type });
  if (size !== undefined) Object.defineProperty(f, 'size', { value: size });
  return f;
}

describe('type réel des photos (signature binaire)', () => {
  it.each([
    ['jpeg', JPEG],
    ['png', PNG],
    ['webp', WEBP],
    ['heic', HEIC],
    ['gif', GIF],
  ] as const)('%s', (expected, head) => {
    expect(sniffImageBytes(head)).toBe(expected);
  });
  it('inconnu sinon', () => {
    expect(sniffImageBytes(bytes(1, 2, 3, 4))).toBe('other');
  });
});

describe('dimensions refusées par l’API', () => {
  it('côté > 10 000 px ou rapport > 20', () => {
    expect(hasExtremeDimensions(12000, 9000)).toBe(true);
    expect(hasExtremeDimensions(400, 9000)).toBe(true);
    expect(hasExtremeDimensions(4000, 3000)).toBe(false);
  });
});

describe('prepareCommunityImage', () => {
  const realImage = global.Image;
  const realCreate = URL.createObjectURL;
  const realRevoke = URL.revokeObjectURL;
  const realCreateElement = document.createElement.bind(document);
  let drawImage: jest.Mock;
  let toBlob: jest.Mock;
  let canvasSize: { width: number; height: number };

  function mockDecoder(width: number, height: number, fail = false) {
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
    // @ts-expect-error — décodeur d'image factice (jsdom ne décode rien)
    global.Image = FakeImage;
  }

  beforeEach(() => {
    URL.createObjectURL = jest.fn(() => 'blob:fake');
    URL.revokeObjectURL = jest.fn();
    drawImage = jest.fn();
    toBlob = jest.fn((cb: (b: Blob | null) => void, type: string) => cb(new Blob(['jpeg-data'], { type })));
    canvasSize = { width: 0, height: 0 };
    jest.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag !== 'canvas') return realCreateElement(tag);
      return {
        set width(v: number) {
          canvasSize.width = v;
        },
        set height(v: number) {
          canvasSize.height = v;
        },
        getContext: () => ({ fillStyle: '', fillRect: jest.fn(), drawImage }),
        toBlob,
      } as unknown as HTMLCanvasElement;
    });
  });

  afterEach(() => {
    global.Image = realImage;
    URL.createObjectURL = realCreate;
    URL.revokeObjectURL = realRevoke;
    jest.restoreAllMocks();
  });

  it('compresse un JPEG : 1 600 px au plus, ré-encodé en JPEG', async () => {
    mockDecoder(4000, 3000);
    const out = await prepareCommunityImage(file(JPEG, 'chat.jpg', 'image/jpeg'));
    expect(canvasSize).toEqual({ width: 1600, height: 1200 });
    expect(drawImage).toHaveBeenCalled();
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.82);
    expect(out).toMatchObject({ filename: 'photo.jpg', width: 1600, height: 1200, converted: false });
    expect(out.blob.type).toBe('image/jpeg');
  });

  it('convertit un HEIC que le navigateur sait décoder (Safari)', async () => {
    mockDecoder(3024, 4032);
    const out = await prepareCommunityImage(file(HEIC, 'IMG_0001.HEIC', 'image/heic'));
    expect(out.converted).toBe(true);
    expect(out.filename).toBe('photo.jpg');
    expect(out.blob.type).toBe('image/jpeg');
  });

  it('refuse clairement un HEIC illisible (Chrome, Firefox)', async () => {
    mockDecoder(0, 0, true);
    await expect(prepareCommunityImage(file(HEIC, 'IMG_0002.HEIC', 'image/heic'))).rejects.toMatchObject({ reason: 'heic' });
  });

  it('reconnaît un HEIC à son extension même sans signature lisible', async () => {
    mockDecoder(0, 0, true);
    await expect(prepareCommunityImage(file(bytes(1, 2, 3), 'IMG_0003.heic'))).rejects.toBeInstanceOf(UnsupportedImageError);
  });

  it('refuse les autres formats (GIF, fichiers quelconques)', async () => {
    mockDecoder(100, 100);
    await expect(prepareCommunityImage(file(GIF, 'anim.gif', 'image/gif'))).rejects.toMatchObject({ reason: 'type' });
    await expect(prepareCommunityImage(file(bytes(1, 2, 3, 4), 'notes.txt', 'text/plain'))).rejects.toMatchObject({ reason: 'type' });
  });

  it('refuse une bande extrême (rapport > 20) avant l’envoi', async () => {
    mockDecoder(300, 9000);
    await expect(prepareCommunityImage(file(PNG, 'capture.png', 'image/png'))).rejects.toMatchObject({ reason: 'dimensions' });
  });

  it('refuse une photo d’origine de plus de 20 Mo', async () => {
    mockDecoder(100, 100);
    await expect(prepareCommunityImage(file(JPEG, 'raw.jpg', 'image/jpeg', COMMUNITY_SOURCE_MAX_BYTES + 1))).rejects.toBeInstanceOf(ImageTooLargeError);
  });

  it("envoie l'original (JPEG/PNG/WebP) si le navigateur ne peut pas le décoder", async () => {
    mockDecoder(0, 0, true);
    const out = await prepareCommunityImage(file(WEBP, 'photo.webp', 'image/webp'));
    expect(out.filename).toBe('photo.webp');
    expect(out.converted).toBe(false);
  });
});
