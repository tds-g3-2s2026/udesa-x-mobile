// What the app tells assistant-api on every step. The field names are the ones
// of the simulated app the model was evaluated against (`evals/app.py` in
// assistant-api), so the phone shows the model what it was measured on.
export interface ScreenPost {
  ref: string;
  author: string;
  handle: string;
  text: string;
  likes: number;
  liked_by_me: boolean;
  retweeted_by_me: boolean;
  time: string;
}

export interface ScreenAccount {
  ref: string;
  handle: string;
  name: string;
  // Only known on a profile: search results do not say it.
  following?: boolean;
}

export type ScreenName = 'feed' | 'post' | 'search' | 'profile' | 'settings';

export interface Screen {
  screen: ScreenName;
  page?: number;
  more_below?: boolean;
  query?: string;
  preferences?: { theme: string; feed_language: string };
  posts?: ScreenPost[];
  accounts?: ScreenAccount[];
  replies?: string[];
}

// What happened when the app performed an action, sent back on the next step.
export interface StepResult {
  ok: boolean;
  done?: string;
  error?: string;
  // The user said no to a confirmation: the request ends here.
  cancelled?: boolean;
}

export type ActionArguments = Record<string, string>;
