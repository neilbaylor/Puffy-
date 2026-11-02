/**
 * A TV-sports "stinger": diagonal gold and purple bars sweep across the
 * screen, hold a title card, then sweep away to reveal the next scene.
 * Used for the jump from the level into King Puff Ball's palace.
 */
let el: HTMLDivElement | null = null;

const later = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Sweep the bars in until they cover the screen. */
export async function stingerCover() {
  el?.remove();
  el = document.createElement('div');
  el.className = 'stinger';
  el.innerHTML = '<i class="sb sb1"></i><i class="sb sb2"></i><i class="sb sb3"></i><i class="sb sb4"></i><div class="st-title"></div>';
  (document.getElementById('ui') ?? document.body).appendChild(el);
  void el.offsetWidth;
  el.classList.add('in');
  await later(620);
}

/** Show a title on the covered screen. */
export function stingerTitle(html: string) {
  if (!el) return;
  const t = el.querySelector<HTMLElement>('.st-title')!;
  t.innerHTML = html;
  t.classList.remove('show');
  void t.offsetWidth;
  t.classList.add('show');
}

/** Sweep the bars away and remove the stinger. */
export async function stingerReveal() {
  if (!el) return;
  const me = el;
  me.classList.add('out');
  await later(760);
  me.remove();
  if (el === me) el = null;
}
