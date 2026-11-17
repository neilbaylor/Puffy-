/**
 * The page's first script, kept tiny: the loading screen is painted first, then the game's own
 * code (main.ts: Phaser and the rest, ~2 MB) is run. Running that takes a moment, and with it
 * already cached (the home-screen app, a return visit) the screen stayed blank until it was done.
 * (The game's code is fetched alongside this from the start: see the modulepreload in vite.config.)
 */
import './ui/style.css';
// (the screen's refresh rate: measured from now on, while the game's code loads)
import './core/refresh';

let go = false;
const start = () => {
  if (go) return;
  go = true;
  void import('./main');
};
// (just after the next paint; or straight away where nothing's painted, e.g. a background tab)
if (document.hidden) start();
else {
  requestAnimationFrame(() => setTimeout(start, 0));
  setTimeout(start, 250);
}
