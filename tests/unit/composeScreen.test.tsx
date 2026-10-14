import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
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
  parentId: null,
  content: 'El post original',
  createdAt: '2026-09-22T15:00:00Z',
  likesCount: 0,
  likedByMe: false,
  retweetsCount: 0,
  repliesCount: 0,
};

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  mockParams = {};
});

describe('E2-H1. Crear Post', () => {
  it('shows the character counter starting at 0/280', () => {
    renderScreen();

    expect(screen.getByText('0/280')).toBeTruthy();
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

    expect(createPost).toHaveBeenCalledWith('Hola UdeSA-X');
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
