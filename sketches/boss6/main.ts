// Boss 6 concept sheets (King Bob's Rematch): open sketches/boss6/index.html with `npm run dev`, or
// render the PNGs with sketches/boss6/render.cjs. #boats, #rain, #announcer, #kingbob-intro or #ending
// picks one sheet; with none, all five, one under the other.
import { boatsSheet } from './boats';
import { rainSheet } from './rain';
import { endingSheet } from './ending';
import { announcerSheet } from './announcer';
import { kingIntroSheet } from './kingintro';

const SHEETS: Record<string, () => HTMLCanvasElement> = { boats: boatsSheet, rain: rainSheet, announcer: announcerSheet, 'kingbob-intro': kingIntroSheet, ending: endingSheet };

async function main() {
  await Promise.all(['400 40px "Lilita One"', '700 20px Nunito', '800 20px Nunito', '900 20px Nunito'].map((f) => document.fonts.load(f)));
  const want = location.hash.slice(1);
  const out: Record<string, string> = {};
  for (const [name, make] of Object.entries(SHEETS)) {
    if (want && want !== name) continue;
    const c = make();
    c.style.width = '100%';
    c.style.display = 'block';
    c.style.marginBottom = '24px';
    document.body.appendChild(c);
    out[name] = c.toDataURL('image/png');
  }
  (window as unknown as { sheets: Record<string, string> }).sheets = out;
}
void main();
