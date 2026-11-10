/**
 * The fish, from the drawings for the underwater level: drawn in the game's polished hand-drawn
 * style (the same inked, shaded shapes as Puffy and the Plops), facing RIGHT as in the drawings —
 * tail on the left, mouth on the right — each in a frame of its own size.
 *
 *   orange — the level's main bad guy: a little orange fish, one big eye, a forked tail; he shoots
 *            bubbles from his tail (fire0–fire2)
 *   kai    — Kai fish: a small blue-purple fish with big grey shark fins (one sweeping up over its back)
 *   fat    — Fat Fish: huge and yellow, a grumpy brow, a blue hat saying "FAT FISH!" with a plume
 *   zippy  — Zippy: a tiny grey round fish with a grin and whiskers
 *   kingbob — King Bob, the king: big, white with orange patches, a gold crown, a cross eye, a rosy cheek
 *   slinger — Slinger: a long grey-and-white fish with a gold crown and a cross eye
 *   toothy — a long yellow fish with a grey band and a big round head that's all jagged teeth
 *
 * The swim cycle (sw0–sw5): the tail sweeps up and down, the fins flap, the body bobs and tips a
 * touch; the toothy one chomps as it goes.
 */
import type { Ctx } from './draw';
import { STYLES, ellipsePts, grow, type Fill, type Pt, type Style } from './handdrawn';

export type FishKind = 'orange' | 'kai' | 'fat' | 'zippy' | 'kingbob' | 'slinger' | 'toothy';
export const FISH_KINDS: FishKind[] = ['orange', 'kai', 'fat', 'zippy', 'kingbob', 'slinger', 'toothy'];
export type SwimFrame = 'sw0' | 'sw1' | 'sw2' | 'sw3' | 'sw4' | 'sw5';
export const SWIM_FRAMES: SwimFrame[] = ['sw0', 'sw1', 'sw2', 'sw3', 'sw4', 'sw5'];
/**
 * The orange fish firing a bubble from his tail: fire0 the wind-up (he scrunches up, tail cocked
 * forward over his back), fire1 the snap (tail flung out behind, a puff of bubbles at its tip — the
 * shot itself is its own sprite, BUBBLE_FRAMES), fire2 settling back.
 */
export type FireFrame = 'fire0' | 'fire1' | 'fire2';
export const FIRE_FRAMES: FireFrame[] = ['fire0', 'fire1', 'fire2'];
export type FishFrame = SwimFrame | FireFrame;
/** Every fish's frames: the swim cycle (and for the orange fish, firing). */
export const FISH_FRAMES: Record<FishKind, FishFrame[]> = {
  orange: [...SWIM_FRAMES, ...FIRE_FRAMES],
  kai: SWIM_FRAMES,
  fat: SWIM_FRAMES,
  zippy: SWIM_FRAMES,
  kingbob: SWIM_FRAMES,
  slinger: SWIM_FRAMES,
  toothy: SWIM_FRAMES,
};
/**
 * How big each fish is in the game: its frame's units × this = game pixels (a hero's 56-unit frame
 * and the Giant Puff's are 1:1). Fat Fish is as big as a Giant Puff (~180 px), King Bob big too;
 * Slinger a bit bigger than the hero; the orange fish, Kai and Zippy small.
 */
export const FISH_SCALE: Record<FishKind, number> = {
  orange: 0.85,
  kai: 0.75,
  fat: 1.15,
  zippy: 0.8,
  kingbob: 2.3,
  slinger: 1.35,
  toothy: 1.1,
};
/** Each fish's frame (units; drawn at ART_RES in the game). */
export const FISH_SIZE: Record<FishKind, { w: number; h: number }> = {
  orange: { w: 74, h: 54 },
  kai: { w: 92, h: 84 },
  fat: { w: 210, h: 176 },
  zippy: { w: 54, h: 40 },
  kingbob: { w: 100, h: 88 },
  slinger: { w: 128, h: 80 },
  toothy: { w: 128, h: 70 },
};
/** What the drawings call them (the ones whose names we haven't got yet are placeholders). */
export const FISH_NAME: Record<FishKind, string> = {
  orange: 'Orange fish',
  kai: 'Kai fish',
  fat: 'Fat Fish',
  zippy: 'Zippy',
  kingbob: 'King Bob',
  slinger: 'Slinger',
  toothy: 'Toothy fish',
};

const F = (base: string, shade: string, light: string): Fill => ({ base, shade, light });
const EYE = F('#ffffff', '#e9e4dc', '#ffffff');
const GOLD = F('#ffd23f', '#d9a316', '#fff2a8');
const GREY_FIN = F('#8e9198', '#62656c', '#c6c8cd');

/** Rotate points about (px, py). */
const rot = (pts: Pt[], px: number, py: number, a: number): Pt[] => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return pts.map(([x, y]) => [px + (x - px) * c - (y - py) * s, py + (x - px) * s + (y - py) * c]);
};

/** Where in the swim cycle a frame is (0…2π; the fire frames hold still at the start). */
const phaseOf = (f: FishFrame) => (f.startsWith('sw') ? (+f.slice(2) / SWIM_FRAMES.length) * Math.PI * 2 : 0);

/** A forked tail, pinned at (px, py) on the body, `len` long, the two lobes `spread` apart, swung by `a`. */
function tail(st: Style, ctx: Ctx, px: number, py: number, len: number, spread: number, a: number, fill: Fill, seed: number, root = 0.32) {
  const pts: Pt[] = [
    [px + 3, py - spread * root],
    [px - len * 0.55, py - spread * 0.7],
    [px - len, py - spread * 1.05],
    [px - len * 0.58, py],
    [px - len, py + spread * 1.05],
    [px - len * 0.55, py + spread * 0.7],
    [px + 3, py + spread * root],
  ];
  st.shape(ctx, rot(pts, px, py, a), fill, seed, { lw: 1, light: [px - len * 0.6, py - spread] });
}

/** A fin: a curved blade from (x, y), `len` long at angle `a`, `w` thick, its tip curling by `curl`. */
function fin(st: Style, ctx: Ctx, x: number, y: number, len: number, w: number, a: number, curl: number, fill: Fill, seed: number) {
  const pts: Pt[] = [];
  const n = 8;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const ang = a + curl * t * t;
    const r = len * t;
    const half = w * (1 - t) * 0.5 + 0.4;
    const nx = -Math.sin(ang);
    const ny = Math.cos(ang);
    pts.push([x + Math.cos(a) * r * 0.55 + Math.cos(ang) * r * 0.45 + nx * half, y + Math.sin(a) * r * 0.55 + Math.sin(ang) * r * 0.45 + ny * half]);
  }
  for (let i = n; i >= 0; i--) {
    const t = i / n;
    const ang = a + curl * t * t;
    const r = len * t;
    const half = w * (1 - t) * 0.5 + 0.4;
    const nx = -Math.sin(ang);
    const ny = Math.cos(ang);
    pts.push([x + Math.cos(a) * r * 0.55 + Math.cos(ang) * r * 0.45 - nx * half, y + Math.sin(a) * r * 0.55 + Math.sin(ang) * r * 0.45 - ny * half]);
  }
  st.shape(ctx, pts, fill, seed, { lw: 0.9 });
}

/** The big drawn eye: a white oval, the pupil a dark crescent on its front side, a glint. */
function eye(st: Style, ctx: Ctx, x: number, y: number, rx: number, ry: number, seed: number) {
  st.shape(ctx, ellipsePts(x, y, rx, ry, 0, 26), EYE, seed, { lw: 1 });
  ctx.fillStyle = st.ink;
  ctx.beginPath();
  ctx.ellipse(x + rx * 0.42, y + ry * 0.08, rx * 0.36, ry * 0.62, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x + rx * 0.28, y - ry * 0.28, Math.max(0.9, rx * 0.16), 0, Math.PI * 2);
  ctx.fill();
}

/** A cross brow over an eye (sloping down toward the front). */
function brow(st: Style, ctx: Ctx, x: number, y: number, w: number, seed: number) {
  st.line(ctx, [[x - w * 0.55, y - w * 0.32], [x + w * 0.5, y + w * 0.12]], seed, 1.5);
}

/**
 * The drawings' mouth: a teardrop loop at the front of the face — from the lips at the edge it curls
 * back into the cheek and round, and the line runs on out past the edge (x, y: the lips).
 */
function mouth(st: Style, ctx: Ctx, x: number, y: number, r: number, seed: number) {
  st.line(
    ctx,
    [
      [x, y - r * 0.2],
      [x - r * 0.7, y - r * 0.85],
      [x - r * 1.5, y - r * 0.7],
      [x - r * 1.75, y + r * 0.1],
      [x - r * 1.25, y + r * 0.85],
      [x - r * 0.3, y + r * 0.75],
      [x + r * 0.45, y + r * 0.35],
      [x + r * 1.0, y + r * 0.55],
    ],
    seed,
    1.05,
  );
}

/** A three-point gold crown standing on (x, y), `w` wide, tipped by `a`. */
function crown(st: Style, ctx: Ctx, x: number, y: number, w: number, h: number, a: number, seed: number) {
  const pts: Pt[] = [
    [x - w / 2, y],
    [x - w / 2, y - h * 0.35],
    [x - w * 0.33, y - h],
    [x - w * 0.17, y - h * 0.42],
    [x, y - h],
    [x + w * 0.17, y - h * 0.42],
    [x + w * 0.33, y - h],
    [x + w / 2, y - h * 0.35],
    [x + w / 2, y],
  ];
  st.shape(ctx, rot(pts, x, y, a), GOLD, seed, { lw: 0.9, light: [x - w * 0.2, y - h * 0.7] });
  // a red jewel on each point
  ctx.fillStyle = '#e8364a';
  for (const [jx, jy] of rot([[x - w * 0.33, y - h * 0.55], [x, y - h * 0.58], [x + w * 0.33, y - h * 0.55]], x, y, a)) {
    ctx.beginPath();
    ctx.arc(jx, jy, Math.max(0.9, w * 0.055), 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Patches of colour on a body, e.g. King Bob's orange (clipped just inside its ink outline, which stays on top). */
function patches(ctx: Ctx, body: Pt[], draw: () => void) {
  ctx.save();
  ctx.beginPath();
  grow(body, -1.4).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.clip();
  draw();
  ctx.restore();
}

/** Draw fish `kind` in swim frame `f`, its frame's top-left at (ox, oy). */
export function drawFish(ctx: Ctx, ox: number, oy: number, kind: FishKind, f: FishFrame, st: Style = STYLES.polished) {
  if (!f.startsWith('sw') && kind !== 'orange') f = 'sw0';
  const p = phaseOf(f);
  const fire = f.startsWith('fire') ? +f.slice(4) : -1;
  const sw = Math.sin(p); // the tail's sweep
  const bob = fire >= 0 ? 0 : Math.sin(p + Math.PI / 2) * 1.2; // the body rises and falls
  const flap = Math.sin(p + 1.1); // fins
  // the body tips a touch with each stroke (firing: it rocks forward on the wind-up, back on the snap)
  const tip = fire === 0 ? -0.1 : fire === 1 ? 0.09 : fire === 2 ? 0.03 : sw * 0.035;
  const { w, h } = FISH_SIZE[kind];
  ctx.save();
  ctx.translate(ox, oy + bob);
  // (the whole fish tips about its middle)
  ctx.translate(w / 2, h / 2);
  ctx.rotate(tip);
  ctx.translate(-w / 2, -h / 2);
  switch (kind) {
    case 'orange':
      drawOrange(ctx, st, sw, flap, fire);
      break;
    case 'kai':
      drawKai(ctx, st, sw, flap);
      break;
    case 'fat':
      drawFat(ctx, st, sw, flap);
      break;
    case 'zippy':
      drawZippy(ctx, st, sw, flap);
      break;
    case 'kingbob':
      drawKingBob(ctx, st, sw, flap);
      break;
    case 'slinger':
      drawSlinger(ctx, st, sw, flap);
      break;
    case 'toothy':
      drawToothy(ctx, st, sw, flap, p);
      break;
  }
  ctx.restore();
}

// ───────────────────────────── the fish ──

function drawOrange(ctx: Ctx, st: Style, sw: number, _flap: number, fire = -1) {
  const BODY = F('#ff9a3c', '#e2661a', '#ffc98c');
  const cx = 42;
  const cy = 27;
  // firing: the wind-up cocks the tail up and forward over his back (scrunched up), the snap flings
  // it out long behind him, then it settles
  const tailA = fire === 0 ? 1.15 : fire === 1 ? -0.12 : fire === 2 ? 0.2 : sw * 0.38;
  const tailLen = fire === 0 ? 17 : fire === 1 ? 24 : 20;
  const sx = fire === 0 ? 0.92 : fire === 1 ? 1.07 : 1;
  const sy = fire === 0 ? 1.08 : fire === 1 ? 0.94 : 1;
  tail(st, ctx, cx - 15 * sx, cy, tailLen, fire === 1 ? 11 : 13, tailA, BODY, 9101);
  const body = ellipsePts(cx, cy, 19 * sx, 16 * sy, 0, 40);
  st.shape(ctx, body, BODY, 9102, { lw: 1.1, light: [cx - 4, cy - 9] });
  if (fire === 1) {
    // the shot leaving the tail: a puff of little bubbles and speed lines at its tip
    const tx = cx - 15 * sx - tailLen - 3;
    for (const [dx, dy, r] of [[-2, -5, 2.4], [-5, 3, 1.8], [1, 6, 1.3], [-8, -1, 1.4]] as const) bubble(ctx, tx + dx, cy + dy, r);
    st.line(ctx, [[tx - 4, cy - 10], [tx - 10, cy - 13]], 9108, 0.7);
    st.line(ctx, [[tx - 5, cy + 10], [tx - 11, cy + 13]], 9109, 0.7);
  }
  eye(st, ctx, cx + 1, cy - 4, 6.5, 8, 9104);
  mouth(st, ctx, cx + 17, cy + 6, 5.2, 9105);
}

function drawKai(ctx: Ctx, st: Style, sw: number, flap: number) {
  const BODY = F('#6d5fd8', '#4536a8', '#a196f2');
  const cx = 52;
  const cy = 46;
  // the big grey fin sweeping up over its back (behind the body), the tail, the fin under it
  fin(st, ctx, cx - 10, cy - 12, 44, 13, -0.75 + flap * 0.05, 0.45, GREY_FIN, 9201);
  tail(st, ctx, cx - 17, cy - 2, 24, 13, sw * 0.4, GREY_FIN, 9202);
  fin(st, ctx, cx - 6, cy + 14, 24, 9, 2.1 + flap * 0.18, 0.35, GREY_FIN, 9203);
  const body = ellipsePts(cx, cy, 22, 20, 0, 40);
  st.shape(ctx, body, BODY, 9204, { lw: 1.1, light: [cx - 6, cy - 10] });
  // a dark streak over the top of the head, as in the drawing
  patches(ctx, body, () => {
    ctx.fillStyle = '#3a2d8c';
    ctx.beginPath();
    ctx.ellipse(cx - 10, cy - 15, 9, 6, -0.5, 0, Math.PI * 2);
    ctx.fill();
  });
  eye(st, ctx, cx - 2, cy - 1, 9, 9.5, 9205);
  mouth(st, ctx, cx + 19, cy + 9, 5.6, 9206);
  // whiskers at the mouth
  st.line(ctx, [[cx + 18, cy + 12], [cx + 27, cy + 10]], 9207, 0.7);
  st.line(ctx, [[cx + 18, cy + 14], [cx + 26, cy + 16]], 9208, 0.7);
}

function drawFat(ctx: Ctx, st: Style, sw: number, _flap: number) {
  const BODY = F('#fff19a', '#e6cc5e', '#fffbd8');
  const HAT = F('#8fb4ec', '#5b85c8', '#cfe0ff');
  const cx = 112;
  const cy = 112;
  tail(st, ctx, cx - 84, cy + 4, 26, 20, sw * 0.3, BODY, 9301, 0.45);
  const body = ellipsePts(cx, cy, 88, 56, -0.06, 60);
  st.shape(ctx, body, BODY, 9302, { lw: 1.4, light: [cx - 30, cy - 30] });
  eye(st, ctx, cx - 12, cy - 22, 11, 14, 9304);
  brow(st, ctx, cx - 12, cy - 40, 22, 9305);
  // the mouth: a big grumpy hook at the front
  mouth(st, ctx, cx + 74, cy + 26, 17, 9306);
  // the hat: a blue bowler-ish hat with a wide brim, tipped back on the top of the head, a plume on top
  const hx = cx + 30;
  const hy = cy - 56;
  const hatTip = -0.12;
  // plume: a few soft white loops
  for (const [dx, dy, r, s] of [[-6, -44, 7, 1], [2, -50, 8, 2], [9, -44, 7, 3]] as const) {
    const [px, py] = rot([[hx + dx, hy + dy]], hx, hy, hatTip)[0];
    st.shape(ctx, ellipsePts(px, py, r * 0.75, r * 1.25, (s - 2) * 0.35, 18), F('#ffffff', '#dfe4ee', '#ffffff'), 9310 + s, { lw: 0.8 });
  }
  const crownPts: Pt[] = [[hx - 32, hy - 2], [hx - 28, hy - 30], [hx - 8, hy - 40], [hx + 20, hy - 36], [hx + 32, hy - 4]];
  st.shape(ctx, rot(crownPts, hx, hy, hatTip), HAT, 9320, { lw: 1.2, light: [hx - 10, hy - 30] });
  const brim = ellipsePts(hx + 2, hy, 46, 9, hatTip, 32);
  st.shape(ctx, brim, HAT, 9321, { lw: 1.2, light: [hx - 20, hy - 4] });
  // the band, with "FAT FISH!" written on it
  ctx.save();
  ctx.translate(hx, hy - 12);
  ctx.rotate(hatTip);
  ctx.fillStyle = st.ink;
  ctx.font = '900 10px Nunito, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('FAT FISH!', 0, 0);
  ctx.restore();
}

function drawZippy(ctx: Ctx, st: Style, sw: number, flap: number) {
  const BODY = F('#9aa3ad', '#6c7580', '#d2d8de');
  const cx = 32;
  const cy = 20;
  // (zippy: its tail flicks quicker and wider)
  tail(st, ctx, cx - 9, cy, 14, 9, sw * 0.5, BODY, 9401);
  const body = ellipsePts(cx, cy, 12, 11.5, 0, 32);
  st.shape(ctx, body, BODY, 9402, { lw: 1, light: [cx - 4, cy - 6] });
  eye(st, ctx, cx + 2, cy - 3, 3.6, 4, 9404);
  // a big grin
  st.line(ctx, [[cx + 3, cy + 4], [cx + 6.5, cy + 6.5], [cx + 10, cy + 3.5]], 9405, 0.9);
  // whiskers sweeping back as it zips along
  for (const [dy, s] of [[-1, 1], [2, 2], [5, 3]] as const) st.line(ctx, [[cx + 10, cy + dy], [cx + 16, cy + dy - 1 + flap * 0.8], [cx + 21, cy + dy + 1]], 9410 + s, 0.55);
}

function drawKingBob(ctx: Ctx, st: Style, sw: number, _flap: number) {
  const BODY = F('#fff6ea', '#e3d4c2', '#ffffff');
  const ORANGE = '#ff9a3c';
  const cx = 56;
  const cy = 52;
  tail(st, ctx, cx - 25, cy, 24, 16, sw * 0.36, F(ORANGE, '#e2661a', '#ffc98c'), 9501);
  const body = ellipsePts(cx, cy, 28, 26, 0, 44);
  st.shape(ctx, body, BODY, 9502, { lw: 1.2, light: [cx - 8, cy - 12] });
  // orange patches over the top and along the belly
  patches(ctx, body, () => {
    ctx.fillStyle = ORANGE;
    ctx.beginPath();
    ctx.ellipse(cx - 4, cy - 26, 26, 8, 0.1, 0, Math.PI * 2);
    ctx.ellipse(cx - 2, cy + 26, 22, 6, -0.05, 0, Math.PI * 2);
    ctx.fill();
  });
  eye(st, ctx, cx - 1, cy - 6, 9, 11, 9504);
  brow(st, ctx, cx - 1, cy - 20, 18, 9505);
  // a rosy cheek under the eye
  ctx.fillStyle = 'rgba(240,130,60,0.75)';
  ctx.beginPath();
  ctx.ellipse(cx - 2, cy + 10, 4.5, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  mouth(st, ctx, cx + 26, cy + 8, 9, 9506);
  crown(st, ctx, cx + 8, cy - 23, 22, 14, 0.18, 9507);
}

function drawSlinger(ctx: Ctx, st: Style, sw: number, _flap: number) {
  const BODY = F('#f4f3ef', '#d6d4ce', '#ffffff');
  const GREY = F('#7c8088', '#565a61', '#b2b6bc');
  const cx = 70;
  const cy = 44;
  tail(st, ctx, cx - 44, cy + 4, 24, 13, sw * 0.32, GREY, 9601);
  // a long loaf of a body: round on top, flatter underneath, a blunt round nose
  const body: Pt[] = [];
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const rx = 46;
    const ry = Math.sin(a) < 0 ? 22 : 15;
    body.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  st.shape(ctx, body, BODY, 9602, { lw: 1.2, light: [cx - 14, cy - 12] });
  // grey patches: a saddle over the back and two on the belly
  patches(ctx, body, () => {
    ctx.fillStyle = GREY.base;
    ctx.beginPath();
    ctx.ellipse(cx - 28, cy - 14, 18, 9, 0.5, 0, Math.PI * 2);
    ctx.ellipse(cx - 12, cy + 16, 10, 5, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + 12, cy + 16, 9, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  eye(st, ctx, cx - 6, cy - 4, 8.5, 10, 9604);
  brow(st, ctx, cx - 6, cy - 17, 18, 9605);
  // a white cheek spot, outlined
  st.shape(ctx, ellipsePts(cx + 10, cy + 2, 5, 3.6, -0.3, 16), F('#ffffff', '#ececec', '#ffffff'), 9606, { lw: 0.6, plain: true });
  mouth(st, ctx, cx + 44, cy + 6, 8.5, 9607);
  crown(st, ctx, cx + 14, cy - 20, 22, 12, 0.12, 9608);
}

function drawToothy(ctx: Ctx, st: Style, sw: number, _flap: number, p: number) {
  const BODY = F('#ffe45c', '#e2b92a', '#fff6b0');
  const BAND = F('#8a8f96', '#62666d', '#b6bac0');
  const hx = 96;
  const hy = 35;
  const hr = 23;
  // the long tapering body, from the tail to the head
  tail(st, ctx, 22, hy, 16, 9, sw * 0.42, BODY, 9701, 0.4);
  const body: Pt[] = [[20, hy - 4], [48, hy - 11], [80, hy - 15], [86, hy], [80, hy + 15], [48, hy + 11], [20, hy + 4]];
  st.shape(ctx, body, BODY, 9702, { lw: 1.1, light: [40, hy - 8] });
  // the grey band round its middle
  patches(ctx, body, () => {
    ctx.fillStyle = BAND.base;
    ctx.fillRect(56, hy - 20, 9, 40);
  });
  // the head: a big round ball that's mostly mouth
  const head = ellipsePts(hx, hy, hr, hr, 0, 40);
  st.shape(ctx, head, BODY, 9704, { lw: 1.2, light: [hx - 8, hy - 10] });
  // the mouth opens and shuts as it swims (chomp, chomp)
  const open = 0.55 + 0.35 * Math.max(0, Math.sin(p * 2));
  const mx = hx + 3;
  const mw = hr * 0.95;
  const mh = hr * open;
  const mouthPts = ellipsePts(mx + 4, hy, mw * 0.72, mh, 0, 32);
  st.shape(ctx, mouthPts, F('#4a3a36', '#2c201d', '#6a5650'), 9705, { lw: 1, plain: true });
  // jagged teeth along the top and bottom of the mouth
  const teeth = (top: boolean): Pt[] => {
    const pts: Pt[] = [];
    const n = 7;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = mx + 4 - mw * 0.66 + t * mw * 1.32;
      const edge = hy + (top ? -1 : 1) * mh * Math.sqrt(Math.max(0, 1 - ((x - mx - 4) / (mw * 0.72)) ** 2));
      pts.push([x, edge]);
      if (i < n) pts.push([x + (mw * 1.32) / n / 2, edge + (top ? 1 : -1) * mh * 0.42]);
    }
    return pts;
  };
  for (const top of [true, false]) {
    const t = teeth(top);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    t.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fill();
    st.line(ctx, t, top ? 9706 : 9707, 0.6);
  }
  // a fierce little eye up on the back of the head
  eye(st, ctx, hx - 12, hy - 13, 4.5, 5, 9708);
  brow(st, ctx, hx - 12, hy - 20, 10, 9709);
}

/** A small bubble: a pale see-through ball, a bright rim and a glint. */
function bubble(ctx: Ctx, x: number, y: number, r: number) {
  ctx.save();
  ctx.fillStyle = 'rgba(210,245,255,0.35)';
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth = Math.max(0.6, r * 0.28);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** The orange fish's shot: a wobbling bubble (b0, b1), BUBBLE_SIZE units square, drawn round its middle. */
export type BubbleFrame = 'b0' | 'b1';
export const BUBBLE_FRAMES: BubbleFrame[] = ['b0', 'b1'];
export const BUBBLE_SIZE = 22;
export function drawBubbleShot(ctx: Ctx, ox: number, oy: number, f: BubbleFrame, st: Style = STYLES.polished) {
  const c = BUBBLE_SIZE / 2;
  const x = ox + c;
  const y = oy + c;
  // (it wobbles as it flies: a touch wide, then a touch tall)
  const [rx, ry] = f === 'b0' ? [8.6, 7.6] : [7.6, 8.6];
  ctx.save();
  const g = ctx.createRadialGradient(x - 3, y - 3, 1, x, y, 9);
  g.addColorStop(0, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.6, 'rgba(170,230,255,0.35)');
  g.addColorStop(1, 'rgba(90,190,235,0.55)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 1.1;
  ctx.strokeStyle = st.ink;
  ctx.globalAlpha = 0.75;
  ctx.stroke();
  ctx.globalAlpha = 1;
  // a bright glint and a little curved shine
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(x - rx * 0.4, y - ry * 0.42, 2.2, 1.5, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, Math.min(rx, ry) * 0.7, 0.2, 1.1);
  ctx.stroke();
  ctx.restore();
}
