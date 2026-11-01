/**
 * Pure canvas-2D drawing for placeholder art. Nothing here depends on Phaser,
 * so the same functions draw portraits in the DOM menus.
 */
import type { CharacterDef } from '../data/characters';

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
    drawPuffy(ctx, ox, oy, ch, pose);
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

// ─────────────────────────────────────────────────────────────
// Puffy — redrawn from the original pencil + crayon sketches:
// an orange egg seen from the side, one big eye, little flappy arms,
// thin legs with round feet. When hurt he puffs up round and spiky.
// ─────────────────────────────────────────────────────────────

const PENCIL = '#2f2a2e';

/** Diagonal crayon strokes inside the current clip, like the coloring in the sketch. */
function crayon(ctx: Ctx, x: number, y: number, w: number, h: number, seed: number, cols: string[]) {
  const r = rng(seed);
  ctx.lineCap = 'round';
  for (let i = 0; i < 44; i++) {
    const sx = x + r() * w;
    const sy = y + r() * h;
    ctx.strokeStyle = cols[Math.floor(r() * cols.length)];
    ctx.lineWidth = 0.7 + r() * 1.1;
    ctx.beginPath();
    ctx.moveTo(sx - 3, sy + 7);
    ctx.lineTo(sx + 4, sy - 8);
    ctx.stroke();
  }
}

function pencilEllipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, rot: number, fill: string, lw = 1.8) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = PENCIL;
  ctx.lineWidth = lw;
  ctx.stroke();
}

function puffyArm(ctx: Ctx, x: number, y: number, rot: number, fill: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  pencilEllipse(ctx, 6, 0, 7, 3.4, 0, fill, 1.6);
  ctx.restore();
}

function drawPuffy(ctx: Ctx, ox: number, oy: number, ch: CharacterDef, pose: Pose) {
  const { main, shade, light } = ch.colors;
  const cx = ox + 27;
  const ground = oy + CHAR_H - 2;

  if (pose === 'hurt') {
    drawPuffyPuffed(ctx, cx, ground, ch);
    return;
  }

  // pose parameters
  let legL = 0; // horizontal foot offsets
  let legR = 0;
  let liftL = 0;
  let liftR = 0;
  let bob = 0;
  let armBack = -0.7; // arm rotations (radians), negative = raised
  let armFront = 0.5;
  let squashX = 1;
  let squashY = 1;
  if (pose === 'idle1') {
    squashX = 1.03;
    squashY = 0.97;
    armBack = -0.55;
    armFront = 0.62;
  }
  if (pose.startsWith('walk')) {
    const f = +pose.slice(4);
    const cyc = [
      [7, -6, 0, 3],
      [3, -2, 0, 0],
      [-6, 7, 3, 0],
      [-2, 3, 0, 0],
    ][f];
    [legL, legR, liftL, liftR] = cyc;
    bob = f % 2 ? -1.5 : 0;
    armBack = f < 2 ? -1.1 : -0.3;
    armFront = f < 2 ? 0.1 : 0.8;
  }
  if (pose === 'jump') {
    legL = -3;
    legR = 5;
    liftL = 6;
    liftR = 3;
    armBack = -1.5;
    armFront = -0.7;
    squashX = 0.95;
    squashY = 1.05;
  }
  if (pose === 'fall') {
    legL = -4;
    legR = 6;
    liftL = 3;
    liftR = 6;
    armBack = -1.9;
    armFront = -1.2;
  }

  const rx = 13 * squashX;
  const ry = 16.5 * squashY;
  const hipY = ground - 15 + bob;
  const cy = hipY - ry + 3;
  const tilt = 0.12; // leaning forward, like he's on the move

  // back arm (behind the body)
  puffyArm(ctx, cx - 9, cy + 3, Math.PI + 0.2 - armBack, shade);

  // legs: thin orange sticks with round feet
  const leg = (hx: number, dx: number, lift: number, col: string) => {
    const fx = cx + hx + dx;
    const fy = ground - 4 - lift;
    ctx.lineCap = 'round';
    ctx.strokeStyle = PENCIL;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(cx + hx, hipY - 2);
    ctx.lineTo(fx, fy);
    ctx.stroke();
    ctx.strokeStyle = col;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(cx + hx, hipY - 2);
    ctx.lineTo(fx, fy);
    ctx.stroke();
    pencilEllipse(ctx, fx + 1.5, fy, 5.5, 4.4, 0, col, 1.6);
  };
  leg(-5, legL, liftL, shade);

  // body: crayon-shaded egg
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, tilt, 0, Math.PI * 2);
  ctx.fillStyle = main;
  ctx.fill();
  ctx.clip();
  crayon(ctx, cx - rx, cy - ry, rx * 2, ry * 2, 7, [shade + '77', light + '77', main]);
  ellipse(ctx, cx - 5, cy - 9, 4, 2.5, '#ffffff55');
  ctx.restore();
  ctx.strokeStyle = PENCIL;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, tilt, 0, Math.PI * 2);
  ctx.stroke();

  // the big eye, seen from the side
  pencilEllipse(ctx, cx + 4, cy - 6, 5.2, 6.8, tilt, '#ffffff', 1.7);
  ellipse(ctx, cx + 7, cy - 5.5, 1.4, 4.6, PENCIL);

  leg(5, legR, liftR, main);

  // bazooka tucked under the front arm, low on the body so the egg + eye stay readable
  const by = cy + 9;
  const bx0 = cx - 11;
  const bx1 = cx + 24;
  roundRect(ctx, bx0 - 1, by - 4, bx1 - bx0 + 2, 8, 3, OUTLINE);
  roundRect(ctx, bx0, by - 3, bx1 - bx0, 6, 2, '#4d6b55');
  ctx.fillStyle = '#6f9479';
  ctx.fillRect(bx0 + 2, by - 2.5, bx1 - bx0 - 4, 1.5);
  roundRect(ctx, bx1 - 4, by - 5, 6, 10, 2, OUTLINE);
  roundRect(ctx, bx1 - 3, by - 4, 4, 8, 1.5, '#39463d');
  roundRect(ctx, bx0 - 3, by - 5, 4, 10, 2, OUTLINE);

  // front arm, flapping over the bazooka
  puffyArm(ctx, cx + 3, cy + 6, armFront, main);
}

/** Puffed-up Puffy: round, wide-eyed, with green spikes popping out (from the second sketch). */
function drawPuffyPuffed(ctx: Ctx, cx: number, ground: number, ch: CharacterDef) {
  const { main, shade, light, accent } = ch.colors;
  const r = 16;
  const cy = ground - r - 4;
  // spikes (green teardrops pointing outwards)
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI / 2 + (i - 4) * 0.42 + (i % 2 ? 0.08 : -0.05);
    const d = r + 6;
    ctx.save();
    ctx.translate(cx + Math.cos(a) * d, cy + Math.sin(a) * d);
    ctx.rotate(a + Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.quadraticCurveTo(4.5, 2, 0, 4);
    ctx.quadraticCurveTo(-4.5, 2, 0, -6);
    ctx.fillStyle = accent;
    ctx.fill();
    ctx.strokeStyle = PENCIL;
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.restore();
  }
  // stubby feet + arms
  pencilEllipse(ctx, cx - 7, ground - 3, 4.5, 3, 0, shade, 1.5);
  pencilEllipse(ctx, cx + 8, ground - 3, 4.5, 3, 0, shade, 1.5);
  puffyArm(ctx, cx - 14, cy, Math.PI + 0.6, shade);
  // round body
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = main;
  ctx.fill();
  ctx.clip();
  crayon(ctx, cx - r, cy - r, r * 2, r * 2, 11, [shade + '77', light + '77', main]);
  // a few spikes poking through the belly
  for (const [dx, dy] of [[-2, 7], [5, 9], [1, 12]]) ellipse(ctx, cx + dx, cy + dy, 1.8, 3, accent);
  ctx.restore();
  ctx.strokeStyle = PENCIL;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  // wide startled eyes + mouth
  for (const ex of [cx - 3, cx + 7]) {
    pencilEllipse(ctx, ex, cy - 5, 3.8, 4.4, 0, '#ffffff', 1.5);
    ellipse(ctx, ex + 0.5, cy - 4.5, 1.2, 1.6, PENCIL);
  }
  ctx.strokeStyle = PENCIL;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(cx - 2, cy + 4);
  ctx.lineTo(cx + 6, cy + 4);
  ctx.stroke();
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
