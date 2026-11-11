/**
 * The online battle screens: the lobby (who's in, your name and hero), the countdown
 * (it starts by itself once two are in; the screen shakes near 0, then slides away to
 * unveil the arena), the scoreboard while you play, and the results.
 */
import type Phaser from 'phaser';
import { account } from '../core/account';
import { isMuted, setMuted, sfx } from '../core/sfx';
import { fadeOutMusic, playBattleMusic, playMenuMusic, preloadBattleMusic, setMusicMuted } from '../core/music';
import { MATCH_SECS } from '../shared/battle/sim';
import { CHARACTERS, characterById } from '../data/characters';
import { drawHeroCard, drawPortrait } from '../gfx/draw';
import { FaceClock, faceFromKey } from '../gfx/face';
import { recolorForSlot } from '../gfx/recolor';
import { gearOf } from '../core/wardrobe';
import { gameArtJobs } from '../gfx/textures';
import { loadArt } from './artLoader';
import { BattleNet, battleUrl, type NetStatus } from '../net/battleNet';
import type { BattleHud } from '../scenes/BattleScene';
import { MAX_BATTLERS, START_NOW_SECS, SLOT_COLORS, SLOT_NAMES, type RoomState } from '../shared/battle/protocol';

export interface BattleHost {
  root: HTMLElement;
  game: Phaser.Game;
  setScreen(el: HTMLElement | null): void;
  /** Go back to the start screen. */
  home(): void;
  /** The hero picked on the start screen. */
  hero(): string;
  touch(show: boolean): void;
  /** Show the touch BOMB button with this many bombs (0 hides it). */
  bombs(n: number): void;
  /** The level picked on the start screen (the lobby plays its song). */
  level(): number;
}

const h = (html: string) => {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild as HTMLElement;
};
/** On a phone or tablet the bomb is a button; on a computer, a key. */
const usingTouchNow = () => matchMedia('(pointer: coarse)').matches;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** The room code you used last (everyone starts in "birchcliff" until they change it). */
const DEFAULT_ROOM = 'birchcliff';
function storedRoom() {
  try {
    return localStorage.getItem('puffy.room') || DEFAULT_ROOM;
  } catch {
    return DEFAULT_ROOM;
  }
}
const cleanRoom = (c: string) =>
  c
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 12) || DEFAULT_ROOM;

/** Where the battle name you typed is kept (signed in: per player, so it starts as your player's name). */
const nameKey = () => (account.user ? `puffy.name.${account.user.name}` : 'puffy.name');

/** Your battle name: the one you typed last; signed in, your player's name until you change it. */
function storedName() {
  try {
    return (localStorage.getItem(nameKey()) ?? account.user?.name ?? '').slice(0, 10);
  } catch {
    return (account.user?.name ?? '').slice(0, 10);
  }
}

/** A hero portrait in a player slot's colour (in a pose, with a face). */
function slotPortrait(target: HTMLCanvasElement, hero: string, slot: number, pose: 'idle0' | 'idle1' = 'idle0', faceKey: string | null = null, wear = '') {
  const tmp = document.createElement('canvas');
  tmp.width = target.width;
  tmp.height = target.height;
  const ch = characterById(hero);
  const face = faceKey ? faceFromKey(faceKey) : undefined;
  // (the hero in the slot's colour, then their sunglasses over it as they are)
  drawPortrait(tmp, ch, pose, face, 'idle0', wear, 'body');
  const out = recolorForSlot(tmp, slot);
  const ctx = target.getContext('2d')!;
  ctx.clearRect(0, 0, target.width, target.height);
  ctx.drawImage(out, 0, 0);
  if (gearOf(wear).eyes) {
    drawPortrait(tmp, ch, pose, face, 'idle0', wear, 'eyes');
    ctx.drawImage(tmp, 0, 0);
  }
}

/**
 * A hero standing in a lobby square, in the slot's colour: drawn like the start screen's cards
 * (feet on the bottom edge, each hero at their own size — Big Muscles the biggest).
 */
function slotCard(target: HTMLCanvasElement, hero: string, slot: number, pose: 'idle0' | 'idle1', faceKey: string | null, wear = '') {
  const tmp = document.createElement('canvas');
  tmp.width = target.width;
  tmp.height = target.height;
  const ch = characterById(hero);
  const face = faceKey ? faceFromKey(faceKey) : undefined;
  drawHeroCard(tmp, ch, pose, face, wear, 'body');
  const out = recolorForSlot(tmp, slot);
  if (gearOf(wear).eyes) drawHeroCard(out, ch, pose, face, wear, 'eyes');
  const ctx = target.getContext('2d')!;
  ctx.clearRect(0, 0, target.width, target.height);
  ctx.drawImage(out, 0, 0);
}

export class BattleUI {
  private net: BattleNet | null = null;
  private lobby: HTMLElement | null = null;
  private hud: HTMLElement | null = null;
  private inBattle = false;
  private lastPhase = '';
  private onHud = (s: BattleHud) => this.renderHud(s);

  constructor(private host: BattleHost) {}

  private code = DEFAULT_ROOM;

  /** Battle: first the room code (in a little window), then into that room's lobby. */
  open(code?: string) {
    if (!code) return this.askCode();
    // (the game's art may still be being drawn in the background: finish it first)
    if (!this.host.game.registry.get('ready')) {
      this.host.game.events.once('assets-ready', () => this.open(code));
      return;
    }
    // the battle's art (every hero — anyone can pick any — and the bad guys), drawn first if it isn't yet
    const jobs = gameArtJobs(this.host.game.scene.getScene('Menu'), { heroes: CHARACTERS.map((c) => c.id), level: 'battle' });
    if (jobs.length) {
      void loadArt(jobs).then(() => this.open(code));
      return;
    }
    this.code = code;
    const base = battleUrl();
    const url = base ? `${base}${base.includes('?') ? '&' : '?'}room=${encodeURIComponent(code)}` : null;
    const name = storedName();
    this.lastPhase = '';
    this.showLobby();
    if (!url) return this.status('offline', 'Online battles work on the game’s web address (not a saved copy).');
    this.status('connecting');
    playMenuMusic(); // (the start screen's song carries on in the lobby)
    preloadBattleMusic();
    this.net = new BattleNet(url, name, this.host.hero());
    this.net.onStatus = (s) => this.status(s);
    this.net.onRoom = (r) => this.room(r);
    window.addEventListener('pagehide', this.onPageHide);
    this.host.game.events.on('battle-hud', this.onHud);
  }

  /** Closing the page (not just switching apps) counts as leaving: free the square now. */
  private onPageHide = (e: PageTransitionEvent) => {
    if (!e.persisted) this.net?.close();
  };

  /** Tapping the room code in the lobby: leave this room and pick another (the room code window). */
  private changeRoom() {
    window.removeEventListener('pagehide', this.onPageHide);
    clearTimeout(this.retryT);
    this.stopClock();
    this.watch(false);
    this.net?.close();
    this.net = null;
    this.host.game.events.off('battle-hud', this.onHud);
    this.stopBattle();
    this.lobby = null;
    this.askCode();
  }

  /** Leave the room and go back to the start screen. */
  leave() {
    window.removeEventListener('pagehide', this.onPageHide);
    clearTimeout(this.retryT);
    this.stopClock();
    this.watch(false);
    this.net?.close();
    this.net = null;
    this.host.game.events.off('battle-hud', this.onHud);
    this.stopBattle();
    this.lobby = null;
    this.host.home();
  }

  private status(s: NetStatus, text?: string) {
    const el = this.lobby?.querySelector<HTMLElement>('.bl-status');
    if (!el) return;
    const msg =
      text ??
      {
        connecting: '',
        online: '',
        full: 'The arena is full (4 players). Try again in a bit!',
        offline: '',
      }[s];
    el.textContent = s === 'full' ? '' : msg;
    el.hidden = !msg || s === 'full';
    this.lobby!.classList.toggle('waiting', s !== 'online');
    // connecting (or lost it): a little loading card instead of the lobby
    const loading = (s === 'connecting' || s === 'offline') && !text;
    this.lobby!.classList.toggle('loading', loading);
    const lc = this.lobby!.querySelector<HTMLElement>('.bl-loading')!;
    lc.hidden = !loading;
    lc.querySelector('p')!.textContent = s === 'offline' ? 'Lost the connection — reconnecting…' : 'Connecting to the arena…';
    // a full arena: its own screen; knock again every few seconds until a spot opens
    this.lobby!.classList.toggle('full', s === 'full');
    this.lobby!.querySelector<HTMLElement>('.bl-fullcard')!.hidden = s !== 'full';
    clearTimeout(this.retryT);
    if (s === 'full') this.retryT = window.setTimeout(() => this.retry(), 5000);
  }

  private retryT = 0;
  private retry() {
    if (!this.lobby?.isConnected || !this.lobby.classList.contains('full')) return;
    this.net?.close();
    this.host.game.events.off('battle-hud', this.onHud);
    this.open(this.code);
  }

  /**
   * The room code window. Everyone who types the same code plays together: if
   * there's a room with that code you go in, otherwise it's made for you. The
   * code you use is remembered for next time.
   */
  private askCode() {
    const el = h(`<div class="screen modal battle-code">
      <div class="panel bc-panel">
        <p class="eyebrow">Battle with friends</p>
        <h2>Room code</h2>
        <label class="bl-namebox bc-box">
          <input maxlength="12" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Room code">
        </label>
        <div class="row">
          <button class="btn btn-alt" data-act="back">Back</button>
          <button class="btn btn-go" data-act="go">Let’s go!</button>
        </div>
      </div>
    </div>`);
    const input = el.querySelector<HTMLInputElement>('input')!;
    input.value = storedRoom();
    // codes aren't case sensitive: shown in lower case as you type; no code, no going
    const goBtn = el.querySelector<HTMLButtonElement>('[data-act=go]')!;
    const sync = () => {
      const v = input.value.toLowerCase();
      if (v !== input.value) input.value = v;
      goBtn.disabled = !/[a-z0-9]/.test(v);
    };
    input.addEventListener('input', sync);
    const go = () => {
      if (goBtn.disabled) return;
      const code = cleanRoom(input.value);
      try {
        localStorage.setItem('puffy.room', code);
      } catch {
        /* private mode */
      }
      sfx.select();
      this.open(code);
    };
    input.addEventListener('keydown', (e) => {
      e.stopPropagation(); // typing isn't playing
      if (e.key === 'Enter') go();
    });
    goBtn.addEventListener('click', go);
    sync();
    el.querySelector('[data-act=back]')!.addEventListener('click', () => {
      sfx.back();
      this.host.home();
    });
    this.host.setScreen(el);
    playMenuMusic();
  }



  // ── lobby ──

  private showLobby() {
    this.stopBattle();
    const el = h(`<div class="screen battle-lobby">
      <button class="icon-btn bl-back" aria-label="Back">‹</button>
      <button class="bl-roomtag" aria-label="Room code (change room)">Room <b>${esc(this.code)}</b></button>
      <header class="bl-head">
        <h1 class="bl-title" aria-label="Battle!">${[...'Battle!'].map((ch, i) => `<span style="--i:${i}">${ch}</span>`).join('')}</h1>
        <p class="bl-sub">Up to ${MAX_BATTLERS} friends</p>
      </header>
      <div class="bl-preview" hidden><b class="bl-live">● LIVE</b></div>
      <div class="bl-slots"></div>
      <div class="bl-me">
        <label class="bl-namecard">
          <span class="bl-namelabel">Your name</span>
          <span class="bl-namebox">
            <input maxlength="10" autocomplete="off" spellcheck="false" placeholder="Type your name">
          </span>
        </label>
        <div class="bl-heroes" role="radiogroup" aria-label="Your hero">${CHARACTERS.map((c) => `<button class="bl-hero" data-hero="${c.id}">${c.name}</button>`).join('')}</div>
      </div>
      <div class="bl-foot">
        <div class="bl-clock" hidden>
          <span class="bl-clock-label">Battle starts in</span>
          <span class="bl-clock-face"><b>15</b></span>
          <button class="btn btn-go bl-startnow" data-act="startnow">Start now</button>
        </div>
        <p class="bl-waitmsg" hidden>Waiting for players<i>.</i><i>.</i><i>.</i></p>
        <p class="bl-status" hidden></p>
      </div>
      <div class="bl-loading" hidden>
        <div class="bl-fulldots">${SLOT_COLORS.map((c) => `<i style="--sc:${c}"></i>`).join('')}</div>
        <p>Connecting to the arena…</p>
      </div>
      <div class="bl-fullcard" hidden>
        <div class="bl-fulldots">${SLOT_COLORS.map((c) => `<i style="--sc:${c}"></i>`).join('')}</div>
        <h2>The arena is full</h2>
        <p>${MAX_BATTLERS} friends are battling right now.<br>You’ll get in as soon as a spot opens!</p>
      </div>
    </div>`);
    this.lobby = el;
    el.querySelector('.bl-back')!.addEventListener('click', () => this.leave());
    // (skip the wait: straight to the last few seconds, the rumble and the curtain)
    el.querySelector('[data-act=startnow]')!.addEventListener('click', (e) => {
      sfx.select();
      (e.currentTarget as HTMLElement).hidden = true;
      this.net?.start();
    });
    el.querySelector('.bl-roomtag')!.addEventListener('click', () => {
      sfx.select();
      this.changeRoom();
    });

    const input = el.querySelector<HTMLInputElement>('.bl-namebox input')!;
    // (signed in, it starts as your player's name; you can still change it for battles)
    input.value = storedName();
    input.addEventListener('change', () => {
      const v = input.value.trim().slice(0, 10);
      try {
        localStorage.setItem(nameKey(), v);
      } catch {
        /* private mode */
      }
      this.net?.setName(v);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') input.blur();
      e.stopPropagation(); // typing isn't playing
    });
    for (const b of el.querySelectorAll<HTMLButtonElement>('.bl-hero'))
      b.addEventListener('click', () => {
        sfx.select();
        this.net?.setHero(b.dataset.hero!);
        this.markHero(b.dataset.hero!);
      });
    this.markHero(this.host.hero());
    this.host.setScreen(el);
    this.renderSlots(this.net?.room ?? null);
  }

  private markHero(id: string) {
    this.lobby?.querySelectorAll<HTMLElement>('.bl-hero').forEach((b) => b.classList.toggle('picked', b.dataset.hero === id));
  }

  private renderSlots(r: RoomState | null) {
    const box = this.lobby?.querySelector('.bl-slots');
    if (!box) return;
    box.innerHTML = '';
    // after a battle, each square shows how its player did (and the winner's cup)
    const played = !!r && r.phase !== 'battle' && r.players.some((q) => q.kos > 0 || q.deaths > 0);
    for (let slot = 0; slot < MAX_BATTLERS; slot++) {
      const p = r?.players.find((q) => q.slot === slot);
      const me = p && p.id === this.net?.myId;
      const el = h(`<div class="bl-slot${p ? '' : ' empty'}${me ? ' me' : ''}${p && !p.connected ? ' away' : ''}" style="--sc:${SLOT_COLORS[slot]}">
        ${p ? '<canvas width="160" height="200"></canvas>' : '<div class="bl-wait">?</div>'}
        <b>${p ? esc(p.name) : 'Waiting…'}</b>
        <small>${p ? `${me ? 'You · ' : ''}${characterById(p.hero).name}` : SLOT_NAMES[slot]}</small>
        ${p && played && p.kos > 0 ? `<span class="bl-last${p.id === r?.winner ? ' won' : ''}" title="Last battle">${p.id === r?.winner ? '🏆 ' : ''}${p.kos} KO${p.kos === 1 ? '' : 's'}</span>` : ''}
      </div>`);
      if (p) this.liveSlot(el.querySelector('canvas')!, p.hero, slot, p.wear ?? '');
      box.appendChild(el);
    }
  }

  /** The heroes in the squares stand there breathing, blinking and glancing about, like on the start screen. */
  private liveSlot(cv: HTMLCanvasElement, hero: string, slot: number, wear = '') {
    const face = new FaceClock();
    let pose: 'idle0' | 'idle1' = 'idle0';
    let shown = '';
    let t = Math.random() * 0.6;
    const draw = () => {
      const k = `${pose}|${face.key}`;
      if (k === shown) return;
      shown = k;
      slotCard(cv, hero, slot, pose, face.key, wear);
    };
    draw();
    const iv = window.setInterval(() => {
      if (!cv.isConnected) return clearInterval(iv);
      face.tick(0.1);
      t += 0.1;
      if (t >= 0.625) {
        t -= 0.625;
        pose = pose === 'idle0' ? 'idle1' : 'idle0';
      }
      draw();
    }, 100);
  }

  // ── the room changed (someone joined, the match started or ended…) ──

  private room(r: RoomState) {
    const me = r.players.find((p) => p.id === this.net?.myId);
    const playing = !!me?.playing;
    const phaseChanged = r.phase !== this.lastPhase;
    this.lastPhase = r.phase;
    if (r.phase === 'battle' && playing) {
      if (!this.inBattle) this.startBattle();
      return;
    }
    if (r.phase === 'results' && this.inBattle) {
      if (phaseChanged) {
        fadeOutMusic(700);
        this.showResults(r);
      }
      return;
    }
    // lobby / countdown / watching someone else's match
    if (this.inBattle || !this.lobby || !this.lobby.isConnected) {
      if (this.inBattle) playMenuMusic();
      this.showLobby();
    }
    const lobby = this.lobby!;
    // (your name card wears your colour)
    const spectator = !!me && me.slot < 0;
    if (me && me.slot >= 0) lobby.style.setProperty('--my', SLOT_COLORS[me.slot]);
    this.renderSlots(r);
    const watching = r.phase === 'battle' && !playing;
    lobby.classList.toggle('watching', watching);
    lobby.querySelector<HTMLElement>('.bl-preview')!.hidden = !watching;
    this.watch(watching);
    const sub = lobby.querySelector<HTMLElement>('.bl-sub')!;
    sub.innerHTML = watching
      ? spectator
        ? 'The arena’s full — you’re watching'
        : 'A battle is on — you’ll join the <b>next</b> one'
      : r.phase === 'results'
        ? 'That battle’s over — the next one starts soon'
        : spectator
          ? 'The arena’s full — you’ll get the <b>next</b> free spot'
          : `Up to ${MAX_BATTLERS} friends`;
    const counting = r.phase === 'countdown';
    const players = r.players.filter((p) => p.connected && p.slot >= 0).length;
    lobby.querySelector<HTMLElement>('.bl-waitmsg')!.hidden = !(r.phase === 'lobby' && players <= 1);
    lobby.querySelector<HTMLElement>('.bl-clock')!.hidden = !counting;
    this.canStartNow = counting && !spectator;
    if (counting) this.runClock(r.timer, phaseChanged);
    else this.stopClock();
    // (the countdown stopped without a battle: drop the warmed-up arena)
    if (!counting && !watching && this.warmed) this.coolDown();
  }

  // ── the countdown clock: a ring that runs down, the screen shakes near 0 ──

  private clockEnd = 0;
  private clockTotal = 15;
  private clockRaf = 0;
  private lastSec = -1;
  /** Players (not people watching) can cut the countdown short. */
  private canStartNow = false;

  private runClock(secsLeft: number, fresh: boolean) {
    const end = performance.now() + secsLeft * 1000;
    // (the server sends whole seconds: only correct our own clock if it has drifted)
    if (fresh || !this.clockRaf || Math.abs(end - this.clockEnd) > 600) this.clockEnd = end;
    if (fresh || secsLeft > this.clockTotal) this.clockTotal = Math.max(secsLeft, 1);
    if (this.clockRaf) return;
    const tick = () => {
      const lobby = this.lobby;
      if (!lobby?.isConnected) return this.stopClock();
      const left = Math.max(0, (this.clockEnd - performance.now()) / 1000);
      const sec = Math.max(1, Math.ceil(left));
      const clock = lobby.querySelector<HTMLElement>('.bl-clock')!;
      const face = clock.querySelector<HTMLElement>('.bl-clock-face')!;
      face.style.setProperty('--p', String(Math.min(1, left / this.clockTotal)));
      clock.querySelector<HTMLElement>('.bl-startnow')!.hidden = !this.canStartNow || left <= START_NOW_SECS + 0.6;
      if (sec !== this.lastSec) {
        this.lastSec = sec;
        face.querySelector('b')!.textContent = String(sec);
        face.classList.remove('tick');
        void face.offsetWidth;
        face.classList.add('tick');
        clock.classList.toggle('hot', sec <= 3);
        if (sec <= 3) sfx.select();
      }
      // a few seconds before the start, get the arena ready (invisibly), so it starts without a hitch
      if (left < 6 && !this.warmed && !this.spectating) this.warmUp();
      // the last few seconds: a rumble that builds up to the start
      const k = Math.max(0, Math.min(1, (4 - left) / 4));
      const a = k * k * 7;
      lobby.style.transform = a > 0.2 ? `translate(${(Math.random() - 0.5) * a}px, ${(Math.random() - 0.5) * a}px)` : '';
      if (a > 0.2) this.host.game.scene.getScene('Menu')?.cameras?.main?.shake(80, 0.0012 + k * k * 0.006, true);
      this.clockRaf = requestAnimationFrame(tick);
    };
    this.clockRaf = requestAnimationFrame(tick);
  }

  /** Build the arena now (hidden), while the countdown runs. */
  private warmed = false;
  private warmUp() {
    const g = this.host.game;
    if (!this.net || g.scene.isActive('Battle')) return;
    this.warmed = true;
    g.scene.start('Battle', { net: this.net, spectate: true, warm: true });
  }
  private coolDown() {
    this.warmed = false;
    const g = this.host.game;
    if (!this.inBattle && !this.spectating && g.scene.isActive('Battle')) g.scene.stop('Battle');
  }

  private stopClock() {
    cancelAnimationFrame(this.clockRaf);
    this.clockRaf = 0;
    this.lastSec = -1;
    if (this.lobby) this.lobby.style.transform = '';
  }

  // ── watching a battle you're not in (a live window in the lobby) ──

  private spectating = false;
  private onResize = () => this.placePreview();

  private watch(on: boolean) {
    const g = this.host.game;
    if (on && !this.spectating && this.net) {
      this.spectating = true;
      g.scene.start('Battle', { net: this.net, spectate: true });
      window.addEventListener('resize', this.onResize);
      // (once the scene has started)
      requestAnimationFrame(() => requestAnimationFrame(() => this.placePreview()));
    } else if (!on && this.spectating) {
      this.spectating = false;
      window.removeEventListener('resize', this.onResize);
      if (!this.inBattle) g.scene.stop('Battle');
    }
  }

  private placePreview() {
    const box = this.lobby?.querySelector<HTMLElement>('.bl-preview');
    const sc = this.host.game.scene.getScene('Battle') as unknown as { setPreview?: (r: { x: number; y: number; w: number; h: number } | null) => void };
    if (!box || !this.spectating || !sc?.setPreview) return;
    const b = box.getBoundingClientRect();
    sc.setPreview({ x: b.left + 4, y: b.top + 4, w: b.width - 8, h: b.height - 8 });
  }

  // ── the match ──

  private startBattle() {
    if (!this.net) return;
    if (this.spectating) {
      this.spectating = false;
      window.removeEventListener('resize', this.onResize);
    }
    this.inBattle = true;
    this.stopClock();
    const g = this.host.game;
    const net = this.net;
    const old = this.lobby;
    this.lobby = null;
    this.warmed = false;
    let curtainUp = true;
    // the arena starts underneath (it was built during the countdown, so this is quick)
    g.scene.start('Battle', { net });
    if (old?.isConnected && g.scene.isActive('Menu')) {
      // the lobby, and the start screen behind it, slide up together like a curtain to unveil it:
      // the start screen keeps drawing on top, its camera moving up in step with the lobby
      g.scene.bringToTop('Menu');
      this.host.setScreen(null);
      const curtain = h(`<div class="bl-curtain"></div>`);
      curtain.appendChild(old);
      this.host.root.appendChild(curtain);
      const cam = g.scene.getScene('Menu').cameras.main;
      const D = 850;
      let t0 = 0;
      let frames = 0;
      const finish = () => {
        curtain.remove();
        // the controls and scoreboard come in once the arena's uncovered
        if (this.inBattle) {
          this.host.touch(true);
          if (this.hud) this.hud.style.visibility = '';
        }
        cam.setViewport(0, 0, g.scale.width, g.scale.height);
        g.scene.stop('Menu');
        g.scene.bringToTop('Battle');
      };
      const step = (now: number) => {
        if (!this.inBattle) return finish();
        // (two still frames first: the arena's first frame gets drawn behind the curtain)
        if (frames++ < 2) {
          t0 = now;
          return requestAnimationFrame(step);
        }
        const t = Math.min(1, (now - t0) / D);
        const p = t * t * (2.4 * t - 1.4); // a little dip, then away it goes
        const y = -p * 1.12;
        curtain.style.transform = `translateY(${y * 100}%)`;
        cam.setViewport(0, Math.round(y * g.scale.height), g.scale.width, g.scale.height);
        if (t < 1) requestAnimationFrame(step);
        else finish();
      };
      requestAnimationFrame(step);
    } else {
      g.scene.stop('Menu');
      this.host.setScreen(null);
      curtainUp = false;
    }
    // the battle song, cued so it ends exactly when the clock hits 0
    this.lastTimeLeft = MATCH_SECS;
    playBattleMusic(() => this.lastTimeLeft, MATCH_SECS);
    if (!curtainUp) this.host.touch(true);
    this.hud?.remove();
    this.hud = h(`<div class="bhud">
      <div class="bhud-time">2:00</div>
      <div class="bhud-bombs" hidden></div>
      <div class="bhud-chips"></div>
      <button class="icon-btn bhud-leave" aria-label="Pause"><svg class="pause-ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="5.6" y="4.5" width="4.8" height="15" rx="1.4"/><rect x="13.6" y="4.5" width="4.8" height="15" rx="1.4"/></svg></button>
      <div class="bhud-lost" hidden>
        <div class="panel">
          <h3>Lost the connection</h3>
          <p>Reconnecting to the arena…</p>
          <button class="btn btn-alt" data-act="lost-leave">Leave battle</button>
        </div>
      </div>
    </div>`);
    this.hud.querySelector('[data-act=lost-leave]')!.addEventListener('click', () => this.leave());
    // no news from the arena for a few seconds (the connection dropped, or the server restarted):
    // say so over the game (instead of a frozen picture), till it's back
    clearInterval(this.staleT);
    if (this.net) this.net.lastSnapAt = performance.now();
    this.staleT = window.setInterval(() => {
      const lost = this.hud?.querySelector<HTMLElement>('.bhud-lost');
      if (!lost || !this.net) return;
      const stale = performance.now() - this.net.lastSnapAt > 3000;
      if (lost.hidden === stale) {
        lost.hidden = !stale;
        this.host.touch(!stale);
      }
    }, 500);
    // (the usual pause button: a battle can't stop for everyone, so it's a menu over the game, which plays on)
    this.hud.querySelector('.bhud-leave')!.addEventListener('click', () => this.pauseMenu());
    if (curtainUp) this.hud.style.visibility = 'hidden';
    this.host.root.appendChild(this.hud);
    sfx.whistle();
  }

  /** The pause button in a battle: keep playing, sound, or leave (the battle goes on meanwhile). */
  private pauseMenu() {
    if (!this.inBattle) return;
    this.host.touch(false);
    const el = h(`<div class="screen modal">
      <div class="panel">
        <h2>Paused</h2>
        <p class="bp-note">The battle keeps going!</p>
        <button class="btn btn-go" data-act="resume">Keep playing</button>
        <button class="btn btn-alt" data-act="sound">${isMuted() ? 'Sound: off' : 'Sound: on'}</button>
        <button class="btn" data-act="leave">Leave battle</button>
      </div>
    </div>`);
    const close = () => {
      window.removeEventListener('keydown', onKey);
      if (!this.inBattle) return;
      this.host.setScreen(null);
      this.host.touch(true);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape' || e.code === 'KeyP') close();
    };
    el.querySelector('[data-act=resume]')!.addEventListener('click', close);
    el.querySelector('[data-act=sound]')!.addEventListener('click', () => {
      setMuted(!isMuted());
      setMusicMuted(isMuted());
      el.querySelector('[data-act=sound]')!.textContent = isMuted() ? 'Sound: off' : 'Sound: on';
    });
    el.querySelector('[data-act=leave]')!.addEventListener('click', () => {
      window.removeEventListener('keydown', onKey);
      this.leave();
    });
    this.host.setScreen(el);
    setTimeout(() => window.addEventListener('keydown', onKey), 0);
  }

  private staleT = 0;

  private stopBattle() {
    clearInterval(this.staleT);
    if (!this.inBattle) return;
    this.inBattle = false;
    const g = this.host.game;
    g.scene.stop('Battle');
    // the start screen's fly-over behind the lobby again
    if (!g.scene.isActive('Menu')) g.scene.start('Menu', { silent: true });
    this.hud?.remove();
    this.hud = null;
    this.host.bombs(0);
    this.host.touch(false);
  }

  private lastTimeLeft = MATCH_SECS;
  private renderHud(s: BattleHud) {
    this.lastTimeLeft = s.timeLeft;
    if (!this.hud) return;
    const t = Math.ceil(s.timeLeft);
    const time = this.hud.querySelector<HTMLElement>('.bhud-time')!;
    time.textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
    time.classList.toggle('low', t <= 10);
    // bombs you're carrying: a counter (with the key to press on a keyboard), and the touch button
    const bombs = this.hud.querySelector<HTMLElement>('.bhud-bombs')!;
    bombs.hidden = s.bombs <= 0 || usingTouchNow();
    const bt = `💣 ×${s.bombs}${usingTouchNow() ? '' : ' · B or Enter to throw'}`;
    if (s.bombs > 0 && bombs.textContent !== bt) bombs.textContent = bt;
    this.host.bombs(s.bombs);
    const names = new Map((this.net?.room?.players ?? []).map((p) => [p.id, p.name]));
    const chips = this.hud.querySelector('.bhud-chips')!;
    const html = [...s.players]
      .sort((a, b) => a.slot - b.slot)
      .map((p) => `<span class="bhud-chip${p.id === this.net?.myId ? ' me' : ''}${p.down ? ' down' : ''}" style="--sc:${SLOT_COLORS[p.slot]}"><i></i>${esc(names.get(p.id) ?? '')}<b>${p.kos}</b></span>`)
      .join('');
    if (chips.innerHTML !== html) chips.innerHTML = html;
  }

  private showResults(r: RoomState) {
    this.host.touch(false);
    this.hud?.remove();
    this.hud = null;
    const myId = this.net?.myId;
    const ranked = r.players.filter((p) => p.playing).sort((a, b) => b.kos - a.kos || a.deaths - b.deaths);
    const winner = r.players.find((p) => p.id === r.winner);
    const iWon = !!winner && winner.id === myId;
    const me = ranked.find((p) => p.id === myId);
    const myRank = me ? ranked.indexOf(me) + 1 : 0;
    // a tie on KOs went to whoever was knocked out least: say so
    const tieBroken = !!winner && ranked.filter((p) => p.kos === winner.kos).length > 1;
    // a draw: the ones level at the top share the stage
    const top = winner ? [winner] : ranked.filter((p) => ranked[0] && p.kos === ranked[0].kos && p.deaths === ranked[0].deaths).slice(0, 3);
    const nth = (n: number) => `${n}${n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th'}`;
    const kos = (n: number) => `${n} KO${n === 1 ? '' : 's'}`;
    const title = winner ? (iWon ? 'You win!' : `${esc(winner.name)} wins!`) : 'It’s a draw!';
    const sub = winner
      ? iWon
        ? tieBroken
          ? 'Level on KOs — you were knocked out the fewest times!'
          : `Most KOs in the arena: ${kos(winner.kos)}!`
        : me
          ? `You came ${nth(myRank)} with ${kos(me.kos)}${tieBroken ? ' · same KOs: fewest knock-outs wins' : ''}`
          : tieBroken
            ? 'Same KOs: knocked out the fewest times'
            : `${kos(winner.kos)}!`
      : 'Nobody could split you!';
    const confetti = iWon
      ? `<div class="br-confetti" aria-hidden="true">${Array.from({ length: 22 }, (_, i) => `<i style="--x:${(i * 37) % 100}%;--d:${(i % 7) * 0.13}s;--c:${['#ff5a5f', '#ffc533', '#4fc3f7', '#7ed957', '#c58cff', '#ff9acb'][i % 6]};--r:${(i * 53) % 360}deg"></i>`).join('')}</div>`
      : '';
    const el = h(`<div class="screen modal">
      <div class="panel battle-results${iWon ? ' won' : ''}${winner ? '' : ' draw'}">
        ${confetti}
        <div class="br-stage" style="--sc:${SLOT_COLORS[top[0]?.slot ?? 0]}">
          <div class="br-heroes${top.length > 1 ? ' many' : ''}">${top.map((p) => `<canvas class="br-winner" width="200" height="200" style="--sc:${SLOT_COLORS[p.slot]}"></canvas>`).join('')}</div>
          <span class="br-ribbon">${winner ? 'Winner' : 'Draw'}</span>
        </div>
        <div class="br-body">
          <h2>${title}</h2>
          <p class="br-sub">${sub}</p>
          <ol class="br-list">${ranked
            .map(
              (p, i) => `<li class="${p.id === myId ? 'me' : ''}" style="--sc:${SLOT_COLORS[p.slot]}">
                <em class="br-rank r${Math.min(i + 1, 4)}">${i + 1}</em>
                <canvas class="br-face" width="72" height="72"></canvas>
                <span class="br-name">${esc(p.name)}${p.id === myId ? '<u>You</u>' : ''}</span>
                <span class="br-out">${tieBroken ? `KO’d ${p.deaths}×` : ''}</span>
                <b>${p.kos}<small>KO${p.kos === 1 ? '' : 's'}</small></b>
              </li>`,
            )
            .join('')}</ol>
          <div class="br-foot">
            <span class="br-next">Next game starting soon</span>
            <button class="btn btn-alt" data-act="leave">Leave</button>
          </div>
        </div>
      </div>
    </div>`);
    el.querySelectorAll<HTMLCanvasElement>('.br-winner').forEach((cv, i) => slotPortrait(cv, top[i].hero, top[i].slot, 'idle0', null, top[i].wear ?? ''));
    el.querySelectorAll<HTMLCanvasElement>('.br-face').forEach((cv, i) => slotPortrait(cv, ranked[i].hero, ranked[i].slot, 'idle0', null, ranked[i].wear ?? ''));
    el.querySelector('[data-act=leave]')!.addEventListener('click', () => this.leave());
    this.host.setScreen(el);
    if (iWon) sfx.cheer();
  }
}
