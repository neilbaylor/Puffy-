// Sheet 1: the bigger boat. Boss 5's boat for size, then the three options at game scale, a hero
// and King Bob on each.
import { BOATS6, drawDais, fillStops, drawSwells, drawStormWaveTile, STORM_WAVE, type Boat6 } from '../../src/gfx/fishing6';
import { BS, BOSS5, BOWL_K, at, canvasOf, drawKingBowl, drawPlacedBoat, frame, heroWithRod, para, sheetHead, text, type Placed } from './common';
import type { Ctx } from '../../src/gfx/draw';

const W = 1800;

/** A gentle overcast sea behind a boat (so the boat reads; the storm itself is the next sheet). */
function backdrop(ctx: Ctx, w: number, h: number, wy: number) {
  fillStops(ctx, 0, 0, w, wy, [[0, '#7d8ea6'], [0.7, '#b9c4cf'], [1, '#d6dcdc']]);
  ctx.save();
  ctx.translate(0, wy - 46);
  drawSwells(ctx, w, 60, 10, 8, 0.2, 5);
  ctx.restore();
  fillStops(ctx, 0, wy, w, h - wy, [[0, '#2f7486'], [1, '#123a55']]);
}
function nearWaves(ctx: Ctx, w: number, wy: number, k = 1) {
  const { c, ctx: t } = canvasOf(STORM_WAVE.w, STORM_WAVE.h);
  drawStormWaveTile(t);
  ctx.save();
  ctx.translate(0, wy - STORM_WAVE.top * 0.5 * k - 2);
  ctx.scale(0.5 * k, 0.5 * k);
  for (let x = 0; x < w / (0.5 * k); x += STORM_WAVE.w) ctx.drawImage(c, x, 0);
  ctx.restore();
}

/** The hero and King Bob on a placed boat (the tug's king on his dais). */
function crew(ctx: Ctx, p: Placed, id: 'sport' | 'tug' | 'cat' | 'boss5', hero: string) {
  const k = at(p, p.boat.king[0], p.boat.king[1]);
  if (id === 'tug') drawDais(ctx, k.x, k.y + 52);
  drawKingBowl(ctx, k.x, k.y);
  const h = at(p, p.boat.hero[0], p.boat.hero[1]);
  heroWithRod(ctx, hero, h.x, h.y);
}

export function boatsSheet() {
  const panelH = 900;
  const H = 1830 + 3 * (panelH + 120);
  const { c, ctx } = canvasOf(W, H);
  let y = sheetHead(
    ctx,
    W,
    H,
    'Puffy · Boss 6 concept · 1 of 5',
    "King Bob's Rematch: the bigger boat",
    "Three options for a bigger boat than Boss 5's Reel Royal, each drawn at game scale (1 px here = 1 world px, the stage is 1280 × 720) with a hero and King Bob in his bowl aboard. Bow to the left, the sea runs off to the right: the hero still casts off the stern.",
  );

  // ── the size line-up: Boss 5's boat and the three, side by side at the same scale ──
  y += 10;
  text(ctx, 'Side by side, same scale', 48, y + 30, { size: 34 });
  y += 50;
  const s = 0.285;
  const fh = 340;
  frame(ctx, 48, y, W - 96, fh + 60, () => {
    const wy = 300;
    backdrop(ctx, W - 96, fh + 60, wy);
    let x = 30;
    const list: [Placed['boat'], string, 'boss5' | 'sport' | 'tug' | 'cat', string][] = [
      [BOSS5, 'Boss 5: Reel Royal', 'boss5', 'puffy'],
      ...BOATS6.map((b, i): [Boat6, string, Boat6['id'], string] => [b, `${'ABC'[i]}: ${b.name}`, b.id, 'puffy']),
    ];
    for (const [b, label, id, hero] of list) {
      ctx.save();
      ctx.translate(x, wy);
      ctx.scale(s, s);
      const p: Placed = { boat: b, x0: 0, wy: 0 };
      drawPlacedBoat(ctx, p);
      crew(ctx, p, id, hero);
      ctx.restore();
      text(ctx, label, x + (b.w * BS * s) / 2, wy + 62, { size: 24, align: 'center', col: id === 'boss5' ? '#d8e4ea' : '#ffffff', stroke: '#1b1b2a' });
      text(ctx, `${Math.round(b.w * BS)} px long`, x + (b.w * BS * s) / 2, wy + 86, { font: 'body', size: 16, weight: 900, align: 'center', col: '#d8e4ea', stroke: '#1b1b2a' });
      x += b.w * BS * s + 28;
    }
    nearWaves(ctx, W - 96, wy, 0.5);
  });
  y += fh + 60 + 50;

  // ── each option, big ──
  const notes: Record<string, string[]> = {
    sport: [
      'A big navy sport-fisher: a flybridge with a hardtop, a tall tuna tower, outriggers, teak cockpit and a fighting chair.',
      'King Bob fishes from up on the flybridge (higher than you: his casts go further). You cast from the cockpit.',
      'Reads instantly as "the serious fishing boat"; same family as Boss 5 (white, navy, gold) but clearly bigger and darker.',
    ],
    tug: [
      'A chunky red royal tug: tyres all along the side, a fat bow fender, a cream wheelhouse with a giant gold crown on the roof, a gold funnel puffing smoke.',
      'King Bob sits on a red-carpet royal dais on the aft deck, right beside you: a face-off.',
      'The funniest silhouette and the most different from Boss 5. Smoke and the tyres move nicely in a storm.',
    ],
    cat: [
      'A purple-and-gold royal catamaran: two hulls, a trampoline net between the bows, a tall mast with the sail furled in its crown cover (it’s a storm), a fringed bimini.',
      'King Bob fishes from under the bimini at the helm, close behind you.',
      'Most elegant and regal; reads less as "fishing boat", and the mast makes it the tallest (more sky in shot).',
    ],
  };
  const heroes: Record<string, string> = { sport: 'puffy', tug: 'muscles', cat: 'scruffy' };
  BOATS6.forEach((b, i) => {
    text(ctx, `${'ABC'[i]} · ${b.name}`, 48, y + 34, { size: 40, col: '#ffc533' });
    ctx.font = `400 40px "Lilita One"`;
    text(ctx, b.kind, 48 + ctx.measureText(`${'ABC'[i]} · ${b.name}`).width + 28, y + 34, { font: 'body', size: 20, weight: 900, col: '#6ff0d8' });
    y += 54;
    frame(ctx, 48, y, W - 96, panelH, () => {
      const wy = panelH - 110;
      backdrop(ctx, W - 96, panelH, wy);
      const p: Placed = { boat: b, x0: (W - 96 - b.w * BS) / 2 - 40, wy };
      drawPlacedBoat(ctx, p);
      crew(ctx, p, b.id, heroes[b.id]);
      nearWaves(ctx, W - 96, wy);
      // the notes, up in the sky to the left of the boat
      ctx.save();
      ctx.fillStyle = 'rgba(36,26,23,0.82)';
      ctx.beginPath();
      ctx.roundRect(20, 20, 470, 270, 14);
      ctx.fill();
      ctx.restore();
      let ty = 54;
      for (const n of notes[b.id]) ty = para(ctx, `• ${n}`, 40, ty, 430, { size: 17, col: '#fff8ec' }) + 6;
    });
    y += panelH + 66;
  });
  void BOWL_K;
  return c;
}
