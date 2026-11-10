/**
 * Puffy, drawn from the original pencil + crayon sketches: an orange egg seen
 * from the side, one big eye, little flappy arms, long thin legs with round
 * feet. When hurt he's knocked back with a bruised, dizzy eye and his tongue out.
 *
 * Geometry lives here; HOW it is inked and colored comes from a Style, so the
 * same Puffy can be shown in every look-development option.
 */
import type { Ctx, Pose } from './draw';
import { carry, carryArms, gait } from './draw';
import { drawBazooka } from './bazooka';
import { ellipsePts, paddlePts, type Fill, type Pt, type Style } from './handdrawn';
import { face, markEyes } from './face';

export const PUFFY = {
  body: { base: '#f28a2e', shade: '#c9611a', light: '#ffc27a' } as Fill,
  limb: { base: '#e97d24', shade: '#b8561a', light: '#ffb565' } as Fill,
  eye: { base: '#ffffff', shade: '#e6ddd0', light: '#ffffff' } as Fill,
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
  const hurt = pose === 'hurt';
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
    const g = gait(+pose.slice(4), 6.5, 3.2);
    [legL, legR, liftL, liftR, bob] = [g.legL, g.legR, g.liftL, g.liftR, g.bob];
    armBack = -0.7 - 0.4 * g.swing;
    armFront = 0.45 + 0.35 * g.swing;
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

  if (hurt) {
    // knocked back: knees buckle, arms fly up, body squashed and leaning back
    [legL, legR, liftL, liftR] = [4, -3, 0, 1];
    armBack = -2.1;
    armFront = 1.25; // front arm hangs limp so the face stays visible
    sx = 1.05;
    sy = 0.93;
  }

  const rx = 13 * sx;
  const ry = 16.5 * sy;
  const hipY = ground - (hurt ? 13 : 15) + bob;
  const cy = hipY - ry + 3;
  const tilt = hurt ? -0.2 : 0.12;
  const seed = pose.length * 7 + (pose.charCodeAt(pose.length - 1) % 13); // stable per pose

  // back arm (or both arms up, carrying something)
  const ca = carry.on ? carryArms('puffy', ox, oy) : null;
  if (ca) st.shape(ctx, paddlePts(ca.back.x, ca.back.y, ca.back.len, 7, ca.back.rot), PUFFY.limb, seed + 1, { lw: 0.85 });
  else st.shape(ctx, paddlePts(cx - 7, cy + 3, 14, 7, Math.PI + 0.2 - armBack), PUFFY.limb, seed + 1, { lw: 0.85 });

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

  markEyes(ctx, cx + 4, cy - 6);
  if (hurt) {
    drawHurtFace(ctx, cx, cy, st, seed);
  } else {
  const f = face();
  // eye (seen from the side)
  if (f.blink) {
    // closed: the lid (body colour) over the eye, with a curved lash line
    st.shape(ctx, ellipsePts(cx + 4, cy - 6, 5.3, 6.9, tilt, 32), PUFFY.body, seed + 5, { lw: 0.85, plain: true });
    st.line(ctx, [[cx - 0.6, cy - 5.6], [cx + 4, cy - 3.6], [cx + 8.6, cy - 5.2]], seed + 6, 0.8);
  } else {
    st.shape(ctx, ellipsePts(cx + 4, cy - 6, 5.3, 6.9, tilt, 32), PUFFY.eye, seed + 5, { lw: 0.85, plain: st.id === 'sticker' });
    // the pupil looks forward by default; it can glance back across the eye, up or down
    const px = cx + 7 + (f.lookX < 0 ? f.lookX * 4.6 : f.lookX * 0.6);
    const py = cy - 5.5 + f.lookY * 1.7;
    st.shape(ctx, ellipsePts(px, py, 1.5, 4.6, 0.05, 20), { base: st.ink, shade: st.ink, light: st.ink }, seed + 6, {
      noLine: true,
      plain: true,
    });
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(px + 0.4, py - 2.5, 0.7, 1, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Puffy's mouth only shows when he makes a face: a little smile, an "o", or open
  const mx = cx + 9.6;
  const my = cy + 2;
  if (f.mouth === 'smile') {
    st.line(ctx, [[mx - 3, my - 0.9], [mx - 0.2, my + 1.4], [mx + 2.6, my - 0.6]], seed + 30, 0.8);
  } else if (f.mouth === 'o' || f.mouth === 'open') {
    const [w, h] = f.mouth === 'o' ? [1.4, 1.7] : [2.5, 2.1];
    st.shape(ctx, ellipsePts(mx, my + 0.4, w, h, 0, 16), { base: '#5a2418', shade: '#3a160e', light: '#7a3424' }, seed + 31, { lw: 0.7, plain: true });
    if (f.mouth === 'open') {
      ctx.fillStyle = '#ef6f86';
      ctx.beginPath();
      ctx.ellipse(mx + 0.2, my + 1.3, 1.3, 0.75, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  }

  leg(5, legR, liftR, PUFFY.body, seed + 7);

  if (ca) {
    st.shape(ctx, paddlePts(ca.front.x, ca.front.y, ca.front.len, 7.5, ca.front.rot), PUFFY.body, seed + 11, { lw: 0.85 });
    return;
  }
  // bazooka, tucked low under the front arm (kicks back 3 units when firing)
  const by = cy + 9;
  const kick = recoil ? 3 : 0;
  if (hurt) {
    // the bazooka slips and droops nose-down
    ctx.save();
    ctx.translate(cx + 5, by + 3);
    ctx.rotate(0.38);
    ctx.translate(-(cx + 5), -(by + 3));
  }
  drawBazooka(ctx, st, { x0: cx - 11 - kick, x1: cx + 22 - kick, y: by + (hurt ? 2 : 0), h: 6.6, loaded: !recoil && !hurt, seed: seed + 8 });
  if (hurt) ctx.restore();

  // front arm flapping over it
  st.shape(ctx, paddlePts(cx + 2, cy + 6, 14, 7.5, armFront), PUFFY.body, seed + 11, { lw: 0.85 });
}

/** Hurt face, like the other heroes: a bruised, swirly dizzy eye, mouth open, tongue out, a sweat drop. */
function drawHurtFace(ctx: Ctx, cx: number, cy: number, st: Style, seed: number) {
  const ex = cx + 4;
  const ey = cy - 6;
  // black-eye bruise around the eye
  st.shape(ctx, ellipsePts(ex + 0.3, ey + 0.4, 7, 8.3, -0.2, 32), { base: '#5a3550', shade: '#3a2236', light: '#7a5070' }, seed + 20, { lw: 0.6, plain: true });
  st.shape(ctx, ellipsePts(ex, ey, 5.3, 6.6, -0.2, 32), PUFFY.eye, seed + 21, { lw: 0.85, plain: true });
  // dizzy spiral
  const sp: Pt[] = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const a = t * Math.PI * 4.2;
    const r = 0.4 + t * 3.8;
    sp.push([ex + 0.4 + Math.cos(a) * r * 0.85, ey + 0.3 + Math.sin(a) * r]);
  }
  st.line(ctx, sp, seed + 22, 0.8);
  // open mouth at the front of the face, tongue hanging out
  const mx = cx + 9.6;
  const my = cy + 2.6;
  st.shape(ctx, ellipsePts(mx, my, 2.9, 2.5, 0.3, 20), { base: '#5e1a2a', shade: '#3e1020', light: '#7e2a3a' }, seed + 23, { lw: 0.7, plain: true });
  st.shape(ctx, ellipsePts(mx + 1.8, my + 3.1, 2.2, 3.3, -0.5, 20), { base: '#ff7d93', shade: '#e0566e', light: '#ffb3c0' }, seed + 24, { lw: 0.6, plain: true });
  // sweat drop flying off the back of his head
  const dx = cx - 13;
  const dy = cy - 12;
  st.shape(ctx, [[dx, dy - 3.4], [dx + 1.9, dy + 0.2], [dx + 1.3, dy + 1.8], [dx - 1.3, dy + 1.8], [dx - 1.9, dy + 0.2]], { base: '#bfe9ff', shade: '#7cc6ec', light: '#ffffff' }, seed + 25, { lw: 0.6, plain: true });
}
