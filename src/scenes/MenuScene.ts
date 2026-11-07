import Phaser from 'phaser';
import { preloadLevelMusic } from '../core/music';
import { MIN_VIEW_W, TILE, VIEW_H } from '../config';
import { ensureLook, freeLooksExcept } from '../gfx/textures';
import { buildLevel1 } from '../level/level1';
import { LEVELS, levelInfo, levelName, progress } from '../level/levels';
import { Background } from '../world/Background';
import { Ambience } from '../world/Ambience';
import { LevelView } from '../world/LevelView';
import { mixTint, themeClock, themeMix, themesFor } from '../world/theme';

/** Animated backdrop behind the start screen: a slow fly-over of Puff Ball Planet. */
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
      cam.fadeOut(180, c[0], c[1], c[2]);
      cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.children.removeAll(true);
        this.build(id);
        cam.fadeIn(380, c[0], c[1], c[2]);
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

  private levelId = 1;
  /**
   * Little jobs done in quiet moments (nobody has touched anything for a bit): this
   * level's other looks, and the levels next to it in the Part picker (their looks and
   * opening scenery), so switching to them is instant.
   */
  private quiet: (() => void)[] = [];
  private lastInput = 0;
  private lastQuiet = 0;

  /** The levels next to this one in the Part picker (it shows every built level once you've beaten one). */
  private neighbours(id: number) {
    if (progress.beaten < 1) return [];
    return LEVELS.filter((l) => l.build && Math.abs(l.id - id) === 1).map((l) => l.id);
  }

  /** Draw a level's opening scenery for the fly-over now (then throw the objects away; the pictures stay). */
  private prewarm(id: number) {
    const info = levelInfo(id);
    if (!info.build) return;
    const before = new Set(this.children.list);
    new LevelView(this, info.build(), { lazyNear: this.startX(id) + 500 });
    for (const o of [...this.children.list]) if (!before.has(o)) o.destroy();
  }
  /** The fly-over loops over the first part of the level only (from x0 to here), so only that much is ever drawn. */
  private loopEnd = 0;
  private wrapping = false;

  private startX(id: number) {
    return id === 2 ? 86 * 32 : id === 3 ? 0 : 0;
  }
  private top: number | null = null;

  private build(id: number) {
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
    const near = this.neighbours(id);
    const data = (levelInfo(id).build ?? buildLevel1)();
    if (!this.scene.isActive('Battle') && !this.scene.isActive('Game')) {
      freeLooksExcept(this, [...looks, ...near.flatMap((n) => themesFor(n))]);
      const keep = [data.name, ...near.map((n) => levelName(n))];
      for (const k of this.textures.getTextureKeys())
        if ((k.startsWith('terrain-') || k.startsWith('tree-')) && !keep.some((name) => k.startsWith(`terrain-${name}-`) || k.startsWith(`tree-${name}-`))) this.textures.remove(k);
    }
    this.quiet = [
      // (this Part's song, decoded ahead so pressing Play doesn't wait for it)
      () => preloadLevelMusic(id),
      ...looks.map((l) => () => ensureLook(this, l)),
      ...near.flatMap((n) => [...themesFor(n).map((l) => () => ensureLook(this, l)), () => this.prewarm(n)]),
    ];
    this.level = new LevelView(this, data, { lazyNear: this.x0 + 500 });
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
    // one quiet-moment job at a time (after the game has finished loading)
    const now = performance.now();
    if (this.quiet.length && now - this.lastInput > 900 && now - this.lastQuiet > 200 && this.registry.get('ready')) {
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
    const surf = (this.level.surfaceY(cx - vw * 0.3) + this.level.surfaceY(cx) + this.level.surfaceY(cx + vw * 0.3)) / 3;
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
