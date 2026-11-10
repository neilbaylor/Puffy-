import { CHARACTERS } from '../../src/data/characters';
import { CHAR_H, CHAR_W, drawCharacter, gearUp, type Pose } from '../../src/gfx/draw';
import { recolorForSlot } from '../../src/gfx/recolor';
const S = 4;
const UP = gearUp('board,frogskins,party');
const H = CHAR_H + UP;
const cols: [string, Pose, number?][] = [
  ['party', 'idle0'], ['frogskins', 'idle0'], ['frogskins', 'walk2'], ['frogskins', 'jump'], ['frogskins', 'hurt'],
  ['board', 'idle0'], ['board', 'walk5'], ['board', 'jump'], ['board', 'fall'],
  ['board,frogskins,party', 'idle0'], ['board,frogskins,party', 'jump'], ['board,frogskins,party', 'idle0', 1], ['board,frogskins,party', 'jump', 2],
];
const c = document.createElement('canvas');
c.width = cols.length * CHAR_W * S; c.height = CHARACTERS.length * (H + 4) * S; document.body.appendChild(c);
const ctx = c.getContext('2d')!;
ctx.fillStyle = '#fbf3e4'; ctx.fillRect(0, 0, c.width, c.height);
CHARACTERS.forEach((ch, r) => cols.forEach(([wear, p, slot], i) => {
  const cell = document.createElement('canvas'); cell.width = CHAR_W * S; cell.height = H * S;
  const x = cell.getContext('2d')!; x.scale(S, S);
  if (!slot) drawCharacter(x, 0, UP, ch, p, undefined, wear);
  else drawCharacter(x, 0, UP, ch, p, undefined, wear, 'body');
  let out: HTMLCanvasElement = cell;
  if (slot) { out = recolorForSlot(cell, slot); const y = out.getContext('2d')!; y.scale(S, S); drawCharacter(y, 0, UP, ch, p, undefined, wear, 'eyes'); }
  ctx.strokeStyle = '#0002'; ctx.strokeRect(i * CHAR_W * S, r * (H + 4) * S, CHAR_W * S, H * S);
  ctx.drawImage(out, i * CHAR_W * S, r * (H + 4) * S);
}));
(window as any).done = true;
