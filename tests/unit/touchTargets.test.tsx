import React from 'react';
import { StyleSheet } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import ComposeScreen from '../../app/(app)/compose';
import { PostCard } from '../../src/features/posts/components/PostCard';
import { useAuthStore } from '../../src/stores/authStore';
import { MIN_TOUCH_TARGET } from '../../src/theme/touchTarget';
import { FeedItem } from '../../src/types/post';

const mockRouter = { back: jest.fn(), push: jest.fn() };

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({}),
}));

jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));

function post(overrides: Partial<FeedItem> = {}): FeedItem {
  return {
    id: 'post-1',
    authorId: 'usr-2',
    authorHandle: '@ana',
    authorDisplayName: 'Ana Pérez',
    authorAvatarUrl: null,
    authorDeleted: false,
    deleted: false,
    content: 'Hola',
    createdAt: '2026-10-17T12:00:00Z',
    images: [],
    likesCount: 0,
    likedByMe: false,
    savedByMe: false,
    retweetedByMe: false,
    retweetedBy: null,
    entryId: 'post:post-1',
    activityAt: '2026-10-17T12:00:00Z',
    retweetsCount: 0,
    repliesCount: 0,
    ...overrides,
  };
}

// The size a press can land on: the box itself, since none of these use hitSlop.
function expectFingerSized(label: string): void {
  const style = StyleSheet.flatten(screen.getByLabelText(label).props.style);
  expect(style.minWidth ?? style.width).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
  expect(style.minHeight ?? style.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
}

beforeEach(() => {
  useAuthStore.setState({
    user: { id: 'usr-1', handle: '@demo', email: 'demo@udesa.edu.ar', isVerified: true },
  });
});

describe('T-48. Revisión de UX, accesibilidad y consistencia visual', () => {
  it('T-48 - every action of a post card is at least 44 x 44', async () => {
    render(
      <PostCard
        item={post()}
        onLike={jest.fn()}
        onRetweet={jest.fn()}
        onBookmark={jest.fn()}
        onReply={jest.fn()}
        onReport={jest.fn()}
      />
    );
    await screen.findByLabelText('Dar me gusta');

    for (const label of [
      'Dar me gusta',
      'Retweetear',
      'Guardar post',
      'Responder a @ana',
      'Denunciar post de @ana',
    ]) {
      expectFingerSized(label);
    }
  });

  it('T-48 - deleting your own post, and both answers of its dialog, are at least 44 x 44', async () => {
    render(<PostCard item={post({ authorId: 'usr-1' })} onDelete={jest.fn()} />);

    fireEvent.press(await screen.findByLabelText('Eliminar publicación'), {
      stopPropagation: jest.fn(),
    });

    expectFingerSized('Eliminar publicación');
    for (const answer of ['Cancelar', 'Eliminar']) {
      const style = StyleSheet.flatten(screen.getByRole('button', { name: answer }).props.style);
      expect(style.minWidth).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
      expect(style.minHeight).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
    }
  });

  it('T-48 - the button that removes a picked image is 44 x 44 inside the thumbnail', async () => {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({
      canceled: false,
      assets: [
        {
          uri: 'file:///cache/uno.jpg',
          fileName: 'uno.jpg',
          mimeType: 'image/jpeg',
          fileSize: 200_000,
        },
      ],
    });
    render(
      <SafeAreaProvider
        initialMetrics={{
          insets: { top: 0, bottom: 0, left: 0, right: 0 },
          frame: { x: 0, y: 0, width: 390, height: 844 },
        }}
      >
        <ComposeScreen />
      </SafeAreaProvider>
    );

    await act(async () => {
      fireEvent.press(await screen.findByLabelText('Agregar imágenes'));
    });

    expectFingerSized('Quitar imagen 1');
    // Not past the thumbnail's edge: on Android a press there never arrives.
    const style = StyleSheet.flatten(screen.getByLabelText('Quitar imagen 1').props.style);
    expect(style.top).toBeGreaterThanOrEqual(0);
    expect(style.right).toBeGreaterThanOrEqual(0);
  });
});
