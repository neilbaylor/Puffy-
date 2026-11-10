// Every fish in every swim frame (sketches/fish/fish-sheet.png), and each frame on its own for the
// animated preview (window.frames: data URLs per fish per frame).
import { FISH_FRAMES, FISH_KINDS, FISH_NAME, FISH_SIZE, drawFish } from '../../src/gfx/fish';
const S = 3;
const PAD = 10;
const rowH = (k: (typeof FISH_KINDS)[number]) => FISH_SIZE[k].h + 16;
const maxW = Math.max(...FISH_KINDS.map((k) => FISH_SIZE[k].w));
const c = document.createElement('canvas');
c.width = (110 + Math.max(...FISH_KINDS.map((k) => FISH_FRAMES[k].length)) * (maxW + PAD)) * S;
c.height = FISH_KINDS.reduce((a, k) => a + rowH(k), 0) * S;
document.body.appendChild(c);
const ctx = c.getContext('2d')!;
const g = ctx.createLinearGradient(0, 0, 0, c.height);
g.addColorStop(0, '#bfe9f5');
g.addColorStop(1, '#7cc6e0');
ctx.fillStyle = g;
ctx.fillRect(0, 0, c.width, c.height);
ctx.scale(S, S);
let y = 0;
const frames: Record<string, string[]> = {};
for (const k of FISH_KINDS) {
  ctx.fillStyle = '#16384a';
  ctx.font = '800 11px Nunito, sans-serif';
  ctx.fillText(FISH_NAME[k], 6, y + rowH(k) / 2 + 4);
  FISH_FRAMES[k].forEach((f, i) => {
    const x = 110 + i * (maxW + PAD) + (maxW - FISH_SIZE[k].w) / 2;
    drawFish(ctx, x, y + 8, k, f);
    // the frame on its own, for the animated preview
    const one = document.createElement('canvas');
    one.width = FISH_SIZE[k].w * S;
    one.height = FISH_SIZE[k].h * S;
    const oc = one.getContext('2d')!;
    oc.scale(S, S);
    drawFish(oc, 0, 0, k, f);
    (frames[k] ??= []).push(one.toDataURL());
  });
  y += rowH(k);
}
(window as any).frames_ = frames;
(window as any).done = true;
