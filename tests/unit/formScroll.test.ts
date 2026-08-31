import { keyboardOverlap, nextScrollOffset } from '../../src/features/auth/components/formScroll';

// The keyboard leaves a 300px tall scrollable area in every case below.
const VIEWPORT = 300;

describe('nextScrollOffset', () => {
  it('scrolls down until the field and its margin fit above the keyboard', () => {
    // Field at 400..450 with the form at the top: it is under the keyboard.
    expect(nextScrollOffset({ y: 400, height: 50 }, VIEWPORT, 0)).toBe(162);
  });

  it('leaves the offset alone when the field is already visible', () => {
    expect(nextScrollOffset({ y: 120, height: 50 }, VIEWPORT, 0)).toBeNull();
  });

  it('scrolls back up when the field is above the visible area', () => {
    expect(nextScrollOffset({ y: 100, height: 50 }, VIEWPORT, 260)).toBe(88);
  });

  it('never scrolls past the top of the form', () => {
    expect(nextScrollOffset({ y: 4, height: 50 }, VIEWPORT, 40)).toBe(0);
  });

  it('keeps the top edge visible when the field is taller than the viewport', () => {
    expect(nextScrollOffset({ y: 100, height: 400 }, VIEWPORT, 0)).toBe(88);
  });

  it('does nothing before the scroll area has been measured', () => {
    expect(nextScrollOffset({ y: 400, height: 50 }, 0, 0)).toBeNull();
  });
});

// Screen 800 tall with a 56px navigation header above the form, and a keyboard
// 300px tall: it starts at y=500 in screen coordinates.
const HEADER = 56;
const FORM_HEIGHT = 800 - HEADER;
const KEYBOARD_TOP = 500;

describe('keyboardOverlap', () => {
  it('gives no inset while the keyboard is closed', () => {
    expect(keyboardOverlap(HEADER, FORM_HEIGHT, null)).toBe(0);
  });

  it('covers exactly the overlapped area, so the footer clears the keyboard', () => {
    expect(keyboardOverlap(HEADER, FORM_HEIGHT, KEYBOARD_TOP)).toBe(300);
  });

  it('adds nothing when the platform already resized the window', () => {
    // The form was laid out ending where the keyboard starts.
    expect(keyboardOverlap(HEADER, KEYBOARD_TOP - HEADER, KEYBOARD_TOP)).toBe(0);
  });

  it('never returns a negative inset', () => {
    expect(keyboardOverlap(HEADER, 100, KEYBOARD_TOP)).toBe(0);
  });
});
