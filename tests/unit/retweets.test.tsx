import { act, fireEvent, render, renderHook, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { useRetweets } from '../../src/features/posts/useRetweets';
import { RetweetButton } from '../../src/features/posts/components/RetweetButton';
import { PostCard } from '../../src/features/posts/components/PostCard';
import { postService } from '../../src/features/posts/services/postService';
import { FeedItem } from '../../src/types/post';
import { ApiError } from '../../src/api/apiClient';

const item: FeedItem = {
  id: 'original',
  authorId: 'author',
  authorHandle: '@author',
  authorDisplayName: null,
  authorAvatarUrl: null,
  deleted: false,
  content: 'Contenido original',
  createdAt: '2026-10-17T12:00:00Z',
  entryId: 'post:original',
  activityAt: '2026-10-17T12:00:00Z',
  likesCount: 7,
  likedByMe: false,
  retweetsCount: 2,
  retweetedByMe: false,
  retweetedBy: null,
  repliesCount: 3,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function TwoEntries() {
  const retweets = useRetweets();
  return (
    <>
      {[item, { ...item, entryId: 'retweet:fan:original', retweetedBy: '@fan' }].map((entry) => (
        <PostCard
          key={entry.entryId}
          item={retweets.forPost(entry)}
          onRetweet={() => retweets.toggle(entry)}
          retweetPending={retweets.isPending(entry.id)}
        />
      ))}
    </>
  );
}

afterEach(() => jest.restoreAllMocks());

test('E2-H5.CA1 - names the sharer while preserving the original content and author', async () => {
  render(<PostCard item={{ ...item, retweetedBy: '@fan' }} />);
  await act(async () => undefined);
  expect(screen.getByText('Retweeteado por @fan')).toBeTruthy();
  expect(screen.getByText('@author')).toBeTruthy();
  expect(screen.getByText('Contenido original')).toBeTruthy();
});

test('E2-H5.CA2 - optimistic state and pending lock are shared by duplicate cards', async () => {
  const mutation = deferred<void>();
  const share = jest.spyOn(postService, 'retweet').mockReturnValue(mutation.promise);
  jest
    .spyOn(postService, 'getPost')
    .mockResolvedValue({ ...item, parentId: null, retweetedByMe: true, retweetsCount: 4 });
  render(<TwoEntries />);
  await act(async () => undefined);
  await act(async () =>
    fireEvent.press(screen.getAllByLabelText('Retweetear')[0], { stopPropagation: jest.fn() })
  );
  const buttons = screen.getAllByLabelText('Deshacer retweet');
  expect(buttons).toHaveLength(2);
  expect(screen.getAllByText('3')).toHaveLength(4);
  await act(async () => fireEvent.press(buttons[1], { stopPropagation: jest.fn() }));
  expect(share).toHaveBeenCalledTimes(1);
  await act(async () => mutation.resolve());
  expect(screen.getAllByText('4')).toHaveLength(2);
});

test('E2-H5.CA3 - undo decrements and reconciles without a negative counter', async () => {
  const undo = jest.spyOn(postService, 'undoRetweet').mockResolvedValue(undefined);
  jest.spyOn(postService, 'getPost').mockRejectedValue(new Error('offline'));
  const { result } = renderHook(() => useRetweets());
  const shared = { ...item, retweetedByMe: true, retweetsCount: 0 };
  await act(async () => result.current.toggle(shared));
  expect(undo).toHaveBeenCalledWith('original');
  expect(result.current.forPost(shared)).toMatchObject({ retweetedByMe: false, retweetsCount: 0 });
});

test('a failed mutation rolls back only retweet fields and reports the error', async () => {
  jest.spyOn(postService, 'retweet').mockRejectedValue(new ApiError('No disponible'));
  jest.spyOn(postService, 'getPost').mockRejectedValue(new Error('offline'));
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  const { result } = renderHook(() => useRetweets());
  await act(async () => result.current.toggle(item));
  expect(result.current.forPost({ ...item, likesCount: 99 }).likesCount).toBe(99);
  expect(result.current.forPost(item)).toMatchObject({ retweetsCount: 2, retweetedByMe: false });
  expect(alert).toHaveBeenCalledWith('Error', 'No disponible');
});

test('a lost response reconciles the committed server state', async () => {
  jest.spyOn(postService, 'retweet').mockRejectedValue(new Error('timeout'));
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  jest
    .spyOn(postService, 'getPost')
    .mockResolvedValue({ ...item, parentId: null, retweetedByMe: true, retweetsCount: 3 });
  const { result } = renderHook(() => useRetweets());
  await act(async () => result.current.toggle(item));
  expect(result.current.forPost(item)).toMatchObject({ retweetsCount: 3, retweetedByMe: true });
});

test('reads started before a mutation cannot replace the new state', async () => {
  jest.spyOn(postService, 'retweet').mockResolvedValue(undefined);
  jest.spyOn(postService, 'getPost').mockRejectedValue(new Error('offline'));
  const { result } = renderHook(() => useRetweets());
  const version = result.current.beginRead();
  await act(async () => result.current.toggle(item));
  expect(result.current.acceptRead(version, [item])).toBe(false);
  await act(async () => {
    expect(result.current.acceptRead(result.current.beginRead(), [item])).toBe(true);
  });
  expect(result.current.forPost(item).retweetedByMe).toBe(false);
});

test('reads during a pending mutation retain its optimistic overlay', async () => {
  const mutation = deferred<void>();
  jest.spyOn(postService, 'retweet').mockReturnValue(mutation.promise);
  jest.spyOn(postService, 'getPost').mockRejectedValue(new Error('offline'));
  const { result } = renderHook(() => useRetweets());
  let task!: Promise<void>;
  act(() => {
    task = result.current.toggle(item);
  });
  await act(async () => {
    expect(result.current.acceptRead(result.current.beginRead(), [item])).toBe(true);
  });
  expect(result.current.forPost(item).retweetedByMe).toBe(true);
  await act(async () => {
    mutation.resolve();
    await task;
  });
});

test('synchronous duplicate calls are ignored even before a render', async () => {
  const mutation = deferred<void>();
  const share = jest.spyOn(postService, 'retweet').mockReturnValue(mutation.promise);
  jest.spyOn(postService, 'getPost').mockRejectedValue(new Error('offline'));
  const { result } = renderHook(() => useRetweets());
  let task!: Promise<void>;
  act(() => {
    task = result.current.toggle(item);
    void result.current.toggle(item);
  });
  expect(share).toHaveBeenCalledTimes(1);
  await act(async () => {
    mutation.resolve();
    await task;
  });
});

test('the retweet button stops card navigation and exposes selected state', async () => {
  const stopPropagation = jest.fn();
  const onPress = jest.fn();
  render(<RetweetButton retweeted count={2} pending={false} onPress={onPress} />);
  await act(async () => undefined);
  fireEvent.press(screen.getByLabelText('Deshacer retweet'), { stopPropagation });
  expect(stopPropagation).toHaveBeenCalledTimes(1);
  expect(onPress).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText('Deshacer retweet').props.accessibilityState.selected).toBe(true);
});
