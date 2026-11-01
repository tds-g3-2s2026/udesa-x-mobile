import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import { ApiError } from '../../src/api/apiClient';
import { ProfileImagesEditor } from '../../src/features/social/components/ProfileImagesEditor';
import { profileService } from '../../src/features/social/services/profileService';
import { profileImageService } from '../../src/features/social/services/profileImageService';
import { UserProfile } from '../../src/types/social';

jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
const launchPicker = ImagePicker.launchImageLibraryAsync as jest.Mock;

const AVATAR = 'https://bucket.example/avatars/usr-1.jpg?sig=1';
const COVER = 'https://bucket.example/covers/usr-1.jpg?sig=1';
const MB = 1_048_576;

function ownProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'usr-1',
    handle: '@demo',
    displayName: null,
    bio: null,
    avatarUrl: null,
    coverUrl: null,
    createdAt: '2026-09-01T12:00:00Z',
    followersCount: 0,
    followingCount: 0,
    isPrivate: false,
    isFollowedByMe: false,
    ...overrides,
  };
}

// What the picker hands back for one chosen file.
function picked(asset: Partial<ImagePicker.ImagePickerAsset>) {
  return {
    canceled: false,
    assets: [
      {
        uri: 'file:///photo.jpg',
        fileName: 'photo.jpg',
        mimeType: 'image/jpeg',
        fileSize: MB,
        ...asset,
      },
    ],
  };
}

const getProfile = jest.spyOn(profileService, 'getProfile');
const upload = jest.spyOn(profileImageService, 'upload');
const remove = jest.spyOn(profileImageService, 'remove');
const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

async function press(label: string) {
  await act(async () => {
    fireEvent.press(screen.getByRole('button', { name: label }));
  });
}

beforeEach(() => {
  getProfile.mockReset().mockResolvedValue(ownProfile());
  upload.mockReset();
  remove.mockReset();
  launchPicker.mockReset();
  alert.mockClear();
});

describe('E1-H8. Foto de Perfil', () => {
  it('starts from the photo and the cover the account already has', async () => {
    getProfile.mockResolvedValueOnce(ownProfile({ avatarUrl: AVATAR, coverUrl: COVER }));
    render(<ProfileImagesEditor userId="usr-1" />);

    expect((await screen.findByLabelText('Foto de perfil')).props.source).toEqual({ uri: AVATAR });
    expect(screen.getByLabelText('Portada').props.source).toEqual({ uri: COVER });
    expect(getProfile).toHaveBeenCalledWith('usr-1');
  });

  it('E1-H8.CA6 - "Eliminar foto actual" deletes the photo and goes back to the default avatar', async () => {
    getProfile.mockResolvedValueOnce(ownProfile({ avatarUrl: AVATAR }));
    remove.mockResolvedValueOnce(undefined);
    render(<ProfileImagesEditor userId="usr-1" />);
    await screen.findByLabelText('Foto de perfil');

    await press('Eliminar foto actual');

    expect(remove).toHaveBeenCalledWith('avatar');
    expect(screen.getByTestId('default-avatar')).toBeTruthy();
    // Nothing left to remove, so the button goes away with the photo.
    expect(screen.queryByRole('button', { name: 'Eliminar foto actual' })).toBeNull();
  });

  it('E1-H8.CA6 - without a photo there is no button to remove it', async () => {
    render(<ProfileImagesEditor userId="usr-1" />);
    await waitFor(() => expect(getProfile).toHaveBeenCalled());

    expect(screen.getByRole('button', { name: 'Cambiar foto' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Eliminar foto actual' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Eliminar portada' })).toBeNull();
  });

  it('E1-H8 - a chosen photo is uploaded and shown as the server returned it', async () => {
    launchPicker.mockResolvedValueOnce(picked({}));
    upload.mockResolvedValueOnce(AVATAR);
    render(<ProfileImagesEditor userId="usr-1" />);
    await waitFor(() => expect(getProfile).toHaveBeenCalled());

    await press('Cambiar foto');

    expect(upload).toHaveBeenCalledWith('avatar', {
      uri: 'file:///photo.jpg',
      name: 'photo.jpg',
      mimeType: 'image/jpeg',
    });
    expect(screen.getByLabelText('Foto de perfil').props.source).toEqual({ uri: AVATAR });
    expect(screen.getByRole('button', { name: 'Eliminar foto actual' })).toBeTruthy();
  });

  it('E1-H8 - the cover goes up as a cover, and can then be removed', async () => {
    launchPicker.mockResolvedValueOnce(picked({ fileSize: 8 * MB }));
    upload.mockResolvedValueOnce(COVER);
    remove.mockResolvedValueOnce(undefined);
    render(<ProfileImagesEditor userId="usr-1" />);
    await waitFor(() => expect(getProfile).toHaveBeenCalled());

    await press('Cambiar portada');
    expect(upload).toHaveBeenCalledWith('cover', expect.objectContaining({ name: 'photo.jpg' }));
    expect(screen.getByLabelText('Portada')).toBeTruthy();

    await press('Eliminar portada');
    expect(remove).toHaveBeenCalledWith('cover');
    expect(screen.getByTestId('default-cover')).toBeTruthy();
  });

  it('E1-H8.CA2 - a photo over 5 MB is refused before it is sent', async () => {
    launchPicker.mockResolvedValueOnce(picked({ fileSize: 5 * MB + 1 }));
    render(<ProfileImagesEditor userId="usr-1" />);
    await waitFor(() => expect(getProfile).toHaveBeenCalled());

    await press('Cambiar foto');

    expect(upload).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledWith(
      'No se pudo usar la imagen',
      'La foto puede pesar hasta 5 MB.'
    );
  });

  it('E1-H8.CA2 - a cover over 10 MB is refused before it is sent', async () => {
    launchPicker.mockResolvedValueOnce(picked({ fileSize: 10 * MB + 1 }));
    render(<ProfileImagesEditor userId="usr-1" />);
    await waitFor(() => expect(getProfile).toHaveBeenCalled());

    await press('Cambiar portada');

    expect(upload).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledWith(
      'No se pudo usar la imagen',
      'La portada puede pesar hasta 10 MB.'
    );
  });

  it('E1-H8.CA1 - a file that is not JPG or PNG is refused before it is sent', async () => {
    launchPicker.mockResolvedValueOnce(
      picked({ uri: 'file:///anim.gif', fileName: 'anim.gif', mimeType: 'image/gif' })
    );
    render(<ProfileImagesEditor userId="usr-1" />);
    await waitFor(() => expect(getProfile).toHaveBeenCalled());

    await press('Cambiar foto');

    expect(upload).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledWith('No se pudo usar la imagen', 'Elegí una imagen JPG o PNG.');
  });

  it('E1-H8.CA3 - shows why the server refused the file and keeps the previous photo', async () => {
    getProfile.mockResolvedValueOnce(ownProfile({ avatarUrl: AVATAR }));
    launchPicker.mockResolvedValueOnce(picked({}));
    upload.mockRejectedValueOnce(
      new ApiError('La imagen tiene que ser JPG o PNG.', 'image-format-not-supported')
    );
    render(<ProfileImagesEditor userId="usr-1" />);
    await screen.findByLabelText('Foto de perfil');

    await press('Cambiar foto');

    expect(alert).toHaveBeenCalledWith('Error', 'La imagen tiene que ser JPG o PNG.');
    expect(screen.getByLabelText('Foto de perfil').props.source).toEqual({ uri: AVATAR });
  });

  it('a failed delete keeps the photo and says why', async () => {
    getProfile.mockResolvedValueOnce(ownProfile({ avatarUrl: AVATAR }));
    remove.mockRejectedValueOnce(new ApiError('No se pudo eliminar la foto. Intentalo de nuevo.'));
    render(<ProfileImagesEditor userId="usr-1" />);
    await screen.findByLabelText('Foto de perfil');

    await press('Eliminar foto actual');

    expect(alert).toHaveBeenCalledWith('Error', 'No se pudo eliminar la foto. Intentalo de nuevo.');
    expect(screen.getByLabelText('Foto de perfil')).toBeTruthy();
  });

  it('closing the gallery without choosing changes nothing', async () => {
    launchPicker.mockResolvedValueOnce({ canceled: true, assets: null });
    render(<ProfileImagesEditor userId="usr-1" />);
    await waitFor(() => expect(getProfile).toHaveBeenCalled());

    await press('Cambiar foto');

    expect(upload).not.toHaveBeenCalled();
    expect(alert).not.toHaveBeenCalled();
  });

  it('says so when the gallery cannot be opened', async () => {
    launchPicker.mockRejectedValueOnce(new Error('permission denied'));
    render(<ProfileImagesEditor userId="usr-1" />);
    await waitFor(() => expect(getProfile).toHaveBeenCalled());

    await press('Cambiar foto');

    expect(alert).toHaveBeenCalledWith('Error', 'No se pudo abrir la galería. Intentalo de nuevo.');
  });

  it('keeps every button disabled while a change is on its way', async () => {
    let finish: (url: string) => void = () => undefined;
    launchPicker.mockResolvedValueOnce(picked({}));
    upload.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
    render(<ProfileImagesEditor userId="usr-1" />);
    await waitFor(() => expect(getProfile).toHaveBeenCalled());

    await press('Cambiar foto');

    expect(screen.getByLabelText('Guardando la foto')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Cambiar portada' }).props.accessibilityState
    ).toMatchObject({ disabled: true });

    await act(async () => finish(AVATAR));
    expect(screen.queryByLabelText('Guardando la foto')).toBeNull();
  });

  it('a failed read of the current images leaves the defaults and the buttons', async () => {
    getProfile.mockReset().mockRejectedValueOnce(new Error('offline'));
    render(<ProfileImagesEditor userId="usr-1" />);
    await waitFor(() => expect(getProfile).toHaveBeenCalled());

    expect(screen.getByTestId('default-avatar')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cambiar foto' })).toBeTruthy();
  });
});
