// The underwater cast at their in-game sizes (heroes in dive gear, a Giant Puff for scale, every
// fish at FISH_SCALE), and the heroes' dive gear in a few poses.
import { CHARACTERS } from '../../src/data/characters';
import { CHAR_H, CHAR_W, drawCharacter, type Pose } from '../../src/gfx/draw';
import { drawGiant, GIANT_H, GIANT_W } from '../../src/gfx/baddies';
import { FISH_KINDS, FISH_NAME, FISH_SCALE, FISH_SIZE, drawFish } from '../../src/gfx/fish';
import { STYLES } from '../../src/gfx/handdrawn';
const Z = 2.2; // zoom (game px → image px)
const st = STYLES.polished;
function water(c: HTMLCanvasElement) {
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 0, c.height);
  g.addColorStop(0, '#9fdcef');
  g.addColorStop(1, '#3f9cc4');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, c.width, c.height);
  return ctx;
}
// 1) the lineup, standing on a sea floor line
const items: { w: number; h: number; label: string; draw: (ctx: CanvasRenderingContext2D) => void }[] = [];
for (const ch of CHARACTERS) items.push({ w: CHAR_W * ch.scale, h: CHAR_H * ch.scale, label: ch.name, draw: (ctx) => { ctx.scale(ch.scale, ch.scale); drawCharacter(ctx, 0, 0, ch, 'idle0', undefined, 'frogskins,scuba'); } });
items.push({ w: GIANT_W, h: GIANT_H, label: 'Giant Puff', draw: (ctx) => drawGiant(ctx, 0, 0, 'w0' as never, st) });
for (const k of FISH_KINDS) items.push({ w: FISH_SIZE[k].w * FISH_SCALE[k], h: FISH_SIZE[k].h * FISH_SCALE[k], label: FISH_NAME[k], draw: (ctx) => { ctx.scale(FISH_SCALE[k], FISH_SCALE[k]); drawFish(ctx, 0, 0, k, 'sw0'); } });
const gap = 18;
const W = items.reduce((a, it) => a + it.w + gap, gap);
const H = Math.max(...items.map((i) => i.h)) + 50;
const c1 = document.createElement('canvas');
c1.width = W * Z;
c1.height = H * Z;
document.body.appendChild(c1);
const ctx1 = water(c1);
ctx1.scale(Z, Z);
let x = gap;
const floor = H - 26;
for (const it of items) {
  ctx1.save();
  ctx1.translate(x, floor - it.h);
  it.draw(ctx1);
  ctx1.restore();
  ctx1.fillStyle = '#0d2c3d';
  ctx1.font = '800 9px Nunito, sans-serif';
  ctx1.textAlign = 'center';
  ctx1.fillText(it.label, x + it.w / 2, floor + 14);
  x += it.w + gap;
}
ctx1.strokeStyle = '#0d2c3d55';
ctx1.beginPath();
ctx1.moveTo(0, floor + 2);
ctx1.lineTo(W, floor + 2);
ctx1.stroke();
// 2) dive gear on each hero in several poses (with sunglasses on: the mask replaces them)
const poses: Pose[] = ['idle0', 'walk2', 'jump', 'fall', 'hurt', 'shoot'];
const c2 = document.createElement('canvas');
const S2 = 4;
c2.width = poses.length * CHAR_W * S2;
c2.height = CHARACTERS.length * (CHAR_H + 6) * S2;
document.body.appendChild(c2);
const ctx2 = water(c2);
ctx2.scale(S2, S2);
CHARACTERS.forEach((ch, r) => poses.forEach((p, i) => { ctx2.save(); ctx2.translate(i * CHAR_W, r * (CHAR_H + 6)); drawCharacter(ctx2, 0, 0, ch, p, undefined, 'frogskins,scuba'); ctx2.restore(); }));
(window as any).done = true;
