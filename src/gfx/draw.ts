/**
 * Pure canvas-2D drawing for placeholder art. Nothing here depends on Phaser,
 * so the same functions draw portraits in the DOM menus.
 */
import type { CharacterDef } from '../data/characters';
import { STYLES } from './handdrawn';
import { drawPuffyStyled } from './puffy';
import { drawScruffyStyled } from './scruffy';
import { drawMusclesStyled } from './muscles';
import { ellipsePts } from './handdrawn';
import { drawNuggie } from './collectibles';
import { withFace, type Face } from './face';

/** Which hand-drawn look the game renders Puffy with (see the look-development page). */
export const ART_STYLE = 'polished' as const;
/** Character textures are drawn at this multiple of their in-world size, so they stay crisp when the camera zooms in. */
export const ART_RES = 3;

export type Ctx = CanvasRenderingContext2D;

export function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  return { c, ctx };
}

/** Deterministic PRNG so generated art and decor are stable between runs. */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, fill: string) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2);
  ctx.fill();
}

export function roundRect(
  ctx: Ctx, x: number, y: number, w: number, h: number, r: number, fill?: string, stroke?: string, lw = 2,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}

// ─────────────────────────────────────────────────────────────
// Characters
// ─────────────────────────────────────────────────────────────

export type Pose = 'idle0' | 'idle1' | `walk${0 | 1 | 2 | 3 | 4 | 5 | 6 | 7}` | 'jump' | 'fall' | 'hurt' | 'shoot' | 'eat0' | 'eat1';
/** Walk cycle length (frames). */
export const WALK_FRAMES = 8;
export const POSES: Pose[] = ['idle0', 'idle1', 'walk0', 'walk1', 'walk2', 'walk3', 'walk4', 'walk5', 'walk6', 'walk7', 'jump', 'fall', 'hurt', 'shoot', 'eat0', 'eat1'];

/**
 * One smooth walk cycle from a single phase (frame f of WALK_FRAMES): the legs
 * swing opposite each other, the leg swinging forward lifts mid-stride, the
 * body dips as each foot lands and rises as the legs pass, and `swing` (−1…1)
 * is for counter-swinging arms.
 */
export function gait(f: number, stride: number, lift: number, bobAmt = 1.6) {
  const ph = (f / WALK_FRAMES) * Math.PI * 2;
  const c = Math.cos(ph);
  const sn = Math.sin(ph);
  return {
    legL: stride * c,
    legR: -stride * c,
    liftL: lift * Math.max(0, -sn),
    liftR: lift * Math.max(0, sn),
    bob: -bobAmt * Math.abs(sn),
    swing: c,
  };
}
export const CHAR_W = 56;
export const CHAR_H = 56;

/** Draws a hero facing right, feet touching y = oy + CHAR_H - 2. */
export function drawCharacter(ctx: Ctx, ox: number, oy: number, ch: CharacterDef, pose: Pose, f?: Face) {
  if (f) return withFace(f, () => drawCharacter(ctx, ox, oy, ch, pose));
  const st = STYLES[ART_STYLE];
  const base: Pose = pose === 'eat0' ? 'idle0' : pose === 'eat1' ? 'idle1' : pose;
  switch (ch.id) {
    case 'scruffy':
      drawScruffyStyled(ctx, ox, oy, base, st);
      break;
    case 'muscles':
      drawMusclesStyled(ctx, ox, oy, base, st);
      break;
    default:
      drawPuffyStyled(ctx, ox, oy, base, st);
  }
  if (pose === 'eat0' || pose === 'eat1') drawEating(ctx, ox, oy, ch.id, pose === 'eat1', st);
}

/** Where each hero's mouth is inside the 56×56 frame. */
const MOUTH: Record<string, [number, number, number]> = {
  puffy: [35.5, 28.5, 1],
  scruffy: [31.5, 38, 0.8],
  muscles: [31, 28, 1],
};

/** Munching a nuggie: open mouth + nuggie (eat0), then puffed cheek + crumbs (eat1). */
function drawEating(ctx: Ctx, ox: number, oy: number, id: string, chew: boolean, st: (typeof STYLES)[keyof typeof STYLES]) {
  const [mx, my, k] = MOUTH[id] ?? MOUTH.puffy;
  const x = ox + mx;
  const y = oy + my;
  if (!chew) {
    st.shape(ctx, ellipsePts(x, y, 3.2 * k, 2.6 * k, 0, 16), { base: '#5e1a2a', shade: '#33091a', light: '#8e2f45' }, 1401, { lw: 0.7, plain: true });
    drawNuggie(ctx, x + 6 * k, y + 0.5, 5.6 * k, 0.5);
  } else {
    st.shape(ctx, ellipsePts(x + 1, y, 4.6 * k, 3.6 * k, 0, 18), { base: '#ffb36a', shade: '#e2721f', light: '#ffe0b8' }, 1402, { lw: 0.7 });
    st.line(ctx, [[x - 1.5 * k, y + 0.5], [x + 1 * k, y + 1.4], [x + 3.5 * k, y + 0.4]], 1403, 0.55);
    ctx.fillStyle = '#d9902e';
    for (const [dx, dy] of [[6, -2], [7.5, 1.5], [5, 3.5], [9, -0.5]] as const) {
      ctx.beginPath();
      ctx.arc(x + dx * k, y + dy * k, 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** How far each hero's standing drawing reaches left and right of their middle (units), measured once. */
const heroSpan = new Map<string, [number, number]>();
function spanOf(ch: CharacterDef): [number, number] {
  let sp = heroSpan.get(ch.id);
  if (sp) return sp;
  const R = 4;
  const M = 24; // room either side for the bazooka
  const { c, ctx } = canvas((CHAR_W + M * 2) * R, CHAR_H * R);
  ctx.scale(R, R);
  drawCharacter(ctx, M, 0, ch, 'idle0');
  const data = ctx.getImageData(0, 0, c.width, c.height).data;
  let x0 = c.width;
  let x1 = 0;
  for (let y = 0; y < c.height; y += 2)
    for (let x = 0; x < c.width; x += 2)
      if (data[(y * c.width + x) * 4 + 3] > 24) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
      }
  sp = [x0 / R - M - 27, x1 / R - M - 27];
  heroSpan.set(ch.id, sp);
  return sp;
}

/**
 * Big lobby picture: feet on the bottom edge, heroes drawn at their real
 * relative sizes, centred on the whole drawing (bazooka included) and made
 * smaller if they'd otherwise poke out of the side of the card.
 */
export function drawHeroCard(target: HTMLCanvasElement, ch: CharacterDef, pose: Pose = 'idle0', f?: Face) {
  const ctx = target.getContext('2d')!;
  ctx.clearRect(0, 0, target.width, target.height);
  const [l, r] = spanOf(ch);
  const mid = (l + r) / 2;
  const half = (r - l) / 2;
  const s = Math.min((target.height / (56 * 1.32)) * ch.scale, (target.width * 0.48) / half);
  ctx.save();
  ctx.translate(target.width / 2 - mid * s, target.height * 0.985);
  ctx.scale(s, s);
  drawCharacter(ctx, -27, -54, ch, pose, f);
  ctx.restore();
}

/** A portrait for menus. */
/**
 * A hero portrait, centred and sized by the actual drawing (not the frame), so
 * every hero sits in the middle of the badge whatever their size or shape.
 */
/** Room round a hero when it's drawn on its own (the bazooka's tip pokes out past the 56-unit cell). */
const EDGE = 12;

/** Each hero + pose's drawn outline, measured once (so redrawing a new face is cheap). */
const portraitBox = new Map<string, [number, number, number, number]>();

export function drawPortrait(target: HTMLCanvasElement, ch: CharacterDef, pose: Pose = 'idle0', f?: Face, boxPose: Pose = pose) {
  const R = 4;
  const { c: tmp, ctx: t } = canvas((CHAR_W + EDGE * 2) * R, (CHAR_H + EDGE) * R);
  t.scale(R, R);
  drawCharacter(t, EDGE, EDGE, ch, pose, f);
  // find the drawing's bounding box (with the neutral face, once per hero + pose)
  // (frames of one animation share the box of `boxPose`, so they don't jump in size)
  const key = `${ch.id}:${boxPose}`;
  let box = portraitBox.get(key);
  if (!box) {
    const { c: m, ctx: mc } = canvas((CHAR_W + EDGE * 2) * R, (CHAR_H + EDGE) * R);
    mc.scale(R, R);
    drawCharacter(mc, EDGE, EDGE, ch, boxPose);
    const data = mc.getImageData(0, 0, m.width, m.height).data;
    let x0 = m.width, y0 = m.height, x1 = 0, y1 = 0;
    for (let y = 0; y < m.height; y += 2)
      for (let x = 0; x < m.width; x += 2)
        if (data[(y * m.width + x) * 4 + 3] > 24) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
    box = [x0, y0, x1, y1];
    portraitBox.set(key, box);
  }
  const [x0, y0, x1, y1] = box;
  const ctx = target.getContext('2d')!;
  ctx.clearRect(0, 0, target.width, target.height);
  if (x1 <= x0 || y1 <= y0) return;
  const bw = x1 - x0 + 2;
  const bh = y1 - y0 + 2;
  const pad = 0.08;
  const s = Math.min((target.width * (1 - pad * 2)) / bw, (target.height * (1 - pad * 2)) / bh);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(tmp, x0, y0, bw, bh, (target.width - bw * s) / 2, (target.height - bh * s) / 2, bw * s, bh * s);
}

/**
 * Several poses of one hero, each drawn once onto its own canvas at ONE shared
 * scale and with the feet on the same baseline, so flipping between them is a
 * cheap drawImage and the hero never changes size from pose to pose.
 */
export function renderPoseSet(ch: CharacterDef, poses: Pose[], size: number): Record<string, HTMLCanvasElement> {
  const R = 4;
  const drawn = poses.map((pose) => {
    const { c, ctx } = canvas((CHAR_W + EDGE * 2) * R, (CHAR_H + EDGE) * R);
    ctx.scale(R, R);
    drawCharacter(ctx, EDGE, EDGE, ch, pose);
    return c;
  });
  // the union of every pose's outline
  let x0 = Infinity, y0 = Infinity, x1 = 0, y1 = 0;
  for (const c of drawn) {
    const data = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    for (let y = 0; y < c.height; y += 2)
      for (let x = 0; x < c.width; x += 2)
        if (data[(y * c.width + x) * 4 + 3] > 24) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
  }
  const out: Record<string, HTMLCanvasElement> = {};
  if (x1 <= x0) return out;
  const bw = x1 - x0 + 2;
  const bh = y1 - y0 + 2;
  const s = Math.min((size * 0.84) / bw, (size * 0.84) / bh);
  poses.forEach((pose, i) => {
    const { c, ctx } = canvas(size, size);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(drawn[i], x0, y0, bw, bh, (size - bw * s) / 2, size * 0.92 - bh * s, bw * s, bh * s);
    out[pose] = c;
  });
  return out;
}
