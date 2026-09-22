import { create } from 'zustand';
import { Post } from '../types/post';

// Stand-in for the feed until a real one (with pagination, pulling every
// account's posts) exists: in-memory only, holding just what this device
// published this session. Replacing this with the real feed should not
// require a rewrite of the compose screen that fills it.
interface FeedState {
  posts: Post[];
  addPost: (post: Post) => void;
}

export const useFeedStore = create<FeedState>((set) => ({
  posts: [],
  addPost: (post) => set((state) => ({ posts: [post, ...state.posts] })),
}));
