import { searchQueryClient, updateSearchAfterBlock } from '../../src/features/search/queryClient';
import { useAuthStore } from '../../src/stores/authStore';

it('E2-H10.CA5 removes a blocked author from both result types and invalidates searches', async () => {
  useAuthStore.setState({
    user: { id: 'viewer', handle: '@viewer', email: 'v@example.com', isVerified: true },
  });
  const key = ['search', 'viewer', 'users', 'ana'];
  searchQueryClient.setQueryData(key, {
    pages: [{ items: [{ id: 'blocked' }, { id: 'visible' }], nextCursor: 'next' }],
    pageParams: [null],
  });
  await updateSearchAfterBlock('viewer', 'blocked', true);
  expect(searchQueryClient.getQueryData(key)).toMatchObject({
    pages: [{ items: [{ id: 'visible' }], nextCursor: 'next' }],
  });
  expect(searchQueryClient.getQueryState(key)?.isInvalidated).toBe(true);
  await updateSearchAfterBlock('viewer', 'blocked', false);
  searchQueryClient.clear();
});

it('keeps the trending ranking out of the search cache that a block rewrites', async () => {
  useAuthStore.setState({
    user: { id: 'viewer', handle: '@viewer', email: 'v@example.com', isVerified: true },
  });
  const key = ['trending', 'viewer'];
  searchQueryClient.setQueryData(key, [{ tag: 'udesa', count: 3 }]);

  await expect(updateSearchAfterBlock('viewer', 'blocked', true)).resolves.toBeUndefined();

  expect(searchQueryClient.getQueryData(key)).toEqual([{ tag: 'udesa', count: 3 }]);
  searchQueryClient.clear();
});
