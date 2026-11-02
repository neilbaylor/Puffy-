import levelClearUrl from '../assets/level-clear.m4a';
import hoopsUrl from '../assets/hoops.m4a';
import mountainUrl from '../assets/mountain-climb.m4a';
import { isMuted } from './sfx';

/**
 * Music tracks, as plain <audio> elements (stream, low memory). Mobile
 * browsers only allow audio started by a tap, so `primeMusic()` runs on the
 * first tap to "unlock" every track; after that the game can start them.
 */
type Track = 'levelClear' | 'hoops' | 'mountain';
const urls: Record<Track, string> = { levelClear: levelClearUrl, hoops: hoopsUrl, mountain: mountainUrl };
const tracks: Partial<Record<Track, HTMLAudioElement>> = {};
let primed = false;

function el(t: Track) {
  if (!tracks[t]) {
    const a = new Audio(urls[t]);
    a.preload = 'auto';
    a.volume = 0.85;
    a.loop = true;
    tracks[t] = a;
  }
  return tracks[t]!;
}

export function primeMusic() {
  if (primed) return;
  primed = true;
  for (const t of Object.keys(urls) as Track[]) {
    const a = el(t);
    a.muted = true;
    a.play()
      .then(() => {
        a.pause();
        a.currentTime = 0;
        a.muted = false;
      })
      .catch(() => {
        a.muted = false;
      });
  }
}

function play(t: Track) {
  stopMusic();
  const a = el(t);
  a.playbackRate = 1;
  a.muted = isMuted();
  a.currentTime = 0;
  a.play().catch(() => {});
}

export const playLevelClear = () => play('levelClear');

/** Each level's own song (Part 1: Level Clear, Part 2: Mountain Climb). */
const levelTrack = (level: number): Track => (level === 2 ? 'mountain' : 'levelClear');

/** Start a level's song from the top. */
export const playLevelSong = (level = 1) => play(levelTrack(level));

/** The level track: loops during play. Keeps going (no restart) if it's already on. */
export function playLevelMusic(level = 1) {
  const a = el(levelTrack(level));
  for (const [k, t] of Object.entries(tracks)) if (t && t !== a && !t.paused && k !== levelTrack(level)) t.pause();
  a.muted = isMuted();
  if (!a.paused) return;
  a.volume = 0.85;
  a.play().catch(() => {});
}
export const playHoops = () => play('hoops');

/** Speed the current track up (or back down), e.g. 1.5× for sudden death. */
export function setMusicRate(rate: number) {
  for (const a of Object.values(tracks)) if (a && !a.paused) a.playbackRate = rate;
}

/** Fade the current track out over `ms`. */
export function fadeOutMusic(ms = 600) {
  for (const a of Object.values(tracks)) {
    if (!a || a.paused) continue;
    const start = a.volume;
    const t0 = performance.now();
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / ms);
      a.volume = start * (1 - k);
      if (k < 1) requestAnimationFrame(step);
      else {
        a.pause();
        a.volume = start;
      }
    };
    requestAnimationFrame(step);
  }
}

export function stopMusic() {
  for (const a of Object.values(tracks)) a?.pause();
}

export function setMusicMuted(m: boolean) {
  for (const a of Object.values(tracks)) if (a) a.muted = m;
}
