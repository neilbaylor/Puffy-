import { FishingScene } from '/workspace/Puffy-/src/scenes/FishingScene';
// King Bob's contest, left from the Paused menu (Home screen) in the middle of a cast, or while a fish hangs on
// a line. Starting it again re-runs init() on the same scene object (the clock goes back to 0), then create().
// What does drawRods() draw on the new contest's first frames?
const s: any = new FishingScene();
const calls: string[] = [];
const g: any = new Proxy({}, { get: (_t, k) => (...a: any[]) => { if (k === 'lineStyle' && a[0] > 20) calls.push('lineStyle width ' + Math.round(a[0])); if (k === 'lineBetween') calls.push('lineBetween ' + a.map((v: number) => Math.round(v)).join(',')); return g; } });
// the state the pause left: 26.8 s into the contest, the hero mid-whip (rod tip streak), a fish hanging on King Bob's line
s.clock = 26839;
s.tipTrail = [{ x: 380, y: 300, t: 26805 }, { x: 395, y: 290, t: 26822 }, { x: 410, y: 285, t: 26839 }];
s.dangle = { hero: null, king: { x: 1057, y: 546 } };
s.heroLean = 0.1;
s.init({ session: { players: [] }, charId: 'puffy', checkpoint: -1, level: 5, result: { practice: true } });
// (what create() sets up for the drawing)
s.rods = g;
s.lures = { hero: { mode: 'held', x: 0, y: 0, dip: 0 }, king: { mode: 'held', x: 0, y: 0, dip: 0 } };
s.clock = 1300;
s.drawRods();
console.log('new contest, 1.3 s in:');
console.log('  rod-tip streak points kept:', s.tipTrail.length, '| widest line drawn:', calls.filter((c) => c.startsWith('lineStyle')).join('; ') || 'none over 20 px');
console.log('  line to a fish on King Bob\'s hook:', JSON.stringify(s.dangle.king), calls.some((c) => c.endsWith(',1057,546')) ? '(drawn: a line out to 1057,546)' : '(none drawn)');
console.log('  hero lean:', s.heroLean);
