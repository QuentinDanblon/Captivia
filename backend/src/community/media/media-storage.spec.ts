import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { LocalMediaStorage } from './local-media-storage';
import { isValidMediaKey, mediaPublicBaseUrl } from './media-storage';
import { S3MediaStorage, s3OptionsFromEnv } from './s3-media-storage';

const KEY = '3f1b2c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d.webp';

describe('clés de médias', () => {
  it('acceptent seulement <uuid>.webp (aucune traversée de chemin)', () => {
    expect(isValidMediaKey(KEY)).toBe(true);
    for (const bad of [
      '../etc/passwd',
      `../${KEY}`,
      `${KEY}/..`,
      'abc.webp',
      KEY.replace('.webp', '.png'),
      KEY.toUpperCase(),
    ]) {
      expect(isValidMediaKey(bad)).toBe(false);
    }
  });
});

describe('mediaPublicBaseUrl', () => {
  const prev = { ...process.env };
  afterEach(() => {
    process.env = { ...prev };
  });

  it('utilise MEDIA_PUBLIC_BASE_URL sans barre finale, sinon l’API locale', () => {
    process.env.MEDIA_PUBLIC_BASE_URL = 'https://media.captivia.example/';
    expect(mediaPublicBaseUrl()).toBe('https://media.captivia.example');
    delete process.env.MEDIA_PUBLIC_BASE_URL;
    process.env.PORT = '4000';
    expect(mediaPublicBaseUrl()).toBe('http://localhost:4000/community/media');
  });
});

describe('LocalMediaStorage', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'captivia-media-spec-'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('écrit, relit et supprime (suppression idempotente)', async () => {
    const storage = new LocalMediaStorage(dir);
    await storage.put(KEY, Buffer.from('webp-bytes'));
    expect((await storage.read(KEY))?.toString()).toBe('webp-bytes');
    await storage.delete(KEY);
    await storage.delete(KEY);
    expect(await storage.read(KEY)).toBeNull();
  });

  it('refuse une clé hors format', async () => {
    const storage = new LocalMediaStorage(dir);
    await expect(storage.put('../evil.webp', Buffer.from('x'))).rejects.toThrow(
      'Invalid media key',
    );
    await expect(storage.read('../../etc/passwd')).rejects.toThrow(
      'Invalid media key',
    );
  });
});

describe('S3MediaStorage (client simulé)', () => {
  const options = {
    bucket: 'captivia-media',
    region: 'auto',
    endpoint: 'https://acc.r2.cloudflarestorage.com',
    forcePathStyle: false,
  };

  it('envoie PutObject (type, cache immuable) et DeleteObject sur le bucket', async () => {
    const send = jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue({});
    const storage = new S3MediaStorage(options, {
      send,
    } as unknown as S3Client);
    await storage.put(KEY, Buffer.from('x'), 'image/webp');
    await storage.delete(KEY);

    const put = send.mock.calls[0][0] as PutObjectCommand;
    expect(put).toBeInstanceOf(PutObjectCommand);
    expect(put.input).toMatchObject({
      Bucket: 'captivia-media',
      Key: KEY,
      ContentType: 'image/webp',
      CacheControl: 'public, max-age=31536000, immutable',
    });
    const del = send.mock.calls[1][0] as DeleteObjectCommand;
    expect(del).toBeInstanceOf(DeleteObjectCommand);
    expect(del.input).toEqual({ Bucket: 'captivia-media', Key: KEY });
  });

  it('read renvoie le contenu, ou null si la clé est absente', async () => {
    const send = jest
      .fn<Promise<unknown>, [unknown]>()
      .mockResolvedValueOnce({
        Body: {
          transformToByteArray: () => Promise.resolve(new Uint8Array([1, 2])),
        },
      })
      .mockResolvedValueOnce({});
    const storage = new S3MediaStorage(options, {
      send,
    } as unknown as S3Client);
    expect(await storage.read(KEY)).toEqual(Buffer.from([1, 2]));
    expect(send.mock.calls[0][0]).toBeInstanceOf(GetObjectCommand);
    expect(await storage.read(KEY)).toBeNull();
  });

  it('lit sa configuration dans l’environnement (R2 : région « auto »)', () => {
    const prev = { ...process.env };
    try {
      delete process.env.MEDIA_BUCKET;
      expect(() => s3OptionsFromEnv()).toThrow('MEDIA_BUCKET');
      process.env.MEDIA_BUCKET = 'b';
      process.env.S3_ENDPOINT = 'https://acc.r2.cloudflarestorage.com';
      delete process.env.S3_REGION;
      expect(s3OptionsFromEnv()).toMatchObject({
        bucket: 'b',
        region: 'auto',
        endpoint: 'https://acc.r2.cloudflarestorage.com',
        forcePathStyle: false,
      });
    } finally {
      process.env = prev;
    }
  });
});
