import { HttpException } from '@nestjs/common';
import sharpModule = require('sharp');
import { MEDIA_MAX_WIDTH } from '../community.constants';
import { detectImageKind, processImage } from './image-processing';

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
