/**
 * Battle prizes: a glossy bubble with what's inside (bombs, a star for
 * invincible, grow, rapid fire, a heart), a little parachute for the float
 * down, and the lobbed bomb itself. Drawn in world units (the bubble is 30).
 */
import type { PrizeKind } from '../shared/battle/sim';
import type { Ctx } from './draw';

const INK = '#3a2418';

/** Each bonus has its own colour: the bubble's tint, its rim and its parachute. */
export const PRIZE_COLOR: Record<PrizeKind, { light: string; mid: string; dark: string }> = {
  bomb: { light: '#ffe2c8', mid: '#ff9a4a', dark: '#c95a1a' },
  star: { light: '#fff6c2', mid: '#ffd23f', dark: '#d19a10' },
  grow: { light: '#eadcff', mid: '#a77ff0', dark: '#6a42b8' },
  rapid: { light: '#ffe0dc', mid: '#ff6b5e', dark: '#c0322a' },
  heart: { light: '#ffe0ee', mid: '#ff86b8', dark: '#d24c86' },
  ice: { light: '#e6fbff', mid: '#7fdcff', dark: '#3a9cc8' },
  fire: { light: '#fff0c8', mid: '#ffb03a', dark: '#e0521c' },
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

/** Little four-point twinkle. */
function twinkle(ctx: Ctx, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fill();
}

/** A fireball (also used for the fire power's shots): flame tongues round a hot core. */
export function drawFireball(ctx: Ctx, cx: number, cy: number, r: number, dir = 1) {
  ctx.lineJoin = 'round';
  // flame tongues trailing behind
  const tongue = (col: string, k: number) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(cx + dir * r * 0.9 * k, cy);
    ctx.quadraticCurveTo(cx + dir * r * 0.7 * k, cy - r * 1.05 * k, cx - dir * r * 0.1, cy - r * 0.95 * k);
    ctx.quadraticCurveTo(cx - dir * r * 0.9 * k, cy - r * 1.3 * k, cx - dir * r * 1.9 * k, cy - r * 0.8 * k);
    ctx.quadraticCurveTo(cx - dir * r * 1.3 * k, cy - r * 0.35 * k, cx - dir * r * 2.1 * k, cy);
    ctx.quadraticCurveTo(cx - dir * r * 1.3 * k, cy + r * 0.35 * k, cx - dir * r * 1.8 * k, cy + r * 0.85 * k);
    ctx.quadraticCurveTo(cx - dir * r * 0.6 * k, cy + r * 1.2 * k, cx, cy + r * 0.95 * k);
    ctx.quadraticCurveTo(cx + dir * r * 0.8 * k, cy + r * 0.9 * k, cx + dir * r * 0.9 * k, cy);
    ctx.fill();
  };
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1, r * 0.16);
  tongue('#e0521c', 1.05);
  ctx.stroke();
  tongue('#ff9a2a', 0.8);
  tongue('#ffd23f', 0.55);
  ctx.fillStyle = '#fff6d0';
  ctx.beginPath();
  ctx.ellipse(cx + dir * r * 0.15, cy, r * 0.42, r * 0.36, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** A six-armed snowflake. */
function snowflake(ctx: Ctx, cx: number, cy: number, r: number) {
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3 - Math.PI / 2;
    const ex = cx + Math.cos(a) * r;
    const ey = cy + Math.sin(a) * r;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(ex, ey);
    // little side branches
    for (const t of [0.55, 0.78]) {
      const bx = cx + Math.cos(a) * r * t;
      const by = cy + Math.sin(a) * r * t;
      const bl = r * (t === 0.55 ? 0.3 : 0.2);
      for (const s of [-1, 1]) {
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + Math.cos(a + s * 0.9) * bl, by + Math.sin(a + s * 0.9) * bl);
      }
    }
    ctx.stroke();
  }
}

/**
 * The bubble a prize floats in (30 × 30), centred at (15, 15): a glossy sphere
 * tinted in the bonus's colour, a thick outline, and a clear icon inside.
 */
export function drawPrize(ctx: Ctx, kind: PrizeKind) {
  const cx = 15;
  const cy = 15;
  const R = 13.6;
  const col = PRIZE_COLOR[kind];
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // the sphere: light top-left, the bonus colour round the edge
  const g = ctx.createRadialGradient(cx - 4.5, cy - 5.5, 1.5, cx, cy, R);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.45, col.light);
  g.addColorStop(0.86, col.mid);
  g.addColorStop(1, col.dark);
  ctx.fillStyle = g;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.9;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // a soft inner ring so the icon sits in a "window"
  ctx.strokeStyle = '#ffffff88';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, R - 2.4, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.25;
  switch (kind) {
    case 'bomb': {
      // a little pile of three bombs
      drawBombBall(ctx, cx - 4.6, cy + 3.6, 4.2, false);
      drawBombBall(ctx, cx + 4.4, cy + 3.8, 4.2, false);
      drawBombBall(ctx, cx - 0.4, cy - 2.4, 5, true);
      break;
    }
    case 'star': {
      // a golden star with a shine stripe, and twinkles round it
      ctx.fillStyle = '#ffd23f';
      star(ctx, cx, cy + 0.6, 9.6, 4.3);
      ctx.fill();
      ctx.stroke();
      ctx.save();
      star(ctx, cx, cy + 0.6, 9.6, 4.3);
      ctx.clip();
      ctx.fillStyle = '#fff3a8';
      ctx.beginPath();
      ctx.moveTo(cx - 9, cy - 1);
      ctx.lineTo(cx - 1, cy - 9);
      ctx.lineTo(cx + 2, cy - 9);
      ctx.lineTo(cx - 9, cy + 2);
      ctx.fill();
      ctx.fillStyle = '#e8ac18';
      ctx.beginPath();
      ctx.moveTo(cx + 10, cy + 3);
      ctx.lineTo(cx + 3, cy + 11);
      ctx.lineTo(cx + 10, cy + 11);
      ctx.fill();
      ctx.restore();
      // tiny face: invincible and pleased about it
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(cx - 2.2, cy + 0.4, 0.95, 0, Math.PI * 2);
      ctx.arc(cx + 2.2, cy + 0.4, 0.95, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.arc(cx, cy + 2, 1.6, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      twinkle(ctx, cx + 8.6, cy - 7.2, 2.4);
      twinkle(ctx, cx - 8.4, cy + 7.4, 1.8);
      break;
    }
    case 'grow': {
      // a big strong flexing arm (upper arm along the bottom, fist up, a huge bicep)
      const skin = '#ffc48a';
      ctx.save();
      ctx.translate(1.2, 0.6);
      // a couple of "pow" lines off the bicep
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(cx - 8.2, cy - 6.8);
      ctx.lineTo(cx - 9.6, cy - 8.2);
      ctx.moveTo(cx - 4.6, cy - 9.6);
      ctx.lineTo(cx - 5, cy - 11.4);
      ctx.moveTo(cx - 10.4, cy - 3.4);
      ctx.lineTo(cx - 12, cy - 4);
      ctx.stroke();
      ctx.lineWidth = 1.35;
      ctx.fillStyle = skin;
      ctx.beginPath();
      ctx.moveTo(cx - 11, cy + 7.6); // shoulder, underneath
      ctx.quadraticCurveTo(cx - 2, cy + 9.6, cx + 5, cy + 8.6); // under the upper arm to the elbow
      ctx.quadraticCurveTo(cx + 9.8, cy + 7.6, cx + 9.4, cy + 2.6); // round the elbow
      ctx.lineTo(cx + 8.6, cy - 4.4); // up the forearm to the wrist
      ctx.bezierCurveTo(cx + 10.4, cy - 7.6, cx + 8.2, cy - 11.6, cx + 4.2, cy - 10.6); // round the fist
      ctx.bezierCurveTo(cx + 1, cy - 10, cx + 0.6, cy - 6.2, cx + 2.2, cy - 4.6); // fist, inside
      ctx.lineTo(cx + 2.6, cy - 0.2); // down the inside of the forearm to the crook
      ctx.bezierCurveTo(cx + 1.6, cy - 9.4, cx - 8.4, cy - 10.2, cx - 8.8, cy - 1.6); // the (huge) bicep
      ctx.quadraticCurveTo(cx - 10, cy - 0.4, cx - 11.4, cy - 0.2); // to the shoulder
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // shading under the bicep and arm
      ctx.fillStyle = '#e8955a';
      ctx.beginPath();
      ctx.moveTo(cx - 10.6, cy + 6.6);
      ctx.quadraticCurveTo(cx - 2, cy + 8.4, cx + 5, cy + 7.4);
      ctx.quadraticCurveTo(cx + 2, cy + 5.6, cx - 3, cy + 5.4);
      ctx.quadraticCurveTo(cx - 8, cy + 5.4, cx - 10.6, cy + 6.6);
      ctx.fill();
      // the crook of the elbow, and the knuckles
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx + 2.6, cy - 0.2);
      ctx.quadraticCurveTo(cx + 1.4, cy + 2.2, cx - 0.6, cy + 2.8);
      ctx.moveTo(cx + 3.2, cy - 8.4);
      ctx.quadraticCurveTo(cx + 4.8, cy - 7.6, cx + 6.6, cy - 8.2);
      ctx.moveTo(cx + 3.6, cy - 6.2);
      ctx.quadraticCurveTo(cx + 5.2, cy - 5.4, cx + 7.4, cy - 6);
      ctx.stroke();
      // a shine on the bicep
      ctx.fillStyle = '#ffffffcc';
      ctx.beginPath();
      ctx.ellipse(cx - 4.2, cy - 4.6, 2.9, 1.4, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      break;
    }
    case 'rapid': {
      // a lightning bolt with speed lines
      ctx.strokeStyle = '#ffffffcc';
      ctx.lineWidth = 1.2;
      for (const [y, l] of [[-4, 5], [1, 7], [6, 4.5]] as const) {
        ctx.beginPath();
        ctx.moveTo(cx - 11, cy + y);
        ctx.lineTo(cx - 11 + l, cy + y);
        ctx.stroke();
      }
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.25;
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      ctx.moveTo(cx + 3.4, cy - 10.5);
      ctx.lineTo(cx - 5, cy + 1.6);
      ctx.lineTo(cx + 0.4, cy + 1.6);
      ctx.lineTo(cx - 2.4, cy + 10.6);
      ctx.lineTo(cx + 7.4, cy - 2.4);
      ctx.lineTo(cx + 2, cy - 2.4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fff6c8';
      ctx.beginPath();
      ctx.moveTo(cx + 2.6, cy - 8.4);
      ctx.lineTo(cx - 2.6, cy + 0.2);
      ctx.lineTo(cx - 1.2, cy + 0.2);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'heart': {
      ctx.fillStyle = '#ff4f73';
      heart(ctx, cx, cy + 0.8, 1.22);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffffffb0';
      ctx.beginPath();
      ctx.ellipse(cx - 3.8, cy - 2.4, 1.8, 1.1, -0.6, 0, Math.PI * 2);
      ctx.fill();
      // a little "+1"
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx + 7.6, cy - 6.6, 3.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#ff4f73';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(cx + 5.8, cy - 6.6);
      ctx.lineTo(cx + 9.4, cy - 6.6);
      ctx.moveTo(cx + 7.6, cy - 8.4);
      ctx.lineTo(cx + 7.6, cy - 4.8);
      ctx.stroke();
      break;
    }
    case 'ice': {
      // an ice cube with a snowflake frozen inside
      ctx.fillStyle = '#c9f2ff';
      ctx.beginPath();
      ctx.moveTo(cx - 8, cy - 4);
      ctx.lineTo(cx - 1, cy - 9);
      ctx.lineTo(cx + 8.5, cy - 5.5);
      ctx.lineTo(cx + 8.5, cy + 6);
      ctx.lineTo(cx + 1, cy + 10);
      ctx.lineTo(cx - 8, cy + 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // top face, lighter
      ctx.fillStyle = '#effcff';
      ctx.beginPath();
      ctx.moveTo(cx - 8, cy - 4);
      ctx.lineTo(cx - 1, cy - 9);
      ctx.lineTo(cx + 8.5, cy - 5.5);
      ctx.lineTo(cx + 1, cy - 1);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + 1, cy - 1);
      ctx.lineTo(cx + 1, cy + 10);
      ctx.stroke();
      ctx.strokeStyle = '#3a9cc8';
      ctx.lineWidth = 0.9;
      snowflake(ctx, cx - 3.4, cy + 3.4, 3.6);
      ctx.fillStyle = '#ffffff';
      twinkle(ctx, cx + 5.6, cy + 1.4, 1.8);
      break;
    }
    case 'fire':
      drawFireball(ctx, cx + 3, cy + 1, 5.6, 1);
      break;
  }
  // gloss on the bubble
  ctx.strokeStyle = '#ffffffdd';
  ctx.lineWidth = 1.7;
  ctx.beginPath();
  ctx.arc(cx, cy, R - 3, Math.PI * 1.08, Math.PI * 1.42);
  ctx.stroke();
  ctx.fillStyle = '#ffffffcc';
  ctx.beginPath();
  ctx.arc(cx - 6.8, cy - 8.4, 1.1, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * A little parachute for a prize floating down (30 × 22): a rounded canopy of
 * five panels in the bonus's colour and cream, shaded towards the edges, a
 * scalloped hem, a vent on top, and lines down to a ring over the bubble.
 */
export function drawChute(ctx: Ctx, kind?: PrizeKind) {
  const col = kind ? PRIZE_COLOR[kind] : { light: '#ffe0ee', mid: '#ff86b8', dark: '#d24c86' };
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const cx = 15;
  const top = 1.2;
  const hem = 11.2;
  const L = 1.6;
  const R = 28.4;
  const N = 5;
  const hx = (i: number) => L + ((R - L) * i) / N;
  // lines down to the ring
  ctx.strokeStyle = '#5a4030';
  ctx.lineWidth = 0.6;
  for (let i = 0; i <= N; i++) {
    ctx.beginPath();
    ctx.moveTo(hx(i), hem + 0.6);
    ctx.lineTo(cx, 20.4);
    ctx.stroke();
  }
  // the canopy outline: a dome over a scalloped hem
  const dome = new Path2D();
  dome.moveTo(L, hem);
  dome.bezierCurveTo(L, top + 2, cx - 9, top, cx, top);
  dome.bezierCurveTo(cx + 9, top, R, top + 2, R, hem);
  for (let i = N; i > 0; i--) dome.quadraticCurveTo((hx(i) + hx(i - 1)) / 2, hem + 2.6, hx(i - 1), hem);
  dome.closePath();
  ctx.save();
  ctx.clip(dome);
  // panels: curved seams fanning out from the top
  for (let i = 0; i < N; i++) {
    const a = hx(i);
    const b = hx(i + 1);
    const g = ctx.createLinearGradient(a, 0, b, 0);
    const base = i % 2 === 0 ? col.mid : '#fff8ee';
    const edge = i % 2 === 0 ? col.dark : '#ead9c8';
    g.addColorStop(0, edge);
    g.addColorStop(0.45, base);
    g.addColorStop(1, edge);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(cx, top - 1);
    ctx.quadraticCurveTo(a + (cx - a) * 0.35, top + 2, a, hem + 3);
    ctx.lineTo(b, hem + 3);
    ctx.quadraticCurveTo(b + (cx - b) * 0.35, top + 2, cx, top - 1);
    ctx.fill();
  }
  // a soft shine across the top
  ctx.fillStyle = '#ffffff55';
  ctx.beginPath();
  ctx.ellipse(cx - 4, top + 3.2, 8, 2.2, -0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // seams + outline
  ctx.strokeStyle = '#3a241880';
  ctx.lineWidth = 0.6;
  for (let i = 1; i < N; i++) {
    const a = hx(i);
    ctx.beginPath();
    ctx.moveTo(cx, top);
    ctx.quadraticCurveTo(a + (cx - a) * 0.35, top + 2, a, hem);
    ctx.stroke();
  }
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.3;
  ctx.stroke(dome);
  // vent on top, and the ring the lines meet at
  ctx.fillStyle = col.dark;
  ctx.beginPath();
  ctx.ellipse(cx, top + 0.8, 1.8, 0.9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 0.9;
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath();
  ctx.arc(cx, 20.6, 1.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}
