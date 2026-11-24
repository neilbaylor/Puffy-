import Phaser from 'phaser';
import { addCanvas } from './textures';
import { LIGHT } from '../core/light';

/**
 * Boss 6's new ending (the launch to the Land of the Bloops): a stand-in Land of the Bloops (a plain
 * sunny land of hills and puff trees, till the land's own art is made). Drawn with the contest's other
 * pictures (FishingScene.artSteps6: behind its loading card), or else when it's first needed.
 */

const INK = '#3a2418';

/** Shapes drawn as one: every outline first (thick), then every fill over it, so they join up. */
function blob(ctx: CanvasRenderingContext2D, shapes: ((c: CanvasRenderingContext2D) => void)[], fill: string, line: number) {
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = line * 2;
  for (const s of shapes) {
    ctx.beginPath();
    s(ctx);
    ctx.stroke();
  }
  ctx.fillStyle = fill;
  for (const s of shapes) {
    ctx.beginPath();
    s(ctx);
    ctx.fill();
  }
}

const rr = (x: number, y: number, w: number, h: number, r: number) => (c: CanvasRenderingContext2D) => c.roundRect(x, y, w, h, r);
const circ = (x: number, y: number, r: number) => (c: CanvasRenderingContext2D) => c.arc(x, y, r, 0, Math.PI * 2);

/** 'bl-land''s resolution (its picture is 1280 × 720 times this). */
export const BLOOPS_RES = LIGHT ? 1 : 1.5;

export function bloopsLand(scene: Phaser.Scene) {
  if (scene.textures.exists('bl-land')) return;
  const R = BLOOPS_RES;
  const c = document.createElement('canvas');
  c.width = Math.round(1280 * R);
  c.height = Math.round(720 * R);
  const ctx = c.getContext('2d')!;
  ctx.scale(R, R);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // sky: a warm, peachy afternoon (not Puff Ball Planet's blue)
  const sky = ctx.createLinearGradient(0, 0, 0, 620);
  sky.addColorStop(0, '#a9dcff');
  sky.addColorStop(0.6, '#d7ecff');
  sky.addColorStop(1, '#ffe7c4');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 1280, 720);
  // the sun
  const glow = ctx.createRadialGradient(1060, 130, 20, 1060, 130, 170);
  glow.addColorStop(0, '#fff6c8cc');
  glow.addColorStop(1, '#fff6c800');
  ctx.fillStyle = glow;
  ctx.fillRect(860, 0, 400, 320);
  ctx.fillStyle = '#fff2a8';
  ctx.beginPath();
  ctx.arc(1060, 130, 56, 0, Math.PI * 2);
  ctx.fill();
  // clouds
  const cloud = (x: number, y: number, k: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(k, k);
    ctx.strokeStyle = '#b9b2dc';
    ctx.lineWidth = 6;
    const puffs: [number, number, number][] = [[-50, 6, 30], [-10, -14, 40], [36, -4, 34], [70, 10, 24], [10, 14, 30]];
    for (const [px, py, r] of puffs) {
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = '#ffffff';
    for (const [px, py, r] of puffs) {
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };
  cloud(220, 140, 1);
  cloud(640, 90, 0.7);
  cloud(880, 220, 0.85);
  // hills: far (soft outline) then near (ink)
  const hills = (base: number, amp: number, waves: number, phase: number, fill: string, line: string, w: number) => {
    ctx.beginPath();
    ctx.moveTo(-20, 720);
    for (let x = -20; x <= 1300; x += 10) ctx.lineTo(x, base - amp * (0.5 + 0.5 * Math.sin((x / 1280) * Math.PI * 2 * waves + phase)) - amp * 0.3 * Math.sin((x / 1280) * Math.PI * 2 * waves * 2.3 + phase * 2));
    ctx.lineTo(1300, 720);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = line;
    ctx.lineWidth = w;
    ctx.stroke();
  };
  hills(470, 90, 2.2, 0.6, '#c3e0b4', '#8fb38a', 4);
  hills(545, 80, 1.6, 2.1, '#9dd48c', INK, 5);
  // puff trees on the near hills
  const tree = (x: number, y: number, k: number, leaf: string) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(k, k);
    blob(ctx, [rr(-9, -70, 18, 72, 8)], '#a8743f', 4);
    blob(ctx, [circ(-26, -82, 30), circ(22, -86, 32), circ(0, -112, 36), circ(0, -76, 30)], leaf, 4);
    ctx.fillStyle = '#ffffff55';
    ctx.beginPath();
    ctx.arc(-10, -122, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };
  tree(170, 520, 1, '#7fcf7a');
  tree(300, 500, 0.75, '#ffc867');
  tree(930, 520, 1.1, '#7fcf7a');
  tree(1130, 505, 0.8, '#f7a6c4');
  // the ground: a grassy top, earth below
  ctx.beginPath();
  ctx.moveTo(-20, 720);
  for (let x = -20; x <= 1300; x += 10) ctx.lineTo(x, 604 + Math.sin(x / 140) * 6 + Math.sin(x / 47) * 2);
  ctx.lineTo(1300, 720);
  ctx.closePath();
  ctx.fillStyle = '#c99a63';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-20, 650);
  for (let x = -20; x <= 1300; x += 10) ctx.lineTo(x, 604 + Math.sin(x / 140) * 6 + Math.sin(x / 47) * 2);
  for (let x = 1300; x >= -20; x -= 10) ctx.lineTo(x, 640 + Math.sin(x / 90) * 5);
  ctx.closePath();
  ctx.fillStyle = '#7cc36e';
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5;
  ctx.beginPath();
  for (let x = -20; x <= 1300; x += 10) {
    const y = 604 + Math.sin(x / 140) * 6 + Math.sin(x / 47) * 2;
    if (x === -20) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  // pebbles in the earth, flowers in the grass
  ctx.lineWidth = 3;
  for (const [x, y, r] of [[120, 684, 9], [380, 696, 7], [610, 680, 8], [820, 700, 10], [1040, 686, 7], [1210, 702, 8]] as const) {
    ctx.fillStyle = '#e2bf8a';
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.3, r, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  for (const [x, col] of [[80, '#ffffff'], [260, '#ffd84d'], [470, '#ff9ec4'], [790, '#ffffff'], [990, '#ffd84d'], [1190, '#ff9ec4']] as const) {
    const y = 612 + Math.sin(x / 140) * 6;
    ctx.strokeStyle = '#4f8a45';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y + 14);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.fillStyle = col;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * 6, y - 4 + Math.sin(a) * 6, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = '#ffb02e';
    ctx.beginPath();
    ctx.arc(x, y - 4, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // a signpost with a question mark (where IS this?)
  ctx.save();
  ctx.translate(1010, 606);
  blob(ctx, [rr(-7, -110, 14, 112, 5)], '#a8743f', 4);
  blob(ctx, [rr(-56, -136, 112, 52, 10)], '#e8c48c', 4);
  ctx.fillStyle = INK;
  ctx.font = '400 40px "Lilita One", "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('???', 0, -108);
  ctx.restore();
  addCanvas(scene, 'bl-land', c, undefined, { release: true });
}
