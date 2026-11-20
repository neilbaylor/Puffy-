import { UI } from '/workspace/Puffy-/src/ui/ui';
// Back to the start screen five times. How many 'fullscreenchange' listeners are left on the document?
// (each one holds a whole old start screen: its DOM and three 320x320 hero canvases)
const any: any = new Proxy(function () {}, { get: (_t, k) => (k === Symbol.toPrimitive ? () => 0 : k === 'then' ? undefined : any), apply: () => any, construct: () => any, set: () => true });
const fs = new Set<Function>();
(globalThis as any).document = new Proxy({}, {
  get: (_t, k) =>
    k === 'addEventListener' ? (ev: string, f: Function) => ev === 'fullscreenchange' && fs.add(f)
    : k === 'removeEventListener' ? (ev: string, f: Function) => ev === 'fullscreenchange' && fs.delete(f)
    : any,
});
const ui: any = Object.create(UI.prototype);
Object.assign(ui, { root: any, hud: any, banner: any, touch: any, rotate: any, game: any, selected: 0, level: 1, screen: null, session: { players: [] } });
for (let i = 1; i <= 5; i++) {
  ui.showStart();
  console.log(`start screen shown ${i}x -> fullscreenchange listeners: ${fs.size}`);
}
