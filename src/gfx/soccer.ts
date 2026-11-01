import type { Ctx } from './draw';
import { STYLES, ellipsePts, roundRectPts, type Fill, type Pt } from './handdrawn';

/**
 * Puffball soccer: the ball they kick around (and at you) and the little
 * goals at each end of their pitch. Polished hand-drawn style.
 */
const st = () => STYLES.polished;

const WHITE: Fill = { base: '#fbf8f2', shade: '#d9d2c8', light: '#ffffff' };
const PATCH: Fill = { base: '#2f2a3a', shade: '#1d1926', light: '#4a4458' };
const POST: Fill = { base: '#ffffff', shade: '#d6d2cc', light: '#ffffff' };

const pentagon = (cx: number, cy: number, r: number, rot: number): Pt[] =>
  Array.from({ length: 5 }, (_, i) => {
    const a = rot + (i / 5) * Math.PI * 2;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r] as Pt;
  });

/** A classic black-and-white soccer ball, radius r. */
export function drawSoccerBall(ctx: Ctx, cx: number, cy: number, r: number) {
  const S = st();
  S.shape(ctx, ellipsePts(cx, cy, r, r, 0, 40), WHITE, 901, { light: [cx - r * 0.45, cy - r * 0.5] });
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r - 0.7, 0, Math.PI * 2);
  ctx.clip();
  const rot = -Math.PI / 2;
  // seams from the middle patch out to the edge patches
  for (let i = 0; i < 5; i++) {
    const a = rot + (i / 5) * Math.PI * 2;
    S.line(ctx, [[cx + Math.cos(a) * r * 0.36, cy + Math.sin(a) * r * 0.36], [cx + Math.cos(a) * r * 0.78, cy + Math.sin(a) * r * 0.78]], 910 + i, 0.55);
  }
  S.shape(ctx, pentagon(cx, cy, r * 0.38, rot), PATCH, 920, { lw: 0.5, plain: true });
  for (let i = 0; i < 5; i++) {
    const a = rot + Math.PI / 5 + (i / 5) * Math.PI * 2;
    S.shape(ctx, pentagon(cx + Math.cos(a) * r * 0.98, cy + Math.sin(a) * r * 0.98, r * 0.34, a + Math.PI), PATCH, 930 + i, { lw: 0.5, plain: true });
  }
  ctx.restore();
  // gloss
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.ellipse(cx - r * 0.42, cy - r * 0.5, r * 0.2, r * 0.12, -0.6, 0, Math.PI * 2);
  ctx.fill();
}

/** A small goal seen from the front-left: white posts and crossbar, a net sagging back. Bottom-left at (x, ground). */
export function drawSoccerGoal(ctx: Ctx, x: number, ground: number, w: number, h: number) {
  const S = st();
  const back = 9; // depth offset of the back frame (up and to the right)
  // back frame + net
  ctx.strokeStyle = 'rgba(90,84,104,0.55)';
  ctx.lineWidth = 0.6;
  const bx = x + back;
  const by = ground - h - back * 0.6;
  const cols = 9;
  const rows = 6;
  for (let i = 0; i <= cols; i++) {
    const t = i / cols;
    ctx.beginPath();
    ctx.moveTo(x + w * t, ground - h);
    ctx.quadraticCurveTo(bx + w * t + 2, by + h * 0.5, bx + w * t, ground - back * 0.2);
    ctx.stroke();
  }
  for (let j = 1; j <= rows; j++) {
    const t = j / rows;
    ctx.beginPath();
    ctx.moveTo(bx + (x - bx) * (1 - t), by + (ground - h - by) * (1 - t) + h * t * 0.98);
    ctx.lineTo(bx + w + (x - bx) * (1 - t), by + (ground - h - by) * (1 - t) + h * t * 0.98);
    ctx.stroke();
  }
  // back posts (thin)
  S.line(ctx, [[bx, by], [bx, ground - back * 0.2]], 940, 0.6, '#b9b3c4');
  S.line(ctx, [[bx + w, by], [bx + w, ground - back * 0.2]], 941, 0.6, '#b9b3c4');
  S.line(ctx, [[bx, by], [bx + w, by]], 942, 0.6, '#b9b3c4');
  // front frame
  const pw = 3.2;
  S.shape(ctx, roundRectPts(x - pw / 2, ground - h - pw / 2, pw, h + pw / 2, 1.2), POST, 950, { lw: 0.7 });
  S.shape(ctx, roundRectPts(x + w - pw / 2, ground - h - pw / 2, pw, h + pw / 2, 1.2), POST, 951, { lw: 0.7 });
  S.shape(ctx, roundRectPts(x - pw / 2, ground - h - pw / 2, w + pw, pw, 1.2), POST, 952, { lw: 0.7 });
}
