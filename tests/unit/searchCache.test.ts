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
  await updateSearchAfterBlock('blocked', true);
  expect(searchQueryClient.getQueryData(key)).toMatchObject({
    pages: [{ items: [{ id: 'visible' }], nextCursor: 'next' }],
  });
  expect(searchQueryClient.getQueryState(key)?.isInvalidated).toBe(true);
  await updateSearchAfterBlock('blocked', false);
  searchQueryClient.clear();
});
