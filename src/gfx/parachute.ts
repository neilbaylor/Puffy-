import type { Ctx } from './draw';
import { STYLES, type Fill, type Pt } from './handdrawn';

/** Parachute for bad guys dropping in from the sky: a striped canopy with cords to a point. 64 × 60, cords meet at (32, 58). */
export function drawParachute(ctx: Ctx) {
  const st = STYLES.polished;
  const cx = 32;
  const top = 6;
  const w = 28;
  const h = 22;
  const N = 6;
  const red: Fill = { base: '#ef4f45', shade: '#b8302a', light: '#ff9a8e' };
  const white: Fill = { base: '#fff8ec', shade: '#e3d6c4', light: '#ffffff' };
  // cords first (behind the canopy)
  for (let i = 0; i <= N; i++) {
    const x = cx - w + (2 * w * i) / N;
    st.line(ctx, [[x, top + h - 1], [cx, 58]], 800 + i, 0.6, '#6a5a50');
  }
  // canopy panels, alternating colours
  for (let i = 0; i < N; i++) {
    const a0 = Math.PI + (i / N) * Math.PI;
    const a1 = Math.PI + ((i + 1) / N) * Math.PI;
    const pts: Pt[] = [];
    for (let k = 0; k <= 6; k++) {
      const a = a0 + ((a1 - a0) * k) / 6;
      pts.push([cx + Math.cos(a) * w, top + h + Math.sin(a) * h]);
    }
    const xb1 = cx + Math.cos(a1) * w;
    const xb0 = cx + Math.cos(a0) * w;
    pts.push([xb1, top + h], [(xb0 + xb1) / 2, top + h - 4], [xb0, top + h]);
    st.shape(ctx, pts, i % 2 ? white : red, 810 + i, { lw: 0.8, light: [cx - 10, top + 4] });
  }
}
