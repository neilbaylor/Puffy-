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
import { drawHeroChuteLayer, drawPlopCanopy, type ChuteState } from './skydive';
import { JETFLAME_H, JETFLAME_W, KING_H, KING_W, SMOKE_R, drawJetFlame, drawJetSmoke, drawPlopKing, type KingFrame } from './plopking';
import { drawHockeyNet, drawPuck, drawRinkLines, drawStick } from './hockey';
import { MOUNTAIN_LOOKS, drawMountainFar, drawMountainMid, drawMountainNear } from './mountain';
import './plopLooks'; // (registers Plop Invasion's palettes)
import { POOWAVE_H, POOWAVE_W, drawPooOnGoat, drawPooPile, drawPooWave, drawStink, drawVolleyNetSide, drawVolleyball } from './plopworld';
import { PLOP_FRAMES, PLOP_H, PLOP_W, drawPlop, type PlopKind } from './plops';
import { BUBBLE_FRAMES, BUBBLE_SIZE, FISH_FRAMES, FISH_SIZE, drawBubbleShot, drawFish, type FishKind } from './fish';
import { drawPoo } from './hazards';
import { CRAB_FRAMES, CRAB_H, CRAB_W, JELLY_FRAMES, JELLY_H, JELLY_W, SCHOOL_FRAMES, SEA_PROPS, SEA_PROP_H, SEA_PROP_W, SURFACE_H, TURTLE_FRAMES, TURTLE_H, TURTLE_W, drawCrab, drawJelly, drawLightRay, drawSchoolFish, drawSeaBubble, drawSeaFar, drawSeaMid, drawSeaNear, drawSeaProp, drawSeaSky, drawSurface, drawTurtle } from './sea';
import { BB_ALIAS, BB_FIELD_TILES, BB_KEYS, BB_PLAIN, BB_ROSTER, BB_SIZE, PARK, drawBallparkBack, drawBallparkFront, drawBaseball, drawBaseballPlop, drawCappedPlop, drawLineDrive, type BBPlayer, type BaseballRole } from './baseball';
import { PLOP_COLOURS } from './plops';
import { gearOf, wardrobe } from '../core/wardrobe';
import { FLAME_FRAMES, FLAME_H, FLAME_W, drawDyingFlame, drawFlame, drawScorch } from './flame';
import { ART_RES, ART_STYLE, CARRY_SWING, CHAR_H, CHAR_W, POSES, gearUp, canvas, carry, drawCharacter, ellipse, type CarryFrame, type Ctx, type Layer, type Pose } from './draw';
import { FACE_FRAMES, faceFromKey } from './face';
import { STYLES } from './handdrawn';
import { themesFor } from '../world/theme';
import { LIGHT } from '../core/light';
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
/** The ground (by far the biggest pictures): lower in light mode. */
export const TERRAIN_RES = LIGHT ? 1.25 : PROP_RES;
export const BG_RES = LIGHT ? 1 : 1.25;

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

/**
 * Older graphics chips (many older Android tablets and laptops) can't hold a picture wider or taller
 * than 4096 px: one that is fails to load, and on some it crashes the page. Every frame sheet is
 * laid out within that.
 */
export const MAX_TEX = 4096;

/** Where n frames (fw × fh each, a transparent gutter between them) go in a sheet no wider than MAX_TEX. */
export function frameGrid(n: number, fw: number, fh: number, gap = 4) {
  const px = fw + gap;
  const py = fh + gap;
  const cols = Math.max(1, Math.min(n, Math.floor(MAX_TEX / px)));
  const rows = Math.ceil(n / cols);
  return { w: cols * px, h: rows === 1 ? fh : rows * py, x: (i: number) => (i % cols) * px, y: (i: number) => Math.floor(i / cols) * py };
}

/** The heroes' own sheets are read back (recoloured for the other players in a battle); everything else lets its pixels go once uploaded. */
// (the heroes' frames, faces and chair-carrying frames: Battle recolours them for each player)
const keepPixels = (key: string) => /^char-[a-z]+(-face|-carry)?$/.test(key);

/** What a hero wears under the sea: their own things, the dive gear on (no skateboard in the water). */
export const seaWear = () => [...wardrobe.wearKey.split(',').filter((w) => w && w !== 'board'), 'scuba'].sort().join(',');
/** A level where you swim (World 3): its hero sheets are the dive-gear ones (`char-<id>-sea`). */
export const swimLevel = (level: number | 'battle' | null | undefined) => level === 5;

/** A frame sheet: each frame is drawn in world units w × h at `res`. */
function sheet<F extends string>(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  frames: readonly F[],
  draw: (ctx: Ctx, f: F) => void,
  res = ART_RES,
  /** (then the whole sheet's swapped for this — a battle player's colour — and `over` drawn on each frame of that) */
  post?: { swap: (c: HTMLCanvasElement) => HTMLCanvasElement; over: (ctx: Ctx, f: F) => void },
) {
  // each frame is clipped to its own cell, with a transparent gutter between cells,
  // so nothing from one frame (a bazooka tip, a fist) ever shows up in the next
  const fw = Math.round(w * res);
  const fh = Math.round(h * res);
  const g = frameGrid(frames.length, fw, fh);
  let { c, ctx } = canvas(g.w, g.h);
  const each = (fn: (ctx: Ctx, f: F) => void) =>
    frames.forEach((f, i) => {
      ctx.save();
      ctx.beginPath();
      ctx.rect(g.x(i), g.y(i), fw, fh);
      ctx.clip();
      ctx.translate(g.x(i), g.y(i));
      ctx.scale(res, res);
      fn(ctx, f);
      ctx.restore();
    });
  each(draw);
  if (post) {
    c = post.swap(c);
    ctx = c.getContext('2d')!;
    each(post.over);
  }
  addCanvas(scene, key, c, (t) => frames.forEach((f, i) => t.add(f, 0, g.x(i), g.y(i), fw, fh)), { release: !keepPixels(key) });
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
  makeHeroSheet(scene, face ? `char-${ch.id}-face` : `char-${ch.id}`, ch, face, wardrobe.wearKey);
}

/**
 * A hero's frames (or their faces) in what they've got on (`wear`: Shop ids, '' nothing) — with room
 * over their head for a hat or the skateboard if there's one (gearUp), the hero at the bottom as
 * always. `recolor`: a battle player's colour, put on before the sunglasses so they stay orange.
 */
export function makeHeroSheet(scene: Phaser.Scene, key: string, ch: (typeof CHARACTERS)[number], face: boolean, wear: string, recolor?: (c: HTMLCanvasElement) => HTMLCanvasElement) {
  const M = HERO_M;
  const up = gearUp(wear);
  const layered = !!recolor && gearOf(wear).eyes;
  const draw = (ctx: Ctx, f: string, layer: Layer) =>
    face ? drawCharacter(ctx, M, up, ch, 'idle0', faceFromKey(f), wear, layer) : drawCharacter(ctx, M, up, ch, f as Pose, undefined, wear, layer);
  // (in the dive gear the walk frames are the swim cycle: see drawCharacter)
  const frames: readonly string[] = face ? FACE_FRAMES : POSES;
  if (!recolor) sheet(scene, key, CHAR_W + M * 2, CHAR_H + up, frames, (ctx, f) => draw(ctx, f, 'all'));
  else
    sheet(scene, key, CHAR_W + M * 2, CHAR_H + up, frames, (ctx, f) => draw(ctx, f, layered ? 'body' : 'all'), ART_RES, {
      swap: recolor,
      over: (ctx, f) => layered && draw(ctx, f, 'eyes'),
    });
}

/** The hero pictures drawn in what you've got on: when that changes they're drawn again, next time they're needed. */
export function dropHeroSheets(textures: Phaser.Textures.TextureManager) {
  for (const k of textures.getTextureKeys()) if (k.startsWith('char-') || k.startsWith('bchar-')) textures.remove(k);
}

/**
 * A hero's parachute for the drops (Plop Invasion · Part 2), in layers round the hero's own sprite:
 * the canopy states behind them and the harness ('harness') over them. The cell is the hero's,
 * widened by CHUTE_SIDE either side and raised CHUTE_UP above (the canopy), the hero's box centred
 * at the bottom: shown with the same scale, origin (0.5, 1) at the same spot as the hero.
 */
export const CHUTE_SIDE = 24;
export const CHUTE_UP = 100;
export const CHUTE_FRAMES = ['pack', 'burst', 'opening', 'open', 'land', 'harness'] as const;
export function makeHeroChute(scene: Phaser.Scene, ch: (typeof CHARACTERS)[number]) {
  const key = `chute-${ch.id}`;
  if (scene.textures.exists(key)) return key;
  const ox = HERO_M + CHUTE_SIDE;
  sheet(scene, key, CHAR_W + ox * 2, CHAR_H + CHUTE_UP, CHUTE_FRAMES, (ctx, f) => {
    ctx.translate(ox, CHUTE_UP);
    if (f === 'harness') drawHeroChuteLayer(ctx, ch, 'open', 'front');
    else drawHeroChuteLayer(ctx, ch, f as ChuteState, 'back');
  });
  return key;
}
/**
 * The Plops' parachutes (canopy only: hung over a Plop sprite): the Plop's 96 × 104 box, with
 * PCHUTE_UP above it for the canopy, down to PCHUTE_DOWN (the clips at the body's sides).
 */
export const PCHUTE_UP = 130;
export const PCHUTE_DOWN = 72;
export const PCHUTE_RES = 2;
/** The Plop King's pictures are drawn at this resolution. */
export const KING_RES = 2;
/**
 * The Plop King with his jetpack (level 4's opening: he laughs at you, then blasts off), the
 * jetpack's flames and its smoke. (`key`, the frames and the look: robe / jetpack / sceptre.)
 */
export function makePlopKing(scene: Phaser.Scene, key: string, frames: readonly KingFrame[], look: { robe?: boolean; jet?: boolean; sceptre?: boolean }) {
  if (scene.textures.exists(key)) return;
  sheet(scene, key, KING_W, KING_H, frames, (ctx, f) => drawPlopKing(ctx, f, look), KING_RES);
}
export function makeJetFx(scene: Phaser.Scene) {
  if (!scene.textures.exists('jetflame')) sheet(scene, 'jetflame', JETFLAME_W, JETFLAME_H, ['f0', 'f1', 'f2'] as const, (ctx, f) => drawJetFlame(ctx, +f[1]), 2);
  if (!scene.textures.exists('jetsmoke')) sheet(scene, 'jetsmoke', SMOKE_R * 2, SMOKE_R * 2, ['s0', 's1'] as const, (ctx, f) => drawJetSmoke(ctx, +f[1]), 2);
}

export function makePlopChutes(scene: Phaser.Scene) {
  if (scene.textures.exists('pchute')) return;
  sheet(scene, 'pchute', PLOP_W, PCHUTE_UP + PCHUTE_DOWN, ['slow', 'mid', 'fast', 'popped'] as const, (ctx, f) => {
    ctx.translate(0, PCHUTE_UP);
    drawPlopCanopy(ctx, f);
  }, PCHUTE_RES);
}

/** Where a hero's sheet puts the hero (frame units): the cell has HERO_M spare either side. */
export const HERO_SHEET_M = HERO_M;

/**
 * A hero holding something up in both hands (the folding chair in the ring): every pose with the
 * arms up and no bazooka, plus a swing (sw0–sw3) and bending to pick it up (lift). Made when needed.
 */
export function makeCarrySheet(scene: Phaser.Scene, ch: (typeof CHARACTERS)[number]) {
  const key = `char-${ch.id}-carry`;
  if (scene.textures.exists(key)) return key;
  const frames: (Pose | CarryFrame)[] = [...POSES, ...(Object.keys(CARRY_SWING) as CarryFrame[])];
  carry.on = true;
  try {
    const up = gearUp(wardrobe.wearKey);
    sheet(scene, key, CHAR_W + HERO_M * 2, CHAR_H + up, frames, (ctx, f) => {
      const sw = (CARRY_SWING as Record<string, number>)[f];
      carry.a = sw ?? -1.75;
      drawCharacter(ctx, HERO_M, up, ch, sw === undefined ? (f as Pose) : f === 'lift' ? 'idle1' : 'idle0');
    });
  } finally {
    carry.on = false;
    carry.a = -1.75;
  }
  return key;
}


/** The bad guys' weapons: blaster, chainsaw, ball and chain, and the blaster's pom-poms (only what's missing). */
export function makeWeaponArt(scene: Phaser.Scene) {
  const st = STYLES[ART_STYLE];
  if (!scene.textures.exists('w-blaster')) addCanvas(scene, 'w-blaster', hires(BLASTER.w, BLASTER.h, W_RES, (ctx) => drawBlaster(ctx, st)));
  if (!scene.textures.exists('w-saw')) sheet(scene, 'w-saw', SAW.w, SAW.h, ['s0', 's1'] as const, (ctx, f) => drawChainsaw(ctx, st, f === 's0' ? 0 : 1), W_RES);
  if (!scene.textures.exists('w-ball')) sheet(scene, 'w-ball', 30, 30, ['open', 'shut'] as const, (ctx, f) => drawFlailBall(ctx, st, f === 'open'), W_RES);
  if (!scene.textures.exists('w-bullet')) addCanvas(scene, 'w-bullet', hires(18, 18, W_RES, (ctx) => drawBullet(ctx, st)));
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
    {
      // the armed bad guys' weapons
      name: 'weapons',
      run: () => makeWeaponArt(scene),
    },
  ];
}

/** Plops in the game: drawn this many times their art size (shown smaller), with room either side for the arms. */
export const PLOP_RES = 2.5;
export const PLOP_PAD = 16;
/** Headroom over the art (the big Plops' swirl tip pokes up past the art's own frame). */
export const PLOP_TOP = 22;

/** One size of Plop's frames for the game (`gplop-<kind>`), plus what Plops throw and leave about. */
/**
 * One fish's frames (the swim cycle sw0–sw5; the orange fish's fire0–fire2 too), as `fish-<kind>`,
 * made when a level first needs it. The fish face right (as in the drawings): flip to swim left.
 * Shown at FISH_SCALE[kind] / ART_RES.
 */
export function makeFish(scene: Phaser.Scene, kind: FishKind) {
  const key = `fish-${kind}`;
  if (scene.textures.exists(key)) return key;
  const { w, h } = FISH_SIZE[kind];
  const st = STYLES[ART_STYLE];
  sheet(scene, key, w, h, FISH_FRAMES[kind], (ctx, f) => drawFish(ctx, 0, 0, kind, f, st));
  return key;
}

/** The orange fish's bubble shot (b0, b1), as `fish-bubble`. */
export function makeFishBubble(scene: Phaser.Scene) {
  if (!scene.textures.exists('fish-bubble')) sheet(scene, 'fish-bubble', BUBBLE_SIZE, BUBBLE_SIZE, BUBBLE_FRAMES, (ctx, f) => drawBubbleShot(ctx, 0, 0, f));
  return 'fish-bubble';
}

export function makePlops(scene: Phaser.Scene, kind: PlopKind) {
  const key = `gplop-${kind}`;
  if (scene.textures.exists(key)) return;
  const st = STYLES[ART_STYLE];
  const fw = Math.round((PLOP_W + PLOP_PAD * 2) * PLOP_RES);
  const fh = Math.round((PLOP_H + PLOP_TOP) * PLOP_RES);
  const g = frameGrid(PLOP_FRAMES.length, fw, fh);
  const { c, ctx } = canvas(g.w, g.h);
  PLOP_FRAMES.forEach((f, i) => {
    ctx.save();
    ctx.translate(g.x(i), g.y(i));
    ctx.scale(PLOP_RES, PLOP_RES);
    drawPlop(ctx, PLOP_PAD, PLOP_TOP, f, st, kind);
    ctx.restore();
  });
  addCanvas(scene, key, c, (t) => PLOP_FRAMES.forEach((f, i) => t.add(f, 0, g.x(i), g.y(i), fw, fh)), { release: true });
  if (!scene.textures.exists('poo')) {
    addCanvas(scene, 'poo', hires(26, 24, ART_RES, (ctx2) => drawPoo(ctx2, 13, 22, 1)));
    sheet(scene, 'poowave', POOWAVE_W, POOWAVE_H, ['w0', 'w1', 'w2', 'w3'] as const, (ctx2, f) => drawPooWave(ctx2, +f[1]), 3);
    addCanvas(scene, 'stink', hires(12, 26, 2, (ctx2) => drawStink(ctx2)));
    // beach volleyball (Plop Invasion's mid-level match)
    addCanvas(scene, 'volleyball', hires(26, 26, ART_RES, (ctx2) => drawVolleyball(ctx2, 13, 13, 11)));
    addCanvas(scene, 'volleynet', hires(20, 112, 3, (ctx2) => drawVolleyNetSide(ctx2, 20, 108, 66)));
  }
}


/** The props and particles, in a few pieces (so the loading screen never stalls on one long job). */
function itemParts(scene: Phaser.Scene, pal: WorldPalette): (() => void)[] {
  const st = STYLES[ART_STYLE];
  return [
    () => {
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
    },
    () => {
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
    },
    () => {
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
    },
    () => {
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
    },
  ];
}


const PUCK_R_ART = 7;

/** Parallax layers, each horizontally tileable, drawn at BG_RES. Heights are world px. */
export const BG_LAYERS = {
  far: { w: 1024, h: 220 },
  clouds: { w: 1024, h: 200 },
  hills: { w: 1024, h: 230 },
  near: { w: 1024, h: 150 },
};

/**
 * A background layer: like `hires`, with 2 transparent rows above and below so edge pixels never
 * bleed when it's shown scaled (drawn straight into the padded canvas: copying a finished layer
 * into a bigger one cost as much as drawing it, on phones).
 */
function hiresPadV(w: number, h: number, res: number, fn: (ctx: Ctx) => void) {
  const { c, ctx } = canvas(Math.ceil(w * res), Math.ceil(h * res) + 4);
  ctx.translate(0, 2);
  ctx.scale(res, res);
  fn(ctx);
  return c;
}

/** Background textures for one look, keyed `bg-<layer>:<palette id>` (the scenery drifts between looks). */
export const bgKey = (layer: 'sky' | 'far' | 'clouds' | 'hills' | 'near', theme: string) => `bg-${layer}:${theme}`;

type BgLayer = 'sky' | 'far' | 'hills' | 'near';

/** One background layer of one look (Part 1/3 looks and Part 2's mountain looks alike). */
function makeBgLayer(scene: Phaser.Scene, id: string, layer: BgLayer) {
  const key = bgKey(layer, id);
  const look = MOUNTAIN_LOOKS.find((l) => l.pal.id === id);
  const pal = look?.pal ?? PALETTES[id];
  if (!pal) return;
  const L = BG_LAYERS;
  const opts = { release: true };
  if (layer === 'sky') addCanvas(scene, key, hires(4, 512, 1, (ctx) => drawSky(ctx, 4, 512, pal)));
  else if (pal.sea) {
    // (under the sea: hazy rock pillars, the reef, the sandy sea bed)
    const L2 = L[layer];
    const draw = layer === 'far' ? drawSeaFar : layer === 'hills' ? drawSeaMid : drawSeaNear;
    addCanvas(scene, key, hiresPadV(L2.w, L2.h, BG_RES, (ctx) => draw(ctx, L2.w, L2.h, pal)), undefined, opts);
  } else if (layer === 'far')
    addCanvas(scene, key, hiresPadV(L.far.w, L.far.h, BG_RES, (ctx) => (look ? drawMountainFar(ctx, L.far.w, L.far.h, look) : drawFarLayer(ctx, L.far.w, L.far.h, pal))), undefined, opts);
  else if (layer === 'hills')
    addCanvas(scene, key, hiresPadV(L.hills.w, L.hills.h, BG_RES, (ctx) => (look ? drawMountainMid(ctx, L.hills.w, L.hills.h, look) : drawHillsLayer(ctx, L.hills.w, L.hills.h, pal))), undefined, opts);
  else addCanvas(scene, key, hiresPadV(L.near.w, L.near.h, BG_RES, (ctx) => (look ? drawMountainNear(ctx, L.near.w, L.near.h, look) : drawNearLayer(ctx, L.near.w, L.near.h, pal))), undefined, opts);
}

const BG_LAYER_IDS: readonly BgLayer[] = ['sky', 'far', 'hills', 'near'];


/** Make sure a look's background layers exist (built right now if the boot hasn't got to them yet). */
export function ensureLook(scene: Phaser.Scene, id: string) {
  for (const l of BG_LAYER_IDS) if (!scene.textures.exists(bgKey(l, id))) makeBgLayer(scene, id, l);
}

/**
 * A look's missing layers as separate little jobs (the start screen draws them between taps:
 * a layer at a time keeps each pause short, so a tap is never kept waiting long).
 */
export function lookJobs(scene: Phaser.Scene, id: string): (() => void)[] {
  return BG_LAYER_IDS.map((l) => () => {
    if (!scene.textures.exists(bgKey(l, id))) makeBgLayer(scene, id, l);
  });
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

export type Step = { name: string; run: () => void };

/**
 * The game's art in small steps. `now`: what the start screen needs (drawn behind the
 * loading screen): the ground's tiles, the props (flowers, tufts, boulders, the gate…)
 * and the starting level's current look. `later`: everything else (the heroes' game
 * frames, the bad guys, the level's other looks), drawn piece by piece once the start
 * screen is up, in quiet moments. Another level's looks are drawn when it's picked.
 */
export function textureSteps(scene: Phaser.Scene, level = 1, pal: WorldPalette = DEFAULT_PALETTE): { now: Step[]; later: Step[] } {
  // (the start screen shows each level in its first look; the others are drawn in quiet moments)
  const first = themesFor(level)[0];
  return {
    now: [
      { name: 'tiles', run: () => makeCollisionTiles(scene) },
      ...itemParts(scene, pal).map((run, i) => ({ name: `items ${i}`, run })),
      ...lookJobs(scene, first).map((run, i) => ({ name: `bg-${first} ${i}`, run })),
    ],
    // (the game's own art — the heroes' game frames, the bad guys — is drawn when a game starts:
    // see gameArtJobs; the start screen doesn't need it, and drawing it all here was too much
    // at once for older devices)
    later: [],
  };
}

/** The pictures each bad-guy piece makes (to skip the ones already drawn, and free the ones a level doesn't use). */
const BADDIE_KEYS: Record<string, string[]> = {
  puffball: ['puffball'],
  bigpuff: ['bigpuff'],
  giant: ['giant'],
  goat: ['goat', 'goat-poo', 'spit'],
  weapons: ['w-blaster', 'w-saw', 'w-ball', 'w-bullet'],
  plops: ['gplop-small', 'gplop-medium', 'gplop-large'],
  chutes: ['pchute'],
  king: ['pking-jet', 'jetflame', 'jetsmoke'],
  baseball: BB_KEYS,
  fish: ['fish-badguy', 'fish-badguybig', 'fish-bubble'],
};

/** The bad guys each level has (and a battle): only those are drawn, the others freed. */
const BADDIES_FOR: Record<string, string[]> = {
  1: ['puffball', 'bigpuff', 'giant', 'weapons'],
  2: ['puffball', 'bigpuff', 'giant', 'goat', 'weapons'],
  3: ['goat', 'weapons', 'plops'],
  4: ['goat', 'weapons', 'plops', 'chutes', 'king', 'baseball'],
  5: ['fish'],
  battle: ['puffball', 'bigpuff', 'giant', 'weapons'],
};

/**
 * What a game needs drawn that the start screen doesn't: the heroes' game frames (and faces),
 * and the bad guys of that level (or a battle; none for a boss). Only what isn't drawn yet,
 * as small steps.
 */
export function gameArtJobs(scene: Phaser.Scene, opts: { heroes: readonly string[]; level?: number | 'battle' | null }): Step[] {
  const T = scene.textures;
  const out: Step[] = [];
  const sea = swimLevel(opts.level);
  for (const id of new Set(opts.heroes)) {
    const ch = CHARACTERS.find((c) => c.id === id);
    if (!ch) continue;
    if (sea) {
      // (under the sea: in the dive gear)
      if (!T.exists(`char-${id}-sea`)) out.push({ name: `hero ${id} diving`, run: () => makeHeroSheet(scene, `char-${id}-sea`, ch, false, seaWear()) });
      if (!T.exists(`char-${id}-sea-face`)) out.push({ name: `hero ${id} diving faces`, run: () => makeHeroSheet(scene, `char-${id}-sea-face`, ch, true, seaWear()) });
      continue;
    }
    if (!T.exists(`char-${id}`)) out.push({ name: `hero ${id}`, run: () => makeCharacter(scene, ch, false) });
    if (!T.exists(`char-${id}-face`)) out.push({ name: `hero ${id} faces`, run: () => makeCharacter(scene, ch, true) });
  }
  const want = opts.level == null ? [] : (BADDIES_FOR[String(opts.level)] ?? BADDIES_FOR[1]);
  if (want.includes('fish'))
    for (const k of ['badguy', 'badguybig'] as const) if (!T.exists(`fish-${k}`)) out.push({ name: `fish ${k}`, run: () => { makeFish(scene, k); makeFishBubble(scene); } });
  for (const b of baddiePieces(scene)) if (want.includes(b.name) && !BADDIE_KEYS[b.name].every((k) => T.exists(k))) out.push(b);
  if (want.includes('plops')) (['small', 'medium', 'large'] as const).forEach((k) => !T.exists(`gplop-${k}`) && out.push({ name: `plops ${k}`, run: () => makePlops(scene, k) }));
  // (level 4's opening: the Plop King with his jetpack)
  if (want.includes('king') && !BADDIE_KEYS.king.every((k) => T.exists(k)))
    out.push({
      name: 'plop king',
      run: () => {
        makePlopKing(scene, 'pking-jet', ['idle', 'yell0', 'yell1', 'grin'], { robe: true, jet: true });
        makeJetFx(scene);
      },
    });
  // (Plop Park: the ballpark, and each player in its cap with its own colour)
  if (want.includes('baseball')) {
    if (!T.exists('bbpark-front')) out.push({ name: 'ballpark', run: () => makeBallpark(scene) });
    for (const r of BB_ROSTER) if (!T.exists(r.key)) out.push({ name: `ballplayer ${r.key}`, run: () => makeBallPlayer(scene, r) });
  }
  // (the parachute drops: the Plops' canopies, and each hero's own)
  if (want.includes('chutes')) {
    if (!T.exists('pchute')) out.push({ name: 'plop chutes', run: () => makePlopChutes(scene) });
    for (const id of new Set(opts.heroes)) {
      const ch = CHARACTERS.find((c) => c.id === id);
      if (ch && !T.exists(`chute-${id}`)) out.push({ name: `chute ${id}`, run: () => makeHeroChute(scene, ch) });
    }
  }
  return out;
}

/** Free the bad guys a level doesn't have (memory: older tablets can't hold every level's at once). */
export function dropBaddiesExcept(scene: Phaser.Scene, level: number | 'battle') {
  const want = BADDIES_FOR[String(level)] ?? BADDIES_FOR[1];
  for (const [name, keys] of Object.entries(BADDIE_KEYS)) if (!want.includes(name)) for (const k of keys) if (scene.textures.exists(k)) scene.textures.remove(k);
  if (!want.includes('chutes')) for (const c of CHARACTERS) if (scene.textures.exists(`chute-${c.id}`)) scene.textures.remove(`chute-${c.id}`);
}

/** Only one set of a hero's pictures at a time: the dive-gear ones under the sea, the usual ones elsewhere (memory). */
export function dropOtherHeroSheets(scene: Phaser.Scene, level: number) {
  const sea = swimLevel(level);
  for (const k of scene.textures.getTextureKeys())
    if (/^char-[a-z]+(-face)?$/.test(k) ? sea : /^char-[a-z]+-sea(-face)?$/.test(k) && !sea) scene.textures.remove(k);
}

/**
 * Under the sea's own little pictures (the start screen's fly-over needs them too): the sea-bed props,
 * the sea creatures, bubbles, light rays, the sky over the water and the surface.
 */
export function ensureSeaArt(scene: Phaser.Scene) {
  const T = scene.textures;
  if (T.exists('sea-surface')) return;
  sheet(scene, 'sea-props', SEA_PROP_W, SEA_PROP_H, SEA_PROPS, (ctx, f) => drawSeaProp(ctx, f), PROP_RES);
  sheet(scene, 'sea-jelly', JELLY_W, JELLY_H, JELLY_FRAMES, (ctx, f) => drawJelly(ctx, f), 1.5);
  sheet(scene, 'sea-school', 24, 14, SCHOOL_FRAMES, (ctx, f) => drawSchoolFish(ctx, f), 1.5);
  sheet(scene, 'sea-turtle', TURTLE_W, TURTLE_H, TURTLE_FRAMES, (ctx, f) => drawTurtle(ctx, f), 1.5);
  sheet(scene, 'sea-crab', CRAB_W, CRAB_H, CRAB_FRAMES, (ctx, f) => drawCrab(ctx, f), 2);
  addCanvas(scene, 'sea-bubble', hires(16, 16, 2, (ctx) => drawSeaBubble(ctx)));
  addCanvas(scene, 'sea-ray', hires(64, 256, 0.5, (ctx) => drawLightRay(ctx)), undefined, { release: true });
  addCanvas(scene, 'sea-sky', hires(1024, 160, BG_RES, (ctx) => drawSeaSky(ctx, 1024, 160)), undefined, { release: true });
  addCanvas(scene, 'sea-surface', hires(512, SURFACE_H, PROP_RES, (ctx) => drawSurface(ctx, 512)), undefined, { release: true });
}


/** Plop Park: the wall, scoreboard, backstop and lights behind; the turf, infield and bases in front; the ball. */
export function makeBallpark(scene: Phaser.Scene) {
  const w = BB_FIELD_TILES * TILE;
  const { END, BACK_UP, FRONT_UP, BAND_BOT } = PARK;
  const W = w + END * 2;
  if (!scene.textures.exists('bbpark-back')) addCanvas(scene, 'bbpark-back', hires(W, BACK_UP, 1.5, (ctx) => drawBallparkBack(ctx, w, [3, 2])), undefined, { release: true });
  if (!scene.textures.exists('bbpark-front')) addCanvas(scene, 'bbpark-front', hires(W, FRONT_UP + BAND_BOT, 2, (ctx) => drawBallparkFront(ctx, w)), undefined, { release: true });
  if (!scene.textures.exists('bb-ball')) addCanvas(scene, 'bb-ball', hires(14, 14, ART_RES, (ctx) => drawBaseball(ctx, 7, 7, 5.5)));
  if (!scene.textures.exists('bb-drive')) addCanvas(scene, 'bb-drive', hires(64, 16, ART_RES, (ctx) => drawLineDrive(ctx, 55, 8, 5.5, 1)));
}

/**
 * One of Plop Park's players: its plain frames (in its cap) and its poses, in its own colour, mirrored
 * to face left like every Plop; at a lower resolution than a Plop's own sheet (there are seven of them).
 */
export function makeBallPlayer(scene: Phaser.Scene, r: BBPlayer) {
  if (scene.textures.exists(r.key)) return;
  const res = BB_SIZE[r.kind].res;
  const fw = Math.round((PLOP_W + r.padX * 2) * res);
  const fh = Math.round((PLOP_H + PLOP_TOP) * res);
  const names: string[] = [...BB_PLAIN, ...r.roles];
  const { c, ctx } = canvas(fw * names.length, fh);
  const fill = PLOP_COLOURS[r.body % PLOP_COLOURS.length];
  names.forEach((n, i) => {
    ctx.save();
    ctx.translate(i * fw, 0);
    ctx.scale(res, res);
    // (mirrored about the body's middle)
    ctx.translate(2 * (r.padX + 50), PLOP_TOP);
    ctx.scale(-1, 1);
    if ((BB_PLAIN as string[]).includes(n)) drawCappedPlop(ctx, n as (typeof BB_PLAIN)[number], r.kind, r.team, fill, 7 + r.body);
    else drawBaseballPlop(ctx, n as BaseballRole, r.kind, 7 + r.body, fill);
    ctx.restore();
  });
  addCanvas(
    scene,
    r.key,
    c,
    (t) => {
      names.forEach((n, i) => t.add(n, 0, i * fw, 0, fw, fh));
      for (const [a, to] of Object.entries(BB_ALIAS)) t.add(a, 0, names.indexOf(to) * fw, 0, fw, fh);
    },
    { release: true },
  );
}
