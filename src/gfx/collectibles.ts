/**
 * Collectibles: chicken nuggies (give aura) and root beer bottles (banked).
 * Kept separate from world.ts so character drawing can use them without an
 * import cycle. No module-level style lookups: everything resolves at call time.
 */
import { rng, type Ctx } from './draw';
import { STYLES, roundRectPts, type Fill, type Pt } from './handdrawn';

// ───────────────────────────── collectibles ──

/** Irregular nugget outline: low-frequency lumps plus fine crispy bumps. */
function nuggetPts(cx: number, cy: number, r: number, seed: number): Pt[] {
  const rr = rng(seed);
  const p1 = rr() * 6.28;
  const p2 = rr() * 6.28;
  const out: Pt[] = [];
  const n = 90;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    // the classic "boot" / bell nugget silhouette: wider on one side, a little flat on the bottom
    let k = 1 + 0.13 * Math.sin(a * 2 + p1) + 0.07 * Math.sin(a * 3 + p2) + 0.08 * Math.cos(a);
    k += (rr() - 0.5) * 0.06; // crispy breading bumps
    const flat = Math.sin(a) > 0.55 ? 1 - (Math.sin(a) - 0.55) * 0.35 : 1;
    out.push([cx + Math.cos(a) * r * 1.12 * k, cy + Math.sin(a) * r * 0.92 * k * flat]);
  }
  return out;
}

function pathOf(ctx: Ctx, pts: Pt[]) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

/** A chicken nuggie: a fried, golden-brown breaded slab with crispy texture. Centre (cx, cy), radius r. */
export function drawNuggie(ctx: Ctx, cx: number, cy: number, r: number, bite = 0) {
  const ink = STYLES.polished.ink;
  let top = nuggetPts(cx, cy - r * 0.08, r, 4);
  // bite: push outline points out of a round bite on the right
  const bx = cx + r * 1.45;
  const by = cy - r * 0.05;
  const br = bite > 0 ? r * (0.55 + 0.3 * bite) : 0;
  const bitten = (pts: Pt[]) =>
    bite > 0
      ? pts.map(([x, y]) => {
          const d = Math.hypot(x - bx, y - by);
          if (d >= br) return [x, y] as Pt;
          const k = br / (d || 1);
          return [bx + (x - bx) * k, by + (y - by) * k] as Pt;
        })
      : pts;
  top = bitten(top);
  const side = bitten(nuggetPts(cx, cy + r * 0.24, r * 0.97, 4));

  // soft drop shadow
  ctx.fillStyle = '#00000022';
  pathOf(ctx, side.map(([x, y]) => [x + r * 0.08, y + r * 0.16] as Pt));
  ctx.fill();

  // thickness: the darker fried side of the slab
  const sideG = ctx.createLinearGradient(0, cy, 0, cy + r * 1.2);
  sideG.addColorStop(0, '#b8661e');
  sideG.addColorStop(1, '#8a4512');
  ctx.fillStyle = sideG;
  pathOf(ctx, side);
  ctx.fill();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = ink;
  ctx.lineWidth = Math.max(0.8, r * 0.07);
  pathOf(ctx, side);
  ctx.stroke();

  // top surface: golden, lighter in the middle where the breading puffs up
  const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.1, cx, cy, r * 1.5);
  g.addColorStop(0, '#ffe09a');
  g.addColorStop(0.35, '#f5b54f');
  g.addColorStop(0.75, '#df8e2c');
  g.addColorStop(1, '#c06a1c');
  ctx.save();
  pathOf(ctx, top);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.clip();

  // crispy breading: lots of tiny bumps, each with a highlight and a shadow
  const rr = rng(91);
  const bumps = Math.round(55 * (r / 11) ** 1.4);
  for (let i = 0; i < bumps; i++) {
    const a = rr() * Math.PI * 2;
    const d = Math.sqrt(rr()) * r * 1.2;
    const x = cx + Math.cos(a) * d * 1.15;
    const y = cy + Math.sin(a) * d * 0.8;
    const s = r * (0.05 + rr() * 0.09);
    ctx.fillStyle = '#9a4e1255';
    ctx.beginPath();
    ctx.ellipse(x + s * 0.4, y + s * 0.5, s, s * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = rr() < 0.5 ? '#ffe7a8cc' : '#ffd27acc';
    ctx.beginPath();
    ctx.ellipse(x - s * 0.2, y - s * 0.25, s * 0.75, s * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // darker fried spots and little pits
  for (let i = 0; i < 9 * (r / 11); i++) {
    const x = cx + (rr() - 0.5) * r * 2.2;
    const y = cy + (rr() - 0.5) * r * 1.4;
    ctx.fillStyle = '#a8561a66';
    ctx.beginPath();
    ctx.ellipse(x, y, r * (0.1 + rr() * 0.12), r * (0.07 + rr() * 0.08), rr() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // a darker rim where the breading browned most
  ctx.strokeStyle = '#a8561a88';
  ctx.lineWidth = r * 0.22;
  pathOf(ctx, top);
  ctx.stroke();
  // glossy fried sheen
  ctx.fillStyle = '#fff6d888';
  ctx.beginPath();
  ctx.ellipse(cx - r * 0.45, cy - r * 0.42, r * 0.38, r * 0.14, -0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (bite > 0) {
    // the white chicken inside the bite, with a few fibres
    ctx.save();
    pathOf(ctx, side);
    ctx.clip();
    ctx.fillStyle = '#fff3dc';
    ctx.beginPath();
    ctx.arc(bx, by, br + r * 0.13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ead6b4';
    ctx.lineWidth = Math.max(0.5, r * 0.04);
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(bx, by, br + r * (0.05 + i * 0.03), Math.PI * 0.7, Math.PI * 1.3);
      ctx.stroke();
    }
    ctx.restore();
  }

  // outline of the top surface
  ctx.strokeStyle = ink;
  ctx.lineWidth = Math.max(0.8, r * 0.07);
  pathOf(ctx, top);
  ctx.stroke();
}

/** A root beer bottle: brown glass, cream label with a "RB" badge, red cap. Bottom-centre (cx, by), height ~h. */
export function drawRootBeer(ctx: Ctx, cx: number, by: number, h: number) {
  const k = h / 30;
  const P = (x: number, y: number): Pt => [cx + x * k, by - y * k];
  const glass: Fill = { base: '#7a3e1c', shade: '#4e2410', light: '#c47a4a' };
  const body: Pt[] = [P(-5, 0), P(5, 0), P(5.6, 2), P(5.6, 15), P(4, 18.5), P(2, 21), P(2, 26), P(-2, 26), P(-2, 21), P(-4, 18.5), P(-5.6, 15), P(-5.6, 2)];
  STYLES.polished.shape(ctx, body, glass, 1301, { lw: 0.85, light: P(-2.5, 12) });
  // cap
  STYLES.polished.shape(ctx, roundRectPts(cx - 2.8 * k, by - 29.5 * k, 5.6 * k, 4 * k, 1 * k), { base: '#e8463f', shade: '#b02f2a', light: '#ff9a8f' }, 1302, { lw: 0.7, plain: true });
  // label
  STYLES.polished.shape(ctx, roundRectPts(cx - 5.6 * k, by - 13 * k, 11.2 * k, 8 * k, 1.2 * k), { base: '#fff1d6', shade: '#ead2a8', light: '#ffffff' }, 1303, { lw: 0.6, plain: true });
  ctx.fillStyle = '#7a3e1c';
  ctx.font = `900 ${5.2 * k}px "Lilita One", "Arial Black", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('RB', cx, by - 8.8 * k);
  // shine
  ctx.fillStyle = '#ffffff66';
  ctx.fillRect(cx - 4 * k, by - 4 * k, 1.2 * k, 3 * k);
  ctx.fillRect(cx - 3.6 * k, by - 18 * k, 1 * k, 3.5 * k);
}
