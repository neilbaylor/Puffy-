// The heroes swimming in their dive gear — what their walk frames draw underwater (for the preview:
// walk0, walk2, walk4, walk6 = the four swim frames).
import { CHARACTERS } from '../../src/data/characters';
import { CHAR_H, CHAR_W, drawCharacter, type Pose } from '../../src/gfx/draw';
const S = 4;
const M = 14;
const out: string[] = [];
for (const p of ['walk0', 'walk2', 'walk4', 'walk6'] as Pose[]) {
  const c = document.createElement('canvas');
  c.width = CHARACTERS.length * (CHAR_W + M * 2) * S;
  c.height = (CHAR_H + 20) * S;
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 0, c.height);
  g.addColorStop(0, '#9fdcef');
  g.addColorStop(1, '#4aa6cc');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.scale(S, S);
  CHARACTERS.forEach((ch, i) => drawCharacter(ctx, i * (CHAR_W + M * 2) + M, 12, ch, p, undefined, 'scuba'));
  out.push(c.toDataURL());
}
(window as any).frames_ = out;
(window as any).done = true;
