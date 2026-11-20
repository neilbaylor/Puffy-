import { FishingScene } from '/workspace/Puffy-/src/scenes/FishingScene';
// One contest: King Bob lands a 7.5 lb fish. Then "Try again": Phaser re-runs init() on the same scene object.
// Does the new contest start with an empty "BIGGEST" footer and an empty news ticker?
const el: any = new Proxy({ hidden: false, style: {} }, { get: (t: any, k) => (k in t ? t[k] : () => el) });
const s: any = new FishingScene();
s.dom = el;
s.fd = { charId: 'puffy' };
s.logCatch('king', 'Bass', 7.5);
console.log('contest 1 after a catch: best =', JSON.stringify(s.best), '| news =', JSON.stringify(s.news));
s.init({ charId: 'puffy', level: 5, result: {} });
console.log('contest 2 right after init(): best =', JSON.stringify(s.best), '| news =', JSON.stringify(s.news));
