import { act, fireEvent, render, screen } from '@testing-library/react';

const mockGetPhoto = jest.fn();
jest.mock('@capacitor/camera', () => ({
  Camera: { getPhoto: (...args: unknown[]) => mockGetPhoto(...args) },
  CameraResultType: { Uri: 'uri' },
  CameraSource: { Prompt: 'PROMPT' },
}));

const mockIsNative = jest.fn(() => false);
jest.mock('@/lib/platform', () => ({ isNative: () => mockIsNative() }));

import {
  PhotoAccessDeniedError,
  isPhotoCancel,
  isPhotoDenied,
  pickNativePhoto,
} from '../native-photo';
import { usePhotoPicker } from '@/components/usePhotoPicker';

const labels = { header: 'H', camera: 'C', library: 'L', cancel: 'X' };
const fetchMock = global.fetch as jest.Mock;

describe('pickNativePhoto', () => {
  beforeEach(() => {
    mockGetPhoto.mockReset();
    fetchMock.mockReset();
  });

  it('propose appareil photo ou galerie et lit le fichier local', async () => {
    const blob = new Blob(['x'], { type: 'image/jpeg' });
    mockGetPhoto.mockResolvedValue({ webPath: 'capacitor://localhost/_capacitor_file_/a.jpg' });
    fetchMock.mockResolvedValue({ ok: true, blob: () => Promise.resolve(blob) });
    await expect(pickNativePhoto(labels)).resolves.toBe(blob);
    expect(mockGetPhoto).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'PROMPT',
        resultType: 'uri',
        width: 1080,
        height: 1080,
        correctOrientation: true,
        saveToGallery: false,
        promptLabelHeader: 'H',
        promptLabelPicture: 'C',
        promptLabelPhoto: 'L',
        promptLabelCancel: 'X',
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith('capacitor://localhost/_capacitor_file_/a.jpg');
  });

  it("renvoie null quand l'utilisateur annule ou sans chemin", async () => {
    mockGetPhoto.mockRejectedValueOnce(new Error('User cancelled photos app'));
    await expect(pickNativePhoto(labels)).resolves.toBeNull();
    mockGetPhoto.mockResolvedValueOnce({});
    await expect(pickNativePhoto(labels)).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('signale un accès refusé', async () => {
    mockGetPhoto.mockRejectedValue(new Error('User denied access to photos'));
    await expect(pickNativePhoto(labels)).rejects.toBeInstanceOf(PhotoAccessDeniedError);
  });

  it('relance les autres erreurs', async () => {
    mockGetPhoto.mockRejectedValue(new Error('boom'));
    await expect(pickNativePhoto(labels)).rejects.toThrow('boom');
  });

  it('reconnaît les messages des deux plateformes', () => {
    expect(isPhotoCancel(new Error('No image picked'))).toBe(true);
    expect(isPhotoCancel('User cancelled photos app')).toBe(true);
    expect(isPhotoCancel(new Error('boom'))).toBe(false);
    expect(isPhotoDenied(new Error('Unable to access camera, user denied permission request'))).toBe(true);
    expect(isPhotoDenied(new Error('User denied access to camera'))).toBe(true);
    expect(isPhotoDenied(null)).toBe(false);
  });
});

function Picker({ onFile, onError }: { onFile: (f: Blob, c: string | undefined) => void; onError: (m: string) => void }) {
  const { inputRef, open, onChange } = usePhotoPicker<string>({ onFile, onError });
  return (
    <>
      <input data-testid="file" ref={inputRef} type="file" onChange={onChange} />
      <button type="button" onClick={() => void open('animal-1')}>
        photo
      </button>
    </>
  );
}

describe('usePhotoPicker', () => {
  beforeEach(() => {
    mockGetPhoto.mockReset();
    fetchMock.mockReset();
    mockIsNative.mockReturnValue(false);
  });

  it("web : ouvre l'input fichier et transmet le fichier avec son contexte", () => {
    const onFile = jest.fn();
    render(<Picker onFile={onFile} onError={jest.fn()} />);
    const input = screen.getByTestId('file') as HTMLInputElement;
    const click = jest.spyOn(input, 'click');
    fireEvent.click(screen.getByRole('button', { name: 'photo' }));
    expect(click).toHaveBeenCalled();
    expect(mockGetPhoto).not.toHaveBeenCalled();
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(onFile).toHaveBeenCalledWith(file, 'animal-1');
  });

  it('natif : feuille appareil photo / galerie, puis le même traitement', async () => {
    mockIsNative.mockReturnValue(true);
    const blob = new Blob(['x'], { type: 'image/jpeg' });
    mockGetPhoto.mockResolvedValue({ webPath: 'capacitor://localhost/_capacitor_file_/b.jpg' });
    fetchMock.mockResolvedValue({ ok: true, blob: () => Promise.resolve(blob) });
    const onFile = jest.fn();
    render(<Picker onFile={onFile} onError={jest.fn()} />);
    const click = jest.spyOn(screen.getByTestId('file') as HTMLInputElement, 'click');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'photo' }));
    });
    expect(click).not.toHaveBeenCalled();
    expect(onFile).toHaveBeenCalledWith(blob, 'animal-1');
  });

  it('natif : accès refusé → message traduit, annulation → rien', async () => {
    mockIsNative.mockReturnValue(true);
    const onFile = jest.fn();
    const onError = jest.fn();
    render(<Picker onFile={onFile} onError={onError} />);
    mockGetPhoto.mockRejectedValueOnce(new Error('User denied access to photos'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'photo' }));
    });
    expect(onError).toHaveBeenCalledWith('accessDenied');
    mockGetPhoto.mockRejectedValueOnce(new Error('User cancelled photos app'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'photo' }));
    });
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onFile).not.toHaveBeenCalled();
  });
});
