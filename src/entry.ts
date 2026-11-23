/**
 * The page's first script, kept tiny: the loading screen is painted first, then the game's own
 * code (main.ts: Phaser and the rest, ~2 MB) is run. Running that takes a moment, and with it
 * already cached (the home-screen app, a return visit) the screen stayed blank until it was done.
 * (The game's code is fetched alongside this from the start: see the modulepreload in vite.config.)
 */
import './ui/fonts.css';
import './ui/style.css';
import './ui/oldSafari.css';
import './core/oldSafari';
// (the screen's refresh rate: measured from now on, while the game's code loads)
import './core/refresh';
import { pickLight } from './core/lightPick';

// (the hidden device-check page, `?bench` in the address: its own small file, fetched only then — it
// starts the game itself when it needs it. See src/bench)
const bench = /[?&]bench(?:[=&]|$)/.test(location.search);

let go = false;
const start = () => {
  if (go) return;
  go = true;
  if (bench) void import('./bench/benchPage');
  // (light mode or not, measured on a version's first start, behind the loading screen: see core/lightPick)
  else void pickLight().then(() => import('./main'));
};
// (just after the next paint; or straight away where nothing's painted, e.g. a background tab)
if (document.hidden) start();
else {
  requestAnimationFrame(() => setTimeout(start, 0));
  setTimeout(start, 250);
}
