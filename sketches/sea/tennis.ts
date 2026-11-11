// Crab tennis + sea grass sway + fish blink preview.
import { PALETTES, drawSky } from '../../src/gfx/world';
import { COURT, drawCourtBack, drawCourtFront, drawTennisNet, NET_GROUND, TCRAB_FRAMES, TCRAB_W, TCRAB_H, drawTennisCrab, drawClam, CLAM_W } from '../../src/gfx/tennis';
import { GRASS_FRAMES, drawGrassFrame, GRASS_W, KELP_FRAMES, KELP_W, KELP_H, drawKelpFrame, drawSeaNear } from '../../src/gfx/sea';
import { drawFish } from '../../src/gfx/fish';
const mk = (w: number, h: number, s = 1) => {
  const c = document.createElement('canvas');
  c.width = w * s; c.height = h * s;
  document.body.appendChild(c);
  const ctx = c.getContext('2d')!;
  ctx.scale(s, s);
  const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#7fe0ec'); g.addColorStop(1, '#2a8ac0'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  return ctx;
};
{
  // the court scene, 2x
  const W = 576 + COURT.END * 2;
  const ctx = mk(W, 300, 2);
  const gy = 230;
  ctx.save(); ctx.translate(0, 120); drawSeaNear(ctx, W, 150, PALETTES['w-lagoon']); ctx.restore();
  ctx.save(); ctx.translate(0, gy - COURT.BACK_UP); drawCourtBack(ctx, 576); ctx.restore();
  ctx.fillStyle = '#f6dea8'; ctx.fillRect(0, gy, W, 70);
  ctx.save(); ctx.translate(0, gy - COURT.UP); drawCourtFront(ctx, 576); ctx.restore();
  const cx = W / 2;
  for (const [x, f, team, flip] of [[cx - 230, 'ready0', 'red', false], [cx - 110, 'swing1', 'red', false], [cx + 110, 'run0', 'orange', true], [cx + 230, 'smash0', 'orange', true]] as const) {
    ctx.save(); ctx.translate(x, gy + 6 - TCRAB_H * 0.8); ctx.scale(flip ? -0.8 : 0.8, 0.8); ctx.translate(-30, 0); drawTennisCrab(ctx, f, team); ctx.restore();
  }
  ctx.save(); ctx.translate(cx - 70, gy - 80); ctx.scale(0.7, 0.7); drawClam(ctx, 'shut'); ctx.restore();
  ctx.save(); ctx.translate(cx - 22, gy - NET_GROUND); drawTennisNet(ctx); ctx.restore();
}
{
  const ctx = mk(TCRAB_FRAMES.length * (TCRAB_W + 4), (TCRAB_H + 4) * 2 + 30, 2);
  TCRAB_FRAMES.forEach((f, i) => (['red', 'orange'] as const).forEach((t, j) => { ctx.save(); ctx.translate(i * (TCRAB_W + 4), j * (TCRAB_H + 4)); drawTennisCrab(ctx, f, t); ctx.restore(); }));
  ctx.save(); ctx.translate(10, (TCRAB_H + 4) * 2); drawClam(ctx, 'shut'); ctx.translate(CLAM_W + 8, 0); drawClam(ctx, 'open'); ctx.restore();
}
{
  const ctx = mk(16 * GRASS_W, 2 * 56 + KELP_H + 30, 1.5);
  GRASS_FRAMES.forEach((f, i) => { ctx.save(); ctx.translate((i % 16) * GRASS_W, Math.floor(i / 16) * 56); drawGrassFrame(ctx, f); ctx.restore(); });
  KELP_FRAMES.forEach((f, i) => { ctx.save(); ctx.translate(i * KELP_W, 112); drawKelpFrame(ctx, f); ctx.restore(); });
}
{
  const ctx = mk(7 * 140, 110, 1.5);
  (['badguy', 'badguybig', 'kai', 'zippy', 'kingbob', 'slinger', 'stone'] as const).forEach((k, i) => {
    ctx.save(); ctx.translate(i * 140, 0); ctx.scale(0.6, 0.6); drawFish(ctx, 0, 0, k, 'sw1'); ctx.translate(0, 90); drawFish(ctx, 0, 0, k, 'bl1'); ctx.restore();
  });
}
(window as any).done = true;
