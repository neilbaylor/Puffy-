import { UI } from '/workspace/Puffy-/src/ui/ui';
// Basketball with King Bob on a phone: turn it upright (the Paused menu comes up, the game is paused),
// then back on its side, without touching anything. Is the game still paused under the "Paused" menu?
const any: any = new Proxy(function () {}, { get: (_t, k) => (k === Symbol.toPrimitive ? () => 0 : k === 'then' ? undefined : any), apply: () => any, construct: () => any, set: () => true });
(globalThis as any).ontouchstart = null; // a touch device
const winListeners: Record<string, Function[]> = {};
(globalThis as any).addEventListener = (ev: string, f: Function) => (winListeners[ev] ??= []).push(f);
const setSize = (w: number, h: number) => Object.assign(globalThis as any, { innerWidth: w, innerHeight: h });
const state: Record<string, 'running' | 'paused' | 'off'> = { Hoops: 'off', Fishing: 'off' };
const gameEvents: Record<string, Function[]> = {};
const game: any = new Proxy(
  {
    scene: new Proxy(
      {
        isActive: (k: string) => state[k] === 'running',
        isPaused: (k: string) => state[k] === 'paused',
        pause: (k: string) => state[k] === 'running' && (state[k] = 'paused'),
        resume: (k: string) => state[k] === 'paused' && (state[k] = 'running'),
      },
      { get: (t: any, k) => (k in t ? t[k] : any) },
    ),
    events: { on: (ev: string, f: Function) => (gameEvents[ev] ??= []).push(f), emit: (ev: string, ...a: unknown[]) => gameEvents[ev]?.forEach((f) => f(...a)) },
  },
  { get: (t: any, k) => (k in t ? t[k] : any) },
);
setSize(900, 400); // on its side
const ui: any = new UI(game);
const resize = () => winListeners.resize.forEach((f) => f());
state.Hoops = 'running';
game.events.emit('hoops-start', { scene: { key: 'Hoops' } });
console.log('contest on:', state.Hoops);
setSize(400, 900);
resize();
console.log('phone upright: Hoops', state.Hoops, '| Paused menu up:', !!ui.screen);
setSize(900, 400);
resize();
console.log('back on its side, nothing tapped: Hoops', state.Hoops, '| Paused menu still up:', !!ui.screen);
// (Resume tapped; later a card that isn't the Paused menu is up, e.g. the results: upright freezes the game, turning back carries on)
ui.resume();
ui.screen = { classList: { contains: () => false }, remove() {} };
setSize(400, 900);
resize();
const frozen = state.Hoops;
setSize(900, 400);
resize();
console.log('under another card: upright ->', frozen, '| back on its side ->', state.Hoops);
