/**
 * Battle prizes: a glossy bubble with what's inside (bombs, a star for
 * invincible, grow, rapid fire, a heart), a little parachute for the float
 * down, and the lobbed bomb itself. Drawn in world units (the bubble is 30).
 */
import type { PrizeKind } from '../shared/battle/sim';
import type { Ctx } from './draw';

const INK = '#3a2418';

const RING: Record<PrizeKind, string> = {
  bomb: '#ff8a3d',
  star: '#ffd23f',
  grow: '#9b6bdf',
  rapid: '#ff5d5d',
  heart: '#ff7eb6',
};

function star(ctx: Ctx, cx: number, cy: number, r: number, inner: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? inner : r;
    ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  ctx.closePath();
}

function heart(ctx: Ctx, cx: number, cy: number, s: number) {
  ctx.beginPath();
  ctx.moveTo(cx, cy + 6 * s);
  ctx.bezierCurveTo(cx - 9 * s, cy - 1 * s, cx - 5 * s, cy - 8 * s, cx, cy - 3.5 * s);
  ctx.bezierCurveTo(cx + 5 * s, cy - 8 * s, cx + 9 * s, cy - 1 * s, cx, cy + 6 * s);
  ctx.closePath();
}

/** A round bomb with a fuse (also the icon inside the bomb bubble). */
export function drawBombBall(ctx: Ctx, cx: number, cy: number, r: number, spark = true) {
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // fuse
  ctx.strokeStyle = '#8a6a4a';
  ctx.lineWidth = r * 0.22;
  ctx.beginPath();
  ctx.moveTo(cx + r * 0.45, cy - r * 0.8);
  ctx.quadraticCurveTo(cx + r * 0.9, cy - r * 1.35, cx + r * 1.15, cy - r * 1.1);
  ctx.stroke();
  // body
  ctx.fillStyle = '#2b2733';
  ctx.strokeStyle = INK;
  ctx.lineWidth = r * 0.18;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // cap
  ctx.fillStyle = '#5a5566';
  ctx.beginPath();
  ctx.ellipse(cx + r * 0.42, cy - r * 0.78, r * 0.32, r * 0.22, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // shine
  ctx.fillStyle = '#ffffff99';
  ctx.beginPath();
  ctx.ellipse(cx - r * 0.38, cy - r * 0.35, r * 0.28, r * 0.17, -0.7, 0, Math.PI * 2);
  ctx.fill();
  if (spark) {
    ctx.fillStyle = '#ffd23f';
    star(ctx, cx + r * 1.18, cy - r * 1.12, r * 0.42, r * 0.17);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx + r * 1.18, cy - r * 1.12, r * 0.1, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** The bubble a prize floats in (30 × 30), centred at (15, 15). */
export function drawPrize(ctx: Ctx, kind: PrizeKind) {
  const cx = 15;
  const cy = 15;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // bubble: soft white with a coloured rim
  const g = ctx.createRadialGradient(cx - 4, cy - 5, 2, cx, cy, 14);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.7, '#fffaf0');
  g.addColorStop(1, RING[kind]);
  ctx.fillStyle = g;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(cx, cy, 13.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // what's inside
  ctx.lineWidth = 1.2;
  switch (kind) {
    case 'bomb':
      drawBombBall(ctx, cx - 1, cy + 1.5, 6.4);
      break;
    case 'star':
      ctx.fillStyle = '#ffd23f';
      star(ctx, cx, cy + 0.5, 9, 4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fff7c2';
      star(ctx, cx - 1, cy - 0.5, 4, 1.8);
      ctx.fill();
      break;
    case 'grow': {
      // a little hero and a big hero, with an arrow up
      ctx.fillStyle = '#f28a2e';
      ctx.beginPath();
      ctx.ellipse(cx - 6, cy + 5, 2.8, 3.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(cx + 3, cy + 1.5, 6, 7.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(cx + 5, cy - 1.5, 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(cx + 5.6, cy - 1.4, 0.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#9b6bdf';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(cx - 6, cy - 1);
      ctx.lineTo(cx - 6, cy - 8);
      ctx.moveTo(cx - 8.6, cy - 5.6);
      ctx.lineTo(cx - 6, cy - 8.4);
      ctx.lineTo(cx - 3.4, cy - 5.6);
      ctx.stroke();
      break;
    }
    case 'rapid':
      // a lightning bolt
      ctx.fillStyle = '#ffb627';
      ctx.beginPath();
      ctx.moveTo(cx + 2, cy - 10);
      ctx.lineTo(cx - 6, cy + 1.5);
      ctx.lineTo(cx - 0.5, cy + 1.5);
      ctx.lineTo(cx - 3, cy + 10);
      ctx.lineTo(cx + 6.5, cy - 2);
      ctx.lineTo(cx + 1, cy - 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    case 'heart':
      ctx.fillStyle = '#ff5d7a';
      heart(ctx, cx, cy + 0.5, 1.15);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffffffaa';
      ctx.beginPath();
      ctx.ellipse(cx - 3.6, cy - 2.2, 1.6, 1, -0.6, 0, Math.PI * 2);
      ctx.fill();
      break;
  }
  // gloss on the bubble
  ctx.strokeStyle = '#ffffffcc';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(cx, cy, 10.6, Math.PI * 1.1, Math.PI * 1.45);
  ctx.stroke();
}

/** A small parachute for a prize floating down (30 × 22): canopy on top, strings to the bubble. */
export function drawChute(ctx: Ctx) {
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(4, 9);
  ctx.lineTo(13, 21);
  ctx.moveTo(26, 9);
  ctx.lineTo(17, 21);
  ctx.moveTo(15, 9);
  ctx.lineTo(15, 21);
  ctx.stroke();
  ctx.lineWidth = 1.4;
  const cols = ['#ff7eb6', '#fff6e8', '#7ee3ff', '#fff6e8'];
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = cols[i];
    ctx.beginPath();
    ctx.moveTo(15, 9);
    ctx.arc(15, 9, 12, Math.PI + (i * Math.PI) / 4, Math.PI + ((i + 1) * Math.PI) / 4);
    ctx.closePath();
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(15, 9, 12, Math.PI, 0);
  ctx.closePath();
  ctx.stroke();
}
