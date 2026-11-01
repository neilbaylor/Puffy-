/**
 * Pure canvas-2D drawing for placeholder art. Nothing here depends on Phaser,
 * so the same functions draw portraits in the DOM menus.
 */
import type { CharacterDef } from '../data/characters';
import { STYLES } from './handdrawn';
import { drawPuffyStyled } from './puffy';
import { drawScruffyStyled } from './scruffy';
import { drawMusclesStyled } from './muscles';

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

export type Pose = 'idle0' | 'idle1' | 'walk0' | 'walk1' | 'walk2' | 'walk3' | 'jump' | 'fall' | 'hurt' | 'shoot';
export const POSES: Pose[] = ['idle0', 'idle1', 'walk0', 'walk1', 'walk2', 'walk3', 'jump', 'fall', 'hurt', 'shoot'];
export const CHAR_W = 56;
export const CHAR_H = 56;

/** Draws a hero facing right, feet touching y = oy + CHAR_H - 2. */
export function drawCharacter(ctx: Ctx, ox: number, oy: number, ch: CharacterDef, pose: Pose) {
  const st = STYLES[ART_STYLE];
  switch (ch.id) {
    case 'scruffy':
      drawScruffyStyled(ctx, ox, oy, pose, st);
      break;
    case 'muscles':
      drawMusclesStyled(ctx, ox, oy, pose, st);
      break;
    default:
      drawPuffyStyled(ctx, ox, oy, pose, st);
  }
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
