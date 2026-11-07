import levelClearUrl from '../assets/level-clear.m4a';
import hoopsUrl from '../assets/hoops.m4a';
import mountainUrl from '../assets/mountain-climb.m4a';
import menuUrl from '../assets/game-ready.m4a';
import battleUrl from '../assets/battle.m4a';
import plopUrl from '../assets/plop-invasion.m4a';
import { audioContext, isMuted, unlockAudio } from './sfx';

/**
 * Music, played through Web Audio (the same audio context as the sound effects).
 *
 * Not <audio> elements: on iPhones those show up as "Now Playing" (the Dynamic
 * Island / lock screen) and a home-screen app would sometimes resume one by
 * itself on top of the one that should be playing, so a song played twice.
 * Here there is only ever one source playing, and it's ours.
 *
 * Songs are fetched once (small compressed files) and decoded when needed, in
 * mono at 32 kHz to keep memory down; only the last two decoded songs are kept.
 */
type Track = 'levelClear' | 'hoops' | 'mountain' | 'menu' | 'battle' | 'plop';
const urls: Record<Track, string> = { levelClear: levelClearUrl, hoops: hoopsUrl, mountain: mountainUrl, menu: menuUrl, battle: battleUrl, plop: plopUrl };
const VOLUME = 0.85;
const RATE = 32000;
const KEEP = 2;

const bytes = new Map<Track, Promise<ArrayBuffer>>();
const decoded = new Map<Track, AudioBuffer>();
const decoding = new Map<Track, Promise<AudioBuffer | null>>();
let recent: Track[] = [];

function fetchBytes(t: Track) {
  if (!bytes.has(t)) bytes.set(t, fetch(urls[t]).then((r) => r.arrayBuffer()));
  return bytes.get(t)!;
}

function keep(t: Track) {
  recent = [t, ...recent.filter((x) => x !== t)];
  for (const old of recent.slice(KEEP)) if (old !== playing?.t) decoded.delete(old);
  recent = recent.slice(0, KEEP + 1);
}

function decode(t: Track): Promise<AudioBuffer | null> {
  const have = decoded.get(t);
  if (have) {
    keep(t);
    return Promise.resolve(have);
  }
  let p = decoding.get(t);
  if (!p) {
    p = (async () => {
      const data = (await fetchBytes(t)).slice(0); // (decoding takes the buffer over)
      const OAC = window.OfflineAudioContext ?? (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext;
      const off = new OAC(1, 1, RATE);
      const buf = await new Promise<AudioBuffer>((res, rej) => off.decodeAudioData(data, res, rej));
      // mix down to one channel (half the memory; phone speakers are mono-ish anyway)
      let out = buf;
      if (buf.numberOfChannels > 1) {
        out = off.createBuffer(1, buf.length, buf.sampleRate);
        const o = out.getChannelData(0);
        const n = buf.numberOfChannels;
        // (in slices, letting the game breathe between them: a whole song in one go is a stutter)
        const SLICE = 1 << 18;
        for (let c = 0; c < n; c++) {
          const d = buf.getChannelData(c);
          for (let s0 = 0; s0 < d.length; s0 += SLICE) {
            const s1 = Math.min(d.length, s0 + SLICE);
            for (let i = s0; i < s1; i++) o[i] += d[i] / n;
            await new Promise((r) => setTimeout(r, 0));
          }
        }
      }
      decoded.set(t, out);
      keep(t);
      return out;
    })()
      .catch(() => null)
      .finally(() => decoding.delete(t));
    decoding.set(t, p);
  }
  return p;
}

// the start screen's song and Part 1's are needed first: fetch them right away
fetchBytes('menu');
fetchBytes('levelClear');

interface Playing {
  t: Track;
  src: AudioBufferSourceNode;
  gain: GainNode;
}
let playing: Playing | null = null;
/** What should be playing (it starts once the audio is unlocked and the song decoded). */
let want: { t: Track; loop: boolean; at?: (dur: number) => number } | null = null;
let token = 0;
let rate = 1;
/** The playback speed the current song should have (the battle song runs a hair fast to fit the clock). */
let baseRate = 1;

function stopNow() {
  if (!playing) return;
  try {
    playing.src.stop();
  } catch {
    /* already stopped */
  }
  playing.src.disconnect();
  playing.gain.disconnect();
  playing = null;
}

/** Start `want` (if it isn't already playing). */
function startWanted() {
  const w = want;
  const ctx = audioContext();
  if (!w || !ctx) return;
  if (playing?.t === w.t) return;
  const my = ++token;
  void decode(w.t).then((buf) => {
    if (!buf || my !== token || want !== w) return;
    stopNow();
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = w.loop;
    src.playbackRate.value = rate;
    const gain = ctx.createGain();
    gain.gain.value = isMuted() ? 0 : VOLUME;
    src.connect(gain).connect(ctx.destination);
    const offset = Math.max(0, Math.min(buf.duration - 0.05, w.at ? w.at(buf.duration) : 0));
    src.start(0, offset);
    const p: Playing = { t: w.t, src, gain };
    src.onended = () => {
      if (playing === p) playing = null;
    };
    playing = p;
  });
}

function play(t: Track, restart: boolean, loop = true, at?: (dur: number) => number, speed = 1) {
  if (!restart && playing?.t === t && want?.t === t) return;
  rate = speed;
  baseRate = speed;
  if (restart || playing?.t !== t) stopNow();
  want = { t, loop, at };
  startWanted();
}

/** The first tap: audio may start now (and the song that should be on, starts). */
export function primeMusic() {
  unlockAudio();
  if (want && !playing) startWanted();
}

export const playLevelClear = () => play('levelClear', true);

/** Each level's own song (Part 1: Level Clear, Part 2: Mountain Climb). */
const levelTrack = (level: number): Track => (level === 2 ? 'mountain' : level === 3 ? 'plop' : 'levelClear');

/** Start a level's song from the top. */
export const playLevelSong = (level = 1) => play(levelTrack(level), true);

/** The level track: loops during play. Keeps going (no restart) if it's already on. */
export const playLevelMusic = (level = 1) => play(levelTrack(level), false);

export const playHoops = () => play('hoops', true);

/** The start screen's song ("Game Ready"): loops; keeps going if it's already on. */
export const playMenuMusic = () => play('menu', false);

/** The start screen's song decoded ahead of time (during the loading screen), so the first tap is instant. */
export const preloadMenuMusic = () => decode('menu');

/** Get a level's song ready (decoded) ahead of time, so it starts straight away. */
export const preloadLevelMusic = (level = 1) => void decode(levelTrack(level));

/**
 * The battle song, from the very start to the very end, finishing exactly as the
 * clock hits 0: it's played a touch faster to fit the battle (151.3 s of song in
 * 150 s: under 1% faster, which nobody can hear). `secondsLeft` is asked at the
 * moment it starts (joining a moment late cues it to the right spot).
 */
export function playBattleMusic(secondsLeft: () => number, battleSecs: number) {
  const SONG = 151.33;
  const speed = SONG / battleSecs;
  play('battle', true, false, () => (battleSecs - secondsLeft()) * speed, speed);
}
export const preloadBattleMusic = () => void decode('battle');

// the app went to the background: everything pauses (the whole audio context);
// coming back, it carries on from the same spot
document.addEventListener('visibilitychange', () => {
  const ctx = audioContext();
  if (!ctx) return;
  if (document.hidden) void ctx.suspend();
  else void ctx.resume();
});

/** Speed the current track up (or back down), e.g. 1.5× for sudden death. */
export function setMusicRate(r: number) {
  rate = r * baseRate;
  if (playing) playing.src.playbackRate.value = rate;
}

/** Fade the current track out over `ms`. */
export function fadeOutMusic(ms = 600) {
  want = null;
  token++;
  const p = playing;
  const ctx = audioContext();
  if (!p || !ctx) return stopNow();
  const g = p.gain.gain;
  g.cancelScheduledValues(ctx.currentTime);
  g.setValueAtTime(g.value, ctx.currentTime);
  g.linearRampToValueAtTime(0, ctx.currentTime + ms / 1000);
  try {
    p.src.stop(ctx.currentTime + ms / 1000 + 0.05);
  } catch {
    /* already stopped */
  }
  playing = null;
}

export function stopMusic() {
  want = null;
  token++;
  stopNow();
}

export function setMusicMuted(m: boolean) {
  if (playing) playing.gain.gain.value = m ? 0 : VOLUME;
}

// (for testing: what's playing)
(window as unknown as { __music: () => unknown }).__music = () => ({ playing: playing?.t ?? null, want: want?.t ?? null, ctx: audioContext()?.state ?? 'none', decoded: [...decoded.keys()] });
