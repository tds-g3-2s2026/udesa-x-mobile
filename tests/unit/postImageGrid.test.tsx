import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import {
  PostImageGrid,
  TALLEST_RATIO,
  WIDEST_RATIO,
} from '../../src/features/posts/components/PostImageGrid';
import { PostImage } from '../../src/types/post';

function images(count: number): PostImage[] {
  return Array.from({ length: count }, (_, position) => ({
    id: `img-${position}`,
    url: `https://bucket.s3.amazonaws.com/posts/${position}.jpg`,
    position,
  }));
}

function cellStyle(index: number) {
  return StyleSheet.flatten(screen.getByTestId(`post-image-${index}`).props.style);
}

describe('E2-H7. Post con Imagen', () => {
  it('E2-H7.CA4 - one image takes the full width', () => {
    render(<PostImageGrid images={images(1)} />);

    expect(cellStyle(0)).toMatchObject({ width: '100%' });
    expect(screen.queryByTestId('post-image-1')).toBeNull();
  });

  it('E2-H7.CA4 - two images split the width in halves', () => {
    render(<PostImageGrid images={images(2)} />);

    expect(cellStyle(0)).toMatchObject({ width: '50%', aspectRatio: 1 });
    expect(cellStyle(1)).toMatchObject({ width: '50%', aspectRatio: 1 });
  });

  it('E2-H7.CA4 - three images fill a 2x2 grid and the fourth cell stays empty', () => {
    render(<PostImageGrid images={images(3)} />);

    expect(cellStyle(0)).toMatchObject({ width: '50%' });
    expect(cellStyle(1)).toMatchObject({ width: '50%' });
    expect(cellStyle(2)).toMatchObject({ width: '50%' });
    expect(screen.queryByTestId('post-image-3')).toBeNull();
  });

  it('E2-H7.CA4 - four images fill the 2x2 grid', () => {
    render(<PostImageGrid images={images(4)} />);

    for (const index of [0, 1, 2, 3]) {
      expect(cellStyle(index)).toMatchObject({ width: '50%', aspectRatio: 1 });
    }
  });

  it('E2-H7.CA4 - a post without images draws nothing', () => {
    render(<PostImageGrid images={[]} />);

    expect(screen.queryByTestId('post-image-grid')).toBeNull();
  });

  it('shows the images in the order of their position, whatever order they arrive in', () => {
    const shuffled = [images(3)[2], images(3)[0], images(3)[1]];

    render(<PostImageGrid images={shuffled} />);

    expect(screen.getByTestId('galeria').props.urls).toEqual([
      'https://bucket.s3.amazonaws.com/posts/0.jpg',
      'https://bucket.s3.amazonaws.com/posts/1.jpg',
      'https://bucket.s3.amazonaws.com/posts/2.jpg',
    ]);
  });

  it('E2-H7.CA5 - the viewer is given every image of the post so it can swipe between them', () => {
    render(<PostImageGrid images={images(3)} />);

    expect(screen.getByTestId('galeria').props.urls).toHaveLength(3);
  });

  it('E2-H7.CA5 - each image tells the viewer which one it is, so it opens on the one tapped', () => {
    render(<PostImageGrid images={images(3)} />);

    expect(screen.getByTestId('galeria-image-0')).toBeTruthy();
    expect(screen.getByTestId('galeria-image-1')).toBeTruthy();
    expect(screen.getByTestId('galeria-image-2')).toBeTruthy();
  });

  it('replaces only the image that fails to load with a placeholder', () => {
    render(<PostImageGrid images={images(2)} />);

    fireEvent(screen.getByLabelText('Imagen 1 de 2'), 'error');

    expect(screen.getAllByTestId('post-image-unavailable')).toHaveLength(1);
    expect(screen.queryByLabelText('Imagen 1 de 2')).toBeNull();
    expect(screen.getByLabelText('Imagen 2 de 2')).toBeTruthy();
  });

  it('describes each image by its place among the post images', () => {
    render(<PostImageGrid images={images(3)} />);

    expect(screen.getByLabelText('Imagen 2 de 3')).toBeTruthy();
  });
});

// The size the image reports once it arrives, as the native Image sends it.
function load(label: string, width: number, height: number) {
  fireEvent(screen.getByLabelText(label), 'load', {
    nativeEvent: { source: { width, height, uri: 'https://bucket/x.jpg' } },
  });
}

describe('T-48. Revisión de UX, accesibilidad y consistencia visual', () => {
  it('T-48 - a single image waits at 16:9 and then takes its own shape, whole', () => {
    render(<PostImageGrid images={images(1)} />);
    expect(cellStyle(0).aspectRatio).toBeCloseTo(16 / 9);

    load('Imagen 1 de 1', 1200, 900);

    expect(cellStyle(0).aspectRatio).toBeCloseTo(4 / 3);
  });

  it('T-48 - a very tall single image stops at 3:4 instead of filling the screen', () => {
    render(<PostImageGrid images={images(1)} />);

    load('Imagen 1 de 1', 1000, 4000);

    expect(cellStyle(0).aspectRatio).toBe(TALLEST_RATIO);
    expect(TALLEST_RATIO).toBe(3 / 4);
  });

  it('T-48 - a very wide single image stops at 2:1', () => {
    render(<PostImageGrid images={images(1)} />);

    load('Imagen 1 de 1', 5000, 1000);

    expect(cellStyle(0).aspectRatio).toBe(WIDEST_RATIO);
    expect(WIDEST_RATIO).toBe(2);
  });

  it('T-48 - with more than one image the cells stay square, whatever their shape', () => {
    render(<PostImageGrid images={images(2)} />);

    load('Imagen 1 de 2', 1000, 3000);

    expect(cellStyle(0)).toMatchObject({ width: '50%', aspectRatio: 1 });
    expect(cellStyle(1)).toMatchObject({ width: '50%', aspectRatio: 1 });
  });
});
