import { CHARACTERS } from '../wt-battle/src/data/characters';
import { CHAR_H, CHAR_W, HAT_UP, POSES, drawCharacter } from '../wt-battle/src/gfx/draw';
const S = 3;
const H = CHAR_H + HAT_UP;
const c = document.createElement('canvas');
c.width = POSES.length * CHAR_W * S; c.height = CHARACTERS.length * (H + 4) * S; document.body.appendChild(c);
const ctx = c.getContext('2d')!;
ctx.fillStyle = '#fbf3e4'; ctx.fillRect(0, 0, c.width, c.height);
CHARACTERS.forEach((ch, r) => POSES.forEach((p, i) => {
  ctx.save(); ctx.scale(S, S); ctx.translate(i * CHAR_W, r * (H + 4));
  ctx.strokeStyle = '#0002'; ctx.strokeRect(0, 0, CHAR_W, H);
  drawCharacter(ctx, 0, HAT_UP, ch, p, undefined, 'party');
  ctx.restore();
}));
(window as any).done = true;
