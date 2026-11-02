import Phaser from 'phaser';
import { TILE } from '../config';
import { CHARACTERS } from '../data/characters';
import { TILE_COUNT } from '../level/tiles';
import { BIGPUFF_H, BIGPUFF_W, GIANT_H, GIANT_W, PUFFBALL_H, PUFFBALL_W, drawBigPuff, drawGiant, drawPuffball } from './baddies';
import { drawMuzzleFlash, drawRocket } from './bazooka';
import { drawSoccerBall, drawSoccerGoal } from './soccer';
import { GOAT_FRAMES, GOAT_H, GOAT_W, drawGoat } from './goat';
import { drawParachute } from './parachute';
import { drawHockeyNet, drawPuck, drawRinkLines, drawStick } from './hockey';
import { MOUNTAIN_LOOKS, drawMountainFar, drawMountainMid, drawMountainNear, type MountainLook } from './mountain';
import { FLAME_FRAMES, FLAME_H, FLAME_W, drawFlame } from './flame';
import { ART_RES, ART_STYLE, CHAR_H, CHAR_W, POSES, canvas, drawCharacter, ellipse, type Ctx } from './draw';
import { STYLES } from './handdrawn';
import {
  DEFAULT_PALETTE,
  PALETTES,
  drawAura,
  drawNuggie,
  drawRootBeer,
  drawBloom,
  drawBoulder,
  drawBramble,
  drawFarLayer,
  drawFlower,
  drawGate,
  drawGateSwirl,
  drawHillsLayer,
  drawNearLayer,
  drawSky,
  type WorldPalette,
} from './world';

/**
 * Generates every texture at boot, all in the polished hand-drawn style.
 * Sprites are drawn at ART_RES× their world size and shown scaled down,
 * so they stay sharp on phone and tablet screens.
 */

/** Resolution for world props and terrain (multiple of world px). */
export const PROP_RES = 2;
export const BG_RES = 1.5;

export function addCanvas(
  scene: Phaser.Scene,
  key: string,
  c: HTMLCanvasElement,
  frames?: (tex: Phaser.Textures.CanvasTexture) => void,
) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.addCanvas(key, c)!;
  frames?.(tex);
  return tex;
}

/** Draw `fn` in world units into a canvas of world size (w × h) at resolution `res`. */
export function hires(w: number, h: number, res: number, fn: (ctx: Ctx) => void) {
  const { c, ctx } = canvas(Math.ceil(w * res), Math.ceil(h * res));
  ctx.scale(res, res);
  fn(ctx);
  return c;
}

/** A frame sheet: each frame is drawn in world units w × h at `res`. */
function sheet<F extends string>(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  frames: readonly F[],
  draw: (ctx: Ctx, f: F) => void,
  res = ART_RES,
) {
  const { c, ctx } = canvas(Math.ceil(w * frames.length * res), Math.ceil(h * res));
  ctx.scale(res, res);
  frames.forEach((f, i) => {
    ctx.save();
    ctx.translate(i * w, 0);
    draw(ctx, f);
    ctx.restore();
  });
  addCanvas(scene, key, c, (t) =>
    frames.forEach((f, i) => t.add(f, 0, Math.round(i * w * res), 0, Math.round(w * res), Math.round(h * res))),
  );
}

// ─────────────────────────────────────────────────────────────

/** The collision tilemap is invisible, but Phaser still wants a tileset image. */
function makeCollisionTiles(scene: Phaser.Scene) {
  const cell = TILE + 2;
  const { c } = canvas(TILE_COUNT * cell, cell);
  addCanvas(scene, 'tiles', c);
}

function makeCharacters(scene: Phaser.Scene) {
  for (const ch of CHARACTERS) sheet(scene, `char-${ch.id}`, CHAR_W, CHAR_H, POSES, (ctx, p) => drawCharacter(ctx, 0, 0, ch, p));
}

function makeBaddies(scene: Phaser.Scene) {
  const st = STYLES[ART_STYLE];
  sheet(scene, 'puffball', PUFFBALL_W, PUFFBALL_H, ['w0', 'w1', 'flat'] as const, (ctx, f) => drawPuffball(ctx, 0, 0, f, st));
  sheet(scene, 'bigpuff', BIGPUFF_W, BIGPUFF_H, ['w0', 'w1', 'm0', 'm1'] as const, (ctx, f) => drawBigPuff(ctx, 0, 0, f, st));
  sheet(scene, 'giant', GIANT_W, GIANT_H, ['w0', 'w1', 'crouch', 'air', 'slam'] as const, (ctx, f) => drawGiant(ctx, 0, 0, f, st), 2.5);
  sheet(scene, 'goat', GOAT_W, GOAT_H, GOAT_FRAMES, (ctx, f) => drawGoat(ctx, 0, 0, f, st));
}

function makeItems(scene: Phaser.Scene, pal: WorldPalette) {
  const st = STYLES[ART_STYLE];
  addCanvas(scene, 'aura', hires(48, 48, ART_RES, (ctx) => drawAura(ctx, 24, 25, 10.5)));
  addCanvas(scene, 'soccerball', hires(28, 28, ART_RES, (ctx) => drawSoccerBall(ctx, 14, 14, 11)));
  addCanvas(scene, 'soccerball-big', hires(44, 44, ART_RES, (ctx) => drawSoccerBall(ctx, 22, 22, 17)));
  addCanvas(scene, 'soccergoal', hires(76, 56, PROP_RES, (ctx) => drawSoccerGoal(ctx, 4, 54, 58, 38)));
  // giant's ground shockwave: a curling crest of dust (faces right)
  addCanvas(
    scene,
    'wave',
    hires(56, 34, ART_RES, (ctx) => {
      const crest: [number, number][] = [];
      for (let i = 0; i <= 24; i++) {
        const t = i / 24;
        crest.push([4 + t * 48, 32 - Math.sin(t * Math.PI) ** 0.7 * 24 - (t > 0.55 ? (t - 0.55) * 14 : 0)]);
      }
      crest.push([52, 32]);
      // a hot orange energy wave with a yellow core, so it stands out on any background
      ctx.save();
      ctx.shadowColor = '#ff5a1f';
      ctx.shadowBlur = 5;
      st.shape(ctx, crest, { base: '#ff6a2a', shade: '#d23a12', light: '#ffd27a' }, 2101, { lw: 1.25, light: [20, 12] });
      ctx.restore();
      const core = crest.map(([x, y]) => [x, 32 - (32 - y) * 0.55] as [number, number]);
      st.shape(ctx, core, { base: '#ffe066', shade: '#ffb02e', light: '#fffbe0' }, 2104, { lw: 0.5, plain: true });
      st.line(ctx, [[14, 26], [24, 16], [34, 14]], 2102, 0.7, '#fff6c8');
      st.line(ctx, [[26, 28], [36, 20], [44, 19]], 2103, 0.7, '#fff6c8');
    }),
  );
  sheet(scene, 'flame', FLAME_W, FLAME_H, FLAME_FRAMES, (ctx, f) => drawFlame(ctx, +f[1]));
  addCanvas(scene, 'chute', hires(64, 60, ART_RES, (ctx) => drawParachute(ctx)));
  addCanvas(scene, 'hstick', hires(40, 40, ART_RES, (ctx) => drawStick(ctx)));
  addCanvas(scene, 'puck', hires(18, 14, ART_RES, (ctx) => drawPuck(ctx, 9, 8, PUCK_R_ART)));
  addCanvas(scene, 'hockeynet', hires(64, 44, PROP_RES, (ctx) => drawHockeyNet(ctx, 4, 40, 44, 30)));
  addCanvas(scene, 'rinklines', hires(400, 7, 2, (ctx) => drawRinkLines(ctx, 400, 1)));
  addCanvas(scene, 'nuggie', hires(40, 34, ART_RES, (ctx) => drawNuggie(ctx, 20, 17, 11)));
  addCanvas(scene, 'rootbeer', hires(30, 40, ART_RES, (ctx) => drawRootBeer(ctx, 15, 38, 34)));
  addCanvas(scene, 'rocket', hires(30, 16, ART_RES, (ctx) => drawRocket(ctx, st, 15, 8)));
  addCanvas(scene, 'flash', hires(40, 32, ART_RES, (ctx) => drawMuzzleFlash(ctx, st, 20, 16, 12)));
  addCanvas(scene, 'boulder', hires(36, 36, PROP_RES, (ctx) => drawBoulder(ctx, 2, 2, pal, 7)));
  addCanvas(scene, 'boulder2', hires(36, 36, PROP_RES, (ctx) => drawBoulder(ctx, 2, 2, pal, 19)));
  addCanvas(scene, 'bramble', hires(36, 34, PROP_RES, (ctx) => drawBramble(ctx, 2, 32, pal, 3)));
  addCanvas(scene, 'bramble2', hires(36, 34, PROP_RES, (ctx) => drawBramble(ctx, 2, 32, pal, 11)));
  sheet(scene, 'bloom', 64, 104, ['off', 'on'] as const, (ctx, f) => drawBloom(ctx, 32, 102, f === 'on'), PROP_RES);
  addCanvas(scene, 'gate', hires(130, 130, PROP_RES, (ctx) => drawGate(ctx, 65, 126, pal)));
  addCanvas(scene, 'gate-swirl', hires(90, 90, PROP_RES, (ctx) => drawGateSwirl(ctx, 45, 45, 42)));
  sheet(scene, 'flower', 16, 24, ['f0', 'f1', 'f2', 'f3'] as const, (ctx, f) => drawFlower(ctx, 8, 23, pal.flowers[+f[1]], 30 + +f[1]), PROP_RES);
  addCanvas(
    scene,
    'tuft',
    hires(20, 12, PROP_RES, (ctx) => {
      ctx.fillStyle = pal.grass.shade;
      for (const [x, h, lean] of [[5, 9, -2], [10, 11, 0], [15, 8, 2]]) {
        ctx.beginPath();
        ctx.moveTo(x - 2.4, 12);
        ctx.quadraticCurveTo(x + lean * 0.3, 12 - h * 0.6, x + lean, 12 - h);
        ctx.quadraticCurveTo(x + lean * 0.4 + 1, 12 - h * 0.4, x + 2.4, 12);
        ctx.fill();
      }
    }),
  );

  // generic FX particles
  const soft = (key: string, size: number) => {
    const { c, ctx } = canvas(size, size);
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, '#ffffffff');
    g.addColorStop(0.6, '#ffffffcc');
    g.addColorStop(1, '#ffffff00');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    addCanvas(scene, key, c);
  };
  soft('puff', 32);
  soft('glow', 64);
  {
    const { c, ctx } = canvas(64, 64);
    ellipse(ctx, 32, 32, 31, 31, '#ffffff');
    addCanvas(scene, 'disc', c);
  }
  {
    const { c, ctx } = canvas(128, 128);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(64, 64, 60, 0, Math.PI * 2);
    ctx.stroke();
    addCanvas(scene, 'ring', c);
  }
  {
    const { c, ctx } = canvas(10, 10);
    ellipse(ctx, 5, 5, 4.5, 4.5, '#ffffff');
    addCanvas(scene, 'spark', c);
  }
  {
    const { c, ctx } = canvas(24, 24);
    const star = (r: number, col: string) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const rr = i % 2 ? r * 0.45 : r;
        ctx.lineTo(12 + Math.cos(a) * rr, 12.5 + Math.sin(a) * rr);
      }
      ctx.fill();
    };
    star(11, '#3a2418');
    star(8.5, '#ffe14d');
    addCanvas(scene, 'star', c);
  }
  {
    // rock chips for blasted boulders
    const { c, ctx } = canvas(14, 14);
    ctx.fillStyle = '#3a2418';
    ctx.beginPath();
    ctx.moveTo(2, 9);
    ctx.lineTo(6, 1);
    ctx.lineTo(13, 4);
    ctx.lineTo(11, 12);
    ctx.lineTo(4, 13);
    ctx.fill();
    ctx.fillStyle = pal.rock.base;
    ctx.beginPath();
    ctx.moveTo(3.5, 9);
    ctx.lineTo(6.5, 2.8);
    ctx.lineTo(11.5, 5);
    ctx.lineTo(10, 10.8);
    ctx.lineTo(4.5, 11.5);
    ctx.fill();
    addCanvas(scene, 'chip', c);
  }
}

const PUCK_R_ART = 7;

/** Parallax layers, each horizontally tileable, drawn at BG_RES. Heights are world px. */
export const BG_LAYERS = {
  far: { w: 1024, h: 220 },
  clouds: { w: 1024, h: 200 },
  hills: { w: 1024, h: 230 },
  near: { w: 1024, h: 150 },
};

/** Adds 2 transparent rows above/below so vertically wrapping TileSprites don't bleed edge pixels. */
function padV(src: HTMLCanvasElement) {
  const { c, ctx } = canvas(src.width, src.height + 4);
  ctx.drawImage(src, 0, 2);
  return c;
}

/** Background textures for one look, keyed `bg-<layer>:<palette id>` (the scenery drifts between looks). */
export const bgKey = (layer: 'sky' | 'far' | 'clouds' | 'hills' | 'near', theme: string) => `bg-${layer}:${theme}`;

function makeBackgrounds(scene: Phaser.Scene, pal: WorldPalette) {
  const k = (layer: Parameters<typeof bgKey>[0]) => bgKey(layer, pal.id);
  addCanvas(scene, k('sky'), hires(4, 512, 1, (ctx) => drawSky(ctx, 4, 512, pal)));
  const L = BG_LAYERS;
  addCanvas(scene, k('far'), padV(hires(L.far.w, L.far.h, BG_RES, (ctx) => drawFarLayer(ctx, L.far.w, L.far.h, pal))));
  addCanvas(scene, k('hills'), padV(hires(L.hills.w, L.hills.h, BG_RES, (ctx) => drawHillsLayer(ctx, L.hills.w, L.hills.h, pal))));
  addCanvas(scene, k('near'), padV(hires(L.near.w, L.near.h, BG_RES, (ctx) => drawNearLayer(ctx, L.near.w, L.near.h, pal))));
}

/** Part 2's backgrounds for one mountain look (same layer sizes as Part 1's). */
function makeMountainBackgrounds(scene: Phaser.Scene, look: MountainLook) {
  const k = (layer: Parameters<typeof bgKey>[0]) => bgKey(layer, look.pal.id);
  addCanvas(scene, k('sky'), hires(4, 512, 1, (ctx) => drawSky(ctx, 4, 512, look.pal)));
  const L = BG_LAYERS;
  addCanvas(scene, k('far'), padV(hires(L.far.w, L.far.h, BG_RES, (ctx) => drawMountainFar(ctx, L.far.w, L.far.h, look))));
  addCanvas(scene, k('hills'), padV(hires(L.hills.w, L.hills.h, BG_RES, (ctx) => drawMountainMid(ctx, L.hills.w, L.hills.h, look))));
  addCanvas(scene, k('near'), padV(hires(L.near.w, L.near.h, BG_RES, (ctx) => drawMountainNear(ctx, L.near.w, L.near.h, look))));
}

/**
 * The same work as generateTextures, split into steps so the boot can draw one
 * per frame behind the start screen (the screen appears right away).
 */
export function textureSteps(scene: Phaser.Scene, pal: WorldPalette = DEFAULT_PALETTE): { name: string; run: () => void }[] {
  return [
    { name: 'tiles', run: () => makeCollisionTiles(scene) },
    { name: 'heroes', run: () => makeCharacters(scene) },
    { name: 'baddies', run: () => makeBaddies(scene) },
    { name: 'items', run: () => makeItems(scene, pal) },
    ...['puff', 'meadow', 'candy', 'golden'].map((id) => ({ name: `bg-${id}`, run: () => makeBackgrounds(scene, PALETTES[id]) })),
    ...MOUNTAIN_LOOKS.map((look) => ({ name: `bg-${look.pal.id}`, run: () => makeMountainBackgrounds(scene, look) })),
  ];
}

export function generateTextures(scene: Phaser.Scene, pal: WorldPalette = DEFAULT_PALETTE) {
  makeCollisionTiles(scene);
  makeCharacters(scene);
  makeBaddies(scene);
  makeItems(scene, pal);
  for (const id of ['puff', 'meadow', 'candy', 'golden']) makeBackgrounds(scene, PALETTES[id]);
  for (const look of MOUNTAIN_LOOKS) makeMountainBackgrounds(scene, look);
}
