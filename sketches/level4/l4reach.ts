// can each ledge be reached from the one before it? (the game's jump numbers, the level's tiles)
import { buildLevel4 } from '../wt-battle/src/level/level4';
import { CHARACTERS } from '../wt-battle/src/data/characters';
const d = buildLevel4();
const climbs = (globalThis as any).__ledges as { x0: number; x1: number; h: number }[][];
const T = 32, G = 1600, DT = 1 / 120;
const solid = (x: number, y: number, up: boolean) => { const c = d.cells[Math.floor(y / T)]?.[Math.floor(x / T)]; if (!c) return false; return c !== 'cloud' || !up; };
for (const ch of CHARACTERS) {
  const W = ch.hitW ?? 22, H = ch.hitH ?? 34;
  let fails = 0;
  climbs.forEach((list, ci) => {
    for (let i = 0; i + 1 < list.length; i++) {
      const a = list[i], b = list[i + 1];
      const dir = (b.x0 + b.x1) / 2 >= (a.x0 + a.x1) / 2 ? 1 : -1;
      const yA = (d.height - a.h) * T, yB = (d.height - b.h) * T;
      let best = false;
      // try: walking or running, from various spots on ledge a, second jump at various moments
      for (const speed of [ch.walkSpeed, ch.runSpeed]) for (let sx = a.x0 * T + W / 2; sx <= (a.x1 + 1) * T - W / 2 && !best; sx += 8) for (const second of [0.18, 0.26, 0.34, 0.42, 99]) {
        let x = sx, y = yA, vx = 0, vy = -ch.jump, t = 0, used = false, ok = true;
        // steer only once above the ledge's height (or straight away if it's beside us)
        while (t < 3) {
          t += DT;
          if (!used && t >= second) { vy = Math.min(vy, -ch.jump * 0.72); used = true; }
          const steer = y - H < yB - 6 || Math.abs(x - ((b.x0 + b.x1 + 1) / 2) * T) > 3 * T ? 1 : 1;
          vx = dir * speed * steer;
          vy = Math.min(900, vy + G * DT);
          const nx = x + vx * DT, ny = y + vy * DT;
          // head / side collisions (body box: x ± W/2, from y - H to y)
          const up = vy < 0;
          const hit = [nx - W / 2 + 1, nx + W / 2 - 1].some((px) => solid(px, ny - H + 1, true) || (!up && false)) ;
          if (up && hit) { vy = 0; }
          // sideways into a wall
          if ([ny - H + 2, ny - 2].some((py) => solid(nx + dir * (W / 2), py, true))) { vx = 0; }
          x = vx ? nx : x;
          // landing on b
          if (vy > 0 && y <= yB && ny >= yB && x + W / 2 > b.x0 * T && x - W / 2 < (b.x1 + 1) * T) { best = true; break; }
          // landed somewhere else / fell well below
          if (vy > 0 && ny > yA + 2 * T) { ok = false; break; }
          y = ny;
          // overshot b while falling: stop moving (a player lets go of the stick)
          if (vy > 0 && dir * (x - ((b.x0 + b.x1 + 1) / 2) * T) > 0) vx = 0;
        }
        void ok;
        if (best) break;
      }
      if (!best) { fails++; if (fails <= 6) console.log(`  ${ch.name}: climb ${ci + 1} ledge ${i} (${a.x0}..${a.x1} @${a.h}) -> ${i + 1} (${b.x0}..${b.x1} @${b.h}) not reachable`); }
    }
  });
  console.log(`${ch.name}: ${fails} unreachable jumps`);
}
