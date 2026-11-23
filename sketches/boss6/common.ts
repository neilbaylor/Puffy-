// Shared bits for the Boss 6 concept sheets: placing a boat in the world, the heroes and King Bob on
// it (drawn by the game's own art code, so they're on-model), speech bubbles and labels.
import { CHAR_H, CHAR_W, carry, carryHand, drawCharacter, type Ctx, type Pose } from '../../src/gfx/draw';
import type { Face } from '../../src/gfx/face';
import { characterById } from '../../src/data/characters';
import { BOAT, BOWL, BOBBER, drawBoat, drawBobber, drawBowlBack, drawBowlFront, drawCooler, COOLER } from '../../src/gfx/fishing';
import { drawFish, kingBobLook, type FishFrame } from '../../src/gfx/fish';
import { drawRod, type Boat6 } from '../../src/gfx/fishing6';

/** As in FishingScene: the boat's scale in the world, the bowl's, a hero's (world px per art unit). */
export const BS = 1.18;
export const BOWL_K = 1.32;
export const HERO_K = 2.38;
const HERO_M = 8;
export const ROD_LEN = 178;
export const KING_ROD_LEN = 150;

export const canvasOf = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return { c, ctx: c.getContext('2d')! };
};

/** A boat placed in the world: its picture's left edge (world x) and the sea's surface (world y). */
export interface Placed {
  boat: Pick<Boat6, 'w' | 'h' | 'water' | 'hero' | 'king' | 'draw'>;
  x0: number;
  wy: number;
}
/** Boss 5's boat as a Placed one (for comparing sizes). */
export const BOSS5: Placed['boat'] = { w: BOAT.w, h: BOAT.h, water: BOAT.water, hero: [BOAT.hero, BOAT.feet + 2], king: [BOAT.king, BOAT.feet + 3], draw: drawBoat };
/** A point on the boat's picture → the world. */
export const at = (p: Placed, px: number, py: number) => ({ x: p.x0 + px * BS, y: p.wy + (py - p.boat.water) * BS });
export function drawPlacedBoat(ctx: Ctx, p: Placed, tint = 0) {
  if (!tint) {
    ctx.save();
    ctx.translate(p.x0, p.wy - p.boat.water * BS);
    ctx.scale(BS, BS);
    p.boat.draw(ctx);
    ctx.restore();
    return;
  }
  // (darkened for the storm, as a tint would: drawn on its own, then shaded where it's drawn)
  const t = ctx.getTransform();
  const k = Math.hypot(t.a, t.b);
  const { c, ctx: o } = canvasOf(Math.ceil(p.boat.w * BS * k), Math.ceil(p.boat.h * BS * k) + 200);
  o.scale(BS * k, BS * k);
  o.translate(0, 200 / (BS * k));
  p.boat.draw(o);
  o.setTransform(1, 0, 0, 1, 0, 0);
  o.globalCompositeOperation = 'source-atop';
  o.fillStyle = `rgba(28,40,64,${tint})`;
  o.fillRect(0, 0, c.width, c.height);
  ctx.save();
  ctx.translate(p.x0, p.wy - p.boat.water * BS - 200 / k);
  ctx.scale(1 / k, 1 / k);
  ctx.drawImage(c, 0, 0);
  ctx.restore();
}

/**
 * A hero, feet at (x, y) in the world, at game size. `a`: holding a rod (or King Bob) in both hands
 * at that arm angle (the cast frames); otherwise `pose`. `lean`: tipped back (fighting a fish).
 * Returns where the hands are.
 */
export function drawHero(ctx: Ctx, id: string, x: number, y: number, o: { a?: number; pose?: Pose; face?: Face; lean?: number; k?: number } = {}) {
  const ch = characterById(id);
  const k = HERO_K * ch.scale * (o.k ?? 1);
  const lean = o.lean ?? 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(lean);
  ctx.scale(k, k);
  ctx.translate(-(CHAR_W + HERO_M * 2) / 2, -CHAR_H);
  if (o.a !== undefined) {
    carry.on = true;
    carry.a = o.a;
  }
  try {
    drawCharacter(ctx, HERO_M, 0, ch, o.pose ?? 'idle0', o.face, '');
  } finally {
    carry.on = false;
    carry.a = -1.75;
  }
  ctx.restore();
  const [hx, hy] = carryHand(ch.id, o.a ?? -1.75);
  const dx = (hx + HERO_M - (CHAR_W + HERO_M * 2) / 2) * k;
  const dy = (hy - CHAR_H) * k;
  return { x: x + dx * Math.cos(lean) - dy * Math.sin(lean), y: y + dx * Math.sin(lean) + dy * Math.cos(lean) };
}

/** King Bob alone, centred at (x, y), at his size in the bowl (k: more or less), turned by rot. */
export function drawKing(ctx: Ctx, x: number, y: number, o: { f?: FishFrame; rot?: number; k?: number; flip?: boolean; mad?: boolean; askew?: boolean; fins?: boolean; alpha?: number } = {}) {
  const k = 0.98 * BOWL_K * (o.k ?? 1);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(o.rot ?? 0);
  ctx.scale(o.flip ? -k : k, k);
  if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
  kingBobLook.mad = !!o.mad;
  kingBobLook.askew = !!o.askew;
  kingBobLook.fins = !!o.fins;
  try {
    drawFish(ctx, -50, -44, 'kingbob', o.f ?? 'sw0');
  } finally {
    kingBobLook.mad = kingBobLook.askew = kingBobLook.fins = false;
  }
  ctx.restore();
}

/** King Bob's bowl standing at (x, y) (the bottom of its stand), him in it (unless `empty`), his gold rod. */
export function drawKingBowl(ctx: Ctx, x: number, y: number, o: { empty?: boolean; f?: FishFrame; rod?: boolean; rodA?: number } = {}) {
  const K = BOWL_K;
  const bowl = (fn: (c: Ctx) => void) => {
    ctx.save();
    ctx.translate(x - (BOWL.w / 2) * K, y - BOWL.h * K);
    ctx.scale(K, K);
    fn(ctx);
    ctx.restore();
  };
  bowl(drawBowlBack);
  if (!o.empty) drawKing(ctx, x + 2 * K, y - (BOWL.h - BOWL.cy - 10) * K, { f: o.f });
  bowl(drawBowlFront);
  if (o.rod !== false && !o.empty) {
    const tip = drawRod(ctx, x + 44 * K, y + (-BOWL.h + 30) * K, o.rodA ?? -1.1, KING_ROD_LEN, 0, { king: true });
    hangBobber(ctx, tip.x, tip.y, true);
  }
}

/** A bobber hanging off a rod tip (line and all). */
export function hangBobber(ctx: Ctx, tx: number, ty: number, gold = false, drop = 30) {
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(tx, ty);
  ctx.lineTo(tx, ty + drop);
  ctx.stroke();
  ctx.save();
  ctx.translate(tx - BOBBER.w / 2, ty + drop - 2);
  drawBobber(ctx, gold);
  ctx.restore();
}

/** A hero with the rod held up, waiting (the scene's resting pose: frame c5, the rod a touch more upright). */
export function heroWithRod(ctx: Ctx, id: string, x: number, y: number, o: { a?: number; rodA?: number; bend?: number; face?: Face; lean?: number; bobber?: boolean } = {}) {
  const a = o.a ?? -0.85;
  const h = drawHero(ctx, id, x, y, { a, face: o.face, lean: o.lean });
  const tip = drawRod(ctx, h.x, h.y, o.rodA ?? a - 0.5, ROD_LEN, o.bend ?? 0);
  if (o.bobber !== false) hangBobber(ctx, tip.x, tip.y);
  return { hands: h, tip };
}

export function drawCoolerAt(ctx: Ctx, x: number, y: number) {
  ctx.save();
  ctx.translate(x - COOLER.w / 2, y - COOLER.h);
  drawCooler(ctx, false);
  ctx.restore();
}

// ───────────────────────────── type ──

export const DISPLAY = '"Lilita One", "Arial Black", sans-serif';
export const BODY = 'Nunito, sans-serif';
export function text(ctx: Ctx, s: string, x: number, y: number, o: { size?: number; font?: 'display' | 'body'; weight?: number; col?: string; align?: CanvasTextAlign; max?: number; stroke?: string } = {}) {
  ctx.save();
  ctx.font = `${o.font === 'body' ? o.weight ?? 800 : 400} ${o.size ?? 20}px ${o.font === 'body' ? BODY : DISPLAY}`;
  ctx.textAlign = o.align ?? 'left';
  ctx.textBaseline = 'alphabetic';
  if (o.stroke) {
    ctx.strokeStyle = o.stroke;
    ctx.lineWidth = (o.size ?? 20) * 0.22;
    ctx.lineJoin = 'round';
    ctx.strokeText(s, x, y, o.max);
  }
  ctx.fillStyle = o.col ?? '#fff8ec';
  ctx.fillText(s, x, y, o.max);
  ctx.restore();
}
/** Wrap text to lines no wider than w (in the current font). */
export function wrap(ctx: Ctx, s: string, w: number) {
  const out: string[] = [];
  let cur = '';
  for (const word of s.split(' ')) {
    const t = cur ? `${cur} ${word}` : word;
    if (ctx.measureText(t).width > w && cur) {
      out.push(cur);
      cur = word;
    } else cur = t;
  }
  if (cur) out.push(cur);
  return out;
}
/** Paragraph text, wrapped; returns the y under it. */
export function para(ctx: Ctx, s: string, x: number, y: number, w: number, o: { size?: number; col?: string; lh?: number; weight?: number } = {}) {
  ctx.save();
  const size = o.size ?? 18;
  ctx.font = `${o.weight ?? 700} ${size}px ${BODY}`;
  ctx.fillStyle = o.col ?? '#d6c4b4';
  for (const l of wrap(ctx, s, w)) {
    ctx.fillText(l, x, y);
    y += size * (o.lh ?? 1.35);
  }
  ctx.restore();
  return y;
}

/**
 * A comic speech bubble (white, a thick ink outline, a tail to (tx, ty)), the text in it wrapped
 * to w, centred at (x, y). `shout`: spiky.
 */
export function bubble(ctx: Ctx, s: string, x: number, y: number, w: number, tx: number, ty: number, o: { size?: number; shout?: boolean; col?: string } = {}) {
  ctx.save();
  const size = o.size ?? 26;
  ctx.font = `400 ${size}px ${DISPLAY}`;
  const lines = wrap(ctx, s, w);
  const lw = Math.max(...lines.map((l) => ctx.measureText(l).width));
  const bw = lw + size * 1.4;
  const bh = lines.length * size * 1.12 + size * 0.9;
  const x0 = x - bw / 2;
  const y0 = y - bh / 2;
  const shape = () => {
    ctx.beginPath();
    if (o.shout) {
      const n = 22;
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2;
        const r = i % 2 ? 1.0 : 1.16;
        const px = x + Math.cos(a) * (bw / 2 + size * 0.5) * r;
        const py = y + Math.sin(a) * (bh / 2 + size * 0.45) * r;
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
    } else ctx.roundRect(x0, y0, bw, bh, size * 0.7);
    // the tail
    const bx = Math.max(x0 + size, Math.min(x0 + bw - size, x + (tx - x) * 0.3));
    const by = ty > y ? y0 + bh - 2 : y0 + 2;
    ctx.moveTo(bx - size * 0.45, by);
    ctx.lineTo(tx, ty);
    ctx.lineTo(bx + size * 0.45, by);
  };
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#1b1b2a';
  ctx.lineWidth = 7;
  shape();
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  shape();
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.fillStyle = o.col ?? '#1b1b2a';
  lines.forEach((l, i) => ctx.fillText(l, x, y0 + size * 0.45 + size * 0.86 + i * size * 1.12));
  ctx.restore();
}

/** A labelled frame: the picture `fn` drawn into a w × h box at (x, y) (clipped, a thick ink border, rounded). */
export function frame(ctx: Ctx, x: number, y: number, w: number, h: number, fn: () => void) {
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 16);
  ctx.clip();
  ctx.translate(x, y);
  fn();
  ctx.restore();
  ctx.save();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#000';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 16);
  ctx.stroke();
  ctx.restore();
}

/** The page's background and its title block; returns the y under it. */
export function sheetHead(ctx: Ctx, w: number, h: number, eyebrow: string, title: string, lede: string) {
  ctx.fillStyle = '#241a17';
  ctx.fillRect(0, 0, w, h);
  text(ctx, eyebrow.toUpperCase(), 48, 62, { font: 'body', weight: 900, size: 18, col: '#6ff0d8' });
  text(ctx, title, 48, 122, { size: 58, col: '#ffc533' });
  return para(ctx, lede, 48, 168, w - 96, { size: 22 }) + 10;
}

/**
 * King Bob's bubble as Boss 5 draws it (FishingScene.kingSays): Nunito 900 17 px brown text, wrapped to
 * 200 px, in a white rounded box with a 3 px brown line, its tail from the bottom-left corner in to
 * the speaker at (ax, ay). `k` scales it all; `side` -1 puts it up to the left instead.
 */
export function gameBubble(ctx: Ctx, s: string, ax: number, ay: number, o: { k?: number; side?: 1 | -1; lift?: number; size?: number } = {}) {
  const k = o.k ?? 1;
  const side = o.side ?? 1;
  ctx.save();
  ctx.translate(ax, ay);
  ctx.scale(k, k);
  const size = o.size ?? 17;
  ctx.font = `900 ${size}px ${BODY}`;
  const lines = wrap(ctx, s, 200);
  const tw = Math.max(...lines.map((l) => ctx.measureText(l).width));
  const w = tw + 26;
  const h = lines.length * size * 1.25 + 16;
  const bx = side * (w / 2 + 18);
  const by = -h / 2 - (o.lift ?? 34);
  const tx = bx - side * (w / 2 - 16);
  const ty = by + h / 2 - 2;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#3a2418';
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.roundRect(bx - w / 2, by - h / 2, w, h, 12);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(tx - 10 * side, ty);
  ctx.lineTo(0, 0);
  ctx.lineTo(tx + 6 * side, ty);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(tx - 10 * side, ty + 1);
  ctx.lineTo(0, 0);
  ctx.lineTo(tx + 6 * side, ty + 1);
  ctx.stroke();
  ctx.fillStyle = '#3a2418';
  ctx.textAlign = 'center';
  lines.forEach((l, i) => ctx.fillText(l, bx, by - h / 2 + 8 + size * 0.95 + i * size * 1.25));
  ctx.restore();
}

/** A caption under a frame: a number badge, a bold line, a note. */
export function caption(ctx: Ctx, n: string, title: string, note: string, x: number, y: number, w: number) {
  ctx.save();
  ctx.fillStyle = '#ffc533';
  ctx.beginPath();
  ctx.arc(x + 18, y + 16, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  text(ctx, n, x + 18, y + 25, { size: 24, col: '#241a17', align: 'center' });
  text(ctx, title, x + 48, y + 27, { size: 28, col: '#fff8ec' });
  return para(ctx, note, x + 48, y + 56, w - 48, { size: 18 });
}

/** The sheet cut to its first h px. */
export function crop(c: HTMLCanvasElement, h: number) {
  const { c: o, ctx } = canvasOf(c.width, Math.ceil(h));
  ctx.drawImage(c, 0, 0);
  return o;
}
