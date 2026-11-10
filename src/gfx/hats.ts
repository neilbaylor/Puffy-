/**
 * Hats from the Shop, drawn on top of a hero (see drawCharacter: it finds the top of the hero's
 * head in each pose and puts the hat there). Their colours keep clear of the heroes' oranges, so a
 * battle player's colour change (recolor.ts) leaves the hat as it is.
 */
import type { Ctx } from './draw';
import { STYLES, ellipsePts, type Fill, type Pt } from './handdrawn';

// (STYLES is read when a hat's drawn, not when this file loads: draw.ts and handdrawn.ts import each
// other's neighbours, and reading it at load time found it not set up yet)
const st = () => STYLES.polished;
const F = (base: string, shade: string, light: string): Fill => ({ base, shade, light });

/**
 * A birthday-party hat: a stripy cone (pink, with teal and purple bands and white polka dots), a
 * fluffy pom-pom on the tip and the thin elastic hanging down one side. Its base sits on (0, 0),
 * the tip up at (0, -h); `s` scales it.
 */
export function drawPartyHat(ctx: Ctx, s = 1) {
  const ST = st();
  const w = 7.2 * s; // half the base
  const h = 17 * s;
  const cone: Pt[] = [
    [-w, 0],
    [-w * 0.5, -h * 0.5],
    [0, -h],
    [w * 0.5, -h * 0.5],
    [w, 0],
    [w * 0.45, 1.6 * s],
    [-w * 0.45, 1.6 * s],
  ];
  // the elastic, hanging down behind the head on one side
  ctx.strokeStyle = '#f7a8d6';
  ctx.lineWidth = 0.8 * s;
  ctx.beginPath();
  ctx.moveTo(-w + 1, 0.5);
  ctx.quadraticCurveTo(-w - 1.5 * s, 5 * s, -w + 0.5 * s, 9 * s);
  ctx.stroke();
  ST.shape(ctx, cone, F('#ff5fa8', '#d6337f', '#ff9fce'), 7701, { lw: 1, light: [-w * 0.35, -h * 0.45] });
  // stripes across it (clipped to the cone), and polka dots
  ctx.save();
  ctx.beginPath();
  cone.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.clip();
  const bands: [number, string][] = [
    [0.18, '#2ec4c4'],
    [0.46, '#8a5cf6'],
    [0.72, '#2ec4c4'],
  ];
  for (const [t, col] of bands) {
    const y = -h * t;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(-w * 1.3, y + 2.4 * s);
    ctx.lineTo(w * 1.3, y - 1.2 * s);
    ctx.lineTo(w * 1.3, y - 3.6 * s);
    ctx.lineTo(-w * 1.3, y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = '#ffffffe6';
  for (const [x, y] of [
    [-3.4, -3.6],
    [2.8, -5.8],
    [-1.6, -9.8],
    [1.8, -12.6],
    [3.6, -1.6],
  ] as const) {
    ctx.beginPath();
    ctx.arc(x * s, y * s, 0.85 * s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // the ink line again over the stripes
  ctx.strokeStyle = '#3a2418';
  ctx.lineWidth = 1 * s;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(-w, 0);
  ctx.lineTo(0, -h);
  ctx.lineTo(w, 0);
  ctx.stroke();
  // the pom-pom: a fluffy little ball of white and pink tufts
  const py = -h - 1.6 * s;
  for (const [dx, dy, r, col] of [
    [-1.6, 0.4, 2.1, F('#ffffff', '#e8d4f0', '#ffffff')],
    [1.6, 0.3, 2.1, F('#ffe3f2', '#f2b6d6', '#ffffff')],
    [0, -1.4, 2.3, F('#ffffff', '#e8d4f0', '#ffffff')],
    [0, 0.9, 1.8, F('#ffd0ea', '#f09cc8', '#ffffff')],
  ] as const)
    ST.shape(ctx, ellipsePts(dx * s, py + dy * s, r * s, r * s, 0, 14), col, 7710 + dx * 3 + dy, { lw: 0.6, light: [dx * s - 0.6 * s, py + dy * s - 0.8 * s] });
}

/** Draw hat `id` with its base at (x, y), turned `rot` (radians), at scale `s`. */
export function drawHat(ctx: Ctx, id: string, x: number, y: number, rot: number, s: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  if (id === 'party') drawPartyHat(ctx, s);
  ctx.restore();
}
