import { HoopsScene } from '/workspace/Puffy-/src/scenes/HoopsScene';
// Basketball, phone turned upright mid-shot: the scene freezes under the "turn your phone" prompt.
// A tap on that prompt: is it saved up as a shot press, locking the meter the moment you turn back?
const s: any = new HoopsScene();
let paused = true;
s.sys = { isActive: () => !paused };
s.tapped = false;
s.tapListener({ target: { closest: (q: string) => (q === '.rotate' ? {} : null) }, preventDefault() {} });
console.log('frozen (upright), tapped the rotate prompt -> press saved for the meter?', s.tapped);
paused = false;
s.tapped = false;
s.tapListener({ target: { closest: () => null }, preventDefault() {} });
console.log('playing, tapped the court                  -> press counted?', s.tapped);
