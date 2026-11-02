import type { Ctx } from './draw';
import { STYLES, ellipsePts, roundRectPts, type Fill, type Pt } from './handdrawn';

/** Hockey on the frozen pond: sticks, pucks, nets and rink lines (polished hand-drawn). */
const st = () => STYLES.polished;

/** A hockey stick held at the top, blade at the bottom-left. 40 × 40, hand at (30, 6). */
export function drawStick(ctx: Ctx) {
  const S = st();
  const shaft: Fill = { base: '#c8915a', shade: '#9a6a3a', light: '#ecc08c' };
  const blade: Fill = { base: '#2c2a33', shade: '#16151b', light: '#55525e' };
  S.shape(ctx, [[28, 4], [32, 6], [12, 32], [8, 30]], shaft, 901, { lw: 0.8 });
  S.shape(ctx, roundRectPts(28, 3, 5, 7, 1.5), blade, 902, { lw: 0.6, plain: true }); // grip tape
  S.shape(ctx, [[8, 29], [13, 33], [11, 37], [0, 37], [-1, 33]], blade, 903, { lw: 0.8 });
  S.line(ctx, [[2, 35], [10, 35]], 904, 0.5, '#ffffff99');
}

/** A puck: a short black cylinder seen from the side, radius r. */
export function drawPuck(ctx: Ctx, cx: number, cy: number, r: number) {
  const S = st();
  S.shape(ctx, roundRectPts(cx - r, cy - r * 0.45, r * 2, r * 0.9, r * 0.35), { base: '#24222b', shade: '#111015', light: '#4a4754' }, 911, { lw: 0.8 });
  S.shape(ctx, ellipsePts(cx, cy - r * 0.45, r, r * 0.28, 0, 20), { base: '#3a3744', shade: '#24222b', light: '#5e5a6a' }, 912, { lw: 0.6, plain: true });
}

/** A hockey net: red frame, white mesh, seen front-left. Bottom-left at (x, ground). */
export function drawHockeyNet(ctx: Ctx, x: number, ground: number, w: number, h: number) {
  const S = st();
  const back = 10;
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 0.7;
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    ctx.beginPath();
    ctx.moveTo(x + w * t, ground - h);
    ctx.quadraticCurveTo(x + back + w * t * 0.8, ground - h * 0.4, x + back + w * t * 0.9, ground);
    ctx.stroke();
  }
  for (let j = 1; j <= 4; j++) {
    const t = j / 5;
    ctx.beginPath();
    ctx.moveTo(x + back * t, ground - h + h * t);
    ctx.lineTo(x + w + back * t * 0.4, ground - h + h * t);
    ctx.stroke();
  }
  const red: Fill = { base: '#e8463f', shade: '#b02a24', light: '#ff8f84' };
  const pw = 3.2;
  S.shape(ctx, roundRectPts(x - pw / 2, ground - h - pw / 2, pw, h + pw / 2, 1.2), red, 920, { lw: 0.7 });
  S.shape(ctx, roundRectPts(x + w - pw / 2, ground - h - pw / 2, pw, h + pw / 2, 1.2), red, 921, { lw: 0.7 });
  S.shape(ctx, roundRectPts(x - pw / 2, ground - h - pw / 2, w + pw, pw, 1.2), red, 922, { lw: 0.7 });
}

/** Painted rink lines on the ice: a red centre line, two blue lines and a centre circle. w wide. */
export function drawRinkLines(ctx: Ctx, w: number, y: number) {
  const pts = (x: number): Pt[] => [
    [x - 1.6, y],
    [x + 1.6, y],
    [x + 1.6, y + 5],
    [x - 1.6, y + 5],
  ];
  const fillPts = (p: Pt[], c: string) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    p.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    ctx.closePath();
    ctx.fill();
  };
  fillPts(pts(w / 2), 'rgba(232,70,63,0.8)');
  fillPts(pts(w * 0.3), 'rgba(47,111,214,0.8)');
  fillPts(pts(w * 0.7), 'rgba(47,111,214,0.8)');
  ctx.strokeStyle = 'rgba(47,111,214,0.6)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.ellipse(w / 2, y + 2.5, 22, 2.6, 0, 0, Math.PI * 2);
  ctx.stroke();
}
