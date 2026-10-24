import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { PostImageGrid } from '../../src/features/posts/components/PostImageGrid';
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
