/**
 * Big Muscles, drawn from the original sketch: the third hero, a bit taller
 * than Puffy. Round orange body, big round eyes, a huge open grin, a little
 * tuft of hair, lumpy muscly arms and long thick legs with curled feet.
 * He flexes one arm and carries the bazooka with the other.
 */
import type { Ctx, Pose } from './draw';
import { ellipsePts, roundRectPts, type Fill, type Pt, type Style } from './handdrawn';
import { PUFFY } from './puffy';

export const MUSCLES = {
  body: { base: '#ec7b2b', shade: '#c0561a', light: '#ffb06a' } as Fill,
  limb: { base: '#e06f22', shade: '#ad4c14', light: '#ffa257' } as Fill,
  eye: { base: '#ffffff', shade: '#e6ddd0', light: '#ffffff' } as Fill,
  mouth: { base: '#fffaf0', shade: '#eadfcd', light: '#ffffff' } as Fill,
};

/** A muscly arm as three lumps (shoulder, bicep/forearm, fist) along a bent path. */
function arm(ctx: Ctx, st: Style, pts: [Pt, Pt, Pt], sizes: [number, number, number], f: Fill, seed: number) {
  pts.forEach(([x, y], i) => {
    const r = sizes[i];
    const next = pts[Math.min(i + 1, 2)];
    const prev = pts[Math.max(i - 1, 0)];
    const rot = Math.atan2(next[1] - prev[1], next[0] - prev[0]);
    st.shape(ctx, ellipsePts(x, y, r * (i === 2 ? 1 : 1.3), r, rot, 24), f, seed + i, { lw: 0.8 });
  });
}

/** Frame is 56×56 units, feet on y = 54. */
export function drawMusclesStyled(ctx: Ctx, ox: number, oy: number, pose: Pose, st: Style) {
  const cx = ox + 27;
  const ground = oy + 54;

  let legL = 0;
  let legR = 0;
  let liftL = 0;
  let liftR = 0;
  let bob = 0;
  let flex = 0; // 0 = flexing at shoulder height, 1 = arm thrown up high
  let sx = 1;
  let sy = 1;
  const hurt = pose === 'hurt';
  if (pose === 'idle1') {
    sx = 1.03;
    sy = 0.97;
    flex = 0.15;
  }
  if (pose.startsWith('walk')) {
    const f = +pose.slice(4);
    [legL, legR, liftL, liftR] = [
      [6, -5, 0, 3],
      [2, -2, 0, 0],
      [-5, 6, 3, 0],
      [-2, 2, 0, 0],
    ][f];
    bob = f % 2 ? -1.5 : 0;
    flex = f < 2 ? 0.25 : 0;
  }
  if (pose === 'jump') {
    [legL, legR, liftL, liftR] = [-3, 4, 5, 2];
    flex = 1;
    sx = 0.96;
    sy = 1.04;
  }
  if (pose === 'fall') {
    [legL, legR, liftL, liftR] = [-4, 5, 2, 5];
    flex = 0.7;
  }
  if (hurt) flex = 1;

  const rx = 12.5 * sx;
  const ry = 14.5 * sy;
  const hipY = ground - 19 + bob;
  const cy = hipY - ry + 3;
  const seed = pose.length * 3 + (pose.charCodeAt(pose.length - 1) % 17) + 1300;

  // flexing back arm: shoulder → forearm up → fist
  const shoulder: Pt = [cx - rx + 1, cy + 2];
  const elbow: Pt = [cx - rx - 5.5, cy - 1 - flex * 3];
  const fist: Pt = [cx - rx - 5 + flex * 1.5, cy - 8.5 - flex * 4];
  arm(ctx, st, [shoulder, elbow, fist], [4.2, 4.6, 3.6], MUSCLES.limb, seed + 1);

  // long thick legs with curled feet
  const leg = (hx: number, dx: number, lift: number, fill: Fill, s: number) => {
    const fx = cx + hx + dx;
    const fy = ground - 4 - lift;
    const top: Pt = [cx + hx, hipY - 4];
    const w = 3.4;
    st.shape(ctx, [[top[0] - w, top[1]], [top[0] + w, top[1]], [fx + w * 0.85, fy], [fx - w * 0.85, fy]], fill, s, { lw: 0.85 });
    // curled foot pointing forward
    st.shape(ctx, ellipsePts(fx + 2.5, fy + 0.4, 6, 3.8, -0.15, 24), fill, s + 3, { lw: 0.85 });
  };
  leg(-5, legL, liftL, MUSCLES.limb, seed + 2);

  // body
  st.shape(ctx, ellipsePts(cx, cy, rx, ry, 0, 48), MUSCLES.body, seed + 4, { light: [cx - 4, cy - 6] });

  // little tuft of hair (the arc on top of his head)
  st.line(ctx, [[cx - 7, cy - ry + 1], [cx - 1, cy - ry - 3.5], [cx + 6, cy - ry - 1.5]], seed + 5, 0.9);

  // big round eyes
  for (const [ex, ey, s] of [
    [cx + 0.5, cy - 4, 1],
    [cx + 8.5, cy - 4.5, 2],
  ] as const) {
    const er = hurt ? 4.2 : 3.8;
    st.shape(ctx, ellipsePts(ex, ey, er, er * 1.1, 0, 24), MUSCLES.eye, seed + 6 + s, { lw: 0.75, plain: true });
    ctx.fillStyle = st.ink;
    ctx.beginPath();
    ctx.ellipse(ex + 1, ey + 0.4, hurt ? 0.8 : 1.2, hurt ? 0.8 : 1.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // huge open grin (a "D" turned on its side), or an "O" when hurt
  const mx = cx + 3.5;
  const my = cy + 4;
  let mouth: Pt[];
  if (hurt) mouth = ellipsePts(mx, my + 1, 3.6, 4.2, 0, 24);
  else {
    mouth = [[mx - 6, my - 1.2]];
    for (let i = 0; i <= 14; i++) {
      const a = (i / 14) * Math.PI;
      mouth.push([mx - Math.cos(a) * 6, my - 1.2 + Math.sin(a) * 5.6]);
    }
    mouth.push([mx + 6, my - 1.2]);
  }
  st.shape(ctx, mouth, MUSCLES.mouth, seed + 9, { lw: 0.85, plain: true });
  if (!hurt) {
    // tongue peeking at the bottom of the grin
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(mx + 0.5, my + 4.4, 3.4, 1.6, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#ef6f86';
    ctx.fill();
    ctx.restore();
  }

  leg(5, legR, liftR, MUSCLES.body, seed + 10);

  // the big bazooka (heavy hitter)
  const by = cy + ry - 1;
  const bx0 = cx - 12;
  const bx1 = cx + 25;
  st.shape(ctx, roundRectPts(bx0, by - 4, bx1 - bx0, 8, 3.5), PUFFY.tube, seed + 11, { lw: 0.85 });
  st.shape(ctx, roundRectPts(bx1 - 3.5, by - 5.4, 5.5, 10.8, 2), PUFFY.tubeDark, seed + 12, { lw: 0.85, plain: true });
  st.shape(ctx, roundRectPts(bx0 - 3, by - 5.4, 4.5, 10.8, 1.8), PUFFY.tubeDark, seed + 13, { lw: 0.85, plain: true });

  // front arm: bicep bulging over the tube, fist on the grip
  // (kept to the far edge of the body so the big grin stays visible)
  arm(ctx, st, [[cx + rx + 0.5, cy + 2], [cx + rx + 4, by - 5], [cx + rx + 1, by + 0.5]], [3.8, 4.2, 3.3], MUSCLES.body, seed + 14);
}
