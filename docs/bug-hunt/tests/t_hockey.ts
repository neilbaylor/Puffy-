import { HockeyMatch } from '/workspace/Puffy-/src/entities/Hockey';
// A knocked-out player's stick: it should fade out once (one 400 ms tween), not start a new fade every frame.
// (a tiny tween manager: each tween runs its duration, then calls onComplete)
let now = 0;
const tweens: { cfg: any; end: number; done: boolean }[] = [];
const manager = {
  add: (cfg: any) => tweens.push({ cfg, end: now + cfg.duration, done: false }),
  isTweening: (o: object) => tweens.some((t) => !t.done && t.cfg.targets === o),
  step() { for (const t of tweens) if (!t.done && now >= t.end) { t.done = true; t.cfg.onComplete?.(); } },
};
const stick = { visible: true, y: 100, setVisible(v: boolean) { this.visible = v; } };
const player = { dead: true, active: false };
const m: any = Object.create(HockeyMatch.prototype);
Object.assign(m, { sticks: new Map([[player, stick]]), players: [], state: 'idle', pucks: [], gs: { tweens: manager } });
for (let frame = 0; frame < 60; frame++) {
  m.update(1 / 60);
  now += 1000 / 60;
  manager.step();
}
console.log('fade tweens started for one stick over 1 s:', tweens.length, '| y targets:', tweens.slice(0, 3).map((t) => t.cfg.y).join(','), tweens.length > 3 ? '...' : '', '| stick visible at the end:', stick.visible);
