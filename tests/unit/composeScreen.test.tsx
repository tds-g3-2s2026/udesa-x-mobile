import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ComposeScreen from '../../app/(app)/compose';
import { postService } from '../../src/features/posts/services/postService';
import { useFeedStore } from '../../src/stores/feedStore';
import { ApiError } from '../../src/api/apiClient';
import { Post } from '../../src/types/post';

const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
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
  content: 'Hola UdeSA-X',
  createdAt: '2026-09-22T15:00:00Z',
  likesCount: 0,
  retweetsCount: 0,
  repliesCount: 0,
};

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  useFeedStore.setState({ posts: [] });
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

  it('publishes the typed content, adds it to the feed and goes back', async () => {
    const createPost = jest.spyOn(postService, 'createPost').mockResolvedValue(createdPost);

    renderScreen();
    fireEvent.changeText(
      screen.getByPlaceholderText('Escribí algo para compartir'),
      'Hola UdeSA-X'
    );
    await press('Publicar');

    expect(createPost).toHaveBeenCalledWith('Hola UdeSA-X');
    expect(useFeedStore.getState().posts).toEqual([createdPost]);
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
    expect(useFeedStore.getState().posts).toEqual([]);
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
