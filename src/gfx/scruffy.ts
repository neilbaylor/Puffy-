/**
 * Scruffy, drawn from the original sketch: Puffy's small sidekick. A little
 * round orange ball with two eyes, a pale muzzle patch, one ear on top,
 * tiny arms and short legs with round feet. Same hand-drawn styles as Puffy.
 */
import type { Ctx, Pose } from './draw';
import { carry, carryArms, gait } from './draw';
import { ellipsePts, paddlePts, type Fill, type Pt, type Style } from './handdrawn';
import { drawBazooka } from './bazooka';
import { face } from './face';

export const SCRUFFY = {
  body: { base: '#f7953a', shade: '#cf6b1c', light: '#ffc98a' } as Fill,
  limb: { base: '#ec8628', shade: '#bd5c16', light: '#ffb76a' } as Fill,
  muzzle: { base: '#fff3e2', shade: '#efd9bd', light: '#ffffff' } as Fill,
  eye: { base: '#ffffff', shade: '#e6ddd0', light: '#ffffff' } as Fill,
};

/** Frame is 56×56 units, feet on y = 54 (same frame as Puffy, he's just smaller inside it). */
export function drawScruffyStyled(ctx: Ctx, ox: number, oy: number, pose: Pose, st: Style) {
  if (pose === 'shoot') {
    // recoil: rock back on the heels, tube kicks back
    ctx.save();
    ctx.translate(ox + 26, oy + 54);
    ctx.rotate(-0.13);
    ctx.translate(-(ox + 26), -(oy + 54));
    drawScruffyPose(ctx, ox, oy, 'idle0', st, true);
    ctx.restore();
    return;
  }
  drawScruffyPose(ctx, ox, oy, pose, st, false);
}

function drawScruffyPose(ctx: Ctx, ox: number, oy: number, pose: Pose, st: Style, recoil: boolean) {
  const cx = ox + 26;
  const ground = oy + 54;

  let legL = 0;
  let legR = 0;
  let liftL = 0;
  let liftR = 0;
  let bob = 0;
  let armBack = 0.5;
  let armFront = -0.2;
  let earRot = -1.1;
  let sx = 1;
  let sy = 1;
  const hurt = pose === 'hurt';
  if (pose === 'idle1') {
    sx = 1.04;
    sy = 0.96;
    earRot = -1.0;
  }
  if (pose.startsWith('walk')) {
    const g = gait(+pose.slice(4), 4.8, 2.4);
    [legL, legR, liftL, liftR, bob] = [g.legL, g.legR, g.liftL, g.liftR, g.bob];
    armBack = 0.5 + 0.4 * g.swing;
    armFront = -0.15 - 0.45 * g.swing;
    earRot = -1.1 - 0.15 * g.swing - 0.12 * Math.abs(Math.sin((+pose.slice(4) / 8) * Math.PI * 2)); // ears flop with each step
  }
  if (pose === 'jump') {
    [legL, legR, liftL, liftR] = [-2, 4, 4, 2];
    armBack = -0.6;
    armFront = -1.1;
    earRot = -1.5;
    sx = 0.94;
    sy = 1.06;
  }
  if (pose === 'fall') {
    [legL, legR, liftL, liftR] = [-3, 4, 2, 4];
    armBack = -1.1;
    armFront = -1.4;
    earRot = -0.7;
  }
  if (hurt) {
    armBack = -1.4;
    armFront = -1.7;
    earRot = -0.4;
    sx = 1.08;
    sy = 1.08;
  }

  const r = 11.5;
  const rx = r * sx;
  const ry = r * sy;
  const hipY = ground - 10 + bob;
  const cy = hipY - ry + 2;
  const seed = pose.length * 5 + (pose.charCodeAt(pose.length - 1) % 11) + 900;

  // back arm (or both arms up, carrying something)
  const ca = carry.on ? carryArms('scruffy', ox, oy) : null;
  if (ca) st.shape(ctx, paddlePts(ca.back.x, ca.back.y, ca.back.len, 5, ca.back.rot), SCRUFFY.limb, seed + 1, { lw: 0.8 });
  else st.shape(ctx, paddlePts(cx - rx + 3, cy + 3, 9, 5, Math.PI - armBack), SCRUFFY.limb, seed + 1, { lw: 0.8 });

  const leg = (hx: number, dx: number, lift: number, fill: Fill, s: number) => {
    const fx = cx + hx + dx;
    const fy = ground - 3.6 - lift;
    const top: Pt = [cx + hx, hipY - 3];
    st.line(ctx, [top, [fx, fy]], s, 2.2);
    st.line(ctx, [top, [fx, fy]], s, 1.05, fill.base);
    st.shape(ctx, ellipsePts(fx + 1.2, fy, 4.4, 3.4), fill, s + 3, { lw: 0.8 });
  };
  leg(-4, legL, liftL, SCRUFFY.limb, seed + 2);

  // ear on top
  st.shape(ctx, paddlePts(cx + 3, cy - ry + 3, 9, 6, earRot), SCRUFFY.limb, seed + 3, { lw: 0.8 });

  // round body
  st.shape(ctx, ellipsePts(cx, cy, rx, ry, 0, 44), SCRUFFY.body, seed + 4, { light: [cx - 4, cy - 5] });

  const f = face();
  // muzzle patch (the pale oval from the sketch)
  st.shape(ctx, ellipsePts(cx + 5.5, cy + 3, 5, hurt ? 5 : 4.2, -0.2, 28), SCRUFFY.muzzle, seed + 5, { lw: 0.75, plain: true });
  if (hurt) {
    ctx.fillStyle = st.ink;
    ctx.beginPath();
    ctx.ellipse(cx + 6, cy + 3.5, 1.8, 2.3, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (f.mouth === 'open' || f.mouth === 'o') {
    const [w, h] = f.mouth === 'o' ? [1.1, 1.3] : [2, 1.7];
    st.shape(ctx, ellipsePts(cx + 6.5, cy + 4.6, w, h, 0, 16), { base: '#5a2418', shade: '#3a160e', light: '#7a3424' }, seed + 6, { lw: 0.6, plain: true });
    if (f.mouth === 'open') {
      ctx.fillStyle = '#ef6f86';
      ctx.beginPath();
      ctx.ellipse(cx + 6.7, cy + 5.5, 1.1, 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (f.mouth === 'smile') {
    // a bigger, happier grin
    st.line(ctx, [[cx + 3.2, cy + 3.4], [cx + 6.5, cy + 6.1], [cx + 9.6, cy + 3.1]], seed + 6, 0.65);
  } else {
    st.line(ctx, [[cx + 4, cy + 4], [cx + 6.5, cy + 5.1], [cx + 9, cy + 3.7]], seed + 6, 0.6);
  }

  // two eyes looking up and forward (they can glance about, and blink)
  for (const [ex, ey, s] of [
    [cx + 0.5, cy - 3.2, 1],
    [cx + 7, cy - 4, 2],
  ] as const) {
    const er = hurt ? 3.4 : 2.9;
    if (!hurt && f.blink) {
      st.shape(ctx, ellipsePts(ex, ey, er, er * 1.2, 0, 20), SCRUFFY.body, seed + 10 + s, { lw: 0.7, plain: true });
      st.line(ctx, [[ex - er + 0.5, ey + 0.2], [ex, ey + 1.2], [ex + er - 0.5, ey + 0.2]], seed + 20 + s, 0.6);
      continue;
    }
    st.shape(ctx, ellipsePts(ex, ey, er, er * 1.2, 0, 20), SCRUFFY.eye, seed + 10 + s, { lw: 0.7, plain: true });
    ctx.fillStyle = st.ink;
    ctx.beginPath();
    const lx = hurt ? 0 : f.lookX * 1.1 - 0.2 * (f.lookX < 0 ? 1 : 0);
    const ly = hurt ? 0 : f.lookY * 1.1;
    ctx.ellipse(ex + 0.8 + lx, ey - (hurt ? 0 : 0.8) + ly, hurt ? 0.9 : 1.2, hurt ? 0.9 : 1.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  leg(4, legR, liftR, SCRUFFY.body, seed + 7);

  if (ca) {
    st.shape(ctx, paddlePts(ca.front.x, ca.front.y, ca.front.len, 5, ca.front.rot), SCRUFFY.body, seed + 11, { lw: 0.8 });
    return;
  }
  // a smaller bazooka, held low
  const by = cy + ry - 1.5;
  const kick = recoil ? 2.5 : 0;
  drawBazooka(ctx, st, { x0: cx - 8 - kick, x1: cx + 17 - kick, y: by, h: 5.4, loaded: !recoil, seed: seed + 8 });

  // front arm over the tube
  st.shape(ctx, paddlePts(cx - 3, by - 2.5, 8.5, 5, armFront + 0.25), SCRUFFY.body, seed + 11, { lw: 0.8 });
}
