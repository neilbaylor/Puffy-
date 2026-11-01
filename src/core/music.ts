import levelClearUrl from '../assets/level-clear.m4a';
import { isMuted } from './sfx';

/**
 * Music. Uses a plain <audio> element (streams, low memory). Mobile browsers
 * only allow audio that was started by a tap, so `primeMusic()` is called from
 * the first tap to "unlock" the element; after that the game can start it.
 */
let levelClear: HTMLAudioElement | null = null;

export function primeMusic() {
  if (levelClear) return;
  levelClear = new Audio(levelClearUrl);
  levelClear.preload = 'auto';
  levelClear.volume = 0.85;
  levelClear.muted = true;
  levelClear
    .play()
    .then(() => {
      levelClear!.pause();
      levelClear!.currentTime = 0;
      levelClear!.muted = false;
    })
    .catch(() => {
      if (levelClear) levelClear.muted = false;
    });
}

export function playLevelClear() {
  primeMusic();
  const a = levelClear!;
  a.muted = isMuted();
  a.currentTime = 0;
  a.play().catch(() => {});
}

export function stopMusic() {
  levelClear?.pause();
}

export function setMusicMuted(m: boolean) {
  if (levelClear) levelClear.muted = m;
}
