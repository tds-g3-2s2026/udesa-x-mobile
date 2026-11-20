import { act, render, screen } from '@testing-library/react-native';
import { QuotedPost } from '../../src/features/posts/components/QuotedPost';
import { postService } from '../../src/features/posts/services/postService';
import { ApiError } from '../../src/api/apiClient';
import { PostDetail } from '../../src/types/post';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

function original(id: string, content: string): PostDetail {
  return {
    id,
    authorId: `usr-${id}`,
    authorHandle: `@${id}`,
    authorDisplayName: null,
    authorAvatarUrl: null,
    authorDeleted: false,
    deleted: false,
    content,
    createdAt: '2026-11-20T12:00:00Z',
    images: [],
    likesCount: 0,
    likedByMe: false,
    savedByMe: false,
    retweetedByMe: false,
    retweetedBy: null,
    entryId: `post:${id}`,
    activityAt: '2026-11-20T12:00:00Z',
    retweetsCount: 0,
    repliesCount: 0,
    parentId: null,
  };
}

afterEach(() => {
  jest.restoreAllMocks();
});

// A recycled row can get a new quote while the previous original is still on
// its way: whatever that answer brings, the box shows the post quoted now.
it.each(['arrives', 'fails'] as const)(
  'an original that %s late does not replace the one quoted now',
  async (outcome) => {
    let settle: () => void = () => undefined;
    const late = new Promise<PostDetail>((resolve, reject) => {
      settle = () =>
        outcome === 'arrives'
          ? resolve(original('post-9', 'Viejo'))
          : reject(new ApiError('Sin conexión.'));
    });
    jest
      .spyOn(postService, 'getPost')
      .mockReturnValueOnce(late)
      .mockResolvedValueOnce(original('post-8', 'Nuevo'));

    const { rerender } = render(<QuotedPost postId="post-9" />);
    rerender(<QuotedPost postId="post-8" />);
    expect(await screen.findByText('Nuevo')).toBeTruthy();

    await act(async () => settle());

    expect(screen.getByText('Nuevo')).toBeTruthy();
    expect(screen.queryByText('Viejo')).toBeNull();
    expect(screen.queryByText('Post no disponible')).toBeNull();
  }
);
