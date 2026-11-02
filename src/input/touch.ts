import { emptyInput, type InputSource, type InputState } from './types';

/** Written by the on-screen touch controls (ui/touchControls.ts), read by the player. */
export const touchState: InputState = emptyInput();

export const isTouchDevice = (): boolean =>
  'ontouchstart' in window || (navigator.maxTouchPoints ?? 0) > 0;

/**
 * Is the player using touch right now? Starts from "is the main pointer a
 * finger" (phones, tablets) — a laptop with a touchscreen counts as a
 * keyboard/mouse device — then follows what they actually use: a game key
 * switches to keyboard mode, a touch on the screen switches back.
 */
let touchMode = typeof matchMedia === 'function' ? matchMedia('(pointer: coarse)').matches : isTouchDevice();
const listeners = new Set<(touch: boolean) => void>();
export const usingTouch = () => touchMode;
export function onInputModeChange(fn: (touch: boolean) => void) {
  listeners.add(fn);
}
function setTouchMode(t: boolean) {
  if (t === touchMode) return;
  touchMode = t;
  listeners.forEach((fn) => fn(t));
}
if (typeof window !== 'undefined') {
  window.addEventListener('touchstart', () => setTouchMode(true), { passive: true, capture: true });
  window.addEventListener(
    'keydown',
    (e) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space', 'KeyA', 'KeyD', 'KeyW', 'KeyF', 'KeyJ', 'ShiftLeft', 'ShiftRight', 'Enter'].includes(e.code)) setTouchMode(false);
    },
    { capture: true },
  );
}

export const touchSource: InputSource = {
  id: 'touch',
  kind: 'touch',
  label: 'Touch',
  hint: 'Left thumb: drag to walk, drag far to run · Right thumb: jump & fire',
  poll: () => ({ ...touchState }),
  connected: () => true,
};
