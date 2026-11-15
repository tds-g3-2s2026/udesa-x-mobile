import { PostMention } from '../../types/post';
import { ENDS_IN_WORD_CHARACTER, splitHashtags, TextSegment } from './hashtags';

export interface PostTextPart extends TextSegment {
  // The account a `@handle` links to; null for plain text and for hashtags.
  mention: PostMention | null;
}

const MENTION = /@([\p{L}\p{N}_]+)/gu;

// A `@handle` is a link only when posts-api listed it as a mention: that is
// what tells an account that exists from a word that merely follows an `@`.
// Handles are compared without regard to case, since `@Ana` and `@ana` are the
// same account. Like a hashtag, the `@` has to start a word, so `ana@udesa.edu.ar`
// has no mention in it. `offset` is where `text` starts in `content`, to look at
// what comes before it.
function splitMentions(
  text: string,
  offset: number,
  content: string,
  byHandle: Map<string, PostMention>
): PostTextPart[] {
  const parts: PostTextPart[] = [];
  let plainFrom = 0;
  for (const match of text.matchAll(MENTION)) {
    const mention = byHandle.get(match[1].toLowerCase());
    if (!mention || ENDS_IN_WORD_CHARACTER.test(content.slice(0, offset + match.index))) continue;
    if (match.index > plainFrom) {
      parts.push({ text: text.slice(plainFrom, match.index), hashtag: false, mention: null });
    }
    parts.push({ text: match[0], hashtag: false, mention });
    plainFrom = match.index + match[0].length;
  }
  if (plainFrom < text.length) {
    parts.push({ text: text.slice(plainFrom), hashtag: false, mention: null });
  }
  return parts;
}

// The text of a post as the pieces PostCard draws: plain text, hashtags and
// mentions. Hashtags are found by `splitHashtags`, so the rule is written once,
// and mentions are looked for only in what is left.
export function splitPostText(content: string, mentions: PostMention[] = []): PostTextPart[] {
  const byHandle = new Map(mentions.map((mention) => [mention.handle.toLowerCase(), mention]));
  const parts: PostTextPart[] = [];
  let offset = 0;
  for (const segment of splitHashtags(content)) {
    if (segment.hashtag || byHandle.size === 0) {
      parts.push({ ...segment, mention: null });
    } else {
      parts.push(...splitMentions(segment.text, offset, content, byHandle));
    }
    offset += segment.text.length;
  }
  return parts;
}
