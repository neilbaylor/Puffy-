import Phaser from 'phaser';
import { DEPTH } from '../config';

/**
 * Life and light for the platforming levels (purely visual, no gameplay):
 *  - little flocks of birds flapping across the sky far away, and butterflies
 *    fluttering over the ground near you (Part 2: snow buntings and pale
 *    ice-blue butterflies),
 *  - soft contact shadows under the heroes and bad guys (they shrink and fade
 *    as you jump higher),
 *  - warm sunlight: a glow in the corner of the sky, slow drifting light
 *    shafts, and a gentle vignette.
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
  // a bird: two frames (wings up / wings down), drawn white so it can be tinted
  mk(
    'amb-bird',
    100,
    34,
    (ctx) => {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const [ox, up] of [[0, 1], [50, -1]] as const) {
        const cx = ox + 25;
        const cy = 17;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.ellipse(cx, cy, 7, 3.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + 7, cy - 1.5, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3.4;
        ctx.beginPath();
        ctx.moveTo(cx - 13, cy - up * 11);
        ctx.quadraticCurveTo(cx - 6, cy - up * 6, cx - 1, cy);
        ctx.quadraticCurveTo(cx + 5, cy - up * 7, cx + 12, cy - up * 12);
        ctx.stroke();
        // dark wing tips (the tint keeps them darker than the body)
        ctx.strokeStyle = 'rgba(0,0,0,0.55)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cx - 13, cy - up * 11);
        ctx.lineTo(cx - 9, cy - up * 8.5);
        ctx.moveTo(cx + 12, cy - up * 12);
        ctx.lineTo(cx + 8.5, cy - up * 9.5);
        ctx.stroke();
      }
    },
    [
      { name: 'up', x: 0, w: 50 },
      { name: 'down', x: 50, w: 50 },
    ],
  );
  // a butterfly: wings open / closed
  mk(
    'amb-fly',
    56,
    24,
    (ctx) => {
      for (const [ox, open] of [[0, 1], [28, 0.25]] as const) {
        const cx = ox + 14;
        const cy = 12;
        ctx.fillStyle = '#fff';
        for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.ellipse(cx + s * 5.5 * open, cy - 3, 6 * open + 1.2, 6, s * 0.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.ellipse(cx + s * 4 * open, cy + 4, 4.2 * open + 1, 4, -s * 0.4, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(cx - 0.9, cy - 6, 1.8, 13);
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.arc(cx + s * 6 * open, cy - 4, 1.6 * open + 0.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    },
    [
      { name: 'open', x: 0, w: 28 },
      { name: 'shut', x: 28, w: 28 },
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
  mk('amb-shaft', 64, 256, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 64, 0);
    g.addColorStop(0, 'rgba(255,250,230,0)');
    g.addColorStop(0.5, 'rgba(255,250,230,1)');
    g.addColorStop(1, 'rgba(255,250,230,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 256);
    const v = ctx.createLinearGradient(0, 0, 0, 256);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, 64, 256);
  });
  mk('amb-vignette', 256, 256, (ctx) => {
    const g = ctx.createRadialGradient(128, 128, 70, 128, 128, 182);
    g.addColorStop(0, 'rgba(40,20,60,0)');
    g.addColorStop(1, 'rgba(40,20,60,1)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
  });
}

export class Ambience {
  private birds: Bird[] = [];
  private flies: Fly[] = [];
  private nextFlock = 2;
  private shadows = new Map<Phaser.GameObjects.GameObject, Phaser.GameObjects.Image>();
  private glow: Phaser.GameObjects.Image;
  private shafts: Phaser.GameObjects.Image[] = [];
  private vignette: Phaser.GameObjects.Image;
  private t = 0;
  private readonly arctic: boolean;

  constructor(
    private scene: Phaser.Scene,
    levelId: number,
    /** First solid ground below a point (or null) — for shadows and butterflies. */
    private groundBelow: (x: number, y: number, max: number) => number | null,
  ) {
    makeTextures(scene);
    this.arctic = levelId === 2;
    this.glow = scene.add.image(0, 0, 'amb-glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.clouds - 1).setAlpha(0.55);
    for (let i = 0; i < 3; i++)
      this.shafts.push(scene.add.image(0, 0, 'amb-shaft').setOrigin(0.5, 0).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.near + 1).setAlpha(0));
    this.vignette = scene.add.image(0, 0, 'amb-vignette').setDepth(DEPTH.text - 1).setAlpha(0.16);
  }

  /** Give a character a soft shadow on the ground under it. */
  shadowFor(obj: Phaser.GameObjects.GameObject) {
    if (this.shadows.has(obj)) return;
    this.shadows.set(obj, this.scene.add.image(0, 0, 'amb-shadow').setDepth(DEPTH.tiles + 0.6));
  }

  update(view: View, dt: number, targets: { obj: Phaser.GameObjects.GameObject; x: number; bottom: number; w: number; alive: boolean }[]) {
    this.t += dt;
    const t = this.t;
    const cx = view.left + view.width / 2;
    const cy = view.top + view.height / 2;

    // ── light ──
    this.glow.setPosition(view.left + view.width * 0.82, view.top + view.height * 0.08).setScale((view.width / 128) * 0.9 * (1 + Math.sin(t * 0.6) * 0.04));
    this.shafts.forEach((s, i) => {
      const k = i / 3;
      s.setPosition(view.left + view.width * (0.55 + k * 0.28) + Math.sin(t * 0.07 + i) * 40, view.top - 30)
        .setDisplaySize(view.width * (0.12 + 0.05 * Math.sin(t * 0.2 + i * 2)), view.height * 1.25)
        .setRotation(0.38 + 0.04 * Math.sin(t * 0.11 + i))
        .setAlpha((this.arctic ? 0.07 : 0.09) * (0.6 + 0.4 * Math.sin(t * 0.17 + i * 1.7)));
    });
    this.vignette.setPosition(cx, cy).setDisplaySize(view.width * 1.2, view.height * 1.2);

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

    // ── birds: a little flock now and then, far off in the sky ──
    this.nextFlock -= dt;
    if (this.nextFlock <= 0 && this.birds.length < 12) {
      this.nextFlock = 7 + Math.random() * 9;
      const dir = Math.random() < 0.6 ? 1 : -1;
      const n = 2 + Math.floor(Math.random() * 4);
      const y0 = view.top + view.height * (0.1 + Math.random() * 0.25);
      const depthK = 0.45 + Math.random() * 0.35; // farther birds are smaller and slower
      for (let i = 0; i < n; i++) {
        const img = this.scene.add.image(0, 0, 'amb-bird', 'up').setDepth(DEPTH.clouds + 2).setTint(this.arctic ? (i % 2 ? 0xffffff : 0xf2f4fa) : i % 3 === 0 ? 0x5a4a6a : 0x6e5c80);
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
      b.img.setFrame(glide ? 'up' : Math.floor(b.ph * b.flap) % 2 ? 'up' : 'down');
      b.img
        .setPosition(view.left + b.x, view.top + b.y + Math.sin(b.ph * 1.7) * 6)
        .setScale(0.42 * b.depthK)
        .setFlipX(b.vx < 0)
        .setAlpha(this.arctic ? 0.95 : 0.8);
      const gone = b.x < -120 || b.x > view.width + 120;
      if (gone) b.img.destroy();
      return !gone;
    });

    // ── butterflies flitting over the ground near you ──
    if (this.flies.length < 4 && Math.random() < dt * 0.5) {
      const x = view.left + view.width * (0.1 + Math.random() * 0.8);
      const gy = this.groundBelow(x, view.top + 10, view.height);
      if (gy !== null && gy < view.top + view.height - 20) {
        const cols = this.arctic ? [0xcfe8ff, 0xffffff, 0xa8d4ff, 0xe6f2ff] : [0xffd23f, 0xff8fb3, 0xff9a3c, 0x8fd0ff, 0xc9a2ff];
        const img = this.scene.add.image(x, gy - 40, 'amb-fly', 'open').setDepth(DEPTH.decor + 1).setScale(0.5).setTint(cols[Math.floor(Math.random() * cols.length)]).setAlpha(0);
        this.flies.push({ img, x, y: gy - 30 - Math.random() * 50, home: gy, vx: (Math.random() < 0.5 ? -1 : 1) * (14 + Math.random() * 18), ph: Math.random() * 6, t: 0, life: 10 + Math.random() * 10 });
      }
    }
    this.flies = this.flies.filter((f) => {
      f.t += dt;
      f.ph += dt;
      f.x += (f.vx + Math.sin(f.ph * 1.3) * 30) * dt;
      const gy = this.groundBelow(f.x, f.y - 60, 260);
      if (gy !== null) f.home += (gy - f.home) * Math.min(1, dt * 2);
      f.y += ((f.home - 40 + Math.sin(f.ph * 0.8) * 22) - f.y) * Math.min(1, dt * 1.5);
      const flap = Math.floor(f.ph * 14) % 2;
      const fade = Math.min(1, f.t, f.life - f.t);
      f.img
        .setFrame(flap ? 'open' : 'shut')
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
