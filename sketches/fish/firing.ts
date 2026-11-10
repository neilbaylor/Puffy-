// The orange fish firing a bubble from his tail, frame by frame (for the animated preview).
import { BUBBLE_SIZE, FISH_SIZE, drawBubbleShot, drawFish, type FishFrame } from '../../src/gfx/fish';
const S = 4;
const W = 230;
const H = 70;
// the sequence: swimming, the wind-up, the snap (the bubble leaves the tail and flies off left), settling, swimming
const seq: { f: FishFrame; shot?: number }[] = [
  { f: 'sw0' }, { f: 'sw1' }, { f: 'sw2' }, { f: 'sw3' },
  { f: 'fire0' }, { f: 'fire0' }, { f: 'fire1', shot: 0 }, { f: 'fire1', shot: 1 }, { f: 'fire2', shot: 2 }, { f: 'fire2', shot: 3 },
  { f: 'sw4', shot: 4 }, { f: 'sw5', shot: 5 }, { f: 'sw0', shot: 6 }, { f: 'sw1', shot: 7 }, { f: 'sw2', shot: 8 }, { f: 'sw3', shot: 9 },
];
const out: string[] = [];
const fx = W - FISH_SIZE.badguy.w - 10;
const fy = (H - FISH_SIZE.badguy.h) / 2;
for (const s of seq) {
  const c = document.createElement('canvas');
  c.width = W * S;
  c.height = H * S;
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 0, c.height);
  g.addColorStop(0, '#9fdcef');
  g.addColorStop(1, '#4aa6cc');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.scale(S, S);
  drawFish(ctx, fx, fy, 'badguy', s.f);
  if (s.shot !== undefined) {
    // the shot flies off the tail tip, to the left
    const bx = fx - 8 - s.shot * 16 - BUBBLE_SIZE / 2;
    drawBubbleShot(ctx, bx, H / 2 - BUBBLE_SIZE / 2 + Math.sin(s.shot) * 1.5, s.shot % 2 ? 'b1' : 'b0');
  }
  out.push(c.toDataURL());
}
(window as any).frames_ = out;
(window as any).done = true;
