/**
 * The Shop's other things for a hero (the hat's in hats.ts): the sunglasses and the skateboard.
 * Pure drawing; draw.ts puts them in place on each hero in each pose.
 */
import type { Ctx } from './draw';
import { STYLES, ellipsePts, type Fill, type Pt } from './handdrawn';

// (STYLES read when drawing, not at load: see hats.ts)
const st = () => STYLES.polished;
const F = (base: string, shade: string, light: string): Fill => ({ base, shade, light });
const INK = '#1c1a1f';

/** A lens: middle (x, y), w × h; the near one's drawn full, a far one can be a narrow sliver. */
export interface Lens {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The lens shape, Frogskins style: a flat brow along the top, rounded off below (a soft, chunky D). */
function lensPath(ctx: Ctx, l: Lens) {
  const { x, y, w, h } = l;
  const x0 = x - w / 2;
  const x1 = x + w / 2;
  const y0 = y - h / 2;
  const y1 = y + h / 2;
  const r = Math.min(w, h) * 0.42;
  ctx.beginPath();
  ctx.moveTo(x0 + 0.6, y0);
  ctx.lineTo(x1 - 0.6, y0);
  ctx.quadraticCurveTo(x1 + 0.2, y0 + 0.2, x1, y0 + h * 0.35);
  ctx.quadraticCurveTo(x1 - 0.2, y1, x1 - r, y1);
  ctx.lineTo(x0 + r, y1);
  ctx.quadraticCurveTo(x0 + 0.2, y1, x0, y0 + h * 0.35);
  ctx.quadraticCurveTo(x0 - 0.2, y0 + 0.2, x0 + 0.6, y0);
  ctx.closePath();
}

/**
 * Sunglasses in the style of the classic Frogskins: chunky glossy black frames, a keyhole bridge,
 * orange iridium lenses (deep red-orange at the brow, fading to amber, a glare streak across), and
 * an arm back to the ear. `lenses`: the near one first; `ear`: where the arm goes; `s` the scale of
 * the frame's thickness.
 */
export function drawFrogskins(ctx: Ctx, lenses: Lens[], ear: { x: number; y: number }, s = 1) {
  const lw = 1.5 * s;
  const near = lenses[0];
  // the arm, back over the side of the head to the ear (behind the frame)
  ctx.strokeStyle = INK;
  ctx.lineCap = 'round';
  ctx.lineWidth = 1.2 * s;
  ctx.beginPath();
  ctx.moveTo(near.x - near.w / 2, near.y - near.h * 0.3);
  ctx.quadraticCurveTo((near.x - near.w / 2 + ear.x) / 2, near.y - near.h * 0.45, ear.x, ear.y);
  ctx.stroke();
  // the bridge between the lenses: the keyhole (a little arch)
  if (lenses.length > 1) {
    const a = lenses[0];
    const b = lenses[1];
    const left = a.x < b.x ? a : b;
    const right = a.x < b.x ? b : a;
    const bx0 = left.x + left.w / 2;
    const bx1 = right.x - right.w / 2;
    const by = (left.y + right.y) / 2 - Math.min(left.h, right.h) * 0.3;
    ctx.lineWidth = 1.4 * s;
    ctx.beginPath();
    ctx.moveTo(bx0 - 0.3, by + 0.6);
    ctx.quadraticCurveTo((bx0 + bx1) / 2, by - 1.2 * s, bx1 + 0.3, by + 0.6);
    ctx.stroke();
  }
  for (const l of lenses) {
    // the lens: orange iridium
    lensPath(ctx, l);
    const g = ctx.createLinearGradient(l.x, l.y - l.h / 2, l.x + l.w * 0.2, l.y + l.h / 2);
    g.addColorStop(0, '#d8361c');
    g.addColorStop(0.45, '#ff7a1a');
    g.addColorStop(1, '#ffc25a');
    ctx.fillStyle = g;
    ctx.fill();
    // the glare: a bright streak across, and a little spark
    ctx.save();
    lensPath(ctx, l);
    ctx.clip();
    ctx.fillStyle = '#ffffffb8';
    ctx.beginPath();
    ctx.moveTo(l.x - l.w * 0.5, l.y - l.h * 0.05);
    ctx.lineTo(l.x - l.w * 0.05, l.y - l.h * 0.55);
    ctx.lineTo(l.x + l.w * 0.12, l.y - l.h * 0.55);
    ctx.lineTo(l.x - l.w * 0.4, l.y + l.h * 0.15);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff70';
    ctx.beginPath();
    ctx.moveTo(l.x + l.w * 0.05, l.y + l.h * 0.5);
    ctx.lineTo(l.x + l.w * 0.45, l.y + l.h * 0.0);
    ctx.lineTo(l.x + l.w * 0.5, l.y + l.h * 0.15);
    ctx.lineTo(l.x + l.w * 0.2, l.y + l.h * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // the chunky frame round it, a thicker brow, a glossy highlight along the top
    lensPath(ctx, l);
    ctx.strokeStyle = INK;
    ctx.lineWidth = lw;
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.lineWidth = lw * 1.5;
    ctx.beginPath();
    ctx.moveTo(l.x - l.w / 2 + 0.4, l.y - l.h / 2);
    ctx.lineTo(l.x + l.w / 2 - 0.4, l.y - l.h / 2);
    ctx.stroke();
    ctx.strokeStyle = '#ffffff66';
    ctx.lineWidth = 0.5 * s;
    ctx.beginPath();
    ctx.moveTo(l.x - l.w * 0.3, l.y - l.h / 2 - 0.5 * s);
    ctx.lineTo(l.x + l.w * 0.2, l.y - l.h / 2 - 0.5 * s);
    ctx.stroke();
  }
}

/** The skateboard's height from the ground to the top of the deck (a rider stands this much taller). */
export const BOARD_LIFT = 5;

/**
 * A skateboard, side on, `len` long: its deck's top middle at (0, 0), wheels on the ground at
 * y = BOARD_LIFT. A purple deck with a pink stripe and kicked-up nose and tail, black grip tape on
 * top, grey trucks, mint wheels.
 */
export function drawSkateboard(ctx: Ctx, len: number) {
  const ST = st();
  const h = len / 2;
  const L = BOARD_LIFT;
  // the wheels and trucks, under the deck
  for (const sx of [-1, 1]) {
    const wx = sx * h * 0.62;
    ST.shape(ctx, [[wx - 2.6, 1.4], [wx + 2.6, 1.4], [wx + 1.6, L - 2.4], [wx - 1.6, L - 2.4]], F('#9aa2ad', '#6b737e', '#d2d8df'), 7801 + sx, { lw: 0.6 });
    for (const d of [-1.2, 1.2]) ST.shape(ctx, ellipsePts(wx + d, L - 1.5, 1.5, 1.5, 0, 12), F('#bff3df', '#7fd4b6', '#ffffff'), 7810 + sx + d, { lw: 0.6, light: [wx + d - 0.5, L - 2] });
  }
  // the deck: flat in the middle, kicked up at both ends
  const k = Math.min(3, len * 0.1);
  const deck: Pt[] = [
    [-h - 0.4, -2.6],
    [-h + k, 0],
    [h - k, 0],
    [h + 0.4, -2.6],
    [h + 1.2, -2],
    [h - k + 0.4, 1.8],
    [-h + k - 0.4, 1.8],
    [-h - 1.2, -2],
  ];
  ST.shape(ctx, deck, F('#7a4cf0', '#5230b8', '#a98cff'), 7820, { lw: 0.9 });
  // the stripe along its side
  ctx.strokeStyle = '#ff6fb1';
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(-h + k, 1);
  ctx.lineTo(h - k, 1);
  ctx.stroke();
  // grip tape along the top
  ctx.strokeStyle = '#2a2730';
  ctx.lineWidth = 0.9;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-h - 0.2, -2.4);
  ctx.lineTo(-h + k, -0.3);
  ctx.lineTo(h - k, -0.3);
  ctx.lineTo(h + 0.2, -2.4);
  ctx.stroke();
}
