// Under-the-sea art preview: each look's background layers stacked, the props, the critters, the pier + sky.
import '../../src/gfx/sea';
import { PALETTES } from '../../src/gfx/world';
import { drawSky } from '../../src/gfx/world';
import { drawSeaFar, drawSeaMid, drawSeaNear, SEA_PROPS, drawSeaProp, drawKelp, JELLY_FRAMES, drawJelly, drawSchoolFish, drawTurtle, drawCrab, drawSeaBubble, drawLightRay, drawSeaSky, drawSurface, drawPier, SEA_PROP_W, SEA_PROP_H, TURTLE_W, CRAB_W, JELLY_W } from '../../src/gfx/sea';
const S = 1;
const mk = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = w * S;
  c.height = h * S;
  document.body.appendChild(c);
  const ctx = c.getContext('2d')!;
  ctx.scale(S, S);
  return ctx;
};
for (const id of ['w-lagoon', 'w-deep', 'w-dusk']) {
  const pal = PALETTES[id];
  const ctx = mk(1024, 420);
  ctx.save();
  ctx.scale(1024 / 4, 420 / 512);
  drawSky(ctx, 4, 512, pal);
  ctx.restore();
  ctx.save(); ctx.translate(0, 100); drawSeaFar(ctx, 1024, 220, pal); ctx.restore();
  ctx.save(); ctx.translate(0, 170); drawSeaMid(ctx, 1024, 230, pal); ctx.restore();
  ctx.save(); ctx.translate(0, 290); drawSeaNear(ctx, 1024, 150, pal); ctx.restore();
}
{
  const ctx = mk(1024, 200);
  const g = ctx.createLinearGradient(0, 0, 0, 200); g.addColorStop(0, '#7fe0ec'); g.addColorStop(1, '#1e78b0'); ctx.fillStyle = g; ctx.fillRect(0, 0, 1024, 200);
  ctx.save(); ctx.scale(2, 2);
  SEA_PROPS.forEach((f, i) => { ctx.save(); ctx.translate(i * 42, 2); drawSeaProp(ctx, f); ctx.restore(); });
  ctx.restore();
  ctx.save(); ctx.translate(940, 0); drawKelp(ctx, 30, 196, 180, 7); ctx.restore();
}
{
  const ctx = mk(1024, 160);
  const g = ctx.createLinearGradient(0, 0, 0, 160); g.addColorStop(0, '#3fb4d6'); g.addColorStop(1, '#1e78b0'); ctx.fillStyle = g; ctx.fillRect(0, 0, 1024, 160);
  ctx.save(); ctx.scale(2, 2);
  JELLY_FRAMES.forEach((f, i) => { ctx.save(); ctx.translate(i * (JELLY_W + 4), 4); drawJelly(ctx, f); ctx.restore(); });
  ctx.save(); ctx.translate(180, 10); drawSchoolFish(ctx, 's0'); ctx.translate(30, 0); drawSchoolFish(ctx, 's1'); ctx.restore();
  ctx.save(); ctx.translate(250, 2); drawTurtle(ctx, 't0'); ctx.translate(TURTLE_W, 0); drawTurtle(ctx, 't1'); ctx.restore();
  ctx.save(); ctx.translate(180, 40); drawCrab(ctx, 'c0'); ctx.translate(CRAB_W, 0); drawCrab(ctx, 'c1'); ctx.restore();
  ctx.save(); ctx.translate(200, 30); drawSeaBubble(ctx); ctx.restore();
  ctx.restore();
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(940, 0); ctx.scale(1, 0.6); drawLightRay(ctx); ctx.restore();
}
{
  const ctx = mk(1024, 300);
  ctx.save(); ctx.scale(1, 1); drawSeaSky(ctx, 1024, 160); ctx.restore();
  const g = ctx.createLinearGradient(0, 152, 0, 300); g.addColorStop(0, '#7fe0ec'); g.addColorStop(1, '#3fb4d6'); ctx.fillStyle = g; ctx.fillRect(0, 152, 1024, 148);
  ctx.save(); ctx.translate(0, 152 - 8); drawSurface(ctx, 1024); ctx.restore();
  ctx.save(); ctx.translate(40, 120); drawPier(ctx, 200, 170); ctx.restore();
}
(window as any).done = true;
