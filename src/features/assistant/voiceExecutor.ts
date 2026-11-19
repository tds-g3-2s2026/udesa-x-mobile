import { FeedItem, FeedPage } from '../../types/post';
import { FollowState } from '../../types/social';
import { Account, PAGE_SIZE, Preferences, View, describe, resolve } from './assistantView';
import { ActionArguments, Screen, StepResult } from './types';

// What other people get to see. The app asks before doing any of these, even
// if the server forgot to say so: the rule does not depend on the model.
export const CONFIRMED_ACTIONS = new Set([
  'retweet_post',
  'reply_to_post',
  'compose_post',
  'follow',
]);

export interface Proposal {
  action: string;
  post?: FeedItem;
  account?: Account;
  // Replies and posts: what the model wrote, which the user can edit.
  text?: string;
}

export interface Confirmation {
  confirmed: boolean;
  text?: string;
}

// Everything the executor does goes through here: the real services in the
// app, fakes in the tests.
export interface AssistantDeps {
  getFeed(cursor: string | null): Promise<FeedPage>;
  getPost(postId: string): Promise<FeedItem>;
  getReplies(postId: string): Promise<FeedPage>;
  like(postId: string): Promise<void>;
  unlike(postId: string): Promise<void>;
  retweet(postId: string): Promise<void>;
  reply(postId: string, text: string): Promise<void>;
  compose(text: string): Promise<void>;
  search(query: string): Promise<{ posts: FeedItem[]; accounts: Account[] }>;
  getProfile(userId: string): Promise<Account>;
  getProfilePosts(userId: string): Promise<FeedItem[]>;
  follow(userId: string): Promise<FollowState>;
  getPreferences(): Promise<Preferences>;
  setTheme(theme: string): Promise<void>;
  setFeedLanguage(language: string): Promise<void>;
  confirm(proposal: Proposal): Promise<Confirmation>;
  errorMessage(error: unknown): string;
}

// An action that makes no sense on what the assistant is looking at. The model
// is told why and can try something else.
class ScreenError extends Error {}

type ProfileView = Extract<View, { kind: 'profile' }>;

export class VoiceExecutor {
  private view: View = { kind: 'feed', items: [], offset: 0, nextCursor: null };
  // The post or account the last action was about, for the panel to point at.
  private highlightedId: string | null = null;

  constructor(
    private readonly deps: AssistantDeps,
    private readonly onChange: () => void = () => {}
  ) {}

  async start(): Promise<void> {
    await this.loadFeed();
  }

  describe(now?: Date): Screen {
    return describe(this.view, now);
  }

  current(): { view: View; highlightedId: string | null } {
    return { view: this.view, highlightedId: this.highlightedId };
  }

  async perform(
    action: string,
    args: ActionArguments,
    needsConfirmation = false
  ): Promise<StepResult> {
    try {
      if (CONFIRMED_ACTIONS.has(action) || needsConfirmation) {
        const proposal = this.proposal(action, args);
        // Nothing to ask about an action that would change nothing.
        if (alreadyDone(proposal)) return { ok: true, done: await this.run(action, args) };
        const confirmation = await this.deps.confirm(proposal);
        if (!confirmation.confirmed) {
          return { ok: false, cancelled: true, error: 'El usuario no lo confirmó' };
        }
        if (confirmation.text !== undefined) args = { ...args, text: confirmation.text };
      }
      return { ok: true, done: await this.run(action, args) };
    } catch (error) {
      const message = error instanceof ScreenError ? error.message : this.deps.errorMessage(error);
      return { ok: false, error: message };
    } finally {
      this.onChange();
    }
  }

  // Checked before asking: the user is never asked to confirm what cannot be done.
  private proposal(action: string, args: ActionArguments): Proposal {
    if (action === 'follow') return { action, account: this.followable(args.ref).account };
    const post = args.ref ? this.post(args.ref) : undefined;
    return { action, post, text: args.text };
  }

  private async run(action: string, args: ActionArguments): Promise<string> {
    switch (action) {
      case 'scroll_feed':
        return this.scroll(args.direction);
      case 'refresh_feed':
        await this.loadFeed();
        return 'El feed está arriba de todo, con lo más nuevo';
      case 'open_post':
        return this.openPost(this.post(args.ref));
      case 'like_post':
        return this.setLike(this.post(args.ref), true);
      case 'unlike_post':
        return this.setLike(this.post(args.ref), false);
      case 'retweet_post':
        return this.retweet(this.post(args.ref));
      case 'reply_to_post': {
        const post = this.post(args.ref);
        await this.deps.reply(post.id, args.text);
        this.highlight(post.id);
        return 'Se publicó la respuesta';
      }
      case 'compose_post':
        await this.deps.compose(args.text);
        await this.loadFeed();
        return 'Se publicó el post';
      case 'search':
        return this.search(args.query);
      case 'open_profile':
        return this.openProfile(args.ref);
      case 'follow':
        return this.follow(args.ref);
      case 'set_preference':
        return this.setPreference(args.name, args.value);
      case 'finish':
        return 'Listo';
      default:
        throw new ScreenError(`${action} no es una acción de la app`);
    }
  }

  private target(ref: string): { post?: FeedItem; account?: Account } {
    const found = resolve(this.view, ref);
    if (!found) throw new ScreenError(`${ref} no está en la pantalla`);
    return found;
  }

  private post(ref: string): FeedItem {
    const { post } = this.target(ref);
    if (!post) throw new ScreenError(`${ref} no es un post`);
    return post;
  }

  private highlight(id: string | null): void {
    this.highlightedId = id;
  }

  private async loadFeed(): Promise<void> {
    const page = await this.deps.getFeed(null);
    this.view = {
      kind: 'feed',
      items: visibleItems(page.items),
      offset: 0,
      nextCursor: page.nextCursor,
    };
    this.highlight(null);
  }

  private async scroll(direction: string): Promise<string> {
    if (this.view.kind !== 'feed') {
      throw new ScreenError('scroll_feed solo funciona en el feed; refresh_feed vuelve al feed');
    }
    const feed = this.view;
    if (direction === 'up') {
      if (feed.offset === 0) throw new ScreenError('Ya estás arriba de todo');
      this.view = { ...feed, offset: Math.max(0, feed.offset - PAGE_SIZE) };
      return 'El feed se movió una pantalla';
    }
    let items = feed.items;
    let nextCursor = feed.nextCursor;
    // The next screen may go past what is loaded: one more page, like the feed does.
    if (feed.offset + 2 * PAGE_SIZE > items.length && nextCursor !== null) {
      const page = await this.deps.getFeed(nextCursor);
      items = [...items, ...visibleItems(page.items)];
      nextCursor = page.nextCursor;
    }
    if (feed.offset + PAGE_SIZE >= items.length)
      throw new ScreenError('Ya estás al final del feed');
    this.view = { kind: 'feed', items, offset: feed.offset + PAGE_SIZE, nextCursor };
    this.highlight(null);
    return 'El feed se movió una pantalla';
  }

  private async openPost(post: FeedItem): Promise<string> {
    const [fresh, replies] = await Promise.all([
      this.deps.getPost(post.id),
      this.deps.getReplies(post.id),
    ]);
    this.view = { kind: 'post', post: fresh, replies: visibleItems(replies.items) };
    this.highlight(fresh.id);
    return 'Se abrió el post';
  }

  private async setLike(post: FeedItem, liked: boolean): Promise<string> {
    this.highlight(post.id);
    if (post.likedByMe === liked) return liked ? 'Ya tenía tu like' : 'No tenía tu like';
    if (liked) await this.deps.like(post.id);
    else await this.deps.unlike(post.id);
    this.updatePost(post.id, {
      likedByMe: liked,
      likesCount: Math.max(0, post.likesCount + (liked ? 1 : -1)),
    });
    return liked ? 'Like dado' : 'Like sacado';
  }

  private async retweet(post: FeedItem): Promise<string> {
    this.highlight(post.id);
    if (post.retweetedByMe) return 'Ya estaba retuiteado';
    await this.deps.retweet(post.id);
    this.updatePost(post.id, { retweetedByMe: true, retweetsCount: post.retweetsCount + 1 });
    return 'Se retuiteó';
  }

  private async search(query: string): Promise<string> {
    const found = await this.deps.search(query);
    this.view = {
      kind: 'search',
      query,
      posts: visibleItems(found.posts),
      accounts: found.accounts,
    };
    this.highlight(null);
    return 'Resultados de la búsqueda';
  }

  private async openProfile(ref: string): Promise<string> {
    const { post, account } = this.target(ref);
    if (post?.authorDeleted) throw new ScreenError('La cuenta de ese post ya no existe');
    const userId = post ? post.authorId : (account as Account).id;
    const [profile, posts] = await Promise.all([
      this.deps.getProfile(userId),
      this.deps.getProfilePosts(userId),
    ]);
    this.view = { kind: 'profile', account: profile, posts: visibleItems(posts) };
    this.highlight(profile.id);
    return `Perfil de ${profile.name}`;
  }

  private followable(ref: string): { profile: ProfileView; account: Account } {
    const view = this.view;
    if (view.kind !== 'profile') {
      throw new ScreenError('Para seguir a alguien, primero abrí su perfil (open_profile)');
    }
    const { account } = this.target(ref);
    if (!account) throw new ScreenError(`${ref} no es una cuenta`);
    return { profile: view, account };
  }

  private async follow(ref: string): Promise<string> {
    const { profile, account } = this.followable(ref);
    if (account.following) return 'Ya lo seguías';
    const state = await this.deps.follow(account.id);
    this.view = { ...profile, account: { ...account, following: state === 'following' } };
    return state === 'pending'
      ? 'La cuenta es privada: quedó la solicitud de seguimiento'
      : 'Ahora lo seguís';
  }

  private async setPreference(name: string, value: string): Promise<string> {
    if (name === 'theme') await this.deps.setTheme(value);
    else if (name === 'feed_language') await this.deps.setFeedLanguage(value);
    else throw new ScreenError(`${name} no es una preferencia`);
    this.view = { kind: 'settings', preferences: await this.deps.getPreferences() };
    this.highlight(null);
    return 'Preferencia guardada';
  }

  // The same change on every copy of the post the view holds.
  private updatePost(postId: string, change: Partial<FeedItem>): void {
    const apply = (item: FeedItem) => (item.id === postId ? { ...item, ...change } : item);
    const view = this.view;
    switch (view.kind) {
      case 'feed':
        this.view = { ...view, items: view.items.map(apply) };
        break;
      case 'post':
        this.view = { ...view, post: apply(view.post) };
        break;
      case 'search':
        this.view = { ...view, posts: view.posts.map(apply) };
        break;
      case 'profile':
        this.view = { ...view, posts: view.posts.map(apply) };
        break;
    }
  }
}

function alreadyDone(proposal: Proposal): boolean {
  if (proposal.action === 'retweet_post') return proposal.post?.retweetedByMe === true;
  if (proposal.action === 'follow') return proposal.account?.following === true;
  return false;
}

// A deleted post has nothing to read or act on.
function visibleItems(items: FeedItem[]): FeedItem[] {
  return items.filter((item) => !item.deleted);
}
