import Phaser from 'phaser';
import { MIN_VIEW_W, TILE, VIEW_H } from '../config';
import { bgKey, ensureLook, freeLooksExcept, lookJobs } from '../gfx/textures';
import { buildLevel1 } from '../level/level1';
import { LEVELS, levelInfo, levelName, progress } from '../level/levels';
import { Background } from '../world/Background';
import { LIGHT } from '../core/light';
import { Ambience } from '../world/Ambience';
import { LevelView, groundPaintJobs } from '../world/LevelView';
import { mixTint, themeClock, themeMix, themesFor } from '../world/theme';

/** Animated backdrop behind the start screen: a slow fly-over of Puff Ball Planet. */
/** Look textures already shown once (warmed on the graphics chip). */
const shown = new WeakSet<Phaser.Textures.Texture>();

/**
 * A Part's fly-over, kept (hidden) when you pick another Part, so going back to it is just
 * showing it again — not building it all over (that build was what made switching stutter).
 */
interface World {
  objs: Phaser.GameObjects.GameObject[];
  level: LevelView;
  bg: Background;
  amb: Ambience;
  x0: number;
  x: number;
  loopEnd: number;
  top: number | null;
  lastSurf: number;
  t: number;
}

export class MenuScene extends Phaser.Scene {
  private bg!: Background;
  private amb!: Ambience;
  private level!: LevelView;
  private x = 0;
  private x0 = 0;
  private t = 0;

  constructor() {
    super('Menu');
  }

  create(data?: { silent?: boolean; level?: number }) {
    // (a fresh start: anything kept from before went with the scene)
    this.worlds.clear();
    this.build(data?.level ?? 1);
    // picking a level on the start screen fades the fly-over to that level's world
    const onLevel = (id: number) => {
      // (light mode: the fly-over stays as it is when another Part is picked — only the title
      // and the buttons change; no new scenery to put up on an older device)
      if (LIGHT) return;
      if (id === this.levelId || !levelInfo(id).build) return;
      const cam = this.cameras.main;
      const c = [255, 248, 236];
      // (a quick dip to white: the new Part's fly-over is usually kept or built ahead, so behind
      // the white it only has to be shown)
      cam.fadeOut(240, c[0], c[1], c[2]);
      cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.stashWorld();
        this.build(id);
        cam.fadeIn(320, c[0], c[1], c[2]);
      });
    };
    this.game.events.on('menu-level', onLevel);
    const onInput = () => (this.lastInput = performance.now());
    window.addEventListener('pointerdown', onInput, true);
    window.addEventListener('keydown', onInput, true);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off('menu-level', onLevel);
      window.removeEventListener('pointerdown', onInput, true);
      window.removeEventListener('keydown', onInput, true);
    });
    // the boot already put the start screen up; coming back from a game shows it again
    if (!data?.silent) this.game.events.emit('menu');
  }

  private levelId = 0;
  /** The level shown before this one (kept drawn too: hopping back to it is instant). */
  private prevId = 0;
  /**
   * Little jobs done in quiet moments (nobody has touched anything for a bit): this
   * level's other looks, and the levels next to it in the Part picker (their looks and
   * opening scenery), so switching to them is instant.
   */
  private quiet: (() => void)[] = [];

  /** Ground pictures drawn ahead in quiet moments (a whole level's, for its fly-over). */
  private painted: string[] = [];
  private lastInput = 0;
  private lastQuiet = 0;

  /**
   * The levels next to this one in the Part picker (it shows every built level once you've beaten
   * one): one either side, plus the furthest one unlocked. Their opening scenery is small (only the fly-over's first view, ~6 MB)
   * and their looks ~6 MB each; this Part's whole ground is drawn too (for its own fly-over after
   * Play), so only the nearest are kept, to stay within what phones can hold.
   */
  private neighbours(id: number) {
    // (light mode: none — only the Part showing is kept, to save memory)
    if (progress.beaten < 1 || LIGHT) return [];
    // (every Part: there are only a few, and with one still look each on the start screen they're
    // light enough to keep; the nearest first)
    return LEVELS.filter((l) => l.build && l.id !== id)
      .sort((a, b) => Math.abs(a.id - id) - Math.abs(b.id - id))
      .map((l) => l.id);
  }

  /** Draw a level's opening scenery for the fly-over now (then throw the objects away; the pictures stay). */
  private prewarm(id: number) {
    const info = levelInfo(id);
    if (!info.build || this.worlds.has(id) || id === this.levelId) return;
    // its whole fly-over, built now and kept hidden: picking that Part only has to show it
    const w = this.createWorld(id, true);
    for (const o of w.objs) (o as unknown as { setVisible?: (v: boolean) => void }).setVisible?.(false);
    this.worlds.set(id, w);
    // its pictures shown once (invisibly), so they're really on the graphics chip: showing the
    // Part later doesn't stall on the first frame
    const keys = new Set<string>();
    for (const o of w.objs) {
      const t = (o as unknown as { texture?: Phaser.Textures.Texture }).texture;
      if (t && t.key !== '__DEFAULT' && t.key !== '__MISSING') keys.add(t.key);
    }
    this.warmOnGpu([...keys].map((k) => this.add.image(0, 0, k).setOrigin(0).setScrollFactor(0).setScale(0.05)));
  }

  /**
   * Pictures drawn ahead of time aren't really on the graphics chip until they're first shown
   * (phones and tablets finish the upload then, and that first frame stalls). So: show them
   * once, invisibly (nearly transparent, behind everything), then throw the objects away.
   */
  private warmOnGpu(objs: Phaser.GameObjects.GameObject[]) {
    for (const o of objs) {
      const a = o as unknown as { setAlpha?: (v: number) => void; setDepth?: (v: number) => void };
      a.setAlpha?.(0.003);
      a.setDepth?.(-1000);
    }
    let frames = 0;
    const done = () => {
      if (++frames < 2) return;
      this.events.off(Phaser.Scenes.Events.RENDER, done);
      for (const o of objs) o.destroy();
    };
    this.events.on(Phaser.Scenes.Events.RENDER, done);
  }

  /** A look drawn now (if it isn't already) and shown once invisibly, so its first real showing is instant. */
  private warmLook(id: string) {
    ensureLook(this, id);
    const keys = (['sky', 'far', 'clouds', 'hills', 'near'] as const).map((l) => bgKey(l, id)).filter((k) => this.textures.exists(k) && !shown.has(this.textures.get(k)));
    for (const k of keys) shown.add(this.textures.get(k));
    if (keys.length) this.warmOnGpu(keys.map((k) => this.add.image(0, 0, k).setOrigin(0).setScrollFactor(0).setScale(0.05)));
  }
  /** The fly-over loops over the first part of the level only (from x0 to here), so only that much is ever drawn. */
  private loopEnd = 0;
  private wrapping = false;

  /** Only what the fly-over's first view shows is drawn at once (the rest a chunk per frame, as it glides on). */
  private firstSpan(): [number, number] {
    const vw = this.scale.width / Math.min(this.scale.height / VIEW_H, this.scale.width / MIN_VIEW_W);
    return [100, vw + 150];
  }

  private startX(id: number) {
    return id === 2 ? 86 * 32 : id === 3 ? 0 : 0;
  }
  private top: number | null = null;
  /** The ground height the camera last followed (kept over a long gap). */
  private lastSurf = 0;

  /** The Parts' fly-overs kept hidden (see World). */
  private worlds = new Map<number, World>();

  /**
   * A level's ground not drawn yet, as steps (for the little loading card before it starts: the
   * level's opening fly-over sweeps all of it in a few seconds, and drawing pieces during it made
   * it stutter). The pictures are the same ones the fly-over would draw, kept for the level.
   */
  groundJobs(id: number): { name: string; run: () => void }[] {
    const info = levelInfo(id);
    if (!info.build) return [];
    // (another Part than the one showing, e.g. in light mode: a view of it just for its pictures)
    const jobs = this.levelId === id && this.level ? this.level.paintJobs() : groundPaintJobs(this, info.build());
    return jobs.map((job, i) => ({
      name: `ground ${i}`,
      run: () => {
        const key = job();
        if (!key) return;
        this.painted.push(key);
        this.warmOnGpu([this.add.image(0, 0, key).setOrigin(0).setScrollFactor(0).setScale(0.05)]);
      },
    }));
  }

  /** Put the showing Part's fly-over away (hidden, not thrown away). */
  private stashWorld() {
    const others = new Set([...this.worlds.values()].flatMap((w) => w.objs));
    const objs = this.children.list.filter((o) => !others.has(o));
    for (const o of objs) (o as unknown as { setVisible?: (v: boolean) => void }).setVisible?.(false);
    this.worlds.set(this.levelId, { objs, level: this.level, bg: this.bg, amb: this.amb, x0: this.x0, x: this.x, loopEnd: this.loopEnd, top: this.top, lastSurf: this.lastSurf, t: this.t });
  }

  /** A kept fly-over, if everything in it is still there (its pictures may have been freed meanwhile). */
  private keptWorld(id: number): World | null {
    const w = this.worlds.get(id);
    if (!w) return null;
    const ok = w.objs.every((o) => {
      if (!o.scene) return true; // (gone already: a temporary one)
      const t = (o as unknown as { texture?: Phaser.Textures.Texture }).texture;
      return !t || t.key === '__DEFAULT' || t.key === '__MISSING' || this.textures.exists(t.key);
    });
    if (ok) return w;
    this.dropWorld(id);
    return null;
  }

  private dropWorld(id: number) {
    const w = this.worlds.get(id);
    if (!w) return;
    for (const o of w.objs) if (o.scene) o.destroy();
    this.worlds.delete(id);
  }

  private build(id: number) {
    if (this.levelId !== id) this.prevId = this.levelId;
    this.levelId = id;
    // the fly-over starts somewhere that shows off the level (Part 2: up in the snow, not the
    // green foothills that look like Part 1); only the terrain near the camera is drawn now,
    // the rest a chunk per frame, so switching levels is quick
    this.x0 = this.startX(id);
    // the look showing right now is drawn straight away; the level's other looks and the
    // levels next to it in the picker are drawn in quiet moments. Only those stay in memory:
    // everything else is freed (not while a battle or a game is showing too: they have their own)
    const looks = themesFor(id);
    // the start screen shows each level in its first look, still (no drifting between looks here:
    // only one look per level to draw and keep); the game starts from that look too
    themeClock.t = 0;
    ensureLook(this, looks[0]);
    // (kept drawn: the Parts next to this one in the picker, and the one you just came from)
    const near = LIGHT ? [] : [...new Set([...this.neighbours(id), this.prevId])].filter((n) => n && n !== id && levelInfo(n).build);
    const data = (levelInfo(id).build ?? buildLevel1)();
    // a whole level's ground drawn ahead (for its fly-over) is only kept for the Part showing
    // (memory: two whole levels at once is too much for phones)
    // (kept fly-overs of Parts that aren't next to this one any more are let go)
    for (const wid of [...this.worlds.keys()]) if (wid !== id && !near.includes(wid)) this.dropWorld(wid);
    // (pictures a kept fly-over is showing are never freed here)
    const inUse = new Set<string>();
    for (const w of this.worlds.values())
      for (const o of w.objs) {
        const t = (o as unknown as { texture?: Phaser.Textures.Texture }).texture;
        if (o.scene && t) inUse.add(t.key);
      }
    const stale = this.painted.filter((k) => !k.startsWith(`terrain-${data.name}-`) && !inUse.has(k));
    for (const k of stale) if (this.textures.exists(k)) this.textures.remove(k);
    this.painted = this.painted.filter((k) => !stale.includes(k));
    if (!this.scene.isActive('Battle') && !this.scene.isActive('Game')) {
      freeLooksExcept(this, [...looks, ...near.map((n) => themesFor(n)[0])]);
      const keep = [data.name, ...near.map((n) => levelName(n))];
      for (const k of this.textures.getTextureKeys())
        if ((k.startsWith('terrain-') || k.startsWith('tree-')) && !inUse.has(k) && !keep.some((name) => k.startsWith(`terrain-${name}-`) || k.startsWith(`tree-${name}-`))) this.textures.remove(k);
    }
    // this Part's fly-over as it was left, if it's kept: just shown again
    const kept = this.keptWorld(id);
    if (kept) {
      this.worlds.delete(id);
      for (const o of kept.objs) if (o.scene && (o as unknown as { alpha?: number }).alpha !== 0.003) (o as unknown as { setVisible?: (v: boolean) => void }).setVisible?.(true);
      ({ level: this.level, bg: this.bg, amb: this.amb, x0: this.x0, x: this.x, loopEnd: this.loopEnd, top: this.top, lastSurf: this.lastSurf, t: this.t } = kept);
      this.bg.refreshClouds();
      this.wrapping = false;
      this.quiet = this.planQuiet(id, near, looks);
      return;
    }
    const w = this.createWorld(id);
    ({ level: this.level, bg: this.bg, amb: this.amb, x0: this.x0, x: this.x, loopEnd: this.loopEnd, top: this.top, lastSurf: this.lastSurf, t: this.t } = w);
    this.wrapping = false;
    this.quiet = this.planQuiet(id, near, looks);
  }

  /** A Part's fly-over: its scenery (only what its first view shows; the rest as it glides on), sky and wildlife. */
  private createWorld(id: number, ahead = false): World {
    const before = new Set(this.children.list);
    const data = (levelInfo(id).build ?? buildLevel1)();
    const x0 = this.startX(id);
    // (built ahead, out of sight: a little more of its ground, everything the fly-over would
    // otherwise draw in its first frames — LevelView draws what's within 400 px of the view at once)
    const span = this.firstSpan();
    const level = new LevelView(this, data, { lazyNear: x0, lazySpan: ahead ? [span[0] + 400, span[1] + 400] : span, ahead: false });
    // loop over about a fifth of the level (at least a good stretch); nothing past it is drawn
    const vw = this.scale.width / Math.min(this.scale.height / VIEW_H, this.scale.width / MIN_VIEW_W);
    const loopEnd = x0 + Math.max(level.widthPx * 0.2, 1800);
    level.trimPending(loopEnd + vw + 400);
    // (still clouds on the start screen: re-drawing their shapes is a constant job it doesn't need)
    const bg = new Background(this, level.heightPx - VIEW_H, true);
    // (in its own look from the start, even built ahead out of sight)
    const look0 = themesFor(id)[0];
    ensureLook(this, look0);
    const mix = themeMix(0, themesFor(id));
    bg.setTheme(mix);
    level.setTint(mixTint(mix));
    const amb = new Ambience(this, id, (x, y, max) => {
      for (let d = 0; d <= max; d += 8) if (level.isSolidAt(x, y + d)) return Math.floor((y + d) / TILE) * TILE;
      return null;
    });
    const objs = this.children.list.filter((o) => !before.has(o));
    return { objs, level, bg, amb, x0, x: x0, loopEnd, top: null, lastSurf: 0, t: 0 };
  }

  /** The quiet-moment jobs for a Part being shown (see `quiet`). */
  private planQuiet(_id: number, near: number[], looks: readonly string[]): (() => void)[] {
    const jobs: (() => void)[] = [
      // first, what a click on a neighbouring Part needs: its look and its opening scenery; then
      // the rest of this Part's ground (the level's fly-over sweeps all of it in a few seconds: drawn
      // here, it only has to be put up; if not, it's drawn a piece per frame as it goes)
      // (a Part whose fly-over is kept needs nothing)
      ...near
        .filter((n) => !this.worlds.has(n))
        .flatMap((n) => {
          const a = themesFor(n)[0];
          return [...lookJobs(this, a), () => this.warmLook(a), () => this.prewarm(n)];
        }),
    ];
    jobs.push(
      // (not in light mode: the level draws its ground as its fly-over reaches it)
      ...(LIGHT ? [] : this.level.paintJobs()).map((job) => () => {
        const key = job();
        if (key) this.painted.push(key);
        if (key) this.warmOnGpu([this.add.image(0, 0, key).setOrigin(0).setScrollFactor(0).setScale(0.05)]);
      }),
      // (this Part's other looks last: the game only drifts into them 20 seconds in)
      ...looks.slice(1).flatMap((l) => [...lookJobs(this, l), () => this.warmLook(l)]),
    );
    return jobs;
  }

  update(_t: number, deltaMs: number) {
    const dt = Math.min(deltaMs / 1000, 1 / 30);
    // one quiet-moment job at a time (straight away, not after the rest of the game's art:
    // a click on another Part is the very next thing people do)
    const now = performance.now();
    // (2.5 s after the last tap: someone tapping their way around the start screen — trying the
    // Parts — is never kept waiting behind one)
    if (this.quiet.length && now - this.lastInput > 2500 && now - this.lastQuiet > 250) {
      this.quiet.shift()!();
      this.lastQuiet = performance.now();
    }
    const cam = this.cameras.main;
    const zoom = Math.min(this.scale.height / VIEW_H, this.scale.width / MIN_VIEW_W);
    cam.setZoom(zoom);
    const vw = this.scale.width / zoom;
    const vh = this.scale.height / zoom;
    const maxX = Math.min(this.level.widthPx - vw, this.loopEnd);
    // a slow, slightly unsteady glide: speed breathes, the camera drifts up and down,
    // zooms gently in and out and banks a touch, like a camera drone
    this.t += dt;
    const t = this.t;
    this.x += dt * (36 + 10 * Math.sin(t * 0.21) + 5 * Math.sin(t * 0.53 + 1));
    // the end of the loop: a soft fade back to the start of it
    if (this.x > maxX && !this.wrapping) {
      this.wrapping = true;
      cam.fadeOut(450, 255, 248, 236);
      cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.x = this.x0;
        this.top = null;
        this.wrapping = false;
        cam.fadeIn(600, 255, 248, 236);
      });
    }
    // follow the terrain up and down (the mountain climbs), smoothly
    const H = this.level.heightPx;
    const cx = this.x + vw / 2;
    // (the ground across the view, leaving out holes and pits: there's no ground in those, and
    // counting them as the bottom of the level made the camera dive into every gap)
    const ys: number[] = [];
    for (let k = -0.4; k <= 0.4001; k += 0.1) {
      const y = this.level.surfaceY(cx + vw * k);
      if (y < H - 1) ys.push(y);
    }
    const surf = ys.length ? ys.reduce((a, y) => a + y, 0) / ys.length : this.lastSurf;
    this.lastSurf = surf;
    const want = Phaser.Math.Clamp(surf - vh * 0.7, Math.min(0, H - vh), H - vh);
    this.top = this.top === null || this.x < this.x0 + 1 ? want : this.top + (want - this.top) * (1 - Math.exp(-dt * 1.5));
    const top = this.top + 26 * Math.sin(t * 0.17 + 0.7) + 9 * Math.sin(t * 0.41);
    cam.setZoom(zoom * (1.04 + 0.04 * Math.sin(t * 0.13 + 2)));
    cam.setRotation(0.012 * Math.sin(t * 0.19) + 0.005 * Math.sin(t * 0.47 + 1.3));
    cam.centerOn(this.x + vw / 2, top + vh / 2);
    // (one still look per level here: see build)
    const m = themeMix(0, themesFor(this.levelId));
    this.bg.setTheme(m);
    this.level.setTint(mixTint(m));
    this.level.animate(this.time.now / 1000, this.x, this.x + vw);
    this.bg.update({ left: this.x - 50, top: top - 50, width: vw + 100, height: vh + 100 }, dt);
    this.amb.update({ left: this.x, top, width: vw, height: vh }, dt, []);
  }
}
