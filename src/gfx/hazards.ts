/**
 * Things that fall out of the sky in a battle: a lumpy grey rock and a
 * cartoon anvil (each about 40 units), plus the armed bad guys' little pellets.
 */
import type { Ctx } from './draw';

const INK = '#3a2418';

export function drawRock(ctx: Ctx) {
  ctx.lineJoin = 'round';
  ctx.fillStyle = '#9a8f9e';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  const pts: [number, number][] = [[6, 24], [9, 12], [18, 6], [30, 7], [37, 16], [36, 29], [27, 36], [13, 35]];
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // shade + highlight + a couple of cracks
  ctx.fillStyle = '#76697c';
  ctx.beginPath();
  ctx.moveTo(36, 18);
  ctx.lineTo(35, 29);
  ctx.lineTo(27, 35);
  ctx.lineTo(19, 34);
  ctx.quadraticCurveTo(31, 28, 36, 18);
  ctx.fill();
  ctx.fillStyle = '#c9c0cc';
  ctx.beginPath();
  ctx.ellipse(17, 13, 6, 3, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(22, 15);
  ctx.lineTo(25, 21);
  ctx.lineTo(22, 26);
  ctx.moveTo(12, 25);
  ctx.lineTo(16, 28);
  ctx.stroke();
}

export function drawAnvil(ctx: Ctx) {
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.4;
  const body = new Path2D();
  // horn on the left, flat top, waist, wide foot
  body.moveTo(2, 10);
  body.quadraticCurveTo(9, 15, 15, 15);
  body.lineTo(16, 20);
  body.lineTo(12, 30);
  body.lineTo(8, 30);
  body.lineTo(8, 36);
  body.lineTo(40, 36);
  body.lineTo(40, 30);
  body.lineTo(34, 30);
  body.lineTo(30, 20);
  body.lineTo(38, 18);
  body.lineTo(38, 9);
  body.closePath();
  ctx.fillStyle = '#4a4656';
  ctx.fill(body);
  ctx.stroke(body);
  // a shiny top face and a darker foot
  ctx.fillStyle = '#7a7690';
  ctx.beginPath();
  ctx.moveTo(4, 10);
  ctx.lineTo(37, 9);
  ctx.lineTo(37, 12);
  ctx.lineTo(10, 13);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#2f2c38';
  ctx.fillRect(9, 31, 30, 4);
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 7px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('1T', 24, 27);
}

/** The armed bad guys' shot: a small glowing ball. */
export function drawPellet(ctx: Ctx) {
  ctx.fillStyle = '#ff5d3c';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(8, 8, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffd6a8';
  ctx.beginPath();
  ctx.arc(6.5, 6.5, 2, 0, Math.PI * 2);
  ctx.fill();
}

/** A cartoon poo (a Plop's favourite thing to throw): three swirly tiers, bottom-centre at (cx, by). */
export function drawPoo(ctx: Ctx, cx: number, by: number, s = 1) {
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6 * s;
  const tier = (y: number, rx: number, ry: number, col: string) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.ellipse(cx, y, rx * s, ry * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  };
  tier(by - 5 * s, 10.5, 5, '#8a5a2e');
  tier(by - 10.5 * s, 7.6, 4.2, '#9c6a38');
  tier(by - 15 * s, 4.8, 3.4, '#ad7a44');
  // the curly tip
  ctx.fillStyle = '#ad7a44';
  ctx.beginPath();
  ctx.moveTo(cx - 2 * s, by - 17.6 * s);
  ctx.quadraticCurveTo(cx + 1 * s, by - 23 * s, cx + 3.6 * s, by - 20 * s);
  ctx.quadraticCurveTo(cx + 2 * s, by - 18.6 * s, cx + 1.6 * s, by - 17 * s);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // shine
  ctx.strokeStyle = '#e8c79a';
  ctx.lineWidth = 1.2 * s;
  for (const [y, rx] of [[-6.4, 6.5], [-11.8, 4.6], [-16.2, 2.6]] as const) {
    ctx.beginPath();
    ctx.ellipse(cx - 1.5 * s, by + y * s, rx * s, 1.6 * s, 0, Math.PI * 1.1, Math.PI * 1.5);
    ctx.stroke();
  }
}

/** A see-through block of ice (w × h) for a frozen hero: rounded, glassy, a crack or two. */
export function drawIceBlock(ctx: Ctx, w: number, h: number) {
  ctx.lineJoin = 'round';
  const r = 8;
  const path = new Path2D();
  path.moveTo(r + 2, 2);
  path.lineTo(w - r - 2, 2);
  path.quadraticCurveTo(w - 2, 2, w - 2, r + 2);
  path.lineTo(w - 2, h - r - 2);
  path.quadraticCurveTo(w - 2, h - 2, w - r - 2, h - 2);
  path.lineTo(r + 2, h - 2);
  path.quadraticCurveTo(2, h - 2, 2, h - r - 2);
  path.lineTo(2, r + 2);
  path.quadraticCurveTo(2, 2, r + 2, 2);
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, 'rgba(225,250,255,0.62)');
  g.addColorStop(0.5, 'rgba(150,220,250,0.42)');
  g.addColorStop(1, 'rgba(95,180,230,0.55)');
  ctx.fillStyle = g;
  ctx.fill(path);
  ctx.strokeStyle = '#3a8cb8';
  ctx.lineWidth = 2.2;
  ctx.stroke(path);
  // glassy streaks
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(9, h * 0.18);
  ctx.lineTo(9, h * 0.5);
  ctx.moveTo(15, h * 0.12);
  ctx.lineTo(15, h * 0.24);
  ctx.stroke();
  // frosty top edge
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  for (let x = 6; x < w - 6; x += 7) ctx.ellipse(x + 3.5, 4.5, 4, 2.4, 0, 0, Math.PI * 2);
  ctx.fill();
  // a crack
  ctx.strokeStyle = 'rgba(58,140,184,0.7)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(w - 10, h * 0.62);
  ctx.lineTo(w - 17, h * 0.7);
  ctx.lineTo(w - 13, h * 0.78);
  ctx.lineTo(w - 20, h * 0.88);
  ctx.stroke();
}

/**
 * The wooden ramp up to the middle island, in world px offset by (ox, oy):
 * a plank deck along the ramp line, a side beam, and legs down to whatever's
 * underneath (`groundAt(x)`).
 */
export function drawRamp(
  ctx: Ctx,
  r: { x0: number; y0: number; x1: number; y1: number; flat: number },
  ox: number,
  oy: number,
  groundAt: (x: number) => number,
) {
  ctx.save();
  ctx.translate(-ox, -oy);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const DECK = 11;
  const yAt = (x: number) => (x <= r.x1 ? r.y0 + ((r.y1 - r.y0) * (x - r.x0)) / (r.x1 - r.x0) : r.y1);
  const xEnd = r.x1 + r.flat;
  // legs (behind the deck), with cross braces
  const legs: number[] = [];
  for (let x = r.x0 + 40; x < xEnd - 10; x += 56) legs.push(x);
  ctx.strokeStyle = INK;
  for (let i = 0; i < legs.length; i++) {
    const x = legs[i];
    const top = yAt(x) + DECK - 2;
    const bot = groundAt(x);
    if (bot - top < 6) continue;
    ctx.fillStyle = '#9a6a3c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(x - 4, top, 8, bot - top);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#b8834e';
    ctx.fillRect(x - 3, top + 1, 2.5, bot - top - 2);
    // a brace to the next leg
    const nx = legs[i + 1];
    if (nx !== undefined) {
      const nb = groundAt(nx);
      const ntop = yAt(nx) + DECK - 2;
      ctx.strokeStyle = '#7a5230';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, Math.min(bot, top + (bot - top) * 0.7));
      ctx.lineTo(nx, Math.min(nb, ntop + 12));
      ctx.stroke();
      ctx.strokeStyle = INK;
    }
  }
  // the deck: a thick plank band under the walking line
  const deck = new Path2D();
  deck.moveTo(r.x0, r.y0);
  deck.lineTo(r.x1, r.y1);
  deck.lineTo(xEnd, r.y1);
  deck.lineTo(xEnd, r.y1 + DECK);
  deck.lineTo(r.x1, r.y1 + DECK);
  deck.lineTo(r.x0 + 6, r.y0 + DECK * 0.6);
  deck.closePath();
  ctx.fillStyle = '#c89356';
  ctx.fill(deck);
  // plank seams across the deck
  ctx.save();
  ctx.clip(deck);
  ctx.strokeStyle = '#8a5a2e';
  ctx.lineWidth = 1.4;
  for (let x = r.x0 + 12; x < xEnd; x += 13) {
    const y = yAt(x);
    ctx.beginPath();
    ctx.moveTo(x, y - 2);
    ctx.lineTo(x + 2, y + DECK + 2);
    ctx.stroke();
  }
  // a lighter top edge, a darker side beam
  ctx.strokeStyle = '#ecc590';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(r.x0, r.y0 + 1.5);
  ctx.lineTo(r.x1, r.y1 + 1.5);
  ctx.lineTo(xEnd, r.y1 + 1.5);
  ctx.stroke();
  ctx.fillStyle = '#8a5a2e';
  ctx.beginPath();
  ctx.moveTo(r.x0, r.y0 + DECK * 0.62);
  ctx.lineTo(r.x1, r.y1 + DECK * 0.62);
  ctx.lineTo(xEnd, r.y1 + DECK * 0.62);
  ctx.lineTo(xEnd, r.y1 + DECK);
  ctx.lineTo(r.x1, r.y1 + DECK);
  ctx.lineTo(r.x0, r.y0 + DECK);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.2;
  ctx.stroke(deck);
  // nail heads on the beam
  ctx.fillStyle = '#3a2418';
  for (let x = r.x0 + 18; x < xEnd - 4; x += 26) {
    ctx.beginPath();
    ctx.arc(x, yAt(x) + DECK * 0.8, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
