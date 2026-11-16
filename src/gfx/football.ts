/**
 * Underwater football (Part 6, the open blue): a gridiron set into the sea bed, seen side on at a
 * low angle like Part 1's soccer pitch and Part 5's tennis court — seagrass turf mowed in stripes,
 * yard lines and numbers, hash marks, end zones in the teams' colours, a shell at midfield — with
 * driftwood goalposts at both ends, coral stands full of fish fans behind, the benches, ad boards,
 * kelp, and a scoreboard under a scallop shell.
 *
 * The teams, six a side: the SNAPPERS (sea turtles, red helmets and jerseys) and the STALLIONS
 * (seahorses, blue and gold). Each team's frames are one sheet; the jersey numbers are little
 * decals laid over the chest (so twelve players share two sheets), and the ball is its own sprite.
 *
 * Polished hand-drawn style, pure canvas drawing (gfx/world.ts's conventions).
 */
import { rng, type Ctx } from './draw';
import { STYLES, ellipsePts, petalPts, roundRectPts, type Fill, type Pt } from './handdrawn';
import { drawBranchCoral, drawKelp, drawSeaFan, drawSeaGrass, drawShell, drawStarfish } from './sea';

const ST = STYLES.polished;
const INK = ST.ink;
const FONT = '"Lilita One", "Arial Black", sans-serif';

/** The field, end line to end line, in tiles (120 yards: two 10-yard end zones and the 100 between). */
export const FB_FIELD_TILES = 36;
/**
 * Sizes (world px), like PITCH and COURT: the front picture (the turf and its lines) is (field +
 * 2·END) wide and spans UP above the ground line to DOWN below; the field band runs from BAND_TOP
 * above the ground line (the far sideline) to BAND_BOT below (the near one). The stands picture is
 * as wide and STANDS_UP tall, standing on the far sideline.
 */
export const FIELD = { END: 80, UP: 16, DOWN: 50, BAND_TOP: 8, BAND_BOT: 40, STANDS_UP: 96 };

const WOOD: Fill = { base: '#c9a77c', shade: '#8f6c46', light: '#efdcbc' };
const ROCK: Fill = { base: '#b9a48a', shade: '#8a765e', light: '#e2d4bc' };
const ROPE = '#ecdcae';

/** The teams' colours. */
export const FB_TEAMS = {
  snappers: {
    name: 'SNAPPERS',
    jersey: { base: '#e0323c', shade: '#a81e2a', light: '#ff8a8a' } as Fill,
    helmet: { base: '#e83a40', shade: '#a81e28', light: '#ffb0b0' } as Fill,
    trim: '#ffffff',
    pants: { base: '#f4f0e6', shade: '#c8c0ae', light: '#ffffff' } as Fill,
    num: '#ffffff',
    zone: '#d8343c',
  },
  stallions: {
    name: 'STALLIONS',
    jersey: { base: '#2c62d8', shade: '#1a3e98', light: '#86b0ff' } as Fill,
    helmet: { base: '#2a5ed2', shade: '#183a8e', light: '#9cc0ff' } as Fill,
    trim: '#ffd23f',
    pants: { base: '#ffd23f', shade: '#d4a218', light: '#fff2a8' } as Fill,
    num: '#ffd23f',
    zone: '#2a5cc8',
  },
};
export type FBTeam = keyof typeof FB_TEAMS;

function path(ctx: Ctx, pts: Pt[], close = true) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  if (close) ctx.closePath();
}

// ───────────────────────────── the field ──

/** Where the yard lines are: x of yard `y` (0 = the left end line, 10 the left goal line … 120 the right end line). */
const yardX = (fieldW: number, y: number) => FIELD.END + (y / 120) * fieldW;

/** The turf: a sandy apron set in the sea bed, the seagrass field on it with every line, number and mark. */
export function drawFieldFront(ctx: Ctx, fieldW: number) {
  const { END, UP, BAND_TOP, BAND_BOT } = FIELD;
  const x0 = END;
  const x1 = END + fieldW;
  const cx = (x0 + x1) / 2;
  const top = UP - BAND_TOP;
  const bot = UP + BAND_BOT;
  const bandH = bot - top;
  const Y = (y: number) => yardX(fieldW, y);
  // (lines running toward you lean out a little: the low angle)
  const P = (x: number, d: number): Pt => [x + ((x - cx) / fieldW) * 22 * d, top + d * bandH];
  const S0 = 0.08;
  const S1 = 0.93;
  // the apron: packed pale sand, a little wider than the field
  ST.shape(ctx, roundRectPts(x0 - 46, top - 1, fieldW + 92, bandH + 2, 11), { base: '#ecdcb4', shade: '#cdb888', light: '#fff6dc' }, 6000, { lw: 1, light: [cx, top] });
  // the turf, out to a little past the sidelines
  const turf = [P(x0 - 14, 0.02), P(x1 + 14, 0.02), P(x1 + 14, 0.98), P(x0 - 14, 0.98)];
  path(ctx, turf);
  const g = ctx.createLinearGradient(0, top, 0, bot);
  g.addColorStop(0, '#5dbb5c');
  g.addColorStop(1, '#3e9549');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  path(ctx, turf);
  ctx.clip();
  // mowed stripes, five yards each
  for (let y = 0; y < 120; y += 5) {
    ctx.fillStyle = (y / 5) % 2 ? 'rgba(255,255,255,0.08)' : 'rgba(0,40,10,0.07)';
    path(ctx, [P(Y(y), 0), P(Y(y + 5), 0), P(Y(y + 5), 1), P(Y(y), 1)]);
    ctx.fill();
  }
  // the end zones, in the teams' colours, each team's name across it
  for (const [a, b, team] of [[0, 10, 'snappers'], [110, 120, 'stallions']] as const) {
    const T = FB_TEAMS[team];
    path(ctx, [P(Y(a), S0), P(Y(b), S0), P(Y(b), S1), P(Y(a), S1)]);
    ctx.fillStyle = T.zone;
    ctx.fill();
    // a darker diagonal hatch
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = 'rgba(0,0,0,0.10)';
    ctx.lineWidth = 3;
    for (let x = Y(a) - 60; x < Y(b) + 60; x += 9) {
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x + 30, bot);
      ctx.stroke();
    }
    ctx.restore();
    // the name, painted flat on the turf (squashed by the angle)
    const mx = (Y(a) + Y(b)) / 2;
    ctx.save();
    ctx.translate(mx + ((mx - cx) / fieldW) * 11, top + bandH * 0.52);
    ctx.transform(1, 0, ((mx - cx) / fieldW) * 0.45, 0.5, 0, 0);
    ctx.font = `15px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(30,20,20,0.55)';
    ctx.strokeText(T.name, 0, 0, Y(b) - Y(a) - 10);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(T.name, 0, 0, Y(b) - Y(a) - 10);
    ctx.restore();
  }
  // depth shading: a lighter far edge, a touch darker near the front
  const dg = ctx.createLinearGradient(0, top, 0, bot);
  dg.addColorStop(0, 'rgba(230,255,230,0.20)');
  dg.addColorStop(0.5, 'rgba(255,255,255,0)');
  dg.addColorStop(1, 'rgba(0,40,30,0.14)');
  ctx.fillStyle = dg;
  ctx.fillRect(x0 - 60, top, fieldW + 120, bandH);
  // sunlight rippling over it from the surface
  ctx.strokeStyle = 'rgba(255,255,255,0.13)';
  ctx.lineWidth = 1.4;
  for (let i = 0; i < fieldW / 16; i++) {
    const x = x0 - 10 + ((i * 41) % (fieldW + 20));
    const y = top + 5 + ((i * 17) % (bandH - 8));
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 8, y - 3, x + 16, y);
    ctx.stroke();
  }
  ctx.restore();

  // the lines
  ctx.lineCap = 'round';
  const line = (a: Pt, b: Pt, w = 1.4, col = '#ffffff') => {
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
  };
  // sidelines and end lines (a wide white border), goal lines
  line(P(Y(0), S0), P(Y(120), S0), 1.6);
  line(P(Y(0), S1), P(Y(120), S1), 2.4);
  line(P(Y(0), S0), P(Y(0), S1), 2);
  line(P(Y(120), S0), P(Y(120), S1), 2);
  line(P(Y(10), S0), P(Y(10), S1), 2.2);
  line(P(Y(110), S0), P(Y(110), S1), 2.2);
  // yard lines every five yards
  for (let y = 15; y < 110; y += 5) line(P(Y(y), S0), P(Y(y), S1), y % 10 ? 0.9 : 1.3);
  // hash marks every yard (two rows in the middle, and along both sidelines)
  ctx.globalAlpha = 0.9;
  for (let y = 11; y < 110; y++) {
    if (y % 5 === 0) continue;
    for (const d of [0.42, 0.58]) line(P(Y(y), d - 0.025), P(Y(y), d + 0.025), 0.7);
    line(P(Y(y), S0), P(Y(y), S0 + 0.035), 0.7);
    line(P(Y(y), S1 - 0.045), P(Y(y), S1), 0.8);
  }
  ctx.globalAlpha = 1;
  // the numbers, painted flat: near side upright, far side upside down (as on a real field), arrows to the nearer goal
  for (let y = 20; y <= 100; y += 10) {
    const yd = y <= 60 ? y - 10 : 110 - y;
    const label = String(yd);
    const x = Y(y);
    for (const [d, size, flip] of [[0.77, 15, false], [0.24, 11, true]] as const) {
      const [px, py] = P(x, d);
      ctx.save();
      ctx.translate(px, py);
      ctx.transform(1, 0, ((x - cx) / fieldW) * 0.5, 0.48, 0, 0);
      if (flip) ctx.rotate(Math.PI);
      ctx.font = `${size}px ${FONT}`;
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      const gap = size * 0.06;
      ctx.textAlign = 'right';
      ctx.fillText(label[0], -gap, 0);
      ctx.textAlign = 'left';
      ctx.fillText(label[1], gap, 0);
      // the arrow, pointing to the nearer goal
      if (yd < 50) {
        const s = (y < 60 ? -1 : 1) * (flip ? -1 : 1);
        const ax = s * (size * 0.75 + 3);
        ctx.beginPath();
        ctx.moveTo(ax + s * 3.5, -size * 0.12);
        ctx.lineTo(ax, -size * 0.3);
        ctx.lineTo(ax, size * 0.06);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
  }
  // midfield: the league's shell, painted flat
  {
    const [mx, my] = P(cx, 0.5);
    ctx.save();
    ctx.translate(mx, my);
    ctx.scale(1, 0.46);
    ST.shape(ctx, ellipsePts(0, 0, 17, 17, 0, 40), { base: '#173c78', shade: '#0e2856', light: '#3a6cc0' }, 6010, { lw: 1.3, plain: true });
    ST.shape(ctx, ellipsePts(0, 0, 13.5, 13.5, 0, 40), { base: '#ffd23f', shade: '#d4a218', light: '#fff2a8' }, 6011, { lw: 0.8, plain: true });
    drawShell(ctx, 0, 7, 1.45, { base: '#ff8a5c', shade: '#d05a34', light: '#ffc8a8' }, 6012);
    ctx.restore();
  }
  // the pylons: orange, on the four corners of each end zone (the near ones, the far ones a touch smaller)
  for (const y of [0, 10, 110, 120])
    for (const [d, k] of [[S0, 0.7], [S1, 1]] as const) {
      const [px, py] = P(Y(y), d);
      ST.shape(ctx, roundRectPts(px - 2.2 * k, py - 7 * k, 4.4 * k, 7.5 * k, 1), { base: '#ff8a1e', shade: '#d0600a', light: '#ffc480' }, 6020 + y, { lw: 0.6, plain: true });
    }
  // the outline of the slab on top
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.1;
  path(ctx, turf);
  ctx.stroke();
  // sea-bed touches on the apron: starfish, shells, sea grass creeping on at the ends
  drawStarfish(ctx, x0 - 30, bot - 5, 6, { base: '#ff8a5c', shade: '#d05a34', light: '#ffc8a8' }, 6030);
  drawShell(ctx, x1 + 30, bot - 2, 0.8, { base: '#ffe4ec', shade: '#e0aabc', light: '#ffffff' }, 6031);
  drawStarfish(ctx, cx - fieldW * 0.3, bot + 3, 5, { base: '#ffcf5c', shade: '#d8a030', light: '#fff0b8' }, 6032);
  drawShell(ctx, cx + fieldW * 0.18, bot + 4, 0.7, { base: '#c8e8ff', shade: '#88aed0', light: '#ffffff' }, 6033);
  for (const [x, k] of [[x0 - 56, 0], [x0 - 40, 3], [x1 + 54, 1], [x1 + 40, 0]] as const) drawSeaGrass(ctx, x, top + 7, k, 0.2, 6040 + x, 0.6);
}

/** A goalpost, driftwood lashed with rope: the base post, the crossbar slanting across from the far side to the near, two uprights, a starfish on each. Its base stands at (POST.X, POST.FOOT) in a POST.W × POST.H cell. */
export const POST = { W: 64, H: 170, X: 28, FOOT: 152, BAR: 62 };
export function drawGoalpost(ctx: Ctx, team: FBTeam) {
  const { X, FOOT, BAR } = POST;
  const T = FB_TEAMS[team];
  const barY = FOOT - BAR;
  // (the crossbar runs from far (up and back) to near (down and forward): the low angle)
  const far: Pt = [X - 9, barY - 6];
  const near: Pt = [X + 13, barY + 7];
  const up = 72;
  const pole = (a: Pt, b: Pt, w: number, seed: number) => {
    ctx.lineCap = 'round';
    ctx.strokeStyle = INK;
    ctx.lineWidth = w + 2;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
    ctx.strokeStyle = WOOD.base;
    ctx.lineWidth = w;
    ctx.stroke();
    // grain and a highlight
    const r = rng(seed);
    ctx.strokeStyle = WOOD.light;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(a[0] - w * 0.22, a[1]);
    ctx.lineTo(b[0] - w * 0.22, b[1]);
    ctx.stroke();
    ctx.strokeStyle = WOOD.shade;
    ctx.lineWidth = 0.6;
    for (let k = 0; k < 3; k++) {
      const t0 = r() * 0.7;
      const t1 = t0 + 0.1 + r() * 0.2;
      const o = (r() - 0.3) * w * 0.4;
      ctx.beginPath();
      ctx.moveTo(a[0] + (b[0] - a[0]) * t0 + o, a[1] + (b[1] - a[1]) * t0);
      ctx.lineTo(a[0] + (b[0] - a[0]) * t1 + o, a[1] + (b[1] - a[1]) * t1);
      ctx.stroke();
    }
  };
  const lash = (x: number, y: number, seed: number) => {
    for (let k = -1; k <= 1; k++) ST.line(ctx, [[x - 3.5, y + k * 2.2 - 1], [x + 3.5, y + k * 2.2 + 1]], seed + k, 0.75, ROPE);
  };
  const star = (x: number, y: number, seed: number) => drawStarfish(ctx, x, y, 5.5, { base: '#ff8a5c', shade: '#d05a34', light: '#ffc8a8' }, seed);
  // the far upright (behind everything)
  pole(far, [far[0], far[1] - up * 0.92], 3.4, 6100);
  star(far[0], far[1] - up * 0.92 - 2, 6101);
  // the base post and its gooseneck, padded in the home colour at the bottom
  pole([X, FOOT], [X, barY + 12], 5, 6102);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(X, barY + 13);
  ctx.quadraticCurveTo(X, barY + 1, X + 2, barY + 1);
  ctx.stroke();
  ctx.strokeStyle = WOOD.base;
  ctx.lineWidth = 3.4;
  ctx.stroke();
  ST.shape(ctx, roundRectPts(X - 5, FOOT - 30, 10, 30, 3), T.jersey, 6103, { lw: 0.9, light: [X - 3, FOOT - 28] });
  ctx.strokeStyle = T.trim;
  ctx.lineWidth = 1.2;
  for (const y of [FOOT - 24, FOOT - 8]) {
    ctx.beginPath();
    ctx.moveTo(X - 4.4, y);
    ctx.lineTo(X + 4.4, y);
    ctx.stroke();
  }
  // the crossbar, lashed at the middle and both ends
  pole(far, near, 3.6, 6104);
  lash((far[0] + near[0]) / 2 + 1, (far[1] + near[1]) / 2, 6105);
  // the near upright
  pole(near, [near[0], near[1] - up], 3.8, 6106);
  lash(far[0], far[1] - 1, 6107);
  lash(near[0], near[1] - 1, 6108);
  star(near[0], near[1] - up - 2, 6109);
  // streamers in the team colour off each tip
  for (const [x, y, k] of [[far[0], far[1] - up * 0.92, 0.85], [near[0], near[1] - up, 1]] as const) {
    ctx.fillStyle = T.zone;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(x + 1, y + 4);
    ctx.quadraticCurveTo(x + 10 * k, y + 2, x + 16 * k, y + 9 * k);
    ctx.quadraticCurveTo(x + 9 * k, y + 7, x + 1, y + 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  // a little coral growing at the foot
  drawBranchCoral(ctx, ST, X - 9, FOOT, 0.32, { base: '#ff8fa8', shade: '#d0607e', light: '#ffd0dc' }, 6110);
}

const ADS = [
  { text: 'BUBBLE COLA', bg: '#c8102e', fg: '#ffffff' },
  { text: 'KELP CHIPS', bg: '#2f8a46', fg: '#fff2a8' },
  { text: 'GO SNAPPERS!', bg: '#e0323c', fg: '#ffffff' },
  { text: 'SHELL TV', bg: '#5a2aa6', fg: '#ffd23f' },
  { text: 'STALLIONS #1', bg: '#2c62d8', fg: '#ffd23f' },
  { text: 'CLAM CHOWDER', bg: '#ffb627', fg: '#4a2a05' },
  { text: 'NUGGIE HUT', bg: '#0b7c78', fg: '#eafffb' },
];

/** A little fish fan (facing you a bit, looking at the game), cheering: its body colour, a scarf or a cap in its team's. */
function fan(ctx: Ctx, x: number, y: number, s: number, seed: number) {
  const r = rng(seed);
  const bodies: Fill[] = [
    { base: '#ff9a3c', shade: '#e2661a', light: '#ffc98c' },
    { base: '#ffd23f', shade: '#d9a316', light: '#fff2a8' },
    { base: '#7ad0ff', shade: '#3a90c8', light: '#d0f0ff' },
    { base: '#ff7fa8', shade: '#d04a78', light: '#ffc8dc' },
    { base: '#9ce07a', shade: '#5aa040', light: '#d8f8c0' },
    { base: '#c8a4ff', shade: '#8a64d0', light: '#ece0ff' },
    { base: '#f2f2f2', shade: '#b8b8c0', light: '#ffffff' },
  ];
  const body = bodies[Math.floor(r() * bodies.length)];
  const team = r() < 0.5 ? FB_TEAMS.snappers : FB_TEAMS.stallions;
  const face = r() < 0.5 ? 1 : -1;
  const bob = r() * 2;
  y -= bob;
  // the tail (behind), the round body, a fin waving
  ST.shape(ctx, [[x - face * 6 * s, y], [x - face * 11 * s, y - 4 * s], [x - face * 10 * s, y + 4 * s]], body, seed, { lw: 0.5, plain: true });
  ST.shape(ctx, ellipsePts(x, y, 7 * s, 6 * s, 0, 18), body, seed + 1, { lw: 0.6, plain: true });
  // a scarf in the team colour
  ctx.fillStyle = team.zone;
  ctx.fillRect(x - 5 * s, y + 1.4 * s, 10 * s, 2.2 * s);
  // the face (big eye towards the field, a happy open mouth)
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x + face * 2.4 * s, y - 1.6 * s, 2.3 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(x + face * 2.9 * s, y - 1.4 * s, 1.1 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#8a2a2a';
  ctx.beginPath();
  ctx.ellipse(x + face * 4.6 * s, y + 0.8 * s, 1.1 * s, 1.4 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  // now and then: a pennant, or a foam finger, held up
  const what = r();
  if (what < 0.22) {
    ST.line(ctx, [[x + face * 4 * s, y - 2 * s], [x + face * 6 * s, y - 16 * s]], seed + 2, 0.4, '#6a4a2a');
    ctx.fillStyle = team.zone;
    ctx.beginPath();
    ctx.moveTo(x + face * 6 * s, y - 16 * s);
    ctx.lineTo(x + face * 15 * s, y - 13 * s);
    ctx.lineTo(x + face * 5.6 * s, y - 10 * s);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 0.5;
    ctx.stroke();
  } else if (what < 0.36) {
    ST.shape(ctx, roundRectPts(x + face * 3 * s - 2 * s, y - 15 * s, 4.4 * s, 10 * s, 1.6 * s), { base: team.trim === '#ffffff' ? '#ffcf3c' : '#ffd23f', shade: '#d4a218', light: '#fff2a8' }, seed + 3, { lw: 0.5, plain: true });
    ST.shape(ctx, roundRectPts(x + face * 3 * s - 0.9 * s, y - 20 * s, 1.8 * s, 6 * s, 0.9 * s), { base: '#ffcf3c', shade: '#d4a218', light: '#fff2a8' }, seed + 4, { lw: 0.5, plain: true });
  }
}

/**
 * Behind the field, along the far sideline: coral-rock stands full of fish fans (cheering, scarves,
 * pennants, foam fingers), the ad boards in front of them, the two benches with their drinks barrels,
 * kelp and sea fans at the ends.
 */
export function drawFieldStands(ctx: Ctx, fieldW: number) {
  const { END, STANDS_UP } = FIELD;
  const gy = STANDS_UP;
  const x0 = END;
  const x1 = END + fieldW;
  const cx = (x0 + x1) / 2;
  const Y = (y: number) => yardX(fieldW, y);
  // kelp and sea fans at both ends, behind it all
  drawKelp(ctx, x0 - 52, gy, 88, 6200, 0.15);
  drawKelp(ctx, x0 - 34, gy, 70, 6201, -0.1);
  drawKelp(ctx, x1 + 40, gy, 92, 6202, 0.2);
  drawSeaFan(ctx, ST, x1 + 60, gy - 2, 0.9, { base: '#c46ad8', shade: '#8a3aa0', light: '#efc0ff' }, 6203);
  drawSeaFan(ctx, ST, x0 - 66, gy - 2, 0.75, { base: '#ff8fa8', shade: '#d0607e', light: '#ffd0dc' }, 6204);
  // the stands: three tiers of reef rock from the 15 to the 105, fans on every tier
  const sx0 = Y(14);
  const sx1 = Y(106);
  const tiers = [
    { h: 70, d: 9 },
    { h: 52, d: 6 },
    { h: 34, d: 3 },
  ];
  tiers.forEach((t, i) => {
    const y = gy - 20 - t.h + 26;
    const a = sx0 + t.d * 3;
    const b = sx1 - t.d * 3;
    // fans along the tier, sitting on it
    const n = Math.floor((b - a) / 15);
    const r = rng(6300 + i);
    for (let k = 0; k < n; k++) {
      if (r() < 0.1) continue;
      fan(ctx, a + 8 + k * 15 + (r() - 0.5) * 4, y - 6, 0.92 - i * 0.04, 6310 + i * 97 + k);
    }
    ST.shape(ctx, roundRectPts(a, y - 1, b - a, 12, 5), ROCK, 6400 + i, { lw: 0.9, light: [cx, y] });
    // bits of coral and barnacles on the rock
    const rr = rng(6410 + i);
    for (let k = 0; k < (b - a) / 70; k++) {
      const bx = a + 20 + rr() * (b - a - 40);
      ctx.fillStyle = ['#ff8fa8', '#ffd23f', '#9ce07a', '#c8a4ff'][k % 4];
      ctx.beginPath();
      ctx.arc(bx, y + 6 + rr() * 3, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  // (the water between: a soft haze over the stands, so the game in front stands out)
  // (only over what's drawn: no box in the open water)
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = 'rgba(150,215,205,0.32)';
  ctx.fillRect(sx0 - 10, 0, sx1 - sx0 + 20, gy - 18);
  ctx.restore();
  // the ad boards along the back of the field
  const bh = 18;
  const by = gy - bh - 1;
  const n = Math.max(2, Math.round((fieldW + 60) / 128));
  const bw = (fieldW + 60) / n;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < n; i++) {
    const ad = ADS[i % ADS.length];
    const bx = x0 - 30 + i * bw;
    ST.shape(ctx, roundRectPts(bx + 2, by, bw - 4, bh, 4), { base: ad.bg, shade: ad.bg, light: ad.bg }, 6500 + i, { lw: 0.9, plain: true });
    ctx.fillStyle = ad.fg;
    ctx.font = `10.5px ${FONT}`;
    ctx.fillText(ad.text, bx + bw / 2, by + bh / 2 + 0.5);
    // a coral sprig on each join
    ST.shape(ctx, petalPts(bx + 2, by + bh, 12, 5, -1.3 - (i % 2) * 0.4), { base: '#ff8fa8', shade: '#d0607e', light: '#ffd0dc' }, 6510 + i, { lw: 0.5 });
  }
  // the benches, in front of the boards between the 30s and 40s: driftwood, a drinks barrel and towels in the team colours
  for (const [ya, yb, team] of [[33, 47, 'snappers'], [73, 87, 'stallions']] as const) {
    const T = FB_TEAMS[team];
    const a = Y(ya);
    const b = Y(yb);
    for (const lx of [a + 6, (a + b) / 2, b - 6]) ST.shape(ctx, roundRectPts(lx - 1.6, gy - 9, 3.2, 9, 1), WOOD, 6600 + lx, { lw: 0.7, plain: true });
    ST.shape(ctx, roundRectPts(a, gy - 12, b - a, 4.5, 2), WOOD, 6610 + a, { lw: 0.9, light: [a, gy - 12] });
    // towels hung over it
    for (let k = 0; k < 3; k++) {
      const tx = a + 14 + k * ((b - a - 28) / 2);
      ST.shape(ctx, roundRectPts(tx - 4, gy - 13, 8, 9, 1.5), { base: T.zone, shade: T.jersey.shade, light: T.jersey.light }, 6620 + k + a, { lw: 0.6, plain: true });
      ctx.fillStyle = T.trim;
      ctx.fillRect(tx - 4, gy - 7, 8, 1.2);
    }
    // the drinks barrel (BUBBLE COLA), at the end of the bench
    const kx = b + 12;
    ST.shape(ctx, roundRectPts(kx - 7, gy - 20, 14, 19, 4), { base: T.zone, shade: T.jersey.shade, light: T.jersey.light }, 6630 + a, { lw: 0.9 });
    ST.shape(ctx, roundRectPts(kx - 7.5, gy - 23, 15, 4.5, 2), { base: '#f4f0e6', shade: '#c8c0ae', light: '#ffffff' }, 6631 + a, { lw: 0.8, plain: true });
    ctx.fillStyle = '#ffffff';
    ctx.font = `5px ${FONT}`;
    ctx.fillText('BUBBLE', kx, gy - 13);
    ctx.fillText('COLA', kx, gy - 8.5);
    // a few bubbles rising off it
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 0.7;
    for (const [bx, bb, rr] of [[kx + 2, gy - 28, 1.4], [kx - 1, gy - 34, 1.1], [kx + 3, gy - 39, 0.8]] as const) {
      ctx.beginPath();
      ctx.arc(bx, bb, rr, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  // sea grass along the foot of the boards
  for (let k = 0; k < 7; k++) drawSeaGrass(ctx, x0 - 20 + k * ((fieldW + 40) / 6), gy, k % 4, 0.15, 6700 + k, 0.4);
}

/** The scoreboard: a dark board on two driftwood posts under a scallop shell, jellyfish lamps either side. The scores go in at SCORE (its own text). */
export const BOARD = { W: 128, H: 124, FOOT: 122, SCORE_X: 98, SCORE_Y: [66, 84] as const };
export function drawScoreboard(ctx: Ctx) {
  const { W, FOOT } = BOARD;
  const cx = W / 2;
  const top = 40;
  // the posts
  for (const s of [-1, 1]) ST.shape(ctx, roundRectPts(cx + s * 34 - 3.5, top + 30, 7, FOOT - top - 30, 2.5), WOOD, 6800 + s, { lw: 0.9 });
  // the shell over it
  const fanPts: Pt[] = [];
  for (let k = 0; k <= 22; k++) {
    const a = Math.PI + (k / 22) * Math.PI;
    const rr = 54 * (1 + 0.035 * Math.abs(Math.sin(k * Math.PI * 0.5)));
    fanPts.push([cx + Math.cos(a) * rr, top + 4 + Math.sin(a) * 30]);
  }
  ST.shape(ctx, fanPts, { base: '#ffe4ec', shade: '#e0aabc', light: '#ffffff' }, 6810, { lw: 1 });
  ctx.strokeStyle = '#e0aabc';
  ctx.lineWidth = 1.1;
  for (let k = 1; k < 10; k++) {
    const a = Math.PI + (k / 10) * Math.PI;
    ctx.beginPath();
    ctx.moveTo(cx, top + 4);
    ctx.lineTo(cx + Math.cos(a) * 52, top + 4 + Math.sin(a) * 29);
    ctx.stroke();
  }
  // jellyfish lamps on the corners, glowing
  for (const s of [-1, 1]) {
    const lx = cx + s * 58;
    const ly = top + 6;
    const g = ctx.createRadialGradient(lx, ly, 1, lx, ly, 18);
    g.addColorStop(0, 'rgba(255,240,200,0.8)');
    g.addColorStop(1, 'rgba(255,200,240,0)');
    ctx.fillStyle = g;
    ctx.fillRect(lx - 18, ly - 18, 36, 36);
    const bell: Pt[] = [];
    for (let i = 0; i <= 14; i++) {
      const a = Math.PI + (i / 14) * Math.PI;
      bell.push([lx + Math.cos(a) * 7, ly + 2 + Math.sin(a) * 6.5]);
    }
    bell.push([lx + 7, ly + 3.5], [lx - 7, ly + 3.5]);
    ST.shape(ctx, bell, { base: '#ffd6f0', shade: '#f0a8d8', light: '#ffffff' }, 6820 + s, { lw: 0.7 });
    ctx.strokeStyle = '#ffd6f0';
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(lx - 4 + i * 4, ly + 4);
      ctx.quadraticCurveTo(lx - 6 + i * 4, ly + 9, lx - 3 + i * 4, ly + 12);
      ctx.stroke();
    }
  }
  // the board
  ST.shape(ctx, roundRectPts(cx - 52, top + 2, 104, 72, 6), { base: '#1d2a44', shade: '#111a2e', light: '#2e3e62' }, 6830, { lw: 1.1 });
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.font = `9px ${FONT}`;
  ctx.fillStyle = '#ffd23f';
  ctx.fillText('REEF BOWL', cx, top + 13);
  // the two teams, a lit box for each score
  BOARD.SCORE_Y.forEach((y, i) => {
    const T = i ? FB_TEAMS.stallions : FB_TEAMS.snappers;
    ST.shape(ctx, roundRectPts(cx - 46, y - 7, 58, 14, 3), { base: T.zone, shade: T.jersey.shade, light: T.jersey.light }, 6840 + i, { lw: 0.7, plain: true });
    ctx.font = `9px ${FONT}`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(T.name, cx - 17, y + 0.5);
    ST.shape(ctx, roundRectPts(BOARD.SCORE_X - 13, y - 8, 26, 16, 3), { base: '#05080e', shade: '#05080e', light: '#05080e' }, 6850 + i, { lw: 0.7, plain: true });
  });
  ctx.font = `7px ${FONT}`;
  ctx.fillStyle = '#7cf0ff';
  ctx.fillText('QTR 4  ·  1ST & 10', cx, top + 65);
}

// ───────────────────────────── the players ──

/** A player's frame: FB_W × FB_H units, facing right, feet on FB_GROUND. */
export const FB_W = 64;
export const FB_H = 66;
export const FB_GROUND = 62;
export const FB_FRAMES = ['idle0', 'idle1', 'blink', 'set', 'run0', 'run1', 'run2', 'run3', 'throw0', 'throw1', 'catch', 'block', 'cheer0', 'cheer1', 'hurt', 'down'] as const;
export type FBFrame = (typeof FB_FRAMES)[number];

type Face = 'open' | 'shut' | 'ow' | 'yell' | 'grin' | 'up';
/**
 * A pose: where the hip, shoulder and head are, the hands (near: in front of the body; far: behind
 * it) and the feet, the body's lean (radians, + forward), and the face.
 */
interface Pose {
  hip: Pt;
  sh: Pt;
  head: Pt;
  hn: Pt;
  hf: Pt;
  fn: Pt;
  ff: Pt;
  lean: number;
  face: Face;
}

const add = (a: Pt, dx: number, dy: number): Pt => [a[0] + dx, a[1] + dy];
const G = FB_GROUND;

/** The turtles' poses (stocky, upright, on two stumpy legs). */
function turtlePose(f: FBFrame): Pose {
  const base: Pose = { hip: [28, 47], sh: [31, 31], head: [38, 18], hn: [41, 44], hf: [22, 43], fn: [35, G], ff: [22, G], lean: 0.1, face: 'open' };
  const b = (dy: number, p: Partial<Pose>): Pose => {
    const q = { ...base, ...p };
    return { ...q, hip: add(q.hip, 0, dy), sh: add(q.sh, 0, dy), head: add(q.head, 0, dy), hn: add(q.hn, 0, dy), hf: add(q.hf, 0, dy) };
  };
  switch (f) {
    case 'idle0':
      return base;
    case 'idle1':
      return b(1, {});
    case 'blink':
      return { ...base, face: 'shut' };
    case 'set':
      // the three-point stance: down low, one fist on the turf
      return { hip: [21, 45], sh: [35, 39], head: [45, 30], hn: [44, G - 1], hf: [26, 50], fn: [33, G], ff: [12, G], lean: 0.9, face: 'open' };
    case 'run0':
      return b(0, { lean: 0.3, sh: [33, 31], head: [41, 19], hn: [24, 42], hf: [44, 36], fn: [42, G - 1], ff: [14, G - 3] });
    case 'run1':
      return b(-2, { lean: 0.3, sh: [33, 31], head: [41, 19], hn: [34, 44], hf: [30, 40], fn: [31, G + 2], ff: [27, G - 5] });
    case 'run2':
      return b(0, { lean: 0.3, sh: [33, 31], head: [41, 19], hn: [45, 37], hf: [21, 41], fn: [16, G - 3], ff: [40, G - 1] });
    case 'run3':
      return b(-2, { lean: 0.3, sh: [33, 31], head: [41, 19], hn: [30, 42], hf: [34, 44], fn: [28, G - 5], ff: [31, G + 2] });
    case 'throw0':
      // the wind-up: leaning back, the far arm cocked right back behind the helmet, the near one pointing where it's going
      return { hip: [27, 47], sh: [27, 31], head: [33, 18], hn: [44, 30], hf: [9, 17], fn: [38, G], ff: [15, G], lean: -0.18, face: 'yell' };
    case 'throw1':
      // the release: the arm whipped through, over the top and out in front
      return { hip: [29, 47], sh: [35, 31], head: [43, 20], hn: [27, 44], hf: [53, 21], fn: [42, G], ff: [18, G - 2], lean: 0.35, face: 'yell' };
    case 'catch':
      return b(-3, { head: [37, 17], hn: [42, 9], hf: [34, 7], fn: [33, G - 3], ff: [24, G - 3], lean: -0.05, face: 'up' });
    case 'block':
      return { hip: [24, 47], sh: [34, 34], head: [42, 23], hn: [50, 36], hf: [48, 42], fn: [37, G], ff: [12, G], lean: 0.55, face: 'yell' };
    case 'cheer0':
      return b(-6, { hn: [46, 9], hf: [18, 9], fn: [34, G - 7], ff: [22, G - 5], face: 'grin', lean: 0 });
    case 'cheer1':
      return b(0, { hn: [45, 11], hf: [19, 11], face: 'grin', lean: 0 });
    case 'hurt':
      return b(-1, { sh: [28, 32], head: [33, 19], hn: [44, 24], hf: [12, 26], fn: [38, G - 2], ff: [20, G], lean: -0.25, face: 'ow' });
    case 'down':
      return { ...base, hn: [45, 36], hf: [16, 36], fn: [40, G - 6], ff: [28, G - 8], face: 'ow' };
  }
}

/** The seahorses' poses (upright on a curled tail: they hop). `fn` is where the tail's coil sits; `ff` unused. */
function horsePose(f: FBFrame): Pose {
  const base: Pose = { hip: [27, 44], sh: [30, 27], head: [35, 15], hn: [39, 40], hf: [22, 39], fn: [27, G - 5], ff: [0, 0], lean: 0.12, face: 'open' };
  const b = (dy: number, p: Partial<Pose>, coil = 0): Pose => {
    const q = { ...base, ...p };
    return { ...q, hip: add(q.hip, 0, dy), sh: add(q.sh, 0, dy), head: add(q.head, 0, dy), hn: add(q.hn, 0, dy), hf: add(q.hf, 0, dy), fn: add(q.fn, 0, coil) };
  };
  switch (f) {
    case 'idle0':
      return base;
    case 'idle1':
      return b(1, {});
    case 'blink':
      return { ...base, face: 'shut' };
    case 'set':
      return { hip: [23, 45], sh: [34, 35], head: [43, 27], hn: [44, G - 1], hf: [27, 50], fn: [24, G - 4], ff: [0, 0], lean: 0.8, face: 'open' };
    // the hop: crouched on its coil, springing up, at the top, coming down
    case 'run0':
      return b(1, { lean: 0.35, sh: [32, 28], head: [39, 17], hn: [40, 36], hf: [24, 38] }, 1);
    case 'run1':
      return b(-4, { lean: 0.3, sh: [32, 28], head: [39, 17], hn: [44, 32], hf: [20, 34] }, -3);
    case 'run2':
      return b(-7, { lean: 0.25, sh: [32, 28], head: [39, 17], hn: [43, 30], hf: [21, 32] }, -5);
    case 'run3':
      return b(-3, { lean: 0.3, sh: [32, 28], head: [39, 17], hn: [41, 34], hf: [22, 36] }, -2);
    case 'throw0':
      return { hip: [27, 44], sh: [27, 27], head: [32, 15], hn: [43, 27], hf: [9, 15], fn: [28, G - 5], ff: [0, 0], lean: -0.2, face: 'yell' };
    case 'throw1':
      return { hip: [28, 44], sh: [34, 28], head: [41, 18], hn: [28, 40], hf: [52, 19], fn: [27, G - 5], ff: [0, 0], lean: 0.35, face: 'yell' };
    case 'catch':
      return b(-4, { hn: [40, 7], hf: [31, 5], face: 'up', lean: -0.05 }, -3);
    case 'block':
      return { hip: [23, 45], sh: [32, 31], head: [40, 21], hn: [48, 33], hf: [46, 39], fn: [22, G - 4], ff: [0, 0], lean: 0.55, face: 'yell' };
    case 'cheer0':
      return b(-7, { hn: [44, 7], hf: [17, 8], face: 'grin', lean: 0 }, -5);
    case 'cheer1':
      return b(0, { hn: [43, 9], hf: [18, 10], face: 'grin', lean: 0 });
    case 'hurt':
      return b(-1, { sh: [27, 28], head: [31, 16], hn: [42, 22], hf: [12, 24], face: 'ow', lean: -0.28 });
    case 'down':
      return { ...base, hn: [44, 32], hf: [16, 34], face: 'ow' };
  }
}

const poses = new Map<string, Pose>();
/** A frame's pose (worked out once: the game asks for the hands and the chest every frame). */
export function fbPose(team: FBTeam, f: FBFrame): Pose {
  const key = team + f;
  let p = poses.get(key);
  if (!p) poses.set(key, (p = team === 'snappers' ? turtlePose(f) : horsePose(f)));
  return p;
}

/** Where a frame's near hand is (the ball's carried there), and the far hand (the throwing arm), in frame units. */
export function fbHands(team: FBTeam, f: FBFrame): { near: Pt; far: Pt } {
  const p = fbPose(team, f);
  return { near: p.hn, far: p.hf };
}

/** Where the jersey number goes (frame units) and its tilt; null on the frames it isn't seen (lying down). */
const chests = new Map<string, [number, number, number] | null>();
export function fbChest(team: FBTeam, f: FBFrame): [number, number, number] | null {
  const key = team + f;
  if (!chests.has(key)) chests.set(key, chestOf(team, f));
  return chests.get(key)!;
}
function chestOf(team: FBTeam, f: FBFrame): [number, number, number] | null {
  if (f === 'down') return null;
  const p = fbPose(team, f);
  const t = team === 'snappers' ? 0.42 : 0.4;
  return [p.hip[0] + (p.sh[0] - p.hip[0]) * t - 1.5 * Math.cos(p.lean), p.hip[1] + (p.sh[1] - p.hip[1]) * t - 1.5 * Math.sin(p.lean), p.lean * 0.8];
}

/** A limb: an inked tube from a to b, bending by `bend` at the middle (an elbow or a knee). */
function limb(ctx: Ctx, a: Pt, b: Pt, w: number, col: string, bend = 0, sleeve?: { col: string; t: number; trim?: string }) {
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l = Math.hypot(dx, dy) || 1;
  const k: Pt = [mx - (dy / l) * bend, my + (dx / l) * bend];
  const curve = () => {
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.quadraticCurveTo(k[0], k[1], b[0], b[1]);
  };
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  curve();
  ctx.strokeStyle = INK;
  ctx.lineWidth = w + 2.2;
  ctx.stroke();
  ctx.strokeStyle = col;
  ctx.lineWidth = w;
  ctx.stroke();
  if (sleeve) {
    // the upper part in the jersey (a sleeve), with a stripe at its cuff
    const at = (t: number): Pt => [(1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * k[0] + t * t * b[0], (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * k[1] + t * t * b[1]];
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    for (let i = 1; i <= 6; i++) ctx.lineTo(...at((i / 6) * sleeve.t));
    ctx.strokeStyle = INK;
    ctx.lineWidth = w + 3.2;
    ctx.stroke();
    ctx.strokeStyle = sleeve.col;
    ctx.lineWidth = w + 1.2;
    ctx.stroke();
    if (sleeve.trim) {
      const [sx, sy] = at(sleeve.t * 0.78);
      ctx.fillStyle = sleeve.trim;
      ctx.beginPath();
      ctx.arc(sx, sy, (w + 1) / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = sleeve.col;
      ctx.lineWidth = w + 1.2;
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      for (let i = 1; i <= 4; i++) ctx.lineTo(...at((i / 4) * sleeve.t * 0.66));
      ctx.stroke();
    }
  }
  // a soft highlight along it
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.lineWidth = w * 0.3;
  ctx.beginPath();
  ctx.moveTo(a[0] - 0.6, a[1] - 0.6);
  ctx.quadraticCurveTo(k[0] - 0.6, k[1] - 0.6, b[0] - 0.6, b[1] - 0.6);
  ctx.stroke();
}

/** A gloved hand (a fist, or a flipper tip for the turtles). */
function hand(ctx: Ctx, at: Pt, r: number, fill: Fill, seed: number) {
  ST.shape(ctx, ellipsePts(at[0], at[1], r, r * 0.9, 0, 14), fill, seed, { lw: 0.7, plain: true });
}

/**
 * The helmet on a head at (hx, hy), radius r, facing right, tilted by `a`: the shell in the team
 * colour with a stripe down the middle, an ear hole, a little badge, the face mask's bars in front of
 * the face, the chin strap. `snout`: the face sticks out this far (the seahorse's long nose).
 */
function helmet(ctx: Ctx, hx: number, hy: number, r: number, a: number, team: FBTeam, seed: number) {
  const T = FB_TEAMS[team];
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(a);
  // the shell: over the top and back of the head, down to the jaw at the back
  const R = r * 1.14;
  const pts: Pt[] = [];
  for (let i = 0; i <= 24; i++) {
    const t = Math.PI * 0.86 + (i / 24) * Math.PI * 1.08;
    pts.push([Math.cos(t) * R, Math.sin(t) * R * 0.98]);
  }
  pts.push([R * 0.82, -R * 0.08], [R * 0.32, R * 0.22], [R * 0.08, R * 0.62], [-R * 0.62, R * 0.72]);
  ST.shape(ctx, pts, T.helmet, seed, { lw: 0.9, light: [-R * 0.2, -R * 0.7] });
  // the stripe over the top
  ctx.strokeStyle = T.trim;
  ctx.lineWidth = r * 0.28;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.8, Math.PI * 1.08, Math.PI * 1.8);
  ctx.stroke();
  // the badge on the side (a shell for the Snappers, a gold star for the Stallions) and the ear hole
  if (team === 'snappers') {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(-R * 0.3, R * 0.02, r * 0.3, r * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = T.helmet.shade;
    ctx.lineWidth = 0.5;
    for (const dx of [-0.12, 0, 0.12]) {
      ctx.beginPath();
      ctx.moveTo(-R * 0.3, R * 0.2);
      ctx.lineTo(-R * 0.3 + r * dx * 2.2, -R * 0.18);
      ctx.stroke();
    }
  } else {
    const sp: Pt[] = [];
    for (let i = 0; i < 10; i++) {
      const t = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const rr = i % 2 ? r * 0.14 : r * 0.33;
      sp.push([-R * 0.3 + Math.cos(t) * rr, Math.sin(t) * rr]);
    }
    ST.shape(ctx, sp, { base: T.trim, shade: '#d4a218', light: '#fff2a8' }, seed + 1, { lw: 0.4, plain: true });
  }
  ctx.fillStyle = 'rgba(20,10,10,0.55)';
  ctx.beginPath();
  ctx.arc(R * 0.08, R * 0.32, r * 0.11, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** The face mask: grey bars from the helmet's front edge out round the face. */
function faceMask(ctx: Ctx, hx: number, hy: number, r: number, a: number, reach: number) {
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(a);
  const R = r * 1.14;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const bars = (w: number, col: string) => {
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    // the cage's front: a bar curving down in front of the face
    ctx.beginPath();
    ctx.moveTo(R * 0.8, -R * 0.12);
    ctx.quadraticCurveTo(R * 0.8 + reach, -R * 0.05, R * 0.76 + reach * 0.9, R * 0.5);
    ctx.quadraticCurveTo(R * 0.6 + reach * 0.6, R * 0.82, R * 0.2, R * 0.66);
    ctx.stroke();
    // two cross bars back to the helmet
    ctx.beginPath();
    ctx.moveTo(R * 0.55, R * 0.18);
    ctx.lineTo(R * 0.86 + reach, R * 0.2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(R * 0.4, R * 0.45);
    ctx.lineTo(R * 0.8 + reach * 0.85, R * 0.44);
    ctx.stroke();
  };
  bars(2.3, INK);
  bars(1.15, '#c8ccd4');
  ctx.restore();
}

/** An eye (white, a pupil looking `look` (radians), a shine), shut, squeezed (ow) or rolled up. */
function eye(ctx: Ctx, x: number, y: number, r: number, face: Face, lid: Fill) {
  if (face === 'shut') {
    ST.shape(ctx, ellipsePts(x, y, r, r, 0, 14), lid, 7000, { lw: 0.6, plain: true });
    ST.line(ctx, [[x - r * 0.8, y + 0.2], [x, y + r * 0.45], [x + r * 0.8, y + 0.2]], 7001, 0.5);
    return;
  }
  ST.shape(ctx, ellipsePts(x, y, r, r * 1.05, 0, 14), { base: '#ffffff', shade: '#e6e6e6', light: '#ffffff' }, 7002, { lw: 0.6, plain: true });
  if (face === 'ow') {
    ST.line(ctx, [[x - r * 0.6, y - r * 0.5], [x + r * 0.5, y], [x - r * 0.6, y + r * 0.5]], 7003, 0.55);
    return;
  }
  const up = face === 'up' ? -r * 0.4 : face === 'yell' ? -r * 0.1 : 0;
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(x + r * 0.35, y + r * 0.1 + up, r * 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x + r * 0.5, y - r * 0.15 + up, r * 0.18, 0, Math.PI * 2);
  ctx.fill();
  // a determined brow when yelling
  if (face === 'yell') ST.line(ctx, [[x - r * 0.9, y - r * 1.15], [x + r * 0.9, y - r * 0.75]], 7004, 0.6);
}

const TURTLE_SKIN: Fill = { base: '#86c66a', shade: '#4f9442', light: '#c4ec9e' };
const TURTLE_SHELL: Fill = { base: '#8a6a3a', shade: '#5c4222', light: '#c4a26a' };
const HORSE_SKIN: Fill = { base: '#ffbe3c', shade: '#d88a1a', light: '#ffe69a' };
const HORSE_FIN: Fill = { base: '#ff9a7a', shade: '#e0664a', light: '#ffd4c0' };

/** The torso: the jersey (shoulders padded out), the pants below a belt, in the team colours. */
function torso(ctx: Ctx, p: Pose, team: FBTeam, rx: number, ry: number, seed: number) {
  const T = FB_TEAMS[team];
  const cx = (p.hip[0] + p.sh[0]) / 2;
  const cy = (p.hip[1] + p.sh[1]) / 2 + 1;
  const body = ellipsePts(cx, cy, rx, ry, p.lean, 34);
  ST.shape(ctx, body, T.jersey, seed, { lw: 1, light: [cx - 3, cy - ry * 0.6] });
  // the pants: the lower part, below the belt
  const up: Pt = [Math.sin(p.lean), -Math.cos(p.lean)];
  const side: Pt = [Math.cos(p.lean), Math.sin(p.lean)];
  const belt = ry * 0.4;
  ctx.save();
  path(ctx, body);
  ctx.clip();
  const bx = cx - up[0] * belt;
  const by = cy - up[1] * belt;
  path(ctx, [
    [bx - side[0] * 30, by - side[1] * 30],
    [bx + side[0] * 30, by + side[1] * 30],
    [bx + side[0] * 30 - up[0] * 30, by + side[1] * 30 - up[1] * 30],
    [bx - side[0] * 30 - up[0] * 30, by - side[1] * 30 - up[1] * 30],
  ]);
  const g = ctx.createLinearGradient(bx, by, bx - up[0] * 14, by - up[1] * 14);
  g.addColorStop(0, T.pants.light);
  g.addColorStop(1, T.pants.shade);
  ctx.fillStyle = g;
  ctx.fill();
  // the belt, and a stripe down the side of the pants
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(bx - side[0] * 30, by - side[1] * 30);
  ctx.lineTo(bx + side[0] * 30, by + side[1] * 30);
  ctx.stroke();
  // the jersey's hem stripes (just over the belt)
  ctx.strokeStyle = T.trim;
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(bx + up[0] * 2.4 - side[0] * 30, by + up[1] * 2.4 - side[1] * 30);
  ctx.lineTo(bx + up[0] * 2.4 + side[0] * 30, by + up[1] * 2.4 + side[1] * 30);
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6;
  path(ctx, body);
  ctx.stroke();
  // the shoulder pad: a big rounded hump over the near shoulder, with the sleeve stripe
  const sx = p.sh[0] + side[0] * 2;
  const sy = p.sh[1] + side[1] * 2 + 1;
  ST.shape(ctx, ellipsePts(sx, sy, rx * 0.62, ry * 0.36, p.lean - 0.25, 22), T.jersey, seed + 1, { lw: 0.9, light: [sx - 2, sy - 3] });
  ctx.strokeStyle = T.trim;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.ellipse(sx, sy, rx * 0.48, ry * 0.24, p.lean - 0.25, Math.PI * 1.1, Math.PI * 1.75);
  ctx.stroke();
}

function drawTurtle(ctx: Ctx, p: Pose, f: FBFrame) {
  const T = FB_TEAMS.snappers;
  const skin = TURTLE_SKIN;
  const side: Pt = [Math.cos(p.lean), Math.sin(p.lean)];
  const cx = (p.hip[0] + p.sh[0]) / 2;
  const cy = (p.hip[1] + p.sh[1]) / 2 + 1;
  const run = f.startsWith('run');
  // the far leg and arm (behind)
  limb(ctx, add(p.hip, -3, 2), p.ff, 6, skin.shade, run ? 2 : 1, { col: T.pants.shade, t: 0.55 });
  ST.shape(ctx, ellipsePts(p.ff[0] + 1.5, p.ff[1] - 1.6, 4.6, 2.4, 0, 14), { base: skin.shade, shade: skin.shade, light: skin.base }, 7100, { lw: 0.7, plain: true });
  const farArm = () => {
    limb(ctx, add(p.sh, -2, 1), p.hf, 4.4, skin.shade, -2, { col: T.jersey.shade, t: 0.34 });
    hand(ctx, p.hf, 3, { base: skin.shade, shade: skin.shade, light: skin.base }, 7101);
  };
  // (the throw: the arm comes over the top, in front of the helmet)
  const over = f === 'throw1';
  if (!over) farArm();
  // the shell on its back, poking out behind the jersey: brown plates, a pale rim
  const shc: Pt = [cx - side[0] * 8.5, cy - side[1] * 8.5];
  ST.shape(ctx, ellipsePts(shc[0], shc[1], 9.5, 16, p.lean + 0.08, 30), TURTLE_SHELL, 7102, { lw: 1, light: [shc[0] - 3, shc[1] - 10] });
  ctx.save();
  path(ctx, ellipsePts(shc[0], shc[1], 9.5, 16, p.lean + 0.08, 30));
  ctx.clip();
  ctx.strokeStyle = '#3e2c14';
  ctx.lineWidth = 0.8;
  for (const [dx, dy] of [[-4, -8], [-5, 0], [-4, 8]] as const) {
    ctx.beginPath();
    const hx = shc[0] + dx * side[0] - dy * Math.sin(p.lean) * -1;
    const hy = shc[1] + dx * side[1] + dy * Math.cos(p.lean);
    for (let i = 0; i <= 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const px = hx + Math.cos(a) * 3.6;
      const py = hy + Math.sin(a) * 3.4;
      if (i) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    }
    ctx.stroke();
  }
  ctx.restore();
  // the body: jersey and pants
  torso(ctx, p, 'snappers', 12.5, 15.5, 7103);
  // the near leg: thigh in the pants, a stumpy green shin, a flat foot
  limb(ctx, add(p.hip, 2, 2), p.fn, 6.6, skin.base, run ? -2 : -1, { col: T.pants.base, t: 0.55, trim: T.jersey.base });
  ST.shape(ctx, ellipsePts(p.fn[0] + 2, p.fn[1] - 1.8, 5.4, 2.6, 0, 14), skin, 7104, { lw: 0.8, plain: true });
  // socks: a stripe at the ankle
  ctx.strokeStyle = T.jersey.base;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(p.fn[0] - 2.5, p.fn[1] - 4.5);
  ctx.lineTo(p.fn[0] + 2.5, p.fn[1] - 4.5);
  ctx.stroke();
  // the head: a round green head with a little beak, under the helmet
  const [hx, hy] = p.head;
  const a = p.lean * 0.45;
  const r = 9;
  // the neck
  limb(ctx, add(p.sh, 1, 2), [hx - 1, hy + 4], 7, skin.base);
  ST.shape(ctx, ellipsePts(hx + 1.5, hy + 1, r * 1.05, r * 0.95, a, 28), skin, 7105, { lw: 1, light: [hx - 2, hy - 4] });
  // the beak and the mouth
  const c = Math.cos(a);
  const s = Math.sin(a);
  const rot = (dx: number, dy: number): Pt => [hx + dx * c - dy * s, hy + dx * s + dy * c];
  ST.shape(ctx, [rot(5, 1), rot(11.5, 2.5), rot(10, 5.5), rot(5, 6)], skin, 7106, { lw: 0.8, plain: true });
  ctx.strokeStyle = INK;
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  if (p.face === 'yell' || p.face === 'grin') {
    ctx.moveTo(...rot(4, 5));
    ctx.quadraticCurveTo(...rot(8, p.face === 'yell' ? 10 : 8), ...rot(11, 4.5));
    ctx.fillStyle = '#8a2a2a';
    ctx.fill();
  } else if (p.face === 'ow') {
    const [ox, oy] = rot(8, 5.5);
    ctx.ellipse(ox, oy, 1.3, 1.7, 0, 0, Math.PI * 2);
  } else {
    ctx.moveTo(...rot(4.5, 5));
    ctx.quadraticCurveTo(...rot(8, 6.5), ...rot(11, 4));
  }
  ctx.stroke();
  helmet(ctx, hx, hy, r, a, 'snappers', 7107);
  eye(ctx, ...rot(5, -0.5), 2.8, p.face, skin);
  faceMask(ctx, hx, hy, r, a, 2.6);
  // the near arm on top: a sleeve, a green forearm, a flipper hand
  limb(ctx, add(p.sh, 3, 2), p.hn, 4.8, skin.base, 2, { col: T.jersey.base, t: 0.34, trim: T.trim });
  hand(ctx, p.hn, 3.3, skin, 7108);
  if (over) farArm();
}

function drawSeahorse(ctx: Ctx, p: Pose, f: FBFrame) {
  const T = FB_TEAMS.stallions;
  const skin = HORSE_SKIN;
  const side: Pt = [Math.cos(p.lean), Math.sin(p.lean)];
  const cx = (p.hip[0] + p.sh[0]) / 2;
  const cy = (p.hip[1] + p.sh[1]) / 2 + 1;
  // the far arm (behind)
  const farArm = () => {
    limb(ctx, add(p.sh, -2, 1), p.hf, 3.6, skin.shade, -2, { col: T.jersey.shade, t: 0.34 });
    hand(ctx, p.hf, 2.6, { base: skin.shade, shade: skin.shade, light: skin.base }, 7200);
  };
  const over = f === 'throw1';
  if (!over) farArm();
  // the dorsal fin on its back (poking out through the jersey), fluttering
  const fin = (f.startsWith('run') ? +f[3] : 0) * 0.15;
  const fb: Pt = [cx - side[0] * 9, cy - side[1] * 9 + 4];
  ST.shape(ctx, petalPts(fb[0], fb[1], 11, 7, Math.PI + 0.4 + p.lean + fin), HORSE_FIN, 7201, { lw: 0.8 });
  ctx.strokeStyle = HORSE_FIN.shade;
  ctx.lineWidth = 0.6;
  for (let k = -1; k <= 1; k++) {
    ctx.beginPath();
    ctx.moveTo(fb[0], fb[1]);
    const a = Math.PI + 0.4 + p.lean + fin + k * 0.3;
    ctx.lineTo(fb[0] + Math.cos(a) * 9, fb[1] + Math.sin(a) * 9);
    ctx.stroke();
  }
  // the tail: from under the pants down and round into a coil it stands (hops) on
  const [kx, ky] = p.fn;
  const cr = 5;
  const tailPts: Pt[] = [];
  const start = add(p.hip, -1, 4);
  const mid: Pt = [(start[0] + kx) / 2 - 5, (start[1] + ky) / 2 + 1];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const x = (1 - t) * (1 - t) * start[0] + 2 * (1 - t) * t * mid[0] + t * t * (kx - cr);
    const y = (1 - t) * (1 - t) * start[1] + 2 * (1 - t) * t * mid[1] + t * t * ky;
    tailPts.push([x, y]);
  }
  // round the coil
  for (let i = 1; i <= 14; i++) {
    const a = Math.PI + (i / 14) * Math.PI * 1.6;
    const rr = cr * (1 - (i / 14) * 0.55);
    tailPts.push([kx + Math.cos(a) * rr, ky - Math.sin(a) * rr * 0.95]);
  }
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [w, col] of [[9, INK], [6.8, skin.base]] as const) {
    for (let i = 0; i < tailPts.length - 1; i++) {
      const t = i / (tailPts.length - 1);
      ctx.strokeStyle = col;
      ctx.lineWidth = Math.max(col === INK ? 3.4 : 1.4, w * (1 - t * 0.78));
      ctx.beginPath();
      ctx.moveTo(...tailPts[i]);
      ctx.lineTo(...tailPts[i + 1]);
      ctx.stroke();
    }
  }
  // ridges along the tail
  ctx.strokeStyle = skin.shade;
  ctx.lineWidth = 0.7;
  for (let i = 2; i < tailPts.length - 4; i += 2) {
    const [ax, ay] = tailPts[i];
    const [bx, by] = tailPts[i + 1];
    const l = Math.hypot(bx - ax, by - ay) || 1;
    const w = 2.8 * (1 - (i / tailPts.length) * 0.7);
    ctx.beginPath();
    ctx.moveTo(ax - ((by - ay) / l) * w, ay + ((bx - ax) / l) * w);
    ctx.lineTo(ax + ((by - ay) / l) * w, ay - ((bx - ax) / l) * w);
    ctx.stroke();
  }
  // the body: jersey and pants (slimmer than a turtle's)
  torso(ctx, p, 'stallions', 10.5, 14.5, 7202);
  // belly ridges showing below the jersey hem? (no: the pants cover it). The head on a curved neck:
  const [hx, hy] = p.head;
  const a = p.lean * 0.4 + 0.08;
  const r = 7.6;
  limb(ctx, add(p.sh, 0, 2), [hx - 2, hy + 4], 7.5, skin.base, 2);
  const c = Math.cos(a);
  const s = Math.sin(a);
  const rot = (dx: number, dy: number): Pt => [hx + dx * c - dy * s, hy + dx * s + dy * c];
  // the long snout, out through the face mask, a little round mouth at its end
  ST.shape(ctx, [rot(3, 0), rot(15.5, 2.2), rot(16.5, 4.2), rot(15.5, 6.4), rot(3, 6.6)], skin, 7203, { lw: 0.9, light: [hx + 6, hy + 2] });
  ctx.fillStyle = p.face === 'yell' || p.face === 'grin' || p.face === 'ow' ? '#8a2a2a' : INK;
  ctx.beginPath();
  const [mx, my] = rot(16.6, 4.3);
  ctx.ellipse(mx, my, p.face === 'yell' ? 1.3 : 0.8, p.face === 'yell' ? 1.8 : 1.1, a, 0, Math.PI * 2);
  ctx.fill();
  ST.shape(ctx, ellipsePts(hx, hy + 0.5, r, r * 0.95, a, 26), skin, 7204, { lw: 1, light: [hx - 2, hy - 3] });
  // a cheek frill
  ctx.strokeStyle = skin.shade;
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.arc(...rot(-1, 3), 3.4, 0.3, 1.9);
  ctx.stroke();
  helmet(ctx, hx, hy, r, a, 'stallions', 7205);
  eye(ctx, ...rot(3.6, 0), 2.6, p.face, skin);
  faceMask(ctx, hx, hy, r, a, 3.2);
  // the near arm on top
  limb(ctx, add(p.sh, 3, 2), p.hn, 4, skin.base, 2, { col: T.jersey.base, t: 0.36, trim: T.trim });
  hand(ctx, p.hn, 2.9, skin, 7206);
  if (over) farArm();
}

/** One frame of a player (facing right, feet on FB_GROUND), its shadow under it. */
export function drawFootballer(ctx: Ctx, team: FBTeam, f: FBFrame) {
  const p = fbPose(team, f);
  // the shadow on the turf
  const air = f === 'cheer0' ? 0.7 : f.startsWith('run') && team === 'stallions' ? 0.85 : 1;
  ctx.fillStyle = `rgba(10,40,30,${0.28 * air})`;
  ctx.beginPath();
  ctx.ellipse(30, G + 0.6, 15 * air + (f === 'down' ? 12 : 0), 2.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  if (f === 'down') {
    // flat on its back (shell down, belly up), dazed: the standing pose turned over
    ctx.translate(-4, team === 'snappers' ? 74 : 69);
    ctx.rotate(-Math.PI / 2);
  }
  if (team === 'snappers') drawTurtle(ctx, p, f);
  else drawSeahorse(ctx, p, f);
  ctx.restore();
  if (f === 'down' || f === 'hurt') {
    // little stars going round
    const [x, y] = f === 'down' ? [16, 36] : [p.head[0] - 2, p.head[1] - 14];
    for (let k = 0; k < 3; k++) {
      const a = k * 2.1 + 0.4;
      drawStarfish(ctx, x + Math.cos(a) * 8, y + Math.sin(a) * 3, 2.6, { base: '#ffe14a', shade: '#e0a818', light: '#fff6c0' }, 7300 + k);
    }
  }
}

// ───────────────────────────── the ball, the numbers ──

/** The football: FBALL_W × FBALL_H units, pointing right, its middle at the cell's middle. b0–b3 spin it round its long axis (the laces going round); `lie` lies on the turf. */
export const FBALL_W = 26;
export const FBALL_H = 16;
export const FBALL_FRAMES = ['b0', 'b1', 'b2', 'b3'] as const;
export function drawFootball(ctx: Ctx, f: (typeof FBALL_FRAMES)[number]) {
  const cx = FBALL_W / 2;
  const cy = FBALL_H / 2;
  const L = 11.5;
  const H = 6.6;
  const pts: Pt[] = [];
  for (let i = 0; i <= 32; i++) {
    const t = (i / 32) * Math.PI * 2;
    const x = Math.cos(t);
    // (pointed at the ends)
    pts.push([cx + x * L, cy + Math.sin(t) * H * Math.pow(1 - x * x, 0.18) * (Math.abs(x) > 0.98 ? 0.4 : 1)]);
  }
  const leather: Fill = { base: '#9a4e22', shade: '#62300e', light: '#d88a52' };
  ST.shape(ctx, pts, leather, 7400, { lw: 1, light: [cx - 3, cy - 4] });
  // the spin: the laces and stripes run round it (phase 0: laces on top facing you)
  const ph = (+f[1] / 4) * Math.PI * 2;
  const lv = Math.cos(ph);
  const ly = cy - Math.sin(ph + Math.PI / 2) * H * 0.55;
  ctx.save();
  path(ctx, pts);
  ctx.clip();
  // the white stripes near the ends (always seen: they go all the way round)
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.4;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + s * L * 0.6, cy - H);
    ctx.quadraticCurveTo(cx + s * L * 0.66, cy, cx + s * L * 0.6, cy + H);
    ctx.stroke();
  }
  // the seam, and the laces when they're round this side
  ctx.strokeStyle = '#4a2008';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(cx - L * 0.82, ly);
  ctx.quadraticCurveTo(cx, ly + (ly < cy ? -1.2 : 1.2), cx + L * 0.82, ly);
  ctx.stroke();
  if (lv > -0.3) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5 * (0.6 + 0.4 * Math.max(0, lv));
    ctx.beginPath();
    ctx.moveTo(cx - L * 0.32, ly);
    ctx.lineTo(cx + L * 0.32, ly);
    ctx.stroke();
    ctx.lineWidth = 0.9;
    for (let k = -3; k <= 3; k++) {
      ctx.beginPath();
      ctx.moveTo(cx + k * 1.9, ly - 1.4 * Math.max(0.3, lv));
      ctx.lineTo(cx + k * 1.9, ly + 1.4 * Math.max(0.3, lv));
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** A jersey number decal (two digits, white or gold, inked), NUM_W × NUM_H units. */
export const NUM_W = 16;
export const NUM_H = 11;
/** The players' numbers: the Snappers C, G, G, QB, WR, WR; the Stallions DL, DL, LB, CB, CB, S. */
export const FB_NUMBERS: Record<FBTeam, number[]> = { snappers: [55, 70, 72, 12, 88, 81], stallions: [90, 94, 52, 24, 21, 33] };
export const NUM_FRAMES = [...FB_NUMBERS.snappers.map((n) => `s${n}`), ...FB_NUMBERS.stallions.map((n) => `h${n}`)];
export function drawJerseyNumber(ctx: Ctx, f: string) {
  const team: FBTeam = f[0] === 's' ? 'snappers' : 'stallions';
  ctx.font = `10px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = team === 'snappers' ? '#6a1018' : '#0e2050';
  ctx.strokeText(f.slice(1), NUM_W / 2, NUM_H / 2 + 0.6);
  ctx.fillStyle = FB_TEAMS[team].num;
  ctx.fillText(f.slice(1), NUM_W / 2, NUM_H / 2 + 0.6);
}

/** The ball's shadow on the turf (a soft dark ellipse), SHADOW_W × SHADOW_H units. */
export const FB_SHADOW = { W: 24, H: 8 };
export function drawBallShadow(ctx: Ctx) {
  const g = ctx.createRadialGradient(12, 4, 0, 12, 4, 12);
  g.addColorStop(0, 'rgba(10,40,30,0.55)');
  g.addColorStop(1, 'rgba(10,40,30,0)');
  ctx.fillStyle = g;
  ctx.save();
  ctx.scale(1, 1 / 3);
  ctx.beginPath();
  ctx.arc(12, 12, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
