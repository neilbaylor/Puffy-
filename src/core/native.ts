/**
 * The game packed as an Android/iOS app (Capacitor: `npm run app:android`, the `app` build mode).
 * The app has the game's files inside it (it starts instantly and plays offline), so its page's
 * address is the phone itself (https://localhost), not the website: accounts and battles are asked
 * of the website's server by its full address. On the website none of this does anything (`IS_APP`
 * is false there, and the native-only code below isn't even in its build).
 */
export const IS_APP = import.meta.env.MODE === 'app';

/** The website the app talks to (VITE_APP_SERVER at build time points a test build somewhere else). */
const SERVER = ((import.meta.env.VITE_APP_SERVER as string | undefined) || 'https://playpuffy.world').replace(/\/+$/, '');

/** What goes in front of `/api/...`: nothing on the website (the same site), the website's address in the app. */
export const apiBase = () => (IS_APP ? SERVER : '');
/** The battle server's address (`ws(s)://…`), for the app. */
export const wsBase = () => SERVER.replace(/^http/, 'ws');

let lastBuzz = 0;
/**
 * A little shake of the device (the app only): `strength` 0–1 (a bump to the biggest slam). Tiny
 * ones are skipped, and there's at most one every 150 ms (a giant's stomps come thick and fast).
 */
export function buzz(strength: number) {
  if (IS_APP) {
    if (strength < 0.2) return;
    const now = performance.now();
    if (now - lastBuzz < 150) return;
    lastBuzz = now;
    void import('@capacitor/haptics')
      .then(({ Haptics, ImpactStyle }) => Haptics.impact({ style: strength > 0.75 ? ImpactStyle.Heavy : strength > 0.45 ? ImpactStyle.Medium : ImpactStyle.Light }))
      .catch(() => {});
  }
}

// Android's back button: a "back" on whatever is showing (a menu's Back/Done/Cancel; in a level, the
// pause menu, and from it back into the level). On the start screen it puts the app away (it stays
// where it was) rather than closing it.
if (IS_APP)
  void import('@capacitor/app')
    .then(({ App }) =>
      App.addListener('backButton', () => {
        const shown = (b: Element) => (b as HTMLElement).offsetParent !== null;
        const back = [...document.querySelectorAll('#ui [data-act=back], #ui [data-act=cancel]')].filter(shown).pop() as HTMLElement | undefined;
        if (back) return back.click();
        const game = (window as unknown as { game?: { scene: { isActive(k: string): boolean } } }).game;
        const onStart = !!document.querySelector('#ui .screen.start') && (game?.scene.isActive('Menu') ?? true);
        if (onStart) return void App.minimizeApp();
        // (the game's own Escape key: pauses a level, or carries on from the pause menu)
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape' }));
      }),
    )
    .catch(() => {});
