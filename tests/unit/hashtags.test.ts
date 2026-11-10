import { splitHashtags } from '../../src/features/posts/hashtags';

// The same cases posts-api tests: what is drawn as a link has to be what it indexes.
const cases: [string, string[]][] = [
  ['Primer día #UdeSA #TDS', ['udesa', 'tds']],
  ['#UdeSA y #udesa y #UDESA', ['udesa']],
  ['café en el #café', ['café']],
  ['#ñandú', ['ñandú']],
  ['#123 y #guion_bajo', ['123', 'guion_bajo']],
  ['#fin.', ['fin']],
  ['(#entre-paréntesis)', ['entre']],
  ['sin hashtags', []],
  ['a#b no es un hashtag', []],
  ['##doble tampoco', []],
  ['# solo, #', []],
  ['mail@dominio.com#ancla', []],
];

function distinctLowercase(content: string): string[] {
  const tags = splitHashtags(content)
    .filter((part) => part.hashtag)
    .map((part) => part.text.slice(1).toLowerCase());
  return [...new Set(tags)];
}

describe('splitHashtags', () => {
  it.each(cases)('finds the hashtags of %j', (content, expected) => {
    expect(distinctLowercase(content)).toEqual(expected);
  });

  it('keeps every character of the text, in order', () => {
    const content = 'Hola #UdeSA, nos vemos #tds.';

    expect(
      splitHashtags(content)
        .map((part) => part.text)
        .join('')
    ).toBe(content);
  });

  it('keeps the original case of a hashtag so it reads as it was written', () => {
    expect(splitHashtags('#UdeSA')).toEqual([{ text: '#UdeSA', hashtag: true }]);
  });
});
