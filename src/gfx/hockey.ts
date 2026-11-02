import type { Ctx } from './draw';
import { STYLES, ellipsePts, roundRectPts, type Fill, type Pt } from './handdrawn';

/** Hockey on the frozen pond: sticks, pucks, nets and rink lines (polished hand-drawn). */
const st = () => STYLES.polished;

/**
 * A real-looking hockey stick held at the top, blade at the bottom-left:
 * a slim two-tone composite shaft with a graphic, white tape wound round the
 * knob, a curved blade with a black tape job. 40 × 40, hand at (30, 6).
 */
export function drawStick(ctx: Ctx) {
  const S = st();
  const top: Pt = [31.5, 2.5];
  const heel: Pt = [14, 33.5];
  const ang = Math.atan2(heel[1] - top[1], heel[0] - top[0]);
  const nx = -Math.sin(ang);
  const ny = Math.cos(ang);
  const w = 1.7;
  const at = (t: number, off = 0): Pt => [top[0] + (heel[0] - top[0]) * t + nx * off, top[1] + (heel[1] - top[1]) * t + ny * off];
  // shaft: matte black composite
  S.shape(ctx, [at(0, -w), at(0, w), at(1, w), at(1, -w)], { base: '#26262e', shade: '#121218', light: '#4a4a58' }, 901, { lw: 0.7 });
  // a red + white graphic band down the shaft, and a shine along one edge
  ctx.fillStyle = '#e8463f';
  const band = (t0: number, t1: number, col: string) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    for (const [x, y] of [at(t0, -w + 0.3), at(t1, -w + 0.3), at(t1, w - 0.3), at(t0, w - 0.3)]) ctx.lineTo(x, y);
    ctx.closePath();
    ctx.fill();
  };
  band(0.42, 0.62, '#e8463f');
  band(0.47, 0.51, '#ffffff');
  band(0.66, 0.69, '#ffffff');
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 0.4;
  ctx.beginPath();
  ctx.moveTo(...at(0.12, -w * 0.45));
  ctx.lineTo(...at(0.95, -w * 0.45));
  ctx.stroke();
  // white tape wound round the top, with a knob
  S.shape(ctx, [at(-0.04, -w - 0.5), at(-0.04, w + 0.5), at(0.2, w + 0.3), at(0.2, -w - 0.3)], { base: '#f4f1ea', shade: '#d9d3c8', light: '#ffffff' }, 902, { lw: 0.6 });
  for (let k = 0; k < 5; k++) {
    const t = 0.02 + k * 0.04;
    S.line(ctx, [at(t, -w - 0.4), at(t + 0.025, w + 0.4)], 903 + k, 0.35, '#b9b2a6');
  }
  // the blade: from the heel, curving gently up at the toe
  const blade: Pt[] = [
    [heel[0] + 2.4, heel[1] - 2.6],
    [heel[0] + 2.6, heel[1] + 1.2],
    [heel[0] - 2, heel[1] + 3.4],
    [heel[0] - 9, heel[1] + 3.6],
    [heel[0] - 12.5, heel[1] + 2.4],
    [heel[0] - 13.2, heel[1] + 0.4],
    [heel[0] - 11.5, heel[1] - 0.2],
    [heel[0] - 6, heel[1] + 0.2],
    [heel[0] - 1, heel[1] - 1.6],
  ];
  S.shape(ctx, blade, { base: '#2c2a33', shade: '#16151b', light: '#55525e' }, 904, { lw: 0.8 });
  // black cloth tape job with a few lighter wraps
  for (let k = 0; k < 5; k++) S.line(ctx, [[heel[0] - 2 - k * 2.1, heel[1] + 3.2], [heel[0] - 3.2 - k * 2.1, heel[1] + 0.2]], 910 + k, 0.35, '#5a5868');
  S.line(ctx, [[heel[0] - 11.5, heel[1] + 2], [heel[0] - 1.5, heel[1] + 2.6]], 916, 0.4, '#ffffff66');
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
