// Sheet 5: the ending. King Bob loses, leaps into the sea as in Boss 5, but this time the hero casts
// after him and reels him in.
import type { Ctx } from '../../src/gfx/draw';
import { rng } from '../../src/gfx/draw';
import { BOWL, drawDrop, drawStarburst } from '../../src/gfx/fishing';
import { drawHook, drawRod } from '../../src/gfx/fishing6';
import { BOWL_K, ROD_LEN, at, canvasOf, caption, crop, drawHero, drawKing, drawKingBowl, drawPlacedBoat, frame, gameBubble, sheetHead, text } from './common';
import { HORIZON, SHIP, WATER, rain, stormBack, stormSurface, vignette, type View } from './storm';
import { onShip, ROLL, shoot } from './rain';

const W = 1800;

/** Drops thrown up and out from (x, y): a fountain of them (n), up to `up` high. */
export function fountain(ctx: Ctx, x: number, y: number, n: number, up: number, spread: number, seed: number) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (r() - 0.5) * spread;
    const d = up * (0.3 + r() * 0.7);
    const s = 3 + r() * 4;
    ctx.save();
    ctx.translate(x + Math.cos(a) * d - s, y + Math.sin(a) * d - s);
    drawDrop(ctx, s);
    ctx.restore();
  }
}
/** A big splash at the surface: a white crown of water, spray, a ring of foam, drops flying. */
export function bigSplash(ctx: Ctx, x: number, y: number, k: number, seed: number) {
  ctx.save();
  // the crown: white sheets of water fanning up
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
    ctx.moveTo(x + (dx - w / 2) * k, y);
    ctx.quadraticCurveTo(x + (dx - w * 0.2 + dx * 0.25) * k, y - h * 0.6 * k, x + (dx * 1.3) * k, y - h * k);
    ctx.quadraticCurveTo(x + (dx + w * 0.3 + dx * 0.2) * k, y - h * 0.5 * k, x + (dx + w / 2) * k, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  // foam on the water round it
  ctx.fillStyle = 'rgba(244,251,252,0.95)';
  const r = rng(seed);
  for (let i = 0; i < 18; i++) {
    ctx.beginPath();
    ctx.arc(x + (r() - 0.5) * 200 * k, y + (r() - 0.3) * 10 * k, (6 + r() * 10) * k, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  fountain(ctx, x, y - 40 * k, 26, 180 * k, 2.2, seed + 1);
}
/** Speed lines / a dotted path along points. */
function dotted(ctx: Ctx, pts: { x: number; y: number }[], col = 'rgba(255,255,255,0.75)') {
  ctx.save();
  ctx.strokeStyle = col;
  ctx.lineWidth = 4;
  ctx.setLineDash([2, 14]);
  ctx.lineCap = 'round';
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.stroke();
  ctx.restore();
}
/** King Bob's leap: the quadratic from the bowl to the sea over the stern (as FishingScene.kingLeaves). */
function leap(t: number) {
  const k = at(SHIP, ...SHIP.boat.king);
  const x0 = k.x + 2 * BOWL_K;
  const y0 = k.y - (BOWL.h - BOWL.cy - 10) * BOWL_K;
  const land = { x: SHIP.x0 + 1172 * 1.18 + 240, y: WATER + 8 };
  const peak = Math.min(y0, land.y) - 150;
  const u = 1 - t;
  const cx = (x0 + land.x) / 2;
  return { x: u * u * x0 + 2 * u * t * cx + t * t * land.x, y: u * u * y0 + 2 * u * t * peak + t * t * land.y };
}
/** A big comic word (Lilita, gold, a dark outline), tilted. */
function boom(ctx: Ctx, s: string, x: number, y: number, size: number, rot = -0.08, col = '#ffd23f') {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  text(ctx, s, 0, 0, { size, align: 'center', col, stroke: '#3a2418' });
  ctx.restore();
}
/** Confetti scattered over a box. */
function confetti(ctx: Ctx, v: View, n: number, seed: number) {
  const r = rng(seed);
  const cols = ['#ff5a5f', '#ffd23f', '#4fd1ff', '#7be07b', '#c77dff', '#ff9a3c'];
  for (let i = 0; i < n; i++) {
    ctx.save();
    ctx.translate(v.x + r() * v.w, v.y + r() * v.h * 0.8);
    ctx.rotate(r() * 6);
    ctx.fillStyle = cols[i % cols.length];
    ctx.fillRect(-5, -3, 10, 6);
    ctx.restore();
  }
}

/** The boat and King Bob's bowl (empty once he's out), the shot's back and the cast. */
function shipWith(ctx: Ctx, kingIn: boolean, crew: () => void) {
  const k = at(SHIP, ...SHIP.boat.king);
  onShip(ctx, ROLL, () => {
    drawPlacedBoat(ctx, SHIP, 0.2);
    drawKingBowl(ctx, k.x, k.y, { empty: !kingIn });
    crew();
  });
}
const hero = () => at(SHIP, ...SHIP.boat.hero);

/** 1: he loses, and he's off: up out of his bowl and over the stern. */
function frame1(ctx: Ctx, v: View) {
  stormBack(ctx, v);
  shipWith(ctx, false, () => {
    const h = hero();
    // the hero, rod up, watching him go (eyes up, mouth an O)
    const hands = drawHero(ctx, 'puffy', h.x, h.y, { a: -1.9, face: { lookX: 0.6, lookY: -1, blink: false, mouth: 'o' } });
    drawRod(ctx, hands.x, hands.y, -2.15, ROD_LEN, 0);
    // water slopping out of the empty bowl
    const k = at(SHIP, ...SHIP.boat.king);
    fountain(ctx, k.x, k.y - (BOWL.h - 20) * BOWL_K, 14, 90, 1.6, 4);
  });
  const path = Array.from({ length: 30 }, (_, i) => leap(i / 29));
  dotted(ctx, path.slice(4, 26));
  const p = leap(0.6);
  drawKing(ctx, p.x, p.y, { rot: 0.3, f: 'sw2' });
  // whoosh lines behind him
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  for (const [dx, dy, l] of [
    [-90, 0, 50],
    [-80, 24, 36],
    [-84, -24, 36],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(p.x + dx, p.y + dy + 20);
    ctx.lineTo(p.x + dx - l, p.y + dy + 34);
    ctx.stroke();
  }
  ctx.restore();
  // where he's going: a target ring on the water
  const land = leap(1);
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(land.x, WATER - 2, 46, 10, 0, 0, Math.PI * 2);
  ctx.stroke();
  stormSurface(ctx, v);
  rain(ctx, v, ['far', 'mid', 'near'], 0.1);
  gameBubble(ctx, "Ha! You'll NEVER catch me!", p.x + 40, p.y - 50, { k: 1.5 });
  vignette(ctx, v, 0.4);
}

/** 2: not so fast: the hero whips a cast out after him. */
function frame2(ctx: Ctx, v: View) {
  stormBack(ctx, v);
  // King Bob, under the water, swimming off (a trail of bubbles), a ring where he went in
  const kx = 1520;
  const ky = WATER + 78;
  drawKing(ctx, kx, ky, { f: 'sw3', rot: 0.05 });
  ctx.strokeStyle = 'rgba(220,245,255,0.8)';
  ctx.lineWidth = 2;
  for (const [x, y, r] of [
    [kx - 80, ky - 10, 7],
    [kx - 110, ky - 28, 5],
    [kx - 140, ky - 44, 8],
    [kx - 165, ky - 60, 4],
  ] as const) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  let tip = { x: 0, y: 0 };
  shipWith(ctx, false, () => {
    const h = hero();
    // the follow-through: arms forward (c7), the rod whipped forward and still flexing
    const hands = drawHero(ctx, 'puffy', h.x, h.y, { a: -0.15, lean: 0.06 });
    tip = drawRod(ctx, hands.x, hands.y, -0.62, ROD_LEN, -0.35);
  });
  // the tip's streak through the cast, the lure's trail arcing out over him
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 12;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(tip.x - 150, tip.y + 170, 230, -1.9, -0.75);
  ctx.stroke();
  ctx.restore();
  const lure = { x: kx + 10, y: 250 };
  const trail = Array.from({ length: 16 }, (_, i) => {
    const t = i / 15;
    return { x: tip.x + (lure.x - tip.x) * t, y: tip.y + (lure.y - tip.y) * t - Math.sin(t * Math.PI) * 140 };
  });
  trail.forEach((q, i) => {
    ctx.fillStyle = `rgba(255,255,255,${0.15 + 0.5 * (i / 15)})`;
    ctx.beginPath();
    ctx.arc(q.x, q.y, 2 + 3 * (i / 15), 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(tip.x, tip.y);
  ctx.quadraticCurveTo((tip.x + lure.x) / 2, tip.y - 120, lure.x, lure.y);
  ctx.stroke();
  drawHook(ctx, lure.x + 6, lure.y + 22, 20);
  stormSurface(ctx, v);
  // the ring where he went in
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(1430, WATER - 4, 70, 12, 0, 0, Math.PI * 2);
  ctx.stroke();
  rain(ctx, v, ['far', 'mid', 'near'], 0.4);
  const h = hero();
  gameBubble(ctx, 'Not so fast, King Bob!', h.x + 10, h.y - 150, { k: 1.5, lift: 50 });
  vignette(ctx, v, 0.4);
}

/** 3: GOTCHA! Hooked by the lip and yanked out of the sea, the rod bent right over. */
function frame3(ctx: Ctx, v: View) {
  stormBack(ctx, v);
  const kx = 1470;
  const ky = 330;
  let tip = { x: 0, y: 0 };
  shipWith(ctx, false, () => {
    const h = hero();
    // leaning right back, arms up, heaving
    const hands = drawHero(ctx, 'puffy', h.x, h.y, { a: -1.55, lean: -0.2, face: { lookX: 1, lookY: -0.4, blink: false, mouth: 'open' } });
    tip = drawRod(ctx, hands.x, hands.y, -1.05, ROD_LEN, 0.95);
  });
  // the catch's gold burst behind him
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.translate(kx - 200, ky - 200);
  drawStarburst(ctx, 400);
  ctx.restore();
  stormSurface(ctx, v);
  bigSplash(ctx, kx + 10, WATER - 6, 1.25, 8);
  // King Bob, out of the water, cross, his crown knocked sideways; the hook in his lip, the line tight
  const rot = -0.45;
  const K = 0.98 * BOWL_K;
  const lip = { x: kx + (32 * Math.cos(rot) - 16 * Math.sin(rot)) * K, y: ky + (32 * Math.sin(rot) + 16 * Math.cos(rot)) * K };
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(tip.x, tip.y);
  ctx.lineTo(lip.x, lip.y - 4);
  ctx.stroke();
  drawKing(ctx, kx, ky, { rot, f: 'sw1', mad: true, askew: true });
  drawHook(ctx, lip.x + 3, lip.y + 6, 18);
  fountain(ctx, kx, ky + 40, 14, 120, 3, 12);
  rain(ctx, v, ['far', 'mid', 'near'], 0.7);
  boom(ctx, 'GOTCHA!', v.x + v.w * 0.3, v.y + v.h * 0.17, 84);
  gameBubble(ctx, 'HEY!! Unhand me, I am a KING!', kx + 60, ky - 70, { k: 1.5 });
  vignette(ctx, v, 0.35);
}

/** 4: the king is caught: held up high in triumph, the storm breaking up, confetti. */
function frame4(ctx: Ctx, v: View) {
  let kingAt = { x: 0, y: 0 };
  stormBack(ctx, v, { clearing: 0.75 });
  shipWith(ctx, false, () => {
    const h = hero();
    // rod held up high, King Bob reeled right up and dangling off the end by his lip
    const hands = drawHero(ctx, 'puffy', h.x, h.y, { a: -1.55, face: { lookX: 1, lookY: -0.6, blink: false, mouth: 'open' } });
    const tip = drawRod(ctx, hands.x, hands.y, -1.15, ROD_LEN, 0.45);
    const lip = { x: tip.x + 4, y: tip.y + 30 };
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tip.x, tip.y);
    ctx.lineTo(lip.x, lip.y);
    ctx.stroke();
    const rot = -1.45;
    const K = 0.98 * BOWL_K;
    const off = { x: (32 * Math.cos(rot) - 16 * Math.sin(rot)) * K, y: (32 * Math.sin(rot) + 16 * Math.cos(rot)) * K };
    drawKing(ctx, lip.x - off.x, lip.y - off.y, { rot, f: 'sw4', mad: true, askew: true });
    drawHook(ctx, lip.x + 2, lip.y + 8, 16);
    // dripping
    const r = rng(21);
    for (let i = 0; i < 8; i++) {
      const sz = 2.5 + r() * 2.5;
      ctx.save();
      ctx.translate(lip.x - off.x + (r() - 0.5) * 60 - sz, lip.y - off.y + 60 + r() * 90);
      drawDrop(ctx, sz);
      ctx.restore();
    }
    kingAt = { x: lip.x - off.x, y: lip.y - off.y };
  });
  stormSurface(ctx, v);
  // a sunbeam through the break in the clouds
  ctx.save();
  const g = ctx.createLinearGradient(0, v.y, 0, WATER);
  g.addColorStop(0, 'rgba(255,236,170,0.45)');
  g.addColorStop(1, 'rgba(255,236,170,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(v.x + v.w * 0.62, v.y);
  ctx.lineTo(v.x + v.w * 0.86, v.y);
  ctx.lineTo(v.x + v.w * 0.98, WATER);
  ctx.lineTo(v.x + v.w * 0.38, WATER);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  rain(ctx, v, ['far'], 0.2);
  confetti(ctx, v, 70, 3);
  gameBubble(ctx, 'Put me DOWN! This is MOST un-royal!', kingAt.x + 50, kingAt.y - 40, { k: 1.25 });
  // the show's lower third: what you caught
  ctx.save();
  const x = v.x + 30;
  const y = v.y + v.h - 120;
  ctx.fillStyle = 'rgba(30,20,16,0.9)';
  ctx.beginPath();
  ctx.roundRect(x, y, 420, 92, 12);
  ctx.fill();
  ctx.fillStyle = '#f29a1d';
  ctx.fillRect(x, y, 10, 92);
  ctx.restore();
  text(ctx, 'YOU CAUGHT', x + 26, y + 30, { font: 'body', weight: 900, size: 16, col: '#f2c94c' });
  text(ctx, 'KING BOB!', x + 24, y + 70, { size: 40, col: '#fff6d8' });
  text(ctx, '212 lb · ROYAL CATCH', x + 400, y + 30, { font: 'body', weight: 900, size: 16, col: '#e8d2a6', align: 'right' });
}

export function endingSheet() {
  const { c, ctx } = canvasOf(W, 2000);
  let y = sheetHead(
    ctx,
    W,
    2000,
    'Puffy · Boss 6 concept · 5 of 5',
    'The ending: this time, you catch him',
    "As in Boss 5, beaten King Bob leaps out of his bowl and over the stern. This time the hero casts after him, hooks him, and holds him up in triumph, King Bob outraged and his crown knocked sideways. Bubbles in Boss 5's own style.",
  );
  const fw = (W - 96 - 24) / 2;
  const fh = Math.round((fw * 9) / 16);
  const frames: [View, (c: Ctx, v: View) => void, string, string][] = [
    [{ x: 660, y: -170, w: 1240, h: 697.5 }, frame1, 'Off he goes!', 'King Bob loses and does his Boss 5 exit: a wriggle, then up out of the bowl in a big arc over the stern, water slopping after him. The hero watches, mouth open. (The dotted arc is his path; the ring shows where he’ll land.)'],
    [{ x: 700, y: 30, w: 1240, h: 697.5 }, frame2, 'Not so fast!', 'He’s under, swimming for it. The hero whips a cast out after him: the rod tip’s streak, the lure’s trail arcing out over the water, straight at him.'],
    [{ x: 880, y: -20, w: 1020, h: 573.75 }, frame3, 'GOTCHA!', 'Hooked by the lip! He bursts out of the sea in a huge splash, the rod bent right over, the hero heaving back. King Bob is outraged, crown knocked sideways. The gold catch burst the game already uses goes off behind him.'],
    [{ x: 740, y: -60, w: 840, h: 472.5 }, frame4, 'The king is caught!', 'Reeled right up and held high: King Bob dangles off the end of the line by his lip, furious, dripping, his crown knocked sideways; the hero beams. The storm breaks: a sunbeam, confetti, and the show\u2019s lower third, YOU CAUGHT KING BOB!'],
  ];
  frames.forEach(([v, fn, title, note], i) => {
    const x = 48 + (i % 2) * (fw + 24);
    const fy = y + Math.floor(i / 2) * (fh + 190);
    frame(ctx, x, fy, fw, fh, () => shoot(ctx, v, fw, () => fn(ctx, v)));
    caption(ctx, String(i + 1), title, note, x, fy + fh + 14, fw);
  });
  void HORIZON;
  return crop(c, y + 2 * (fh + 190));
}
