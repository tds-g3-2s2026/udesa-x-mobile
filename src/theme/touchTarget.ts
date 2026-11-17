import { ViewStyle } from 'react-native';

// The smallest area a finger can press reliably, in points: 44 x 44 is what
// Apple's guidelines and WCAG 2.5.5 ask for (Android asks 48 x 48 dp).
export const MIN_TOUCH_TARGET = 44;

// For a control drawn smaller than that, such as an icon: the box grows to
// the minimum with the icon centered, so what the eye sees stays the same.
// A real box and not hitSlop: on Android a press outside the parent's
// bounds never arrives, so a hitSlop past the edge of a card is dead.
export const touchTarget: ViewStyle = {
  minWidth: MIN_TOUCH_TARGET,
  minHeight: MIN_TOUCH_TARGET,
  alignItems: 'center',
  justifyContent: 'center',
};
