import Phaser from 'phaser';
import { VIEW_H } from '../config';
import { buildLevel1 } from '../level/level1';
import { Background } from '../world/Background';
import { LevelView } from '../world/LevelView';

/** Animated backdrop behind the title + character select: a slow fly-over of level 1. */
export class MenuScene extends Phaser.Scene {
  private bg!: Background;
  private level!: LevelView;
  private x = 0;

  constructor() {
    super('Menu');
  }

  create() {
    this.level = new LevelView(this, buildLevel1());
    this.bg = new Background(this, this.level.heightPx - VIEW_H);
    this.x = 0;
    this.game.events.emit('menu');
  }

  update(_t: number, deltaMs: number) {
    const dt = Math.min(deltaMs / 1000, 1 / 30);
    const cam = this.cameras.main;
    const zoom = this.scale.height / VIEW_H;
    cam.setZoom(zoom);
    const vw = this.scale.width / zoom;
    const maxX = this.level.widthPx - vw;
    this.x = (this.x + dt * 40) % Math.max(1, maxX);
    const top = this.level.heightPx - VIEW_H;
    cam.centerOn(this.x + vw / 2, top + VIEW_H / 2);
    this.bg.update({ left: this.x, top, width: vw, height: VIEW_H }, dt);
  }
}
