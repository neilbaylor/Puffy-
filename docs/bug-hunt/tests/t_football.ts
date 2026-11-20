import { FootballGame } from '/workspace/Puffy-/src/entities/Football';
// The centre is knocked flat while the snap is in the air: the play is whistled dead.
// Does that ball come back to the pool, or does the downed quarterback keep it for good?
const chain = (o: any) => new Proxy(o, { get: (t, k) => (k in t ? t[k] : () => chain(t)) });
const sprite = () => chain({ frame: { name: 'idle0' }, scaleX: 1, depth: 0, rotation: 0, setFrame(f: string) { this.frame = { name: f }; return this; } });
const gs: any = chain({
  fx: chain({}), amb: { sea: chain({}) }, sea: chain({}),
  textures: { getFrame: () => ({ width: 32 }) },
  groundUnder: () => 500, rocketAt: () => null, players: [], liveRockets: [],
});
const g: any = Object.create(FootballGame.prototype);
const role = (r: string, x: number) => ({ team: 'snappers', role: r, img: sprite(), num: sprite(), x, lane: 0.5, tx: x, tlane: 0.5, speed: 100, face: 1, stand: 'idle0', pose: null, poseT: 0, dx: 0, home: 0.5, runT: 0, blink: 1, out: 0, push: 0 });
const C = role('C', 300), QB = role('QB', 280);
const balls = Array.from({ length: 4 }, () => ({ img: sprite(), shadow: sprite(), mode: 'off', by: null, far: false, x: 0, y: 0, vx: 0, vy: 0, t: 0, x0: 0, y0: 0, x1: 0, y1: 0, T: 1, peak: 0, done: null, spin: 0, life: 0, bubT: 0 }));
Object.assign(g, { gs, left: 0, right: 1000, ground: 500, players: [C, QB], balls, throwers: [], qb: QB, safety: QB, los: 45, phase: 'set', t: 0, ball: null, carrier: null, passed: false, shown: true, gap: 0, qbPass: 0, sheetK: { snappers: 1, stallions: 1 }, score: [0, 0], scoreText: [] });

for (let play = 1; play <= 5; play++) {
  g.phase = 'set';
  C.out = 0;
  g.snap(true); // HIKE
  const flying = g.ball;
  if (!flying) { console.log(`play ${play}: no ball left to snap (take() returned null) -> phase ${g.phase}`); break; }
  g.knockDown(C, 'stomp'); // flattened mid-snap: whistled dead
  for (let i = 0; i < 75; i++) for (const b of balls) if (b.mode !== 'off') g.updateBall(b, 1 / 60); // 1.25 s: the snap lands, loose balls fade
  console.log(`play ${play}: snapped ball now ${flying.mode}${flying.by === QB ? ' (in the QB\'s hand, nobody\'s play ball)' : ''}; balls free in the pool: ${balls.filter((b) => b.mode === 'off').length}/4`);
}
// (they come back only when the quarterback himself is knocked down: he drops everything he holds)
g.knockDown(QB, 'rocket');
for (let i = 0; i < 120; i++) for (const b of balls) if (b.mode !== 'off') g.updateBall(b, 1 / 60);
console.log(`after the QB is knocked down: balls free in the pool: ${balls.filter((b) => b.mode === 'off').length}/4`);
// (a clean snap, nobody knocked down: still caught by the quarterback as the play's ball)
g.phase = 'set';
C.out = 0;
QB.out = 0;
g.snap(true);
for (let i = 0; i < 30; i++) for (const b of balls) if (b.mode !== 'off') g.updateBall(b, 1 / 60);
console.log(`clean snap: ball ${g.ball?.mode}, held by the QB: ${g.ball?.by === QB}, phase ${g.phase}`);
