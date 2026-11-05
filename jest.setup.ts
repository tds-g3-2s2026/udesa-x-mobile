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

// expo-notifications is native too. This stand-in is a phone that never
// granted the permission, has no FCM token and was not opened from a push, so
// suites that do not care about push stay off it; the push tests give each
// function its own answer.
jest.mock('expo-notifications', () => ({
  AndroidImportance: { DEFAULT: 3 },
  DEFAULT_ACTION_IDENTIFIER: 'expo.modules.notifications.actions.DEFAULT',
  setNotificationChannelAsync: jest.fn(() => Promise.resolve(null)),
  getPermissionsAsync: jest.fn(() => Promise.resolve({ granted: false, canAskAgain: false })),
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ granted: false, canAskAgain: false })),
  getDevicePushTokenAsync: jest.fn(() => Promise.reject(new Error('No FCM token in tests'))),
  addPushTokenListener: jest.fn(() => ({ remove: jest.fn() })),
  setNotificationHandler: jest.fn(),
  getLastNotificationResponse: jest.fn(() => null),
  clearLastNotificationResponse: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
}));
