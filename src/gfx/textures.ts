import Phaser from 'phaser';
import { TILE } from '../config';
import { CHARACTERS } from '../data/characters';
import { TILE_COUNT, TILESET_COLS, T } from '../level/tiles';
import { ART_RES, CHAR_H, CHAR_W, POSES, canvas, drawCharacter, ellipse, rng, roundRect, type Ctx } from './draw';

/**
 * Generates every placeholder texture at boot. When real art arrives, each
 * section here gets replaced by a normal `this.load.image/spritesheet` call
 * using the same texture keys + frame names, and nothing else has to change.
 */

const OUT = '#2a1e2e';

/** Theme palette for the world. Swap these to re-skin the level (see world sketches). */
export const THEME = {
  skyTop: '#3fb4ff',
  skyBottom: '#c4f0ff',
  grass: '#5fd23c',
  grassDark: '#2f9a2a',
  grassLight: '#a8f06a',
  dirtA: '#d28a45',
  dirtB: '#b06a32',
  dirtEdge: '#7a4320',
  brick: '#e0703a',
  brickDark: '#9b3d17',
  brickLight: '#ffa070',
  gold: '#ffc533',
  goldDark: '#c7861a',
  stone: '#a7b1c2',
  stoneDark: '#6c7689',
  stoneLight: '#d6dde8',
  wood: '#c98b4b',
  woodDark: '#7d4f24',
  farA: '#8fb7e8',
  farB: '#b4d3f5',
  hillA: '#3fbf4a',
  hillB: '#2e9e3c',
  hillC: '#7ad65a',
  nearA: '#27883a',
  nearB: '#1d6e2f',
};

type AddFrames = (tex: Phaser.Textures.CanvasTexture) => void;

/** Adds 2px transparent rows above and below, so vertically-wrapping TileSprites don't bleed edge pixels. */
function padV(src: HTMLCanvasElement) {
  const { c, ctx } = canvas(src.width, src.height + 4);
  ctx.drawImage(src, 0, 2);
  return c;
}

function addCanvas(scene: Phaser.Scene, key: string, c: HTMLCanvasElement, frames?: AddFrames) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.addCanvas(key, c)!;
  frames?.(tex);
  return tex;
}

// ─────────────────────────────────────────────────────────────
// Tiles
// ─────────────────────────────────────────────────────────────

function drawDirt(ctx: Ctx, seed: number) {
  // Big checker, the classic "loop zone" look
  for (let y = 0; y < 2; y++)
    for (let x = 0; x < 2; x++) {
      ctx.fillStyle = (x + y) % 2 ? THEME.dirtB : THEME.dirtA;
      ctx.fillRect(x * 16, y * 16, 16, 16);
    }
  const r = rng(seed);
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = r() > 0.5 ? '#00000014' : '#ffffff18';
    ctx.fillRect(Math.floor(r() * 30), Math.floor(r() * 30), 2, 2);
  }
}

function drawGrassTop(ctx: Ctx, left: boolean, right: boolean) {
  // grass cap with a scalloped lower edge
  ctx.fillStyle = THEME.grassDark;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(32, 0);
  ctx.lineTo(32, 11);
  for (let x = 32; x >= 0; x -= 8) ctx.quadraticCurveTo(x - 4, 17, x - 8, 11);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = THEME.grass;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(32, 0);
  ctx.lineTo(32, 8);
  for (let x = 32; x >= 0; x -= 8) ctx.quadraticCurveTo(x - 4, 14, x - 8, 8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = THEME.grassLight;
  ctx.fillRect(0, 0, 32, 3);
  ctx.fillStyle = '#ffffff55';
  ctx.fillRect(0, 0, 32, 1);
  if (left) {
    ctx.clearRect(0, 0, 3, 3);
    ctx.clearRect(0, 0, 1, 6);
    ctx.fillStyle = THEME.grassDark;
    ctx.fillRect(0, 3, 2, 10);
  }
  if (right) {
    ctx.clearRect(29, 0, 3, 3);
    ctx.clearRect(31, 0, 1, 6);
    ctx.fillStyle = THEME.grassDark;
    ctx.fillRect(30, 3, 2, 10);
  }
}

function drawTile(ctx: Ctx, id: number) {
  const edgeL = [T.GRASS_L, T.GRASS_LR, T.DIRT_L, T.DIRT_LR].includes(id as never);
  const edgeR = [T.GRASS_R, T.GRASS_LR, T.DIRT_R, T.DIRT_LR].includes(id as never);
  switch (id) {
    case T.GRASS:
    case T.GRASS_L:
    case T.GRASS_R:
    case T.GRASS_LR:
    case T.DIRT:
    case T.DIRT_L:
    case T.DIRT_R:
    case T.DIRT_LR: {
      drawDirt(ctx, id * 7 + 3);
      if (edgeL) {
        ctx.fillStyle = THEME.dirtEdge;
        ctx.fillRect(0, 0, 3, 32);
      }
      if (edgeR) {
        ctx.fillStyle = THEME.dirtEdge;
        ctx.fillRect(29, 0, 3, 32);
      }
      if (id <= T.GRASS_LR) drawGrassTop(ctx, edgeL, edgeR);
      break;
    }
    case T.BRICK: {
      ctx.fillStyle = THEME.brickDark;
      ctx.fillRect(0, 0, 32, 32);
      for (let r = 0; r < 4; r++) {
        const offset = r % 2 ? 8 : 0;
        for (let bx = -16; bx < 32; bx += 16) {
          const x0 = Math.max(0, bx + offset + 1);
          const x1 = Math.min(32, bx + offset + 15);
          if (x1 <= x0) continue;
          const y = r * 8 + 1;
          ctx.fillStyle = THEME.brick;
          ctx.fillRect(x0, y, x1 - x0, 6);
          ctx.fillStyle = THEME.brickLight;
          ctx.fillRect(x0, y, x1 - x0, 1.5);
        }
      }
      break;
    }
    case T.QBLOCK:
    case T.USED: {
      const used = id === T.USED;
      roundRect(ctx, 0, 0, 32, 32, 4, OUT);
      roundRect(ctx, 1.5, 1.5, 29, 29, 3, used ? '#a48659' : THEME.gold);
      ctx.fillStyle = used ? '#c2a576' : '#ffe58a';
      ctx.fillRect(3, 3, 26, 3);
      ctx.fillStyle = used ? '#7b6240' : THEME.goldDark;
      ctx.fillRect(3, 26, 26, 3);
      // rivets
      for (const [x, y] of [[5, 5], [27, 5], [5, 27], [27, 27]]) ellipse(ctx, x, y, 1.5, 1.5, OUT);
      if (!used) {
        ctx.font = '900 22px "Lilita One", "Arial Black", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = THEME.goldDark;
        ctx.fillText('?', 17, 18);
        ctx.fillStyle = '#fff8dc';
        ctx.fillText('?', 16, 16.5);
      }
      break;
    }
    case T.STONE: {
      ctx.fillStyle = THEME.stoneDark;
      ctx.fillRect(0, 0, 32, 32);
      ctx.fillStyle = THEME.stone;
      ctx.fillRect(2, 2, 28, 28);
      ctx.fillStyle = THEME.stoneLight;
      ctx.fillRect(2, 2, 28, 3);
      ctx.fillRect(2, 2, 3, 28);
      ctx.fillStyle = '#00000022';
      ctx.fillRect(2, 27, 28, 3);
      ctx.fillRect(27, 2, 3, 28);
      ctx.fillStyle = '#ffffff30';
      ctx.fillRect(9, 9, 6, 2);
      break;
    }
    case T.PLAT_L:
    case T.PLAT_M:
    case T.PLAT_R: {
      const l = id === T.PLAT_L;
      const r = id === T.PLAT_R;
      ctx.fillStyle = OUT;
      ctx.fillRect(l ? 2 : 0, 0, 32 - (l ? 2 : 0) - (r ? 2 : 0), 14);
      ctx.fillStyle = THEME.wood;
      ctx.fillRect(l ? 4 : 0, 2, 32 - (l ? 4 : 0) - (r ? 4 : 0), 10);
      ctx.fillStyle = '#e8b27a';
      ctx.fillRect(l ? 4 : 0, 2, 32 - (l ? 4 : 0) - (r ? 4 : 0), 2);
      ctx.fillStyle = THEME.woodDark;
      ctx.fillRect(15, 2, 2, 10);
      // support brackets
      if (l || r) {
        const x = l ? 6 : 20;
        ctx.fillStyle = OUT;
        ctx.beginPath();
        ctx.moveTo(x, 14);
        ctx.lineTo(x + 6, 14);
        ctx.lineTo(x + 3, 22);
        ctx.fill();
      }
      break;
    }
    case T.SPIKES: {
      ctx.fillStyle = THEME.stoneDark;
      ctx.fillRect(0, 26, 32, 6);
      for (let i = 0; i < 4; i++) {
        const x = i * 8;
        ctx.fillStyle = OUT;
        ctx.beginPath();
        ctx.moveTo(x, 27);
        ctx.lineTo(x + 4, 6);
        ctx.lineTo(x + 8, 27);
        ctx.fill();
        ctx.fillStyle = '#e3e9f2';
        ctx.beginPath();
        ctx.moveTo(x + 1.5, 26);
        ctx.lineTo(x + 4, 9);
        ctx.lineTo(x + 6.5, 26);
        ctx.fill();
        ctx.fillStyle = '#9aa6b8';
        ctx.beginPath();
        ctx.moveTo(x + 4, 9);
        ctx.lineTo(x + 6.5, 26);
        ctx.lineTo(x + 4, 26);
        ctx.fill();
      }
      break;
    }
  }
}

/** Tileset with 1px extruded borders (margin 1, spacing 2) so tiles never show seams when zoomed. */
function makeTileset(scene: Phaser.Scene) {
  const rows = Math.ceil(TILE_COUNT / TILESET_COLS);
  const cell = TILE + 2;
  const { c, ctx } = canvas(TILESET_COLS * cell, rows * cell);
  const tmp = canvas(TILE, TILE);
  for (let id = 0; id < TILE_COUNT; id++) {
    tmp.ctx.clearRect(0, 0, TILE, TILE);
    drawTile(tmp.ctx, id);
    const x = (id % TILESET_COLS) * cell + 1;
    const y = Math.floor(id / TILESET_COLS) * cell + 1;
    ctx.drawImage(tmp.c, x, y);
    // extrude edges
    ctx.drawImage(tmp.c, 0, 0, 1, TILE, x - 1, y, 1, TILE);
    ctx.drawImage(tmp.c, TILE - 1, 0, 1, TILE, x + TILE, y, 1, TILE);
    ctx.drawImage(tmp.c, 0, 0, TILE, 1, x, y - 1, TILE, 1);
    ctx.drawImage(tmp.c, 0, TILE - 1, TILE, 1, x, y + TILE, TILE, 1);
  }
  addCanvas(scene, 'tiles', c, (tex) => {
    for (let id = 0; id < TILE_COUNT; id++) {
      const x = (id % TILESET_COLS) * cell + 1;
      const y = Math.floor(id / TILESET_COLS) * cell + 1;
      tex.add(`t${id}`, 0, x, y, TILE, TILE);
    }
  });
}

// ─────────────────────────────────────────────────────────────
// Characters
// ─────────────────────────────────────────────────────────────

function makeCharacters(scene: Phaser.Scene) {
  for (const ch of CHARACTERS) {
    const R = ART_RES;
    const { c, ctx } = canvas(CHAR_W * POSES.length * R, CHAR_H * R);
    ctx.scale(R, R);
    POSES.forEach((p, i) => drawCharacter(ctx, i * CHAR_W, 0, ch, p));
    addCanvas(scene, `char-${ch.id}`, c, (tex) =>
      POSES.forEach((p, i) => tex.add(p, 0, i * CHAR_W * R, 0, CHAR_W * R, CHAR_H * R)),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Enemies
// ─────────────────────────────────────────────────────────────

const angryEyes = (ctx: Ctx, cx: number, cy: number, gap = 7) => {
  for (const s of [-1, 1]) {
    const ex = cx + s * gap * 0.5 - 3;
    ellipse(ctx, ex, cy, 3.6, 4.4, OUT);
    ellipse(ctx, ex, cy, 2.8, 3.6, '#fff');
    ellipse(ctx, ex - 1.2, cy + 0.8, 1.5, 2.2, OUT);
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(ex - 4, cy - 6 + (s < 0 ? -1 : 2));
    ctx.lineTo(ex + 4, cy - 6 + (s < 0 ? 2 : -1));
    ctx.stroke();
  }
};

function drawBeetle(ctx: Ctx, ox: number, frame: number, spiky: boolean, flat = false) {
  const cx = ox + 20;
  const base = 38;
  const shell = spiky ? '#3db06a' : '#d1495b';
  const shellDark = spiky ? '#237a45' : '#8e2a3a';
  const shellLight = spiky ? '#8ee0a5' : '#ff8a96';
  if (flat) {
    ellipse(ctx, cx, base - 4, 17, 5, OUT);
    ellipse(ctx, cx, base - 5, 15, 3.5, shell);
    return;
  }
  // legs
  const lp = frame === 0 ? [-3, 3] : [3, -3];
  for (const [i, dx] of [[-9, lp[0]], [9, lp[1]]]) {
    ellipse(ctx, cx + i + dx, base - 3, 5.5, 3.5, OUT);
    ellipse(ctx, cx + i + dx, base - 3.5, 4.2, 2.4, '#4a3328');
  }
  if (spiky) {
    for (let i = -2; i <= 2; i++) {
      const sx = cx + i * 6;
      ctx.fillStyle = OUT;
      ctx.beginPath();
      ctx.moveTo(sx - 4, 22 - Math.abs(i) * -1);
      ctx.lineTo(sx, 5 + Math.abs(i) * 3);
      ctx.lineTo(sx + 4, 22 - Math.abs(i) * -1);
      ctx.fill();
      ctx.fillStyle = '#eef2f7';
      ctx.beginPath();
      ctx.moveTo(sx - 2.5, 21);
      ctx.lineTo(sx, 8 + Math.abs(i) * 3);
      ctx.lineTo(sx + 2.5, 21);
      ctx.fill();
    }
  }
  // shell dome
  ctx.fillStyle = OUT;
  ctx.beginPath();
  ctx.ellipse(cx, base - 8, 18, 17, 0, Math.PI, 0);
  ctx.lineTo(cx + 18, base - 6);
  ctx.lineTo(cx - 18, base - 6);
  ctx.fill();
  ctx.fillStyle = shell;
  ctx.beginPath();
  ctx.ellipse(cx, base - 8, 16, 15, 0, Math.PI, 0);
  ctx.lineTo(cx + 16, base - 7.5);
  ctx.lineTo(cx - 16, base - 7.5);
  ctx.fill();
  ellipse(ctx, cx - 5, base - 17, 6, 4, shellLight);
  ctx.fillStyle = shellDark;
  ctx.fillRect(cx - 16, base - 11, 32, 3);
  if (!spiky) {
    ellipse(ctx, cx + 6, base - 19, 3, 2.5, shellDark);
    ellipse(ctx, cx + 10, base - 13, 2, 1.8, shellDark);
  }
  // face (looking left = default walking direction)
  ellipse(ctx, cx - 8, base - 11, 9, 7, '#ffe2c4');
  angryEyes(ctx, cx - 6, base - 13, 8);
}

function makeEnemies(scene: Phaser.Scene) {
  // walker + spiker: 3 frames each, 40x40
  for (const [key, spiky] of [['walker', false], ['spiker', true]] as const) {
    const { c, ctx } = canvas(40 * 3, 40);
    drawBeetle(ctx, 0, 0, spiky);
    drawBeetle(ctx, 40, 1, spiky);
    drawBeetle(ctx, 80, 0, spiky, true);
    addCanvas(scene, key, c, (t) => ['w0', 'w1', 'flat'].forEach((f, i) => t.add(f, 0, i * 40, 0, 40, 40)));
  }

  // hopper: frog-ish blob
  {
    const { c, ctx } = canvas(80, 44);
    for (const [i, air] of [[0, false], [1, true]] as const) {
      const cx = i * 40 + 20;
      const by = 42;
      const sq = air ? 1.15 : 0.9;
      // legs
      if (air) {
        ellipse(ctx, cx - 9, by - 4, 4, 7, OUT);
        ellipse(ctx, cx + 9, by - 4, 4, 7, OUT);
        ellipse(ctx, cx - 9, by - 4.5, 2.8, 5.6, '#1b8a83');
        ellipse(ctx, cx + 9, by - 4.5, 2.8, 5.6, '#1b8a83');
      } else {
        ellipse(ctx, cx - 11, by - 3, 7, 3.5, OUT);
        ellipse(ctx, cx + 11, by - 3, 7, 3.5, OUT);
        ellipse(ctx, cx - 11, by - 3.5, 5.6, 2.4, '#1b8a83');
        ellipse(ctx, cx + 11, by - 3.5, 5.6, 2.4, '#1b8a83');
      }
      const bcy = by - 16 * sq - (air ? 6 : 2);
      ellipse(ctx, cx, bcy, 17, 15 * sq, OUT);
      ellipse(ctx, cx, bcy, 15, 13 * sq, '#2ec4b6');
      ellipse(ctx, cx, bcy + 6 * sq, 11, 6 * sq, '#bff5ec');
      // eye bumps
      for (const s of [-1, 1]) {
        ellipse(ctx, cx + s * 7, bcy - 12 * sq, 6, 6, OUT);
        ellipse(ctx, cx + s * 7, bcy - 12 * sq, 4.8, 4.8, '#fff');
        ellipse(ctx, cx + s * 7 - 1.5, bcy - 11.5 * sq, 2, 2.6, OUT);
      }
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, bcy + 1, 6, 0.1 * Math.PI, 0.9 * Math.PI);
      ctx.stroke();
    }
    addCanvas(scene, 'hopper', c, (t) => {
      t.add('idle', 0, 0, 0, 40, 44);
      t.add('jump', 0, 40, 0, 40, 44);
    });
  }

  // flyer: round bug with wings
  {
    const { c, ctx } = canvas(88, 40);
    for (const i of [0, 1]) {
      const cx = i * 44 + 22;
      const cy = 22;
      const up = i === 0;
      for (const s of [-1, 1]) {
        ctx.save();
        ctx.translate(cx + s * 9, cy - 6);
        ctx.rotate(s * (up ? -0.7 : 0.35));
        ellipse(ctx, s * 6, up ? -6 : 2, 10, 6, OUT);
        ellipse(ctx, s * 6, up ? -6 : 2, 8.5, 4.6, '#e9f6ff');
        ctx.restore();
      }
      ellipse(ctx, cx, cy, 14, 13, OUT);
      ellipse(ctx, cx, cy, 12, 11, '#9b5de5');
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(cx - 12, cy + 1, 24, 3);
      ellipse(ctx, cx - 4, cy - 5, 4, 3, '#c9a2f2');
      angryEyes(ctx, cx - 1, cy - 2, 9);
      // stinger
      ctx.fillStyle = OUT;
      ctx.beginPath();
      ctx.moveTo(cx + 10, cy + 3);
      ctx.lineTo(cx + 19, cy + 7);
      ctx.lineTo(cx + 9, cy + 9);
      ctx.fill();
    }
    addCanvas(scene, 'flyer', c, (t) => {
      t.add('f0', 0, 0, 0, 44, 40);
      t.add('f1', 0, 44, 0, 44, 40);
    });
  }

  // turret base + barrel
  {
    const { c, ctx } = canvas(64, 48);
    roundRect(ctx, 2, 14, 60, 34, 6, OUT);
    roundRect(ctx, 5, 17, 54, 28, 4, '#5a6378');
    ctx.fillStyle = '#7c879e';
    ctx.fillRect(7, 19, 50, 4);
    for (const x of [10, 54]) ellipse(ctx, x, 40, 2, 2, OUT);
    // dome
    ellipse(ctx, 32, 18, 17, 14, OUT);
    ellipse(ctx, 32, 18, 15, 12, '#6e7890');
    ellipse(ctx, 32, 18, 7, 7, OUT);
    ellipse(ctx, 32, 18, 5, 5, '#ff4d4d');
    ellipse(ctx, 30.5, 16.5, 1.6, 1.6, '#ffd0d0');
    addCanvas(scene, 'turret', c);
    const b = canvas(36, 14);
    roundRect(b.ctx, 0, 1, 34, 12, 4, OUT);
    roundRect(b.ctx, 2, 3, 30, 8, 3, '#3a4152');
    b.ctx.fillStyle = '#ff4d4d';
    b.ctx.fillRect(27, 3, 3, 8);
    addCanvas(scene, 'barrel', b.c);
  }

  // enemy bullet
  {
    const { c, ctx } = canvas(20, 20);
    const g = ctx.createRadialGradient(10, 10, 1, 10, 10, 10);
    g.addColorStop(0, '#ffe08a');
    g.addColorStop(0.45, '#ff5a3c');
    g.addColorStop(1, '#ff5a3c00');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 20, 20);
    ellipse(ctx, 10, 10, 4.5, 4.5, OUT);
    ellipse(ctx, 10, 10, 3, 3, '#ffdd55');
    addCanvas(scene, 'bullet', c);
  }
}

// ─────────────────────────────────────────────────────────────
// Items, projectiles, FX
// ─────────────────────────────────────────────────────────────

function makeItems(scene: Phaser.Scene) {
  // coin spin: 4 frames 24x24
  {
    const widths = [9, 6.5, 2.5, 6.5];
    const { c, ctx } = canvas(24 * 4, 24);
    widths.forEach((w, i) => {
      const cx = i * 24 + 12;
      ellipse(ctx, cx, 12, w + 1.5, 11, OUT);
      ellipse(ctx, cx, 12, w, 9.5, THEME.gold);
      if (w > 3) {
        ellipse(ctx, cx, 12, w * 0.55, 6, THEME.goldDark);
        ellipse(ctx, cx - w * 0.3, 8, w * 0.25, 3, '#fff3b0');
      }
    });
    addCanvas(scene, 'coin', c, (t) => widths.forEach((_, i) => t.add(`c${i}`, 0, i * 24, 0, 24, 24)));
  }
  // heart
  {
    const { c, ctx } = canvas(26, 24);
    const heart = (s: number, col: string) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(13, 21 * s + (1 - s) * 12);
      ctx.bezierCurveTo(13 - 13 * s, 12, 13 - 11 * s, 2 + (1 - s) * 6, 13, 7 + (1 - s) * 2);
      ctx.bezierCurveTo(13 + 11 * s, 2 + (1 - s) * 6, 13 + 13 * s, 12, 13, 21 * s + (1 - s) * 12);
      ctx.fill();
    };
    heart(1.08, OUT);
    heart(0.92, '#ff4d6d');
    ellipse(ctx, 8.5, 9, 2.5, 2, '#ffc2cf');
    addCanvas(scene, 'heart', c);
  }
  // rocket
  {
    const { c, ctx } = canvas(30, 14);
    roundRect(ctx, 3, 3, 22, 8, 3, OUT);
    roundRect(ctx, 4, 4, 20, 6, 2, '#e9edf3');
    ctx.fillStyle = '#ff4d4d';
    ctx.beginPath();
    ctx.moveTo(22, 2.5);
    ctx.quadraticCurveTo(31, 7, 22, 11.5);
    ctx.fill();
    ctx.fillStyle = OUT;
    ctx.beginPath();
    ctx.moveTo(4, 7);
    ctx.lineTo(0, 0);
    ctx.lineTo(9, 4);
    ctx.moveTo(4, 7);
    ctx.lineTo(0, 14);
    ctx.lineTo(9, 10);
    ctx.fill();
    ctx.fillStyle = '#ff4d4d';
    ctx.fillRect(12, 4, 2, 6);
    addCanvas(scene, 'rocket', c);
  }
  // soft round particle
  {
    const { c, ctx } = canvas(32, 32);
    const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, '#ffffffff');
    g.addColorStop(0.6, '#ffffffcc');
    g.addColorStop(1, '#ffffff00');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 32, 32);
    addCanvas(scene, 'puff', c);
  }
  // hard circle (for explosion cores)
  {
    const { c, ctx } = canvas(64, 64);
    ellipse(ctx, 32, 32, 31, 31, '#ffffff');
    addCanvas(scene, 'disc', c);
  }
  // shockwave ring
  {
    const { c, ctx } = canvas(128, 128);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(64, 64, 60, 0, Math.PI * 2);
    ctx.stroke();
    addCanvas(scene, 'ring', c);
  }
  // spark
  {
    const { c, ctx } = canvas(10, 10);
    ellipse(ctx, 5, 5, 4.5, 4.5, '#ffffff');
    addCanvas(scene, 'spark', c);
  }
  // star
  {
    const { c, ctx } = canvas(20, 20);
    ctx.fillStyle = OUT;
    const star = (r: number, col: string) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const rr = i % 2 ? r * 0.45 : r;
        ctx.lineTo(10 + Math.cos(a) * rr, 10.5 + Math.sin(a) * rr);
      }
      ctx.fill();
    };
    star(10, OUT);
    star(7.5, '#ffe14d');
    addCanvas(scene, 'star', c);
  }
  // brick debris
  {
    const { c, ctx } = canvas(12, 12);
    roundRect(ctx, 0, 0, 12, 12, 2, OUT);
    roundRect(ctx, 1.5, 1.5, 9, 9, 1.5, THEME.brick);
    ctx.fillStyle = THEME.brickLight;
    ctx.fillRect(2, 2, 8, 2);
    addCanvas(scene, 'debris', c);
  }
  // checkpoint (off / on)
  {
    const { c, ctx } = canvas(96, 112);
    for (const i of [0, 1]) {
      const ox = i * 48;
      roundRect(ctx, ox + 20, 6, 8, 104, 3, OUT);
      roundRect(ctx, ox + 22, 8, 4, 100, 2, '#e9edf3');
      ellipse(ctx, ox + 24, 8, 6, 6, OUT);
      ellipse(ctx, ox + 24, 8, 4.5, 4.5, i ? '#ffd23f' : '#9aa3ad');
      // flag
      ctx.fillStyle = OUT;
      ctx.beginPath();
      if (i) {
        ctx.moveTo(ox + 27, 14);
        ctx.lineTo(ox + 47, 22);
        ctx.lineTo(ox + 27, 32);
      } else {
        ctx.moveTo(ox + 27, 70);
        ctx.lineTo(ox + 44, 78);
        ctx.lineTo(ox + 27, 88);
      }
      ctx.fill();
      ctx.fillStyle = i ? '#3ddc84' : '#b0b8c4';
      ctx.beginPath();
      if (i) {
        ctx.moveTo(ox + 28, 16.5);
        ctx.lineTo(ox + 43, 22.5);
        ctx.lineTo(ox + 28, 29.5);
      } else {
        ctx.moveTo(ox + 28, 72.5);
        ctx.lineTo(ox + 40, 78.5);
        ctx.lineTo(ox + 28, 85.5);
      }
      ctx.fill();
      roundRect(ctx, ox + 12, 104, 24, 8, 3, OUT);
      roundRect(ctx, ox + 14, 105.5, 20, 5, 2, '#6c7689');
    }
    addCanvas(scene, 'checkpoint', c, (t) => {
      t.add('off', 0, 0, 0, 48, 112);
      t.add('on', 0, 48, 0, 48, 112);
    });
  }
  // goal: tall post with a big round sign
  {
    const { c, ctx } = canvas(80, 160);
    roundRect(ctx, 36, 50, 8, 108, 3, OUT);
    roundRect(ctx, 38, 52, 4, 104, 2, '#e9edf3');
    roundRect(ctx, 24, 150, 32, 10, 3, OUT);
    roundRect(ctx, 26, 151.5, 28, 7, 2, '#6c7689');
    addCanvas(scene, 'goal-post', c);
    const s = canvas(72, 72);
    ellipse(s.ctx, 36, 36, 35, 35, OUT);
    ellipse(s.ctx, 36, 36, 31, 31, '#ffffff');
    ellipse(s.ctx, 36, 36, 26, 26, '#3fa7ff');
    const sc = s.ctx;
    sc.fillStyle = '#ffe14d';
    sc.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 ? 8.5 : 19;
      sc.lineTo(36 + Math.cos(a) * rr, 37 + Math.sin(a) * rr);
    }
    sc.fill();
    addCanvas(scene, 'goal-sign', s.c);
  }
}

// ─────────────────────────────────────────────────────────────
// Decor (non-colliding scenery placed on the ground)
// ─────────────────────────────────────────────────────────────

function makeDecor(scene: Phaser.Scene) {
  // bush
  {
    const { c, ctx } = canvas(80, 36);
    const lumps = [
      [16, 22, 14],
      [36, 16, 18],
      [58, 21, 15],
    ];
    for (const [x, y, r] of lumps) ellipse(ctx, x, y, r + 2, r + 2, OUT);
    ctx.fillStyle = OUT;
    ctx.fillRect(4, 22, 72, 14);
    for (const [x, y, r] of lumps) ellipse(ctx, x, y, r, r, THEME.hillA);
    ctx.fillStyle = THEME.hillA;
    ctx.fillRect(6, 22, 68, 14);
    for (const [x, y, r] of lumps) ellipse(ctx, x - r * 0.3, y - r * 0.35, r * 0.4, r * 0.3, THEME.grassLight);
    addCanvas(scene, 'bush', c);
  }
  // flowers (2 colors)
  {
    const { c, ctx } = canvas(36, 28);
    for (const [i, col] of [[0, '#ff6fa3'], [1, '#ffd23f']] as const) {
      const cx = i * 18 + 9;
      ctx.fillStyle = THEME.grassDark;
      ctx.fillRect(cx - 1, 12, 2, 16);
      ellipse(ctx, cx + 3, 20, 3, 1.6, THEME.grass);
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        ellipse(ctx, cx + Math.cos(a) * 4, 9 + Math.sin(a) * 4, 3.2, 3.2, col);
      }
      ellipse(ctx, cx, 9, 2.6, 2.6, '#fff4c2');
    }
    addCanvas(scene, 'flower', c, (t) => {
      t.add('f0', 0, 0, 0, 18, 28);
      t.add('f1', 0, 18, 0, 18, 28);
    });
  }
  // palm tree
  {
    const { c, ctx } = canvas(96, 150);
    // trunk segments
    for (let i = 0; i < 9; i++) {
      const y = 146 - i * 13;
      const x = 48 + Math.sin(i * 0.35) * 6;
      ellipse(ctx, x, y, 8, 7.5, OUT);
      ellipse(ctx, x, y, 6.5, 6, i % 2 ? '#b0773f' : '#c98b4b');
    }
    const top = [48 + Math.sin(8 * 0.35) * 6, 146 - 8 * 13];
    for (const a of [-2.7, -2.1, -1.4, -0.9, -0.35, 0.3]) {
      ctx.save();
      ctx.translate(top[0], top[1]);
      ctx.rotate(a);
      ellipse(ctx, 22, 0, 26, 8, OUT);
      ellipse(ctx, 22, 0, 24, 6, THEME.grass);
      ctx.fillStyle = THEME.grassDark;
      ctx.fillRect(2, -1, 40, 2);
      ctx.restore();
    }
    ellipse(ctx, top[0] - 4, top[1] + 4, 5, 5, OUT);
    ellipse(ctx, top[0] - 4, top[1] + 4, 3.8, 3.8, '#7a4320');
    ellipse(ctx, top[0] + 4, top[1] + 6, 5, 5, OUT);
    ellipse(ctx, top[0] + 4, top[1] + 6, 3.8, 3.8, '#7a4320');
    addCanvas(scene, 'palm', c);
  }
  // signpost with arrow
  {
    const { c, ctx } = canvas(48, 56);
    roundRect(ctx, 20, 20, 8, 36, 2, OUT);
    roundRect(ctx, 22, 22, 4, 34, 1, THEME.wood);
    ctx.fillStyle = OUT;
    ctx.beginPath();
    ctx.moveTo(4, 6);
    ctx.lineTo(34, 6);
    ctx.lineTo(46, 17);
    ctx.lineTo(34, 28);
    ctx.lineTo(4, 28);
    ctx.fill();
    ctx.fillStyle = '#e8b27a';
    ctx.beginPath();
    ctx.moveTo(6, 8.5);
    ctx.lineTo(33, 8.5);
    ctx.lineTo(42.5, 17);
    ctx.lineTo(33, 25.5);
    ctx.lineTo(6, 25.5);
    ctx.fill();
    ctx.fillStyle = THEME.woodDark;
    ctx.beginPath();
    ctx.moveTo(14, 13);
    ctx.lineTo(26, 13);
    ctx.lineTo(26, 10);
    ctx.lineTo(33, 17);
    ctx.lineTo(26, 24);
    ctx.lineTo(26, 21);
    ctx.lineTo(14, 21);
    ctx.fill();
    addCanvas(scene, 'sign', c);
  }
  // grass tuft
  {
    const { c, ctx } = canvas(20, 12);
    ctx.fillStyle = THEME.grassDark;
    for (const [x, h, lean] of [[4, 10, -2], [9, 12, 0], [14, 9, 2]]) {
      ctx.beginPath();
      ctx.moveTo(x - 2.5, 12);
      ctx.lineTo(x + lean, 12 - h);
      ctx.lineTo(x + 2.5, 12);
      ctx.fill();
    }
    addCanvas(scene, 'tuft', c);
  }
}

// ─────────────────────────────────────────────────────────────
// Parallax backgrounds (each is horizontally tileable)
// ─────────────────────────────────────────────────────────────

/** Draws `fn` at x, and wrapped at x±w so the strip tiles seamlessly. */
const wrap = (w: number, fn: (dx: number) => void) => [-w, 0, w].forEach(fn);

function makeBackgrounds(scene: Phaser.Scene) {
  // Sky
  {
    const { c, ctx } = canvas(4, 512);
    const g = ctx.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, THEME.skyTop);
    g.addColorStop(1, THEME.skyBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 4, 512);
    addCanvas(scene, 'bg-sky', c);
  }
  // Far mountains
  {
    const W = 1024;
    const H = 260;
    const { c, ctx } = canvas(W, H);
    const r = rng(11);
    const peaks: [number, number, number][] = [];
    for (let x = 0; x < W; x += 110 + r() * 80) peaks.push([x, 60 + r() * 90, 120 + r() * 70]);
    for (const [col, shift, scale] of [[THEME.farB, 50, 0.8], [THEME.farA, 0, 1]] as const) {
      for (const [px, py, pw] of peaks) {
        wrap(W, (dx) => {
          const x = px + dx + shift;
          const top = py + (1 - scale) * 80;
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.moveTo(x - pw * scale, H);
          ctx.quadraticCurveTo(x - pw * 0.15, top - 10, x, top);
          ctx.quadraticCurveTo(x + pw * 0.15, top - 10, x + pw * scale, H);
          ctx.fill();
          if (scale === 1) {
            // snow cap
            ctx.fillStyle = '#f4f9ff';
            ctx.beginPath();
            ctx.moveTo(x - 26, top + 28);
            ctx.quadraticCurveTo(x - 6, top - 6, x, top);
            ctx.quadraticCurveTo(x + 6, top - 6, x + 26, top + 28);
            ctx.lineTo(x + 12, top + 22);
            ctx.lineTo(x + 2, top + 30);
            ctx.lineTo(x - 10, top + 21);
            ctx.fill();
          }
        });
      }
    }
    addCanvas(scene, 'bg-far', padV(c));
  }
  // Clouds
  {
    const W = 1024;
    const H = 220;
    const { c, ctx } = canvas(W, H);
    const r = rng(5);
    for (let i = 0; i < 7; i++) {
      const cx = r() * W;
      const cy = 30 + r() * 140;
      const s = 0.6 + r() * 0.7;
      wrap(W, (dx) => {
        const lumps = [
          [-30, 6, 20],
          [-10, -6, 26],
          [16, -2, 22],
          [36, 8, 16],
        ];
        for (const [lx, ly, lr] of lumps) ellipse(ctx, cx + dx + lx * s, cy + ly * s + 3, lr * s, lr * s, '#cfe9fb');
        for (const [lx, ly, lr] of lumps) ellipse(ctx, cx + dx + lx * s, cy + ly * s, lr * s, lr * s, '#ffffff');
        ctx.fillStyle = '#cfe9fb';
        ctx.fillRect(cx + dx - 46 * s, cy + 12 * s, 96 * s, 4 * s);
      });
    }
    addCanvas(scene, 'bg-clouds', padV(c));
  }
  // Mid hills with checker stripes
  {
    const W = 1024;
    const H = 260;
    const { c, ctx } = canvas(W, H);
    const r = rng(21);
    const hills: [number, number, number][] = [];
    for (let x = 0; x < W; x += 150 + r() * 110) hills.push([x, 70 + r() * 90, 110 + r() * 80]);
    for (const [hx, hy, hw] of hills) {
      wrap(W, (dx) => {
        const x = hx + dx;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(x - hw, H);
        ctx.bezierCurveTo(x - hw, hy - 20, x + hw, hy - 20, x + hw, H);
        ctx.closePath();
        ctx.fillStyle = THEME.hillA;
        ctx.fill();
        ctx.clip();
        // checker bands
        for (let yy = hy + 26; yy < H; yy += 28) {
          for (let xx = x - hw; xx < x + hw; xx += 28) {
            if (((xx - (x - hw)) / 28 + (yy - hy) / 28) % 2 < 1) {
              ctx.fillStyle = THEME.hillB;
              ctx.fillRect(xx, yy, 28, 14);
            }
          }
        }
        ctx.fillStyle = THEME.hillC;
        ctx.beginPath();
        ctx.ellipse(x - hw * 0.25, hy + 12, hw * 0.35, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
    }
    ctx.fillStyle = THEME.hillB;
    ctx.fillRect(0, H - 30, W, 30);
    addCanvas(scene, 'bg-hills', padV(c));
  }
  // Near bushes / tree line
  {
    const W = 1024;
    const H = 160;
    const { c, ctx } = canvas(W, H);
    const r = rng(33);
    for (let x = 0; x < W + 60; x += 34 + r() * 30) {
      const rr = 28 + r() * 26;
      const yy = 70 + r() * 30;
      wrap(W, (dx) => {
        ellipse(ctx, x + dx, yy, rr, rr, THEME.nearB);
        ellipse(ctx, x + dx - rr * 0.2, yy - rr * 0.25, rr * 0.75, rr * 0.7, THEME.nearA);
      });
    }
    ctx.fillStyle = THEME.nearB;
    ctx.fillRect(0, 95, W, H - 95);
    addCanvas(scene, 'bg-near', padV(c));
  }
}

export function generateTextures(scene: Phaser.Scene) {
  makeTileset(scene);
  makeCharacters(scene);
  makeEnemies(scene);
  makeItems(scene);
  makeDecor(scene);
  makeBackgrounds(scene);
}
