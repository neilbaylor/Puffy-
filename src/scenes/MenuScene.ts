import Phaser from 'phaser';
import { preloadLevelMusic } from '../core/music';
import { MIN_VIEW_W, TILE, VIEW_H } from '../config';
import { bgKey, ensureLook, freeLooksExcept } from '../gfx/textures';
import { buildLevel1 } from '../level/level1';
import { LEVELS, latestLevel, levelInfo, levelName, progress } from '../level/levels';
import { Background } from '../world/Background';
import { Ambience } from '../world/Ambience';
import { LevelView } from '../world/LevelView';
import { mixTint, themeClock, themeMix, themesFor } from '../world/theme';

/** Animated backdrop behind the start screen: a slow fly-over of Puff Ball Planet. */
/** Look textures already shown once (warmed on the graphics chip). */
const shown = new WeakSet<Phaser.Textures.Texture>();

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
    this.build(data?.level ?? 1);
    // picking a level on the start screen fades the fly-over to that level's world
    const onLevel = (id: number) => {
      if (id === this.levelId || !levelInfo(id).build) return;
      const cam = this.cameras.main;
      const c = [255, 248, 236];
      // (the fade is long enough for the new title to swap in first — its letters animate on
      // their own — before the new level's scenery is drawn behind the white)
      cam.fadeOut(320, c[0], c[1], c[2]);
      cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.children.removeAll(true);
        this.build(id);
        cam.fadeIn(380, c[0], c[1], c[2]);
        // (the start screen's title pops its new letters in only now, once the new scenery has
        // been drawn the first time: doing both at once made the letters stutter)
        this.events.once(Phaser.Scenes.Events.RENDER, () => requestAnimationFrame(() => this.game.events.emit('menu-level-built', id)));
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

  /** The quiet-moment jobs still to do, taken off the list (the loading screen does them up front). */
  takeQuietJobs() {
    const jobs = this.quiet;
    this.quiet = [];
    return jobs;
  }
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
    if (progress.beaten < 1) return [];
    // (…and the furthest Part you've unlocked: it's the one most often picked, even from far away)
    const latest = latestLevel();
    return LEVELS.filter((l) => l.build && l.id !== id && (Math.abs(l.id - id) <= 1 || l.id === latest))
      .sort((a, b) => Math.abs(a.id - id) - Math.abs(b.id - id))
      .map((l) => l.id);
  }

  /** Draw a level's opening scenery for the fly-over now (then throw the objects away; the pictures stay). */
  private prewarm(id: number) {
    const info = levelInfo(id);
    if (!info.build) return;
    const before = new Set(this.children.list);
    new LevelView(this, info.build(), { lazyNear: this.startX(id), lazySpan: this.firstSpan() });
    this.warmOnGpu(this.children.list.filter((o) => !before.has(o)));
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
    const mix = themeMix(themeClock.t, looks);
    ensureLook(this, mix.a);
    if (mix.w > 0) ensureLook(this, mix.b);
    // (kept drawn: the Parts next to this one in the picker, and the one you just came from)
    const near = [...new Set([...this.neighbours(id), this.prevId])].filter((n) => n && n !== id && levelInfo(n).build);
    const data = (levelInfo(id).build ?? buildLevel1)();
    // a whole level's ground drawn ahead (for its fly-over) is only kept for the Part showing
    // (memory: two whole levels at once is too much for phones)
    const stale = this.painted.filter((k) => !k.startsWith(`terrain-${data.name}-`));
    for (const k of stale) if (this.textures.exists(k)) this.textures.remove(k);
    this.painted = this.painted.filter((k) => !stale.includes(k));
    if (!this.scene.isActive('Battle') && !this.scene.isActive('Game')) {
      freeLooksExcept(this, [...looks, ...near.flatMap((n) => themesFor(n))]);
      const keep = [data.name, ...near.map((n) => levelName(n))];
      for (const k of this.textures.getTextureKeys())
        if ((k.startsWith('terrain-') || k.startsWith('tree-')) && !keep.some((name) => k.startsWith(`terrain-${name}-`) || k.startsWith(`tree-${name}-`))) this.textures.remove(k);
    }
    this.level = new LevelView(this, data, { lazyNear: this.x0, lazySpan: this.firstSpan() });
    this.quiet = [
      // first, what a click on a neighbouring Part needs: the look it'd show right now and
      // its opening scenery; then this Part's song (so Play doesn't wait for it), then the rest
      // of this Part's ground (the level's fly-over sweeps all of it in a few seconds: drawn
      // here, it only has to be put up), then the other looks, which only show up later as
      // the colours drift
      ...near.flatMap((n) => [() => this.warmLook(themeMix(themeClock.t, themesFor(n)).a), () => this.prewarm(n)]),
      () => preloadLevelMusic(id),
      ...this.level.paintJobs().map((job) => () => {
        const key = job();
        if (key) this.painted.push(key);
        if (key) this.warmOnGpu([this.add.image(0, 0, key).setOrigin(0).setScrollFactor(0).setScale(0.05)]);
      }),
      ...looks.map((l) => () => this.warmLook(l)),
      ...near.flatMap((n) => themesFor(n).map((l) => () => this.warmLook(l))),
    ];
    // loop over about a fifth of the level (at least a good stretch); nothing past it is drawn
    const vw = this.scale.width / Math.min(this.scale.height / VIEW_H, this.scale.width / MIN_VIEW_W);
    this.loopEnd = this.x0 + Math.max(this.level.widthPx * 0.2, 1800);
    this.level.trimPending(this.loopEnd + vw + 400);
    this.wrapping = false;
    this.bg = new Background(this, this.level.heightPx - VIEW_H);
    this.amb = new Ambience(this, id, (x, y, max) => {
      for (let d = 0; d <= max; d += 8) if (this.level.isSolidAt(x, y + d)) return Math.floor((y + d) / TILE) * TILE;
      return null;
    });
    this.x = this.x0;
    this.top = null;
  }

  update(_t: number, deltaMs: number) {
    const dt = Math.min(deltaMs / 1000, 1 / 30);
    // one quiet-moment job at a time (straight away, not after the rest of the game's art:
    // a click on another Part is the very next thing people do)
    const now = performance.now();
    if (this.quiet.length && now - this.lastInput > 600 && now - this.lastQuiet > 200) {
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
    // the looks keep drifting behind the start screen too (same clock as the game)
    themeClock.t += dt;
    const m = themeMix(themeClock.t, themesFor(this.levelId));
    this.bg.setTheme(m);
    this.level.setTint(mixTint(m));
    this.level.animate(this.time.now / 1000, this.x, this.x + vw);
    this.bg.update({ left: this.x - 50, top: top - 50, width: vw + 100, height: vh + 100 }, dt);
    this.amb.update({ left: this.x, top, width: vw, height: vh }, dt, []);
  }
}
