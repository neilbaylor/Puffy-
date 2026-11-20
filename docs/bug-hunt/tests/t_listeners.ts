import EventEmitter from '/workspace/Puffy-/node_modules/eventemitter3/index.js';
import { Glob } from '/workspace/Puffy-/src/entities/enemies/Enemy';
import { FishBubble } from '/workspace/Puffy-/src/entities/enemies/Fish';
import { Weapon } from '/workspace/Puffy-/src/entities/enemies/Weapons';
// 50 of each projectile is fired and each one ends on its first frame.
// After that, how many UPDATE and SHUTDOWN listeners are still on the scene's (real eventemitter3) events?
const chain: any = new Proxy(function () {}, { get: (_t, k) => (k === 'scene' ? {} : chain), apply: () => chain });
const img = () => {
  const o: any = { x: 0, y: 0, rotation: 0, scale: 1, visible: true, scene: {}, destroy() { o.scene = undefined; } };
  const p: any = new Proxy(o, { get: (t, k) => (k in t ? t[k] : () => p) }); // (any setter: chains)
  return p;
};
const events = new EventEmitter();
const gs: any = {
  events,
  add: { image: () => img() },
  fx: chain, amb: { sea: chain }, cameras: chain, tweens: { add() {} },
  players: [], liveRockets: [], cutsceneOn: false,
  level: { isSolidAt: () => true, heightPx: -1000, data: {} },
  nearestPlayer: () => null,
};
const owner: any = { x: 0, y: 0, flipX: false, depth: 0, body: { top: 0 }, weapon: null };
const weapon = (kind: string): any => Object.assign(Object.create(Weapon.prototype), { gs, owner, kind, size: 'small', k: 1, recoil: 0, img: img(), busy: false, charge: 0 });
const frame = () => events.emit('update', 0, 16);
const count = () => `update ${events.listenerCount('update')}, shutdown ${events.listenerCount('shutdown')}`;
for (let i = 0; i < 50; i++) new Glob(gs, 0, 0, 100, 0, 760);
frame();
console.log('50 globs gone       ->', count());
for (let i = 0; i < 50; i++) weapon('gun').fire();
frame();
console.log('+50 pom-poms gone   ->', count());
for (let i = 0; i < 50; i++) weapon('saw').throwSaw();
gs.level.isSolidAt = () => false; // (a saw stuck in the ground buzzes on for 1.6 s: this one flies off the bottom instead)
frame();
console.log('+50 thrown saws gone ->', count());
gs.level.isSolidAt = () => true;
for (let i = 0; i < 50; i++) new FishBubble(gs, 0, 0, 100, 0, 1);
frame();
console.log('+50 fish bubbles gone ->', count());
// (and the scene shutting down still clears projectiles that are in the air)
gs.level.isSolidAt = () => false;
gs.level.heightPx = 1e9;
for (let i = 0; i < 10; i++) new Glob(gs, 0, 0, 100, 0, 0);
frame();
console.log('10 globs in the air   ->', count());
events.emit('shutdown');
console.log('after SHUTDOWN        ->', count());
