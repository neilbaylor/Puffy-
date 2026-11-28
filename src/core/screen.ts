/**
 * Perf round G12's drawing savings in the levels (the terrain chunks in pieces, cut to where their
 * ground is; the background cut behind what's solid in front): on the test machine only a phone in
 * full mode measured better, and not by more than the runs' noise — so they're OFF unless switched
 * on, for the owner to try on real devices: `?g12=1` on (kept on this device), `?g12=0` off. Light
 * mode never uses them (measured slower there). The link's switch is taken out of the address.
 */
const KEY = 'puffy.g12';
export const G12: boolean = (() => {
  try {
    const q = new URLSearchParams(location.search);
    const v = q.get('g12');
    if (v === '1' || v === '0') {
      localStorage.setItem(KEY, v);
      q.delete('g12');
      const rest = q.toString();
      history.replaceState(null, '', location.pathname + (rest ? `?${rest}` : '') + location.hash);
    }
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
})();
