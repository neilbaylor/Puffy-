import { FishingScene } from '/workspace/Puffy-/src/scenes/FishingScene';
// Boss 6 (King Bob's rematch) won: its ending launches the hero off the boat (heroFree), puts the rods down
// (rodsDown) and frees the camera from the world's edges (freeCam). "Play again" — or Boss 5 next, from the
// Bosses menu — starts the same scene object again: Phaser runs init() on it. Does the next contest have
// its hero placed on the boat and its rods drawn?
const s: any = new FishingScene();
s.heroFree = true;
s.rodsDown = true;
s.freeCam = true;
s.kingRps = 'kp';
for (const level of [6, 5]) {
  s.init({ session: { players: [] }, charId: 'puffy', checkpoint: -1, level, result: { practice: true } });
  let drawn = 0;
  const g: any = new Proxy({}, { get: (_t, k) => (...a: any[]) => { if (k !== 'clear') drawn++; return g; } });
  s.rods = g;
  s.lures = { hero: { mode: 'float', x: 900, y: 520, dip: 0 }, king: { mode: 'held', x: 0, y: 0, dip: 0 } };
  s.drawRods();
  console.log('next contest (Boss ' + level + ') after init(): heroFree', s.heroFree, '| rodsDown', s.rodsDown, '| freeCam', s.freeCam, '| kingRps', s.kingRps, '| rods and lines drawn:', drawn ? drawn + ' calls' : 'NOTHING');
  s.heroFree = true; s.rodsDown = true; s.freeCam = true; s.kingRps = 'kp';
}
