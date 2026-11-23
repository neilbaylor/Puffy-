// Sheet 3: the show's host (Chuck Rivers, Boss 5's intro) announcing the rematch from the dock, in
// the rain, in a yellow oilskin and sou'wester; on the old telly with its closed captions, as Boss 5.
import type { Ctx } from '../../src/gfx/draw';
import { rng } from '../../src/gfx/draw';
import { DOCK, HOST, drawDock, drawHost } from '../../src/gfx/fishing';
import { drawDeckSplash } from '../../src/gfx/fishing6';
import { drawDrop } from '../../src/gfx/fishing';
import { canvasOf, caption, crop, frame, sheetHead, text, wrap, BODY, DISPLAY } from './common';
import { WATER, rain, stormBack, stormSurface, seaSplashes, type View } from './storm';
import { shoot } from './rain';

const W = 1800;
/** As in FishingScene: the dock, its deck, the host on it. */
const DOCK_X = -2700;
const DOCK_TOP = WATER - 58;
const HOST_X = DOCK_X + 470;
const HOST_K = 0.92;
/** The game's shot of him (its camera at zoom 2, on him). */
const HOST_VIEW: View = { x: -2480, y: 190, w: 640, h: 360 };

function host(ctx: Ctx, f: string, rain = true) {
  ctx.save();
  ctx.translate(HOST_X - 62 * HOST_K, DOCK_TOP - 12 - 186 * HOST_K);
  ctx.scale(HOST_K, HOST_K);
  drawHost(ctx, f, rain);
  ctx.restore();
}

/** The dock in the storm: the host on it, puddles, splashes, drips off his hat. */
function dockScene(ctx: Ctx, v: View, f: string, t: number) {
  stormBack(ctx, v, { clouds: { dx: v.x - 80, dy: 220, k: 0.62 } });
  seaSplashes(ctx, v, 30, 4);
  ctx.save();
  ctx.translate(DOCK_X, DOCK_TOP - DOCK.deck);
  drawDock(ctx);
  ctx.restore();
  // puddles on the planks, rain bouncing off them
  ctx.fillStyle = 'rgba(190,215,235,0.35)';
  for (const [x, w] of [
    [-2440, 60],
    [-2330, 40],
    [-2060, 70],
    [-1930, 46],
  ] as const) {
    ctx.beginPath();
    ctx.ellipse(x, DOCK_TOP - 12, w / 2, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const r = rng(17);
  for (let i = 0; i < 12; i++) drawDeckSplash(ctx, v.x + 20 + r() * (v.w - 40), DOCK_TOP - 8 - r() * 16, 10 + r() * 8);
  host(ctx, f);
  // drips running off the back of his hat's brim
  const shock = f.startsWith('s');
  const bx = HOST_X - 62 * HOST_K + (60 - 52) * HOST_K;
  const by = DOCK_TOP - 12 - 186 * HOST_K + (48 + 12 - (shock ? 16 : 0)) * HOST_K;
  for (const [dx, dy, s] of [
    [0, 8, 2.6],
    [-4, 22, 2],
    [6, 30, 1.6],
  ] as const) {
    ctx.save();
    ctx.translate(bx + dx - s, by + dy - s);
    drawDrop(ctx, s);
    ctx.restore();
  }
  stormSurface(ctx, v, {}, t * 30);
  rain(ctx, v, ['far', 'mid', 'near'], t);
}

/** Draw the shot (fn) through the old telly into the box (0, 0, w, h) of ctx. */
function tvShot(ctx: Ctx, w: number, h: number, v: View, fn: (o: Ctx) => void, cc: string, title: [string, string, string]) {
  const { c, ctx: o } = canvasOf(w, h);
  shoot(o, v, w, () => fn(o));
  ctx.save();
  ctx.filter = 'sepia(0.5) saturate(0.85) contrast(1.08) brightness(1.03)';
  ctx.drawImage(c, 0, 0);
  ctx.restore();
  // scanlines, the dark edges, the bezel
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
  const g = ctx.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.62);
  g.addColorStop(0, 'rgba(10,6,2,0)');
  g.addColorStop(1, 'rgba(10,6,2,0.6)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.strokeStyle = '#120d08';
  ctx.lineWidth = 20;
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, [34]);
  ctx.stroke();
  ctx.restore();
  // the title card, top left (skewed, a brown box, coloured stripes off its right edge)
  ctx.save();
  ctx.translate(30, 26);
  ctx.transform(1, 0, -0.14, 1, 0, 0);
  const tw = 250;
  for (const [i, col] of [
    [3, '#6ba36b'],
    [2, '#f2c94c'],
    [1, '#e8582a'],
  ] as const) {
    ctx.fillStyle = col;
    ctx.fillRect(0, 0, tw + i * 6, 84);
  }
  ctx.fillStyle = '#3a2414';
  ctx.fillRect(0, 0, tw, 84);
  ctx.fillStyle = '#f29a1d';
  ctx.fillRect(0, 0, 8, 84);
  text(ctx, title[0], 20, 22, { font: 'body', weight: 900, size: 11, col: '#f2c94c' });
  ctx.save();
  ctx.font = `italic 400 34px ${DISPLAY}`;
  ctx.fillStyle = '#e8582a';
  ctx.fillText(title[1], 21, 59);
  ctx.fillStyle = '#fff6d8';
  ctx.fillText(title[1], 18, 56);
  ctx.restore();
  text(ctx, title[2], 20, 76, { font: 'body', weight: 800, size: 10, col: '#e8d2a6' });
  ctx.restore();
  // the bug, top right
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.strokeStyle = '#fff6d8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(w - 76, 50, 36, 24, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.font = `italic 400 22px ${DISPLAY}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#b5501f';
  ctx.fillText('WWS', w - 74, 53);
  ctx.fillStyle = '#fff6d8';
  ctx.fillText('WWS', w - 76, 51);
  ctx.font = `900 8px ${BODY}`;
  ctx.fillStyle = '#ff8a3c';
  ctx.fillText('L I V E', w - 76, 64);
  ctx.restore();
  // the closed captions, bottom middle: white Courier on black
  ctx.save();
  ctx.font = `700 19px "Courier New", Courier, monospace`;
  const lines = wrap(ctx, cc.toUpperCase(), w * 0.78);
  const lw = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 24;
  const lh = 25;
  const bh = lines.length * lh + 10;
  const by = h * 0.92 - bh;
  ctx.fillStyle = 'rgba(0,0,0,0.88)';
  ctx.fillRect(w / 2 - lw / 2, by, lw, bh);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  lines.forEach((l, i) => ctx.fillText(l, w / 2, by + 24 + i * lh));
  ctx.restore();
}

export function announcerSheet() {
  const { c, ctx } = canvasOf(W, 2000);
  let y = sheetHead(
    ctx,
    W,
    2000,
    'Puffy · Boss 6 concept · 3 of 5',
    'The announcer: rematch in the rain',
    "Chuck Rivers, the host from Boss 5's intro, on the dock in a yellow oilskin rain coat, wellies and a sou'wester (same face, body, bow tie and microphone: the rain gear is an option on his drawing). On the old telly with closed captions, as in Boss 5. The hero's name goes in line 2.",
  );
  const fw = (W - 96 - 24) / 2;
  const fh = Math.round((fw * 9) / 16);
  const title: [string, string, string] = ['THE WONDERFUL WORLD OF', 'SPORTS', 'CHUCK RIVERS · LIVE IN THE STORM'];
  const frames: [string, string, string, string][] = [
    ['t1', "Folks, it's raining cats and dogfish out here!", 'Rain gear on', 'Talking frame (t1): rain hammering the dock, puddles splashing, drips running off the back of his hat brim. A joke to open: the weather’s the first sign this one’s tougher.'],
    ['p1', 'But nothing stops the REMATCH! King Bob versus Puffy!', 'The rematch', 'Pointing off to the boat (p1), as in Boss 5. The hero’s name filled in as now.'],
    ['s1', "And this time... it's for ALL of Puff Ball Planet!", 'For the whole planet!', 'His shocked frame (s1) used for big excitement: a hand flung up, and his sou’wester jumps right up off his head.'],
  ];
  frames.forEach(([f, cc, t, note], i) => {
    const x = 48 + (i % 2) * (fw + 24);
    const fy = y + Math.floor(i / 2) * (fh + 170);
    frame(ctx, x, fy, fw, fh, () => tvShot(ctx, fw, fh, HOST_VIEW, (o) => dockScene(o, HOST_VIEW, f, i * 0.37), cc, title));
    caption(ctx, String(i + 1), t, note, x, fy + fh + 14, fw);
  });
  // the model sheet: him as in Boss 5, and in the rain gear (three frames), big, on paper
  {
    const x = 48 + fw + 24;
    const fy = y + fh + 170;
    frame(ctx, x, fy, fw, fh, () => {
      ctx.fillStyle = '#f4e9d4';
      ctx.fillRect(0, 0, fw, fh);
      const k = 1.3;
      const items: [string, boolean, string][] = [
        ['t0', false, 'Boss 5'],
        ['t1', true, 'Rain: talking'],
        ['p1', true, 'Rain: pointing'],
        ['s1', true, 'Rain: shocked'],
      ];
      items.forEach(([f, r, label], j) => {
        ctx.save();
        ctx.translate(14 + j * 202, 96);
        ctx.scale(k, k);
        drawHost(ctx, f, r);
        ctx.restore();
        text(ctx, label, 14 + j * 202 + 82, fh - 26, { size: 22, col: '#3a2418', align: 'center' });
      });
      void HOST;
    });
    caption(ctx, '★', 'On-model check', "Left: Boss 5's look. Right: the rain gear on the same drawing. For the game, his picture needs a bit more room up top for the hat (HOST_RAIN_UP).", x, fy + fh + 14, fw);
  }
  return crop(c, y + 2 * (fh + 170));
}
