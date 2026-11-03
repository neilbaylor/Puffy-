/**
 * The online battle screens: the lobby (who's in, your name and hero, Start),
 * the 3-2-1 countdown, the scoreboard while you play, and the results.
 */
import type Phaser from 'phaser';
import { sfx } from '../core/sfx';
import { CHARACTERS, characterById } from '../data/characters';
import { drawPortrait } from '../gfx/draw';
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
}

const h = (html: string) => {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild as HTMLElement;
};
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function storedName() {
  try {
    return localStorage.getItem('puffy.name') ?? '';
  } catch {
    return '';
  }
}

/** A hero portrait in a player slot's colour. */
function slotPortrait(target: HTMLCanvasElement, hero: string, slot: number) {
  const tmp = document.createElement('canvas');
  tmp.width = target.width;
  tmp.height = target.height;
  drawPortrait(tmp, characterById(hero));
  const out = recolorForSlot(tmp, slot);
  const ctx = target.getContext('2d')!;
  ctx.clearRect(0, 0, target.width, target.height);
  ctx.drawImage(out, 0, 0);
}

/** For the 🎲 button next to your name. */
const FUN_NAMES = ['Captain Fluff', 'Sir Puffsalot', 'Nugget', 'Boom Boom', 'Rocket Rex', 'Sparky', 'Mr. Muffin', 'Dizzy', 'Turbo', 'Pickle', 'Noodle', 'Biscuit', 'Zoomer', 'Kaboom', 'Fuzzball', 'Puffinator'];

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
    this.net = new BattleNet(url, name, this.host.hero());
    this.net.onStatus = (s) => this.status(s);
    this.net.onRoom = (r) => this.room(r);
    this.host.game.events.on('battle-hud', this.onHud);
  }

  /** Leave the room and go back to the start screen. */
  leave() {
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
        connecting: 'Connecting to the battle server…',
        online: '',
        full: 'The arena is full (4 players). Try again in a bit!',
        offline: 'Lost the connection — reconnecting…',
      }[s];
    el.textContent = msg;
    el.hidden = !msg;
    this.lobby!.classList.toggle('waiting', s !== 'online');
    // a full arena: nothing to pick or start, just the message (and Back)
    this.lobby!.classList.toggle('full', s === 'full');
  }

  // ── lobby ──

  private showLobby() {
    this.stopBattle();
    const el = h(`<div class="screen battle-lobby">
      <button class="icon-btn bl-back" aria-label="Back">‹</button>
      <header class="bl-head">
        <h1 class="bl-title">Battle!</h1>
        <p class="bl-sub">Up to ${MAX_BATTLERS} friends — everyone opens Puffy and taps <b>Battle</b></p>
      </header>
      <div class="bl-preview" hidden><b class="bl-live">● LIVE</b></div>
      <div class="bl-slots"></div>
      <div class="bl-me">
        <label class="bl-namecard">
          <span class="bl-namelabel">Your name</span>
          <span class="bl-namebox">
            <i class="bl-pen" aria-hidden="true">✎</i>
            <input maxlength="12" autocomplete="off" spellcheck="false" placeholder="Type your name">
            <button type="button" class="bl-dice" aria-label="Pick a random name">🎲</button>
          </span>
        </label>
        <div class="bl-heroes" role="radiogroup" aria-label="Your hero">${CHARACTERS.map((c) => `<button class="bl-hero" data-hero="${c.id}">${c.name}</button>`).join('')}</div>
      </div>
      <div class="bl-foot">
        <p class="bl-timer" hidden></p>
        <button class="btn btn-big btn-go bl-start">Start battle</button>
        <p class="bl-status" hidden></p>
      </div>
      <div class="bl-count" hidden></div>
    </div>`);
    this.lobby = el;
    el.querySelector('.bl-back')!.addEventListener('click', () => this.leave());
    const input = el.querySelector<HTMLInputElement>('.bl-namebox input')!;
    input.value = storedName();
    el.querySelector('.bl-dice')!.addEventListener('click', (e) => {
      e.preventDefault();
      sfx.select();
      let n = input.value;
      while (n === input.value) n = FUN_NAMES[Math.floor(Math.random() * FUN_NAMES.length)];
      input.value = n;
      input.dispatchEvent(new Event('change'));
    });
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
    el.querySelector('.bl-start')!.addEventListener('click', () => {
      sfx.select();
      this.net?.start();
    });
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
      const el = h(`<div class="bl-slot${p ? '' : ' empty'}${me ? ' me' : ''}" style="--sc:${SLOT_COLORS[slot]}">
        ${p ? '<canvas width="120" height="120"></canvas>' : '<div class="bl-wait">?</div>'}
        <b>${p ? esc(p.name) : 'Waiting…'}</b>
        <small>${p ? `${me ? 'You · ' : ''}${characterById(p.hero).name}${p.connected ? '' : ' · reconnecting'}` : SLOT_NAMES[slot]}</small>
      </div>`);
      if (p) slotPortrait(el.querySelector('canvas')!, p.hero, slot);
      box.appendChild(el);
    }
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
      if (phaseChanged) this.showResults(r);
      return;
    }
    // lobby / countdown / watching someone else's match
    if (this.inBattle || !this.lobby || !this.lobby.isConnected) this.showLobby();
    const lobby = this.lobby!;
    // (your name card wears your colour)
    if (me) lobby.style.setProperty('--my', SLOT_COLORS[me.slot]);
    this.renderSlots(r);
    const connected = r.players.filter((p) => p.connected).length;
    const watching = r.phase === 'battle' && !playing;
    lobby.classList.toggle('watching', watching);
    lobby.querySelector<HTMLElement>('.bl-preview')!.hidden = !watching;
    this.watch(watching);
    const start = lobby.querySelector<HTMLButtonElement>('.bl-start')!;
    const timer = lobby.querySelector<HTMLElement>('.bl-timer')!;
    const sub = lobby.querySelector<HTMLElement>('.bl-sub')!;
    sub.innerHTML = watching
      ? 'A battle is on — you’ll join the <b>next</b> one'
      : connected <= 1
        ? 'Waiting for friends… it starts by itself once <b>2</b> are here'
        : `Up to ${MAX_BATTLERS} friends — everyone opens Puffy and taps <b>Battle</b>`;
    const counting = r.phase === 'countdown';
    start.disabled = !(r.phase === 'lobby' || (counting && r.timer > 3));
    start.textContent = watching ? 'Watching…' : r.phase === 'results' ? 'Back in a moment…' : counting ? 'Start now' : connected <= 1 ? 'Practice alone' : 'Start battle';
    timer.hidden = !counting || r.timer <= 3;
    if (counting) timer.innerHTML = `Battle starts in <b>${r.timer}</b>`;
    // the last three seconds: big numbers over everything
    const count = lobby.querySelector<HTMLElement>('.bl-count')!;
    count.hidden = !counting || r.timer > 3;
    if (counting && r.timer <= 3) {
      count.textContent = String(Math.max(1, r.timer));
      count.classList.remove('pop');
      void count.offsetWidth;
      count.classList.add('pop');
      sfx.select();
    }
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
    const g = this.host.game;
    g.scene.stop('Menu');
    g.scene.start('Battle', { net: this.net });
    this.host.setScreen(null);
    this.lobby = null;
    this.host.touch(true);
    this.hud?.remove();
    this.hud = h(`<div class="bhud">
      <div class="bhud-time">2:00</div>
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
    this.host.touch(false);
  }

  private renderHud(s: BattleHud) {
    if (!this.hud) return;
    const t = Math.ceil(s.timeLeft);
    const time = this.hud.querySelector<HTMLElement>('.bhud-time')!;
    time.textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
    time.classList.toggle('low', t <= 10);
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
