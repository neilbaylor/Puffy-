// Sheet 4: King Bob before the match, in his bowl up on the flybridge in the rain: a glare and a
// taunt, a splashy somersault in his bowl (as Boss 5's kingFlip, bigger), and a landing, fins up.
import type { Ctx } from '../../src/gfx/draw';
import { BOWL, drawBowlBack, drawBowlFront, drawRipple } from '../../src/gfx/fishing';
import { drawRod } from '../../src/gfx/fishing6';
import { BOWL_K, KING_ROD_LEN, ROD_LEN, at, canvasOf, caption, crop, drawHero, drawKing, drawPlacedBoat, frame, gameBubble, sheetHead } from './common';
import { SHIP, rain, stormBack, stormSurface, vignette, type View } from './storm';
import { ROLL, onShip, shoot } from './rain';
import { fountain } from './ending';

const W = 1800;
const K = BOWL_K;
/** The bowl's foot, and King Bob's spot in it (as FishingScene.placeBoat). */
const bowl = () => at(SHIP, ...SHIP.boat.king);
const inBowl = () => {
  const b = bowl();
  return { x: b.x + 2 * K, y: b.y - (BOWL.h - BOWL.cy - 10) * K };
};
const rim = () => {
  const b = bowl();
  return { x: b.x, y: b.y - (BOWL.h - 22) * K };
};

/** The bowl in two halves round whatever's in it (King Bob, or nothing while he's up in the air). */
function bowlWith(ctx: Ctx, inside: () => void) {
  const b = bowl();
  const half = (fn: (c: Ctx) => void) => {
    ctx.save();
    ctx.translate(b.x - (BOWL.w / 2) * K, b.y - BOWL.h * K);
    ctx.scale(K, K);
    fn(ctx);
    ctx.restore();
  };
  half(drawBowlBack);
  inside();
  half(drawBowlFront);
}
/** Water slopping over the rim: sheets of it pouring down the glass either side, and drops. */
function slosh(ctx: Ctx, k: number, seed: number) {
  const r = rim();
  ctx.save();
  ctx.fillStyle = 'rgba(120,200,235,0.9)';
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth = 2;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(r.x + s * 30, r.y);
    ctx.quadraticCurveTo(r.x + s * (60 + 20 * k), r.y - 26 * k, r.x + s * (78 + 20 * k), r.y + 30 * k);
    ctx.quadraticCurveTo(r.x + s * (66 + 10 * k), r.y + 6, r.x + s * 44, r.y + 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
  fountain(ctx, r.x, r.y - 10, Math.round(16 * k), 110 * k, 2.6, seed);
}
/** Wobble lines round a crown (it's only just staying on). */
function wobble(ctx: Ctx, x: number, y: number, rot: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(0, 0, 30, s > 0 ? -0.5 : Math.PI - 0.1, s > 0 ? 0.1 : Math.PI + 0.5);
    ctx.stroke();
  }
  ctx.restore();
}

/** The shot round the flybridge: the boat, the hero below in the cockpit (in `withHero` shots), the rain. */
function shot(ctx: Ctx, v: View, t: number, inside: () => void, after?: () => void, withHero = true) {
  stormBack(ctx, v);
  onShip(ctx, ROLL, () => {
    drawPlacedBoat(ctx, SHIP, 0.2);
    if (withHero) {
      const h = at(SHIP, ...SHIP.boat.hero);
      const hands = drawHero(ctx, 'puffy', h.x, h.y, { a: -1.55, face: { lookX: -0.6, lookY: -1, blink: false, mouth: 'rest' } });
      drawRod(ctx, hands.x, hands.y, -1.85, ROD_LEN, 0);
    }
    bowlWith(ctx, inside);
    after?.();
  });
  stormSurface(ctx, v);
  rain(ctx, v, ['far', 'mid', 'near'], t);
  vignette(ctx, v, 0.4);
}
/** His gold rod, out of the bowl. */
const kingRod = (ctx: Ctx) => {
  const b = bowl();
  return drawRod(ctx, b.x + 44 * K, b.y + (-BOWL.h + 30) * K, -1.1, KING_ROD_LEN, 0, { king: true });
};

function frame1(ctx: Ctx, v: View) {
  shot(ctx, v, 0.1, () => {
    const p = inBowl();
    // glaring down at the hero: scowling, tipped forward
    drawKing(ctx, p.x, p.y, { f: 'sw0', mad: true, rot: 0.12 });
  }, () => kingRod(ctx));
  const r = rim();
  gameBubble(ctx, 'You were lucky last time!', r.x + 64, r.y + 6, { k: 1.4 });
}
function frame2(ctx: Ctx, v: View) {
  const p = inBowl();
  const up = { x: p.x + 10, y: p.y - 150 };
  shot(ctx, v, 0.3, () => {}, () => {
    slosh(ctx, 0.8, 5);
    // up and over: upside down at the top of his somersault, the crown hanging on
    drawKing(ctx, up.x, up.y, { f: 'sw2', rot: -Math.PI * 0.8 });
    wobble(ctx, up.x - 20, up.y + 34, -Math.PI * 0.8);
    // the arc of the flip
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 5;
    ctx.setLineDash([2, 14]);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(up.x + 10, up.y + 70, 110, 0.5, -1.35, true);
    ctx.stroke();
    ctx.restore();
  }, false);
}
function frame3(ctx: Ctx, v: View) {
  const p = inBowl();
  shot(ctx, v, 0.6, () => {
    // back in, nose first: SPLOOSH
    drawKing(ctx, p.x, p.y - 30, { f: 'sw4', rot: -Math.PI * 1.55, askew: true });
  }, () => {
    slosh(ctx, 1.4, 9);
    const r = rim();
    ctx.save();
    ctx.translate(r.x - 64, r.y - 4);
    ctx.scale(2, 1.4);
    drawRipple(ctx, 64, 18);
    ctx.restore();
  }, false);
}
function frame4(ctx: Ctx, v: View) {
  shot(ctx, v, 0.9, () => {
    const p = inBowl();
    // landed, facing the hero, fins up: bring it on
    drawKing(ctx, p.x, p.y, { f: 'sw1', mad: true, fins: true, rot: 0.06 });
  }, () => {
    kingRod(ctx);
    fountain(ctx, rim().x, rim().y - 6, 8, 40, 2.6, 13);
  });
  const r = rim();
  gameBubble(ctx, 'Not AGAIN!', r.x + 64, r.y + 6, { k: 1.6 });
}

export function kingIntroSheet() {
  const { c, ctx } = canvasOf(W, 2000);
  const y = sheetHead(
    ctx,
    W,
    2000,
    'Puffy · Boss 6 concept · 4 of 5',
    "King Bob's pre-match: a glare and a flip",
    "Before the first cast: King Bob in his bowl up on the flybridge, rain drumming on everything. A taunt, a splashy somersault in his bowl (Boss 5's kingFlip, bigger and wetter), and he lands facing the hero, fins up. Real King Bob frames and bowl; bubbles in Boss 5's style.",
  );
  const fw = (W - 96 - 24) / 2;
  const fh = Math.round((fw * 9) / 16);
  const wide: View = { x: 600, y: -190, w: 900, h: 506.25 };
  const close: View = { x: 540, y: -215, w: 700, h: 393.75 };
  const frames: [View, (c: Ctx, v: View) => void, string, string][] = [
    [wide, frame1, '"You were lucky last time!"', 'He glares down from the flybridge at the hero in the cockpit, scowling and red in the face, tipped forward in his water.'],
    [close, frame2, 'Up and over', 'A big somersault up out of his bowl: water slopping over the rim, the crown wobbling but hanging on.'],
    [close, frame3, 'SPLOOSH!', 'Back in nose first: a huge slosh pours over both sides of the bowl, the crown knocked crooked.'],
    [wide, frame4, '"Not AGAIN!"', 'Landed facing the hero, both fins thrown up: bring it on. (Fins up is a new option on his drawing; his crown has bounced back straight.)'],
  ];
  frames.forEach(([v, fn, title, note], i) => {
    const x = 48 + (i % 2) * (fw + 24);
    const fy = y + Math.floor(i / 2) * (fh + 150);
    frame(ctx, x, fy, fw, fh, () => shoot(ctx, v, fw, () => fn(ctx, v)));
    caption(ctx, String(i + 1), title, note, x, fy + fh + 14, fw);
  });
  return crop(c, y + 2 * (fh + 150));
}
