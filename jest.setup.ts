import type { ComponentType, ReactNode } from 'react';
import { configure } from '@testing-library/react-native';

// The first test of a file runs while Jest is still compiling it, and on a cold
// CI runner that can take longer than the default one second of findBy*.
configure({ asyncUtilTimeout: 10000 });

// The viewer is a native module Jest cannot load. This stand-in renders the
// cells it wraps and keeps the `urls` it was given, which is all a test needs
// to check what the viewer would open on.
jest.mock('@nandorojo/galeria', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  const Host = View as unknown as ComponentType<Record<string, unknown>>;
  const Galeria = ({ urls, children }: { urls: string[]; children: ReactNode }) =>
    React.createElement(Host, { testID: 'galeria', urls }, children);
  Galeria.Image = ({ index, children }: { index?: number; children: ReactNode }) =>
    React.createElement(Host, { testID: `galeria-image-${index ?? 0}` }, children);
  return { Galeria };
});
