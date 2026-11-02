/**
 * Basketball finale art: King Puff Ball (from the sketch), the ball, the hoop
 * (red rounded backboard like the sketch) and King Puff Ball's Basketball
 * Palace drawn in a pseudo-3D perspective. Bolder, glossier and darker than
 * the platforming world so the finale feels like a different place.
 */
import { canvas, rng, type Ctx } from './draw';
import { STYLES, ellipsePts, paddlePts, trace, type Fill, type Pt } from './handdrawn';
import { fluffPts } from './baddies';

const st = () => STYLES.polished;

// ───────────────────────────── King Puff Ball (frame 130 × 150, feet at y 146) ──

export type KingFrame = 'idle0' | 'idle1' | 'shoot' | 'laugh0' | 'laugh1' | 'sad' | 'run0' | 'run1' | 'talk' | 'bend' | 'hold' | 'adjust0' | 'adjust1';
export const KING_FRAMES: KingFrame[] = ['idle0', 'idle1', 'shoot', 'laugh0', 'laugh1', 'sad', 'run0', 'run1', 'talk', 'bend', 'hold', 'adjust0', 'adjust1'];
/** Lean (radians, about his feet) for the frames where he bends over. */
const KING_LEAN: Partial<Record<string, number>> = { bend: -0.32 };
const leanPt = (f: string, x: number, y: number) => {
  const a = KING_LEAN[f] ?? 0;
  if (!a) return { x, y };
  const dx = x - 66;
  const dy = y - 146;
  return { x: 66 + dx * Math.cos(a) - dy * Math.sin(a), y: 146 + dx * Math.sin(a) + dy * Math.cos(a) };
};
/** The King's front hand (frame px) in the crown-handling frames. */
export function kingHandAt(f: string) {
  const armB = f === 'bend' ? Math.PI - 0.95 : f === 'hold' ? Math.PI + 1.38 : Math.PI + 1.15;
  const p = { x: 66 - 40 + 8 + Math.cos(armB) * 30, y: 74 - 2 + Math.sin(armB) * 30 };
  return leanPt(f, p.x, p.y);
}
/** Where the bottom-centre of the King's crown sits in his frame, per frame (frame px). */
export const kingCrownAt = (f: string) => {
  if (f === 'hold') {
    const h = kingHandAt('hold');
    return { x: h.x + 2, y: h.y - 2 };
  }
  if (f === 'bend') {
    const h = kingHandAt('bend');
    return { x: h.x, y: h.y + 4 };
  }
  return leanPt(f, 66, 48 + (f === 'idle1' || f === 'laugh1' || f === 'run1' || f === 'adjust1' ? -3 : 0));
};
/** The crown on its own (so it can fall off): 64 × 44, bottom-centre at (32, 40). */
export function drawKingCrown(ctx: Ctx, cx: number, by: number) {
  const S = st();
  const crownY = by - 6;
  const crown: Pt[] = [
    [cx - 28, crownY + 6],
    [cx - 26, crownY - 26],
    [cx - 14, crownY - 6],
    [cx, crownY - 32],
    [cx + 14, crownY - 6],
    [cx + 26, crownY - 26],
    [cx + 28, crownY + 6],
  ];
  S.shape(ctx, crown, GOLD, 1540, { lw: 1.2, light: [cx - 10, crownY - 16] });
  for (const [gx, gy] of [[-22, -8], [0, -12], [22, -8]] as const)
    S.shape(ctx, ellipsePts(cx + gx, crownY + gy, 4, 4.6, 0, 14), { base: '#ff7a2e', shade: '#c9461a', light: '#ffc08a' }, 1541 + gx, { lw: 0.7 });
}
export const KING_W = 130;
export const KING_H = 150;

const KING: Fill = { base: '#f28a2e', shade: '#c55a16', light: '#ffc07a' };
const KING_LIMB: Fill = { base: '#e7791f', shade: '#b04d10', light: '#ffae62' };
const GOLD: Fill = { base: '#ffd23f', shade: '#d9a316', light: '#fff2a8' };
const EYE: Fill = { base: '#ffffff', shade: '#e8e0d4', light: '#ffffff' };
const TOOTH: Fill = { base: '#fffaf0', shade: '#e3d8c6', light: '#ffffff' };

/** King Puff Ball, facing left (toward the hoop when he stands on the right). */
export function drawKing(ctx: Ctx, ox: number, oy: number, f: KingFrame, withCrown = true) {
  const S = st();
  // bending over: the whole King leans forward about his feet
  const lean = KING_LEAN[f] ?? 0;
  if (lean) {
    ctx.save();
    ctx.translate(ox + 66, oy + 146);
    ctx.rotate(lean);
    ctx.translate(-(ox + 66), -(oy + 146));
  }
  const ground = oy + 146;
  const cx = ox + 66;
  const laugh = f.startsWith('laugh');
  const run = f.startsWith('run');
  const bob = f === 'idle1' || f === 'laugh1' || f === 'run1' || f === 'adjust1' ? -3 : 0;
  const rx = 40;
  const ry = 38;
  const cy = ground - 34 - ry + bob;

  // legs: thin, curled feet (like the sketch)
  const leg = (hx: number, dx: number, lift: number, seed: number) => {
    const fx = cx + hx + dx;
    const fy = ground - 6 - lift;
    S.line(ctx, [[cx + hx, cy + ry - 8], [cx + hx + dx * 0.5, cy + ry + 12], [fx, fy]], seed, 3.4);
    S.line(ctx, [[cx + hx, cy + ry - 8], [cx + hx + dx * 0.5, cy + ry + 12], [fx, fy]], seed, 1.9, KING_LIMB.base);
    S.shape(ctx, ellipsePts(fx - 6, fy + 1, 10, 6, -0.1), KING_LIMB, seed + 1, { lw: 1 });
  };
  const step = f === 'run0' ? 10 : f === 'run1' ? -10 : 0;
  leg(14, -step, run && step < 0 ? 6 : 0, 1500);
  leg(-14, step, run && step > 0 ? 6 : 0, 1510);

  // arms: up and waving (idle), clutching belly (laugh), flailing (sad/run)
  let armA = laugh ? 0.9 : f === 'sad' || run ? -2.2 : f === 'shoot' ? -0.2 : -0.75 + bob * 0.04;
  let armB = laugh ? Math.PI - 0.9 : f === 'sad' || run ? Math.PI + 2.2 : f === 'shoot' ? Math.PI + 0.2 : Math.PI + 0.75 - bob * 0.04;
  // handling the crown: reaching down for it, holding it up high, both hands fixing it on
  if (f === 'bend') [armA, armB] = [-0.4, Math.PI - 0.95];
  if (f === 'hold') [armA, armB] = [-0.9, Math.PI + 1.38];
  if (f === 'adjust0') [armA, armB] = [-1.15, Math.PI + 1.15];
  if (f === 'adjust1') [armA, armB] = [-1.3, Math.PI + 1.3];
  // when he handles his crown the arms come round in front of him, so you see his hands
  const handsFront = f === 'bend' || f === 'hold' || f === 'adjust0' || f === 'adjust1';
  const armAFront = f === 'adjust0' || f === 'adjust1';
  if (!armAFront) S.shape(ctx, paddlePts(cx + rx - 8, cy - 2, 30, 13, armA), KING_LIMB, 1520, { lw: 1.1 });
  if (!handsFront) S.shape(ctx, paddlePts(cx - rx + 8, cy - 2, 30, 13, armB), KING_LIMB, 1521, { lw: 1.1 });

  // body: fluffy puffball
  S.shape(ctx, fluffPts(cx, cy, rx, ry, 10, 0.07, 0.4), KING, 1530, { light: [cx - 14, cy - 16], lw: 1.4 });
  if (handsFront) S.shape(ctx, paddlePts(cx - rx + 8, cy - 2, 30, 13, armB), KING_LIMB, 1521, { lw: 1.1 });
  if (armAFront) S.shape(ctx, paddlePts(cx + rx - 8, cy - 2, 30, 13, armA), KING_LIMB, 1520, { lw: 1.1 });

  // crown: three gold points with orange gems (a separate sprite in the game, so it can fall off)
  if (withCrown) drawKingCrown(ctx, cx, cy - ry + 12);

  // eyes: one big, one smaller, angry V brow (like the sketch)
  const sad = f === 'sad' || run;
  if (laugh) {
    for (const [ex, w] of [[cx - 16, 11], [cx + 12, 9]] as const)
      S.line(ctx, [[ex - w, cy - 10], [ex, cy - 18], [ex + w, cy - 10]], 1550 + ex, 1.5);
  } else {
    for (const [ex, ey, er, s] of [[cx - 16, cy - 12, 13, 1], [cx + 13, cy - 13, 10, 2]] as const) {
      S.shape(ctx, ellipsePts(ex, ey, er, er * 1.05, 0, 28), EYE, 1560 + s, { lw: 1.1 });
      const px = sad ? 2 : -er * 0.35;
      ctx.fillStyle = S.ink;
      ctx.beginPath();
      ctx.ellipse(ex + px, ey + (sad ? 3 : 1), er * 0.3, er * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ex + px - 1.5, ey - 1, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    if (sad) {
      S.line(ctx, [[cx - 28, cy - 24], [cx - 10, cy - 32]], 1570, 1.6);
      S.line(ctx, [[cx + 4, cy - 32], [cx + 22, cy - 26]], 1571, 1.6);
    } else {
      S.line(ctx, [[cx - 30, cy - 34], [cx - 14, cy - 27], [cx - 4, cy - 20]], 1570, 1.8);
      S.line(ctx, [[cx + 2, cy - 22], [cx + 10, cy - 28], [cx + 22, cy - 30]], 1571, 1.5);
    }
  }

  // mouth: toothy grin / wide open (shoot, laugh) / wobbly (sad)
  const mx = cx - 2;
  const my = cy + 12;
  if (f === 'shoot' || laugh || f === 'talk') {
    const open = f === 'shoot' ? 15 : f === 'talk' ? 11 : 18;
    const mouth = ellipsePts(mx, my + 2, 20, open, 0, 36);
    S.shape(ctx, mouth, { base: '#5e1a2a', shade: '#33091a', light: '#8e2f45' }, 1580, { lw: 1.2 });
    ctx.save();
    trace(ctx, mouth);
    ctx.clip();
    for (let i = 0; i < 6; i++) S.shape(ctx, [[mx - 18 + i * 6.5, my + 2 - open], [mx - 11.5 + i * 6.5, my + 2 - open], [mx - 14.75 + i * 6.5, my + 2 - open + 8]], TOOTH, 1590 + i, { lw: 0.6, plain: true });
    if (laugh) S.shape(ctx, ellipsePts(mx, my + open - 2, 11, 6, 0, 20), { base: '#e65a73', shade: '#b23a52', light: '#ff9cb0' }, 1599, { lw: 0.7, plain: true });
    ctx.restore();
  } else if (sad) {
    S.line(ctx, [[mx - 14, my + 8], [mx - 7, my + 3], [mx, my + 7], [mx + 7, my + 2], [mx + 14, my + 7]], 1585, 1.3);
  } else {
    // grin with two rows of zigzag teeth
    const grin: Pt[] = [];
    for (let i = 0; i <= 12; i++) grin.push([mx - 20 + i * (40 / 12), my - 3 + Math.sin((i / 12) * Math.PI) * -2]);
    for (let i = 12; i >= 0; i--) grin.push([mx - 20 + i * (40 / 12), my + 3 + Math.sin((i / 12) * Math.PI) * 10]);
    S.shape(ctx, grin, TOOTH, 1580, { lw: 1.2, plain: true });
    const zig: Pt[] = [];
    for (let i = 0; i <= 10; i++) zig.push([mx - 18 + i * 3.6, my + 3 + (i % 2 ? 6 : 0) + Math.sin((i / 10) * Math.PI) * 3]);
    S.line(ctx, zig, 1581, 0.8);
  }
  if (lean) ctx.restore();
}

// ───────────────────────────── ball ──

/** A real-looking basketball: pebbled orange leather, black channels, a soft studio highlight. Rotated by `spin`. */
export function drawBall(ctx: Ctx, cx: number, cy: number, r: number, spin = 0) {
  // leather
  const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.05, cx, cy, r * 1.05);
  g.addColorStop(0, '#ffa55a');
  g.addColorStop(0.45, '#ea6c22');
  g.addColorStop(0.85, '#b9461a');
  g.addColorStop(1, '#7c2c10');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  // pebble grain
  const rr = rng(77);
  for (let i = 0; i < r * r * 1.6; i++) {
    const a = rr() * Math.PI * 2;
    const d = Math.sqrt(rr()) * r;
    ctx.fillStyle = rr() < 0.5 ? 'rgba(90,30,8,0.22)' : 'rgba(255,200,150,0.18)';
    ctx.fillRect(cx + Math.cos(a) * d, cy + Math.sin(a) * d, r * 0.045, r * 0.045);
  }
  // channels (seams), curving round the sphere
  ctx.translate(cx, cy);
  ctx.rotate(spin);
  ctx.strokeStyle = '#1e120c';
  ctx.lineWidth = Math.max(1, r * 0.075);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-r, 0);
  ctx.bezierCurveTo(-r * 0.4, r * 0.12, r * 0.4, r * 0.12, r, 0);
  ctx.moveTo(r * 0.08, -r);
  ctx.bezierCurveTo(-r * 0.12, -r * 0.4, -r * 0.12, r * 0.4, r * 0.08, r);
  ctx.stroke();
  for (const sg of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(sg * r * 1.12, 0, r * 0.62, r * 1.15, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
  // rim shadow + studio highlight
  const rim = ctx.createRadialGradient(cx, cy, r * 0.7, cx, cy, r);
  rim.addColorStop(0, 'rgba(0,0,0,0)');
  rim.addColorStop(1, 'rgba(40,10,0,0.35)');
  ctx.fillStyle = rim;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  const hl = ctx.createRadialGradient(cx - r * 0.38, cy - r * 0.45, 0, cx - r * 0.38, cy - r * 0.45, r * 0.45);
  hl.addColorStop(0, 'rgba(255,240,220,0.75)');
  hl.addColorStop(1, 'rgba(255,240,220,0)');
  ctx.fillStyle = hl;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

/** A soft contact shadow (for floors), w × h. */
export function drawSoftShadow(ctx: Ctx, w: number, h: number) {
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.scale(1, h / w);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, w / 2);
  g.addColorStop(0, 'rgba(0,0,0,0.6)');
  g.addColorStop(0.5, 'rgba(0,0,0,0.32)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, w / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** A round pool of light, used to cut spotlights out of the dark arena. */
export function drawSpotBrush(ctx: Ctx, d: number) {
  const g = ctx.createRadialGradient(d / 2, d / 2, 0, d / 2, d / 2, d / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.9)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, d, d);
}

// ───────────────────────────── arena styles (one per showdown) ──

interface Ad {
  text: string;
  bg: string;
  fg: string;
}

export interface ArenaStyle {
  id: string;
  /** Bowl gradient from the rafters down to the court. */
  bowl: [string, string, string, string];
  tierUpper: string;
  tierLower: string;
  seatUpper: string;
  seatLower: string;
  shirts: string[];
  wood: string[];
  apron: string;
  lane: string;
  words: [string, string];
  wordColor: string;
  ads: Ad[];
  jumboTitle: string;
  jumboSub: string;
  banners: [string, string][];
  bannerTop: string;
  bannerBottom: string;
  /** Backboard border and the stanchion pad. */
  frame: string;
  padTop: string;
  padBottom: string;
  logo: string;
  /** Net cord colours, cycled strand by strand. */
  net: number[];
  /** Where things are in this building (so the two arenas don't look like the same room). */
  layout: ArenaLayout;
}

export interface ArenaLayout {
  /** Left edge of the jumbotron screen (stage x). */
  jumboX: number;
  /** Left edge of the first championship banner. */
  bannerX: number;
  /** Upper-deck crowd: first row y, aisles; lower bowl aisles; crowd seeds. */
  upperY0: number;
  aislesU: number[];
  aislesL: number[];
  seeds: [number, number];
  /** The broadcast camera's home framing: offset, zoom and a slight roll. */
  cam: { dx: number; dy: number; zoom: number; rot: number };
}

/** Part 1: King Puff Ball's Basketball Palace (royal purple and gold). */
export const PALACE: ArenaStyle = {
  id: 'palace',
  bowl: ['#030207', '#0a0613', '#170c27', '#241238'],
  tierUpper: '#140a20',
  tierLower: '#21112f',
  seatUpper: '#4a1f3e',
  seatLower: '#6a2440',
  shirts: ['#4b1d8f', '#4b1d8f', '#5a2aa6', '#ffc629', '#ffc629', '#f4f1ea', '#f4f1ea', '#1b1b22', '#c8102e', '#2f6fd6', '#8a8f9c', '#0b7c78'],
  wood: ['#c98c50', '#d19659', '#be8047', '#d7a165', '#c4874c', '#cc9256', '#b97b43', '#d39b5e'],
  apron: 'rgba(46,18,86,0.86)',
  lane: 'rgba(78,30,150,0.9)',
  words: ['KING PUFF BALL', 'PALACE'],
  wordColor: 'rgba(255,210,63,0.85)',
  ads: [
    { text: 'PUFF COLA', bg: '#c8102e', fg: '#ffffff' },
    { text: 'MADE BY HENRY & NEIL', bg: '#ffc629', fg: '#4a1f05' },
    { text: 'KING PUFF BALL PALACE', bg: '#3d1478', fg: '#ffd23f' },
    { text: 'ROOT BEER · ICE COLD', bg: '#5a2a10', fg: '#ffe2b0' },
    { text: 'PUFF BALL PLANET', bg: '#0b7c78', fg: '#eafffb' },
  ],
  jumboTitle: 'KING PUFF BALL',
  jumboSub: 'B A S K E T B A L L   P A L A C E',
  banners: [
    ['WORLD 1', 'CHAMPS'],
    ['PUFF', 'CUP'],
    ['KING', 'OF HOOPS'],
  ],
  bannerTop: '#2a1052',
  bannerBottom: '#3e1878',
  frame: '#f7f7f4',
  padTop: '#24203a',
  padBottom: '#0f0d1a',
  logo: '#e8b931',
  net: [0xfbfbf8],
  layout: { jumboX: 158, bannerX: 1110, upperY0: -46, aislesU: [-40, 340, 1120, 1390], aislesL: [90, 470, 1270], seeds: [4242, 5151], cam: { dx: 0, dy: 0, zoom: 1, rot: 0 } },
};

/** Part 2: the Summit Dome up the mountain (ice blue, navy and red; striped net). */
export const SUMMIT: ArenaStyle = {
  id: 'summit',
  bowl: ['#010509', '#04101a', '#0a2232', '#103448'],
  tierUpper: '#081620',
  tierLower: '#0e2636',
  seatUpper: '#1b3f5c',
  seatLower: '#245476',
  shirts: ['#0f8f9a', '#0f8f9a', '#18b0b8', '#ffffff', '#ffffff', '#c8102e', '#c8102e', '#1b2a44', '#9aa8b8', '#2f6fd6', '#ffd23f', '#e6f4ff'],
  wood: ['#d3ab7a', '#dbb484', '#c9a070', '#e0bc8c', '#cea676', '#d7b080', '#c49a6a', '#ddb889'],
  apron: 'rgba(12,38,66,0.88)',
  lane: 'rgba(12,128,142,0.9)',
  words: ['SUMMIT', 'DOME'],
  wordColor: 'rgba(200,236,255,0.85)',
  ads: [
    { text: 'SNOW CONE CO.', bg: '#2f9be0', fg: '#ffffff' },
    { text: 'MADE BY HENRY & NEIL', bg: '#ffc629', fg: '#4a1f05' },
    { text: 'SUMMIT DOME', bg: '#0c7f8e', fg: '#eafffb' },
    { text: 'GOAT MILK · FRESH', bg: '#f4f8fc', fg: '#123a55' },
    { text: 'PUCK PALACE', bg: '#c8102e', fg: '#ffffff' },
  ],
  jumboTitle: 'KING PUFF BALL',
  jumboSub: 'S U M M I T   D O M E   ·   R E M A T C H',
  banners: [
    ['PART 2', 'FINAL'],
    ['SUMMIT', 'CUP'],
    ['KING', 'OF PEAKS'],
  ],
  bannerTop: '#0b2a44',
  bannerBottom: '#14466a',
  frame: '#4fd6ff',
  padTop: '#163a56',
  padBottom: '#0a1c2c',
  logo: '#cfeeff',
  net: [0xe8463f, 0xfbfbf8],
  // centre-hung jumbotron, banners on the left, a lower upper deck with different aisles,
  // and a camera set lower and further to the side
  layout: { jumboX: 428, bannerX: -140, upperY0: -18, aislesU: [120, 660, 1240], aislesL: [260, 930], seeds: [777, 9191], cam: { dx: 70, dy: 34, zoom: 1.07, rot: -0.012 } },
};

/** The style the arena drawing functions use right now (set before drawing). */
let AS: ArenaStyle = PALACE;
export function setArenaStyle(s: ArenaStyle) {
  AS = s;
  JUMBO.x = s.layout.jumboX;
  BOARD_SEGS = adSegments(262, 0);
  RIBBON_SEGS = adSegments(318, 2);
}

// ───────────────────────────── shared helpers ──

function poly(ctx: Ctx, pts: Pt[]) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

function seg(ctx: Ctx, a: Pt, b: Pt) {
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.stroke();
}

function hexRgb(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** A colour under arena lighting: k = 1 is fully lit, lower sinks toward the dark of the stands. */
function lit(h: string, k: number, a = 1, desat = 0) {
  let [r, g, b] = hexRgb(h);
  if (desat) {
    const l = r * 0.3 + g * 0.59 + b * 0.11;
    r += (l - r) * desat;
    g += (l - g) * desat;
    b += (l - b) * desat;
  }
  const m = (c: number, t: number) => Math.max(0, Math.min(255, Math.round(t + (c - t) * k)));
  return `rgba(${m(r, 9)},${m(g, 6)},${m(b, 20)},${a})`;
}

const DISPLAY_FONT = '"Lilita One", "Arial Black", sans-serif';

// ───────────────────────────── camera + court geometry ──

/** Floor horizon (where the court meets the courtside boards) and vanishing point, stage coordinates. */
const HORIZON = 330;
const VPX = 860;
const VPY = 120;
/** A pinhole camera over the court (feet): projection scale, height term and distance from the baseline. */
const CAM_F = 595;
const CAM_H = 9913;
const CAM_D = 39.65;
/** Court point (u = feet across, 0 under the hoop; v = feet out from the baseline) → stage. */
function P(u: number, v: number): Pt {
  const z = CAM_D - v;
  return [VPX + (u * CAM_F) / z, VPY + CAM_H / z];
}

type UV = [number, number];

/** A painted court line `w` feet wide along floor points, in true perspective. */
function courtLine(ctx: Ctx, pts: UV[], w = 0.2) {
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    let du = b[0] - a[0];
    let dv = b[1] - a[1];
    const l = Math.hypot(du, dv) || 1;
    du /= l;
    dv /= l;
    const [u, v] = pts[i];
    left.push(P(u - (dv * w) / 2, v + (du * w) / 2));
    right.push(P(u + (dv * w) / 2, v - (du * w) / 2));
  }
  poly(ctx, [...left, ...right.reverse()]);
  ctx.fill();
}

function arcUV(cu: number, cv: number, r: number, a0: number, a1: number, n = 48): UV[] {
  const out: UV[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    out.push([cu + Math.cos(a) * r, cv + Math.sin(a) * r]);
  }
  return out;
}

// ───────────────────────────── hoop ──

export const HOOP = {
  /** Rim centre in stage coordinates. */
  rimX: 860,
  rimY: 250,
  rimRX: 44,
  rimRY: 11,
  /** Where the ball lands on the floor under the hoop. */
  baseY: 420,
  /** Backboard scale. */
  k: 1.3,
};

/** Stanchion + glass backboard + shot clock (drawn behind everything at the hoop). */
export function drawBackboard(ctx: Ctx) {
  const { rimX: x, rimY: y } = HOOP;
  drawStanchion(ctx, x);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(HOOP.k, HOOP.k);
  ctx.translate(-x, -y);
  drawBoard(ctx, x, y);
  ctx.restore();
}

/** The padded stanchion base behind the baseline, and its post up to the board. */
function drawStanchion(ctx: Ctx, x: number) {
  const [, fy] = P(0, -1.5); // front edge on the floor
  const [, by] = P(0, -8); // back edge
  const fw = 3 * (CAM_F / (CAM_D + 1.5));
  const bw = 3 * (CAM_F / (CAM_D + 8));
  const fh = 3.6 * (CAM_F / (CAM_D + 1.5));
  const bh = 3.6 * (CAM_F / (CAM_D + 8));
  // contact shadow
  const sh = ctx.createRadialGradient(x, fy, 4, x, fy, fw * 1.6);
  sh.addColorStop(0, 'rgba(0,0,0,0.45)');
  sh.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  ctx.translate(0, fy);
  ctx.scale(1, 0.18);
  ctx.fillStyle = sh;
  ctx.fillRect(x - fw * 1.7, -fw * 1.7, fw * 3.4, fw * 3.4);
  ctx.restore();
  // post (mostly hidden behind the board)
  const post = ctx.createLinearGradient(x - 11, 0, x + 11, 0);
  post.addColorStop(0, '#4a4658');
  post.addColorStop(0.35, '#2a2734');
  post.addColorStop(1, '#141219');
  ctx.fillStyle = post;
  ctx.fillRect(x - 11, HOOP.rimY - 10, 22, by - bh - (HOOP.rimY - 10) + 14);
  // padded box: top face then front face
  const top = ctx.createLinearGradient(0, by - bh, 0, fy - fh);
  top.addColorStop(0, '#2a2440');
  top.addColorStop(1, '#3b3358');
  ctx.fillStyle = top;
  poly(ctx, [
    [x - bw, by - bh],
    [x + bw, by - bh],
    [x + fw, fy - fh],
    [x - fw, fy - fh],
  ]);
  ctx.fill();
  const front = ctx.createLinearGradient(0, fy - fh, 0, fy);
  front.addColorStop(0, AS.padTop);
  front.addColorStop(1, AS.padBottom);
  ctx.fillStyle = front;
  ctx.beginPath();
  ctx.roundRect(x - fw, fy - fh, fw * 2, fh, [3, 3, 1, 1]);
  ctx.fill();
  // stitched padding seams + top edge highlight
  ctx.strokeStyle = 'rgba(255,255,255,0.13)';
  ctx.lineWidth = 1;
  seg(ctx, [x - fw + 2, fy - fh + 1], [x + fw - 2, fy - fh + 1]);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  for (const dx of [-fw / 3, fw / 3]) seg(ctx, [x + dx, fy - fh + 3], [x + dx, fy - 2]);
  // crown logo on the pad
  ctx.fillStyle = AS.logo;
  const cy = fy - fh * 0.5;
  poly(ctx, [
    [x - 13, cy + 7],
    [x - 14, cy - 6],
    [x - 6, cy],
    [x, cy - 10],
    [x + 6, cy],
    [x + 14, cy - 6],
    [x + 13, cy + 7],
  ]);
  ctx.fill();
}

/** Glass backboard, unscaled units (the caller scales it by HOOP.k around the rim). */
function drawBoard(ctx: Ctx, x: number, y: number) {
  const W = 78;
  const top = y - 85;
  const bottom = y + 6;
  // shot clock on top
  ctx.fillStyle = '#1c1a24';
  ctx.fillRect(x - 3, top - 6, 6, 6);
  ctx.fillStyle = '#0c0b11';
  ctx.beginPath();
  ctx.roundRect(x - 22, top - 24, 44, 19, 3);
  ctx.fill();
  ctx.strokeStyle = '#34313f';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.save();
  ctx.font = `400 15px ${DISPLAY_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = '#ff2020';
  ctx.shadowBlur = 6;
  ctx.fillStyle = '#ff3b2f';
  ctx.fillText('24', x, top - 14);
  ctx.restore();
  // the glass (the crowd shows through it)
  const glass = ctx.createLinearGradient(0, top, 0, bottom);
  glass.addColorStop(0, 'rgba(205,228,255,0.20)');
  glass.addColorStop(1, 'rgba(160,200,240,0.10)');
  ctx.fillStyle = glass;
  ctx.fillRect(x - W, top, W * 2, bottom - top);
  // reflections across the glass
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - W, top, W * 2, bottom - top);
  ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  poly(ctx, [
    [x - W + 10, bottom],
    [x - W + 36, bottom],
    [x - W + 92, top],
    [x - W + 66, top],
  ]);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  poly(ctx, [
    [x - W + 44, bottom],
    [x - W + 52, bottom],
    [x - W + 108, top],
    [x - W + 100, top],
  ]);
  ctx.fill();
  ctx.restore();
  // frame: thin dark edge, white border
  ctx.strokeStyle = '#121118';
  ctx.lineWidth = 4.6;
  ctx.strokeRect(x - W, top, W * 2, bottom - top);
  ctx.strokeStyle = AS.frame;
  ctx.lineWidth = 2.6;
  ctx.strokeRect(x - W + 0.8, top + 0.8, W * 2 - 1.6, bottom - top - 1.6);
  // shooter's square
  ctx.lineWidth = 2.2;
  ctx.strokeRect(x - 26, y - 21, 52, 21);
  // padding along the bottom and lower sides
  ctx.fillStyle = '#16131f';
  ctx.fillRect(x - W - 2.5, bottom - 1, W * 2 + 5, 5.5);
  ctx.fillRect(x - W - 2.5, bottom - 24, 4.5, 24);
  ctx.fillRect(x + W - 2, bottom - 24, 4.5, 24);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(x - W - 2.5, bottom - 1, W * 2 + 5, 1);
  // rim mount
  const mount = ctx.createLinearGradient(x - 9, 0, x + 9, 0);
  mount.addColorStop(0, '#c9ccd4');
  mount.addColorStop(1, '#6d717c');
  ctx.fillStyle = mount;
  ctx.fillRect(x - 9, y - 9, 18, 11);
}

const RIM_DARK = '#5e1a08';
const RIM_BASE = '#cf4a1a';
const RIM_MID = '#f06a2c';
const RIM_LIGHT = '#ffc7a0';

/** Rim tube along an elliptical arc (a0..a1), shaded like painted steel. */
function rimTube(ctx: Ctx, x: number, y: number, a0: number, a1: number, front: boolean) {
  const { rimRX: rx, rimRY: ry } = HOOP;
  const arc = (dy: number, w: number, col: string, b0 = a0, b1 = a1) => {
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.ellipse(x, y + dy, rx, ry, 0, b0, b1);
    ctx.stroke();
  };
  ctx.lineCap = 'round';
  arc(1.4, 6.4, RIM_DARK);
  arc(0.3, 5, RIM_BASE);
  arc(-0.6, 2.8, RIM_MID);
  if (front) {
    arc(-1.4, 1.1, RIM_LIGHT, 0.45, Math.PI - 0.45);
    // little steel hooks the net hangs from
    ctx.fillStyle = '#d9d6de';
    for (let i = 1; i < 12; i++) {
      const a = (i / 12) * Math.PI;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * rx, y + Math.sin(a) * ry + 2.6, 0.9, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    arc(-1.2, 0.8, '#ff9d6e', Math.PI + 0.5, Math.PI * 2 - 0.5);
  }
}

/** Net lattice: rows of points from the rim down to the narrow bottom. */
function netLattice(ox: number, oy: number, stretch: number) {
  const { rimRX: rx, rimRY: ry } = HOOP;
  const ROWS = 6;
  const N = 18;
  const depth = 44 + stretch * 18;
  const bottomR = rx * (0.5 - stretch * 0.1);
  const pt = (k: number, i: number): Pt => {
    const t = k / ROWS;
    const r = rx + (bottomR - rx) * Math.pow(t, 0.8);
    const a = ((i + (k % 2) * 0.5) / N) * Math.PI * 2;
    const sway = stretch * Math.sin(a * 2 + k) * 2.2;
    return [ox + Math.cos(a) * r + sway, oy + depth * t + Math.sin(a) * ry * (1 - 0.45 * t)];
  };
  const segs: { a: Pt; b: Pt; front: boolean; t: number }[] = [];
  for (let k = 0; k < ROWS; k++) {
    for (let i = 0; i < N; i++) {
      const a = pt(k, i);
      for (const j of k % 2 ? [i, i + 1] : [i - 1, i]) {
        const b = pt(k + 1, (j + N) % N);
        const ang = ((i + (k % 2) * 0.5 + (j + ((k + 1) % 2) * 0.5)) / 2 / N) * Math.PI * 2;
        segs.push({ a, b, front: Math.sin(ang) >= 0, t: k / ROWS });
      }
    }
  }
  // dangling cord ends under the bottom ring
  const tails: { a: Pt; b: Pt; front: boolean }[] = [];
  for (let i = 0; i < N; i += 2) {
    const a = pt(ROWS, i);
    const ang = ((i + (ROWS % 2) * 0.5) / N) * Math.PI * 2;
    tails.push({ a, b: [a[0] + Math.cos(ang) * 1.5, a[1] + 5 + stretch * 2], front: Math.sin(ang) >= 0 });
  }
  return { segs, tails };
}

/** A sagging cord between two knots. */
function cord(ctx: Ctx, a: Pt, b: Pt) {
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.quadraticCurveTo((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 1.4, b[0], b[1]);
  ctx.stroke();
}

/** Back half of the rim (+ the back of a still net, for static pictures). */
export function drawRimBack(ctx: Ctx, withNet = true) {
  const { rimX: x, rimY: y } = HOOP;
  const { segs } = netLattice(x, y, 0);
  ctx.lineCap = 'round';
  for (const sg of segs) {
    if (sg.front || !withNet) continue;
    ctx.strokeStyle = `rgba(150,146,162,${0.75 - sg.t * 0.3})`;
    ctx.lineWidth = 1.1;
    cord(ctx, sg.a, sg.b);
  }
  rimTube(ctx, x, y, Math.PI, Math.PI * 2, false);
}

/** Just the front of the rim tube (the game draws a live, simulated net). */
export function drawRimFrontTube(ctx: Ctx, ox: number, oy: number) {
  rimTube(ctx, ox, oy, 0, Math.PI, true);
}

/** Front half of the rim + the front of the net, drawn into a canvas whose origin is the rim centre. `stretch` 0..1 swishes the net. */
export function drawRimFront(ctx: Ctx, ox: number, oy: number, stretch = 0) {
  const { segs, tails } = netLattice(ox, oy, stretch);
  ctx.lineCap = 'round';
  const front = segs.filter((sg) => sg.front);
  // cord shadow, then the white cord (a touch greyer deeper in the net)
  ctx.strokeStyle = 'rgba(70,64,84,0.45)';
  ctx.lineWidth = 2.5;
  for (const sg of front) cord(ctx, [sg.a[0] + 0.5, sg.a[1] + 0.6], [sg.b[0] + 0.5, sg.b[1] + 0.6]);
  for (const sg of front) {
    const g = Math.round(250 - sg.t * 34);
    ctx.strokeStyle = `rgb(${g},${g - 2},${g - 6})`;
    ctx.lineWidth = 1.5;
    cord(ctx, sg.a, sg.b);
  }
  ctx.strokeStyle = '#e8e5ee';
  ctx.lineWidth = 1.2;
  for (const tl of tails) if (tl.front) cord(ctx, tl.a, tl.b);
  rimTube(ctx, ox, oy, 0, Math.PI, true);
}

// ───────────────────────────── arena (1600 × 900, the 1280 × 720 stage sits at +160, +90) ──

export const ARENA_W = 1600;
export const ARENA_H = 900;
export const STAGE_OX = 160;
export const STAGE_OY = 90;
/** The crowd + front layers cover the top of the arena down to just below the courtside boards. */
export const CROWD_H = 420;
export const FRONT_H = 432;

const L = -STAGE_OX;
const R = 1280 + STAGE_OX;
const T = -STAGE_OY;
const B = 720 + STAGE_OY;

/** Shooting spots on the floor (stage coordinates, feet). */
export const SPOTS = {
  hero: { x: 400, y: 640 },
  king: { x: 1010, y: 650 },
};

// LED advertising (all made-up Puff Ball Planet brands; per arena style)
interface AdSeg {
  x0: number;
  x1: number;
  ad: Ad;
}
function adSegments(w: number, start: number): AdSeg[] {
  const out: AdSeg[] = [];
  let i = start;
  for (let x = L; x < R; x += w) out.push({ x0: x, x1: x + w, ad: AS.ads[i++ % AS.ads.length] });
  return out;
}
/** Courtside LED boards along the baseline (also reflected in the floor). */
const BOARD_Y0 = 297;
const BOARD_Y1 = HORIZON + 1;
let BOARD_SEGS: AdSeg[] = [];
/** The LED ribbon between the upper and lower decks. */
const RIBBON_Y0 = 114;
const RIBBON_Y1 = 131;
let RIBBON_SEGS: AdSeg[] = [];

function ledBoard(ctx: Ctx, y0: number, y1: number, segs: AdSeg[], fontPx: number) {
  ctx.fillStyle = '#060509';
  ctx.fillRect(L, y0 - 3, R - L, y1 - y0 + 6);
  for (const s of segs) {
    // glow spilling past the board
    ctx.save();
    ctx.shadowColor = s.ad.bg;
    ctx.shadowBlur = 16;
    ctx.fillStyle = s.ad.bg;
    ctx.fillRect(s.x0 + 1.5, y0, s.x1 - s.x0 - 3, y1 - y0);
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.rect(s.x0 + 1.5, y0, s.x1 - s.x0 - 3, y1 - y0);
    ctx.clip();
    const sheen = ctx.createLinearGradient(0, y0, 0, y1);
    sheen.addColorStop(0, 'rgba(255,255,255,0.22)');
    sheen.addColorStop(0.5, 'rgba(255,255,255,0)');
    sheen.addColorStop(1, 'rgba(0,0,0,0.18)');
    ctx.fillStyle = sheen;
    ctx.fillRect(s.x0, y0, s.x1 - s.x0, y1 - y0);
    ctx.font = `400 ${fontPx}px ${DISPLAY_FONT}`;
    const tw = ctx.measureText(s.ad.text).width;
    const fit = Math.min(1, (s.x1 - s.x0 - 18) / tw);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.translate((s.x0 + s.x1) / 2, (y0 + y1) / 2 + 1);
    ctx.scale(fit, 1);
    ctx.shadowColor = s.ad.fg;
    ctx.shadowBlur = 5;
    ctx.fillStyle = s.ad.fg;
    ctx.fillText(s.ad.text, 0, 0);
    ctx.restore();
    // LED pixel grid
    ctx.fillStyle = 'rgba(0,0,0,0.17)';
    for (let x = s.x0 + 1.5; x < s.x1 - 1.5; x += 2.6) ctx.fillRect(x, y0, 0.7, y1 - y0);
    for (let y = y0; y < y1; y += 2.6) ctx.fillRect(s.x0 + 1.5, y, s.x1 - s.x0 - 3, 0.7);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.fillRect(L, y0 - 3, R - L, 1);
}

/**
 * The back of the arena: dark rafters with lights, empty tiers (the crowd is
 * its own layer), and the hardwood court in true perspective.
 */
export function drawArena(ctx: Ctx) {
  ctx.save();
  ctx.translate(STAGE_OX, STAGE_OY);

  // the bowl: almost black up in the rafters, warmer toward the court
  const bowl = ctx.createLinearGradient(0, T, 0, HORIZON);
  bowl.addColorStop(0, AS.bowl[0]);
  bowl.addColorStop(0.3, AS.bowl[1]);
  bowl.addColorStop(0.65, AS.bowl[2]);
  bowl.addColorStop(1, AS.bowl[3]);
  ctx.fillStyle = bowl;
  ctx.fillRect(L, T, R - L, HORIZON - T + 2);

  // roof trusses
  ctx.strokeStyle = 'rgba(80,72,104,0.35)';
  ctx.lineWidth = 1.3;
  for (const yy of [T + 6, T + 26]) seg(ctx, [L, yy], [R, yy]);
  ctx.lineWidth = 0.9;
  for (let x = L; x < R; x += 28) {
    seg(ctx, [x, T + 6], [x + 14, T + 26]);
    seg(ctx, [x + 14, T + 26], [x + 28, T + 6]);
  }
  // arena lights hanging in the rafters
  for (let x = L + 50; x < R; x += 165) {
    const g = ctx.createRadialGradient(x, T + 30, 2, x, T + 30, 70);
    g.addColorStop(0, 'rgba(255,246,222,0.55)');
    g.addColorStop(0.25, 'rgba(255,240,210,0.16)');
    g.addColorStop(1, 'rgba(255,240,210,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 70, T - 40, 140, 140);
    ctx.fillStyle = '#fffbea';
    ctx.beginPath();
    ctx.roundRect(x - 10, T + 26, 20, 7, 2);
    ctx.fill();
  }
  // seating tiers behind the crowd
  ctx.fillStyle = AS.tierUpper;
  ctx.fillRect(L, -58, R - L, 176);
  ctx.fillStyle = AS.tierLower;
  ctx.fillRect(L, 140, R - L, 160);

  drawFloor(ctx);
  ctx.restore();
}

function drawFloor(ctx: Ctx) {
  const r = rng(9031);
  const VB = -8.2; // just behind the courtside boards
  const VF = 26; // past the bottom of the screen
  ctx.save();
  ctx.beginPath();
  ctx.rect(L, HORIZON, R - L, B - HORIZON);
  ctx.clip();
  ctx.fillStyle = '#c08347';
  ctx.fillRect(L, HORIZON, R - L, B - HORIZON);

  // maple planks running toward the hoop, each made of boards of slightly different tone
  const tones = AS.wood;
  const PW = 0.75;
  for (let u = -84; u < 48; u += PW) {
    ctx.fillStyle = tones[Math.floor(r() * tones.length)];
    poly(ctx, [P(u, VB), P(u + PW, VB), P(u + PW, VF), P(u, VF)]);
    ctx.fill();
    let v = VB - r() * 10;
    while (v < VF) {
      const len = 6 + r() * 10;
      const a = Math.max(v, VB);
      const b = Math.min(v + len, VF);
      const dark = r() < 0.5;
      const al = 0.04 + r() * 0.09;
      if (b > a) {
        ctx.fillStyle = dark ? `rgba(90,45,15,${al})` : `rgba(255,232,190,${al})`;
        poly(ctx, [P(u, a), P(u + PW, a), P(u + PW, b), P(u, b)]);
        ctx.fill();
      }
      if (v + len > VB && v + len < VF) {
        ctx.strokeStyle = 'rgba(80,40,14,0.35)';
        ctx.lineWidth = 0.7;
        seg(ctx, P(u, v + len), P(u + PW, v + len));
      }
      v += len;
    }
    for (let g = 0; g < 2; g++) {
      const gu = u + 0.12 + r() * (PW - 0.24);
      const v0 = VB + r() * 28;
      const v1 = Math.min(VF, v0 + 2 + r() * 8);
      ctx.strokeStyle = `rgba(110,60,20,${0.07 + r() * 0.07})`;
      ctx.lineWidth = 0.6;
      seg(ctx, P(gu, v0), P(gu, v1));
    }
  }
  ctx.strokeStyle = 'rgba(85,42,14,0.3)';
  ctx.lineWidth = 0.7;
  for (let u = -84; u <= 48; u += PW) seg(ctx, P(u, VB), P(u, VF));

  // out of bounds: royal purple paint over the wood (the grain still shows)
  ctx.fillStyle = AS.apron;
  ctx.beginPath();
  ctx.rect(L, HORIZON, R - L, B - HORIZON);
  const court: Pt[] = [P(-25, 0), P(25, 0), P(25, VF), P(-25, VF)];
  court.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fill('evenodd');
  // the lane
  ctx.fillStyle = AS.lane;
  poly(ctx, [P(-8, 0), P(8, 0), P(8, 19), P(-8, 19)]);
  ctx.fill();
  // painted words behind the baseline, laid flat on the floor
  const word = (text: string, u: number) => {
    const [px, py] = P(u, -3.7);
    ctx.save();
    ctx.translate(px, py);
    ctx.scale(1, CAM_H / (CAM_F * (CAM_D + 3.7)));
    ctx.font = `400 34px ${DISPLAY_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = AS.wordColor;
    ctx.fillText(text, 0, 0);
    ctx.restore();
  };
  word(AS.words[0], -15);
  word(AS.words[1], 13);

  // court lines
  ctx.fillStyle = '#f5f0e4';
  courtLine(ctx, [[-25, 0], [25, 0]]);
  courtLine(ctx, [[-25, 0], [-25, VF]]);
  courtLine(ctx, [[25, 0], [25, VF]]);
  courtLine(ctx, [[-8, 0], [-8, 19]]);
  courtLine(ctx, [[8, 0], [8, 19]]);
  courtLine(ctx, [[-8, 19], [8, 19]]);
  courtLine(ctx, arcUV(0, 19, 6, 0, Math.PI));
  for (let d = 0; d < 9; d++) {
    const a0 = Math.PI + (d / 9) * Math.PI;
    courtLine(ctx, arcUV(0, 19, 6, a0, a0 + (Math.PI / 9) * 0.55, 6));
  }
  courtLine(ctx, [[-4, 4] as UV, ...arcUV(0, 5.25, 4, Math.PI, 0, 32), [4, 4] as UV]);
  const a3 = Math.acos(22 / 23.75);
  courtLine(ctx, [[-22, 0], [-22, 5.25 + 23.75 * Math.sin(a3)]]);
  courtLine(ctx, [[22, 0], [22, 5.25 + 23.75 * Math.sin(a3)]]);
  courtLine(ctx, arcUV(0, 5.25, 23.75, a3, Math.PI - a3, 80));
  // lane hash marks and the block
  for (const sgn of [-1, 1]) {
    poly(ctx, [P(sgn * 8, 7), P(sgn * 8.7, 7), P(sgn * 8.7, 7.7), P(sgn * 8, 7.7)]);
    ctx.fill();
    for (const hv of [11, 14, 17]) courtLine(ctx, [[sgn * 8, hv], [sgn * 8.6, hv]], 0.17);
  }

  // depth: darker toward the back, lit pool in the middle
  const depth = ctx.createLinearGradient(0, HORIZON, 0, B);
  depth.addColorStop(0, 'rgba(25,10,3,0.38)');
  depth.addColorStop(0.45, 'rgba(25,10,3,0)');
  ctx.fillStyle = depth;
  ctx.fillRect(L, HORIZON, R - L, B - HORIZON);

  // glossy finish: reflections of the LED boards and the arena lights
  ctx.globalCompositeOperation = 'lighter';
  for (const s of BOARD_SEGS) {
    const [cr, cg, cb] = hexRgb(s.ad.bg);
    for (const [grow, al, len] of [
      [-14, 0.1, 90],
      [0, 0.07, 130],
      [16, 0.05, 180],
      [34, 0.03, 220],
    ] as const) {
      const g = ctx.createLinearGradient(0, HORIZON, 0, HORIZON + len);
      g.addColorStop(0, `rgba(${cr},${cg},${cb},${al})`);
      g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(s.x0 + 6 - grow, HORIZON, s.x1 - s.x0 - 12 + grow * 2, len);
    }
  }
  for (const lx of [40, 300, 590, 1130, 1390]) {
    ctx.save();
    ctx.translate(lx, 500);
    ctx.scale(1, 5);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 34);
    g.addColorStop(0, 'rgba(255,240,215,0.16)');
    g.addColorStop(1, 'rgba(255,240,215,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-40, -40, 80, 80);
    ctx.restore();
  }
  ctx.globalCompositeOperation = 'source-over';
  const pool = ctx.createRadialGradient(720, 640, 40, 720, 640, 720);
  pool.addColorStop(0, 'rgba(255,238,205,0.14)');
  pool.addColorStop(1, 'rgba(255,238,205,0)');
  ctx.fillStyle = pool;
  ctx.fillRect(L, HORIZON, R - L, B - HORIZON);
  const vig = ctx.createRadialGradient(700, 560, 320, 700, 560, 1050);
  vig.addColorStop(0, 'rgba(8,4,2,0)');
  vig.addColorStop(1, 'rgba(8,4,2,0.55)');
  ctx.fillStyle = vig;
  ctx.fillRect(L, HORIZON, R - L, B - HORIZON);
  ctx.restore();
}

// ───────────────────────────── crowd ──

interface Tier {
  y0: number;
  y1: number;
  rows: number;
  s0: number;
  s1: number;
  /** Pixels per stage pixel when rendered (lower = softer, like depth of field). */
  q: number;
  light0: number;
  light1: number;
  aisles: number[];
  aisleW: number;
  seat: string;
  near: boolean;
}

const UPPER: Tier = { y0: -46, y1: 118, rows: 17, s0: 3.6, s1: 4.7, q: 0.6, light0: 0.2, light1: 0.38, aisles: [-40, 340, 1120, 1390], aisleW: 15, seat: '#4a1f3e', near: false };
const LOWER: Tier = { y0: 166, y1: 302, rows: 8, s0: 6.6, s1: 9.6, q: 0.8, light0: 0.36, light1: 0.64, aisles: [90, 470, 1270], aisleW: 26, seat: '#6a2440', near: true };

const SKINS = ['#f2a65a', '#f7c690', '#ffb3c6', '#e8a46c', '#f08a3c', '#ffd4a8', '#a8e6d4', '#f5b78a', '#d98c55'];

const SIGNS = ['GO KING!', 'PUFF!', '#1 FAN', 'KING ME', 'D-FENSE'];

/**
 * The crowd: thousands of little puffball fans in the King's purple and gold,
 * packed into an upper deck and a lower bowl with stair aisles, lit by the
 * court lights (dimmer the higher they sit) and drawn softer with distance.
 * `excited` stands them up with arms in the air (the scene flips between the
 * two when someone scores).
 */
export function drawCrowd(ctx: Ctx, excited = false) {
  ctx.save();
  ctx.translate(STAGE_OX, STAGE_OY);
  const lay = AS.layout;
  drawTier(ctx, { ...UPPER, y0: lay.upperY0, aisles: lay.aislesU, rows: Math.round(17 * (118 - lay.upperY0) / 164) }, rng(lay.seeds[0]), excited);
  drawTier(ctx, { ...LOWER, aisles: lay.aislesL }, rng(lay.seeds[1]), excited);
  ctx.restore();
}

function drawTier(dst: Ctx, tier: Tier, r: () => number, excited: boolean) {
  const top = tier.y0 - 40;
  const bottom = tier.y1 + 24;
  const { c, ctx } = canvas(Math.ceil((R - L) * tier.q), Math.ceil((bottom - top) * tier.q));
  ctx.scale(tier.q, tier.q);
  ctx.translate(-L, -top);
  const inAisle = (x: number) => tier.aisles.some((a) => Math.abs(x - a) < tier.aisleW / 2 + 2);

  for (let row = 0; row < tier.rows; row++) {
    const t = row / (tier.rows - 1);
    const s = tier.s0 + (tier.s1 - tier.s0) * t;
    const y = tier.y0 + (tier.y1 - tier.y0) * t;
    const light = tier.light0 + (tier.light1 - tier.light0) * t;
    // the row of seat backs (shows where seats are empty)
    ctx.fillStyle = lit(tier.near ? AS.seatLower : AS.seatUpper, light * 0.85);
    ctx.fillRect(L, y - s * 0.55, R - L, s * 1.5);
    ctx.fillStyle = lit('#ffffff', light * 0.25, 0.25);
    ctx.fillRect(L, y - s * 0.55, R - L, Math.max(0.6, s * 0.12));
    // stair aisles
    for (const ax of tier.aisles) {
      ctx.fillStyle = lit('#5b5468', light);
      ctx.fillRect(ax - tier.aisleW / 2, y - s * 0.9, tier.aisleW, s * 2.4);
      ctx.fillStyle = lit('#c9c3d6', light, 0.5);
      ctx.fillRect(ax - tier.aisleW / 2, y - s * 0.9, tier.aisleW, Math.max(0.7, s * 0.14));
      ctx.fillStyle = lit('#ffd23f', light, 0.8);
      ctx.fillRect(ax - tier.aisleW / 2 + 1, y - s * 0.86, 2, Math.max(0.6, s * 0.1));
      ctx.fillRect(ax + tier.aisleW / 2 - 3, y - s * 0.86, 2, Math.max(0.6, s * 0.1));
    }
    let x = L - r() * s * 2;
    while (x < R + s * 2) {
      const step = s * 1.78 + r() * s * 0.38;
      const v = { skin: r(), shirt: r(), hat: r(), empty: r(), arms: r(), prop: r(), jit: r(), stand: r(), lean: r(), hue: r(), size: r() };
      x += step;
      if (inAisle(x) || v.empty < 0.06) continue;
      const ps = s * (0.86 + v.size * 0.28);
      fan(ctx, x, y + (v.size - 0.5) * s * 0.5, ps, light, v, tier.near && ps > 7.4, excited);
    }
  }
  dst.imageSmoothingEnabled = true;
  dst.imageSmoothingQuality = 'high';
  dst.drawImage(c, L, top, R - L, bottom - top);
}

function fan(
  ctx: Ctx,
  x: number,
  y: number,
  s: number,
  light: number,
  v: { skin: number; shirt: number; hat: number; arms: number; prop: number; jit: number; stand: number; lean: number; hue: number; size: number },
  near: boolean,
  excited: boolean,
) {
  const standing = excited && v.stand < 0.75;
  const yy = y - (standing ? s * 0.45 : 0) + (v.jit - 0.5) * s * 0.3;
  const skin = SKINS[Math.floor(v.skin * SKINS.length)];
  const shirt = AS.shirts[Math.floor(v.shirt * AS.shirts.length)];
  const k = light * (0.9 + v.hue * 0.2);
  const hx = x + (v.lean - 0.5) * s * 0.35;
  const hy = yy - s * 1.55;
  const armsUp = excited ? v.arms < 0.72 : v.arms < 0.1;
  const oneArm = armsUp && v.arms > (excited ? 0.55 : 0.07);

  // arms raised behind the head
  if (armsUp) {
    ctx.lineCap = 'round';
    ctx.strokeStyle = lit(shirt, k * 0.85, 1, 0.22);
    ctx.lineWidth = s * 0.42;
    for (const sg of oneArm ? [v.lean < 0.5 ? -1 : 1] : [-1, 1]) {
      const ex = x + sg * s * (1.05 + v.jit * 0.3);
      const ey = yy - s * (2.5 + v.hue * 0.4);
      seg(ctx, [x + sg * s * 0.7, yy - s * 0.6], [ex, ey]);
      ctx.fillStyle = lit(skin, k);
      ctx.beginPath();
      ctx.arc(ex, ey, s * 0.27, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // shoulders + body
  ctx.fillStyle = lit(shirt, k, 1, 0.22);
  ctx.beginPath();
  ctx.moveTo(x - s * 0.95, yy + s * 1.3);
  ctx.lineTo(x - s * 0.95, yy - s * 0.45);
  ctx.quadraticCurveTo(x - s * 0.92, yy - s * 1.02, x - s * 0.3, yy - s * 1.02);
  ctx.lineTo(x + s * 0.3, yy - s * 1.02);
  ctx.quadraticCurveTo(x + s * 0.92, yy - s * 1.02, x + s * 0.95, yy - s * 0.45);
  ctx.lineTo(x + s * 0.95, yy + s * 1.3);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(x + s * 0.25, yy - s * 0.7, s * 0.7, s * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(x - s * 0.8, yy - s * 0.95, s * 1.2, s * 0.3);
  // fluffy puffball head, lit from above
  const hr = s * 0.62;
  const hg = ctx.createRadialGradient(hx - hr * 0.35, hy - hr * 0.45, hr * 0.1, hx, hy, hr * 1.25);
  hg.addColorStop(0, lit(skin, Math.min(1.25, k * 1.18), 1, 0.15));
  hg.addColorStop(1, lit(skin, k * 0.62, 1, 0.15));
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.arc(hx, hy, hr, 0, Math.PI * 2);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + v.hue * 2;
    ctx.moveTo(hx + Math.cos(a) * hr * 0.92 + hr * 0.3, hy + Math.sin(a) * hr * 0.92);
    ctx.arc(hx + Math.cos(a) * hr * 0.92, hy + Math.sin(a) * hr * 0.92, hr * 0.3, 0, Math.PI * 2);
  }
  ctx.fill();
  // hats: team caps and paper crowns for the King's biggest fans
  if (v.hat < 0.14) {
    ctx.fillStyle = lit(v.hat < 0.07 ? '#4b1d8f' : '#ffc629', k);
    ctx.beginPath();
    ctx.arc(hx, hy - hr * 0.15, hr * 0.95, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(hx - hr * (v.lean < 0.5 ? 1.5 : -0.2), hy - hr * 0.25, hr * 1.3, hr * 0.28);
  } else if (v.hat < 0.2) {
    ctx.fillStyle = lit('#ffd23f', k * 1.1);
    poly(ctx, [
      [hx - hr * 0.8, hy - hr * 0.55],
      [hx - hr * 0.85, hy - hr * 1.45],
      [hx - hr * 0.35, hy - hr * 0.95],
      [hx, hy - hr * 1.6],
      [hx + hr * 0.35, hy - hr * 0.95],
      [hx + hr * 0.85, hy - hr * 1.45],
      [hx + hr * 0.8, hy - hr * 0.55],
    ]);
    ctx.fill();
  }
  // faces in the lower bowl
  if (near) {
    const look = (VPX - hx) / 2400;
    ctx.fillStyle = 'rgba(20,14,26,0.85)';
    for (const ex of [-0.3, 0.28]) {
      ctx.beginPath();
      ctx.ellipse(hx + ex * hr * 1.6 + look * hr * 2, hy - hr * 0.02, hr * 0.13, hr * 0.17, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (excited || v.prop > 0.9) {
      ctx.fillStyle = '#4a1222';
      ctx.beginPath();
      ctx.ellipse(hx, hy + hr * 0.5, hr * 0.26, hr * (excited ? 0.24 : 0.12), 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // props
  if (near && v.prop < 0.025) {
    // foam finger
    const fx = x + s * 1.1;
    const fy = yy - s * 3.1;
    ctx.fillStyle = lit('#ffc629', k);
    ctx.beginPath();
    ctx.roundRect(fx - s * 0.5, fy + s * 0.8, s * 1.0, s * 1.4, s * 0.25);
    ctx.roundRect(fx - s * 0.2, fy - s * 0.4, s * 0.42, s * 1.4, s * 0.2);
    ctx.fill();
  } else if (near && v.prop < 0.05) {
    // hand-made sign
    const w = s * 5;
    const h = s * 1.9;
    const sx = x - w / 2;
    const sy = yy - s * 3.6 - (excited ? s * 0.5 : 0);
    ctx.fillStyle = lit('#fbf8f0', k);
    ctx.fillRect(sx, sy, w, h);
    ctx.fillStyle = v.hue < 0.5 ? '#5a2aa6' : '#c8102e';
    ctx.font = `400 ${s * 1.15}px ${DISPLAY_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(SIGNS[Math.floor(v.hue * SIGNS.length)], x, sy + h / 2 + s * 0.05, w - s * 0.4);
  } else if (!near && v.prop < (excited ? 0.06 : 0.025)) {
    // phone screen up in the cheap seats
    ctx.fillStyle = '#e4f3ff';
    ctx.shadowColor = '#bfe2ff';
    ctx.shadowBlur = 3;
    ctx.fillRect(hx + s * 0.6, hy - s * 1.1, s * 0.5, s * 0.75);
    ctx.shadowBlur = 0;
  }
}

/**
 * The arena furniture in front of the crowd: jumbotron, championship banners,
 * the LED ribbon between the decks, the lower-bowl wall and the courtside LED
 * boards along the baseline.
 */
export function drawArenaFront(ctx: Ctx) {
  ctx.save();
  ctx.translate(STAGE_OX, STAGE_OY);
  drawJumbotron(ctx);
  drawBanners(ctx);
  // upper-deck fascia + ribbon board
  ctx.fillStyle = '#0b0912';
  ctx.fillRect(L, RIBBON_Y0 - 6, R - L, 6);
  ledBoard(ctx, RIBBON_Y0, RIBBON_Y1, RIBBON_SEGS, 12);
  const fascia = ctx.createLinearGradient(0, RIBBON_Y1 + 3, 0, RIBBON_Y1 + 16);
  fascia.addColorStop(0, '#1b1028');
  fascia.addColorStop(1, '#0c0814');
  ctx.fillStyle = fascia;
  ctx.fillRect(L, RIBBON_Y1 + 3, R - L, 13);
  // lower-bowl front wall + glass rail just above the courtside boards
  ctx.fillStyle = '#120a1c';
  ctx.fillRect(L, BOARD_Y0 - 12, R - L, 10);
  ctx.fillStyle = 'rgba(190,215,255,0.10)';
  ctx.fillRect(L, BOARD_Y0 - 22, R - L, 10);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(L, BOARD_Y0 - 22, R - L, 1);
  ledBoard(ctx, BOARD_Y0, BOARD_Y1, BOARD_SEGS, 19);
  ctx.restore();
}

/** The jumbotron's screen in stage coordinates (the scene draws live content there). */
export const JUMBO = { x: 158, y: -24, w: 424, h: 108 };

export type JumboContent =
  | { kind: 'title' }
  | {
      kind: 'score';
      you: number;
      king: number;
      name: string;
      sudden: boolean;
      /** Each shot so far (true = made), and how many shots each in regulation. */
      youShots?: boolean[];
      kingShots?: boolean[];
      regulation?: number;
    }
  | { kind: 'big'; text: string; sub?: string; color: string; bg: string };

// 7-segment LED digits: segments a b c d e f g
const SEG_ON: Record<string, string> = {
  '0': 'abcdef', '1': 'bc', '2': 'abged', '3': 'abgcd', '4': 'fgbc', '5': 'afgcd',
  '6': 'afgedc', '7': 'abc', '8': 'abcdefg', '9': 'abcdfg', '-': 'g', ' ': '',
};

/** One glowing 7-segment digit, top-left at (x, y), w × h. Unlit segments show faintly. */
function segDigit(ctx: Ctx, ch: string, x: number, y: number, w: number, h: number, on: string, off: string) {
  const t = Math.max(2, w * 0.18); // segment thickness
  const g = t * 0.18; // gap at the joints
  const hm = y + h / 2;
  const horiz = (yy: number): [number, number][] => [
    [x + g + t * 0.5, yy], [x + g + t, yy - t / 2], [x + w - g - t, yy - t / 2],
    [x + w - g - t * 0.5, yy], [x + w - g - t, yy + t / 2], [x + g + t, yy + t / 2],
  ];
  const vert = (xx: number, y0: number, y1: number): [number, number][] => [
    [xx, y0 + g + t * 0.5], [xx + t / 2, y0 + g + t], [xx + t / 2, y1 - g - t],
    [xx, y1 - g - t * 0.5], [xx - t / 2, y1 - g - t], [xx - t / 2, y0 + g + t],
  ];
  const segs: Record<string, [number, number][]> = {
    a: horiz(y + t / 2),
    g: horiz(hm),
    d: horiz(y + h - t / 2),
    f: vert(x + t / 2, y, hm),
    b: vert(x + w - t / 2, y, hm),
    e: vert(x + t / 2, hm, y + h),
    c: vert(x + w - t / 2, hm, y + h),
  };
  const lit = SEG_ON[ch] ?? '';
  for (const k of 'abcdefg') {
    const isOn = lit.includes(k);
    ctx.save();
    // a slight italic slant, like a real scoreboard
    ctx.transform(1, 0, -0.08, 1, (y + h / 2) * 0.08, 0);
    ctx.fillStyle = isOn ? on : off;
    if (isOn) {
      ctx.shadowColor = on;
      ctx.shadowBlur = 7;
    }
    poly(ctx, segs[k]);
    ctx.fill();
    ctx.restore();
  }
}

/** A two-digit LED score in a dark inset window centred at (cx, cy). */
function ledScore(ctx: Ctx, n: number, cx: number, cy: number, col: string, dim: string) {
  const dw = 21;
  const dh = 36;
  const gap = 6;
  const bw = dw * 2 + gap + 16;
  const bh = dh + 10;
  ctx.fillStyle = '#05040a';
  ctx.beginPath();
  ctx.roundRect(cx - bw / 2, cy - bh / 2, bw, bh, 4);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  ctx.stroke();
  const str = String(Math.min(99, n)).padStart(2, ' ');
  for (let i = 0; i < 2; i++) segDigit(ctx, str[i], cx - (dw * 2 + gap) / 2 + i * (dw + gap), cy - dh / 2, dw, dh, col, dim);
}

/** The scrolling news ticker along the bottom of the jumbotron. */
function jumboTicker(ctx: Ctx, items: { text: string; color: string }[], t: number, y0: number, h: number, w: number) {
  const bar = ctx.createLinearGradient(0, y0, 0, y0 + h);
  bar.addColorStop(0, '#1c1430');
  bar.addColorStop(1, '#0a0714');
  ctx.fillStyle = bar;
  ctx.fillRect(0, y0, w, h);
  ctx.fillStyle = AS.ads[0].bg;
  ctx.fillRect(0, y0, w, 1.5);
  // the crawl
  const tagW = 50;
  ctx.save();
  ctx.beginPath();
  ctx.rect(tagW, y0, w - tagW, h);
  ctx.clip();
  ctx.font = `400 12px ${DISPLAY_FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const sep = '   ★   ';
  const sepW = ctx.measureText(sep).width;
  let total = 0;
  const widths = items.map((it) => {
    const tw = ctx.measureText(it.text).width;
    total += tw + sepW;
    return tw;
  });
  const off = tagW - ((t * 46) % total);
  for (let x = off; x < w; x += total) {
    let xx = x;
    items.forEach((it, i) => {
      ctx.fillStyle = it.color;
      ctx.fillText(it.text, xx, y0 + h / 2 + 0.5);
      xx += widths[i];
      ctx.fillStyle = '#ffd23f';
      ctx.fillText(sep, xx, y0 + h / 2 + 0.5);
      xx += sepW;
    });
  }
  // soft fades at both ends of the crawl
  for (const [x0, x1] of [[tagW, tagW + 26], [w, w - 26]] as const) {
    const f = ctx.createLinearGradient(x0, 0, x1, 0);
    f.addColorStop(0, '#120c22');
    f.addColorStop(1, 'rgba(18,12,34,0)');
    ctx.fillStyle = f;
    ctx.fillRect(Math.min(x0, x1), y0, 26, h);
  }
  ctx.restore();
  // LIVE tag with a blinking dot
  ctx.fillStyle = '#d0021b';
  poly(ctx, [[0, y0], [tagW - 4, y0], [tagW + 4, y0 + h], [0, y0 + h]]);
  ctx.fill();
  ctx.fillStyle = Math.floor(t * 2) % 2 ? '#ffffff' : '#ff9a9a';
  ctx.beginPath();
  ctx.arc(10, y0 + h / 2, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = `400 12px ${DISPLAY_FONT}`;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.fillText('LIVE', 17, y0 + h / 2 + 0.5);
}

/** Live jumbotron content, drawn into a JUMBO.w × JUMBO.h canvas (scaled by the caller). */
export function drawJumboScreen(ctx: Ctx, c: JumboContent, t = 0) {
  const { w, h } = JUMBO;
  const TICK_H = 18;
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, c.kind === 'big' ? c.bg : '#0e1240');
  bg.addColorStop(1, c.kind === 'big' ? '#12061f' : '#240a40');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.textBaseline = 'middle';
  if (c.kind === 'title') {
    ctx.fillStyle = 'rgba(255,210,63,0.12)';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + t * 0.4;
      poly(ctx, [
        [62, 44],
        [62 + Math.cos(a) * 140, 44 + Math.sin(a) * 140],
        [62 + Math.cos(a + 0.2) * 140, 44 + Math.sin(a + 0.2) * 140],
      ]);
      ctx.fill();
    }
    ctx.shadowColor = '#ffd23f';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#ffd23f';
    poly(ctx, [[28, 64], [24, 26], [45, 42], [62, 18], [79, 42], [100, 26], [96, 64]]);
    ctx.fill();
    ctx.font = `400 31px ${DISPLAY_FONT}`;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffe58a';
    ctx.fillText(AS.jumboTitle, 120, 32);
    ctx.shadowBlur = 0;
    ctx.font = `800 13px Nunito, "Arial Black", sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(AS.jumboSub, 122, 60, JUMBO.w - 130);
  } else if (c.kind === 'score') {
    const reg = c.regulation ?? 5;
    const ys = c.youShots ?? [];
    const ks = c.kingShots ?? [];
    const n = Math.max(reg, ys.length, ks.length);
    // header strip
    const hdr = ctx.createLinearGradient(0, 0, 0, 15);
    hdr.addColorStop(0, c.sudden ? '#a0001a' : '#2a2160');
    hdr.addColorStop(1, c.sudden ? '#5a0010' : '#161036');
    ctx.fillStyle = hdr;
    ctx.fillRect(0, 0, w, 15);
    ctx.textAlign = 'center';
    ctx.font = `400 12px ${DISPLAY_FONT}`;
    ctx.fillStyle = c.sudden ? (Math.floor(t * 3) % 2 ? '#ffffff' : '#ffd23f') : '#ffd23f';
    ctx.fillText(c.sudden ? '★ SUDDEN DEATH ★' : 'FREE THROW SHOWDOWN', w / 2, 8);
    const panels = [
      { x0: 6, name: c.name.toUpperCase(), n: c.you, shots: ys, col: '#7fe7ff', dim: 'rgba(127,231,255,0.07)', head: ['#1aa6e0', '#0b5e8c'], lead: c.you > c.king },
      { x0: w - 6 - 160, name: 'KING PUFF BALL', n: c.king, shots: ks, col: '#ffd23f', dim: 'rgba(255,210,63,0.07)', head: ['#e8a91c', '#8a5a06'], lead: c.king > c.you },
    ];
    for (const p of panels) {
      const pw = 160;
      // panel body
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.beginPath();
      ctx.roundRect(p.x0, 18, pw, h - TICK_H - 21, 5);
      ctx.fill();
      // team header
      const hg = ctx.createLinearGradient(0, 18, 0, 32);
      hg.addColorStop(0, p.head[0]);
      hg.addColorStop(1, p.head[1]);
      ctx.fillStyle = hg;
      ctx.beginPath();
      ctx.roundRect(p.x0, 18, pw, 14, [5, 5, 0, 0]);
      ctx.fill();
      ctx.font = `400 12px ${DISPLAY_FONT}`;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(p.name, p.x0 + pw / 2, 25.5, pw - 10);
      // big LED score
      ledScore(ctx, p.n, p.x0 + 54, 56, p.col, p.dim);
      if (p.lead) {
        // the leader's panel glows
        ctx.save();
        ctx.globalAlpha = 0.55 + Math.sin(t * 5) * 0.3;
        ctx.strokeStyle = p.col;
        ctx.lineWidth = 1.5;
        ctx.shadowColor = p.col;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.roundRect(p.x0 + 0.75, 18.75, pw - 1.5, h - TICK_H - 22.5, 5);
        ctx.stroke();
        ctx.restore();
      }
      // shot-by-shot lights (made = green, missed = red)
      const per = Math.min(n, 10);
      const rows = Math.ceil(per / 5);
      const first = Math.max(0, Math.min(p.shots.length, n) - per);
      for (let i = 0; i < per; i++) {
        const shot = p.shots[first + i];
        const cx = p.x0 + 102 + (i % 5) * 11.5;
        const cy = 52 + Math.floor(i / 5) * 12 - (rows > 1 ? 6 : 0);
        ctx.beginPath();
        ctx.arc(cx, cy, 4, 0, Math.PI * 2);
        if (shot === undefined) {
          ctx.fillStyle = 'rgba(255,255,255,0.12)';
          ctx.fill();
        } else {
          ctx.save();
          ctx.fillStyle = shot ? '#4dff7a' : '#ff4d5e';
          ctx.shadowColor = shot ? '#4dff7a' : '#ff4d5e';
          ctx.shadowBlur = 6;
          ctx.fill();
          ctx.restore();
        }
      }
      ctx.font = `400 9px ${DISPLAY_FONT}`;
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillText('SHOTS', p.x0 + 125, rows > 1 ? 72 : 66);
    }
    // centre column: VS + which shot we're on
    const done = Math.min(ys.length, ks.length);
    const shot = c.sudden ? done + 1 : Math.min(done + 1, reg);
    ctx.font = `400 18px ${DISPLAY_FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText('VS', w / 2, 36);
    ctx.font = `400 9px ${DISPLAY_FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText('SHOT', w / 2, 54);
    ctx.font = `400 15px ${DISPLAY_FONT}`;
    ctx.fillStyle = c.sudden ? '#ff6a7a' : '#ffffff';
    ctx.fillText(c.sudden ? `SD ${shot - reg}` : `${shot}/${reg}`, w / 2, 68);
  } else {
    ctx.textAlign = 'center';
    // bursting rays behind the big call
    ctx.save();
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = c.color;
    const cy = (h - TICK_H) / 2;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + t * 0.8;
      poly(ctx, [
        [w / 2, cy],
        [w / 2 + Math.cos(a) * 300, cy + Math.sin(a) * 300],
        [w / 2 + Math.cos(a + 0.18) * 300, cy + Math.sin(a + 0.18) * 300],
      ]);
      ctx.fill();
    }
    ctx.restore();
    const pulse = 1 + Math.sin(t * 9) * 0.03;
    ctx.save();
    ctx.translate(w / 2, c.sub ? 34 : cy - 2);
    ctx.scale(pulse, pulse);
    ctx.font = `400 ${c.sub ? 42 : 52}px ${DISPLAY_FONT}`;
    ctx.lineJoin = 'round';
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.strokeText(c.text, 0, 0, w - 24);
    ctx.shadowColor = c.color;
    ctx.shadowBlur = 16;
    ctx.fillStyle = c.color;
    ctx.fillText(c.text, 0, 0, w - 24);
    ctx.restore();
    if (c.sub) {
      ctx.font = `400 15px ${DISPLAY_FONT}`;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(c.sub, w / 2, 70, w - 20);
    }
  }
  // ticker
  const items =
    c.kind === 'score'
      ? [
          { text: `${c.name.toUpperCase()} ${c.you}  ·  KING ${c.king}`, color: '#ffffff' },
          { text: AS.jumboTitle + ' ' + AS.words[1], color: '#ffd23f' },
          { text: c.sudden ? 'SUDDEN DEATH — EVERY SHOT COUNTS' : '5 SHOTS EACH', color: '#7fe7ff' },
          ...AS.ads.slice(0, 3).map((a) => ({ text: a.text, color: '#ffffff' })),
        ]
      : [
          { text: 'FREE THROW SHOWDOWN', color: '#ffffff' },
          { text: AS.jumboTitle + ' ' + AS.words[1], color: '#ffd23f' },
          { text: '5 SHOTS EACH', color: '#7fe7ff' },
          ...AS.ads.slice(0, 3).map((a) => ({ text: a.text, color: '#ffffff' })),
        ];
  jumboTicker(ctx, items, t, h - TICK_H, TICK_H, w);
  // LED pixels + glare
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  for (let x = 0; x < w; x += 2.6) ctx.fillRect(x, 0, 0.7, h);
  for (let y = 0; y < h; y += 2.6) ctx.fillRect(0, y, w, 0.7);
  const glare = ctx.createLinearGradient(0, 0, 160, h);
  glare.addColorStop(0, 'rgba(255,255,255,0.12)');
  glare.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glare;
  ctx.fillRect(0, 0, w, h);
}

/** The LED ribbon between the decks, in stage coordinates (the scene animates it). */
export const RIBBON = { x: L, y: RIBBON_Y0, w: R - L, h: RIBBON_Y1 - RIBBON_Y0 };

/**
 * The ribbon board as a live, scrolling LED marquee: sponsor panels glide
 * past, and big moments ("KOBE!") race across the whole ribbon.
 */
export function drawRibbonScreen(ctx: Ctx, t: number, msg: { text: string; color: string; bg: string; t0: number } | null) {
  const { w, h } = RIBBON;
  ctx.fillStyle = '#060509';
  ctx.fillRect(0, 0, w, h);
  const age = msg ? t - msg.t0 : Infinity;
  if (msg && age < 2.6) {
    // a full-width takeover: the message chases across, repeated, on a pulsing field
    const bgc = ctx.createLinearGradient(0, 0, w, 0);
    bgc.addColorStop(0, msg.bg);
    bgc.addColorStop(0.5, Math.floor(t * 6) % 2 ? msg.bg : '#000000');
    bgc.addColorStop(1, msg.bg);
    ctx.fillStyle = bgc;
    ctx.fillRect(0, 0, w, h);
    ctx.font = `400 14px ${DISPLAY_FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const unit = `${msg.text}  ★  `;
    const uw = ctx.measureText(unit).width;
    const off = -((t * 260) % uw);
    ctx.shadowColor = msg.color;
    ctx.shadowBlur = 6;
    ctx.fillStyle = msg.color;
    for (let x = off; x < w; x += uw) ctx.fillText(unit, x, h / 2 + 1);
    ctx.shadowBlur = 0;
  } else {
    // sponsor panels sliding by
    const segW = 230;
    const off = -((t * 28) % (segW * AS.ads.length));
    let i = 0;
    for (let x = off; x < w; x += segW, i++) {
      if (x + segW < 0) continue;
      const ad = AS.ads[i % AS.ads.length];
      ctx.fillStyle = ad.bg;
      ctx.fillRect(x + 1.5, 0, segW - 3, h);
      const sheen = ctx.createLinearGradient(0, 0, 0, h);
      sheen.addColorStop(0, 'rgba(255,255,255,0.22)');
      sheen.addColorStop(0.5, 'rgba(255,255,255,0)');
      sheen.addColorStop(1, 'rgba(0,0,0,0.18)');
      ctx.fillStyle = sheen;
      ctx.fillRect(x + 1.5, 0, segW - 3, h);
      ctx.font = `400 12px ${DISPLAY_FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = ad.fg;
      ctx.fillText(ad.text, x + segW / 2, h / 2 + 1, segW - 18);
    }
    // a light sweep running along it now and then
    const sx = ((t * 400) % (w * 2.5)) - w * 0.25;
    const sw = ctx.createLinearGradient(sx - 60, 0, sx + 60, 0);
    sw.addColorStop(0, 'rgba(255,255,255,0)');
    sw.addColorStop(0.5, 'rgba(255,255,255,0.28)');
    sw.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sw;
    ctx.fillRect(sx - 60, 0, 120, h);
  }
  // LED pixel grid
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  for (let x = 0; x < w; x += 2.6) ctx.fillRect(x, 0, 0.7, h);
  for (let y = 0; y < h; y += 2.6) ctx.fillRect(0, y, w, 0.7);
}

function drawJumbotron(ctx: Ctx) {
  const x0 = JUMBO.x - 8;
  const x1 = JUMBO.x + JUMBO.w + 8;
  const y0 = -32;
  const y1 = 92;
  ctx.strokeStyle = '#2b2835';
  ctx.lineWidth = 2;
  for (const cx of [x0 + 50, x1 - 50]) seg(ctx, [cx, T], [cx, y0]);
  ctx.save();
  ctx.shadowColor = 'rgba(110,80,255,0.55)';
  ctx.shadowBlur = 40;
  ctx.fillStyle = '#0b0a10';
  ctx.beginPath();
  ctx.roundRect(x0, y0, x1 - x0, y1 - y0, 6);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = '#34303f';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  const sx0 = x0 + 8;
  const sx1 = x1 - 8;
  const sy0 = y0 + 8;
  const sy1 = y1 - 8;
  ctx.save();
  ctx.beginPath();
  ctx.rect(sx0, sy0, sx1 - sx0, sy1 - sy0);
  ctx.clip();
  const scr = ctx.createLinearGradient(sx0, sy0, sx1, sy1);
  scr.addColorStop(0, '#101548');
  scr.addColorStop(1, '#2a0c4a');
  ctx.fillStyle = scr;
  ctx.fillRect(sx0, sy0, sx1 - sx0, sy1 - sy0);
  // light rays behind the crown
  const cx = sx0 + 62;
  const cy = sy0 + 42;
  ctx.fillStyle = 'rgba(255,210,63,0.10)';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    poly(ctx, [
      [cx, cy],
      [cx + Math.cos(a) * 120, cy + Math.sin(a) * 120],
      [cx + Math.cos(a + 0.2) * 120, cy + Math.sin(a + 0.2) * 120],
    ]);
    ctx.fill();
  }
  // crown
  ctx.shadowColor = '#ffd23f';
  ctx.shadowBlur = 12;
  ctx.fillStyle = '#ffd23f';
  poly(ctx, [
    [cx - 34, cy + 20],
    [cx - 38, cy - 18],
    [cx - 17, cy - 2],
    [cx, cy - 26],
    [cx + 17, cy - 2],
    [cx + 38, cy - 18],
    [cx + 34, cy + 20],
  ]);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#e8463f';
  for (const [jx, jy] of [
    [-17, 8],
    [0, 4],
    [17, 8],
  ])
    ctx.fillRect(cx + jx - 3.5, cy + jy - 3.5, 7, 7);
  // titles
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = `400 31px ${DISPLAY_FONT}`;
  ctx.shadowColor = '#ffd23f';
  ctx.shadowBlur = 10;
  ctx.fillStyle = '#ffe58a';
  ctx.fillText(AS.jumboTitle, sx0 + 120, sy0 + 30);
  ctx.shadowBlur = 0;
  ctx.font = `800 13px Nunito, "Arial Black", sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(AS.jumboSub, sx0 + 122, sy0 + 58, sx1 - sx0 - 130);
  // ticker
  ctx.fillStyle = '#b3001b';
  ctx.fillRect(sx0, sy1 - 20, sx1 - sx0, 20);
  ctx.font = `400 13px ${DISPLAY_FONT}`;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText('FREE THROW SHOWDOWN  ★  5 SHOTS EACH  ★  SUDDEN DEATH', (sx0 + sx1) / 2, sy1 - 9.5);
  // LED pixels + glass glare
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  for (let x = sx0; x < sx1; x += 2.6) ctx.fillRect(x, sy0, 0.7, sy1 - sy0);
  for (let y = sy0; y < sy1; y += 2.6) ctx.fillRect(sx0, y, sx1 - sx0, 0.7);
  const glare = ctx.createLinearGradient(sx0, sy0, sx0 + 160, sy1);
  glare.addColorStop(0, 'rgba(255,255,255,0.12)');
  glare.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glare;
  ctx.fillRect(sx0, sy0, sx1 - sx0, sy1 - sy0);
  ctx.restore();
}

function drawBanners(ctx: Ctx) {
  const lines = AS.banners;
  ctx.strokeStyle = '#2b2835';
  ctx.lineWidth = 2;
  const b0 = AS.layout.bannerX;
  seg(ctx, [b0 - 20, T + 8], [b0 + 310, T + 8]);
  lines.forEach((ls, i) => {
    const bx = b0 + i * 105;
    const by = T + 10;
    const w = 72;
    const h = 104;
    const g = ctx.createLinearGradient(0, by, 0, by + h);
    g.addColorStop(0, AS.bannerTop);
    g.addColorStop(1, AS.bannerBottom);
    ctx.fillStyle = g;
    poly(ctx, [
      [bx, by],
      [bx + w, by],
      [bx + w, by + h],
      [bx + w / 2, by + h - 12],
      [bx, by + h],
    ]);
    ctx.fill();
    ctx.strokeStyle = 'rgba(232,185,49,0.85)';
    ctx.lineWidth = 2;
    poly(ctx, [
      [bx + 5, by + 4],
      [bx + w - 5, by + 4],
      [bx + w - 5, by + h - 8],
      [bx + w / 2, by + h - 18],
      [bx + 5, by + h - 8],
    ]);
    ctx.stroke();
    ctx.fillStyle = '#e8b931';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `400 15px ${DISPLAY_FONT}`;
    ctx.fillText(ls[0], bx + w / 2, by + 30, w - 12);
    ctx.font = `400 12px ${DISPLAY_FONT}`;
    ctx.fillText(ls[1], bx + w / 2, by + 50, w - 12);
    ctx.fillText('★ ★ ★', bx + w / 2, by + 70, w - 12);
  });
  // they hang up in the dark
  ctx.fillStyle = 'rgba(5,3,12,0.3)';
  ctx.fillRect(1100, T, 330, 130);
}

/** A soft beam of light (for additive blending). Width w at the bottom, height h. */
export function drawSpotlight(ctx: Ctx, w: number, h: number) {
  for (let i = 0; i < 6; i++) {
    const f = 1 - i * 0.15;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(255,246,214,0.11)');
    g.addColorStop(1, 'rgba(255,246,214,0)');
    ctx.fillStyle = g;
    poly(ctx, [
      [w / 2 - 8 * f, 0],
      [w / 2 + 8 * f, 0],
      [w / 2 + (w / 2) * f, h],
      [w / 2 - (w / 2) * f, h],
    ]);
    ctx.fill();
  }
}

/** A camera flash in the crowd (for additive blending). */
export function drawCameraFlash(ctx: Ctx, r: number) {
  const g = ctx.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.12, 'rgba(240,248,255,0.9)');
  g.addColorStop(0.35, 'rgba(200,225,255,0.25)');
  g.addColorStop(1, 'rgba(200,225,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, r * 2, r * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillRect(r - r * 0.9, r - 0.6, r * 1.8, 1.2);
  ctx.fillRect(r - 0.6, r - r * 0.9, 1.2, r * 1.8);
}

setArenaStyle(PALACE);
