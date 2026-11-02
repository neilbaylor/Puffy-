import type { Ctx } from './draw';
import { STYLES, ellipsePts, roundRectPts, type Fill, type Pt } from './handdrawn';

/**
 * A proper little soccer pitch for Puff Park (Part 1): mowed stripes, white
 * lines (halfway line, centre circle, penalty boxes, goal areas, spots and
 * corner arcs) seen at a low angle, real goals with nets, corner flags, LED
 * ad boards along the far touchline and floodlight towers at both ends.
 * Polished hand-drawn style.
 */
const st = () => STYLES.polished;
const FONT = '"Lilita One", "Arial Black", sans-serif';

/**
 * Sizes (world px). Both textures are (pitch + 2·END) wide. The front one
 * (turf, lines, goals, flags) spans FRONT_UP above the ground line to
 * FRONT_DOWN below; the back one (boards, floodlights) BACK_UP above.
 * The turf band runs from BAND_TOP above the ground line to BAND_BOT below.
 */
export const PITCH = { END: 84, FRONT_UP: 64, FRONT_DOWN: 50, BACK_UP: 246, BAND_TOP: 10, BAND_BOT: 46 };

const POST: Fill = { base: '#ffffff', shade: '#d6d2cc', light: '#ffffff' };
const STEEL: Fill = { base: '#a3abc2', shade: '#737c98', light: '#d7dcea' };

const ADS = [
  { text: 'PUFF COLA', bg: '#c8102e', fg: '#ffffff' },
  { text: 'NUGGIE HUT', bg: '#ffb627', fg: '#4a2a05' },
  { text: 'PUFF BALL PLANET', bg: '#0b7c78', fg: '#eafffb' },
  { text: 'MADE BY HENRY & NEIL', bg: '#5a2aa6', fg: '#ffd23f' },
  { text: 'ROOT BEER', bg: '#5a2a10', fg: '#ffe2b0' },
  { text: 'GO PUFFS!', bg: '#2f6fd6', fg: '#ffffff' },
];

function path(ctx: Ctx, pts: Pt[], close = true) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  if (close) ctx.closePath();
}

/**
 * The turf, lines, goals and corner flags (drawn just over the terrain's top
 * edge, behind the players). pitchW = goal line to goal line.
 */
export function drawPitchFront(ctx: Ctx, pitchW: number) {
  const S = st();
  const { END, FRONT_UP, BAND_TOP, BAND_BOT } = PITCH;
  const g0 = END; // left goal line
  const g1 = END + pitchW; // right goal line
  const cx = (g0 + g1) / 2;
  const gy = FRONT_UP; // the ground line
  const top = gy - BAND_TOP;
  const bot = gy + BAND_BOT;
  const bandH = bot - top;
  // low-angle perspective: lines running toward the viewer lean outward
  const P = (x: number, d: number): Pt => [x + ((x - cx) / pitchW) * 24 * d, top + d * bandH];

  // the turf slab (a little wider than the lines)
  const slab = roundRectPts(g0 - 30, top, pitchW + 60, bandH, 9);
  S.shape(ctx, slab, { base: '#5ec45c', shade: '#3f9a45', light: '#8ee07a' }, 2000, { lw: 1, light: [cx, top + 3] });
  ctx.save();
  path(ctx, slab);
  ctx.clip();
  // mowed stripes
  const stripes = 14;
  const sw = (pitchW + 80) / stripes;
  for (let i = 0; i < stripes; i++) {
    const a = g0 - 40 + i * sw;
    ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.10)' : 'rgba(0,40,0,0.08)';
    path(ctx, [P(a, 0), P(a + sw, 0), P(a + sw, 1), P(a, 1)]);
    ctx.fill();
  }
  // depth shading: lighter far edge, a touch darker near the front
  const g = ctx.createLinearGradient(0, top, 0, bot);
  g.addColorStop(0, 'rgba(255,255,230,0.25)');
  g.addColorStop(0.5, 'rgba(255,255,255,0)');
  g.addColorStop(1, 'rgba(0,50,20,0.16)');
  ctx.fillStyle = g;
  ctx.fillRect(g0 - 40, top, pitchW + 80, bandH);

  // the white lines
  ctx.strokeStyle = 'rgba(255,255,255,0.92)';
  ctx.lineWidth = 1.3;
  ctx.lineJoin = 'round';
  const line = (pts: Pt[], close = false) => {
    path(ctx, pts, close);
    ctx.stroke();
  };
  const dFar = 0.1;
  const dNear = 0.93;
  // touchlines + goal lines (the outline of the field)
  line([P(g0, dFar), P(g1, dFar), P(g1, dNear), P(g0, dNear)], true);
  // halfway line + centre circle + spot
  line([P(cx, dFar), P(cx, dNear)]);
  const ell = (x: number, d: number, rx: number, rd: number, a0 = 0, a1 = Math.PI * 2): Pt[] => {
    const pts: Pt[] = [];
    for (let i = 0; i <= 40; i++) {
      const a = a0 + ((a1 - a0) * i) / 40;
      pts.push(P(x + Math.cos(a) * rx, d + Math.sin(a) * rd));
    }
    return pts;
  };
  line(ell(cx, 0.52, pitchW * 0.075, 0.3));
  const spot = (x: number, d: number) => {
    const [px, py] = P(x, d);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(px, py, 1.8, 0.9, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  spot(cx, 0.52);
  // penalty boxes, goal areas, penalty spots + arcs, corner arcs
  const box = pitchW * 0.15;
  const six = pitchW * 0.055;
  for (const [gl, dir] of [[g0, 1], [g1, -1]] as const) {
    line([P(gl, 0.17), P(gl + dir * box, 0.17), P(gl + dir * box, 0.84), P(gl, 0.84)]);
    line([P(gl, 0.3), P(gl + dir * six, 0.3), P(gl + dir * six, 0.66), P(gl, 0.66)]);
    spot(gl + dir * box * 0.7, 0.52);
    // the "D" outside the box
    line(ell(gl + dir * box * 0.7, 0.52, box * 0.55, 0.2, dir > 0 ? -0.95 : Math.PI - 0.95, dir > 0 ? 0.95 : Math.PI + 0.95));
    for (const d of [dFar, dNear]) {
      const down = d < 0.5 ? 1 : -1;
      line(ell(gl, d, 8, 0.06, dir > 0 ? (down > 0 ? 0 : -Math.PI / 2) : down > 0 ? Math.PI / 2 : Math.PI, dir > 0 ? (down > 0 ? Math.PI / 2 : 0) : down > 0 ? Math.PI : (Math.PI * 3) / 2));
    }
  }
  ctx.restore();
  // a soft grassy lip along the front edge
  for (let x = g0 - 22; x < g1 + 22; x += 8) {
    const r = 3 + ((x * 7) % 5) * 0.45;
    S.shape(ctx, ellipsePts(x, bot - 0.5, r, r * 0.55, 0, 12), { base: '#5ec45c', shade: '#3f9a45', light: '#8ee07a' }, 2100 + x, { lw: 0.6, plain: true });
  }

  // corner flags (far ones first, then the goals, then the near flags on top)
  const flag = (x: number, d: number, h: number, seed: number, dir: number) => {
    const [fx, fy] = P(x, d);
    S.line(ctx, [[fx, fy], [fx, fy - h]], seed, 1.6, '#f4f1ea');
    const wave: Pt[] = [
      [fx, fy - h],
      [fx + dir * h * 0.42, fy - h + h * 0.1],
      [fx + dir * h * 0.38, fy - h + h * 0.26],
      [fx, fy - h + h * 0.3],
    ];
    S.shape(ctx, wave, { base: '#ffd23f', shade: '#e0a91c', light: '#fff2a8' }, seed + 1, { lw: 0.7 });
    ctx.fillStyle = '#e8463f';
    path(ctx, [wave[0], [(wave[0][0] + wave[1][0]) / 2, (wave[0][1] + wave[1][1]) / 2], [(wave[0][0] + wave[3][0]) / 2 + dir * 3, (wave[0][1] + wave[3][1]) / 2]]);
    ctx.fill();
  };
  flag(g0, dFar, 22, 2200, 1);
  flag(g1, dFar, 22, 2210, -1);

  // the goals: a frame on the goal line, the net box behind it
  for (const [gl, dir] of [[g0, 1], [g1, -1]] as const) {
    const far = P(gl, 0.24);
    const near = P(gl, 0.6);
    const fh = 48; // far post height (a bit shorter: further away)
    const nh = 54;
    const back = 30 * -dir; // net depth (away from the pitch)
    const farTop: Pt = [far[0], far[1] - fh];
    const nearTop: Pt = [near[0], near[1] - nh];
    const bFar: Pt = [far[0] + back, far[1]];
    const bNear: Pt = [near[0] + back, near[1]];
    const bFarTop: Pt = [far[0] + back * 0.6, far[1] - fh * 0.78];
    const bNearTop: Pt = [near[0] + back * 0.6, near[1] - nh * 0.78];
    // net panels (back, roof, side), a soft white fill + mesh
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    path(ctx, [farTop, nearTop, bNearTop, bFarTop]);
    ctx.fill();
    path(ctx, [bFarTop, bNearTop, bNear, bFar]);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.lineWidth = 0.55;
    const lerp = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const mesh = (a: Pt, b: Pt, c: Pt, d: Pt, nu: number, nv: number) => {
      for (let i = 0; i <= nu; i++) line([lerp(a, b, i / nu), lerp(d, c, i / nu)]);
      for (let j = 0; j <= nv; j++) line([lerp(a, d, j / nv), lerp(b, c, j / nv)]);
    };
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    mesh(bFarTop, bNearTop, bNear, bFar, 6, 6); // back
    mesh(farTop, nearTop, bNearTop, bFarTop, 6, 3); // roof
    mesh(farTop, bFarTop, bFar, far, 3, 6); // far side
    // back frame (thin)
    S.line(ctx, [bFarTop, bNearTop, bNear], 2300 + gl, 0.7, '#c9c4d2');
    S.line(ctx, [bFarTop, bFar], 2301 + gl, 0.7, '#c9c4d2');
    // the near side net over the top
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    mesh(nearTop, bNearTop, bNear, near, 3, 6);
    // front frame: far post, crossbar, near post
    const pw = 3.2;
    S.shape(ctx, roundRectPts(far[0] - pw / 2, farTop[1], pw, fh, 1.2), POST, 2310 + gl, { lw: 0.7 });
    S.shape(ctx, [[farTop[0] - 1, farTop[1] - 1.6], [nearTop[0] + 1, nearTop[1] - 1.6], [nearTop[0] + 1, nearTop[1] + 1.6], [farTop[0] - 1, farTop[1] + 1.6]], POST, 2311 + gl, { lw: 0.7 });
    S.shape(ctx, roundRectPts(near[0] - pw / 2, nearTop[1], pw, nh, 1.2), POST, 2312 + gl, { lw: 0.7 });
  }
  flag(g0, dNear, 30, 2220, 1);
  flag(g1, dNear, 30, 2230, -1);
}

/** Behind the players: LED ad boards along the far touchline and two floodlight towers. */
export function drawPitchBack(ctx: Ctx, pitchW: number) {
  const S = st();
  const { END, BACK_UP } = PITCH;
  const g0 = END;
  const g1 = END + pitchW;
  const gy = BACK_UP;

  // floodlight towers beyond each goal
  for (const [tx, dir] of [[g0 - 58, 1], [g1 + 58, -1]] as const) {
    const topY = gy - 236;
    // lattice mast
    S.shape(ctx, [[tx - 6, gy], [tx + 6, gy], [tx + 2.5, topY + 26], [tx - 2.5, topY + 26]], STEEL, 2400 + tx, { lw: 0.9 });
    for (let y = gy - 14; y > topY + 30; y -= 14) {
      const w = 2.5 + ((y - topY) / (gy - topY)) * 3.5;
      S.line(ctx, [[tx - w, y], [tx + w, y - 12]], 2410 + y, 0.6, STEEL.shade);
    }
    // the light bank, angled toward the pitch
    ctx.save();
    ctx.translate(tx, topY + 14);
    ctx.rotate(dir * 0.12);
    S.shape(ctx, roundRectPts(-22, -16, 44, 30, 3), { base: '#3a3f55', shade: '#24283a', light: '#5d6380' }, 2420 + tx, { lw: 1 });
    ctx.shadowColor = '#fffbe0';
    ctx.shadowBlur = 6;
    ctx.fillStyle = '#fffbe6';
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 4; c++) {
        ctx.beginPath();
        ctx.arc(-15 + c * 10, -8 + r * 8.5, 3.1, 0, Math.PI * 2);
        ctx.fill();
      }
    ctx.restore();
  }

  // ad boards on little legs, a step back from the far touchline
  const bx0 = g0 - 34;
  const bx1 = g1 + 34;
  const bTop = gy - 30;
  const bBot = gy - 8;
  S.shape(ctx, roundRectPts(bx0, bTop, bx1 - bx0, bBot - bTop, 3), { base: '#1a1724', shade: '#0e0c14', light: '#33303f' }, 2500, { lw: 1 });
  const panelW = 96;
  const n = Math.max(2, Math.round((bx1 - bx0 - 8) / panelW));
  const pw = (bx1 - bx0 - 8) / n;
  for (let i = 0; i < n; i++) {
    const ad = ADS[i % ADS.length];
    const x = bx0 + 4 + i * pw;
    ctx.save();
    ctx.shadowColor = ad.bg;
    ctx.shadowBlur = 6;
    ctx.fillStyle = ad.bg;
    ctx.fillRect(x + 1, bTop + 3, pw - 2, bBot - bTop - 6);
    ctx.restore();
    const sheen = ctx.createLinearGradient(0, bTop + 3, 0, bBot - 3);
    sheen.addColorStop(0, 'rgba(255,255,255,0.25)');
    sheen.addColorStop(0.5, 'rgba(255,255,255,0)');
    sheen.addColorStop(1, 'rgba(0,0,0,0.15)');
    ctx.fillStyle = sheen;
    ctx.fillRect(x + 1, bTop + 3, pw - 2, bBot - bTop - 6);
    ctx.font = `400 10px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = ad.fg;
    ctx.fillText(ad.text, x + pw / 2, (bTop + bBot) / 2 + 0.5, pw - 10);
    // LED dots
    ctx.fillStyle = 'rgba(0,0,0,0.14)';
    for (let lx = x + 1; lx < x + pw - 1; lx += 2.4) ctx.fillRect(lx, bTop + 3, 0.6, bBot - bTop - 6);
  }
  for (let x = bx0 + 10; x < bx1; x += 60) S.line(ctx, [[x, bBot], [x, gy - 2]], 2600 + x, 1.2, '#4a4658');
}
