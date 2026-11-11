// Close-ups: the tennis crabs (new rackets), the umpire crab, the volleyball referee Plop.
import { TCRAB_FRAMES, TCRAB_W, TCRAB_H, drawTennisCrab } from '../../src/gfx/tennis';
import { drawPlop, PLOP_DRESS } from '../../src/gfx/plops';
import { STYLES } from '../../src/gfx/handdrawn';
const c = document.createElement('canvas');
const S = 3;
c.width = (6 * (TCRAB_W + 4) + 3 * 110) * S;
c.height = (TCRAB_H * 2 + 10) * S;
document.body.appendChild(c);
const ctx = c.getContext('2d')!;
ctx.fillStyle = '#9fdcef';
ctx.fillRect(0, 0, c.width, c.height);
ctx.scale(S, S);
(['ready0', 'swing0', 'swing1', 'smash0', 'smash1', 'run0'] as const).forEach((f, i) => { ctx.save(); ctx.translate(i * (TCRAB_W + 4), 0); drawTennisCrab(ctx, f, 'red'); ctx.restore(); });
(['ready0', 'blink', 'smash0'] as const).forEach((f, i) => { ctx.save(); ctx.translate(i * (TCRAB_W + 4), TCRAB_H + 6); drawTennisCrab(ctx, f, 'ump'); ctx.restore(); });
PLOP_DRESS.ref = true;
(['idle', 'yell0'] as const).forEach((f, i) => { ctx.save(); ctx.translate(6 * (TCRAB_W + 4) + i * 110, 0); ctx.scale(0.9, 0.9); drawPlop(ctx, 0, 10, f, STYLES.polished, 'small'); ctx.restore(); });
(window as any).done = true;
