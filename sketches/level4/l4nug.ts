// Level 4 nuggies by section (and a fingerprint of the ledges, to check the layout didn't move)
import { buildLevel4 } from '../wt-battle/src/level/level4';
const d = buildLevel4();
const a = d.spawns.filter((s: any) => s.type === 'aura');
const H = d.height;
const sec = (name: string, f: (s: any) => boolean) => console.log(name.padEnd(14), a.filter(f).length);
sec('climb 1', (s) => s.x < 42 && H - s.y < 92);
sec('drop 1 (air)', (s) => s.x >= 42 && s.x < 106 && H - s.y > 12);
sec('bottom', (s) => s.x >= 42 && s.x < 109 && H - s.y <= 12);
sec('climb 2', (s) => s.x >= 108 && s.x < 146 && H - s.y > 6);
sec('drop 2 (air)', (s) => s.x >= 146 && s.x < 162 && H - s.y > 14);
sec('climb 3', (s) => s.x >= 162);
console.log('total', a.length);
console.log('layout', JSON.stringify((globalThis as any).__ledges).length, require('crypto').createHash('md5').update(JSON.stringify(d.cells)).digest('hex'));
