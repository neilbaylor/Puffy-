import { rng, type Ctx } from './draw';
import { STYLES, ellipsePts, roundRectPts, type Fill, type Pt } from './handdrawn';
import { drawCrownIcon } from './fishing';

/**
 * King Bob's rematch (Boss 6): concept art, drawn like Boss 5's (src/gfx/fishing.ts) in world-ish
 * picture units, side on, bow to the left, the sea running off to the right (you cast off the stern).
 *
 *  - three bigger boats to choose from (BOATS6): a sport-fisher with a flybridge and a tuna tower,
 *    a chunky royal tug, a royal catamaran with her sail furled for the storm
 *  - the storm: the sky, heavy clouds, big dark swells, the near surface, rain in layers (each a
 *    tile that repeats, for a TileSprite scrolling down at its own speed), splashes, lightning
 *  - a fishing rod drawn on a canvas (the scene draws them live; the storyboard needs them still)
 */
const st = STYLES.polished;
const F = (base: string, shade: string, light: string): Fill => ({ base, shade, light });

const WHITE = F('#fbfbf7', '#d9dde0', '#ffffff');
const CREAM = F('#f6e7c4', '#dcc596', '#fff8e4');
const NAVY = F('#1f3a68', '#13264a', '#3c5c94');
const RED = F('#c8413a', '#9a2b26', '#e8685e');
const STEEL = F('#c9d1d8', '#8d98a2', '#f2f6f9');
const BLACK = F('#2a2d33', '#16181c', '#4c515a');
const GLASS = F('#2c4a66', '#1c3349', '#7fb2d6');
const TEAK = F('#b5773a', '#8a5426', '#dca36a');
const GOLD = F('#ffd23f', '#d9a316', '#fff2a8');
const PURPLE = F('#6a3fa0', '#4a2878', '#9a72d0');

/** Points along a quadratic curve (n steps, both ends in). */
const quad = (a: Pt, c: Pt, b: Pt, n = 16): Pt[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    const u = 1 - t;
    return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]];
  });
const path = (ctx: Ctx, pts: Pt[]) => {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
};
const line = (ctx: Ctx, pts: Pt[], w: number, col: string) => {
  ctx.strokeStyle = col;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  path(ctx, pts);
  ctx.stroke();
};
/** A stainless tube: a grey line with a bright highlight down it. */
const tube = (ctx: Ctx, pts: Pt[], w = 4) => {
  line(ctx, pts, w + 2, '#4b5560');
  line(ctx, pts, w, '#c9d1d8');
  line(
    ctx,
    pts.map(([x, y]) => [x - w * 0.18, y - w * 0.18]),
    w * 0.35,
    '#ffffff',
  );
};
/**
 * A polygon kept boxy for the polished style (which draws curves through the middles of the edges,
 * so a bare 4-point box comes out an oval): each corner pinned by points r along its two edges.
 */
const box = (pts: Pt[], r = 7): Pt[] =>
  pts.flatMap((v, i) => {
    const out: Pt[] = [];
    for (const o of [pts[(i + pts.length - 1) % pts.length], pts[(i + 1) % pts.length]]) {
      const d = Math.hypot(o[0] - v[0], o[1] - v[1]);
      const k = Math.min(r, d / 3) / d;
      out.push([v[0] + (o[0] - v[0]) * k, v[1] + (o[1] - v[1]) * k]);
    }
    return [out[0], v, out[1]];
  });
/** y on a polyline at x (the sheer, for things standing on the deck). */
const yAt = (pts: Pt[], x: number) => {
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    if ((x >= x0 && x <= x1) || (x <= x0 && x >= x1)) return x1 === x0 ? y0 : y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
  }
  return pts[x < pts[0][0] ? 0 : pts.length - 1][1];
};
/** Tinted glass in a frame: dark, a sky reflection at the top, two shine streaks. */
function glass(ctx: Ctx, pts: Pt[], seed: number, lw = 1.1) {
  st.shape(ctx, pts, GLASS, seed, { lw, plain: true });
  ctx.save();
  path(ctx, pts);
  ctx.closePath();
  ctx.clip();
  const ys = pts.map((p) => p[1]);
  const xs = pts.map((p) => p[0]);
  const top = Math.min(...ys);
  const bot = Math.max(...ys);
  const g = ctx.createLinearGradient(0, top, 0, bot);
  g.addColorStop(0, 'rgba(160,200,230,0.55)');
  g.addColorStop(0.45, 'rgba(160,200,230,0.08)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(Math.min(...xs), top, Math.max(...xs) - Math.min(...xs), bot - top);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineCap = 'round';
  for (let x = Math.min(...xs) + 24; x < Math.max(...xs); x += 120) {
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(x, bot + 4);
    ctx.lineTo(x + (bot - top) * 0.7, top - 4);
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + 14, bot + 4);
    ctx.lineTo(x + 14 + (bot - top) * 0.7, top - 4);
    ctx.stroke();
  }
  ctx.restore();
}
/** A red-and-white life ring (radius R). */
function lifeRing(ctx: Ctx, lx: number, ly: number, R: number) {
  for (let k = 0; k < 4; k++) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.arc(lx, ly, R + 1, (k * Math.PI) / 2, ((k + 1) * Math.PI) / 2);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = k % 2 ? '#fbfbf7' : RED.base;
    ctx.beginPath();
    ctx.arc(lx, ly, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = '#20406e';
  ctx.beginPath();
  ctx.arc(lx, ly, R * 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = st.ink;
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.arc(lx, ly, R, 0, Math.PI * 2);
  ctx.moveTo(lx + R * 0.5, ly);
  ctx.arc(lx, ly, R * 0.5, 0, Math.PI * 2);
  ctx.stroke();
}
/** A round porthole: a steel (or brass) ring, glass in it. */
function porthole(ctx: Ctx, x: number, y: number, r: number, seed: number, brass = false) {
  st.shape(ctx, ellipsePts(x, y, r, r, 0, 20), brass ? GOLD : STEEL, seed, { lw: 0.9, plain: true });
  st.shape(ctx, ellipsePts(x, y, r * 0.64, r * 0.64, 0, 16), GLASS, seed + 1, { lw: 0.4, plain: true });
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.arc(x - r * 0.22, y - r * 0.22, r * 0.18, 0, Math.PI * 2);
  ctx.fill();
}
/** A rod standing in a holder: the blank, its cork grip, a reel. */
function rackedRod(ctx: Ctx, x: number, y: number, a: number, len: number, col: string) {
  line(ctx, [[x, y], [x + Math.cos(a) * len, y + Math.sin(a) * len]], 3.2, '#22252c');
  line(ctx, [[x, y], [x + Math.cos(a) * 18, y + Math.sin(a) * 18]], 4.2, '#c89a5e');
  ctx.fillStyle = col;
  ctx.strokeStyle = '#22252c';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(x + Math.cos(a) * 24 + Math.cos(a + Math.PI / 2) * 6, y + Math.sin(a) * 24 + Math.sin(a + Math.PI / 2) * 6, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}
/** A boat's name in big letters (Lilita), leaning forward, a coloured drop shadow and a crown before it. */
function boatName(ctx: Ctx, text: string, x: number, y: number, size: number, col: string, shadow: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.transform(1, 0, -0.16, 1, 0, 0);
  ctx.font = `400 ${size}px "Lilita One", "Arial Black", sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillStyle = shadow;
  ctx.fillText(text, 2.5, 2.5);
  ctx.fillStyle = col;
  ctx.fillText(text, 0, 0);
  ctx.restore();
  drawCrownIcon(ctx, x - size * 0.55, y - size * 0.36, size * 0.6);
}

/**
 * The deck seen from a little above, between the near sheer and the far one (`d` higher, ramping in
 * from nothing at the bow): its colour, the inside of the far side, the far gunwale's cap.
 */
function deckBand(ctx: Ctx, sheer: Pt[], d: number, x0: number, ramp: number, deck: string, cap: string, inner = '#f2f4f5') {
  const far: Pt[] = sheer.map(([x, y]) => [x + 3, y - d * Math.min(1, Math.max(0, (x - x0) / ramp))]);
  ctx.fillStyle = deck;
  path(ctx, [...far, ...sheer.slice().reverse()]);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = inner;
  path(ctx, [...far, ...far.map(([x, y]): Pt => [x, y + 10]).reverse()]);
  ctx.closePath();
  ctx.fill();
  line(ctx, far.map(([x, y]) => [x, y + 11]), 3, 'rgba(40,50,70,0.2)');
  line(ctx, far, 5, '#3a2a20');
  line(ctx, far, 3.4, cap);
  return far;
}
/** Planks on a deck band (teak): fine seams across it. */
function planks(ctx: Ctx, sheer: Pt[], far: Pt[], from: number, to: number) {
  ctx.save();
  path(ctx, [...far.map(([x, y]): Pt => [x, y + 10]), ...sheer.slice().reverse()]);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = TEAK.base;
  ctx.fillRect(from, 0, to - from, 2000);
  ctx.strokeStyle = 'rgba(70,40,15,0.45)';
  ctx.lineWidth = 1;
  for (let k = 0; k < 6; k++) {
    ctx.beginPath();
    far.forEach(([x, y], i) => {
      const yy = y + 10 + (yAt(sheer, x) - y - 10) * (k / 6);
      if (x < from || x > to) return;
      i && x > from + 2 ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy);
    });
    ctx.stroke();
  }
  ctx.restore();
}
/** Draw a hull: fill, then `paint` (stripes, bottom paint) clipped inside, then the ink outline again. */
function hull(ctx: Ctx, pts: Pt[], fill: Fill, seed: number, light: Pt, paint: () => void) {
  st.shape(ctx, pts, fill, seed, { lw: 1.3, light });
  ctx.save();
  path(ctx, pts);
  ctx.closePath();
  ctx.clip();
  paint();
  ctx.restore();
  ctx.strokeStyle = st.ink;
  ctx.lineWidth = 2.6;
  ctx.lineJoin = 'round';
  path(ctx, pts);
  ctx.closePath();
  ctx.stroke();
}
/** A soft gloss streak along a hull (a band of white fading at its edges). */
function gloss(ctx: Ctx, x: number, y: number, w: number, h: number, a = 0.6) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.5, `rgba(255,255,255,${a})`);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
}

/**
 * A boat: its picture's size (units), the waterline, where the hero stands (x, feet y) and where
 * King Bob's bowl stands (x, the bottom of its stand), what she's called and what she is.
 */
export interface Boat6 {
  id: 'sport' | 'tug' | 'cat';
  name: string;
  kind: string;
  w: number;
  h: number;
  water: number;
  hero: Pt;
  king: Pt;
  draw: (ctx: Ctx) => void;
}

// ───────────────────────────────────────── A: the sport-fisher ──

const SA: Pt[] = [...quad([22, 318], [200, 394], [470, 424], 18), [880, 430], [1172, 436]];
/** (drawn in three parts, so the game can spread the drawing over frames behind its loading card) */
const SPORT_ON = 15;
const SPORT_W = 580;
function drawSport(ctx: Ctx) {
  for (const part of SPORT_PARTS) part(ctx);
}
function sportTop(ctx: Ctx) {
  const on = SPORT_ON;
  const far = deckBand(ctx, SA, 34, 22, 280, '#e3e8ec', TEAK.base);
  planks(ctx, SA, far, 860, 1172);
  // (the far side's transom edge)
  st.shape(ctx, box([[1168, 400], [1176, 400], [1176, 436], [1170, 436]]), F('#eef1f3', '#cfd5da', '#ffffff'), 2001, { lw: 0.8, plain: true });

  ctx.save();
  ctx.translate(0, -on);
  // ── up top: the outriggers, the tuna tower, the hardtop ──
  for (const [x0, y0, x1, y1, w] of [
    [690, 196, 1010, 44, 2.6],
    [712, 198, 1070, 4, 3.2],
  ] as const) {
    tube(ctx, [[x0, y0], [x1, y1]], w);
    line(ctx, [[x1 - 2, y1 + 4], [x1 + 20, y1 + 150], [x1 + 60, 330]], 0.9, 'rgba(255,255,255,0.75)');
  }
  // the tower: four legs from the hardtop up to the top station, rungs across them
  for (const [a, b, w] of [
    [[548, 190], [580, 66], 3.4],
    [[574, 190], [596, 66], 2.6],
    [[700, 190], [668, 66], 3.4],
    [[674, 190], [652, 66], 2.6],
  ] as [Pt, Pt, number][])
    tube(ctx, [a, b], w);
  for (const y of [158, 126, 96]) {
    const t = (190 - y) / 124;
    tube(ctx, [[548 + 32 * t, y], [700 - 32 * t, y]], 2.2);
  }
  // the top station: its rail, its little canopy, a whip antenna and the royal pennant
  tube(ctx, [[572, 66], [572, 40], [676, 40], [676, 66]], 2.6);
  tube(ctx, [[572, 54], [676, 54]], 2);
  st.shape(ctx, box([[560, 24], [570, 14], [680, 14], [690, 24], [680, 30], [568, 30]]), WHITE, 2002, { lw: 1, light: [580, 14] });
  ctx.fillStyle = NAVY.base;
  ctx.fillRect(566, 24, 118, 4);
  line(ctx, [[640, 14], [610, -60]], 1.8, '#e0e0e0');
  st.shape(ctx, box([[612, -58], [650, -50], [612, -40]], 3), F('#e8463f', '#b92f2a', '#ff7d70'), 2003, { lw: 0.7 });
  drawCrownIcon(ctx, 626, -49, 11);
  // the hardtop over the flybridge (on four posts), a radar dome, a blue light
  for (const x of [470, 520, 730, 770]) tube(ctx, [[x, 282], [x + (x < 600 ? -4 : 4), 206]], 2.6);
  st.shape(ctx, box([[444, 204], [458, 188], [778, 186], [796, 198], [786, 210], [450, 210]]), WHITE, 2004, { lw: 1.1, light: [470, 186] });
  ctx.fillStyle = NAVY.base;
  ctx.fillRect(450, 200, 340, 6);
  ctx.fillStyle = 'rgba(20,38,74,0.3)';
  ctx.fillRect(458, 210, 320, 5);
  st.shape(ctx, ellipsePts(500, 176, 28, 11, 0, 32), WHITE, 2005, { lw: 1 });
  st.shape(ctx, roundRectPts(488, 182, 24, 5, 2), STEEL, 2006, { lw: 0.5, plain: true });
  st.shape(ctx, ellipsePts(760, 180, 5, 4, 0, 12), F('#5fd7ff', '#2ea6d6', '#cff4ff'), 2007, { lw: 0.6, plain: true });

  ctx.restore();
}
function sportMid(ctx: Ctx) {
  const on = SPORT_ON;
  ctx.save();
  ctx.translate(0, -on);
  // ── the flybridge: its coaming (white, a navy stripe), the helm seats and screen peeping over ──
  for (const x of [560, 604]) {
    st.shape(ctx, roundRectPts(x, 252, 32, 36, 9), NAVY, 2010 + x, { lw: 1, light: [x + 6, 256] });
  }
  st.shape(ctx, box([[452, 284], [470, 262], [520, 258], [526, 284]]), F('#9fd0ea', '#6aa6c6', '#e6f6ff'), 2012, { lw: 1 });
  st.shape(ctx, box([[430, 322], [446, 290], [478, 280], [900, 280], [908, 296], [906, 324]]), WHITE, 2013, { lw: 1.1, light: [470, 284] });
  ctx.fillStyle = NAVY.base;
  path(ctx, [[440, 306], [906, 304], [906, 312], [438, 314]]);
  ctx.fill();
  tube(ctx, [[478, 278], [900, 276]], 2.2);
  lifeRing(ctx, 870, 296, 14);
  // (the overhang's shadow, out over the cockpit)
  ctx.fillStyle = 'rgba(20,30,50,0.28)';
  ctx.fillRect(818, 324, 88, 8);

  // ── the salon: white, raked forward, a band of dark glass wrapping round it ──
  st.shape(ctx, box([[330, yAt(SA, 330) + 2], [372, 350], [420, 322], [818, 322], [822, yAt(SA, 822) + 2]]), WHITE, 2020, { lw: 1.2, light: [400, 330] });
  glass(ctx, box([[386, 360], [424, 336], [804, 336], [806, 380], [394, 384]], 10), 2021);
  for (const x of [540, 672]) {
    ctx.fillStyle = '#f4f6f7';
    ctx.fillRect(x, 336, 8, 46);
    ctx.strokeStyle = st.ink;
    ctx.lineWidth = 0.8;
    ctx.strokeRect(x, 336, 8, 46);
  }
  ctx.fillStyle = NAVY.base;
  path(ctx, [[372, 396], [818, 392], [818, 400], [366, 404]]);
  ctx.fill();
  // the bow rail along the foredeck
  ctx.restore();
  const rail = quad([40, 286], [170, 346], [334, 384], 14);
  tube(ctx, rail, 2.6);
  for (const i of [2, 6, 10, 14]) tube(ctx, [rail[i], [rail[i][0] + 1, yAt(SA, rail[i][0])]], 2.2);

  // ── the cockpit: the fighting chair, rods in the holders ──
  ctx.save();
  ctx.translate(0, -on);
  const cx = 950;
  const dk = yAt(SA, cx);
  st.shape(ctx, roundRectPts(cx - 7, dk - 58, 14, 58, 4), STEEL, 2030, { lw: 1 });
  st.shape(ctx, ellipsePts(cx, dk - 2, 22, 5, 0, 20), STEEL, 2031, { lw: 0.9, plain: true });
  st.shape(ctx, roundRectPts(cx - 34, dk - 74, 68, 18, 7), WHITE, 2032, { lw: 1 });
  st.shape(ctx, roundRectPts(cx - 30, dk - 80, 58, 10, 5), NAVY, 2033, { lw: 0.9 });
  st.shape(ctx, roundRectPts(cx - 38, dk - 128, 20, 54, 8), NAVY, 2034, { lw: 1, light: [cx - 34, dk - 124] });
  tube(ctx, [[cx - 24, dk - 74], [cx - 26, dk - 58], [cx + 40, dk - 40], [cx + 46, dk - 18]], 2.4);
  st.shape(ctx, roundRectPts(cx + 36, dk - 22, 26, 6, 3), STEEL, 2035, { lw: 0.6, plain: true });
  for (const [x, a] of [
    [884, -1.9],
    [1150, -1.3],
    [1132, -1.2],
  ] as const)
    rackedRod(ctx, x, yAt(SA, x) - 2, a, 120, x > 1140 ? '#ffd23f' : '#e8463f');
  ctx.restore();

}
function sportHull(ctx: Ctx) {
  const W = SPORT_W;
  // ── the hull: navy, a gold cove stripe, a white boot stripe, red bottom paint ──
  const H: Pt[] = [...SA, [1168, W + 24], ...quad([1060, W + 30], [420, W + 34], [190, W + 16], 12), ...quad([190, W + 16], [52, W - 40], [22, 318], 14).slice(1)];
  const under = (d: number): Pt[] => SA.map(([x, y], i) => [x + (i < 18 ? d * 0.2 : 0), y + d]);
  hull(ctx, H, NAVY, 2040, [240, 440], () => {
    ctx.fillStyle = '#f4f6f7';
    ctx.fillRect(0, W - 18, 1200, 12);
    ctx.fillStyle = RED.base;
    ctx.fillRect(0, W - 6, 1200, 80);
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.fillRect(0, W + 10, 1200, 60);
    line(ctx, under(20), 4, GOLD.base);
    line(ctx, under(26), 1.4, GOLD.shade);
    const chine = quad([60, 430], [300, 530], [1172, 540], 20);
    ctx.fillStyle = 'rgba(0,0,10,0.25)';
    path(ctx, [...chine, [1200, W + 40], [0, W + 40]]);
    ctx.fill();
    line(ctx, chine, 2, 'rgba(140,170,220,0.55)');
    // the exhausts, aft
    for (const x of [1090, 1124]) st.shape(ctx, roundRectPts(x, 526, 20, 9, 4.5), BLACK, 2041 + x, { lw: 0.7, plain: true });
  });
  // the rub rail and the teak cap
  line(ctx, SA.map(([x, y]) => [x, y + 7]), 3, '#c9d1d8');
  line(ctx, SA, 7, '#5a3418');
  line(ctx, SA, 5, TEAK.base);
  boatName(ctx, 'REEL ROYAL II', 440, 500, 44, GOLD.base, '#0d1a30');
  for (const x of [150, 196, 242]) porthole(ctx, x, yAt(SA, x) + 44, 9, 2050 + x);
  st.shape(ctx, ellipsePts(34, 330, 4, 3, 0, 10), F('#e8463f', '#b92f2a', '#ff9a90'), 2060, { lw: 0.6, plain: true });
}

/** The sport-fisher (Boss 6's Reel Royal II) in drawing order: the deck, tower and hardtop; the flybridge, salon and cockpit; the hull. */
export const SPORT_PARTS: ((ctx: Ctx) => void)[] = [sportTop, sportMid, sportHull];

// ───────────────────────────────────────── B: the royal tug ──

const SB: Pt[] = [...quad([34, 344], [150, 404], [360, 424], 14), [1110, 432]];
function drawTug(ctx: Ctx) {
  const W = 560;
  const on = 15;
  const far = deckBand(ctx, SB, 34, 34, 240, '#9aa3a8', '#fbfbf7', '#e9e9e2');
  void far;
  ctx.save();
  ctx.translate(0, -on);
  // ── the mast behind the wheelhouse: a yardarm, the horn, a radar bar, the royal pennant ──
  tube(ctx, [[470, 180], [470, 34]], 4);
  tube(ctx, [[430, 80], [510, 80]], 2.6);
  st.shape(ctx, roundRectPts(422, 60, 96, 10, 5), F('#3d4a57', '#25303a', '#64748a'), 2101, { lw: 0.9 });
  st.shape(ctx, box([[478, 100], [500, 94], [500, 110], [478, 106]], 2), GOLD, 2102, { lw: 0.8 });
  st.shape(ctx, box([[472, 36], [516, 46], [472, 56]], 3), F('#e8463f', '#b92f2a', '#ff7d70'), 2103, { lw: 0.7 });
  drawCrownIcon(ctx, 488, 46, 13);
  // ── the funnel: gold, a navy band with a crown, a black top, smoke puffing off aft ──
  for (const [x, y, r, a] of [
    [640, 96, 20, 0.55],
    [690, 70, 28, 0.42],
    [752, 52, 34, 0.3],
  ] as const) {
    ctx.fillStyle = `rgba(110,115,125,${a})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.arc(x + r * 0.8, y + 6, r * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }
  const fun: Pt[] = box([[548, 302], [556, 136], [626, 128], [622, 302]], 5);
  st.shape(ctx, fun, GOLD, 2110, { lw: 1.2, light: [566, 150] });
  ctx.save();
  path(ctx, fun);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = NAVY.base;
  ctx.fillRect(540, 168, 100, 44);
  ctx.fillStyle = BLACK.base;
  ctx.fillRect(540, 120, 100, 20);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(562, 140, 6, 160);
  ctx.restore();
  drawCrownIcon(ctx, 588, 190, 30);
  // ── the deckhouse: cream, brass portholes, a red trim ──
  st.shape(ctx, box([[196, yAt(SB, 196) + 2], [206, 302], [652, 302], [660, yAt(SB, 660) + 2]]), CREAM, 2120, { lw: 1.2, light: [230, 306] });
  ctx.fillStyle = RED.base;
  ctx.fillRect(206, 302, 446, 8);
  for (let x = 260; x < 640; x += 64) porthole(ctx, x, 358, 12, 2121 + x, true);
  // a door, with a life ring by it
  st.shape(ctx, roundRectPts(574, 330, 40, 84, 6), F('#8e6a48', '#6b4a2e', '#b08a66'), 2130, { lw: 1 });
  porthole(ctx, 594, 352, 8, 2131, true);
  lifeRing(ctx, 534, 384, 16);
  // ── the wheelhouse on top: windows all round, leaning out; a navy visor; a big gold crown on the roof ──
  const wh: Pt[] = box([[236, 304], [222, 186], [512, 186], [500, 304]]);
  st.shape(ctx, wh, CREAM, 2140, { lw: 1.2, light: [250, 196] });
  for (let i = 0; i < 5; i++) {
    const x0 = 244 + i * 52;
    glass(ctx, box([[x0, 252], [x0 - 4, 202], [x0 + 42, 202], [x0 + 42, 252]], 6), 2141 + i, 1);
  }
  ctx.fillStyle = RED.base;
  ctx.fillRect(230, 268, 274, 8);
  st.shape(ctx, box([[208, 190], [212, 174], [522, 174], [528, 190]]), NAVY, 2150, { lw: 1.1 });
  // the searchlight, and the crown
  st.shape(ctx, roundRectPts(254, 152, 30, 22, 6), STEEL, 2151, { lw: 1 });
  st.shape(ctx, ellipsePts(254, 163, 5, 10, 0, 14), F('#fff6c2', '#e8d070', '#ffffff'), 2152, { lw: 0.8 });
  drawCrownIcon(ctx, 372, 140, 84);
  ctx.fillStyle = '#e8364a';
  for (const [x, y] of [[341, 128], [372, 112], [403, 128]] as const) {
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // ── the aft deck: the towing bitts, a coil of rope, the bulwark rail ──
  ctx.save();
  ctx.translate(0, -on);
  const dk = (x: number) => yAt(SB, x);
  for (const x of [690, 724]) st.shape(ctx, roundRectPts(x - 9, dk(x) - 46, 18, 46, 5), BLACK, 2160 + x, { lw: 1, light: [x - 5, dk(x) - 44] });
  st.shape(ctx, roundRectPts(676, dk(700) - 34, 62, 9, 4), BLACK, 2163, { lw: 0.9 });
  for (let k = 0; k < 3; k++) st.shape(ctx, ellipsePts(1072, dk(1072) - 8 - k * 5, 28 - k * 4, 7, 0, 24), F('#e8d9b0', '#c2ad7c', '#fff4d6'), 2164 + k, { lw: 0.8, plain: true });
  ctx.restore();
  for (const x of [680, 820, 960, 1100]) tube(ctx, [[x, dk(x) - 34], [x, dk(x)]], 2.4);
  tube(ctx, [[660, dk(660) - 34], [1104, dk(1104) - 34]], 2.6);

  // ── the hull: red, a black rubbing band, tyres hung all along, a fat black bow fender ──
  const H: Pt[] = [...SB, [1124, 446], ...quad([1128, 470], [1130, W + 12], [1050, W + 34], 8), ...quad([1050, W + 34], [600, W + 40], [200, W + 34], 10).slice(1), ...quad([200, W + 34], [36, W + 10], [34, 344], 14).slice(1)];
  hull(ctx, H, RED, 2170, [200, 440], () => {
    ctx.fillStyle = BLACK.base;
    ctx.fillRect(0, W - 18, 1200, 200);
    ctx.fillStyle = '#fbfbf7';
    ctx.fillRect(0, W - 22, 1200, 5);
    ctx.fillStyle = BLACK.base;
    path(ctx, [...SB.map(([x, y]): Pt => [x, y + 36]), ...SB.map(([x, y]): Pt => [x, y + 54]).reverse()]);
    ctx.closePath();
    ctx.fill();
    gloss(ctx, 260, 494, 760, 12, 0.22);
  });
  line(ctx, SB, 9, st.ink);
  line(ctx, SB, 7, '#fbfbf7');
  boatName(ctx, 'BIG BOB', 150, 525, 46, GOLD.base, '#5a120e');
  // the bow's fender: a fat black sausage round the stem, lashed on
  const stem = quad([46, 352], [26, 450], [78, 548], 12);
  line(ctx, stem, 30, st.ink);
  line(ctx, stem, 26, BLACK.base);
  line(ctx, stem.map(([x, y]) => [x - 5, y - 3]), 5, '#5a606a');
  for (const i of [2, 5, 8, 11]) {
    const [x, y] = stem[i];
    line(ctx, [[x - 12, y - 3], [x + 12, y + 3]], 2.4, '#e8d9b0');
  }
  // tyres on ropes all along the side
  for (const x of [250, 420, 590, 760, 930, 1080]) {
    const y = yAt(SB, x);
    line(ctx, [[x, y + 2], [x, y + 30]], 1.6, '#e8d9b0');
    st.shape(ctx, ellipsePts(x, y + 50, 17, 22, 0, 24), BLACK, 2180 + x, { lw: 1.1, light: [x - 6, y + 34] });
    st.shape(ctx, ellipsePts(x, y + 50, 7, 10, 0, 16), F('#101114', '#08090a', '#2a2d33'), 2181 + x, { lw: 0.8, plain: true });
  }
}

// ───────────────────────────────────────── C: the royal catamaran ──

const SC: Pt[] = [[40, 486], [1080, 494]];
function drawCat(ctx: Ctx) {
  const W = 620;
  const on = 15;
  // ── the far hull, a little up and behind (lighter), the trampoline net between the bows ──
  const farHull: Pt[] = box([[60, 450], [1100, 458], [1100, W - 26], [100, W - 26]], 12);
  st.shape(ctx, farHull, F('#e4e2ec', '#c9c5d6', '#f4f2fa'), 2201, { lw: 1.1 });
  ctx.fillStyle = PURPLE.shade;
  ctx.fillRect(64, 460, 1032, 10);
  const far = deckBand(ctx, SC, 30, 40, 40, '#e6e8ec', GOLD.base);
  // the trampoline: a dark net forward of the cabin
  ctx.save();
  path(ctx, [...far.map(([x, y]): Pt => [x, y + 10]), ...SC.slice().reverse()]);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = '#2e2a44';
  ctx.fillRect(40, 400, 270, 120);
  ctx.strokeStyle = 'rgba(200,190,230,0.45)';
  ctx.lineWidth = 1;
  for (let x = 30; x < 320; x += 10) {
    ctx.beginPath();
    ctx.moveTo(x, 440);
    ctx.lineTo(x + 40, 500);
    ctx.moveTo(x + 40, 440);
    ctx.lineTo(x, 500);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.translate(0, -on);
  // ── the rig: the mast, the stays, the boom with the sail furled in its purple cover ──
  line(ctx, [[520, 30], [56, 478]], 1.2, '#4b5560');
  line(ctx, [[520, 30], [870, 384]], 1, '#4b5560');
  line(ctx, [[520, 30], [430, 384]], 1, '#4b5560');
  tube(ctx, [[520, 386], [520, 26]], 7);
  tube(ctx, [[490, 196], [552, 196]], 2.6);
  // the masthead: a light, and the royal standard flying
  st.shape(ctx, box([[522, 16], [580, 26], [574, 42], [522, 40]], 3), PURPLE, 2210, { lw: 0.9 });
  drawCrownIcon(ctx, 548, 29, 16);
  st.shape(ctx, ellipsePts(520, 22, 5, 5, 0, 12), F('#ffffff', '#dddddd', '#ffffff'), 2211, { lw: 0.6, plain: true });
  // lazy jacks down to the boom
  for (const x of [600, 700, 800]) line(ctx, [[520, 160], [x, 318]], 0.8, '#6b7580');
  tube(ctx, [[520, 334], [910, 330]], 4);
  const sail: Pt[] = box([[528, 332], [540, 304], [600, 294], [890, 300], [904, 316], [900, 332]], 10);
  st.shape(ctx, sail, PURPLE, 2212, { lw: 1.2, light: [560, 300] });
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(560, 300, 300, 5);
  for (const x of [600, 680, 760, 840]) line(ctx, [[x, 296], [x - 4, 332]], 1.4, GOLD.shade);
  drawCrownIcon(ctx, 720, 316, 24);
  // ── the bimini over the cockpit: purple canvas on stainless posts, a gold fringe ──
  for (const x of [918, 1072]) tube(ctx, [[x, 480], [x, 262]], 2.6);
  st.shape(ctx, box([[896, 262], [916, 240], [1080, 242], [1100, 262], [1086, 272], [908, 272]]), PURPLE, 2220, { lw: 1.1, light: [930, 244] });
  for (let x = 912; x < 1088; x += 12) {
    ctx.fillStyle = GOLD.base;
    ctx.beginPath();
    ctx.arc(x, 276, 4, 0, Math.PI);
    ctx.fill();
  }
  // ── the cabin: white, big sweeping windows, a purple stripe ──
  st.shape(ctx, box([[300, 490], [358, 404], [404, 384], [900, 382], [904, 490]]), WHITE, 2230, { lw: 1.2, light: [400, 392] });
  glass(ctx, box([[366, 414], [408, 396], [890, 396], [890, 444], [374, 448]], 10), 2231);
  for (const x of [520, 640, 760]) {
    ctx.fillStyle = '#f4f6f7';
    ctx.fillRect(x, 396, 7, 50);
    ctx.strokeStyle = st.ink;
    ctx.lineWidth = 0.8;
    ctx.strokeRect(x, 396, 7, 50);
  }
  ctx.fillStyle = PURPLE.base;
  path(ctx, [[340, 462], [904, 458], [904, 468], [334, 472]]);
  ctx.fill();
  // the helm, at the cabin's back corner: a wheel
  ctx.strokeStyle = '#2a2d33';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(924, 430, 16, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  // stanchions and a rail round the bows
  for (const x of [60, 140, 220, 300]) tube(ctx, [[x, yAt(SC, x) - 30], [x, yAt(SC, x)]], 2.2);
  tube(ctx, [[56, yAt(SC, 56) - 30], [300, yAt(SC, 300) - 30]], 2.4);

  // ── the near hull: white, a purple sheer stripe and gold pinstripe, a slit of window, stern steps ──
  const H: Pt[] = [[40, 486], [1080, 494], [1080, 512], [1112, 512], [1112, 534], [1150, 534], [1150, W + 4], [1120, W + 20], ...quad([1060, W + 22], [500, W + 26], [90, W + 18], 10), [46, W - 4]];
  hull(ctx, H, WHITE, 2240, [160, 500], () => {
    ctx.fillStyle = PURPLE.base;
    ctx.fillRect(0, 496, 1200, 18);
    ctx.fillStyle = GOLD.base;
    ctx.fillRect(0, 517, 1200, 3);
    ctx.fillStyle = PURPLE.base;
    ctx.fillRect(0, W - 16, 1200, 10);
    ctx.fillStyle = '#2b2350';
    ctx.fillRect(0, W - 6, 1200, 60);
    gloss(ctx, 200, 536, 820, 16, 0.6);
  });
  glass(ctx, box([[150, 536], [400, 534], [396, 546], [154, 548]], 4), 2241, 0.9);
  boatName(ctx, 'CROWN JEWEL', 520, 588, 40, PURPLE.base, GOLD.base);
  line(ctx, SC, 5, '#5b6670');
  line(ctx, SC, 3, '#c9d1d8');
}

/** The three boats to choose from (picture units; drawn in the world at Boss 5's scale, 1.18). */
export const BOATS6: Boat6[] = [
  { id: 'sport', name: 'Reel Royal II', kind: 'Sport-fisher: flybridge and tuna tower', w: 1200, h: 660, water: 580, hero: [1080, 422], king: [858, 272], draw: drawSport },
  { id: 'tug', name: 'Big Bob', kind: 'Royal tug: wheelhouse, funnel, tyres all round', w: 1140, h: 620, water: 560, hero: [1000, 416], king: [830, 370], draw: drawTug },
  { id: 'cat', name: 'Crown Jewel', kind: 'Royal catamaran: two hulls, sail furled for the storm', w: 1180, h: 680, water: 620, hero: [1060, 476], king: [960, 476], draw: drawCat },
];
/** The king's dais on the tug (a red-carpeted step with gold edges), standing on the deck at x, the deck at y. */
export function drawDais(ctx: Ctx, x: number, y: number) {
  st.shape(ctx, roundRectPts(x - 66, y - 46, 132, 46, 4), F('#b02a4a', '#7e1834', '#e0567a'), 2190, { lw: 1.1, light: [x - 50, y - 44] });
  st.shape(ctx, roundRectPts(x - 72, y - 52, 144, 10, 3), GOLD, 2191, { lw: 1 });
  st.shape(ctx, roundRectPts(x - 72, y - 6, 144, 8, 3), GOLD, 2192, { lw: 1 });
  drawCrownIcon(ctx, x, y - 24, 24);
}

// ───────────────────────────────────────── the storm ──

/** The storm sky: slate at the top, a sickly grey-green glow at the horizon. Flash: lit up white-lilac. */
export const STORM_SKY: readonly (readonly [number, string])[] = [[0, '#1d2333'], [0.5, '#3a4458'], [0.85, '#5d6b74'], [1, '#7f8e86']];
export const STORM_SKY_FLASH: readonly (readonly [number, string])[] = [[0, '#6e6a9a'], [0.5, '#a9a8cf'], [0.85, '#d6d6ea'], [1, '#eef0f4']];
/** Under the water in the storm: murky green-blue, very dark down deep. */
export const STORM_DEEP: readonly (readonly [number, string])[] = [[0, '#2a6f80'], [0.35, '#1a4d66'], [1, '#081c30']];
/** The far sea: grey-green, darker nearer. */
export const STORM_FAR: readonly (readonly [number, string])[] = [[0, '#56686e'], [1, '#2c4a58']];

export function fillStops(ctx: Ctx, x: number, y: number, w: number, h: number, stops: readonly (readonly [number, string])[]) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  for (const [t, c] of stops) g.addColorStop(t, c);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
}

/**
 * A heavy storm cloud (w × h): a bank of round bumps, dark underneath, a paler rim catching the
 * light on top; `tone` 0 (far, paler, bluer) … 1 (near, darkest). `flash`: rims lit white.
 */
export function drawStormCloud(ctx: Ctx, w: number, h: number, seed: number, tone: number, flash = false) {
  const r = rng(seed);
  const n = 7;
  const bumps: [number, number, number][] = [];
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n;
    const rad = h * (0.26 + 0.22 * Math.sin(u * Math.PI)) * (0.8 + r() * 0.4);
    bumps.push([w * (0.08 + u * 0.84), h * 0.62 - rad * 0.55 + r() * h * 0.06, rad]);
  }
  const mix = (a: number[], b: number[], t: number) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;
  const base = flash ? mix([150, 150, 190], [96, 96, 136], tone) : mix([92, 102, 122], [40, 44, 60], tone);
  const top = flash ? '#f2f0ff' : mix([150, 160, 176], [96, 104, 124], tone);
  const under = flash ? mix([110, 110, 150], [60, 60, 96], tone) : mix([60, 66, 84], [22, 24, 36], tone);
  // (and a row of smaller bumps along the bottom: a lumpy, heavy belly, no flat edge)
  const belly: [number, number, number][] = [];
  for (let i = 0; i < n + 1; i++) {
    const u = i / n;
    belly.push([w * (0.12 + u * 0.76), h * 0.74, h * (0.12 + r() * 0.06)]);
  }
  const blob = (dy: number, k: number) => {
    ctx.beginPath();
    for (const [x, y, rad] of [...bumps, ...belly]) {
      ctx.moveTo(x + rad * k, y + dy);
      ctx.arc(x, y + dy, rad * k, 0, Math.PI * 2);
    }
    ctx.rect(w * 0.12, h * 0.4 + dy, w * 0.76, h * 0.34);
  };
  // the light rim on the top, the body, the dark belly
  ctx.fillStyle = top;
  blob(-4, 1);
  ctx.fill();
  ctx.fillStyle = base;
  blob(3, 0.97);
  ctx.fill();
  ctx.save();
  blob(3, 0.97);
  ctx.clip();
  const g = ctx.createLinearGradient(0, h * 0.4, 0, h);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, under);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/** Curtains of rain hanging from a far cloud down to the horizon (w × h): soft slanting streaks. */
export function drawRainCurtain(ctx: Ctx, w: number, h: number, seed: number, a = 0.22) {
  const r = rng(seed);
  for (let i = 0; i < 26; i++) {
    const x = r() * w;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, `rgba(150,160,175,${a})`);
    g.addColorStop(1, 'rgba(150,160,175,0)');
    ctx.strokeStyle = g;
    ctx.lineWidth = 6 + r() * 12;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + h * 0.18, h);
    ctx.stroke();
  }
}

/**
 * A band of swells (w wide, the band h deep, its crests along y = 0 … amp): rolling dark hills of
 * water, whitecaps blowing off their tops, streaks of foam down their faces. `tone` 0 far … 1 near.
 * It tiles across (the hills repeat every w).
 */
export function drawSwells(ctx: Ctx, w: number, h: number, amp: number, n: number, tone: number, seed: number, flash = false) {
  const r = rng(seed);
  const crest = (x: number) => amp * 0.5 - Math.cos((x / w) * Math.PI * 2 * n) * amp * 0.5 + Math.sin((x / w) * Math.PI * 2 * n * 2 + 1) * amp * 0.12;
  const mix = (a: number[], b: number[], t: number) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;
  const top = flash ? mix([170, 190, 200], [120, 150, 165], tone) : mix([82, 112, 118], [42, 96, 112], tone);
  const bot = flash ? mix([90, 110, 130], [50, 70, 95], tone) : mix([44, 70, 84], [18, 50, 70], tone);
  ctx.beginPath();
  ctx.moveTo(0, crest(0));
  for (let x = 0; x <= w; x += 4) ctx.lineTo(x, crest(x));
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, top);
  g.addColorStop(1, bot);
  ctx.fillStyle = g;
  ctx.fill();
  // whitecaps: a foam lip along each crest, spray blowing off it
  for (let k = 0; k < n; k++) {
    const x0 = ((k + 0.5) / n) * w;
    const span = (w / n) * (0.22 + r() * 0.12);
    ctx.strokeStyle = 'rgba(240,248,250,0.92)';
    ctx.lineWidth = 2 + tone * 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let x = x0 - span; x <= x0 + span; x += 3) x === x0 - span ? ctx.moveTo(x, crest(x) + 1) : ctx.lineTo(x, crest(x) + 1);
    ctx.stroke();
    ctx.fillStyle = 'rgba(240,248,250,0.7)';
    for (let i = 0; i < 6 + tone * 6; i++) {
      const x = x0 - span * 0.6 + r() * span * 1.4;
      ctx.beginPath();
      ctx.arc(x + r() * 10, crest(x) - 2 - r() * amp * 0.25, 1 + r() * (1.5 + tone * 2), 0, Math.PI * 2);
      ctx.fill();
    }
    // foam streaks trailing down the face
    ctx.strokeStyle = 'rgba(220,235,240,0.35)';
    ctx.lineWidth = 1.5 + tone;
    for (let i = 0; i < 3; i++) {
      const x = x0 - span * 0.5 + r() * span;
      ctx.beginPath();
      ctx.moveTo(x, crest(x) + 6 + i * 6);
      ctx.quadraticCurveTo(x + 20, crest(x) + 12 + i * 8, x + 46 + r() * 30, crest(x + 40) + 10 + i * 8);
      ctx.stroke();
    }
  }
}

/** The near surface in the storm, a tile that repeats across (512 × 90): a big swell with a foaming crest. */
export const STORM_WAVE = { w: 512, h: 90, top: 30 } as const;
export function drawStormWaveTile(ctx: Ctx, flash = false) {
  const W = STORM_WAVE.w;
  const y0 = STORM_WAVE.top;
  const wave = (x: number) => y0 + Math.sin((x / W) * Math.PI * 4) * 13 + Math.sin((x / W) * Math.PI * 12 + 1) * 3;
  ctx.beginPath();
  ctx.moveTo(0, wave(0));
  for (let x = 0; x <= W; x += 4) ctx.lineTo(x, wave(x));
  ctx.lineTo(W, STORM_WAVE.h);
  ctx.lineTo(0, STORM_WAVE.h);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, y0 - 16, 0, STORM_WAVE.h);
  g.addColorStop(0, flash ? '#cfe4ea' : '#5f9aa6');
  g.addColorStop(0.35, flash ? '#7fa6b4' : '#2f7486');
  // (fading out below: the cut-away under the surface shows through)
  g.addColorStop(0.62, flash ? 'rgba(78,118,144,0.7)' : 'rgba(31,90,114,0.7)');
  g.addColorStop(1, flash ? 'rgba(78,118,144,0)' : 'rgba(31,90,114,0)');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = '#f4fbfc';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let x = 0; x <= W; x += 4) x ? ctx.lineTo(x, wave(x) + 1) : ctx.moveTo(x, wave(x) + 1);
  ctx.stroke();
  // foam curling over at the tops of the swells, and lacy foam on the face
  ctx.fillStyle = 'rgba(244,251,252,0.9)';
  for (const xc of [W * 0.125 - 10, W * 0.625 - 10]) {
    for (let i = 0; i < 9; i++) {
      const x = xc - 30 + i * 9;
      ctx.beginPath();
      ctx.arc(x, wave(x) - 1 - Math.sin((i / 8) * Math.PI) * 5, 4 + Math.sin((i / 8) * Math.PI) * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.strokeStyle = 'rgba(244,251,252,0.4)';
  ctx.lineWidth = 2;
  for (let x = 10; x <= W; x += 38) {
    ctx.beginPath();
    ctx.moveTo(x, wave(x) + 14);
    ctx.quadraticCurveTo(x + 10, wave(x + 10) + 20, x + 24, wave(x + 24) + 16);
    ctx.stroke();
  }
}

/**
 * The rain, in layers: each is a tile of streaks (w × h, seamless both ways) that a TileSprite
 * scrolls down (and a touch sideways, the wind) at its own speed. Far: many fine short streaks,
 * faint and slow; near: a few long fat ones, bright and fast. Light mode uses only `mid`.
 */
export const RAIN_LAYERS = {
  far: { n: 120, len: 14, w: 1.1, a: 0.35, speed: 520, tile: 256, col: '200,210,225' },
  mid: { n: 46, len: 30, w: 1.8, a: 0.55, speed: 900, tile: 256, col: '215,228,240' },
  near: { n: 14, len: 64, w: 3.2, a: 0.7, speed: 1500, tile: 256, col: '230,240,250' },
} as const;
export type RainLayer = keyof typeof RAIN_LAYERS;
/** The wind: how far a streak leans sideways for each unit it falls. */
export const RAIN_SLANT = 0.22;
export function drawRainTile(ctx: Ctx, layer: RainLayer, seed: number, scale = 1) {
  const L = RAIN_LAYERS[layer];
  const S = L.tile;
  const r = rng(seed);
  ctx.lineCap = 'round';
  for (let i = 0; i < L.n; i++) {
    const x = r() * S;
    const y = r() * S;
    const len = L.len * (0.7 + r() * 0.6) * scale;
    const a = L.a * (0.6 + r() * 0.4);
    // (drawn again a tile over wherever it runs off an edge, so the tile repeats without a seam)
    for (const ox of [-S, 0, S])
      for (const oy of [-S, 0, S]) {
        const x0 = x + ox;
        const y0 = y + oy;
        if (x0 + len * RAIN_SLANT < 0 || x0 - 2 > S || y0 + len < 0 || y0 > S) continue;
        const g = ctx.createLinearGradient(x0, y0, x0 + len * RAIN_SLANT, y0 + len);
        g.addColorStop(0, `rgba(${L.col},0)`);
        g.addColorStop(1, `rgba(${L.col},${a})`);
        ctx.strokeStyle = g;
        ctx.lineWidth = L.w * scale;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x0 + len * RAIN_SLANT, y0 + len);
        ctx.stroke();
      }
  }
}
/** Fill a box with a rain layer's tile, repeated (as a TileSprite would), shifted by (ox, oy). */
export function fillRain(ctx: Ctx, x: number, y: number, w: number, h: number, layer: RainLayer, seed: number, ox = 0, oy = 0, scale = 1) {
  const S = RAIN_LAYERS[layer].tile * scale;
  const c = document.createElement('canvas');
  c.width = Math.ceil(S);
  c.height = Math.ceil(S);
  const t = c.getContext('2d')!;
  t.scale(scale, scale);
  drawRainTile(t, layer, seed, 1);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  for (let tx = x - S + (((ox % S) + S) % S); tx < x + w; tx += S) for (let ty = y - S + (((oy % S) + S) % S); ty < y + h; ty += S) ctx.drawImage(c, tx, ty, S, S);
  ctx.restore();
}

/**
 * A raindrop's splash on a hard deck (centred on where it hit, ~s wide): a little crown of drops
 * flicking up and out, a flat ring.
 */
export function drawDeckSplash(ctx: Ctx, x: number, y: number, s: number, a = 0.9) {
  ctx.save();
  ctx.strokeStyle = `rgba(235,245,255,${a})`;
  ctx.lineWidth = Math.max(1, s * 0.1);
  ctx.beginPath();
  ctx.ellipse(x, y, s * 0.5, s * 0.14, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(1, s * 0.09);
  for (const k of [-1, -0.45, 0.45, 1]) {
    ctx.beginPath();
    ctx.moveTo(x + k * s * 0.3, y - s * 0.04);
    ctx.quadraticCurveTo(x + k * s * 0.46, y - s * 0.4, x + k * s * 0.56, y - s * 0.46 + Math.abs(k) * s * 0.12);
    ctx.stroke();
  }
  ctx.fillStyle = `rgba(235,245,255,${a})`;
  for (const k of [-0.8, -0.2, 0.3, 0.9]) {
    ctx.beginPath();
    ctx.arc(x + k * s * 0.6, y - s * (0.6 - Math.abs(k) * 0.15), Math.max(0.8, s * 0.07), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
/** A raindrop hitting the sea: a ring spreading, a little jet of water bouncing up in the middle. */
export function drawSeaSplash(ctx: Ctx, x: number, y: number, s: number, a = 0.75) {
  ctx.save();
  ctx.strokeStyle = `rgba(225,240,245,${a})`;
  ctx.lineWidth = Math.max(1, s * 0.08);
  ctx.beginPath();
  ctx.ellipse(x, y, s * 0.55, s * 0.13, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = Math.max(0.8, s * 0.05);
  ctx.beginPath();
  ctx.ellipse(x, y, s * 0.3, s * 0.07, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(1.2, s * 0.1);
  ctx.beginPath();
  ctx.moveTo(x, y - s * 0.02);
  ctx.lineTo(x, y - s * 0.32);
  ctx.stroke();
  ctx.fillStyle = `rgba(225,240,245,${a})`;
  ctx.beginPath();
  ctx.arc(x, y - s * 0.44, Math.max(1, s * 0.08), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** A lightning bolt from (x0, y0) down to (x1, y1): jagged, branching, a white-hot core in a lilac glow. */
export function drawLightning(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, seed: number) {
  const r = rng(seed);
  const bolt = (ax: number, ay: number, bx: number, by: number, n: number, jit: number): Pt[] => {
    const pts: Pt[] = [[ax, ay]];
    for (let i = 1; i < n; i++) {
      const t = i / n;
      pts.push([ax + (bx - ax) * t + (r() - 0.5) * jit, ay + (by - ay) * t + (r() - 0.5) * jit * 0.3]);
    }
    pts.push([bx, by]);
    return pts;
  };
  const main = bolt(x0, y0, x1, y1, 11, 70);
  const branches: Pt[][] = [];
  for (const i of [3, 5, 7]) {
    const [bx, by] = main[i];
    branches.push(bolt(bx, by, bx + (r() < 0.5 ? -1 : 1) * (60 + r() * 70), by + 70 + r() * 60, 5, 28));
  }
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const g = ctx.createRadialGradient(x0 + (x1 - x0) * 0.4, y0 + (y1 - y0) * 0.4, 0, x0 + (x1 - x0) * 0.4, y0 + (y1 - y0) * 0.4, Math.abs(y1 - y0) * 0.8);
  g.addColorStop(0, 'rgba(230,220,255,0.35)');
  g.addColorStop(1, 'rgba(230,220,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x0 - 400, y0 - 100, 800, y1 - y0 + 200);
  for (const [w, col] of [
    [16, 'rgba(190,170,255,0.35)'],
    [8, 'rgba(220,210,255,0.7)'],
    [3.2, '#ffffff'],
  ] as const) {
    line(ctx, main, w, col);
    for (const b of branches) line(ctx, b, w * 0.55, col);
  }
  ctx.restore();
}

/**
 * A fishing rod, drawn on a canvas (the game draws them live with Phaser's graphics; this is the
 * same rod for stills): from the hands at angle `a`, `len` long, `bend` (0 … 1) pulling the tip
 * round, a reel under the hands. Returns the tip.
 */
export function drawRod(ctx: Ctx, hx: number, hy: number, a: number, len: number, bend: number, o: { king?: boolean; butt?: number; reel?: number } = {}) {
  const dir = { x: Math.cos(a), y: Math.sin(a) };
  const n = { x: -dir.y, y: dir.x };
  const butt = o.butt ?? (o.king ? 16 : 34);
  const tip = { x: hx + dir.x * len + n.x * bend * len * 0.32, y: hy + dir.y * len + n.y * bend * len * 0.32 };
  const b = { x: hx - dir.x * butt, y: hy - dir.y * butt };
  const mid = { x: hx + dir.x * len * 0.5, y: hy + dir.y * len * 0.5 };
  const P = (u: number) => {
    const q = 1 - u;
    return { x: q * q * b.x + 2 * q * u * mid.x + u * u * tip.x, y: q * q * b.y + 2 * q * u * mid.y + u * u * tip.y };
  };
  const N = 14;
  ctx.lineCap = 'round';
  for (const pass of [0, 1])
    for (let i = 0; i < N; i++) {
      const p0 = P(i / N);
      const p1 = P((i + 1) / N);
      const u = i / N;
      const w = o.king ? 5.4 - u * 4 : 6.2 - u * 4.8;
      ctx.strokeStyle = pass ? (u < 0.2 ? '#c89a5e' : o.king ? '#d9a316' : '#2b2f3a') : '#2a1a12';
      ctx.lineWidth = pass ? w : w + 2.4;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }
  ctx.fillStyle = '#dfe6ec';
  for (const u of [0.42, 0.62, 0.8, 0.94]) {
    const p = P(u);
    ctx.beginPath();
    ctx.arc(p.x - dir.y * 3, p.y + dir.x * 3, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
  const rc = { x: hx + dir.x * 10 - dir.y * 10, y: hy + dir.y * 10 + dir.x * 10 };
  const R = o.king ? 7.5 : 8.5;
  ctx.fillStyle = '#2a1a12';
  ctx.beginPath();
  ctx.arc(rc.x, rc.y, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = o.king ? '#ffd23f' : '#e8463f';
  ctx.beginPath();
  ctx.arc(rc.x, rc.y, R - 2, 0, Math.PI * 2);
  ctx.fill();
  const ha = o.reel ?? 0.6;
  line(ctx, [[rc.x, rc.y], [rc.x + Math.cos(ha) * 9, rc.y + Math.sin(ha) * 9]], 2.4, '#2a1a12');
  ctx.fillStyle = '#f2f2f2';
  ctx.beginPath();
  ctx.arc(rc.x + Math.cos(ha) * 9, rc.y + Math.sin(ha) * 9, 2.4, 0, Math.PI * 2);
  ctx.fill();
  return tip;
}

/** A fish hook (s tall), its point at (x, y), the eye up top: steel, a glint. */
export function drawHook(ctx: Ctx, x: number, y: number, s: number) {
  ctx.save();
  ctx.lineCap = 'round';
  for (const [w, c] of [
    [s * 0.2, st.ink],
    [s * 0.12, '#c9d1d8'],
  ] as const) {
    ctx.strokeStyle = c;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(x - s * 0.35, y - s);
    ctx.lineTo(x - s * 0.35, y - s * 0.25);
    ctx.arc(x - s * 0.1, y - s * 0.25, s * 0.25, Math.PI, 0, true);
    ctx.lineTo(x + s * 0.15, y - s * 0.45);
    ctx.stroke();
  }
  ctx.restore();
}

// ───────────────────────────────────────── for the game (Boss 6) ──

/** Clouds in a band: [x, y, w, h, seed, tone] (band units). */
export type CloudSpec = readonly (readonly [number, number, number, number, number, number])[];
/**
 * A band of storm clouds that tiles across (w wide, so a TileSprite can run it the length of the
 * world): each cloud drawn again a band's width to the left and right, so whatever hangs off one
 * end comes back in at the other. `curtains`: rain hanging off the band's underside (the far band).
 */
export function drawCloudBand(ctx: Ctx, w: number, h: number, clouds: CloudSpec, flash = false, curtains: readonly (readonly [number, number])[] = []) {
  for (const [x, s] of curtains)
    for (const ox of [-w, 0, w]) {
      if (x + ox > w || x + ox + 340 < 0) continue;
      ctx.save();
      ctx.translate(x + ox, h * 0.45);
      drawRainCurtain(ctx, 300, h * 0.55, s, flash ? 0.35 : 0.22);
      ctx.restore();
    }
  for (const [x, y, cw, ch, seed, tone] of clouds)
    for (const ox of [-w, 0, w]) {
      if (x + ox > w || x + ox + cw < 0) continue;
      ctx.save();
      ctx.translate(x + ox, y);
      drawStormCloud(ctx, cw, ch, seed, tone, flash);
      ctx.restore();
    }
}
/** The game's three cloud bands (each 1024 wide): far (pale, rain curtains under it), mid, near (darkest, lowest). */
export const CLOUD_BANDS = {
  far: {
    h: 256,
    clouds: [
      [-40, 30, 330, 120, 11, 0.05],
      [300, 10, 400, 140, 12, 0.1],
      [680, 40, 380, 120, 13, 0.05],
    ],
    curtains: [
      [120, 3],
      [640, 4],
    ],
  },
  mid: {
    h: 256,
    clouds: [
      [-60, 20, 460, 190, 21, 0.5],
      [330, 0, 440, 200, 22, 0.55],
      [700, 24, 440, 190, 23, 0.5],
    ],
    curtains: [],
  },
  near: {
    h: 256,
    clouds: [
      [-120, 0, 600, 220, 31, 1],
      [420, 10, 640, 230, 32, 0.95],
    ],
    curtains: [],
  },
} as const satisfies Record<string, { h: number; clouds: CloudSpec; curtains: readonly (readonly [number, number])[] }>;
export type CloudBand = keyof typeof CLOUD_BANDS;

/** Rain's splashes as a strip of frames (each SPLASH × SPLASH): 5 on a deck (a crown of drops, growing, fading), then 5 on the sea. */
export const SPLASH = 40;
export const SPLASH_FRAMES = 10;
export function drawSplashFrame(ctx: Ctx, i: number) {
  const k = (i % 5) / 4;
  const s = 10 + k * 22;
  const a = 0.95 - k * 0.55;
  if (i < 5) drawDeckSplash(ctx, SPLASH / 2, SPLASH * 0.8, s, a);
  else drawSeaSplash(ctx, SPLASH / 2, SPLASH * 0.75, s, a);
}

/** A sunbeam (w × h): warm light pouring down through a break in the clouds, fading out lower down (drawn added on). */
export function drawSunbeam(ctx: Ctx, w: number, h: number) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(255,236,170,0.75)');
  g.addColorStop(0.6, 'rgba(255,226,150,0.3)');
  g.addColorStop(1, 'rgba(255,214,140,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(w * 0.3, 0);
  ctx.lineTo(w * 0.62, 0);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();
  // (and a couple of brighter shafts in it)
  for (const [a, b, al] of [
    [0.38, 0.16, 0.35],
    [0.5, 0.58, 0.25],
  ] as const) {
    const g2 = ctx.createLinearGradient(0, 0, 0, h);
    g2.addColorStop(0, `rgba(255,248,210,${al})`);
    g2.addColorStop(1, 'rgba(255,248,210,0)');
    ctx.fillStyle = g2;
    ctx.beginPath();
    ctx.moveTo(w * a, 0);
    ctx.lineTo(w * (a + 0.06), 0);
    ctx.lineTo(w * (b + 0.14), h);
    ctx.lineTo(w * b, h);
    ctx.closePath();
    ctx.fill();
  }
}

/**
 * A huge splash (GOTCHA!), centred on (w/2, the bottom): white sheets of water fanning up, foam on the
 * water round it. w × h = 320 × 200.
 */
export const BIG_SPLASH = { w: 320, h: 200 } as const;
export function drawBigSplash(ctx: Ctx) {
  const x = BIG_SPLASH.w / 2;
  const y = BIG_SPLASH.h - 14;
  ctx.save();
  ctx.fillStyle = 'rgba(240,250,252,0.95)';
  ctx.strokeStyle = 'rgba(150,200,215,0.9)';
  ctx.lineWidth = 2;
  for (const [dx, h, w] of [
    [-60, 70, 34],
    [-30, 110, 30],
    [0, 130, 34],
    [30, 104, 30],
    [62, 66, 32],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(x + dx - w / 2, y);
    ctx.quadraticCurveTo(x + dx - w * 0.2 + dx * 0.25, y - h * 0.6, x + dx * 1.3, y - h);
    ctx.quadraticCurveTo(x + dx + w * 0.3 + dx * 0.2, y - h * 0.5, x + dx + w / 2, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(244,251,252,0.95)';
  const r = rng(8);
  for (let i = 0; i < 18; i++) {
    ctx.beginPath();
    ctx.arc(x + (r() - 0.5) * 220, y + (r() - 0.3) * 10, 6 + r() * 8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
