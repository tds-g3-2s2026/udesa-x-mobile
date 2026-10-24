import {
  acceptPickedImages,
  MAX_IMAGE_BYTES,
  MAX_POST_IMAGES,
  PickerAsset,
} from '../../src/features/posts/postImages';

function asset(overrides: Partial<PickerAsset> = {}): PickerAsset {
  return {
    uri: 'file:///cache/foto.jpg',
    fileName: 'foto.jpg',
    mimeType: 'image/jpeg',
    fileSize: 200_000,
    ...overrides,
  };
}

describe('E2-H7. Post con Imagen', () => {
  it('E2-H7.CA2 - the limit is the same 1 MB the server enforces', () => {
    expect(MAX_IMAGE_BYTES).toBe(1_048_576);
  });

  it('E2-H7.CA1 - a post takes up to four images', () => {
    expect(MAX_POST_IMAGES).toBe(4);
  });

  it('E2-H7.CA1 - accepts JPG and PNG and keeps where each one is', () => {
    const result = acceptPickedImages(
      [
        asset(),
        asset({ uri: 'file:///cache/captura.png', fileName: 'captura.png', mimeType: 'image/png' }),
      ],
      0
    );

    expect(result.rejected).toEqual([]);
    expect(result.accepted).toEqual([
      { uri: 'file:///cache/foto.jpg', name: 'foto.jpg', mimeType: 'image/jpeg' },
      { uri: 'file:///cache/captura.png', name: 'captura.png', mimeType: 'image/png' },
    ]);
  });

  it('E2-H7.CA1 - refuses any other format and says which file it was', () => {
    const result = acceptPickedImages(
      [asset({ fileName: 'animacion.gif', mimeType: 'image/gif' }), asset()],
      0
    );

    expect(result.rejected).toEqual([{ name: 'animacion.gif', reason: 'format' }]);
    expect(result.accepted).toHaveLength(1);
  });

  it('E2-H7.CA1 - without a mime type it goes by the extension', () => {
    const result = acceptPickedImages(
      [
        asset({ mimeType: null, fileName: 'a.JPEG', uri: 'file:///a.JPEG' }),
        asset({ mimeType: undefined, fileName: 'b.webp', uri: 'file:///b.webp' }),
        asset({ mimeType: undefined, fileName: null, uri: 'file:///sin-extension' }),
      ],
      0
    );

    expect(result.accepted).toEqual([
      { uri: 'file:///a.JPEG', name: 'a.JPEG', mimeType: 'image/jpeg' },
    ]);
    expect(result.rejected).toEqual([
      { name: 'b.webp', reason: 'format' },
      { name: 'sin-extension', reason: 'format' },
    ]);
  });

  it('reads the extension of a uri that carries a query string', () => {
    const result = acceptPickedImages(
      [asset({ mimeType: undefined, fileName: null, uri: 'content://media/foto.png?id=7' })],
      0
    );

    expect(result.accepted).toHaveLength(1);
    expect(result.accepted[0].mimeType).toBe('image/png');
  });

  it('E2-H7.CA2 - refuses an image over 1 MB and keeps the ones that fit', () => {
    const result = acceptPickedImages(
      [asset({ fileName: 'grande.jpg', fileSize: MAX_IMAGE_BYTES + 1 }), asset()],
      0
    );

    expect(result.rejected).toEqual([{ name: 'grande.jpg', reason: 'size' }]);
    expect(result.accepted).toHaveLength(1);
  });

  it('E2-H7.CA2 - exactly 1 MB still goes through', () => {
    const result = acceptPickedImages([asset({ fileSize: MAX_IMAGE_BYTES })], 0);

    expect(result.accepted).toHaveLength(1);
    expect(result.rejected).toEqual([]);
  });

  it('lets an image through when the picker could not report its size', () => {
    const result = acceptPickedImages([asset({ fileSize: undefined })], 0);

    expect(result.accepted).toHaveLength(1);
  });

  it('E2-H7.CA1 - never goes past four images counting the ones already attached', () => {
    const result = acceptPickedImages(
      [
        asset({ uri: 'file:///1.jpg' }),
        asset({ uri: 'file:///2.jpg' }),
        asset({ uri: 'file:///3.jpg' }),
      ],
      3
    );

    expect(result.accepted.map((image) => image.uri)).toEqual(['file:///1.jpg']);
  });

  it('names a file by its uri when the picker gives no name, and by a fallback when it has none', () => {
    const result = acceptPickedImages(
      [
        asset({ fileName: null, uri: 'file:///cache/IMG_20260101.jpg' }),
        asset({ fileName: null, mimeType: 'image/png', uri: 'file:///cache/' }),
      ],
      0
    );

    expect(result.accepted.map((image) => image.name)).toEqual(['IMG_20260101.jpg', 'imagen']);
  });
});
