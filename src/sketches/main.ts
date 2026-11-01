import { H, W, WORLDS } from './worlds';

/** Paints every world sketch into its <canvas data-world="..."> once fonts are ready. */
async function paint() {
  try {
    await Promise.race([document.fonts.load('26px "Lilita One"'), new Promise((r) => setTimeout(r, 1200))]);
  } catch {
    /* system font fallback */
  }
  for (const w of WORLDS) {
    const c = document.querySelector<HTMLCanvasElement>(`canvas[data-world="${w.id}"]`);
    if (!c) continue;
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d')!;
    w.draw(ctx);
  }
}
void paint();
