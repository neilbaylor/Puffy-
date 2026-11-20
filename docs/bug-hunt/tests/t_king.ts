import { WrestleScene } from '/workspace/Puffy-/src/scenes/WrestleScene';
// The Plop King flies off and his Plops drop in one after another (380 ms apart).
// The first one is splatted before the second arrives: does he come back with Plops still on their way?
const nop = () => {};
const chain: any = new Proxy({}, { get: () => () => chain });
const calls: (() => void)[] = [];
let returned = 0;
const w: any = Object.create(WrestleScene.prototype);
const spr = { y: 0, visible: true, setVisible(v: boolean) { this.visible = v; return this; }, setDepth() { return this; } };
Object.assign(w, {
  queen: { mode: 'idle', spr, shadow: chain, x: 0, top: 0, body: chain, setMode(m: string) { this.mode = m; } },
  player: { x: 0, alive: true }, awayCount: 0, minions: [], ended: false, clock: 0,
  time: { delayedCall: (_ms: number, f: () => void) => calls.push(f), now: 0 },
  fx: chain, callout: nop, flashJumbo: nop, setJet: nop, tweenP: async () => {},
  spawnMinion(kind: string) { this.minions.push({ kind, dead: false, chute: null, spr: chain, weapon: null }); },
  kingReturn() { returned++; this.queen.spr.setVisible(true); },
});
// (updateMinions is only called here when every Plop in the ring is splatted: the "all gone" test)
const step = () => w.updateMinions(1 / 60);
await w.kingAway();
console.log('wave 1:', calls.length, 'Plops on their way');
calls.shift()!(); // the first one drops in
w.minions[0].dead = true; // ...and is splatted at once
step();
console.log('first Plop splatted, 4 still to come -> King back already?', returned > 0);
while (calls.length) calls.shift()!(); // the rest drop in
for (const m of w.minions) m.dead = true; // all splatted
step();
console.log('all 5 splatted -> King back?', returned > 0, '| times he came back:', returned);
