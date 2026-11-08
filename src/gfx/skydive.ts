/**
 * Plop Invasion · Part 2's parachute drops: the heroes' parachutes (a big dome in each hero's own
 * colours, opening, steering, landing) and the Plops' (patched-up, flies buzzing round them; a big
 * slow one, a scruffy middling one, and a little streamer for the ones that come down fast).
 *
 * Units: the hero's usual 56 × 56 box (feet at y = 54). The canopy hangs above, its lines running
 * down to the hero's shoulders through a harness; hands stay free (the bazooka still fires).
 */
import { drawCharacter, type Ctx, type Pose } from './draw';
import { STYLES, ellipsePts, type Fill, type Pt } from './handdrawn';
import { drawPlop, type PlopFrame, type PlopKind } from './plops';
import type { CharacterDef } from '../data/characters';

const ST = STYLES.polished;
const INK = ST.ink;

/** A canopy's two colours (panels alternate) and its trim. */
export interface CanopyLook {
  a: Fill;
  b: Fill;
  /** The vent cap on top and the hem's tape. */
  trim: string;
  /** Patched up and grubby (the Plops'): stitched patches, a hole or two, stains. */
  grubby?: boolean;
}

const F = (base: string, shade: string, light: string): Fill => ({ base, shade, light });
const CREAM = F('#fff6e6', '#e6d3b8', '#ffffff');

/** Each hero's parachute, in their own colours (they're all orange heroes: the canopies tell them apart). */
export const HERO_CANOPY: Record<string, CanopyLook> = {
  // Puffy: their own orange and cream, green trim (the bazooka's green)
  puffy: { a: F('#f28a2e', '#c9611a', '#ffc27a'), b: CREAM, trim: '#6fae63' },
  // Scruffy: sky blue and cream, a sunny yellow trim
  scruffy: { a: F('#4fb3e8', '#2b80b8', '#9ad8fa'), b: CREAM, trim: '#ffd23f' },
  // Big Muscles: champion red and white, gold trim
  muscles: { a: F('#e8484a', '#b52a2e', '#ff8c86'), b: F('#ffffff', '#e2dcd6', '#ffffff'), trim: '#ffc83a' },
};

/** The Plops' parachutes: grubby browns and mustard, patched up. */
export const PLOP_CANOPY: Record<'slow' | 'mid', CanopyLook> = {
  slow: { a: F('#9a6a3a', '#6b4422', '#c99a62'), b: F('#e0b85a', '#b08a34', '#f6d88a'), trim: '#5a3a1c', grubby: true },
  mid: { a: F('#7d8a3c', '#56611f', '#a8b468'), b: F('#c9a46a', '#9a7840', '#e6c890'), trim: '#4a3418', grubby: true },
};

/**
 * A parachute canopy: a dome of gores seen from a little below (the hem curves down towards you,
 * scalloped between the lines), shaded, seams inked, a vent cap on top and a shine.
 * (cx, top): the apex. `open` 0..1: 0 a crumpled bundle just catching air, 1 fully open.
 * Returns where each line meets the hem (left to right).
 */
export function drawCanopy(ctx: Ctx, cx: number, top: number, w: number, h: number, look: CanopyLook, open = 1, seed = 1): Pt[] {
  const N = 8;
  const r = rand(seed);
  const o = Math.max(0, Math.min(1, open));
  // (half open: narrower, flatter and lumpy, the hem flapping)
  const W = w * (0.42 + 0.58 * o);
  const H = h * (0.55 + 0.45 * o);
  const hemY = top + H;
  const dip = 5 * (0.4 + 0.6 * o); // how far the hem curves down at the middle (seen from below)
  const flap = (1 - o) * 6;
  const hem: Pt[] = [];
  for (let i = 0; i <= N; i++) {
    const t = Math.PI - (i / N) * Math.PI;
    hem.push([cx + Math.cos(t) * W + (r() - 0.5) * flap, hemY + Math.sin(t) * dip + (r() - 0.5) * flap * 1.4]);
  }
  /** A seam from the apex to hem point i, bulging out (a dome). */
  const seam = (i: number): Pt[] => {
    const [hx, hy] = hem[i];
    const k = (i / N) * 2 - 1; // -1 … 1 across
    const bulge = 1.12 + 0.06 * o;
    const pts: Pt[] = [];
    for (let s = 0; s <= 8; s++) {
      const u = s / 8;
      // a quadratic from the apex, through a control point out wide and two-fifths of the way down
      const c: Pt = [cx + (hx - cx) * bulge, top + (hy - top) * 0.38 - Math.abs(k) * 2];
      const x = (1 - u) * (1 - u) * cx + 2 * (1 - u) * u * c[0] + u * u * hx;
      const y = (1 - u) * (1 - u) * (top + 0.5) + 2 * (1 - u) * u * c[1] + u * u * hy;
      pts.push([x, y]);
    }
    return pts;
  };
  const seams = hem.map((_, i) => seam(i));
  // the inside of the canopy, glimpsed under the hem (darker): behind the panels
  {
    const under: Pt[] = [...hem.map(([x, y]) => [x, y - 0.5] as Pt)];
    for (let i = N; i >= 0; i--) {
      const [x, y] = hem[i];
      under.push([x + (cx - x) * 0.08, y - dip * 1.5 - 2]);
    }
    ST.shape(ctx, under, { base: look.a.shade, shade: shadeOf(look.a.shade), light: look.a.base }, seed + 3, { lw: 0.7, plain: true });
  }
  // the gores: alternating colours; each one a seam down, the scalloped hem across, the next seam up
  for (let i = 0; i < N; i++) {
    const l = seams[i];
    const rr = seams[i + 1];
    const [x0, y0] = hem[i];
    const [x1, y1] = hem[i + 1];
    const mid: Pt = [(x0 + x1) / 2, Math.max(y0, y1) + 2.6 + (1 - o) * 1.5];
    const pts: Pt[] = [...l, mid, ...[...rr].reverse()];
    const fill = i % 2 === 0 ? look.a : look.b;
    ST.shape(ctx, pts, fill, seed + 10 + i, { lw: 0.8, light: [cx - W * 0.45, top + 2] });
  }
  // shading: the far edges turn away from the light; a shine across the top-left
  ctx.save();
  const dome = new Path2D();
  dome.moveTo(cx, top);
  for (const p of seams[0]) dome.lineTo(p[0], p[1]);
  for (let i = 0; i < N; i++) dome.lineTo(hem[i + 1][0], hem[i + 1][1] + 2.6);
  for (const p of [...seams[N]].reverse()) dome.lineTo(p[0], p[1]);
  dome.closePath();
  ctx.clip(dome);
  const g = ctx.createLinearGradient(cx - W, 0, cx + W, 0);
  g.addColorStop(0, '#3a241838');
  g.addColorStop(0.3, '#3a241800');
  g.addColorStop(0.7, '#3a241800');
  g.addColorStop(1, '#3a241855');
  ctx.fillStyle = g;
  ctx.fillRect(cx - W - 4, top - 4, W * 2 + 8, H + 14);
  const v = ctx.createLinearGradient(0, top, 0, hemY + dip);
  v.addColorStop(0, '#ffffff00');
  v.addColorStop(0.75, '#ffffff00');
  v.addColorStop(1, '#3a24182a');
  ctx.fillStyle = v;
  ctx.fillRect(cx - W - 4, top - 4, W * 2 + 8, H + 14);
  ctx.fillStyle = '#ffffff66';
  ctx.beginPath();
  ctx.ellipse(cx - W * 0.32, top + H * 0.26, W * 0.34, H * 0.11, -0.32, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff3a';
  ctx.beginPath();
  ctx.ellipse(cx + W * 0.1, top + H * 0.14, W * 0.16, H * 0.06, -0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (look.grubby) grubby(ctx, cx, top, W, H, seed);
  // the hem tape
  for (let i = 0; i < N; i++) {
    const [x0, y0] = hem[i];
    const [x1, y1] = hem[i + 1];
    ST.line(ctx, [[x0, y0 + 0.4], [(x0 + x1) / 2, Math.max(y0, y1) + 2.8 + (1 - o) * 1.5], [x1, y1 + 0.4]], seed + 40 + i, 0.9, look.trim);
  }
  // the vent cap
  ST.shape(ctx, ellipsePts(cx, top + 1.6, W * 0.11, 2.3, 0, 18), { base: look.trim, shade: shadeOf(look.trim), light: '#ffffff' }, seed + 60, { lw: 0.7 });
  return hem.map(([x, y]) => [x, y + 0.6] as Pt);
}

/** Patches, stitches, a hole and stains (a Plop's parachute has seen some things). */
function grubby(ctx: Ctx, cx: number, top: number, W: number, H: number, seed: number) {
  const r = rand(seed + 7);
  // stains
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = '#4a2c1426';
    ctx.beginPath();
    ctx.ellipse(cx + (r() - 0.5) * W * 1.3, top + H * (0.35 + r() * 0.5), 3 + r() * 5, 2 + r() * 3, r() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // two stitched patches
  for (let i = 0; i < 2; i++) {
    const px = cx + (i ? 0.35 : -0.42) * W + (r() - 0.5) * 6;
    const py = top + H * (0.42 + r() * 0.2);
    const s = 5 + r() * 3;
    const pts: Pt[] = [[px - s, py - s * 0.8], [px + s, py - s * 0.9], [px + s * 1.1, py + s * 0.8], [px - s * 0.9, py + s * 0.9]];
    ST.shape(ctx, pts, i ? F('#c9b07a', '#9f8650', '#e8d4a2') : F('#8a9a5a', '#62703a', '#b4c286'), seed + 70 + i, { lw: 0.6, plain: true });
    // stitches round the edge
    ctx.strokeStyle = '#3a2418aa';
    ctx.lineWidth = 0.5;
    for (let k = 0; k < 4; k++) {
      const [ax, ay] = pts[k];
      const [bx, by] = pts[(k + 1) % 4];
      for (let q = 1; q < 4; q++) {
        const u = q / 4;
        const x = ax + (bx - ax) * u;
        const y = ay + (by - ay) * u;
        ctx.beginPath();
        ctx.moveTo(x - 0.9, y - 0.9);
        ctx.lineTo(x + 0.9, y + 0.9);
        ctx.stroke();
      }
    }
  }
  // a little torn hole (sky through it)
  const hx = cx + W * 0.12;
  const hy = top + H * 0.3;
  ctx.fillStyle = '#2a1a10';
  ctx.beginPath();
  ctx.moveTo(hx - 3, hy);
  ctx.lineTo(hx - 1, hy - 2.2);
  ctx.lineTo(hx + 2.4, hy - 1.4);
  ctx.lineTo(hx + 3, hy + 1.2);
  ctx.lineTo(hx, hy + 2.2);
  ctx.closePath();
  ctx.fill();
}

/** The lines from the hem down to two risers that meet the harness at the shoulders. */
function drawLines(ctx: Ctx, hem: Pt[], l: Pt, rr: Pt, seed: number) {
  const N = hem.length - 1;
  // the risers: where the lines gather, a little above the shoulders
  const gl: Pt = [l[0] - 1, l[1] - 9];
  const gr: Pt = [rr[0] + 1, rr[1] - 9];
  for (let i = 0; i <= N; i++) {
    const g = i <= N / 2 ? gl : gr;
    ST.line(ctx, [hem[i], g], seed + i, 0.38, '#5a4636');
  }
  ST.line(ctx, [gl, l], seed + 30, 1.0, '#4a3a2e');
  ST.line(ctx, [gr, rr], seed + 31, 1.0, '#4a3a2e');
}

/**
 * Where the lines clip on (the rings at either side of the body, clear of the face) and the belt
 * across the hips (below the bazooka), per hero (units, facing right at ox = oy = 0; measured from
 * the falling pose's outline).
 */
const HARNESS: Record<string, { l: Pt; r: Pt; belt: number; bx: [number, number] }> = {
  puffy: { l: [13, 23], r: [41, 23], belt: 41, bx: [17, 44] },
  scruffy: { l: [16, 28], r: [36, 27], belt: 49, bx: [16, 38] },
  muscles: { l: [9, 19], r: [41, 21], belt: 44, bx: [15, 46] },
};

/** The harness: straps down either side of the body, a belt across the hips with a buckle, a ring at each clip. */
function drawHarness(ctx: Ctx, id: string, seed: number) {
  const h = HARNESS[id] ?? HARNESS.puffy;
  const strap = '#3c5a8a';
  const [lx, ly] = h.l;
  const [rx, ry] = h.r;
  const [b0, b1] = h.bx;
  ST.line(ctx, [[lx, ly], [lx - 0.5, (ly + h.belt) / 2], [b0 + 1, h.belt]], seed, 1.3, strap);
  ST.line(ctx, [[rx, ry], [rx + 1, (ry + h.belt) / 2], [b1 - 1, h.belt]], seed + 1, 1.3, strap);
  ST.line(ctx, [[b0, h.belt], [(b0 + b1) / 2, h.belt + 1.2], [b1, h.belt]], seed + 2, 1.5, strap);
  const mx = (b0 + b1) / 2;
  ST.shape(ctx, [[mx - 2.4, h.belt - 1.4], [mx + 2.4, h.belt - 1.4], [mx + 2.4, h.belt + 2.6], [mx - 2.4, h.belt + 2.6]], F('#ffd23f', '#c99a1a', '#fff2a8'), seed + 4, { lw: 0.5, plain: true });
  for (const [x, y] of [h.l, h.r]) ST.shape(ctx, ellipsePts(x, y, 1.9, 1.9, 0, 12), F('#d9dde2', '#9aa3ad', '#ffffff'), seed + 5 + x, { lw: 0.5, plain: true });
}

/** How a hero's parachute is doing. */
export type ChuteState =
  /** The pack, a little pilot chute just pulling the bag out. */
  | 'pack'
  /** Bursting open (crumpled, flapping). */
  | 'burst'
  /** Nearly there. */
  | 'opening'
  /** Full and floating down. */
  | 'open'
  /** Steering: leaning into a turn (with `lean` -1 … 1). */
  | 'steer'
  /** Touched down: the canopy sags over to one side and collapses. */
  | 'land';

/**
 * A hero under their parachute. Drawn in the hero's 56 × 56 box (feet at y = 54); the canopy goes up
 * to about y = −84 above it. `lean` tips the whole rig (and swings the hero a little the other way).
 */
export function drawHeroChute(ctx: Ctx, ch: CharacterDef, pose: Pose, state: ChuteState, lean = 0, seed = 5) {
  const look = HERO_CANOPY[ch.id] ?? HERO_CANOPY.puffy;
  const h = HARNESS[ch.id] ?? HARNESS.puffy;
  const midX = (h.l[0] + h.r[0]) / 2;
  const sh = Math.min(h.l[1], h.r[1]);
  const open = state === 'burst' ? 0.25 : state === 'opening' ? 0.7 : state === 'land' ? 0.55 : 1;
  ctx.save();
  // the whole rig swings round the hero's shoulders
  ctx.translate(midX, sh);
  ctx.rotate(lean * 0.22);
  ctx.translate(-midX, -sh);
  if (state === 'pack') {
    // the bag and its little pilot chute streaming up out of the pack
    const bx = midX - 2;
    const by = sh - 18;
    ST.line(ctx, [h.l, [bx, by + 8]], seed, 0.6, '#5a4636');
    ST.line(ctx, [h.r, [bx + 3, by + 8]], seed + 1, 0.6, '#5a4636');
    // the bag, pulled out and streaming up, its little pilot chute catching the air
    ST.shape(ctx, [[bx - 5, by - 6], [bx + 7, by - 7], [bx + 8, by + 9], [bx - 4, by + 9]], look.a, seed + 2, { lw: 0.8 });
    ST.line(ctx, [[bx + 1, by - 6], [bx + 3, by - 22]], seed + 3, 0.5, '#5a4636');
    drawCanopy(ctx, bx + 3, by - 38, 13, 13, look, 0.9, seed + 4);
  } else if (state === 'land') {
    // sagging over to the side, collapsing
    // (behind the hero: flopping down onto the ground)
    ctx.save();
    ctx.translate(midX - 16, 52);
    ctx.rotate(-1.2);
    drawCanopy(ctx, 0, -46, 34, 28, look, 0.45, seed);
    ctx.restore();
    ST.line(ctx, [h.l, [midX - 18, sh + 6], [midX - 30, 40]], seed + 7, 0.6, '#5a4636');
    ST.line(ctx, [h.r, [midX - 8, sh + 2], [midX - 26, 30]], seed + 8, 0.6, '#5a4636');
  } else {
    const W = 60;
    const H = 46;
    const top = sh - 34 - H * (0.55 + 0.45 * open);
    const hem = drawCanopy(ctx, midX, top, W, H, look, open, seed);
    drawLines(ctx, hem, h.l, h.r, seed + 20);
  }
  // the hero (swinging back a touch against the lean), then the harness over them
  ctx.save();
  ctx.translate(midX, sh);
  ctx.rotate(-lean * 0.12);
  ctx.translate(-midX, -sh);
  drawCharacter(ctx, 0, 0, ch, pose);
  drawHarness(ctx, ch.id, seed + 50);
  ctx.restore();
  ctx.restore();
}

/**
 * A Plop coming down by parachute (in its 96 × 104 box, feet at y ≈ 100):
 *  - 'slow': a big patched dome, a fly or two, a happy grin (taking its time)
 *  - 'mid':  an olive patched canopy, yelling POOPA
 *  - 'fast': just a little streamer chute, flapping, coming down fast (speed lines)
 *  - 'popped': hit: the canopy torn and flapping, the Plop dropping out of the sky
 */
export function drawPlopChute(ctx: Ctx, kind: PlopKind, how: 'slow' | 'mid' | 'fast' | 'popped', seed = 3) {
  const cx = 48;
  // (the lines clip on at either side of the body; a belt round its middle)
  const grip: [Pt, Pt] = [[20, 64], [76, 64]];
  const frame: PlopFrame = how === 'slow' ? 'grin' : how === 'mid' ? 'yell0' : how === 'fast' ? 'yell1' : 'hurt';
  if (how === 'fast') {
    // speed lines streaming up past it
    ctx.save();
    ctx.lineCap = 'round';
    const r = rand(seed);
    for (let i = 0; i < 9; i++) {
      const x = 6 + r() * 84;
      ctx.strokeStyle = i % 2 ? '#ffffffb0' : '#3a241840';
      ctx.lineWidth = 1.2 + r() * 1.6;
      ctx.beginPath();
      ctx.moveTo(x, -70 + r() * 30);
      ctx.lineTo(x, 20 + r() * 40);
      ctx.stroke();
    }
    ctx.restore();
    // a parachute that hasn't opened properly: a long flapping streamer, ribbons whipping off it
    const look = PLOP_CANOPY.mid;
    ST.line(ctx, [[cx + 6, -60], [cx - 8, -84], [cx + 10, -104], [cx - 2, -124]], seed + 5, 1.8, look.trim);
    ST.line(ctx, [[cx + 12, -58], [cx + 26, -82], [cx + 16, -102]], seed + 6, 1.4, '#c9a46a');
    const hem = drawCanopy(ctx, cx + 4, -78, 54, 72, look, 0.06, seed + 3);
    drawLines(ctx, hem, grip[0], grip[1], seed + 20);
  } else if (how === 'popped') {
    // torn: a few flapping rags of canopy on tangled lines
    const look = PLOP_CANOPY.mid;
    // slack, tangled lines up to a few torn rags of canopy, flapping
    ST.line(ctx, [grip[0], [cx - 22, 40], [cx - 30, 18]], seed + 1, 0.45, '#5a4636');
    ST.line(ctx, [grip[1], [cx + 20, 44], [cx + 28, 20]], seed + 2, 0.45, '#5a4636');
    ST.line(ctx, [[cx - 6, 50], [cx - 2, 30], [cx + 4, 14]], seed + 3, 0.45, '#5a4636');
    const rag = (x: number, y: number, w: number, f: Fill, sd: number, tilt: number) => {
      const pts: Pt[] = [];
      for (let k = 0; k <= 8; k++) {
        const a = Math.PI + (k / 8) * Math.PI;
        const jag = k % 2 ? 0.55 : 1;
        pts.push([x + Math.cos(a + tilt) * w * jag, y + Math.sin(a + tilt) * w * 0.7 * jag]);
      }
      pts.push([x + w * 0.5, y + w * 0.3], [x, y + w * 0.12], [x - w * 0.5, y + w * 0.35]);
      ST.shape(ctx, pts, f, sd, { lw: 0.7 });
    };
    rag(cx - 30, 16, 13, look.a, seed + 4, -0.4);
    rag(cx + 28, 18, 12, look.b, seed + 5, 0.5);
    rag(cx + 4, 12, 10, look.a, seed + 6, 0.1);
    // POP!
    starBurst(ctx, cx, -8, 18, seed + 7);
  } else {
    const look = PLOP_CANOPY[how];
    const W = how === 'slow' ? 58 : 46;
    const H = how === 'slow' ? 46 : 38;
    const top = how === 'slow' ? -64 : -48;
    const hem = drawCanopy(ctx, cx, top, W, H, look, 1, seed);
    drawLines(ctx, hem, grip[0], grip[1], seed + 20);
    if (how === 'slow') flies(ctx, cx, top + H * 0.4, W, seed + 30);
  }
  drawPlop(ctx, 0, 0, frame, ST, kind);
  // a belt round its middle, rings where the lines clip on
  {
    ST.line(ctx, [[grip[0][0] + 2, 76], [cx, 79], [grip[1][0] - 2, 76]], seed + 80, 1.4, '#3c5a8a');
    ST.line(ctx, [grip[0], [grip[0][0] + 2, 76]], seed + 81, 1.2, '#3c5a8a');
    ST.line(ctx, [grip[1], [grip[1][0] - 2, 76]], seed + 82, 1.2, '#3c5a8a');
    for (const [x, y] of grip) ST.shape(ctx, ellipsePts(x, y, 2.2, 2.2, 0, 12), F('#d9dde2', '#9aa3ad', '#ffffff'), seed + 90 + x, { lw: 0.5, plain: true });
  }
}

/** A couple of flies buzzing round (their wobbly flight paths dotted). */
function flies(ctx: Ctx, cx: number, cy: number, W: number, seed: number) {
  const r = rand(seed);
  for (let i = 0; i < 3; i++) {
    const x = cx + (r() - 0.5) * W * 1.8;
    const y = cy - 8 + r() * 16;
    ctx.setLineDash([1.2, 2]);
    ctx.strokeStyle = '#3a241866';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(x - 10, y + 4);
    ctx.quadraticCurveTo(x - 5, y - 6, x, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#ffffffaa';
    ctx.beginPath();
    ctx.ellipse(x - 1, y - 2, 2, 1.2, -0.5, 0, Math.PI * 2);
    ctx.ellipse(x + 1.2, y - 2, 2, 1.2, 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2a1a10';
    ctx.beginPath();
    ctx.ellipse(x, y, 1.6, 1.1, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** A little cartoon burst. */
function starBurst(ctx: Ctx, x: number, y: number, r: number, seed: number) {
  const pts: Pt[] = [];
  const rr = rand(seed);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const d = i % 2 ? r * 0.5 : r * (0.85 + rr() * 0.3);
    pts.push([x + Math.cos(a) * d, y + Math.sin(a) * d]);
  }
  ST.shape(ctx, pts, F('#ffe066', '#f2a81e', '#fff6c0'), seed, { lw: 0.8 });
  ctx.fillStyle = INK;
  ctx.font = `900 ${r * 0.55}px "Lilita One", "Arial Black", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('POP!', x, y + 0.5);
}

function shadeOf(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const k = 0.7;
  const c = (v: number) => Math.round(v * k).toString(16).padStart(2, '0');
  return `#${c((n >> 16) & 255)}${c((n >> 8) & 255)}${c(n & 255)}`;
}

function rand(seed: number) {
  let s = seed * 9301 + 49297;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}
