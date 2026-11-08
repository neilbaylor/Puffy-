import { CHARACTERS } from '../wt-battle/src/data/characters';
import { drawHeroChute, drawPlopChute, type ChuteState } from '../wt-battle/src/gfx/skydive';
import { STYLES, type Pt } from '../wt-battle/src/gfx/handdrawn';
import { drawNuggie } from '../wt-battle/src/gfx/collectibles';
import type { Pose } from '../wt-battle/src/gfx/draw';

const ST = STYLES.polished;
const FONT = '"Lilita One", "Arial Black", sans-serif';
type C = CanvasRenderingContext2D;
const at = (ctx: C, x: number, y: number, s: number, fn: () => void, flip = false) => {
  ctx.save(); ctx.translate(x, y); ctx.scale(flip ? -s : s, s); fn(); ctx.restore();
};
const label = (ctx: C, t: string, x: number, y: number, size = 20, color = '#3a2418') => {
  ctx.font = `${size}px ${FONT}`; ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.fillText(t, x, y);
};
const sheet = (name: string, w: number, h: number) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h; c.dataset.sheet = name;
  document.body.appendChild(c);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fbf3e4'; ctx.fillRect(0, 0, w, h);
  return ctx;
};
const hero = (id: string) => CHARACTERS.find((c) => c.id === id)!;

// 1) the three heroes' parachutes
{
  const ctx = sheet('heroes', 1500, 560);
  label(ctx, 'Hero parachutes (each hero their own colours)', 750, 44, 30);
  const S = 3.0;
  [['puffy', 'Puffy'], ['scruffy', 'Scruffy'], ['muscles', 'Big Muscles']].forEach(([id, name], i) => {
    const x = 250 + i * 500;
    const ch = hero(id);
    const s = S * ch.scale;
    at(ctx, x - 28 * s, 520 - 56 * s, s, () => drawHeroChute(ctx, ch, 'fall', 'open', 0, 7 + i));
    label(ctx, name, x, 548, 24);
  });
}
// 2) Puffy: the whole sequence
{
  const ctx = sheet('sequence', 1760, 470);
  label(ctx, 'Opening, steering, shooting, landing (Puffy)', 880, 40, 28);
  const steps: [string, ChuteState, Pose, number][] = [
    ['pull!', 'pack', 'jump', 0],
    ['bursts open', 'burst', 'fall', 0],
    ['opening', 'opening', 'fall', 0],
    ['floating', 'open', 'fall', 0],
    ['steer left', 'steer', 'fall', -1],
    ['steer right', 'steer', 'fall', 1],
    ['shoot!', 'open', 'shoot', 0],
    ['landing', 'land', 'idle0', 0],
  ];
  const ch = hero('puffy');
  steps.forEach(([t, st, pose, lean], i) => {
    const x = 110 + i * 220;
    const s = 1.75;
    at(ctx, lean < 0 ? x + 28 * s : x - 28 * s, 400 - 56 * s, s, () => drawHeroChute(ctx, ch, pose, st, Math.abs(lean), 11), lean < 0);
    label(ctx, t, x, 440, 19);
  });
}
// 3) Plops by parachute
{
  const ctx = sheet('plops', 1500, 560);
  label(ctx, 'Plops by parachute (different speeds)', 750, 44, 30);
  const rows: [string, 'slow' | 'mid' | 'fast' | 'popped', 'small' | 'medium' | 'large', string][] = [
    ['slow: big patched dome', 'slow', 'small', 'drifts down slowly: you catch up to it'],
    ['middling', 'mid', 'medium', 'about your speed'],
    ['fast: just a streamer', 'fast', 'small', 'whooshes past you from above'],
    ['hit by a rocket', 'popped', 'medium', 'POP! and down it goes'],
  ];
  rows.forEach(([t, how, kind, sub], i) => {
    const x = 190 + i * 370;
    const s = (kind === 'small' ? 0.68 : kind === 'large' ? 1.32 : 1) * 2.1;
    at(ctx, x - 48 * s, 470 - 100 * s, s, () => drawPlopChute(ctx, kind, how, 5 + i));
    label(ctx, t, x, 512, 21);
    label(ctx, sub, x, 538, 15, '#7a5a40');
  });
}
// 4) a mock-up of a drop: the canyon, you, Plops at different heights
{
  const W = 900, H = 1200;
  const ctx = sheet('scene', W, H);
  // smoggy sky down the canyon
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#e9c98c'); g.addColorStop(0.45, '#b9874e'); g.addColorStop(1, '#5e3c22');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // far cliffs (hazy)
  const cliff = (side: number, x0: number, depth: number, col: string, seed: number) => {
    const pts: Pt[] = [];
    const r = (k: number) => Math.sin(k * 1.7 + seed) * 0.5 + Math.sin(k * 0.6 + seed * 2) * 0.5;
    const edge = (y: number) => x0 + r(y / 90) * 40 * depth;
    if (side < 0) { pts.push([-20, -20]); for (let y = -20; y <= H + 20; y += 30) pts.push([edge(y), y]); pts.push([-20, H + 20]); }
    else { pts.push([W + 20, -20]); for (let y = -20; y <= H + 20; y += 30) pts.push([W - edge(y), y]); pts.push([W + 20, H + 20]); }
    ST.shape(ctx, pts, { base: col, shade: '#4a2c14', light: '#c79a62' }, seed, { lw: 1.2 });
  };
  cliff(-1, 150, 1, '#9b6b3e', 3); cliff(1, 150, 1, '#9b6b3e', 5);
  cliff(-1, 70, 1.3, '#7a4f2a', 7); cliff(1, 80, 1.3, '#7a4f2a', 9);
  // poo drips off the near walls
  ctx.fillStyle = '#5a3418';
  for (let i = 0; i < 9; i++) { const y = 80 + i * 130; ctx.beginPath(); ctx.ellipse(i % 2 ? W - 75 : 75, y, 6, 14, 0, 0, Math.PI * 2); ctx.fill(); }
  // nuggies floating in the air
  for (const [x, y] of [[380, 470], [430, 450], [480, 470], [600, 820]] as Pt[]) at(ctx, x, y, 1.6, () => drawNuggie(ctx, 0, 0, 9));
  // Plops: a slow one below you, a middling one level-ish, a fast one coming down from above
  at(ctx, 520, 760, 1.6 * 0.68, () => drawPlopChute(ctx, 'small', 'slow', 4));
  at(ctx, 250, 500, 1.6, () => drawPlopChute(ctx, 'medium', 'mid', 6));
  at(ctx, 560, 120, 1.6 * 0.68, () => drawPlopChute(ctx, 'small', 'fast', 8));
  at(ctx, 190, 930, 1.6 * 1.32, () => drawPlopChute(ctx, 'large', 'mid', 9));
  // the warning for the fast one
  label(ctx, '!', 610, 60, 54, '#ff5a3c');
  // you, steering right, bazooka ready
  const ch = hero('puffy');
  at(ctx, 420, 300, 2.4, () => drawHeroChute(ctx, ch, 'shoot', 'steer', 0.5, 13));
  label(ctx, 'Mock-up: parachute drop down the canyon', W / 2, H - 24, 26, '#fff6e6');
}
