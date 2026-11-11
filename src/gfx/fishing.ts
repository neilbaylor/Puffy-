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

/**
 * The boat's picture (world px): its size; where the waterline is; the deck (where the gunwale is, and
 * where folk stand on the stern); where King Bob's bowl, the cooler and the hero go; the outboards.
 */
export const BOAT = { w: 900, h: 450, water: 362, deck: 258, feet: 243, king: 540, cooler: 622, hero: 706, motor: 848, transom: 816 } as const;
/** Seen a little from above: how far the far side's gunwale sits over the near one (the deck shows between). */
const DECK_D = 30;
/** And how far up the deck everything standing on it is drawn (its middle). */
const ON_DECK = BOAT.deck - BOAT.feet;

const WHITE = F('#fbfbf7', '#d9dde0', '#ffffff');
const NAVY = F('#1f3a68', '#13264a', '#3c5c94');
const RED = F('#c8413a', '#9a2b26', '#e8685e');
const STEEL = F('#c9d1d8', '#8d98a2', '#f2f6f9');
const BLACK = F('#2a2d33', '#16181c', '#4c515a');
const GLASS = F('#3f6f8f', '#2a5470', '#8fc4e2');
const TEAK = F('#b5773a', '#8a5426', '#dca36a');

/** Points along a quadratic curve (n steps, both ends in). */
const quad = (a: Pt, c: Pt, b: Pt, n = 16): Pt[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    const u = 1 - t;
    return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]];
  });

/** The sheer line (the top of the hull, bow to stern): sweeping up to a raised bow. */
const SHEER: Pt[] = [...quad([18, 186], [150, 250], [310, BOAT.deck], 18), [BOAT.transom, BOAT.deck]];
/** The hull's outline: the sheer, down the transom, along the keel and up the stem to the bow. */
function hullPts(): Pt[] {
  const W = BOAT.water;
  return [...SHEER, [BOAT.transom - 10, W + 22], ...quad([700, W + 24], [240, W + 26], [150, W + 14], 10).slice(0), ...quad([150, W + 14], [46, W - 10], [18, 186], 14).slice(1)];
}
/** A curve parallel-ish to the sheer, `d` below it (for stripes along the hull). */
const underSheer = (d: number): Pt[] => SHEER.map(([x, y], i) => [x + (i < 18 ? d * 0.18 : 0), y + d]);

const line = (ctx: Ctx, pts: Pt[], w: number, col: string) => {
  ctx.strokeStyle = col;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
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

/** A rod standing in a holder: the blank, a reel, its line guides. */
function rackedRod(ctx: Ctx, x: number, y: number, a: number, len: number, col: string) {
  const x1 = x + Math.cos(a) * len;
  const y1 = y + Math.sin(a) * len;
  line(
    ctx,
    [
      [x, y],
      [x1, y1],
    ],
    3.2,
    '#22252c',
  );
  line(
    ctx,
    [
      [x, y],
      [x + Math.cos(a) * 18, y + Math.sin(a) * 18],
    ],
    4.2,
    '#c89a5e',
  );
  ctx.fillStyle = col;
  ctx.strokeStyle = '#22252c';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(x + Math.cos(a) * 24 + Math.cos(a + Math.PI / 2) * 6, y + Math.sin(a) * 24 + Math.sin(a + Math.PI / 2) * 6, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

/** The boat (without the cooler, which is its own sprite: the fish go in it). */
export function drawBoat(ctx: Ctx) {
  const d = BOAT.deck;
  const W = BOAT.water;
  const r = rng(77);

  // ── the deck, seen from a little above: the far side's gunwale and inner wall, the non-skid deck ──
  const far: Pt[] = SHEER.map(([x, y]) => [x + 4, y - DECK_D * Math.min(1, Math.max(0, (x - 18) / 230))]);
  ctx.fillStyle = '#dfe5e9';
  ctx.beginPath();
  [...far, ...SHEER.slice().reverse()].forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fill();
  // (the inside of the far side: white, a shadow along its foot)
  ctx.fillStyle = '#f6f8f9';
  ctx.beginPath();
  [...far, ...far.map(([x, y]): Pt => [x, y + 11]).reverse()].forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fill();
  line(
    ctx,
    far.map(([x, y]) => [x, y + 12]),
    3,
    'rgba(60,80,100,0.18)',
  );
  // non-skid: a fine diamond pattern on the deck
  ctx.save();
  ctx.beginPath();
  [...far.map(([x, y]): Pt => [x, y + 12]), ...SHEER.slice().reverse()].forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = 'rgba(120,135,150,0.22)';
  for (let x = 30; x < BOAT.transom; x += 9) for (let y = d - DECK_D; y < d; y += 6) ctx.fillRect(x + ((y / 6) % 2) * 4.5, y, 2, 2);
  ctx.restore();
  // the far gunwale's teak cap, and the inside of the transom
  line(ctx, far, 5, '#6b3f1c');
  line(ctx, far, 3.4, TEAK.base);
  st.shape(
    ctx,
    [
      [BOAT.transom - 4, d - DECK_D],
      [BOAT.transom + 4, d - DECK_D],
      [BOAT.transom + 4, d],
      [BOAT.transom - 2, d],
    ],
    F('#eef1f3', '#cfd5da', '#ffffff'),
    1001,
    { lw: 0.8, plain: true },
  );

  // everything standing on the deck is drawn up on its middle
  ctx.save();
  ctx.translate(2, -ON_DECK);
  // ── up top first: the outrigger, antennas, the hardtop with its radar, the rod rack ──
  const roofY = d - 172;
  // the outrigger, a long pole reaching up and forward over the bow, its line hanging off it
  tube(
    ctx,
    [
      [318, roofY + 8],
      [92, 14],
    ],
    3,
  );
  line(
    ctx,
    [
      [96, 18],
      [150, 120],
      [205, roofY + 40],
    ],
    0.8,
    'rgba(255,255,255,0.7)',
  );
  // whip antennas raked back, a royal pennant on one
  line(
    ctx,
    [
      [468, roofY + 4],
      [520, 8],
    ],
    2,
    '#e8e8e8',
  );
  line(
    ctx,
    [
      [452, roofY + 4],
      [480, 34],
    ],
    1.6,
    '#d8d8d8',
  );
  st.shape(
    ctx,
    [
      [518, 10],
      [552, 18],
      [518, 27],
    ],
    F('#e8463f', '#b92f2a', '#ff7d70'),
    1011,
    { lw: 0.7 },
  );
  drawCrownIcon(ctx, 532, 18, 10);
  // the rod rack ("rocket launcher") along the back edge of the hardtop: rods leaning back
  for (const [x, a] of [
    [446, -1.28],
    [462, -1.18],
    [478, -1.08],
    [494, -0.98],
  ] as const)
    rackedRod(ctx, x, roofY + 12, a, 112, x % 32 ? '#e8463f' : '#ffd23f');
  // the frame: stainless tubes from the console and the leaning post up to the hardtop
  tube(ctx, [
    [312, d - 70],
    [306, roofY + 40],
    [318, roofY + 12],
  ]);
  tube(
    ctx,
    [
      [338, d - 70],
      [334, roofY + 12],
    ],
    3,
  );
  tube(ctx, [
    [452, d - 52],
    [462, roofY + 40],
    [470, roofY + 12],
  ]);
  tube(
    ctx,
    [
      [430, d - 52],
      [440, roofY + 12],
    ],
    3,
  );
  // the hardtop: white fibreglass, a navy edge, the canvas shade under it
  st.shape(
    ctx,
    [
      [286, roofY + 8],
      [296, roofY - 4],
      [494, roofY - 6],
      [512, roofY + 6],
      [500, roofY + 18],
      [290, roofY + 18],
    ],
    WHITE,
    1012,
    { lw: 1.1, light: [320, roofY - 8] },
  );
  ctx.fillStyle = NAVY.base;
  ctx.fillRect(292, roofY + 10, 212, 6);
  ctx.fillStyle = 'rgba(20,38,74,0.35)';
  ctx.fillRect(300, roofY + 18, 190, 5);
  // radar dome and a blue light
  st.shape(ctx, ellipsePts(390, roofY - 14, 30, 12, 0, 32), WHITE, 1013, { lw: 1 });
  st.shape(ctx, roundRectPts(378, roofY - 6, 24, 5, 2), STEEL, 1014, { lw: 0.5, plain: true });
  st.shape(ctx, ellipsePts(320, roofY - 8, 5, 4, 0, 12), F('#5fd7ff', '#2ea6d6', '#cff4ff'), 1015, { lw: 0.6, plain: true });

  // ── the leaning post: a padded backrest on a stainless frame, a tackle station under it ──
  st.shape(ctx, roundRectPts(420, d - 48, 48, 48, 6), WHITE, 1016, { lw: 1 });
  for (let i = 0; i < 3; i++) st.shape(ctx, roundRectPts(426, d - 42 + i * 13, 36, 9, 3), F('#e9edf0', '#c6ccd2', '#ffffff'), 1017 + i, { lw: 0.5, plain: true });
  st.shape(ctx, roundRectPts(430, d - 92, 34, 40, 10), NAVY, 1020, { lw: 1, light: [440, d - 88] });
  line(
    ctx,
    [
      [436, d - 84],
      [458, d - 84],
    ],
    1,
    'rgba(255,255,255,0.5)',
  );

  // ── the console: white, a wrap-around tinted windscreen, the wheel behind it, a grab rail ──
  // (the wheel and the screen first: they show through the glass)
  ctx.fillStyle = '#1b2230';
  ctx.beginPath();
  ctx.arc(392, d - 98, 15, 0, Math.PI * 2);
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#1b2230';
  ctx.stroke();
  ctx.fillRect(388, d - 98, 6, 18);
  st.shape(
    ctx,
    [
      [300, d],
      [306, d - 64],
      [328, d - 82],
      [410, d - 82],
      [418, d],
    ],
    WHITE,
    1021,
    { lw: 1.1, light: [320, d - 76] },
  );
  // the console's side: a navy flash and a hatch
  ctx.fillStyle = NAVY.base;
  ctx.beginPath();
  ctx.moveTo(312, d - 46);
  ctx.lineTo(414, d - 52);
  ctx.lineTo(415, d - 42);
  ctx.lineTo(311, d - 36);
  ctx.closePath();
  ctx.fill();
  st.shape(ctx, roundRectPts(340, d - 30, 40, 24, 4), F('#eef1f3', '#cfd5da', '#ffffff'), 1022, { lw: 0.7, plain: true });
  st.shape(ctx, ellipsePts(374, d - 18, 2.5, 2.5, 0, 10), STEEL, 1023, { lw: 0.4, plain: true });
  // the windscreen
  ctx.save();
  ctx.globalAlpha = 0.82;
  st.shape(
    ctx,
    [
      [326, d - 82],
      [348, d - 122],
      [404, d - 124],
      [410, d - 82],
    ],
    GLASS,
    1024,
    { lw: 1.1, light: [350, d - 120] },
  );
  ctx.restore();
  line(
    ctx,
    [
      [332, d - 88],
      [348, d - 116],
    ],
    3,
    'rgba(255,255,255,0.6)',
  );
  line(
    ctx,
    [
      [346, d - 88],
      [356, d - 106],
    ],
    2,
    'rgba(255,255,255,0.45)',
  );
  tube(
    ctx,
    [
      [344, d - 124],
      [406, d - 126],
    ],
    2.5,
  );
  // the dash: a chart-plotter glowing
  st.shape(ctx, roundRectPts(358, d - 80, 26, 14, 3), F('#0f1a2a', '#09111c', '#1d3350'), 1025, { lw: 0.6, plain: true });
  ctx.fillStyle = '#4fd1ff';
  ctx.fillRect(361, d - 77, 20, 8);
  ctx.fillStyle = '#ffd23f';
  ctx.fillRect(366, d - 74, 6, 2);
  // the grab rail round the console
  tube(
    ctx,
    [
      [300, d - 60],
      [302, d - 72],
      [316, d - 76],
    ],
    2.5,
  );
  // the front seat ahead of the console: a white box with a navy cushion
  st.shape(ctx, roundRectPts(236, d - 34, 60, 34, 5), WHITE, 1026, { lw: 1 });
  st.shape(ctx, roundRectPts(232, d - 44, 68, 13, 6), NAVY, 1027, { lw: 1, light: [240, d - 44] });
  st.shape(ctx, roundRectPts(232, d - 72, 14, 34, 6), NAVY, 1028, { lw: 0.9 });
  // a life ring on the leaning post's side
  lifeRing(ctx, 444, d - 66, 13);

  ctx.restore();

  // ── the bow rail: stainless, sweeping up to the bow ──
  const rail = quad([30, 160], [140, 218], [262, d - 26], 14);
  tube(ctx, rail, 2.6);
  for (const i of [1, 4, 8, 12]) {
    const [x, y] = rail[i];
    const sy = SHEER.reduce((b, p) => (Math.abs(p[0] - x) < Math.abs(b[0] - x) ? p : b))[1];
    tube(
      ctx,
      [
        [x, y],
        [x + 1, sy],
      ],
      2.2,
    );
  }
  // stern rail by the motors
  tube(
    ctx,
    [
      [738, d - 30],
      [802, d - 30],
      [808, d],
    ],
    2.4,
  );
  tube(
    ctx,
    [
      [738, d - 30],
      [738, d],
    ],
    2.2,
  );

  // ── the swim platform and ladder off the stern, the twin outboards on their bracket ──
  st.shape(ctx, roundRectPts(BOAT.transom - 6, W - 26, 66, 8, 3), TEAK, 1030, { lw: 0.9 });
  for (let i = 0; i < 6; i++)
    line(
      ctx,
      [
        [BOAT.transom + i * 10, W - 25],
        [BOAT.transom + i * 10, W - 19],
      ],
      0.8,
      '#8a5426',
    );
  tube(
    ctx,
    [
      [BOAT.transom + 54, W - 26],
      [BOAT.transom + 58, W + 30],
    ],
    2.2,
  );
  tube(
    ctx,
    [
      [BOAT.transom + 46, W - 26],
      [BOAT.transom + 50, W + 30],
    ],
    2.2,
  );
  for (const k of [0, 1]) {
    // (the far motor a touch higher and darker, behind the near one)
    const mx = BOAT.motor - 18 + k * 18;
    const dy = k ? 0 : -6;
    const body = k ? BLACK : F('#1d1f24', '#111216', '#383c44');
    st.shape(
      ctx,
      [
        [mx - 12, d + 14 + dy],
        [mx + 6, d + 14 + dy],
        [mx + 4, W + 44],
        [mx - 10, W + 44],
      ],
      body,
      1040 + k,
      { lw: 1 },
    );
    st.shape(ctx, roundRectPts(mx - 30, W + 30, 50, 8, 4), body, 1042 + k, { lw: 0.8 });
    st.shape(
      ctx,
      [
        [mx - 8, W + 44],
        [mx + 2, W + 44],
        [mx - 2, W + 60],
      ],
      body,
      1044 + k,
      { lw: 0.7 },
    );
    st.shape(ctx, ellipsePts(mx + 8, W + 50, 3.5, 13, 0.25, 16), STEEL, 1046 + k, { lw: 0.6 });
    // the cowling: big and glossy, an orange stripe, vents, the badge
    const cy = d - 52 + dy;
    const cowl: Pt[] = [];
    for (let i = 0; i <= 30; i++) {
      const a = Math.PI + (i / 30) * Math.PI;
      cowl.push([mx - 4 + Math.cos(a) * 34, cy + Math.sin(a) * 30]);
    }
    cowl.push([mx + 30, cy + 32], [mx + 22, d + 16 + dy], [mx - 32, d + 16 + dy], [mx - 40, cy + 32]);
    st.shape(ctx, cowl, body, 1048 + k, { lw: 1.1, light: [mx - 22, cy - 22] });
    if (k) {
      ctx.fillStyle = '#ff8a2a';
      ctx.fillRect(mx - 39, cy + 26, 68, 5);
      ctx.fillStyle = '#4c515a';
      for (let i = 0; i < 4; i++) ctx.fillRect(mx + 4 + i * 5, cy - 6, 2.5, 12);
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 11px Nunito, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('BOB 300', mx - 12, cy + 18);
      drawCrownIcon(ctx, mx - 12, cy + 2, 13);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(mx - 4, cy, 26, Math.PI * 1.12, Math.PI * 1.55);
      ctx.stroke();
    }
    // the bracket on the transom
    st.shape(ctx, roundRectPts(mx - 34, d + 8 + dy, 16, 30, 3), STEEL, 1050 + k, { lw: 0.7, plain: true });
  }

  // ── the hull ──
  const hull = hullPts();
  st.shape(ctx, hull, WHITE, 1060, { lw: 1.3, light: [220, d + 10] });
  ctx.save();
  ctx.beginPath();
  hull.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.clip();
  // the shade on the lower hull, under the spray rail
  const chine = quad([40, 240], [240, 318], [BOAT.transom, 330], 20);
  ctx.fillStyle = 'rgba(70,95,125,0.16)';
  ctx.beginPath();
  chine.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.lineTo(BOAT.transom + 20, W + 40);
  ctx.lineTo(0, W + 40);
  ctx.closePath();
  ctx.fill();
  // the boot stripe and the antifouling under the waterline
  ctx.fillStyle = NAVY.base;
  ctx.fillRect(0, W - 16, BOAT.w, 12);
  ctx.fillStyle = RED.base;
  ctx.fillRect(0, W - 4, BOAT.w, 80);
  ctx.fillStyle = 'rgba(0,0,0,0.14)';
  ctx.fillRect(0, W + 10, BOAT.w, 60);
  // a navy sheer stripe sweeping up to the bow, a gold pinstripe under it
  ctx.fillStyle = NAVY.base;
  ctx.beginPath();
  [...underSheer(10), ...underSheer(26).reverse()].forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fill();
  line(ctx, underSheer(31), 2.2, '#ffd23f');
  // the gloss: a long soft highlight along the topsides
  const gl = ctx.createLinearGradient(0, d + 34, 0, d + 52);
  gl.addColorStop(0, 'rgba(255,255,255,0)');
  gl.addColorStop(0.5, 'rgba(255,255,255,0.75)');
  gl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gl;
  ctx.fillRect(200, d + 34, 560, 18);
  ctx.restore();
  // the spray rail itself
  line(ctx, chine, 2, 'rgba(255,255,255,0.9)');
  line(
    ctx,
    chine.map(([x, y]) => [x, y + 2.2]),
    1.2,
    'rgba(60,80,110,0.4)',
  );
  // the outline again, over the stripes
  ctx.strokeStyle = st.ink;
  ctx.lineWidth = 2.6;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  hull.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.stroke();
  // the teak cap rail along the gunwale, the rub rail under it
  line(
    ctx,
    SHEER.map(([x, y]) => [x, y + 7]),
    3,
    '#5b6670',
  );
  line(ctx, SHEER, 7, '#6b3f1c');
  line(ctx, SHEER, 5, TEAK.base);
  line(
    ctx,
    SHEER.map(([x, y]) => [x, y - 1.2]),
    1.4,
    TEAK.light,
  );
  // her name (sporty, leaning forward) with a little crown, and a gold shadow
  ctx.save();
  ctx.translate(352, d + 78);
  ctx.transform(1, 0, -0.18, 1, 0, 0);
  ctx.font = '400 38px "Lilita One", "Arial Black", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#d9a316';
  ctx.fillText('REEL ROYAL', 2, 2);
  ctx.fillStyle = NAVY.base;
  ctx.fillText('REEL ROYAL', 0, 0);
  ctx.restore();
  drawCrownIcon(ctx, 330, d + 64, 22);
  // the anchor at the bow, a nav light, portholes
  anchor(ctx, 66, 238);
  st.shape(ctx, ellipsePts(32, 196, 4, 3, 0, 10), F('#e8463f', '#b92f2a', '#ff9a90'), 1070, { lw: 0.6, plain: true });
  for (const [x, y] of [
    [124, 262],
    [160, 270],
  ] as const) {
    st.shape(ctx, ellipsePts(x, y, 8, 8, 0, 20), STEEL, 1071 + x, { lw: 0.9, plain: true });
    st.shape(ctx, ellipsePts(x, y, 5, 5, 0, 16), GLASS, 1072 + x, { lw: 0.4, plain: true });
  }
  // fenders on ropes over the side
  for (const x of [262, 700]) {
    line(
      ctx,
      [
        [x, d - 2],
        [x + 1, d + 30],
      ],
      1.2,
      '#e8d9b0',
    );
    st.shape(ctx, roundRectPts(x - 9, d + 30, 18, 44, 9), WHITE, 1080 + x, { lw: 1 });
    st.shape(ctx, roundRectPts(x - 9, d + 30, 18, 9, 4), NAVY, 1081 + x, { lw: 0.6, plain: true });
    st.shape(ctx, roundRectPts(x - 9, d + 65, 18, 9, 4), NAVY, 1082 + x, { lw: 0.6, plain: true });
  }
  void r;
}

/** A red-and-white life ring (radius R) with its rope. */
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

/** A little steel anchor on the bow, centred at (x, y). */
function anchor(ctx: Ctx, x: number, y: number) {
  ctx.strokeStyle = '#5b6670';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y - 9);
  ctx.lineTo(x, y + 9);
  ctx.moveTo(x - 6, y - 4);
  ctx.lineTo(x + 6, y - 4);
  ctx.moveTo(x - 9, y + 3);
  ctx.quadraticCurveTo(x, y + 14, x + 9, y + 3);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y - 12, 3, 0, Math.PI * 2);
  ctx.stroke();
}

/** The soft shadow of the hull under the water (w × h). */
export function drawHullShadow(ctx: Ctx, w: number, h: number) {
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  g.addColorStop(0, 'rgba(5,30,60,0.55)');
  g.addColorStop(1, 'rgba(5,30,60,0)');
  ctx.fillStyle = g;
  ctx.save();
  ctx.scale(1, h / w);
  ctx.beginPath();
  ctx.arc(w / 2, w / 2, w / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
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

/** The dock the show's host stands on (w × h, its deck along the top; the pilings go on down into the water). */
export const DOCK = { w: 760, h: 300, deck: 70 } as const;
export function drawDock(ctx: Ctx) {
  const W = DOCK.w;
  const top = DOCK.deck;
  const WOOD = F('#b88752', '#8a5e33', '#dcb07c');
  const DARK = F('#8a5e33', '#5f3e1f', '#b88752');
  // pilings, down into the water
  for (let x = 30; x < W; x += 120) {
    st.shape(ctx, roundRectPts(x - 13, top - 20, 26, DOCK.h - top + 10, 8), DARK, 1500 + x, { lw: 1.1, light: [x - 8, top] });
    // (a rope wrapped round some of them)
    if (x % 240 === 30)
      for (let k = 0; k < 3; k++)
        line(
          ctx,
          [
            [x - 13, top + 30 + k * 6],
            [x + 13, top + 34 + k * 6],
          ],
          2.4,
          '#e8d9b0',
        );
    // weed and wet at the waterline
    ctx.fillStyle = 'rgba(40,90,60,0.35)';
    ctx.fillRect(x - 13, top + 118, 26, 14);
  }
  // the deck: planks seen a little from above, then the beam along the front
  st.shape(
    ctx,
    [
      [0, top - 26],
      [W, top - 26],
      [W, top],
      [0, top],
    ],
    WOOD,
    1510,
    { lw: 1.1, light: [100, top - 26] },
  );
  ctx.strokeStyle = 'rgba(95,62,31,0.55)';
  ctx.lineWidth = 1.2;
  for (let x = 14; x < W; x += 28) {
    ctx.beginPath();
    ctx.moveTo(x, top - 26);
    ctx.lineTo(x - 4, top);
    ctx.stroke();
  }
  st.shape(ctx, roundRectPts(0, top, W, 18, 3), DARK, 1511, { lw: 1.1 });
  for (let x = 20; x < W; x += 60) {
    ctx.fillStyle = '#4b5560';
    ctx.beginPath();
    ctx.arc(x, top + 9, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
  // a bollard with a coil of rope, and an old lamp post
  st.shape(ctx, roundRectPts(600, top - 46, 22, 26, 6), F('#3d4a57', '#25303a', '#64748a'), 1512, { lw: 1 });
  st.shape(ctx, ellipsePts(611, top - 46, 15, 5, 0, 20), F('#3d4a57', '#25303a', '#64748a'), 1513, { lw: 1 });
  for (let k = 0; k < 3; k++) st.shape(ctx, ellipsePts(560, top - 30 - k * 4, 22 - k * 3, 6, 0, 24), F('#e8d9b0', '#c2ad7c', '#fff4d6'), 1514 + k, { lw: 0.8, plain: true });
  st.shape(ctx, roundRectPts(96, top - 196, 8, 172, 3), F('#2f3a44', '#1c242b', '#55626e'), 1520, { lw: 1 });
  st.shape(
    ctx,
    [
      [86, top - 196],
      [114, top - 196],
      [108, top - 222],
      [92, top - 222],
    ],
    F('#fff3b0', '#e8c860', '#ffffff'),
    1521,
    { lw: 1 },
  );
  st.shape(
    ctx,
    [
      [82, top - 222],
      [118, top - 222],
      [100, top - 236],
    ],
    F('#2f3a44', '#1c242b', '#55626e'),
    1522,
    { lw: 1 },
  );
  // the show's sign, on two posts
  for (const x of [190, 330]) st.shape(ctx, roundRectPts(x - 4, top - 110, 8, 86, 2), DARK, 1530 + x, { lw: 0.9 });
  st.shape(ctx, roundRectPts(160, top - 160, 200, 62, 10), F('#f4e2b8', '#d9c08a', '#fff8e4'), 1532, { lw: 1.2 });
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#c0392b';
  ctx.font = '400 13px "Lilita One", "Arial Black", sans-serif';
  ctx.fillText('THE WONDERFUL WORLD OF', 260, top - 138, 184);
  ctx.fillStyle = '#1f3a68';
  ctx.font = '400 26px "Lilita One", "Arial Black", sans-serif';
  ctx.fillText('SPORTS', 260, top - 110);
  ctx.restore();
}

/**
 * The show's host: a round, cheery old-school TV sports man in a mustard check blazer and a red bow
 * tie, a slick of hair, a big moustache, holding a chrome ball microphone on a curly lead. Frames:
 * t0/t1 talking (mouth shut/open), p0/p1 pointing off to the right (towards the boat).
 */
export const HOST = { w: 140, h: 190 } as const;
export const HOST_FRAMES = ['t0', 't1', 'p0', 'p1'] as const;
export function drawHost(ctx: Ctx, f: string) {
  const open = f.endsWith('1');
  const point = f.startsWith('p');
  const SKIN = F('#ffd6ad', '#e8aa7a', '#fff0dc');
  const BLAZER = F('#d9a441', '#a87a24', '#f2cc78');
  const PANTS = F('#6b4a2e', '#4a311d', '#8e6a48');
  const HAIR = F('#4a2f1c', '#2e1c10', '#7a5236');
  const cx = 62;
  // legs and shoes
  for (const dx of [-14, 12]) {
    st.shape(ctx, roundRectPts(cx + dx - 9, 142, 18, 36, 6), PANTS, 1600 + dx, { lw: 1 });
    st.shape(ctx, ellipsePts(cx + dx + 4, 180, 15, 7, 0, 20), F('#2a2421', '#151210', '#4c423c'), 1602 + dx, { lw: 1 });
  }
  // the body: a round blazer, the shirt and the bow tie
  const body = ellipsePts(cx, 118, 40, 38, 0, 40);
  st.shape(ctx, body, BLAZER, 1610, { lw: 1.2, light: [cx - 14, 96] });
  ctx.save();
  ctx.beginPath();
  body.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.clip();
  // the check pattern
  ctx.strokeStyle = 'rgba(120,70,20,0.35)';
  ctx.lineWidth = 2;
  for (let x = cx - 44; x < cx + 44; x += 10) {
    ctx.beginPath();
    ctx.moveTo(x, 78);
    ctx.lineTo(x, 160);
    ctx.stroke();
  }
  for (let y = 82; y < 160; y += 10) {
    ctx.beginPath();
    ctx.moveTo(cx - 44, y);
    ctx.lineTo(cx + 44, y);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(190,60,40,0.3)';
  ctx.lineWidth = 1;
  for (let x = cx - 39; x < cx + 44; x += 20) {
    ctx.beginPath();
    ctx.moveTo(x, 78);
    ctx.lineTo(x, 160);
    ctx.stroke();
  }
  ctx.restore();
  st.shape(
    ctx,
    [
      [cx - 14, 84],
      [cx + 14, 84],
      [cx, 118],
    ],
    F('#ffffff', '#e6e6e6', '#ffffff'),
    1611,
    { lw: 1 },
  );
  st.shape(
    ctx,
    [
      [cx - 14, 84],
      [cx - 6, 120],
      [cx - 22, 100],
    ],
    BLAZER,
    1612,
    { lw: 0.9 },
  );
  st.shape(
    ctx,
    [
      [cx + 14, 84],
      [cx + 6, 120],
      [cx + 22, 100],
    ],
    BLAZER,
    1613,
    { lw: 0.9 },
  );
  st.shape(
    ctx,
    [
      [cx, 90],
      [cx - 11, 84],
      [cx - 11, 96],
    ],
    F('#d6302a', '#a8201b', '#ff6a5e'),
    1614,
    { lw: 0.8 },
  );
  st.shape(
    ctx,
    [
      [cx, 90],
      [cx + 11, 84],
      [cx + 11, 96],
    ],
    F('#d6302a', '#a8201b', '#ff6a5e'),
    1615,
    { lw: 0.8 },
  );
  // a pocket square
  st.shape(
    ctx,
    [
      [cx + 18, 108],
      [cx + 30, 106],
      [cx + 28, 112],
      [cx + 20, 113],
    ],
    F('#ffffff', '#e6e6e6', '#ffffff'),
    1616,
    { lw: 0.6, plain: true },
  );
  // the free arm: down by his side, or pointing off to the right
  if (point) {
    st.shape(
      ctx,
      [
        [cx + 30, 100],
        [cx + 72, 82],
        [cx + 76, 92],
        [cx + 34, 112],
      ],
      BLAZER,
      1620,
      { lw: 1 },
    );
    st.shape(ctx, ellipsePts(cx + 80, 85, 8, 7, -0.4, 16), SKIN, 1621, { lw: 1 });
    st.shape(ctx, roundRectPts(cx + 84, 80, 16, 5, 2.5), SKIN, 1622, { lw: 0.8 });
  } else {
    st.shape(
      ctx,
      [
        [cx + 32, 102],
        [cx + 44, 130],
        [cx + 36, 136],
        [cx + 26, 112],
      ],
      BLAZER,
      1623,
      { lw: 1 },
    );
    st.shape(ctx, ellipsePts(cx + 41, 138, 7, 7, 0, 14), SKIN, 1624, { lw: 1 });
  }
  // the head: big and round
  const hx = cx - 2;
  const hy = 48;
  st.shape(ctx, ellipsePts(hx, hy, 34, 33, 0, 40), SKIN, 1630, { lw: 1.2, light: [hx - 12, hy - 14] });
  // ears
  st.shape(ctx, ellipsePts(hx - 34, hy + 4, 6, 9, 0, 14), SKIN, 1631, { lw: 0.9 });
  // the hair: slicked back, a big glossy wave over the top
  st.shape(
    ctx,
    [
      [hx - 34, hy - 2],
      [hx - 36, hy - 22],
      [hx - 20, hy - 38],
      [hx + 4, hy - 42],
      [hx + 26, hy - 40],
      [hx + 36, hy - 28],
      [hx + 22, hy - 26],
      [hx + 4, hy - 22],
      [hx - 18, hy - 20],
      [hx - 28, hy - 8],
    ],
    HAIR,
    1632,
    { lw: 1.1, light: [hx - 8, hy - 40] },
  );
  line(
    ctx,
    [
      [hx - 18, hy - 32],
      [hx + 6, hy - 37],
      [hx + 26, hy - 34],
    ],
    2,
    'rgba(255,255,255,0.45)',
  );
  // eyes and big raised brows (he's very excited)
  for (const dx of [-12, 12]) {
    st.shape(ctx, ellipsePts(hx + dx + 6, hy - 4, 6, 8, 0, 18), F('#ffffff', '#ececec', '#ffffff'), 1640 + dx, { lw: 0.9, plain: true });
    ctx.fillStyle = '#2a1a12';
    ctx.beginPath();
    ctx.arc(hx + dx + 8, hy - 3, 3.2, 0, Math.PI * 2);
    ctx.fill();
    line(
      ctx,
      [
        [hx + dx, hy - 18],
        [hx + dx + 7, hy - 21],
        [hx + dx + 13, hy - 18],
      ],
      3,
      '#3a2418',
    );
  }
  // the nose, the mouth (open when talking), the moustache over it
  st.shape(ctx, ellipsePts(hx + 12, hy + 8, 6, 5, 0, 14), F('#ffc49a', '#e39a6c', '#ffe2c8'), 1650, { lw: 0.9 });
  if (open) {
    st.shape(ctx, ellipsePts(hx + 10, hy + 22, 11, 8, 0, 24), F('#7a1f1f', '#5a1414', '#a8302c'), 1651, { lw: 1 });
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(hx + 2, hy + 15, 16, 4);
    st.shape(ctx, ellipsePts(hx + 10, hy + 27, 6, 3, 0, 12), F('#ff8a8a', '#e06060', '#ffb0b0'), 1652, { lw: 0, noLine: true, plain: true });
  } else
    line(
      ctx,
      [
        [hx + 1, hy + 20],
        [hx + 10, hy + 24],
        [hx + 19, hy + 20],
      ],
      2.4,
      '#3a2418',
    );
  st.shape(
    ctx,
    [
      [hx - 6, hy + 16],
      [hx + 4, hy + 11],
      [hx + 10, hy + 14],
      [hx + 16, hy + 11],
      [hx + 26, hy + 16],
      [hx + 16, hy + 18],
      [hx + 10, hy + 16],
      [hx + 4, hy + 18],
    ],
    HAIR,
    1653,
    { lw: 0.9 },
  );
  // the microphone hand up by his chin: a chrome ball on a black handle, its curly lead hanging down
  const mx = hx + 34;
  const my = hy + 30;
  ctx.strokeStyle = '#1b1b1f';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(mx + 4, my + 34);
  for (let i = 0; i < 26; i++) ctx.lineTo(mx + 6 + Math.sin(i * 1.4) * 4, my + 36 + i * 3.2);
  ctx.stroke();
  st.shape(
    ctx,
    [
      [mx - 3, my + 4],
      [mx + 5, my + 4],
      [mx + 7, my + 36],
      [mx + 1, my + 36],
    ],
    F('#2a2a30', '#141418', '#55555e'),
    1660,
    { lw: 1 },
  );
  st.shape(ctx, ellipsePts(mx + 1, my - 4, 11, 11, 0, 24), F('#d9dee3', '#9aa3ab', '#ffffff'), 1661, { lw: 1.1, light: [mx - 4, my - 10] });
  ctx.strokeStyle = 'rgba(70,80,90,0.55)';
  ctx.lineWidth = 0.8;
  for (let k = -8; k <= 8; k += 4) {
    ctx.beginPath();
    ctx.moveTo(mx + 1 + k, my - 14);
    ctx.lineTo(mx + 1 + k, my + 6);
    ctx.moveTo(mx - 10, my - 4 + k);
    ctx.lineTo(mx + 12, my - 4 + k);
    ctx.stroke();
  }
  // (the channel's flag on the mic)
  st.shape(ctx, roundRectPts(mx - 7, my + 8, 16, 11, 2), F('#c0392b', '#962a1f', '#e8685e'), 1662, { lw: 0.8 });
  ctx.fillStyle = '#fff';
  ctx.font = '900 7px Nunito, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('WWS', mx + 1, my + 16);
  // the hand round it
  st.shape(ctx, ellipsePts(mx + 2, my + 22, 8, 7, 0, 16), SKIN, 1663, { lw: 1 });
  st.shape(
    ctx,
    [
      [cx - 10, 100],
      [mx - 4, my + 26],
      [mx + 4, my + 30],
      [cx - 4, 112],
    ],
    BLAZER,
    1664,
    { lw: 1 },
  );
}
