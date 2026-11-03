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
