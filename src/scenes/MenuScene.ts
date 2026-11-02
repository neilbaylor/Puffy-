import Phaser from 'phaser';
import { MIN_VIEW_W, VIEW_H } from '../config';
import { buildLevel1 } from '../level/level1';
import { Background } from '../world/Background';
import { LevelView } from '../world/LevelView';
import { mixTint, themeClock, themeMix } from '../world/theme';

/** Animated backdrop behind the start screen: a slow fly-over of Puff Ball Planet. */
export class MenuScene extends Phaser.Scene {
  private bg!: Background;
  private level!: LevelView;
  private x = 0;

  constructor() {
    super('Menu');
  }

  create(data?: { silent?: boolean }) {
    this.level = new LevelView(this, buildLevel1());
    this.bg = new Background(this, this.level.heightPx - VIEW_H);
    this.x = 0;
    // the boot already put the start screen up; coming back from a game shows it again
    if (!data?.silent) this.game.events.emit('menu');
  }

  update(_t: number, deltaMs: number) {
    const dt = Math.min(deltaMs / 1000, 1 / 30);
    const cam = this.cameras.main;
    const zoom = Math.min(this.scale.height / VIEW_H, this.scale.width / MIN_VIEW_W);
    cam.setZoom(zoom);
    const vw = this.scale.width / zoom;
    const vh = this.scale.height / zoom;
    const maxX = this.level.widthPx - vw;
    this.x = (this.x + dt * 36) % Math.max(1, maxX);
    const top = this.level.heightPx - vh;
    cam.centerOn(this.x + vw / 2, top + vh / 2);
    // the looks keep drifting behind the start screen too (same clock as the game)
    themeClock.t += dt;
    const m = themeMix(themeClock.t);
    this.bg.setTheme(m);
    this.level.setTint(mixTint(m));
    this.level.animate(this.time.now / 1000, this.x, this.x + vw);
    this.bg.update({ left: this.x, top, width: vw, height: vh }, dt);
  }
}
