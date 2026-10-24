import { useEffect } from 'react';
import { usePostInteractions } from '../../src/features/posts/usePostInteractions';
import { FeedItem } from '../../src/types/post';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { LikeButton } from '../../src/features/posts/components/LikeButton';
import { postService } from '../../src/features/posts/services/postService';
import { ApiError } from '../../src/api/apiClient';

const original: FeedItem = {
  id: 'post-1',
  authorId: 'author',
  authorHandle: '@author',
  authorDisplayName: null,
  authorAvatarUrl: null,
  authorDeleted: false,
  deleted: false,
  content: 'post',
  createdAt: '2026-10-17T12:00:00Z',
  activityAt: '2026-10-17T12:00:00Z',
  entryId: 'post:post-1',
  likedByMe: false,
  images: [],
  likesCount: 0,
  retweetedByMe: false,
  retweetsCount: 0,
  retweetedBy: null,
  repliesCount: 0,
};

function LikeHarness({ liked, count }: { liked: boolean; count: number }) {
  const interactions = usePostInteractions();
  const { beginRead, acceptRead } = interactions;
  const item = { ...original, likedByMe: liked, likesCount: count };
  useEffect(() => {
    acceptRead(beginRead(), [{ ...original, likedByMe: liked, likesCount: count }]);
  }, [liked, count, beginRead, acceptRead]);
  const current = interactions.forPost(item);
  return (
    <LikeButton
      liked={current.likedByMe}
      count={current.likesCount}
      pending={interactions.isLikePending(item.id)}
      onPress={() => interactions.toggleLike(item)}
    />
  );
}

beforeEach(() => jest.spyOn(postService, 'getPost').mockRejectedValue(new Error('offline')));

// The empty act lets the icon font settle after the first render, which would
// otherwise warn about an update nobody awaited.
async function renderButton(liked: boolean, count: number) {
  const view = render(<LikeHarness liked={liked} count={count} />);
  await act(async () => undefined);
  return view;
}

async function tap(label: string): Promise<void> {
  await act(async () => {
    fireEvent.press(screen.getByLabelText(label), { stopPropagation: jest.fn() });
  });
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('E2-H6. Like a un Post', () => {
  it('shows the state and the count the server sent', async () => {
    await renderButton(true, 5);

    expect(screen.getByLabelText('Quitar me gusta')).toBeTruthy();
    expect(screen.getByText('5')).toBeTruthy();
  });

  it('E2-H6.CA1 - tapping an unliked post likes it and flips the button', async () => {
    const like = jest.spyOn(postService, 'likePost').mockResolvedValue(undefined);
    const unlike = jest.spyOn(postService, 'unlikePost');

    await renderButton(false, 2);
    await tap('Dar me gusta');

    expect(like).toHaveBeenCalledWith('post-1');
    expect(unlike).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Quitar me gusta')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('E2-H6.CA1 - tapping a liked post removes the like', async () => {
    const like = jest.spyOn(postService, 'likePost');
    const unlike = jest.spyOn(postService, 'unlikePost').mockResolvedValue(undefined);

    await renderButton(true, 2);
    await tap('Quitar me gusta');

    expect(unlike).toHaveBeenCalledWith('post-1');
    expect(like).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Dar me gusta')).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();
  });

  it('E2-H6.CA2 - the count moves before the server answers', async () => {
    jest.spyOn(postService, 'likePost').mockReturnValue(new Promise(() => undefined));

    await renderButton(false, 2);
    await tap('Dar me gusta');

    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByLabelText('Quitar me gusta')).toBeTruthy();
  });

  it('E2-H6.CA2 - a failed like goes back to how it was and says so', async () => {
    jest
      .spyOn(postService, 'likePost')
      .mockRejectedValue(new ApiError('La publicación no existe.'));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    await renderButton(false, 2);
    await tap('Dar me gusta');

    expect(alert).toHaveBeenCalledWith('Error', 'La publicación no existe.');
    expect(screen.getByLabelText('Dar me gusta')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('E2-H6.CA2 - a failed unlike goes back to liked, with the original count', async () => {
    jest
      .spyOn(postService, 'unlikePost')
      .mockRejectedValue(new ApiError('No se pudo quitar el me gusta. Intentalo de nuevo.'));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    await renderButton(true, 2);
    await tap('Quitar me gusta');

    expect(alert).toHaveBeenCalledWith(
      'Error',
      'No se pudo quitar el me gusta. Intentalo de nuevo.'
    );
    expect(screen.getByLabelText('Quitar me gusta')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('ignores a second tap while the first call is still on its way', async () => {
    const like = jest.spyOn(postService, 'likePost').mockReturnValue(new Promise(() => undefined));

    await renderButton(false, 2);
    await tap('Dar me gusta');
    await tap('Quitar me gusta');

    expect(like).toHaveBeenCalledTimes(1);
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('can be tapped again once the previous call finished', async () => {
    const like = jest.spyOn(postService, 'likePost').mockResolvedValue(undefined);
    const unlike = jest.spyOn(postService, 'unlikePost').mockResolvedValue(undefined);

    await renderButton(false, 2);
    await tap('Dar me gusta');
    await tap('Quitar me gusta');

    expect(like).toHaveBeenCalledTimes(1);
    expect(unlike).toHaveBeenCalledTimes(1);
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('what the list reloads with replaces what the button remembered', async () => {
    const view = await renderButton(false, 2);

    await act(async () => {
      view.rerender(<LikeHarness liked count={7} />);
    });

    expect(screen.getByLabelText('Quitar me gusta')).toBeTruthy();
    expect(screen.getByText('7')).toBeTruthy();
  });

  it('never shows a negative count, even if the server count was already behind', async () => {
    jest.spyOn(postService, 'unlikePost').mockResolvedValue(undefined);

    await renderButton(true, 0);
    await tap('Quitar me gusta');

    expect(screen.getByText('0')).toBeTruthy();
  });
});
