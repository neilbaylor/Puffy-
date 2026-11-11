import Phaser from 'phaser';
import { DEPTH } from '../config';
import { SeaLife } from './Sea';

/**
 * Life and light for the platforming levels (purely visual, no gameplay):
 *  - little flocks of birds flapping across the sky far away, and butterflies
 *    fluttering over the ground near you (Part 2: snow buntings and pale
 *    ice-blue butterflies),
 *  - soft contact shadows under the heroes and bad guys (they shrink and fade
 *    as you jump higher),
 *  - warm sunlight: a glow in the corner of the sky.
 */

interface View {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface Bird {
  img: Phaser.GameObjects.Image;
  x: number;
  y: number;
  vx: number;
  ph: number;
  flap: number;
  depthK: number;
}

interface Fly {
  img: Phaser.GameObjects.Image;
  x: number;
  y: number;
  home: number;
  vx: number;
  ph: number;
  t: number;
  life: number;
}

function makeTextures(scene: Phaser.Scene) {
  if (scene.textures.exists('amb-bird')) return;
  const mk = (key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void, frames?: { name: string; x: number; w: number }[]) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    draw(c.getContext('2d')!);
    const t = scene.textures.addImage(key, c as unknown as HTMLImageElement)!;
    frames?.forEach((f) => t.add(f.name, 0, f.x, 0, f.w, h));
  };
  // a bird (2× resolution): wings up / wings level / wings down, drawn white with an
  // ink outline so it can be tinted and still read against the sky
  mk(
    'amb-bird',
    300,
    68,
    (ctx) => {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const [ox, up] of [[0, 1], [100, 0.15], [200, -0.8]] as const) {
        const cx = ox + 50;
        const cy = 36;
        const wing = (dir: number) => {
          const tipX = cx + dir * 40;
          const tipY = cy - up * 26 + (up < 0 ? 0 : 4);
          ctx.beginPath();
          ctx.moveTo(cx + dir * 4, cy - 4);
          ctx.quadraticCurveTo(cx + dir * 18, cy - up * 22 - 8, tipX, tipY);
          ctx.quadraticCurveTo(cx + dir * 22, cy - up * 10 + 2, cx + dir * 6, cy + 4);
          ctx.closePath();
        };
        const shapeAll = () => {
          // body + head + tail
          ctx.beginPath();
          ctx.ellipse(cx, cy, 16, 7.5, -0.05, 0, Math.PI * 2);
          ctx.moveTo(cx + 22, cy - 3);
          ctx.arc(cx + 15, cy - 3, 6.5, 0, Math.PI * 2);
          ctx.moveTo(cx - 12, cy);
          ctx.lineTo(cx - 28, cy - 6);
          ctx.lineTo(cx - 22, cy + 1);
          ctx.lineTo(cx - 28, cy + 7);
          ctx.closePath();
        };
        // ink outline first (thick), then white fill on top
        ctx.strokeStyle = 'rgba(40,30,60,0.85)';
        ctx.lineWidth = 4;
        for (const d of [-1, 1]) {
          wing(d);
          ctx.stroke();
        }
        shapeAll();
        ctx.stroke();
        ctx.fillStyle = '#fff';
        for (const d of [-1, 1]) {
          wing(d);
          ctx.fill();
        }
        shapeAll();
        ctx.fill();
        // beak and eye
        ctx.fillStyle = '#ffb347';
        ctx.beginPath();
        ctx.moveTo(cx + 21, cy - 5);
        ctx.lineTo(cx + 28, cy - 2);
        ctx.lineTo(cx + 21, cy - 0.5);
        ctx.fill();
        ctx.fillStyle = '#2a1e2e';
        ctx.beginPath();
        ctx.arc(cx + 17, cy - 5, 1.6, 0, Math.PI * 2);
        ctx.fill();
        // darker wing tips
        ctx.fillStyle = 'rgba(60,50,80,0.45)';
        for (const d of [-1, 1]) {
          ctx.beginPath();
          ctx.arc(cx + d * 34, cy - up * 22 + (up < 0 ? 0 : 4), 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    },
    [
      { name: 'up', x: 0, w: 100 },
      { name: 'mid', x: 100, w: 100 },
      { name: 'down', x: 200, w: 100 },
    ],
  );
  // a butterfly (3× resolution, seen from above): proper fore- and hind-wings with a soft
  // darker edge, a couple of eye-spots and fine veins, a slim body and curled antennae.
  // Three frames: open, half and shut. Drawn white so it can be tinted gently.
  mk(
    'amb-fly',
    270,
    78,
    (ctx) => {
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      for (const [ox, open] of [[0, 1], [90, 0.55], [180, 0.12]] as const) {
        const cx = ox + 45;
        const cy = 40;
        const wing = (s: number, fore: boolean) => {
          const w = (fore ? 30 : 22) * open + 3;
          const h = fore ? 26 : 19;
          const y = fore ? cy - 4 : cy + 6;
          ctx.beginPath();
          ctx.moveTo(cx + s * 2, y);
          if (fore) {
            ctx.bezierCurveTo(cx + s * w * 0.4, y - h * 1.05, cx + s * w * 1.05, y - h * 0.9, cx + s * w, y - h * 0.25);
            ctx.bezierCurveTo(cx + s * w * 0.95, y + 2, cx + s * w * 0.5, y + 6, cx + s * 2, y + 3);
          } else {
            ctx.bezierCurveTo(cx + s * w * 0.6, y - 2, cx + s * w * 1.05, y + h * 0.45, cx + s * w * 0.7, y + h * 0.95);
            ctx.bezierCurveTo(cx + s * w * 0.4, y + h * 1.1, cx + s * 4, y + h * 0.6, cx + s * 2, y + 2);
          }
          ctx.closePath();
        };
        for (const s of [-1, 1]) {
          for (const fore of [false, true]) {
            // white wing with a soft grey edge (the tint keeps it subtle)
            wing(s, fore);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
            ctx.save();
            wing(s, fore);
            ctx.clip();
            const g = ctx.createRadialGradient(cx, cy, 6, cx, cy, fore ? 34 : 26);
            g.addColorStop(0, 'rgba(0,0,0,0)');
            g.addColorStop(0.7, 'rgba(0,0,0,0.04)');
            g.addColorStop(1, 'rgba(40,30,60,0.32)');
            ctx.fillStyle = g;
            ctx.fillRect(ox, 0, 90, 78);
            // veins
            ctx.strokeStyle = 'rgba(40,30,60,0.18)';
            ctx.lineWidth = 0.9;
            for (let k = 0; k < 3; k++) {
              ctx.beginPath();
              ctx.moveTo(cx + s * 3, fore ? cy - 2 : cy + 6);
              ctx.lineTo(cx + s * (8 + k * 9) * open + s * 2, fore ? cy - 18 + k * 6 : cy + 12 + k * 4);
              ctx.stroke();
            }
            ctx.restore();
            wing(s, fore);
            ctx.strokeStyle = 'rgba(40,30,60,0.55)';
            ctx.lineWidth = 1.6;
            ctx.stroke();
          }
          // an eye-spot on each forewing
          if (open > 0.3) {
            ctx.fillStyle = 'rgba(40,30,60,0.4)';
            ctx.beginPath();
            ctx.ellipse(cx + s * 17 * open, cy - 15, 3.6 * open, 3.6, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.95)';
            ctx.beginPath();
            ctx.ellipse(cx + s * 17 * open, cy - 15.5, 1.4 * open, 1.4, 0, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        // body + antennae
        ctx.fillStyle = 'rgba(50,38,60,0.9)';
        ctx.beginPath();
        ctx.ellipse(cx, cy + 4, 2.4, 13, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx, cy - 10, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(50,38,60,0.85)';
        ctx.lineWidth = 1.2;
        for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(cx + s, cy - 12);
          ctx.quadraticCurveTo(cx + s * 6, cy - 24, cx + s * 9, cy - 25);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(cx + s * 9.5, cy - 25, 1.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    },
    [
      { name: 'open', x: 0, w: 90 },
      { name: 'half', x: 90, w: 90 },
      { name: 'shut', x: 180, w: 90 },
    ],
  );
  // a soft contact shadow
  mk('amb-shadow', 64, 20, (ctx) => {
    const g = ctx.createRadialGradient(32, 10, 0, 32, 10, 32);
    g.addColorStop(0, 'rgba(30,20,40,0.55)');
    g.addColorStop(0.55, 'rgba(30,20,40,0.28)');
    g.addColorStop(1, 'rgba(30,20,40,0)');
    ctx.fillStyle = g;
    ctx.save();
    ctx.scale(1, 20 / 64);
    ctx.fillRect(0, 0, 64, 64);
    ctx.restore();
  });
  // sun glow, light shaft and vignette
  mk('amb-glow', 128, 128, (ctx) => {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,250,225,1)');
    g.addColorStop(0.3, 'rgba(255,240,200,0.45)');
    g.addColorStop(1, 'rgba(255,240,200,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  });
}

export class Ambience {
  private birds: Bird[] = [];
  private flies: Fly[] = [];
  private nextFlock = 2;
  private shadows = new Map<Phaser.GameObjects.GameObject, Phaser.GameObjects.Image>();
  private glow: Phaser.GameObjects.Image;
  private t = 0;
  private readonly arctic: boolean;
  /** Plop Invasion: flies buzzing about instead of butterflies, drab birds. */
  private readonly stinky: boolean;
  /** Under the sea (a level with water): its own life and light instead of birds, butterflies and sun. */
  readonly sea: SeaLife | null;

  constructor(
    private scene: Phaser.Scene,
    levelId: number,
    /** First solid ground below a point (or null) — for shadows and butterflies. */
    private groundBelow: (x: number, y: number, max: number) => number | null,
    /** Under the sea: the water's surface (world y) and the level's width. */
    water?: { surface: number; width: number; dark?: [number, number] },
  ) {
    makeTextures(scene);
    this.arctic = levelId === 2;
    this.stinky = levelId === 3 || levelId === 4;
    this.glow = scene.add.image(0, 0, 'amb-glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.clouds - 1).setAlpha(0.55);
    this.sea = water ? new SeaLife(scene, water.surface, water.width, groundBelow, water.dark) : null;
    if (this.sea) this.glow.setVisible(false);
    // (no light shafts or vignette any more: each was a whole extra screenful to draw every frame,
    // for an effect you could hardly see)
  }

  /** Give a character a soft shadow on the ground under it. */
  shadowFor(obj: Phaser.GameObjects.GameObject) {
    if (this.shadows.has(obj)) return;
    this.shadows.set(obj, this.scene.add.image(0, 0, 'amb-shadow').setDepth(DEPTH.tiles + 0.6));
  }

  update(view: View, dt: number, targets: { obj: Phaser.GameObjects.GameObject; x: number; bottom: number; w: number; alive: boolean }[]) {
    this.t += dt;
    const t = this.t;

    // ── light ──
    this.glow.setPosition(view.left + view.width * 0.82, view.top + view.height * 0.08).setScale((view.width / 128) * 0.9 * (1 + Math.sin(t * 0.6) * 0.04));

    // ── shadows ──
    for (const [obj, sh] of this.shadows) {
      const tg = targets.find((q) => q.obj === obj);
      if (!tg || !obj.active || !tg.alive) {
        sh.setVisible(false);
        if (!obj.active) {
          sh.destroy();
          this.shadows.delete(obj);
        }
        continue;
      }
      const gy = this.groundBelow(tg.x, tg.bottom - 4, 220);
      if (gy === null) {
        sh.setVisible(false);
        continue;
      }
      const h = Math.max(0, gy - tg.bottom);
      const k = 1 - Math.min(1, h / 220);
      sh.setVisible(true).setPosition(tg.x, gy + 1).setDisplaySize(tg.w * (1.45 - 0.5 * (1 - k)), 12 * (0.6 + 0.4 * k)).setAlpha(k);
    }

    // ── under the sea: fish, jellyfish, light from the surface (no birds or butterflies) ──
    if (this.sea) {
      this.sea.update(view, dt, targets[0] ? { x: targets[0].x, y: targets[0].bottom - 20 } : null);
      return;
    }

    // ── birds: a little flock now and then, far off in the sky ──
    this.nextFlock -= dt;
    if (this.nextFlock <= 0 && this.birds.length < 12) {
      this.nextFlock = 7 + Math.random() * 9;
      const dir = Math.random() < 0.6 ? 1 : -1;
      const n = 2 + Math.floor(Math.random() * 4);
      const y0 = view.top + view.height * (0.1 + Math.random() * 0.25);
      const depthK = 0.45 + Math.random() * 0.35; // farther birds are smaller and slower
      for (let i = 0; i < n; i++) {
        const img = this.scene.add
          .image(0, 0, 'amb-bird', 'up')
          .setDepth(DEPTH.clouds + 2)
          .setTint(this.arctic ? (i % 2 ? 0xffffff : 0xeef3fb) : this.stinky ? [0x8a7a6a, 0x6e6458, 0x9a8a72][i % 3] : [0x8fc8ff, 0xffb3c6, 0xffe17a, 0xb9f0d0][(i + Math.floor(y0)) % 4]);
        this.birds.push({
          img,
          x: dir > 0 ? -60 - i * 26 : view.width + 60 + i * 26,
          y: y0 - view.top + (i % 2 ? 14 : -6) * i * 0.6,
          vx: dir * (55 + Math.random() * 25) * depthK * 1.4,
          ph: Math.random() * 6,
          flap: 7 + Math.random() * 3,
          depthK,
        });
      }
    }
    this.birds = this.birds.filter((b) => {
      b.x += b.vx * dt;
      b.ph += dt;
      const glide = Math.sin(b.ph * 0.9) > 0.55; // they glide for a moment now and then
      const fi = Math.floor(b.ph * b.flap * 2) % 4;
      b.img.setFrame(glide ? 'mid' : ['up', 'mid', 'down', 'mid'][fi]);
      b.img
        .setPosition(view.left + b.x, view.top + b.y + Math.sin(b.ph * 1.7) * 6)
        .setScale(0.36 * b.depthK)
        .setFlipX(b.vx < 0)
        .setAlpha(this.arctic ? 0.95 : 0.8);
      const gone = b.x < -120 || b.x > view.width + 120;
      if (gone) b.img.destroy();
      return !gone;
    });

    // ── butterflies flitting over the ground near you ──
    if (this.flies.length < (this.stinky ? 7 : 4) && Math.random() < dt * (this.stinky ? 1.5 : 0.5)) {
      const x = view.left + view.width * (0.1 + Math.random() * 0.8);
      const gy = this.groundBelow(x, view.top + 10, view.height);
      if (gy !== null && gy < view.top + view.height - 20) {
        // soft, gentle colours (cabbage whites, pale lemons, faded lilac and peach)
        const cols = this.arctic ? [0xffffff, 0xeef5ff, 0xdcecff, 0xf4f8ff] : this.stinky ? [0x3a3440, 0x2e3a2e, 0x443a30] : [0xffffff, 0xfff4c8, 0xf0e6ff, 0xffe8da, 0xe8f4ff, 0xfffbe8];
        // (Plop Invasion: little dark flies, low over the ground, zipping about)
        const img = this.scene.add.image(x, gy - 40, 'amb-fly', 'open').setDepth(DEPTH.decor + 1).setScale(this.stinky ? 0.13 : 0.24).setTint(cols[Math.floor(Math.random() * cols.length)]).setAlpha(0);
        const fast = this.stinky ? 2.6 : 1;
        this.flies.push({ img, x, y: gy - 30 - Math.random() * 50, home: gy + (this.stinky ? 18 : 0), vx: (Math.random() < 0.5 ? -1 : 1) * (14 + Math.random() * 18) * fast, ph: Math.random() * 6, t: 0, life: 10 + Math.random() * 10 });
      }
    }
    this.flies = this.flies.filter((f) => {
      f.t += dt;
      f.ph += dt;
      f.x += (f.vx + Math.sin(f.ph * 1.3) * 30) * dt;
      const gy = this.groundBelow(f.x, f.y - 60, 260);
      if (gy !== null) f.home += (gy - f.home) * Math.min(1, dt * 2);
      f.y += ((f.home - 40 + Math.sin(f.ph * 0.8) * 22) - f.y) * Math.min(1, dt * 1.5);
      const fi = Math.floor(f.ph * 18) % 4;
      const fade = Math.min(1, f.t, f.life - f.t);
      f.img
        .setFrame(['open', 'half', 'shut', 'half'][fi])
        .setPosition(f.x, f.y + Math.sin(f.ph * 9) * 2.5)
        .setAlpha(Math.max(0, fade) * 0.95)
        .setRotation(Math.sin(f.ph * 2) * 0.25);
      const off = f.x < view.left - 100 || f.x > view.left + view.width + 100;
      if (f.t > f.life || off) {
        f.img.destroy();
        return false;
      }
      return true;
    });
  }
}
