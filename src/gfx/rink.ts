import type { Ctx } from './draw';
import { STYLES, ellipsePts, roundRectPts, type Fill, type Pt } from './handdrawn';

/**
 * The mini hockey arena on the frozen pond (Part 2): a little grandstand of
 * puffball fans behind the glass, white dasher boards with ads and a yellow
 * kick plate, steel posts holding an arched lighting truss with floodlights
 * and a centre-hung scoreboard — plus the ice sheet itself with real rink
 * markings. Polished hand-drawn style.
 */
const st = () => STYLES.polished;
const FONT = '"Lilita One", "Arial Black", sans-serif';

/** Rink sizes (world px). The back texture is W × (ABOVE + BELOW), ground at y = ABOVE. */
export const RINK = { END: 64, ABOVE: 236, BELOW: 4, ICE_UP: 8, ICE_DOWN: 22 };

const STEEL: Fill = { base: '#9aa3be', shade: '#6c7593', light: '#d3d9ea' };
const BOARD: Fill = { base: '#fbfcff', shade: '#d7dfec', light: '#ffffff' };
const RAIL: Fill = { base: '#2f6fd6', shade: '#1d4ea6', light: '#7aa8f0' };
const KICK: Fill = { base: '#f2c230', shade: '#c9971a', light: '#ffe17a' };

const ADS = [
  { text: 'PUFF COLA', bg: '#c8102e', fg: '#ffffff' },
  { text: 'NUGGIE HUT', bg: '#ffb627', fg: '#4a2a05' },
  { text: 'FROSTY POPS', bg: '#2fa8d6', fg: '#ffffff' },
  { text: 'MADE BY HENRY & NEIL', bg: '#5a2aa6', fg: '#ffd23f' },
  { text: 'ROOT BEER', bg: '#5a2a10', fg: '#ffe2b0' },
];

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function fillPoly(ctx: Ctx, pts: Pt[], color: string | CanvasGradient) {
  ctx.fillStyle = color;
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fill();
}

/** A cheering puffball fan in the stands: round fuzzy head, googly eyes, maybe arms up. */
function fan(ctx: Ctx, x: number, y: number, r: number, color: string, rand: () => number, seed: number) {
  const S = st();
  const up = rand() < 0.4;
  if (up) {
    S.line(ctx, [[x - r * 0.8, y + r * 0.3], [x - r * 1.5, y - r * 0.9]], seed + 1, 1.6, color);
    S.line(ctx, [[x + r * 0.8, y + r * 0.3], [x + r * 1.5, y - r * 0.9]], seed + 2, 1.6, color);
  }
  S.shape(ctx, ellipsePts(x, y, r, r * 0.95, 0, 18), { base: color, shade: color, light: '#ffffff' }, seed, { lw: 0.7, light: [x - r * 0.3, y - r * 0.4] });
  ctx.fillStyle = '#ffffff';
  for (const ex of [-0.35, 0.35]) {
    ctx.beginPath();
    ctx.arc(x + ex * r, y - r * 0.15, r * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#2a2233';
  for (const ex of [-0.35, 0.35]) {
    ctx.beginPath();
    ctx.arc(x + ex * r + (rand() - 0.5) * r * 0.2, y - r * 0.12, r * 0.14, 0, Math.PI * 2);
    ctx.fill();
  }
  if (rand() < 0.5) {
    // a happy open mouth
    ctx.fillStyle = '#7a2a3a';
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.42, r * 0.22, r * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // team scarf
  if (rand() < 0.45) {
    ctx.fillStyle = rand() < 0.5 ? '#2f6fd6' : '#e8463f';
    ctx.fillRect(x - r * 0.8, y + r * 0.7, r * 1.6, r * 0.38);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - r * 0.2, y + r * 0.7, r * 0.4, r * 0.38);
  }
}

/**
 * Everything behind the players. rinkW = ice length; the texture is
 * rinkW + 2·END wide, the ice runs from x = END to END + rinkW, ground at y = gy.
 */
export function drawRinkBack(ctx: Ctx, rinkW: number) {
  const S = st();
  const { END } = RINK;
  const gy = RINK.ABOVE;
  const x0 = END;
  const x1 = END + rinkW;
  const cx = (x0 + x1) / 2;
  const rand = rng(77);

  // ── the grandstand ──
  const standTop = gy - 132;
  const standBot = gy - 26;
  const sx0 = x0 - 10;
  const sx1 = x1 + 10;
  S.shape(ctx, [[sx0 + 30, standTop], [sx1 - 30, standTop], [sx1, standBot + 4], [sx0, standBot + 4]], { base: '#2c3a6e', shade: '#1d2852', light: '#41539a' }, 1001, { lw: 1 });
  // top banner rail
  S.shape(ctx, roundRectPts(sx0 + 26, standTop - 9, sx1 - sx0 - 52, 11, 3), { base: '#e8463f', shade: '#b52c27', light: '#ff8a80' }, 1002, { lw: 0.9 });
  ctx.font = `400 9px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  const chant = '★ GO PUFFS GO ★ FROZEN POND FACE-OFF ★ GO PUFFS GO ★';
  ctx.fillText(chant, cx, standTop - 3.2, sx1 - sx0 - 70);
  // rows of seats with fans in them
  const rows = 6;
  const FANS = ['#f0c58f', '#ffb3c7', '#9fe8c8', '#c9b3ff', '#ffe17a', '#8fd0ff', '#ffffff', '#f7a072'];
  for (let r = rows - 1; r >= 0; r--) {
    const y = standBot - 8 - r * 16;
    const inset = (r / rows) * 30;
    const a = sx0 + 6 + inset;
    const b = sx1 - 6 - inset;
    // seat back row
    fillPoly(ctx, [[a, y - 3], [b, y - 3], [b, y + 4], [a, y + 4]], r % 2 ? '#3d58a6' : '#4864b4');
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(a, y - 3, b - a, 1.2);
    for (let x = a + 8 + rand() * 8; x < b - 8; x += 15 + rand() * 9) {
      if (rand() < 0.22) continue; // an empty seat
      fan(ctx, x, y - 6, 5.6 + rand() * 1.2, FANS[Math.floor(rand() * FANS.length)], rand, 1100 + Math.floor(x) + r * 7);
    }
  }

  // ── steel posts + the arched lighting truss ──
  const px0 = x0 - 34;
  const px1 = x1 + 34;
  const postTop = gy - 196;
  for (const px of [px0, px1]) {
    S.shape(ctx, roundRectPts(px - 4, postTop, 8, gy - postTop + 2, 2), STEEL, 1200 + px, { lw: 0.9, light: [px - 2, postTop + 30] });
    S.shape(ctx, roundRectPts(px - 8, gy - 6, 16, 8, 2), STEEL, 1210 + px, { lw: 0.8 });
  }
  const arch = (t: number, dy: number): Pt => [px0 + (px1 - px0) * t, postTop + dy - Math.sin(t * Math.PI) * 30];
  const N = 40;
  const topChord: Pt[] = [];
  const botChord: Pt[] = [];
  for (let i = 0; i <= N; i++) {
    topChord.push(arch(i / N, 0));
    botChord.push(arch(i / N, 11));
  }
  // web (zig-zag)
  for (let i = 0; i < N; i++) S.line(ctx, [topChord[i], botChord[i + 1]], 1300 + i, 0.9, '#7d87a6');
  S.line(ctx, topChord, 1290, 2.6);
  S.line(ctx, topChord, 1290, 1.6, STEEL.light);
  S.line(ctx, botChord, 1291, 2.6);
  S.line(ctx, botChord, 1291, 1.6, STEEL.base);

  // ── floodlights + their beams down onto the ice ──
  for (const t of [0.14, 0.32, 0.68, 0.86]) {
    const [lx, ly0] = arch(t, 11);
    const ly = ly0 + 4;
    const beam = ctx.createLinearGradient(0, ly, 0, gy - 20);
    beam.addColorStop(0, 'rgba(255,250,215,0.34)');
    beam.addColorStop(1, 'rgba(255,250,215,0)');
    fillPoly(ctx, [[lx - 6, ly + 6], [lx + 6, ly + 6], [lx + 46, gy - 20], [lx - 46, gy - 20]], beam);
    S.shape(ctx, roundRectPts(lx - 9, ly - 2, 18, 9, 2.5), { base: '#3a3f55', shade: '#24283a', light: '#5d6380' }, 1400 + t * 100, { lw: 0.9 });
    ctx.save();
    ctx.shadowColor = '#fff6c0';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#fffbe6';
    ctx.beginPath();
    ctx.ellipse(lx, ly + 7, 7, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ── the centre-hung scoreboard ──
  const [, archMid] = arch(0.5, 11);
  const sbW = 92;
  const sbH = 40;
  const sbY = archMid + 22;
  for (const dx of [-30, 30]) S.line(ctx, [[cx + dx, archMid], [cx + dx, sbY]], 1500 + dx, 0.8, '#5a6078');
  S.shape(ctx, roundRectPts(cx - sbW / 2, sbY, sbW, sbH, 4), { base: '#262a3a', shade: '#171a26', light: '#3e4460' }, 1510, { lw: 1 });
  S.shape(ctx, roundRectPts(cx - sbW / 2 + 4, sbY + 3, sbW - 8, 9, 2), { base: '#2f6fd6', shade: '#1d4ea6', light: '#7aa8f0' }, 1511, { lw: 0.6, plain: true });
  ctx.font = `400 8px ${FONT}`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText('PUFF PUCK CUP', cx, sbY + 8, sbW - 12);
  ctx.font = `400 7px ${FONT}`;
  ctx.fillStyle = '#cfd6ff';
  ctx.fillText('HOME', cx - 24, sbY + 18);
  ctx.fillText('AWAY', cx + 24, sbY + 18);
  ctx.save();
  ctx.font = `400 15px ${FONT}`;
  ctx.shadowColor = '#ff5a3c';
  ctx.shadowBlur = 5;
  ctx.fillStyle = '#ff7a4a';
  ctx.fillText('3', cx - 24, sbY + 30);
  ctx.fillText('2', cx + 24, sbY + 30);
  ctx.shadowColor = '#ffd23f';
  ctx.fillStyle = '#ffd23f';
  ctx.font = `400 9px ${FONT}`;
  ctx.fillText('3RD', cx, sbY + 21);
  ctx.fillText('0:42', cx, sbY + 32);
  ctx.restore();

  // ── the glass ──
  const gTop = gy - 78;
  const gBot = gy - 28;
  ctx.save();
  ctx.beginPath();
  const gl = roundRectPts(x0 - 18, gTop, rinkW + 36, gBot - gTop + 4, 10);
  gl.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fillStyle = 'rgba(205,232,255,0.30)';
  ctx.fill();
  ctx.clip();
  // reflections
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  for (let x = x0 - 40; x < x1 + 40; x += 70 + (x % 3) * 9) fillPoly(ctx, [[x, gBot], [x + 10, gBot], [x + 34, gTop], [x + 24, gTop]], 'rgba(255,255,255,0.22)');
  ctx.restore();
  S.line(ctx, [[x0 - 8, gTop], [x1 + 8, gTop]], 1600, 1.2, 'rgba(255,255,255,0.9)');
  // glass stanchions
  for (let x = x0 - 8, i = 0; x <= x1 + 8; x += (rinkW + 16) / Math.round((rinkW + 16) / 88), i++)
    S.shape(ctx, roundRectPts(x - 1.5, gTop - 1, 3, gBot - gTop + 2, 1), { base: '#e8edf6', shade: '#b6bfd2', light: '#ffffff' }, 1610 + i, { lw: 0.6, plain: true });

  // ── the dasher boards ──
  const bTop = gy - 30;
  const bBot = gy - 3;
  S.shape(ctx, roundRectPts(x0 - 22, bTop, rinkW + 44, bBot - bTop, 12), BOARD, 1700, { lw: 1.1, light: [cx, bTop + 4] });
  // ad panels
  const panelW = 92;
  const n = Math.max(1, Math.floor((rinkW - 40) / (panelW + 26)));
  const gap = (rinkW - n * panelW) / (n + 1);
  for (let i = 0; i < n; i++) {
    const ad = ADS[i % ADS.length];
    const ax = x0 + gap + i * (panelW + gap);
    ctx.fillStyle = ad.bg;
    ctx.beginPath();
    ctx.roundRect(ax, bTop + 5, panelW, 12, 2);
    ctx.fill();
    ctx.font = `400 9px ${FONT}`;
    ctx.fillStyle = ad.fg;
    ctx.fillText(ad.text, ax + panelW / 2, bTop + 11.5, panelW - 8);
  }
  // yellow kick plate along the bottom, blue rail cap on top
  S.shape(ctx, roundRectPts(x0 - 20, bBot - 7, rinkW + 40, 6, 3), KICK, 1720, { lw: 0.8, plain: true });
  S.shape(ctx, roundRectPts(x0 - 22, bTop - 3, rinkW + 44, 5, 2.5), RAIL, 1730, { lw: 0.9, plain: true });
  // team benches' doors (little gaps in the boards)
  for (const dx of [-110, 70]) {
    const d = cx + dx;
    S.line(ctx, [[d, bTop + 2], [d, bBot - 7]], 1740 + dx, 0.6, '#b9c2d4');
    S.line(ctx, [[d + 40, bTop + 2], [d + 40, bBot - 7]], 1745 + dx, 0.6, '#b9c2d4');
  }
}

/**
 * The ice sheet in front (drawn just over the terrain's top edge): glossy ice
 * with the centre red line, blue lines, goal lines, creases and face-off
 * circles, seen at a low angle. Texture is (rinkW + 2·END) × (ICE_UP + ICE_DOWN),
 * ground at y = ICE_UP.
 */
export function drawRinkIce(ctx: Ctx, rinkW: number) {
  const S = st();
  const { END, ICE_UP, ICE_DOWN } = RINK;
  const x0 = END;
  const x1 = END + rinkW;
  const cx = (x0 + x1) / 2;
  const top = 0.5;
  const bot = ICE_UP + ICE_DOWN - 2;
  const slab = roundRectPts(x0 - 22, top, rinkW + 44, bot - top, 9);
  S.shape(ctx, slab, { base: '#e6f4ff', shade: '#bcd8ee', light: '#ffffff' }, 1800, { lw: 1, light: [cx, top + 3] });
  ctx.save();
  ctx.beginPath();
  slab.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.clip();
  // depth shading: brighter far edge, cooler toward the front
  const g = ctx.createLinearGradient(0, top, 0, bot);
  g.addColorStop(0, 'rgba(255,255,255,0.65)');
  g.addColorStop(0.5, 'rgba(255,255,255,0)');
  g.addColorStop(1, 'rgba(120,170,210,0.28)');
  ctx.fillStyle = g;
  ctx.fillRect(x0 - 30, top, rinkW + 60, bot - top);
  // lines running front-to-back lean outward a little toward the viewer
  const yy0 = top + 1;
  const yy1 = bot;
  const across = (x: number, w: number, color: string) => {
    const lean = ((x - cx) / rinkW) * 10;
    fillPoly(ctx, [[x - w / 2, yy0], [x + w / 2, yy0], [x + w / 2 + lean, yy1], [x - w / 2 + lean, yy1]], color);
  };
  across(cx, 4.5, 'rgba(225,50,50,0.85)');
  across(cx - rinkW * 0.17, 4.5, 'rgba(40,100,215,0.85)');
  across(cx + rinkW * 0.17, 4.5, 'rgba(40,100,215,0.85)');
  across(x0 + 24, 1.6, 'rgba(225,50,50,0.8)');
  across(x1 - 24, 1.6, 'rgba(225,50,50,0.8)');
  // goal creases
  for (const [gx, dir] of [[x0 + 24, 1], [x1 - 24, -1]] as const) {
    ctx.fillStyle = 'rgba(110,170,240,0.55)';
    ctx.beginPath();
    ctx.ellipse(gx, yy0 + 6, 20, 5.5, 0, dir > 0 ? -Math.PI / 2 : Math.PI / 2, dir > 0 ? Math.PI / 2 : (Math.PI * 3) / 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(225,50,50,0.8)';
    ctx.lineWidth = 0.9;
    ctx.stroke();
  }
  // centre circle + face-off circles (flattened by the low view)
  const ring = (x: number, y: number, rx: number, ry: number, color: string) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y, 2.2, 1, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  ring(cx, yy0 + 10, 34, 7, 'rgba(40,100,215,0.85)');
  for (const fx of [x0 + rinkW * 0.12, x1 - rinkW * 0.12]) {
    ring(fx, yy0 + 10, 26, 6, 'rgba(225,50,50,0.8)');
    // the little hash marks either side of the circle
    ctx.fillStyle = 'rgba(225,50,50,0.8)';
    for (const s of [-1, 1]) ctx.fillRect(fx + s * 26 - 0.6, yy0 + 3, 1.2, 3);
  }
  for (const fx of [cx - rinkW * 0.27, cx + rinkW * 0.27]) {
    ctx.fillStyle = 'rgba(225,50,50,0.8)';
    ctx.beginPath();
    ctx.ellipse(fx, yy0 + 10, 2.4, 1.1, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // a logo at centre ice
  ctx.save();
  ctx.translate(cx, yy0 + 10);
  ctx.scale(1, 0.24);
  ctx.fillStyle = 'rgba(90,42,166,0.35)';
  ctx.beginPath();
  ctx.arc(0, 0, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = `400 16px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText('PUFF', 0, 0);
  ctx.restore();
  // skate scratches + gloss streaks (reflections of the floodlights)
  const rand = rng(31);
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 0.5;
  for (let i = 0; i < 40; i++) {
    const x = x0 + rand() * rinkW;
    const y = yy0 + 2 + rand() * (yy1 - yy0 - 4);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 8 + rand() * 10, y - 1.5, x + 16 + rand() * 20, y + (rand() - 0.5) * 2);
    ctx.stroke();
  }
  for (const t of [0.14, 0.32, 0.68, 0.86]) {
    const lx = x0 - 34 + (rinkW + 68) * t;
    const r = ctx.createRadialGradient(lx, yy0 + 9, 0, lx, yy0 + 9, 26);
    r.addColorStop(0, 'rgba(255,255,250,0.75)');
    r.addColorStop(1, 'rgba(255,255,250,0)');
    ctx.save();
    ctx.translate(lx, yy0 + 9);
    ctx.scale(1, 0.25);
    ctx.translate(-lx, -(yy0 + 9));
    ctx.fillStyle = r;
    ctx.fillRect(lx - 30, yy0 + 9 - 30, 60, 60);
    ctx.restore();
  }
  ctx.restore();
  // the near edge of the ice slab: a little snow bank in front
  for (let x = x0 - 14; x < x1 + 14; x += 9) {
    const r = 3 + ((x * 7) % 5) * 0.5;
    S.shape(ctx, ellipsePts(x, bot - 0.5, r, r * 0.6, 0, 12), { base: '#ffffff', shade: '#dfe8f4', light: '#ffffff' }, 1900 + x, { lw: 0.6, plain: true });
  }
}
