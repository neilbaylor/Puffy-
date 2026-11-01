import Phaser from 'phaser';
import { generateTextures } from '../gfx/textures';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  async create() {
    // Make sure the display font is ready before drawing anything that uses it.
    try {
      await Promise.race([document.fonts.load('22px "Lilita One"'), new Promise((r) => setTimeout(r, 1500))]);
    } catch {
      /* fall back to system font */
    }
    generateTextures(this);
    document.getElementById('boot')?.remove();
    this.scene.start('Menu');
  }
}
