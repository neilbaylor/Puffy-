import Phaser from 'phaser';
import { MAX_PLAYERS } from '../config';
import { CHARACTERS, characterById } from '../data/characters';
import { SLOT_COLORS, type PlayerSlot, type Session } from '../core/session';
import { isMuted, setMuted, sfx, unlockAudio } from '../core/sfx';
import { drawPortrait } from '../gfx/draw';
import { allSources, sourceById } from '../input/devices';
import { isKeyDown } from '../input/keyboard';
import { isTouchDevice } from '../input/touch';
import { emptyInput, type InputState } from '../input/types';
import type { GameScene, HudState, ResultState } from '../scenes/GameScene';
import { TouchControls } from './touchControls';

interface LobbySlot {
  inputId: string;
  char: number;
  ready: boolean;
}

const h = (html: string) => {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild as HTMLElement;
};

/**
 * All menus and the HUD are plain DOM on top of the canvas: crisp text at any
 * pixel density, easy safe-area handling for notched phones.
 */
export class UI {
  private root: HTMLElement;
  private screen: HTMLElement | null = null;
  private hud: HTMLElement;
  private touch: TouchControls;
  private rotate: HTMLElement;
  private lobby: (LobbySlot | null)[] = [null, null, null];
  private prevInputs = new Map<string, InputState>();
  private lobbyRaf = 0;
  private lastSession: Session = { players: [] };
  private gameScene: GameScene | null = null;

  constructor(private game: Phaser.Game) {
    this.root = document.getElementById('ui')!;
    this.hud = h(`<div class="hud" hidden>
        <div class="hud-players"></div>
        <div class="hud-center"><div class="hud-coins"><i class="coin-ico"></i><span>0</span></div><div class="hud-score">0</div></div>
        <div class="hud-right"><div class="hud-lives"><i class="life-ico"></i>×<span>5</span></div>
        <button class="icon-btn hud-pause" aria-label="Pause">❚❚</button></div>
      </div>`);
    this.root.appendChild(this.hud);
    this.hud.querySelector('.hud-pause')!.addEventListener('click', () => this.pause());
    this.touch = new TouchControls(this.root);
    this.rotate = h(`<div class="rotate" hidden><div class="rotate-phone"></div><p>Turn your phone sideways to play</p></div>`);
    this.root.appendChild(this.rotate);

    game.events.on('menu', () => this.showTitle());
    game.events.on('game-start', (s: GameScene) => {
      this.gameScene = s;
      cancelAnimationFrame(this.lobbyRaf);
      this.setScreen(null);
      this.showHud();
    });
    game.events.on('hud', (s: HudState) => this.renderHud(s));
    game.events.on('level-complete', (r: ResultState) => this.showResults(r));
    game.events.on('game-over', (r: ResultState) => this.showResults(r));

    window.addEventListener('keydown', (e) => {
      if ((e.code === 'Escape' || e.code === 'KeyP') && this.gameScene && !this.screen) this.pause();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.gameScene && !this.screen) this.pause();
    });
    const checkOrientation = () => {
      const portrait = window.innerHeight > window.innerWidth;
      this.rotate.hidden = !(portrait && isTouchDevice());
    };
    window.addEventListener('resize', checkOrientation);
    checkOrientation();
  }

  private setScreen(el: HTMLElement | null) {
    this.screen?.remove();
    this.screen = el;
    if (el) this.root.appendChild(el);
  }

  // ─────────────────────────────────────────── title ──

  showTitle() {
    this.gameScene = null;
    this.hud.hidden = true;
    this.touch.hide();
    cancelAnimationFrame(this.lobbyRaf);
    const el = h(`<div class="screen title">
      <div class="logo"><span>P</span><span>U</span><span>F</span><span>F</span><span>Y</span></div>
      <p class="sub">Run · Jump · Bazooka</p>
      <div class="title-heroes"></div>
      <button class="btn btn-big" data-act="play">PLAY</button>
      <p class="fine">Working title &amp; placeholder art</p>
    </div>`);
    const heroes = el.querySelector('.title-heroes')!;
    CHARACTERS.forEach((c, i) => {
      const cv = document.createElement('canvas');
      cv.width = 112;
      cv.height = 112;
      cv.style.animationDelay = `${i * 0.18}s`;
      drawPortrait(cv, c, 'idle0');
      heroes.appendChild(cv);
    });
    el.querySelector('[data-act=play]')!.addEventListener('click', () => {
      unlockAudio();
      sfx.select();
      this.goFullscreen();
      this.showSelect();
    });
    this.setScreen(el);
    const onKey = (e: KeyboardEvent) => {
      if (this.screen !== el) return window.removeEventListener('keydown', onKey);
      if (['Enter', 'Space', 'KeyW', 'ArrowUp'].includes(e.code)) {
        window.removeEventListener('keydown', onKey);
        unlockAudio();
        sfx.select();
        this.showSelect();
      }
    };
    window.addEventListener('keydown', onKey);
  }

  private goFullscreen() {
    if (!isTouchDevice()) return;
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

  // ─────────────────────────────────────────── character select / lobby ──

  showSelect() {
    this.lobby = [null, null, null];
    this.prevInputs.clear();
    // Mark everything currently held as "already pressed" so the key that opened this screen doesn't join.
    for (const s of allSources()) this.prevInputs.set(s.id, s.poll());
    if (isTouchDevice()) this.lobby[0] = { inputId: 'touch', char: 0, ready: false };

    const el = h(`<div class="screen select">
      <div class="select-head">
        <button class="icon-btn" data-act="back" aria-label="Back">‹</button>
        <h2>Choose your hero</h2>
        <span></span>
      </div>
      <div class="cards"></div>
      <div class="select-foot">
        <div class="slots"></div>
        <button class="btn" data-act="start" disabled>START</button>
      </div>
    </div>`);
    const cards = el.querySelector('.cards')!;
    CHARACTERS.forEach((c, i) => {
      const bar = (n: number) => `<i style="--n:${n}"></i>`;
      const card = h(`<button class="card" data-i="${i}" style="--c:${c.colors.main};--cs:${c.colors.shade}">
        <canvas width="160" height="160"></canvas>
        <div class="card-name">${c.name}</div>
        <div class="card-tag">${c.tagline}</div>
        <dl class="bars">
          <dt>Speed</dt><dd>${bar(c.bars.speed)}</dd>
          <dt>Jump</dt><dd>${bar(c.bars.jump)}</dd>
          <dt>Power</dt><dd>${bar(c.bars.power)}</dd>
        </dl>
        <div class="card-chips"></div>
      </button>`);
      drawPortrait(card.querySelector('canvas')!, c, 'idle0');
      card.addEventListener('click', () => this.pointerPick(i));
      cards.appendChild(card);
    });
    el.querySelector('[data-act=back]')!.addEventListener('click', () => {
      sfx.back();
      this.showTitle();
    });
    el.querySelector('[data-act=start]')!.addEventListener('click', () => this.tryStart());
    this.setScreen(el);
    this.renderLobby();

    const loop = () => {
      if (this.screen !== el) return;
      this.pollLobby();
      this.lobbyRaf = requestAnimationFrame(loop);
    };
    cancelAnimationFrame(this.lobbyRaf);
    this.lobbyRaf = requestAnimationFrame(loop);
  }

  private takenBy(char: number, except: number) {
    return this.lobby.some((s, i) => i !== except && s?.ready && s.char === char);
  }

  private pointerPick(char: number) {
    unlockAudio();
    // the pointer/touch player is whoever joined with touch, or keyboard A on desktop
    const id = isTouchDevice() ? 'touch' : 'kb1';
    let idx = this.lobby.findIndex((s) => s?.inputId === id);
    if (idx < 0) {
      idx = this.lobby.findIndex((s) => !s);
      if (idx < 0) return;
      this.lobby[idx] = { inputId: id, char, ready: false };
    }
    const slot = this.lobby[idx]!;
    if (this.takenBy(char, idx)) {
      sfx.back();
      return;
    }
    slot.char = char;
    slot.ready = true;
    sfx.select();
    this.renderLobby();
  }

  private pollLobby() {
    if (isKeyDown('Escape')) {
      this.showTitle();
      return;
    }
    let changed = false;
    for (const src of allSources()) {
      if (src.kind === 'touch') continue;
      const now = src.poll();
      const prev = this.prevInputs.get(src.id) ?? emptyInput();
      this.prevInputs.set(src.id, now);
      const pressed = (k: keyof InputState) => now[k] && !prev[k];
      const idx = this.lobby.findIndex((s) => s?.inputId === src.id);
      if (idx < 0) {
        if (pressed('jump') || pressed('fire')) {
          const free = this.lobby.findIndex((s) => !s);
          if (free >= 0) {
            let char = 0;
            while (this.takenBy(char, free) && char < CHARACTERS.length - 1) char++;
            this.lobby[free] = { inputId: src.id, char, ready: false };
            sfx.select();
            changed = true;
          }
        }
        continue;
      }
      const slot = this.lobby[idx]!;
      if (!slot.ready) {
        if (pressed('left') || pressed('right')) {
          slot.char = (slot.char + (pressed('right') ? 1 : -1) + CHARACTERS.length) % CHARACTERS.length;
          sfx.select();
          changed = true;
        }
        if (pressed('jump')) {
          if (this.takenBy(slot.char, idx)) sfx.back();
          else {
            slot.ready = true;
            sfx.select();
          }
          changed = true;
        }
        if (pressed('fire')) {
          this.lobby[idx] = null;
          sfx.back();
          changed = true;
        }
      } else {
        if (pressed('fire')) {
          slot.ready = false;
          sfx.back();
          changed = true;
        } else if (pressed('jump')) {
          this.tryStart();
          return;
        }
      }
    }
    if (isKeyDown('Enter')) {
      this.tryStart();
      return;
    }
    if (changed) this.renderLobby();
  }

  private canStart() {
    const joined = this.lobby.filter(Boolean) as LobbySlot[];
    return joined.length > 0 && joined.every((s) => s.ready);
  }

  private renderLobby() {
    const el = this.screen;
    if (!el) return;
    el.querySelectorAll<HTMLElement>('.card').forEach((card, i) => {
      const chips = card.querySelector('.card-chips')!;
      chips.innerHTML = '';
      let picked = false;
      this.lobby.forEach((s, si) => {
        if (!s || s.char !== i) return;
        picked ||= s.ready;
        chips.appendChild(
          h(`<span class="chip ${s.ready ? 'ready' : ''}" style="--pc:${SLOT_COLORS[si]}">P${si + 1}${s.ready ? ' ✓' : ''}</span>`),
        );
      });
      card.classList.toggle('picked', picked);
      card.classList.toggle('hover', !picked && this.lobby.some((s) => s && !s.ready && s.char === i));
    });
    const slots = el.querySelector('.slots')!;
    slots.innerHTML = '';
    for (let i = 0; i < MAX_PLAYERS; i++) {
      const s = this.lobby[i];
      const src = s ? sourceById(s.inputId) : undefined;
      slots.appendChild(
        h(`<div class="slot ${s ? 'on' : ''}" style="--pc:${SLOT_COLORS[i]}">
          <b>P${i + 1}</b>
          <span>${
            s
              ? `${src?.label ?? s.inputId} · ${s.ready ? characterById(CHARACTERS[s.char].id).name + ' ✓' : 'choosing…'}`
              : isTouchDevice()
                ? 'Phone co-op coming next'
                : 'Press jump to join'
          }</span>
        </div>`),
      );
    }
    const hint = this.lobby.find((s) => s && !s.ready);
    const start = el.querySelector<HTMLButtonElement>('[data-act=start]')!;
    start.disabled = !this.canStart();
    start.title = hint ? 'Everyone who joined must pick a hero' : '';
  }

  private tryStart() {
    if (!this.canStart()) return;
    cancelAnimationFrame(this.lobbyRaf);
    const players: PlayerSlot[] = [];
    this.lobby.forEach((s, i) => {
      if (s) players.push({ slot: i, characterId: CHARACTERS[s.char].id, inputId: s.inputId });
    });
    this.startGame({ players });
  }

  private startGame(session: Session) {
    unlockAudio();
    sfx.select();
    this.lastSession = session;
    this.setScreen(null);
    this.game.scene.stop('Menu');
    this.game.scene.stop('Game');
    this.game.scene.start('Game', session);
  }

  // ─────────────────────────────────────────── HUD ──

  private showHud() {
    this.hud.hidden = false;
    this.hud.querySelector('.hud-players')!.innerHTML = '';
    const usesTouch = this.lastSession.players.some((p) => p.inputId === 'touch');
    if (usesTouch) this.touch.show();
    else this.touch.hide();
  }

  private renderHud(s: HudState) {
    const wrap = this.hud.querySelector('.hud-players')!;
    if (wrap.children.length !== s.players.length) {
      wrap.innerHTML = '';
      for (const p of s.players) {
        const el = h(`<div class="hud-p" style="--pc:${p.color}"><canvas width="64" height="64"></canvas><div class="hud-hearts"></div></div>`);
        drawPortrait(el.querySelector('canvas')!, characterById(p.charId));
        wrap.appendChild(el);
      }
    }
    s.players.forEach((p, i) => {
      const el = wrap.children[i] as HTMLElement;
      el.classList.toggle('down', p.state !== 'alive' && p.state !== 'finished');
      const hearts = el.querySelector('.hud-hearts')!;
      let html = '';
      for (let k = 0; k < p.maxHp; k++) html += `<i class="${k < p.hp ? 'full' : ''}"></i>`;
      if (hearts.innerHTML !== html) hearts.innerHTML = html;
    });
    this.hud.querySelector('.hud-coins span')!.textContent = String(s.coins);
    this.hud.querySelector('.hud-score')!.textContent = String(s.score).padStart(6, '0');
    this.hud.querySelector('.hud-lives span')!.textContent = String(s.lives);
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
        <button class="btn btn-alt" data-act="sound">${isMuted() ? 'Sound: off' : 'Sound: on'}</button>
        <button class="btn btn-alt" data-act="quit">Quit to menu</button>
      </div>
    </div>`);
    const act = (a: string, fn: () => void) => el.querySelector(`[data-act=${a}]`)!.addEventListener('click', fn);
    act('resume', () => this.resume());
    act('restart', () => this.startGame(this.lastSession));
    act('sound', () => {
      setMuted(!isMuted());
      el.querySelector('[data-act=sound]')!.textContent = isMuted() ? 'Sound: off' : 'Sound: on';
    });
    act('quit', () => this.quitToMenu());
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

  private quitToMenu() {
    this.setScreen(null);
    this.game.scene.stop('Game');
    this.gameScene = null;
    this.hud.hidden = true;
    this.touch.hide();
    this.game.scene.start('Menu');
  }

  private showResults(r: ResultState) {
    this.touch.hide();
    const rows = r.players
      .map(
        (p) => `<tr style="--pc:${p.color}"><th><canvas width="48" height="48" data-char="${p.charId}"></canvas>P${p.slot + 1}</th>
        <td>${p.score}</td><td>${p.coins}</td><td>${p.kills}</td><td>${p.deaths}</td></tr>`,
      )
      .join('');
    const el = h(`<div class="screen modal">
      <div class="panel results ${r.won ? 'won' : 'lost'}">
        <h2>${r.won ? 'Level clear!' : 'Game over'}</h2>
        <div class="big-score">${r.score}</div>
        <table>
          <thead><tr><th></th><th>Score</th><th>Coins</th><th>KOs</th><th>Falls</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="row">
          <button class="btn" data-act="again">${r.won ? 'Play again' : 'Try again'}</button>
          <button class="btn btn-alt" data-act="menu">Menu</button>
        </div>
      </div>
    </div>`);
    el.querySelectorAll<HTMLCanvasElement>('canvas[data-char]').forEach((c) => drawPortrait(c, characterById(c.dataset.char!)));
    el.querySelector('[data-act=again]')!.addEventListener('click', () => this.startGame(this.lastSession));
    el.querySelector('[data-act=menu]')!.addEventListener('click', () => this.quitToMenu());
    this.setScreen(el);
    const onKey = (e: KeyboardEvent) => {
      if (this.screen !== el) return window.removeEventListener('keydown', onKey);
      if (e.code === 'Enter') {
        window.removeEventListener('keydown', onKey);
        this.startGame(this.lastSession);
      }
    };
    setTimeout(() => window.addEventListener('keydown', onKey), 400);
  }
}
