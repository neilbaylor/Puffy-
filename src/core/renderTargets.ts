import Phaser from 'phaser';

/**
 * (Phaser 4 trial) Phaser 3's spare screen-sized drawing surfaces (masks, the utility pipeline's
 * frames, the capture target) were shrunk here. Phaser 4's renderer has none of those: its render
 * nodes make drawing surfaces only when something (a filter, a DynamicTexture) needs one.
 */
export function trimRenderTargets(_game: Phaser.Game) {}

/** (Phaser 3 only: see above) */
export function shrinkCaptureTarget(_game: Phaser.Game) {}
