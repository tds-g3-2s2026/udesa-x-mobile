import { act, fireEvent, render, renderHook, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { PostCard } from '../../src/features/posts/components/PostCard';
import { usePostDeletion } from '../../src/features/posts/usePostDeletion';
import { postService } from '../../src/features/posts/services/postService';
import { postsApiClient } from '../../src/api/postsApiClient';
import { FeedItem } from '../../src/types/post';

const item: FeedItem = {
  id: 'post',
  authorId: 'author',
  authorHandle: '@author',
  authorDisplayName: null,
  authorAvatarUrl: null,
  content: 'Texto original',
  deleted: false,
  createdAt: '2026-10-17T12:00:00Z',
  activityAt: '2026-10-17T12:00:00Z',
  entryId: 'post:post',
  likesCount: 2,
  retweetsCount: 3,
  repliesCount: 1,
  likedByMe: true,
  retweetedByMe: true,
  retweetedBy: null,
};

afterEach(() => jest.restoreAllMocks());

test('E2-H3.CA2 - cancellation does not delete and confirmation sends once while pending', async () => {
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  let finish!: () => void;
  const request = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const remove = jest.spyOn(postService, 'deletePost').mockReturnValue(request);
  const refresh = jest.fn().mockResolvedValue(undefined);
  const { result } = renderHook(() => usePostDeletion(refresh));
  expect(remove).not.toHaveBeenCalled();
  await act(async () => {
    void result.current.remove(item);
    void result.current.remove(item);
  });
  expect(remove).toHaveBeenCalledTimes(1);
  expect(result.current.isPending(item.id)).toBe(true);
  expect(result.current.forPost(item).deleted).toBe(false);
  await act(async () => finish());
  expect(result.current.forPost(item)).toMatchObject({
    deleted: true,
    content: null,
    retweetsCount: 0,
  });
  expect(refresh).toHaveBeenCalledTimes(1);
});

test('E2-H3.CA4 - tombstones hide text and interactions but preserve thread navigation', async () => {
  const open = jest.fn();
  render(
    <PostCard
      item={{ ...item, deleted: true }}
      onOpen={open}
      onReply={jest.fn()}
      onRetweet={jest.fn()}
      onDelete={jest.fn()}
      onReport={jest.fn()}
    />
  );
  expect(screen.getByText('[Post eliminado]')).toBeTruthy();
  expect(screen.queryByText('Texto original')).toBeNull();
  expect(screen.queryByLabelText('Eliminar publicación')).toBeNull();
  expect(screen.queryByLabelText('Quitar me gusta')).toBeNull();
  expect(screen.queryByLabelText('Responder a @author')).toBeNull();
  fireEvent.press(screen.getByLabelText('Abrir la publicación de @author'));
  expect(open).toHaveBeenCalledTimes(1);
});

test('E2-H3.CA2 - failed deletion reconciles a committed response and survives refresh failure', async () => {
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  jest.spyOn(postService, 'deletePost').mockRejectedValue(new Error('lost response'));
  jest
    .spyOn(postService, 'getPost')
    .mockResolvedValue({ ...item, parentId: null, content: null, deleted: true });
  const { result } = renderHook(() =>
    usePostDeletion(async () => {
      throw new Error('refresh');
    })
  );
  await act(async () => {
    await result.current.remove(item);
  });
  expect(result.current.forPost({ ...item, entryId: 'retweet:fan:post' }).deleted).toBe(true);
  expect(result.current.forPost({ ...item, content: 'stale response' }).content).toBeNull();
  expect(Alert.alert).not.toHaveBeenCalled();
});

test('E2-H3.CA2 - unconfirmed failure preserves the post and permits retry', async () => {
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  const remove = jest.spyOn(postService, 'deletePost').mockRejectedValue(new Error('offline'));
  jest.spyOn(postService, 'getPost').mockRejectedValue(new Error('offline'));
  const { result } = renderHook(() => usePostDeletion(jest.fn()));
  await act(async () => {
    await result.current.remove(item);
  });
  expect(result.current.forPost(item)).toEqual(item);
  expect(result.current.isPending(item.id)).toBe(false);
  await act(async () => {
    await result.current.remove(item);
  });
  expect(remove).toHaveBeenCalledTimes(2);
});

test('deletePost uses the authenticated posts client', async () => {
  const request = jest.spyOn(postsApiClient, 'delete').mockResolvedValue({ status: 204 });
  await postService.deletePost('post');
  expect(request).toHaveBeenCalledWith('/posts/post');
});

test('E2-H3.CA2 - shared delete button confirms, cancels and does not navigate', () => {
  const remove = jest.fn();
  const open = jest.fn();
  render(<PostCard item={item} onOpen={open} onDelete={remove} />);
  fireEvent.press(screen.getByLabelText('Eliminar publicación'), { stopPropagation: jest.fn() });
  expect(remove).not.toHaveBeenCalled();
  fireEvent.press(screen.getByText('Cancelar'), { stopPropagation: jest.fn() });
  expect(remove).not.toHaveBeenCalled();
  fireEvent.press(screen.getByLabelText('Eliminar publicación'), { stopPropagation: jest.fn() });
  fireEvent.press(screen.getByText('Eliminar'), { stopPropagation: jest.fn() });
  expect(remove).toHaveBeenCalledTimes(1);
  expect(open).not.toHaveBeenCalled();
});

test('E2-H3.CA2 - closing the native modal cancels deletion', async () => {
  const { Modal } = jest.requireActual('react-native');
  const remove = jest.fn();
  const view = render(<PostCard item={item} onDelete={remove} />);
  await act(async () => undefined);
  fireEvent.press(screen.getByLabelText('Eliminar publicación'), { stopPropagation: jest.fn() });
  act(() => view.UNSAFE_getByType(Modal).props.onRequestClose());
  expect(screen.queryByText('¿Eliminar publicación?')).toBeNull();
  expect(remove).not.toHaveBeenCalled();
});

test('deletePost translates network failures for the screen', async () => {
  const { AxiosError } = jest.requireActual('axios');
  jest
    .spyOn(postsApiClient, 'delete')
    .mockRejectedValue(new AxiosError('Network Error', 'ERR_NETWORK'));
  await expect(postService.deletePost(item.id)).rejects.toMatchObject({
    message: 'No se pudo conectar con el servidor. Revisá tu conexión.',
  });
});

test.each([true, false])(
  'unmounted deletion finishes without refreshing or alerting (success: %s)',
  async (success) => {
    let finish!: () => void;
    let fail!: (error: Error) => void;
    jest.spyOn(postService, 'deletePost').mockReturnValue(
      new Promise<void>((resolve, reject) => {
        finish = resolve;
        fail = reject;
      })
    );
    jest.spyOn(postService, 'getPost').mockRejectedValue(new Error('offline'));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const refresh = jest.fn();
    const { result, unmount } = renderHook(() => usePostDeletion(refresh));
    let task!: Promise<void>;
    act(() => {
      task = result.current.remove(item);
    });
    unmount();
    await act(async () => {
      if (success) finish();
      else fail(new Error('offline'));
      await task;
    });
    expect(refresh).not.toHaveBeenCalled();
    expect(alert).not.toHaveBeenCalled();
  }
);
