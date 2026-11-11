import Phaser from 'phaser';
import { CHARACTERS, characterById, type CharacterDef } from '../data/characters';
import type { Session } from '../core/session';
import { fadeOutMusic, playLevelClear, playLevelMusic, playLevelSong, playMenuMusic, preloadHoopsMusic, preloadLevelMusic, primeMusic, setMusicMuted, stopMusic } from '../core/music';
import { isMuted, setMuted, sfx, unlockAudio } from '../core/sfx';
import { drawHeroCard, drawPortrait, renderPoseSet } from '../gfx/draw';
import { NEUTRAL_FACE, type Face } from '../gfx/face';
import { BattleUI } from './battleUi';
import { loadArt } from './artLoader';
import { LIGHT } from '../core/light';
import { savedResCap } from '../core/res';
import { dropHeroSheets, gameArtJobs, seaWear, swimLevel } from '../gfx/textures';
import { SHOP, wardrobe } from '../core/wardrobe';
import { groundPaintJobs } from '../world/LevelView';
import { gamepadSources } from '../input/gamepad';
import { isKeyDown } from '../input/keyboard';
import { isTouchDevice, onInputModeChange, usingTouch } from '../input/touch';
import type { GameData, GameOverState, GameScene, HudState, ResultState } from '../scenes/GameScene';
import { TouchControls } from './touchControls';
import { drawNuggie, drawRootBeer } from '../gfx/collectibles';
import { VERSION } from '../version';
import { LEVELS, canPickLevel, isTester, setTester, latestLevel, levelInfo, levelName, pickableLevels, progress } from '../level/levels';
import { account } from '../core/account';
import { bossData } from '../scenes/WrestleScene';

/** The boss at the end of each level (the Bosses menu lists the ones from levels you've beaten). */
const BOSSES = [
  { level: 1, name: 'King Puff Ball Basketball 1', scene: 'Hoops' },
  { level: 2, name: 'King Puff Ball Basketball 2', scene: 'Hoops' },
  { level: 3, name: 'Queen Plop Wrestling', scene: 'Wrestle' },
  { level: 4, name: 'Plop King Wrestling', scene: 'Wrestle' },
] as const;
import { resetLives } from '../core/lives';
import { bank } from '../core/bank';

/** A count kept short where space is tight: 1000 and up as 1.0k, 10.4k… (rounded down, so it never shows more than you have). */
export function shortCount(n: number): string {
  return n < 1000 ? String(n) : `${(Math.floor(n / 100) / 10).toFixed(1)}k`;
}

/** Text safe to put in HTML. */
const esc = (t: string) => t.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
/** A little person icon (the account button). */
const PERSON = '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><circle cx="10" cy="6.5" r="3.8" fill="currentColor"/><path d="M2.8 18.2c.6-4.2 3.6-6.6 7.2-6.6s6.6 2.4 7.2 6.6" fill="currentColor"/></svg>';
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
function controlsHtml(compact = false, swim = false) {
  const rows: [string, string][] = [
    [`${kc('←')}${kc('→')} <small>or</small> ${kc('A')}${kc('D')}`, swim ? 'swim' : 'move'],
    // (under the sea: every press is a stroke up)
    [`${kc('↑')} <small>or</small> ${kc('W')}`, swim ? (compact ? 'swim up (tap, tap, tap)' : 'swim up — each press is a stroke') : compact ? 'jump (again in the air: double jump)' : 'jump — press again in the air for a double jump'],
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
  /** The scene being played right now (a level, or Queen Plop's ring): what Pause pauses. */
  private gameScene: Phaser.Scene | null = null;
  /** A boss fight's intro is playing (no pause button until it's over). */
  private bossIntro = false;
  private pickRaf = 0;
  private hudFace: FaceLife | null = null;
  private hudIdle = 0;
  /** The online battle screens (made the first time you tap Battle). */
  private battleUi: BattleUI | null = null;
  private get battle() {
    this.battleUi ??= this.makeBattleUi();
    // (for the test scripts: sketches/battle/tresults.cjs shows each end-of-battle card)
    (window as unknown as { __battle?: BattleUI }).__battle = this.battleUi;
    return this.battleUi;
  }
  private makeBattleUi() {
    return new BattleUI({
    root: this.root,
    game: this.game,
    setScreen: (el) => this.setScreen(el),
    home: () => {
      if (this.game.scene.isActive('Menu')) this.showStart();
      else this.game.scene.start('Menu');
    },
    hero: () => CHARACTERS[this.selected]?.id ?? 'puffy',
    touch: (on) => {
      if (on && usingTouch()) this.touch.show();
      else this.touch.hide();
    },
    bombs: (n) => this.touch.setBombs(n),
    level: () => this.level,
  });
  }
  private selected = 0;
  private introEl: HTMLElement | null = null;
  /** Which level to start (1-based); you can pick once you've beaten a level. */
  /** (starts on the furthest level you've unlocked) */
  private level = latestLevel();

  constructor(private game: Phaser.Game) {
    this.root = document.getElementById('ui')!;
    // still signed in from last time? pick the account back up (and its progress)
    const beatenBefore = progress.beaten;
    // (what you wear changed — the Shop, or your account brought a hat from another device: the
    // hero's pictures are drawn again next time they're needed; not mid-game, they're in use)
    wardrobe.onChange(() => {
      if (['Game', 'Wrestle', 'Hoops', 'Battle'].some((k) => this.game.scene.isActive(k))) return;
      dropHeroSheets(this.game.textures);
      // (in the Shop: the start screen under it is redrawn once you close it, not on every buy — that
      // was a lot of drawing right as the till started counting)
      if (this.shopEl) this.startStale = true;
      else if (this.screen?.classList.contains('start')) this.showStart();
    });
    account.onChange(() => {
      const btn = this.screen?.querySelector<HTMLElement>('[data-act=account]');
      if (btn) btn.innerHTML = this.accountLabel();
      // (a tester signed in or out: the work-in-progress Parts come or go)
      if (setTester(account.user?.name)) {
        if (levelInfo(this.level).id !== this.level) this.level = latestLevel();
        if (this.screen?.classList.contains('start')) this.showStart();
      }
    });
    void account.restore().then(() => {
      if (progress.beaten !== beatenBefore && this.screen?.classList.contains('start')) {
        this.level = latestLevel();
        this.showStart();
      }
    });
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
        <button class="icon-btn hud-pause" aria-label="Pause"><svg class="pause-ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="5.6" y="4.5" width="4.8" height="15" rx="1.4"/><rect x="13.6" y="4.5" width="4.8" height="15" rx="1.4"/></svg></button>
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
    // (a few times a second is plenty for a two-frame shuffle: not a job on every frame of the game)
    const animatePuffy = () => {
      if (!this.rotate.hidden) {
        poses ??= renderPoseSet(CHARACTERS[0], ['idle0', 'idle1'], rc.width, '');
        const pose = Math.floor((performance.now() - t0) / 450) % 2 ? 'idle1' : 'idle0';
        if (pose !== lastPose && poses[pose]) {
          lastPose = pose;
          rctx.clearRect(0, 0, rc.width, rc.height);
          rctx.drawImage(poses[pose], 0, 0);
        }
      }
    };
    setInterval(animatePuffy, 75);
    this.root.appendChild(this.rotate);
    this.selected = Math.max(0, CHARACTERS.findIndex((c) => c.id === store.get('puffy.hero')));

    game.events.on('menu', () => this.showStart());
    // (during the loading screen: each hero's card poses drawn now, so the first pick is instant)
    game.events.on('warm-start', () => this.warmCards(true));
    game.events.on('warm-cards', () => this.warmCards(false));
    game.events.on('game-start', (s: GameScene, info: { fresh: boolean; atStart: boolean; level: string; world: string }) => {
      this.gameScene = s;
      this.bossIntro = false;
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
        <div class="li-title"><strong>${i.title}</strong><em>${i.part}</em></div>
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
        const tip = h(`<div class="ctl-tip">${controlsHtml(true, (this.gameScene as { level?: { data: { water?: number } } } | null)?.level?.data.water !== undefined)}</div>`);
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
    // boss fights: no HUD, just the pause button (top right), once the intro's over (nothing to
    // press by mistake during the cut scene; Esc / P wait too)
    const pauseOnly = () => {
      this.hud.hidden = false;
      this.hud.classList.add('bare');
      this.bossIntro = false;
    };
    const introStarts = () => {
      this.hud.hidden = true;
      this.bossIntro = true;
    };
    game.events.on('hoops-play', pauseOnly);
    game.events.on('hoops-start', (s: Phaser.Scene) => {
      this.gameScene = s;
      this.setScreen(null);
      introStarts();
      this.banner.hidden = true;
      this.touch.hide();
      // the phone is upright as basketball begins: start it frozen (turning back carries on)
      requestAnimationFrame(() => {
        if (window.innerHeight > window.innerWidth && isTouchDevice() && game.scene.isActive('Hoops')) game.scene.pause('Hoops');
      });
    });
    // Queen Plop's ring: the HUD and controls come once her entrance is over
    game.events.on('wrestle-start', (s: Phaser.Scene) => {
      this.introEl?.remove();
      this.introEl = null;
      this.gameScene = s;
      this.setScreen(null);
      introStarts();
      this.banner.hidden = true;
      this.touch.hide();
    });
    game.events.on('wrestle-fight', () => {
      this.showHud();
      // (no HUD in the ring, just the pause button: your hearts are over your head)
      this.hud.classList.add('bare');
      this.bossIntro = false;
    });
    // a boss fight's ending: the pause button goes again for the cut scene
    game.events.on('boss-cutscene', () => {
      this.hud.hidden = true;
      this.touch.hide();
      this.bossIntro = true;
    });
    // holding the chair: the FIRE button swings it
    game.events.on('wrestle-chair', (on: boolean) => this.touch.setChair(on));
    game.events.on('level-complete', (r: ResultState) => this.showResults(r));
    game.events.on('game-over', (g: GameOverState) => this.showGameOver(g));
    // lost a boss fought from the Bosses menu: a card, not a straight restart
    game.events.on('boss-lost', (r: ResultState) => this.showBossResults(r, false));

    window.addEventListener('keydown', (e) => {
      if ((e.code === 'Escape' || e.code === 'KeyP') && this.gameScene && !this.screen && !this.bossIntro) this.pause();
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
    // the first tap anywhere unlocks sound + music (if the browser didn't already let it
    // start by itself). Some browsers only count the finger lifting as a "real" tap.
    const unlock = () => {
      unlockAudio();
      primeMusic();
    };
    for (const ev of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) window.addEventListener(ev, unlock, { once: true });
    // (no automatic full screen: the full-screen button, or installing the game as an app)
  }

  private setScreen(el: HTMLElement | null) {
    cancelAnimationFrame(this.pickRaf);
    this.screen?.remove();
    this.screen = el;
    if (el) this.root.appendChild(el);
    // (paused during the level's flyover: its title card and Skip button step aside till you're back)
    this.introEl?.classList.toggle('held', !!el);
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
    const el = h(`<div class="screen start${canPickLevel() ? '' : ' no-levels'}">
      <header class="start-head">
        <div class="logo"><span>P</span><span>U</span><span>F</span><span>F</span><span>Y</span></div>
        <p class="world-name" aria-label="${levelName(this.level)}">${waveText(levelName(this.level))}</p>
      </header>
      <h2>Pick your player</h2>
      <div class="cards" role="radiogroup" aria-label="Pick your player"></div>
      ${
        canPickLevel()
          ? `<div class="levels" role="radiogroup" aria-label="Pick a level">${pickableLevels().map(
              (l) => `<button class="lvl" data-lvl="${l.id}" ${l.build ? '' : 'disabled'}>${l.button ?? l.part}${l.build ? '' : '<small>coming soon</small>'}</button>`,
            ).join('')}<span class="lvl-side"><button class="lvl lvl-bosses" data-act="bosses" aria-label="Boss battles">Bosses</button></span></div>`
          : ''
      }
      <div class="start-tl">
        <button class="icon-btn mute-btn" data-act="mute" aria-label="Sound on or off"></button>
        <button class="icon-btn acct-btn" data-act="account" aria-label="Your player account">${this.accountLabel()}</button>
      </div>
      <div class="start-tr">
        <button class="icon-btn battle-btn shop-btn" data-act="shop" aria-label="The Shop: things for your hero">Shop</button>
        <button class="icon-btn battle-btn" data-act="battle" aria-label="Online battle with friends">Battle</button>
        <button class="icon-btn fs-btn" data-act="fs" aria-label="Full screen" hidden>⛶</button>
      </div>
      <p class="version">v${VERSION} · ${this.game.renderer.type === Phaser.WEBGL ? 'WebGL' : 'Canvas'}${this.lowRes()}</p>
      <div class="start-foot">
        <button class="btn btn-big btn-go" data-act="play">Play</button>
        ${usingTouch() ? '' : controlsHtml(true)}
      </div>
    </div>`);
    const cards = el.querySelector('.cards')!;
    CHARACTERS.forEach((c, i) => {
      const bar = (n: number) => `<i style="--n:${n}"></i>`;
      const card = h(`<button class="card" role="radio" data-i="${i}" data-hero="${c.id}" style="--c:${c.colors.main};--cs:${c.colors.shade}">
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
      // (what you've got on from the Shop shows on the picked hero only: the others stand there bare)
      drawHeroCard(cv, c, 'idle0', undefined, i === this.selected ? wardrobe.wearKey : '');
      // select the moment a finger touches the card (a tap can trigger full screen and
      // shift the layout before the finger lifts); tapping the picked card again plays
      let pickedOnDown = false;
      card.addEventListener('pointerdown', () => {
        unlockAudio();
        pickedOnDown = this.selected !== i;
        if (pickedOnDown) this.select(i);
      });
      card.addEventListener('click', () => {
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
      el.querySelectorAll<HTMLButtonElement>('.lvl[data-lvl]').forEach((b) => b.classList.toggle('picked', Number(b.dataset.lvl) === this.level));
      const wn = el.querySelector<HTMLElement>('.world-name:not(.wn-old)')!;
      // the planet's name says which world it is ("Puff Ball Planet" is World 1)
      const text = levelName(this.level);
      if (wn.getAttribute('aria-label') === text) return;
      wn.setAttribute('aria-label', text);
      // the old line and the new one cross-fade in the same spot (both sit in a fixed slot, out
      // of the page's layout: nothing else moves). The old one is a copy that fades away.
      el.querySelectorAll('.world-name.wn-old').forEach((o) => o.remove());
      // (light mode: just the new words, no cross-fade)
      if (LIGHT) {
        wn.innerHTML = waveText(text);
        return;
      }
      const old = wn.cloneNode(true) as HTMLElement;
      old.classList.remove('wn-new');
      old.classList.add('wn-old');
      old.removeAttribute('aria-label');
      old.setAttribute('aria-hidden', 'true');
      wn.after(old);
      old.addEventListener('animationend', (e) => e.target === old && old.remove());
      window.setTimeout(() => old.remove(), 800);
      wn.innerHTML = waveText(text);
      wn.classList.remove('wn-new');
      void wn.offsetWidth;
      wn.classList.add('wn-new');
    };
    el.querySelectorAll<HTMLButtonElement>('.lvl[data-lvl]').forEach((b) =>
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
    el.querySelector('[data-act=battle]')!.addEventListener('click', () => {
      sfx.select();
      this.battle.open();
    });
    el.querySelector('[data-act=shop]')!.addEventListener('click', () => {
      sfx.select();
      this.showShop();
    });
    // (temporary, for testing: straight into Queen Plop's ring)
    el.querySelector('[data-act=bosses]')?.addEventListener('click', () => {
      sfx.select();
      this.showBosses();
    });
    el.querySelector('[data-act=account]')!.addEventListener('click', () => {
      sfx.select();
      this.showAccount();
    });
    const fsBtn = el.querySelector<HTMLButtonElement>('[data-act=fs]')!;
    const syncFs = () => (fsBtn.hidden = !canFullscreen() || isFullscreen() || isStandalone());
    syncFs();
    document.addEventListener('fullscreenchange', syncFs);
    fsBtn.addEventListener('click', () => {
      this.goFullscreen();
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

  // ─────────────────────────────────────────── the (optional) account ──

  /** The account button's label: your name once signed in, else "Sign in". */
  private accountLabel() {
    const u = account.user;
    return u ? `${PERSON}<span>${esc(u.name)}</span><small class="acct-rb"><i class="rb-ico"></i>${shortCount(bank.rootbeerLeft)}</small>` : `${PERSON}<span>Sign in</span>`;
  }

  /**
   * Sign in (or make a player) with a name and password, so your root beer, nuggies and
   * level are saved to your account; signed in, it shows them and lets you sign out.
   * Playing never needs it.
   */
  private showAccount() {
    const u = account.user;
    // signed in: like the end-of-level card — your hero on the left, your player's stats on the right
    const el = u
      ? h(`<div class="screen modal acct">
      <div class="panel results acct-card">
        <button class="btn btn-alt acct-out" data-act="out">Sign out</button>
        <div class="results-hero"><canvas width="160" height="160"></canvas></div>
        <div class="results-body">
          <h2>Hi ${esc(u.name)}!</h2>
          <dl class="stat-list">
            <dt>Root beer <i class="rb-ico"></i></dt><dd>${bank.rootbeerLeft}</dd>
            <dt>Nuggies eaten <i class="aura-ico"></i></dt><dd>${Math.max(u.nuggies, bank.nuggies)}</dd>
            <dt>Bad guys beaten</dt><dd>${Math.max(u.kills, bank.kills)}</dd>
            <dt>Current level</dt><dd>${esc(levelName(latestLevel()))}</dd>
          </dl>
        </div>
        <div class="row acct-done-row">
          <button class="btn btn-go" data-act="back">Done</button>
        </div>
      </div>
    </div>`)
      : h(`<div class="screen modal acct">
      <div class="panel acct-panel">
        <h2>Sign in</h2>
        <label class="bl-namebox acct-box"><input name="name" maxlength="10" placeholder="Name" autocomplete="username" autocapitalize="off" spellcheck="false" aria-label="Name"></label>
        <label class="bl-namebox acct-box"><input name="pw" type="password" maxlength="64" placeholder="Password" autocomplete="current-password" aria-label="Password"></label>
        <p class="acct-err" hidden></p>
        <div class="row acct-main">
          <button class="btn btn-alt" data-act="back">Back</button>
          <button class="btn btn-go" data-act="in">Sign in</button>
        </div>
        <div class="row acct-confirm" hidden>
          <button class="btn btn-alt" data-act="cancel">Cancel</button>
          <button class="btn btn-go" data-act="ok">OK</button>
        </div>
      </div>
    </div>`);
    if (u) this.liveHero(el.querySelector('canvas')!, CHARACTERS[this.selected] ?? CHARACTERS[0], () => this.screen === el);
    const back = () => {
      sfx.back();
      this.showStart();
    };
    el.querySelector('[data-act=back]')!.addEventListener('click', back);
    el.querySelector('[data-act=out]')?.addEventListener('click', async () => {
      sfx.back();
      await account.signOut();
      this.showStart();
    });
    const name = el.querySelector<HTMLInputElement>('input[name=name]');
    const pw = el.querySelector<HTMLInputElement>('input[name=pw]');
    const err = el.querySelector<HTMLElement>('.acct-err');
    const main = el.querySelector<HTMLElement>('.acct-main');
    const confirm = el.querySelector<HTMLElement>('.acct-confirm');
    const btns = [...el.querySelectorAll<HTMLButtonElement>('.row .btn')];
    const say = (text: string, kind: 'error' | 'ask') => {
      if (!err) return;
      err.textContent = text;
      err.hidden = false;
      err.classList.toggle('ask', kind === 'ask');
    };
    // a name nobody has yet: say so; OK makes the new player
    const asking = (on: boolean) => {
      if (main) main.hidden = on;
      if (confirm) confirm.hidden = !on;
      if (!on && err) err.hidden = true;
    };
    const go = async (create: boolean) => {
      if (!name || !pw) return;
      if (name.value.trim().length < 2 || pw.value.length < 4) {
        say(name.value.trim().length < 2 ? 'Type your name (at least 2 letters).' : 'Passwords are at least 4 characters.', 'error');
        sfx.bump();
        return;
      }
      btns.forEach((b) => (b.disabled = true));
      const r = await account.signIn(name.value, pw.value, create);
      btns.forEach((b) => (b.disabled = false));
      if (r.unknown && !create) {
        say(`There's no player called “${name.value.trim()}” yet.\nMake a new player with this name and password?`, 'ask');
        asking(true);
        sfx.select();
        return;
      }
      if (r.error) {
        asking(false);
        say(r.error, 'error');
        sfx.bump();
        return;
      }
      // signed in: straight back to the start screen
      sfx.select();
      this.level = latestLevel();
      this.showStart();
    };
    el.querySelector('[data-act=in]')?.addEventListener('click', () => go(false));
    el.querySelector('[data-act=ok]')?.addEventListener('click', () => go(true));
    el.querySelector('[data-act=cancel]')?.addEventListener('click', () => {
      sfx.back();
      asking(false);
    });
    for (const input of [name, pw]) {
      input?.addEventListener('keydown', (e) => {
        e.stopPropagation(); // typing isn't playing
        if (e.key === 'Enter') go(!!confirm && !confirm.hidden);
      });
      // changing the name or password after the question: ask again
      input?.addEventListener('input', () => asking(false));
    }
    this.setScreen(el);
  }

  private select(i: number, quiet = false) {
    const prev = this.selected;
    this.selected = i;
    const el = this.screen;
    if (!el) return;
    // the hero we moved away from goes back to a plain face, and hands over the Shop things
    if (prev !== i) {
      const pc = el.querySelectorAll<HTMLElement>('.card')[prev]?.querySelector('canvas');
      if (pc) drawHeroCard(pc, CHARACTERS[prev], 'idle0', undefined, '');
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
      // (the Shop things go on the hero you pick: a little sparkle as they appear)
      if (wardrobe.wearKey) this.sparkle(el.querySelectorAll<HTMLElement>('.card')[i]);
    }
  }

  /**
   * Each hero's card poses in what you've got on, drawn once (a hop flips between them with no
   * redraw cost). Only the picked hero hops, so it's always them in their Shop things — the jump's
   * the skateboard's ollie if they're on it. (Kept per hero; drawn again if what's on changes.)
   */
  private cardPoses = new Map<string, { key: string; poses: Record<string, HTMLCanvasElement> }>();
  private cheerRaf = 0;

  private posesFor(i: number, cv: HTMLCanvasElement, wear = wardrobe.wearKey) {
    const ch = CHARACTERS[i];
    const key = `${wear}|${cv.width}x${cv.height}`;
    let kept = this.cardPoses.get(ch.id);
    if (!kept || kept.key !== key) {
      const poses: Record<string, HTMLCanvasElement> = {};
      for (const pose of ['idle0', 'jump', 'fall'] as const) {
        const c = document.createElement('canvas');
        c.width = cv.width;
        c.height = cv.height;
        drawHeroCard(c, ch, pose, undefined, wear);
        poses[pose] = c;
      }
      kept = { key, poses };
      this.cardPoses.set(ch.id, kept);
    }
    return kept.poses;
  }

  /** The cards' hop poses, drawn ahead of time (the picked hero's during loading, the others just after). */
  private warmCards(pickedOnly: boolean) {
    this.screen?.querySelectorAll<HTMLElement>('.card').forEach((card, i) => {
      const cv = card.querySelector('canvas');
      if (cv && (!pickedOnly || i === this.selected)) this.posesFor(i, cv);
    });
  }

  /** The picked hero celebrates: crouch, hop, land with a squash, and the name bounces. */
  private cheer(i: number) {
    const card = this.screen?.querySelectorAll<HTMLElement>('.card')[i];
    const cv = card?.querySelector('canvas');
    if (!card || !cv) return;
    const ch = CHARACTERS[i];
    const poses = this.posesFor(i, cv);
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
      // (one still hopping when another's picked: it lands, bare)
      const other = c.querySelector('canvas');
      const k = Number(c.dataset.i);
      if (other && k !== i) drawHeroCard(other, CHARACTERS[k], 'idle0', undefined, '');
    });
        void card.offsetWidth;
    card.classList.add('cheer');
    // the poses follow the hop's own clock (.cheer keyframes, 0.75 s), so they
    // always line up with it: crouch → up → coming down → landed
    const hop = cv.getAnimations()[0];
    const t0 = performance.now();
    const step = () => {
      const t = hop && typeof hop.currentTime === 'number' ? hop.currentTime : performance.now() - t0;
      // (Scruffy does a little backflip, so he's up in the air a bit longer)
      const [up, down, end] = ch.id === 'scruffy' ? [355, 570, 860] : [330, 540, 760];
      show(t < 105 ? 'idle0' : t < up ? 'jump' : t < down ? 'fall' : 'idle0');
      if (card.isConnected && hop?.playState !== 'finished' && t < end) this.cheerRaf = requestAnimationFrame(step);
      else {
        show('idle0');
        card.classList.remove('cheer');
      }
    };
    this.cheerRaf = requestAnimationFrame(step);
  }

  /**
   * A hero drawn like on the pick-a-player cards, alive: the standing animation
   * (two frames, at the game's pace) plus the odd blink, glance and breath.
   * Runs until `alive()` says the screen has gone.
   */
  private liveHero(cv: HTMLCanvasElement, hero: CharacterDef, alive: () => boolean, level?: number) {
    let pose: 'idle0' | 'idle1' = 'idle0';
    let face: Face | undefined;
    cv.classList.add('live');
    // (under the sea: in the dive gear, not on the skateboard)
    const wear = swimLevel(level) ? seaWear() : wardrobe.wearKey;
    // (sized to fill the spot, the same size on both frames so it doesn't jump)
    const draw = () => drawPortrait(cv, hero, pose, face, 'idle0', wear);
    draw();
    new FaceLife((f) => ((face = f), draw()), alive, { mouth: true });
    const iv = window.setInterval(() => {
      if (!alive()) return clearInterval(iv);
      pose = pose === 'idle0' ? 'idle1' : 'idle0';
      draw();
    }, 625);
  }

  /** Hide the browser's address bar etc. (Android, iPad, desktop). iPhone needs "Add to Home Screen". */
  private goFullscreen() {
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

  /** ' · lower res' on the version label when this device was found slow and draws at a lower resolution. */
  private lowRes() {
    if (LIGHT) return ' · light';
    return savedResCap() ? ' · lower res' : '';
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
    const hero = CHARACTERS[this.selected];
    store.set('puffy.hero', hero.id);
    this.startGame({ players: [{ slot: 0, characterId: hero.id, inputId: 'solo' }] });
  }

  /**
   * The Shop: a page of its own that slides up from the bottom over the start screen (and back down
   * when you close it, × top right). Things for your hero, bought with root beer: a party hat,
   * sunglasses, a skateboard. Each shows your hero with it on (with whatever else they've on); once
   * it's yours, put it on or take it off — one on your head, one over your eyes, one under your
   * feet. Putting one on, your hero does their celebration in it. Whatever you've on shows on your
   * hero everywhere (and in battles, to everyone).
   */
  private shopEl: HTMLElement | null = null;
  /** What you've on changed while the Shop was open: the start screen under it wants redrawing. */
  private startStale = false;
  /** What was on when the Shop opened. */
  private shopWore = '';
  private showShop() {
    if (this.shopEl) return;
    const page = h(`<div class="shop-page" role="dialog" aria-label="Shop">
      <button class="icon-btn shop-x" aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 5.5 18.5 18.5M18.5 5.5 5.5 18.5"/></svg></button>
      <header class="bl-head">
        <h1 class="bl-title shop-title" aria-label="Shop!">${[...'Shop!'].map((ch, i) => `<span style="--i:${i}">${ch}</span>`).join('')}</h1>
        <p class="bl-sub shop-rb"></p>
      </header>
      <p class="shop-welcome">Welcome to The Puffy Boutique</p>
      <div class="shop-list"></div>
    </div>`);
    this.shopEl = page;
    this.shopWore = wardrobe.wearKey;
    this.root.appendChild(page);
    // (slides up on the next frame, from where it starts: below the screen)
    void page.offsetWidth;
    page.classList.add('in');
    page.querySelector('.shop-x')!.addEventListener('click', () => {
      sfx.back();
      this.closeShop();
    });
    this.renderShop();
    this.alignShop();
    window.addEventListener('resize', this.alignShopSoon);
  }

  /**
   * On tablets and computers the welcome line and the tiles sit level with the start screen's
   * "Pick your player" and its cards (the start screen's still there, under the Shop: measure it).
   * Where the start screen hides its title (short screens), the Shop keeps its own layout.
   */
  private alignShop() {
    const page = this.shopEl;
    const welcome = page?.querySelector<HTMLElement>('.shop-welcome');
    const list = page?.querySelector<HTMLElement>('.shop-list');
    if (!page || !welcome || !list) return;
    welcome.style.marginTop = '';
    list.style.marginTop = '';
    const h2 = this.screen?.querySelector<HTMLElement>('.start h2');
    const card = this.screen?.querySelector<HTMLElement>('.card');
    if (!h2 || !card || !h2.offsetHeight || !welcome.offsetHeight) return;
    // (layout positions: offsetTop isn't moved by the page's slide)
    const want = h2.getBoundingClientRect().top;
    const wantCards = card.getBoundingClientRect().top;
    // (each row measured where it lands with no margin, then nudged to the line; a little negative
    // margin is fine — it eats into the page's row gap, never into the badge or the welcome line)
    welcome.style.marginTop = '0px';
    list.style.marginTop = '0px';
    welcome.style.marginTop = `${Math.max(-14, want - welcome.offsetTop)}px`;
    list.style.marginTop = `${Math.max(-14, wantCards - list.offsetTop)}px`;
  }
  private alignShopSoon = () => requestAnimationFrame(() => this.alignShop());

  /** Slide the Shop back down, then it's gone (the start screen's under it all along). */
  private closeShop() {
    const page = this.shopEl;
    if (!page) return;
    this.shopEl = null;
    window.removeEventListener('resize', this.alignShopSoon);
    if (this.startStale) {
      this.startStale = false;
      if (this.screen?.classList.contains('start')) this.showStart();
    }
    page.classList.remove('in');
    // (something new on: back on the start screen, your hero shows it off)
    if (wardrobe.wearKey !== this.shopWore && this.screen?.classList.contains('start')) setTimeout(() => this.cheer(this.selected), 380);
    let gone = false;
    const done = () => {
      if (gone) return;
      gone = true;
      page.remove();
    };
    // (the page's own slide: a button's transition ending inside it bubbles up here too)
    page.addEventListener('transitionend', (e) => e.target === page && done());
    setTimeout(done, 700);
  }

  /** The Shop's things (drawn again after each buy / put on / take off). */
  private renderShop(cheerId?: string, paidFrom?: number) {
    const page = this.shopEl;
    if (!page) return;
    const hero = CHARACTERS[this.selected];
    const left = bank.rootbeerLeft;
    const pill = page.querySelector<HTMLElement>('.shop-rb')!;
    pill.innerHTML = `<i class="rb-ico"></i> <b class="shop-count">${left}</b> root beer`;
    if (paidFrom !== undefined && paidFrom > left) this.ringUp(pill, paidFrom, left);
    const list = page.querySelector('.shop-list')!;
    list.innerHTML = SHOP.map((it) => {
      const own = wardrobe.owns(it.id);
      const on = wardrobe.isOn(it.id);
      const btn = on
        ? `<button class="btn btn-alt" data-off="${it.id}">${it.slot === 'ride' ? 'Stop Riding' : it.slot === 'eyes' ? 'Take them off' : 'Take it off'}</button>`
        : own
          ? `<button class="btn shop-wear" data-wear="${it.id}">${it.slot === 'ride' ? 'Ride it' : it.slot === 'eyes' ? 'Wear them' : 'Wear it'}</button>`
          : // (not enough root beer yet: the same Buy button, greyed out)
            `<button class="btn btn-go" ${left >= it.price ? `data-buy="${it.id}"` : 'disabled'}>Buy · ${it.price} <i class="rb-ico"></i></button>`;
      return `<div class="shop-item${on ? ' on' : ''}" data-id="${it.id}" data-hero="${hero.id}">
        <canvas width="240" height="240"></canvas>
        <h3>${esc(it.name)}</h3>
        <p class="shop-tag">${on ? (it.slot === 'ride' ? 'Riding it' : 'Wearing it') : own ? 'Yours' : ''}</p>
        <p class="shop-blurb">${esc(it.blurb)}</p>
        ${btn}
      </div>`;
    }).join('');
    // (each with that on, and whatever else you've on that it doesn't replace)
    const withIt = (id: string) => {
      const slot = SHOP.find((i) => i.id === id)!.slot;
      return [...wardrobe.equipped.filter((x) => SHOP.find((i) => i.id === x)?.slot !== slot), id].sort().join(',');
    };
    list.querySelectorAll<HTMLElement>('.shop-item').forEach((item) => {
      const cv = item.querySelector('canvas')!;
      const wear = withIt(item.dataset.id!);
      drawHeroCard(cv, hero, 'idle0', undefined, wear);
      if (item.dataset.id === cheerId) this.hop(item, cv, hero, wear);
    });
    // (what you wear changed: the hero's pictures are drawn again, with or without it, next time they're needed)
    const changed = (id?: string, paidFrom?: number) => {
      dropHeroSheets(this.game.textures);
      account.save();
      this.renderShop(id, paidFrom);
    };
    list.querySelectorAll<HTMLButtonElement>('[data-buy]').forEach((b) =>
      b.addEventListener('click', () => {
        const had = bank.rootbeerLeft;
        if (!wardrobe.buy(b.dataset.buy!)) return;
        // (light mode: the new count straight away, and a cheer; else the till rings it up)
        if (LIGHT) sfx.powerup();
        wardrobe.wear(b.dataset.buy!, true);
        changed(b.dataset.buy, LIGHT ? undefined : had);
      }),
    );
    list.querySelectorAll<HTMLButtonElement>('[data-wear]').forEach((b) =>
      b.addEventListener('click', () => {
        sfx.select();
        wardrobe.wear(b.dataset.wear!, true);
        changed(b.dataset.wear);
      }),
    );
    list.querySelectorAll<HTMLButtonElement>('[data-off]').forEach((b) =>
      b.addEventListener('click', () => {
        sfx.back();
        wardrobe.wear(b.dataset.off!, false);
        changed();
      }),
    );
  }

  /**
   * Paying, like a till: the root beer count clicks down a bottle at a time (quick at first, then
   * slowing), the price drops off the pill ("−20"), and it ends with a ka-ching and a bump.
   */
  private ringUp(pill: HTMLElement, from: number, to: number) {
    const count = pill.querySelector<HTMLElement>('.shop-count')!;
    const paid = from - to;
    count.textContent = String(from);
    const drop = document.createElement('span');
    drop.className = 'shop-paid';
    drop.innerHTML = `−${paid} <i class="rb-ico"></i>`;
    pill.appendChild(drop);
    setTimeout(() => drop.remove(), 2100);
    // (a quick till: ~0.8 s for 20 bottles, 1.2 s for 50, easing off for the last few; it starts a
    // moment after the tap, once the Shop's pictures have been redrawn, so it doesn't hitch)
    const dur = Math.min(1200, 550 + paid * 13);
    let t0 = 0;
    let shown = from;
    let lastTick = 0;
    const step = (now: number) => {
      if (!pill.isConnected) return;
      t0 ||= now;
      const u = Math.min(1, (now - t0) / dur);
      const n = Math.round(from - paid * (1 - Math.pow(1 - u, 2)));
      if (n !== shown) {
        shown = n;
        count.textContent = String(n);
        // (the wheel flicking over: an animation of its own, no restyling of the page)
        count.animate([{ transform: 'translateY(-0.22em)', opacity: 0.55 }, { transform: 'none', opacity: 1 }], { duration: 110, easing: 'ease-out' });
        if (now - lastTick > 55) {
          lastTick = now;
          sfx.tick();
        }
      }
      if (u < 1) requestAnimationFrame(step);
      else {
        count.textContent = String(to);
        // (the bump runs on the compositor — the pill's already its own layer — and the ka-ching's
        // sound is set up just after, so neither holds the other up)
        pill.animate(
          [{ transform: 'none' }, { transform: 'scale(1.08) rotate(-1.5deg)', offset: 0.35 }, { transform: 'none' }],
          { duration: 380, easing: 'cubic-bezier(0.3, 1.3, 0.5, 1)' },
        );
        setTimeout(() => sfx.kaching(), 0);
      }
    };
    setTimeout(() => requestAnimationFrame(step), 160);
  }

  /** A burst of little sparkles over a card's hero (their Shop things going on). */
  private sparkle(card: HTMLElement | undefined) {
    const cv = card?.querySelector('canvas');
    if (!card || !cv || LIGHT) return;
    card.querySelectorAll('.gear-spark').forEach((e) => e.remove());
    const cx = cv.offsetLeft + cv.offsetWidth / 2;
    const cy = cv.offsetTop + cv.offsetHeight * 0.42;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + 0.3;
      const r = Math.max(44, cv.offsetHeight * 0.62) * (0.8 + (k % 2) * 0.3);
      const sp = document.createElement('i');
      sp.className = 'gear-spark';
      sp.style.cssText = `--sc:${['#ff6fb1', '#ffc94a', '#2ec4c4', '#8a5cf6'][k % 4]};left:${cx}px;top:${cy}px;--dx:${Math.cos(a) * r}px;--dy:${Math.sin(a) * r * 0.8}px;--d:${(k % 3) * 40}ms`;
      card.appendChild(sp);
      setTimeout(() => sp.remove(), 900);
    }
  }

  /**
   * A hero's celebration in a picture (`box` gets .cheer, which runs the hop on `cv`): crouch, up
   * (their jump — on the skateboard, the ollie), coming down, landed, in what `wear` puts on them.
   * The poses follow the hop's own clock, so they always line up with it.
   */
  private hop(box: HTMLElement, cv: HTMLCanvasElement, ch: CharacterDef, wear: string) {
    const poses: Record<string, HTMLCanvasElement> = {};
    for (const pose of ['idle0', 'jump', 'fall'] as const) {
      const c = document.createElement('canvas');
      c.width = cv.width;
      c.height = cv.height;
      drawHeroCard(c, ch, pose, undefined, wear);
      poses[pose] = c;
    }
    const ctx = cv.getContext('2d')!;
    let shown = '';
    const show = (pose: string) => {
      if (pose === shown) return;
      shown = pose;
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.drawImage(poses[pose], 0, 0);
    };
    box.classList.remove('cheer');
    void box.offsetWidth;
    box.classList.add('cheer');
    const anim = cv.getAnimations()[0];
    const t0 = performance.now();
    const [up, down, end] = ch.id === 'scruffy' ? [355, 570, 860] : [330, 540, 760];
    const step = () => {
      const t = anim && typeof anim.currentTime === 'number' ? anim.currentTime : performance.now() - t0;
      show(t < 105 ? 'idle0' : t < up ? 'jump' : t < down ? 'fall' : 'idle0');
      if (box.isConnected && anim?.playState !== 'finished' && t < end) requestAnimationFrame(step);
      else {
        show('idle0');
        box.classList.remove('cheer');
      }
    };
    requestAnimationFrame(step);
  }

  /** (Temporary, for testing) straight into the Queen Plop fight with the picked hero. */
  /** The Bosses menu: fight the boss of any level you've beaten, straight away (as practice). */
  private showBosses() {
    // (the testers get every boss)
    const open = BOSSES.filter((b) => progress.beaten >= b.level || isTester());
    const el = h(`<div class="screen modal bosses">
      <div class="panel boss-panel">
        <h2>Boss Battles</h2>
        <div class="boss-list">${open
          .map((b) => `<button class="btn boss-btn" data-boss="${b.level}"><b>${b.name}</b><small>${esc(levelName(b.level))}</small></button>`)
          .join('')}</div>
        <div class="row"><button class="btn btn-alt" data-act="back">Back</button></div>
      </div>
    </div>`);
    el.querySelector('[data-act=back]')!.addEventListener('click', () => {
      sfx.back();
      this.showStart();
    });
    el.querySelectorAll<HTMLButtonElement>('[data-boss]').forEach((b) => b.addEventListener('click', () => this.playBoss(Number(b.dataset.boss))));
    this.setScreen(el);
  }

  /** Straight into a level's boss fight (from the Bosses menu: practice, no lives lost). */
  private playBoss(level: number) {
    if (!this.game.registry.get('ready')) {
      this.game.events.once('assets-ready', () => this.playBoss(level));
      return;
    }
    const boss = BOSSES.find((b) => b.level === level);
    if (!boss) return;
    unlockAudio();
    primeMusic();
    preloadHoopsMusic();
    const hero = CHARACTERS[this.selected];
    if (this.starting) return;
    this.starting = true;
    void this.gameArt([hero.id], null).then(() => {
      this.starting = false;
      this.launchBoss(boss, hero, level);
    });
  }

  private launchBoss(boss: (typeof BOSSES)[number], hero: CharacterDef, level: number) {
    store.set('puffy.hero', hero.id);
    sfx.select();
    stopMusic();
    resetLives();
    this.level = level;
    this.session = { players: [{ slot: 0, characterId: hero.id, inputId: 'solo' }] };
    this.setScreen(null);
    this.game.scene.stop('Menu');
    this.game.scene.stop('Hoops');
    this.game.scene.stop('Wrestle');
    this.game.scene.stop('Game');
    this.game.scene.start(boss.scene, bossData(this.session, hero.id, level));
  }

  /** You beat (or lost to) a boss from the Bosses menu: fight it again, or back home. */
  private showBossResults(r: ResultState, won = true) {
    this.touch.hide();
    if (won) playLevelClear();
    else {
      this.hud.hidden = true;
      fadeOutMusic(800);
      sfx.groan();
    }
    const boss = BOSSES.find((b) => b.level === r.level) ?? BOSSES[0];
    const queen = boss.scene === 'Wrestle' && boss.level === 3;
    const plopKing = boss.level === 4;
    const title = plopKing
      ? won
        ? 'The Plop King is done for!'
        : 'The Plop King wins!'
      : won
        ? queen
          ? 'Queen Plop is down!'
          : 'You beat the King!'
        : queen
          ? 'Queen Plop wins!'
          : 'The King wins!';
    const result = `<dt>Result</dt><dd>${won ? 'Won' : 'Lost'}</dd>` + (r.hoops ? `<dt>Final score</dt><dd>${esc(r.hoops)}</dd>` : '');
    const el = h(`<div class="screen modal">
      <div class="panel results${won ? '' : ' gameover'}">
        <div class="results-hero"><canvas width="160" height="160"></canvas></div>
        <div class="results-body">
          <p class="eyebrow">${boss.name}</p>
          <h2>${title}</h2>
          <dl class="stat-list">
            ${result}
          </dl>
          <div class="row">
            <button class="btn ${won ? 'btn-alt' : 'btn-go'}" data-act="again">${won ? 'Play again' : 'Try again'}</button>
            <button class="btn ${won ? 'btn-go' : 'btn-alt'}" data-act="home">Home screen</button>
          </div>
        </div>
      </div>
    </div>`);
    this.liveHero(el.querySelector('canvas')!, characterById(r.charId), () => this.screen === el, r.level ?? this.level);
    el.querySelector('[data-act=again]')!.addEventListener('click', () => this.playBoss(boss.level));
    el.querySelector('[data-act=home]')!.addEventListener('click', () => this.quitToStart());
    this.setScreen(el);
  }

  /** The game's own art for these heroes (and a level's bad guys), drawn first behind a little loading card if it isn't yet. */
  private gameArt(heroes: string[], level: number | null) {
    const scene = this.game.scene.getScene('Menu') as unknown as Phaser.Scene & { groundJobs?: (id: number) => { name: string; run: () => void }[] };
    // (and the level's ground, for its opening fly-over, if the start screen hasn't drawn it yet)
    let ground: { name: string; run: () => void }[] = [];
    const build = level !== null ? levelInfo(level).build : undefined;
    // (straight on from a results card over a boss's arena: no ground on show there, so the last
    // level's is let go first — memory stays flat — and the arena's scene works the pictures out)
    const host = ['Hoops', 'Wrestle'].map((k) => this.game.scene.getScene(k)).find((sc) => sc?.sys.isActive());
    if (level !== null && this.game.scene.isActive('Menu')) ground = scene.groundJobs?.(level) ?? [];
    else if (build && host) {
      const data = build();
      for (const k of this.game.textures.getTextureKeys())
        if ((k.startsWith('terrain-') && !k.startsWith(`terrain-${data.name}-`)) || (k.startsWith('tree-') && !k.startsWith(`tree-${data.name}-`))) this.game.textures.remove(k);
      ground = groundPaintJobs(host, data).map((job, i) => ({ name: `ground ${i}`, run: () => void job() }));
    }
    return loadArt([...gameArtJobs(scene, { heroes, level }), ...ground]);
  }

  private starting = false;

  private startGame(session: Session, checkpoint = -1) {
    if (this.starting) return;
    this.starting = true;
    sfx.select();
    // the level's song: fetched and decoded while the loading card is up (not on the start screen
    // for every Part looked at: that was work and memory spent while browsing)
    preloadLevelMusic(this.level);
    void this.gameArt(
      session.players.map((p) => p.characterId),
      this.level,
    ).then(() => {
      this.starting = false;
      this.launchGame(session, checkpoint);
    });
  }

  private launchGame(session: Session, checkpoint: number) {
    stopMusic(); // (the start screen's song)
    this.introEl?.remove();
    this.introEl = null;
    this.session = session;
    this.setScreen(null);
    this.game.scene.stop('Menu');
    this.game.scene.stop('Hoops');
    this.game.scene.stop('Wrestle');
    this.game.scene.stop('Game');
    this.game.scene.start('Game', { session, checkpoint, level: this.level } satisfies GameData);
  }

  // ─────────────────────────────────────────── HUD ──

  private showHud() {
    this.hud.hidden = false;
    this.hud.classList.remove('bare');
    const hero = characterById(this.session.players[0]?.characterId ?? 'puffy');
    const cv = this.hud.querySelector('canvas')!;
    // the hero's own standing animation (the same two frames as in the game, at the
    // same pace), plus the odd blink or glance
    this.hudFace?.stop();
    clearInterval(this.hudIdle);
    const session = this.session;
    let pose: 'idle0' | 'idle1' = 'idle0';
    let face: Face | undefined;
    // (the HUD's little portrait: the sunglasses if they're on, and under the sea the dive gear — no
    // party hat or skateboard up there)
    const glasses = wardrobe.wearKey.split(',').filter((w) => w === 'frogskins');
    const wear = (swimLevel((this.gameScene as { levelId?: number } | null)?.levelId) ? [...glasses, 'scuba'] : glasses).join(',');
    const draw = () => drawPortrait(cv, hero, pose, face, 'idle0', wear);
    draw();
    const alive = () => !this.hud.hidden && this.session === session;
    this.hudFace = new FaceLife((f) => ((face = f), draw()), alive, { mouth: false, calm: true });
    this.hudIdle = window.setInterval(() => {
      if (!alive()) return clearInterval(this.hudIdle);
      pose = pose === 'idle0' ? 'idle1' : 'idle0';
      draw();
    }, 625);
    this.touch.setFire(true);
    if (usingTouch()) this.touch.show();
    else this.touch.hide();
  }

  private renderHud(s: HudState) {
    this.hud.querySelector('.hud-aura span')!.textContent = String(s.aura);
    this.hud.querySelector('.hud-aura')!.classList.toggle('has', s.aura > 0);
    const rb = this.hud.querySelector('.hud-rb span')!;
    if ((rb as HTMLElement).dataset.n !== String(s.rootbeer)) {
      (rb as HTMLElement).dataset.n = String(s.rootbeer);
      rb.textContent = shortCount(s.rootbeer);
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
    this.game.scene.pause(this.gameScene.scene.key);
    this.touch.reset();
    const el = h(`<div class="screen modal">
      <div class="panel">
        <h2>Paused</h2>
        <button class="btn btn-go" data-act="resume">Resume</button>
        <button class="btn" data-act="hero">Home screen</button>
        <button class="btn btn-alt" data-act="sound">${isMuted() ? 'Sound: off' : 'Sound: on'}</button>
        ${usingTouch() ? '' : `<h3 class="ctl-title">Controls</h3>${controlsHtml(false, (this.gameScene as { level?: { data: { water?: number } } } | null)?.level?.data.water !== undefined)}`}
      </div>
    </div>`);
    const act = (a: string, fn: () => void) => el.querySelector(`[data-act=${a}]`)!.addEventListener('click', fn);
    act('resume', () => this.resume());
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
    if (this.gameScene) this.game.scene.resume(this.gameScene.scene.key);
  }

  private quitToStart() {
    this.bossIntro = false;
    this.introEl?.remove();
    this.introEl = null;
    this.setScreen(null);
    stopMusic();
    this.game.scene.stop('Hoops');
    this.game.scene.stop('Wrestle');
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
          <p class="eyebrow">${levelName(this.level)}</p>
          <h2>Out of lives!</h2>
          <p class="gameover-note">${g.name} fainted one too many times. Start the level again with 3 spare lives.</p>
          <div class="row">
            <button class="btn btn-go" data-act="again">Try again</button>
            <button class="btn btn-alt" data-act="hero">Pick player</button>
          </div>
        </div>
      </div>
    </div>`);
    // the hero as on the pick-a-player screen: standing about, blinking, glancing, breathing
    this.liveHero(el.querySelector('canvas')!, characterById(g.charId), () => this.screen === el);
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
    if (r.practice) return this.showBossResults(r);
    this.touch.hide();
    // beating a level unlocks picking where to start
    progress.markBeaten(r.level ?? 1);
    // signed in: the account gets this level's progress, quietly in the background
    account.save();
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
          <p class="eyebrow">${levelName(r.level ?? this.level)}</p>
          <h2>Level clear!</h2>
          <dl class="stat-list">
            <dt>Lives left <i class="life-ico"></i></dt><dd>${r.lives}</dd>
            <dt>Aura carried <i class="aura-ico"></i></dt><dd>${r.aura}</dd>
            <dt>Root beer found <i class="rb-ico"></i></dt><dd>${r.rootbeerTotal}</dd>
            <dt>${levelInfo(r.level ?? this.level).world === 'World 3' ? 'Bad guy fish popped' : levelInfo(r.level ?? this.level).world === 'World 2' ? 'Plops splatted' : 'Puffballs popped'}</dt><dd>${r.popped}</dd>
            <dt>${levelInfo(r.level ?? this.level).world === 'World 2' ? 'Giant Plops beaten' : 'Giants beaten'}</dt><dd>${r.giants}</dd>
            <dt>Time</dt><dd>${mins}:${secs}</dd>
          </dl>
          <div class="row">
            ${next ? `<button class="btn btn-next" data-act="next">Next: ${next.button ?? next.part} ▶</button>` : ''}
            <button class="btn btn-alt" data-act="again">Play again</button>
            ${next ? '' : '<button class="btn btn-go" data-act="home">Home screen</button>'}
          </div>
        </div>
      </div>
    </div>`);
    this.liveHero(el.querySelector('canvas')!, characterById(r.charId), () => this.screen === el, r.level ?? this.level);
    // the default (and the big button) is on to the next level, when there is one
    const goNext = () => {
      if (!next) return this.quitToStart();
      this.level = next.id;
      this.startGame(this.session);
    };
    el.querySelector('[data-act=next]')?.addEventListener('click', goNext);
    el.querySelector('[data-act=again]')!.addEventListener('click', () => {
      this.level = r.level ?? this.level;
      this.startGame(this.session);
    });
    // (the last level there is: back to the start screen)
    el.querySelector('[data-act=home]')?.addEventListener('click', () => this.quitToStart());
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
