import levelClearUrl from '../assets/level-clear.m4a';
import hoopsUrl from '../assets/hoops.m4a';
import mountainUrl from '../assets/mountain-climb.m4a';
import menuUrl from '../assets/game-ready.m4a';
import { isMuted } from './sfx';

/**
 * Music tracks, as plain <audio> elements (stream, low memory). Mobile
 * browsers only allow audio started by a tap, so `primeMusic()` runs on the
 * first tap to "unlock" every track; after that the game can start them.
 */
type Track = 'levelClear' | 'hoops' | 'mountain' | 'menu';
const urls: Record<Track, string> = { levelClear: levelClearUrl, hoops: hoopsUrl, mountain: mountainUrl, menu: menuUrl };
/** The track that should be playing (priming must not pause it). */
let wanted: HTMLAudioElement | null = null;
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
    // the song that should be playing is started for real by its own call, not here
    if (a === wanted) continue;
    a.muted = true;
    a.play()
      .then(() => {
        if (a === wanted) {
          a.muted = isMuted();
          return;
        }
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
  wanted = a;
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
  wanted = a;
  for (const [k, t] of Object.entries(tracks)) if (t && t !== a && !t.paused && k !== levelTrack(level)) t.pause();
  a.muted = isMuted();
  if (!a.paused) return;
  a.volume = 0.85;
  a.play().catch(() => {});
}
export const playHoops = () => play('hoops');

/** The start screen's song ("Game Ready"): loops; keeps going if it's already on. */
export function playMenuMusic() {
  const a = el('menu');
  wanted = a;
  for (const t of Object.values(tracks)) if (t && t !== a && !t.paused) t.pause();
  a.muted = isMuted();
  a.volume = 0.8;
  // already playing, or a start already on its way: never start it a second time
  if (!a.paused || starting.has(a)) return;
  starting.add(a);
  a.play()
    .catch(() => {})
    .finally(() => starting.delete(a));
}

/** Songs with a play() still on its way (iOS can double up if asked again meanwhile). */
const starting = new Set<HTMLAudioElement>();

// the app went to the background: pause the music; coming back, only the song that
// should be playing carries on (iOS home-screen apps otherwise sometimes double up)
let resumeOnShow = false;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    resumeOnShow = !!wanted && !wanted.paused;
    for (const a of Object.values(tracks)) a?.pause();
  } else if (resumeOnShow && wanted) {
    resumeOnShow = false;
    for (const a of Object.values(tracks)) if (a && a !== wanted && !a.paused) a.pause();
    wanted.muted = isMuted();
    if (wanted.paused && !starting.has(wanted)) {
      const w = wanted;
      starting.add(w);
      w.play()
        .catch(() => {})
        .finally(() => starting.delete(w));
    }
  }
});

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
  wanted = null;
  for (const a of Object.values(tracks)) a?.pause();
}

export function setMusicMuted(m: boolean) {
  for (const a of Object.values(tracks)) if (a) a.muted = m;
}
