import { FishingScene } from '/workspace/Puffy-/src/scenes/FishingScene';
// BITE! is up; the game gets paused (the pause button, the phone turned upright, the app put aside):
// the contest clock stops, so the button stays up. A tap on the Paused menu ("Resume") over that spot:
// does it land the fish?
const bite: any = { hidden: false, offsetWidth: 120, getBoundingClientRect: () => ({ left: 500, top: 300, width: 120, height: 120 }) };
const s: any = new FishingScene();
s.dom = { querySelector: () => bite };
let paused = true;
s.scene = { isPaused: () => paused, isActive: () => !paused };
s.sys = { isActive: () => !paused, isPaused: () => paused };
const resumeTap: any = { clientX: 560, clientY: 360, target: { closest: (q: string) => (q.includes('.screen') ? {} : null) }, preventDefault() {} };
s.biteHit = s.biteMiss = false;
s.tapListener(resumeTap);
console.log('paused, tapped Resume over the BITE! button -> caught?', s.biteHit);
paused = false;
s.biteHit = s.biteMiss = false;
s.tapListener({ ...resumeTap, target: { closest: () => null } });
console.log('playing, tapped the BITE! button              -> caught?', s.biteHit);
