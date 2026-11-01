import Phaser from 'phaser';
import { generateTextures } from '../gfx/textures';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  async create() {
    // Make sure the display font is ready before drawing text into textures.
    try {
      await Promise.race([
        document.fonts.load('22px "Lilita One"'),
        new Promise((r) => setTimeout(r, 1500)),
      ]);
    } catch {
      /* fall back to system font */
    }
    generateTextures(this);
    this.anims.create({
      key: 'coin-spin',
      frames: ['c0', 'c1', 'c2', 'c3'].map((f) => ({ key: 'coin', frame: f })),
      frameRate: 14,
      repeat: -1,
    });
    this.scene.start('Menu');
  }
}
