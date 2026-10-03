import { HttpException } from '@nestjs/common';
import sharpModule = require('sharp');
import {
  MEDIA_MAX_INPUT_PIXELS,
  MEDIA_MAX_WIDTH,
} from '../community.constants';
import {
  Semaphore,
  assertSafeDimensions,
  detectImageKind,
  processImage,
} from './image-processing';

const sharp = sharpModule as unknown as typeof sharpModule.default;

/** Marqueurs EXIF recherchés : balise « GPS IFD » (0x8825, little endian) et latitude 48/1 51/1. */
const GPS_IFD_TAG = Buffer.from([0x25, 0x88]);
const GPS_LATITUDE = Buffer.from([
  48, 0, 0, 0, 1, 0, 0, 0, 51, 0, 0, 0, 1, 0, 0, 0,
]);
const CAMERA = 'CaptiviaSecretCam';

/** JPEG 2400 × 1200 avec EXIF (appareil, coordonnées GPS de Paris). */
async function jpegWithGps(width = 2400, height = 1200): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 180, g: 90, b: 40 },
    },
  })
    .jpeg()
    .withExif({
      IFD0: { Make: CAMERA, Model: 'Model-X' },
      IFD3: {
        GPSLatitudeRef: 'N',
        GPSLatitude: '48/1 51/1 2400/100',
        GPSLongitudeRef: 'E',
        GPSLongitude: '2/1 21/1 0/1',
      },
    })
    .toBuffer();
}

async function codeOf(p: Promise<unknown>): Promise<[number, string]> {
  try {
    await p;
  } catch (e) {
    const err = e as HttpException;
    const body = err.getResponse() as { code: string };
    return [err.getStatus(), body.code];
  }
  throw new Error('expected a rejection');
}

describe('detectImageKind (magic bytes)', () => {
  it('reconnaît JPEG, PNG et WebP par leur signature', async () => {
    const base = sharp({
      create: { width: 4, height: 4, channels: 3, background: '#000' },
    });
    expect(detectImageKind(await base.clone().jpeg().toBuffer())).toBe('jpeg');
    expect(detectImageKind(await base.clone().png().toBuffer())).toBe('png');
    expect(detectImageKind(await base.clone().webp().toBuffer())).toBe('webp');
  });

  it('refuse un faux PNG (HTML renommé), un GIF, un SVG et un fichier vide', () => {
    expect(
      detectImageKind(Buffer.from('<html><script>alert(1)</script>')),
    ).toBeNull();
    expect(detectImageKind(Buffer.from('GIF89a......'))).toBeNull();
    expect(
      detectImageKind(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')),
    ).toBeNull();
    expect(detectImageKind(Buffer.alloc(0))).toBeNull();
    // « PNG » tronqué : signature incomplète.
    expect(detectImageKind(Buffer.from([0x89, 0x50, 0x4e, 0x47]))).toBeNull();
  });
});

describe('processImage', () => {
  it('supprime toutes les métadonnées EXIF, dont la position GPS, et ré-encode en WebP', async () => {
    const input = await jpegWithGps();
    // Témoin : l'entrée porte bien l'EXIF, l'appareil et la balise GPS.
    const before = await sharp(input).metadata();
    expect(before.exif).toBeDefined();
    expect(before.exif!.includes(GPS_IFD_TAG)).toBe(true);
    expect(before.exif!.includes(GPS_LATITUDE)).toBe(true);
    expect(input.includes(CAMERA)).toBe(true);

    const out = await processImage(input, 10 * 1024 * 1024);
    const after = await sharp(out.data).metadata();
    expect(out.contentType).toBe('image/webp');
    expect(after.format).toBe('webp');
    expect(after.exif).toBeUndefined();
    expect(after.xmp).toBeUndefined();
    expect(after.iptc).toBeUndefined();
    // Aucun octet résiduel : ni chunk EXIF WebP, ni appareil, ni coordonnées.
    expect(out.data.includes('EXIF')).toBe(false);
    expect(out.data.includes('Exif')).toBe(false);
    expect(out.data.includes(CAMERA)).toBe(false);
    expect(out.data.includes(GPS_LATITUDE)).toBe(false);
  });

  it('redimensionne à 1 600 px de large au plus en gardant les proportions', async () => {
    const out = await processImage(
      await jpegWithGps(2400, 1200),
      10 * 1024 * 1024,
    );
    expect(out.width).toBe(MEDIA_MAX_WIDTH);
    expect(out.height).toBe(800);
    const meta = await sharp(out.data).metadata();
    expect(meta.width).toBe(MEDIA_MAX_WIDTH);
  });

  it("n'agrandit jamais une petite image", async () => {
    const small = await sharp({
      create: { width: 320, height: 200, channels: 3, background: '#0a0' },
    })
      .png()
      .toBuffer();
    const out = await processImage(small, 10 * 1024 * 1024);
    expect([out.width, out.height]).toEqual([320, 200]);
  });

  it('applique l’orientation EXIF avant de la retirer', async () => {
    const rotated = await sharp({
      create: { width: 400, height: 200, channels: 3, background: '#00f' },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    const out = await processImage(rotated, 10 * 1024 * 1024);
    expect([out.width, out.height]).toEqual([200, 400]);
    expect((await sharp(out.data).metadata()).orientation).toBeUndefined();
  });

  it('contrôle le type réel AVANT la taille : un faux PNG volumineux est refusé en 415', async () => {
    const fake = Buffer.concat([Buffer.from('<html>'), Buffer.alloc(5000)]);
    expect(await codeOf(processImage(fake, 1000))).toEqual([
      415,
      'MEDIA_UNSUPPORTED_TYPE',
    ]);
  });

  it('refuse une image trop lourde (413) et une image corrompue (400)', async () => {
    const jpeg = await jpegWithGps(800, 600);
    expect(await codeOf(processImage(jpeg, jpeg.length - 1))).toEqual([
      413,
      'MEDIA_TOO_LARGE',
    ]);
    const truncated = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.from('not really a png'),
    ]);
    expect(await codeOf(processImage(truncated, 1_000_000))).toEqual([
      400,
      'MEDIA_INVALID_IMAGE',
    ]);
  });
});

describe('bombe de décompression', () => {
  /** PNG uni de grandes dimensions : quelques Ko compressés, des Go une fois décodé. */
  function hugePng(width: number, height: number): Promise<Buffer> {
    return sharp({
      create: { width, height, channels: 3, background: '#000' },
      limitInputPixels: false,
    })
      .png({ compressionLevel: 9 })
      .toBuffer();
  }

  it('PNG de 10 000 000 × 5 px : refusé en 413 d’après l’en-tête, sans décodage', async () => {
    const input = await hugePng(10_000_000, 5);
    expect(input.length).toBeLessThan(200 * 1024);
    const rss = process.memoryUsage().rss;
    let peak = rss;
    const timer = setInterval(() => {
      peak = Math.max(peak, process.memoryUsage().rss);
    }, 2);
    try {
      expect(await codeOf(processImage(input, 8 * 1024 * 1024))).toEqual([
        413,
        'MEDIA_TOO_LARGE',
      ]);
    } finally {
      clearInterval(timer);
    }
    // Avant correctif : plus de 1,4 Go (jusqu'à 4 Go) ; après : rien n'est décodé.
    expect((peak - rss) / 1e6).toBeLessThan(150);
  });

  it('bornes : 10 000 px par côté, 24 M pixels, rapport 20:1', () => {
    const status = (w: number, h: number) => {
      try {
        assertSafeDimensions(w, h);
        return 'ok';
      } catch (e) {
        return (e as HttpException).getStatus();
      }
    };
    expect(MEDIA_MAX_INPUT_PIXELS).toBe(24_000_000);
    expect(status(1600, 1200)).toBe('ok');
    expect(status(4000, 200)).toBe('ok');
    expect(status(10_001, 1000)).toBe(413);
    expect(status(1000, 10_001)).toBe(413);
    expect(status(6000, 6000)).toBe(413);
    expect(status(4200, 200)).toBe(400);
    expect(status(0, 10)).toBe(400);
  });

  it('PNG trop allongé : refusé en 400 avant décodage', async () => {
    expect(
      await codeOf(processImage(await hugePng(9000, 400), 8 * 1024 * 1024)),
    ).toEqual([400, 'MEDIA_INVALID_IMAGE']);
  });
});

describe('Semaphore (traitements simultanés)', () => {
  const tick = () => new Promise((r) => setTimeout(r, 5));

  it('ne lance jamais plus de `limit` tâches à la fois', async () => {
    const sem = new Semaphore(2, 10, 5000);
    let running = 0;
    let max = 0;
    await Promise.all(
      Array.from({ length: 8 }, () =>
        sem.run(async () => {
          running++;
          max = Math.max(max, running);
          await tick();
          running--;
        }),
      ),
    );
    expect(max).toBe(2);
    expect(sem.running).toBe(0);
    expect(sem.waiting).toBe(0);
  });

  it('file pleine ou attente trop longue : 503 MEDIA_BUSY', async () => {
    const sem = new Semaphore(1, 1, 50);
    let release!: () => void;
    const blocker = sem.run(() => new Promise<void>((r) => (release = r)));
    const queued = sem.run(() => Promise.resolve('late'));
    expect(await codeOf(sem.run(() => Promise.resolve()))).toEqual([
      503,
      'MEDIA_BUSY',
    ]);
    // L'attente dépasse 50 ms : la tâche en file est refusée à son tour.
    expect(await codeOf(queued)).toEqual([503, 'MEDIA_BUSY']);
    release();
    await blocker;
    expect(await sem.run(() => Promise.resolve('ok'))).toBe('ok');
    expect(sem.running).toBe(0);
  });

  it('une tâche en échec libère son créneau', async () => {
    const sem = new Semaphore(1, 5, 5000);
    await expect(
      sem.run(() => Promise.reject(new Error('boom'))),
    ).rejects.toThrow('boom');
    expect(await sem.run(() => Promise.resolve(1))).toBe(1);
  });
});
