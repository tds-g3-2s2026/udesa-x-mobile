import { splitPostText } from '../../src/features/posts/postText';

const ana = { id: 'usr-1', handle: 'ana_dev' };
const luis = { id: 'usr-2', handle: 'Luis99' };

function linked(content: string, mentions = [ana, luis]): string[] {
  return splitPostText(content, mentions)
    .filter((part) => part.mention)
    .map((part) => part.text);
}

describe('splitPostText', () => {
  it.each([
    ['Hola @ana_dev y @luis99', ['@ana_dev', '@luis99']],
    ['@ANA_DEV abre el post', ['@ANA_DEV']],
    ['gracias @ana_dev.', ['@ana_dev']],
    ['(@ana_dev)', ['@ana_dev']],
    ['@ana_dev @ana_dev', ['@ana_dev', '@ana_dev']],
    ['@fantasma no existe', []],
    ['@ana_dev_largo no es @ana_dev', ['@ana_dev']],
    ['mail ana@ana_dev.com', []],
    ['sin menciones', []],
    ['un @ suelto y @', []],
  ])('links the mentions of %j', (content, expected) => {
    expect(linked(content)).toEqual(expected);
  });

  it('gives each link the account it points to', () => {
    const parts = splitPostText('@ana_dev y @LUIS99', [ana, luis]);

    expect(parts.filter((part) => part.mention).map((part) => part.mention)).toEqual([ana, luis]);
  });

  it('keeps every character of the text, in order', () => {
    const content = 'Hola @ana_dev, mirá #UdeSA con @fantasma y @luis99.';

    expect(
      splitPostText(content, [ana, luis])
        .map((part) => part.text)
        .join('')
    ).toBe(content);
  });

  it('leaves hashtags to the hashtag rule, and a mention glued to one is not a mention', () => {
    const parts = splitPostText('#UdeSA @ana_dev #tds@ana_dev', [ana]);

    expect(parts.filter((part) => part.hashtag).map((part) => part.text)).toEqual([
      '#UdeSA',
      '#tds',
    ]);
    expect(parts.filter((part) => part.mention).map((part) => part.text)).toEqual(['@ana_dev']);
  });

  it('is the same as the hashtag split when there are no mentions to look for', () => {
    expect(splitPostText('Hola #UdeSA @ana_dev')).toEqual([
      { text: 'Hola ', hashtag: false, mention: null },
      { text: '#UdeSA', hashtag: true, mention: null },
      { text: ' @ana_dev', hashtag: false, mention: null },
    ]);
  });
});
