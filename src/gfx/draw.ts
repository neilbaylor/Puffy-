/**
 * Pure canvas-2D drawing for placeholder art. Nothing here depends on Phaser,
 * so the same functions draw portraits in the DOM menus.
 */
import type { CharacterDef } from '../data/characters';
import { STYLES } from './handdrawn';
import { drawPuffyStyled } from './puffy';

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

const OUTLINE = '#2a1e2e';

// ─────────────────────────────────────────────────────────────
// Characters
// ─────────────────────────────────────────────────────────────

export type Pose = 'idle0' | 'idle1' | 'walk0' | 'walk1' | 'walk2' | 'walk3' | 'jump' | 'fall' | 'hurt';
export const POSES: Pose[] = ['idle0', 'idle1', 'walk0', 'walk1', 'walk2', 'walk3', 'jump', 'fall', 'hurt'];
export const CHAR_W = 56;
export const CHAR_H = 56;

/**
 * Draws a puffy round placeholder hero facing right, feet touching y = oy + CHAR_H - 2.
 */
export function drawCharacter(ctx: Ctx, ox: number, oy: number, ch: CharacterDef, pose: Pose) {
  if (ch.id === 'puffy') {
    drawPuffyStyled(ctx, ox, oy, pose, STYLES[ART_STYLE]);
    return;
  }
  const { main, shade, light, accent } = ch.colors;
  const big = ch.id === 'boom' ? 1.08 : 1;
  const cx = ox + 26;
  const ground = oy + CHAR_H - 2;

  let bodyRx = 15 * big;
  let bodyRy = 15 * big;
  let bob = 0;
  let footL = 0;
  let footR = 0;
  let footLift = [0, 0];
  if (pose === 'idle1') {
    bodyRx += 0.8;
    bodyRy -= 0.8;
  }
  if (pose.startsWith('walk')) {
    const f = +pose.slice(4);
    const cyc = [
      [6, -5, 0, 2],
      [2, -2, 0, 0],
      [-5, 6, 2, 0],
      [-2, 2, 0, 0],
    ][f];
    footL = cyc[0];
    footR = cyc[1];
    footLift = [cyc[2], cyc[3]];
    bob = f % 2 === 1 ? -1.5 : 0;
  }
  if (pose === 'jump') {
    bodyRx -= 1.5;
    bodyRy += 1.5;
    footL = -4;
    footR = 5;
    footLift = [5, 2];
  }
  if (pose === 'fall') {
    bodyRx += 1;
    bodyRy -= 0.5;
    footL = -3;
    footR = 6;
    footLift = [2, 5];
  }

  const cy = ground - 7 - bodyRy + bob;

  // Feet (behind body)
  const foot = (dx: number, lift: number, col: string) => {
    ellipse(ctx, cx + dx, ground - 4 - lift, 7, 4.5, OUTLINE);
    ellipse(ctx, cx + dx, ground - 4.5 - lift, 5.6, 3.3, col);
  };
  foot(-6 + footL, footLift[0], shade);

  // Character-specific back detail
  if (ch.id === 'bolt') {
    // two pointy ears
    for (const s of [-1, 1]) {
      ctx.fillStyle = OUTLINE;
      ctx.beginPath();
      ctx.moveTo(cx + s * 3 - 6, cy - bodyRy + 6);
      ctx.lineTo(cx + s * 7 - 2 + (s > 0 ? 4 : -4), cy - bodyRy - 13);
      ctx.lineTo(cx + s * 9 + 2, cy - bodyRy + 6);
      ctx.fill();
      ctx.fillStyle = shade;
      ctx.beginPath();
      ctx.moveTo(cx + s * 3 - 4, cy - bodyRy + 6);
      ctx.lineTo(cx + s * 7 - 2 + (s > 0 ? 4 : -4), cy - bodyRy - 9);
      ctx.lineTo(cx + s * 9, cy - bodyRy + 6);
      ctx.fill();
    }
  }

  // Body
  ellipse(ctx, cx, cy, bodyRx + 2, bodyRy + 2, OUTLINE);
  ellipse(ctx, cx, cy, bodyRx, bodyRy, main);
  // shade + highlight for the "puffy" volume
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, bodyRx, bodyRy, 0, 0, Math.PI * 2);
  ctx.clip();
  ellipse(ctx, cx - 4, cy + bodyRy * 0.9, bodyRx * 1.3, bodyRy * 0.55, shade);
  ellipse(ctx, cx - 6, cy - bodyRy * 0.45, 5, 3.5, light);
  ellipse(ctx, cx + 5, cy + 5, 7, 5, light + '66');
  ctx.restore();

  if (ch.id === 'boom') {
    // helmet
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, bodyRx, bodyRy, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(cx - bodyRx - 2, cy - bodyRy - 2, bodyRx * 2 + 4, bodyRy * 0.75 + 3);
    ctx.fillStyle = '#6b7a52';
    ctx.fillRect(cx - bodyRx - 2, cy - bodyRy - 2, bodyRx * 2 + 4, bodyRy * 0.75);
    ctx.fillStyle = '#8d9c6f';
    ctx.fillRect(cx - bodyRx, cy - bodyRy * 0.55, bodyRx * 2, 2.5);
    ctx.restore();
  }
  if (ch.id === 'bolt') {
    // lightning stripe
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.moveTo(cx - 9, cy + 3);
    ctx.lineTo(cx - 3, cy - 1);
    ctx.lineTo(cx - 4, cy + 3);
    ctx.lineTo(cx + 1, cy + 1);
    ctx.lineTo(cx - 6, cy + 8);
    ctx.lineTo(cx - 5, cy + 4);
    ctx.closePath();
    ctx.fill();
  }

  // Face
  const ey = cy - 3 + (ch.id === 'boom' ? 2 : 0);
  const hurt = pose === 'hurt';
  for (const ex of [cx + 3, cx + 10]) {
    ellipse(ctx, ex, ey, 3.6, 4.8, OUTLINE);
    ellipse(ctx, ex, ey, 2.9, 4.1, '#ffffff');
    if (hurt) {
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(ex - 2, ey - 2);
      ctx.lineTo(ex + 2, ey + 2);
      ctx.moveTo(ex + 2, ey - 2);
      ctx.lineTo(ex - 2, ey + 2);
      ctx.stroke();
    } else {
      ellipse(ctx, ex + 1.2, ey + 0.4, 1.7, 2.5, OUTLINE);
      ellipse(ctx, ex + 1.8, ey - 0.8, 0.7, 0.8, '#ffffff');
    }
  }
  // cheek + mouth
  ellipse(ctx, cx + 13, ey + 6, 2.4, 1.5, '#ff8fa3aa');
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  if (hurt) ctx.ellipse(cx + 8, ey + 8, 2, 2.4, 0, 0, Math.PI * 2);
  else ctx.arc(cx + 7.5, ey + 5.5, 3, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();

  // Front foot
  foot(7 + footR, footLift[1], shade);

  // Bazooka, resting on the shoulder
  const by = cy + 3 + (pose === 'jump' ? -1 : 0);
  const bx0 = cx - 18;
  const bx1 = cx + 24;
  roundRect(ctx, bx0 - 1, by - 5, bx1 - bx0 + 2, 10, 4, OUTLINE);
  roundRect(ctx, bx0, by - 4, bx1 - bx0, 8, 3, '#4d6b55');
  ctx.fillStyle = '#6f9479';
  ctx.fillRect(bx0 + 2, by - 3, bx1 - bx0 - 4, 2);
  // muzzle
  roundRect(ctx, bx1 - 5, by - 6, 7, 12, 2, OUTLINE);
  roundRect(ctx, bx1 - 4, by - 5, 5, 10, 1.5, '#39463d');
  // rear flare
  roundRect(ctx, bx0 - 3, by - 6, 5, 12, 2, OUTLINE);
  roundRect(ctx, bx0 - 2, by - 5, 3, 10, 1, '#39463d');
  // stripe in player color
  ctx.fillStyle = accent;
  ctx.fillRect(cx + 8, by - 4, 3, 8);
  // grip + hand
  ellipse(ctx, cx + 4, by + 5, 4.2, 3.6, OUTLINE);
  ellipse(ctx, cx + 4, by + 4.6, 3.2, 2.7, light);
}

/** A portrait for menus. */
export function drawPortrait(target: HTMLCanvasElement, ch: CharacterDef, pose: Pose = 'idle0') {
  const ctx = target.getContext('2d')!;
  ctx.clearRect(0, 0, target.width, target.height);
  const s = Math.min(target.width / CHAR_W, target.height / CHAR_H);
  ctx.save();
  ctx.translate((target.width - CHAR_W * s) / 2, (target.height - CHAR_H * s) / 2);
  ctx.scale(s, s);
  drawCharacter(ctx, 0, 0, ch, pose);
  ctx.restore();
}
