/**
 * World 2 · "Plop Invasion": Puff Ball Planet, taken over by the Plops and
 * covered in poo. The same hand-drawn world, but the puff-moss is a thick
 * glossy layer of poo that drips over every edge, the puff trees wear poo
 * caps, little poo piles sit where the flowers were, the hills in the
 * distance are soft-serve poo mountains, the waterfalls run brown and the
 * sea of clouds below is a sea of sludge.
 *
 * The drawing helpers live here (world.ts draws the poo touches for palettes
 * with `poo: true`); the palettes themselves are in plopLooks.ts.
 */
import type { Ctx } from './draw';
import { STYLES, ellipsePts, type Fill, type Pt } from './handdrawn';

const ST = STYLES.polished;
const INK = ST.ink;

/** Fresh, glossy poo. */
export const POO: Fill = { base: '#8a5232', shade: '#5c3118', light: '#c99064' };
/** Older, darker poo. */
export const POO_DARK: Fill = { base: '#6b3b20', shade: '#45230f', light: '#a06a44' };

/**
 * A poo swirl: stacked, shrinking tiers with a curled tip and a glossy shine.
 * Base centre (x, groundY), width w.
 */
export function drawPooSwirl(ctx: Ctx, x: number, groundY: number, w: number, fill: Fill = POO, seed = 1) {
  const tiers = w > 26 ? 4 : 3;
  let y = groundY;
  let tw = w;
  for (let i = 0; i < tiers; i++) {
    const th = tw * 0.36;
    ST.shape(ctx, ellipsePts(x + (i % 2 ? -1 : 1) * tw * 0.04, y - th * 0.5, tw / 2, th / 2, 0, 22), fill, seed + i, { lw: Math.max(0.5, w / 40), light: [x - tw * 0.18, y - th * 0.75] });
    y -= th * 0.72;
    tw *= 0.72;
  }
  // the curled tip
  const tip: Pt[] = [
    [x - tw * 0.32, y + 1],
    [x + tw * 0.05, y - tw * 0.55],
    [x + tw * 0.5, y - tw * 1.05],
    [x + tw * 0.32, y - tw * 0.4],
    [x + tw * 0.36, y + 1],
  ];
  ST.shape(ctx, tip, fill, seed + 9, { lw: Math.max(0.5, w / 40), light: [x, y - tw * 0.4] });
  // shine
  ctx.fillStyle = '#ffffff70';
  ctx.beginPath();
  ctx.ellipse(x - w * 0.2, groundY - w * 0.26, w * 0.09, w * 0.045, -0.5, 0, Math.PI * 2);
  ctx.fill();
}

/** A drip of poo hanging from (x, y): a stretched teardrop `len` long, `w` wide. */
export function drawDrip(ctx: Ctx, x: number, y: number, len: number, w: number, fill: Fill = POO) {
  ctx.fillStyle = fill.shade;
  ctx.beginPath();
  ctx.moveTo(x - w / 2 - 0.6, y);
  ctx.quadraticCurveTo(x - w / 2 - 0.6, y + len * 0.7, x, y + len + 0.8);
  ctx.quadraticCurveTo(x + w / 2 + 0.6, y + len * 0.7, x + w / 2 + 0.6, y);
  ctx.fill();
  ctx.fillStyle = fill.base;
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y);
  ctx.quadraticCurveTo(x - w / 2, y + len * 0.68, x, y + len);
  ctx.quadraticCurveTo(x + w / 2, y + len * 0.68, x + w / 2, y);
  ctx.fill();
  ctx.fillStyle = fill.light + 'cc';
  ctx.beginPath();
  ctx.ellipse(x - w * 0.15, y + len * 0.62, w * 0.14, len * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * A poo pile prop (where Puff Ball Planet had little flowers): a squat swirl,
 * sometimes a flat splat, sometimes with a fly. Feet at (x, groundY). `v` 0..3 picks the variant.
 */
export function drawPooPile(ctx: Ctx, x: number, groundY: number, v: number) {
  if (v === 3) {
    // a flat splat
    const pts: Pt[] = [];
    for (let k = 0; k < 18; k++) {
      const a = (k / 18) * Math.PI * 2;
      const rr = (k % 2 ? 6.5 : 8.5) + Math.sin(k * 2.7) * 1.2;
      pts.push([x + Math.cos(a) * rr, groundY - 2.5 + Math.sin(a) * rr * 0.32]);
    }
    ST.shape(ctx, pts, POO_DARK, 77, { lw: 0.6, light: [x - 3, groundY - 4] });
    return;
  }
  drawPooSwirl(ctx, x, groundY, [12, 15, 10][v], v === 1 ? POO_DARK : POO, 60 + v);
  if (v === 1) {
    // a little fly buzzing over it
    const fx = x + 5;
    const fy = groundY - 17;
    ctx.fillStyle = '#ffffffb0';
    ctx.beginPath();
    ctx.ellipse(fx - 2, fy - 2, 2.2, 1.3, -0.5, 0, Math.PI * 2);
    ctx.ellipse(fx + 2, fy - 2, 2.2, 1.3, 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2a2230';
    ctx.beginPath();
    ctx.arc(fx, fy, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Distant soft-serve poo mountain for the hills layer: base centre (x, baseY), width w, height h. */
export function drawPooMountain(ctx: Ctx, x: number, baseY: number, w: number, h: number, fill: Fill, ink: typeof ST, seed: number) {
  const tiers = 4;
  let y = baseY;
  let tw = w;
  const th = h / (tiers + 0.6);
  for (let i = 0; i < tiers; i++) {
    const pts: Pt[] = [];
    for (let k = 0; k <= 24; k++) {
      const t = k / 24;
      const a = Math.PI + t * Math.PI;
      pts.push([x + (i % 2 ? -1 : 1) * tw * 0.03 + Math.cos(a) * tw / 2, y + Math.sin(a) * th * 1.15]);
    }
    pts.push([x + tw / 2, y + 4]);
    pts.push([x - tw / 2, y + 4]);
    ink.shape(ctx, pts, fill, seed + i, { lw: 0.8, light: [x - tw * 0.2, y - th] });
    y -= th * 0.95;
    tw *= 0.74;
  }
  const tip: Pt[] = [
    [x - tw * 0.3, y + 2],
    [x + tw * 0.1, y - th * 0.7],
    [x + tw * 0.55, y - th * 1.2],
    [x + tw * 0.35, y - th * 0.3],
    [x + tw * 0.35, y + 2],
  ];
  ink.shape(ctx, tip, fill, seed + 9, { lw: 0.8 });
}

/** The Big Plop's rolling poo wave: 56 × 36, rolling to the right, its foot on y = 34. Frames 0..3 wobble it. */
export const POOWAVE_W = 56;
export const POOWAVE_H = 36;
export function drawPooWave(ctx: Ctx, f: number) {
  const k = [0, 1, 2, 1][f] - 1; // -1..1
  const crestX = 38 + k * 1.5;
  const crestY = 7 - k * 1.5;
  const lipX = 50 + k * 1.2;
  const pts: Pt[] = [
    [2, 34],
    [8, 30],
    [16, 25 + k],
    [24, 18 - k * 0.5],
    [31, 11],
    [crestX, crestY],
    [lipX - 3, crestY + 1],
    [lipX, crestY + 6],
    [lipX - 2, crestY + 11],
    [lipX - 6, crestY + 10],
    [lipX - 5, 22],
    [lipX - 1, 30],
    [lipX + 1, 34],
  ];
  ST.shape(ctx, pts, POO, 4100 + f, { lw: 1.2, light: [26, 16] });
  // darker under the curl
  ctx.fillStyle = POO.shade + 'aa';
  ctx.beginPath();
  ctx.ellipse(lipX - 7, crestY + 12, 4, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  // drips off the lip
  drawDrip(ctx, lipX - 2, crestY + 10, 4 + f, 2.6);
  drawDrip(ctx, lipX - 7, crestY + 11, 6 - f * 0.8, 2.2);
  // bubbles and shine
  ctx.fillStyle = '#ffffff60';
  for (const [bx, by, br] of [[18 + f * 2, 28, 1.6], [28 - f, 22, 1.2], [34, 17 + f, 1]] as const) {
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = '#ffffff80';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(22, 20);
  ctx.quadraticCurveTo(30, 11, crestX - 1, crestY + 2);
  ctx.stroke();
}

/** A wavy stink line (rises off the Plops): 12 × 26. */
export function drawStink(ctx: Ctx) {
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#a8c24ad0';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    const x = 6 + Math.sin(t * Math.PI * 2.5) * 3.6;
    const y = 25 - t * 23;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

/** Poo all over a mountain goat (drawn over its frame, 64 × 64). Not on the frames where it's flipped over. */
export function drawPooOnGoat(ctx: Ctx, frame: string) {
  if (frame.startsWith('flop')) return;
  const head = frame === 'c0' || frame === 'c1' || frame === 'sp0' || frame === 'sp1' ? (frame[0] === 'c' ? [12, 30] : [13, 16]) : [13, 18];
  // a swirl on its back, splats on its coat and head, drips down its side
  const blob = (x: number, y: number, rx: number, ry: number, f: Fill, seed: number) => ST.shape(ctx, ellipsePts(x, y, rx, ry, 0.3, 14), f, seed, { lw: 0.55, light: [x - rx * 0.3, y - ry * 0.4] });
  blob(44, 30, 5, 3, POO_DARK, 5101);
  blob(33, 34, 3.4, 2.2, POO, 5102);
  blob(head[0] + 1, head[1] - 7, 4.2, 2.6, POO, 5103);
  drawDrip(ctx, 46, 31, 6, 2.2, POO_DARK);
  drawDrip(ctx, 31, 35, 5, 1.8);
  drawPooSwirl(ctx, 40, 25, 11, POO, 5104);
}

/**
 * A pro beach volleyball: white, with curved yellow and blue panels sweeping round it
 * in three bands, fine seams, a soft shine. Centre (cx, cy), radius r.
 */
export function drawVolleyball(ctx: Ctx, cx: number, cy: number, r: number) {
  const YEL = '#ffcc1a';
  const BLU = '#1d5fc4';
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = '#fbfaf5';
  ctx.fill();
  ctx.clip();
  // each band: the strip between two big circles curving across the ball, cut into three
  // panels (yellow, white, blue) by two more circles in between
  const band = (a: number, cols: string[]) => {
    const ux = Math.cos(a);
    const uy = Math.sin(a);
    const R0 = r * 1.15;
    const offs = [1.95, 1.78, 1.61, 1.44];
    for (let i = 0; i < 3; i++) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx + ux * r * offs[i + 1], cy + uy * r * offs[i + 1], R0, 0, Math.PI * 2);
      ctx.clip();
      ctx.beginPath();
      ctx.rect(cx - r * 3, cy - r * 3, r * 6, r * 6);
      ctx.arc(cx + ux * r * offs[i], cy + uy * r * offs[i], R0, 0, Math.PI * 2, true);
      ctx.fillStyle = cols[i];
      ctx.fill('evenodd');
      ctx.restore();
    }
    ctx.strokeStyle = '#1b2440';
    ctx.lineWidth = r * 0.045;
    for (const o of offs) {
      ctx.beginPath();
      ctx.arc(cx + ux * r * o, cy + uy * r * o, R0, 0, Math.PI * 2);
      ctx.stroke();
    }
  };
  band(-0.5, [YEL, '#fbfaf5', BLU]);
  band(-0.5 + (Math.PI * 2) / 3, [BLU, '#fbfaf5', YEL]);
  band(-0.5 + (Math.PI * 4) / 3, [YEL, '#fbfaf5', BLU]);
  // shading + shine
  const g = ctx.createRadialGradient(cx - r * 0.38, cy - r * 0.42, r * 0.05, cx, cy, r * 1.05);
  g.addColorStop(0, '#ffffffaa');
  g.addColorStop(0.35, '#ffffff22');
  g.addColorStop(0.75, '#00000000');
  g.addColorStop(1, '#0a1a3a55');
  ctx.fillStyle = g;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  ctx.restore();
  ctx.strokeStyle = INK;
  ctx.lineWidth = r * 0.11;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
}

/** A sponsor banner on two posts (w × h, its feet at y = h + 6): white, an orange band, blue lettering. */
export function drawCourtBoard(ctx: Ctx, w: number, h: number, text: string) {
  for (const x of [w * 0.12, w * 0.88]) {
    ctx.fillStyle = '#8d94a0';
    ctx.fillRect(x - 0.8, h - 2, 1.6, 8);
  }
  const r = 2;
  const panel = () => {
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(w - r, 0);
    ctx.quadraticCurveTo(w, 0, w, r);
    ctx.lineTo(w, h - r);
    ctx.quadraticCurveTo(w, h, w - r, h);
    ctx.lineTo(r, h);
    ctx.quadraticCurveTo(0, h, 0, h - r);
    ctx.lineTo(0, r);
    ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.closePath();
  };
  panel();
  ctx.fillStyle = '#fffaf0';
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = '#ff8a2a';
  ctx.fillRect(0, 0, w, h * 0.22);
  ctx.fillStyle = '#2a6fd6';
  ctx.fillRect(0, h * 0.82, w, h * 0.18);
  // a poo swirl logo at each end
  for (const x of [h * 0.45, w - h * 0.45]) drawPooSwirl(ctx, x, h * 0.78, h * 0.24, POO, 5400 + Math.round(x));
  ctx.restore();
  ctx.font = `${Math.round(h * 0.42)}px "Lilita One", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = h * 0.09;
  ctx.strokeStyle = '#ffffff';
  ctx.strokeText(text, w / 2, h * 0.53);
  ctx.fillStyle = '#1f4fa8';
  ctx.fillText(text, w / 2, h * 0.53);
  panel();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 0.9;
  ctx.stroke();
}

/** The referee's high chair (white frame, blue seat), its feet at (x, groundY), seat ~34 px up. */
export function drawRefChair(ctx: Ctx, x: number, groundY: number) {
  const top = groundY - 34;
  ctx.lineCap = 'round';
  // legs and ladder
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.6;
  for (const [a, b] of [[x - 7, x - 4], [x + 7, x + 4]] as const) {
    ctx.beginPath();
    ctx.moveTo(a, groundY);
    ctx.lineTo(b, top + 2);
    ctx.stroke();
  }
  ctx.strokeStyle = '#f4f6f9';
  ctx.lineWidth = 1.5;
  for (const [a, b] of [[x - 7, x - 4], [x + 7, x + 4]] as const) {
    ctx.beginPath();
    ctx.moveTo(a, groundY);
    ctx.lineTo(b, top + 2);
    ctx.stroke();
  }
  for (let i = 1; i <= 4; i++) {
    const t = i / 5;
    const yy = groundY - (groundY - top) * t;
    const hw = 7 - 3 * t;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(x - hw, yy);
    ctx.lineTo(x + hw, yy);
    ctx.stroke();
    ctx.strokeStyle = '#d5d9e0';
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
  // the seat and its back
  ST.shape(ctx, [[x - 7, top - 1], [x + 7, top - 1], [x + 7, top + 3], [x - 7, top + 3]], { base: '#2a6fd6', shade: '#1b4e9e', light: '#5c96ee' }, 5501, { lw: 0.8, plain: true });
  ST.shape(ctx, [[x + 4, top - 12], [x + 7.5, top - 12], [x + 7.5, top], [x + 4, top]], { base: '#2a6fd6', shade: '#1b4e9e', light: '#5c96ee' }, 5502, { lw: 0.8, plain: true });
}

/** The volleyball court's sand, side on (like the soccer pitch's turf): how far it rises over the ground line, and its depth. */
export const SAND = { UP: 6, DOWN: 30, END: 14 };

/**
 * The court's sand, seen from the side: a raked band over the front of the ground from
 * x = END to END + w, with a blue tape line along the top and a little flag at each end.
 */
export function drawVolleySand(ctx: Ctx, w: number) {
  const { UP, DOWN, END } = SAND;
  const gy = UP; // the ground line
  const x0 = END;
  const x1 = END + w;
  // the sand: a soft mound on top, a wavy bottom edge where it thins out into the soil
  ctx.beginPath();
  ctx.moveTo(x0 - 10, gy + 2);
  ctx.quadraticCurveTo(x0 - 4, gy - 4, x0 + 6, gy - 4);
  ctx.lineTo(x1 - 6, gy - 4);
  ctx.quadraticCurveTo(x1 + 4, gy - 4, x1 + 10, gy + 2);
  for (let x = x1 + 6; x >= x0 - 6; x -= 9) ctx.lineTo(x, gy + DOWN - 10 + Math.sin(x * 0.37) * 3 + Math.sin(x * 0.11) * 4);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, gy - 4, 0, gy + DOWN);
  g.addColorStop(0, '#fbe6b4');
  g.addColorStop(0.35, '#efd29a');
  g.addColorStop(1, '#d9b277');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.clip();
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < w / 3; i++) {
    ctx.fillStyle = rnd() < 0.55 ? '#c99f62' : '#fff6dc';
    ctx.fillRect(x0 - 8 + rnd() * (w + 16), gy - 3 + rnd() * (DOWN - 4), 0.8, 0.8);
  }
  ctx.strokeStyle = '#d4af7255';
  ctx.lineWidth = 0.6;
  for (let i = 0; i < w / 14; i++) {
    const x = x0 + rnd() * w;
    const y = gy + 3 + rnd() * (DOWN - 14);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 5, y - 1.5, x + 10, y);
    ctx.stroke();
  }
  ctx.restore();
  // ink outline along the top, the blue tape just under it
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(x0 - 10, gy + 2);
  ctx.quadraticCurveTo(x0 - 4, gy - 4, x0 + 6, gy - 4);
  ctx.lineTo(x1 - 6, gy - 4);
  ctx.quadraticCurveTo(x1 + 4, gy - 4, x1 + 10, gy + 2);
  ctx.stroke();
  ctx.strokeStyle = '#1f5fc0';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(x0 + 2, gy - 1.5);
  ctx.lineTo(x1 - 2, gy - 1.5);
  ctx.stroke();
  // little boundary flags at the corners
  for (const x of [x0 + 2, x1 - 2]) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(x, gy - 2);
    ctx.lineTo(x, gy - 13);
    ctx.stroke();
    ctx.fillStyle = '#ff8a2a';
    ctx.beginPath();
    ctx.moveTo(x, gy - 13);
    ctx.lineTo(x + (x < x1 - 10 ? 6 : -6), gy - 11);
    ctx.lineTo(x, gy - 9);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

/**
 * The net, nearly side on (seen from just a little in front, so it isn't a flat stick): the
 * near post at (w/2 + 4, h) and the far post just behind it, a touch higher and smaller, with
 * the net stretched between them (black mesh, white tape along the top, blue at the bottom)
 * and a red-and-white antenna over each end. The top of the net netH above the near post's foot.
 */
export function drawVolleyNetSide(ctx: Ctx, w: number, h: number, netH: number) {
  const cx = w / 2;
  const near = { x: cx + 4, y: h };
  const far = { x: cx - 4, y: h - 5 };
  const kF = 0.94;
  const topN = near.y - netH;
  const topF = far.y - netH * kF;
  const botN = topN + netH * 0.4;
  const botF = topF + netH * kF * 0.4;
  const metal = (x: number, k: number) => {
    const g = ctx.createLinearGradient(x - 1.6 * k, 0, x + 1.6 * k, 0);
    g.addColorStop(0, '#9aa1ad');
    g.addColorStop(0.45, '#ffffff');
    g.addColorStop(1, '#8d94a0');
    return g;
  };
  const post = (x: number, foot: number, top: number, k: number) => {
    ctx.fillStyle = metal(x, k);
    ctx.fillRect(x - 1.5 * k, top - 2, 3 * k, foot - top + 2);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 0.6;
    ctx.strokeRect(x - 1.5 * k, top - 2, 3 * k, foot - top + 2);
    const padTop = foot - (foot - top) * 0.42;
    const pad = ctx.createLinearGradient(x - 3 * k, 0, x + 3 * k, 0);
    pad.addColorStop(0, '#1b4e9e');
    pad.addColorStop(0.4, '#4a8af0');
    pad.addColorStop(1, '#18458c');
    ctx.fillStyle = pad;
    ctx.fillRect(x - 3 * k, padTop, 6 * k, foot - padTop);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 0.7;
    ctx.strokeRect(x - 3 * k, padTop, 6 * k, foot - padTop);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - 3 * k, padTop + 4, 6 * k, 1.3);
  };
  const antenna = (x: number, top: number, k: number) => {
    const len = netH * 0.3 * k;
    for (let i = 0; i < 6; i++) {
      ctx.strokeStyle = i % 2 ? '#ffffff' : '#e8322a';
      ctx.lineWidth = 1.2 * k;
      ctx.beginPath();
      ctx.moveTo(x, top - (len * i) / 6);
      ctx.lineTo(x, top - (len * (i + 1)) / 6);
      ctx.stroke();
    }
    ctx.strokeStyle = INK;
    ctx.lineWidth = 0.35;
    ctx.strokeRect(x - 0.6 * k, top - len, 1.2 * k, len);
  };
  // behind: the far post and its antenna
  antenna(far.x, topF, kF);
  post(far.x, far.y, topF, kF);
  // the net between the posts: a narrow, slanting panel of mesh
  ctx.beginPath();
  ctx.moveTo(far.x, topF);
  ctx.lineTo(near.x, topN);
  ctx.lineTo(near.x, botN);
  ctx.lineTo(far.x, botF);
  ctx.closePath();
  ctx.fillStyle = '#10121a33';
  ctx.fill();
  ctx.strokeStyle = '#15161dbb';
  ctx.lineWidth = 0.35;
  for (let j = 1; j < 12; j++) {
    const t = j / 12;
    ctx.beginPath();
    ctx.moveTo(far.x, topF + (botF - topF) * t);
    ctx.lineTo(near.x, topN + (botN - topN) * t);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(cx, (topF + topN) / 2);
  ctx.lineTo(cx, (botF + botN) / 2);
  ctx.stroke();
  // the tapes: white along the top, blue along the bottom
  ctx.lineCap = 'round';
  for (const [y0, y1, col, lw] of [[topF, topN, '#ffffff', 2.6], [botF, botN, '#2a6fd6', 1.8]] as const) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = lw + 1.2;
    ctx.beginPath();
    ctx.moveTo(far.x, y0);
    ctx.lineTo(near.x, y1);
    ctx.stroke();
    ctx.strokeStyle = col;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
  // in front: the near post and its antenna
  post(near.x, near.y, topN, 1);
  antenna(near.x, topN, 1);
}
