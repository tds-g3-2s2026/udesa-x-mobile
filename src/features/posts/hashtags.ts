export interface TextSegment {
  text: string;
  hashtag: boolean;
}

// A `#` that starts a word and is followed by letters, digits or `_`. It has to
// follow the same rule as posts-api, which indexes what this draws as a link.
const HASHTAG = /#([\p{L}\p{N}_]+)/gu;
const ENDS_IN_WORD_CHARACTER = /[\p{L}\p{N}_#]$/u;

export function splitHashtags(content: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let plainFrom = 0;
  for (const match of content.matchAll(HASHTAG)) {
    const start = match.index;
    if (ENDS_IN_WORD_CHARACTER.test(content.slice(0, start))) continue;
    if (start > plainFrom) segments.push({ text: content.slice(plainFrom, start), hashtag: false });
    segments.push({ text: match[0], hashtag: true });
    plainFrom = start + match[0].length;
  }
  if (plainFrom < content.length) segments.push({ text: content.slice(plainFrom), hashtag: false });
  return segments;
}
