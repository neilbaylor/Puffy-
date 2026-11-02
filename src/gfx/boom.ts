/**
 * A big cartoon explosion as hand-drawn frames (for the King blowing up):
 * a white flash, a spiky yellow-orange starburst, then it breaks into puffy
 * smoke clouds with flame tongues, which swell and thin away. Each frame is
 * BOOM_SIZE × BOOM_SIZE units, centred.
 */
import type { Ctx } from './draw';
import { rng } from './draw';

export const BOOM_SIZE = 300;
export const BOOM_FRAMES = Array.from({ length: 12 }, (_, i) => `b${i}`);

const INK = '#3a2418';

function spiky(ctx: Ctx, cx: number, cy: number, r0: number, r1: number, points: number, seed: number) {
  const r = rng(seed);
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = (i / (points * 2)) * Math.PI * 2 + r() * 0.12;
    const rr = (i % 2 ? r0 : r1) * (0.85 + r() * 0.3);
    ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  ctx.closePath();
}

function puff(ctx: Ctx, cx: number, cy: number, r: number, fill: string, shade: string, alpha: number) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = fill;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = shade;
  ctx.beginPath();
  ctx.arc(cx + r * 0.18, cy + r * 0.22, r * 0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffffaa';
  ctx.beginPath();
  ctx.ellipse(cx - r * 0.35, cy - r * 0.4, r * 0.28, r * 0.17, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

export function drawBoomFrame(ctx: Ctx, f: number) {
  const c = BOOM_SIZE / 2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (f <= 1) {
    // the flash: a white-hot core with a little yellow star around it
    const r = f === 0 ? 46 : 78;
    ctx.fillStyle = '#ffd23f';
    spiky(ctx, c, c, r * 0.75, r * 1.35, 10, 11 + f);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(c, c, r * 0.72, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  if (f <= 4) {
    // the starburst: big spiky layers, orange → yellow → white middle
    const k = (f - 2) / 2; // 0 … 1
    const R = 92 + k * 46;
    ctx.fillStyle = '#e8463f';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4;
    spiky(ctx, c, c, R * 0.72, R * 1.32, 12, 30 + f);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ff8a2a';
    spiky(ctx, c, c, R * 0.6, R * 1.05, 11, 40 + f);
    ctx.fill();
    ctx.fillStyle = '#ffd23f';
    spiky(ctx, c, c, R * 0.45, R * 0.78, 9, 50 + f);
    ctx.fill();
    ctx.fillStyle = '#fff6c8';
    ctx.beginPath();
    ctx.arc(c, c, R * (0.4 - k * 0.14), 0, Math.PI * 2);
    ctx.fill();
    // speed lines shooting out
    const r = rng(60 + f);
    ctx.strokeStyle = '#fff2a8';
    ctx.lineWidth = 4;
    for (let i = 0; i < 10; i++) {
      const a = r() * Math.PI * 2;
      const r0 = R * (1.05 + r() * 0.15);
      ctx.beginPath();
      ctx.moveTo(c + Math.cos(a) * r0, c + Math.sin(a) * r0);
      ctx.lineTo(c + Math.cos(a) * (r0 + 22 + k * 20), c + Math.sin(a) * (r0 + 22 + k * 20));
      ctx.stroke();
    }
    return;
  }
  // it breaks up into puffs of smoke, with flame licking through at first
  const k = (f - 5) / 6; // 0 … 1
  const r = rng(77);
  const n = 9;
  const fade = 1 - Math.max(0, k - 0.45) / 0.55;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 0.4;
    const d = 40 + k * 70 + r() * 18;
    const pr = (34 + r() * 14) * (1 + k * 0.5) * (1 - Math.max(0, k - 0.7) * 0.6);
    const hot = k < 0.35;
    puff(ctx, c + Math.cos(a) * d, c + Math.sin(a) * d * 0.85 - k * 26, pr, hot ? '#ffb46a' : '#efe7f2', hot ? '#f2884a' : '#d4c8dc', fade);
  }
  // the middle puff
  puff(ctx, c, c - k * 30, (52 + k * 22) * (1 - Math.max(0, k - 0.7)), k < 0.25 ? '#ffc27a' : '#f6f0f7', k < 0.25 ? '#ff9a4c' : '#ddd2e4', fade);
  if (k < 0.5) {
    // flame tongues poking out between the puffs
    ctx.globalAlpha = 1 - k * 2;
    ctx.fillStyle = '#ffd23f';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      const d0 = 60 + k * 60;
      const x = c + Math.cos(a) * d0;
      const y = c + Math.sin(a) * d0 * 0.85;
      ctx.beginPath();
      ctx.moveTo(x - Math.sin(a) * 10, y + Math.cos(a) * 10);
      ctx.quadraticCurveTo(x + Math.cos(a) * 34, y + Math.sin(a) * 34, x + Math.sin(a) * 10, y - Math.cos(a) * 10);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  // little sparks flying off
  ctx.fillStyle = '#ffd23f';
  for (let i = 0; i < 14; i++) {
    const a = r() * Math.PI * 2;
    const d = 110 + k * 50 + r() * 20;
    ctx.globalAlpha = fade;
    ctx.beginPath();
    ctx.arc(c + Math.cos(a) * d, c + Math.sin(a) * d, 4 * (1 - k * 0.6), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
