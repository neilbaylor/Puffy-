/**
 * Big outlined words on older Safari (html.no-po, set in index.html: it paints a word's outline over
 * its letters, and a ring of text shadows looked fuzzy at these sizes on the owner's old iPad). There
 * the words go in twice, stacked: the back copy, filled with the outline's colour, keeps the real
 * outline; the front copy has none (ui/oldSafariExtra.css). Everywhere else: just the words.
 */
export const NOPO = document.documentElement.classList.contains('no-po');

export function outlined(html: string): string {
  return NOPO ? `<span class="ol"><span class="ol-b" aria-hidden="true">${html}</span><span class="ol-f">${html}</span></span>` : html;
}

/** Give each back copy under `root` its outline's colour (once it's in the page, with its classes). */
export function colorOutline(root: HTMLElement) {
  if (!NOPO) return;
  for (const b of root.querySelectorAll<HTMLElement>('.ol-b')) {
    for (const n of [b, ...b.querySelectorAll<HTMLElement>('*')]) {
      const cs = getComputedStyle(n);
      if (parseFloat(cs.getPropertyValue('-webkit-text-stroke-width')) > 0) {
        b.style.setProperty('--olc', cs.getPropertyValue('-webkit-text-stroke-color'));
        break;
      }
    }
  }
}

/** `el.innerHTML = html`, outlined as above. */
export function setOutlined(el: HTMLElement, html: string) {
  el.innerHTML = outlined(html);
  colorOutline(el);
}
