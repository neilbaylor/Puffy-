/**
 * Puffy, drawn from the original pencil + crayon sketches: an orange egg seen
 * from the side, one big eye, little flappy arms, long thin legs with round
 * feet. When hurt he puffs up round and spiky (second sketch).
 *
 * Geometry lives here; HOW it is inked and colored comes from a Style, so the
 * same Puffy can be shown in every look-development option.
 */
import type { Ctx, Pose } from './draw';
import { drawBazooka } from './bazooka';
import { ellipsePts, paddlePts, petalPts, type Fill, type Pt, type Style } from './handdrawn';

export const PUFFY = {
  body: { base: '#f28a2e', shade: '#c9611a', light: '#ffc27a' } as Fill,
  limb: { base: '#e97d24', shade: '#b8561a', light: '#ffb565' } as Fill,
  eye: { base: '#ffffff', shade: '#e6ddd0', light: '#ffffff' } as Fill,
  spike: { base: '#8fc48a', shade: '#5d9a5a', light: '#c8ecc0' } as Fill,
  tube: { base: '#5a7d63', shade: '#3a5443', light: '#8db296' } as Fill,
  tubeDark: { base: '#3c4a40', shade: '#2a342d', light: '#5a6b5e' } as Fill,
};

/** Frame is 56×56 units, feet on y = 54. */
export function drawPuffyStyled(ctx: Ctx, ox: number, oy: number, pose: Pose, st: Style) {
  if (pose === 'shoot') {
    // recoil: the whole body rocks back on its heels and the tube kicks back
    ctx.save();
    ctx.translate(ox + 27, oy + 54);
    ctx.rotate(-0.13);
    ctx.translate(-(ox + 27), -(oy + 54));
    drawPuffyPose(ctx, ox, oy, 'idle0', st, true);
    ctx.restore();
    return;
  }
  drawPuffyPose(ctx, ox, oy, pose, st, false);
}

function drawPuffyPose(ctx: Ctx, ox: number, oy: number, pose: Pose, st: Style, recoil: boolean) {
  const cx = ox + 27;
  const ground = oy + 54;
  if (pose === 'hurt') {
    drawPuffed(ctx, cx, ground, st);
    return;
  }

  let legL = 0;
  let legR = 0;
  let liftL = 0;
  let liftR = 0;
  let bob = 0;
  let armBack = -0.7;
  let armFront = 0.5;
  let sx = 1;
  let sy = 1;
  if (pose === 'idle1') {
    sx = 1.03;
    sy = 0.97;
    armBack = -0.55;
    armFront = 0.62;
  }
  if (pose.startsWith('walk')) {
    const f = +pose.slice(4);
    [legL, legR, liftL, liftR] = [
      [7, -6, 0, 3],
      [3, -2, 0, 0],
      [-6, 7, 3, 0],
      [-2, 3, 0, 0],
    ][f];
    bob = f % 2 ? -1.5 : 0;
    armBack = f < 2 ? -1.1 : -0.3;
    armFront = f < 2 ? 0.1 : 0.8;
  }
  // Puffy puffs up when he's in the air: rounder, fuller body
  let puffed = false;
  if (pose === 'jump') {
    [legL, legR, liftL, liftR] = [-3, 5, 6, 3];
    armBack = -1.5;
    armFront = -0.7;
    sx = 1.2;
    sy = 1.03;
    puffed = true;
  }
  if (pose === 'fall') {
    [legL, legR, liftL, liftR] = [-4, 6, 3, 6];
    armBack = -1.9;
    armFront = -1.2;
    sx = 1.16;
    sy = 1.0;
    puffed = true;
  }

  const rx = 13 * sx;
  const ry = 16.5 * sy;
  const hipY = ground - 15 + bob;
  const cy = hipY - ry + 3;
  const tilt = 0.12;
  const seed = pose.length * 7 + (pose.charCodeAt(pose.length - 1) % 13); // stable per pose

  // back arm
  st.shape(ctx, paddlePts(cx - 7, cy + 3, 14, 7, Math.PI + 0.2 - armBack), PUFFY.limb, seed + 1, { lw: 0.85 });

  const leg = (hx: number, dx: number, lift: number, fill: Fill, s: number) => {
    const fx = cx + hx + dx;
    const fy = ground - 4.5 - lift;
    const top: Pt = [cx + hx, hipY - 2];
    const mid: Pt = [(top[0] + fx) / 2 + 0.6, (top[1] + fy) / 2];
    st.line(ctx, [top, mid, [fx, fy]], s, 2.6);
    st.line(ctx, [top, mid, [fx, fy]], s, 1.25, fill.base);
    st.shape(ctx, ellipsePts(fx + 1.5, fy, 5.6, 4.4), fill, s + 3, { lw: 0.85 });
  };
  leg(-5, legL, liftL, PUFFY.limb, seed + 2);

  // body
  st.shape(ctx, ellipsePts(cx, cy, rx, ry, puffed ? 0.05 : tilt, 56), PUFFY.body, seed + 4, { light: [cx - 5, cy - 8] });
  if (puffed) {
    // puffed-out cheek + a couple of "puff" lines
    st.shape(ctx, ellipsePts(cx + rx - 4.5, cy + 3, 4.2, 3.4, 0, 20), PUFFY.body, seed + 40, { lw: 0.7 });
    st.line(ctx, [[cx - rx - 2.5, cy - 6], [cx - rx - 5.5, cy - 8]], seed + 41, 0.7);
    st.line(ctx, [[cx - rx - 3, cy + 1], [cx - rx - 6.5, cy + 1]], seed + 42, 0.7);
  }

  // eye (seen from the side)
  st.shape(ctx, ellipsePts(cx + 4, cy - 6, 5.3, 6.9, tilt, 32), PUFFY.eye, seed + 5, { lw: 0.85, plain: st.id === 'sticker' });
  st.shape(ctx, ellipsePts(cx + 7, cy - 5.5, 1.5, 4.6, 0.05, 20), { base: st.ink, shade: st.ink, light: st.ink }, seed + 6, {
    noLine: true,
    plain: true,
  });
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(cx + 7.4, cy - 8, 0.7, 1, 0, 0, Math.PI * 2);
  ctx.fill();

  leg(5, legR, liftR, PUFFY.body, seed + 7);

  // bazooka, tucked low under the front arm (kicks back 3 units when firing)
  const by = cy + 9;
  const kick = recoil ? 3 : 0;
  drawBazooka(ctx, st, { x0: cx - 11 - kick, x1: cx + 22 - kick, y: by, h: 6.6, loaded: !recoil, seed: seed + 8 });

  // front arm flapping over it
  st.shape(ctx, paddlePts(cx + 2, cy + 6, 14, 7.5, armFront), PUFFY.body, seed + 11, { lw: 0.85 });
}

function drawPuffed(ctx: Ctx, cx: number, ground: number, st: Style) {
  const r = 16;
  const cy = ground - r - 4;
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI / 2 + (i - 4) * 0.42 + (i % 2 ? 0.08 : -0.05);
    const d = r + 1;
    st.shape(ctx, petalPts(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 11, 7, a), PUFFY.spike, 40 + i, { lw: 0.75 });
  }
  st.shape(ctx, ellipsePts(cx - 7, ground - 3, 4.6, 3.1), PUFFY.limb, 51, { lw: 0.8 });
  st.shape(ctx, ellipsePts(cx + 8, ground - 3, 4.6, 3.1), PUFFY.limb, 52, { lw: 0.8 });
  st.shape(ctx, paddlePts(cx - 12, cy + 2, 11, 6, Math.PI + 0.6), PUFFY.limb, 53, { lw: 0.8 });
  st.shape(ctx, ellipsePts(cx, cy, r, r, 0, 56), PUFFY.body, 54, { light: [cx - 6, cy - 7] });
  for (const [dx, dy] of [[-3, 8], [4, 10], [0, 12.5]])
    st.shape(ctx, petalPts(cx + dx, cy + dy + 2, 5, 3, -Math.PI / 2), PUFFY.spike, 60 + dx, { lw: 0.6, plain: true });
  for (const ex of [cx - 3.5, cx + 6.5]) {
    st.shape(ctx, ellipsePts(ex, cy - 5, 3.9, 4.5, 0, 24), PUFFY.eye, 70 + ex, { lw: 0.8, plain: true });
    ctx.fillStyle = st.ink;
    ctx.beginPath();
    ctx.ellipse(ex + 0.4, cy - 4.4, 1.3, 1.7, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  st.line(ctx, [[cx - 2, cy + 3.5], [cx + 2, cy + 4.2], [cx + 6, cy + 3.6]], 80, 0.8);
}
