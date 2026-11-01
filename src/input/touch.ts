import { emptyInput, type InputSource, type InputState } from './types';

/** Written by the on-screen touch controls (ui/touchControls.ts), read by the player. */
export const touchState: InputState = emptyInput();

export const isTouchDevice = (): boolean =>
  'ontouchstart' in window || (navigator.maxTouchPoints ?? 0) > 0;

export const touchSource: InputSource = {
  id: 'touch',
  kind: 'touch',
  label: 'Touch',
  hint: 'Left thumb: drag to walk, drag far to run · Right thumb: jump & fire',
  poll: () => ({ ...touchState }),
  connected: () => true,
};
