import Phaser from 'phaser';
import { MIN_VIEW_W, TILE, VIEW_H } from '../config';
import { buildLevel1 } from '../level/level1';
import { levelInfo } from '../level/levels';
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
      cam.fadeOut(350, 255, 248, 236);
      cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.children.removeAll(true);
        this.build(id);
        cam.fadeIn(450, 255, 248, 236);
      });
    };
    this.game.events.on('menu-level', onLevel);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.game.events.off('menu-level', onLevel));
    // the boot already put the start screen up; coming back from a game shows it again
    if (!data?.silent) this.game.events.emit('menu');
  }

  private levelId = 1;
  private top: number | null = null;

  private build(id: number) {
    this.levelId = id;
    this.level = new LevelView(this, (levelInfo(id).build ?? buildLevel1)());
    this.bg = new Background(this, this.level.heightPx - VIEW_H);
    this.amb = new Ambience(this, id, (x, y, max) => {
      for (let d = 0; d <= max; d += 8) if (this.level.isSolidAt(x, y + d)) return Math.floor((y + d) / TILE) * TILE;
      return null;
    });
    this.x = 0;
    this.top = null;
  }

  update(_t: number, deltaMs: number) {
    const dt = Math.min(deltaMs / 1000, 1 / 30);
    const cam = this.cameras.main;
    const zoom = Math.min(this.scale.height / VIEW_H, this.scale.width / MIN_VIEW_W);
    cam.setZoom(zoom);
    const vw = this.scale.width / zoom;
    const vh = this.scale.height / zoom;
    const maxX = this.level.widthPx - vw;
    // a slow, slightly unsteady glide: speed breathes, the camera drifts up and down,
    // zooms gently in and out and banks a touch, like a camera drone
    this.t += dt;
    const t = this.t;
    this.x = (this.x + dt * (36 + 10 * Math.sin(t * 0.21) + 5 * Math.sin(t * 0.53 + 1))) % Math.max(1, maxX);
    // follow the terrain up and down (the mountain climbs), smoothly
    const H = this.level.heightPx;
    const cx = this.x + vw / 2;
    const surf = (this.level.surfaceY(cx - vw * 0.3) + this.level.surfaceY(cx) + this.level.surfaceY(cx + vw * 0.3)) / 3;
    const want = Phaser.Math.Clamp(surf - vh * 0.7, Math.min(0, H - vh), H - vh);
    this.top = this.top === null || this.x < 1 ? want : this.top + (want - this.top) * (1 - Math.exp(-dt * 1.5));
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
