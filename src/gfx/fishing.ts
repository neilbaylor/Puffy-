import { rng, type Ctx } from './draw';
import { STYLES, ellipsePts, roundRectPts, type Fill, type Pt } from './handdrawn';

/**
 * King Bob's fishing contest (World 3's boss): the art. Everything here is drawn in world pixels
 * (the scene's stage is 1280 × 720 round the boat, the sea running off to the right), side on.
 *
 *  - the boat: a sporty white centre-console fishing boat, "REEL ROYAL", bow to the left, a T-top
 *    with rods racked on it, the big outboard on the stern (you cast off the back, over the motor)
 *  - King Bob's royal fishbowl: he fishes from a glass bowl of sea water on a little gold stand
 *  - the bobber, the cooler, the sky and the sea (a cut-away: the surface, and under it)
 */
const st = STYLES.polished;
const F = (base: string, shade: string, light: string): Fill => ({
  base,
  shade,
  light,
});

/** The boat's picture (world px): its size, where the waterline is, and where folk stand on the stern deck. */
export const BOAT = {
  w: 780,
  h: 380,
  top: 60,
  water: 300,
  deck: 200,
  hero: 612,
  king: 470,
  cooler: 545,
  motor: 742,
} as const;

const WHITE = F('#fbfbf7', '#d9dde0', '#ffffff');
const NAVY = F('#1f3a68', '#13264a', '#3c5c94');
const RED = F('#c8413a', '#9a2b26', '#e8685e');
const STEEL = F('#c9d1d8', '#8d98a2', '#f2f6f9');
const BLACK = F('#2a2d33', '#16181c', '#4c515a');
const GLASS = F('#5d8fae', '#3c6a88', '#a8d4ec');

/** The hull's outline (bow at the left, raised; flat transom on the right). */
function hullPts(): Pt[] {
  const t = BOAT.top;
  const pts: Pt[] = [];
  // the sheer line: from the bow tip, sweeping down to the deck line and flat to the stern
  for (let i = 0; i <= 20; i++) {
    const u = i / 20;
    const x = 10 + u * 230;
    pts.push([x, t + 70 + (BOAT.deck - 70 - t) * (1 - Math.pow(1 - u, 2.2)) + t * 0]);
  }
  pts.push([730, BOAT.deck]);
  // the transom, raked a touch
  pts.push([726, BOAT.water + 28]);
  // the keel, sweeping back up to the bow
  for (let i = 0; i <= 24; i++) {
    const u = i / 24;
    const x = 715 - u * 705;
    const y = BOAT.water + 30 - Math.pow(u, 3.2) * (BOAT.water + 30 - (t + 72));
    pts.push([x, y]);
  }
  return pts;
}

/** The boat (without the cooler, which is its own sprite: the fish go in it). */
export function drawBoat(ctx: Ctx) {
  const t = BOAT.top;
  const r = rng(77);
  const d = BOAT.deck;
  // ── the T-top: poles, the roof, the radar, the antenna and its pennant, rods racked behind ──
  const roofY = t + 4;
  for (const x of [300, 420]) st.shape(ctx, roundRectPts(x - 3, roofY + 10, 6, d - 40 - roofY, 3), STEEL, 1000 + x, { lw: 0.7, plain: true });
  // rods in the rack, leaning back
  for (const [x, a] of [
    [400, -2.25],
    [414, -2.1],
    [428, -1.95],
  ] as const) {
    const len = 150;
    const x1 = x + Math.cos(a) * len;
    const y1 = roofY + 18 + Math.sin(a) * len;
    ctx.strokeStyle = '#2b2b30';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(x, roofY + 18);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 + 2, y1 + 34);
    ctx.stroke();
  }
  // the antenna, a long whip with a royal pennant at the top
  st.line(
    ctx,
    [
      [452, roofY + 8],
      [470, roofY - 52],
    ],
    1010,
    1.1,
    '#e8e8e8',
  );
  st.shape(
    ctx,
    [
      [468, roofY - 52],
      [500, roofY - 44],
      [468, roofY - 36],
    ],
    F('#e8463f', '#b92f2a', '#ff7d70'),
    1011,
    { lw: 0.7 },
  );
  st.shape(ctx, roundRectPts(270, roofY, 190, 16, 6), NAVY, 1012, { lw: 1 });
  // radar dome
  st.shape(ctx, ellipsePts(330, roofY - 7, 20, 10, 0, 28), WHITE, 1013, {
    lw: 0.9,
  });
  st.shape(ctx, roundRectPts(322, roofY - 2, 16, 4, 2), STEEL, 1014, {
    lw: 0.5,
    plain: true,
  });
  // a blue light on top
  st.shape(ctx, ellipsePts(440, roofY - 2, 4, 3, 0, 12), F('#5fd7ff', '#2ea6d6', '#cff4ff'), 1015, { lw: 0.5, plain: true });

  // ── the console: white, a raked tinted windshield, a grab rail; a life ring on its side ──
  const cy0 = d - 78;
  st.shape(
    ctx,
    [
      [278, d],
      [282, cy0],
      [404, cy0 + 2],
      [412, d],
    ],
    WHITE,
    1020,
    { lw: 1 },
  );
  st.shape(
    ctx,
    [
      [286, cy0],
      [300, cy0 - 34],
      [376, cy0 - 34],
      [398, cy0 + 1],
    ],
    GLASS,
    1021,
    { lw: 1, light: [300, cy0 - 30] },
  );
  // (the glint across the glass)
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(312, cy0 - 4);
  ctx.lineTo(326, cy0 - 30);
  ctx.moveTo(326, cy0 - 4);
  ctx.lineTo(334, cy0 - 20);
  ctx.stroke();
  st.line(
    ctx,
    [
      [288, cy0 + 6],
      [404, cy0 + 8],
    ],
    1022,
    1.2,
    '#9aa4ad',
  );
  // the life ring: red and white quarters
  const lx = 345;
  const ly = d - 36;
  for (let k = 0; k < 4; k++) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.arc(lx, ly, 19, (k * Math.PI) / 2, ((k + 1) * Math.PI) / 2);
    ctx.closePath();
    ctx.clip();
    st.shape(ctx, ellipsePts(lx, ly, 18, 18, 0, 36), k % 2 ? WHITE : RED, 1030 + k, { lw: 0, noLine: true, plain: true });
    ctx.restore();
  }
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(lx, ly, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = st.ink;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(lx, ly, 18, 0, Math.PI * 2);
  ctx.arc(lx, ly, 9, 0, Math.PI * 2);
  ctx.stroke();
  // a bit of rope round it
  ctx.strokeStyle = '#e8d9b0';
  ctx.lineWidth = 1.2;
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + 0.4;
    ctx.beginPath();
    ctx.arc(lx + Math.cos(a) * 13.5, ly + Math.sin(a) * 13.5, 3, a + 1.2, a + Math.PI + 1.9);
    ctx.stroke();
  }

  // ── the bow rail ──
  ctx.strokeStyle = '#aab4bd';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(26, t + 52);
  ctx.quadraticCurveTo(110, t + 86, 236, d - 30);
  ctx.stroke();
  for (const [x, y] of [
    [40, t + 76],
    [100, t + 102],
    [170, t + 128],
    [228, d - 4],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 2, y - 24);
    ctx.stroke();
  }

  // ── the outboard: up on the transom (its cowling above the deck, the leg down into the water) ──
  const mx = BOAT.motor;
  // the leg and the lower unit (mostly under the water)
  st.shape(
    ctx,
    [
      [mx - 14, d + 10],
      [mx + 6, d + 10],
      [mx + 4, BOAT.water + 46],
      [mx - 10, BOAT.water + 46],
    ],
    BLACK,
    1040,
    { lw: 1 },
  );
  st.shape(ctx, roundRectPts(mx - 30, BOAT.water + 30, 50, 9, 4), BLACK, 1041, {
    lw: 0.8,
  });
  // the propeller
  st.shape(ctx, ellipsePts(mx - 2, BOAT.water + 54, 4, 15, 0.2, 18), STEEL, 1042, { lw: 0.7 });
  // the bracket on the transom
  st.shape(ctx, roundRectPts(mx - 22, d - 6, 18, 34, 4), STEEL, 1043, {
    lw: 0.8,
    plain: true,
  });
  // the cowling: big, glossy black with an orange stripe and the badge
  const cowl: Pt[] = [];
  for (let i = 0; i <= 30; i++) {
    const a = Math.PI + (i / 30) * Math.PI;
    cowl.push([mx - 6 + Math.cos(a) * 34, d - 52 + Math.sin(a) * 30]);
  }
  cowl.push([mx + 28, d - 20], [mx + 20, d + 10], [mx - 32, d + 10], [mx - 40, d - 20]);
  st.shape(ctx, cowl, BLACK, 1044, { lw: 1.1, light: [mx - 20, d - 70] });
  ctx.fillStyle = '#ff8a2a';
  ctx.fillRect(mx - 39, d - 26, 66, 6);
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 11px Nunito, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('BOB 300', mx - 6, d - 36);
  // a glossy highlight across its top
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(mx - 6, d - 52, 26, Math.PI * 1.15, Math.PI * 1.55);
  ctx.stroke();

  // ── the hull ──
  const hull = hullPts();
  st.shape(ctx, hull, WHITE, 1050, { lw: 1.3, light: [200, d - 20] });
  ctx.save();
  ctx.beginPath();
  hull.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.clip();
  // the boot stripe and the antifouling under the waterline
  ctx.fillStyle = NAVY.base;
  ctx.fillRect(0, BOAT.water - 22, BOAT.w, 14);
  ctx.fillStyle = RED.base;
  ctx.fillRect(0, BOAT.water - 8, BOAT.w, 80);
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(0, BOAT.water + 12, BOAT.w, 60);
  // a navy sheer stripe just under the gunwale, sweeping up to the bow
  ctx.strokeStyle = NAVY.base;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(14, t + 80);
  ctx.quadraticCurveTo(120, d - 4, 260, d + 12);
  ctx.lineTo(740, d + 12);
  ctx.stroke();
  ctx.strokeStyle = '#ffd23f';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(18, t + 90);
  ctx.quadraticCurveTo(122, d + 4, 262, d + 20);
  ctx.lineTo(740, d + 20);
  ctx.stroke();
  // the hull's shading: a soft shadow under the rub rail
  const g = ctx.createLinearGradient(0, d, 0, BOAT.water - 22);
  g.addColorStop(0, 'rgba(40,60,90,0.18)');
  g.addColorStop(0.3, 'rgba(40,60,90,0)');
  g.addColorStop(1, 'rgba(40,60,90,0.12)');
  ctx.fillStyle = g;
  ctx.fillRect(0, d, BOAT.w, BOAT.water - d);
  ctx.restore();
  // (the outline again, over the stripes)
  ctx.strokeStyle = st.ink;
  ctx.lineWidth = 2.6;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  hull.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.stroke();
  // the rub rail along the gunwale
  ctx.strokeStyle = '#59636d';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i <= 20; i++) {
    const [x, y] = hull[i];
    if (i) ctx.lineTo(x, y + 2);
    else ctx.moveTo(x, y + 2);
  }
  ctx.lineTo(730, d + 2);
  ctx.stroke();
  // her name, with a little crown
  ctx.fillStyle = NAVY.base;
  ctx.font = '900 30px "Luckiest Guy", "Nunito", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('REEL ROYAL', 300, d + 64);
  drawCrownIcon(ctx, 278, d + 50, 16);
  // portholes up at the bow
  for (const x of [120, 156]) {
    const y = d + 28 - (x < 140 ? 6 : 2);
    st.shape(ctx, ellipsePts(x, y, 7, 7, 0, 18), STEEL, 1060 + x, {
      lw: 0.8,
      plain: true,
    });
    st.shape(ctx, ellipsePts(x, y, 4.5, 4.5, 0, 14), GLASS, 1061 + x, {
      lw: 0.4,
      plain: true,
    });
  }
  // fenders hanging over the side on ropes
  for (const x of [222, 640]) {
    st.line(
      ctx,
      [
        [x, d + 2],
        [x + 1, d + 18],
      ],
      1070 + x,
      1,
      '#e8d9b0',
    );
    st.shape(ctx, roundRectPts(x - 7, d + 18, 14, 40, 7), F('#2f7fd6', '#1f5ea6', '#7ab6f2'), 1071 + x, { lw: 0.9 });
  }
  // a cleat or two
  for (const x of [250, 690])
    st.shape(ctx, roundRectPts(x - 9, d - 5, 18, 5, 2), STEEL, 1080 + x, {
      lw: 0.6,
      plain: true,
    });
  void r;
}

/** A little gold crown (for the boat's name and the pennant), centred at (x, y), w wide. */
export function drawCrownIcon(ctx: Ctx, x: number, y: number, w: number) {
  const h = w * 0.75;
  const pts: Pt[] = [
    [x - w / 2, y + h / 2],
    [x - w / 2, y - h / 4],
    [x - w / 4, y + h * 0.05],
    [x, y - h / 2],
    [x + w / 4, y + h * 0.05],
    [x + w / 2, y - h / 4],
    [x + w / 2, y + h / 2],
  ];
  st.shape(ctx, pts, F('#ffd23f', '#d9a316', '#fff2a8'), 1090, { lw: 0.8 });
}

/** The cooler on the deck (the catch goes in it): white with a teal lid. `open` lifts the lid. */
export const COOLER = { w: 76, h: 60 } as const;
export function drawCooler(ctx: Ctx, open: boolean) {
  const W = COOLER.w;
  const H = COOLER.h;
  st.shape(ctx, roundRectPts(6, 22, W - 12, H - 24, 6), WHITE, 1100, { lw: 1 });
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  ctx.fillRect(10, H - 12, W - 20, 6);
  // handle on the side
  st.shape(ctx, roundRectPts(W / 2 - 12, 34, 24, 6, 3), F('#2fb5b0', '#1f8a86', '#7fe0dc'), 1101, { lw: 0.6, plain: true });
  if (open) {
    st.shape(
      ctx,
      [
        [8, 22],
        [14, 2],
        [W - 4, 10],
        [W - 6, 22],
      ],
      F('#2fb5b0', '#1f8a86', '#7fe0dc'),
      1102,
      { lw: 1 },
    );
  } else st.shape(ctx, roundRectPts(3, 14, W - 6, 11, 5), F('#2fb5b0', '#1f8a86', '#7fe0dc'), 1103, { lw: 1 });
}

/** King Bob's royal fishbowl: a glass ball of sea water on a little gold stand. */
export const BOWL = { w: 150, h: 170, cx: 75, cy: 78, r: 62 } as const;
/** The bowl, back half: the water inside it (King Bob goes in front of this). */
export function drawBowlBack(ctx: Ctx) {
  const { cx, cy, r } = BOWL;
  // the gold stand: three curly legs and a cushion
  const GOLD = F('#ffd23f', '#d9a316', '#fff2a8');
  for (const dx of [-34, 0, 34])
    st.shape(
      ctx,
      [
        [cx + dx - 6, cy + r - 6],
        [cx + dx * 1.25 - 4, BOWL.h - 4],
        [cx + dx * 1.25 + 6, BOWL.h - 4],
        [cx + dx + 6, cy + r - 6],
      ],
      GOLD,
      1200 + dx,
      { lw: 0.9 },
    );
  st.shape(ctx, ellipsePts(cx, cy + r - 2, 44, 10, 0, 28), F('#b02a4a', '#7e1834', '#e0567a'), 1203, { lw: 1 });
  // the water: a ball of it, the surface up near the top
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  const g = ctx.createLinearGradient(0, cy - r, 0, cy + r);
  g.addColorStop(0, '#9fe3f7');
  g.addColorStop(1, '#2f8fc2');
  ctx.fillStyle = g;
  ctx.fillRect(cx - r, cy - r + 16, r * 2, r * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillRect(cx - r, cy - r + 14, r * 2, 3);
  // sand and a tiny castle at the bottom
  ctx.fillStyle = '#f2d9a0';
  ctx.beginPath();
  ctx.ellipse(cx, cy + r + 2, r, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
/** The bowl, front half: the glass (its rim and shine), drawn over King Bob. */
export function drawBowlFront(ctx: Ctx) {
  const { cx, cy, r } = BOWL;
  ctx.save();
  ctx.strokeStyle = st.ink;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  // (an opening at the top: the glass curls in to a lip)
  ctx.arc(cx, cy, r, -Math.PI / 2 + 0.55, -Math.PI / 2 - 0.55 + Math.PI * 2);
  ctx.stroke();
  // the lip: a gold rim round the opening
  st.shape(ctx, ellipsePts(cx, cy - r * Math.cos(0.55) + 1, r * Math.sin(0.55) + 4, 5, 0, 24), F('#ffd23f', '#d9a316', '#fff2a8'), 1210, { lw: 0.9 });
  // shine on the glass
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx, cy, r - 10, Math.PI * 1.08, Math.PI * 1.32);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, r - 10, Math.PI * 1.38, Math.PI * 1.45);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** The bobber: red over white, a little stick on top (centred, 22 × 34). */
export const BOBBER = { w: 22, h: 34 } as const;
export function drawBobber(ctx: Ctx, gold = false) {
  const cx = 11;
  const cy = 20;
  st.line(
    ctx,
    [
      [cx, cy - 8],
      [cx, 2],
    ],
    1300,
    1.2,
    '#3a2418',
  );
  st.shape(ctx, ellipsePts(cx, cy, 9, 10, 0, 28), WHITE, 1301, { lw: 1 });
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, 22, cy);
  ctx.clip();
  st.shape(ctx, ellipsePts(cx, cy, 9, 10, 0, 28), gold ? F('#ffd23f', '#d9a316', '#fff2a8') : RED, 1302, { lw: 1 });
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.ellipse(cx - 3.5, cy - 5, 2.4, 1.6, -0.5, 0, Math.PI * 2);
  ctx.fill();
}

/** The sky (a tall strip, stretched across): deep blue at the top to a warm haze at the horizon. */
export function drawSkyStrip(ctx: Ctx, h: number) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#3e8fe0');
  g.addColorStop(0.55, '#8fd0f6');
  g.addColorStop(1, '#fff1cf');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, h);
}

/** The water under the surface (a strip, stretched): bright under the top, deep blue down below. */
export function drawDeepStrip(ctx: Ctx, h: number) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#2bb3d6');
  g.addColorStop(0.35, '#1683b5');
  g.addColorStop(1, '#0a3e6e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, h);
}

/** The far-off sea, seen over the top of the cut-away (a strip): hazy at the horizon, bluer nearer. */
export function drawFarSeaStrip(ctx: Ctx, h: number) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#9fd9ee');
  g.addColorStop(1, '#3fa6d0');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, h);
}

/** The near surface, a tile that repeats across (256 × 44): a wavy top with foam, the water's skin under it. */
export const WAVE = { w: 256, h: 44, top: 14 } as const;
export function drawWaveTile(ctx: Ctx) {
  const W = WAVE.w;
  const y0 = WAVE.top;
  const wave = (x: number) => y0 + Math.sin((x / W) * Math.PI * 4) * 4 + Math.sin((x / W) * Math.PI * 10 + 1) * 1.6;
  ctx.beginPath();
  ctx.moveTo(0, wave(0));
  for (let x = 0; x <= W; x += 4) ctx.lineTo(x, wave(x));
  ctx.lineTo(W, WAVE.h);
  ctx.lineTo(0, WAVE.h);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, y0 - 6, 0, WAVE.h);
  g.addColorStop(0, '#7fdcef');
  g.addColorStop(0.4, '#36bde0');
  g.addColorStop(1, '#2bb3d6');
  ctx.fillStyle = g;
  ctx.fill();
  // the foam line along the crest
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let x = 0; x <= W; x += 4) x ? ctx.lineTo(x, wave(x) + 1) : ctx.moveTo(x, wave(x) + 1);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = 6; x <= W; x += 32) {
    ctx.moveTo(x, wave(x) + 9);
    ctx.lineTo(x + 12, wave(x + 12) + 9);
  }
  ctx.stroke();
}

/** A puffy cartoon cloud (w × h). */
export function drawCloud(ctx: Ctx, w: number, h: number, seed: number) {
  const r = rng(seed);
  const n = 5;
  const bumps: [number, number, number][] = [];
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n;
    const rad = h * (0.28 + 0.2 * Math.sin(u * Math.PI)) * (0.85 + r() * 0.3);
    bumps.push([w * (0.12 + u * 0.76), h - rad * 0.95 - 4, rad]);
  }
  ctx.fillStyle = 'rgba(160,190,220,0.45)';
  ctx.beginPath();
  for (const [x, y, rad] of bumps) {
    ctx.moveTo(x + rad, y + 6);
    ctx.arc(x, y + 6, rad, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  for (const [x, y, rad] of bumps) {
    ctx.moveTo(x + rad, y);
    ctx.arc(x, y, rad, 0, Math.PI * 2);
  }
  ctx.rect(w * 0.12, h - h * 0.3, w * 0.76, h * 0.3 - 4);
  ctx.fill();
}

/** A far island on the horizon (w × h): two humps, palms, and a little red-and-white lighthouse. */
export function drawIsland(ctx: Ctx, w: number, h: number) {
  ctx.fillStyle = '#7fb6a8';
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.bezierCurveTo(w * 0.15, h - 20, w * 0.25, h - h * 0.75, w * 0.42, h - h * 0.7);
  ctx.bezierCurveTo(w * 0.55, h - h * 0.66, w * 0.6, h - h * 0.45, w * 0.72, h - h * 0.48);
  ctx.bezierCurveTo(w * 0.85, h - h * 0.5, w * 0.92, h - 14, w, h);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#e9dcae';
  ctx.fillRect(w * 0.05, h - 6, w * 0.9, 6);
  // palms
  ctx.strokeStyle = '#5f8f80';
  ctx.lineWidth = 3;
  for (const [x, s] of [
    [0.3, 1],
    [0.36, -1],
    [0.78, 1],
  ] as const) {
    const bx = w * x;
    const by = h - h * (x > 0.7 ? 0.46 : 0.68);
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.quadraticCurveTo(bx + 6 * s, by - 20, bx + 3 * s, by - 34);
    ctx.stroke();
    for (const a of [-2.6, -2, -1.2, -0.5]) {
      ctx.beginPath();
      ctx.moveTo(bx + 3 * s, by - 34);
      ctx.quadraticCurveTo(bx + 3 * s + Math.cos(a) * 10, by - 40 + Math.sin(a) * 6, bx + 3 * s + Math.cos(a) * 18, by - 30 + Math.sin(a) * 6);
      ctx.stroke();
    }
  }
  // the lighthouse
  const lx = w * 0.62;
  const ly = h - h * 0.55;
  ctx.fillStyle = '#fafafa';
  ctx.beginPath();
  ctx.moveTo(lx - 7, ly);
  ctx.lineTo(lx - 4, ly - 40);
  ctx.lineTo(lx + 4, ly - 40);
  ctx.lineTo(lx + 7, ly);
  ctx.fill();
  ctx.fillStyle = '#e05a4a';
  ctx.fillRect(lx - 6, ly - 14, 12, 7);
  ctx.fillRect(lx - 5, ly - 30, 10, 7);
  ctx.fillStyle = '#ffe58a';
  ctx.fillRect(lx - 4, ly - 46, 8, 6);
  ctx.fillStyle = '#e05a4a';
  ctx.beginPath();
  ctx.moveTo(lx - 6, ly - 46);
  ctx.lineTo(lx, ly - 53);
  ctx.lineTo(lx + 6, ly - 46);
  ctx.fill();
}

/** A soft light ray under the water (w × h): brightest at the top, fading down. */
export function drawRay(ctx: Ctx, w: number, h: number) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(255,255,255,0.5)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(w * 0.35, 0);
  ctx.lineTo(w * 0.65, 0);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();
}

/** A fish's shadow under the water (w × h, nose to the right): you can't tell what it is till it's caught. */
export function drawFishShadow(ctx: Ctx, w: number, h: number) {
  ctx.fillStyle = 'rgba(8,40,70,0.75)';
  ctx.beginPath();
  ctx.ellipse(w * 0.58, h / 2, w * 0.36, h * 0.36, 0, 0, Math.PI * 2);
  ctx.moveTo(w * 0.26, h / 2);
  ctx.lineTo(w * 0.04, h * 0.12);
  ctx.lineTo(w * 0.1, h / 2);
  ctx.lineTo(w * 0.04, h * 0.88);
  ctx.closePath();
  ctx.fill();
}

/** The rays behind a fish you've just caught (s × s): gold spokes from the middle, fading out. */
export function drawStarburst(ctx: Ctx, s: number) {
  const c = s / 2;
  const g = ctx.createRadialGradient(c, c, 0, c, c, c);
  g.addColorStop(0, 'rgba(255,240,170,0.95)');
  g.addColorStop(0.5, 'rgba(255,210,63,0.5)');
  g.addColorStop(1, 'rgba(255,210,63,0)');
  ctx.fillStyle = g;
  const n = 14;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2;
    const a1 = a0 + (Math.PI / n) * 0.9;
    ctx.moveTo(c, c);
    ctx.lineTo(c + Math.cos(a0) * c, c + Math.sin(a0) * c);
    ctx.lineTo(c + Math.cos(a1) * c, c + Math.sin(a1) * c);
    ctx.closePath();
  }
  ctx.fill();
  const g2 = ctx.createRadialGradient(c, c, 0, c, c, c * 0.4);
  g2.addColorStop(0, 'rgba(255,255,230,0.9)');
  g2.addColorStop(1, 'rgba(255,255,230,0)');
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, s, s);
}

/** A ripple ring on the water (an ellipse, w × h). */
export function drawRipple(ctx: Ctx, w: number, h: number) {
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(w / 2, h / 2, w / 2 - 2, h / 2 - 2, 0, 0, Math.PI * 2);
  ctx.stroke();
}

/** A drop of water (r): a blue-white bead with a glint. */
export function drawDrop(ctx: Ctx, r: number) {
  ctx.fillStyle = '#d8f6ff';
  ctx.beginPath();
  ctx.arc(r, r, r - 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(r * 0.7, r * 0.7, r * 0.3, 0, Math.PI * 2);
  ctx.fill();
}
