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
import { eyeMark, withFace, type Face } from './face';
import { drawHat } from './hats';
import { BOARD_LIFT, drawFrogskins, drawSkateboard, type Lens } from './gear';
import { gearOf, wardrobe } from '../core/wardrobe';

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

export type Pose = 'idle0' | 'idle1' | `walk${0 | 1 | 2 | 3 | 4 | 5 | 6 | 7}` | 'jump' | 'fall' | 'hurt' | 'shoot' | 'eat0' | 'eat1' | `swim${0 | 1 | 2 | 3}`;
/** Walk cycle length (frames). */
export const WALK_FRAMES = 8;
export const POSES: Pose[] = ['idle0', 'idle1', 'walk0', 'walk1', 'walk2', 'walk3', 'walk4', 'walk5', 'walk6', 'walk7', 'jump', 'fall', 'hurt', 'shoot', 'eat0', 'eat1'];
/**
 * Swimming (the underwater level, in the dive gear): the hero leans forward into the water, legs
 * flutter-kicking, bobbing a little, bubbles rising from the regulator. In the dive gear it's what
 * the walk frames draw (no extra frames in any sheet); swim0–3 name the frames on their own.
 */
export const SWIM_POSES: Pose[] = ['swim0', 'swim1', 'swim2', 'swim3'];

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
/**
 * Room over a hero's frame for a hat from the Shop (frame units): their sheets are this much taller
 * when one's worn (only then), the hero at the bottom as always, so everything's still lined up by the feet.
 */
export const HAT_UP = 16;
export const CHAR_H = 56;
/** How far up a hero's body is drawn in what they've got on (frame units): on the skateboard, the deck's height. */
export const bodyLift = (wear: string | null | undefined) => (gearOf(wear).ride ? BOARD_LIFT : 0);
/** Room over a hero's frame for what they've got on ('' nothing): a hat, and the skateboard's lift. */
export function gearUp(wear: string | null | undefined) {
  const g = gearOf(wear);
  return (g.head ? HAT_UP : 0) + (g.ride ? BOARD_LIFT + 1 : 0);
}

/**
 * Carrying something over the head in both hands (the folding chair in the ring): no bazooka, both
 * arms reach out along angle `a` (0 = forward, −π/2 = straight up, from the hero facing right). Set
 * only while the carry sheets are drawn.
 */
export const carry = { on: false, a: -1.75 };
/** The carry sheet's extra frames: winding up, the swing, the follow-through; and bending to pick it up. */
export const CARRY_SWING = { sw0: -2.3, sw1: -1.25, sw2: -0.4, sw3: 0.2, lift: 0.95 } as const;
export type CarryFrame = keyof typeof CARRY_SWING;
/** Each hero's shoulders (front, back; units, hero drawn at ox = oy = 0) and arm length when carrying. */
const CARRY_ARM: Record<string, { f: [number, number]; b: [number, number]; len: number }> = {
  puffy: { f: [22, 24], b: [18, 26], len: 16 },
  scruffy: { f: [22, 32], b: [18, 33], len: 12 },
  muscles: { f: [24, 21], b: [19, 23], len: 15.5 },
};
/** Where the hands are (hero units) when carrying at angle a. */
export function carryHand(id: string, a: number): [number, number] {
  const c = CARRY_ARM[id] ?? CARRY_ARM.puffy;
  return [c.f[0] + Math.cos(a) * c.len, c.f[1] + Math.sin(a) * c.len];
}
/** Both arms, as (shoulder, length, angle), meeting at the hands. */
export function carryArms(id: string, ox: number, oy: number) {
  const c = CARRY_ARM[id] ?? CARRY_ARM.puffy;
  const [hx, hy] = carryHand(id, carry.a);
  const arm = (s: [number, number]) => ({ x: ox + s[0], y: oy + s[1], len: Math.hypot(hx - s[0], hy - s[1]), rot: Math.atan2(hy - s[1], hx - s[0]) });
  return { front: arm(c.f), back: arm(c.b), hand: [ox + hx, oy + hy] as [number, number] };
}

/** Which part of a hero to draw: everything, all but the sunglasses, or only them. */
export type Layer = 'all' | 'body' | 'eyes';

/**
 * Draws a hero facing right, feet touching y = oy + CHAR_H - 2 (or the skateboard's wheels, if
 * they're on one), in what they've got on (`wear`: Shop item ids, see wardrobe.ts). `layer`: 'body'
 * leaves off the sunglasses and 'eyes' draws only them — a battle player's colour change has to go
 * between the two, or it'd turn the orange lenses too.
 */
export function drawCharacter(ctx: Ctx, ox: number, oy: number, ch: CharacterDef, pose: Pose, f?: Face, wear: string = wardrobe.wearKey, layer: Layer = 'all') {
  if (f) return withFace(f, () => drawCharacter(ctx, ox, oy, ch, pose, undefined, wear, layer));
  if (pose.startsWith('swim')) return drawSwim(ctx, ox, oy, ch, +pose[4], wear, layer);
  // underwater (in the dive gear) they swim instead of walking: the walk frames are the swim cycle
  // (two walk frames to each swim frame), so the level's moving code needn't change
  if (!inSwim && pose.startsWith('walk') && wear && wear.split(',').includes('scuba')) return drawSwim(ctx, ox, oy, ch, Math.floor(+pose[4] / 2), wear, layer);
  const g = wear ? gearOf(wear) : {};
  // 'scuba' in what's on: the underwater level's dive gear (not a Shop thing: the level adds it)
  const scuba = !!wear && wear.split(',').includes('scuba');
  const eating = pose === 'eat0' || pose === 'eat1';
  let base: Pose = pose === 'eat0' ? 'idle0' : pose === 'eat1' ? 'idle1' : pose;
  // on the skateboard: standing on it rolling along (no walking), up on it by the deck's height
  if (g.ride && base.startsWith('walk')) base = +base[4] < 4 ? 'idle0' : 'idle1';
  const lift = g.ride ? BOARD_LIFT : 0;
  const by = oy - lift;
  if (layer !== 'eyes') {
    if (g.ride) drawBoard(ctx, ox, oy, ch, base);
    // (underwater: the air tank on its back, behind the body)
    if (scuba) drawTank(ctx, ox, by, ch, base);
    const st = STYLES[ART_STYLE];
    switch (ch.id) {
      case 'scruffy':
        drawScruffyStyled(ctx, ox, by, base, st);
        break;
      case 'muscles':
        drawMusclesStyled(ctx, ox, by, base, st);
        break;
      default:
        drawPuffyStyled(ctx, ox, by, base, st);
    }
    if (eating) drawEating(ctx, ox, by, ch.id, pose === 'eat1', st);
    if (scuba) drawRegulator(ctx, ox, by, ch, base);
  }
  // (underwater the dive mask goes on, instead of any sunglasses)
  if (scuba) {
    if (layer !== 'body') drawMask(ctx, ox, by, ch, base);
  } else if (g.eyes && layer !== 'body') drawGlasses(ctx, ox, by, ch, base);
  // a hat from the Shop, on top of the head
  if (g.head && layer !== 'eyes') {
    const a = headTop(ch, base);
    const k = HAT_FIT[ch.id] ?? HAT_FIT.puffy;
    drawHat(ctx, g.head, ox + a.x + k.dx, by + a.y + k.dy, a.tilt - 0.2, k.s);
  }
}

/**
 * A swim frame (k of 4): the hero leaned forward about their middle (a walk frame, so the legs kick
 * — and with them leaned back behind, the stride's a flutter kick), a gentle bob, and a few bubbles
 * rising from the regulator. The dive gear's drawn with the body, so it leans with it.
 */
/** (set while a swim frame draws its body from a walk frame) */
let inSwim = false;
function drawSwim(ctx: Ctx, ox: number, oy: number, ch: CharacterDef, k: number, wear: string, layer: Layer) {
  const under: Pose = (['walk0', 'walk2', 'walk4', 'walk6'] as const)[k % 4];
  const bob = Math.sin((k / 4) * Math.PI * 2) * 1.2;
  const lean = 0.56 + Math.sin((k / 4) * Math.PI * 2 + 1) * 0.04;
  const px = ox + 28;
  const py = oy + 36;
  ctx.save();
  ctx.translate(px, py + bob);
  ctx.rotate(lean);
  ctx.translate(-px, -py);
  // (the body itself: the walk frame as it is, not swum again)
  inSwim = true;
  try {
    drawCharacter(ctx, ox, oy, ch, under, undefined, wear, layer);
  } finally {
    inSwim = false;
  }
  ctx.restore();
  if (layer === 'eyes' || !wear.split(',').includes('scuba')) return;
  // bubbles from the regulator, drifting up and back (a different few each frame)
  const m = SCUBA[ch.id] ?? SCUBA.puffy;
  const c = Math.cos(lean);
  const s = Math.sin(lean);
  // (from just in front of the mouthpiece, so they rise clear of the mask)
  const mx = px + (m.mouth[0] - 28) * c - (m.mouth[1] - 36) * s + 7;
  const my = py + bob + (m.mouth[0] - 28) * s + (m.mouth[1] - 36) * c - 2;
  ctx.save();
  for (let i = 0; i < 3; i++) {
    const t = ((k + i * 1.33) % 4) / 4;
    const r = 1 + i * 0.45;
    const bx = mx + t * 3 + Math.sin(t * 9 + i) * 1.2;
    const by = my - t * 22 - i * 2;
    ctx.globalAlpha = 1 - t * 0.6;
    ctx.fillStyle = 'rgba(215,245,255,0.35)';
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 0.55;
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

/** Each hero's hat: its size, and a nudge from the top of the head the drawing finds. */
const HAT_FIT: Record<string, { s: number; dx: number; dy: number }> = {
  puffy: { s: 1, dx: 0, dy: 3 },
  scruffy: { s: 0.88, dx: 0.5, dy: 3.5 },
  muscles: { s: 1, dx: 0, dy: 6 },
};

/**
 * Each hero's sunglasses, standing (idle0, frame units): the lenses over the eyes, the near one
 * first, and where the arm goes back to. In other poses they move and turn with the head.
 */
const GLASSES: Record<string, { lenses: Lens[]; ear: { x: number; y: number }; s: number }> = {
  puffy: { lenses: [{ x: 32.5, y: 19.6, w: 12.4, h: 11.6 }, { x: 41.8, y: 19, w: 3.8, h: 10 }], ear: { x: 17, y: 18 }, s: 1 },
  scruffy: { lenses: [{ x: 26.5, y: 30.6, w: 6.6, h: 6 }, { x: 33.3, y: 29.6, w: 6.6, h: 6 }], ear: { x: 16, y: 30 }, s: 0.8 },
  muscles: { lenses: [{ x: 28.5, y: 18.8, w: 7.6, h: 7 }, { x: 35.9, y: 18.6, w: 7.6, h: 7 }], ear: { x: 17, y: 18 }, s: 0.9 },
};

function drawGlasses(ctx: Ctx, ox: number, oy: number, ch: CharacterDef, pose: Pose) {
  const G = GLASSES[ch.id] ?? GLASSES.puffy;
  const e0 = eyesOf(ch, 'idle0');
  const e = eyesOf(ch, pose);
  ctx.save();
  // (the eyes have moved and turned from where they are standing: the glasses go with them)
  ctx.translate(ox + e.x, oy + e.y);
  ctx.rotate(e.rot - e0.rot);
  ctx.translate(-e0.x, -e0.y);
  drawFrogskins(ctx, G.lenses, G.ear, G.s);
  ctx.restore();
}

/**
 * The underwater dive gear (wear 'scuba'): a yellow air tank on the back, a hose over the shoulder
 * to a mouthpiece, and a dive mask over the eyes (in place of sunglasses). Each hero's spots, standing
 * (idle0); in other poses they move with the head.
 */
const SCUBA: Record<string, { tank: [number, number, number, number]; mouth: [number, number]; s: number }> = {
  // tank: middle x, top y, bottom y, width
  puffy: { tank: [11.5, 21, 41, 9], mouth: [37, 29], s: 1 },
  scruffy: { tank: [10, 28, 44, 8], mouth: [33, 38.5], s: 0.85 },
  muscles: { tank: [10, 16, 39, 10], mouth: [33, 28.5], s: 1.05 },
};
const TANK = { base: '#ffcc33', shade: '#d99a12', light: '#fff0a8' };
/** How far the head's moved (and turned) from where it is standing, in this pose. */
function headShift(ch: CharacterDef, pose: Pose) {
  const e0 = eyesOf(ch, 'idle0');
  const e = eyesOf(ch, pose);
  return { dx: e.x - e0.x, dy: e.y - e0.y, rot: e.rot - e0.rot, e0, e };
}
function drawTank(ctx: Ctx, ox: number, oy: number, ch: CharacterDef, pose: Pose) {
  const k = SCUBA[ch.id] ?? SCUBA.puffy;
  const st = STYLES[ART_STYLE];
  const h = headShift(ch, pose);
  const [x, y0, y1, w] = k.tank;
  const tx = ox + x + h.dx * 0.6;
  const ty = oy + h.dy * 0.6;
  ctx.save();
  ctx.translate(tx, ty + (y0 + y1) / 2);
  ctx.rotate(h.rot * 0.6 - 0.12);
  const half = (y1 - y0) / 2;
  // the valve on top, then the tank: a rounded yellow cylinder with a dark band
  st.shape(ctx, [[-1.6, -half - 4], [1.6, -half - 4], [1.6, -half + 1], [-1.6, -half + 1]], { base: '#8d949c', shade: '#626a73', light: '#c9ced4' }, 8801, { lw: 0.7 });
  const r = w / 2;
  const pts: [number, number][] = [];
  for (let i = 0; i <= 10; i++) pts.push([-r * Math.cos((i / 10) * Math.PI), -half + r - r * Math.sin((i / 10) * Math.PI)]);
  for (let i = 0; i <= 10; i++) pts.push([r * Math.cos((i / 10) * Math.PI), half - r + r * Math.sin((i / 10) * Math.PI)]);
  st.shape(ctx, pts, TANK, 8802, { lw: 0.9, light: [-r * 0.5, -half + 3] });
  ctx.fillStyle = '#3a3f46';
  ctx.fillRect(-r + 0.6, -half + r + 3, w - 1.2, 1.8);
  ctx.restore();
}
function drawRegulator(ctx: Ctx, ox: number, oy: number, ch: CharacterDef, pose: Pose) {
  const k = SCUBA[ch.id] ?? SCUBA.puffy;
  const h = headShift(ch, pose);
  const [x, y0] = k.tank;
  const vx = ox + x + h.dx * 0.6 + 1;
  const vy = oy + y0 - 3 + h.dy * 0.6;
  const mx = ox + k.mouth[0] + h.dx;
  const my = oy + k.mouth[1] + h.dy;
  // the hose: from the tank's valve, over the top of the shoulder, to the mouthpiece
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#1f2328';
  ctx.lineWidth = 3 * k.s;
  ctx.beginPath();
  ctx.moveTo(vx, vy);
  ctx.bezierCurveTo(vx + 2, vy - 9 * k.s, mx - 14 * k.s, my - 2, mx - 2, my + 1);
  ctx.stroke();
  ctx.strokeStyle = '#5b636d';
  ctx.lineWidth = 1.1 * k.s;
  ctx.stroke();
  // the mouthpiece: a dark rounded block with a round purge button
  const st = STYLES[ART_STYLE];
  st.shape(ctx, [[mx - 3 * k.s, my - 2.6 * k.s], [mx + 3.4 * k.s, my - 2.8 * k.s], [mx + 3.8 * k.s, my + 2.8 * k.s], [mx - 3 * k.s, my + 2.6 * k.s]], { base: '#2b3036', shade: '#16191d', light: '#57606a' }, 8803, { lw: 0.8 });
  st.shape(ctx, ellipsePts(mx + 3.6 * k.s, my, 2.2 * k.s, 2.4 * k.s, 0, 14), { base: '#ffcc33', shade: '#d99a12', light: '#fff0a8' }, 8804, { lw: 0.7 });
}
/** A hero's own mask oval (middle x, y, radii; standing, frame units) where the one from the eyes' spots doesn't fit. */
const MASK_FIT: Record<string, [number, number, number, number]> = {
  puffy: [35, 19.2, 9.6, 8.6],
  // (a size up on Big Muscles: his eyes sit well inside it)
  muscles: [32.2, 18.7, 9.6, 6.4],
};
/**
 * The dive mask, old-school: a small oval glass faceplate snug over the eyes in a polished metal rim
 * (with a couple of rivets), a black rubber strap round the back of the head.
 */
function drawMask(ctx: Ctx, ox: number, oy: number, ch: CharacterDef, pose: Pose) {
  const G = GLASSES[ch.id] ?? GLASSES.puffy;
  const h = headShift(ch, pose);
  const x0 = Math.min(...G.lenses.map((l) => l.x - l.w / 2));
  const x1 = Math.max(...G.lenses.map((l) => l.x + l.w / 2));
  const y0 = Math.min(...G.lenses.map((l) => l.y - l.h / 2));
  const y1 = Math.max(...G.lenses.map((l) => l.y + l.h / 2));
  // (Puffy: the same oval as the others, but sized to his face — tall enough for his one big eye,
  // and long enough to reach across to his far-side eye)
  const fit = MASK_FIT[ch.id];
  const cx = fit ? fit[0] : (x0 + x1) / 2;
  const cy = fit ? fit[1] : (y0 + y1) / 2;
  const rx = fit ? fit[2] : (x1 - x0) / 2 + 0.3;
  const ry = fit ? fit[3] : (y1 - y0) / 2 + 0.2;
  ctx.save();
  ctx.translate(ox + h.e.x, oy + h.e.y);
  ctx.rotate(h.rot);
  ctx.translate(-h.e0.x, -h.e0.y);
  // the strap, back round the head to the ear
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#1f2328';
  ctx.lineWidth = 2.2 * G.s;
  ctx.beginPath();
  ctx.moveTo(cx - rx + 0.5, cy - 0.5);
  ctx.quadraticCurveTo((cx - rx + G.ear.x) / 2, cy - ry - 1.5, G.ear.x, G.ear.y);
  ctx.stroke();
  // the glass: pale sea-blue and see-through (the eyes show)
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(175,230,252,0.26)';
  ctx.fill();
  // the metal rim: ink outline, a steel band, a bright edge
  ctx.strokeStyle = '#1c1a1f';
  ctx.lineWidth = 3.2;
  ctx.stroke();
  ctx.strokeStyle = '#9aa4ae';
  ctx.lineWidth = 1.7;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, Math.PI * 1.05, Math.PI * 1.55);
  ctx.stroke();
  // rivets on the rim
  ctx.fillStyle = '#e8edf2';
  for (const a of [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75]) {
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
  // a glare across the glass
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath();
  ctx.moveTo(cx - rx, cy + ry * 0.1);
  ctx.lineTo(cx - rx * 0.25, cy - ry - 1);
  ctx.lineTo(cx + rx * 0.05, cy - ry - 1);
  ctx.lineTo(cx - rx * 0.75, cy + ry * 0.45);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
}

/** Where a hero's eyes are in a pose (frame units; see markEyes), found once by drawing it. */
const eyesAt = new Map<string, { x: number; y: number; rot: number }>();
function eyesOf(ch: CharacterDef, pose: Pose) {
  const key = `${ch.id}/${pose}`;
  let e = eyesAt.get(key);
  if (!e) {
    // (drawn somewhere tiny: only where the eyes go is wanted)
    const { ctx } = canvas(2, 2);
    drawCharacter(ctx, 0, 0, ch, pose, undefined, '', 'body');
    e = { ...eyeMark };
    eyesAt.set(key, e);
  }
  return e;
}

/** Each hero's skateboard length (units). */
const BOARD_LEN: Record<string, number> = { puffy: 30, scruffy: 26, muscles: 34 };

/**
 * The skateboard under a hero's feet: flat on the ground standing and rolling; in a jump the ollie
 * (popped up under the feet, nose high); falling, level under them coming down.
 */
function drawBoard(ctx: Ctx, ox: number, oy: number, ch: CharacterDef, pose: Pose) {
  const len = BOARD_LEN[ch.id] ?? 30;
  const ft = feetOf(ch, pose);
  ctx.save();
  if (pose === 'jump') {
    // (the deck along the bottoms of both feet, the back one on the tail: nose up)
    const a = Math.max(-0.55, Math.min(-0.22, Math.atan2(ft.yr - ft.yl, ft.xr - ft.xl)));
    const mx = (ft.xl + ft.xr) / 2;
    const my = Math.max(ft.yl + (mx - ft.xl) * Math.tan(a), ft.yr - (ft.xr - mx) * Math.tan(a));
    ctx.translate(ox + mx, oy + my - BOARD_LIFT + 0.3);
    ctx.rotate(a);
  } else if (pose === 'fall' || pose === 'hurt') {
    ctx.translate(ox + ft.x, oy + ft.y - BOARD_LIFT + 0.4);
    ctx.rotate(pose === 'hurt' ? 0.16 : 0.06);
  } else ctx.translate(ox + ft.x, oy + CHAR_H - 2 - BOARD_LIFT);
  drawSkateboard(ctx, len);
  ctx.restore();
}

/** A hero drawn bare in a pose, at 4× (for measuring), kept while the measuring's done. */
function measure(ch: CharacterDef, pose: Pose) {
  const R = 4;
  const { c, ctx } = canvas(CHAR_W * R, CHAR_H * R);
  ctx.scale(R, R);
  drawCharacter(ctx, 0, 0, ch, pose, undefined, '');
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  const W = c.width;
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < c.height && d[(y * W + x) * 4 + 3] > 60;
  return { R, W, H: c.height, solid };
}

/** Where a hero's feet are in a pose (frame units): the middle of the lowest bit of them, and its bottom. */
type Feet = { x: number; y: number; xl: number; yl: number; xr: number; yr: number };
const feet = new Map<string, Feet>();
function feetOf(ch: CharacterDef, pose: Pose) {
  const key = `${ch.id}/${pose}`;
  const hit = feet.get(key);
  if (hit) return hit;
  const { R, H, solid } = measure(ch, pose);
  const xa = 10 * R;
  const xb = 46 * R;
  let bottom = -1;
  for (let y = H - 1; y >= 0 && bottom < 0; y--)
    for (let x = xa; x < xb; x++)
      if (solid(x, y)) {
        bottom = y;
        break;
      }
  let out: Feet = { x: 28, y: CHAR_H - 2, xl: 22, yl: CHAR_H - 2, xr: 34, yr: CHAR_H - 2 };
  if (bottom >= 0) {
    // (both feet: everything solid in the bottom 3 units)
    let x0 = xb;
    let x1 = xa;
    for (let y = bottom - 3 * R; y <= bottom; y++)
      for (let x = xa; x < xb; x++)
        if (solid(x, y)) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
        }
    // (and each foot's own bottom, back and front: the lowest point in each quarter of the bottom 9 units' width)
    let f0 = xb;
    let f1 = xa;
    for (let y = bottom - 9 * R; y <= bottom; y++)
      for (let x = xa; x < xb; x++)
        if (solid(x, y)) {
          if (x < f0) f0 = x;
          if (x > f1) f1 = x;
        }
    const lowIn = (a: number, b: number) => {
      for (let y = bottom; y > bottom - 12 * R; y--) for (let x = Math.round(a); x < b; x++) if (solid(x, y)) return (y + 1) / R;
      return (bottom + 1) / R;
    };
    const q = (f1 - f0) / 4;
    out = { x: (x0 + x1) / 2 / R, y: (bottom + 1) / R, xl: (f0 + q) / R, yl: lowIn(f0, f0 + q * 2), xr: (f1 - q) / R, yr: lowIn(f1 - q * 2, f1) };
  }
  feet.set(key, out);
  return out;
}

/**
 * The top of a hero's head in a pose (frame units) and how the head's tilted there: found once by
 * drawing the pose (hatless) and looking at it — the middle of the head a few units down from its
 * top, then straight up from there to the outline. So a hat sits right in every pose, walking,
 * jumping or hurt, without anyone working out where.
 */
const heads = new Map<string, { x: number; y: number; tilt: number }>();
function headTop(ch: CharacterDef, pose: Pose) {
  const key = `${ch.id}/${pose}`;
  const hit = heads.get(key);
  if (hit) return hit;
  const { R, W, H, solid } = measure(ch, pose);
  const c = { width: W, height: H };
  // (look between these columns: the head, not a fist or the bazooka off to the side)
  const xa = Math.round(12 * R);
  const xb = Math.round(48 * R);
  let top = -1;
  for (let y = 0; y < c.height && top < 0; y++)
    for (let x = xa; x < xb; x++)
      if (solid(x, y)) {
        top = y;
        break;
      }
  if (top < 0) return { x: 28, y: 8, tilt: 0 };
  // the widest run across the head, 7 units down: its middle
  const row = top + 7 * R;
  let best = [xa, xa];
  for (let x = xa; x < xb; ) {
    if (!solid(x, row)) {
      x++;
      continue;
    }
    const x0 = x;
    while (x < xb && solid(x, row)) x++;
    if (x - x0 > best[1] - best[0]) best = [x0, x];
  }
  const mid = Math.round((best[0] + best[1]) / 2);
  const topAt = (x: number) => {
    for (let y = 0; y < c.height; y++) if (solid(x, y)) return y;
    return c.height;
  };
  const yMid = topAt(mid);
  const yl = topAt(mid - 5 * R);
  const yr = topAt(mid + 5 * R);
  const out = { x: mid / R, y: yMid / R, tilt: Math.atan2(yr - yl, 10 * R) };
  heads.set(key, out);
  return out;
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
  drawCharacter(ctx, M, 0, ch, 'idle0', undefined, '');
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

/** How high a hero's standing drawing reaches in what they've got on (frame units: 0 is the top of the frame, less is higher), measured once. */
const heroTop = new Map<string, number>();
function topOf(ch: CharacterDef, wear: string) {
  const key = `${ch.id}|${wear}`;
  let t = heroTop.get(key);
  if (t !== undefined) return t;
  const R = 2;
  const up = gearUp(wear);
  const { c, ctx } = canvas(CHAR_W * R, (CHAR_H + up) * R);
  ctx.scale(R, R);
  drawCharacter(ctx, 0, up, ch, 'idle0', undefined, wear);
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  t = 0;
  find: for (let y = 0; y < c.height; y++)
    for (let x = 0; x < c.width; x++)
      if (d[(y * c.width + x) * 4 + 3] > 24) {
        t = y / R - up;
        break find;
      }
  heroTop.set(key, t);
  return t;
}

/**
 * Big lobby picture: feet on the bottom edge, heroes drawn at their real
 * relative sizes, centred on the whole drawing (bazooka included) and made
 * smaller if they'd otherwise poke out of the side of the card.
 */
export function drawHeroCard(target: HTMLCanvasElement, ch: CharacterDef, pose: Pose = 'idle0', f?: Face, wear: string = wardrobe.wearKey, layer: Layer = 'all') {
  const ctx = target.getContext('2d')!;
  // (the sunglasses alone go over what's there: see drawCharacter)
  if (layer !== 'eyes') ctx.clearRect(0, 0, target.width, target.height);
  const [l, r] = spanOf(ch);
  const mid = (l + r) / 2;
  const half = (r - l) / 2;
  // (and smaller still if what they've got on — a hat, the skateboard — would poke out of the top)
  const s = Math.min((target.height / (56 * 1.32)) * ch.scale, (target.width * 0.48) / half, (target.height * 0.96) / (54 - topOf(ch, wear)));
  ctx.save();
  ctx.translate(target.width / 2 - mid * s, target.height * 0.985);
  ctx.scale(s, s);
  drawCharacter(ctx, -27, -54, ch, pose, f, wear, layer);
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

/**
 * Finished portraits (hero + pose + face, at a size), kept: the HUD's and the cards' heroes flip
 * between the same few every second or so, and drawing the whole hero each time made a little
 * stutter on phones. (A handful at most, so they're cheap to keep.)
 */
const portraitCache = new Map<string, HTMLCanvasElement>();

export function drawPortrait(target: HTMLCanvasElement, ch: CharacterDef, pose: Pose = 'idle0', f?: Face, boxPose: Pose = pose, wear: string = wardrobe.wearKey, layer: Layer = 'all') {
  const key = `${ch.id}|${ch.colors.main}|${pose}|${boxPose}|${f ? `${f.lookX},${f.lookY},${f.blink ? 1 : 0},${f.mouth}` : '-'}|${target.width}x${target.height}|${wear}|${layer}`;
  let done = portraitCache.get(key);
  if (!done) {
    done = canvas(target.width, target.height).c;
    paintPortrait(done, ch, pose, f, boxPose, wear, layer);
    if (portraitCache.size >= 48) portraitCache.delete(portraitCache.keys().next().value!);
    portraitCache.set(key, done);
  }
  const ctx = target.getContext('2d')!;
  ctx.clearRect(0, 0, target.width, target.height);
  ctx.drawImage(done, 0, 0);
}

function paintPortrait(target: HTMLCanvasElement, ch: CharacterDef, pose: Pose, f: Face | undefined, boxPose: Pose, wear: string, layer: Layer) {
  const R = 4;
  // (room over the head for a hat or the skateboard, if there's one)
  const up = gearUp(wear);
  const { c: tmp, ctx: t } = canvas((CHAR_W + EDGE * 2) * R, (CHAR_H + EDGE + up) * R);
  t.scale(R, R);
  drawCharacter(t, EDGE, EDGE + up, ch, pose, f, wear, layer);
  // find the drawing's bounding box (with the neutral face, once per hero + pose)
  // (frames of one animation share the box of `boxPose`, so they don't jump in size)
  const key = `${ch.id}:${boxPose}:${wear}`;
  let box = portraitBox.get(key);
  if (!box) {
    const { c: m, ctx: mc } = canvas((CHAR_W + EDGE * 2) * R, (CHAR_H + EDGE + up) * R);
    mc.scale(R, R);
    drawCharacter(mc, EDGE, EDGE + up, ch, boxPose, undefined, wear);
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
export function renderPoseSet(ch: CharacterDef, poses: Pose[], size: number, wear: string = wardrobe.wearKey): Record<string, HTMLCanvasElement> {
  const R = 4;
  const up = gearUp(wear);
  const drawn = poses.map((pose) => {
    const { c, ctx } = canvas((CHAR_W + EDGE * 2) * R, (CHAR_H + EDGE + up) * R);
    ctx.scale(R, R);
    drawCharacter(ctx, EDGE, EDGE + up, ch, pose, undefined, wear);
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
