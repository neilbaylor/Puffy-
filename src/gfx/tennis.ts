/**
 * Crab tennis under the sea (World 3): a proper little hard court set into the sea bed, seen side on
 * at a low angle like Part 1's soccer pitch — blue court, white lines, a rope net on driftwood posts
 * with cork floats, ad boards along the back framed in coral, an umpire's high chair, a scoreboard,
 * and light towers topped with glowing jellyfish. The players are crabs in visors swinging rackets;
 * the "ball" is a clam (who'd rather not be).
 *
 * Polished hand-drawn style, pure canvas drawing (gfx/world.ts's conventions).
 */
import type { Ctx } from './draw';
import { STYLES, ellipsePts, petalPts, roundRectPts, type Fill, type Pt } from './handdrawn';
import { drawSeaGrass, drawStarfish, drawShell } from './sea';

const ST = STYLES.polished;
const INK = ST.ink;
const FONT = '"Lilita One", "Arial Black", sans-serif';

/**
 * Sizes (world px), like PITCH: both pictures are (court + 2·END) wide. The front one (the court
 * slab and its lines) spans UP above the ground line to DOWN below; the back one (boards, towers,
 * chair, scoreboard) BACK_UP above. The court band runs from BAND_TOP above the ground line to
 * BAND_BOT below.
 */
export const COURT = { END: 70, UP: 16, DOWN: 50, BACK_UP: 210, BAND_TOP: 8, BAND_BOT: 40 };

const WOOD: Fill = { base: '#b08458', shade: '#7a5634', light: '#dcb48a' };
const CORAL: Fill = { base: '#ff8fa8', shade: '#d0607e', light: '#ffd0dc' };

function path(ctx: Ctx, pts: Pt[], close = true) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  if (close) ctx.closePath();
}

/** The court: a pale stone apron set in the sand, the blue court on it with its lines, seen at a low angle. */
export function drawCourtFront(ctx: Ctx, courtW: number) {
  const { END, UP, BAND_TOP, BAND_BOT } = COURT;
  const x0 = END;
  const x1 = END + courtW;
  const cx = (x0 + x1) / 2;
  const top = UP - BAND_TOP;
  const bot = UP + BAND_BOT;
  const bandH = bot - top;
  // (lines running toward you lean out a little: the low angle)
  const P = (x: number, d: number): Pt => [x + ((x - cx) / courtW) * 20 * d, top + d * bandH];
  // the apron: smooth pale stone, a little wider than the court
  const apron = roundRectPts(x0 - 34, top - 1, courtW + 68, bandH + 2, 10);
  ST.shape(ctx, apron, { base: '#e8dcc4', shade: '#c4b496', light: '#fbf4e4' }, 3000, { lw: 1, light: [cx, top] });
  // the court surface (blue), with a teal outer zone
  const outer = [P(x0 - 18, 0.08), P(x1 + 18, 0.08), P(x1 + 18, 0.94), P(x0 - 18, 0.94)];
  path(ctx, outer);
  ctx.fillStyle = '#3f9e9a';
  ctx.fill();
  const inner = [P(x0, 0.16), P(x1, 0.16), P(x1, 0.86), P(x0, 0.86)];
  path(ctx, inner);
  const g = ctx.createLinearGradient(0, top, 0, bot);
  g.addColorStop(0, '#5c9be0');
  g.addColorStop(1, '#3a74c4');
  ctx.fillStyle = g;
  ctx.fill();
  // a soft light ripple across it (sunlight through the water)
  ctx.save();
  path(ctx, outer);
  ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 1.4;
  for (let i = 0; i < courtW / 18; i++) {
    const x = x0 - 10 + ((i * 37) % (courtW + 20));
    const y = top + 6 + ((i * 13) % (bandH - 10));
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 7, y - 3, x + 14, y);
    ctx.stroke();
  }
  ctx.restore();
  // the lines
  ctx.strokeStyle = '#ffffff';
  ctx.lineCap = 'round';
  const line = (a: Pt, b: Pt, w = 1.6) => {
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
  };
  // baselines, sidelines (doubles and singles)
  line(P(x0, 0.16), P(x0, 0.86));
  line(P(x1, 0.16), P(x1, 0.86));
  line(P(x0, 0.16), P(x1, 0.16), 1.3);
  line(P(x0, 0.86), P(x1, 0.86), 1.8);
  line(P(x0, 0.26), P(x1, 0.26), 1.2);
  line(P(x0, 0.76), P(x1, 0.76), 1.6);
  // service lines and the centre service line
  const sv = courtW * 0.27;
  line(P(cx - sv, 0.26), P(cx - sv, 0.76), 1.4);
  line(P(cx + sv, 0.26), P(cx + sv, 0.76), 1.4);
  line(P(cx - sv, 0.51), P(cx + sv, 0.51), 1.3);
  // centre marks on the baselines
  line(P(x0, 0.51), P(x0 + 6, 0.51), 1.3);
  line(P(x1, 0.51), P(x1 - 6, 0.51), 1.3);
  // the net's shadow across the court
  ctx.fillStyle = 'rgba(20,40,80,0.18)';
  path(ctx, [P(cx - 3, 0.16), P(cx + 6, 0.16), P(cx + 8, 0.86), P(cx - 1, 0.86)]);
  ctx.fill();
  // the outline of the slab on top
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.1;
  path(ctx, outer);
  ctx.stroke();
  // sea-bed touches on the apron: starfish, shells, sea grass creeping on at the ends
  drawStarfish(ctx, x0 - 22, bot - 6, 6, { base: '#ff8a5c', shade: '#d05a34', light: '#ffc8a8' }, 3010);
  drawShell(ctx, x1 + 24, bot - 3, 0.8, { base: '#ffe4ec', shade: '#e0aabc', light: '#ffffff' }, 3011);
  drawStarfish(ctx, cx + courtW * 0.38, bot + 2, 5, { base: '#ffcf5c', shade: '#d8a030', light: '#fff0b8' }, 3012);
  for (const [x, k] of [[x0 - 44, 0], [x1 + 46, 3], [x1 + 30, 1]] as const) drawSeaGrass(ctx, x, top + 6, k, 0.2, 3020 + k, 0.55);
}

const ADS = [
  { text: 'CRAB OPEN', bg: '#c8102e', fg: '#ffffff' },
  { text: 'CLAM SLAM', bg: '#ffb627', fg: '#4a2a05' },
  { text: 'BUBBLE COLA', bg: '#0b7c78', fg: '#eafffb' },
  { text: 'PINCH PRO', bg: '#5a2aa6', fg: '#ffd23f' },
  { text: 'SHELL TV', bg: '#2f6fd6', fg: '#ffffff' },
  { text: 'GO CRABS!', bg: '#e8508a', fg: '#ffffff' },
];

/** A light tower: a driftwood pole lashed with rope, a glowing jellyfish in a cage on top. */
function lightTower(ctx: Ctx, x: number, ground: number, h: number, seed: number) {
  ST.shape(ctx, roundRectPts(x - 4, ground - h, 8, h, 3), WOOD, seed, { lw: 0.9, light: [x - 3, ground - h] });
  for (let y = ground - h + 18; y < ground - 10; y += 26) ST.line(ctx, [[x - 5, y], [x + 5, y + 4]], seed + y, 0.9, '#e8d6a8');
  const ly = ground - h - 16;
  // the glow
  const g = ctx.createRadialGradient(x, ly, 2, x, ly, 46);
  g.addColorStop(0, 'rgba(255,240,200,0.75)');
  g.addColorStop(0.4, 'rgba(255,200,240,0.3)');
  g.addColorStop(1, 'rgba(255,200,240,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - 46, ly - 46, 92, 92);
  // the jellyfish lamp
  const bell: Pt[] = [];
  for (let i = 0; i <= 20; i++) {
    const a = Math.PI + (i / 20) * Math.PI;
    bell.push([x + Math.cos(a) * 11, ly + 4 + Math.sin(a) * 10]);
  }
  bell.push([x + 11, ly + 6], [x - 11, ly + 6]);
  ST.shape(ctx, bell, { base: '#ffd6f0', shade: '#f0a8d8', light: '#ffffff' }, seed + 1, { lw: 0.8 });
  ctx.strokeStyle = '#ffd6f0';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(x - 7 + i * 4.6, ly + 6);
    ctx.quadraticCurveTo(x - 9 + i * 4.6, ly + 12, x - 6 + i * 4.6, ly + 16);
    ctx.stroke();
  }
  // the cage: two hoops
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(x, ly + 2, 14, 13, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, ly - 11);
  ctx.lineTo(x, ly + 15);
  ctx.stroke();
}

/** The umpire's high chair, built of coral and driftwood, standing at (x, ground). Its seat is SEAT_UP above the ground. */
export const SEAT_UP = 62;
function umpireChair(ctx: Ctx, x: number, ground: number) {
  for (const s of [-1, 1]) ST.line(ctx, [[x + s * 13, ground], [x + s * 8, ground - SEAT_UP]], 3100 + s, 1.6, WOOD.shade);
  for (let k = 1; k < 4; k++) ST.line(ctx, [[x - 13 + k * 1.3, ground - k * 15], [x + 13 - k * 1.3, ground - k * 15]], 3110 + k, 1.1, WOOD.base);
  ST.shape(ctx, roundRectPts(x - 12, ground - SEAT_UP - 3, 24, 6, 2), WOOD, 3120, { lw: 0.9 });
  ST.shape(ctx, roundRectPts(x + 7, ground - SEAT_UP - 20, 5, 19, 2), WOOD, 3121, { lw: 0.8 });
  // a coral sprig growing up one leg
  ST.shape(ctx, petalPts(x - 11, ground - 6, 14, 5, -1.9), CORAL, 3122, { lw: 0.6 });
  ST.shape(ctx, petalPts(x - 12, ground - 14, 10, 4, -2.4), CORAL, 3123, { lw: 0.6 });
}

/** Behind the court: the ad boards (coral frames), the scoreboard, two light towers, the umpire's chair. */
export function drawCourtBack(ctx: Ctx, courtW: number) {
  const { END, BACK_UP } = COURT;
  const gy = BACK_UP;
  const x0 = END;
  const x1 = END + courtW;
  const cx = (x0 + x1) / 2;
  // light towers at both ends
  lightTower(ctx, x0 - 40, gy, 128, 3200);
  lightTower(ctx, x1 + 40, gy, 128, 3210);
  // the scoreboard: a big shell-topped board on two posts, behind the far end
  const sbx = x0 + courtW * 0.18;
  const sby = gy - 120;
  for (const s of [-1, 1]) ST.shape(ctx, roundRectPts(sbx + s * 30 - 3, sby + 30, 6, 90, 2), WOOD, 3300 + s, { lw: 0.8 });
  const fan: Pt[] = [];
  for (let k = 0; k <= 18; k++) {
    const a = Math.PI + (k / 18) * Math.PI;
    fan.push([sbx + Math.cos(a) * 46, sby + 6 + Math.sin(a) * 22]);
  }
  ST.shape(ctx, fan, { base: '#ffe4ec', shade: '#e0aabc', light: '#ffffff' }, 3310, { lw: 0.9 });
  ctx.strokeStyle = '#e0aabc';
  ctx.lineWidth = 1;
  for (let k = 1; k < 8; k++) {
    const a = Math.PI + (k / 8) * Math.PI;
    ctx.beginPath();
    ctx.moveTo(sbx, sby + 6);
    ctx.lineTo(sbx + Math.cos(a) * 44, sby + 6 + Math.sin(a) * 21);
    ctx.stroke();
  }
  ST.shape(ctx, roundRectPts(sbx - 44, sby + 4, 88, 32, 5), { base: '#1d2a44', shade: '#111a2e', light: '#2e3e62' }, 3311, { lw: 1 });
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `9px ${FONT}`;
  ctx.fillStyle = '#ffd23f';
  ctx.fillText('CRAB OPEN', sbx, sby + 12);
  ctx.font = `12px ${FONT}`;
  ctx.fillStyle = '#7cf0ff';
  ctx.fillText('15 · 40', sbx, sby + 26);
  // ad boards along the back, framed in coral
  const bh = 20;
  const by = gy - bh - 2;
  const n = Math.max(2, Math.round((courtW + 60) / 120));
  const bw = (courtW + 60) / n;
  for (let i = 0; i < n; i++) {
    const ad = ADS[i % ADS.length];
    const bx = x0 - 30 + i * bw;
    ST.shape(ctx, roundRectPts(bx + 2, by, bw - 4, bh, 4), { base: ad.bg, shade: ad.bg, light: ad.bg }, 3400 + i, { lw: 0.9, plain: true });
    ctx.fillStyle = ad.fg;
    ctx.font = `11px ${FONT}`;
    ctx.fillText(ad.text, bx + bw / 2, by + bh / 2 + 0.5);
    // a coral sprig on each join
    ST.shape(ctx, petalPts(bx + 2, by + bh, 12, 5, -1.3 - (i % 2) * 0.4), CORAL, 3410 + i, { lw: 0.5 });
  }
  // the umpire's chair at the net
  umpireChair(ctx, cx + 22, gy);
}

/**
 * The net, running across the court from the far sideline to the near one, seen from the low angle
 * the court's drawn at (like the volleyball net): the far post at the back of the court (a touch
 * smaller), the near post at the front, the net between them a slanting panel of mesh — white tape
 * along the top with cork floats, a band along the bottom. In a NET_W × NET_H cell: the court's
 * ground line (the far sideline) at y = NET_GROUND, the near post's foot NET_DEEP further down.
 */
export const NET_W = 44;
export const NET_CELL_H = 96;
export const NET_GROUND = 52;
export const NET_DEEP = 34;
export function drawTennisNet(ctx: Ctx) {
  const cx = NET_W / 2;
  const kF = 0.84;
  const far = { x: cx - 7, y: NET_GROUND - 1 };
  const near = { x: cx + 7, y: NET_GROUND + NET_DEEP };
  const netH = 30;
  const topF = far.y - netH * kF;
  const topN = near.y - netH;
  const botF = far.y - 2;
  const botN = near.y - 3;
  const post = (x: number, foot: number, top: number, k: number, seed: number) => {
    ST.shape(ctx, roundRectPts(x - 2.4 * k, top - 4 * k, 4.8 * k, foot - top + 4 * k, 2 * k), WOOD, seed, { lw: 0.85 * k, light: [x - 2, top] });
    // rope lashings, a knot of cork on the top
    for (let y = top + 6 * k; y < foot - 4; y += 9 * k) ST.line(ctx, [[x - 2.6 * k, y], [x + 2.6 * k, y + 2 * k]], seed + y, 0.8 * k, '#e8d6a8');
    ST.shape(ctx, ellipsePts(x, top - 4.5 * k, 3 * k, 2.4 * k, 0, 14), { base: '#e0a050', shade: '#b0702a', light: '#ffd8a0' }, seed + 3, { lw: 0.6, plain: true });
  };
  // behind: the far post
  post(far.x, far.y, topF, kF, 3500);
  // the mesh: a slanting panel between the posts
  ctx.save();
  path(ctx, [[far.x, topF], [near.x, topN], [near.x, botN], [far.x, botF]]);
  ctx.fillStyle = 'rgba(16,20,28,0.28)';
  ctx.fill();
  ctx.clip();
  ctx.strokeStyle = 'rgba(20,24,32,0.75)';
  ctx.lineWidth = 0.4;
  // (rows run along the net, from far post to near; columns drop straight down)
  for (let j = 1; j < 14; j++) {
    const t = j / 14;
    ctx.beginPath();
    ctx.moveTo(far.x, topF + (botF - topF) * t);
    ctx.lineTo(near.x, topN + (botN - topN) * t);
    ctx.stroke();
  }
  for (let x = far.x + 1.6; x < near.x; x += 1.9) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, NET_CELL_H);
    ctx.stroke();
  }
  ctx.restore();
  // the tapes: white along the top (with cork floats), a darker band along the bottom
  ctx.lineCap = 'round';
  for (const [y0, y1, col, lw] of [[topF, topN, '#ffffff', 2.4], [botF, botN, '#2a5a4a', 1.4]] as const) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = lw + 1.1;
    ctx.beginPath();
    ctx.moveTo(far.x, y0);
    ctx.lineTo(near.x, y1);
    ctx.stroke();
    ctx.strokeStyle = col;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
  for (const t of [0.3, 0.65]) {
    const fx = far.x + (near.x - far.x) * t;
    const fy = topF + (topN - topF) * t;
    ST.shape(ctx, ellipsePts(fx, fy, 2.2 + t, 1.7 + t * 0.6, 0, 14), { base: '#e0a050', shade: '#b0702a', light: '#ffd8a0' }, 3510 + t * 10, { lw: 0.5, plain: true });
  }
  // the centre strap holding the middle down
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 1;
  const mx = (far.x + near.x) / 2;
  ctx.beginPath();
  ctx.moveTo(mx, (topF + topN) / 2 + 1);
  ctx.lineTo(mx, (botF + botN) / 2);
  ctx.stroke();
  // in front: the near post
  post(near.x, near.y, topN, 1, 3520);
}

// ───────────────────────────── the crabs ──

/** A crab tennis player (facing right, its racket in its front claw), CRAB_W × CRAB_H units, feet on the bottom. */
export const TCRAB_W = 68;
export const TCRAB_H = 56;
export const TCRAB_FRAMES = ['ready0', 'ready1', 'blink', 'run0', 'run1', 'swing0', 'swing1', 'smash0', 'smash1', 'hurt'] as const;
export type TCrabFrame = (typeof TCRAB_FRAMES)[number];
/** The two teams: shell colours, and the visor. */
export const TCRAB_TEAMS = {
  red: { shell: { base: '#ff6a4a', shade: '#cc3e26', light: '#ffb4a0' } as Fill, visor: '#2f6fd6' },
  orange: { shell: { base: '#ffa040', shade: '#d06a18', light: '#ffd4a0' } as Fill, visor: '#e8508a' },
};
/** A team, or the umpire (no racket: a striped shirt, a whistle when it blows it). */
export type TCrabTeam = keyof typeof TCRAB_TEAMS | 'ump';
const UMP_SHELL: Fill = { base: '#ff8a5a', shade: '#cc5a30', light: '#ffc4a8' };

/**
 * A tennis racket: its grip's end at (x, y), pointing along angle a, `len` long — a wrapped grip with
 * a butt cap, an open throat, an oval head (red frame with a shine) strung with a proper grid.
 */
function racket(ctx: Ctx, x: number, y: number, a: number, len: number) {
  const L = len;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  // the grip, its white tape wound round it, and the butt cap
  ST.shape(ctx, roundRectPts(-0.5, -2.2, L * 0.37, 4.4, 1.8), { base: '#33303e', shade: '#1a1824', light: '#5c5870' }, 3600, { lw: 0.8, plain: true });
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 0.6;
  for (let u = 1.5; u < L * 0.35; u += 2.4) {
    ctx.beginPath();
    ctx.moveTo(u, 2);
    ctx.lineTo(u + 1.6, -2);
    ctx.stroke();
  }
  ST.shape(ctx, roundRectPts(-1.6, -2.7, 2.6, 5.4, 1.2), { base: '#e8364a', shade: '#b0202e', light: '#ff8090' }, 3601, { lw: 0.6, plain: true });
  // the throat: two arms opening out to the head
  const hx = L * 0.72;
  const rx = L * 0.28;
  const ry = L * 0.205;
  const neck = L * 0.37;
  for (const s of [-1, 1]) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(neck - 0.5, s * 1.4);
    ctx.quadraticCurveTo(hx - rx * 0.75, s * 1.8, hx - rx * 0.86, s * ry * 0.55);
    ctx.stroke();
    ctx.strokeStyle = '#e8364a';
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }
  // the strings: a pale bed and a grid, inside the frame
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(hx, 0, rx - 1.2, ry - 1.2, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(225,245,255,0.35)';
  ctx.fill();
  ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 0.4;
  for (let u = hx - rx; u <= hx + rx; u += 2.1) {
    ctx.beginPath();
    ctx.moveTo(u, -ry);
    ctx.lineTo(u, ry);
    ctx.stroke();
  }
  for (let v = -ry; v <= ry; v += 2.1) {
    ctx.beginPath();
    ctx.moveTo(hx - rx, v);
    ctx.lineTo(hx + rx, v);
    ctx.stroke();
  }
  ctx.restore();
  // the frame: inked, red, a shine along the top
  ctx.beginPath();
  ctx.ellipse(hx, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.2;
  ctx.stroke();
  ctx.strokeStyle = '#e8364a';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(hx, 0, rx, ry, 0, Math.PI * 1.15, Math.PI * 1.6);
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 0.8;
  ctx.stroke();
  // the throat bridge
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(hx - rx * 0.86, -ry * 0.55);
  ctx.quadraticCurveTo(hx - rx * 0.7, 0, hx - rx * 0.86, ry * 0.55);
  ctx.stroke();
  ctx.strokeStyle = '#e8364a';
  ctx.lineWidth = 1.1;
  ctx.stroke();
  ctx.restore();
}

export function drawTennisCrab(ctx: Ctx, f: TCrabFrame, team: TCrabTeam) {
  const ump = team === 'ump';
  const T = ump ? { shell: UMP_SHELL, visor: '#26232a' } : TCRAB_TEAMS[team];
  const shell = T.shell;
  const ground = TCRAB_H - 1;
  const run = f === 'run0' ? 1 : f === 'run1' ? -1 : 0;
  const bob = f === 'ready1' ? 1.2 : f === 'hurt' ? -2 : run ? -1 : 0;
  const cx = 30;
  const cy = 36 + bob;
  // swings: the racket's angle (from the claw) and where the front claw is
  const swing: Record<string, [number, number, number]> = {
    swing0: [-2.6, 44, 26],
    swing1: [-0.25, 50, 30],
    smash0: [-2.0, 40, 16],
    smash1: [0.55, 50, 32],
    hurt: [-2.9, 42, 24],
  };
  let [ra, clx, cly] = swing[f] ?? [-1.15, 48, 26];
  if (ump) [ra, clx, cly] = f === 'smash0' ? [0, 40, 33] : [0.4, 44, 40];
  // legs: three each side, scuttling
  for (const s of [-1, 1])
    for (let i = 0; i < 3; i++) {
      const lx = cx + s * (6 + i * 4);
      const step = run * (i % 2 ? 1 : -1) * 2.5;
      ST.line(ctx, [[lx, cy + 4], [lx + s * 7 + step, cy + 6 - (i % 2 ? run * 2 : 0)], [lx + s * 9 + step * 1.4, ground]], 3700 + i + s, 1.6, shell.shade);
    }
  // back claw (small, raised)
  ST.line(ctx, [[cx - 10, cy - 2], [cx - 17, cy - 9]], 3710, 1.8, shell.shade);
  ST.shape(ctx, ellipsePts(cx - 19, cy - 12, 4.5, 3.6, -0.6, 18), shell, 3711, { lw: 0.7 });
  // racket (behind the front claw; the umpire has none)
  if (!ump) racket(ctx, clx, cly, ra, 32);
  // the body
  ST.shape(ctx, ellipsePts(cx, cy, 15, 10, 0, 34), shell, 3720, { lw: 1, light: [cx - 5, cy - 7] });
  // the umpire's striped shirt
  if (ump) {
    ctx.save();
    ctx.beginPath();
    ellipsePts(cx, cy, 15, 10, 0, 34).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = '#fbfbf6';
    ctx.fillRect(cx - 16, cy - 4, 32, 16);
    ctx.fillStyle = '#26232a';
    for (let x = cx - 15; x < cx + 16; x += 5) ctx.fillRect(x, cy - 4, 2.4, 16);
    ctx.restore();
    ST.line(ctx, [[cx - 14, cy - 3.5], [cx + 14, cy - 3.5]], 3725, 0.9);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 15, 10, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  // shell speckles
  ctx.fillStyle = shell.light + 'aa';
  for (const [sx, sy] of [[-6, -3], [3, -5], [8, -1], [-1, 1]] as const) {
    ctx.beginPath();
    ctx.arc(cx + sx, cy + sy, 1.1, 0, Math.PI * 2);
    ctx.fill();
  }
  // a smile (an "o" when hurt)
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1;
  if (f === 'hurt') {
    ctx.beginPath();
    ctx.ellipse(cx + 8, cy + 2, 1.6, 2.2, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(cx + 7, cy, 3.6, 0.3, 1.5);
    ctx.stroke();
  }
  // front arm and claw gripping the racket (the umpire's: its whistle)
  ST.line(ctx, [[cx + 10, cy - 2], [clx, cly]], 3730, 2, shell.shade);
  ST.shape(ctx, ellipsePts(clx, cly, 5, 4, ra, 18), shell, 3731, { lw: 0.8 });
  if (ump && f === 'smash0') ST.shape(ctx, roundRectPts(clx - 1, cly - 6, 7, 4, 1.5), { base: '#c8ccd4', shade: '#8a909c', light: '#ffffff' }, 3732, { lw: 0.7 });
  // eye stalks, eyes (shut on a blink, squeezed when hurt), the visor between them
  for (const s of [-1, 1]) {
    const ex = cx + 2 + s * 5;
    const ey = cy - 17;
    ST.line(ctx, [[ex - s * 1, cy - 9], [ex, ey + 3]], 3740, 1.3, shell.shade);
    if (f === 'blink' || f === 'hurt') {
      ST.shape(ctx, ellipsePts(ex, ey, 3.6, 3.6, 0, 16), shell, 3741, { lw: 0.6, plain: true });
      ST.line(ctx, f === 'hurt' ? [[ex - 2.4, ey - 1.4], [ex + 2.2, ey], [ex - 2.4, ey + 1.4]] : [[ex - 2.6, ey + 0.4], [ex, ey + 1.6], [ex + 2.6, ey + 0.4]], 3742, 0.9);
    } else {
      ST.shape(ctx, ellipsePts(ex, ey, 3.6, 3.8, 0, 16), { base: '#ffffff', shade: '#e6e6e6', light: '#ffffff' }, 3741, { lw: 0.6, plain: true });
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(ex + 1.2, ey + 0.4, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ex + 1.6, ey - 0.4, 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // the visor: a band across between the stalks and a peak out front
  ST.shape(ctx, roundRectPts(cx - 6, cy - 12, 14, 3.4, 1.6), { base: T.visor, shade: T.visor, light: '#ffffff' }, 3750, { lw: 0.7, plain: true });
  ST.shape(ctx, [[cx + 7, cy - 12], [cx + 15, cy - 10.5], [cx + 7, cy - 8.6]], { base: T.visor, shade: T.visor, light: '#ffffff' }, 3751, { lw: 0.7, plain: true });
}

/** The clam they're playing with: shut tight, eyes squeezed shut (`shut`), or popped open by a rocket (`open`). 28 × 24 units, its middle at (14, 12). */
export const CLAM_W = 28;
export const CLAM_H = 24;
export const CLAM_FRAMES = ['shut', 'open'] as const;
export function drawClam(ctx: Ctx, f: (typeof CLAM_FRAMES)[number]) {
  const shellF: Fill = { base: '#f6d8c8', shade: '#d4a894', light: '#fff4ec' };
  const cx = 14;
  const cy = 12;
  const half = (up: boolean, gape: number) => {
    const pts: Pt[] = [];
    for (let k = 0; k <= 18; k++) {
      const t = k / 18;
      const a = Math.PI + t * Math.PI;
      const r = 10.5 * (1 + 0.06 * Math.abs(Math.sin(t * Math.PI * 6)));
      pts.push([cx + Math.cos(a) * r, cy + (up ? -1 : 1) * (gape + Math.abs(Math.sin(a)) * r * 0.62)]);
    }
    return pts;
  };
  if (f === 'open') {
    // the top half flipped open, a pearl inside
    ST.shape(ctx, half(true, 3), shellF, 3800, { lw: 0.9 });
    ST.shape(ctx, half(false, 0.5), shellF, 3801, { lw: 0.9 });
    ST.shape(ctx, ellipsePts(cx, cy, 3.4, 3.4, 0, 16), { base: '#ffffff', shade: '#d8e0f0', light: '#ffffff' }, 3802, { lw: 0.6 });
    return;
  }
  ST.shape(ctx, [...half(true, 0), ...half(false, 0).reverse()], shellF, 3803, { lw: 1, light: [cx - 4, cy - 6] });
  // ridges
  ctx.strokeStyle = shellF.shade;
  ctx.lineWidth = 0.7;
  for (let k = 1; k < 6; k++) {
    const a = Math.PI + (k / 6) * Math.PI;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx, cy + s * 0.5);
      ctx.lineTo(cx + Math.cos(a) * 9.5, cy + s * Math.abs(Math.sin(a)) * 5.8);
      ctx.stroke();
    }
  }
  // the seam, and a face: eyes squeezed shut, a worried little mouth
  ST.line(ctx, [[cx - 10.5, cy], [cx + 10.5, cy]], 3804, 0.9);
  ST.line(ctx, [[cx - 4.5, cy - 4.2], [cx - 2.4, cy - 3.2], [cx - 4.5, cy - 2.2]], 3805, 0.8);
  ST.line(ctx, [[cx + 4.5, cy - 4.2], [cx + 2.4, cy - 3.2], [cx + 4.5, cy - 2.2]], 3806, 0.8);
  ctx.fillStyle = '#ff9fb8';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(cx + s * 6.5, cy - 1.6, 1.6, 0.9, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}
