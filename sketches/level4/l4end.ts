import { buildLevel4 } from '../wt-battle/src/level/level4';
const d = buildLevel4();
const goal = d.spawns.find((s: any) => s.type === 'goal')!;
console.log('W', d.width, 'goal', goal.x, d.height - goal.y);
for (const s of d.spawns) if (s.type !== 'aura' && s.x > d.width - 40) console.log(s.type, s.x, d.height - s.y, JSON.stringify(s.opts ?? {}));
