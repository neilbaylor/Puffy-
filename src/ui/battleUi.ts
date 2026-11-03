/**
 * The online battle screens: the lobby (who's in, your name and hero), the countdown
 * (it starts by itself once two are in; the screen shakes near 0, then slides away to
 * unveil the arena), the scoreboard while you play, and the results.
 */
import type Phaser from 'phaser';
import { sfx } from '../core/sfx';
import { fadeOutMusic, playBattleMusic, playLevelMusic, preloadBattleMusic } from '../core/music';
import { MATCH_SECS } from '../shared/battle/sim';
import { CHARACTERS, characterById } from '../data/characters';
import { drawPortrait } from '../gfx/draw';
import { FaceClock, faceFromKey } from '../gfx/face';
import { recolorForSlot } from '../gfx/recolor';
import { BattleNet, battleUrl, type NetStatus } from '../net/battleNet';
import type { BattleHud } from '../scenes/BattleScene';
import { MAX_BATTLERS, SLOT_COLORS, SLOT_NAMES, type RoomState } from '../shared/battle/protocol';

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

function storedName() {
  try {
    return localStorage.getItem('puffy.name') ?? '';
  } catch {
    return '';
  }
}

/** A hero portrait in a player slot's colour (in a pose, with a face). */
function slotPortrait(target: HTMLCanvasElement, hero: string, slot: number, pose: 'idle0' | 'idle1' = 'idle0', faceKey: string | null = null) {
  const tmp = document.createElement('canvas');
  tmp.width = target.width;
  tmp.height = target.height;
  drawPortrait(tmp, characterById(hero), pose, faceKey ? faceFromKey(faceKey) : undefined, 'idle0');
  const out = recolorForSlot(tmp, slot);
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

  /** Join the room and show the lobby. */
  open() {
    const url = battleUrl();
    const name = storedName();
    this.lastPhase = '';
    this.showLobby();
    if (!url) return this.status('offline', 'Online battles work on the game’s web address (not a saved copy).');
    this.status('connecting');
    playLevelMusic(this.host.level());
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
    this.open();
  }

  // ── lobby ──

  private showLobby() {
    this.stopBattle();
    const el = h(`<div class="screen battle-lobby">
      <button class="icon-btn bl-back" aria-label="Back">‹</button>
      <header class="bl-head">
        <h1 class="bl-title">Battle!</h1>
        <p class="bl-sub">Up to ${MAX_BATTLERS} friends</p>
      </header>
      <div class="bl-preview" hidden><b class="bl-live">● LIVE</b></div>
      <div class="bl-slots"></div>
      <div class="bl-me">
        <label class="bl-namecard">
          <span class="bl-namelabel">Your name</span>
          <span class="bl-namebox">
            <input maxlength="12" autocomplete="off" spellcheck="false" placeholder="Type your name">
          </span>
        </label>
        <div class="bl-heroes" role="radiogroup" aria-label="Your hero">${CHARACTERS.map((c) => `<button class="bl-hero" data-hero="${c.id}">${c.name}</button>`).join('')}</div>
      </div>
      <div class="bl-foot">
        <div class="bl-clock" hidden>
          <span class="bl-clock-label">Battle starts in</span>
          <span class="bl-clock-face"><b>15</b></span>
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
    const input = el.querySelector<HTMLInputElement>('.bl-namebox input')!;
    input.value = storedName();
    input.addEventListener('change', () => {
      const v = input.value.trim().slice(0, 12);
      try {
        localStorage.setItem('puffy.name', v);
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
    for (let slot = 0; slot < MAX_BATTLERS; slot++) {
      const p = r?.players.find((q) => q.slot === slot);
      const me = p && p.id === this.net?.myId;
      const el = h(`<div class="bl-slot${p ? '' : ' empty'}${me ? ' me' : ''}${p && !p.connected ? ' away' : ''}" style="--sc:${SLOT_COLORS[slot]}">
        ${p ? '<canvas width="120" height="120"></canvas>' : '<div class="bl-wait">?</div>'}
        <b>${p ? esc(p.name) : 'Waiting…'}</b>
        <small>${p ? `${me ? 'You · ' : ''}${characterById(p.hero).name}` : SLOT_NAMES[slot]}</small>
      </div>`);
      if (p) this.liveSlot(el.querySelector('canvas')!, p.hero, slot);
      box.appendChild(el);
    }
  }

  /** The heroes in the squares stand there breathing, blinking and glancing about, like on the start screen. */
  private liveSlot(cv: HTMLCanvasElement, hero: string, slot: number) {
    const face = new FaceClock();
    let pose: 'idle0' | 'idle1' = 'idle0';
    let shown = '';
    let t = Math.random() * 0.6;
    const draw = () => {
      const k = `${pose}|${face.key}`;
      if (k === shown) return;
      shown = k;
      slotPortrait(cv, hero, slot, pose, face.key);
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
      if (this.inBattle) playLevelMusic(this.host.level());
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
    }
    // the battle song, cued so it ends exactly when the clock hits 0
    this.lastTimeLeft = MATCH_SECS;
    playBattleMusic(() => this.lastTimeLeft);
    this.host.touch(true);
    this.hud?.remove();
    this.hud = h(`<div class="bhud">
      <div class="bhud-time">2:00</div>
      <div class="bhud-bombs" hidden></div>
      <div class="bhud-chips"></div>
      <button class="icon-btn bhud-leave" aria-label="Leave the battle">✕</button>
    </div>`);
    this.hud.querySelector('.bhud-leave')!.addEventListener('click', () => this.leave());
    this.host.root.appendChild(this.hud);
    sfx.whistle();
  }

  private stopBattle() {
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
    bombs.hidden = s.bombs <= 0;
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
    const ranked = r.players.filter((p) => p.playing).sort((a, b) => b.kos - a.kos || a.deaths - b.deaths);
    const winner = r.players.find((p) => p.id === r.winner);
    const iWon = !!winner && winner.id === this.net?.myId;
    const el = h(`<div class="screen modal">
      <div class="panel battle-results">
        <p class="eyebrow">Battle over</p>
        <h2>${winner ? (iWon ? 'You win!' : `${esc(winner.name)} wins!`) : 'It’s a draw!'}</h2>
        ${winner ? `<canvas class="br-winner" width="160" height="160" style="--sc:${SLOT_COLORS[winner.slot]}"></canvas>` : ''}
        <ol class="br-list">${ranked
          .map((p) => `<li style="--sc:${SLOT_COLORS[p.slot]}"><i></i><span>${esc(p.name)}${p.id === this.net?.myId ? ' (you)' : ''}</span><b>${p.kos} KO${p.kos === 1 ? '' : 's'}</b></li>`)
          .join('')}</ol>
        <p class="br-next">Back to the lobby in a moment…</p>
        <div class="row"><button class="btn btn-alt" data-act="leave">Leave</button></div>
      </div>
    </div>`);
    if (winner) slotPortrait(el.querySelector<HTMLCanvasElement>('.br-winner')!, winner.hero, winner.slot);
    el.querySelector('[data-act=leave]')!.addEventListener('click', () => this.leave());
    this.host.setScreen(el);
    if (iWon) sfx.cheer();
  }
}
