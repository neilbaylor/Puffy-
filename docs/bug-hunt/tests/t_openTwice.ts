import { BattleUI } from '/workspace/Puffy-/src/ui/battleUi';
// "Let's go" pressed twice for the same room (Enter twice in the room-code box): how many live connections?
const any: any = new Proxy(function () {}, { get: (_t, k) => (k === Symbol.toPrimitive ? () => 0 : k === 'then' ? undefined : any), apply: () => any, construct: () => any, set: () => true });
let opened = 0;
let closed = 0;
(globalThis as any).WebSocket = class { static OPEN = 1; readyState = 0; constructor() { opened++; } send() {} close() { closed++; } };
(globalThis as any).sessionStorage = { getItem: () => 'tok', setItem() {} };
const ui: any = new BattleUI({ root: any, game: new Proxy({ registry: { get: () => true }, events: { on() {}, off() {}, once() {} }, scene: any }, { get: (t: any, k) => (k in t ? t[k] : any) }), setScreen() {}, home() {}, hero: () => 'puffy', touch() {}, bombs() {}, level: () => 1 } as any);
ui.open('birchcliff');
ui.open('birchcliff');
console.log(`after two presses: connections opened ${opened}, closed ${closed} -> live ${opened - closed}`);
