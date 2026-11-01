/**
 * Collectibles: chicken nuggies (give aura) and root beer bottles (banked).
 * Kept separate from world.ts so character drawing can use them without an
 * import cycle. No module-level style lookups: everything resolves at call time.
 */
import { rng, type Ctx } from './draw';
import { STYLES, roundRectPts, trace, type Fill, type Pt } from './handdrawn';
import { fluffPts } from './baddies';

// ───────────────────────────── collectibles ──

const NUG: Fill = { base: '#f2b04e', shade: '#c97a26', light: '#ffe2a0' };

/** A chicken nuggie: lumpy golden-brown breaded blob with crumbs. Centre (cx, cy), radius r. */
export function drawNuggie(ctx: Ctx, cx: number, cy: number, r: number, bite = 0) {
  const pts = fluffPts(cx, cy, r * 1.25, r * 0.95, 7, 0.1, 1.3);
  let shape = pts;
  if (bite > 0) {
    // a round bite taken out of the right side
    const bx = cx + r * 1.15;
    const by = cy - r * 0.15;
    const br = r * 0.55 * bite + r * 0.25;
    shape = pts.map(([x, y]) => {
      const d = Math.hypot(x - bx, y - by);
      if (d >= br) return [x, y] as Pt;
      const k = br / (d || 1);
      return [bx + (x - bx) * k, by + (y - by) * k] as Pt;
    });
  }
  STYLES.polished.shape(ctx, shape, NUG, 1201, { lw: 0.85, light: [cx - r * 0.5, cy - r * 0.5] });
  // breading crumbs
  const rr = rng(77);
  for (let i = 0; i < 9; i++) {
    const a = rr() * Math.PI * 2;
    const d = rr() * r * 0.8;
    const x = cx + Math.cos(a) * d * 1.2;
    const y = cy + Math.sin(a) * d * 0.85;
    if (bite > 0 && x > cx + r * 0.4) continue;
    ctx.fillStyle = i % 2 ? '#b8681e' : '#ffe2a0';
    ctx.beginPath();
    ctx.ellipse(x, y, 0.9 + rr() * 0.7, 0.7 + rr() * 0.5, rr() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  if (bite > 0) {
    // the white chicken inside the bite
    ctx.save();
    trace(ctx, shape);
    ctx.clip();
    ctx.fillStyle = '#fff3dc';
    ctx.beginPath();
    ctx.arc(cx + r * 1.15, cy - r * 0.15, r * 0.55 * bite + r * 0.25 + 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
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
