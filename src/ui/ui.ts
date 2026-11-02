import Phaser from 'phaser';
import { CHARACTERS, characterById } from '../data/characters';
import type { Session } from '../core/session';
import { fadeOutMusic, playLevelClear, playLevelMusic, playLevelSong, playMenuMusic, primeMusic, setMusicMuted, stopMusic } from '../core/music';
import { isMuted, setMuted, sfx, unlockAudio } from '../core/sfx';
import { drawHeroCard, drawPortrait, renderPoseSet } from '../gfx/draw';
import { NEUTRAL_FACE, type Face } from '../gfx/face';
import { gamepadSources } from '../input/gamepad';
import { isKeyDown } from '../input/keyboard';
import { isTouchDevice, onInputModeChange, usingTouch } from '../input/touch';
import type { GameData, GameOverState, GameScene, HudState, ResultState } from '../scenes/GameScene';
import { TouchControls } from './touchControls';
import { drawNuggie, drawRootBeer } from '../gfx/collectibles';
import { VERSION } from '../version';
import { LEVELS, levelInfo, levelName, progress } from '../level/levels';

const h = (html: string) => {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild as HTMLElement;
};

const isStandalone = () =>
  window.matchMedia?.('(display-mode: fullscreen)').matches ||
  window.matchMedia?.('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;
const canFullscreen = () => {
  const de = document.documentElement as HTMLElement & { webkitRequestFullscreen?: unknown };
  return !!(de.requestFullscreen || de.webkitRequestFullscreen);
};
const isFullscreen = () => !!(document.fullscreenElement || (document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement);

const store = {
  get(k: string) {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k: string, v: string) {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* private mode etc. */
    }
  },
};

/**
 * All menus and the HUD are plain DOM over the canvas: crisp text at any
 * pixel density and easy safe-area handling on notched phones and tablets.
 */
/** Keyboard + mouse controls, as little key caps (shown on computers without a touch screen). */
const kc = (k: string) => `<kbd>${k}</kbd>`;
/** A little mouse (the emoji doesn't show on every computer). */
const MOUSE = `<svg class="mouse-ico" viewBox="0 0 14 20" width="11" height="16" aria-hidden="true"><rect x="1.2" y="1.2" width="11.6" height="17.6" rx="5.8" fill="#fff" stroke="currentColor" stroke-width="1.8"/><path d="M7 1.6v5.4M1.6 7h10.8" stroke="currentColor" stroke-width="1.4"/><rect x="1.9" y="1.9" width="5" height="5" rx="2" fill="#ffd23f"/></svg>`;
function controlsHtml(compact = false) {
  const rows: [string, string][] = [
    [`${kc('←')}${kc('→')} <small>or</small> ${kc('A')}${kc('D')}`, 'move'],
    [`${kc('↑')} <small>or</small> ${kc('W')}`, compact ? 'jump (again in the air: double jump)' : 'jump — press again in the air for a double jump'],
    [`${kc('Space')} <small>or</small> ${MOUSE} <small>click</small>`, 'fire the bazooka'],
    [`${kc('Shift')}`, 'hold to run (uses stamina)'],
    [`${kc('Esc')}`, 'pause'],
  ];
  return `<div class="controls${compact ? ' compact' : ''}">${rows.map(([k, what]) => `<span class="ctl"><span class="keys">${k}</span><em>${what}</em></span>`).join('')}</div>`;
}

/** One run of words as letter spans for the rolling wave (--i = position in the whole line). */
function waveWords(text: string, start = 0) {
  let i = start;
  return text
    .split(' ')
    .map((w) => `<span class="w">${[...w].map((ch, j) => `<i style="--i:${i++};--j:${j}">${ch}</i>`).join('')}</span>`)
    .join('');
}

/**
 * The subtitle's letters for the rolling wave: each " · " part (world, title,
 * part) is its own segment, so a level switch can swap just the part that changed.
 */
function waveText(text: string) {
  let i = 0;
  return text
    .split(' · ')
    .map((part) => {
      const html = `<span class="seg">${waveWords(part, i)}</span>`;
      i += part.replace(/ /g, '').length;
      return html;
    })
    .join('<b class="sep">•</b>');
}

/** Speaker icons for the sound toggle. */
const SPEAKER_ON = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`;
const SPEAKER_OFF = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M16 9.5l5 5M21 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`;

const rand = (a: number, b: number) => a + Math.random() * (b - a);

/**
 * Little bits of life for a hero's face: now and then the eyes blink or glance
 * around, and (separately, on their own clock) the mouth smiles, goes "o" or
 * chatters. Each hero gets their own, so they never move in step.
 */
class FaceLife {
  private f: Face = { ...NEUTRAL_FACE };
  private timers = new Set<number>();
  constructor(
    private redraw: (f: Face) => void,
    private alive: () => boolean,
    opts: { mouth: boolean; calm?: boolean },
  ) {
    this.calm = !!opts.calm;
    this.after(rand(400, 2400), () => this.eyes());
    if (opts.mouth) this.after(rand(1500, 4500), () => this.mouth());
  }
  private calm: boolean;
  stop() {
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
  }
  private after(ms: number, fn: () => void) {
    const id = window.setTimeout(() => {
      this.timers.delete(id);
      if (!this.alive()) return this.stop();
      fn();
    }, ms);
    this.timers.add(id);
  }
  private set(p: Partial<Face>) {
    this.f = { ...this.f, ...p };
    this.redraw(this.f);
  }
  private eyes() {
    const next = () => this.after(this.calm ? rand(2600, 6500) : rand(1300, 4200), () => this.eyes());
    if (Math.random() < 0.5) {
      // blink (sometimes twice)
      this.set({ blink: true });
      this.after(120, () => this.set({ blink: false }));
      if (Math.random() < 0.25) {
        this.after(260, () => this.set({ blink: true }));
        this.after(370, () => this.set({ blink: false }));
      }
      return next();
    }
    // glance somewhere, hold it, look back (often with a blink)
    const looks = [-1, -0.75, -0.4, 0.4, 0.9];
    this.set({ lookX: looks[Math.floor(Math.random() * looks.length)], lookY: rand(-0.9, 0.6) });
    const hold = this.calm ? rand(600, 1300) : rand(700, 1800);
    this.after(hold, () => this.set({ lookX: 0, lookY: 0, blink: Math.random() < 0.3 }));
    this.after(hold + 120, () => this.set({ blink: false }));
    next();
  }
  private mouth() {
    // mostly breathing (a small open and close), sometimes a big open mouth, or a chatter
    const next = (t: number) => this.after(t + rand(1800, 3600), () => this.mouth());
    const r = Math.random();
    if (r < 0.7) {
      const hold = rand(550, 900);
      this.set({ mouth: 'o' });
      this.after(hold, () => this.set({ mouth: 'rest' }));
      return next(hold);
    }
    if (r < 0.9) {
      const hold = rand(700, 1100);
      this.set({ mouth: 'o' });
      this.after(120, () => this.set({ mouth: 'open' }));
      this.after(hold - 120, () => this.set({ mouth: 'o' }));
      this.after(hold, () => this.set({ mouth: 'rest' }));
      return next(hold);
    }
    // chatter: open / shut a few times
    const n = 3 + Math.floor(Math.random() * 4);
    let t = 0;
    for (let i = 0; i < n; i++) {
      const m = i % 2 === 0 ? 'open' : 'rest';
      this.after(t, () => this.set({ mouth: m }));
      t += rand(110, 180);
    }
    this.after(t, () => this.set({ mouth: 'rest' }));
    next(t);
  }
}

export class UI {
  private root: HTMLElement;
  private screen: HTMLElement | null = null;
  private hud: HTMLElement;
  private banner: HTMLElement;
  private touch: TouchControls;
  private rotate: HTMLElement;
  private session: Session = { players: [] };
  private gameScene: GameScene | null = null;
  private pickRaf = 0;
  private subtitleTimer = 0;
  private hudFace: FaceLife | null = null;
  private hudIdle = 0;
  private selected = 0;
  private introEl: HTMLElement | null = null;
  /** Which level to start (1-based); you can pick once you've beaten a level. */
  private level = 1;

  constructor(private game: Phaser.Game) {
    this.root = document.getElementById('ui')!;
    // the aura icon is a real nuggie, drawn once and shared by the HUD and results
    try {
      const c = document.createElement('canvas');
      c.width = 80;
      c.height = 68;
      const ctx = c.getContext('2d')!;
      ctx.scale(2, 2);
      drawNuggie(ctx, 20, 17, 13, 0);
      document.documentElement.style.setProperty('--nuggie-img', `url(${c.toDataURL()})`);
      // and the root beer icon is the same bottle you find in the level
      const rb = document.createElement('canvas');
      rb.width = 60;
      rb.height = 80;
      const rctx = rb.getContext('2d')!;
      rctx.scale(2, 2);
      drawRootBeer(rctx, 15, 38, 34);
      document.documentElement.style.setProperty('--rootbeer-img', `url(${rb.toDataURL()})`);
    } catch {
      /* falls back to the CSS icon */
    }
    this.hud = h(`<div class="hud" hidden>
        <div class="hud-hero">
          <canvas width="72" height="72"></canvas>
          <div class="hud-stats">
            <div class="hud-row">
              <div class="hud-aura" title="Aura (eat nuggies!)"><i class="aura-ico"></i><span>0</span></div>
              <div class="hud-rb" title="Root beer"><i class="rb-ico"></i><span>0</span></div>
              <div class="hud-lives" title="Lives left"><i class="life-ico"></i><span>3</span></div>
            </div>
            <div class="hud-stamina" title="Stamina"><b>STAMINA</b><div class="bar"><i></i></div></div>
          </div>
        </div>
        <button class="icon-btn hud-pause" aria-label="Pause">❚❚</button>
      </div>`);
    this.root.appendChild(this.hud);
    this.hud.querySelector('.hud-pause')!.addEventListener('click', () => this.pause());
    this.banner = h(`<div class="banner" hidden></div>`);
    this.root.appendChild(this.banner);
    this.touch = new TouchControls(this.root);
    this.rotate = h(`<div class="rotate" hidden>
      <i class="rc rc1"></i><i class="rc rc2"></i><i class="rc rc3"></i>
      <div class="logo"><span>P</span><span>U</span><span>F</span><span>F</span><span>Y</span></div>
      <div class="rotate-stage"><div class="rotate-phone"><div class="rotate-hero"><canvas width="200" height="200"></canvas></div></div></div>
      <p>Turn your phone sideways to play!</p>
      <div class="rotate-hill"></div>
    </div>`);
    // Puffy is alive in there: his standing animation, back and forth
    const rc = this.rotate.querySelector('canvas')!;
    const rctx = rc.getContext('2d')!;
    let poses: Record<string, HTMLCanvasElement> | null = null;
    let lastPose = '';
    const t0 = performance.now();
    const animatePuffy = () => {
      if (!this.rotate.hidden) {
        poses ??= renderPoseSet(CHARACTERS[0], ['idle0', 'idle1'], rc.width);
        const pose = Math.floor((performance.now() - t0) / 450) % 2 ? 'idle1' : 'idle0';
        if (pose !== lastPose && poses[pose]) {
          lastPose = pose;
          rctx.clearRect(0, 0, rc.width, rc.height);
          rctx.drawImage(poses[pose], 0, 0);
        }
      }
      requestAnimationFrame(animatePuffy);
    };
    requestAnimationFrame(animatePuffy);
    this.root.appendChild(this.rotate);
    this.selected = Math.max(0, CHARACTERS.findIndex((c) => c.id === store.get('puffy.hero')));

    game.events.on('menu', () => this.showStart());
    game.events.on('game-start', (s: GameScene, info: { fresh: boolean; atStart: boolean; level: string; world: string }) => {
      this.gameScene = s;
      this.setScreen(null);
      // a new run starts the song from the top; restarts after a faint keep it going
      if (info.fresh) playLevelSong(this.level);
      else playLevelMusic(this.level);
      if (this.introEl) return; // the level intro is playing: HUD and controls come after it
      this.showHud();
      if (info.fresh) this.showBanner(`<small>${info.world}</small>${info.level}`, 2600);
      else this.showBanner(info.atStart ? '<small>Back to the</small>Start' : '<small>Back to the</small>Checkpoint', 1300);
    });
    // the level intro flyover: letterbox, title card, a Skip button; then GO!
    game.events.on('level-intro', (i: { world: string; title: string; part: string }) => {
      this.introEl?.remove();
      this.hud.hidden = true;
      this.touch.hide();
      this.introEl = h(`<div class="lvl-intro">
        <i class="li-bar"></i><i class="li-bar"></i>
        <div class="li-title"><small>${i.world}</small><strong>${i.title}</strong><em>${i.part}</em></div>
        <button class="li-skip">Skip ›</button>
      </div>`);
      this.introEl.querySelector('.li-skip')!.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        game.events.emit('skip-intro');
      });
      this.root.appendChild(this.introEl);
      void this.introEl.offsetWidth;
      this.introEl.classList.add('on');
    });
    game.events.on('level-intro-end', () => {
      if (!usingTouch()) {
        // a quick reminder of the keys, fading away after a few seconds
        const tip = h(`<div class="ctl-tip">${controlsHtml(true)}</div>`);
        this.root.appendChild(tip);
        setTimeout(() => tip.classList.add('off'), 6500);
        setTimeout(() => tip.remove(), 7300);
      }
      const el = this.introEl;
      this.introEl = null;
      if (el) {
        el.classList.remove('on');
        el.classList.add('off');
        setTimeout(() => el.remove(), 500);
      }
      this.showHud();
      this.showBanner('GO!', 900);
      // the phone was turned upright during the flyover: pause as soon as it's over
      if (window.innerHeight > window.innerWidth && isTouchDevice()) this.pause();
    });
    game.events.on('hud', (s: HudState) => this.renderHud(s));
    game.events.on('hoops-start', () => {
      this.gameScene = null;
      this.setScreen(null);
      this.hud.hidden = true;
      this.banner.hidden = true;
      this.touch.hide();
      // the phone is upright as basketball begins: start it frozen (turning back carries on)
      requestAnimationFrame(() => {
        if (window.innerHeight > window.innerWidth && isTouchDevice() && game.scene.isActive('Hoops')) game.scene.pause('Hoops');
      });
    });
    game.events.on('level-complete', (r: ResultState) => this.showResults(r));
    game.events.on('game-over', (g: GameOverState) => this.showGameOver(g));

    window.addEventListener('keydown', (e) => {
      if ((e.code === 'Escape' || e.code === 'KeyP') && this.gameScene && !this.screen) this.pause();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.gameScene && !this.screen) this.pause();
    });
    const checkOrientation = () => {
      const portrait = window.innerHeight > window.innerWidth;
      const upright = portrait && isTouchDevice();
      // turned the phone upright mid-level: pause the game for them (not during the
      // level's flyover: that plays on, and pauses when it ends if still upright)
      if (upright && this.rotate.hidden && this.gameScene && !this.screen && !this.introEl) this.pause();
      // basketball has no pause menu: it just freezes while the phone is upright
      const sc = this.game.scene;
      if (upright && sc.isActive('Hoops')) sc.pause('Hoops');
      else if (!upright && sc.isPaused('Hoops')) sc.resume('Hoops');
      this.rotate.hidden = !(portrait && isTouchDevice());
      // the page behind matches the prompt, so no strip of sky shows under it (iOS home screen)
      document.documentElement.classList.toggle('rotating', !this.rotate.hidden);
    };
    window.addEventListener('resize', checkOrientation);
    // switching between touch and keyboard mid-game shows / hides the on-screen controls
    onInputModeChange((touch) => {
      if (!this.gameScene || this.hud.hidden) return;
      if (touch) this.touch.show();
      else this.touch.hide();
    });
    checkOrientation();
    // the first tap anywhere unlocks sound + music on mobile
    const unlock = () => {
      unlockAudio();
      primeMusic();
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    // phones/tablets: full screen from the very first tap. Browsers only count a
    // touch as a "user gesture" when the finger lifts, so listen for that too.
    const fsOnTap = () => {
      this.goFullscreen();
      window.removeEventListener('pointerup', fsOnTap);
      window.removeEventListener('touchend', fsOnTap);
    };
    window.addEventListener('pointerup', fsOnTap);
    window.addEventListener('touchend', fsOnTap);
  }

  private setScreen(el: HTMLElement | null) {
    cancelAnimationFrame(this.pickRaf);
    this.screen?.remove();
    this.screen = el;
    if (el) this.root.appendChild(el);
  }

  private showBanner(html: string, ms: number) {
    this.banner.innerHTML = `<div>${html}</div>`;
    this.banner.hidden = false;
    this.banner.classList.remove('out');
    clearTimeout((this.banner as unknown as { _t: number })._t);
    (this.banner as unknown as { _t: number })._t = window.setTimeout(() => {
      this.banner.classList.add('out');
      (this.banner as unknown as { _t: number })._t = window.setTimeout(() => (this.banner.hidden = true), 400);
    }, ms);
  }

  // ─────────────────────────────────────────── start: pick your player ──

  showStart() {
    this.gameScene = null;
    this.hud.hidden = true;
    this.banner.hidden = true;
    this.touch.hide();
    // the start screen's song (phones only let it start once you've touched the screen)
    playMenuMusic();
    const el = h(`<div class="screen start${progress.beaten >= 1 ? '' : ' no-levels'}">
      <header class="start-head">
        <div class="logo"><span>P</span><span>U</span><span>F</span><span>F</span><span>Y</span></div>
        <p class="world-name" aria-label="${levelName(this.level)}">${waveText(levelName(this.level))}</p>
      </header>
      <h2>Pick your player</h2>
      <div class="cards" role="radiogroup" aria-label="Pick your player"></div>
      ${
        progress.beaten >= 1
          ? `<div class="levels" role="radiogroup" aria-label="Pick a level">${LEVELS.map(
              (l) => `<button class="lvl" data-lvl="${l.id}" ${l.build ? '' : 'disabled'}>${l.part}${l.build ? '' : '<small>coming soon</small>'}</button>`,
            ).join('')}</div>`
          : ''
      }
      <button class="icon-btn fs-btn" data-act="fs" aria-label="Full screen" hidden>⛶</button>
      <button class="icon-btn mute-btn" data-act="mute" aria-label="Sound on or off"></button>
      <p class="version">v${VERSION}</p>
      <div class="start-foot">
        <button class="btn btn-big btn-go" data-act="play">Play</button>
        ${usingTouch() ? '' : controlsHtml(true)}
      </div>
    </div>`);
    const cards = el.querySelector('.cards')!;
    CHARACTERS.forEach((c, i) => {
      const bar = (n: number) => `<i style="--n:${n}"></i>`;
      const card = h(`<button class="card" role="radio" data-i="${i}" style="--c:${c.colors.main};--cs:${c.colors.shade}">
        <canvas width="320" height="320"></canvas>
        <div class="card-name" aria-label="${c.name}">${waveWords(c.name)}</div>
        <div class="card-tag">${c.tagline}</div>
        <dl class="bars">
          <dt>Speed</dt><dd>${bar(c.bars.speed)}</dd>
          <dt>Jump</dt><dd>${bar(c.bars.jump)}</dd>
          <dt>Stamina</dt><dd>${bar(c.bars.stamina)}</dd>
          <dt>Blast</dt><dd>${bar(c.bars.blast)}</dd>
        </dl>
      </button>`);
      const cv = card.querySelector('canvas')!;
      drawHeroCard(cv, c, 'idle0');
      // select the moment a finger touches the card (a tap can trigger full screen and
      // shift the layout before the finger lifts); tapping the picked card again plays
      let pickedOnDown = false;
      card.addEventListener('pointerdown', () => {
        unlockAudio();
        pickedOnDown = this.selected !== i;
        if (pickedOnDown) this.select(i);
      });
      card.addEventListener('click', () => {
        this.goFullscreen();
        if (pickedOnDown) {
          pickedOnDown = false;
          return;
        }
        if (this.selected === i) this.play();
        else this.select(i);
      });
      cards.appendChild(card);
    });
    el.querySelector('[data-act=play]')!.addEventListener('click', () => this.play());
    // the picked hero now and then blinks, glances around, smiles or chatters
    new FaceLife(
      (f) => {
        const card = el.querySelectorAll<HTMLElement>('.card')[this.selected];
        if (card && !card.classList.contains('cheer')) drawHeroCard(card.querySelector('canvas')!, CHARACTERS[this.selected], 'idle0', f);
      },
      () => this.screen === el && el.isConnected,
      { mouth: true },
    );
    const syncLevels = () => {
      el.querySelectorAll<HTMLButtonElement>('.lvl').forEach((b) => b.classList.toggle('picked', Number(b.dataset.lvl) === this.level));
      const wn = el.querySelector<HTMLElement>('.world-name')!;
      // the planet's name says which world it is ("Puff Ball Planet" is World 1)
      const text = levelName(this.level);
      if (wn.getAttribute('aria-label') === text) return;
      wn.setAttribute('aria-label', text);
      // only the parts that changed (e.g. "Part 1" → "Part 2"; the world only when
      // it's a new world) hop away, and the new words pop in letter by letter
      clearTimeout(this.subtitleTimer);
      const parts = text.split(' · ');
      const segs = [...wn.querySelectorAll<HTMLElement>('.seg')];
      if (segs.length !== parts.length) {
        wn.innerHTML = waveText(text);
        return;
      }
      const changed: number[] = [];
      segs.forEach((seg, k) => {
        seg.classList.remove('swap-in');
        // (a part still hopping away from a quick switch back also pops in again)
        if (seg.classList.contains('swap-out') || seg.textContent !== parts[k].replace(/ /g, '')) {
          changed.push(k);
          seg.classList.add('swap-out');
        }
      });
      this.subtitleTimer = window.setTimeout(() => {
        let i = 0;
        segs.forEach((seg, k) => {
          if (changed.includes(k)) {
            seg.innerHTML = waveWords(parts[k], i);
            seg.classList.remove('swap-out');
            void seg.offsetWidth;
            seg.classList.add('swap-in');
          }
          i += parts[k].replace(/ /g, '').length;
        });
      }, 260);
    };
    el.querySelectorAll<HTMLButtonElement>('.lvl').forEach((b) =>
      b.addEventListener('click', () => {
        if (!levelInfo(Number(b.dataset.lvl)).build) return;
        this.level = Number(b.dataset.lvl);
        sfx.select();
        syncLevels();
        this.game.events.emit('menu-level', this.level);
      }),
    );
    syncLevels();
    // first touch / key anywhere on the start screen: audio is allowed now, start the song
    const wake = () => {
      unlockAudio();
      primeMusic();
      if (this.screen === el) playMenuMusic();
      el.removeEventListener('pointerdown', wake, true);
      window.removeEventListener('keydown', wake, true);
    };
    el.addEventListener('pointerdown', wake, true);
    window.addEventListener('keydown', wake, true);
    // a small sound on/off toggle, top left
    const muteBtn = el.querySelector<HTMLButtonElement>('[data-act=mute]')!;
    const syncMute = () => {
      muteBtn.innerHTML = isMuted() ? SPEAKER_OFF : SPEAKER_ON;
      muteBtn.classList.toggle('off', isMuted());
    };
    syncMute();
    muteBtn.addEventListener('click', () => {
      setMuted(!isMuted());
      setMusicMuted(isMuted());
      syncMute();
      if (!isMuted()) playMenuMusic();
    });
    const fsBtn = el.querySelector<HTMLButtonElement>('[data-act=fs]')!;
    const syncFs = () => (fsBtn.hidden = !canFullscreen() || isFullscreen() || isStandalone());
    syncFs();
    document.addEventListener('fullscreenchange', syncFs);
    fsBtn.addEventListener('click', () => {
      this.goFullscreen(true);
      setTimeout(syncFs, 300);
    });
    this.setScreen(el);
    this.select(this.selected, true);

    // keyboard / gamepad: left/right to choose, jump/enter to play
    const prev = { l: false, r: false, go: false };
    const first = { blocked: true };
    const loop = () => {
      if (this.screen !== el) return;
      let l = isKeyDown('ArrowLeft') || isKeyDown('KeyA');
      let r = isKeyDown('ArrowRight') || isKeyDown('KeyD');
      let go = isKeyDown('Enter') || isKeyDown('Space');
      for (const g of gamepadSources) {
        if (!g.connected()) continue;
        const s = g.poll();
        l ||= s.left;
        r ||= s.right;
        go ||= s.jump;
      }
      if (first.blocked) first.blocked = l || r || go; // ignore keys still held from before
      else {
        if (l && !prev.l) this.select((this.selected + CHARACTERS.length - 1) % CHARACTERS.length);
        if (r && !prev.r) this.select((this.selected + 1) % CHARACTERS.length);
        if (go && !prev.go) return this.play();
      }
      Object.assign(prev, { l, r, go });
      this.pickRaf = requestAnimationFrame(loop);
    };
    this.pickRaf = requestAnimationFrame(loop);
  }

  private select(i: number, quiet = false) {
    const prev = this.selected;
    this.selected = i;
    const el = this.screen;
    if (!el) return;
    // the hero we moved away from goes back to a plain face
    if (prev !== i) {
      const pc = el.querySelectorAll<HTMLElement>('.card')[prev]?.querySelector('canvas');
      if (pc) drawHeroCard(pc, CHARACTERS[prev], 'idle0');
    }
    el.querySelectorAll<HTMLElement>('.card').forEach((c, k) => {
      c.classList.toggle('picked', k === i);
      c.setAttribute('aria-checked', String(k === i));
    });
    const btn = el.querySelector<HTMLButtonElement>('[data-act=play]');
    if (btn) btn.textContent = `Play as ${CHARACTERS[i].name}`;
    if (!quiet) {
      sfx.select();
      this.cheer(i);
    }
  }

  /** Each hero's card poses, drawn once (a hop flips between them with no redraw cost). */
  private cardPoses = new Map<string, Record<string, HTMLCanvasElement>>();
  private cheerRaf = 0;

  /** The picked hero celebrates: crouch, hop, land with a squash, and the name bounces. */
  private cheer(i: number) {
    const card = this.screen?.querySelectorAll<HTMLElement>('.card')[i];
    const cv = card?.querySelector('canvas');
    if (!card || !cv) return;
    const ch = CHARACTERS[i];
    let poses = this.cardPoses.get(ch.id);
    if (!poses) {
      poses = {};
      for (const pose of ['idle0', 'jump', 'fall'] as const) {
        const c = document.createElement('canvas');
        c.width = cv.width;
        c.height = cv.height;
        drawHeroCard(c, ch, pose);
        poses[pose] = c;
      }
      this.cardPoses.set(ch.id, poses);
    }
    const ctx = cv.getContext('2d')!;
    let shown = '';
    const show = (pose: string) => {
      if (pose === shown) return;
      shown = pose;
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.drawImage(poses![pose], 0, 0);
    };
    cancelAnimationFrame(this.cheerRaf);
    this.screen?.querySelectorAll<HTMLElement>('.card.cheer').forEach((c) => {
      c.classList.remove('cheer');
      const other = c.querySelector('canvas');
      const op = this.cardPoses.get(CHARACTERS[Number(c.dataset.i)].id);
      if (other && op) {
        const oc = other.getContext('2d')!;
        oc.clearRect(0, 0, other.width, other.height);
        oc.drawImage(op.idle0, 0, 0);
      }
    });
        void card.offsetWidth;
    card.classList.add('cheer');
    // the poses follow the hop's own clock (.cheer keyframes, 0.75 s), so they
    // always line up with it: crouch → up → coming down → landed
    const hop = cv.getAnimations()[0];
    const t0 = performance.now();
    const step = () => {
      const t = hop && typeof hop.currentTime === 'number' ? hop.currentTime : performance.now() - t0;
      show(t < 105 ? 'idle0' : t < 330 ? 'jump' : t < 540 ? 'fall' : 'idle0');
      if (card.isConnected && hop?.playState !== 'finished' && t < 760) this.cheerRaf = requestAnimationFrame(step);
      else {
        show('idle0');
        card.classList.remove('cheer');
      }
    };
    this.cheerRaf = requestAnimationFrame(step);
  }

  /** Hide the browser's address bar etc. (Android, iPad, desktop). iPhone needs "Add to Home Screen". */
  private goFullscreen(always = false) {
    if (!always && !isTouchDevice()) return;
    if (isFullscreen() || isStandalone()) return;
    const de = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
    try {
      const p = de.requestFullscreen?.({ navigationUI: 'hide' }) ?? de.webkitRequestFullscreen?.();
      Promise.resolve(p)
        .then(() => (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> })?.lock?.('landscape'))
        .catch(() => {});
    } catch {
      /* not supported (e.g. iPhone Safari) */
    }
  }

  private play() {
    if (!this.game.registry.get('ready')) {
      // the art is still being drawn (a second at most): start as soon as it's done
      const btn = this.screen?.querySelector<HTMLButtonElement>('[data-act=play]');
      if (btn) btn.textContent = 'Loading…';
      this.game.events.once('assets-ready', () => this.play());
      return;
    }
    unlockAudio();
    primeMusic();
    this.goFullscreen();
    const hero = CHARACTERS[this.selected];
    store.set('puffy.hero', hero.id);
    this.startGame({ players: [{ slot: 0, characterId: hero.id, inputId: 'solo' }] });
  }

  private startGame(session: Session, checkpoint = -1) {
    sfx.select();
    stopMusic(); // (the start screen's song)
    this.introEl?.remove();
    this.introEl = null;
    this.session = session;
    this.setScreen(null);
    this.game.scene.stop('Menu');
    this.game.scene.stop('Hoops');
    this.game.scene.stop('Game');
    this.game.scene.start('Game', { session, checkpoint, level: this.level } satisfies GameData);
  }

  // ─────────────────────────────────────────── HUD ──

  private showHud() {
    this.hud.hidden = false;
    const hero = characterById(this.session.players[0]?.characterId ?? 'puffy');
    const cv = this.hud.querySelector('canvas')!;
    // the hero's own standing animation (the same two frames as in the game, at the
    // same pace), plus the odd blink or glance
    this.hudFace?.stop();
    clearInterval(this.hudIdle);
    const session = this.session;
    let pose: 'idle0' | 'idle1' = 'idle0';
    let face: Face | undefined;
    const draw = () => drawPortrait(cv, hero, pose, face, 'idle0');
    draw();
    const alive = () => !this.hud.hidden && this.session === session;
    this.hudFace = new FaceLife((f) => ((face = f), draw()), alive, { mouth: false, calm: true });
    this.hudIdle = window.setInterval(() => {
      if (!alive()) return clearInterval(this.hudIdle);
      pose = pose === 'idle0' ? 'idle1' : 'idle0';
      draw();
    }, 625);
    if (usingTouch()) this.touch.show();
    else this.touch.hide();
  }

  private renderHud(s: HudState) {
    this.hud.querySelector('.hud-aura span')!.textContent = String(s.aura);
    this.hud.querySelector('.hud-aura')!.classList.toggle('has', s.aura > 0);
    const rb = this.hud.querySelector('.hud-rb span')!;
    if (rb.textContent !== String(s.rootbeer)) {
      rb.textContent = String(s.rootbeer);
      const box = this.hud.querySelector('.hud-rb')!;
      box.classList.remove('bump');
      void (box as HTMLElement).offsetWidth;
      box.classList.add('bump');
    }
    const lv = this.hud.querySelector('.hud-lives span')!;
    if (lv.textContent !== String(s.lives)) {
      lv.textContent = String(s.lives);
      const box = this.hud.querySelector('.hud-lives')!;
      box.classList.toggle('last', s.lives === 0);
      box.classList.remove('bump');
      void (box as HTMLElement).offsetWidth;
      box.classList.add('bump');
    }
    const bar = this.hud.querySelector<HTMLElement>('.hud-stamina')!;
    bar.style.setProperty('--v', String(s.stamina));
    bar.classList.toggle('low', s.stamina < 0.35 && !s.exhausted);
    bar.classList.toggle('exhausted', s.exhausted);
    bar.classList.toggle('running', s.running);
  }

  // ─────────────────────────────────────────── pause / results ──

  private pause() {
    if (!this.gameScene || this.screen) return;
    this.game.scene.pause('Game');
    this.touch.reset();
    const el = h(`<div class="screen modal">
      <div class="panel">
        <h2>Paused</h2>
        <button class="btn" data-act="resume">Resume</button>
        <button class="btn btn-alt" data-act="restart">Restart level</button>
        <button class="btn btn-alt" data-act="hero">Pick another player</button>
        <button class="btn btn-alt" data-act="sound">${isMuted() ? 'Sound: off' : 'Sound: on'}</button>
        ${usingTouch() ? '' : `<h3 class="ctl-title">Controls</h3>${controlsHtml()}`}
      </div>
    </div>`);
    const act = (a: string, fn: () => void) => el.querySelector(`[data-act=${a}]`)!.addEventListener('click', fn);
    act('resume', () => this.resume());
    act('restart', () => this.startGame(this.session));
    act('hero', () => this.quitToStart());
    act('sound', () => {
      setMuted(!isMuted());
      setMusicMuted(isMuted());
      el.querySelector('[data-act=sound]')!.textContent = isMuted() ? 'Sound: off' : 'Sound: on';
    });
    this.setScreen(el);
    const onKey = (e: KeyboardEvent) => {
      if (this.screen !== el) return window.removeEventListener('keydown', onKey);
      if (e.code === 'Escape' || e.code === 'KeyP') {
        window.removeEventListener('keydown', onKey);
        setTimeout(() => this.resume(), 0);
      }
    };
    setTimeout(() => window.addEventListener('keydown', onKey), 0);
  }

  private resume() {
    this.setScreen(null);
    this.game.scene.resume('Game');
  }

  private quitToStart() {
    this.introEl?.remove();
    this.introEl = null;
    this.setScreen(null);
    stopMusic();
    this.game.scene.stop('Hoops');
    this.game.scene.stop('Game');
    this.gameScene = null;
    this.hud.hidden = true;
    this.touch.hide();
    this.game.scene.start('Menu', { silent: true, level: this.level });
    this.showStart();
  }

  private showGameOver(g: GameOverState) {
    this.touch.hide();
    this.hud.hidden = true;
    this.banner.hidden = true;
    this.gameScene = null;
    fadeOutMusic(800);
    sfx.groan();
    const el = h(`<div class="screen modal">
      <div class="panel results gameover">
        <div class="results-hero"><canvas width="160" height="160"></canvas></div>
        <div class="results-body">
          <p class="eyebrow">${levelInfo(this.level).world} · ${levelName(this.level)}</p>
          <h2>Out of lives!</h2>
          <p class="gameover-note">${g.name} fainted one too many times. Start the level again with 3 spare lives.</p>
          <div class="row">
            <button class="btn btn-go" data-act="again">Try again</button>
            <button class="btn btn-alt" data-act="hero">Pick player</button>
          </div>
        </div>
      </div>
    </div>`);
    drawPortrait(el.querySelector('canvas')!, characterById(g.charId), 'hurt');
    const again = () => {
      stopMusic();
      this.startGame(this.session);
    };
    el.querySelector('[data-act=again]')!.addEventListener('click', again);
    el.querySelector('[data-act=hero]')!.addEventListener('click', () => this.quitToStart());
    this.setScreen(el);
    const onKey = (e: KeyboardEvent) => {
      if (this.screen !== el) return window.removeEventListener('keydown', onKey);
      if (e.code === 'Enter') {
        window.removeEventListener('keydown', onKey);
        again();
      }
    };
    setTimeout(() => window.addEventListener('keydown', onKey), 600);
  }

  private showResults(r: ResultState) {
    this.touch.hide();
    // beating a level unlocks picking where to start
    const firstTime = progress.beaten < (r.level ?? 1);
    progress.markBeaten(r.level ?? 1);
    playLevelClear();
    const nextInfo = LEVELS.find((l) => l.id === (r.level ?? 1) + 1);
    const next = nextInfo && nextInfo.build ? nextInfo : null;
    const mins = Math.floor(r.seconds / 60);
    const secs = String(r.seconds % 60).padStart(2, '0');
    const el = h(`<div class="screen modal">
      <div class="panel results">
        <div class="results-hero">
          <canvas width="160" height="160"></canvas>
          <button class="btn btn-alt btn-small" data-act="hero">Pick player</button>
        </div>
        <div class="results-body">
          <p class="eyebrow">${levelInfo(r.level ?? this.level).world} · ${levelName(r.level ?? this.level)}</p>
          <h2>Level clear!</h2>
          ${firstTime ? '<p class="unlock-note">New: pick which level to start from on the start screen!</p>' : ''}
          <dl class="stat-list">
            <dt>Lives left <i class="life-ico"></i></dt><dd>${r.lives}</dd>
            <dt>Aura carried <i class="aura-ico"></i></dt><dd>${r.aura}</dd>
            <dt>Root beer found <i class="rb-ico"></i></dt><dd>${r.rootbeerTotal}</dd>
            <dt>Puffballs popped</dt><dd>${r.popped}</dd>
            <dt>Giants beaten</dt><dd>${r.giants}</dd>
            <dt>Time</dt><dd>${mins}:${secs}</dd>
          </dl>
          <div class="row">
            ${next ? `<button class="btn btn-next" data-act="next">Next: ${next.part} ▶</button>` : ''}
            <button class="btn ${next ? 'btn-alt' : 'btn-go'}" data-act="again">Play again</button>
          </div>
        </div>
      </div>
    </div>`);
    drawPortrait(el.querySelector('canvas')!, characterById(r.charId), 'jump');
    // the default (and the big button) is on to the next level, when there is one
    const goNext = () => {
      if (!next) return this.startGame(this.session);
      this.level = next.id;
      this.startGame(this.session);
    };
    el.querySelector('[data-act=next]')?.addEventListener('click', goNext);
    el.querySelector('[data-act=again]')!.addEventListener('click', () => this.startGame(this.session));
    el.querySelector('[data-act=hero]')!.addEventListener('click', () => this.quitToStart());
    this.setScreen(el);
    const onKey = (e: KeyboardEvent) => {
      if (this.screen !== el) return window.removeEventListener('keydown', onKey);
      if (e.code === 'Enter') {
        window.removeEventListener('keydown', onKey);
        goNext();
      }
    };
    setTimeout(() => window.addEventListener('keydown', onKey), 600);
  }
}
