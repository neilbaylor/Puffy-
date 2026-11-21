import { HoopsScene } from '/workspace/Puffy-/src/scenes/HoopsScene';
// Basketball from the Bosses menu: you win, the King runs off (youWin leaves kingAnim on his run frames, the
// hero on a hop). "Play again" starts the same scene object again: Phaser runs init() on it, then create(),
// then the intro, where the King is spotlit and says "Welcome to MY palace!". Which frames does he show?
const s: any = new HoopsScene();
s.kingAnim = { frames: ['run0', 'run1'], fps: 10 };
s.heroAnim = { frames: ['jump', 'idle0'], fps: 5 };
console.log('end of game 1 (a win):      king', JSON.stringify(s.kingAnim.frames), '| hero', JSON.stringify(s.heroAnim.frames));
s.init({ session: { players: [] }, charId: 'puffy', checkpoint: -1, level: 1, result: { practice: true } });
console.log('"Play again", after init(): king', JSON.stringify(s.kingAnim.frames), '| hero', JSON.stringify(s.heroAnim.frames));
console.log('King\'s first intro frame:', s.kingAnim.frames[0], '(a fresh scene shows idle0; his mouth only moves over idle0/idle1)');
