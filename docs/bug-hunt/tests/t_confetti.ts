import { SimpleConfetti } from '/workspace/Puffy-/src/world/SimpleConfetti';
import EmitterOp from '/workspace/Puffy-/node_modules/phaser/src/gameobjects/particles/EmitterOp.js';
// The King's crown bursts with { colors: [gold, white] } (HoopsScene.ts:767). Which tints do the pieces get?
// The emitter here is a stand-in, but its tint is Phaser's own EmitterOp, set up the way the emitter's config does it.
const COLORS = [0xffd23f, 0x7a2ec2, 0xffffff, 0xe8463f, 0x2fd0c0, 0xff8fb3, 0x4c8dff];
const tint = new (EmitterOp as any)('tint', 0xffffff);
tint.loadConfig({ tint: COLORS });
const emitted: number[] = [];
const burstE: any = {
  ops: { tint },
  set particleTint(v: number) { tint.onChange(v); }, // (what Phaser's ParticleEmitter.particleTint setter does)
  get particleTint() { return tint.current; },
  setEmitterAngle() {}, setParticleSpeed() {}, setParticleScale() {},
  explode(n: number) { for (let i = 0; i < n * 20; i++) emitted.push(tint.onEmit({}, 'tint')); },
};
const c: any = Object.create(SimpleConfetti.prototype);
c.burstE = burstE;
const hex = (s: Iterable<number>) => [...new Set(s)].map((v) => '#' + v.toString(16)).sort().join(' ');
c.burst(0, 0, 8, { power: 220, colors: [0xffd23f, 0xffffff] });
console.log('asked for #ffd23f #ffffff; the pieces got:', hex(emitted));
emitted.length = 0;
c.burst(0, 0, 8, { power: 220 });
console.log('the next burst without colors gets:', hex(emitted));
