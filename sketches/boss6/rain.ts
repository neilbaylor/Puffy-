// Sheet 2: the rainy scene. The contest in full (16:9), a lightning flash, the light-mode version,
// and the rain's layers on their own.
import type { Ctx } from '../../src/gfx/draw';
import { RAIN_LAYERS, RAIN_SLANT, drawDeckSplash, drawRainTile, drawSeaSplash, type RainLayer } from '../../src/gfx/fishing6';
import { at, canvasOf, crop, caption, drawKingBowl, drawPlacedBoat, frame, heroWithRod, para, sheetHead, text, gameBubble, BOWL_K } from './common';
import { SHIP, WATER, deckSplashes, floatBobber, rain, seaSplashes, stormBack, stormSurface, vignette, type StormOpts, type View } from './storm';
import { drawKing } from './common';
import { BOWL } from '../../src/gfx/fishing';

const W = 1800;
/** The contest's shot: the stern half of the boat and the sea off to the right (the bow off the left). */
export const CONTEST_VIEW: View = { x: 0, y: -200, w: 1600, h: 900 };
/** The boat rolls a touch in the swell (radians, about the middle of her waterline). */
export const ROLL = -0.018;

/** Turn the boat and all aboard her by the roll. */
export function onShip(ctx: Ctx, roll: number, fn: () => void) {
  const px = SHIP.x0 + (SHIP.boat.w * 1.18) / 2;
  ctx.save();
  ctx.translate(px, WATER);
  ctx.rotate(roll);
  ctx.translate(-px, -WATER);
  fn();
  ctx.restore();
}

/** Where rain splashes on the boat (picture points): the cockpit, the flybridge, the hardtop, the tower, the foredeck. */
const DECK_HITS: [number, number][] = [
  [900, 424], [990, 426], [1040, 428], [1140, 430], [1166, 432],
  [470, 268], [540, 266], [690, 266], [780, 266],
  [470, 171], [580, 170], [690, 170], [760, 171],
  [600, -2], [664, -2],
  [120, 362], [200, 392], [280, 404],
];

/** The contest in the storm: both lines out, bobbers on the swell. */
export function contestScene(ctx: Ctx, v: View, o: StormOpts & { splashes?: boolean } = {}) {
  const light = !!o.light;
  stormBack(ctx, v, o);
  if (!light && o.splashes !== false) seaSplashes(ctx, v, 70, 9);
  const k = at(SHIP, ...SHIP.boat.king);
  const h = at(SHIP, ...SHIP.boat.hero);
  let tips: { hero: { x: number; y: number }; king: { x: number; y: number } } = { hero: { x: 0, y: 0 }, king: { x: 0, y: 0 } };
  onShip(ctx, ROLL, () => {
    drawPlacedBoat(ctx, SHIP, o.flash ? 0 : light ? 0.12 : 0.2);
    drawKingBowl(ctx, k.x, k.y, { rod: false });
    // (his rod: drawn here so its tip is known for the line)
    tips = {
      king: rodFromBowl(ctx, k.x, k.y),
      hero: heroWithRod(ctx, 'puffy', h.x, h.y, { a: -1.55, rodA: -1.2, bend: 0.12, bobber: false }).tip,
    };
    if (!light && o.splashes !== false) deckSplashes(ctx, DECK_HITS.map(([x, y]) => at(SHIP, x, y - 15)), 3, 18);
  });
  floatBobber(ctx, 1330, tips.king, true);
  floatBobber(ctx, 1490, tips.hero);
  stormSurface(ctx, v, o, (o.t ?? 0) * 40);
  if (o.flash) {
    ctx.fillStyle = 'rgba(235,235,255,0.12)';
    ctx.fillRect(v.x, v.y, v.w, v.h);
  }
  rain(ctx, v, light ? ['mid'] : ['far', 'mid', 'near'], o.t ?? 0, !!o.flash);
  if (!light) vignette(ctx, v, o.flash ? 0.2 : 0.45);
}

/** King Bob's gold rod out of his bowl (at its stand's foot x, y); returns the tip. */
import { drawRod } from '../../src/gfx/fishing6';
export function rodFromBowl(ctx: Ctx, x: number, y: number, a = -1.1, bend = 0.1) {
  return drawRod(ctx, x + 44 * BOWL_K, y + (-BOWL.h + 30) * BOWL_K, a, 150, bend, { king: true });
}

/** Draw a scene for view v into a box w px wide (16:9) at the current origin. */
export function shoot(ctx: Ctx, v: View, w: number, fn: () => void) {
  ctx.save();
  ctx.scale(w / v.w, w / v.w);
  ctx.translate(-v.x, -v.y);
  fn();
  ctx.restore();
}

export function rainSheet() {
  const H = 3400;
  const { c, ctx } = canvasOf(W, H);
  let y = sheetHead(
    ctx,
    W,
    H,
    'Puffy · Boss 6 concept · 2 of 5',
    'The rematch in the rain',
    'The contest as it would look (option A, the Reel Royal II): a dark storm sky with heavy clouds, big dark swells with whitecaps, rain in three layers, splashes on the deck and the sea. Then a lightning flash, and the light mode for slow tablets.',
  );
  const fw = W - 96;
  const fh = Math.round((fw * 9) / 16);
  frame(ctx, 48, y, fw, fh, () => shoot(ctx, CONTEST_VIEW, fw, () => {
    contestScene(ctx, CONTEST_VIEW, { t: 0.3 });
    const k = at(SHIP, ...SHIP.boat.king);
    void k;
  }));
  y += fh + 16;
  y = para(ctx, 'Full detail. Back to front: sky gradient · far clouds with rain curtains under them · mid and low clouds (dark bellies, pale tops) · three rows of swells, whitecaps blowing off · the deep, murky · the boat (shaded a touch darker for the storm; the heroes and King Bob are not, so they still pop) · the near surface, a taller swell than Boss 5 · splashes on the sea and on every deck, the hardtop, the tower · rain far, mid and near · a dark vignette.', 48, y + 10, fw, { size: 19 });
  y += 30;

  // ── the flash, and light mode ──
  const sw = (fw - 24) / 2;
  const sh = Math.round((sw * 9) / 16);
  frame(ctx, 48, y, sw, sh, () => shoot(ctx, CONTEST_VIEW, sw, () => contestScene(ctx, CONTEST_VIEW, { flash: true, t: 0.6 })));
  frame(ctx, 48 + sw + 24, y, sw, sh, () => shoot(ctx, CONTEST_VIEW, sw, () => contestScene(ctx, CONTEST_VIEW, { light: true, t: 0.3 })));
  y += sh + 14;
  caption(ctx, '⚡', 'Lightning flash', 'Every so often (and as King Bob lands a big one): the sky and clouds swap to their lit-up colours for a few frames, a bolt cracks down to the horizon, the water goes pale, thunder a beat later. Two sets of sky/cloud/sea pictures, swapped: no extra cost while it shows.', 48, y, sw);
  caption(ctx, 'L', 'Light mode (slow tablets)', 'One rain layer (mid) instead of three; one band of plain clouds, no curtains; two rows of swells; no splashes, no vignette. The boat, the bobbers and the heroes stay the same: it still reads as a storm.', 48 + sw + 24, y, sw);
  y += 190;

  // ── the rain layers ──
  text(ctx, 'The rain, layer by layer', 48, y + 30, { size: 40, col: '#ffc533' });
  y = para(ctx, 'Each layer is one small tile (256 × 256, seamless) on a TileSprite the size of the screen, scrolled down and a little sideways by the wind each frame. Different sizes, brightness and speeds give the depth; that’s three textures and three quads, cheap even on old tablets.', 48, y + 64, fw, { size: 19 });
  y += 10;
  const tw = (fw - 3 * 24) / 4;
  const layers: [RainLayer, string][] = [
    ['far', 'Far'],
    ['mid', 'Mid'],
    ['near', 'Near'],
  ];
  layers.forEach(([l, name], i) => {
    const x = 48 + i * (tw + 24);
    frame(ctx, x, y, tw, tw, () => {
      ctx.fillStyle = '#2a3346';
      ctx.fillRect(0, 0, tw, tw);
      const { c: t, ctx: tc } = canvasOf(256, 256);
      drawRainTile(tc, l, { far: 61, mid: 62, near: 63 }[l]);
      const s = tw / 256;
      ctx.drawImage(t, 0, 0, 256 * s, 256 * s);
    });
    const L = RAIN_LAYERS[l];
    text(ctx, name, x, y + tw + 40, { size: 30 });
    para(ctx, `${L.n} streaks a tile, ~${L.len} px long, ${L.w} px wide, ${Math.round(L.a * 100)}% at most · falls ${L.speed} px/s, ${Math.round(L.speed * RAIN_SLANT)} px/s sideways${l === 'mid' ? ' · the only layer in light mode' : ''}`, x, y + tw + 72, tw, { size: 17 });
  });
  {
    const x = 48 + 3 * (tw + 24);
    frame(ctx, x, y, tw, tw, () => {
      ctx.fillStyle = '#2a3346';
      ctx.fillRect(0, 0, tw, tw);
      const s = tw / 256;
      ctx.scale(s, s);
      for (const l of ['far', 'mid', 'near'] as const) drawRainTile(ctx, l, { far: 61, mid: 62, near: 63 }[l]);
    });
    text(ctx, 'All three', x, y + tw + 40, { size: 30 });
    para(ctx, 'Stacked. In the game they move at their own speeds, so the near streaks whip past and the far ones drift: depth without any 3D.', x, y + tw + 72, tw, { size: 17 });
  }
  y += tw + 200;
  // ── splashes ──
  text(ctx, 'Splashes', 48, y + 10, { size: 40, col: '#ffc533' });
  para(ctx, 'Small sprites, a few frames each, popped at random spots on the decks and the water (a pool of ~20; none in light mode). On the deck: a crown of drops; on the sea: a ring and a little jet.', 48, y + 44, fw, { size: 19 });
  y += 70;
  frame(ctx, 48, y, fw, 220, () => {
    ctx.fillStyle = '#2a3346';
    ctx.fillRect(0, 0, fw, 110);
    ctx.fillStyle = '#2f7486';
    ctx.fillRect(0, 110, fw, 110);
    ctx.fillStyle = '#b5773a';
    ctx.fillRect(0, 84, fw / 2 - 20, 26);
    for (let i = 0; i < 5; i++) drawDeckSplash(ctx, 80 + i * 160, 92, 26 + i * 8);
    for (let i = 0; i < 5; i++) drawSeaSplash(ctx, fw / 2 + 60 + i * 160, 180, 28 + i * 8, 0.9);
  });
  y += 260;
  void gameBubble;
  void drawKing;
  return crop(c, y);
}
