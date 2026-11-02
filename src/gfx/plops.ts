/**
 * The Plops (World 2: Plop Invasion), from the sketches: little poo guys.
 * A wide squashy bottom tier, a smaller dome on top with big oval googly eyes
 * and slit pupils, a pointy swirl tip curling up, leaf-shaped arms sticking
 * out, and two dark legs with curled-up feet. Some have a toothy shouting
 * mouth; the boss Plop wears a little gold crown. Drawn facing LEFT.
 * Frame 96 × 104, feet on y = 100.
 */
import type { Ctx } from './draw';
import { ellipsePts, type Fill, type Pt, type Style } from './handdrawn';

export type PlopFrame = 'idle' | 'run0' | 'run1' | 'yell0' | 'yell1';
export const PLOP_FRAMES: PlopFrame[] = ['idle', 'run0', 'run1', 'yell0', 'yell1'];
export const PLOP_W = 96;
export const PLOP_H = 104;

const BODY: Fill = { base: '#8b5434', shade: '#5f3520', light: '#b98058' };
const LEG: Fill = { base: '#6e3f25', shade: '#4a2716', light: '#9a6440' };
const EYE: Fill = { base: '#ffffff', shade: '#ece4dc', light: '#ffffff' };
const GOLD: Fill = { base: '#ffd23f', shade: '#d9a316', light: '#fff2a8' };

function leg(ctx: Ctx, st: Style, x: number, top: number, ground: number, dx: number, lift: number, seed: number) {
  const fy = ground - 3 - lift;
  const fx = x + dx;
  const pts: Pt[] = [
    [x - 4, top],
    [x + 4, top],
    [fx + 3.6, fy - 6],
    [fx + 1, fy + 1],
    [fx - 9, fy + 2],
    [fx - 10, fy - 3],
    [fx - 5, fy - 4],
    [fx - 3, fy - 7],
  ];
  st.shape(ctx, pts, LEG, seed, { lw: 1 });
}

export function drawPlop(ctx: Ctx, ox: number, oy: number, f: PlopFrame, st: Style, crowned = false) {
  const ground = oy + 100;
  const cx = ox + 50;
  const run = f === 'run0' || f === 'run1';
  const yell = f === 'yell0' || f === 'yell1';
  const bob = f === 'run1' || f === 'yell1' ? -3 : 0;
  const stride = f === 'run0' ? 7 : f === 'run1' ? -7 : 0;

  // legs (behind the body)
  const botY = ground - 30 + bob;
  leg(ctx, st, cx + 10, botY + 8, ground, -stride, stride < 0 ? 4 : 0, 2001);
  leg(ctx, st, cx - 12, botY + 8, ground, stride, stride > 0 ? 4 : 0, 2002);

  // leaf-shaped arms out to the sides (waving up when yelling)
  const arm = (x: number, y: number, ang: number, seed: number) => {
    const len = 22;
    const tip: Pt = [x + Math.cos(ang) * len, y + Math.sin(ang) * len];
    const nx = -Math.sin(ang) * 6;
    const ny = Math.cos(ang) * 6;
    st.shape(ctx, [[x, y], [x + Math.cos(ang) * len * 0.5 + nx, y + Math.sin(ang) * len * 0.5 + ny], tip, [x + Math.cos(ang) * len * 0.5 - nx, y + Math.sin(ang) * len * 0.5 - ny]], BODY, seed, { lw: 1 });
  };
  const wave = f === 'yell1' ? 0.35 : 0;
  arm(cx - 30, botY - 4, Math.PI + (yell ? 0.95 + wave : run ? 0.45 : 0.75), 2010);
  arm(cx + 30, botY - 4, yell ? -0.95 - wave : run ? -0.3 : -0.75, 2011);

  // top tier: a smaller dome (behind the bottom tier, like the sketch), with the swirl tip
  const topY = botY - 27;
  st.shape(ctx, [[cx - 8, topY - 12], [cx + 2, topY - 34], [cx + 12, topY - 44], [cx + 10, topY - 30], [cx + 14, topY - 12]], BODY, 2030, { lw: 1.2, light: [cx + 4, topY - 26] });
  st.shape(ctx, ellipsePts(cx + 1, topY + 2, 26, 19, 0, 36), BODY, 2031, { lw: 1.3, light: [cx - 8, topY - 7] });
  // bottom tier: a wide squashy oval in front
  st.shape(ctx, ellipsePts(cx, botY, 35, 21, 0, 40), BODY, 2020, { lw: 1.3, light: [cx - 12, botY - 8] });

  // big googly eyes with slit pupils (looking left, the way they face)
  for (const [ex, er, s] of [[cx - 10, 9, 1], [cx + 11, 8.4, 2]] as const) {
    st.shape(ctx, ellipsePts(ex, topY - 3, er * 0.82, er, 0, 24), EYE, 2040 + s, { lw: 1 });
    ctx.fillStyle = st.ink;
    ctx.beginPath();
    ctx.ellipse(ex - 2.4, topY - 3 + (yell ? -1 : 1), 1.5, er * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (yell) {
    // angry brows
    st.line(ctx, [[cx - 19, topY - 15], [cx - 4, topY - 10]], 2045, 1.3);
    st.line(ctx, [[cx + 3, topY - 10], [cx + 19, topY - 15]], 2046, 1.3);
  }

  // mouth on the bottom tier: a shouting toothy "POOPA!" or a flat little line
  if (yell) {
    const open = f === 'yell0' ? 11 : 8;
    const m = ellipsePts(cx - 4, botY + 2, 12, open, 0, 28);
    st.shape(ctx, m, { base: '#fdf8ee', shade: '#e4d8c4', light: '#ffffff' }, 2050, { lw: 1.1 });
    // zig-zag teeth top and bottom
    const zig = (y: number, dir: number): Pt[] => Array.from({ length: 7 }, (_, i) => [cx - 14 + i * 3.4, y + (i % 2 ? dir * 3.6 : 0)] as Pt);
    st.line(ctx, zig(botY + 2 - open + 3, 1), 2051, 0.8);
    st.line(ctx, zig(botY + 2 + open - 3, -1), 2052, 0.8);
  } else {
    st.line(ctx, [[cx - 12, botY + 4], [cx - 4, botY + 5], [cx + 6, botY + 4]], 2050, 1.1);
  }

  if (crowned) {
    const by = topY - 14;
    st.shape(ctx, [[cx - 14, by + 2], [cx - 15, by - 13], [cx - 7, by - 4], [cx, by - 16], [cx + 7, by - 4], [cx + 15, by - 13], [cx + 14, by + 2]], GOLD, 2060, { lw: 1, light: [cx - 4, by - 8] });
  }
}
