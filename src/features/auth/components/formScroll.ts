import { createContext, useContext } from 'react';

// Position of a field inside the scrollable content of the form.
export type FieldRect = {
  y: number;
  height: number;
};

export type FormScroll = {
  // Scrolls the form until the given field is visible above the keyboard.
  revealField: (rect: FieldRect) => void;
};

export const FormScrollContext = createContext<FormScroll | null>(null);

export function useFormScroll(): FormScroll {
  const formScroll = useContext(FormScrollContext);
  if (!formScroll) {
    throw new Error('FormInput has to be rendered inside an AuthScreen');
  }
  return formScroll;
}

// Breathing room kept around a focused field when it is scrolled into view.
const FIELD_MARGIN = 12;

/**
 * Offset the form has to scroll to for `field` to be fully visible, or null when
 * the current `offset` already shows it. `viewport` is the height of the scrollable
 * area, which the keyboard and the fixed footer make smaller than the screen.
 */
export function nextScrollOffset(
  field: FieldRect,
  viewport: number,
  offset: number
): number | null {
  if (viewport <= 0) return null;

  const fieldTop = field.y - FIELD_MARGIN;
  const fieldBottom = field.y + field.height + FIELD_MARGIN;
  let target = offset;

  // Scrolling down to uncover the bottom edge comes first: when the field is
  // taller than the viewport, its top edge stays visible.
  if (fieldBottom > target + viewport) target = fieldBottom - viewport;
  if (fieldTop < target) target = fieldTop;
  target = Math.max(target, 0);

  return Math.abs(target - offset) < 1 ? null : target;
}

/**
 * Vertical space the keyboard takes from a view that starts `offsetY` pixels below
 * the top of the screen and is `height` pixels tall. `keyboardScreenY` is the top
 * of the keyboard in screen coordinates, or null when the keyboard is closed.
 *
 * Returns 0 when the platform already resized the window for the keyboard: there
 * the measured height ends where the keyboard begins, so nothing has to be added.
 */
export function keyboardOverlap(
  offsetY: number,
  height: number,
  keyboardScreenY: number | null
): number {
  if (keyboardScreenY === null) return 0;
  return Math.max(offsetY + height - keyboardScreenY, 0);
}
