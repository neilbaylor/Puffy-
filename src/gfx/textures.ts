import Phaser from 'phaser';
import { TILE } from '../config';
import { CHARACTERS } from '../data/characters';
import { TILE_COUNT } from '../level/tiles';
import { BIGPUFF_FRAMES, BIGPUFF_H, BIGPUFF_W, GIANT_FRAMES, GIANT_H, GIANT_W, PUFFBALL_H, PUFFBALL_W, drawBigPuff, drawGiant, drawPuffball } from './baddies';
import { drawMuzzleFlash, drawRocket } from './bazooka';
import { drawSoccerBall, drawSoccerGoal } from './soccer';
import { GOAT_FRAMES, GOAT_H, GOAT_W, drawGoat, drawSpit } from './goat';
import { BLASTER, SAW, W_RES, drawBlaster, drawBullet, drawChainsaw, drawFlailBall } from './weapons';
import { drawParachute } from './parachute';
import { drawHockeyNet, drawPuck, drawRinkLines, drawStick } from './hockey';
import { MOUNTAIN_LOOKS, drawMountainFar, drawMountainMid, drawMountainNear, type MountainLook } from './mountain';
import './plopLooks'; // (registers Plop Invasion's palettes)
import { POOWAVE_H, POOWAVE_W, drawPooOnGoat, drawPooPile, drawPooWave, drawStink, drawVolleyNet, drawVolleyball } from './plopworld';
import { PLOP_FRAMES, PLOP_H, PLOP_W, drawPlop, type PlopKind } from './plops';
import { drawPoo } from './hazards';
import { FLAME_FRAMES, FLAME_H, FLAME_W, drawDyingFlame, drawFlame, drawScorch } from './flame';
import { ART_RES, ART_STYLE, CHAR_H, CHAR_W, POSES, canvas, drawCharacter, ellipse, type Ctx } from './draw';
import { FACE_FRAMES, faceFromKey } from './face';
import { STYLES } from './handdrawn';
import { themeClock, themeMix, themesFor } from '../world/theme';
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

/**
 * Register a drawn canvas as a (static) texture. Uses a plain image texture —
 * Phaser's CanvasTexture keeps a full getImageData() copy of every pixel,
 * doubling memory, which is what got phones (iOS Safari especially) killed.
 * With `release`, the canvas's own pixels are freed once they're on the GPU
 * (fine for anything only shown as an Image; TileSprites still need them).
 */
export function addCanvas(
  scene: Phaser.Scene,
  key: string,
  c: HTMLCanvasElement,
  frames?: (tex: Phaser.Textures.Texture) => void,
  opts?: { release?: boolean },
) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.addImage(key, c as unknown as HTMLImageElement)!;
  frames?.(tex);
  if (opts?.release && scene.game.renderer.type === Phaser.WEBGL) {
    c.width = 1;
    c.height = 1;
  }
  return tex;
}

/** Free textures whose keys start with `prefix` (e.g. the terrain of a level we left). */
export function dropTextures(scene: Phaser.Scene, prefix: string) {
  for (const k of scene.textures.getTextureKeys()) if (k.startsWith(prefix)) scene.textures.remove(k);
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
  // each frame is clipped to its own cell, with a transparent gutter between cells,
  // so nothing from one frame (a bazooka tip, a fist) ever shows up in the next
  const fw = Math.round(w * res);
  const fh = Math.round(h * res);
  const pitch = fw + 4;
  const { c, ctx } = canvas(pitch * frames.length, fh);
  frames.forEach((f, i) => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(i * pitch, 0, fw, fh);
    ctx.clip();
    ctx.translate(i * pitch, 0);
    ctx.scale(res, res);
    draw(ctx, f);
    ctx.restore();
  });
  addCanvas(scene, key, c, (t) => frames.forEach((f, i) => t.add(f, 0, i * pitch, 0, fw, fh)));
}

// ─────────────────────────────────────────────────────────────

/** The collision tilemap is invisible, but Phaser still wants a tileset image. */
function makeCollisionTiles(scene: Phaser.Scene) {
  const cell = TILE + 2;
  const { c } = canvas(TILE_COUNT * cell, cell);
  addCanvas(scene, 'tiles', c);
}

/** A little extra room either side of a hero (the bazooka tip pokes out of the 56-unit cell). */
const HERO_M = 8;
/** One hero's animation frames (`face`: the standing pose with each little face they pull now and then). */
function makeCharacter(scene: Phaser.Scene, ch: (typeof CHARACTERS)[number], face: boolean) {
  const M = HERO_M;
  if (!face) sheet(scene, `char-${ch.id}`, CHAR_W + M * 2, CHAR_H, POSES, (ctx, p) => drawCharacter(ctx, M, 0, ch, p));
  else sheet(scene, `char-${ch.id}-face`, CHAR_W + M * 2, CHAR_H, FACE_FRAMES, (ctx, f) => drawCharacter(ctx, M, 0, ch, 'idle0', faceFromKey(f)));
}

function makeCharacters(scene: Phaser.Scene) {
  for (const ch of CHARACTERS) makeCharacter(scene, ch, false);
  for (const ch of CHARACTERS) makeCharacter(scene, ch, true);
}

/** The bad guys, as separate pieces (so they can be drawn a bit at a time). */
function baddiePieces(scene: Phaser.Scene): { name: string; run: () => void }[] {
  const st = STYLES[ART_STYLE];
  return [
    { name: 'puffball', run: () => sheet(scene, 'puffball', PUFFBALL_W, PUFFBALL_H, ['w0', 'w1', 'flat'] as const, (ctx, f) => drawPuffball(ctx, 0, 0, f, st)) },
    { name: 'bigpuff', run: () => sheet(scene, 'bigpuff', BIGPUFF_W, BIGPUFF_H, BIGPUFF_FRAMES, (ctx, f) => drawBigPuff(ctx, 0, 0, f, st)) },
    { name: 'giant', run: () => sheet(scene, 'giant', GIANT_W, GIANT_H, GIANT_FRAMES, (ctx, f) => drawGiant(ctx, 0, 0, f, st), 2.5) },
    {
      name: 'goat',
      run: () => {
        sheet(scene, 'goat', GOAT_W, GOAT_H, GOAT_FRAMES, (ctx, f) => drawGoat(ctx, 0, 0, f, st));
        // (Plop Invasion's goats: covered in poo)
        sheet(scene, 'goat-poo', GOAT_W, GOAT_H, GOAT_FRAMES, (ctx, f) => {
          drawGoat(ctx, 0, 0, f, st);
          drawPooOnGoat(ctx, f);
        });
        addCanvas(scene, 'spit', hires(36, 14, ART_RES, (ctx) => drawSpit(ctx, 24, 7, st)));
      },
    },
    { name: 'plops small', run: () => makePlops(scene, 'small') },
    { name: 'plops medium', run: () => makePlops(scene, 'medium') },
    { name: 'plops large', run: () => makePlops(scene, 'large') },
    {
      // the armed bad guys' weapons
      name: 'weapons',
      run: () => {
        addCanvas(scene, 'w-blaster', hires(BLASTER.w, BLASTER.h, W_RES, (ctx) => drawBlaster(ctx, st)));
        sheet(scene, 'w-saw', SAW.w, SAW.h, ['s0', 's1'] as const, (ctx, f) => drawChainsaw(ctx, st, f === 's0' ? 0 : 1), W_RES);
        sheet(scene, 'w-ball', 30, 30, ['open', 'shut'] as const, (ctx, f) => drawFlailBall(ctx, st, f === 'open'), W_RES);
        addCanvas(scene, 'w-bullet', hires(18, 18, W_RES, (ctx) => drawBullet(ctx, st)));
      },
    },
  ];
}

/** Plops in the game: drawn this many times their art size (shown smaller), with room either side for the arms. */
export const PLOP_RES = 2.5;
export const PLOP_PAD = 16;
/** Headroom over the art (the big Plops' swirl tip pokes up past the art's own frame). */
export const PLOP_TOP = 22;

/** One size of Plop's frames for the game (`gplop-<kind>`), plus what Plops throw and leave about. */
function makePlops(scene: Phaser.Scene, kind: PlopKind) {
  const key = `gplop-${kind}`;
  if (scene.textures.exists(key)) return;
  const st = STYLES[ART_STYLE];
  const fw = Math.round((PLOP_W + PLOP_PAD * 2) * PLOP_RES);
  const pw = fw + 4;
  const fh = Math.round((PLOP_H + PLOP_TOP) * PLOP_RES);
  const { c, ctx } = canvas(pw * PLOP_FRAMES.length, fh);
  PLOP_FRAMES.forEach((f, i) => {
    ctx.save();
    ctx.translate(i * pw, 0);
    ctx.scale(PLOP_RES, PLOP_RES);
    drawPlop(ctx, PLOP_PAD, PLOP_TOP, f, st, kind);
    ctx.restore();
  });
  addCanvas(scene, key, c, (t) => PLOP_FRAMES.forEach((f, i) => t.add(f, 0, i * pw, 0, fw, fh)));
  if (!scene.textures.exists('poo')) {
    addCanvas(scene, 'poo', hires(26, 24, ART_RES, (ctx2) => drawPoo(ctx2, 13, 22, 1)));
    sheet(scene, 'poowave', POOWAVE_W, POOWAVE_H, ['w0', 'w1', 'w2', 'w3'] as const, (ctx2, f) => drawPooWave(ctx2, +f[1]), 3);
    addCanvas(scene, 'stink', hires(12, 26, 2, (ctx2) => drawStink(ctx2)));
    // beach volleyball (Plop Invasion's mid-level match)
    addCanvas(scene, 'volleyball', hires(26, 26, ART_RES, (ctx2) => drawVolleyball(ctx2, 13, 13, 11)));
    addCanvas(scene, 'volleynet', hires(64, 100, 3, (ctx2) => drawVolleyNet(ctx2, 64, 96, 66)));
  }
}

function makeBaddies(scene: Phaser.Scene) {
  for (const p of baddiePieces(scene)) p.run();
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
  sheet(scene, 'flame', FLAME_W, FLAME_H, FLAME_FRAMES, (ctx, f) => (f[0] === 'd' ? drawDyingFlame(ctx, +f[1]) : drawFlame(ctx, +f[1])));
  addCanvas(scene, 'scorch', hires(64, 16, PROP_RES, (ctx) => drawScorch(ctx)));
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
  sheet(scene, 'poopile', 24, 26, ['p0', 'p1', 'p2', 'p3'] as const, (ctx, f) => drawPooPile(ctx, 12, 25, +f[1]), PROP_RES);
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
  src.width = src.height = 1; // free the scratch canvas right away (Safari is slow to collect them)
  return c;
}

/** Background textures for one look, keyed `bg-<layer>:<palette id>` (the scenery drifts between looks). */
export const bgKey = (layer: 'sky' | 'far' | 'clouds' | 'hills' | 'near', theme: string) => `bg-${layer}:${theme}`;

function makeBackgrounds(scene: Phaser.Scene, pal: WorldPalette) {
  const k = (layer: Parameters<typeof bgKey>[0]) => bgKey(layer, pal.id);
  addCanvas(scene, k('sky'), hires(4, 512, 1, (ctx) => drawSky(ctx, 4, 512, pal)));
  const L = BG_LAYERS;
  addCanvas(scene, k('far'), padV(hires(L.far.w, L.far.h, BG_RES, (ctx) => drawFarLayer(ctx, L.far.w, L.far.h, pal))), undefined, { release: true });
  addCanvas(scene, k('hills'), padV(hires(L.hills.w, L.hills.h, BG_RES, (ctx) => drawHillsLayer(ctx, L.hills.w, L.hills.h, pal))), undefined, { release: true });
  addCanvas(scene, k('near'), padV(hires(L.near.w, L.near.h, BG_RES, (ctx) => drawNearLayer(ctx, L.near.w, L.near.h, pal))), undefined, { release: true });
}

/** Part 2's backgrounds for one mountain look (same layer sizes as Part 1's). */
function makeMountainBackgrounds(scene: Phaser.Scene, look: MountainLook) {
  const k = (layer: Parameters<typeof bgKey>[0]) => bgKey(layer, look.pal.id);
  addCanvas(scene, k('sky'), hires(4, 512, 1, (ctx) => drawSky(ctx, 4, 512, look.pal)));
  const L = BG_LAYERS;
  addCanvas(scene, k('far'), padV(hires(L.far.w, L.far.h, BG_RES, (ctx) => drawMountainFar(ctx, L.far.w, L.far.h, look))), undefined, { release: true });
  addCanvas(scene, k('hills'), padV(hires(L.hills.w, L.hills.h, BG_RES, (ctx) => drawMountainMid(ctx, L.hills.w, L.hills.h, look))), undefined, { release: true });
  addCanvas(scene, k('near'), padV(hires(L.near.w, L.near.h, BG_RES, (ctx) => drawMountainNear(ctx, L.near.w, L.near.h, look))), undefined, { release: true });
}

/** Make sure a look's background layers exist (built right now if the boot hasn't got to them yet). */
export function ensureLook(scene: Phaser.Scene, id: string) {
  if (scene.textures.exists(bgKey('near', id))) return;
  const look = MOUNTAIN_LOOKS.find((l) => l.pal.id === id);
  if (look) makeMountainBackgrounds(scene, look);
  else if (PALETTES[id]) makeBackgrounds(scene, PALETTES[id]);
}

/** All the looks (backgrounds) one level cycles through, drawn now if they aren't already. */
export function ensureLevelLooks(scene: Phaser.Scene, level: number) {
  for (const id of themesFor(level)) ensureLook(scene, id);
}

/**
 * Free the background looks no longer needed (only the level you're on, or picking, keeps
 * its looks: memory stays the same however many levels there are).
 */
export function freeLooksExcept(scene: Phaser.Scene, keep: readonly string[]) {
  for (const k of scene.textures.getTextureKeys()) {
    const m = /^bg-[a-z]+:(.+)$/.exec(k);
    if (m && !keep.includes(m[1])) scene.textures.remove(k);
  }
}

type Step = { name: string; run: () => void };

/**
 * The game's art in small steps. `now`: what the start screen needs (drawn behind the
 * loading screen): the ground's tiles, the props (flowers, tufts, boulders, the gate…)
 * and the starting level's current look. `later`: everything else (the heroes' game
 * frames, the bad guys, the level's other looks), drawn piece by piece once the start
 * screen is up, in quiet moments. Another level's looks are drawn when it's picked.
 */
export function textureSteps(scene: Phaser.Scene, level = 1, pal: WorldPalette = DEFAULT_PALETTE): { now: Step[]; later: Step[] } {
  const looks = themesFor(level);
  const first = themeMix(themeClock.t, looks).a;
  return {
    now: [
      { name: 'tiles', run: () => makeCollisionTiles(scene) },
      { name: 'items', run: () => makeItems(scene, pal) },
      { name: `bg-${first}`, run: () => ensureLook(scene, first) },
    ],
    later: [
      ...CHARACTERS.flatMap((ch) => [
        { name: `hero ${ch.id}`, run: () => makeCharacter(scene, ch, false) },
        { name: `hero ${ch.id} faces`, run: () => makeCharacter(scene, ch, true) },
      ]),
      ...baddiePieces(scene),
      ...looks.filter((id) => id !== first).map((id) => ({ name: `bg-${id}`, run: () => ensureLook(scene, id) })),
    ],
  };
}

export function generateTextures(scene: Phaser.Scene, pal: WorldPalette = DEFAULT_PALETTE) {
  makeCollisionTiles(scene);
  makeCharacters(scene);
  makeBaddies(scene);
  makeItems(scene, pal);
  for (const id of ['puff', 'meadow', 'candy', 'golden']) makeBackgrounds(scene, PALETTES[id]);
  for (const look of MOUNTAIN_LOOKS) makeMountainBackgrounds(scene, look);
}
