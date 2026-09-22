// Shape of POST /posts' 201 response. Counts start at zero and content
// already comes back sanitized: both are backend guarantees, nothing
// mobile has to enforce on its own.
export interface Post {
  id: string;
  authorId: string;
  content: string;
  createdAt: string;
  likesCount: number;
  retweetsCount: number;
  repliesCount: number;
}
