import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import ComposeScreen from '../../app/(app)/compose';
import { postService } from '../../src/features/posts/services/postService';
import { ApiError } from '../../src/api/apiClient';
import { Post, PostDetail } from '../../src/types/post';

const mockBack = jest.fn();
// One object for the whole file: the composer reads the original post from an
// effect that depends on the router, so a new object per render would loop.
const mockRouter = { back: mockBack };
let mockParams: { parentId?: string } = {};

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams,
}));

// The gallery is a native screen: what the user picks is whatever the test says.
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
const launchPicker = ImagePicker.launchImageLibraryAsync as jest.Mock;

const initialMetrics = {
  insets: { top: 0, bottom: 0, left: 0, right: 0 },
  frame: { x: 0, y: 0, width: 390, height: 844 },
};

function renderScreen() {
  return render(
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <ComposeScreen />
    </SafeAreaProvider>
  );
}

async function press(label: string): Promise<void> {
  await act(async () => {
    fireEvent.press(screen.getByText(label));
  });
}

const createdPost: Post = {
  id: 'post-1',
  authorId: 'usr-1',
  parentId: null,
  content: 'Hola UdeSA-X',
  createdAt: '2026-09-22T15:00:00Z',
  images: [],
  likesCount: 0,
  retweetsCount: 0,
  repliesCount: 0,
};

const original: PostDetail = {
  id: 'post-1',
  authorId: 'usr-2',
  authorHandle: '@joaquin_dev',
  authorDisplayName: null,
  authorAvatarUrl: null,
  authorDeleted: false,
  deleted: false,
  parentId: null,
  content: 'El post original',
  createdAt: '2026-09-22T15:00:00Z',
  images: [],
  likesCount: 0,
  likedByMe: false,
  retweetedByMe: false,
  retweetedBy: null,
  entryId: 'post:post-1',
  activityAt: '2026-09-22T15:00:00Z',
  retweetsCount: 0,
  repliesCount: 0,
};

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  mockParams = {};
});

describe('E2-H1. Crear Post', () => {
  it('shows the character counter starting at 0/280', async () => {
    renderScreen();

    // Waits on a find: the image icon loads its font after the first render,
    // and a test that ends before that leaves the update outside act().
    expect(await screen.findByText('0/280')).toBeTruthy();
  });

  it('E2-H1.CA2 - Publicar is blocked while the field is blank or only spaces', async () => {
    const createPost = jest.spyOn(postService, 'createPost');

    renderScreen();
    await press('Publicar');
    expect(createPost).not.toHaveBeenCalled();

    fireEvent.changeText(screen.getByPlaceholderText('Escribí algo para compartir'), '   ');
    await press('Publicar');
    expect(createPost).not.toHaveBeenCalled();
  });

  it('E2-H1.CA1 - Publicar is blocked past 280 characters, same as the field going empty', async () => {
    const createPost = jest.spyOn(postService, 'createPost');

    renderScreen();
    fireEvent.changeText(
      screen.getByPlaceholderText('Escribí algo para compartir'),
      'a'.repeat(281)
    );

    expect(screen.getByText('281/280')).toBeTruthy();
    await press('Publicar');
    expect(createPost).not.toHaveBeenCalled();
  });

  it('publishes the typed content and goes back to the feed', async () => {
    const createPost = jest.spyOn(postService, 'createPost').mockResolvedValue(createdPost);

    renderScreen();
    fireEvent.changeText(
      screen.getByPlaceholderText('Escribí algo para compartir'),
      'Hola UdeSA-X'
    );
    await press('Publicar');

    expect(createPost).toHaveBeenCalledWith('Hola UdeSA-X', []);
    expect(mockBack).toHaveBeenCalled();
  });

  it('E2-H1.CA5 - a publish failure shows the API message and keeps the draft on screen', async () => {
    jest
      .spyOn(postService, 'createPost')
      .mockRejectedValue(
        new ApiError('Alcanzaste el límite de 30 publicaciones por hora. Probá más tarde.')
      );
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    renderScreen();
    fireEvent.changeText(screen.getByPlaceholderText('Escribí algo para compartir'), 'otro post');
    await press('Publicar');

    expect(alert).toHaveBeenCalledWith(
      'Error',
      'Alcanzaste el límite de 30 publicaciones por hora. Probá más tarde.'
    );
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('Cancelar returns to the feed without publishing anything', async () => {
    const createPost = jest.spyOn(postService, 'createPost');

    renderScreen();
    fireEvent.changeText(
      screen.getByPlaceholderText('Escribí algo para compartir'),
      'un post que no se manda'
    );
    await press('Cancelar');

    expect(createPost).not.toHaveBeenCalled();
    expect(mockBack).toHaveBeenCalled();
  });
});

describe('E2-H4. Responder a un Post', () => {
  beforeEach(() => {
    mockParams = { parentId: 'post-1' };
    jest.spyOn(postService, 'getPost').mockResolvedValue(original);
  });

  it('E2-H4.CA1 - shows who is being answered together with the original post', async () => {
    renderScreen();

    expect(await screen.findByText('Respondiendo a @joaquin_dev')).toBeTruthy();
    expect(screen.getByText('El post original')).toBeTruthy();
  });

  it('E1-H4.CA5 - answering a reply from a deleted account names it as a deleted user', async () => {
    jest.spyOn(postService, 'getPost').mockResolvedValue({
      ...original,
      authorHandle: null,
      authorDisplayName: null,
      authorDeleted: true,
    });

    renderScreen();

    expect(await screen.findByText('Respondiendo a [Usuario eliminado]')).toBeTruthy();
    expect(screen.getByText('El post original')).toBeTruthy();
  });

  it('E2-H4.CA1 - sends the text as a reply to that post and goes back', async () => {
    const createReply = jest.spyOn(postService, 'createReply').mockResolvedValue({
      ...createdPost,
      id: 'reply-1',
      parentId: 'post-1',
    });
    const createPost = jest.spyOn(postService, 'createPost');

    renderScreen();
    await screen.findByText('Respondiendo a @joaquin_dev');
    fireEvent.changeText(screen.getByPlaceholderText('Escribí tu respuesta'), 'Buenísimo');
    await press('Responder');

    expect(createReply).toHaveBeenCalledWith('post-1', 'Buenísimo');
    expect(createPost).not.toHaveBeenCalled();
    expect(mockBack).toHaveBeenCalled();
  });

  it('E2-H4.CA2 - the reply has the same 280 characters limit as a post', async () => {
    const createReply = jest.spyOn(postService, 'createReply');

    renderScreen();
    await screen.findByText('Respondiendo a @joaquin_dev');
    fireEvent.changeText(screen.getByPlaceholderText('Escribí tu respuesta'), 'a'.repeat(281));

    expect(screen.getByText('281/280')).toBeTruthy();
    await press('Responder');
    expect(createReply).not.toHaveBeenCalled();
  });

  it('E2-H4.CA2 - a blank reply cannot be sent', async () => {
    const createReply = jest.spyOn(postService, 'createReply');

    renderScreen();
    await screen.findByText('Respondiendo a @joaquin_dev');
    fireEvent.changeText(screen.getByPlaceholderText('Escribí tu respuesta'), '   ');
    await press('Responder');

    expect(createReply).not.toHaveBeenCalled();
  });

  it('cannot be sent before the original post has loaded', async () => {
    jest.spyOn(postService, 'getPost').mockReturnValue(new Promise(() => undefined));
    const createReply = jest.spyOn(postService, 'createReply');

    renderScreen();
    fireEvent.changeText(screen.getByPlaceholderText('Escribí tu respuesta'), 'Buenísimo');
    await press('Responder');

    expect(createReply).not.toHaveBeenCalled();
  });

  it('E2-H4.CA3 - a 404 says the post cannot be answered, without naming a block', async () => {
    jest
      .spyOn(postService, 'createReply')
      .mockRejectedValue(new ApiError('La publicación no existe.', 'post-not-found'));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    renderScreen();
    await screen.findByText('Respondiendo a @joaquin_dev');
    fireEvent.changeText(screen.getByPlaceholderText('Escribí tu respuesta'), 'Buenísimo');
    await press('Responder');

    expect(alert).toHaveBeenCalledWith('Error', 'No podés responder a esta publicación.');
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('E2-H4.CA2 - any other failure shows the API message and keeps the draft', async () => {
    jest
      .spyOn(postService, 'createReply')
      .mockRejectedValue(
        new ApiError('Alcanzaste el límite de 30 publicaciones por hora. Probá más tarde.')
      );
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    renderScreen();
    await screen.findByText('Respondiendo a @joaquin_dev');
    fireEvent.changeText(screen.getByPlaceholderText('Escribí tu respuesta'), 'Buenísimo');
    await press('Responder');

    expect(alert).toHaveBeenCalledWith(
      'Error',
      'Alcanzaste el límite de 30 publicaciones por hora. Probá más tarde.'
    );
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('E2-H4.CA3 - an original that cannot be read closes the composer with the same message', async () => {
    jest
      .spyOn(postService, 'getPost')
      .mockRejectedValue(new ApiError('La publicación no existe.', 'post-not-found'));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    renderScreen();

    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith('Error', 'No podés responder a esta publicación.')
    );
    expect(mockBack).toHaveBeenCalled();
  });

  it('a screen closed before the original arrives ignores the late answer', async () => {
    let resolve: (post: PostDetail) => void = () => undefined;
    jest.spyOn(postService, 'getPost').mockReturnValue(new Promise((done) => (resolve = done)));

    const view = renderScreen();
    view.unmount();
    await act(async () => resolve(original));

    expect(mockBack).not.toHaveBeenCalled();
  });

  it('a screen closed before the original fails ignores the late failure', async () => {
    let reject: (error: Error) => void = () => undefined;
    jest.spyOn(postService, 'getPost').mockReturnValue(new Promise((_, fail) => (reject = fail)));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    const view = renderScreen();
    view.unmount();
    await act(async () => reject(new ApiError('La publicación no existe.', 'post-not-found')));

    expect(alert).not.toHaveBeenCalled();
    expect(mockBack).not.toHaveBeenCalled();
  });
});

test('E2-H3.CA4 - a deleted parent disables replying without discarding the draft', async () => {
  mockParams = { parentId: 'post-1' };
  jest
    .spyOn(postService, 'getPost')
    .mockResolvedValue({ ...original, deleted: true, content: null });
  const submit = jest.spyOn(postService, 'createReply');
  renderScreen();
  expect(await screen.findByText('Esta publicación fue eliminada.')).toBeTruthy();
  fireEvent.changeText(screen.getByPlaceholderText('Escribí tu respuesta'), 'Mi borrador');
  await press('Responder');
  expect(submit).not.toHaveBeenCalled();
  expect(screen.getByDisplayValue('Mi borrador')).toBeTruthy();
});

test('E2-H3.CA4 - deletion while composing keeps the draft and prevents a second submission', async () => {
  mockParams = { parentId: 'post-1' };
  jest.spyOn(postService, 'getPost').mockResolvedValue(original);
  const submit = jest
    .spyOn(postService, 'createReply')
    .mockRejectedValue(new ApiError('Esta publicación fue eliminada.', 'post-deleted'));
  renderScreen();
  await screen.findByText('El post original');
  fireEvent.changeText(screen.getByPlaceholderText('Escribí tu respuesta'), 'Mi borrador');
  await press('Responder');
  expect(await screen.findByText('Esta publicación fue eliminada.')).toBeTruthy();
  expect(screen.getByDisplayValue('Mi borrador')).toBeTruthy();
  await press('Responder');
  expect(submit).toHaveBeenCalledTimes(1);
});

function picked(...assets: Record<string, unknown>[]) {
  launchPicker.mockResolvedValueOnce({ canceled: false, assets });
}

function jpg(name: string, extra: Record<string, unknown> = {}) {
  return {
    uri: `file:///cache/${name}`,
    fileName: name,
    mimeType: 'image/jpeg',
    fileSize: 200_000,
    ...extra,
  };
}

async function attach(...assets: Record<string, unknown>[]) {
  picked(...assets);
  await act(async () => {
    fireEvent.press(screen.getByLabelText('Agregar imágenes'));
  });
}

describe('E2-H7. Post con Imagen', () => {
  it('E2-H7.CA1 - opens the gallery for up to four images at once, untouched', async () => {
    renderScreen();

    await attach(jpg('uno.jpg'));

    expect(launchPicker).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: 4,
        quality: 1,
      })
    );
  });

  it('E2-H7.CA1 - lists what was picked with a remove button each', async () => {
    renderScreen();

    await attach(jpg('uno.jpg'), jpg('dos.jpg'));

    expect(screen.getByText('Imágenes 2/4')).toBeTruthy();
    expect(screen.getByLabelText('Quitar imagen 1')).toBeTruthy();
    expect(screen.getByLabelText('Quitar imagen 2')).toBeTruthy();
  });

  it('E2-H7.CA1 - removing one leaves the others and frees its place', async () => {
    renderScreen();
    await attach(jpg('uno.jpg'), jpg('dos.jpg'));

    fireEvent.press(screen.getByLabelText('Quitar imagen 1'));

    expect(screen.getByText('Imágenes 1/4')).toBeTruthy();
    expect(screen.queryByLabelText('Quitar imagen 2')).toBeNull();
    await attach(jpg('tres.jpg'));
    expect(launchPicker).toHaveBeenLastCalledWith(expect.objectContaining({ selectionLimit: 3 }));
  });

  it('E2-H7.CA1 - with four attached the gallery cannot be opened again', async () => {
    renderScreen();
    await attach(jpg('1.jpg'), jpg('2.jpg'), jpg('3.jpg'), jpg('4.jpg'));
    launchPicker.mockClear();

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Agregar imágenes'));
    });

    expect(screen.getByText('Imágenes 4/4')).toBeTruthy();
    expect(launchPicker).not.toHaveBeenCalled();
  });

  it('E2-H7.CA2 - an image over 1 MB is warned about by name and never attached', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    renderScreen();

    await attach(jpg('grande.jpg', { fileSize: 1_048_577 }), jpg('chica.jpg'));

    expect(alert).toHaveBeenCalledWith(
      'Algunas imágenes no se agregaron',
      'grande.jpg pesa más de 1 MB.'
    );
    expect(screen.getByText('Imágenes 1/4')).toBeTruthy();
  });

  it('E2-H7.CA1 - a format other than JPG or PNG is warned about and never attached', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    renderScreen();

    await attach(jpg('animacion.gif', { mimeType: 'image/gif' }));

    expect(alert).toHaveBeenCalledWith(
      'Algunas imágenes no se agregaron',
      'animacion.gif no es JPG ni PNG.'
    );
    expect(screen.getByText('Imágenes 0/4')).toBeTruthy();
  });

  it('closing the gallery without choosing changes nothing', async () => {
    launchPicker.mockResolvedValueOnce({ canceled: true, assets: null });
    renderScreen();

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Agregar imágenes'));
    });

    expect(screen.getByText('Imágenes 0/4')).toBeTruthy();
  });

  it('a gallery that fails to open shows an alert instead of a dead button', async () => {
    launchPicker.mockRejectedValueOnce(new Error('boom'));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    renderScreen();

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Agregar imágenes'));
    });

    expect(alert).toHaveBeenCalledWith('Error', 'No se pudo abrir la galería. Intentalo de nuevo.');
  });

  it('a post with only images can be published, with the images in the order they were picked', async () => {
    const createPost = jest.spyOn(postService, 'createPost').mockResolvedValue(createdPost);
    renderScreen();
    await attach(jpg('uno.jpg'), jpg('dos.jpg'));

    await press('Publicar');

    expect(createPost).toHaveBeenCalledWith('', [
      { uri: 'file:///cache/uno.jpg', name: 'uno.jpg', mimeType: 'image/jpeg' },
      { uri: 'file:///cache/dos.jpg', name: 'dos.jpg', mimeType: 'image/jpeg' },
    ]);
    expect(mockBack).toHaveBeenCalled();
  });

  it('publishes the text together with the images', async () => {
    const createPost = jest.spyOn(postService, 'createPost').mockResolvedValue(createdPost);
    renderScreen();
    await attach(jpg('uno.jpg'));
    fireEvent.changeText(screen.getByPlaceholderText('Escribí algo para compartir'), 'Con foto');

    await press('Publicar');

    expect(createPost).toHaveBeenCalledWith('Con foto', [
      { uri: 'file:///cache/uno.jpg', name: 'uno.jpg', mimeType: 'image/jpeg' },
    ]);
  });

  it('still refuses a blank post when there are no images either', async () => {
    const createPost = jest.spyOn(postService, 'createPost');
    renderScreen();

    await press('Publicar');

    expect(createPost).not.toHaveBeenCalled();
  });

  it('E2-H7.CA2 - a server refusal keeps the draft and its images on screen', async () => {
    jest
      .spyOn(postService, 'createPost')
      .mockRejectedValue(new ApiError('Cada imagen puede pesar hasta 1 MB.', 'image-too-large'));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    renderScreen();
    await attach(jpg('uno.jpg'));

    await press('Publicar');

    expect(alert).toHaveBeenCalledWith('Error', 'Cada imagen puede pesar hasta 1 MB.');
    expect(screen.getByText('Imágenes 1/4')).toBeTruthy();
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('a reply has no image button, since replies are text only', async () => {
    mockParams = { parentId: 'post-1' };
    jest.spyOn(postService, 'getPost').mockResolvedValue(original);

    renderScreen();
    await screen.findByText('Respondiendo a @joaquin_dev');

    expect(screen.queryByLabelText('Agregar imágenes')).toBeNull();
  });
});
